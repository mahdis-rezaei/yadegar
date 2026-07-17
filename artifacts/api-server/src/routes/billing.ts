import { Router } from "express";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { rateLimit } from "../lib/rate-limit";
import { sendEmail, membershipWelcomeEmail } from "../lib/email";

// Phase 2 — Stripe membership. The webhook is the SOURCE OF TRUTH for users.plan;
// checkout/portal just hand the user off to Stripe-hosted pages. Everything here
// no-ops gracefully (503 "billing not configured") until the four env vars are set
// — STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_MONTHLY,
// STRIPE_PRICE_ANNUAL — so the app runs unchanged before Stripe is wired.

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:5173").replace(/\/+$/, "");
}

// current_period_end lives on the subscription in older API versions and on the
// first subscription item in newer ones (Basil, 2025-03+). Read both so the
// renewal date survives an API-version change.
function periodEnd(sub: Stripe.Subscription): Date | null {
  const item = sub.items?.data?.[0] as { current_period_end?: number } | undefined;
  const ts =
    item?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end;
  return typeof ts === "number" ? new Date(ts * 1000) : null;
}

// Reconcile a user's plan from a Stripe subscription. Active/trialing → member;
// anything else (canceled, unpaid, past_due, incomplete_expired) → free. Looked up
// by stripe_customer_id, which checkout persisted before the first webhook. Never
// touches the user's pages — a lapsed member keeps everything, just loses the
// unlimited fresh-return allowance (the quota gate then applies).
async function applySubscription(sub: Stripe.Subscription): Promise<void> {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const active = sub.status === "active" || sub.status === "trialing";
  await db
    .update(usersTable)
    .set({
      plan: active ? "member" : "free",
      planRenewsAt: active ? periodEnd(sub) : null,
      stripeSubscriptionId: sub.id,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.stripeCustomerId, customerId));
}

function billingEnabled(): boolean {
  return (
    stripe != null &&
    !!process.env.STRIPE_PRICE_MONTHLY &&
    !!process.env.STRIPE_PRICE_ANNUAL
  );
}

// Create a fresh Stripe customer for the user and persist its id. Called both for
// a first-time checkout and to self-heal a stale stored id (see checkout below).
async function createCustomerFor(user: {
  id: string;
  email: string;
}): Promise<string> {
  const customer = await stripe!.customers.create({
    email: user.email,
    metadata: { userId: user.id },
  });
  await db
    .update(usersTable)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));
  return customer.id;
}

function newCheckoutSession(customerId: string, price: string, userId: string) {
  return stripe!.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: userId,
    line_items: [{ price, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${appUrl()}/settings/plan?status=success`,
    cancel_url: `${appUrl()}/settings/plan?status=cancelled`,
  });
}

const router = Router();

// GET /billing/config — public, unauthenticated. Lets the client show the real
// purchase UI only once Stripe is actually wired (else a gentle "coming soon"),
// so the Phase 2 page can ship before the keys are set without a dead CTA.
router.get("/billing/config", (_req, res): void => {
  res.json({ enabled: billingEnabled() });
});

// POST /billing/checkout { interval: "monthly" | "annual" } → { url }
// Creates (or reuses) the user's Stripe customer and a subscription Checkout
// Session, returning the hosted URL for the client to redirect to.
router.post("/billing/checkout", requireAuth, async (req, res): Promise<void> => {
  if (!stripe) {
    res.status(503).json({ error: "Billing is not configured yet" });
    return;
  }
  const interval =
    (req.body as { interval?: string })?.interval === "annual"
      ? "annual"
      : "monthly";
  const price =
    interval === "annual"
      ? process.env.STRIPE_PRICE_ANNUAL
      : process.env.STRIPE_PRICE_MONTHLY;
  if (!price) {
    res.status(503).json({ error: "Billing is not configured yet" });
    return;
  }

  try {
    const user = req.user!;
    const hadStoredCustomer = !!user.stripeCustomerId;
    let customerId = user.stripeCustomerId ?? (await createCustomerFor(user));

    let session;
    try {
      session = await newCheckoutSession(customerId, price, user.id);
    } catch (err) {
      // A stored customer id can go stale — most commonly when it was created
      // under a TEST key and the app later switched to a LIVE key, so the
      // customer no longer exists in the current Stripe account. Rather than
      // dead-ending the user, recreate the customer once and retry. (Only when we
      // were reusing a STORED id, so a genuinely missing price still surfaces.)
      if (
        hadStoredCustomer &&
        err instanceof Stripe.errors.StripeInvalidRequestError &&
        err.code === "resource_missing"
      ) {
        req.log.warn(
          { userId: user.id, staleCustomer: customerId },
          "Stored Stripe customer missing — recreating and retrying checkout",
        );
        customerId = await createCustomerFor(user);
        session = await newCheckoutSession(customerId, price, user.id);
      } else {
        throw err;
      }
    }
    res.json({ url: session.url });
  } catch (err) {
    req.log.error({ err }, "Checkout session failed");
    res.status(500).json({ error: "Could not start checkout" });
  }
});

// POST /billing/portal → { url } — the Stripe Billing Portal to update payment,
// switch monthly/annual, or cancel. Source of truth stays the webhook.
router.post("/billing/portal", requireAuth, async (req, res): Promise<void> => {
  if (!stripe) {
    res.status(503).json({ error: "Billing is not configured yet" });
    return;
  }
  const user = req.user!;
  if (!user.stripeCustomerId) {
    res.status(400).json({ error: "No membership to manage" });
    return;
  }
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appUrl()}/settings/plan`,
    });
    res.json({ url: session.url });
  } catch (err) {
    req.log.error({ err }, "Billing portal session failed");
    res.status(500).json({ error: "Could not open the billing portal" });
  }
});

// POST /billing/webhook — Stripe → us. Mounted with a RAW body parser (see app.ts)
// so the signature verifies. This is the authority for plan changes; checkout's
// success redirect is only a UX hint. Always 2xx on a handled event so Stripe
// stops retrying; 400 only on a bad signature.
router.post("/billing/webhook", async (req, res): Promise<void> => {
  if (!stripe) {
    res.status(503).end();
    return;
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers["stripe-signature"];
  if (!secret || typeof sig !== "string") {
    res.status(400).send("Missing signature");
    return;
  }

  let event: Stripe.Event;
  try {
    // req.body is a Buffer here (raw parser), exactly what constructEvent needs.
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, secret);
  } catch (err) {
    req.log.error({ err }, "Stripe webhook signature verification failed");
    res.status(400).send("Invalid signature");
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;
        // Look up the user once — for the welcome email AND to know whether this
        // is a genuinely NEW membership (so a redelivered event can't re-send it).
        let recipient: { email: string; name: string | null } | null = null;
        let wasMember = false;
        if (userId) {
          const [u] = await db
            .select({
              email: usersTable.email,
              name: usersTable.name,
              plan: usersTable.plan,
            })
            .from(usersTable)
            .where(eq(usersTable.id, userId));
          if (u) {
            recipient = { email: u.email, name: u.name };
            wasMember = u.plan === "member";
          }
        }
        // Persist the customer id against the user (idempotent) so later
        // subscription events resolve by customer.
        if (userId && customerId) {
          await db
            .update(usersTable)
            .set({ stripeCustomerId: customerId, updatedAt: new Date() })
            .where(eq(usersTable.id, userId));
        }
        if (typeof session.subscription === "string") {
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          await applySubscription(sub);
        }
        // Warm welcome — best-effort, and only on the transition into membership
        // (not on a renewal or a redelivered event).
        if (!wasMember && recipient?.email) {
          sendEmail({
            to: recipient.email,
            ...membershipWelcomeEmail({ name: recipient.name }),
          }).catch((err) =>
            req.log.error({ err }, "Membership welcome email failed"),
          );
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await applySubscription(event.data.object);
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (err) {
    req.log.error({ err, type: event.type }, "Stripe webhook handler error");
    // 500 so Stripe retries — the event was authentic, our handling failed.
    res.status(500).json({ error: "Webhook handling failed" });
  }
});

// ── RevenueCat (iOS In-App Purchase) ─────────────────────────────────────────
// iOS can't use Stripe checkout — Apple requires In-App Purchase — so app members
// subscribe via StoreKit, and RevenueCat reports the result here. This is the
// source of truth for plan on the Apple side, mirroring the Stripe webhook above.
// Secured by a shared secret: set the same value in the RevenueCat dashboard
// (Webhook → Authorization header) and the REVENUECAT_WEBHOOK_AUTH env. Inert
// (503) until that env is set, so the app runs unchanged before IAP is wired.
//
// The app sets RevenueCat's app_user_id to our users.id (Purchases.logIn), so an
// event maps straight to a user. FOLLOW-UP: a user who subscribes on BOTH web
// (Stripe) and iOS (Apple) isn't yet reconciled across sources — this sets plan
// from the Apple entitlement alone. Fine for a mobile-first launch; track
// per-source state before dual-subscription becomes common.

type RevenueCatEvent = {
  type?: string;
  app_user_id?: string;
  expiration_at_ms?: number;
};

// Event types that mean the entitlement is (now) active.
const RC_GRANTS_MEMBER = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
]);

// The RevenueCat entitlement that grants membership — must match the mobile
// client's ENTITLEMENT_ID (lib/purchases.ts) and the dashboard entitlement.
const RC_ENTITLEMENT_ID = "member";

router.post("/billing/revenuecat", async (req, res): Promise<void> => {
  const auth = process.env.REVENUECAT_WEBHOOK_AUTH;
  if (!auth) {
    res.status(503).end();
    return;
  }
  if (req.header("authorization") !== auth) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const event = (req.body as { event?: RevenueCatEvent })?.event ?? {};
  const userId = event.app_user_id;
  if (!userId) {
    res.json({ received: true });
    return;
  }

  try {
    if (event.type && RC_GRANTS_MEMBER.has(event.type)) {
      await db
        .update(usersTable)
        .set({
          plan: "member",
          planRenewsAt:
            typeof event.expiration_at_ms === "number"
              ? new Date(event.expiration_at_ms)
              : null,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, userId));
    } else if (event.type === "EXPIRATION") {
      // Entitlement lapsed → drop to free. Pages are never touched; only the
      // unlimited fresh-return allowance goes (the quota gate then applies).
      await db
        .update(usersTable)
        .set({ plan: "free", planRenewsAt: null, updatedAt: new Date() })
        .where(eq(usersTable.id, userId));
    }
    // CANCELLATION (auto-renew off but still active until expiry) and
    // BILLING_ISSUE (grace period) intentionally leave plan unchanged —
    // EXPIRATION is what makes the downgrade final.
    res.json({ received: true });
  } catch (err) {
    req.log.error({ err, type: event.type }, "RevenueCat webhook handler error");
    res.status(500).json({ error: "Webhook handling failed" });
  }
});

// ── RevenueCat client-initiated sync (webhook-independent grant path) ─────────
// The webhook is asynchronous and out-of-band — if it's misconfigured, delayed,
// or dropped, a paying member's `plan` never flips and (once enforced) they'd be
// gated as free. So the app also calls this right after a purchase/restore: the
// server asks RevenueCat's REST API whether THIS user's `member` entitlement is
// active and, if so, flips the plan immediately. The app_user_id is our users.id
// (the client sets it via Purchases.configure), so req.userId is the subscriber.
//
// GRANTS ONLY — it never downgrades. A non-active Apple entitlement can simply
// mean the user pays on web (Stripe) or the subscription lapsed (the webhook's
// EXPIRATION handles that), so revoking here could wrongly strip a real member.
// Inert (no-op, returns the current plan) until REVENUECAT_SECRET_KEY is set.
const RC_API = "https://api.revenuecat.com/v1";

async function appleEntitlement(
  appUserId: string,
): Promise<{ active: boolean; expires: Date | null }> {
  const key = process.env.REVENUECAT_SECRET_KEY;
  if (!key) return { active: false, expires: null };
  const resp = await fetch(
    `${RC_API}/subscribers/${encodeURIComponent(appUserId)}`,
    { headers: { Authorization: `Bearer ${key}` } },
  );
  if (!resp.ok) {
    throw new Error(`RevenueCat subscriber fetch failed: ${resp.status}`);
  }
  const data = (await resp.json()) as {
    subscriber?: {
      entitlements?: Record<
        string,
        { expires_date?: string | null; grace_period_expires_date?: string | null }
      >;
    };
  };
  const ent = data.subscriber?.entitlements?.[RC_ENTITLEMENT_ID];
  if (!ent) return { active: false, expires: null };
  const now = Date.now();
  const expires = ent.expires_date ? new Date(ent.expires_date) : null;
  const grace = ent.grace_period_expires_date
    ? new Date(ent.grace_period_expires_date)
    : null;
  // Active if it never expires (non-renewing/lifetime), hasn't expired yet, or is
  // in its billing-issue grace period.
  const active =
    expires === null ||
    expires.getTime() > now ||
    (grace !== null && grace.getTime() > now);
  return { active, expires };
}

// A modest per-user cap: this makes an outbound RevenueCat call, so it must not
// be spammable. Normal use is one or two hits around a purchase.
const syncLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  keyOf: (req) => req.userId ?? req.ip ?? "anon",
  message: "Please slow down.",
});

router.post(
  "/billing/revenuecat/sync",
  requireAuth,
  syncLimiter,
  async (req, res): Promise<void> => {
    // Not configured — no-op so the client's opportunistic call is harmless; the
    // webhook remains the path.
    if (!process.env.REVENUECAT_SECRET_KEY) {
      res.json({ plan: req.user!.plan });
      return;
    }
    try {
      const { active, expires } = await appleEntitlement(req.userId!);
      if (active) {
        await db
          .update(usersTable)
          .set({ plan: "member", planRenewsAt: expires, updatedAt: new Date() })
          .where(eq(usersTable.id, req.userId!));
        res.json({ plan: "member" });
        return;
      }
      // Not active on Apple — leave the plan as-is (grant-only).
      res.json({ plan: req.user!.plan });
    } catch (err) {
      req.log.error({ err }, "RevenueCat sync failed");
      res.status(502).json({ error: "Could not verify membership" });
    }
  },
);

export default router;

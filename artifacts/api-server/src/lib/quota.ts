import { and, eq } from "drizzle-orm";
import { db, usageTable, usersTable, type User } from "@workspace/db";
import { monthStartUTC, REROLL_WINDOW_MS } from "./usage";
import { sendEmail, membershipLimitEmail } from "./email";

// Phase 1 — free-tier quota on the one costly thing: a FRESH AI return (a
// cache-miss /memories/run). Writing, keeping, importing, browsing, exporting, and
// date-based returns are always free and never metered. We gate the AI, never the
// journal.
//
// The billable counter is usage.freshReturns (incremented in usage.ts ONLY on a
// real model call, with rapid re-rolls already collapsed into one). This module
// reads that counter and decides whether the NEXT user-initiated run is allowed.

// Free allowance per calendar month — "about one a week". A new account gets a
// one-time onboarding bonus in its FIRST calendar month so the first session never
// hits a wall (the magic has to land before any limit does).
export const FREE_MONTHLY_RETURNS = 4;
export const ONBOARDING_BONUS = 3;

// Members are "unlimited" — but unlimited is priced on the AVERAGE member (~weekly
// use), so a fair-use CEILING bounds the abusive tail that would otherwise be an
// open-ended COGS cheque (each fresh return is a real ~$0.10 model read; the only
// other backstop is the 30/hour rate limiter). The ceiling is set far above any
// real cadence — ~6–7/day sustained — so a genuine member never meets it; it only
// clips runaway use. Tunable via env without a deploy. At this ceiling worst-case
// member COGS is bounded (~cap × $0.10/mo) instead of unbounded.
export const MEMBER_MONTHLY_CAP =
  Number(process.env.MEMBER_MONTHLY_CAP) > 0
    ? Number(process.env.MEMBER_MONTHLY_CAP)
    : 200;

// SHADOW BY DEFAULT. Until payments exist (Phase 2) a capped free user has no way
// to upgrade, so we METER and EXPOSE usage but never actually block. Flip
// STILL_QUOTA_ENFORCED=1 (the day membership is purchasable) to turn the gate from
// shadow into a real 402. Everything else — counter, usage summary, client nudge —
// already works; this is the single switch.
export const QUOTA_ENFORCED = process.env.STILL_QUOTA_ENFORCED === "1";

export class QuotaExceeded extends Error {
  constructor(
    readonly summary: UsageSummary,
    readonly enforced: boolean,
  ) {
    super("quota_exceeded");
    this.name = "QuotaExceeded";
  }
}

export interface UsageSummary {
  plan: "free" | "member";
  // Fresh returns counted this calendar month.
  used: number;
  // The effective monthly allowance (free: base + any onboarding bonus). null =
  // unlimited (members).
  limit: number | null;
  // Whether the user is currently at/over their DISPLAY allowance (false for
  // members — their fair-use ceiling is internal and never shown).
  atLimit: boolean;
  // Internal: at/over the ENFORCEMENT cap (free allowance OR the member fair-use
  // ceiling). Drives the gate; not part of the client-facing /auth/me payload.
  overCap: boolean;
  // ISO start of the counting period (this month, UTC).
  periodStart: string;
  // Last counted return (for re-roll grace); null if none this period.
  lastReturnAt: string | null;
}

// The effective monthly allowance for a free account: base + onboarding bonus
// during the account's first calendar month only.
function freeLimitFor(user: Pick<User, "createdAt">): number {
  const created = new Date(user.createdAt);
  const inFirstMonth =
    monthStartUTC(created).getTime() === monthStartUTC().getTime();
  return FREE_MONTHLY_RETURNS + (inFirstMonth ? ONBOARDING_BONUS : 0);
}

// Read the current month's usage for a user (no model calls — a single indexed
// row read). Safe to call on every /auth/me.
export async function getUsageSummary(
  user: Pick<User, "id" | "plan" | "createdAt">,
): Promise<UsageSummary> {
  const period = monthStartUTC();
  const [row] = await db
    .select({
      freshReturns: usageTable.freshReturns,
      lastReturnAt: usageTable.lastReturnAt,
    })
    .from(usageTable)
    .where(
      and(eq(usageTable.userId, user.id), eq(usageTable.periodStart, period)),
    );

  const used = row?.freshReturns ?? 0;
  const limit = user.plan === "member" ? null : freeLimitFor(user);
  // The cap actually enforced: the free allowance, or the member fair-use ceiling.
  const cap = user.plan === "member" ? MEMBER_MONTHLY_CAP : (limit ?? Infinity);
  return {
    plan: user.plan,
    used,
    limit,
    atLimit: limit != null && used >= limit,
    overCap: used >= cap,
    periodStart: period.toISOString(),
    lastReturnAt: row?.lastReturnAt ? new Date(row.lastReturnAt).toISOString() : null,
  };
}

// Gate the billable path. A user passes while under their enforcement cap — the
// free monthly allowance, or the member fair-use ceiling. At/over the cap they
// still pass if this run is a re-roll of the return they just got (within the same
// window usage.ts collapses for billing) — refining a return you already paid for
// must never be blocked. Only a genuinely NEW return past the cap is denied.
//
// In SHADOW mode (default) this never throws — it returns the summary so the
// caller/logs can see who WOULD have been blocked. When STILL_QUOTA_ENFORCED=1 it
// throws QuotaExceeded for a real over-cap new return (free OR member fair-use).
export async function assertCanRunMemory(
  user: Pick<User, "id" | "plan" | "createdAt">,
): Promise<UsageSummary> {
  const summary = await getUsageSummary(user);
  if (!summary.overCap) return summary;

  // At/over the cap — allow a re-roll of the just-counted return (grace), block a
  // new one.
  const lastMs = summary.lastReturnAt ? new Date(summary.lastReturnAt).getTime() : 0;
  const withinRerollGrace = lastMs > 0 && Date.now() - lastMs <= REROLL_WINDOW_MS;
  if (withinRerollGrace) return summary;

  if (QUOTA_ENFORCED) throw new QuotaExceeded(summary, true);
  return summary; // shadow: metered, not blocked
}

// Fire-and-forget lifecycle email: when a free user has just reached their monthly
// allowance, send the one high-intent invitation to membership. Sent at most once
// per period, never in shadow (the limit isn't real yet), never to members. Call
// after a user-initiated run has been counted.
export async function notifyIfAtLimit(userId: string): Promise<void> {
  if (!QUOTA_ENFORCED) return;
  try {
    const [user] = await db
      .select({
        email: usersTable.email,
        name: usersTable.name,
        plan: usersTable.plan,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    if (!user || user.plan === "member") return;

    const period = monthStartUTC();
    const [row] = await db
      .select({
        freshReturns: usageTable.freshReturns,
        limitNotifiedAt: usageTable.limitNotifiedAt,
      })
      .from(usageTable)
      .where(
        and(eq(usageTable.userId, userId), eq(usageTable.periodStart, period)),
      );

    const used = row?.freshReturns ?? 0;
    if (used < freeLimitFor(user)) return;

    // Already told them this period? (Compare against this period's start.)
    const notified = row?.limitNotifiedAt ? new Date(row.limitNotifiedAt) : null;
    if (notified && notified >= period) return;

    // Mark BEFORE sending so a concurrent run can't double-send.
    await db
      .update(usageTable)
      .set({ limitNotifiedAt: new Date() })
      .where(
        and(eq(usageTable.userId, userId), eq(usageTable.periodStart, period)),
      );

    await sendEmail({
      to: user.email,
      ...membershipLimitEmail({ name: user.name }),
    });
  } catch {
    // best-effort; a lifecycle email must never break the run path
  }
}

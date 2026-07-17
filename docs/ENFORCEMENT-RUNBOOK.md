# Runbook — turning on the free-tier quota (STILL_QUOTA_ENFORCED)

The quota gate is built and running in **shadow mode**: every fresh AI return is
metered, but nobody is ever blocked. This runbook flips it to real enforcement,
so a free user past their monthly allowance gets a gentle 402 (and the in-app
"Become a member" nudge) while members stay unlimited.

**Do not flip until BOTH are true:**
1. An app version whose paywall + quota upgrade CTA is **live in the App Store**
   (build 20 or later, approved and released) — otherwise capped users on the
   old app hit a wall with no upgrade path.
2. The RevenueCat webhook is **verified** to flip `users.plan` in prod (Step 1
   below). Without it, a paying member would be enforced as free.

Everything is reversible in seconds (Step 4).

---

## Step 0 — What enforcement changes

- Free allowance: **4 fresh returns / month**, plus a **+3 onboarding bonus** in
  the account's first calendar month (so a first session never hits a wall).
- Members: unlimited, with an internal fair-use ceiling (`MEMBER_MONTHLY_CAP`,
  default 200/mo) that only clips runaway automation — a real member never meets it.
- Never touched: writing, keeping, importing, exporting, browsing, and date-based
  "On this day" returns. We gate the AI, never the journal.
- Re-rolls of a return you just got are always allowed (no double-charging a
  refinement).

## Step 1 — Verify the backend `plan` flips in prod (the crux)

The client now shows membership from the local entitlement, so the UI looks right
even if the backend is behind. Enforcement, though, reads `users.plan` on the
server — so we must confirm a purchase actually writes it.

There are now **two** paths that set `plan = member`, so this is robust:
1. **Client-initiated sync (primary):** right after a purchase/restore the app
   calls `POST /api/billing/revenuecat/sync`; the server asks RevenueCat's REST
   API whether this user's `member` entitlement is active and flips the plan
   immediately. Requires the secret `REVENUECAT_SECRET_KEY` (RevenueCat dashboard
   → Project → API keys → **Secret** key). Inert (no-op) until it's set.
2. **Webhook (backstop):** RevenueCat → `POST /api/billing/revenuecat`, which also
   covers renewals and expirations. Requires `REVENUECAT_WEBHOOK_AUTH`.

Set **both** secrets before enforcing. Then verify end to end:

1. **Confirm the secret is set.** In Replit → Secrets, `REVENUECAT_WEBHOOK_AUTH`
   must exist (same value as the Authorization header configured on the
   RevenueCat webhook). If it's unset, `POST /api/billing/revenuecat` returns 503
   and no plan ever changes.
2. **Make a fresh sandbox purchase** on a TestFlight build with a test account.
3. **Check RevenueCat → the customer / Webhooks delivery log:** the
   `INITIAL_PURCHASE` event should show a delivery to our endpoint with a **200**
   response.
4. **Check the database** (Replit → the DB/SQL console):
   ```sql
   select email, plan, plan_renews_at from users where email = '<test account>';
   ```
   `plan` must read **member**. That's the proof the webhook wrote through.

If `plan` is still `free`: the webhook isn't reaching us or isn't authorized —
fix that before enforcing. Common causes: `REVENUECAT_WEBHOOK_AUTH` unset or
mismatched; webhook URL not `https://yadegarjournal.com/api/billing/revenuecat`;
the `app_user_id` on the RC customer isn't our `users.id` (it should be —
`configurePurchases` sets it at sign-in).

## Step 2 — Flip enforcement

In Replit → Secrets, set:
```
STILL_QUOTA_ENFORCED = 1
```
Then rebuild + restart api-server and republish. No code change, no migration.

## Step 3 — Verify enforcement live

- **Free account past its allowance** (a shadow-mode account that already ran
  more than its monthly count): trigger a fresh return → it should come back as
  the gentle quota state with the **"Become a member"** button, not an error, and
  the journal + returns shelf stay fully reachable.
- **Member account**: unaffected — fresh returns keep working.
- **A brand-new account**: still gets its first-month bonus, so onboarding isn't
  walled.
- Server logs: a blocked run logs the over-cap event; no 500s.

## Step 4 — Rollback (instant)

Set `STILL_QUOTA_ENFORCED = 0` (or delete the secret) and republish. Back to
shadow mode immediately — metered, never blocked. Nothing else to undo.

## Notes / knobs

- `MEMBER_MONTHLY_CAP` (env) tunes the member fair-use ceiling without a deploy.
- The at-limit lifecycle email (the one-time membership invitation) only sends
  once enforcement is on — it stays silent in shadow because the limit isn't real
  yet.
- Watch the first days after flipping: server logs show real demand against the
  cap, so you can tell whether 4/month is too tight before it costs conversions.

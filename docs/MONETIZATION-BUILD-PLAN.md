# Yadegar — Monetization Build Plan (phased)

*Companion to `docs/MONETIZATION-STRATEGY.md`. Concrete engineering plan to ship
freemium and cut per-return COGS. File paths are grounded in the current codebase;
line numbers are indicative — re-confirm at implementation time (the engine partly
runs in Replit). Corrections from the engine review are marked **[review]**.*

## Guiding decisions (from the strategy)
- **Gate the AI, never the journal.** Writing/keeping/importing/browsing/export
  stay unconditionally free.
- **The billable unit is a *fresh* AI return** (a `/memories/run` that causes a
  real model call — a cache miss). Cache hits and re-opens are free and uncounted.
- **Two plans:** `free` (~4 fresh returns/mo) and `member` (unlimited within a
  generous fair-use cap).
- **Never show tokens to users.** Express limits as "fresh returns."

---

## Phase 0 — COGS cuts + metering (internal only, ship first)

No user-facing change. Closes the spend leak and gives cost visibility *before*
anyone is charged. **Gate the whole phase behind the eval harness passing.**

### 0.1 Anthropic prompt caching on static system prompts
- **File:** `artifacts/api-server/src/routes/still.ts` — the `client.messages.create`
  calls for PASS 1 (~line 1248) and PASS 2 (~lines 1308/1417). No `cache_control`
  exists today (verified).
- **Change:** pass `system` as content blocks with `cache_control: { type:
  "ephemeral" }` on the large static `PASS1_SYSTEM` / `PASS2_SYSTEM` strings.
- **[review] Win is volume-dependent.** The cache TTL is ~5 min; writes cost
  ~1.25×, reads ~0.1×. At real traffic the static prompt stays warm → ~$0.11 →
  ~$0.085/return. **At launch/low volume the cache is often cold** (≈ no savings,
  marginally worse on a cold call). Ship it anyway (scales with you); just don't
  forecast the savings before there's steady traffic.
- **Risk:** none functional (identical text). Verify with the eval harness that
  outputs are unchanged.

### 0.2 Tier the model (within Anthropic)
- **File:** `still.ts` — single pinned `MODEL = "claude-sonnet-4-6"` (~line 17).
  Add `CLASSIFY_MODEL = "claude-haiku-4-5-20251001"` and use it for the
  **hard-floor** (~line 472) and **theme** (~line 513) calls only. **Keep Sonnet
  for extract, score, AND the crisis check** (~line 447) — crisis is safety-
  critical and cheap.
- **Win:** import classification ~$5 → ~$1.7 per 1,000 entries.
- **Risk:** classification quality. Spot-check hard-floor/theme on a fixture set
  before/after; hard-floor fails closed. **Do not move crisis to Haiku.**
- **Provider:** all journal-content calls stay on Anthropic (single data processor
  — privacy). The eval harness is the seam for any in-Anthropic swap.

### 0.2b Bound per-entry input (the abuse / fairness fix)
- **File:** `artifacts/api-server/src/lib/memory-engine.ts` (pool assembly) and the
  crisis-input assembly in `still.ts`.
- **Change:** cap the text fed to the model **per entry** to a representative
  window, and enforce a **total per-call input budget** (~30K tokens) that trims
  the longest entries first. Users may still *write* any length.
- **[review] Window by sentence-sampling, NOT "first ~800 tokens."** The resonant
  line can be anywhere in a long entry; naive head-truncation drops it for exactly
  the introspective long-form writers we most want. Use head + sampled middle +
  tail. This is also a **correctness** fix: extract/score already hit
  `stop_reason === "max_tokens"` on large pools (verified, ~lines 1266/1434) →
  truncated JSON → 500s.
- **[review] Crisis is exempt from aggressive truncation.** The crisis check reads
  the most-recent entry and weights it heaviest; truncating it risks a missed
  crisis (false negative). Give crisis a **much larger read budget** (recent entry
  nearly in full). Cost cap must never touch safety.
- **Win:** converts an unbounded cost vector into a fixed worst case (~$0.15 /
  fresh return) — the precondition for fair flat pricing.
- **Verify:** eval-harness parity on normal-length fixtures; **add a long-entry
  fixture** to confirm the window engages without breaking selection or crisis
  detection.

### 0.3 Lazy / deferred import classification
- **Files:** import path + the `/cron/tag-resurface-safety` job in `cron.ts`.
- **Change:** stop eagerly classifying every imported entry. Classify on first
  resurfacing-candidacy, or drain the backlog slowly with a low per-tick cap.
  `journal_entries.resurface_safety` already stores the verdict (fail-closed until
  tagged), so unclassified entries are safely withheld meanwhile.
- **Win:** import COGS becomes pay-as-used.

### 0.4 Usage metering (the prerequisite)
- **New schema:** `lib/db/src/schema/usage.ts` — a `usage` table keyed
  `unique(userId, periodStart)` with `freshReturns`, `inputTokens`,
  `outputTokens`, `estCostCents`, `updatedAt`. Register in `schema/index.ts`;
  generate a Drizzle migration (additive).
- **Engine must report whether it called the model.** Today the cache hit is only
  logged. Thread a boolean up: `still.ts` extract/score return `{ ..., cached:
  boolean, usage?: {input,output} }`; `memory-engine.ts` `runMemoryForUser()`
  returns `modelCalled: boolean` + aggregated `usage`.
- **Increment usage only on `modelCalled === true`**, in the `/memories/run`
  handler. Upsert the user's monthly `usage` row.
- **[review] Re-roll accounting (decide here, it's cheap now / painful later).**
  "What keeps returning" + "look again"/"show another" send `fresh: true` (verified
  in `what-keeps-returning.tsx`), so each re-roll is a real model call. If raw
  cache-miss counting stands, every re-roll consumes a free return. **Recommended:**
  treat re-rolls *of the same surfacing within a short window* (e.g. same session /
  N minutes) as one billable return — track a "surfacing id" or last-billed
  timestamp per user so the meter still maps to COGS without punishing exploration.
  Build this into the counter from day one, not after users complain.

**Phase 0 exit:** spend leak bounded + real metering live; per-return COGS down
~25–40% at volume; import COGS down ~⅔; re-roll metering decided.

---

## Phase 1 — Plans + free-tier quota enforcement

### 1.1 Plan fields on the user
- **File:** `lib/db/src/schema/users.ts` — add `plan` (`"free" | "member"`,
  default `free`), `planRenewsAt`, `stripeCustomerId` (unique), `stripeSubscriptionId`.
  Additive Drizzle migration.

### 1.2 Quota gate on the billable path
- **New:** `artifacts/api-server/src/lib/quota.ts` — `assertCanRunMemory(user)`:
  `member` → allow (subject to fair-use soft cap); `free` → allow if this month's
  `usage.freshReturns < FREE_MONTHLY_RETURNS` (default 4), else throw `QuotaExceeded`.
- **Wire in:** `memories.ts`, right after the existing `runLimiter` on
  `/memories/run`. Return HTTP `402`/`429` with a machine code (`quota_exceeded`)
  and a gentle message.
- **Order:** check runs *before* the engine; the counter increments *after*, only
  on a real model call (cache hits / re-rolls per §0.4 don't consume quota).

### 1.3 Fair-use ceiling for members
- In `quota.ts`, a soft per-day cap (e.g. ~6–8/day), reusing the existing gentle
  copy. Far above real cadence; caps tail abuse. No hard wall.

### 1.4 Expose plan + usage to the client
- **File:** `auth.ts` `GET /auth/me` — include `plan`, `planRenewsAt`, and
  `usage: { freshReturnsUsed, freshReturnsLimit }`.
- **[review] DO NOT run orval codegen.** Codegen is broken in this repo — a full
  `pnpm --filter @workspace/api-spec run codegen` collides on duplicate exports for
  the collections/capsules/shelf/look-back endpoints and breaks `tsc --build`.
  Instead **hand-patch** the generated `AuthUser` in
  `lib/api-client-react/src/generated/api.schemas.ts` (add `plan`, `planRenewsAt?`,
  `usage?`), and add the same fields to `lib/api-spec/openapi.yaml`'s `AuthUser`
  schema for spec accuracy — exactly as was done for `avatarColor` and
  `hasPassword`. The frontend auth context (`auth.tsx`) reads `AuthUser`, so the
  hand-patched type propagates.

### 1.5 Gentle upgrade surface (no payments yet — soft-launchable)
- Show an upgrade prompt when a free user is out of returns, triggered by the
  `quota_exceeded` response. Copy: *"You've used this week's return. Yadegar can
  keep reading across your years — [become a member]."*
- **Trigger points** already exist — `today.tsx` ("Bring a page back"),
  `what-keeps-returning.tsx`, `then-and-now.tsx`, `revisit-a-time.tsx`. Centralize
  handling of `quota_exceeded` in the memory-run hook (`lib/run-job.ts` /
  `run-memory` path) so all surfaces behave the same.

**Phase 1 exit:** free tier enforced and humane; membership presentable (even as
waitlist) before Stripe.

---

## Phase 2 — Payments (Stripe)

### 2.1 Backend
- **Deps/env:** `stripe` SDK; `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`.
- **New route:** `artifacts/api-server/src/routes/billing.ts`
  - `POST /billing/checkout` (auth) → Checkout Session for the chosen price.
  - `POST /billing/portal` (auth) → Billing Portal session (manage/cancel).
  - `POST /billing/webhook` (raw body, signature-verified) → on
    `checkout.session.completed` / `customer.subscription.updated|deleted`, set
    `users.plan` + `planRenewsAt` + `stripeSubscriptionId`. **The webhook is the
    source of truth for `plan`.**
- Mount with raw-body parsing for the webhook only; JSON elsewhere.

### 2.2 Frontend
- **New page:** `artifacts/still/src/pages/plan.tsx` at `/settings/plan` — current
  plan, this-period usage (as "fresh returns," never tokens), monthly/annual
  toggle, "Become a member" / "Manage membership". Add the route in `App.tsx`
  (consider `lazy()` if it pulls Stripe.js), and a "Membership" card in
  `settings.tsx` + an optional account-menu link in `app-nav.tsx`.

### 2.3 Plan downgrade handling
- On subscription end, webhook flips `plan` → `free`; the quota gate then applies.
  **Never delete or lock the user's pages.**

**Phase 2 exit:** end-to-end paid conversion live, annual-first.

---

## Phase 3 — Polish & guardrails
- **Top-up credits** (optional secondary) for users past fair use.
- **Admin/COGS dashboard:** aggregate `usage` → cost per user / per feature.
- **Trials / annual incentive:** 7-day full-access trial; founding-member discount.
- **`PROMPT_VERSION` cost awareness:** bumping it invalidates the result cache →
  cold-return spike. Schedule bumps and pre-warm.
- **Multi-instance readiness:** the rate limiter is in-memory/single-instance; move
  counters to Postgres (`usage` already is) or Redis before scaling horizontally.

---

## Rollout sequencing
1. **Phase 0** — ship now; pure savings + visibility, zero user impact.
2. **Phase 1** — gate the leak humanely.
3. **Phase 2** — turn on revenue.
4. **Phase 3** — optimize and harden.

## Test & verification
- **Engine parity** after prompt-caching / Haiku / read-window changes: run the
  eval harness (`pnpm --filter @workspace/scripts run eval`, or live
  `STILL_MODE=http`). Add a **long-entry fixture** for the read window, and confirm
  crisis detection still fires on a crisis-in-a-long-entry fixture.
- **Quota logic:** unit-test `quota.ts` (free under/over; member fair-use; cache
  hit and same-surfacing re-roll do NOT consume quota).
- **Stripe webhook:** test-mode subscribe/renew/cancel → assert `users.plan`
  transitions and that pages are never locked.
- **`pnpm run typecheck` (root)** before every push (it rebuilds libs first; the
  per-package `still` typecheck false-errors on stale lib `.d.ts`).

## Decisions (locked)
- **Free allowance:** 4 fresh returns/month, framed "about one a week," + a small
  onboarding bonus (~first 3). **Re-rolls of the same surfacing don't each count
  (§0.4) — confirm before launch.**
- **Price:** $8/mo or $59/yr (annual-first ≈ $4.92/mo).
- **Year keepsake:** basic print/PDF of your own year is **free**; a *designed*
  multi-year/physical Book is the member perk. (Raw export always free.)
- **Provider:** all journal content on Anthropic; Sonnet for prose + crisis, Haiku
  for hard-floor + theme.
- **Per-return cost bounded** via the sentence-sampled read window (§0.2b), crisis
  exempted — the basis for flat pricing being fair.
- **No codegen** — hand-patch generated types (§1.4).

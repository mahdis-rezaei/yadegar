# Yadegar — an AI journaling companion that knows when to stay silent

**A solo-built, production LLM product — engine, eval harness, safety guardrails, and business model.**

> Live at **yadegarjournal.com** (web) and on the **iOS App Store**. A contemplative
> journaling companion that reads years of your private entries and surfaces *one*
> thing worth returning to today — a thread, a forgotten page, a distance travelled —
> always in your own words, and **stays silent when nothing honest surfaces.**

**Role:** Sole owner — product, design, AI/eval engineering, full-stack, infra, mobile, and monetization.
**Status:** Launched and live. Web since June 2026; iOS shipped (survived an App Store rejection→fix→approval); a subscription/membership update in review.
**Stack:** Two-pass LLM engine (Claude) · Express/Postgres API · React SPA · Expo/React-Native iOS · Stripe + Apple IAP (RevenueCat) · a CI eval harness.

---

## 1. The problem, and the thesis

Every journaling app remembers what *happened*. Yadegar tries to remember what *endured*.

People reopen old journals not for analytics but to ask: *What was I thinking? What mattered? How far have I come? What survived?* The product bet is that a well-calibrated model can answer that — surfacing the continuity you can't see from inside a single entry — **if and only if** it has the taste and safety to know when to speak and when to keep quiet.

The distinction the entire product hangs on:

- **What happened = the wound.** Surfacing it unbidden is an *ambush* — pain without perspective.
- **What endured = the thread.** Surfacing it is a *gift* — a continuity the writer couldn't see alone.

A well-built app with bad calibration is just *"an ambush machine with beautiful typography."* Avoiding that — not the CRUD, not the UI — was the actual job. The governing product rule, which everything technical descends from:

> **Offer the meaning, never push the moment.**

**A deliberate anti-metrics stance.** No streaks, feeds, likes, mood scores, or engagement dashboards. Positioned as *librarian, never therapist/coach/guru*. The success signal is a user saying **"I forgot I wrote that"** or **"that's true"** — recognition, *not* "wow." That reframing of success (away from DAU/session-length toward *recognition rate*) drove every downstream decision, including actively **suppressing** compulsive use.

---

## 2. The AI engine — the core bet

The engine is a **two-pass** model pipeline plus small classifiers, run as an internal service.

**Pass 1 — extract.** Runs a crisis check *first* (see §3), then does **deterministic sentence segmentation** server-side: entries are split into numbered sentences and the model selects candidates *by index* — it never types a quote itself, killing a whole class of nondeterminism (paraphrase, hallucinated quotes, sub-clause carving). It **over-collects on purpose** (8–15 candidates): "a line wrongly included costs nothing — Pass 2 drops it; a line wrongly excluded is invisible forever."

**Pass 2 — score.** Four pass/fail **gates** (safety floors, perspective, textual evidence, displayable quote) applied *before* ranking, then five 1–5 **axes** — emotional center (master), specificity, discovery, contradiction, worth-returning-to — plus a **resolution penalty**: self-reassurances and motivational conclusions are demoted, because *"the conclusion is what the writer wanted to believe; the observation is where the truth slipped out — prefer the escaped truth."* It returns exactly **one** result, or **nothing**.

**Why two passes:** it's the single most important architectural decision — it makes every failure *locatable*. A missed line is an *extraction* bug; a wrong pick is a *scoring* bug. This paid off immediately: the best line in a test archive ("Until when should I live in another 6 bodies?") was losing not because scoring ranked it low but because **it was never extracted** — no scoring change could ever have fixed it.

**Design decisions that show the judgment:**

- **Silence is a first-class output**, not a failure. A logistics list, a thin line, "got the job!" — none are surfaceable. *"A companion that always finds something profound is a fortune teller."*
- **Threads key on the persistence of a *function*, not a phrase** — a 2015 "take a deep breath" and a 2018 "hold the pen" are *one* thread (the same self-steadying move), though they share no words. With a guard against manufacturing threads from unrelated logistics.
- **Determinism as UX and safety:** temperature 0 on every call + a Postgres cache keyed on a `PROMPT_VERSION` string. Re-opening an entry returns the identical line (never silently rewrites someone's reflection); bumping the version auto-invalidates the cache so tuning never serves stale results. Honest caveat carried in-code: temp-0 isn't bit-deterministic without a seed, so *the cache*, not temp-0, is what actually guarantees stability.
- **The calibrated scorer is kept context-blind.** Personalization ("why *today*?") is applied *after* scoring, in deterministic code, and only re-ranks near-ties — because a control experiment showed that feeding "today's context" into the scoring prompt *inflated the axis scores* (the resonant candidate's emotional-center rose a clean +1.0 and won on the master axis rather than as an honest tiebreak). So the seam is drawn to protect the calibration.
- **Models pinned to exact versions** (never a floating alias, so an auto-upgrade can't silently change results). A cheaper model is used *only* for low-stakes classification — and only after the eval harness proves it holds the same line.

---

## 3. Responsible AI — the guardrails

Safety here isn't a content filter bolted on; it's layered through the pipeline, and each choice of failure direction is deliberate.

- **Crisis check (§3.1) runs before anything else**, scoped to the writer's *present state* (only the most recent entry — running it over years over-fires, because a lifetime of journaling always contains some survived despair). It's sensitivity-biased ("better to offer support unnecessarily than miss someone"), returns **server-authored** support copy (the model never writes it, pointing to 988 / findahelpline.com), and — critically — **fails open**: on any error it returns false, which is *safe* because two independent downstream layers (Pass-1 exclusion, Pass-2 gate) still exclude crisis lines. Defense in depth. Its false-positive boundary was stress-tested: a breakup written *in acceptance* is verified **not** flagged.
- **Absolute hard floors** — body weight, eating, appearance, physical self-image are never surfaced, *even "positively,"* because observation itself can harm there. The check judges an entry's *focus*, not a single word, and the requirement is **absence, not suppression** (the banned line must not appear at all). Verified: across an 11-year archive containing "I feel annoyingly fat," that line was never surfaced.
- **The perspective-not-wound gate is arc-aware** — this was the most important calibration shipped. A blunt version stripped the raw "before" of every growth arc, which *destroyed the product's whole thesis* ("you can't show 'look how far you've come' if the gate deletes where you started"). The fix: evaluate cross-time candidates *as arcs* — a raw "before" passes when the same candidate holds a later fragment showing it was survived.
- **A bias guard** scopes every observation to *"in your writing,"* never *"in your life"* — because people write more in distress than contentment, and *"appears often in the journal" must never silently become "was often true of your life."* Prevents a funhouse mirror.
- **User-sovereign controls:** mute a date range (a grief season) so nothing from it ever resurfaces by any path; mark any entry "never resurface"; and a diversity/rotation layer that won't repeat a page within 6 months or a theme within 90 days — *"a life is larger than its hardest chapter"* (the anti-"Grief Retrieval Machine" rule).
- **Fail-open vs. fail-closed, chosen per risk:** crisis detection fails *open* (safe via downstream gates); hard-floor and resurfacing-safety classifiers fail *closed* (withhold rather than risk exposure). A NULL safety verdict is treated as un-surfaceable.

---

## 4. The eval harness — taste, made executable

For a product that is *"80% calibration and safety, 20% plumbing,"* the crown jewel is the regression suite that turns subjective quality into something a CI gate can enforce. *"I think this output is good"* is unshippable when the output speaks to someone about their most private writing.

**Two independent axes, scored separately** — because they fail independently and selection is primary:

1. **Selection** — did it choose the right line, or the right *silence*?
2. **Voice** — did it say it safely and concisely?

The founding insight: an early result scored **Selection 3/10, Voice 8/10** — beautiful prose about the *wrong* line. Scoring them together would have hidden it. *"Bad retrieval can never be fixed by prettier prose."*

**A gold set of frozen human judgments.** 16 fixtures built from real journal text, each encoding a `target` (must surface) and `antiTargets` (must not) — e.g. "the uniquely-hers line must beat the LinkedIn-résumé line." The categories are the product's whole risk surface:

- **Must-surface** recognition cases.
- **Silence guards** (`expect: "nothing"`) against "silence erosion" — a to-do list or one thin line must stay quiet.
- **Crisis** (support response, never analysis) vs. **wound** (raw distress that must return nothing) vs. **survived-guard** (must surface) — testing the gates in *both* directions so they neither over- nor under-fire.
- **Thread/continuity** cases, including a "don't manufacture a thread from noise" guard and a cross-year span assertion.
- **Cost-bound** cases proving the read-window sampling can never sample a crisis line away.

**Engineering discipline worth noting:**

- **One seam.** All engine coupling is isolated behind a single `adapter.ts`; the checks reason over a normalized contract and never touch raw engine JSON. Offline mode replays recordings for fast CI; a live mode hits the running engine.
- **A separate safety harness** validates a *cheaper* hard-floor model before it's trusted — 5 must-withhold + 5 must-allow cases, where a single missed withhold is a **disqualifying safety failure** ("keep the more expensive model").
- **Separating harness bugs from engine bugs is itself the discipline** — a live "10 failing" run turned out to be ~6 fixtures missing date headers + 1 over-strict check, not engine defects.
- **CI-able:** the runner exits non-zero on any scored failure, so a prompt change that breaks a principle fails loudly instead of silently degrading. Live board: **Selection 12/16, Voice 10/11**, with remaining reds documented as model nondeterminism, not defects.

*The eval is the roadmap: iteration happens against the gold set, not opinions. Taste, made executable.*

---

## 5. The business model — "gate the AI, never the journal"

The monetization is drawn from one principle: **charge only for the one action with real recurring marginal cost.**

- **Everything with ~$0 marginal cost is free forever** — writing, keeping, editing, importing, exporting, and *date-based* returns ("On This Day," "Your Year in Pages" — pure SQL over your own pages). You can also *revisit* any past AI return for free.
- **The paid line is the fresh AI return** (a cache-miss engine run) — the only thing that costs real money each time.

**Tiers & pricing:**
- Free: **4 fresh returns/month** ("about one a week"), **+3 one-time onboarding bonus** in month one — *"the magic has to land before any limit does."*
- Member: **unlimited**, with an internal fair-use ceiling (200/mo, ~6–7/day — env-tunable, invisible to real users) that bounds the abusive tail.
- **$8.99/mo** or **$59.99/yr** (≈$5/mo, **44% off**). Annual is defaulted and its savings shown, but *"the nudge is a fact, not a pressure tactic"* — consistent with "offer, never push."

**Unit economics I actually modeled:**
- ~**$0.10 COGS per fresh return** (two-pass call); ~$0.002 to re-open a cached one.
- ~**83–90% gross margin** on a modeled 1,000-member book; break-even at ~47–75 returns/month — roughly 5–15× a realistic cadence. The anti-engagement design *protects* this by suppressing compulsive use.
- The fair-use ceiling caps worst-case member cost at ~$20/mo instead of an open-ended cheque: *"price 'unlimited' on the average — like gyms and data plans — and clip the tail."*

**Rollout judgment:**
- **Shadow-mode metering.** The quota gate ships *metered but not blocking* until membership is purchasable — *"a capped free user with no way to upgrade should never hit a wall."* It exposes real demand and COGS in logs *before* any wall exists; flipping one flag turns it into a gentle, reversible `402`.
- **Re-roll grace:** rapid "show me another" clicks collapse into one billable return, so exploring never burns quota.
- **Dual-platform billing done honestly:** Stripe on web (signature-verified webhook as source of truth) and Apple IAP via RevenueCat on mobile (Apple mandates IAP). When the webhook proved to be a single, out-of-band point of failure, I added a **client-initiated, grant-only server verification** that queries RevenueCat's API right after purchase — so a paying member is never gated as free by a dropped webhook. Lapsing **never touches your pages**: *"leaving is easier than arriving."*
- **One narrative on every surface,** with honest fine print: marketing says "unlimited," the FAQ explains plainly why a fair-use ceiling exists and invites a reply if that's genuinely your pace.

---

## 6. Architecture & execution

- **Two repos, one-way flow:** GitHub is the source of truth → a Replit deployment syncs, runs, and migrates (never pushes back). Ships via per-change runbooks.
- **The engine is an internal loopback service** — the raw `/still/*` endpoints are hard-blocked (403) to any non-loopback caller because they bill the model API on every call; a rate-limit alone was replaceable by a rotating-proxy attacker, so it became an outright loopback block. Real users reach it only through the authenticated, rate-limited product API. An async job pattern (enqueue + poll) lets long reads dark-ship with instant rollback.
- **Monorepo:** Express API + engine, a React SPA, a Postgres/Drizzle schema with **AES-256-GCM encryption at rest** (transparent custom column type; a stolen DB dump is useless without the key), an OpenAPI→codegen client, the eval harness, and an Expo/React-Native iOS app — all over one backend.
- **Shipped end to end:** three auth providers (email/password, Google, Sign in with Apple with token revocation on delete), email verification + password reset, onboarding, the write→import→run→returns→reflect loop, privacy export/delete, legal pages, a custom domain, security headers + report-only CSP, and a DB-backed readiness probe for uptime monitoring. iOS went through the full App Store gauntlet — a rejection for non-discoverable account deletion (Guideline 5.1.1(v)) → fix → approval.

---

 ## 7. What this demonstrates

- **0→1 product judgment under deep ambiguity** — defining success as *recognition, not engagement*, and holding that line against every default of the category.
- **AI system design with safety as a first-class constraint** — layered guardrails, fail-direction chosen per risk, and a scorer deliberately kept blind to personalization to protect its calibration.
- **Evaluation rigor** — turning subjective "taste" into a CI regression suite on independent axes, with held-out cases and a cheaper-model safety validator; treating *the eval as the roadmap*.
- **Business fluency** — a model whose price line is drawn exactly where marginal cost lives, with modeled unit economics, a fair-use ceiling, and a shadow-mode rollout that de-risks the pricing before the wall exists.
- **End-to-end shipping ownership** — a live, encrypted, multi-platform product with a paid tier, built and launched solo.

> *It remembers what endured, not what happened — and the whole product is the taste and safety to know the difference, proven by an eval harness.*

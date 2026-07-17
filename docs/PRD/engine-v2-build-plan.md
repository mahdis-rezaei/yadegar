# Engine V2 — build plan (scoped, grounded in the V1 code)

_2026-06-03. The **how** to `memory-engine-v2-vision.md`'s **what/why**. Reflects
the actual V1 implementation (`artifacts/api-server/src/routes/still.ts`,
`lib/memory-engine.ts`, `scripts/src/eval/`). No engine changes yet — this is the
plan + the decisions needed before touching the calibrated engine._

## Where V1 stands (the constraints we build within)
- **Per-run, context-free.** `memory-engine.ts` sends the engine a flat blob of
  all eligible entries (`[date]\nbody`, ascending), and Pass 2 returns the **one**
  most emotionally-central surfaceable thing (lexicographic axes: emotional_center
  → specificity → discovery → contradiction → worth_returning_to; four gates;
  resolution penalty) + an optional `secondaryThread`. Temperature 0 + cache.
- **No "today."** The engine doesn't know the current date, the recent entries, or
  what it surfaced last week. It can't answer "why *today*?"
- **No theme / no rotation / no affinity.** `returned_memories` stores lens,
  label, quote, quoteDate, createdAt, favorite, openedAt, dismissed — but **no
  topical theme**, so diversity can't be enforced yet.
- **Harness is per-run, single-winner** (`fixtures.ts` → one input; `checks.ts`
  asserts the winner/voice). It can't express cross-run properties as-is.

## The core architectural decision: split V2 by where each question belongs

| V2 question | Lives in | Why | Risk |
|---|---|---|---|
| Q1 worth-returning-to | engine (V1, unchanged) | already calibrated | none |
| **Q2 "why today?"** (temporal/thematic resonance) | **engine** (new context input + a relevance **tiebreak**) | needs the model to read recent context | medium — touches the prompt |
| **Q3 diversity / rotation** | **app** (deterministic re-rank over engine candidates + stored history) | cross-run; needs no LLM | **low** — never touches the prompt |
| **Q4 user-affinity** (soft learning) | **app** (deterministic weighting from favorites/opens/dismiss) | signals already stored | **low** |
| Aliveness (active/enduring/completed); life-stage | engine (later) | deeper inference | higher — defer |

**The key insight:** the riskiest, most "magical-but-dangerous" parts — diversity
and personalization — are **deterministic and belong in the app**, testable with
plain unit tests, **never destabilizing the calibrated engine.** Only Q2 needs an
engine change, and it can be a **tiebreak that never overrides emotional_center
dominance** — so V1's calibration (and the anti-horoscope rule) is preserved.

## What changes, concretely

**Engine (`still.ts`, new PROMPT_VERSION) — additive:**
1. Accept optional **context** in the score/extract input: `today` (date) +
   `recentEntries` (the last ~N entries / ~90 days) so the model can judge
   temporal + thematic resonance.
2. Add a **`why_today` relevance signal** per candidate, used **only as a
   tiebreak** among already-surfaceable, comparable-strength candidates (same
   discipline as the existing CROSS-TIME / FRESH-GRIEF tiebreaks). It never
   promotes a weaker line over a clearly stronger emotional_center.
3. Emit a lightweight **`theme`** tag on the surfaced result (and on each ranked
   candidate) — a topical label (home, family, loneliness, work, love, identity,
   hope, grief, friendship, wonder, beginning-again…). A *label, not a judgment.*
4. Emit a **`ranked`** array of the top ~5 surfaceable candidates (theme + scores
   + safe quote) **alongside** the unchanged primary — so the app can choose
   among them for diversity. Purely additive; the primary winner is unchanged.

**App (`memory-engine.ts` + schema) — deterministic, unit-tested:**
5. Assemble the richer input (archive + recent window + today).
6. **Diversity/rotation re-ranker:** from `ranked`, prefer a candidate whose
   theme/period hasn't been surfaced recently (read `returned_memories`), so we
   never become the "Grief Retrieval Machine." Default rule (tunable): *don't
   repeat a theme within the last 3 returns or 90 days, unless nothing else
   qualifies.* The engine's #1 wins by default when there's no conflict.
7. **Soft affinity:** gently boost themes the user favorites/opens; gently
   down-weight a theme just dismissed. **Never punish; never visible.**
8. Store `theme` (+ a `why_today` reason) on `returned_memories` so rotation has
   history. (Schema: add `theme` + `why_today` columns — one additive migration.)

**Harness (`scripts/src/eval/`):**
9. Extend `Fixture` with optional `context` (recentEntries + today) and a
   `expectWhyToday`/relevance assertion → keeps Q2 testable **per-run**.
10. **New deterministic unit tests** for the app-side re-ranker (diversity +
    affinity) — no LLM, fully repeatable. This is how we test the "cross-run"
    properties without a flaky cross-run LLM harness.
11. Non-negotiable gate: the **entire existing board stays green** (V2 must not
    regress V1 selection/voice).

## Phasing (each phase shippable + guarded)
- **Phase 0 — instrument:** add `theme`/`why_today` columns; start tagging
  surfaced results with a theme (cheap classify, reuse the resurface-safety
  pattern) to begin building rotation history. No behavior change.
- **Phase 1 — Q2 in the engine:** context input + `why_today` tiebreak + `theme`
  + `ranked`. New PROMPT_VERSION. Extend fixtures; board stays green.
- **Phase 2 — Q3 diversity (app):** the re-ranker over `ranked` + history.
  Deterministic unit tests.
- **Phase 3 — Q4 affinity (app):** favorites/opens boost, dismiss soft-down; then
  the explicit "show me more: Family/Travel…" preference (Batch 5 #34) on the
  same theme model.
- **Phase 4 — later:** aliveness (active/enduring/completed) classification,
  life-stage resonance, and the Monthly Letter (#47) — the highest
  interpretation-risk items, built last with the strict "a word + the pages" rule.

## Risks & guardrails
- **Don't destabilize V1.** Q2 is a *tiebreak*; `ranked`/`theme` are *additive*;
  diversity/affinity are *app-side*. The full eval board must stay green at every
  step (this is the safety net the harness exists for).
- **Anti-horoscope (binding).** Diversity and affinity must optimize for
  *recognition*, never for engagement/intensity/sadness/profundity. Success =
  "I forgot I wrote that," not "wow."
- **Librarian, not therapist.** `theme` is a topical shelf label, never a verdict
  about the person. No life-stage *prediction* — only recognition.
- **Personalization stays invisible & gentle.** Soft signals only; never punish a
  dismissal beyond a gentle frequency reduction; never a social-media feedback
  loop.

## Decisions needed before building (the point of this pass)
1. **First slice:** Q2 "why today?" + Q3 diversity (recommended), deferring
   affinity-personalization and aliveness — or a different cut?
2. **"Why today?" strength:** tiebreak-only, never overriding emotional_center
   (recommended, preserves calibration) — or a stronger booster?
3. **Diversity default:** avoid repeating a theme within the last 3 returns / 90
   days unless nothing else qualifies (recommended default; tunable).

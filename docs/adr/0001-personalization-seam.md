# ADR 0001 — Personalization is a post-score code seam; the scorer stays context-blind

Status: **accepted** (2026-06-03) · Supersedes the prompt-clause approach to why-today.

## Context

Engine V2 wants to make the surfaced return *today-aware*: among candidates of
comparable strength, gently prefer the one that resonates with today (same
season, an anniversary, a recent theme). The product's one-liner literally
promises "one thing worth returning to **today**." Soft affinity (#34, "lean
toward what this writer tends to keep/favorite") is the same shape of feature.

We first tried this as a **prompt clause**: a third soft tiebreak appended to the
PASS2 scoring prompt, fed `today` + `recentThemes`, told in strong terms to act
ONLY as a last-resort tiebreak and to NEVER change an axis score.

A DEV-engine **fixed-candidate-set control** (extract once; score the SAME set 4×
with no context and 4× with resonant context) falsified that approach:

- Resonant candidate `emotional_center`: `4,4,4,4` → `5,5,5,5` (zero overlap, +1.0)
- Theme-match candidate: `3,3,3,3` → `4,4,4,4`
- With context the resonant candidate won on `emotional_center` (the MASTER axis),
  not as a tiebreak.

Tightening the clause to forbid axis movement (commit 4cef294) did **not** close
the leak — the same +1.0 inflation persisted. Conclusion: **any personalization
context placed in the scoring prompt corrupts the calibrated axis scores.** This
is not a why-today bug; it is a property of mixing "what matters in general"
(scoring) with "what matters to this person today" (personalization) in one model
call.

## Decision

1. **The scorer is context-blind, permanently.** `POST /still/score` sends the
   model only the candidates. Axis scores are a pure function of the candidates —
   the exact calibration the eval harness protects. No `today`, themes, affinity,
   or any per-user signal ever enters the scoring prompt or its cache key.

2. **Personalization is a deterministic CODE seam applied AFTER scoring**, over
   the model's pure scores. It can re-rank only **among near-ties** (candidates
   the model itself scored as comparable to the winner) and never alters a score.
   Why-today is the seam's **first signal**; soft affinity (#34) will be the
   second — same seam, not a second architecture.

3. **A surfaced result is only ever changed by a VOICE-only second pass** that
   writes the new winner's observation/quotes, and only when an override actually
   fires. When no override fires (the common case), output is **byte-identical to
   flag-off**.

## Why this is the durable choice

- **Correct by construction.** The scorer cannot inflate an axis for "today"
  because it never sees today. The invariant is structural, not a request to the
  model we then have to police.
- **Invisible until it has something to say.** No near-tie + resonance → no
  change, no extra cost. The hot path is untouched.
- **Finally testable offline.** Comparability and resonance are pure functions
  the harness asserts deterministically — the prompt approach was untestable
  offline and therefore undurable.
- **One seam, reused.** #34 plugs in as another signal feeding the same re-rank.

## Rejected alternatives

- **Prompt clause** (any wording): empirically inflates axis scores. Dead.
- **Single-pass, model emits observations for top-N candidates**: taxes every
  scoring call with extra tokens + a harder task (writing voice for losers) to
  avoid a rare second call. Wrong trade; risks voice quality on the hot path.
- **Shelve why-today**: the *seam* is needed for #34 regardless, and "return to
  today" is core to the pitch — worth building once, correctly.

## Contract / invariants (what the harness and Replit verify)

- Today/affinity/etc. NEVER change any axis score. (Verified: blind scoring →
  off≡on byte-identical with no context, already confirmed on DEV.)
- The seam re-ranks ONLY among candidates the model scored as comparable to its
  winner; it NEVER overrides a candidate that is clearly stronger.
- It NEVER lowers the silence bar: if the model returned `mode="nothing"`, the
  seam stays silent.
- Flag-off, and flag-on-with-no-override, are byte-identical to today.

## Implementation plan (staged, dark-shipped)

- **S2a — DONE (this commit):** scoring made context-blind; leaky prompt clause
  removed; scoring cache key reverted to pure candidates (shared with flag-off).
  Flag + context input retained for the seam to consume. Offline board unchanged.
- **S2b — DONE:** `artifacts/api-server/src/lib/why-today.ts` — pure functions
  `parseDateParts` / `seasonOf` / `resonance` (anniversary > season, + theme
  overlap), `comparableSet` (master-axis TIE only — `emotional_center` equal,
  surfaceable, non-penalized; tightened from the initial within-one-point window
  after the DEV log-only observation showed a becki ec 5→4 override demoting a
  strictly higher master axis, which violates "emotional_center decides any clear
  winner"), `identifyWinner` (match surfaced quotes → displayable
  fragments), and `chooseWhyTodayOverride`. Unit-tested (15 cases) in
  `why-today.test.ts`, run via `pnpm --filter @workspace/scripts run test:engine`
  (uses the scripts package's existing tsx — no new dep, no lockfile change).
  Wired in `/still/score` in LOG-ONLY mode behind the flag: when on + context, it
  logs the would-be override; the surfaced `result` is unchanged, so enabling the
  flag is still behaviorally inert. Offline board unchanged (Selection 3/3).
- **S2c — DONE:** the seam now APPLIES the override (still flag-gated).
  - Voice pass (`surfaceOverrideCandidate` in `still.ts`): re-runs PASS2 on the
    SINGLE chosen candidate, so the surfaced voice/quotes/label come from the same
    calibrated scorer — no separate voice prompt to drift. If the re-run declines
    (`mode:"nothing"`) or anything throws, the blind winner is kept. The swapped
    fields are mode/label/observation/quotes/why + `winning_tiebreak_level:
    "why_today"` + an audit `why_today_override` block; the blind `scores` and
    `secondaryThread` are preserved.
  - Resonance bar raised: `MIN_OVERRIDE_RESONANCE = 2` — a bare same-season
    coincidence (weight 1) can no longer fire; only a real anniversary (3), a
    theme echo (2), or season+theme (3) does. Keeps fires rare and meaningful.
  - Cache: when the flag is active the (possibly overridden) result is cached
    under a separate key carrying COARSENED context (month + sorted themes), so it
    never pollutes the flag-off cache and is stable within a month rather than
    re-rolling the noisy decision daily. Flag-off key unchanged (pure candidates).
  - Accepted limitation (per the DEV reconfirm): pass-2 `emotional_center` jitters
    ±1, so which near-tie freezes is probabilistic — but always SAFE (only swaps
    among co-equal, surfaceable, gated candidates; never breaks silence) and, once
    computed, frozen per (pool, month, themes) by the cache.
  - 16 unit tests; offline board unchanged (flag-off identical).
  - **Verified on the DEV engine (A/B, flag ON vs OFF):** catchup fired and
    swapped the surfaced output ("Still at the Beginning" → "Happiest Girl
    Exhausted") with a `why_today_override` audit and `winning_tiebreak_level:
    "why_today"`; clear-winner + silence cases were ON==OFF; flag-off showed no
    leak; the coarse cache held the frozen override across non-fresh re-reads; the
    re-voiced observation read as a genuine turning line. Fires are rare (need a
    true ec tie + resonance ≥2), as intended.
  - Cross-mode override is intentional (comparability is ec + surfaceable +
    non-penalized, NOT mode-gated); when an override makes the new primary a
    thread/distance, the preserved `secondaryThread` is nulled to avoid
    duplicating the primary (mirrors PASS2). NEXT: enable in prod, watch
    `why_today_override` frequency/quality, keep the flag as instant rollback.

### Soft affinity (#34) — the seam's second signal

Same seam, second signal. NOT pool-level favorite-weighting (that already ships
at the pool stage, batch-2) — this is a *selection-level* nudge among candidates
the model itself scored co-equal. Product rule (engine-v2-build-plan Phase 3):
"gently boost themes the writer favorites/opens; gently down-weight a just-
dismissed theme. Never punish; never visible." Anti-horoscope: optimize for
RECOGNITION, not engagement/intensity. Own flag (`SOFT_AFFINITY`), independent of
`WHY_TODAY_TIEBREAK`.

Signals (all already stored): `favorite` + recent `lastOpenedAt` → favored
themes; `resurfacing_preference = "never"` → dismissed themes. A theme both
treasured and dismissed is dropped from favored (never punish, never boost).

- **A1 — DONE (this commit):** `artifacts/api-server/src/lib/affinity.ts` — pure
  `buildAffinityProfile(entries, now)` (favored / dismissed theme sets) and
  `affinityScore(candidate, profile)` (+favored / −dismissed, text-matched like
  why-today's theme echo). 11 unit tests in `affinity.test.ts`. Wired into
  NOTHING yet — fully inert; offline board + why-today untouched.
- **A2 — DONE:** composed into the seam as one preference over `comparableSet`.
  - `chooseSeamOverride(result, candidates, context, { whyToday, profile })` in
    why-today.ts: preference = (`whyToday` ? `resonance` : 0) + `affinityScore`,
    confined to ec-tied / surfaceable / non-penalized candidates, requiring
    `>= MIN_OVERRIDE_RESONANCE` AND strictly beating the winner's own preference
    (so a favored winner is never overridden; a dismissed winner can be passed
    over). **Affinity-off (no profile) DELEGATES to the untouched
    `chooseWhyTodayOverride`** — live why-today is provably identical (locked by a
    test). Favorite / `more_often` / recent-open → favored; `never` → dismissed.
  - App: `runMemoryForUser` builds the profile (`buildAffinityProfile`) and passes
    it in `context.affinityProfile`; `/still/score` schema accepts it.
  - Wired **LOG-ONLY** behind `SOFT_AFFINITY`, computed on the BLIND result before
    the why-today apply can mutate it — logs the combined seam decision; surfaced
    result unchanged. 33 engine unit tests; offline board unchanged (3/3).
- **A3 — DONE:** the seam now APPLIES the combined decision (still flag-gated).
  - `/still/score` runs ONE unified seam block: `chooseSeamOverride` with
    `{ whyToday: wtActive, profile: affActive ? … : undefined }`, re-voiced by the
    same single-candidate PASS2 pass. With `SOFT_AFFINITY` OFF it is byte-identical
    to the live why-today path (delegation + the `why_today_override` audit and
    `"why-today: applied override"` log line are preserved); with it ON the audit
    is `seam_override` + `winning_tiebreak_level:"seam"` and the log says `seam:`.
  - Cache: when affinity is active the key carries the normalized favored /
    dismissed sets (plus the why-today coarse context if on); the why-today-only
    and flag-off keys are left byte-identical, so the live why-today cache never
    churns.
  - **A3 DEV A/B (flag on, seeded profile) — done; two findings addressed below.**
    Apply/no-leak/cache/gate-safety all passed; the one failure was QUALITY:
    affinity matched the favored *word* against the model GLOSS, which is brittle
    (coincidental hits + missed the true center, e.g. an "exhaustion" page titled
    "Exhausted" fired nothing).
  - **FIX — tag matching (post-A/B):** affinity now matches the candidate's
    SOURCE-ENTRY theme TAG (exact membership in favored/dismissed), not the gloss.
    The app annotates each candidate with `themes` from its evidence dates (the
    `[entryDate]` headers make evidence dates equal pool `entryDate`s exactly);
    `themes` is STRIPPED from the model scoring payload + cache key, so scoring
    stays byte-identical. why-today's own theme echo is unchanged (date signals
    are its primary axis).
  - **Architect caveat (resolved):** the combined path drops why-today's binary
    winner-resonance short-circuit, but the winner's resonance still counts in ITS
    preference — a peer favored on affinity alone (max +2) cannot beat a winner
    resonating at 3. Locked by a test (`a today-resonant WINNER is not overridden
    by an affinity-favored peer`).
  - 35 engine unit tests; offline board unchanged (3/3) with all flags off.
  - **NEXT:** re-run the dev A/B with the tag-matching fix + a seeded account —
    confirm favored matches now track the true source theme and read as
    recognition; then enable `SOFT_AFFINITY` in prod.

## Rollback

Each flag (`WHY_TODAY_TIEBREAK`, `SOFT_AFFINITY`) independently gates its signal.
Off → pure engine, exactly as today. Unsetting is a complete, instant rollback at
every stage.

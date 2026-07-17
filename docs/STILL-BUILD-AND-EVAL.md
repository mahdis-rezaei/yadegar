# Still — Build & Evaluation: An AI PM's Field Guide

*A complete account of what we built, how we built it, the guardrails that make it safe, and the evaluation harness that made the whole thing possible. Written to be read end-to-end before an interview, or used as a reference.*

---

## 0. The 60-second version (say this first)

**Still is a companion to a lifelong journaling practice.** You paste in years of your own entries; it reads the whole archive and surfaces **one** thing worth returning to today — a recurring thread, a forgotten page, a line where the truth slipped out — always pointing back to your own words.

The hard part was never "find patterns in text" — LLMs do that trivially. The hard part, and the entire product, is **taste and safety**: deciding *which* of the things it finds are worth saying out loud, and *never* surfacing the ones that would wound. A competent app with bad calibration is "an ambush machine with beautiful typography." So we built the product as **a philosophy with features hanging off it**, and we proved the calibration with an **evaluation harness** — a regression test suite that runs the engine against real journal entries and asserts both *did it choose the right thing* and *did it say it safely*.

What makes this an AI-PM story rather than an engineering story: the work was **80% calibration and safety, 20% plumbing**, and the way we made calibration tractable was by turning subjective "is this a good output?" judgments into an **automated, two-axis eval** that let us iterate against real data instead of vibes.

---

## 1. The product thesis (the thing that must not be diluted)

A person who has journaled for years **cannot see their own life**. They can reread a page; they cannot revisit a *pattern*. No one can hold a decade of their own writing in their head at once.

The founding principle:

> **The companion's job is not to remember what *happened*. It is to remember what *endured*.**

- **What happened = the wound.** The bad night, the breakup, the 3am spiral. Surfacing it unbidden is an **ambush** — it returns pain without perspective.
- **What endured = the thread.** The meaning that survived the moment — the voice that kept steadying itself, the fear that disappeared, the courage that kept reappearing in new clothes. Surfacing it is a **gift** — it reveals a continuity you couldn't see from inside any single entry.

Everything in the product descends from one rule: **offer the meaning, never push the moment.**

**Why this matters for a PM:** the thesis *is* the spec. Every feature, every model prompt, every threshold was judged against "does this honor what endured, or does it push the wound?" When a build decision conflicted with the thesis, the thesis won. Having a single, sharp north star is what kept an open-ended LLM product from drifting into a generic "AI journaling assistant."

**What success is NOT:** not DAU, not time-in-app, not streaks. Success is a person who feels *recognized* — who sees a thread they'd lived for years without naming, and feels *accompanied* rather than analyzed. If the product ever optimized for return visits or manufactured profundity to seem valuable, it would have betrayed the one thing it was built to be.

---

## 2. The architecture at a glance

```
  Pasted entries (multi-year archive)
        │
        ▼
  ┌─────────────────────────────────────────────┐
  │  PASS 1 — /still/extract                     │
  │  • §3.1 crisis classifier runs FIRST         │  → if active crisis:
  │  • deterministic sentence segmentation       │     return support message,
  │  • extract candidate "moments" across lenses │     STOP (never analyze)
  │  • each candidate: lens, evidence fragments  │
  │    (verbatim + dated), function              │
  └─────────────────────────────────────────────┘
        │  candidates[]
        ▼
  ┌─────────────────────────────────────────────┐
  │  PASS 2 — /still/score                       │
  │  • score each candidate on 5 axes (1–5)      │
  │  • apply 4 gates (pass/fail)                 │
  │  • resolution penalty                        │
  │  • holistic selection → ONE winner           │
  │  • compute the best cross-time thread        │
  │    separately → secondaryThread (Option B)   │
  │  • write the observation (the "voice")       │
  └─────────────────────────────────────────────┘
        │
        ▼
  Result: label · observation · 1–2 quotes (the payoff) · optional "read the
  full entry →" · optional collapsed "across the years…" secondary thread
  — OR "nothing this time" — OR a crisis support response.
```

**Two passes on purpose.** Extraction (find candidate moments) is separated from scoring/selection (decide which one to say). This is the single most important architectural decision, because it let us locate every bug precisely: a missed line was an *extraction* problem; a wrong pick was a *scoring* problem. (More than once we "fixed selection" for weeks when the real bug was that extraction never surfaced the right candidate — see §6.)

**Stack:** Node/TypeScript, Express, the Claude API for both passes, Postgres for a result cache. The eval harness is a separate pnpm workspace package (`scripts/src/eval/`). The *stack is commodity*; the calibration is the product.

---

## 3. The reasoning engine in depth

### 3.1 Pass 1 — extraction

- **Crisis-first:** before anything else, a §3.1 classifier checks for *active, present-tense* crisis. If found, the engine returns a support response and never extracts/analyzes (see §4.3). This ordering is deliberate — the safety floor runs before the product logic.
- **Deterministic segmentation:** entries are split into whole sentences server-side; a candidate's evidence is a verbatim, **date-attributed** sentence (or at most two adjacent sentences forming one move — e.g. a self-correction). This killed a whole class of nondeterminism where the model used to bundle a raw cry together with an adjacent discovery, or split a line differently each run.
- **Candidates across lenses.** The engine extracts 8–15 candidate "moments," each tagged with a lens (below) and carrying verbatim evidence fragments. **Extraction over-collects on purpose** — curation happens in Pass 2. A line wrongly included costs nothing; a line wrongly excluded is invisible forever.

### 3.2 The lenses (how it reads the archive)

The product never shows the user "lens tabs." Internally it reads through several lenses and returns **exactly one** result (or nothing). Selectivity *is* the product.

| Lens | Question it answers |
|---|---|
| `memory` | "What page captured a past self / what did I forget?" |
| `thread` | "What kept returning across time?" |
| `distance` | "How far have I come? What changed?" |
| `wisdom` | "What did I already know?" (a hard-won self-understanding) |
| `value_signal` | "What mattered to me then?" (a saved/copied quote — attributed, never my words) |
| (`becoming`, `survival`) | "Who was I becoming / what survived?" |

### 3.3 Pass 2 — scoring & selection

Each surfaceable candidate is scored 1–5 on **five axes**:

- **`emotional_center`** — does the page hang on this line? (the dominant axis)
- **`specificity`** — could *only this person* have written it? (the "fingerprint")
- **`discovery`** — is it an *escaped* truth, not a conclusion reached for?
- **`contradiction`** — does it hold two things at once?
- **`worth_returning_to`** — would seeing it again land as recognition, not noise?

**Selection is holistic with `emotional_center` dominant** — *not* strict lexicographic. We learned this the hard way (§6): a strict center→specificity→… order would have picked the shallower line in real cases. A genuine discovery can rightly beat a higher-specificity line. The one hard invariant we kept: the winner should hold the top `emotional_center` among surfaceable candidates — *except* a promoted cross-time thread, which wins on continuity.

**The resolution penalty.** Self-reassurances, affirmations, motivational conclusions ("I promise I'll…", "everything is under control") are what the writer *wanted to believe* — the resolution, not the discovery. They're demoted when a stronger discovery/contradiction exists on the page. This was a key insight: *the conclusion is usually what the writer wanted to believe; the observation is where the truth slipped out — prefer the escaped truth.*

**Option B — primary + a secondary thread.** On a rich multi-year archive, the **primary** result is the sharpest single thing (often a single-entry recognition); separately, the engine offers the **single best qualifying cross-time thread** as a **collapsed, writer-initiated** pull ("…across the years, this kept returning →"). Exactly one, or none. This resolved a real tension: single-entry lines *land* harder than diffuse threads, but the product's thesis is cross-time recognition — so we surface the sharp line *and* let the writer pull the thread, honoring both without becoming a dashboard.

**The honest "won at" trace.** The dev panel shows winner vs. runner-up and the axis that actually broke the tie — and flags the model's self-reported label when it disagrees. This was instrumentation we added *because the model kept mislabeling its own pick*; the trace let us see the real selection logic instead of trusting the model's narration. (We also added an anomaly flag that fires *only* when the winner trails the runner-up on `emotional_center` — the one real ordering bug — and stays quiet on the holistic sub-center overrides that are by-design.)

---

## 4. The guardrails (this is the product, not a footnote)

This is the section to spend the most time on in an interview. The product centralizes a decade of someone's most private writing. Done well it's wise; done badly it reopens wounds with beautiful typography. Six layered safeguards:

### 4.1 Hard floors — never crossed, regardless of anything
- **No threads/observations about body weight, eating, appearance, or physical self-image — ever**, even "positively." This is a category where *observation itself can harm*. The engine does not pattern-match on it. (This floor came directly from real entries in the test archive.) Verified live: across an 11-year archive containing "I feel annoyingly fat," that line was **never** surfaced.
- **No diagnosis, no clinical language, no advice, no coaching.** The companion observes; it never prescribes.

### 4.2 The perspective-not-wound gate
The governing safety rule: **offer the meaning, never push the moment.** A line is gated if surfacing it would *re-stage raw distress* rather than offer survivable meaning. Crucially, the criterion is **"would this re-stage the wound,"** not "does the line contain its own resolution" — we corrected this after discovering the over-strict version was suppressing valid material (§6).
- **Arc-aware for cross-time threads:** a raw "before" fragment (e.g. 2020 "I feel numb") becomes surfaceable when paired with a later fragment showing it was *survived* (2025 "grief has stages… I'll heal"). The pairing is meaning-over-wound — that's the §6.4 "named and shown to have dissolved" gift. This is the §3.1 distinction made operational: **active present crisis vs. survived past difficulty.**

### 4.3 §3.1 active-crisis handling
When an entry contains *active, present-tense* crisis (not survived past pain), the engine does **not** produce a thread/observation/quote. It returns a **warm, brief, non-clinical support response** pointing to real help (988 / findahelpline.com internationally), then stops. The live response we verified:
> *"…the thing that matters most isn't anything in these pages — it's you… In the US you can call or text 988… You don't have to hold this alone."*

Two things make this safe: it runs **before** extraction (the safety check gates the product logic), and we verified the **false-positive boundary** — intense-but-reflective entries (a breakup *in acceptance*, "I cry because I feel strongly") are **not** mis-flagged; only genuine active crisis triggers it. *Honest framing:* crisis detection via model prompting is a prototype-grade safeguard, not a clinical one — the product should say so and err toward the support response when uncertain.

### 4.4 Attribution — saved words are not the writer's words
When a candidate draws on a quote/book passage/copied text the writer *saved* (`source_type: saved_quote | copied_text | journal | unknown`), the engine must never present it as something she *wrote* or believed. ❌ "You wrote about courage" → ✅ "In the passages you saved then, courage seemed to be something you were reaching toward." Verified live: a saved Cherokee parable was tagged `copied_text` and surfaced under **"IN THE WORDS YOU SAVED."**

### 4.5 The silence discipline
**"Nothing meaningful surfaced this time"** is a valid, trust-building output. A companion that always finds something profound is a fortune teller. This is *harder* as lenses multiply (more lenses → higher odds of finding *something*), so silence is enforced aggressively: thin/logistical input (a to-do list, a bare year-list, two unrelated logistical entries) returns `nothing`, never a manufactured thread. Verified live: a saved URL + a list of years → *"Better silence than a false thread."*

### 4.6 The bias guard (speak from the writing, not the life)
People write more in distress than in contentment — more at 3am than 3pm. An archive **over-represents struggle**. So every observation is scoped to *"in your writing," "across the pages from this period"* — never *"you spent years lonely."* "Appears often in the journal" must never silently become "was often true of your life." This prevents the product from becoming a funhouse mirror that tells someone they were miserable when really they just *wrote when miserable*.

### 4.7 Determinism (a safety property too)
Temperature 0 on both passes + a Postgres result cache keyed on `PROMPT_VERSION`. Re-opening the same entry returns the **same** surfaced line (no arbitrary changes to someone's reflection). Honest caveat we documented: temperature 0 reduces but doesn't eliminate run-to-run drift (no seed on the API), so the **cache** is what actually guarantees stability on re-open.

---

## 5. The evaluation harness (the centerpiece for an AI PM)

This is the part that turns "we have a vibe that the output is good" into "we have a regression suite that proves it." If you remember one thing from this doc for the interview, make it this.

### 5.1 Why it exists
The output of an LLM that speaks to you about your most private writing is **subjective and high-stakes**. You cannot ship "I think this is good." We needed to (a) make the quality judgment *repeatable*, (b) catch regressions when we changed a prompt, and (c) *separate two different kinds of failure* that get conflated.

### 5.2 The core idea: two independent axes
Every output is scored on **two separate questions**, because they fail independently and **selection is primary**:
1. **Selection** — *did it choose the right thing?* (the line, or correct silence)
2. **Voice** — *did it say it well/safely?* (concise, points-not-explains, no banned formula, no analysis)

> Key insight: *bad retrieval can never be fixed by prettier prose.* An early result scored Selection 3/10 but Voice 8/10 — beautiful writing about the *wrong* line. Scoring them together would have hidden that. Splitting them made the priority obvious: fix what it picks before how it talks.

### 5.3 How it's built (`scripts/src/eval/`)
- **`fixtures.ts`** — the **gold set**: real journal entries, each annotated with `targets` (lines that *should* win), `antiTargets` (lines that must *not* win), and expectation flags (`expect: surface|nothing`, `expectSpan`, `expectSecondaryThread`, `expectCrisis`, `hardFloor`).
- **`checks.ts`** — the assertions (below).
- **`adapter.ts`** — the only engine-specific code: it calls the live two-pass engine (`/still/extract` → `/still/score`, crisis-aware) and normalizes the response into one shape the checks understand. The README's rule: *"this is the engine shim — edit only this to match the engine."*
- **`recordings.ts`** — captured engine outputs so the suite runs **offline** (`STILL_MODE=recording`) for fast CI of the harness itself; `STILL_MODE=http` runs it **live** against the engine.
- **`run.ts`** — the runner; prints a scorecard and exits non-zero on failure (CI-able).

### 5.4 What it actually checks
**Selection checks:** hard-floor content is absent everywhere; the target line was *extracted* as a candidate (catches Pass-1 misses); the target *won*; no anti-target won; surfaced quotes carry a **real date** (not "unknown"); the winner holds top `emotional_center` (except promoted threads); multi-year input surfaces a cross-time result (`expectSpan` / `expectSecondaryThread`); silence cases return `nothing`; active crisis returns a support response and **no** analysis.

**Voice checks:** opener isn't a stock formula (we banned the templates the model kept reaching for); ≤3 sentences; ≤45 words (concise); no literary/analysis vocabulary ("the writing does X"); no claims about the writer's interior ("you realized…"); and **coherence** — the observation may only quote lines that are actually displayed.

**Cross-result check:** no two surfaced openings rhyme (the model can't self-enforce variety across stateless calls, so the harness does).

### 5.5 The methodology lessons (gold from a PM lens)
- **The gold set encodes taste.** Each fixture's `target`/`anti-target` is a frozen human judgment ("the uniquely-hers line should beat the LinkedIn line"). The suite is *taste, made executable.*
- **Passing the tuning cases is necessary, not sufficient.** We kept *held-out* fixtures separate from the ones the rules were derived against — otherwise you overfit the prompt to a handful of entries.
- **Silence and over-gating are both regressions.** We guard *both* directions: thin input must return `nothing` (silence erosion), AND a survived-difficulty entry must still *surface* meaning (over-gating). They pull against each other; the suite holds the line on both.
- **The harness caught my *own* bugs.** A live run once showed "10 failing" — but ~6 were my fixtures missing date headers (so the engine correctly returned "unknown"), and 1 was my check being too strict for promoted threads. **Separating harness bugs from engine bugs is itself a PM skill** the suite forces you to practice.

---

## 6. The iteration story — the decisions a PM should be able to narrate

This is the "tell me about a hard problem you worked through" material. Each item is a real decision with a before/after.

1. **"Prefer the line where the truth slipped out, not the line that's quotable."** The model's default bias is toward polished, shareable, inspirational sentences — so "find the meaningful line" kept collapsing into "find the *pretty* line." We made the rubric *actively fight this*: prefer **discovery over resolution**, **contradiction over beauty**, the **uniquely-hers fingerprint** over the generic, **raw/exposed** over poetic. Concrete example the whole team aligned on: on one page, the engine kept picking *"I'm trying to catch up with life"* (LinkedIn-flavored) over *"Until when should I live in another 6 bodies?"* (unmistakably hers). The second is the right answer.

2. **The bottleneck was extraction, not selection.** We spent effort "fixing selection" when the truly best line (*"6 bodies"*) was never even **extracted** as a candidate — so no scoring change could ever pick it. Lesson: in a multi-stage LLM pipeline, **instrument every stage** and find *where* the right answer disappears before tuning the stage you assume is wrong.

3. **Selection is holistic, not lexicographic — and we proved it with a real case.** A multi-entry archive surfaced *"Once again we have a family side by side"* (a discovery about loss) over a higher-specificity line. A strict ordering would have picked the shallower line. We *relaxed our own invariant* and added an **honest trace** so we could see the real tiebreak instead of the model's (often wrong) self-label.

4. **The voice "formula" problem.** Every observation started "There's a line in here I keep stopping on…" — warm once, a tic by the tenth time. We **banned stock openers** (and refused to replace them with a *new* approved list, which is just a new template) and required the observation to *point and stop* — the quote carries ~80% of the emotional weight; the prose is the door, not the summary.

5. **Over-gating suppressed the product's whole thesis.** The safety gate, applied naively, was stripping the raw "before" of every growth arc — which destroyed cross-time threads (you can't show "look how far you've come" if the gate deletes where you started). The fix was the **arc-aware gate** (§4.2): a raw line is surfaceable *as part of an arc* when a later entry shows it was survived. This is the §3.1 *survived-vs-active* distinction made operational, and it's the single most important calibration we shipped.

6. **The thread lens vs. the single line.** Across many multi-year runs, a single-entry line won every time and the cross-time thread never surfaced — even when present. We diagnosed it as a real tension (single lines *land* harder) and resolved it with **Option B**: keep the sharp single line as primary, offer the thread as a *secondary pull*. We also had to fix **thread assembly** to key on *persistence-of-function under changing language* (2015 "take a deep breath" → 2018 "hold the pen" = same function, different words) rather than literal repetition.

7. **The silence discipline had to be enforced against false threads.** The engine once stitched a "thread" between two unrelated logistical entries (an apartment lease + a flight). We tightened the bar: a thread qualifies only on *genuine* persistence-of-function; a bare logistical/celebratory beat is `nothing`.

8. **Crisis safety + the false-positive boundary.** We added §3.1, then immediately stress-tested the *opposite* risk: that it would over-fire on intense-but-reflective pages and suppress meaningful material. Verified it fires only on active crisis and leaves survived/processing pain alone.

9. **Determinism as UX.** Same entry, three runs, three different (all-good) winners felt arbitrary. We added temperature 0 + a version-keyed cache so re-opening an entry is stable, while being honest that the cache (not temp 0) is what guarantees it.

---

## 7. Engineering & workflow lessons (the messy-reality stuff)

Worth a mention because PMs who've *shipped* know these:
- **Eval harness ↔ engine drift.** The harness (canonical, in GitHub) and the engine (in a separate Replit checkout) kept drifting one commit apart, so every run risked using a stale copy. The durable fix was committing the **working adapter to the canonical repo** so a single pull gives a runnable harness — and documenting the sync workflow so it doesn't recur.
- **The adapter is the seam.** We deliberately isolated *all* engine-specific coupling into one file (`adapter.ts`) with a normalized contract, so the fixtures/checks (the taste) never had to change when the engine's response shape did.
- **Squash-merges + a long-lived branch** create add/add "phantom" conflicts; the fix was to rebuild the branch as `main` + a clean delta before each PR.
- **Background processes get reaped** in some sandboxes; long live-eval runs had to be warmed concurrently into the cache, then read back — a real-world constraint that shaped how we ran the suite.

---

## 8. What an AI PM should take away (the transferable principles)

1. **For a calibration-heavy AI product, the eval *is* the roadmap.** We didn't iterate on opinions; we iterated against a gold set that turned subjective quality into a pass/fail board. The eval is where all the iteration belongs.
2. **Separate the axes that fail independently.** Selection vs. voice; extraction vs. scoring; harness bug vs. engine bug. Conflating them hides the real problem and wastes weeks.
3. **Safety floors are non-negotiable and come *first* in the pipeline.** Hard floors (body/appearance) and crisis detection run before the product logic, not as a post-filter. And every safety mechanism needs its *opposite* failure guarded too (crisis over-firing; gate over-suppressing).
4. **Restraint is a feature; silence builds trust.** The hardest engineering was teaching the model to say *nothing*. The product's value is *selectivity*, not coverage. We resisted "show more," "say more," "more lenses" — every one of those would have made it worse.
5. **Risk-sequence the build.** We did the part that *could kill the product* (the engine + taste) first, against ~20 real entries, before any pipeline/UI/storage. The PRD called this explicitly: *"if the engine can't find one real thread in 20 entries, it won't find one in 20,000."*
6. **Instrument honestly.** The model mislabels its own reasoning; the dev panel's reconstructed "won at" trace let us see the truth. Trust the trace you build, not the model's narration.
7. **Tell the truth in the product's own materials.** "Crisis detection is prototype-grade." "We speak about your writing, not your life." Honesty over reassurance is itself a safety and trust strategy.

---

## 9. Current status & what's next

**Done & verified live (engine — PRD build-order steps 1–2, "the whole bet"):** single-page recognition, the silence discipline, value_signal + attribution, the §3 hard floors, §3.1 crisis with a holding false-positive boundary, date attribution, and cross-time continuity as both a promoted primary and an Option-B secondary pull — all guarded by the eval harness. Live board: Selection 12/16, Voice 10/11, with the thesis-defining cases green; the remaining reds are inherent model nondeterminism, not defects.

**Next (the plumbing the PRD deferred *until* the engine was proven):**
- **Step 3 — Graduated-disclosure UI** (orientation → thread → full entry), including the one known open defect: the **"full entry unavailable"** expand.
- **Step 4 — Storage + privacy architecture (§8)** — "the product, not a footnote": where the archive lives, what touches a model, local-first vs. E2E, the plain-language "where your writing lives" screen.
- **Step 5 — Import pipeline** (paste → files → Apple Notes/Docs → email).
- **Step 6 — Gentle return + across-time notes** (opt-in, default-off, low-frequency, no streaks/guilt).

---

## 10. Quick reference (for fast recall in the room)

**The five axes:** emotional_center · specificity · discovery · contradiction · worth_returning_to.
**The four gates:** hard_floors · perspective_not_wound · textual_evidence · displayable_quote.
**The lenses:** memory · thread · distance · wisdom · value_signal (· becoming · survival).
**The safeguards:** hard floors · perspective gate (arc-aware) · §3.1 crisis · attribution · silence discipline · bias guard · determinism.
**The eval's two axes:** Selection (did it choose right) · Voice (did it say it safely).
**The one-liner:** *"It remembers what endured, not what happened — and the whole product is the taste and safety to know the difference, proven by an eval harness."*

---

### Likely interview questions (and the angle to take)

- **"How did you measure quality for something so subjective?"** → The two-axis eval harness, gold set as executable taste, separation of selection vs. voice, held-out fixtures.
- **"What's the biggest risk and how did you mitigate it?"** → Re-opening a wound (the ambush). Layered guardrails, safety-first pipeline ordering, the arc-aware gate, crisis handling with a verified false-positive boundary.
- **"Tell me about a wrong assumption you corrected."** → "Selection is lexicographic" (it's holistic), and "the bottleneck is selection" (it was extraction). Both were caught by instrumenting the pipeline.
- **"How do you keep an LLM product from drifting?"** → A single sharp thesis that *wins* over build decisions, plus a regression eval that fails loudly when a prompt change breaks a principle.
- **"What did you choose *not* to build?"** → More lenses, longer voice, multiple results at once, an import pipeline first. Restraint and risk-sequencing.

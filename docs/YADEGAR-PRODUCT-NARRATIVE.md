# Yadegar — The Complete Product Narrative

> A VP-of-Product walkthrough of everything we built: the thesis, the brand, the
> memory engine, the eval/harness craft, the safety system, the unit economics, the
> subscription model, and the shop. Written to be read aloud or fed into a tool like
> NotebookLM to generate a presentation or podcast.
>
> **One naming note up front:** the product is **Yadegar** (Persian: *a keepsake, the
> thing that remains*), live at **yadegarjournal.com**. The internal codename is
> **"still."** User-facing copy says "Yadegar"; the code, repo, engine routes, and
> cache tables say "still." That split is deliberate — renaming internals would be
> risky churn and a DB migration for zero user benefit. When you hear "still" in this
> doc, it means Yadegar.

---

## 1. The one-sentence thesis

> **Yadegar surfaces *one* thing worth returning to from a lifetime of journal
> entries — a thread, a forgotten page, a distance travelled — always pointing back
> to the writer's own words, and stays *silent* when nothing honest surfaces.**

Everything else in this document is in service of that sentence. The hard part was
never storing journals. The hard part is the **taste and safety to know which single
page belongs in front of you today** — and the discipline to say nothing when the
answer is "nothing."

The governing rule, the line everything descends from:

> **"Offer the meaning, never push the moment."**

---

## 2. The problem: remember what *endured*, not what *happened*

Most journaling tools remember what **happened**. Yadegar tries to remember what
**endured**.

A traditional journal app might say: *"In 2015 you felt lost. In 2018 you felt
confident."* Yadegar asks a different question: *"What remained true across both
moments?"* — and the answer might be a thread you couldn't see from inside any single
entry. **That is not a memory. It is a thread.** The goal is not advice. The goal is
**recognition**.

The deepest framing we wrote down:

> **"A journal preserves moments; a memory engine preserves the relationship between
> who you were, who you are, and who you are becoming."**

Yadegar is **not** a therapist, coach, or productivity tool. It is a **companion**.
*"It keeps your pages, and every so often gently brings one back."*

The distinction the whole product hangs on:
- **What happened = the wound.** Surfacing it unbidden is an **"ambush"** — it returns
  pain without perspective.
- **What endured = the thread.** Surfacing it is a **"gift"** — it reveals a continuity
  you couldn't see from the inside.

A competent app with bad calibration, as we put it internally, is just *"an ambush
machine with beautiful typography."* Avoiding that is the entire job.

---

## 3. The brand

- **Name:** Yadegar — Persian for *a keepsake, the thing that remains.* It ties to the
  founder's own story and a decade of personal journals. (We renamed from "Still"
  because the journaling category was crowded with "Still"-like names.)
- **Voice:** Quiet, Literary, Timeless, Human. *"Warm, personal, gentle. Never cute,
  corporate, or overly sentimental."* Closer to reading a book than using software.
- **Forbidden words:** "Submitted / Posted / Published," "Records Parsed,"
  "Dashboard," "Insights." **Preferred:** "Kept," "A Page From Then," "Pages Found."
  Save states read **"Saving… → Saved → Kept."**
- **What Yadegar will never be:** *"No streaks, social feeds, public profiles, likes,
  followers, engagement metrics, productivity dashboards, mood scores, personality
  reports, AI life coaching, AI therapy. Still is not trying to explain a life — it
  helps someone revisit it."*

The design principles: **Quiet** (no red badges, no anxiety notifications),
**Literary**, **Timeless** (*"could exist ten years ago or ten years from now"*),
**Human**.

---

## 4. The governing principles (the constitution)

Every feature is judged against **The Still Test**:

> **"Does this help someone reconnect with their own words? If yes, build it. If no,
> don't."**

The constitution, in one breath: **"Librarian, never therapist/coach/guru.
Recognition, not amazement. Offer, never push. The user owns and controls everything.
No streaks/guilt. The Still Test decides every feature."**

The principles that shape the engine specifically:

1. **Offer the meaning, never push the moment.** Surface what endured, never the raw
   wound. (This is the criterion of the engine's *perspective-not-wound* gate.)
2. **Evidence before interpretation.** Every observation must point back to the
   writer's own **verbatim, dated** words. "A theme is a word + the pages, never a
   sentence interpreting the person."
3. **Prefer the escaped truth over the resolution.** *"The conclusion is usually what
   the writer wanted to believe; the observation is where the truth slipped out."*
4. **Recognition over advice (the Anti-Horoscope Rule).** A memory succeeds when the
   user says **"I forgot I wrote that"** or **"that's true"** — *not "wow." The goal is
   recognition, not amazement.*
5. **The silence discipline.** *"Better silence than a false thread."* A companion that
   always finds something profound is a fortune teller. Saying "nothing this time" is
   a valid, trust-building output.
6. **The bias guard — speak from the writing, not the life.** People write more in
   distress than contentment, more at 3am than 3pm. An archive over-represents
   struggle. Every observation is scoped to *"in your writing,"* never *"you spent
   years lonely."* Otherwise the product becomes *"a funhouse mirror that tells someone
   they were miserable when really they just wrote when miserable."*
7. **Selectivity is the product.** It reads through several lenses and returns
   **exactly one result, or nothing.** We resisted every pull toward "show more,"
   "say more," "more lenses."
8. **Privacy by default.** *"Your pages belong to you."* Export everything, delete
   everything, anytime — and be honest that an AI reads the words (privately, never to
   train it, never shown to anyone, never sold).

---

## 5. The product: the loop and the feature set

The core loop is **write → import → run → returns → reflect.**

**Definition of done (the MVP bar):** *a user can write a page today; import pages from
the past; run Yadegar; receive one returned memory; open the full original page; write
a reflection; and trust that the page belongs to them.*

Navigation: **Today · Library · Explore · Returns · Settings.** No Dashboard, no
Analytics.

- **Today (home):** the date, a rotating gentle prompt (*"What wants to be written
  today?"*, *"What are you carrying?"*, *"What keeps returning?"*), a large
  distraction-free editor with debounced auto-save, and the **"Bring a page back"**
  action that runs the engine. If a memory exists, "A Page From Then → Read Full Page."
- **Library:** an archive that *"feels like shelves, not records"* — filtered by year,
  month, favorites, source, search; grouped by year. Favorites are **stars, not
  hearts**. It also holds the **Continuity card** — the deliberate **anti-streak**:
  pages kept, years spanned, oldest-page age, writing-since, reflections + gentle
  milestones. No guilt, no red counts.
- **Full entry view:** reading-focused, beautiful typography, big margins.
  **No AI sidebar, no analysis panel, no chat, no summaries.** Actions: Favorite ·
  Edit · Delete · Reflect.
- **Reflections / letters across time:** "Reflect on this page" attaches a dated
  reflection *beneath* the original — *"like letters across time"* (a 2016 entry, then
  a 2027 reply). The original is never altered. Not comments, not chat bubbles.
- **Look back:** the date-based resurfacing surfaces — **On This Day, Around This Time,
  Favorites, Forgotten Page** ("what keeps returning / revisit a time / year in
  pages").
- **Explore:** full-archive *navigation* (distinct from resurfacing): **Search Your
  Life** (client-side, because bodies are encrypted), **The Timeline of You**, the
  **Memory Calendar**, the **Memory Shelf** ("kept close," distinct from Favorites),
  **Annual Letters / Your Year in Pages** (print-ready), plus **Collections**
  ("playlists of pages") and **Capsules** ("Send to Future Me").
  - A subtle but important rule: **browse vs. resurface.** Navigation shows the *whole*
    archive; only *resurfacing* honors the safety floors and mutes. *"We do not hide a
    page from the person actively looking for it."*
- **Returns:** the permanent home for everything the engine has surfaced — each card
  has a date, an excerpt, "Read Full Page," favorite, and dismiss. **Revisiting a past
  return is always free, forever** (it matters for the business model — see §10).
- **Nudges ("notifications as companion"):** *"feel like a friend placing a page on
  your desk."* Allowed: *"A page from 2018 came back today."* Forbidden: *"You haven't
  journaled lately / Complete your streak."* Off by default; per-nudge cadence.
- **Privacy:** export everything (JSON), delete everything (cascades all data),
  encryption at rest (AES-256-GCM), an honest "an AI reads your words" disclosure, and
  a Philosophy page.
- **Auth & onboarding:** email/password + Google (+ Apple on mobile). Email
  verification + password reset via Resend. Onboarding asks **"What brings you to
  Yadegar?"** and routes you to Import, to Today, or to a sample memory.

**What we optimize for:** Pages Kept, Memories Opened, Reflections Written, Years
Archived, **Meaningful Returns.** *Not* DAU, session length, or streaks.

---

## 6. The memory engine — how it actually works

The engine is the bet. It runs as a **two-pass HTTP service** (in Replit), and the
single most important architectural decision is the split:

> **Separate *finding candidate moments* (extraction) from *deciding which one to say*
> (scoring/selection).** *"The stack is commodity; the calibration is the product."*

### Pass 1 — `POST /still/extract`
- **Safety runs first.** Before any product logic, the **§3.1 crisis classifier** runs.
  *"The safety floor runs before the product logic."* If active, present-tense crisis is
  detected, the engine returns **no candidates** and a warm support message — it never
  analyzes.
- **Deterministic sentence segmentation.** Entries are split into whole sentences
  **server-side**, and a candidate's evidence is a **verbatim, date-attributed**
  sentence. This killed a whole class of nondeterminism (the model used to bundle a raw
  cry with an adjacent discovery, or split lines differently each run).
- **Over-collect on purpose.** It extracts **8–15 candidate "moments,"** each with a
  lens and verbatim fragments. The rationale: *"A line wrongly included costs nothing;
  a line wrongly excluded is invisible forever."* Curation happens in Pass 2.

### Pass 2 — `POST /still/score`
The extract output is *exactly* the score input. Pass 2:
- Scores each candidate **1–5 on five axes**,
- Applies **four pass/fail gates**,
- Applies a **resolution penalty**,
- Does **holistic selection → exactly one winner**,
- Separately computes the **single best cross-time thread → the optional "Option B"
  secondary**,
- And writes the **observation (the voice).**

**The five scoring axes (1–5):**
1. **`emotional_center`** — does the page hang on this line? *(the dominant axis)*
2. **`specificity`** — could *only this person* have written it? *(the "fingerprint")*
3. **`discovery`** — is it an *escaped* truth, not a conclusion reached for?
4. **`contradiction`** — does it hold two things at once?
5. **`worth_returning_to`** — would seeing it again land as recognition, not noise?

**The four gates (pass/fail):** `hard_floors` · `perspective_not_wound` ·
`textual_evidence` · `displayable_quote`.

**The resolution penalty** demotes self-reassurances and motivational conclusions
(*"everything is under control," "I promise I'll…"*) when a stronger discovery or
contradiction exists on the same page — because *"the conclusion is what the writer
wanted to believe; the observation is where the truth slipped out."*

**The lenses (internal only — the user never sees lens tabs):** `memory` (a captured
past self), `thread` (what kept returning), `distance` (how far you've come / what
changed), `wisdom` (what you already knew), `value_signal` (a saved/copied quote —
*attributed, never claimed as your words*), plus `becoming` / `survival`. The engine
returns **exactly one result, or nothing.**

**Selection is holistic, not lexicographic.** `emotional_center` is dominant, but a
genuine *discovery* can rightly beat a higher-*specificity* line. The one hard
invariant: the winner should hold the **top emotional_center** among surfaceable
candidates — *unless* it's a promoted cross-time thread, which wins on continuity.

**Option B — primary + secondary.** On a rich, multi-year archive, the **primary** is
the single sharpest thing (often a single-entry recognition that *lands* harder than a
diffuse thread), and the engine *separately* offers the **single best qualifying
cross-time thread** as a collapsed, writer-initiated pull: *"…across the years, this
kept returning →."* Exactly one, or none.

### Determinism: temperature 0 + a version-keyed cache
- **Temperature 0 on both passes**, plus a **Postgres result cache (`still_results`)
  keyed on `PROMPT_VERSION`.**
- Re-opening the same entry returns the **same** surfaced line — you never want to
  silently change someone's reflection.
- The honest engineering caveat we documented twice: *"temperature 0 reduces but
  doesn't eliminate run-to-run drift (there's no seed on the API), so **the cache is
  what actually guarantees stability** on re-open."* A cache hit is *already correct*
  for the current prompt; bump `PROMPT_VERSION` and stale entries auto-miss and
  recompute.

### How threads actually work — function, not keywords
Threads key on **persistence of *function* under changing language**, not literal
repetition. Example: 2015 *"take a deep breath"* and 2018 *"hold the pen"* are the
**same function** — becoming her own steadying voice — in different words. The noise
counter-example: an apartment lease and a flight booking share no function, so the
engine returns **nothing**.

---

## 7. The safety system — six layered guardrails

This is the part most teams skip and the part that makes Yadegar trustworthy.

1. **Hard floors — never crossed.** No threads or observations about **body weight,
   eating, appearance, or physical self-image — ever, even "positively"** — because
   *"the observation itself can harm."* Verified live: across an 11-year archive
   containing the line *"I feel annoyingly fat,"* that line was **never surfaced.** Also
   banned: diagnosis, clinical language, advice, coaching.
2. **The perspective-not-wound gate.** A line is gated if surfacing it would *"re-stage
   raw distress rather than offer survivable meaning."* It's **arc-aware**: a raw
   "before" fragment (2020 *"I feel numb"*) becomes surfaceable when paired with a
   later "survived" fragment (2025 *"grief has stages… I'll heal"*) — *the distance is
   the point.*
3. **§3.1 active-crisis handling.** On present-tense crisis, the engine produces no
   thread/quote — just a warm, brief, non-clinical support response pointing to real
   help (988 / findahelpline.com), then stops. It runs **before** extraction, and its
   **false-positive boundary is verified** — an entry that is intense but *reflective*
   (a breakup *in acceptance*) is not mis-flagged. We're honest that this is
   *"prototype-grade, not clinical,"* and we err toward support when uncertain.
4. **Attribution — saved words aren't your words.** Every fragment carries a
   `source_type` (`journal | saved_quote | copied_text | unknown`). ❌ *"You wrote about
   courage"* → ✅ *"In the passages you saved then, courage seemed to be something you
   were reaching toward."* Verified live with a saved Cherokee parable surfaced under
   **"In the words you saved."**
5. **The silence discipline.** Enforced aggressively — the more lenses you add, the
   higher the odds of finding *something*, so silence has to be defended on purpose.
6. **The bias guard + determinism** (see principles §4).

---

## 8. The eval harness — proving the taste (this is the crown jewel)

The output of this product is **subjective and high-stakes.** You cannot ship *"I think
this is good."* So we turned *"we have a vibe that the output is good"* into *"we have a
**regression suite** that proves it."* It's CI-able: any failure exits non-zero.

### The core insight: two independent axes
We score every result on **two separate axes**, and selection is primary:

1. **Selection** — *did it choose the right thing?* (the right line, or correct
   silence)
2. **Voice** — *did it say it well and safely?* (concise, frames rather than explains,
   no banned formula, no analysis vocabulary)

> **"Bad retrieval can never be fixed by prettier prose."**

The proof this mattered: an early result scored **Selection 3/10 but Voice 8/10** —
*"beautiful writing about the wrong line. Scoring them together would have hidden
that."* The scorecard prints them separately. The current live board: **Selection
12/16, Voice 10/11**, with every thesis-defining case green and the remaining reds
attributable to model nondeterminism rather than defects.

### How the harness is built (`scripts/src/eval/`)
- **`fixtures.ts` — the gold set.** Real journal entries annotated with `targets`
  (lines that *should* win), `antiTargets` (must *not* win), and flags like
  `expect: surface | nothing`, `expectSpan`, `expectSecondaryThread`, `expectCrisis`,
  `hardFloor`. *"Each fixture's target is a frozen human judgment. The suite is taste,
  made executable."*
- **`adapter.ts` — the seam.** The *only* engine-specific file. It calls the live
  two-pass engine and **normalizes** the response into one shape the checks understand,
  so the checks never depend on the engine's exact JSON. (When the engine changes, you
  edit only this file.)
- **`checks.ts` — the assertions** (below).
- **`classify-floor.ts` — a separate safety harness** (below).
- **`recordings.ts` — offline captures** so the harness itself runs fast in CI without
  hitting the live model.
- **`run.ts` / `types.ts`** — the runner/scorecard and the normalized shapes.

### The selection checks (what "right" means, precisely)
- **Hard floor: banned content absent** — the banned line must be *absent from the
  candidate set and the result*, not merely gated-but-present.
- **Active crisis → support, not analysis** — crisis register/support message present,
  and **zero quotes / no secondary**.
- **Returns nothing** — for thin/logistical input, the engine must produce no
  observation.
- **Target extracted as candidate** — catches *Pass-1* misses (the right line was never
  even found).
- **Target won / anti-target did not win** — the *Pass-2* selection assertions.
- **Surfaced quotes have a real date** — *"the date anchors 'a page from THEN.'"*
- **Winner has top emotional_center** — the one hard ordering invariant (skipped when
  the winner is a promoted cross-time thread).
- **Spans ≥2 years / secondary thread offered** — for the cross-time cases.

### The voice checks (how to say it without a tic)
- **Opener not a stock formula** — a blocklist of banned openers (e.g. *"There's a
  line…," "I keep coming back to…," "What stayed with me…"*). Every observation used to
  start *"There's a line in here I keep stopping on…"* — *"warm once, a tic by the tenth
  time."* We banned the formulas and **refused to replace them with a new approved
  list.**
- **1–3 sentences** and **≤45 words** — the **80/20 principle**: *"the quote carries
  ~80% of the emotional weight; the prose is the door, not the summary."*
- **No literary/analysis vocabulary** — bans "the arc," "the transformation," "the
  writing reveals," "holds two things at once," etc.
- **No interior claims** — bans "you realized," "you learned," "you became,"
  "you transformed."
- **Observation quotes only shown lines** (coherence) — the prose can't reference a line
  the safety filter withheld.
- **Doesn't restate the displayed quote** — *"frame the line, don't echo it"* (caught
  with a longest-shared-consecutive-words algorithm).
- **Opener variety (cross-result)** — no two surfaced observations share a first-five-
  word signature. *"The model can't self-enforce this in a stateless per-entry call, so
  the harness does."*

### `classify-floor.ts` — validating a cheaper safety model
A separate, live-only harness for the whole-entry hard-floor check that gates date-based
resurfacing. Its **purpose is cost discipline done safely**: prove a *lighter, cheaper*
model can do the floor check before trusting it. Ten fixtures — **5 must-withhold**
(body/weight/eating central) and **5 must-allow** — and the rule is absolute: *"only
trustworthy if **every** withhold case still returns hardFloor=true."* A single miss on
a withhold case is a **safety failure → reject, keep Sonnet.** The key discriminator
fixture, `allow-breathe`, contains a body line *only in passing* in an entry centrally
about a hard night — the lighter model must allow the *entry* while the per-line gate
still suppresses the *line*.

### Evals as a craft (the PM skill)
- **Held-out fixtures.** Passing your tuning cases is necessary, not sufficient —
  *"otherwise you overfit the prompt to a handful of entries."*
- **Both directions are regressions.** Guard **silence erosion** (thin input must
  return nothing) *and* **over-gating** (survived difficulty must still surface). They
  pull against each other; the suite holds the line on both.
- **Separating harness bugs from engine bugs is itself the skill** — a "10 failing" run
  turned out to be mostly fixtures missing date headers plus one check too strict for
  promoted threads, not engine defects.

The one-line summary of the whole engineering story:

> **"It remembers what endured, not what happened — and the whole product is the taste
> and safety to know the difference, proven by an eval harness."**

---

## 9. Token usage, cost & latency

The product has, by design, **one expensive operation and almost nothing else.**
Everything except a fresh AI return — writing, keeping, importing, browsing,
organizing, exporting, date-based "On This Day" — is **$0 model cost** (pure Postgres +
SQL).

**The token math for one fresh return** (Sonnet 4.6 @ ~$3/M input, ~$15/M output):

| Stage | Input tokens | Output tokens |
|---|---|---|
| §3.1 crisis check | ~900 | ~50 |
| Pass 1 — extract | ~5,200 | ~1,500 |
| Pass 2 — score (its ~8.3K-token system prompt dominates) | ~11,300 | ~2,500 |
| **Total** | **~17,400** | **~4,050** |

- **Cold return (no prompt cache):** ≈ **$0.11**
- **At volume, with Anthropic prompt caching** on the ~10K static system tokens: ≈
  **$0.085** steady-state (caveat: the prompt cache has a ~5-min TTL, so *at launch /
  low volume, calls are often cold* and cost stays ~$0.11 — *"don't bank the savings on
  day one"*).
- **Re-opening a past return (DB cache hit):** ≈ **$0.002**
- **Importing old journals:** ~$0.004–0.007/entry one-time → a 1,000-entry archive ≈
  **$4–7 once.**
- **Planning figure used throughout:** **~$0.10 COGS per fresh return.**

**Cost controls that are also correctness controls:**
- A **per-entry read window** (`READ_WINDOW_ENTRY_CHARS = 12,000`): entries past the cap
  are **sentence-sampled** (head + tail verbatim, middle thinned at an even stride), so
  *"the resonant line at the close survives windowing"* — this fixed both an abuse vector
  *and* a real bug where huge entries hit `max_tokens` and returned truncated JSON.
- **Safety is never windowed** — the crisis check reads the writer's present state in
  **full.** The cost cap can never sample a crisis line away.
- **Model tiering within one vendor:** the prose passes stay on **Sonnet**
  (*"quality is the product"*); trivial JSON like hard-floor + theme tagging can move to
  **Haiku** (~⅓ the cost), which cut import classification from ~$5 to ~$1.7 per 1,000
  entries.

**A deliberate constraint: single vendor.** We will *not* route journal text to a
non-Anthropic model to save tokens — *"every extra LLM vendor is a data processor to
disclose and trust,"* and that breaks the privacy promise that is a brand pillar.

---

## 10. The business model — freemium done honestly

The governing principle:

> **"Never paywall a person's ability to write, keep, import, browse, or export their
> own pages. Charge for the AI that reads across them."** — i.e. **"gate the AI, never
> the journal."** Or: **"subsidize the writing; monetize the meaning."**

This works because of a rare alignment: **cost ≈ value ≈ the thing we charge for.**
*"The thing that costs money is exactly the thing users find magical. The natural
paywall line is obvious *and* fair. We never charge for storage or for nothing."*

**Free forever (both tiers, unlimited):** write, keep, edit, import, export; organize
(Collections, Shelf, Capsules, favorites); browse everything; all date-based return
(On This Day, Look Back, Year in Pages, Timeline, Calendar); and — critically —
**revisiting any past return** (served from cache at ~$0.002). The framing line:

> **"Revisiting what's returned to you is always free. Bringing back something new is
> part of Yadegar."**

**The free *limit*:** **4 fresh AI returns per month** ("about one a week"), plus a
~3-return onboarding bonus in the first month.

**Membership adds:** unlimited fresh AI returns (within fair use), memory **nudge
emails**, and a *designed* multi-year / optional physical **Book**.

**We explicitly ruled out entry caps.** *"'You've used 2 of 3 entries this month' betrays
the promise and torches the retention/lock-in that makes the paid AI valuable."* The
free journal **is the moat** — *"years of an encrypted diary is the highest-switching-
cost asset a consumer app can hold."*

### Pricing
- **$8 / month**
- **$59 / year** (≈ **$4.92/mo**, "save 38%") — annual is the steered default, but it's
  *"a nudge, not a wall… a fact, not a pressure tactic."*
- Deliberately **under market** (AI-journaling peers run ~$9–13; Day One/Stoic ~$35–40/
  yr). *"We can raise later; we can't un-charge early adopters."* We price for
  acquisition and retention because the moat is the accumulating archive.
- **Why a subscription, not one-time:** *"A fresh return costs us every time. A one-time
  price would either over-charge up front or force us to degrade the engine later to
  protect margin. A subscription is the honest match of price to ongoing cost."*

### Unit economics
| Cohort | Returns/mo | COGS/mo @ ~$0.085 | Margin note |
|---|---|---|---|
| Free user | ~4 | ~$0.34 | sustainable acquisition cost |
| Typical paid | ~12 | ~$1.02 | vs ~$8 → **~85% gross margin** |
| Heavy paid | ~60 | ~$5.10 | fair-use keeps this rare; still > $0 |

Blended across a modeled member base, **~83–90% gross margin.** Net of Stripe fees a
monthly member is ~$7.47/mo and an annual member ~$4.75/mo. **Break-even usage** is
~75 returns/mo (monthly) / ~47 (annual) — *"5–15× a realistic cadence, so the median
member is deeply profitable."* And the product design itself protects this: **no feed,
no streak, "one thing worth returning to" suppresses compulsive use.**

### The fair-use ceiling (naming and bounding the tail risk)
The honest weakness of any "unlimited" plan is a small cohort that costs far more than
it pays. Our answer: *"price 'unlimited' on the **average** (like gyms, data plans,
buffets) and clip the **tail** — don't price for the worst case."*

Implemented as quota constants (single source of truth, `quota.ts`):
- `FREE_MONTHLY_RETURNS = 4`, `ONBOARDING_BONUS = 3`
- `MEMBER_MONTHLY_CAP = 200/mo` (≈ 6–7/day; **internal** — members see "unlimited";
  env-tunable). This turns worst-case member COGS from *unbounded* into ~$20/mo, and
  near-zero in practice.

The metering is elegant: **count a return against quota only when it causes a real
model call (a cache miss).** Quota maps 1:1 to actual COGS — *"we charge for spend, not
for nothing."* (A sharp edge we flagged: "show another" re-rolls send `fresh:true` and
bypass the cache, so re-rolls within ~10 minutes of a counted return are treated as one
billable return — otherwise "4/mo" would secretly mean "4 clicks.")

### Shadow mode — `STILL_QUOTA_ENFORCED`
Enforcement ships **OFF.** The system meters every return and exposes usage but
**blocks no one** until `STILL_QUOTA_ENFORCED=1` is flipped (the day membership goes
live). So we can watch real demand against the cap *before* any wall exists, confirm the
COGS-per-member metric, and the whole thing is **fully reversible.** *"The biggest spend
leak is having no metering"* — closing it was priority #1, independent of pricing.

### Communication philosophy
**One story, every surface** — landing, plan page, in-app upgrade dialog, FAQ, welcome
email all tell the same narrative so there's no whiplash. Two deliberate UX choices:
1. **Usage lives in Settings, not in the reading flow.** *"A counter next to 'Bring a
   page back' would cheapen the keepsake moment."*
2. **No payment is ever a wall on words.** Cancel or lapse and you keep every page,
   reflection, and saved return — you just return to the free allowance. *"Leaving is
   easier than arriving."*

Memorable copy: **"Free to keep. Yours to deepen."** · **"We gate the AI, never your
journal."**

### Billing mechanics (Stripe)
One product, two recurring prices ($8/mo, $59/yr). Four env vars; **dormant by default**
(no keys → billing routes return 503 and the UI says "coming soon"). The **webhook is
the source of truth** for `users.plan` (`checkout.session.completed`,
`customer.subscription.created/updated/deleted`) — a raw-body parser is registered for
the webhook *before* the JSON parser because Stripe signatures are computed over exact
bytes. Cancel → `subscription.deleted` → plan flips to free; **we never delete or lock
the user's pages.**

---

## 11. The shop — a third revenue line, on-brand by construction

A **headless Shopify storefront** living natively inside yadegarjournal.com at `/shop`,
selling Yadegar-branded physical goods. It's on-brand *by construction*: Yadegar means
*"the thing that remains,"* and a physical journal is the most literal keepsake. The
hero product **is the journal the app is named after.**

It closes the loop: **write by hand → bring the pages into the app** (the app's
**import** feature is the bridge). Physical and digital reinforce each other.

- **The Desk collection:** the **Yadegar Journal** (hero, hardcover, fountain-pen
  paper, lies flat, $28–34), the **Yadegar Pen** (cross-sell, $12–16), and **The Desk
  Set** bundle (AOV lever, ~$36–42).
- **Margins:** **print-on-demand to launch with zero inventory at ~30–40%**, rising to
  **50–60% private-label at volume.**
- **Architecture (the interview-grade decisions):** headless via the **Storefront +
  Cart APIs** (keeps the shop inside our design system), a **server proxy** through Node
  (token stays server-side, one place for caching/error-handling), and **Shopify-hosted
  checkout** — *"own the browsing and merchandising; let Shopify own checkout"* (PCI,
  fraud, tax, shipping, Apple Pay / Shop Pay).

**Three revenue lines, one brand:** membership (~85–90% margin software), shop (30–60%
physical), and an optional affiliate line. The unique cross-line play no pure-SaaS or
pure-commerce competitor can match: **bundle the journal with a year of membership.**

---

## 12. Engine V2 — the vision (specced, not yet built)

V1 asks *"is this meaningful?"* (**remember what endured**). V2 asks *"is this
meaningful enough to return **today**?"* (**bring back what belongs today**).

> **"V1 finds significance. V2 finds relevance. A page can be meaningful, true,
> beautiful, and still not be the right thing to surface today. The engine's job is not
> to retrieve — it is to recognize."**

Every candidate answers **Four Questions:**
1. **Is it worth returning to?** — the V1 foundation, kept as-is.
2. **Why today?** — the new axis: temporal resonance (anniversary/season), thematic
   resonance (the page *participates in an active conversation*, not by repeating), and
   life-stage resonance (a similar threshold) — *"recognition, not prediction."*
3. **Have we shown too much of this already?** — the **Diversity Layer**, so the engine
   never becomes **"the Grief Retrieval Machine."** *"A journal is not a balanced
   dataset; people write far more when scared/lonely/lost than when content. A life is
   larger than its hardest chapter."*
4. **Is this still alive?** — distinguishes **active vs enduring vs completed** threads.

Plus a soft **User Memory Model** (learn gently from favorites/opens/revisits;
*"never punish; only gently reduce frequency"*) and **memory rotation** across the
domains of a life.

The architectural insight for *building* V2 safely: keep the calibrated engine stable.
*"Why today?"* lives in the engine only as a **tiebreak that never overrides
emotional_center dominance**; the riskier diversity and personalization layers are
**deterministic and app-side, unit-testable** — *"the most magical-but-dangerous parts
are deterministic and belong in the app."*

V2's most important metric is **Trust Rate** — the user feels **accompanied**, *"never
ambushed, manipulated, or analyzed."*

The final test, and a beautiful one to end on:

> **"Of everything this person wrote over ten years, why this page, on this day? — and
> the answer should feel *inevitable once seen.* Not the most emotional, most repeated,
> or saddest thing — the thing that quietly belonged in today's conversation."**

---

## 13. Where things stand today

- **Live in production** at **yadegarjournal.com** since 2026-06-02 (Replit autoscale +
  production Postgres). Verified end-to-end: email/password + Google sign-in, email
  verification + password reset (Resend), encryption at rest (AES-256-GCM), onboarding,
  the full write→import→run→returns→reflect loop, privacy export/delete, legal pages,
  custom domain. Rate limiting in place. *"Every 'harden first' item is complete."*
- **The engine** = PRD steps 1–2 ("the whole bet") **done and verified live, guarded by
  the harness.** Live board **Selection 12/16, Voice 10/11.**
- **The iOS app** is **submitted to the App Store** (built on Expo / React Native,
  upgraded to SDK 54 / RN 0.81 / React 19 to meet Apple's iOS 26 SDK requirement). See
  `docs/MOBILE-ROADMAP.md` for the post-launch plan (brand fonts, web logo + App Store
  download CTAs, Android, membership IAP, push/nudge verification, an explainer video).
- **An honest tension we chose to name:** true zero-knowledge encryption is incompatible
  with V1, because the engine *must* read the words (it sends them to the model to
  choose what to surface). The pragmatic answer is app-level encryption with a
  server-held key — *"a stolen DB dump is useless without the app key; the engine
  decrypts in memory to call the model."* The tradeoff: Library search stays
  client-side.

---

## 14. Soundbites (for the podcast)

- **"Offer the meaning, never push the moment."**
- **"Remember what endured, not what happened."**
- **"A journal preserves moments; a memory engine preserves the relationship between
  who you were, who you are, and who you are becoming."**
- **"The engine's job is not to retrieve — it is to recognize."**
- A memory succeeds when you say **"I forgot I wrote that"** or **"that's true"** — *not
  "wow."*
- **"Better silence than a false thread."**
- **"Bad retrieval can never be fixed by prettier prose."**
- **"The stack is commodity; the calibration is the product."**
- **"Selectivity is the product."**
- **"Librarian, never therapist."**
- **"Gate the AI, never your journal."** / **"Free to keep. Yours to deepen."**
- **"We speak about your writing, not your life."**
- **"The moat is time."** — *year 1 nice → year 7 meaningful → year 30 priceless.*
- Without the diversity layer, the engine becomes **"the Grief Retrieval Machine"** —
  *"a life is larger than its hardest chapter."*
- **"Of everything this person wrote over ten years, why this page, on this day?"** — and
  the answer *"should feel inevitable once seen."*
- The whole thing in one line: **"It remembers what endured, not what happened — and the
  whole product is the taste and safety to know the difference, proven by an eval
  harness."**

---

*One sourcing note for accuracy: the "lost in 2015 / confident in 2018 → what remained
true across both?" framing in §2 is an **illustration in the spirit of the Distance
lens** ("not what repeated, but what changed — often invisible to the writer"), not a
verbatim quote from a spec. Every other quoted line in this document is drawn from the
project's own docs and engine/eval code.*

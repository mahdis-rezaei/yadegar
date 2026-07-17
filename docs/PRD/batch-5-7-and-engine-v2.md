# Yadegar — Batches 5–7 + Engine V2: consolidated evaluation

_Updated 2026-06-03. Evaluates the original Batch 5, 6, 7 drafts and the Engine V2
note against everything built through Batch 4. Companion docs: `batch-2.md`,
`batch-3.md`, `batch-4.md`, `memory-engine-v2-vision.md`, `../HANDOFF.md`._

> One consolidated doc (not three) on purpose: **so much of 5–7 is already built
> or is a thin layer over what exists** that separate greenfield PRDs would mostly
> say "done." The real remaining core is **Engine V2**, and almost every
> "intelligent" feature across 5–7 depends on it.

---

## 0. The headline

Three findings:

1. **~Half of 5–7 already exists** (often built in 1–4 under a different name).
2. **The true remaining spine is Engine V2** — "bring back what belongs *today*"
   (relevance · diversity · aliveness · soft personalization). Personalization
   (34), Monthly Letter (47), the diversity/why-today layers (31/32), the
   empty-archive fix (43), Memory Graph (51), Living Chapters (52), and
   recurring-question detection all **reduce to engine work.** Build the engine
   and most of "Batch 5's invisible systems" thesis is satisfied at once.
3. **Batch 7 is mostly vision/strategy, not features** — and the draft says so
   ("stop ideating; write Vision + MVP + Roadmap"). Captured in §5.

---

## 1. Already shipped (or a thin layer away)

| Feature (orig.) | Status | Where it lives now |
|---|---|---|
| 49 Notifications as Companion | **DONE** | nudges (date-first, no-guilt copy), Batch 2/3 |
| 48 Annual Review / 47*report* | **DONE** | Annual Letters "Your Year in Pages" (B3) |
| 46 Trust Dashboard ("Your Data") | **DONE** | Privacy page (export/delete) + Philosophy page (B4) |
| 44 Journaling Prompts (literary) | **DONE** | Today's rotating prompts |
| 53 Memory Collections | **DONE** | Collections (B4) — playlists of pages, by kind |
| 60 The Still Test | **DONE** | the governing guardrail in every batch doc |
| 50 Success Metrics (Pages Kept) | **DONE (metric)** | Continuity card; "Meaningful Returns" signals already on `returned_memories` (opened/favorite/dismissed) |
| 36 First Magic Moment (demo) | **PARTIAL** | sample-entries onboarding ("see how it feels first"); a labeled *demo memory* card is a small add |
| 35 Onboarding paths / 41 Archetypes | **PARTIAL** | 3-path onboarding exists; archetype *tagging* + tailored 30-day flow (42) is lifecycle orchestration, mostly nudge/engine |
| 58 Future Self Mode | **PARTIAL** | Memory Capsule = "Send to Future Me" (B4); "future-self *prompts*" is a writing-prompt variant |
| 43 Empty Archive | **PARTIAL** | date-based surfacers already work on recent entries; "month-1 resurface recent" is an engine tweak |

**Implication:** before building anything new, a cheap pass could *finish* the
partials (a labeled demo-memory in onboarding; a couple of future-self prompts;
month-1 "recent returns" once the engine is touched). None are big.

---

## 2. The spine — Engine V2 (Batch 5 #31, 32, 34, 39, 40 + the V2 note)

The shared Engine V2 note is **essentially identical** to the repo's
`memory-engine-v2-vision.md` (Four Questions, candidate types, diversity,
anti-horoscope, rotation, the metrics, the final test). So V2 is **already
specced**; what's missing is the **build**. Reconciled scope:

- **Q1 worth-returning-to** — V1, kept as-is.
- **Q2 "why today?"** (#31 temporal + thematic + life-stage resonance) — the
  defining new axis.
- **Q3 diversity layer** (#32) — anti-"Grief Retrieval Machine"; theme rotation.
- **Q4 aliveness** — active vs enduring vs completed threads.
- **Candidate types** — Forgotten Page · Enduring Thread · Distance · Forgotten
  Wisdom · Words You Saved.
- **User Memory Model** (#34, #39) — *soft* learning from favorites / opens /
  revisits / exports (+ weak negative on dismiss). **The raw signals are already
  being captured** on `returned_memories` (favorite, opened_at, dismissed) — V2
  starts consuming them. The explicit "show me more: Family/Travel…" preference
  (34) layers on the same theme model.
- **The Intelligence Layer / librarian rule** (#40) — the constitution: *AI is a
  librarian, never a therapist/coach/guru.* Already our binding principle.

**Build reality (the hard part):** V2's properties (relevance, diversity,
rotation, aliveness) are **cross-run** — V1's per-run harness fixtures can't test
them. So the order is: **new cross-run harness fixtures first → prompt/scoring
changes guarded by them → new PROMPT_VERSION.** This touches the *live, calibrated*
engine in Replit, so it warrants a deliberate design pass with explicit scope
decisions (which of Q2/Q3/Q4 to ship first; how aggressive personalization gets).
Recommend starting V2 with **Q2 "why today?" + Q3 diversity** (highest felt
impact, lowest interpretation risk), deferring heavy life-stage inference.

---

## 3. Near-term, NOT engine (can ship independently)

- **Memory Sensitivity modes** (Batch 5 #33 = Batch 6 #45 — *the same feature*):
  a global **Open · Gentle · Protected** setting layered over the safety
  machinery we already have (`resurface_safety`, `resurfacing_preference=never`,
  date-range mutes). Mostly a settings toggle + a filter parameter on the
  surfacers/engine call. **Cheap, high-trust, app-side — the best non-engine next
  win.** (Consolidate 33 and 45 into one feature.)
- **Premium model** (#38): a real **business decision**, not a build — tiers
  (free vs premium), and the "Still Forever" lifetime option (very on-brand). The
  one hard rule from the draft: **premium enhances; ownership/export stays free.**
  Needs pricing + billing infra decisions before any code.
- **AI-assisted import** (#37): smarter parsing (split / titles / dates /
  people / places / dupes). A *separate* intelligence track from the memory
  engine; today's import is regex date-splitting. Medium effort; LLM-assisted,
  user still approves. Note: people/places detected here could **auto-suggest
  Collections** — ties back to B4.
- **Monthly Letter from Still** (#47): "you wrote often about home this month; one
  question kept returning." **Engine-dependent** (theme/question detection) AND
  the **highest interpretation-risk** feature in the whole roadmap — it must stay
  *noticing*, never advice. Build it only after V2's theme model exists, with the
  same strict "a word + the pages" guardrail as Themes.

---

## 4. Far-future surfaces (Batch 7 — gated, large, sensitive)

These are new product *surfaces*, each a project unto itself; none near-term:
- **Memory Graph (51)** + **Living Chapters (52)** — relationship/chapter
  detection. The deep end of the engine; build long after V2 basics prove out.
- **The Book of Us (54)** + **Family Archive (59)** — multi-user / intergenerational.
  Powerful and category-defining, but need identity, consent, and legal design
  (and tie to the deferred Legacy controls from B4 #29).
- **Audio Memories (55)** — voice capture + transcription; a new media pipeline
  (we have no media yet).
- **The Life Atlas (56)** — places-on-a-map; a natural future view over the
  `place` Collections we already have.
- **Companion Model (57)** — a *positioning* decision (companion, not tool/
  chatbot/coach), not a feature. Goes in the Vision doc.

---

## 5. Vision · Moat · Risks (Batch 7 framing → the Vision doc)

The draft's best instinct: **stop ideating; write the Vision.** Capture (and we
should split this into a standalone `vision.md` when ready):

- **Why Yadegar exists:** to help people stay in conversation with their past
  selves. The whole company is one moment — *"I forgot I wrote that," "that's
  true."*
- **The moat is time.** Year 1 nice → year 3 useful → year 7 meaningful → year 15
  irreplaceable → year 30 priceless. Defensibility compounds with the archive.
- **Companion, not tool.** Remembers, returns, sits beside, notices — never
  advises.
- **The named risks (write them down, guard against them):** becoming an AI
  *summary* tool · *therapy* software · *productivity* software · *repetitive*
  resurfacing (→ why Engine V2 matters) · *broken trust* on uploads (→ encryption
  + the Trust/Philosophy pages, done).
- **The Still Test** governs everything: *does this help someone reconnect with
  their own words?* If no, don't ship.

---

## 6. Recommended sequence

1. **(optional, cheap) Sensitivity modes** (33/45) — Open/Gentle/Protected over
   existing safety machinery. A genuine trust win, no engine.
2. **Engine V2 — design pass, then build** — start with **"why today?" (Q2) +
   diversity (Q3)**, cross-run harness fixtures first, new PROMPT_VERSION. This is
   the spine; it retro-upgrades resurfacing, personalization (34), the empty
   archive (43), and unlocks the Monthly Letter (47) safely.
3. **Then, as separate tracks:** AI-assisted import (37) → premium decision (38)
   → the far-future surfaces (51/52/54/55/56/59) as deliberate projects.
4. **Write `vision.md`** (the Batch 7 strategy) whenever you want it as a
   standalone artifact.

**Do NOT** spin up three more feature batches — the feature backlog is largely
satisfied. The leverage now is the engine + the vision, exactly as the drafts
themselves conclude.

## Guardrails (unchanged, binding — the constitution)
Librarian, never therapist/coach/guru. Recognition, not amazement
(anti-horoscope). Offer, never push. The user owns and controls everything.
No streaks/guilt. **The Still Test decides every feature.**

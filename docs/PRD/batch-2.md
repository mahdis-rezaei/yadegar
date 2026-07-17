# Yadegar — Batch 2: Resurfacing, Returns & Reflection (v2)

_Updated 2026-06-03. Supersedes the original "Still Product Requirements — Batch 2"
draft. Authored with Mahdis. Companion docs: `mvp-v1.md` (MVP spec),
`memory-engine-v2-vision.md` (future engine), `../HANDOFF.md` (engine state)._

> **Brand note.** User-facing copy says **Yadegar**. Internal code keeps the
> "still" codename (engine routes, `useStill`, `still_results`, repo). This doc is
> product-facing, so examples use **Yadegar**.

---

## 0. Read first — what changed on 2026-06-03

Two things changed since the original Batch 2 draft was written:

**(a) Most of Batch 2 already shipped.** Returns, Library + Favorites, the full
reading experience, Reflections-across-time, and Nudges are **built and live** at
https://yadegarjournal.com. This rewrite marks what's done, fixes what drifted
from reality, and adds the new direction below. Each feature now carries a
**Status** line.

**(b) The resurfacing strategy pivoted.** We are **relaxing locked decision #3**
of `mvp-v1.md` — *"all resurfacing goes through the engine — never raw by-date."*

### The pivot, in one paragraph
Date-based resurfacing — **"On this day," "around this time of year," "a page you
haven't opened in years," "a page you favorited"** — becomes a **first-class,
everyday mode**, sitting *alongside* the meaning engine rather than being banned
by it. A page written at 3am that isn't "positive" is now allowed to come back.
The original fear (a journal over-represents struggle, so naive date-resurfacing
becomes a "funhouse mirror" that ambushes someone with a wound) is real but is
**better answered by user control + pull-not-push + preserved hard floors than by
forbidding dates outright.**

### Why this is the right call
- The engine-only model is **opaque and often empty** by design (it's supposed to
  be rare and quiet). That makes a single hidden button the *only* way a page ever
  returns — unsatisfying as the everyday experience, and brittle when the engine
  declines or misfires.
- Date-based return is **legible and in the user's hands.** "On this day, three
  years ago" needs no explanation and no AI. It is the *offer*, never the *push* —
  which is exactly the governing rule (**offer the meaning, never push the
  moment**). The user opens it; nothing is shoved at them.
- A journaler **wants to meet their past honestly**, hard pages included. Treating
  every difficult entry as a hazard is its own kind of dishonesty. The right
  posture is **trust + control**, not avoidance.

### Two surfacers, not one (the core mental model)

| | **Date-based surfacer** (NEW, first-class) | **The meaning engine** (existing) |
|---|---|---|
| How it picks | deterministic date/metadata queries | LLM, two-pass, holistic scoring |
| Cost | ~free (a DB query) | an API call per run, cached |
| Cadence | the everyday heartbeat; browseable anytime | rare, quiet, occasional |
| Direction | **pull** (user opens) + gentle nudge | **push** (one gift) + on-demand |
| Voice | dates + the user's own words, nothing added | dates + the user's own words, nothing added |
| Failure mode | shows nothing for that date (fine) | honest silence / support on crisis |
| Memory types | On This Day · Around This Time · Forgotten Page · Favorite | Unexpected Return · Thread · Distance · Forgotten Wisdom |

Both surfacers **only ever show the user's own words.** Neither explains, scores,
coaches, or diagnoses. That principle is unchanged and non-negotiable.

### What safety means now (relaxed where paternalistic, kept where real)
Reversing "never by-date" does **not** mean "show anything." We keep the floors
that prevent genuine harm and drop the ones that were just over-protection:

- **KEPT — §3 hard floors are absolute.** No body / appearance / eating-disorder
  content is ever surfaced by *either* surfacer. Gated-but-present is not enough;
  it must be absent. (This already exists in the engine; the date-based surfacer
  must honor the same floor — see Feature 6b.)
- **KEPT — active-crisis pages are never resurfaced.** A page expressing active
  self-harm/crisis is never served as a memory by either path.
- **KEPT — pull over push for anything heavy.** Date-based memories are something
  the user *opens*; we don't push a hard page into a notification unprompted
  (nudge copy stays gentle and the heavy material lives behind a tap).
- **RELAXED — ordinary sadness, doubt, grief, "3am" pages now resurface.** These
  are part of an honest life and the user asked to meet them.
- **NEW — the user controls what returns.** Per-entry `resurfacing_preference =
  never` already exists; we add (1) a one-tap **"Don't show this again"** on any
  memory card, and (2) an optional **"Don't resurface pages from this time"**
  date-range mute (the Facebook-Memories lesson — let people fence off a grief
  window without deleting it).

### Decisions to confirm (flagged for Mahdis)
1. **Reverse decision #3** (allow date-based resurfacing) — assumed **yes** in
   this doc; say the word if not.
2. **No pure-random pulls at first.** Random is where the funhouse-mirror risk
   actually lives. Ship **On This Day + Favorites + Forgotten Page** first;
   consider a "surprise me" later, hard-floor filtered. (Recommended.)
3. **Where each surfacer lives:** **Returns** stays the home of engine gifts +
   anything the user keeps; **On This Day** is a live, computed surface on **Today**
   plus its own lightweight browse. (Recommended; see Features 6–7.)
4. **The engine crisis-scope fix still ships** for the push path (assess present
   state, not the whole archive) — independent of this pivot, tracked separately.

---

## 1. Purpose (unchanged)

The way a page comes back is the heart of Yadegar. It must **never feel like AI
analysis.** It should feel like opening an old journal and finding exactly the
page you needed today.

**Not** the goal: summarize · optimize · coach · diagnose · teach.
**The** goal: **return one meaningful thing from your own words.**

### Core principle (unchanged, load-bearing)
Yadegar never tells you what your journal *means*. It only **brings it back**.

- ❌ "This entry reflects your growth around resilience."
- ❌ "You seem to have overcome anxiety."
- ✅ "**June 3, 2018**" — then your words.

This holds for *both* surfacers.

---

## Feature 6 — How a page comes back

> **Status: split into two parts.** 6a (the engine) is **built and live**. 6b
> (date-based) is the **new build** this batch unlocks.

### 6a — The meaning engine (built)
The two-pass Replit engine that finds significance: emotional center, specificity,
discovery, contradiction, worth-returning-to; holistic selection; §3.1 crisis
floor; one result or honest silence. Its lenses map to the original draft's
"types" as follows:

| Original draft "type" | Lives in | Engine lens / mechanism |
|---|---|---|
| Unexpected Return | engine | the surfaced result (any lens) — "Something worth revisiting." |
| Enduring Thread | engine | `thread` (+ Option B `secondaryThread`) |
| Distance | engine | `distance` |
| Forgotten Wisdom | engine | `wisdom` |
| The Words You Saved | engine | `value_signal` (kept separate forever) |

No change to the engine in this batch except the **crisis-scope fix** (push path)
already tracked in HANDOFF. The richer V2 "why today?" relevance model stays a
future engine project (`memory-engine-v2-vision.md`) — note that **6b delivers a
cheap, deterministic slice of V2's "temporal resonance" today, without an LLM.**

### 6b — Date-based memories (NEW — the pivot)
A deterministic surfacer that needs no model. Given today's date and the user's
entries, it can compute, instantly and for free:

- **On This Day** — entries from this same calendar date in prior years.
  - *Facebook-Memories logic, stated plainly:* match **month + day**, show **one
    card per prior year that has an entry near today** (a ±3-day window so a date
    doesn't have to land exactly), newest-first, labeled by distance:
    *"From a year ago today" · "From three years ago today" · "From seven years
    ago today."* If you wrote on June 3 in 2018, 2021, and 2024, opening June 3,
    2027 shows three cards. Empty days simply show nothing.
  - Copy: **"From seven years ago today."**
- **Around This Time** — same season / month when there's no exact-date hit.
  Copy: **"Written around this time of year."**
- **Forgotten Page** — a real, specific page not opened in a long time (uses
  `opened_at`). Copy: **"A page you haven't seen in a while."**
- **Favorite Memory** — drawn from starred entries. Copy: **"You marked this as
  important."**

**Safety floor for 6b (required):** the date-based surfacer must apply the **same
§3 hard floors** as the engine (no body/appearance/eating content) and must
**skip active-crisis pages** and any entry with `resurfacing_preference = never`
or inside a muted date range. Because the floor logic lives in the engine today,
the cleanest implementation is a small shared classifier/flag (cheap heuristic or
a one-time per-entry tag at write/import time) so 6b doesn't need a live LLM call.
*Open implementation question — see §Build notes.*

### Memory card structure (both surfacers — unchanged shape, Yadegar copy)
**Header** — `From your journals` · `June 3, 2018` _or_ `Seven years ago today`.
**Body** — a selected excerpt, **50–300 words** (enough context; never tiny
snippets; for short entries, the whole page).
**Footer** — `Open full page →` · `★ Favorite` · `Save for later` ·
`Not this one` (dismiss). New: an overflow action **"Don't show pages from this
time"** (date-range mute).

### Ranking
- **Engine (6a):** unchanged holistic scoring (see HANDOFF §2).
- **Date-based (6b):** ranking is mostly mechanical — exact-date > same-week >
  same-season; **favorites and longer/specific entries float up; lists, to-dos,
  shopping notes, duplicates, and imported garbage sink** (reuse the engine's
  existing low-signal heuristics where possible).
- **Don't-repeat rule (both):** never show the same memory twice within **6
  months** unless the user asks. The signal already exists — `returned_memories`
  records `opened_at` / `dismissed`; date-based shows should write the same
  ledger so rotation is shared across surfacers.

### Acceptance criteria
- The user receives **one** memory at a time (per surface), and it feels personal.
- It never reads as AI-generated — dates + their words only.
- The user can open the full entry, favorite it, save it, or dismiss it.
- Hard floors hold for **both** surfacers; active-crisis pages never appear.
- `resurfacing_preference = never` and muted date ranges are always respected.

---

## Feature 7 — Returns (the memory inbox)

> **Status: built and live** (`/returns`, cards with favorite/dismiss, stored
> permanently). This batch clarifies *what lands there* under the two-surfacer
> model.

- **Returns is the home for kept gifts**, not a live feed. Engine pushes land
  here permanently and revisitably. A date-based memory the user **keeps** (saves
  / favorites / reflects on) is **promoted into Returns**; ephemeral "on this day"
  cards the user merely glances at do **not** clutter it.
- Title stays **Returns** (preferred over "Things that came back").
- Newest first. **No infinite scroll. No social feed. Cards feel like letters** —
  large margins, paper aesthetic.
- **Empty state:** "Nothing has returned yet. Keep writing. We'll bring something
  back when it's ready."

**New (small):** Returns gains a quiet entry point to **On This Day** browse
(Feature 6b) — so Returns = *the gifts you kept*, On This Day = *go looking on
your own*. Both reachable, neither a feed.

### Acceptance criteria
- Past resurfaced memories are accessible and stored. Returns is searchable later.

---

## Feature 8 — The full reading experience + Reflection Mode

> **Status: built and live** (`/library/:id`, reading layout, Favorite · Edit ·
> Delete · Reflect). Reflection composer exists.

When someone opens a memory they enter the original page — one of the most
emotional moments in the product. Large date, readable serif, generous margins,
**no sidebar, no AI panel, no analysis.** Footer: Favorite · Edit · Delete · Back.

**Reflection Mode (polish this batch):** after reading an old page, a subtle,
optional prompt — **"What do you notice now?"** → **Write a reflection** — creating
a *linked* reflection (e.g. a 2027 note attached to a 2016 entry). The original is
never altered. (This is the seam into Feature 11.)

### Acceptance criteria
- Read the original entry; edit; create a reflection; original stays unchanged.

---

## Feature 9 — Favorites, treasured pages & hiding

> **Status: built and live** (★ star, Favorites filter in Library, engine weights
> favorites higher). This batch adds the **control surface** the pivot requires.

- **★ Star** (archival, not a heart). Favoriting raises resurfacing probability,
  filters in Library, and exports separately. Separate from
  `resurfacing_preference`.
- **NEW — hiding, the other half of trust:**
  - Per-entry **"Don't resurface this"** (`resurfacing_preference = never`,
    already in schema) surfaced as a clear toggle on the entry + on memory cards
    ("Not this one" → "…and don't show it again").
  - Optional **date-range mute** ("Don't resurface pages from `Aug 2019`") for
    fencing off a grief window without deleting anything. _(New preference; small
    schema addition — see Build notes.)_
- **Future:** Annual Favorite Collection — *"Your treasured pages from 2027"* as a
  beautiful PDF/export.

### Acceptance criteria
- Favorite / unfavorite; engine weights favorites higher.
- A user can prevent any page (or any time-window) from ever returning, without
  deleting it.

---

## Feature 10 — Nudges & memory delivery

> **Status: built and live** — `/settings/notifications` (writing / memory ·
> off/weekly/monthly, both off by default), `POST /cron/run-nudges` sends due
> nudges (the memory nudge runs the engine, so all gates apply). This batch adds
> a **cheaper, gentler date-based nudge path.**

Design principle unchanged: **Yadegar is not Duolingo.** No streaks, badges,
missed-day guilt, or red notifications — **ever.** Every notification feels like
**a friend putting a page on your desk.**

**NEW nudge types (date-based, no engine call):**
- **On This Day return** — *"A page from June 2018 came back today."* (links to
  the date-based card; the cheapest, most reliable nudge there is.)
- **Seasonal reflection** — *"You wrote often this month, five years ago. Would
  you like to revisit it?"*

These let us send a gentle, *true* nudge even on days the engine would stay
silent — without spending an API call or risking a misfire. The existing
engine-backed memory nudge remains for the occasional deeper gift. **Heavy pages
stay behind a tap:** the nudge copy is warm and quiet; the page itself opens only
when the user chooses.

**Settings:** frequency (Never · Monthly · Biweekly · Weekly · Few times a week ·
Daily; recommend **Weekly**) and time (Morning · Afternoon · Evening · Custom;
recommend **Morning**). _(Schema has `frequency` + `preferred_day` + `preferred_time`;
biweekly/few-times-a-week/daily are additions if we want the full range — confirm
how granular to go.)_

Allowed copy: *"A page from 2019 came back today." · "You once wrote this." ·
"Something worth revisiting."*
Forbidden: *"Your weekly journal insight is ready." · "You haven't journaled in 12
days." · any streak/engagement language.*

### Acceptance criteria
- Users control frequency + timing and can disable all nudges.
- No streak or guilt language anywhere. Heavy material never pushed, only offered.

---

## Feature 11 — Reflections across time (the crown jewel)

> **Status: built and live** — linked reflections render beneath the entry as
> letters across time; the original is never modified.

The most beloved feature. A 2016 page and a 2027 reflection living **together —
not merged, not analyzed, just connected.** Over years the user builds a
conversation with former selves.

```
2016 — "I am tired. I am very very very tired."
2027 — "I wish I could hug the person who wrote this."
```

No change needed beyond the Reflection-Mode prompt polish in Feature 8. This is
the feature the date-based surfacer most directly *feeds*: more honest pages
coming back → more reflections written → deeper archive. Protect it; never let
analysis or AI commentary creep into this surface.

---

## Build priority (this batch — most of the list is already done)

Ordered by leverage, given what already exists:

1. **Engine crisis-scope fix** (push path) — unblocks "Bring a page back"
   regardless of the pivot. *Small; engine/Replit; guarded by the harness.*
2. **Date-based surfacer (6b)** — On This Day + Forgotten Page + Favorite, with
   the shared hard-floor/crisis/never filter. Surfaced on **Today** + a light
   browse, fed into the don't-repeat ledger. *The big unlock.*
3. **Date-based nudge type (10)** — "On this day" + seasonal, no engine call.
4. **Hiding controls (9)** — per-entry "don't show again" toggle + date-range
   mute (small schema add).
5. **Reflection-Mode prompt polish (8)** — "What do you notice now?" after reading.
6. **Returns ↔ On This Day wiring (7)** — keep promotes a date memory into Returns.
7. **Future:** Annual Favorite Collection; "surprise me" random (hard-floor
   filtered); engine V2 relevance model.

## Build notes / open questions (engineering)
- **Hard-floor reuse for 6b.** The §3 floor + crisis classifier live in the
  engine (an LLM pass). The date-based surfacer must not pay that cost per view.
  Options: (a) **tag each entry once** at write/import time with a cheap
  safety/quality flag (preferred — turns a live gate into a stored column); (b) a
  fast lexical heuristic for the floors; (c) lazily classify a date-eligible entry
  the first time it would surface, then cache. Recommend (a). _Needs a schema
  field, e.g. `journal_entries.resurface_flags jsonb` or a `safety_tag`._
- **Don't-repeat ledger sharing.** Date-based shows should write to the same
  `opened_at`/`dismissed` signal so the 6-month rotation is global across both
  surfacers (avoid 6b re-showing what the engine just gave).
- **Date-range mute** — small new preference (per-user list of muted
  month/year ranges), checked by both surfacers.
- **Returns vs. ephemeral.** Decide the promotion rule precisely: a date memory
  enters Returns on favorite/save/reflect (not on mere open). Keep Returns a
  collection of gifts, not a log.

---

## Guardrails that do not move (for any future edit to this doc)
- Only ever show the user's **own words.** No summaries, scores, coaching,
  diagnoses, mood charts, personality labels.
- **Offer, never push.** Heavy material lives behind a tap; nudges are quiet.
- **One thing at a time.** No feeds, no infinite scroll, no engagement metrics.
- **Hard floors are absolute**; active-crisis pages are never resurfaced.
- **The user owns what returns** — favorite, hide, mute, export, delete, anytime.
- **No streaks, badges, guilt, or red notifications. Ever.**
</content>
</invoke>

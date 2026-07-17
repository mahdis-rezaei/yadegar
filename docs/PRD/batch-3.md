# Yadegar — Batch 3: Ownership, Continuity & Delight (v2)

_Updated 2026-06-03. Supersedes the original "Still Product Requirements —
Batch 3" draft. Authored with Mahdis. Companion docs: `mvp-v1.md`,
`batch-2.md`, `memory-engine-v2-vision.md`, `../HANDOFF.md`._

> **Brand note.** User-facing copy says **Yadegar**. Internal code keeps the
> "still" codename. This doc is product-facing, so examples use **Yadegar**.

Batch 1 = Foundation · Batch 2 = Memory (resurfacing) · **Batch 3 = meaningful
ownership, continuity, and delight** — the features that deepen a lifelong
relationship without ever becoming a habit-loop.

---

## 0. Read first — reconciling with what exists

The original Batch 3 draft predates the launched product and Batch 2. Three
things reshape it:

### (a) Some of it is already built
- **Feature 12 — Reflections Across Time is DONE and live** (shipped as Batch 2's
  "Reflections across time"). Linked reflections render beneath an entry as
  letters across time; the original is never modified; multiple reflections per
  entry are already supported. **No new work** beyond the optional Reflection-Mode
  prompt polish already noted in `batch-2.md`. Treat Feature 12 as closed.
- **Feature 16 — Search** partly exists: the Library has a client-side search box.
  Batch 3 elevates it into a first-class "search your whole life," but the
  foundation (and the key constraint) is already set — see (c).
- **Feature 18 — Memory Calendar** overlaps Batch 2 heavily: On This Day + Look
  Back already do date-based resurfacing. Calendar is a *navigation* re-skin of
  the same date data — reconciled below, not a from-scratch build.

### (b) The "browse vs. resurface" line (the most important new principle)
Batch 2 introduced safety floors for **resurfacing** — the `resurface_safety`
verdict, `resurfacing_preference = never`, and the date-range **mutes** all
govern what comes back to the user **unbidden** (the engine's push, the date
nudge, On This Day, Look Back).

**Batch 3 is mostly the opposite mode: deliberate navigation of your own
archive** (Search, Timeline, Calendar, Themes). The rule:

> **Floors and mutes govern resurfacing, not navigation.** When the user
> *deliberately goes looking* — searches, opens the timeline, taps a month —
> they see their whole archive, exactly like the Library does today (which shows
> everything, unfiltered). We do **not** hide a page from the person who wrote it
> and is actively looking for it. Mutes/`never`/hard-floors only stop a page from
> arriving *uninvited*.

This single distinction settles most of Batch 3's "should this be filtered?"
questions: **navigation surfaces = full archive; resurfacing surfaces = floored.**
(One nuance for Themes — see Feature 13.)

### (c) Three hard architecture facts constrain Batch 3
1. **Encryption at rest → search is client-side.** Entry body/title are
   AES-256-GCM encrypted, so Postgres cannot `ILIKE` them. Server-side full-text
   search is impossible without weakening privacy. Search therefore stays
   **client-side** (as Library's already is). This is a privacy *feature*, not a
   limitation — design around it (Feature 16).
2. **Themes need the engine (and risk "diagnosis").** Recurring-theme detection is
   cross-entry LLM work — it belongs to the **Engine V2** track
   (`memory-engine-v2-vision.md` already models theme/diversity tracking), is the
   most principle-risky feature in the batch, and is the user's own Tier C. Defer
   and tie to V2 (Feature 13).
3. **No new heavy deps for PDFs.** The repo deliberately removed PDF *import*
   ("can't preserve words faithfully"). For Annual Letters (PDF *export*), prefer
   a beautifully-typeset **print-CSS web page** the user prints to PDF — zero
   server PDF dependency, and a better archival-typography fit (Feature 14).

### Design guardrails carried forward (unchanged, non-negotiable)
Quiet · literary · timeless · human. **No streaks, badges, points, guilt, or red
notifications — ever.** Only ever show the user's own words; never diagnose,
score, coach, or summarize a personality. Offer, never push. The user owns
everything (export/delete/hide/mute). Silence is a valid answer.

### Decisions to confirm (flagged for Mahdis)
1. **Browse vs. resurface** (navigation = full archive) — assumed **yes**.
2. **Search stays client-side** (privacy-preserving; load the archive and index
   in-browser) — assumed **yes**; the alternative (a server search index) leaks
   plaintext and is off the table for v1.
3. **Themes deferred to Engine V2** — assumed **yes** (it's the only engine-heavy,
   principle-risky item).
4. **Annual Letters as a print-CSS page**, not a server-rendered PDF — recommended.

---

## Feature 12 — Reflections Across Time
**Status: DONE & LIVE.** Closed in Batch 2. The "one life across decades" vision
(2016 entry ↓ 2022 ↓ 2027 reflections) already works — reflections are a
chronological list linked to an entry, rendered as stacked letters, original
untouched. The only open polish is the optional after-reading prompt ("What do
you notice now?") already tracked in `batch-2.md`. No Batch 3 work.

---

## Feature 17 + 20 — Continuity (streak replacement) & Gentle Milestones
**Status: NEW. The cheapest, most on-brand wins in the batch — recommend FIRST.**

These two are one idea: **celebrate accumulation, never consistency.** Both are
pure computed reads over existing data (entries + reflections + returned_memories)
— no migration, no engine, no risk, total taste fit (the "no streaks" rule is
already a core principle).

**Continuity metrics** (a quiet card, e.g. on Today or Library):
- "You've been writing here since 2027." · "These pages now span 3 years." ·
  "You've written 412 pages." · "Your oldest page is now 8 years old."
- Archival metrics, never productivity metrics. No "7-day streak," no "missed
  yesterday," ever.

**Gentle Milestones** (quiet, event-triggered cards — no confetti/badges):
- "Your first imported journal is now 10 years old." · "You wrote your first
  reflection today." · "This page has returned 3 times across 7 years." · "You've
  been writing here for 1 year."

*Build:* a `GET /me/continuity` (or extend an existing endpoint) returning the
counts/dates; milestone detection is a handful of cheap checks. Surface as a calm
card. The "returned N times" milestone reads `returned_memories`.

---

## Feature 15 — The Timeline of You
**Status: NEW. The "I've never seen this before" feature — recommend EARLY.**

A chronological spine of the user's life *from their own entries* — years down
the side, pages on the right, opened with a tap. Built entirely from existing
`/entries` data (dates already present); a **navigation** surface → full archive.

- v1: entries grouped by year, fast year-jump nav, open any entry. Mostly
  frontend over data we already serve.
- **Milestones:** let the user *mark* an entry as a milestone ("Moved to New
  York") so it stands out on the spine. Small addition — a `milestone` flag (or a
  `metadata` key, which entries already have → possibly **no migration**).
- **Optional AI milestone suggestions: defer.** "Nothing automatic" is the
  user's own rule; suggestions are an Engine-V2-adjacent nicety, not v1.

*Risk:* performance on a decade of entries — handle with year-bucketed loading /
virtualization (same concern as Search; share the solution).

---

## Feature 16 — Search Your Life
**Status: PARTLY BUILT (Library client-side search). Elevate to first-class. The
most-used feature — recommend EARLY.**

The design is shaped by fact (c.1): **search is client-side** because bodies are
encrypted. That's good for privacy; we lean into it.

- A dedicated, fast search over the **whole archive** (navigation → unfiltered),
  **results grouped by year** ("2016 · 3 pages / 2022 · 7 pages"), not a flat
  "17 results." Highlight matches.
- Filters: keyword · year · month · favorite · source (these are cheap;
  theme-filter waits on Feature 13).
- **Scaling the client-side constraint:** fetch the archive once and build an
  in-browser index (e.g. a lightweight inverted index / a small client search
  lib), with virtualized results. For journaling volumes (even 10 years ≈ a few
  thousand pages) this is fine; design for it rather than against it.

*Decision:* keep it client-side (privacy). A server-side search index would
require storing decrypted/searchable text — **off the table for v1.**

---

## Feature 19 — The Memory Shelf
**Status: NEW. Distinct from Favorites — recommend MID.**

Favorites = "this mattered" (can be hundreds). **Shelf = "this is meaningful
*right now*"** — a small, curated, reorderable set the user keeps close.

- *Build:* a small **`shelf_items` table** (user_id, entry_id, order_index,
  created_at) rather than a boolean, so manual **drag-ordering** is possible
  later without a second migration. One additive migration.
- Endpoints: add/remove/list/reorder. A "Shelf" view; an "Add to shelf" action on
  entries and on memory cards.
- Navigation surface (the user's own curation) → no floors.

---

## Feature 18 — Memory Calendar
**Status: NEW, but RECONCILE with Batch 2 — recommend MID.**

A calendar is a *navigation re-skin* of date data we already surface (On This Day
/ Look Back). Tap a month → see that month's pages across all years; tap a day →
its pages. Paper aesthetic, not Google Calendar.

- **Reuse, don't rebuild:** it queries the same dated entries. Because it's
  **navigation**, it shows the **full archive** by date (like Library), *not* the
  floored resurfacing set — this is the cleanest distinction from On This Day
  (which is the *resurfacing* view of the same dates).
- *Build:* a by-month/day entries query (dates are unencrypted, so this is a
  clean server query — no client-side workaround needed) + a calendar UI.

*Open question to confirm:* should Calendar and Look Back feel like one place
(two views of "your past by date") or stay separate? Recommend **one home**
("Look back" gains a calendar view) to avoid two date-browsers.

---

## Feature 14 — Annual Letters ("Your Year in Pages")
**Status: NEW. Emotionally high-value, medium effort — recommend MID/LATE.**

A yearly artifact: "This year you wrote 183 pages. These are a few that stayed."

- **Render as a typeset web page** (`/letters/:year`) with print CSS → the user
  prints to PDF. No server PDF dependency (fact c.3), and CSS gives real archival
  typography. "Download" = print-to-PDF; "regenerate" = just reload.
- **v1 sections from signals we already have:** page count for the year,
  favorited pages, reflections written, a few returned memories
  (`returned_memories`). 
- **Defer the theme-dependent sections** ("questions you asked often") until
  Feature 13 / Engine V2 exists — don't block the artifact on them.

---

## Feature 13 — Themes Across a Life
**Status: NEW but DEFER (Engine V2) — the only heavy, principle-risky item.**

Recurring themes (Home, Belonging, Grief, Beginning Again…) surfaced as a shelf
of the user's own pages under a theme word — **"Home appeared throughout your
journals," then their pages, nothing more.**

Why defer:
- It's **cross-entry LLM work** → the Engine (Replit), a new PROMPT_VERSION, and
  harness fixtures for a cross-run property. This is precisely the
  theme/diversity modeling in `memory-engine-v2-vision.md`. Build it *with* V2.
- It's the **highest "diagnosis" risk** in the whole product. The guardrail must
  be absolute: a theme shows **a word + the pages**, never a sentence
  interpreting the person. No "you struggle with belonging." Recognition, not
  analysis.
- It's the user's own **Tier C**.

When built: themes are a **navigation** surface (browse your own archive by
recurring topic) → it may span the full archive, **but** it must still honor the
§3 hard floor in what it *labels/headlines* (don't create a "theme" out of
body/appearance/eating content). Treat the floor as a labeling constraint here,
not a hiding one.

---

## Re-tiered build order (effort × taste × what's already built)

**Tier A — do first (cheap, no/low migration, pure taste fit):**
1. **Continuity + Gentle Milestones (17+20)** — computed reads, zero risk, instant
   delight. The warmest cheapest win.
2. **Timeline of You (15)** — mostly frontend over existing dates; the wow view.
3. **Search Your Life (16)** — elevate the existing client-side search; most-used.

**Tier B — next (one small additive migration each, reuse Batch 2 infra):**
4. **Memory Shelf (19)** — `shelf_items` table.
5. **Memory Calendar (18)** — reuse date data; fold into "Look back."
6. **Annual Letters (14)** — print-CSS page; existing signals only.

**Tier C — later / with Engine V2:**
7. **Themes Across a Life (13)** — engine work + strict anti-diagnosis framing.

**Already done:** Reflections Across Time (12).

This reorders the original draft slightly: it front-loads the **zero-migration,
zero-risk** wins (continuity/milestones) the original buried in Tier C, and
defers Themes to where the engine work actually lives. The original's instincts
on the headliners hold: **Timeline** = the strongest novelty, **Search** = the
most-used, **Reflections** = the most emotionally powerful (and it already
ships).

---

## Build notes / engineering
- **Search & Timeline share a problem:** loading a large archive client-side.
  Solve once — a cached `GET /entries` (dates + light fields; bodies only when
  needed) + in-browser indexing/virtualization — and both features ride it.
- **Calendar uses dates only** → a clean server query (dates aren't encrypted),
  unlike Search.
- **Shelf** → new `shelf_items` table (order_index for future drag).
- **Milestone flag** for Timeline → try `journal_entries.metadata` first (exists)
  to avoid a migration; promote to a column only if querying by it gets heavy.
- **Annual Letters** → no new deps; a print-stylesheet route.
- **Themes** → Engine V2 (Replit), harness-guarded, new PROMPT_VERSION.
- Every new endpoint goes in `openapi.yaml`; the app can use hand-written hooks
  until `codegen` runs (as in Batch 2).

## Guardrails that do not move
- Only the user's **own words**; no diagnosis, scores, coaching, personality
  summaries — this binds **Themes** hardest.
- **Navigation shows the whole archive; resurfacing honors the floors/mutes.**
- **No streaks, badges, points, guilt, or red notifications. Ever.** (Feature 17
  is the *anti*-streak.)
- Quiet, literary, archival. Artifacts feel like letters and shelves, not reports
  or dashboards.
- The user owns everything — export, delete, hide, mute, curate — anytime.

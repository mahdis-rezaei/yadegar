# Yadegar — Batch 4: Trust, Legacy & the Threads of a Life (v2)

_Updated 2026-06-03. Supersedes the original "Still Product Requirements —
Batch 4" draft. Authored with Mahdis. Companion docs: `mvp-v1.md`, `batch-2.md`,
`batch-3.md`, `memory-engine-v2-vision.md`, `../HANDOFF.md`._

> Brand: user-facing **Yadegar**; internal codename **still**.

Batch 1 = Foundation · 2 = Memory · 3 = Ownership/continuity/delight ·
**Batch 4 = trust + legacy + the threads of a life.** The original draft's thesis
holds and is worth repeating: *someone can switch journaling apps; they rarely
leave the place where their life lives.* **Trust is the moat.**

---

## 0. Read first — the evaluation

### (a) One feature is already built
- **Feature 28 — "The Quietest Metric" (Pages Kept) is DONE.** It shipped in
  Batch 3 as the **Continuity card** ("X pages across Y years"). Closed. (If we
  want the exact "Pages Kept / across N years of your life" phrasing, it's a
  one-line copy tweak to the existing card — not a feature.)

### (b) The big structural insight: **Collections** unifies five features
Five Batch 4 features are the *same primitive* — **a user-named group of pages,
shown chronologically** — and the draft explicitly forbids AI judgment on all of
them ("only retrieval," "no profiling," "no relationship scoring," "user can edit
location assignments," "user can manually create… AI suggestions later"):

| Feature | Is really… |
|---|---|
| 25 People in My Life ("Mom" across years) | a Collection of kind **person** |
| 26 Places I've Been ("London 2014–2016") | a Collection of kind **place** |
| 24 Journal Continuity View (a question over time) | a Collection of kind **thought** |
| 27 Before & After (two pages side by side) | a Collection of kind **pair** (or a 2-item view) |
| (manual) Themes Across a Life | a Collection of kind **theme** |

So instead of building five features, build **one Collections system** — and get
all five. This also resolves Batch 3's deferred **Themes** for the *manual* case:
a user can curate a "Home" collection today; the *automatic* theme/people/place
detection is the engine enhancement layer (see (d)).

**Proposed model (one migration):**
- `collections` (id, user_id, name, kind: person|place|theme|thought|pair|custom, created_at)
- `collection_items` (id, collection_id, journal_entry_id, order_index, created_at)
- A collection page = the name + its entries **chronologically**. `kind` lets the
  UI group them ("People," "Places," …) and enables kind-specific touches later
  (a place map; a thought rendered as a question evolving; a pair shown as two
  found letters). "Add to collection" sits on the full-page reader (next to the
  shelf toggle), and pages can be in many collections.

This is pure **retrieval + user curation** — exactly what the spec asks, zero
diagnosis risk, **no engine.**

### (c) PDFs stay print-CSS (no server dependency)
Export-to-PDF (21) and **The Book of You** (23) reuse the **Annual Letters
pattern**: a beautifully typeset web page + print CSS → the browser's
print-to-PDF. We deliberately avoid a server PDF engine (we removed PDF *import*
for the same fidelity reasons). "Hardcover-quality" is achievable with real
typography + `@media print` (page numbers, chapter breaks via CSS). Markdown,
plain-text, and JSON exports are trivial server responses.

### (d) Where the engine actually comes in (answers "all 7 batches then engine?")
**Recommendation: no — don't defer the engine to after Batch 7.** Two reasons:
1. **Your own Batch 4 note** says the work *right after* Batch 4 is "AI
   architecture, memory selection **engine v2**, parsing intelligence,
   personalization." So the engine is effectively **Batch 5** by your own plan,
   not batch 8.
2. **Batch 4 is fully buildable engine-free** (Collections + print-CSS + a
   capsule table + content pages). The engine isn't a *blocker* for Batch 4 — it's
   the **enhancement layer** that later sits on top of it: auto-suggesting a
   collection's members ("pages that mention Mom"), auto-detecting people/places,
   auto-pairing before/after, and the automatic Themes + "why today?" relevance.

So the clean sequence: **build Batch 4 now (trust, engine-free) → then Engine V2
as Batch 5 (it retro-actively upgrades Collections, Themes, People/Places, and
resurfacing) → then reassess 6–7 with intelligence in hand.** Building 5–7 before
the engine would mean building more features that the engine later wants to
re-touch. (This is a recommendation — say the word if you'd rather march 4→7
first.)

### Design guardrails (unchanged, binding)
Quiet · literary · timeless · human. Only the user's own words; **no profiling,
no relationship/AI scoring, no diagnosis.** No streaks/badges/guilt. Offer, never
push. **Browse vs. resurface** (Batch 3): navigation/collections show the whole
archive; only resurfacing honors floors/mutes. The user owns everything.

### Decisions to confirm
1. **Collections as the unifying primitive** for People/Places/Continuity/
   Before-After/manual-Themes — assumed **yes** (the doc is built on it).
2. **PDFs via print-CSS**, not a server PDF engine — assumed **yes**.
3. **Engine V2 as Batch 5** (not after Batch 7) — recommended.
4. Legacy controls (29): **design the data model now, ship later** — assumed yes.

---

## Feature 21 — Your Life, Exported
**Status: PARTLY BUILT (privacy JSON export exists) — extend. Cheap, high-trust.**

Today: `GET /privacy/export` returns full JSON. Batch 4 makes export *richer than
import* (the trust promise):
- **Formats:** JSON (done) · **Markdown** · **plain text** (both trivial server
  serializers) · **PDF** (a print-CSS "printable archive/year" page).
- **Scopes:** full archive · a year · favorites · reflections · a **collection**
  (ties to (b)).
- **Home:** Settings → "Export my journals" — "Your journals belong to you.
  Export them anytime." Instant for normal archives; note a queued path only if
  archives ever get huge.

## Feature 22 — Memory Capsule ("Send to Future Me")
**Status: NEW, self-contained, delightful — strong early pick. (one small table)**

A sealed letter to your future self. `capsules` table (user_id, body [encrypted],
created_at, deliver_at, delivered_at, opened_at). **No editing after sending** —
sealed. Delivery reuses the **existing cron**: due capsules surface on Today /
Returns ("A page from your past arrived today") + an email nudge. Choose delivery:
1y · 5y · 10y · custom. On-brand and magical; no engine.

## Feature 23 — The Book of You
**Status: NEW — extends Annual Letters. Medium. (no migration)**

A longer-form keepsake: choose a year / range / theme(collection) / favorites →
a typeset, print-ready **print-CSS book** ("The Pages of 2027 · Mahdis Rezaei"):
cover, chapter breaks (by year/month), page numbers, real memoir typography.
Builds directly on the Annual Letters renderer. Photos = future (no media yet).

## Feature 24 — Journal Continuity View (a thought over time)
**Status: NEW → a Collection of kind `thought`.**

The same question across years, placed together (2016 "Why am I not happy?" →
2027 "I think I finally understand."), **never explained.** It's a chronological
collection with a "thought" presentation. Built on (b); no engine for the manual
case (auto-linking is V2).

## Feature 25 — People in My Life
**Status: NEW → a Collection of kind `person`.** Curated, retrieval-only ("Mom"
across years). No profiling/scoring (binding). Auto-suggest "pages mentioning
Mom" = V2.

## Feature 26 — Places I've Been
**Status: NEW → a Collection of kind `place`.** "London 2014–2016," entries
grouped; **user can edit location assignments** (exactly curation). A map view is
a later flourish. Auto-detection = V2.

## Feature 27 — Before & After
**Status: NEW → a Collection of kind `pair` (or a 2-page side-by-side view).**
Manual creation now ("Before: I'm scared to move / After: I can't imagine living
anywhere else"), shown like two found letters. AI suggestions = V2.

## Feature 28 — The Quietest Metric (Pages Kept)
**Status: DONE** (Batch 3 Continuity card). Optional one-line copy tweak to match
the "Pages Kept · across N years of your life" wording. No build.

## Feature 29 — End-of-Life & Legacy Controls
**Status: DESIGN NOW, SHIP LATER (per the draft).** We already have export +
permanent account delete. Design the *data model* for: a legacy choice
(delete-all / leave / **designate a trusted person** / auto-export / archive
package) — likely a `legacy_preferences` row + (later) a verified-contact flow.
Don't build the trusted-person handoff yet (it needs identity/verification design
+ legal care), but reserve the shape so it's not a retrofit.

## Feature 30 — The Yadegar Philosophy Page
**Status: NEW, pure content — cheapest trust win.** A public/auth page (like
`/why`) stating the values: *Your words belong to you · Memory is not productivity
· Reflection over optimization · The page has not changed — you have · Why there
are no streaks · Why AI never interprets your life.* No backend.

---

## Re-tiered build order

**Tier A — cheap, high-trust, mostly no migration:**
1. **Philosophy page (30)** — content only; states the moat in the product's voice.
2. **Export, extended (21)** — Markdown/text + scopes on the existing export; PDF
   via a print page. Trust = "leaving is easy."
3. **Memory Capsule (22)** — one small table + cron delivery; pure delight.

**Tier B — the Collections primitive + its five faces (one migration):**
4. **Collections** (`collections` + `collection_items`) + "Add to collection" on
   the reader + a Collections home, then surface the kinds: **People (25) ·
   Places (26) · Continuity/thought (24) · Before & After (27) · manual Themes.**
5. **The Book of You (23)** — extends Annual Letters; can also render a collection.

**Design-only now:**
6. **Legacy controls (29)** — reserve the data model; ship later.

**Then (Batch 5): Engine V2** — auto-suggest collection members, auto people/
place/theme detection, "why today?" relevance. The intelligence layer on top of
everything above.

---

## Build notes
- **Collections** is the one migration in Batch 4 — two tables; everything else is
  code-only (extends existing endpoints/renderers) or a single small table
  (capsules).
- **Capsule delivery** rides the existing `/cron/run-nudges` tick (check due
  capsules); store body encrypted (reuse `encryptedText`).
- **Exports/Book** reuse the Annual Letters print-CSS approach + trivial
  serializers; no new deps.
- New endpoints → `openapi.yaml`; app uses hand-written hooks until `codegen`.
- **One superset sync per deploy** (lesson learned): "sync to latest head, run any
  migration noted."

## Guardrails that do not move
- **Retrieval, never judgment.** People/Places/Themes/Continuity show pages; they
  never profile, score, or interpret a person or a relationship.
- Collections & exports are **navigation** → the user's whole archive.
- Sealed capsules are **immutable** after sending.
- No streaks, badges, guilt. The only metric is accumulation (Pages Kept).
- The user owns everything — export (richer than import), curate, delete, and
  decide its legacy.

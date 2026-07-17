# Still — MVP Product Requirements (v1.0)

_The canonical product + technical spec for the Still MVP. Authored by Mahdis._
_Companion docs: `docs/STILL-BUILD-AND-EVAL.md` (engine + eval), `docs/PRODUCT-BUILD.md` (phase tracker + workflow), `docs/HANDOFF.md`._

## Product vision
Still is a lifelong journaling companion. People revisit old journals not for
analytics but to remember: *What was I thinking? How was I feeling? What
mattered? How far have I come? What survived?* Still helps people stay in
conversation with their past selves.

Still is **not** a therapist, coach, or productivity tool. It is a companion. It
keeps your pages, and every so often gently brings one back.

## Core philosophy
Every decision passes one test: **"Does this help someone reconnect with their
own words?"** If yes, build it. If no, don't.

## Things Still will never be
No streaks, social feeds, public profiles, likes, followers, engagement metrics,
productivity dashboards, mood scores, personality reports, AI life coaching, AI
therapy. Still is not trying to explain a life — it helps someone revisit it.

## Design principles
- **Quiet** — calm, no loud colors, no urgency, no red badges, no anxiety-driving notifications.
- **Literary** — closer to reading a book than using software. Large type, generous spacing.
- **Timeless** — could exist ten years ago or ten years from now. No trendy/startup UI.
- **Human** — warm, personal, gentle. Never cute, corporate, or overly sentimental.

Inspiration: le kiff, paper journals, literary magazines, beautifully typeset
books. Not: productivity apps, Notion, Linear, Asana, social networks.

## Design system
- **Color:** background `#F8F4EC`, surface `#FFFDF8`, text `#24211D`, muted text `#7A7168`, border `#E6DDD0`, accent `#3F5D4E` or `#2F4A60`. Avoid bright blues/reds/neon.
- **Type:** headings serif (Newsreader / Cormorant / Literata); body readable (Inter / Source Serif / system).
- **Components:** soft rounded buttons, paper-like cards with large spacing + subtle borders, minimal calm inputs.
- **Motion:** subtle fades only. No bouncy animations, confetti, or gamification.

## Navigation
Authenticated: **Today · Library · Returns · Settings**. No Dashboard, Analytics, or Insights.

## Core loop
Discover → create account → import journals OR write first entry → journals
stored → memory engine returns a page → read old page → reflect → relationship
with past self grows.

---

## Landing page
- **Hero:** "Still" / "quiet enough to hear what stayed" / "Write here. Bring old journals with you. And every so often, Still brings a page back. A memory. A question. A version of you. Waiting quietly to be seen again." Buttons: **Create Account**, **Read Why I Built Still**.
- **What Still Returns:** three emotionally authentic example memories (real, not mock screenshots).
- **How It Works:** Write · Keep · Return · Reflect (a few sentences each).
- **Why Still:** short founder teaser → **Read the full story**.

## Authentication
Google Sign-In + Email/Password (Apple later). Keep existing endpoints.

## Onboarding
"What brings you to Still?" → **A)** I already have years of journals (prioritize
import) · **B)** I journal occasionally (→ writing screen) · **C)** I'm starting
fresh (sample memory → writing screen).

## Today (home after onboarding — never "Dashboard")
- **Top:** if a memory exists → "A Page From Then" + **Read Full Page**.
- **Middle:** prompt "What wants to be written today?" (alts: "What are you carrying?", "Write one honest sentence.", "What keeps returning?") + large editor.
- **Bottom:** minimal recent activity. No analytics.

## Writing experience (core feature)
Auto-save; large writing area; minimal toolbar; distraction-free; mobile-first.
Save states: **Saving… → Saved → Kept**. Never "Submitted/Posted/Published."

## Library
Archive that feels like shelves, not records. Filters: Year, Month, Favorites,
Source. Entry card: date, first lines, source, favorite star, open. No dense
tables.

## Full entry view (one of the most important screens)
Beautiful typography, large margins, reading-focused. **No** AI sidebar, analysis
panel, chat, or summaries. Actions: Favorite · Edit · Delete · Reflect.

## Reflection feature
From an old entry: **Reflect on this page** → a linked reflection. Displayed
together like letters across time (e.g. a 2016 entry ↓ a 2027 reflection). Not
comments, not chat bubbles. The original entry stays unchanged.

## Import
Sources: Paste Text, TXT, Markdown, Google Docs. Flow: choose source → parse →
review → edit dates → confirm → save. Language: "Pages Found" / "Entries Found",
never "Records Parsed." Detect dates; if none found, offer "import as one entry"
or "split later" — never fail harshly.

## Returns (home for resurfaced memories)
Each card: date, excerpt, **Read Full Page**, favorite, dismiss. Returns are
stored permanently and revisitable.

## Favorites
**Star** icon (not heart). Signals importance / meaning / future ranking
preference. Separate from `resurfacing_preference`.

## Nudges
Feel like a friend placing a page on your desk. Never guilt, never pressure.
Supported: Weekly / Monthly / Off. Allowed copy: "A page from 2018 came back
today." Forbidden: "You haven't journaled lately / Complete your streak / Your
engagement report is ready."

## Privacy (must exist in MVP, dedicated page)
**Your pages belong to you.** Export everything, delete everything, disconnect
imports, delete account — anytime. Prototype honesty: early prototype, don't use
for highly sensitive journals until the full privacy architecture is complete.
**AI disclosure (decision):** be honest that entries are read by an AI model —
privately, never to train it, never shown to anyone, never sold.

## Success metrics
Optimize for: Pages Kept, Memories Opened, Reflections Written, Favorites Added,
Years Archived, Meaningful Returns. **Not** DAU, session length, time spent,
streaks.

## MVP scope
**Build:** Landing, Auth, Onboarding, Writing, Library, Import, Full Entry View,
Returns, Favorites, Reflections, Nudges, Privacy, Memory Engine V1.
**Not yet:** Timeline, Themes, Annual Reviews, Books, Life Chapters, Places,
People, Collections, Future Self, Memory Calendar, Advanced Analytics.

---

# Technical architecture & database

**Architecture principle:** GitHub is the source of truth. Replit is used to
sync, run, migrate, and test — never make permanent code changes only in Replit
without pushing back immediately.

**Stack:** React/TS · Node/Express · Postgres · Drizzle · email+password & Google
OAuth · the existing two-pass Still engine · Resend (email, later) · Replit
(prototype hosting).

## Locked decisions (v1)
1. **UUID primary keys** (not serial) — entry IDs appear in URLs; non-enumerable IDs protect privacy.
2. **Privacy page discloses AI processing** — honest, warm, explicit.
3. **All resurfacing goes through the engine** — never raw by-date; a `returned_memory` is never created/shown with lens `crisis` or `nothing` (crisis → support; nothing → honest silence).
4. **`entry_date` is nullable** — real archives have genuinely undated pages; an "undated" group in the Library.
5. **Clean API namespace** — `/entries`, `/memories`, `/imports`, `/reflections`; the engine stays at `/still/extract` + `/still/score` (backend calls it; the frontend never calls the engine directly).

## Database schema (Postgres / Drizzle)

**users:** id (uuid pk), email (unique not null), name, password_hash, google_id
(unique), avatar_url, timezone (default America/Los_Angeles),
onboarding_completed (bool default false), created_at, updated_at, deleted_at
(nullable).

**sessions:** id (text pk = sha256 of cookie token), user_id (uuid fk),
expires_at, created_at. Cookie: httpOnly, secure in prod, sameSite=lax.

**journal_entries:** id (uuid pk), user_id (fk), title (nullable), body (not
null), entry_date (date, **nullable**), source (manual | pasted_import |
file_import | google_doc | sample), source_document_id (uuid nullable),
source_title (nullable), favorite (bool default false), resurfacing_preference
(normal | more_often | never, default normal), created_at, updated_at, deleted_at
(nullable), metadata (jsonb nullable).

**journal_imports:** id (uuid pk), user_id (fk), source (paste | txt | markdown |
google_doc), original_filename, google_doc_id, google_doc_title, status (parsing
| review | imported | failed | cancelled), raw_text, parsed_count (default 0),
imported_count (default 0), created_at, updated_at.

**parsed_import_entries:** id (uuid pk), import_id (fk), user_id (fk),
detected_date (date nullable), date_confidence (high | medium | low | unknown),
body (not null), title (nullable), include (bool default true), order_index,
created_at, updated_at.

**returned_memories:** id (uuid pk), user_id (fk), journal_entry_id (uuid nullable
fk), engine_run_id (uuid nullable), label, observation, quote, quote_date (date
nullable), lens (memory | thread | distance | wisdom | value_signal | becoming |
survival), full_engine_response (jsonb), dismissed (bool default false), favorite
(bool default false), created_at, opened_at (nullable). _Never persisted: lens
crisis or nothing._

**reflections:** id (uuid pk), user_id (fk), journal_entry_id (fk), body (not
null), reflection_date (date), created_at, updated_at, deleted_at (nullable). The
original entry stays unchanged.

**notification_preferences:** id (uuid pk), user_id (fk), writing_nudges_enabled
(bool default false), memory_nudges_enabled (bool default false), frequency (off
| weekly | monthly, default weekly), preferred_day, preferred_time, email_enabled
(bool default false), created_at, updated_at.

**still_results** (existing engine cache): cache_key (text pk), result (jsonb),
created_at. Keyed on PROMPT_VERSION; performance cache only.

## API (all scoped to the authenticated user)
- **Auth (existing):** POST /auth/register, /auth/login, /auth/logout; GET /auth/me, /auth/google, /auth/google/callback.
- **Entries:** GET /entries (year, month, favorite, source, search) · POST /entries · GET /entries/:id (incl. reflections) · PATCH /entries/:id (title, body, entry_date, favorite, resurfacing_preference) · DELETE /entries/:id (soft delete).
- **Imports:** POST /imports/paste · POST /imports/file · GET /imports/:id/review · PATCH /imports/:id/parsed/:parsedEntryId · POST /imports/:id/confirm.
- **Memories:** POST /memories/run (year?, month?, entry_ids?, fresh?) — fetch eligible entries (exclude deleted + resurfacing=never), assemble engine input, run engine, store result, return it · GET /memories · GET /memories/:id · PATCH /memories/:id (favorite, dismissed, opened_at).
- **Reflections:** POST /entries/:id/reflections · GET /entries/:id/reflections · PATCH /reflections/:id · DELETE /reflections/:id (soft delete).
- **Privacy:** GET /privacy/export (JSON for MVP) · DELETE /privacy/account (soft delete acceptable for MVP; permanent delete required before real launch).

## Engine integration
Use the existing two-pass engine as a service. Backend calls POST /still/extract
then /still/score; the frontend never calls the engine directly. Store the full
response in `returned_memories.full_engine_response`. On nothing → honest
silence; on crisis → support response (never a memory).

## Import parser
Detect: `March 12, 2026`, `Mar 12, 2026`, `2026-03-12`, `03/12/2026`,
`September 24, 2015`, `[2015-09-24]`, `May 29, 2025`. No dates found → import as
one entry or split later. Language: "We found 18 pages," not "18 records parsed."

## Empty states
- **No entries:** "Your pages will live here. Write today or bring old journals into Still." → Write today / Import journals.
- **No memory surfaced:** "Nothing honest surfaced this time. That is okay. Still is better quiet than false."
- **Import failed:** "We could not read this clearly yet. You can paste the text manually or try another file."

## Frontend pages
Public: `/`, `/why`, `/login`. Authenticated: `/today`, `/library`,
`/library/:entryId`, `/returns`, `/returns/:memoryId`, `/import`, `/settings`,
`/settings/privacy`.

## Non-negotiables
Never build: streaks, badges, points, social feed, public sharing, AI chat,
therapy chatbot, coaching suggestions, sentiment scores, mood charts, personality
labels.

## Build priority
Auth verification → DB migrations → Writing → Library → Full entry view →
Favorites → Reflections → Import (paste) → Import (file) → Returns → Memory
engine integration → Notification settings → Privacy/export/delete → Landing
polish.

## Definition of done
A user can: write a page today; import pages from the past; run Still; receive
one returned memory; open the full original page; write a reflection; and trust
that the page belongs to them.

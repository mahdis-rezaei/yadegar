# PRODUCT BUILD — turning the engine into the app

Tracks the build of the user-facing product (PRD steps 3–6 + §8) on top of the
verified engine. Phased, foundation-first. The app + Postgres + OAuth run in
**Replit**; code is authored here and synced there to run.

## Workflow — GitHub is the source of truth (decided)

One-way flow: **author here → push → Replit syncs and runs.** Replit's
"auto-merge" does NOT push back to GitHub, so any edit made only in Replit is
one re-sync away from being silently overwritten — we hit that hazard three
times. The rule:

- All code/UI changes are made in GitHub (with Claude Code). Replit is only
  used to **sync, run, and migrate** — not to edit.
- Standard sync prompt: `docs/REPLIT-PROMPT.txt` (a clean
  `git reset --hard origin/<branch>` — safe once the engine is on GitHub).
- The engine (`artifacts/api-server/src/routes/still.ts`, ~82KB incl. prompts
  at PROMPT_VERSION 2026-06-02.9) historically lived only in Replit. One-time
  fix to make GitHub complete: `docs/REPLIT-PUSH-ENGINE-ONCE.txt`. After that
  runs, GitHub holds everything and the preserve-the-engine dance is over.
- If the engine/prompts ever must change in Replit, push it back to the branch
  immediately — never leave a change living only in Replit.

## Phase status

| Phase | Scope | State |
|---|---|---|
| 1 | Auth (Google + email/password) + user-scoped storage | **done, verified live in Replit** |
| 2 | Write / store / list / read full entry (DB-backed) + import + memory engine | **done, verified live in Replit** |
| 3 | Launch: encryption at rest, email verify/reset, rate limiting, onboarding, nudges, legal, custom domain | **done — LIVE at yadegarjournal.com** |
| 4 | **Batch 2 — date-based resurfacing** (see below) | **built; deploy via the migration sync** |
| 5 | **Batch 3 — ownership, continuity & delight** (see below) | **built except Themes; deploy via the superset sync** |

---

## Batch 3 — ownership, continuity & delight (`docs/PRD/batch-3.md`, `docs/HANDOFF.md` §5)

Deepening the lifelong relationship without a habit-loop. Core principle:
**browse vs. resurface** — navigation surfaces show the whole archive (like
Library); only resurfacing honors the safety floors/mutes. Shipped on the branch:

- **Continuity + Gentle Milestones** — `GET /continuity`; an archival anti-streak
  card on Library. (no migration)
- **Timeline of You** — `/timeline`, a chronological spine over entry dates.
  (no backend)
- **Search Your Life** — `/search`, client-side (encryption → no server text
  search), year-grouped + highlighted. (no backend)
- **Explore nav** — dropdown grouping Search · Timeline · Look back · Calendar ·
  Shelf.
- **Annual Letters** — `GET /letters/:year` + `/letters/:year`, print-CSS "Your
  Year in Pages" (no server PDF dep). (no migration)
- **Memory Calendar** — `/calendar`, month grid → that month across years.
  (no migration)
- **Memory Shelf** — `shelf_items` table + `GET/POST/DELETE /shelf` + reader
  toggle + `/shelf`. **The only Batch 3 migration.**

Reflections Across Time was already done in Batch 2. **Themes Across a Life** is
deferred to the Engine V2 track (cross-entry LLM + highest diagnosis-risk).

Deploy: one superset sync with one additive migration (`shelf_items`) —
`docs/REPLIT-SYNC-SHELF.txt`. (The other Batch 3 pieces are code-only and also
ride that sync.)

---

## Batch 2 — date-based resurfacing (`docs/PRD/batch-2.md`, `docs/HANDOFF.md` §5)

The Batch 2 rewrite made date-based resurfacing a first-class mode alongside the
engine (relaxing "never raw by-date"). Built on the branch and merged to `main`
via PR #6 (merge commit — `main` now reflects the live product). Pieces:

- **Crisis-scope fix** — §3.1 assesses the writer's present state (most recent
  entry), not the whole archive. PROMPT_VERSION `2026-06-03.1`.
- **Resurfacing-safety tagging** — `POST /still/classify` + `/cron/tag-resurface-safety`
  write `journal_entries.resurface_safety`; surfacers read the stored verdict.
- **Surfacers** — On This Day, Around This Time, Favorites, Forgotten Page
  (`journal_entries.last_opened_at`), all behind one eligibility floor.
- **Look Back** browse + Today section; **date-first** memory nudge.
- **Date-range mute** — `resurface_mutes` + `/settings/resurfacing`; respected by
  every surfacer and the engine.

Deploy: two additive migrations (`resurface_safety`/`last_opened_at` columns +
`resurface_mutes` table) — see `docs/REPLIT-SYNC-FORGOTTEN-MUTE.txt`. The tagging
cron runs via cron-job.org (the `.github/workflows` version is dormant unless a
scheduled-capable default branch is used).

---

## Phase 2 — schema + entries backend (in progress)

Implements the MVP schema from `docs/PRD/mvp-v1.md` (decisions #1–#5 locked).

- **DB (`lib/db/src/schema/`):** moved to **UUID** primary keys; `entries` →
  `journal_entries` with `title, body, entry_date (nullable), source, favorite,
  resurfacing_preference, updated_at, deleted_at, metadata`; users gain
  `timezone, onboarding_completed, updated_at, deleted_at`. New tables:
  `journal_imports`, `parsed_import_entries`, `returned_memories`, `reflections`,
  `notification_preferences`. (Routes for the new tables come in later steps.)
- **Server:** entry CRUD removed from `still.ts` (now pure engine) and moved to
  `routes/entries.ts` at the clean `/entries` namespace — GET (year/month/
  favorite/source/search filters, undated sorts last), POST, GET/:id, PATCH,
  DELETE (soft). Auth refactored to string (UUID) ids.
- **Contract:** `/entries` endpoints + richer `Entry`/`EntryInput`/`EntryUpdate`;
  `AuthUser.id` is now a string. Regenerated client + zod.
- **UI (done):** shared `AppNav`; **Today** (`/today`) — date, rotating prompt,
  distraction-free editor with debounced auto-save (create-then-patch one entry;
  saving…/kept); **Library** (`/library`) — search + favorites filter, entries
  grouped by year (undated last), favorite stars, cards open the entry; **Full
  entry view** (`/library/:id`) — reading layout, favorite, resurfacing
  preference, inline edit, soft delete. `/` redirects to `/today`; the legacy
  engine-demo flow moved to `/home` (off the primary nav).
- **Memory engine (done):** `routes/memories.ts` — `POST /memories/run` gathers
  eligible entries (not deleted, not resurfacing=never, dated), assembles the
  engine input, and calls the two-pass engine as an **internal service**
  (extract→score). Persists only real lenses; crisis→support, nothing→honest
  silence, none→not_enough. `GET /memories`, `GET/:id`, `PATCH/:id`. UI:
  `MemoryCard`, Today "Bring a page back", **Returns** page (favorite/dismiss).
  The frontend never calls the engine directly.
- **Import (done):** `routes/imports.ts` + `lib/parse-import.ts` (date-aware
  splitter: `[YYYY-MM-DD]`, ISO, `MM/DD/YYYY`, `Month D, YYYY`; no dates → one
  undated entry). Flow: `POST /imports/paste|file` → review → `PATCH
  /imports/:id/parsed/:pid` (date/include) → `POST /imports/:id/confirm`. UI:
  `/import` (paste or .txt/.md upload → review with editable dates + include →
  keep). Confirmed entries get source `pasted_import`/`file_import`.
- **Reflections (done):** `routes/reflections.ts` — `GET/POST
  /entries/:id/reflections`, `PATCH/DELETE /reflections/:id` (soft delete);
  original entry never modified. UI: "Reflect on this page" composer + existing
  reflections rendered beneath the entry as letters across time (date label,
  left rule). `lib/db` reflections table already existed.
- **Privacy (done):** `routes/privacy.ts` — `GET /privacy/export` (all entries,
  reflections, memories + account, as JSON) and `DELETE /privacy/account`
  (**permanent** — deletes the user row; the onDelete:cascade FKs wipe every
  child table and free the email). UI: `/settings` (account, link to privacy,
  sign out) and `/settings/privacy` ("Your pages belong to you," the honest **AI
  disclosure** [decision #2], prototype-honesty note, Export, two-step Delete).
  Settings added to the nav.
- **Onboarding (done):** `/onboarding` ("What brings you to Yadegar?" →
  have-journals→Import / occasional→Today / fresh→Today). Gated by
  `users.onboardingCompleted` (now on AuthUser); `POST /auth/complete-onboarding`
  sets it; the auth guard routes not-yet-onboarded users there once.
- **Next:** notification settings + nudges + password reset / email verification
  — all need an email provider (Resend). Engine V2 captured in
  `docs/PRD/memory-engine-v2-vision.md` (future — not implemented).

### ⚠️ This migration is DESTRUCTIVE (prototype reset)
Switching serial→UUID and renaming `entries`→`journal_entries` cannot be done
in place by `drizzle-kit push` without dropping the old tables. Since this is a
prototype with throwaway data, the intended path on the next Replit sync is:
**drop the old `users`, `sessions`, `entries` tables, then push the new schema
fresh.** Any existing test accounts/entries will be cleared — expected. (The
`still_results` cache table is unaffected.)

## Phase 1 — what was built

**DB (`lib/db/src/schema/`)**
- `users` — email (unique), name, `passwordHash` (null for Google-only),
  `googleId` (unique, null for password-only), avatarUrl.
- `sessions` — `id` = SHA-256 of the cookie token (no usable credential at
  rest), userId, expiresAt.
- `entries` — added nullable `userId` FK. All routes scope by it; pre-auth rows
  (userId null) are never surfaced.

**Server (`artifacts/api-server/`)**
- `src/lib/auth.ts` — password hashing (node `crypto.scrypt`, constant-time
  compare), opaque session tokens (cookie holds token, DB stores its hash),
  `requireAuth` middleware (sets `req.user`/`req.userId`), Google OAuth
  authorization-code flow via `fetch` (no SDK). **Zero new dependencies.**
- `src/routes/auth.ts` — `POST /auth/register`, `POST /auth/login`,
  `POST /auth/logout`, `GET /auth/me`, `GET /auth/google`,
  `GET /auth/google/callback`.
- `app.ts` — added `cookie-parser` + `cors({ origin:true, credentials:true })`.
- `still.ts` — entry routes now behind `requireAuth` and scoped to `req.userId`.

**Contract (`lib/api-spec/openapi.yaml`)** — added the auth tag, `/auth/*`
JSON endpoints, and `AuthUser`/`RegisterInput`/`LoginInput` schemas. Regenerated
`lib/api-zod` + `lib/api-client-react` via `pnpm --filter @workspace/api-spec run codegen`.

**Frontend (`artifacts/still/`)**
- `src/lib/auth.tsx` — `AuthProvider` + `useAuth` (login / register / logout /
  loginWithGoogle, current user via `GET /auth/me`).
- `src/pages/login.tsx` — email/password + "Continue with Google", sign-in /
  register toggle, error handling.
- `App.tsx` — `/login` route + auth guard: everything else requires a session.
- `home.tsx` — discreet "Signed in as … · Sign out" footer.
- `custom-fetch.ts` — sends `credentials: "include"` so the session cookie flows.

---

## Replit setup to make Phase 1 live (do this after syncing)

1. **Migrate the schema** (adds users/sessions tables + entries.userId):
   ```
   pnpm --filter @workspace/db exec drizzle-kit push
   ```
   (Existing `entries` rows get `userId = null` and simply won't show — fine for
   a prototype. Wipe the table first if you want a clean slate.)

2. **Environment variables** on the api-server:
   - `APP_URL` — the app's public origin, e.g. `https://<slug>.replit.app`
     (no trailing slash). Used for cookies + OAuth redirects.
   - `NODE_ENV=production` — so the session cookie is marked `secure`.
   - For Google sign-in (optional — email/password works without it):
     - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
     - In Google Cloud Console → OAuth 2.0 Client (Web): add the redirect URI
       `${APP_URL}/api/auth/google/callback`. Override with `GOOGLE_REDIRECT_URI`
       if your proxy path differs.
   - (Already needed) `DATABASE_URL`, `ANTHROPIC_API_KEY`, `PORT`.

3. **Verify the loop:** register with email/password → land on Home → "Sign out"
   → sign back in. Then (if configured) "Continue with Google". Confirm entries
   are now per-account.

### Security notes (prototype-honest)
- Passwords: scrypt + per-user salt, constant-time compare. Fine for a
  prototype; revisit work-factor/argon2 before real users.
- Sessions: httpOnly, sameSite=lax, secure in prod; DB stores only the token
  hash. 30-day TTL.
- §8 (encryption at rest for the journal text) is still **not** built — keep the
  "prototype, use sample entries" framing until it is.

# Launch plan — prototype → real product

Goal: publish Still as a real, trustworthy product on a real domain.

## ✅ LIVE (2026-06-02): https://yadegarjournal.com
Deployed (Replit autoscale) on the custom domain, with a production database.
Verified live end-to-end: email/password **and Google** sign-in, **email
verification** (real email delivered via Resend from the domain) + password
reset, encryption at rest, onboarding, the full write → import → run → returns →
reflect loop, privacy export/delete, and the legal pages. Every "harden first"
item is complete.

### Remaining (optional / post-launch; none blocking)
- [x] **Nudges + notification settings** — DONE. `/settings/notifications` lets
  the user set a per-nudge cadence (writing / memory · off/weekly/monthly; both
  off by default). A cron endpoint `POST /cron/run-nudges` (auth: `x-cron-secret`
  == `CRON_SECRET`) sends due nudges: a writing reminder, and a memory nudge that
  runs the engine (so all safety gates apply — crisis/nothing send nothing). The
  engine-run logic was factored into `lib/memory-engine.ts` (shared with
  `/memories/run`). **Needs:** a DB push (notification_preferences reshaped), a
  `CRON_SECRET` secret, and a daily Scheduled Deployment hitting the cron
  endpoint.
- **Filter year/month → run** UI (the backend `/memories/run` already accepts it).
- **Google Doc import** (paste + .txt/.md are done).
- **Option B `secondaryThread`** surfaced in the Returns/Today UI.
- **Polish:** landing "what Yadegar returns / how it works" sections; encrypt
  `returned_memories.full_engine_response`; OG image/favicon.
- **Before broad public launch:** human/legal review of Privacy + Terms.
- **Engine V2** — future eval (`docs/PRD/memory-engine-v2-vision.md`).

## Decisions (locked with Mahdis)
- **Posture: harden first, then invite real journals.** Get the trust/safety
  layer done before opening to real (non-sample) journals.
- **Privacy: pragmatic at-rest + policy.** Encryption at rest with server-managed
  keys + access controls + a real privacy policy/ToS. (Not zero-knowledge — the
  engine must read text to work; that tension is documented below.)
- **Name: DECIDED → Yadegar.** Domain purchased: **yadegarjournal.com**.
  (Persian: a keepsake / what remains — ties to the founder's story.) "Still" was
  dropped due to category crowding in journaling apps. Tagline direction:
  *"yadegar — Persian: a keepsake, the thing that remains"* + *"letters between
  you and who you were" / "the pages that find you again."*
- **Brand vs. code:** user-facing copy now says **Yadegar**. Internal code
  identifiers are intentionally left as "still" (no user impact, avoids risky
  churn): the `@workspace/still` package + `artifacts/still` dir, the `useStill`
  store / `StillProvider`, the engine's `/still/extract` + `/still/score`
  routes, the `still_results` cache table, and the GitHub repo name. APP_URL at
  deploy = the yadegarjournal.com domain.

## The encryption tension (important)
Still's engine must read the user's words (it sends them to Anthropic to choose
what to surface). So true zero-knowledge isn't compatible with the engine in v1.
**v1 plan:** application-level encryption of journal text (entries, reflections,
import bodies, returned-memory text) with a server-held key, plus provider disk
encryption + HTTPS. A stolen DB dump is then useless without the app key. The
engine decrypts in memory to call the model. **Tradeoff:** server-side SQL search
can't run on encrypted columns → Library search stays client-side (already is).

## Sequence
**Phase A — finish the product** (me): onboarding ("What brings you to Still?");
notification settings + nudges (needs email provider).

**Phase B — get a real URL live** (me + Replit + you): deploy on Replit
(persistent Deployment, not the ephemeral dev URL); point the custom domain;
production Postgres with **automated backups**; production secrets (APP_URL = real
domain, ANTHROPIC_API_KEY, DATABASE_URL, NODE_ENV=production, Google keys on the
real domain).

**Phase C — trust & safety before real journals** (the gate):
- [x] Privacy Policy + Terms pages (`/privacy-policy`, `/terms`) — DRAFT, need
      human/legal review + real contact address before public launch.
- [x] **Encryption at rest** for journal text (app-level, AES-256-GCM). Done via
      a transparent Drizzle `encryptedText` custom column type (`lib/db/src/crypto.ts`
      + `schema/encrypted.ts`) on: entry body/title, reflection body, import
      raw_text, parsed-entry body/title, returned-memory label/observation/quote.
      Reads/writes are transparent; the engine still sees plaintext in memory.
      Legacy-plaintext tolerant (rows without the `enc:v1:` prefix pass through),
      so the rollout needs no data wipe. **Requires a new secret
      `ENCRYPTION_KEY`** (32 bytes / 64 hex) in every environment that reads or
      writes — generate with `openssl rand -hex 32`. Server-side text search was
      removed (can't ILIKE ciphertext); Library search is client-side.
      NOTE: `returned_memories.full_engine_response` (jsonb debug trace) is left
      unencrypted for now — a fast-follow.
- [x] Auth completeness: password reset + email verification (via Resend).
      Soft verification (non-blocking; a banner prompts + resends). Tokens in a
      new `auth_tokens` table (hashed, single-use, expiring); `users.emailVerified`
      added. Email sent via the Resend REST API (no SDK), from `EMAIL_FROM`.
      Pages: /verify-email, /forgot-password, /reset-password. **Needs a DB push**
      (new column + table) on next sync, and a verified Resend domain.
- [x] Rate limiting (in-memory, no deps): per-user cap on /memories/run (the
      costly LLM path, 30/hr), per-IP throttle on login/register (30 / 15 min),
      and a per-IP guard on the raw /still/* engine endpoints (60/hr, loopback
      exempt so the internal /memories/run call is unaffected). `trust proxy` set
      so req.ip is the real client. (Single-instance; move to Redis if it scales.)
- [ ] Error monitoring + uptime.

**Phase D — launch**: soft launch to a few trusted people → fix → public.

## What only Mahdis can do
- Pick + register the domain (Cloudflare Registrar recommended).
- Create a **Resend** account (free) → API key for email (unlocks password reset,
  email verification, nudges).
- Create Google OAuth credentials against the real domain (Client ID + Secret).
- Own the Anthropic billing account.
- Have a human review the Privacy Policy + Terms before public launch.

## Costs (rough)
Domain ~$12/yr · Replit Deployment ~$a few–$20+/mo · Anthropic API per-run (cents)
· Resend free tier for early use.

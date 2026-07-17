# Yadegar

**A companion to a lifelong journaling practice.** You write — or bring in years of past entries — and Yadegar surfaces *one* thing worth returning to today: a thread that keeps coming back, a page you'd forgotten, a distance you've travelled. Always pointing back to your own words. And when nothing honest surfaces, it stays quiet.

🌐 **Live:** https://yadegarjournal.com  ·  📱 **iOS:** live on the App Store (membership update in review)

📄 **Deep dive:** [`docs/CASE-STUDY.md`](docs/CASE-STUDY.md) — the product thesis, the engine, the eval harness, safety guardrails, and the freemium unit economics, end to end.

> *Yadegar* — Persian for *a keepsake, the thing that remains.*
> Governing rule: **offer the meaning, never push the moment.**

*("Still" is the internal codename you'll see throughout the code — the package `@workspace/still`, the `/still/*` engine routes, the `still_results` cache. User-facing copy is **Yadegar**. The brand/codename split is deliberate: renaming internals would mean a risky refactor + a DB migration for zero user benefit.)*

---

## The bet

Most journaling tools remember what *happened*. Yadegar tries to remember what **endured**.

A traditional app might say *"In 2015 you felt lost; in 2018 you felt confident."* Yadegar asks a different question — *what remained true across both?* — and answers in your own words:

> *"When uncertainty appears, you keep becoming your own source of reassurance."*

That isn't a memory. It's a thread. The product is built entirely around surfacing that one true thing — and around the discipline to say nothing when there's nothing true to say.

## The loop

**Write → Keep → Return → Reflect.** Write today or import decades of old pages → they're kept private and encrypted, by date and year → when you ask, the engine reads across your years and places **one** page back in front of you → you can write back to the person who wrote it (letters across time).

## The engine (the interesting part)

A two-pass memory engine, run server-side and called by both web and mobile:

1. **`/still/extract`** — runs a crisis/safety check first, then pulls candidate material from the archive.
2. **`/still/score`** — selects the single best thing to return (a thread, a forgotten page, a distance), or returns **silence**.

Design decisions that matter more than the model choice:

- **Determinism & cost:** temperature 0 + a Postgres cache keyed on `PROMPT_VERSION`, so the same archive returns the same page and a re-run is free.
- **Silence as a feature:** the engine returns *nothing* unless a candidate clears a real bar. Better quiet than false.
- **Safety gates, not vibes:** active-crisis content is gated; there are hard floors (e.g. body-image/eating); users set per-page resurfacing (`never`) and muted date ranges that the engine always respects.
- **The AI never interprets your life.** It only chooses which of *your own words* to bring back — it never diagnoses, summarizes who you are, or explains what your life means.

## Proving a non-deterministic feature: the eval harness

The hard part of an AI feature isn't building it — it's keeping it *calibrated* as prompts evolve. So the engine ships with its own regression suite (`scripts/src/eval/`):

- Fixture archives with expectations for **both** what should surface **and** when the engine must stay silent.
- A single adapter seam (`adapter.ts`) so the suite runs **offline** against fixtures or **live** against the deployed engine.
- It's the safety net that lets the prompt change without quietly regressing the calibration that makes the product trustworthy.

## Product decisions I'd defend in an interview

- **Silence over output.** A surfacing engine that can't shut up is a liability; the silence bar *is* the product.
- **The encryption ↔ engine tension, named honestly.** Journals are encrypted at rest (AES-256-GCM), but the engine must read plaintext to work — so it's not zero-knowledge in v1, and that trade-off is documented rather than hidden. (Consequence: search is client-side, because the server can't read ciphertext.)
- **Freemium that protects the brand.** Writing, keeping, importing, exporting, and revisiting are free forever; membership only lifts the cap on *new* AI returns (the one expensive path).
- **App Store compliance shaped the mobile UX.** No external prices or web checkout in-app (digital subscriptions must use IAP), so the mobile landing/membership screens are intentionally price-free.

## The mobile app: web → native parity

A full native iOS app (Expo / React Native) built to mirror the live web product screen-for-screen: Today (with a live rich-text editor, voice dictation, and photos), Look back (the engine's three reads), Explore (Library with list/calendar/timeline, Shelf, Collections, Capsules), entry pages, Returns & History, the full Settings tree, Profile, the philosophy & maker's-note pages, a native FAQ, and a pre-login landing.

Engineering calls under the hood:

- **Native rich text** via a contained `WebView` `contentEditable` that emits the *same* sanitized HTML the web stores — so a page round-trips identically across platforms.
- **Guarded native modules.** Every native dependency (WebView, image picker, speech, document picker, fonts) is feature-detected and **degrades instead of crashing** on a build that doesn't include it yet — which let most work ship as JS-only reloads and kept native rebuilds rare.
- **Typography parity.** A `<Text>` patch maps each element to the right loaded font file by role — Fraunces (display), Newsreader (body, with real bold/italic), Inter (UI) — because React Native won't swap weight files the way a browser does.

## Tech

- **Monorepo:** TypeScript, pnpm workspaces.
- **Web:** React + Vite (deployed on Replit).
- **API:** Express + Drizzle ORM + Postgres; transparent AES-256-GCM `encryptedText` columns; in-memory rate limiting; auth via email/password + Google + Apple, with email verification & password reset (Resend).
- **AI:** Anthropic, the two-pass memory engine.
- **Mobile:** Expo SDK 52, expo-router, NativeWind, React Native; biometric lock; encrypted attachments.
- **Quality:** the eval harness as the engine's regression suite.

## Repo layout

```
artifacts/still/        the web app + the memory engine (/still routes)
artifacts/api-server/   Express API: entries, memories, auth, privacy, billing
lib/                    shared workspace packages (db schema, api types, clients)
scripts/src/eval/       the engine's eval / regression harness
apps/mobile/            the Expo / React Native iOS app
docs/                   product spec, launch plan, build logs, runbooks
```

## Status

Web product **launched and live** at yadegarjournal.com (auth, encryption at rest, the full write → import → run → return → reflect loop, privacy export/delete, legal pages, custom domain). The **iOS app** is at feature parity with the web and **live on the App Store**, with a membership/subscriptions update in review. Android is scoped and next.

---

*Built solo, with heavy AI pair-programming — an exercise in shipping a complete, opinionated AI product end-to-end: the model design, the safety discipline, the eval harness that keeps it honest, and the craft of the surfaces around it.*

# Yadegar — Mobile Post-Launch Roadmap

> Working doc for continuing the mobile app after the **1.0 App Store submission**.
> Read `CLAUDE.md` first (brand/codename split: user-facing = "Yadegar", internal
> code = "still" — do NOT rename internals).

---

## Current state (LAUNCHED — iOS 1.0 live on the App Store)

- **iOS 1.0 (build 14) is LIVE** at https://apps.apple.com/app/id6778475173.
  (Rejected once under 5.1.1(v) for non-discoverable account deletion → fixed
  with a top-level "Delete account" → approved on re-review and released.)
- **Web download path is LIVE:** "Download on the App Store" badge + Apple Smart
  App Banner on yadegarjournal.com (the gated flag now defaults on).
- **⚠️ Queued for 1.0.1 (on the branch, NOT in the shipped build 14):** opt-in
  Face ID lock (build 14 still FORCES it — affects live users now) + the
  duplicate-text lock fix, native "Why I built this" (web view in build 14),
  push deep-link-on-tap + token refresh on resume, and the welcome first-
  viewport focus. Cutting 1.0.1 lands all of these.
- **Fonts are FIXED and verified on TestFlight** (Task 1 — was top priority).
  Brand fonts (Fraunces / Newsreader / Inter) are embedded at build time via the
  `expo-font` config plugin; a brand `<Text>` wrapper (`components/text.tsx`)
  applies them by role. The old runtime-`loadAsync` + `Text.render` monkey-patch
  is gone (`lib/app-fonts.ts` deleted).
- **Account deletion** is now a top-level "Delete account" action on the Settings
  hub (`app/(app)/settings/index.tsx`), in addition to the nested copy under
  "Privacy & your pages". Both call `DELETE /privacy/account`.
- **Sign in with Apple token revocation is LIVE** (App Store 5.1.1(v)): the app
  sends Apple's `authorizationCode` at sign-in; the server exchanges it for a
  refresh token (stored on `users.apple_refresh_token`) and revokes it on account
  deletion. Code in `artifacts/api-server/src/lib/apple.ts` + `auth.ts`/
  `privacy.ts`. Activated by four `APPLE_*` secrets on Replit; deployed.
- **Welcome screen** refocused for first-time users: Sign in leads the hero CTA
  pair, "Why I built this" demoted to a link, redundant nav buttons removed,
  first viewport calmed (editorial scroll below the fold unchanged).
- **Web:** open-book mark shipped as favicon / apple-touch-icon + beside the
  header wordmark. Live via Replit re-sync.
- Built on **Expo SDK 54, React Native 0.81, React 19** (the iOS 26 / Xcode 26
  upgrade). The app is fully functional.

### Key facts / IDs
- App Store Connect App ID (ASC App ID): **6778475173**
- App Store URL (once live): `https://apps.apple.com/app/id6778475173`
- Bundle ID: `com.yadegar.app` · Android package: `com.yadegar.app`
- EAS projectId: `713e75e4-8c5c-46cf-9b40-de16938bea8a`
- Apple Team: `9N5834LYYL` (Mahdis Rezaei, Individual)
- Demo review account: `review@yadegarjournal.com` / `Demo123!` (loaded with sample entries)
- Live: **1.0 (build 14)**. Next update is being prepped as **1.0.1 (build 15)**
  in `app.json` (now that 1.0 is released, normal version bumps apply).
  `appVersionSource` is local, so `app.json` `version` + `ios.buildNumber` drive
  the build; `autoIncrement` bumps the build number from there.

### Workflow gotchas (READ BEFORE WORKING)
- **`apps/mobile` is a standalone npm project** (own `package-lock.json`), NOT in the
  pnpm workspace. Use **npm** there. It has `.npmrc` with `legacy-peer-deps=true`
  (required for React 19 peer ranges).
- **Develop on the branch the task specifies.** Recent mobile work is on
  `mobile-rich-text` (current tip of all the above). Confirm before pushing.
- **The GitHub repo is `mahdis-rezaei/yadegar`** (renamed from `mahdis-rezaei/
  still`; GitHub 301-redirects the old name, so old references still resolve).
  The internal codename "still" stays in code/paths per `CLAUDE.md`.
- **The git push proxy is flaky (intermittent 503s).** When `git push` fails, push
  via the GitHub MCP `create_or_update_file` tool, then
  `git reset --hard origin/<branch>` to resync local.
- **iOS builds must be done in the cloud via EAS** —
  `npx eas-cli@latest build --platform ios --profile production`. Local Xcode builds
  fail (Xcode 26 can't compile RN's `fmt` library). There is also a `simulator` EAS
  profile for screenshots. The user runs all eas/git commands on their Mac; Claude
  makes code changes + pushes.
- **`eas.json` uses `appVersionSource: "local"`** (changed from `remote`): the
  version + `ios.buildNumber` come from `app.json`, and `autoIncrement` (in the
  `production` profile) bumps the build number on each build. With `remote`, EAS
  ignored `app.json`'s version — which once silently shipped a 1.0.1 build and a
  build-number collision. Keep it local so `app.json` is the source of truth.
- **TestFlight headlines the highest version string, not the newest upload.** A
  1.0 build won't show as an "update" over an installed 1.0.1 — install it from
  the app's builds list (tap the app row), or delete the installed app first.
- **Production ships via Replit re-sync** (`docs/REPLIT-SYNC-*.txt`), NOT by
  merging to `main`. Each runbook = reset Replit to a branch head, `pnpm install`,
  `drizzle-kit push` for any migration, set any new secrets, rebuild + publish.
- `app.json` has `newArchEnabled: true` (New Architecture / Fabric).

---

## TASK 1 — Fix the brand fonts ✅ DONE (verified on TestFlight)

**Resolved.** Fonts are embedded at build time via the `expo-font` config plugin
(TTFs in `apps/mobile/assets/fonts/`, named by PostScript name), and a brand
`<Text>` wrapper (`components/text.tsx`) applies the role mapping; `cssInterop`
keeps NativeWind className sizes working. The dead `lib/app-fonts.ts` runtime
loader + `Text.render` monkey-patch were removed. Kept below for history.

**Original symptom:** the app rendered in the iOS system font (San Francisco)
instead of the brand fonts — **Fraunces** (display/headings), **Newsreader**
(body/quotes), **Inter** (UI labels). Broke during the SDK 54 upgrade.

**What we know (important — saves repeating failed attempts):**
- `lib/app-fonts.ts` loads fonts via `expo-font` `loadAsync` + `@expo-google-fonts/*`
  packages, and monkey-patches RN's `Text.render` to apply a font family by role
  (size/weight/style) — see `pickFamily()`.
- On **RN 0.81 + New Architecture + React 19 this is fully broken.** We added an
  explicit hard-coded `style={{ fontFamily: "Fraunces_600SemiBold" }}` probe on the
  welcome wordmark (`app/(auth)/welcome.tsx`) and **even that renders as system font**
  → fonts are NOT loading/registering at all. So it's not only the `Text.render`
  patch — `loadAsync` itself isn't taking in the production build.
- Already done: `@expo-google-fonts/{fraunces,newsreader,inter}` updated to latest;
  `expo-font` is now a **config plugin** in `app.json` `plugins`.

**Agreed plan:**
1. **Embed the TTF files at build time via the `expo-font` config plugin**
   (`["expo-font", { "fonts": [ ...ttf paths... ] }]`). This is the bulletproof,
   no-runtime-`loadAsync` method and removes all dynamic-import / asset-bundling
   failure modes. Copy the needed TTFs into `apps/mobile/assets/fonts/` and reference
   them (don't rely on `node_modules` paths).
2. **Determine the exact iOS font family name** each embedded TTF registers under
   (PostScript / full name — may differ from `Fraunces_600SemiBold`). Use those names
   in styles.
3. **Apply the fonts** — the global `Text.render` patch is dead on the New Arch, so
   either (a) a robust app-wide mechanism that works on Fabric, or (b) explicit font
   families on components. Keep the role mapping intent from `pickFamily()`.
4. Rebuild via EAS, **verify on TestFlight** before shipping as 1.0.1.

**Files:** `lib/app-fonts.ts`, `app.json` (plugins), `tailwind.config.js` (has the
`display`/`body`/`sans` font tokens), `app/(auth)/welcome.tsx` (has the probe).

---

## TASK 2 — Web: logo mark, favicon, and app download path

> The **web frontend is a SEPARATE part of the codebase** from `apps/mobile` — locate
> it first (deployed to yadegarjournal.com).

1. **Logo update / favicon** = the app mark (source art:
   `apps/mobile/assets/icon-source.png` — the open-book "Y" on cream). Replace the
   browser-tab favicon and add a small mark in the site header next to the "Yadegar"
   wordmark, for brand cohesion across web ↔ app ↔ stores.
2. **iOS app download path** (gate behind "app is live" — see timing):
   - **Apple Smart App Banner** — add to web `<head>`:
     `<meta name="apple-itunes-app" content="app-id=6778475173">` (native banner in
     iOS Safari).
   - **Official "Download on the App Store" badge** in the hero + footer →
     `https://apps.apple.com/app/id6778475173` (use Apple's official badge artwork).
3. **Android download path** (later, once the Android app ships — Task 5):
   - There is **no native "smart banner" on Android**; instead add a **"Get it on
     Google Play" badge** + an optional custom dismissible banner. Link to the Play
     Store listing URL once it exists.
4. **Platform-aware CTA:** lead with the app on phones, show a **QR code** on desktop.
   Keep web sign-in available — invite, don't force (no full-screen interstitial).
5. **Timing:** only enable a store CTA once that app is Approved AND released. Manual
   release means flip the web CTAs + press "Release" at the same moment.

---

## TASK 3 — FAQ: hyperlink the contents (anchor links)

`components/markdown.tsx` currently renders in-page `#anchors` as **plain text**
(RN has no DOM anchors). Make the Contents items (in `lib/faq.ts`) tappable and
**scroll the ScrollView to the target section** — measure each `##` heading's
y-offset (onLayout) and drive the parent ScrollView. (Numbering alignment is already
fixed: the list number column was widened to `width: 26`.)

---

## TASK 4 — Membership / subscriptions (in-app purchase)

Currently `app/(app)/membership.tsx` is intentionally **price-free with no checkout**
(App Store rules: digital subscriptions must use IAP). To make it real:
- Integrate **RevenueCat** + create the subscription product(s) in **App Store
  Connect** (and **Google Play** for Android).
- Wire the quota gate (currently shadow until `STILL_QUOTA_ENFORCED=1`) — gate the AI
  returns, never the journal.
- Surface the price + a working **Subscribe** button on the membership screen once IAP
  is live; restore-purchases flow; reflect `user.plan === "member"` state.
- See `docs/MEMBERSHIP-COMMS.md`, `docs/MONETIZATION-*.md`, `docs/STRIPE-SETUP.md`.

---

## TASK 5 — Android app

The app is already Expo/React Native, so most code is cross-platform. `app.json`
already has Android config (`package`, `adaptiveIcon` via `assets/adaptive-icon.png`,
permissions). Remaining work is testing/polish + Play Store setup. Estimate: ~2–4
focused days once iOS fonts are fixed (mostly device testing + Play Console paperwork,
not rewriting). Do this **after** iOS 1.0 is live + fonts fixed, so Android inherits a
polished codebase.

**Phase A — code (platform parity)**
- Conditionally **hide "Sign in with Apple" on Android** (keep Google + email/password).
  Apple requires SiwA on iOS when offering Google; Android doesn't.
- **Push notifications → FCM:** create a Firebase project, add the FCM key to EAS
  credentials (iOS uses APNs, already working). See Task 7.
- **Verify each native module on Android:** `expo-local-authentication` (biometric),
  `expo-speech-recognition` (most fiddly), `expo-image-picker`, `expo-secure-store`,
  `expo-notifications`, `expo-apple-authentication` (iOS-only — guard it).
- Polish the **adaptive icon** safe-zone + splash; sweep every screen for Android
  layout/keyboard/safe-area differences.

**Phase B — store setup (Google Play Console, $25 one-time)**
- Store listing (reuse iOS copy), **Android screenshots** (phone sizes), feature graphic.
- **Data Safety form** (≈ App Privacy — same answers: App Functionality, linked to
  user, no tracking).
- Content rating questionnaire; target API level compliance.

**Phase C — build & submit**
- `eas build --platform android --profile production` → `eas submit -p android`.
- Internal testing track first, then production.

---

## TASK 6 — Shop (in-app entry + settings)

Currently the **Shop** menu item (`components/app-header.tsx`) opens
`https://yadegarjournal.com/shop` in the external browser. It sells **physical goods
only** (journals/keepsakes), which is App-Store-compliant.
- **Clarify desired scope** with Mahdis: keep as an external link, or build a richer
  in-app shop surface / "shop settings" (e.g., region, currency, a nicer in-app
  browser via `expo-web-browser` instead of `Linking.openURL`).
- If kept external, consider an in-app `WebBrowser.openBrowserAsync` for a smoother,
  in-app-feeling experience while still being an external store.

---

## TASK 7 — Make push notifications / nudges actually work

The nudge feature is the native counterpart to the web's email nudges. Verify the full
loop on a **real device with the production build** (push doesn't work in Simulator):
- `lib/push.ts` `registerForPush()` runs, gets an Expo push token, and POSTs it to
  `/notifications/devices`. (Guarded so it never breaks launch.)
- Confirm the token actually registers with the backend for the signed-in user.
- Confirm the **nudge cron** delivers a push and it appears on the device (foreground
  handler uses `shouldShowBanner` / `shouldShowList` post-SDK-54).
- Check notification **permission prompt** timing/UX.
- Android: requires FCM (Task 5 Phase A) before this works there.

---

## TASK 8 — Marketing: explainer video + auto-generated assets

For logged-out / curious users who don't want to sign in, give them a way to *get it*
fast.
- **Short product video / explainer** (30–60s) for the landing page + App Store
  "App Preview" slot — the loop: write → keep → return → reflect, with the silence
  discipline as the hook ("offer the meaning, never push the moment").
- **Idea from Mahdis:** feed everything we've built (the engine spec, PRD, FAQ, build
  logs in `docs/`, the product story) into **NotebookLM** (or similar) to generate a
  presentation / explainer / "podcast" overview.
  - ✅ **Source docs written:** `docs/YADEGAR-PRODUCT-NARRATIVE.md` (strategy,
    engine, evals, economics, model) + `docs/YADEGAR-FEATURE-REFERENCE.md` (every
    feature). Feed these as the NotebookLM core, optionally plus
    `docs/STILL-BUILD-AND-EVAL.md`, `docs/PRD/*`, `docs/MONETIZATION-STRATEGY.md`.
  - Still TODO: produce the actual 30–60s video / App Preview from them.
- Could double as portfolio/resume material (the brand + the AI-product thinking).

---

## Suggested order

**✅ Done & LIVE:** iOS 1.0 on the App Store (fonts, discoverable account
deletion, Sign in with Apple token revocation — the 5.1.1(v) fix); web favicon /
header mark + App Store download CTAs + Smart App Banner (Task 2); push/nudge
loop verified on-device (Task 7); NotebookLM source docs (part of Task 8).

**⏳ Immediate — land 1.0.1:** cut & submit **1.0.1 (build 15)** to ship the
branch's queued mobile fixes to users — most importantly the **opt-in Face ID
lock** (build 14 still forces it), plus native "Why I built this", push
deep-link/resume, and the welcome focus.

**Then, in order:**
1. **Android app** — biggest scope; also unblocks Android push (FCM). (Task 5)
2. **Membership IAP** — monetization (RevenueCat + store products). (Task 4)
3. **FAQ hyperlinks, Shop polish, explainer video** — opportunistic. (Tasks 3, 6, 8)

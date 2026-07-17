# Yadegar mobile (iOS + Android) — plan

The full plan for native apps. Decisions locked: **Expo / React Native**,
**in-app purchase via RevenueCat**, **native-first parity** for v1.

## TL;DR
- One codebase (Expo/React Native) in the existing monorepo (`apps/mobile`),
  reusing the shared TypeScript types and API client. Same Replit backend.
- Auth becomes **token-based** (the API client already exposes `setAuthTokenGetter`
  + `setBaseUrl`), stored in the device keychain. Add **Sign in with Apple**
  (required by Apple once Google sign-in exists).
- Membership on mobile = **RevenueCat IAP** → entitlement synced to the existing
  `users.plan`, so the quota system is reused untouched. Existing **web (Stripe)
  members are honored in-app** with no second charge.
- v1 = web core (write, library, the engine, returns, reflections) **plus** native
  delights: **push nudges, an "On this day" widget, Face ID lock.**

---

## 1. Goals
1. A genuinely native journaling experience (fast, offline-capable, private).
2. Maximum **reuse** of the existing stack (types, API client, backend, brand) so
   we're building UI + native capabilities, not re-deriving the product.
3. Native superpowers that fit the brand: push (vs email), home-screen widget,
   biometric lock, share-sheet capture.
4. A clean monetization path that reuses `plan`/quota and respects platform rules.

## 2. Why this is high-leverage here
The hard parts are already done and shareable:
- **`@workspace/api-zod`** — request/response schemas, reused as-is.
- **`@workspace/api-client-react`** — `customFetch`, generated React Query hooks,
  and crucially `setBaseUrl` + `setAuthTokenGetter` (token auth was anticipated).
  React Query and `fetch` both run in React Native, so much of the data layer ports.
- **Backend** — stateless `/api` on Replit; the app points at the same base URL.
- **`plan` / quota / usage** — entitlement plumbing already exists; mobile IAP just
  becomes another way `plan` becomes `member`.

So mobile is mostly: native UI, navigation, auth/token, IAP, and native modules.

## 3. Architecture
- **Framework:** Expo (managed) + **Expo Router** (file-based routing that mirrors
  the web's route structure).
- **Monorepo:** add `apps/mobile` (Expo) alongside `artifacts/still` (web). Shared
  packages (`api-zod`, `api-client-react`) consumed by both.
- **Styling:** **NativeWind** (Tailwind for RN) so the brand tokens (cream
  `#F7F1E6`, deep-brown `#3A2F25`, accent-sepia, Fraunces/Newsreader) and class
  conventions carry over from web with minimal translation.
- **Data:** `@tanstack/react-query` (reused) over the shared API client, configured
  for native via `setBaseUrl(API_URL)` + `setAuthTokenGetter(() => token)`.
- **Local store:** `expo-secure-store` (tokens), `expo-sqlite` or MMKV (offline
  drafts + cached entries).
- **Fonts:** `expo-font` loading Fraunces + Newsreader to match the web.

## 4. Auth (token-based)
- **Flows:** email/password, **Continue with Google** (native via
  `expo-auth-session`), and **Sign in with Apple** (`expo-apple-authentication`) —
  the latter is *mandatory* on iOS because we offer Google (App Store 4.8).
- **Tokens:** login/register returns a **bearer token** (reuse the existing session
  token, delivered in the body for mobile instead of a cookie); store in
  `expo-secure-store`; the API client attaches it via `setAuthTokenGetter`.
- **Backend change:** `requireAuth` must accept `Authorization: Bearer <token>` in
  addition to the session cookie (same underlying session lookup). Small, additive.
- **Biometric lock:** `expo-local-authentication` (Face ID / fingerprint) gates app
  open — strong privacy story for a journal.

## 5. Monetization on mobile (the platform-tax decision)
- **Layer:** **RevenueCat** wraps StoreKit (iOS) + Play Billing (Android) and gives
  one cross-platform entitlement API + webhooks.
- **Products:** the same membership ($8/mo, $59/yr) as **IAP products** in App Store
  Connect + Play Console, mapped to a RevenueCat "membership" entitlement.
- **Entitlement sync (reuse plan/quota):** RevenueCat **webhook → our backend → set
  `users.plan` = member** (+ `planRenewsAt`), exactly parallel to the Stripe
  webhook. The quota gate (`quota.ts`) and all paywall logic are reused unchanged.
- **Source of truth:** `users.plan` stays the single entitlement flag. Add a
  `plan_source` ("stripe" | "appstore" | "playstore") to know which system to send
  cancellations/refunds to. The app gates on `/auth/me` `plan`, not on the store.
- **Honor existing web members:** a Stripe member opening the app reads `plan:
  member` from `/auth/me` → **no paywall, no second charge** (multiplatform model).
  IAP is only offered to **non-members** in-app.
- **Margin reality:** Apple/Google take **30%**, or **15%** under the Small Business
  Program (<$1M/yr) — so $8 IAP nets ~$6.80 (15%) vs ~$7.47 on web Stripe. Steer new
  members to web where it's allowed; never *cheaper-in-app*. (External-link billing
  is loosening in the US/EU, but ship compliant IAP first.)
- **Physical shop is exempt:** the Shopify store sells *physical* goods, which use
  normal payment, not IAP — so the shop can live in the app via web checkout.

## 6. Native features (the "first-class, not a wrapper" layer)
| Feature | Native module | Brand fit |
|---|---|---|
| **Push nudges** | `expo-notifications` (+ FCM/APNs) | Replace/augment email nudges; gentle, opt-in |
| **"On this day" widget** | WidgetKit (iOS) / Glance (Android) via config plugin | A keepsake glanced at daily — very on-brand |
| **Biometric lock** | `expo-local-authentication` | A journal that locks to your face |
| **Share-sheet capture** | share intent | Send a thought to Yadegar from anywhere |
| **Offline writing** | `expo-sqlite` + sync | Journal on a plane; sync later |
| **Camera/photos, voice** | `expo-image-picker`, `expo-speech`/native | Parity with web's photo + dictation |

**Push backend changes:** a `device_tokens` table + a register endpoint; the
existing nudge cron sends a **push** (Expo Push API) alongside/instead of email
based on the user's notification preferences (which already exist).

## 7. Offline & sync
- **v1:** online-first with a **local draft cache** — Today writes to local storage
  immediately and syncs (the web already autosaves; mobile makes it offline-safe).
- **Later:** full offline library (cached entries in SQLite) + a sync queue;
  last-write-wins on drafts (single-author, low conflict).

## 8. Scope
**v1 (native-first parity):**
- Auth (email/Google/Apple, token, biometric lock)
- Today: write + autosave + offline draft
- Library: list, entry detail, reflections, photos
- The engine: **Bring a page back**, On This Day, Returns, Look back lenses
- Membership: RevenueCat IAP + paywall (gating reused from `plan`/quota)
- Native: **push nudges, "On this day" widget, Face ID lock**, share-sheet capture
- Settings: profile, notifications (push prefs), privacy/export, sign out

**Deferred to v1.x:** bulk import (rare on phone), Collections/Shelf/Capsules,
Year-in-Pages/Book (print), full offline library.

## 9. Phased roadmap
- **Phase 0 — Foundations:** `apps/mobile` Expo app, Expo Router, NativeWind +
  brand tokens + fonts, React Query wired to the shared client, **token auth
  end-to-end** (incl. backend bearer support + Apple Sign-In), app shell/nav.
- **Phase 1 — Read/Write core:** Today (write/autosave/offline), Library + entry
  detail + reflections + photos, biometric lock.
- **Phase 2 — Engine + returns + push:** Bring a page back, On This Day, Returns,
  Look back; `device_tokens` + push, cron sends push nudges.
- **Phase 3 — Membership (IAP):** RevenueCat + App Store/Play products, paywall,
  webhook→`plan` sync, honor existing web members, `plan_source`.
- **Phase 4 — Native delights + polish:** "On this day" widget, share-sheet,
  settings/privacy, store assets, EAS Build/Submit, TestFlight/internal testing.
- **Phase 5 — Launch & iterate:** review, ASO, beta feedback, crash monitoring.

## 10. Build, release & store ops
- **EAS Build** (cloud builds) + **EAS Submit** (to both stores); **EAS Update** for
  OTA JS updates between store releases.
- **Accounts:** Apple Developer ($99/yr) + Google Play ($25 once).
- **Beta:** TestFlight (iOS) + Play internal testing.
- **Store assets:** icon (the "Y" mark), screenshots, the یادگار story for the
  listing, privacy nutrition labels / Data Safety form (we encrypt at rest; AI
  reads text to surface — disclose honestly, matching the FAQ's plain language).
- **Review gotchas:** Sign in with Apple (4.8), IAP for digital sub (3.1.1), a
  working demo account for reviewers, no broken links, privacy policy URL.

## 11. Risks & mitigations
- **Cross-platform entitlement** (web-Stripe vs in-app) — `plan` as single source of
  truth + `plan_source`; app gates on `/auth/me`, honors web members. *(Designed in.)*
- **Platform tax on margin** — steer to web where compliant; 15% Small Business
  Program; physical shop exempt.
- **Widgets are native** — extra effort via Expo config plugins / a dev client; can
  slip to Phase 4 without blocking launch.
- **App review unpredictability** — clean demo account, honest privacy labels, ship
  compliant IAP first.
- **Sync conflicts** — last-write-wins for single-author drafts.

## 12. Metrics
Installs → **activation** (first entry / first return) → D1/D7/D30 retention; push
opt-in % and push→open; **web↔mobile cross-use** (the omnichannel thesis); mobile
free→member conversion; crash-free sessions.

## 13. Backend changes (small, additive)
1. `requireAuth` accepts `Authorization: Bearer` (mobile sessions).
2. Login/register optionally return the token in the body for native clients.
3. `device_tokens` table + register endpoint; push send in the nudge cron.
4. **RevenueCat webhook** → set `plan` (+ `planRenewsAt`, `plan_source`).
5. `users.plan_source` column (additive).

## 14. Open decisions (for when we build)
- Push provider: Expo Push (simplest) vs direct FCM/APNs.
- Navigation lib: Expo Router (recommended) vs React Navigation.
- Offline depth in v1 (draft-only) vs v1.x (full library).
- Whether to attempt US/EU external-link billing later to reduce the platform tax.

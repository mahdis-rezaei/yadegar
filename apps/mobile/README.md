# Yadegar mobile (Expo / React Native)

Phase 0 of the native app. This folder holds our **app code** (auth, API layer,
theme, starter screens). Because Expo needs native tooling and a device/simulator,
**you bootstrap + run it on your machine** (Mac for iOS); it is intentionally *not*
wired into the repo's sandbox-tuned pnpm install.

See `docs/MOBILE-APP-PLAN.md` for the full plan.

---

## Bootstrap & run (on your machine)

This folder already has the full app: `package.json`, Expo/NativeWind config, and
our source (`app/`, `lib/`). So it's a one-command start:

```bash
cd apps/mobile

npm install                 # install the pinned deps
npx expo install --fix      # align native deps to your installed Expo SDK (important)
cp .env.example .env        # backend URL (defaults to yadegarjournal.com)

npx expo start              # press i (iOS sim) / a (Android) / scan the QR on device
```

If `expo-doctor` flags version mismatches (likely if your Expo SDK is newer than
the pinned ~52), run `npx expo install --fix` again and bump `expo` in
`package.json` to your target SDK. The NativeWind setup (`babel.config.js`,
`metro.config.js`, `tailwind.config.js`, `global.css`) is already wired.

For real device builds + store submission later: `npm i -g eas-cli && eas login`,
then `eas build` / `eas submit`.

For real device builds + store submission later: `eas build` / `eas submit`
(`npm i -g eas-cli && eas login`).

---

## What's here (drop these into the bootstrapped app)
- `lib/api.ts` — fetch wrapper: base URL, bearer token from SecureStore, the
  `X-Yadegar-Client: mobile` header the backend keys on.
- `lib/auth.tsx` — token auth context (sign in / up / out, `/auth/me` rehydrate).
- `lib/theme.ts` — brand color tokens (mirrors the web palette).
- `tailwind.config.js` + `global.css` — NativeWind with the brand tokens.
- `app/_layout.tsx` — providers (React Query + Auth) + auth redirect.
- `app/index.tsx` — routes to Today or Sign in based on auth.
- `app/(auth)/sign-in.tsx` — email/password (Google + Apple wired in Phase 0.x).
- `app/(app)/today.tsx` — first signed-in screen.

## Backend
The backend already accepts mobile auth: `requireAuth` reads
`Authorization: Bearer <token>`, and `/auth/login` + `/auth/register` return the
token in the body when the request sends `X-Yadegar-Client: mobile`. No backend
work needed to start.

## Phase 0.x (next)
- Wire **shared packages** (`@workspace/api-zod`, `@workspace/api-client-react`) via
  Metro `watchFolders` so we stop hand-typing request shapes.
- **Google** (`expo-auth-session`) + **Sign in with Apple** native flows.
- Biometric lock (`expo-local-authentication`) on app open.

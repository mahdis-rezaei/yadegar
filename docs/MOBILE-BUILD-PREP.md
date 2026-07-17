# Mobile — tomorrow's install + build (prep)

Everything below is already wired in code on `mobile-rich-text`. Tomorrow is
**one install** (JS packages) + **one `eas build`** (native modules), and it all
lights up.

## ⚠️ Order matters
The new packages must be **installed before you reload Metro**, or the bundle
can't resolve them (fonts, date picker, etc. are real imports now).

```bash
# 1. get the code
cd ~/still/apps/mobile
git checkout mobile-rich-text
git pull

# 2. install all the new deps + align versions to the SDK, then lock it
npm install
npx expo install --fix
git add package.json package-lock.json && git commit -m "Sync lockfile for mobile build" && git push

# 3. build the native binary (includes every native module below)
npx eas-cli build --profile development --platform ios
# …install that build on your phone from the Expo link when it finishes…

# 4. run Metro and open the app
npx expo start --dev-client
```

## What works after step 2 (install only — no build)
- **Brand fonts** — Fraunces · Newsreader · Inter (the web's exact set). Newsreader
  is the global serif body; tailwind has `font-display`/`font-body`/`font-sans`.
  *(Caveat: with custom fonts, bold/italic don't auto-swap weight files; a
  follow-up can map Fraunces onto headings and the italic face onto quotes.)*
- **Help & FAQ** — native, mirrors `docs/FAQ.md` (menu + Settings).
- **Membership** — native info screen (price-free; real subscribe = IAP, below).

## What needs the build (step 3)
These native modules are in `package.json`; the build compiles them in:
- **`react-native-webview`** → the live rich-text editor (toolbar + colours).
- **`expo-image-manipulator`** → photo avatars (resize under the size cap).
- **`expo-document-picker`** → import a `.txt` / `.md` file (Library → Bring old
  journals). Paste import already works.
- **`@react-native-community/datetimepicker`** → the native date wheel for a
  Capsule's "On a date…" (the typed `YYYY-MM-DD` field works without it).
- (already needed before) `expo-image-picker`, `expo-speech-recognition`.

## The app icon
`assets/icon.png` (+ splash, Android adaptive icon) is set in `app.json` — a
serif **Y** on deep brown. It bakes into the binary at **build** time, so the
home-screen icon updates after step 3.

## Still TODO (can't be finished from code alone)
- **Membership / IAP** — needs `react-native-purchases` (RevenueCat) **plus**
  App Store Connect subscription products + RevenueCat dashboard config. The
  in-app screen is ready; the Subscribe button + purchase flow come with that
  setup. (App Store rules forbid showing external prices / web checkout, which is
  why the landing + membership screens are intentionally price-free.)
- **Fonts polish** — map Fraunces → headings and the italic face → quotes for
  exact weight/italic fidelity.
- **Google-Doc import** — paste + file are wired; Google Doc is a later slice.

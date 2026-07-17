# Android readiness

An honest assessment of what shipping Yadegar on Android actually takes. Written
while iOS is in App Store review; **the recommendation is to hold Android until
iOS is approved and quota enforcement proves people pay** — but the point of this
doc is that when that day comes, Android is a *setup* project, not a rewrite.

## Verdict

The app is Expo/React Native, so most of it is already cross-platform and the
iOS-specific bits degrade gracefully. The code lift is **modest**; the real work
is **account/store/billing setup** (Play Console, Google Play Billing, Firebase) —
the same shape as the iOS launch, which you've now done once.

## Already Android-ready (no work)

- **Auth** — Google + email/password work on every platform. The Sign-in-with-Apple
  button is gated behind `AppleAuthentication.isAvailableAsync()` (`app/(auth)/
  sign-in.tsx`), so it simply doesn't render on Android. Nothing to change.
- **Biometric lock** — `expo-local-authentication` is cross-platform, and
  `app.json` already declares `USE_BIOMETRIC` / `USE_FINGERPRINT`. Verify on a
  device; expected to work.
- **UI/behavior** — the `Platform.OS === "ios"` branches (keyboard toolbar in
  `keyboard-done.tsx`, `KeyboardAvoidingView` behavior, share sheets in
  library/capsules/privacy views) all fall back cleanly on Android.
- **`app.json`** — Android is already scaffolded: `package` com.yadegar.app,
  adaptive icon, permissions.
- **Push (code side)** — `lib/push.ts` already sets up the Android notification
  channel and sends `platform`. Uses Expo push tokens, so Expo routes delivery.

## Needs code work (small)

- **Membership / IAP** — `lib/purchases.ts` is hard-gated to iOS
  (`if (Platform.OS !== "ios") return null`). For Android it must configure the
  RevenueCat **Google** SDK key (`goog_…`) instead of the `appl_…` key and drop
  the iOS-only guard. Small code change — but it depends on the Play Billing
  setup below existing first.
- **Any iOS-only affordances** worth a pass for parity (e.g. the writing-screen
  keyboard toolbar is iOS-only by design — fine to leave, just a known gap).

## Needs setup — the bulk of the work (no code)

1. **Google Play Developer account** — one-time $25.
2. **Google Play Billing** — recreate the two subscriptions
   (`com.yadegar.app.member.monthly` / `.yearly`, $8.99 / $59.99) in Play Console,
   then connect Play to RevenueCat with a Google Cloud **service-account JSON**
   (Play Console → API access). Add the `member` entitlement + offering for the
   Play products, mirroring iOS.
3. **Firebase / FCM** — create a Firebase project, add `google-services.json`, and
   upload the FCM V1 service-account key to Expo/EAS credentials so Android push
   delivers.
4. **EAS Android build** — `eas build --platform android --profile production`
   (generates a keystore on first run) and `eas submit --platform android`.
5. **Play Console listing** — Android screenshots, short/full description, content
   rating questionnaire, **Data safety** form, target audience, privacy policy URL
   (already have one). Then a Play review cycle (usually faster than Apple's).

## Rough effort

- Code: ~half a day (un-gate purchases + `goog_` key, verify push + biometric on a
  real device).
- Setup: a few days across Play Console + Play Billing + Firebase + store assets,
  plus a review cycle. Front-loaded and mostly one-time.

## When to do it

Hold until: (a) iOS 1.0 is approved and live, and (b) quota enforcement is on and
the iOS funnel shows real conversion. Expanding platforms before the funnel
converts doubles maintenance/testing surface for unproven upside. Once iOS earns
it, this checklist is the path.

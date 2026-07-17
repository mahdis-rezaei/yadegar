import { Platform } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";

// RevenueCat (In-App Purchase) wrapper. iOS-only for now — Android membership
// arrives with the Play/FCM work. Everything is defensive: if the native module
// isn't present (Expo Go, or a build before the SDK was added) every call no-ops,
// so membership.tsx falls back to its "coming soon" state instead of crashing.

// Public SDK key — designed to be embedded in the app, so it's safe to commit.
const APPLE_API_KEY = "appl_DTIciHsKPmaCNquCtPjilOLpodJ";
// Must match the entitlement identifier configured in RevenueCat.
const ENTITLEMENT_ID = "member";

let configured = false;

// Load the SDK lazily so a build/runtime without the native module never throws
// at import time (same guard philosophy as lib/push.ts).
async function rc() {
  if (Platform.OS !== "ios") return null;
  try {
    return (await import("react-native-purchases")).default;
  } catch {
    return null;
  }
}

// Configure once with the signed-in user as the RevenueCat app_user_id, so the
// backend webhook's app_user_id maps straight to our users.id. Safe to call on
// every auth change — re-identifies if already configured.
export async function configurePurchases(userId: string): Promise<void> {
  const Purchases = await rc();
  if (!Purchases) return;
  try {
    if (!configured) {
      Purchases.configure({ apiKey: APPLE_API_KEY, appUserID: userId });
      configured = true;
    } else {
      await Purchases.logIn(userId);
    }
  } catch {
    // never let purchases setup break the app
  }
}

// On sign-out, detach so a shared device doesn't carry the entitlement over.
export async function logOutPurchases(): Promise<void> {
  if (!configured) return;
  const Purchases = await rc();
  if (!Purchases) return;
  try {
    await Purchases.logOut();
  } catch {
    // best-effort
  }
}

export interface MemberPackages {
  monthly: PurchasesPackage | null;
  annual: PurchasesPackage | null;
}

// The current offering's monthly + annual packages, or null when unavailable
// (no SDK, no offering, or a fetch error) — the screen treats null as "no paywall
// to show" and falls back.
export async function getMemberPackages(): Promise<MemberPackages | null> {
  const Purchases = await rc();
  if (!Purchases) return null;
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return null;
    return { monthly: current.monthly ?? null, annual: current.annual ?? null };
  } catch {
    return null;
  }
}

// Purchase a package. Resolves true if the member entitlement is now active.
// Throws on real failures (the caller distinguishes a user cancel via
// `error.userCancelled`); returns false only when purchases are unavailable.
export async function purchaseMemberPackage(
  pkg: PurchasesPackage,
): Promise<boolean> {
  const Purchases = await rc();
  if (!Purchases) return false;
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo.entitlements.active[ENTITLEMENT_ID] != null;
}

// Restore prior purchases. Resolves true if the member entitlement is active.
export async function restoreMembership(): Promise<boolean> {
  const Purchases = await rc();
  if (!Purchases) return false;
  const customerInfo = await Purchases.restorePurchases();
  return customerInfo.entitlements.active[ENTITLEMENT_ID] != null;
}

export interface MembershipDetails {
  // Derived from the product id (…member.yearly / …member.monthly).
  plan: "monthly" | "yearly" | null;
  // ISO date the current period ends. With willRenew it's the next charge date;
  // otherwise it's when access ends.
  expirationDate: string | null;
  willRenew: boolean;
  // True for TestFlight/sandbox purchases (dates are accelerated there).
  isSandbox: boolean;
}

// Plan + renewal detail for the active member entitlement, straight from
// RevenueCat's local customer info — so the member screen can show "Yearly ·
// renews <date>" without a backend round-trip. null when there's no active
// entitlement (e.g. a web/Stripe member on this device) or no SDK.
export async function getMembershipDetails(): Promise<MembershipDetails | null> {
  const Purchases = await rc();
  if (!Purchases) return null;
  try {
    const info = await Purchases.getCustomerInfo();
    const ent = info.entitlements.active[ENTITLEMENT_ID];
    if (!ent) return null;
    const pid = ent.productIdentifier ?? "";
    const plan = /year|annual/i.test(pid)
      ? "yearly"
      : /month/i.test(pid)
        ? "monthly"
        : null;
    return {
      plan,
      expirationDate: ent.expirationDate ?? null,
      willRenew: ent.willRenew ?? false,
      isSandbox: ent.isSandbox ?? false,
    };
  } catch {
    return null;
  }
}

// Whether the member entitlement is currently active for this device, straight
// from RevenueCat's (locally cached) customer info. This is the truth the app
// trusts for showing membership immediately after a purchase — the backend
// `plan` (flipped by the webhook) can lag by seconds, so the UI must not wait on
// it. Returns false when the SDK isn't present (non-iOS, older build).
export async function hasActiveMembership(): Promise<boolean> {
  const Purchases = await rc();
  if (!Purchases) return false;
  try {
    const info = await Purchases.getCustomerInfo();
    return info.entitlements.active[ENTITLEMENT_ID] != null;
  } catch {
    return false;
  }
}

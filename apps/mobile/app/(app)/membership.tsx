import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, View } from "react-native";
import { Text } from "../../components/text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import {
  getMemberPackages,
  getMembershipDetails,
  purchaseMemberPackage,
  restoreMembership,
  type MemberPackages,
  type MembershipDetails,
} from "../../lib/purchases";

// Ask the server to verify this user's entitlement with RevenueCat and flip the
// backend plan now, instead of waiting on the (async, out-of-band) webhook.
// Best-effort: the webhook is the backstop, and the local entitlement already
// drives the UI, so a failure here never blocks the member.
async function syncMembershipToServer(): Promise<void> {
  try {
    await api("/billing/revenuecat/sync", { method: "POST" });
  } catch {
    // ignore — webhook + local entitlement cover it
  }
}

function formatRenewal(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}
import type { PurchasesPackage } from "react-native-purchases";

// Membership. Sells the upgrade via Apple In-App Purchase (RevenueCat). If the
// offering can't load (older build, simulator, Android), it falls back to the
// gentle "coming soon" copy rather than a dead end.
function Bullet({ children }: { children: string }) {
  return (
    <View className="flex-row gap-2">
      <Text className="text-faint-ink">·</Text>
      <Text className="flex-1 text-soft-ink leading-relaxed">{children}</Text>
    </View>
  );
}

const TERMS = "https://yadegarjournal.com/terms";
const PRIVACY = "https://yadegarjournal.com/privacy-policy";
// Apple owns IAP billing: cancelling or switching between the monthly/yearly plan
// happens in the system Subscriptions screen, never in-app. This deep link opens
// it directly. (There is no equivalent in-app cancel — Apple's rules forbid it.)
const MANAGE_SUBSCRIPTIONS = "https://apps.apple.com/account/subscriptions";

export default function Membership() {
  const insets = useSafeAreaInsets();
  const { user, refresh, isMember, syncMembership } = useAuth();

  const [packages, setPackages] = useState<MemberPackages | null>(null);
  const [details, setDetails] = useState<MembershipDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Load the active plan + renewal date for a member (from RevenueCat, on-device).
  useEffect(() => {
    if (!isMember) {
      setDetails(null);
      return;
    }
    let active = true;
    void (async () => {
      const d = await getMembershipDetails();
      if (active) setDetails(d);
    })();
    return () => {
      active = false;
    };
  }, [isMember]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const p = await getMemberPackages();
      if (active) {
        setPackages(p);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const onPurchase = useCallback(
    async (pkg: PurchasesPackage) => {
      setBusy(true);
      try {
        const ok = await purchaseMemberPackage(pkg);
        if (ok) {
          // Reflect the entitlement immediately (instant UI), then have the
          // server verify with RevenueCat and flip the backend plan now rather
          // than waiting on the webhook; refresh pulls the updated user.
          await syncMembership();
          await syncMembershipToServer();
          await refresh();
          Alert.alert("You're a member", "Thank you for supporting Yadegar.");
        }
      } catch (e) {
        // A user cancelling isn't an error — only surface real failures.
        if (!(e as { userCancelled?: boolean })?.userCancelled) {
          Alert.alert("Purchase failed", "Something went wrong. Please try again.");
        }
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const onRestore = useCallback(async () => {
    setBusy(true);
    try {
      const ok = await restoreMembership();
      await syncMembership();
      await syncMembershipToServer();
      await refresh();
      Alert.alert(
        ok ? "Membership restored" : "Nothing to restore",
        ok
          ? "Your membership is active again."
          : "No previous membership was found for this Apple ID.",
      );
    } catch {
      Alert.alert("Couldn't restore", "Please try again in a moment.");
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  // Switch an existing member between the monthly and yearly plan. Both products
  // live in the same App Store subscription group, so purchasing the other one is
  // handled by StoreKit as a crossgrade (Apple replaces the plan and prorates —
  // no double charge), not a second subscription. This is App Store-compliant;
  // only cancellation must go through Apple's system Subscriptions screen.
  const onSwitch = useCallback(
    async (pkg: PurchasesPackage) => {
      setBusy(true);
      try {
        const ok = await purchaseMemberPackage(pkg);
        if (ok) {
          await syncMembership();
          await syncMembershipToServer();
          // isMember stays true across a switch, so the details effect won't
          // re-fire — refresh the plan/renewal card explicitly.
          setDetails(await getMembershipDetails());
          await refresh();
          Alert.alert("Plan updated", "Your membership plan has been changed.");
        }
      } catch (e) {
        if (!(e as { userCancelled?: boolean })?.userCancelled) {
          Alert.alert("Couldn't change plan", "Something went wrong. Please try again.");
        }
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const annual = packages?.annual ?? null;
  const monthly = packages?.monthly ?? null;
  const hasOffer = !isMember && Boolean(annual || monthly);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: 12,
        paddingHorizontal: 24,
        paddingBottom: insets.bottom + 48,
      }}
    >
      <Text className="text-4xl text-deep-brown leading-tight">
        {isMember ? "You're a member." : "Free to keep. Yours to deepen."}
      </Text>
      <Text className="text-soft-ink mt-3 leading-relaxed">
        Your journal is always free. Membership lifts the cap on new returns —
        Yadegar reading across your years, whenever you like.
      </Text>

      <View className="mt-6 rounded-3xl border border-border bg-surface p-5">
        <Text className="text-xs uppercase tracking-widest text-faint-ink mb-3">
          Your journal · Free
        </Text>
        <View className="gap-2.5">
          <Bullet>Unlimited writing, keeping & importing</Bullet>
          <Bullet>Your whole archive, private & encrypted</Bullet>
          <Bullet>Export everything, anytime</Bullet>
          <Bullet>A few fresh returns a month</Bullet>
          <Bullet>Revisit anything that's returned, always free</Bullet>
        </View>
      </View>

      <View className="mt-4 rounded-3xl border border-accent-sepia/30 bg-surface p-5">
        <Text className="text-xs uppercase tracking-widest text-faint-ink mb-3">
          Membership
        </Text>
        <View className="gap-2.5">
          <Bullet>Unlimited fresh returns across your years</Bullet>
          <Bullet>Read across all your time, whenever you like</Bullet>
        </View>
        {!isMember && user?.usage && user.usage.limit != null ? (
          <Text className="text-faint-ink text-sm mt-4">
            Fresh returns this month: {user.usage.used} of about {user.usage.limit}.
          </Text>
        ) : null}
      </View>

      <Text className="text-faint-ink text-sm mt-5 leading-relaxed">
        We gate the AI, never your journal. Your words are always yours to write,
        keep, and take with you.
      </Text>

      {/* Purchase / state */}
      {isMember ? (
        <View className="mt-8">
          <View className="rounded-3xl border border-accent-sepia/30 bg-surface p-5">
            <Text className="text-lg text-ink">
              {details?.plan === "yearly"
                ? "Yearly membership"
                : details?.plan === "monthly"
                  ? "Monthly membership"
                  : "You're a member"}
            </Text>
            {details?.expirationDate ? (
              <Text className="text-soft-ink text-sm mt-1">
                {details.willRenew ? "Renews " : "Access until "}
                {formatRenewal(details.expirationDate)}
              </Text>
            ) : null}
            {details?.isSandbox ? (
              <Text className="text-faint-ink text-xs mt-1">
                Sandbox (TestFlight) — dates are accelerated for testing.
              </Text>
            ) : null}
          </View>
          {/* In-app plan switch (a StoreKit crossgrade within the subscription
              group). Shown once we know the current plan and the other package
              has loaded. */}
          {details?.plan === "monthly" && annual ? (
            <Pressable
              onPress={() => onSwitch(annual)}
              disabled={busy}
              className="rounded-full bg-deep-brown px-6 py-4 items-center mt-4"
            >
              <Text className="text-background">
                Switch to yearly · {annual.product.priceString}/year
              </Text>
              <Text className="text-background/70 text-xs mt-0.5">Save 44%</Text>
            </Pressable>
          ) : details?.plan === "yearly" && monthly ? (
            <Pressable
              onPress={() => onSwitch(monthly)}
              disabled={busy}
              className="rounded-full border border-border bg-surface px-6 py-4 items-center mt-4"
            >
              <Text className="text-ink">
                Switch to monthly · {monthly.product.priceString}/month
              </Text>
            </Pressable>
          ) : null}

          <Text className="text-soft-ink text-sm leading-relaxed mt-4">
            Thank you for supporting Yadegar. Cancel anytime through your Apple ID.
          </Text>
          <Pressable
            onPress={() => void Linking.openURL(MANAGE_SUBSCRIPTIONS)}
            className="rounded-full border border-border bg-surface px-6 py-4 items-center mt-3"
          >
            <Text className="text-ink">Manage subscription</Text>
          </Pressable>

          {busy ? (
            <View className="mt-4 items-center">
              <ActivityIndicator color="#3A2F25" />
            </View>
          ) : null}
        </View>
      ) : hasOffer ? (
        <View className="mt-6">
          {annual ? (
            <Pressable
              onPress={() => onPurchase(annual)}
              disabled={busy}
              className="rounded-full bg-deep-brown px-6 py-4 items-center"
            >
              <Text className="text-background">
                Become a member · {annual.product.priceString}/year
              </Text>
              <Text className="text-background/70 text-xs mt-0.5">Best value</Text>
            </Pressable>
          ) : null}
          {monthly ? (
            <Pressable
              onPress={() => onPurchase(monthly)}
              disabled={busy}
              className="rounded-full border border-border bg-surface px-6 py-4 items-center mt-3"
            >
              <Text className="text-ink">
                Monthly · {monthly.product.priceString}/month
              </Text>
            </Pressable>
          ) : null}

          <Pressable onPress={onRestore} disabled={busy} className="mt-5 items-center">
            <Text className="text-soft-ink" style={{ fontSize: 13 }}>
              Restore purchases
            </Text>
          </Pressable>

          {busy ? (
            <View className="mt-4 items-center">
              <ActivityIndicator color="#3A2F25" />
            </View>
          ) : null}

          {/* App Store-required disclosure (Guideline 3.1.2). */}
          <Text className="text-faint-ink text-xs mt-6 leading-relaxed">
            Payment is charged to your Apple ID. Membership renews automatically
            for the same price and period unless cancelled at least 24 hours
            before the end of the current period; manage or cancel anytime in your
            Apple ID settings. By subscribing you agree to our{" "}
            <Text className="text-soft-ink" onPress={() => void Linking.openURL(TERMS)}>
              Terms
            </Text>{" "}
            and{" "}
            <Text className="text-soft-ink" onPress={() => void Linking.openURL(PRIVACY)}>
              Privacy Policy
            </Text>
            .
          </Text>
        </View>
      ) : loading ? (
        <View className="mt-8 items-center">
          <ActivityIndicator color="#3A2F25" />
        </View>
      ) : (
        <Text className="text-soft-ink text-sm mt-8 leading-relaxed">
          Membership is coming to the app soon. Until then, everything that
          matters — your writing, your archive, and revisiting what's returned —
          stays free and unlimited.
        </Text>
      )}
    </ScrollView>
  );
}

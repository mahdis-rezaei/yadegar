import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, View } from "react-native";
import { Text } from "../../../components/text";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as LocalAuthentication from "expo-local-authentication";
import { useAuth } from "../../../lib/auth";
import { deleteAccount } from "../../../lib/settings";
import { getAppLockEnabled, setAppLockEnabled } from "../../../lib/app-lock";

// Settings hub — mirrors the web: section cards (Account · Membership · Nudges ·
// What returns · Your data · Help) that open sub-pages, then Sign out.

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-xs uppercase tracking-widest text-faint-ink mb-3">
      {children}
    </Text>
  );
}

function NavCard({
  onPress,
  children,
}: {
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl border border-border bg-surface p-5"
    >
      {children}
    </Pressable>
  );
}

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isMember, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [lockOn, setLockOn] = useState(false);

  useEffect(() => {
    void getAppLockEnabled().then(setLockOn);
  }, []);

  async function onToggleLock(next: boolean) {
    // Turning it on is pointless if the device has no enrolled biometrics or
    // passcode — warn instead of silently leaving the lock inert.
    if (next) {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) {
        Alert.alert(
          "Set up Face ID first",
          "Add Face ID, Touch ID, or a passcode in your device settings to use the app lock.",
        );
        return;
      }
    }
    setLockOn(next);
    await setAppLockEnabled(next);
  }

  function onDelete() {
    Alert.alert(
      "Delete account?",
      "This permanently erases your account and all your pages, reflections, and returns. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await deleteAccount();
              await signOut();
            } catch {
              setBusy(false);
              Alert.alert("Couldn't delete", "Something went wrong. Please try again.");
            }
          },
        },
      ],
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: 14,
        paddingHorizontal: 24,
        paddingBottom: insets.bottom + 48,
      }}
    >
      <Text className="text-4xl text-deep-brown">Settings</Text>

      <View className="mt-8">
        <SectionLabel>Account</SectionLabel>
        <NavCard onPress={() => router.push("/(app)/settings/profile")}>
          {user?.name ? <Text className="text-lg text-ink">{user.name}</Text> : null}
          <Text className="text-soft-ink">{user?.email}</Text>
          <Text className="text-soft-ink mt-2" style={{ fontSize: 13 }}>
            Edit your profile →
          </Text>
        </NavCard>
      </View>

      <View className="mt-8">
        <SectionLabel>Membership</SectionLabel>
        <NavCard onPress={() => router.push("/(app)/membership")}>
          {isMember ? (
            <>
              <Text className="text-lg text-ink">Member</Text>
              <Text className="text-soft-ink text-sm mt-1 leading-relaxed">
                Unlimited fresh returns across your years. Manage membership →
              </Text>
            </>
          ) : (
            <>
              <Text className="text-lg text-ink">Your journal, free</Text>
              <Text className="text-soft-ink text-sm mt-1 leading-relaxed">
                Writing, keeping, importing, and revisiting the pages that return
                to you are always free and unlimited.
              </Text>
              {user?.usage && user.usage.limit != null ? (
                <Text className="text-faint-ink text-sm mt-3">
                  Fresh returns this month: {user.usage.used} of about{" "}
                  {user.usage.limit}.
                </Text>
              ) : null}
              <Text className="text-soft-ink mt-3" style={{ fontSize: 13 }}>
                See membership →
              </Text>
            </>
          )}
        </NavCard>
      </View>

      <View className="mt-8">
        <SectionLabel>Nudges</SectionLabel>
        <NavCard onPress={() => router.push("/(app)/settings/reminders")}>
          <Text className="text-lg text-ink">Reminders</Text>
          <Text className="text-soft-ink text-sm mt-1 leading-relaxed">
            A gentle nudge to write, or a page brought back — your cadence, off by
            default.
          </Text>
        </NavCard>
      </View>

      <View className="mt-8">
        <SectionLabel>What returns</SectionLabel>
        <NavCard onPress={() => router.push("/(app)/settings/resurfacing")}>
          <Text className="text-lg text-ink">Muted periods</Text>
          <Text className="text-soft-ink text-sm mt-1 leading-relaxed">
            Fence off a season you'd rather not have return, without deleting a
            thing.
          </Text>
        </NavCard>
      </View>

      <View className="mt-8">
        <SectionLabel>Your data</SectionLabel>
        <NavCard onPress={() => router.push("/(app)/settings/privacy")}>
          <Text className="text-lg text-ink">Privacy & your pages</Text>
          <Text className="text-soft-ink text-sm mt-1 leading-relaxed">
            Export everything, or delete your account, anytime.
          </Text>
        </NavCard>
        <Text className="text-faint-ink text-sm mt-3 leading-relaxed">
          Your pages are private. Yadegar never shares your journals — they're
          encrypted at rest, and yours to export or delete whenever you like.
        </Text>
        <Pressable
          onPress={() => router.push("/(app)/philosophy")}
          className="mt-3 self-start"
        >
          <Text className="text-soft-ink" style={{ fontSize: 13 }}>
            The Yadegar philosophy →
          </Text>
        </Pressable>
      </View>

      <View className="mt-8">
        <SectionLabel>App lock</SectionLabel>
        <View className="rounded-2xl border border-border bg-surface p-5 flex-row items-center justify-between">
          <View className="flex-1 pr-4">
            <Text className="text-lg text-ink">Require Face ID</Text>
            <Text className="text-soft-ink text-sm mt-1 leading-relaxed">
              Ask for Face ID, Touch ID, or your passcode each time you open
              Yadegar. Off by default.
            </Text>
          </View>
          <Switch value={lockOn} onValueChange={onToggleLock} />
        </View>
      </View>

      <View className="mt-8">
        <SectionLabel>Help</SectionLabel>
        <NavCard onPress={() => router.push("/(app)/help")}>
          <Text className="text-lg text-ink">Help & FAQ</Text>
          <Text className="text-soft-ink text-sm mt-1 leading-relaxed">
            Answers to common questions about every part of Yadegar.
          </Text>
        </NavCard>
      </View>

      <Pressable onPress={signOut} className="mt-10 self-start">
        <Text className="text-soft-ink">Sign out</Text>
      </Pressable>

      <View className="mt-8 pt-6 border-t border-border/50">
        <Pressable onPress={onDelete} disabled={busy} className="self-start">
          <Text style={{ color: "#B4453A" }}>Delete account</Text>
          <Text className="text-faint-ink text-sm mt-1 leading-relaxed">
            Permanently erase your account and everything in it.
          </Text>
        </Pressable>
        {busy ? (
          <View className="mt-4 self-start">
            <ActivityIndicator color="#3A2F25" />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

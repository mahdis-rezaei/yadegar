import { useState } from "react";
import { View, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Text } from "../components/text";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../lib/auth";

// First-run welcome. Shown once (when onboardingCompleted is false). Calm intro to
// what Yadegar does, then "Begin" → marks onboarding complete and the Gate routes
// on to Today. Kept to a single screen; the product reveals itself in use.
const POINTS = [
  {
    title: "Write what you want to remember",
    body: "A quiet page each day. Your words save to this phone first, then sync.",
  },
  {
    title: "Bring a page back",
    body: "Yadegar reads across your years and returns one thing worth returning to — pointing back to your own words.",
  },
  {
    title: "It stays quiet when nothing honest surfaces",
    body: "Better silence than a false thread. You're always in control of what resurfaces.",
  },
];

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, completeOnboarding } = useAuth();
  const [busy, setBusy] = useState(false);

  async function begin() {
    setBusy(true);
    try {
      await completeOnboarding();
      router.replace("/(app)/today");
    } catch {
      // If it fails, let them try again rather than trapping them here.
      setBusy(false);
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: insets.top + 48,
        paddingHorizontal: 28,
        paddingBottom: insets.bottom + 32,
        flexGrow: 1,
      }}
    >
      <Text className="text-soft-ink text-base">یادگار</Text>
      <Text className="text-4xl text-deep-brown mt-2">
        {user?.name ? `Welcome, ${user.name}.` : "Welcome to Yadegar."}
      </Text>
      <Text className="text-soft-ink mt-3 text-lg leading-relaxed">
        A companion to a lifelong journaling practice — a keepsake, the thing that
        remains.
      </Text>

      <View className="mt-10 gap-6">
        {POINTS.map((p) => (
          <View key={p.title}>
            <Text className="text-xl text-deep-brown">{p.title}</Text>
            <Text className="text-soft-ink mt-1 leading-relaxed">{p.body}</Text>
          </View>
        ))}
      </View>

      <View className="flex-1" />

      <Pressable
        onPress={begin}
        disabled={busy}
        style={{ opacity: busy ? 0.6 : 1 }}
        className="mt-12 items-center rounded-full bg-deep-brown py-4"
      >
        {busy ? (
          <ActivityIndicator color="#F7F1E6" />
        ) : (
          <Text className="text-background text-base">Begin</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

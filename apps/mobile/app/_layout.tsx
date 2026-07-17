import "../global.css";
import { useEffect, useState } from "react";
import { AppState, View } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../lib/auth";
import { BiometricLockGate } from "../lib/biometric-lock";
import { registerForPush } from "../lib/push";
import { getAppLockEnabled } from "../lib/app-lock";

const queryClient = new QueryClient();

// Auth gate: route signed-out → sign-in, brand-new users → onboarding, everyone
// else → the app.
function Gate() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const inAuthGroup = segments[0] === "(auth)";
  const inOnboarding = segments[0] === "onboarding";
  // Only force onboarding when the flag is EXPLICITLY false — a missing flag
  // (older accounts) is treated as done, so no one gets trapped.
  const needsOnboarding = !!user && user.onboardingCompleted === false;

  // App lock is OPT-IN (off by default); the gate only engages when the user has
  // turned on "Require Face ID" in Settings. Re-read on resume so toggling it
  // takes effect on the next foreground without a restart.
  const [lockEnabled, setLockEnabled] = useState(false);
  useEffect(() => {
    const refresh = () => void getAppLockEnabled().then(setLockEnabled);
    refresh();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      if (!inAuthGroup) router.replace("/(auth)/welcome");
      return;
    }
    if (needsOnboarding) {
      if (!inOnboarding) router.replace("/onboarding");
      return;
    }
    if (inAuthGroup || inOnboarding) router.replace("/(app)/today");
  }, [user, loading, inAuthGroup, inOnboarding, needsOnboarding, router]);

  // Refresh the push token when a signed-in user brings the app back to the
  // foreground, so a token invalidated between sessions self-heals (sign-in
  // alone wouldn't catch it). promptIfNeeded:false → never prompts on resume.
  useEffect(() => {
    if (!user) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void registerForPush({ promptIfNeeded: false });
    });
    return () => sub.remove();
  }, [user]);

  // While the session is still resolving, show a calm splash on the app's own
  // background instead of the current route. Without this, the Slot renders the
  // restored/initial screen (often the welcome/sign-in page) for the few hundred
  // ms it takes /auth/me to return — a jarring "logged-out" flash before the app
  // (and the Face ID lock) settle.
  if (loading) {
    return <View className="flex-1 bg-background" />;
  }

  return (
    <BiometricLockGate
      enabled={
        lockEnabled && Boolean(user) && !inAuthGroup && !inOnboarding
      }
    >
      <Slot />
    </BiometricLockGate>
  );
}

export default function RootLayout() {
  // Brand fonts are embedded in the binary (expo-font config plugin +
  // components/text.tsx) — nothing to load at runtime.
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

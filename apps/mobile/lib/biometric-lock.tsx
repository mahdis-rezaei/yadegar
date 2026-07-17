import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, AppState, Pressable, View } from "react-native";
import { Text } from "../components/text";
import * as LocalAuthentication from "expo-local-authentication";
import { useAuth } from "./auth";

type LockStatus = "checking" | "locked" | "unlocked";

export function BiometricLockGate({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const { signOut } = useAuth();
  const [status, setStatus] = useState<LockStatus>("unlocked");
  const [message, setMessage] = useState<string | null>(null);

  const unlock = useCallback(async () => {
    if (!enabled) {
      setStatus("unlocked");
      setMessage(null);
      return;
    }

    setStatus("checking");
    setMessage(null);

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      // Simulator/devices without biometrics should not trap the user.
      // They can still use the app while the feature remains enabled on real devices.
      if (!hasHardware || !isEnrolled) {
        setStatus("unlocked");
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Yadegar",
        fallbackLabel: "Use passcode",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });

      if (result.success) {
        setStatus("unlocked");
        return;
      }

      // Don't echo the title here — a redundant "Yadegar is locked." subtitle
      // looked broken. Fall through to the helpful default copy below.
      setStatus("locked");
      setMessage(null);
    } catch {
      // Graceful dev fallback: never strand the user behind a native-module error.
      setStatus("unlocked");
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setStatus("unlocked");
      setMessage(null);
      return;
    }

    void unlock();
  }, [enabled, unlock]);

  useEffect(() => {
    if (!enabled) return;

    let shouldLockOnReturn = false;

    const subscription = AppState.addEventListener("change", (nextState) => {
      // Only a true "background" should re-lock. iOS also fires "inactive"
      // while the native Face ID prompt is up (and for the app switcher, control
      // center, incoming calls) — if we re-locked on "inactive", the unlock
      // prompt itself would flip us to "inactive", we'd re-lock, then on
      // "active" re-prompt: an infinite Face ID loop right after sign-in.
      if (nextState === "background") {
        shouldLockOnReturn = true;
        setStatus("locked");
      }

      if (nextState === "active" && shouldLockOnReturn) {
        shouldLockOnReturn = false;
        void unlock();
      }
    });

    return () => subscription.remove();
  }, [enabled, unlock]);

  if (!enabled || status === "unlocked") {
    return <>{children}</>;
  }

  // During the (fast) initial/auto check, show a calm splash — NOT the alarming
  // "Yadegar is locked" screen — so a normal sign-in doesn't flash a scary lock
  // message before Today. The full lock screen below only appears once a check
  // has actually failed (status === "locked"), where the Unlock button matters.
  if (status === "checking") {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#3A2F25" />
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-background px-8">
      <Text className="text-center text-3xl text-deep-brown">
        Yadegar is locked
      </Text>

      <Text className="mt-3 text-center text-soft-ink leading-relaxed">
        {message ?? "Use Face ID, Touch ID, or your device passcode to open your journal."}
      </Text>

      <Pressable
        onPress={unlock}
        className="mt-8 w-full rounded-full bg-deep-brown px-5 py-4"
      >
        <Text className="text-center text-base text-background">Unlock</Text>
      </Pressable>

      <Pressable onPress={signOut} className="mt-6">
        <Text className="text-soft-ink">Sign out</Text>
      </Pressable>
    </View>
  );
}

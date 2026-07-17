import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import { api } from "./api";

// Native push: ask permission, get this device's Expo push token, and register it
// with the backend so the nudge cron can reach it (the native counterpart to the
// web's email nudges).
//
// IMPORTANT — why the guard below: on a build that doesn't include the push native
// modules yet (an older dev build made before push, or Expo Go), merely importing
// expo-notifications throws "Cannot find native module 'ExpoPushTokenManager'" at
// module-eval time — and that throw escapes even a surrounding try/catch (Metro
// surfaces dynamic-import eval errors out of band). So we first check, via
// expo-modules-core (always present), whether the native module is registered. If
// not, we skip everything and never touch expo-notifications. Push stays dormant
// until the app is rebuilt with the modules; it can never break sign-in or launch.
//
// NOTE: remote push only delivers from a dev/production build (not Expo Go). The
// EAS projectId in app.json (extra.eas.projectId) is what getExpoPushTokenAsync needs.

// True only on a build that actually includes the push native module.
function pushNativeAvailable(): boolean {
  try {
    return requireOptionalNativeModule("ExpoPushTokenManager") != null;
  } catch {
    return false;
  }
}

function projectIdFrom(constants: unknown): string | undefined {
  const c = constants as {
    expoConfig?: { extra?: { eas?: { projectId?: string } } };
    easConfig?: { projectId?: string };
  };
  return c?.expoConfig?.extra?.eas?.projectId ?? c?.easConfig?.projectId;
}

// Returns the registered token, or null if registration didn't happen (no native
// module, no permission, simulator, or error). Safe to call repeatedly (the
// backend upserts).
//
// promptIfNeeded (default true): on sign-in we may ask for permission. On an
// app-resume refresh we pass false — only re-register a token for users who
// already opted in, never surface a permission prompt on resume.
export async function registerForPush(
  opts: { promptIfNeeded?: boolean } = {},
): Promise<string | null> {
  const { promptIfNeeded = true } = opts;
  // Skip entirely on a build without the push native module (see note above).
  if (!pushNativeAvailable()) return null;
  try {
    const Notifications = await import("expo-notifications");
    const Device = await import("expo-device");
    const Constants = (await import("expo-constants")).default;

    // Push requires a physical device.
    if (!Device.isDevice) return null;

    // Show an alert + sound when a push arrives while foregrounded.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        // SDK 54: shouldShowAlert split into banner + list.
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      // Resume refreshes skip the prompt entirely — only refresh tokens for
      // users who already granted permission.
      if (!promptIfNeeded) return null;
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") return null;

    // Android needs a channel for notifications to show.
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const tokenResp = await Notifications.getExpoPushTokenAsync({
      projectId: projectIdFrom(Constants),
    });
    const token = tokenResp.data;
    if (!token) return null;

    // Dev-only: print the token so you can fire a test push from the terminal
    // (stripped from production builds via __DEV__).
    if (__DEV__) console.log("[push] Expo push token:", token);

    await api("/notifications/devices", {
      method: "POST",
      body: { token, platform: Platform.OS },
    });
    return token;
  } catch {
    // Never let push registration break sign-in / app launch.
    return null;
  }
}

// Unregister on sign-out so a shared device stops receiving this user's pushes.
export async function unregisterForPush(): Promise<void> {
  if (!pushNativeAvailable()) return;
  try {
    const Notifications = await import("expo-notifications");
    const Device = await import("expo-device");
    const Constants = (await import("expo-constants")).default;
    if (!Device.isDevice) return;
    const tokenResp = await Notifications.getExpoPushTokenAsync({
      projectId: projectIdFrom(Constants),
    });
    const token = tokenResp.data;
    if (!token) return;
    await api("/notifications/devices", { method: "DELETE", body: { token } });
  } catch {
    // best-effort cleanup
  }
}

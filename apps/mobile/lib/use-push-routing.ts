import { useEffect } from "react";
import { useRouter } from "expo-router";
import { requireOptionalNativeModule } from "expo-modules-core";

// Route a tapped push to the page it's about. Payloads come from the nudge cron
// (api-server routes/cron.ts):
//   { type: "writing" }                    → Today
//   { type: "on_this_day", entryId }       → that entry
//   { type: "memory", entryId? }           → that entry, else Returns
// Mounted from the (app) layout, so it only runs when signed in and the target
// routes exist. Handles both cold start (app launched by a tap) and warm taps.

// Same guard as lib/push.ts: never touch expo-notifications on a build without
// the native module (it throws at import-eval), which would break the app.
function pushAvailable(): boolean {
  try {
    return requireOptionalNativeModule("ExpoPushTokenManager") != null;
  } catch {
    return false;
  }
}

function routeFor(router: ReturnType<typeof useRouter>, data: unknown): void {
  const d = (data ?? {}) as { type?: string; entryId?: string | null };
  const entryId = typeof d.entryId === "string" ? d.entryId : null;
  if (d.type === "writing") {
    router.push("/(app)/today");
  } else if (entryId && (d.type === "on_this_day" || d.type === "memory")) {
    router.push({ pathname: "/(app)/entries/[id]", params: { id: entryId } });
  } else if (d.type === "memory") {
    router.push("/(app)/returns");
  }
}

export function usePushNotificationRouting(): void {
  const router = useRouter();
  useEffect(() => {
    if (!pushAvailable()) return;
    let cancelled = false;
    let sub: { remove: () => void } | undefined;
    void (async () => {
      const Notifications = await import("expo-notifications");
      // Cold start: the app was launched by tapping a notification.
      const last = await Notifications.getLastNotificationResponseAsync();
      if (last && !cancelled) {
        routeFor(router, last.notification.request.content.data);
      }
      // Warm: tapped while the app was running or backgrounded.
      sub = Notifications.addNotificationResponseReceivedListener((resp) => {
        routeFor(router, resp.notification.request.content.data);
      });
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [router]);
}

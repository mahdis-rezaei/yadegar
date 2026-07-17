import { Tabs } from "expo-router";
import { TabBar } from "../../components/tab-bar";
import { AppHeader } from "../../components/app-header";
import { usePushNotificationRouting } from "../../lib/use-push-routing";

// Navigation mirrors the web: primary destinations are Today · Look back ·
// Explore (the bottom tabs), and the full menu — Explore's sub-sections, Returns,
// Shop, and account — lives in the ☰ AppHeader on each screen. Everything else is
// a hidden route reached from the menu, the Explore hub, or a list.
export default function AppLayout() {
  // Tapping a push (nudge) deep-links to the page it's about. Only here, so it
  // runs when signed in and the target routes exist.
  usePushNotificationRouting();

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: true, header: () => <AppHeader /> }}
    >
      <Tabs.Screen name="today" options={{ title: "Today" }} />
      <Tabs.Screen name="look-back" options={{ title: "Look back" }} />
      <Tabs.Screen name="explore" options={{ title: "Explore" }} />
      {/* Hidden routes — reached via the ☰ menu, the Explore hub, or a list. */}
      <Tabs.Screen name="library" options={{ href: null }} />
      <Tabs.Screen name="returns" options={{ href: null }} />
      <Tabs.Screen name="history" options={{ href: null }} />
      <Tabs.Screen name="philosophy" options={{ href: null }} />
      <Tabs.Screen name="why" options={{ href: null }} />
      <Tabs.Screen name="help" options={{ href: null }} />
      <Tabs.Screen name="membership" options={{ href: null }} />
      <Tabs.Screen name="settings/index" options={{ href: null }} />
      <Tabs.Screen name="settings/profile" options={{ href: null }} />
      <Tabs.Screen name="settings/reminders" options={{ href: null }} />
      <Tabs.Screen name="settings/resurfacing" options={{ href: null }} />
      <Tabs.Screen name="settings/privacy" options={{ href: null }} />
      <Tabs.Screen name="calendar" options={{ href: null }} />
      <Tabs.Screen name="collections" options={{ href: null }} />
      <Tabs.Screen name="collection/[id]" options={{ href: null }} />
      <Tabs.Screen name="shelf" options={{ href: null }} />
      <Tabs.Screen name="capsules" options={{ href: null }} />
      <Tabs.Screen name="year" options={{ href: null }} />
      <Tabs.Screen name="import" options={{ href: null }} />
      <Tabs.Screen name="entries/[id]" options={{ href: null }} />
    </Tabs>
  );
}

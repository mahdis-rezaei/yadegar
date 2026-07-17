import { View, Pressable } from "react-native";
import { Text } from "./text";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// A custom, brand-matched bottom tab bar. We render it ourselves (instead of the
// default react-navigation bar) so we get: proper bottom safe-area padding (labels
// never clip into the home indicator), clean text-only tabs with no stray icon
// placeholders, and the calm cream/brown palette. Dependency-free — no icon font,
// so it works on the current dev build. The active tab is deep-brown + medium
// weight with a short accent rule above it; the rest are muted.

const ORDER = ["today", "look-back", "explore"] as const;
const LABELS: Record<string, string> = {
  today: "Today",
  "look-back": "Look back",
  explore: "Explore",
};

const DEEP_BROWN = "#3A2F25";
const FAINT_INK = "#A59B8D";
const ACCENT = "#8A6F4D"; // accent-sepia

// Minimal shape of the react-navigation tab bar props we use (typed inline to
// avoid importing @react-navigation/bottom-tabs).
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (e: {
      type: "tabPress";
      target: string;
      canPreventDefault: boolean;
    }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const tabs = state.routes
    .map((route, index) => ({ route, index }))
    .filter(({ route }) => ORDER.includes(route.name as (typeof ORDER)[number]));

  return (
    <View
      style={{ paddingBottom: insets.bottom || 10 }}
      className="flex-row border-t border-border bg-surface"
    >
      {tabs.map(({ route, index }) => {
        const focused = state.index === index;
        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            className="flex-1 items-center pt-3 pb-2"
          >
            {/* short accent rule above the active tab */}
            <View
              style={{
                height: 2,
                width: 18,
                borderRadius: 1,
                marginBottom: 7,
                backgroundColor: focused ? ACCENT : "transparent",
              }}
            />
            <Text
              style={{
                fontSize: 13,
                color: focused ? DEEP_BROWN : FAINT_INK,
                fontWeight: focused ? "600" : "400",
              }}
            >
              {LABELS[route.name]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

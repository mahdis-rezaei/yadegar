import { Pressable, ScrollView, View } from "react-native";
import { Text } from "../text";

// The Explore sub-nav: Library · Shelf · Collections · Capsules — the same shared
// bar the web shows across all four archive/keepsake views.
export type ExploreTab = "library" | "shelf" | "collections" | "capsules";

const TABS: { key: ExploreTab; label: string }[] = [
  { key: "library", label: "Library" },
  { key: "shelf", label: "Shelf" },
  { key: "collections", label: "Collections" },
  { key: "capsules", label: "Capsules" },
];

export function ExploreNav({
  tab,
  onChange,
}: {
  tab: ExploreTab;
  onChange: (t: ExploreTab) => void;
}) {
  return (
    <View className="border-b border-border/60">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, gap: 20 }}
      >
        {TABS.map((t) => {
          const sel = t.key === tab;
          return (
            <Pressable key={t.key} onPress={() => onChange(t.key)} className="py-3">
              <Text
                style={{ fontSize: 15 }}
                className={sel ? "text-ink" : "text-soft-ink"}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

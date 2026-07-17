import { View, Pressable } from "react-native";
import { Text } from "./text";
import { useRouter } from "expo-router";
import { longDate } from "../lib/extras";

// A compact page reference (date · title · excerpt) that opens the full entry.
// Shared by Calendar, Collections, Shelf, and Year in Pages.
export function EntryRefCard({
  entryId,
  title,
  excerpt,
  entryDate,
  favorite,
}: {
  entryId: string;
  title: string | null;
  excerpt: string;
  entryDate: string | null;
  favorite?: boolean;
}) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: "/(app)/entries/[id]", params: { id: entryId } })
      }
      className="rounded-3xl border border-border bg-surface p-5"
    >
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-sm text-soft-ink">{longDate(entryDate)}</Text>
        {favorite ? (
          <Text className="text-sm text-accent-sepia">Favorite</Text>
        ) : null}
      </View>
      {title ? (
        <Text className="mt-3 text-xl text-deep-brown">{title}</Text>
      ) : null}
      <Text className="mt-3 text-base leading-6 text-ink" numberOfLines={4}>
        {excerpt}
      </Text>
    </Pressable>
  );
}

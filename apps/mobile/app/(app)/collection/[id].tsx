import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { Text } from "../../../components/text";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getCollection, type CollectionDetail } from "../../../lib/extras";
import { EntryRefCard } from "../../../components/entry-ref-card";

// A single collection and its pages, chronological.
export default function CollectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<CollectionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setData(await getCollection(id));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: 14,
        paddingHorizontal: 24,
        paddingBottom: insets.bottom + 48,
      }}
    >
      {loading ? (
        <View className="min-h-80 items-center justify-center">
          <ActivityIndicator color="#3A2F25" />
        </View>
      ) : !data ? (
        <Text className="text-soft-ink">That collection couldn't be found.</Text>
      ) : (
        <>
          <Text className="text-4xl text-deep-brown">{data.name}</Text>
          <Text className="text-soft-ink mt-1">
            {data.items.length} {data.items.length === 1 ? "page" : "pages"}
          </Text>
          {data.items.length === 0 ? (
            <View className="mt-10 rounded-3xl border border-border bg-surface p-5">
              <Text className="text-soft-ink leading-relaxed">
                No pages here yet. Add pages from any page in your Library.
              </Text>
            </View>
          ) : (
            <View className="mt-8 gap-4">
              {data.items.map((i) => (
                <EntryRefCard key={i.entryId} {...i} />
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

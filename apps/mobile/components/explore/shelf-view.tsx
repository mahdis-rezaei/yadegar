import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { Text } from "../text";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getShelf, type ShelfItem } from "../../lib/extras";
import { EntryRefCard } from "../entry-ref-card";

// The Shelf: pages you've set aside to keep close (added from a page; this is the
// browse view). Used by the Explore tab and the standalone /shelf route.
export default function ShelfView() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ShelfItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      setItems(await getShelf());
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <ScrollView
      className="flex-1 bg-background"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void load({ refresh: true })}
        />
      }
      contentContainerStyle={{
        paddingTop: 16,
        paddingHorizontal: 24,
        paddingBottom: insets.bottom + 48,
      }}
    >
      <Text className="text-4xl text-deep-brown">Your shelf</Text>
      <Text className="text-soft-ink mt-1 leading-relaxed">
        A few pages you wanted close, the ones that feel alive right now.
        Favorites are everything that mattered; the shelf is what's near.
      </Text>

      {loading ? (
        <View className="min-h-80 items-center justify-center">
          <ActivityIndicator color="#3A2F25" />
        </View>
      ) : items.length === 0 ? (
        <View className="mt-10 rounded-3xl border border-border bg-surface p-5">
          <Text className="text-soft-ink leading-relaxed">
            Your shelf is empty. Add a page to the shelf from any page to keep it
            within reach.
          </Text>
        </View>
      ) : (
        <View className="mt-8 gap-4">
          {items.map((i) => (
            <EntryRefCard key={i.entryId} {...i} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

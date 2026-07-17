import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { Text } from "../../components/text";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { listMemories, updateMemory, type Memory } from "../../lib/memories";
import { MemoryCard } from "../../components/memory-card";

// Returns: the archive of pages the engine has brought back. They stay here to
// revisit (revisiting is always free). Star to keep, dismiss to retire. Mirrors
// the Library screen's load/refresh pattern.
export default function Returns() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const rows = await listMemories();
      setMemories(rows.filter((m) => !m.dismissed));
    } catch {
      setError("Could not load your returns. Please try again.");
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

  // Optimistic: update locally first, then persist (revert on failure).
  async function favorite(m: Memory) {
    const next = !m.favorite;
    setMemories((list) =>
      list.map((x) => (x.id === m.id ? { ...x, favorite: next } : x)),
    );
    try {
      await updateMemory(m.id, { favorite: next });
    } catch {
      setMemories((list) =>
        list.map((x) => (x.id === m.id ? { ...x, favorite: m.favorite } : x)),
      );
    }
  }

  async function dismiss(m: Memory) {
    setMemories((list) => list.filter((x) => x.id !== m.id));
    try {
      await updateMemory(m.id, { dismissed: true });
    } catch {
      void load(); // restore from server if it didn't take
    }
  }

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
        paddingTop: 14,
        paddingHorizontal: 24,
        paddingBottom: insets.bottom + 48,
      }}
    >
      <View>
        <Text className="text-4xl text-deep-brown">Returns</Text>
        <Text className="text-soft-ink mt-1 leading-relaxed">
          Pages Yadegar has brought back. They stay here for you to revisit.
        </Text>
        <Pressable
          onPress={() => router.push("/(app)/calendar")}
          className="mt-3 self-start"
          hitSlop={6}
        >
          <Text className="text-soft-ink" style={{ fontSize: 13 }}>
            Or look back through your own pages, by date and by the ones you
            treasured →
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="min-h-80 items-center justify-center">
          <ActivityIndicator color="#3A2F25" />
        </View>
      ) : error ? (
        <View className="mt-10 rounded-3xl border border-border bg-surface p-5">
          <Text className="text-ink">{error}</Text>
          <Pressable onPress={() => void load()} className="mt-4">
            <Text className="text-deep-brown">Try again</Text>
          </Pressable>
        </View>
      ) : memories.length === 0 ? (
        <View className="mt-10 rounded-3xl border border-border bg-surface p-6">
          <Text className="text-lg text-ink">Nothing has returned yet.</Text>
          <Text className="mt-2 text-soft-ink leading-relaxed">
            Write or bring in pages, and Yadegar will return something when there
            is something honest to return.
          </Text>
          <Pressable onPress={() => router.push("/(app)/today")} className="mt-5">
            <Text className="text-deep-brown">Go to Today</Text>
          </Pressable>
        </View>
      ) : (
        <View className="mt-8 gap-5">
          {memories.map((m) => (
            <MemoryCard
              key={m.id}
              memory={m}
              onFavorite={() => void favorite(m)}
              onDismiss={() => void dismiss(m)}
            />
          ))}
        </View>
      )}

      {!loading && !error ? (
        <Pressable
          onPress={() => router.push("/(app)/history")}
          className="mt-10 self-start"
          hitSlop={8}
        >
          <Text className="text-soft-ink" style={{ fontSize: 13 }}>
            See the full history, including retired pages →
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

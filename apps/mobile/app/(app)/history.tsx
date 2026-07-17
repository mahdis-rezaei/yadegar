import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { Text } from "../../components/text";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { listMemories, updateMemory, type Memory } from "../../lib/memories";
import { MemoryCard } from "../../components/memory-card";

// History: the FULL log of pages the engine has brought back — including the
// ones you've retired (Returns hides those). Active pages can be starred or
// retired; retired ones can be restored. Same data as Returns, nothing hidden.
export default function History() {
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
      setMemories(await listMemories());
    } catch {
      setError("Could not load your history. Please try again.");
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

  function patch(id: string, p: Partial<Memory>) {
    setMemories((list) => list.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }

  // Optimistic: update locally, persist, revert on failure.
  async function favorite(m: Memory) {
    const next = !m.favorite;
    patch(m.id, { favorite: next });
    try {
      await updateMemory(m.id, { favorite: next });
    } catch {
      patch(m.id, { favorite: m.favorite });
    }
  }
  async function setDismissed(m: Memory, dismissed: boolean) {
    patch(m.id, { dismissed });
    try {
      await updateMemory(m.id, { dismissed });
    } catch {
      patch(m.id, { dismissed: m.dismissed });
    }
  }

  const active = memories.filter((m) => !m.dismissed);
  const retired = memories.filter((m) => m.dismissed);

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
        <Text className="text-4xl text-deep-brown">History</Text>
        <Text className="text-soft-ink mt-1 leading-relaxed">
          Every page Yadegar has brought back — including the ones you've retired.
        </Text>
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
            As Yadegar brings pages back, the full log lives here.
          </Text>
        </View>
      ) : (
        <>
          <View className="mt-8 gap-5">
            {active.map((m) => (
              <MemoryCard
                key={m.id}
                memory={m}
                onFavorite={() => void favorite(m)}
                onDismiss={() => void setDismissed(m, true)}
              />
            ))}
          </View>

          {retired.length > 0 ? (
            <View className="mt-10">
              <Text className="text-xs uppercase tracking-widest text-faint-ink mb-3">
                Retired
              </Text>
              <View className="gap-5">
                {retired.map((m) => (
                  <View key={m.id}>
                    <View style={{ opacity: 0.6 }}>
                      <MemoryCard memory={m} />
                    </View>
                    <Pressable
                      onPress={() => void setDismissed(m, false)}
                      hitSlop={8}
                      className="self-start mt-2"
                    >
                      <Text className="text-deep-brown" style={{ fontSize: 13 }}>
                        Restore
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

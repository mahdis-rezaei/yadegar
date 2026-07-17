import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { Text } from "../../components/text";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getYearInPages, type YearInPages } from "../../lib/extras";

// Your Year in Pages — the year letter: a whole year of your writing gathered to
// read straight through. Mirrors the web /letters/:year (the data is the same;
// here it reads as a letter rather than a stats card).
function dateLabel(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d)
    .toLocaleDateString("en-US", { month: "long", day: "numeric" })
    .toUpperCase();
}

export default function Year() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ year?: string }>();
  const initialYear = Number(params.year);
  const [year, setYear] = useState(
    Number.isInteger(initialYear) && initialYear > 1900
      ? initialYear
      : new Date().getFullYear(),
  );
  const [data, setData] = useState<YearInPages | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (y: number) => {
    setLoading(true);
    try {
      setData(await getYearInPages(y));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(year);
    }, [load, year]),
  );

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: 14,
        paddingHorizontal: 24,
        paddingBottom: insets.bottom + 56,
      }}
    >
      <View className="flex-row items-center justify-between">
        <Pressable onPress={() => router.push("/(app)/look-back")} hitSlop={8}>
          <Text className="text-soft-ink" style={{ fontSize: 14 }}>← Look back</Text>
        </Pressable>
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => setYear((y) => y - 1)}
            className="rounded-full border border-border bg-surface px-3 py-1.5"
            hitSlop={6}
          >
            <Text className="text-soft-ink">‹</Text>
          </Pressable>
          <Text className="text-lg text-deep-brown">{year}</Text>
          <Pressable
            onPress={() => setYear((y) => y + 1)}
            className="rounded-full border border-border bg-surface px-3 py-1.5"
            hitSlop={6}
          >
            <Text className="text-soft-ink">›</Text>
          </Pressable>
        </View>
      </View>

      {/* Letter header. */}
      <View className="items-center mt-10">
        <Text className="text-xs uppercase tracking-widest text-faint-ink mb-2">
          Yadegar
        </Text>
        <Text className="text-2xl text-deep-brown">Your Year in Pages</Text>
        <Text className="text-deep-brown" style={{ fontSize: 64, lineHeight: 72 }}>
          {year}
        </Text>
      </View>

      {loading ? (
        <View className="min-h-60 items-center justify-center">
          <ActivityIndicator color="#3A2F25" />
        </View>
      ) : !data ? (
        <Text className="text-soft-ink mt-10 text-center">Couldn't load that year.</Text>
      ) : data.pageCount === 0 ? (
        <Text className="text-soft-ink mt-8 text-center leading-relaxed">
          No pages from {year} yet. As you write across the year, they gather here.
        </Text>
      ) : (
        <>
          <Text className="text-soft-ink mt-6 text-center leading-relaxed">
            This year you wrote {data.pageCount} {data.pageCount === 1 ? "page" : "pages"}.
            {data.favorites.length > 0 ? " These are a few that stayed." : ""}
          </Text>

          {data.favorites.length > 0 ? (
            <View className="mt-10">
              {data.favorites.map((f) => (
                <View key={f.entryId} className="mb-9">
                  <Text className="text-xs uppercase tracking-widest text-faint-ink mb-2">
                    {f.entryDate ? dateLabel(f.entryDate) : "Undated"}
                  </Text>
                  {f.title ? (
                    <Text className="text-xl text-deep-brown mb-2">{f.title}</Text>
                  ) : null}
                  <Text className="text-lg text-ink leading-relaxed" numberOfLines={8}>
                    {f.excerpt}
                  </Text>
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: "/(app)/entries/[id]", params: { id: f.entryId } })
                    }
                    className="mt-3 self-start"
                  >
                    <Text className="text-accent-sepia" style={{ fontSize: 13 }}>
                      Read the full page →
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <Text className="text-soft-ink mt-8 text-center leading-relaxed">
              Mark pages as favorite across the year and they'll gather here to
              read straight through.
            </Text>
          )}
        </>
      )}
    </ScrollView>
  );
}

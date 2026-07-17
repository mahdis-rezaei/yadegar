import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { Text } from "../../components/text";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMonthEntries, type CalendarEntry } from "../../lib/extras";
import { EntryRefCard } from "../../components/entry-ref-card";

// A month browser: step through months and read what you wrote. (A full grid
// calendar is a later refinement; this lists each month's pages, which is the
// useful core on a phone.)
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function Calendar() {
  const insets = useSafeAreaInsets();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      const rows = await getMonthEntries(y, m);
      setEntries(rows);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(year, month);
    }, [load, year, month]),
  );

  function step(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: 14,
        paddingHorizontal: 24,
        paddingBottom: insets.bottom + 48,
      }}
    >
      <Text className="text-4xl text-deep-brown">Calendar</Text>

      <View className="mt-6 flex-row items-center justify-between">
        <Pressable
          onPress={() => step(-1)}
          className="rounded-full border border-border bg-surface px-4 py-2"
        >
          <Text className="text-soft-ink">‹</Text>
        </Pressable>
        <Text className="text-lg text-deep-brown">
          {MONTHS[month - 1]} {year}
        </Text>
        <Pressable
          onPress={() => step(1)}
          className="rounded-full border border-border bg-surface px-4 py-2"
        >
          <Text className="text-soft-ink">›</Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="min-h-80 items-center justify-center">
          <ActivityIndicator color="#3A2F25" />
        </View>
      ) : entries.length === 0 ? (
        <View className="mt-10 rounded-3xl border border-border bg-surface p-5">
          <Text className="text-soft-ink leading-relaxed">
            Nothing written this month.
          </Text>
        </View>
      ) : (
        <View className="mt-8 gap-4">
          {entries.map((e) => (
            <EntryRefCard
              key={e.id}
              entryId={e.id}
              title={e.title ?? null}
              excerpt={e.body.replace(/\s+/g, " ").trim().slice(0, 140)}
              entryDate={e.entryDate}
              favorite={e.favorite}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

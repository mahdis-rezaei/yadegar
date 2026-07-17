import { useState } from "react";
import { View, Pressable } from "react-native";
import { Text } from "./text";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getOnThisDayFramed, onThisDayLabel, localTodayISO } from "../lib/memories";
import { DateMemoryCard } from "./date-memory-card";
import { MemoryCard } from "./memory-card";

// On This Day on Today. Pulls the EXACT calendar day from prior years and leads
// with the most recent one VOICED by the engine (a lens heading + observation),
// as the web does — falling back to the raw page if framing is unavailable. Stays
// SILENT (renders nothing) when there's nothing from this day. A ladder steps
// through each year; the fuller browse lives on Look back.
export function OnThisDay() {
  const router = useRouter();
  const [showYears, setShowYears] = useState(false);
  const date = localTodayISO();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["on-this-day-framed", date],
    queryFn: () => getOnThisDayFramed(date),
    staleTime: 60 * 60 * 1000,
  });

  const years = data?.years ?? [];
  if (isLoading || years.length === 0) return null;

  return (
    <View className="mt-10">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-2xl text-deep-brown">On this day</Text>
        <Pressable onPress={() => router.push("/(app)/look-back")} hitSlop={8}>
          <Text className="text-soft-ink" style={{ fontSize: 13 }}>Look back →</Text>
        </Pressable>
      </View>

      {data?.framed ? (
        <MemoryCard memory={data.framed} />
      ) : (
        <DateMemoryCard
          heading={onThisDayLabel(years[0])}
          memory={years[0]}
          onChanged={() => void refetch()}
        />
      )}

      {years.length > 1 && (
        <View className="mt-4">
          <Pressable onPress={() => setShowYears((v) => !v)} hitSlop={8}>
            <Text className="text-soft-ink">
              {showYears ? "Hide other years" : `See each year (${years.length})`}
            </Text>
          </Pressable>
          {showYears && (
            <View className="mt-4 gap-4">
              {years.slice(1).map((m) => (
                <DateMemoryCard
                  key={m.entryId}
                  heading={onThisDayLabel(m)}
                  memory={m}
                  onChanged={() => void refetch()}
                />
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

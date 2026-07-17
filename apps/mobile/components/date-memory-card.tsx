import { useState } from "react";
import { View, Pressable } from "react-native";
import { Text } from "./text";
import { useRouter } from "expo-router";
import { api } from "../lib/api";
import { updateEntryResurfacing } from "../lib/settings";
import type { DateMemory } from "../lib/memories";

function longDate(d: string): string {
  const parsed = new Date(d + "T00:00:00");
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// A date-based resurfaced page (On This Day / Look Back). Mirrors the web: the
// card reads in place (only "Read the full page →" navigates — tapping the text
// never jumps you away), with a ★ favorite and a "not this one" that stops this
// page resurfacing. `onChanged` lets the parent refetch after a change.
export function DateMemoryCard({
  heading,
  memory,
  onChanged,
}: {
  heading: string;
  memory: DateMemory;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [fav, setFav] = useState(!!memory.favorite);

  function toggleFavorite() {
    const next = !fav;
    setFav(next);
    api(`/entries/${memory.entryId}`, { method: "PATCH", body: { favorite: next } })
      .then(() => onChanged?.())
      .catch(() => setFav(!next));
  }

  function hide() {
    void updateEntryResurfacing(memory.entryId, "never")
      .then(() => onChanged?.())
      .catch(() => {});
  }

  return (
    <View className="rounded-3xl border border-border bg-surface p-5">
      <View className="flex-row items-start justify-between gap-3 mb-2">
        <Text className="flex-1 text-xs uppercase tracking-widest text-faint-ink">
          {heading}
        </Text>
        <View className="flex-row items-center gap-3">
          <Pressable onPress={toggleFavorite} hitSlop={6}>
            <Text className={fav ? "text-accent-sepia text-lg" : "text-faint-ink text-lg"}>
              {fav ? "★" : "☆"}
            </Text>
          </Pressable>
          <Pressable onPress={hide} hitSlop={6}>
            <Text className="text-faint-ink text-xs">not this one</Text>
          </Pressable>
        </View>
      </View>

      <Text className="text-xs text-faint-ink mb-3">{longDate(memory.entryDate)}</Text>

      {memory.title ? (
        <Text className="text-lg text-deep-brown mb-2">{memory.title}</Text>
      ) : null}

      <Text className="text-ink leading-relaxed">{memory.excerpt}</Text>

      <Pressable
        onPress={() =>
          router.push({ pathname: "/(app)/entries/[id]", params: { id: memory.entryId } })
        }
        className="mt-5 self-start"
      >
        <Text className="text-accent-sepia" style={{ fontSize: 13 }}>
          Read the full page →
        </Text>
      </Pressable>
    </View>
  );
}

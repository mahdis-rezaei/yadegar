import { View, Pressable } from "react-native";
import { Text } from "./text";
import { useRouter } from "expo-router";
import { LENS_LABELS, type Memory } from "../lib/memories";

function longDate(d?: string | null): string | null {
  if (!d) return null;
  const parsed = new Date(`${d.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// A returned page, rendered as a card. The lens becomes a plain heading, the
// writer's own quote is the payoff (80/20 — the quote carries it), the
// observation points at it. Mirrors the web MemoryCard. Optional star/dismiss
// (used by the Returns archive later); hidden on the just-now Today result.
export function MemoryCard({
  memory,
  onFavorite,
  onDismiss,
}: {
  memory: Memory;
  onFavorite?: () => void;
  onDismiss?: () => void;
}) {
  const router = useRouter();
  const heading = LENS_LABELS[memory.lens ?? ""] ?? "A page worth returning to";
  const date = longDate(memory.quoteDate);

  return (
    <View className="rounded-3xl border border-border bg-surface p-6">
      <View className="flex-row items-start justify-between gap-4 mb-4">
        <Text className="flex-1 text-xs uppercase tracking-widest text-faint-ink">
          {heading}
        </Text>
        {(onFavorite || onDismiss) && (
          <View className="flex-row items-center gap-4">
            {onFavorite && (
              <Pressable onPress={onFavorite} hitSlop={8}>
                <Text
                  className={
                    "text-lg " +
                    (memory.favorite ? "text-accent-sepia" : "text-faint-ink")
                  }
                >
                  {memory.favorite ? "★" : "☆"}
                </Text>
              </Pressable>
            )}
            {onDismiss && (
              <Pressable onPress={onDismiss} hitSlop={8}>
                <Text className="text-xs text-faint-ink">dismiss</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      {date && <Text className="text-xs text-faint-ink mb-3">{date}</Text>}

      {!!memory.quote && (
        <Text className="text-xl italic text-deep-brown leading-snug mb-4">
          “{memory.quote}”
        </Text>
      )}

      {!!memory.observation && (
        <Text className="text-soft-ink leading-relaxed">{memory.observation}</Text>
      )}

      {!!memory.journalEntryId && (
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/(app)/entries/[id]",
              params: { id: memory.journalEntryId! },
            })
          }
          className="self-start mt-5 border-b border-accent-sepia/40"
        >
          <Text className="text-sm text-accent-sepia">Read the full page →</Text>
        </Pressable>
      )}
    </View>
  );
}

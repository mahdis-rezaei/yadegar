import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "./text";
import { useAuth } from "../lib/auth";
import { type MemoryRunResult } from "../lib/memories";
import { MemoryCard } from "./memory-card";

// Shared engine-read UI for Today + Look back: a button-to-surface read with
// calm, time-aware reassurance while it reads, then the voiced page — or honest
// silence when nothing real surfaces (the engine is better quiet than false).

export function silenceMessage(r: MemoryRunResult): string {
  if (r.reason === "crisis" && r.supportMessage) return r.supportMessage;
  if (r.reason === "quota")
    return "You've used this month's returns. Revisiting what's already returned to you is always free.";
  if (r.reason === "not_enough")
    return "Write or bring in a few more pages first, and Yadegar will have something to return.";
  if (r.reason === "error")
    return "Something interrupted the reading. Try again in a moment.";
  return "Nothing honest surfaced this time. That's okay — Yadegar is better quiet than false.";
}

export function useRun() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<MemoryRunResult | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!pending) {
      setElapsed(0);
      return;
    }
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [pending]);

  const run = useCallback(async (fn: () => Promise<MemoryRunResult>) => {
    setResult(null);
    setPending(true);
    try {
      setResult(await fn());
    } catch {
      setResult({ surfaced: false, reason: "error" });
    } finally {
      setPending(false);
    }
  }, []);

  const reset = useCallback(() => setResult(null), []);

  return { pending, result, elapsed, run, reset };
}

export function RunResult({
  pending,
  elapsed,
  result,
}: {
  pending: boolean;
  elapsed: number;
  result: MemoryRunResult | null;
}) {
  if (pending) {
    return (
      <View className="mt-4 rounded-3xl border border-border bg-surface p-5">
        <Text className="text-soft-ink leading-relaxed">
          {elapsed < 10
            ? "Reading across your years…"
            : elapsed < 35
              ? "Still reading, looking for what keeps coming back…"
              : elapsed < 90
                ? "Your archive is large, so this takes a moment. Hang tight, Yadegar is still reading."
                : "Almost there — a long archive takes a little longer to read."}
        </Text>
      </View>
    );
  }
  if (!result) return null;
  if (result.surfaced && result.memory) {
    return (
      <View className="mt-4">
        <MemoryCard memory={result.memory} />
      </View>
    );
  }
  return (
    <View className="mt-4 rounded-3xl border border-border bg-surface p-5">
      <Text className="text-soft-ink leading-relaxed">{silenceMessage(result)}</Text>
      {result.reason === "quota" ? <QuotaUpgradeCta /> : null}
    </View>
  );
}

// Shown only when a free user hit their monthly returns — the highest-intent
// moment to offer membership. Hidden for members (a member who hit the internal
// fair-use ceiling shouldn't be sold what they already have).
function QuotaUpgradeCta() {
  const router = useRouter();
  const { isMember } = useAuth();
  if (isMember) return null;
  return (
    <Pressable
      onPress={() => router.push("/(app)/membership")}
      className="mt-4 rounded-full bg-deep-brown px-5 py-3 items-center"
    >
      <Text className="text-background">Become a member</Text>
    </Pressable>
  );
}

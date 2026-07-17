import { useEffect, useState } from "react";
import { type MemoryRunResult } from "@workspace/api-client-react";
import { runMemoryRequest } from "@/lib/run-job";
import { MemoryCard } from "@/components/memory-card";

// "What keeps returning", the pattern lens: the engine roams your whole archive
// for a thread / line that keeps coming back across your years. Button-to-surface
// (so it never writes silently on every visit), then the voiced result. On a deep
// archive the engine leans toward a cross-time thread; on a thinner one it finds
// the line that keeps mattering.
//
// Caching: the first read uses the cached run (instant once the engine's extract/
// score caches are warm, a cold run over a big archive is a ~2-pass model read
// that can take a couple of minutes). Re-rolls ("look again" / "show another")
// pass `fresh` to bypass the run cache so they actually vary instead of handing
// back the identical cached pick.
export function WhatKeepsReturning() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<MemoryRunResult | null>(null);

  // A cold run is a two-pass model read across the whole archive and can take a
  // couple of minutes. Without feedback that wait reads as "broken," so we show
  // calm, time-aware reassurance (no raw stopwatch, that makes it feel anxious).
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!pending) {
      setElapsed(0);
      return;
    }
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [pending]);

  async function run(fresh: boolean) {
    setResult(null);
    setPending(true);
    try {
      setResult(
        await runMemoryRequest("/api/memories/run", fresh ? { fresh: true } : {}),
      );
    } catch {
      setResult({ surfaced: false, reason: "error" });
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      {!pending && !result && (
        <button
          onClick={() => run(false)}
          className="font-sans text-sm text-soft-ink hover:text-ink border border-border hover:border-accent-sepia rounded-full px-4 py-2 transition-colors"
          data-testid="wkr-go"
        >
          ✦ Show me what keeps returning
        </button>
      )}

      {pending && (
        <div className="border border-border/70 rounded-2xl bg-surface/50 p-6">
          <p className="font-body text-soft-ink leading-relaxed">
            {elapsed < 10
              ? "Reading across your years…"
              : elapsed < 35
                ? "Still reading, looking for what keeps coming back…"
                : elapsed < 90
                  ? "Your archive is large, so this takes a moment. Hang tight, Yadegar is still reading."
                  : "Almost there, a long archive takes a little longer to read."}
          </p>
        </div>
      )}

      {!pending && result?.surfaced && result.memory && (
        <div>
          <MemoryCard memory={result.memory} />
          <button
            onClick={() => run(true)}
            className="mt-3 font-sans text-xs text-faint-ink hover:text-soft-ink transition-colors"
            data-testid="wkr-again"
          >
            show another →
          </button>
        </div>
      )}

      {!pending && result && !result.surfaced && result.reason === "error" && (
        <div>
          <p className="font-body text-soft-ink leading-relaxed">
            Couldn't read across your years just now.
          </p>
          <button
            onClick={() => run(true)}
            className="mt-2 font-sans text-xs text-faint-ink hover:text-soft-ink transition-colors"
            data-testid="wkr-retry"
          >
            try again →
          </button>
        </div>
      )}

      {!pending && result && !result.surfaced && result.reason !== "error" && (
        <div>
          <p className="font-body text-soft-ink leading-relaxed">
            Nothing clear keeps returning just yet, as your pages gather years,
            the threads will show.
          </p>
          <button
            onClick={() => run(true)}
            className="mt-2 font-sans text-xs text-faint-ink hover:text-soft-ink transition-colors"
            data-testid="wkr-again-silent"
          >
            look again →
          </button>
        </div>
      )}
    </div>
  );
}

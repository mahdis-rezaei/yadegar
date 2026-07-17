import { useEffect, useState } from "react";
import { type MemoryRunResult } from "@workspace/api-client-react";
import { runMemoryRequest } from "@/lib/run-job";
import { localTodayISO } from "@/lib/use-on-this-day";
import { MemoryCard } from "@/components/memory-card";

// "This time of year", the voiced nostalgia for Look Back: the engine reads your
// pages from around now (this day ±3 and this month) across prior years and
// frames one. The wider-window companion to Today's strict exact-day surface; a
// thread/arc is welcome here. Auto-runs on open (reads in the background, then
// the voiced card appears); stays silent when there's nothing from this season.
export function ThisTimeOfYear() {
  const [pending, setPending] = useState(true);
  const [result, setResult] = useState<MemoryRunResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await runMemoryRequest("/api/memories/this-time-of-year", {
          date: localTodayISO(),
        });
        if (!cancelled) setResult(r);
      } catch {
        if (!cancelled) setResult({ surfaced: false, reason: "error" });
      } finally {
        if (!cancelled) setPending(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Silent when nothing honest surfaces from around this time of year.
  if (!pending && !(result && result.surfaced)) return null;

  return (
    <section className="mb-10">
      <h2 className="font-display text-2xl text-deep-brown mb-3">
        This time of year
      </h2>
      {pending ? (
        <div className="border border-border/70 rounded-2xl bg-surface/50 p-6">
          <p className="font-body text-soft-ink leading-relaxed">
            Reading around this time of year…
          </p>
        </div>
      ) : result?.surfaced && result.memory ? (
        <MemoryCard memory={result.memory} />
      ) : null}
    </section>
  );
}

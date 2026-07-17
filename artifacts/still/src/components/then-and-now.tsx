import { useMemo, useState } from "react";
import {
  useListEntries,
  type MemoryRunResult,
} from "@workspace/api-client-react";
import { runMemoryRequest } from "@/lib/run-job";
import { MemoryCard } from "@/components/memory-card";

// "How far you've come" (Then & now). You pick a PAST year; the engine reads that
// window together with your recent pages and surfaces the distance between then
// and now, the distance/arc mode, steered by you. It's a scoped engine run, so
// it rides the same async queue + reading state as Bring a page back. Stays quiet
// when the window is thin or nothing honest surfaces.
export function ThenAndNow() {
  const { data: entries } = useListEntries();

  const years = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries ?? []) {
      const y = e.entryDate?.slice(0, 4);
      if (y) set.add(y);
    }
    // Then↔now wants a PAST window, so drop the current year.
    const current = String(new Date().getFullYear());
    return [...set].filter((y) => y !== current).sort().reverse();
  }, [entries]);

  const [year, setYear] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<MemoryRunResult | null>(null);

  // Need at least one past year to compare against.
  if (years.length === 0) return null;

  async function go() {
    if (!year) return;
    setResult(null);
    setPending(true);
    try {
      setResult(
        await runMemoryRequest("/api/memories/then-and-now", {
          year: Number(year),
        }),
      );
    } catch {
      setResult({ surfaced: false, reason: "error" });
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          disabled={pending}
          className="font-sans text-sm text-soft-ink bg-surface/60 border border-border rounded-full px-4 py-2 focus:outline-none focus:border-accent-sepia disabled:opacity-50"
          data-testid="select-then-year"
        >
          <option value="">Choose a year…</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <button
          onClick={go}
          disabled={!year || pending}
          className="font-sans text-sm text-soft-ink hover:text-ink border border-border hover:border-accent-sepia rounded-full px-4 py-2 transition-colors disabled:opacity-50"
          data-testid="button-then-and-now"
        >
          {pending ? "reading…" : "Show me"}
        </button>
      </div>

      {pending && (
        <div className="border border-border/70 rounded-2xl bg-surface/50 p-6 mt-3">
          <p className="font-body text-soft-ink leading-relaxed">
            Reading across the years…
          </p>
        </div>
      )}

      {result && !pending && (
        <div className="mt-3">
          {result.surfaced && result.memory ? (
            <MemoryCard memory={result.memory} />
          ) : (
            <div className="border border-border/70 rounded-2xl bg-surface/50 p-6">
              <p className="font-body text-soft-ink leading-relaxed">
                {result.reason === "not_enough"
                  ? "Not enough from that year yet to draw the line."
                  : "Nothing honest surfaced between then and now, and that's okay."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

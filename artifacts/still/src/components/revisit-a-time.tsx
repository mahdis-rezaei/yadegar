import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  useListEntries,
  customFetch,
  type Entry,
  type MemoryRunResult,
} from "@workspace/api-client-react";
import { runMemoryRequest } from "@/lib/run-job";
import { MemoryCard } from "@/components/memory-card";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function snippet(body: string): string {
  const s = body.trim().replace(/\s+/g, " ");
  return s.length > 160 ? s.slice(0, 160) + "…" : s;
}

// "Revisit a time", you pick a month and year; the engine surfaces the one line
// worth returning to from it (voice first), then the period's pages are listed
// below to read. Directed time-travel with the AI as your guide.
export function RevisitATime() {
  const { data: entries } = useListEntries();
  const years = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries ?? []) {
      const y = e.entryDate?.slice(0, 4);
      if (y) set.add(y);
    }
    return [...set].sort().reverse();
  }, [entries]);

  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [pending, setPending] = useState(false);
  const [voice, setVoice] = useState<MemoryRunResult | null>(null);
  const [pages, setPages] = useState<Entry[] | null>(null);

  if (years.length === 0) {
    return (
      <p className="font-body text-soft-ink leading-relaxed">
        Once you have a few months of pages, you can revisit any of them here.
      </p>
    );
  }

  async function go() {
    if (!year || !month) return;
    setVoice(null);
    setPages(null);
    setPending(true);
    try {
      const [v, p] = await Promise.all([
        runMemoryRequest("/api/memories/revisit", {
          year: Number(year),
          month: Number(month),
        }),
        customFetch<Entry[]>(`/api/entries?year=${year}&month=${month}`, {
          responseType: "json",
        }),
      ]);
      setVoice(v);
      setPages(p);
    } catch {
      setVoice({ surfaced: false, reason: "error" });
    } finally {
      setPending(false);
    }
  }

  const selectClass =
    "font-sans text-sm text-soft-ink bg-surface/60 border border-border rounded-full px-4 py-2 focus:outline-none focus:border-accent-sepia disabled:opacity-50";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          disabled={pending}
          className={selectClass}
          data-testid="revisit-month"
        >
          <option value="">Month…</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          disabled={pending}
          className={selectClass}
          data-testid="revisit-year"
        >
          <option value="">Year…</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <button
          onClick={go}
          disabled={!year || !month || pending}
          className="font-sans text-sm text-soft-ink hover:text-ink border border-border hover:border-accent-sepia rounded-full px-4 py-2 transition-colors disabled:opacity-50"
          data-testid="revisit-go"
        >
          {pending ? "reading…" : "Show me"}
        </button>
      </div>

      {pending && (
        <div className="border border-border/70 rounded-2xl bg-surface/50 p-6 mt-3">
          <p className="font-body text-soft-ink leading-relaxed">
            Reading that month…
          </p>
        </div>
      )}

      {!pending && voice?.surfaced && voice.memory && (
        <div className="mt-3">
          <MemoryCard memory={voice.memory} />
        </div>
      )}

      {!pending && pages && pages.length > 0 && (
        <div className="mt-8">
          <h3 className="font-display text-lg text-deep-brown mb-3">
            {pages.length} {pages.length === 1 ? "page" : "pages"} from{" "}
            {month ? MONTHS[Number(month) - 1] : ""} {year}
          </h3>
          <div className="space-y-4">
            {pages.map((e) => (
              <Link
                key={e.id}
                href={`/library/${e.id}`}
                className="block border-b border-border/40 pb-3 hover:opacity-80 transition-opacity"
              >
                <p className="font-sans text-xs text-faint-ink mb-1">
                  {e.entryDate}
                </p>
                <p className="font-body text-soft-ink leading-relaxed">
                  {snippet(e.body)}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {!pending && pages && pages.length === 0 && (
        <p className="font-body text-soft-ink leading-relaxed mt-3">
          No pages from that month, try another.
        </p>
      )}
    </div>
  );
}

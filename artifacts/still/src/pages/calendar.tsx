import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useListEntries, type Entry } from "@workspace/api-client-react";
import { AppNav } from "@/components/app-nav";
import { PageHeader } from "@/components/page";
import { LibraryViews } from "@/components/library-views";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function preview(e: Entry): string {
  if (e.title && e.title.trim()) return e.title.trim();
  const line = (e.body ?? "").trim().split(/\n+/)[0] ?? "";
  if (!line) return "(an untitled page)";
  return line.length > 110 ? line.slice(0, 109).trimEnd() + "…" : line;
}

function dayNum(d: string): string {
  const n = Number(d.slice(8, 10));
  return Number.isFinite(n) ? String(n) : "";
}

export default function Calendar() {
  const { data, isLoading } = useListEntries();
  const [month, setMonth] = useState(new Date().getMonth() + 1); // 1–12

  // Per-month counts (across all years) + the entries for the selected month
  // grouped by year (recent year first).
  const { counts, byYear } = useMemo(() => {
    const entries = ((data ?? []) as Entry[]).filter((e) => e.entryDate);
    const counts = new Array(13).fill(0) as number[]; // 1-indexed
    for (const e of entries) {
      counts[Number((e.entryDate as string).slice(5, 7))]++;
    }
    const inMonth = entries.filter(
      (e) => Number((e.entryDate as string).slice(5, 7)) === month,
    );
    const map = new Map<number, Entry[]>();
    for (const e of inMonth) {
      const y = Number((e.entryDate as string).slice(0, 4));
      const list = map.get(y) ?? [];
      list.push(e);
      map.set(y, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => ((a.entryDate ?? "") < (b.entryDate ?? "") ? -1 : 1));
    }
    const byYear = [...map.entries()].sort((a, b) => b[0] - a[0]);
    return { counts, byYear };
  }, [data, month]);

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AppNav />
      <main className="flex-1 w-full max-w-[720px] mx-auto px-6 py-12 md:py-16">
        <PageHeader
          title="Calendar"
          subtitle="Your pages by the turning of the year. Tap a month to see it across all the years you've written."
        />
        <LibraryViews current="calendar" />

        {/* Month grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-12">
          {MONTHS.map((name, i) => {
            const m = i + 1;
            const count = counts[m] ?? 0;
            const selected = m === month;
            return (
              <button
                key={name}
                onClick={() => setMonth(m)}
                className={
                  "rounded-xl border px-3 py-3 text-left transition-colors " +
                  (selected
                    ? "border-accent-sepia bg-surface"
                    : "border-border hover:border-accent-sepia/60 bg-surface/40")
                }
              >
                <span
                  className={
                    "font-display text-base " +
                    (count > 0 ? "text-deep-brown" : "text-faint-ink")
                  }
                >
                  {name}
                </span>
                <span className="block font-sans text-xs text-faint-ink mt-0.5">
                  {count > 0 ? `${count} ${count === 1 ? "page" : "pages"}` : "—"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected month, across the years */}
        <h2 className="font-display text-2xl text-deep-brown mb-5">
          {MONTHS[month - 1]}
        </h2>

        {isLoading ? (
          <p className="font-sans text-sm text-faint-ink">Gathering…</p>
        ) : byYear.length === 0 ? (
          <p className="font-body text-soft-ink">
            No pages from {MONTHS[month - 1]} yet.
          </p>
        ) : (
          <div className="space-y-10">
            {byYear.map(([year, items]) => (
              <section key={year}>
                <p className="font-sans text-xs uppercase tracking-[0.18em] text-faint-ink mb-4">
                  {MONTHS[month - 1]} {year}
                </p>
                <ul className="space-y-4">
                  {items.map((e) => (
                    <li key={e.id} className="flex gap-4">
                      <span className="font-display text-lg text-accent-sepia w-7 shrink-0 text-right">
                        {dayNum(e.entryDate as string)}
                      </span>
                      <Link
                        href={`/library/${e.id}`}
                        className="group block flex-1 border-b border-border/50 pb-4"
                      >
                        <p className="font-body text-ink group-hover:text-deep-brown transition-colors leading-relaxed">
                          {preview(e)}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

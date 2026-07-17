import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useListEntries } from "@workspace/api-client-react";

// "Your Year in Pages", a whole year of writing, gathered into something to read,
// print, or keep as a book. The year is PICKED from the years you've actually
// written (defaulting to your most recent one), rather than a hardcoded "last
// year" that left people wondering why a particular year showed up.
export function YearInPagesTab() {
  const { data: entries } = useListEntries();

  const years = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries ?? []) {
      const y = e.entryDate?.slice(0, 4);
      if (y) set.add(y);
    }
    return [...set].sort().reverse();
  }, [entries]);

  const [picked, setPicked] = useState("");
  // Default to the most recent year that ISN'T in the future, so a stray
  // future-dated entry can't hijack the default (it's still selectable below).
  const currentYear = new Date().getFullYear();
  const defaultYear =
    years.find((y) => Number(y) <= currentYear) ??
    years[0] ??
    String(currentYear);
  const year = picked || defaultYear;

  if (years.length === 0) {
    return (
      <p className="font-body text-soft-ink leading-relaxed">
        Once you've written across a year, you can gather it into a book here.
      </p>
    );
  }

  return (
    <div>
      {years.length > 1 && (
        <div className="flex items-center gap-3 mb-5">
          <span className="font-sans text-sm text-faint-ink">Year</span>
          <select
            value={year}
            onChange={(e) => setPicked(e.target.value)}
            className="font-sans text-sm text-soft-ink bg-surface/60 border border-border rounded-full px-4 py-2 focus:outline-none focus:border-accent-sepia"
            data-testid="year-in-pages-select"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      )}

      <Link
        href={`/letters/${year}`}
        className="block rounded-2xl border border-border bg-surface/60 px-6 py-5 hover:border-accent-sepia transition-colors"
        data-testid="card-year-in-pages"
      >
        <p className="font-display text-3xl text-deep-brown">{year} →</p>
        <p className="font-sans text-sm text-soft-ink mt-1">
          Open this year as a single, readable letter, then print it or make a
          book.
        </p>
      </Link>
    </div>
  );
}

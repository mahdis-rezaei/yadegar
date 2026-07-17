import { useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { useListEntries, type Entry } from "@workspace/api-client-react";
import { AppNav } from "@/components/app-nav";
import { PageHeader } from "@/components/page";

// Search is CLIENT-SIDE on purpose: entry bodies are encrypted at rest, so the
// server can't search them, which keeps your words private. We match in the
// browser over the archive we already load.

const SOURCE_FILTERS: { value: string; label: string; test: (e: Entry) => boolean }[] = [
  { value: "all", label: "All", test: () => true },
  { value: "written", label: "Written here", test: (e) => e.source === "manual" },
  {
    value: "imported",
    label: "Imported",
    test: (e) =>
      e.source === "pasted_import" ||
      e.source === "file_import" ||
      e.source === "google_doc",
  },
];

function longDate(d: string): string {
  const parsed = new Date(d + "T00:00:00");
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Everything a query can match against: words, names, places, and the date,
// long-form ("June", "2016") and ISO.
function haystack(e: Entry): string {
  const parts = [e.title ?? "", e.body ?? "", e.entryDate ?? ""];
  if (e.entryDate) parts.push(longDate(e.entryDate));
  return parts.join(" ").toLowerCase();
}

function Snippet({ text, q }: { text: string; q: string }) {
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) {
    const line = text.trim().split(/\n+/)[0] ?? "";
    return <>{line.length > 140 ? line.slice(0, 139).trimEnd() + "…" : line}</>;
  }
  const start = Math.max(0, idx - 60);
  const end = Math.min(text.length, idx + q.length + 90);
  return (
    <>
      {start > 0 && "…"}
      {text.slice(start, idx)}
      <mark className="bg-accent-sepia/25 text-deep-brown rounded px-0.5">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length, end)}
      {end < text.length && "…"}
    </>
  );
}

export default function Search() {
  const initial = new URLSearchParams(useSearch()).get("q") ?? "";
  const [query, setQuery] = useState(initial);
  const [favOnly, setFavOnly] = useState(false);
  const [source, setSource] = useState("all");
  const { data, isLoading } = useListEntries();

  const q = query.trim();

  // Matches grouped by year, most recent year first; undated last.
  const { groups, total } = useMemo(() => {
    if (!q) return { groups: [] as [string, Entry[]][], total: 0 };
    const test = SOURCE_FILTERS.find((s) => s.value === source)?.test ?? (() => true);
    const lower = q.toLowerCase();
    const matches = ((data ?? []) as Entry[]).filter(
      (e) => (!favOnly || e.favorite) && test(e) && haystack(e).includes(lower),
    );

    const byYear = new Map<string, Entry[]>();
    for (const e of matches) {
      const key = e.entryDate ? e.entryDate.slice(0, 4) : "Undated";
      const list = byYear.get(key) ?? [];
      list.push(e);
      byYear.set(key, list);
    }
    // Sort each year's pages newest-first; year keys descending, Undated last.
    for (const list of byYear.values()) {
      list.sort((a, b) => (a.entryDate ?? "") < (b.entryDate ?? "") ? 1 : -1);
    }
    const groups = [...byYear.entries()].sort((a, b) => {
      if (a[0] === "Undated") return 1;
      if (b[0] === "Undated") return -1;
      return Number(b[0]) - Number(a[0]);
    });
    return { groups, total: matches.length };
  }, [data, q, favOnly, source]);

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AppNav />
      <main className="flex-1 w-full max-w-[720px] mx-auto px-6 py-12 md:py-16">
        <PageHeader
          title="Search your life"
          subtitle="A word, a name, a place, a year. Your pages stay private, this searches them right here in your browser."
        />

        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <input
            type="search"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Mom · London · home · 2016 · hope…"
            className="flex-1 bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-ink font-sans placeholder:text-faint-ink focus:outline-none focus:border-accent-sepia transition-colors"
          />
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-soft-ink font-sans focus:outline-none focus:border-accent-sepia"
          >
            {SOURCE_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setFavOnly((v) => !v)}
            className={
              "rounded-lg border px-4 py-2.5 font-sans text-sm transition-colors " +
              (favOnly
                ? "border-accent-sepia text-ink bg-surface"
                : "border-border text-soft-ink hover:text-ink")
            }
          >
            ★ Favorites
          </button>
        </div>

        {!q ? (
          <p className="font-body text-soft-ink">
            Start typing to search across every page you've kept.
          </p>
        ) : isLoading ? (
          <p className="font-sans text-sm text-faint-ink">Searching…</p>
        ) : total === 0 ? (
          <p className="font-body text-soft-ink">
            No pages matched “{q}”. Try another word.
          </p>
        ) : (
          <>
            <p className="font-sans text-xs text-faint-ink mb-8">
              {total} {total === 1 ? "page" : "pages"}
            </p>
            <div className="space-y-10">
              {groups.map(([year, items]) => (
                <section key={year}>
                  <h2 className="font-display text-2xl text-deep-brown mb-1">
                    {year}
                  </h2>
                  <p className="font-sans text-xs text-faint-ink mb-4">
                    {items.length} {items.length === 1 ? "page" : "pages"}
                  </p>
                  <ul className="space-y-5">
                    {items.map((e) => (
                      <li key={e.id}>
                        <Link href={`/library/${e.id}`} className="group block">
                          <span className="font-sans text-xs text-faint-ink">
                            {e.entryDate ? longDate(e.entryDate) : "Undated"}
                          </span>
                          {e.title && e.title.trim() && (
                            <p className="font-body text-ink font-medium">
                              <Snippet text={e.title} q={q} />
                            </p>
                          )}
                          <p className="font-body text-soft-ink leading-relaxed group-hover:text-ink transition-colors">
                            <Snippet text={e.body ?? ""} q={q} />
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

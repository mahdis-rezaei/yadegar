import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListEntries,
  useUpdateEntry,
  useClearSampleEntries,
  useBulkDeleteEntries,
  getListEntriesQueryKey,
  type Entry,
} from "@workspace/api-client-react";
import { AppNav } from "@/components/app-nav";
import { PageHeader } from "@/components/page";
import { ContinuityCard } from "@/components/continuity";
import { LibraryViews } from "@/components/library-views";

const SOURCE_LABELS: Record<string, string> = {
  pasted_import: "imported",
  file_import: "imported",
  google_doc: "google doc",
  sample: "sample",
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Group the raw entry sources into the three kinds a person actually thinks in.
type SourceKind = "written" | "imported" | "sample";
function sourceKind(source: string): SourceKind {
  if (source === "sample") return "sample";
  if (source === "manual") return "written";
  return "imported";
}

function firstLines(body: string, max = 2): string {
  return body
    .trim()
    .split("\n")
    .filter((l) => l.trim())
    .slice(0, max)
    .join(" ");
}

export default function Library() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useListEntries();
  const updateEntry = useUpdateEntry();
  const clearSamples = useClearSampleEntries();

  const [query, setQuery] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [yearFilter, setYearFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | SourceKind>("all");

  const all = data ?? [];

  // The years and source kinds actually present, so we never offer an empty filter.
  const years = useMemo(() => {
    const set = new Set<string>();
    for (const e of all) {
      const y = e.entryDate?.slice(0, 4);
      if (y) set.add(y);
    }
    return [...set].sort((a, b) => (a < b ? 1 : -1));
  }, [all]);

  const sourceKinds = useMemo(() => {
    const set = new Set<SourceKind>();
    for (const e of all) set.add(sourceKind(e.source));
    return set;
  }, [all]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((e) => {
      if (favOnly && !e.favorite) return false;
      if (yearFilter !== "all" && e.entryDate?.slice(0, 4) !== yearFilter)
        return false;
      if (monthFilter !== "all" && e.entryDate?.slice(5, 7) !== monthFilter)
        return false;
      if (sourceFilter !== "all" && sourceKind(e.source) !== sourceFilter)
        return false;
      if (!q) return true;
      return (
        e.body.toLowerCase().includes(q) ||
        (e.entryDate ?? "").toLowerCase().includes(q) ||
        (e.title ?? "").toLowerCase().includes(q)
      );
    });
  }, [all, query, favOnly, yearFilter, monthFilter, sourceFilter]);

  const filtersActive =
    yearFilter !== "all" || monthFilter !== "all" || sourceFilter !== "all";

  function clearFilters() {
    setYearFilter("all");
    setMonthFilter("all");
    setSourceFilter("all");
  }

  const yearGroups = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of filtered) {
      const year = e.entryDate?.slice(0, 4) || "Undated";
      const arr = map.get(year);
      if (arr) arr.push(e);
      else map.set(year, [e]);
    }
    // Years descending; "Undated" sinks to the bottom.
    return [...map.entries()].sort((a, b) => {
      if (a[0] === "Undated") return 1;
      if (b[0] === "Undated") return -1;
      return a[0] < b[0] ? 1 : -1;
    });
  }, [filtered]);

  async function toggleFavorite(e: Entry) {
    await updateEntry.mutateAsync({
      id: e.id,
      data: { favorite: !e.favorite },
    });
    queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
  }

  const hasSamples = all.some((e) => e.source === "sample");

  async function removeSamples() {
    await clearSamples.mutateAsync();
    queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
  }

  // Selection mode, tick pages (or "select all" within the current filters) and
  // remove them in one go. A two-step confirm guards the delete.
  const bulkDelete = useBulkDeleteEntries();
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const filteredIds = useMemo(() => filtered.map((e) => e.id), [filtered]);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));

  function exitSelect() {
    setSelecting(false);
    setSelectedIds(new Set());
    setConfirmDelete(false);
  }

  function toggleSelect(id: string) {
    setConfirmDelete(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setConfirmDelete(false);
    setSelectedIds(allFilteredSelected ? new Set() : new Set(filteredIds));
  }

  async function deleteSelected() {
    if (selectedIds.size === 0) return;
    await bulkDelete.mutateAsync({ data: { ids: [...selectedIds] } });
    queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
    exitSelect();
  }

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AppNav />

      <main className="flex-1 w-full max-w-[680px] mx-auto px-6 py-12 md:py-16">
        <PageHeader
          title="Library"
          subtitle={
            all.length > 0
              ? `${all.length} ${all.length === 1 ? "page" : "pages"} kept`
              : "Every page you write or bring in lives here."
          }
          right={
            <div className="flex items-center gap-4">
              {all.length > 0 && (
                <button
                  onClick={() => (selecting ? exitSelect() : setSelecting(true))}
                  className="font-sans text-sm text-soft-ink hover:text-ink transition-colors"
                  data-testid="button-select-mode"
                >
                  {selecting ? "Done" : "Select"}
                </button>
              )}
              <Link
                href="/import"
                className="font-sans text-sm text-soft-ink hover:text-ink transition-colors"
              >
                Bring old journals →
              </Link>
            </div>
          }
        />

        {isLoading ? (
          <p className="font-sans text-sm text-faint-ink">
            Opening your library…
          </p>
        ) : all.length === 0 ? (
          <div className="border border-border rounded-2xl bg-surface/60 p-10 text-center">
            <p className="font-body text-xl text-soft-ink mb-2">
              Your pages will live here.
            </p>
            <p className="font-body text-soft-ink mb-7">
              Write today or bring old journals into Yadegar.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/today"
                className="rounded-full bg-deep-brown text-background px-6 py-2.5 font-sans text-sm hover:bg-ink transition-colors"
              >
                Write today
              </Link>
              <Link
                href="/import"
                className="rounded-full border border-border bg-surface px-6 py-2.5 font-sans text-sm text-ink hover:border-accent-sepia transition-colors"
              >
                Bring old journals
              </Link>
            </div>
          </div>
        ) : (
          <>
            <ContinuityCard />
            <LibraryViews current="list" />
            {hasSamples && (
              <div className="flex items-center justify-between gap-4 mb-6 rounded-xl border border-accent-sepia/25 bg-[#F3EAD7]/60 px-4 py-3">
                <p className="font-body text-sm text-deep-brown/80 leading-relaxed">
                  These are sample pages, here to show you how Yadegar feels.
                </p>
                <button
                  onClick={removeSamples}
                  disabled={clearSamples.isPending}
                  className="shrink-0 font-sans text-sm text-accent-sepia hover:text-deep-brown underline underline-offset-2 transition-colors disabled:opacity-50"
                  data-testid="button-remove-samples"
                >
                  {clearSamples.isPending ? "removing…" : "Remove them"}
                </button>
              </div>
            )}

            <div className="flex items-center gap-3 mb-8">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by word or date…"
                className="flex-1 bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-ink font-sans placeholder:text-faint-ink focus:outline-none focus:border-accent-sepia transition-colors"
                data-testid="input-search"
              />
              <button
                onClick={() => setFavOnly((v) => !v)}
                className={
                  "rounded-lg border px-4 py-2.5 font-sans text-sm transition-colors " +
                  (favOnly
                    ? "border-accent-sepia text-ink bg-surface"
                    : "border-border text-soft-ink hover:text-ink")
                }
                data-testid="button-favonly"
              >
                ★ Favorites
              </button>
            </div>

            {/* A quiet filing line, narrow the shelf by year, month, or kind. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-8 font-sans text-sm text-soft-ink">
              <span className="text-faint-ink">Showing</span>
              <select
                value={sourceFilter}
                onChange={(e) =>
                  setSourceFilter(e.target.value as "all" | SourceKind)
                }
                className="bg-transparent text-ink border-b border-border focus:border-accent-sepia focus:outline-none py-0.5 cursor-pointer"
                data-testid="filter-source"
              >
                <option value="all">all pages</option>
                {sourceKinds.has("written") && (
                  <option value="written">written here</option>
                )}
                {sourceKinds.has("imported") && (
                  <option value="imported">imported</option>
                )}
                {sourceKinds.has("sample") && (
                  <option value="sample">samples</option>
                )}
              </select>
              <span className="text-faint-ink">from</span>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="bg-transparent text-ink border-b border-border focus:border-accent-sepia focus:outline-none py-0.5 cursor-pointer"
                data-testid="filter-year"
              >
                <option value="all">any year</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="bg-transparent text-ink border-b border-border focus:border-accent-sepia focus:outline-none py-0.5 cursor-pointer"
                data-testid="filter-month"
              >
                <option value="all">any month</option>
                {MONTHS.map((name, i) => (
                  <option key={name} value={String(i + 1).padStart(2, "0")}>
                    {name}
                  </option>
                ))}
              </select>
              {filtersActive && (
                <button
                  onClick={clearFilters}
                  className="text-faint-ink hover:text-ink underline underline-offset-2 transition-colors"
                  data-testid="button-clear-filters"
                >
                  clear
                </button>
              )}
            </div>

            {selecting && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6 rounded-xl border border-border bg-surface/60 px-4 py-3">
                <button
                  onClick={toggleSelectAll}
                  className="font-sans text-sm text-ink hover:text-deep-brown transition-colors"
                  data-testid="button-select-all"
                >
                  {allFilteredSelected ? "Clear all" : "Select all"}
                </button>
                <span className="font-sans text-sm text-faint-ink">
                  {selectedIds.size} selected
                </span>
                <span className="flex-1" />
                {confirmDelete ? (
                  <span className="flex items-center gap-3">
                    <span className="font-body text-sm text-soft-ink">
                      Delete {selectedIds.size}{" "}
                      {selectedIds.size === 1 ? "page" : "pages"}? This can't be
                      undone.
                    </span>
                    <button
                      onClick={deleteSelected}
                      disabled={bulkDelete.isPending}
                      className="font-sans text-sm text-red-700 hover:text-red-800 disabled:opacity-50 transition-colors"
                      data-testid="button-confirm-delete"
                    >
                      {bulkDelete.isPending ? "Deleting…" : "Yes, delete"}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="font-sans text-sm text-soft-ink hover:text-ink transition-colors"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    disabled={selectedIds.size === 0}
                    className="font-sans text-sm text-red-700 hover:text-red-800 disabled:opacity-40 transition-colors"
                    data-testid="button-delete-selected"
                  >
                    Delete{" "}
                    {selectedIds.size > 0 ? `${selectedIds.size} ` : ""}
                    {selectedIds.size === 1 ? "page" : "pages"}
                  </button>
                )}
              </div>
            )}

            {filtered.length === 0 && (
              <p className="font-body text-soft-ink py-4">
                {query.trim()
                  ? `No pages match “${query.trim()}”.`
                  : "No pages here yet, try widening the filters."}
              </p>
            )}

            {yearGroups.map(([year, items]) => (
              <section key={year} className="mb-10">
                <div className="flex items-center gap-4 mb-2">
                  <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-faint-ink">
                    {year}
                  </h2>
                  <span className="flex-1 h-px bg-border/60" />
                </div>
                <div className="flex flex-col">
                  {items.map((entry) => {
                    const rowInner = (
                      <>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-sans text-xs text-faint-ink tracking-wide">
                            {entry.entryDate ?? "Undated"}
                          </span>
                          {SOURCE_LABELS[entry.source] && (
                            <span className="font-sans text-[10px] uppercase tracking-wider text-faint-ink">
                              {SOURCE_LABELS[entry.source]}
                            </span>
                          )}
                        </div>
                        <p className="font-body text-base text-soft-ink leading-snug truncate group-hover:text-ink transition-colors mt-0.5">
                          {entry.title || firstLines(entry.body)}
                        </p>
                      </>
                    );
                    return (
                      <div
                        key={entry.id}
                        className="group flex items-start gap-3 py-4 border-b border-border/70 last:border-0"
                      >
                        {selecting ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(entry.id)}
                            onChange={() => toggleSelect(entry.id)}
                            className="mt-1.5 accent-[var(--color-accent-sepia)]"
                            aria-label="Select page"
                            data-testid={`select-entry-${entry.id}`}
                          />
                        ) : (
                          <button
                            onClick={() => toggleFavorite(entry)}
                            className={
                              "mt-1 text-lg leading-none transition-colors " +
                              (entry.favorite
                                ? "text-accent-sepia"
                                : "text-faint-ink hover:text-soft-ink")
                            }
                            aria-label={
                              entry.favorite ? "Unfavorite" : "Favorite"
                            }
                            data-testid={`button-fav-${entry.id}`}
                          >
                            {entry.favorite ? "★" : "☆"}
                          </button>
                        )}
                        {selecting ? (
                          <button
                            onClick={() => toggleSelect(entry.id)}
                            className="flex-1 min-w-0 text-left"
                            data-testid={`row-entry-${entry.id}`}
                          >
                            {rowInner}
                          </button>
                        ) : (
                          <Link
                            href={`/library/${entry.id}`}
                            className="flex-1 min-w-0 text-left"
                            data-testid={`link-entry-${entry.id}`}
                          >
                            {rowInner}
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </>
        )}
      </main>
    </div>
  );
}

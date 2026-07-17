import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useImportPaste,
  useImportFile,
  useUpdateParsedEntry,
  useConfirmImport,
  getListEntriesQueryKey,
  type ImportReview,
  type ParsedEntry,
} from "@workspace/api-client-react";
import { AppNav } from "@/components/app-nav";

const CONFIDENCE_HINT: Record<string, string> = {
  unknown: "no date found, add one",
  low: "unsure of this date",
};

function excerpt(body: string, max = 220): string {
  const t = body.trim().replace(/\s+/g, " ");
  return t.length > max ? t.slice(0, max) + "…" : t;
}

export default function Import() {
  const queryClient = useQueryClient();
  const importPaste = useImportPaste();
  const importFile = useImportFile();
  const updateParsed = useUpdateParsedEntry();
  const confirmImport = useConfirmImport();

  const [raw, setRaw] = useState("");
  const [review, setReview] = useState<ImportReview | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  // Which year is being viewed in the review (a scan/navigation filter, NOT a
  // selection, "Keep" always keeps every checked page across all years).
  const [yearTab, setYearTab] = useState<string>("all");
  // Ids of pages expanded to their full text in the review.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Turn a raw fetch/HTTP error into something a person can act on.
  function friendlyImportError(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err);
    if (/413|too large|payload/i.test(msg)) {
      return "That's a lot of journal at once. Try bringing it in a few chunks, a year or two at a time, or upload it as a .txt file instead.";
    }
    return "Couldn't read that. Please try again, or paste the text instead.";
  }

  async function doPaste() {
    if (!raw.trim()) return;
    setFileError(null);
    setBusy(true);
    try {
      setReview(await importPaste.mutateAsync({ data: { rawText: raw } }));
    } catch (err) {
      setFileError(friendlyImportError(err));
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file again still fires onChange.
    e.target.value = "";
    if (!file) return;
    setFileError(null);
    setBusy(true);
    try {
      const name = file.name.toLowerCase();
      let rawText: string;
      if (name.endsWith(".docx")) {
        // Load mammoth only when a .docx is actually chosen.
        const { extractText } = await import("@/lib/extract-text");
        rawText = await extractText(file);
      } else {
        rawText = await file.text();
        if (!rawText.trim()) {
          throw new Error("That file looks empty.");
        }
      }
      setReview(
        await importFile.mutateAsync({
          data: { filename: file.name, rawText },
        }),
      );
    } catch (err) {
      // Keep our own friendly extraction messages (e.g. "no text in that
      // file"); only rewrite raw HTTP/size errors into something actionable.
      const msg = err instanceof Error ? err.message : "";
      setFileError(
        /413|too large|payload|HTTP \d/i.test(msg)
          ? friendlyImportError(err)
          : msg || "Couldn't read that file. Try pasting the words instead.",
      );
    } finally {
      setBusy(false);
    }
  }

  function patchLocal(updated: ParsedEntry) {
    setReview((r) =>
      r
        ? { ...r, entries: r.entries.map((e) => (e.id === updated.id ? updated : e)) }
        : r,
    );
  }

  async function patch(entry: ParsedEntry, data: Record<string, unknown>) {
    if (!review) return;
    const updated = await updateParsed.mutateAsync({
      id: review.id,
      parsedEntryId: entry.id,
      data,
    });
    patchLocal(updated);
  }

  async function confirm() {
    if (!review) return;
    setBusy(true);
    try {
      const result = await confirmImport.mutateAsync({ id: review.id });
      queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
      setDone(result.importedCount);
    } finally {
      setBusy(false);
    }
  }

  const includedCount = review?.entries.filter((e) => e.include).length ?? 0;

  // A fresh import: start back at "all years" with everything collapsed.
  useEffect(() => {
    setYearTab("all");
    setExpanded(new Set());
  }, [review?.id]);

  // For big imports: the span of years found, so the scope is legible at a glance.
  const yearSpan = useMemo(() => {
    const years = (review?.entries ?? [])
      .map((e) => e.detectedDate?.slice(0, 4))
      .filter((y): y is string => Boolean(y))
      .sort();
    if (years.length === 0) return null;
    const lo = years[0];
    const hi = years[years.length - 1];
    return lo === hi ? lo : `${lo}–${hi}`;
  }, [review]);

  // The distinct years present (newest first), plus whether any page is undated,
  // to build the year navigation. Each year also carries its page count.
  const yearTabs = useMemo(() => {
    const counts = new Map<string, number>();
    let undated = 0;
    for (const e of review?.entries ?? []) {
      const y = e.detectedDate?.slice(0, 4);
      if (y) counts.set(y, (counts.get(y) ?? 0) + 1);
      else undated += 1;
    }
    const years = [...counts.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
    return { years, undated };
  }, [review]);

  // The pages shown for the current year filter (a view only, selection is
  // tracked per page via the checkboxes and is unaffected by this filter).
  const visibleEntries = useMemo(() => {
    const all = review?.entries ?? [];
    if (yearTab === "all") return all;
    if (yearTab === "undated") return all.filter((e) => !e.detectedDate);
    return all.filter((e) => e.detectedDate?.slice(0, 4) === yearTab);
  }, [review, yearTab]);

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AppNav />
      <main className="flex-1 w-full max-w-[680px] mx-auto px-6 py-12 md:py-16">
        {done !== null ? (
          <div className="text-center py-10">
            <h1 className="font-display text-4xl text-deep-brown mb-3">
              Kept {done} {done === 1 ? "page" : "pages"}.
            </h1>
            <p className="font-body text-soft-ink mb-8">
              They're in your Library now, private and yours.
            </p>
            <Link
              href="/library"
              className="rounded-full bg-deep-brown text-background px-6 py-2.5 font-sans text-sm hover:bg-ink transition-colors"
            >
              Open your Library
            </Link>
          </div>
        ) : review ? (
          <>
            <h1 className="font-display text-4xl text-deep-brown mb-2">
              {review.parsedCount === 0
                ? "We couldn't find clear pages yet"
                : `We found ${review.parsedCount} ${review.parsedCount === 1 ? "page" : "pages"}`}
            </h1>
            <p className="font-body text-soft-ink mb-8">
              {review.parsedCount === 0
                ? "Try pasting again, or add a date line like [2018-03-29] before each entry."
                : yearSpan
                  ? `Spanning ${yearSpan}. Everything is selected to keep, scan below, fix any dates, and uncheck anything you'd rather skip.`
                  : "Review them below. Fix any dates, uncheck anything you'd rather not keep, then save."}
            </p>

            {/* A keep action up top too, so a long import doesn't need a scroll to save. */}
            {review.parsedCount > 0 && (
              <div className="flex items-center gap-4 mb-8">
                <button
                  onClick={confirm}
                  disabled={busy || includedCount === 0}
                  className="rounded-full bg-deep-brown text-background px-7 py-2.5 font-sans text-sm hover:bg-ink disabled:opacity-50 transition-colors"
                  data-testid="button-keep-top"
                >
                  {busy
                    ? "Keeping…"
                    : `Keep ${includedCount} ${includedCount === 1 ? "page" : "pages"}`}
                </button>
                {includedCount !== review.parsedCount && (
                  <span className="font-sans text-sm text-faint-ink">
                    {review.parsedCount - includedCount} unchecked
                  </span>
                )}
              </div>
            )}

            {/* Year navigation, a way to scan a long archive one year at a time. */}
            {yearTabs.years.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-8">
                {(
                  [
                    ["all", "All", review.parsedCount] as const,
                    ...yearTabs.years.map(
                      ([y, n]) => [y, y, n] as const,
                    ),
                    ...(yearTabs.undated
                      ? [["undated", "Undated", yearTabs.undated] as const]
                      : []),
                  ]
                ).map(([key, label, count]) => (
                  <button
                    key={key}
                    onClick={() => setYearTab(key)}
                    className={
                      "rounded-full border px-3 py-1 font-sans text-sm transition-colors " +
                      (yearTab === key
                        ? "border-accent-sepia text-ink bg-surface"
                        : "border-border text-soft-ink hover:text-ink")
                    }
                    data-testid={`year-tab-${key}`}
                  >
                    {label}{" "}
                    <span className="text-faint-ink">{count}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-4">
              {visibleEntries.map((entry, i) => {
                const hint = CONFIDENCE_HINT[entry.dateConfidence];
                const year = entry.detectedDate?.slice(0, 4) ?? null;
                const prevYear =
                  i > 0
                    ? (visibleEntries[i - 1].detectedDate?.slice(0, 4) ?? null)
                    : null;
                // Year headers only matter in the combined "all" view.
                const showYear = yearTab === "all" && year && year !== prevYear;
                const isOpen = expanded.has(entry.id);
                const isLong = entry.body.trim().length > 220;
                return (
                  <Fragment key={entry.id}>
                    {showYear && (
                      <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-faint-ink pt-4">
                        {year}
                      </h2>
                    )}
                    <div
                      className={
                        "border rounded-xl p-5 transition-opacity " +
                        (entry.include
                          ? "border-border bg-surface/60"
                          : "border-border/60 bg-transparent opacity-50")
                      }
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <input
                          type="checkbox"
                          checked={entry.include}
                          onChange={(e) =>
                            patch(entry, { include: e.target.checked })
                          }
                          className="accent-[var(--color-accent-sepia)]"
                          aria-label="Include this page"
                        />
                        <input
                          type="date"
                          value={entry.detectedDate ?? ""}
                          onChange={(e) =>
                            patch(entry, {
                              detectedDate: e.target.value || null,
                            })
                          }
                          className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-soft-ink font-sans focus:outline-none focus:border-accent-sepia"
                        />
                        {hint && (
                          <span className="font-sans text-xs text-accent-sepia">
                            {hint}
                          </span>
                        )}
                      </div>
                      {isOpen ? (
                        // Full text, line breaks preserved; capped so a giant
                        // entry scrolls within its card instead of the page.
                        <p className="font-body text-soft-ink leading-relaxed whitespace-pre-wrap max-h-[60vh] overflow-y-auto">
                          {entry.body.trim()}
                        </p>
                      ) : (
                        <p className="font-body text-soft-ink leading-relaxed">
                          {excerpt(entry.body)}
                        </p>
                      )}
                      {isLong && (
                        <button
                          onClick={() => toggleExpanded(entry.id)}
                          className="mt-3 font-sans text-sm text-accent-sepia hover:text-deep-brown transition-colors"
                          data-testid="button-expand-entry"
                        >
                          {isOpen ? "Show less" : "Read full page"}
                        </button>
                      )}
                    </div>
                  </Fragment>
                );
              })}
            </div>

            {review.parsedCount > 0 && (
              <div className="flex items-center gap-4 mt-8 pt-6 border-t border-border/60">
                <button
                  onClick={confirm}
                  disabled={busy || includedCount === 0}
                  className="rounded-full bg-deep-brown text-background px-7 py-2.5 font-sans text-sm hover:bg-ink disabled:opacity-50 transition-colors"
                >
                  {busy
                    ? "Keeping…"
                    : `Keep ${includedCount} ${includedCount === 1 ? "page" : "pages"}`}
                </button>
                <button
                  onClick={() => {
                    setReview(null);
                    setRaw("");
                  }}
                  className="font-sans text-sm text-soft-ink hover:text-ink transition-colors"
                >
                  Start over
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <h1 className="font-display text-4xl text-deep-brown mb-2">
              Bring old pages into Yadegar
            </h1>
            <p className="font-body text-soft-ink mb-8">
              Paste a journal archive, or upload a file, plain text (.txt, .md)
              or a Word/Google Doc export (.docx). You can review everything
              before saving.
            </p>

            <div className="rounded-2xl border border-border bg-surface/80 shadow-sm p-6 md:p-7">
              <textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder={
                  "Paste your journal here. Dates like [2018-03-29], 2018-03-29, or March 29, 2018 help Yadegar split the pages."
                }
                className="w-full min-h-[320px] bg-transparent text-base text-ink font-body leading-relaxed placeholder:text-faint-ink/80 focus:outline-none resize-none"
                data-testid="input-import-text"
              />
            </div>

            <div className="flex items-center gap-4 mt-5">
              <button
                onClick={doPaste}
                disabled={busy || !raw.trim()}
                className="rounded-full bg-deep-brown text-background px-7 py-2.5 font-sans text-sm hover:bg-ink disabled:opacity-50 transition-colors"
                data-testid="button-find-pages"
              >
                {busy ? "Reading…" : "Find pages"}
              </button>
              <label className="font-sans text-sm text-soft-ink hover:text-ink cursor-pointer transition-colors">
                or upload a file
                <input
                  type="file"
                  accept=".txt,.md,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={onFile}
                  className="hidden"
                />
              </label>
            </div>

            {fileError && (
              <p className="font-body text-sm text-red-700/80 mt-4">
                {fileError}
              </p>
            )}

            <p className="font-sans text-xs text-faint-ink mt-6 leading-relaxed">
              Have a Google Doc? Choose File → Download → Microsoft Word (.docx)
              and upload that, your words come through exactly, in any language.
              We don't take PDFs: a PDF stores glyphs, not text, so it can't be
              read back without altering your words. Scanned images and photos of
              handwriting can't be read either, paste those instead.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

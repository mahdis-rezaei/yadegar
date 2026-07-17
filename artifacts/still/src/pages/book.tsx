import { useMemo } from "react";
import { Link, useSearch } from "wouter";
import { useListEntries, type Entry } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function dayLabel(d: string): string {
  const parsed = new Date(d + "T00:00:00");
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

// Chapter key: by month within a year scope, by year for favorites (which span
// years). The label is what's printed as a chapter break.
function chapterLabel(e: Entry, byMonth: boolean): string {
  const d = e.entryDate as string;
  return byMonth ? `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}` : d.slice(0, 4);
}

export default function Book() {
  const params = new URLSearchParams(useSearch());
  const scope = params.get("scope") ?? "year";
  const year = Number(params.get("year"));
  const { user } = useAuth();
  const { data, isLoading } = useListEntries();

  const byMonth = scope === "year";

  const entries = useMemo(() => {
    let list = ((data ?? []) as Entry[]).filter((e) => e.entryDate);
    if (scope === "favorites") list = list.filter((e) => e.favorite);
    else if (scope === "year" && year)
      list = list.filter((e) => Number((e.entryDate as string).slice(0, 4)) === year);
    list.sort((a, b) => ((a.entryDate ?? "") < (b.entryDate ?? "") ? -1 : 1));
    return list;
  }, [data, scope, year]);

  const title =
    scope === "favorites" ? "Treasured Pages" : `The Pages of ${year || ""}`.trim();

  let lastChapter = "";

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <div className="print:hidden">
        <AppNav />
      </div>

      <main className="flex-1 w-full max-w-[640px] mx-auto px-6 py-12 md:py-16">
        <div className="print:hidden flex items-center justify-between mb-12">
          <Link
            href="/library"
            className="font-sans text-sm text-soft-ink hover:text-ink transition-colors"
          >
            ← Library
          </Link>
          {entries.length > 0 && (
            <button
              onClick={() => window.print()}
              className="rounded-full border border-border hover:border-accent-sepia text-soft-ink hover:text-ink px-4 py-2 font-sans text-sm transition-colors"
            >
              Print / Save as PDF
            </button>
          )}
        </div>

        {isLoading ? (
          <p className="font-sans text-sm text-faint-ink">Gathering your pages…</p>
        ) : entries.length === 0 ? (
          <p className="font-body text-soft-ink text-center py-10">
            There are no pages for this book yet.
          </p>
        ) : (
          <article>
            {/* Cover */}
            <header className="text-center mb-24 pt-10">
              <p className="font-sans text-xs uppercase tracking-[0.3em] text-faint-ink mb-8">
                Yadegar
              </p>
              <h1 className="font-display text-4xl md:text-5xl text-deep-brown leading-tight">
                {title}
              </h1>
              {user?.name && (
                <p className="font-display text-xl text-soft-ink mt-6">
                  {user.name}
                </p>
              )}
              <p className="font-sans text-xs text-faint-ink mt-10">
                {entries.length} pages
              </p>
            </header>

            {entries.map((e) => {
              const chapter = chapterLabel(e, byMonth);
              const newChapter = chapter !== lastChapter;
              lastChapter = chapter;
              return (
                <div key={e.id}>
                  {newChapter && (
                    <h2 className="font-display text-3xl text-accent-sepia mt-16 mb-8 break-before-page">
                      {chapter}
                    </h2>
                  )}
                  <section className="mb-12 break-inside-avoid">
                    <p className="font-sans text-xs uppercase tracking-[0.18em] text-faint-ink mb-2">
                      {dayLabel(e.entryDate as string)}
                    </p>
                    {e.title && e.title.trim() && (
                      <p className="font-display text-xl text-deep-brown mb-2">
                        {e.title}
                      </p>
                    )}
                    <p className="font-body text-ink leading-relaxed whitespace-pre-wrap">
                      {e.body}
                    </p>
                  </section>
                </div>
              );
            })}
          </article>
        )}
      </main>
    </div>
  );
}

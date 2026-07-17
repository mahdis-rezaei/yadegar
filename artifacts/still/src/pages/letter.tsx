import { useMemo } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { useListEntries } from "@workspace/api-client-react";
import { AppNav } from "@/components/app-nav";
import { useYearLetter } from "@/lib/use-year-letter";

function longDate(d: string): string {
  const parsed = new Date(d + "T00:00:00");
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}

function excerptOf(body: string | null, max = 320): string {
  const t = (body ?? "").trim();
  return t.length > max ? t.slice(0, max).trimEnd() + "…" : t;
}

export default function Letter() {
  const [, params] = useRoute("/letters/:year");
  const [, setLocation] = useLocation();
  const year = Number(params?.year);
  const valid = Number.isInteger(year);
  const { data, isLoading } = useYearLetter(valid ? year : 0);
  const { data: entries } = useListEntries();

  const hasPages = !!data && data.pageCount > 0;

  // The years you've actually written, for the year-jump dropdown and to bound
  // the prev/next arrows to real years (so you never walk into an empty one).
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const e of entries ?? []) {
      const y = Number(e.entryDate?.slice(0, 4));
      if (Number.isInteger(y)) set.add(y);
    }
    if (valid) set.add(year);
    return [...set].sort((a, b) => b - a);
  }, [entries, valid, year]);

  const prevYear = years.filter((y) => y < year).sort((a, b) => b - a)[0];
  const nextYear = years.filter((y) => y > year).sort((a, b) => a - b)[0];

  // This year's pages (used to fill the letter when nothing was favorited, so a
  // year never reads as just a cover + a count).
  const yearPages = useMemo(() => {
    return (entries ?? [])
      .filter((e) => Number(e.entryDate?.slice(0, 4)) === year)
      .sort((a, b) => (a.entryDate ?? "") < (b.entryDate ?? "") ? -1 : 1);
  }, [entries, year]);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* Hidden when printing, so the PDF is just the letter. */}
      <div className="print:hidden">
        <AppNav />
      </div>

      <main className="flex-1 w-full px-6 py-12 md:py-20">
        {/* Navigation + print, hidden in the printed PDF. Sits a touch wider
            than the 640px book column so the controls fit on one line. */}
        <div className="print:hidden max-w-[760px] mx-auto flex flex-wrap items-center justify-between gap-x-5 gap-y-3 mb-12">
          <div className="flex items-center gap-3 md:gap-4">
            <Link
              href="/look-back/keepsake"
              className="font-sans text-sm text-soft-ink hover:text-ink transition-colors whitespace-nowrap"
            >
              ← Look back
            </Link>
            {prevYear && (
              <Link
                href={`/letters/${prevYear}`}
                className="font-sans text-sm text-faint-ink hover:text-ink transition-colors whitespace-nowrap"
              >
                {prevYear}
              </Link>
            )}
            {years.length > 1 && (
              <select
                value={String(year)}
                onChange={(e) => setLocation(`/letters/${e.target.value}`)}
                className="font-sans text-sm text-soft-ink bg-surface/60 border border-border rounded-full px-3 py-1.5 focus:outline-none focus:border-accent-sepia"
                data-testid="letter-year-select"
                aria-label="Jump to a year"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            )}
            {nextYear && (
              <Link
                href={`/letters/${nextYear}`}
                className="font-sans text-sm text-faint-ink hover:text-ink transition-colors whitespace-nowrap"
              >
                {nextYear}
              </Link>
            )}
          </div>
          {hasPages && (
            <div className="flex items-center gap-4">
              <Link
                href={`/book?scope=year&year=${year}`}
                className="font-sans text-sm text-soft-ink hover:text-ink transition-colors whitespace-nowrap"
              >
                Make a full book →
              </Link>
              <button
                onClick={() => window.print()}
                className="rounded-full border border-border hover:border-accent-sepia text-soft-ink hover:text-ink px-4 py-2 font-sans text-sm transition-colors whitespace-nowrap"
              >
                Print / Save as PDF
              </button>
            </div>
          )}
        </div>

        <div className="w-full max-w-[640px] mx-auto">
        {!valid ? (
          <p className="font-body text-soft-ink">That isn't a year.</p>
        ) : isLoading ? (
          <p className="font-sans text-sm text-faint-ink">Gathering your year…</p>
        ) : !hasPages ? (
          <div className="text-center py-10">
            <p className="font-display text-3xl text-deep-brown mb-3">
              {year}
            </p>
            <p className="font-body text-soft-ink">
              No pages from this year yet. When you write or import some, your year
              will gather here.
            </p>
          </div>
        ) : (
          <article>
            {/* Cover */}
            <header className="text-center mb-16">
              <p className="font-sans text-xs uppercase tracking-[0.3em] text-faint-ink mb-6">
                Yadegar
              </p>
              <h1 className="font-display text-3xl md:text-4xl text-deep-brown leading-tight">
                Your Year in Pages
              </h1>
              <p className="font-display text-7xl md:text-8xl text-accent-sepia mt-4">
                {year}
              </p>
            </header>

            {/* Opening */}
            <p className="font-body text-xl text-ink leading-relaxed text-center mb-16">
              This year you wrote {data!.pageCount}{" "}
              {data!.pageCount === 1 ? "page" : "pages"}.
              {data!.favorites.length > 0
                ? " These are a few that stayed."
                : " Here they are."}
            </p>

            {/* The pages that stayed (favorites), else the whole year, gathered. */}
            {(() => {
              const fav = data!.favorites;
              const sections =
                fav.length > 0
                  ? fav.map((f) => ({
                      key: f.entryId,
                      entryId: f.entryId,
                      entryDate: f.entryDate,
                      title: f.title,
                      text: f.excerpt,
                    }))
                  : yearPages.map((e) => ({
                      key: e.id,
                      entryId: e.id,
                      entryDate: e.entryDate ?? "",
                      title: e.title,
                      text: excerptOf(e.body ?? null),
                    }));

              return (
                <div className="space-y-12">
                  {sections.map((s) => (
                    <section key={s.key} className="break-inside-avoid">
                      <p className="font-sans text-xs uppercase tracking-[0.18em] text-faint-ink mb-2">
                        {longDate(s.entryDate)}
                      </p>
                      {s.title && s.title.trim() && (
                        <p className="font-display text-xl text-deep-brown mb-2">
                          {s.title}
                        </p>
                      )}
                      <p className="font-body text-ink leading-relaxed whitespace-pre-wrap">
                        {s.text}
                      </p>
                      <Link
                        href={`/library/${s.entryId}`}
                        className="print:hidden inline-block mt-3 font-sans text-sm text-accent-sepia hover:text-deep-brown transition-colors"
                      >
                        Read the full page →
                      </Link>
                    </section>
                  ))}
                </div>
              );
            })()}

            {/* Closing */}
            {data!.reflectionCount > 0 && (
              <p className="font-body text-soft-ink leading-relaxed text-center mt-16 pt-10 border-t border-border/60">
                You also wrote {data!.reflectionCount}{" "}
                {data!.reflectionCount === 1 ? "reflection" : "reflections"} this
                year, letters to the person who wrote these pages.
              </p>
            )}
          </article>
        )}
        </div>
      </main>
    </div>
  );
}

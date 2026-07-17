import { useMemo } from "react";
import { Link } from "wouter";
import { useListEntries, type Entry } from "@workspace/api-client-react";
import { AppNav } from "@/components/app-nav";
import { PageHeader } from "@/components/page";
import { LibraryViews } from "@/components/library-views";

// One-line preview: the title, else the first non-empty line of the page.
function preview(e: Entry): string {
  if (e.title && e.title.trim()) return e.title.trim();
  const line = (e.body ?? "").trim().split(/\n+/)[0] ?? "";
  if (!line) return "(an untitled page)";
  return line.length > 120 ? line.slice(0, 119).trimEnd() + "…" : line;
}

function dayLabel(d: string): string {
  const parsed = new Date(d + "T00:00:00");
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function EntryRow({ entry, showDay }: { entry: Entry; showDay?: boolean }) {
  return (
    <li>
      <Link href={`/library/${entry.id}`} className="group block">
        {showDay && entry.entryDate && (
          <span className="font-sans text-xs text-faint-ink">
            {dayLabel(entry.entryDate)}
          </span>
        )}
        <p className="font-body text-ink group-hover:text-deep-brown transition-colors leading-relaxed">
          {preview(entry)}
        </p>
      </Link>
    </li>
  );
}

export default function Timeline() {
  const { data, isLoading } = useListEntries();

  const { years, undated } = useMemo(() => {
    const entries = (data ?? []) as Entry[];
    const dated = entries.filter((e) => e.entryDate);
    const undatedEntries = entries.filter((e) => !e.entryDate);
    // Oldest → newest: a life as it unfolded.
    dated.sort((a, b) =>
      (a.entryDate ?? "") < (b.entryDate ?? "")
        ? -1
        : (a.entryDate ?? "") > (b.entryDate ?? "")
          ? 1
          : 0,
    );
    const byYear = new Map<number, Entry[]>();
    for (const e of dated) {
      const y = Number((e.entryDate as string).slice(0, 4));
      const list = byYear.get(y) ?? [];
      list.push(e);
      byYear.set(y, list);
    }
    const yearList = [...byYear.entries()].sort((a, b) => a[0] - b[0]);
    return { years: yearList, undated: undatedEntries };
  }, [data]);

  const empty = !isLoading && years.length === 0 && undated.length === 0;

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AppNav />
      <main className="flex-1 w-full max-w-[760px] mx-auto px-6 py-12 md:py-16">
        <PageHeader
          title="The timeline of you"
          subtitle="Your life as you wrote it, oldest page to newest. Only your own words; nothing inferred."
        />
        <LibraryViews current="timeline" />

        {isLoading ? (
          <p className="font-sans text-sm text-faint-ink">Gathering…</p>
        ) : empty ? (
          <div className="border border-border rounded-2xl bg-surface/60 p-10 text-center">
            <p className="font-body text-xl text-soft-ink mb-2">
              Your timeline begins with your first page.
            </p>
            <Link
              href="/today"
              className="inline-block mt-4 rounded-full bg-deep-brown text-background px-6 py-2.5 font-sans text-sm hover:bg-ink transition-colors"
            >
              Write today
            </Link>
          </div>
        ) : (
          <>
            {/* Year jump */}
            {years.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-10">
                {years.map(([y]) => (
                  <a
                    key={y}
                    href={`#y${y}`}
                    className="font-sans text-xs text-soft-ink hover:text-ink border border-border rounded-full px-3 py-1 transition-colors"
                  >
                    {y}
                  </a>
                ))}
              </div>
            )}

            {/* The spine */}
            <div className="border-l-2 border-border/60 pl-6 md:pl-8 space-y-14">
              {years.map(([year, items]) => (
                <section key={year} id={`y${year}`} className="scroll-mt-8">
                  <h2 className="font-display text-4xl text-deep-brown mb-5">
                    {year}
                  </h2>
                  <ul className="space-y-5">
                    {items.map((e) => (
                      <EntryRow key={e.id} entry={e} showDay />
                    ))}
                  </ul>
                </section>
              ))}

              {undated.length > 0 && (
                <section className="scroll-mt-8">
                  <h2 className="font-display text-3xl text-soft-ink mb-5">
                    Undated
                  </h2>
                  <ul className="space-y-5">
                    {undated.map((e) => (
                      <EntryRow key={e.id} entry={e} />
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

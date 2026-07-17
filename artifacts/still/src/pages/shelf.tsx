import { Link } from "wouter";
import { AppNav } from "@/components/app-nav";
import { PageHeader } from "@/components/page";
import { useShelf, useRemoveFromShelf } from "@/lib/use-shelf";

function longDate(d: string | null): string | null {
  if (!d) return null;
  const parsed = new Date(d + "T00:00:00");
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function Shelf() {
  const { data, isLoading } = useShelf();
  const remove = useRemoveFromShelf();
  const items = data ?? [];

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AppNav />
      <main className="flex-1 w-full max-w-[680px] mx-auto px-6 py-12 md:py-16">
        <PageHeader
          title="Your shelf"
          subtitle="A few pages you wanted close, the ones that feel alive right now. Favorites are everything that mattered; the shelf is what's near."
        />

        {isLoading ? (
          <p className="font-sans text-sm text-faint-ink">Gathering…</p>
        ) : items.length === 0 ? (
          <div className="border border-border rounded-2xl bg-surface/60 p-10 text-center">
            <p className="font-body text-xl text-soft-ink mb-2">
              Your shelf is empty.
            </p>
            <p className="font-body text-soft-ink">
              When a page feels worth keeping close, open it and choose
              “Add to shelf.”
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {items.map((m) => (
              <div
                key={m.entryId}
                className="border border-border rounded-2xl bg-surface/70 p-6 md:p-8"
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <span className="font-sans text-xs text-faint-ink">
                    {longDate(m.entryDate) ?? "Undated"}
                  </span>
                  <button
                    onClick={() => remove.mutate(m.entryId)}
                    disabled={remove.isPending}
                    className="font-sans text-xs text-faint-ink hover:text-soft-ink transition-colors"
                  >
                    remove
                  </button>
                </div>
                {m.title && m.title.trim() && (
                  <p className="font-display text-lg text-deep-brown mb-1">
                    {m.title}
                  </p>
                )}
                <p className="font-body text-ink leading-relaxed whitespace-pre-wrap">
                  {m.excerpt}
                </p>
                <Link
                  href={`/library/${m.entryId}`}
                  className="inline-block mt-4 font-sans text-sm text-accent-sepia hover:text-deep-brown border-b border-accent-sepia/40 pb-0.5 transition-colors"
                >
                  Read the full page →
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

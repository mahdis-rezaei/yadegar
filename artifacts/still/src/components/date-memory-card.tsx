import { Link } from "wouter";
import { useUpdateEntry } from "@workspace/api-client-react";

// The minimal shape every date-based memory card needs.
export interface DateMemoryCardItem {
  entryId: string;
  title: string | null;
  excerpt: string;
  entryDate: string;
  favorite: boolean;
}

function longDate(d: string): string {
  const parsed = new Date(d + "T00:00:00");
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// A single resurfaced page (date-based). Shared by the Today "On this day"
// section and the Look Back browse. `heading` is the section-specific label
// (e.g. "A year ago today", "You marked this as important"). `onChanged` lets
// the parent refresh its own query after a favorite/hide.
export function DateMemoryCard({
  heading,
  memory,
  onChanged,
}: {
  heading: string;
  memory: DateMemoryCardItem;
  onChanged?: () => void;
}) {
  const updateEntry = useUpdateEntry();

  function toggleFavorite() {
    updateEntry.mutate(
      { id: memory.entryId, data: { favorite: !memory.favorite } },
      { onSuccess: onChanged },
    );
  }

  // "Not this one" = don't resurface this page again (the user controls what
  // returns). Sets the entry's resurfacing preference to never.
  function hide() {
    updateEntry.mutate(
      { id: memory.entryId, data: { resurfacingPreference: "never" } },
      { onSuccess: onChanged },
    );
  }

  return (
    <div className="border border-border rounded-2xl bg-surface/70 p-6 md:p-8">
      <div className="flex items-start justify-between gap-4 mb-3">
        <span className="font-sans text-xs uppercase tracking-[0.18em] text-faint-ink">
          {heading}
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleFavorite}
            disabled={updateEntry.isPending}
            className={
              "text-lg leading-none transition-colors " +
              (memory.favorite
                ? "text-accent-sepia"
                : "text-faint-ink hover:text-soft-ink")
            }
            aria-label={memory.favorite ? "Unfavorite" : "Favorite"}
          >
            {memory.favorite ? "★" : "☆"}
          </button>
          <button
            onClick={hide}
            disabled={updateEntry.isPending}
            className="font-sans text-xs text-faint-ink hover:text-soft-ink transition-colors"
          >
            not this one
          </button>
        </div>
      </div>

      <p className="font-sans text-xs text-faint-ink mb-3">
        {longDate(memory.entryDate)}
      </p>

      <p className="font-body text-ink leading-relaxed whitespace-pre-wrap">
        {memory.excerpt}
      </p>

      <Link
        href={`/library/${memory.entryId}`}
        className="inline-block mt-5 font-sans text-sm text-accent-sepia hover:text-deep-brown border-b border-accent-sepia/40 pb-0.5 transition-colors"
      >
        Read the full page →
      </Link>
    </div>
  );
}

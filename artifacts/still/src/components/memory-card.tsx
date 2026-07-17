import { Link } from "wouter";
import type { ReturnedMemory } from "@workspace/api-client-react";

// What each lens means, in the reader's language (never shown as a "lens").
export const LENS_LABELS: Record<string, string> = {
  memory: "A page from then",
  thread: "What kept returning",
  distance: "How far you've come",
  wisdom: "Something you seemed to know",
  value_signal: "What mattered then",
  becoming: "Who you were becoming",
  survival: "What you carried through",
};

function longDate(d: string | null | undefined): string | null {
  if (!d) return null;
  const parsed = new Date(d + "T00:00:00");
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function MemoryCard({
  memory,
  onFavorite,
  onDismiss,
}: {
  memory: ReturnedMemory;
  onFavorite?: () => void;
  onDismiss?: () => void;
}) {
  const heading = LENS_LABELS[memory.lens ?? ""] ?? "A page worth returning to";
  const date = longDate(memory.quoteDate);

  return (
    <div className="border border-border rounded-2xl bg-surface/70 p-6 md:p-8">
      <div className="flex items-start justify-between gap-4 mb-4">
        <span className="font-sans text-xs uppercase tracking-[0.18em] text-faint-ink">
          {heading}
        </span>
        {(onFavorite || onDismiss) && (
          <div className="flex items-center gap-3">
            {onFavorite && (
              <button
                onClick={onFavorite}
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
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="font-sans text-xs text-faint-ink hover:text-soft-ink transition-colors"
              >
                dismiss
              </button>
            )}
          </div>
        )}
      </div>

      {date && (
        <p className="font-sans text-xs text-faint-ink mb-3">{date}</p>
      )}

      {memory.quote && (
        <p className="font-display italic text-xl md:text-2xl text-deep-brown leading-snug mb-4">
          “{memory.quote}”
        </p>
      )}

      {memory.observation && (
        <p className="font-body text-soft-ink leading-relaxed">
          {memory.observation}
        </p>
      )}

      {memory.journalEntryId && (
        <Link
          href={`/library/${memory.journalEntryId}`}
          className="inline-block mt-5 font-sans text-sm text-accent-sepia hover:text-deep-brown border-b border-accent-sepia/40 pb-0.5 transition-colors"
        >
          Read the full page →
        </Link>
      )}
    </div>
  );
}

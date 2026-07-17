import { useLocation } from "wouter";
import { useStill, type HistoryEntry } from "@/lib/store";
import { motion } from "framer-motion";

const MODE_PREVIEW: Record<string, string> = {
  thread: "something that kept returning",
  memory: "a page from your past",
  distance: "how far you've come",
  value_signal: "what mattered then",
  wisdom: "something you seemed to know",
  nothing: "Nothing surfaced",
};

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Earlier today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function ThreadRow({
  entry,
  onView,
  onDelete,
  index,
}: {
  entry: HistoryEntry;
  onView: () => void;
  onDelete: () => void;
  index: number;
}) {
  const isNothing = entry.result.mode === "nothing";
  const preview = MODE_PREVIEW[entry.result.mode] ?? entry.result.mode;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4 }}
      className="flex items-start justify-between gap-4 py-5 border-b border-border last:border-0"
    >
      <div className="flex flex-col gap-1.5 min-w-0">
        <span className="text-xs font-sans text-faint-ink tracking-wide">
          {formatDate(entry.savedAt)}
        </span>
        <p className={`font-body text-base leading-snug ${isNothing ? "text-soft-ink italic" : "text-ink"}`}>
          {preview}
        </p>
        {!isNothing && entry.result.observation && (
          <p className="text-sm font-sans text-soft-ink leading-snug truncate max-w-xs">
            {entry.result.observation}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0 pt-0.5">
        <button
          onClick={onView}
          className={`font-sans text-sm border-b pb-0.5 transition-colors whitespace-nowrap ${
            isNothing
              ? "text-faint-ink hover:text-soft-ink border-faint-ink/30"
              : "text-accent-sepia hover:text-deep-brown border-accent-sepia/40"
          }`}
        >
          {isNothing ? "View" : "Read again"}
        </button>
        <button
          onClick={onDelete}
          className="text-faint-ink hover:text-soft-ink font-sans text-xs transition-colors"
        >
          Remove
        </button>
      </div>
    </motion.div>
  );
}

export default function History() {
  const [, setLocation] = useLocation();
  const { history, deleteHistoryEntry, clearHistory, viewHistoryEntry } = useStill();

  const handleView = (entry: HistoryEntry) => {
    viewHistoryEntry(entry);
    setLocation("/result");
  };

  const handleDelete = (id: string) => {
    deleteHistoryEntry(id);
  };

  const handleClearAll = () => {
    clearHistory();
    setLocation("/");
  };

  return (
    <div className="min-h-[100dvh] flex flex-col p-6 max-w-[680px] mx-auto py-12 md:py-24">
      <div className="flex items-center justify-between mb-10">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-3xl text-deep-brown">Your threads</h2>
          <p className="text-sm font-sans text-soft-ink">
            {history.length === 0
              ? "No threads saved yet."
              : `${history.length} thread${history.length !== 1 ? "s" : ""}, most recent first`}
          </p>
        </div>
        {history.length > 1 && (
          <button
            onClick={handleClearAll}
            className="text-faint-ink hover:text-soft-ink font-sans text-xs transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <p className="font-body text-base text-soft-ink italic">
          Nothing here yet. Past threads will appear once you run Yadegar.
        </p>
      ) : (
        <div className="flex flex-col">
          {history.map((entry, i) => (
            <ThreadRow
              key={entry.id}
              entry={entry}
              index={i}
              onView={() => handleView(entry)}
              onDelete={() => handleDelete(entry.id)}
            />
          ))}
        </div>
      )}

      <div className="mt-16">
        <button
          onClick={() => setLocation("/")}
          className="text-soft-ink hover:text-ink font-sans text-sm transition-colors"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useStill } from "@/lib/store";
import { useListEntries, type Entry } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";

function resolveFullText(
  date: string,
  fragment: string,
  stored: Entry[] | undefined,
  fallback: Record<string, string>
): string | null {
  const onDate = (stored ?? []).filter((e) => e.entryDate === date);
  if (onDate.length > 0) {
    // Prefer the stored entry whose text actually contains the fragment.
    const withFragment = onDate.find(
      (e) =>
        fragment &&
        e.body.toLowerCase().includes(fragment.toLowerCase())
    );
    return (withFragment ?? onDate[0]).body;
  }
  return fallback[date] ?? null;
}

const MODE_LABELS: Record<string, string> = {
  thread: "WHAT KEPT RETURNING",
  memory: "A PAGE FROM THEN",
  distance: "LOOK HOW FAR",
  value_signal: "WHAT MATTERED THEN",
  wisdom: "WHAT YOU KNEW",
  nothing: "NOTHING THIS TIME",
};

function quoteSectionLabel(mode: string): string {
  if (mode === "value_signal") return "IN THE WORDS YOU SAVED";
  return "IN YOUR OWN WORDS";
}

function spanAt(
  fullText: string,
  start: number,
  length: number
): { before: string; match: string; after: string } {
  return {
    before: fullText.slice(0, start),
    match: fullText.slice(start, start + length),
    after: fullText.slice(start + length),
  };
}

function highlightFragment(
  fullText: string,
  fragment: string
): { before: string; match: string; after: string } | null {
  const trimmed = fragment.trim();
  if (!trimmed) return null;

  // Exact substring.
  const idx = fullText.indexOf(trimmed);
  if (idx !== -1) return spanAt(fullText, idx, trimmed.length);

  // Case-insensitive substring.
  const lidx = fullText.toLowerCase().indexOf(trimmed.toLowerCase());
  if (lidx !== -1) return spanAt(fullText, lidx, trimmed.length);

  // Whitespace- and case-tolerant match for near-verbatim fragments
  // (handles differences in spacing, line breaks, and capitalization).
  const escaped = trimmed
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  try {
    const re = new RegExp(escaped, "i");
    const m = re.exec(fullText);
    if (m) return spanAt(fullText, m.index, m[0].length);
  } catch {
    // Malformed regex, fall through to no highlight.
  }

  return null;
}

export default function Result() {
  const [, setLocation] = useLocation();
  const { scoreResult, activeSourceEntries, reset } = useStill();
  const { data: storedEntries } = useListEntries();
  const [showWhy, setShowWhy] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!scoreResult) {
      setLocation("/paste");
    }
  }, [scoreResult, setLocation]);

  if (!scoreResult) return null;

  const isNothing = scoreResult.mode === "nothing";
  const label = MODE_LABELS[scoreResult.mode] ?? scoreResult.mode.toUpperCase();

  function toggleEntry(idx: number) {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  return (
    <div className="min-h-[100dvh] flex flex-col p-6 max-w-[680px] mx-auto py-12 md:py-24">

      {isNothing ? (
        <div className="flex flex-col items-center text-center gap-8 py-12">
          <span className="text-sm font-sans tracking-widest uppercase text-faint-ink">
            {label}
          </span>
          <p className="font-body text-2xl text-ink leading-relaxed max-w-lg">
            Nothing meaningful surfaced this time. There were patterns in the writing, but none felt durable enough to name honestly.
          </p>
          <p className="font-body text-lg text-soft-ink italic">
            Better silence than a false thread.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">

          {/* Label */}
          <span className="text-xs font-sans tracking-widest uppercase text-faint-ink">
            {label}
          </span>

          {/* Observation */}
          {scoreResult.observation && (
            <p className="font-display text-2xl md:text-3xl text-deep-brown leading-snug">
              {scoreResult.observation}
            </p>
          )}

          {/* Quotes */}
          {scoreResult.quotes && scoreResult.quotes.length > 0 && (
            <div className="flex flex-col gap-1 mt-2">
              <span className="text-[10px] font-sans tracking-widest uppercase text-faint-ink mb-4">
                {quoteSectionLabel(scoreResult.mode)}
              </span>
              <div className="flex flex-col gap-8">
                {scoreResult.quotes.map((q, idx) => {
                  const fullText = resolveFullText(q.date, q.fragment, storedEntries, activeSourceEntries);
                  const isExpanded = expandedEntries.has(idx);
                  const highlighted = fullText ? highlightFragment(fullText, q.fragment) : null;

                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 + 0.2, duration: 0.6 }}
                      className="flex flex-col gap-2"
                    >
                      <span className="text-[11px] font-sans text-faint-ink tracking-wide">
                        {q.date}
                      </span>
                      <p className="font-body text-xl text-ink leading-relaxed">
                        "{q.fragment}"
                      </p>

                      {/* Show full entry */}
                      {fullText && (
                        <div className="mt-1">
                          <button
                            onClick={() => toggleEntry(idx)}
                            className="text-[11px] font-sans text-faint-ink/60 hover:text-faint-ink transition-colors border-b border-faint-ink/20 pb-px leading-none"
                          >
                            {isExpanded ? "hide entry" : "show full entry"}
                          </button>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.35, ease: "easeInOut" }}
                                className="overflow-hidden"
                              >
                                <div className="mt-4 pl-4 border-l border-border">
                                  <p className="text-[11px] font-sans text-faint-ink tracking-wide mb-2">
                                    {q.date}
                                  </p>
                                  <p className="font-body text-sm text-soft-ink leading-relaxed whitespace-pre-wrap">
                                    {highlighted ? (
                                      <>
                                        {highlighted.before}
                                        <span className="bg-deep-brown/8 text-ink rounded-sm px-0.5">
                                          {highlighted.match}
                                        </span>
                                        {highlighted.after}
                                      </>
                                    ) : (
                                      fullText
                                    )}
                                  </p>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}

                      <div className="mt-4 border-b border-border" />
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Why this surfaced */}
          {scoreResult.why && (
            <div className="mt-2">
              {!showWhy ? (
                <button
                  onClick={() => setShowWhy(true)}
                  className="text-sm font-sans text-faint-ink hover:text-soft-ink transition-colors border-b border-faint-ink/30 pb-0.5"
                >
                  Why this surfaced
                </button>
              ) : (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="font-body text-base text-soft-ink leading-relaxed italic"
                >
                  {scoreResult.why}
                </motion.p>
              )}
            </div>
          )}

        </div>
      )}

      <div className={`mt-24 flex items-center gap-6 ${isNothing ? "justify-center" : "justify-start"}`}>
        <button
          onClick={() => {
            reset();
            setLocation("/paste");
          }}
          className="text-soft-ink hover:text-ink font-sans text-sm transition-colors"
        >
          Begin again
        </button>
        <button
          onClick={() => setLocation("/history")}
          className="text-faint-ink hover:text-soft-ink font-sans text-sm transition-colors"
        >
          View history
        </button>
      </div>
    </div>
  );
}

import { useState, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListEntries,
  useCreateEntry,
  getListEntriesQueryKey,
  type Entry,
} from "@workspace/api-client-react";
import { useStill, parseEntriesVerbatim } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";

function today(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function buildArchiveText(entries: Entry[]): string {
  return [...entries]
    .filter((e) => e.entryDate)
    .sort((a, b) => {
      const ad = a.entryDate ?? "";
      const bd = b.entryDate ?? "";
      return ad < bd ? -1 : ad > bd ? 1 : 0;
    })
    .map((e) => `[${e.entryDate}]\n${e.body}`)
    .join("\n\n");
}

export default function Entries() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { setEntries } = useStill();

  const { data: entries, isLoading } = useListEntries();
  const createEntry = useCreateEntry();

  const [mode, setMode] = useState<"write" | "paste">("write");
  const [date, setDate] = useState(today());
  const [text, setText] = useState("");
  const [batch, setBatch] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const yearRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const list = entries ?? [];
  const batchParsed = parseEntriesVerbatim(batch);
  const batchCount = batchParsed.length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (e) =>
        e.body.toLowerCase().includes(q) ||
        (e.entryDate ?? "").toLowerCase().includes(q),
    );
  }, [list, query]);

  const yearGroups = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of filtered) {
      const year = e.entryDate?.slice(0, 4) || "Undated";
      const arr = map.get(year);
      if (arr) arr.push(e);
      else map.set(year, [e]);
    }
    return [...map.entries()];
  }, [filtered]);

  function jumpToYear(year: string) {
    yearRefs.current[year]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
  }

  async function handleSaveOne() {
    if (!date || !text.trim()) return;
    setSaving(true);
    try {
      await createEntry.mutateAsync({ data: { body: text, entryDate: date } });
      setText("");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveBatch() {
    if (batchCount === 0) return;
    setSaving(true);
    try {
      for (const { date: d, text: t } of batchParsed) {
        await createEntry.mutateAsync({ data: { body: t, entryDate: d } });
      }
      setBatch("");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  function handleReadAcross() {
    if (list.length === 0) return;
    setEntries(buildArchiveText(list));
    setLocation("/processing");
  }

  return (
    <div className="min-h-[100dvh] flex flex-col p-6 max-w-[680px] mx-auto py-12 md:py-24">
      <div className="flex items-baseline justify-between mb-8">
        <h1 className="font-display text-4xl text-deep-brown">Your archive</h1>
        <button
          onClick={() => setLocation("/")}
          className="text-soft-ink hover:text-ink font-sans text-sm transition-colors"
        >
          ← Home
        </button>
      </div>

      <p className="text-lg text-soft-ink mb-8 leading-relaxed">
        Keep your pages here. They stay between visits. Write one, or paste a batch, Yadegar reads across all of them when you're ready.
      </p>

      {/* Mode toggle */}
      <div className="flex items-center gap-6 mb-6">
        <button
          onClick={() => setMode("write")}
          className={`font-sans text-sm pb-1 border-b transition-colors ${
            mode === "write"
              ? "text-ink border-accent-sepia"
              : "text-faint-ink border-transparent hover:text-soft-ink"
          }`}
        >
          Write one
        </button>
        <button
          onClick={() => setMode("paste")}
          className={`font-sans text-sm pb-1 border-b transition-colors ${
            mode === "paste"
              ? "text-ink border-accent-sepia"
              : "text-faint-ink border-transparent hover:text-soft-ink"
          }`}
        >
          Paste a batch
        </button>
      </div>

      {/* Composer */}
      <div className="mb-12">
        {mode === "write" ? (
          <div className="flex flex-col gap-4">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="self-start bg-surface border border-border rounded-sm px-3 py-2 text-sm text-soft-ink font-sans focus:outline-none focus:ring-1 focus:ring-accent-sepia"
            />
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write the page as it was…"
              className="w-full min-h-[220px] bg-surface border border-border rounded-sm p-6 text-lg text-ink font-body placeholder:text-faint-ink focus:outline-none focus:ring-1 focus:ring-accent-sepia resize-none shadow-sm"
            />
            <button
              onClick={handleSaveOne}
              disabled={saving || !date || !text.trim()}
              className="self-start bg-ink hover:bg-deep-brown disabled:bg-faint-ink text-surface px-6 py-2.5 rounded-sm font-body text-base transition-colors"
            >
              {saving ? "Saving…" : "Save to archive"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <textarea
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              placeholder={"[2015-08-24]\nToday I felt…\n\n[2018-03-29]\nAnother page…"}
              className="w-full min-h-[260px] bg-surface border border-border rounded-sm p-6 text-base text-ink font-body placeholder:text-faint-ink focus:outline-none focus:ring-1 focus:ring-accent-sepia resize-none shadow-sm"
            />
            <div className="flex items-center gap-4">
              <button
                onClick={handleSaveBatch}
                disabled={saving || batchCount === 0}
                className="self-start bg-ink hover:bg-deep-brown disabled:bg-faint-ink text-surface px-6 py-2.5 rounded-sm font-body text-base transition-colors"
              >
                {saving
                  ? "Saving…"
                  : batchCount > 0
                    ? `Save ${batchCount} ${batchCount === 1 ? "entry" : "entries"}`
                    : "Save batch"}
              </button>
              <span className="text-xs font-sans text-faint-ink">
                Split on [YYYY-MM-DD] markers
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Read across */}
      <div className="flex flex-col gap-2 mb-12 border-t border-border pt-8">
        <button
          onClick={handleReadAcross}
          disabled={list.length === 0}
          className="self-start text-accent-sepia hover:text-deep-brown disabled:text-faint-ink font-body text-lg border-b border-accent-sepia/40 disabled:border-transparent pb-0.5 transition-colors"
        >
          Read across my entries
        </button>
        <span className="text-xs font-sans text-faint-ink">
          {list.length === 0
            ? "Add a page or two first."
            : `Yadegar will read across all ${list.length} ${list.length === 1 ? "page" : "pages"}.`}
        </span>
      </div>

      {/* The archive */}
      <div className="flex flex-col">
        <div className="flex items-baseline justify-between mb-4">
          <span className="text-[10px] font-sans tracking-widest uppercase text-faint-ink">
            {isLoading ? "Opening the archive…" : list.length === 0 ? "The archive is empty" : "Pages kept"}
          </span>
          {list.length > 0 && (
            <span className="text-[10px] font-sans text-faint-ink tracking-wide">
              {query.trim()
                ? `${filtered.length} of ${list.length}`
                : `${list.length} ${list.length === 1 ? "page" : "pages"}`}
            </span>
          )}
        </div>

        {list.length > 0 && (
          <>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by word or date, try 2018, 2018-03, or a phrase…"
              className="w-full bg-surface border border-border rounded-sm px-4 py-2.5 text-sm text-ink font-sans placeholder:text-faint-ink focus:outline-none focus:ring-1 focus:ring-accent-sepia mb-4"
            />

            {yearGroups.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {yearGroups.map(([year]) => (
                  <button
                    key={year}
                    onClick={() => jumpToYear(year)}
                    className="font-sans text-xs px-3 py-1 rounded-full border border-border text-soft-ink hover:text-ink hover:border-accent-sepia transition-colors"
                  >
                    {year}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {list.length > 0 && filtered.length === 0 && (
          <p className="font-body text-base text-faint-ink py-4">
            No pages match “{query.trim()}”.
          </p>
        )}

        {yearGroups.map(([year, items]) => (
          <div
            key={year}
            ref={(el) => {
              yearRefs.current[year] = el;
            }}
            className="flex flex-col scroll-mt-6"
          >
            <h2 className="font-display text-2xl text-deep-brown mt-6 mb-1 pt-2 border-t border-border first:border-0 first:pt-0">
              {year}
            </h2>
            {items.map((entry, i) => {
              const isOpen = expanded.has(entry.id);
              const firstLine = entry.body.trim().split("\n")[0];
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.4 }}
                  className="py-4 border-b border-border last:border-0"
                >
                  <button
                    onClick={() => toggle(entry.id)}
                    className="w-full text-left flex flex-col gap-1.5"
                  >
                    <span className="text-[11px] font-sans text-faint-ink tracking-wide">
                      {entry.entryDate ?? "Undated"}
                    </span>
                    {!isOpen && (
                      <p className="font-body text-base text-soft-ink leading-snug truncate">
                        {firstLine}
                      </p>
                    )}
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <p className="font-body text-base text-ink leading-relaxed whitespace-pre-wrap mt-1">
                          {entry.body}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

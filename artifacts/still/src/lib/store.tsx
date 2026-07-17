import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo } from "react";
import type {
  ScoreResult,
  ExtractResult,
} from "@workspace/api-client-react";

const HISTORY_KEY = "still:history";
const MAX_HISTORY = 5;

export interface HistoryEntry {
  id: string;
  result: ScoreResult;
  savedAt: string;
  sourceEntries?: Record<string, string>;
}

interface StillState {
  entries: string;
  setEntries: (entries: string) => void;
  parsedEntries: Record<string, string>;
  activeSourceEntries: Record<string, string>;
  extractResult: ExtractResult | null;
  setExtractResult: (result: ExtractResult | null) => void;
  scoreResult: ScoreResult | null;
  setScoreResult: (result: ScoreResult | null) => void;
  savedAt: Date | null;
  history: HistoryEntry[];
  deleteHistoryEntry: (id: string) => void;
  clearHistory: () => void;
  viewHistoryEntry: (entry: HistoryEntry) => void;
  reset: () => void;
}

function parseEntries(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  const regex = /\[(\d{4}-\d{2}-\d{2})\]/g;
  const matches = [...raw.matchAll(regex)];
  matches.forEach((match, i) => {
    const date = match[1];
    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? raw.length) : raw.length;
    result[date] = raw.slice(start, end).trim();
  });
  return result;
}

// Lossless variant for the persistence path: splits a batch on [YYYY-MM-DD]
// markers but stores each block's text EXACTLY as written, no trimming,
// no normalization. Only the date marker itself and the single line break
// that ends the marker line are dropped (they are format, not content).
export function parseEntriesVerbatim(
  raw: string,
): { date: string; text: string }[] {
  const result: { date: string; text: string }[] = [];
  const regex = /\[(\d{4}-\d{2}-\d{2})\]/g;
  const matches = [...raw.matchAll(regex)];
  matches.forEach((match, i) => {
    const date = match[1];
    let start = (match.index ?? 0) + match[0].length;
    // Drop only the line break that terminates the "[date]" marker line.
    if (raw[start] === "\r") start += 1;
    if (raw[start] === "\n") start += 1;
    const end =
      i + 1 < matches.length ? (matches[i + 1].index ?? raw.length) : raw.length;
    result.push({ date, text: raw.slice(start, end) });
  });
  return result;
}

const StillContext = createContext<StillState | undefined>(undefined);

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

function persistHistory(history: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
  }
}

export function StillProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState("");
  const [extractResult, setExtractResult] = useState<ExtractResult | null>(null);
  const [scoreResult, setScoreResultState] = useState<ScoreResult | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeSourceEntries, setActiveSourceEntries] = useState<Record<string, string>>({});

  const parsedEntries = useMemo(() => parseEntries(entries), [entries]);

  useEffect(() => {
    const saved = loadHistory();
    setHistory(saved);
    if (saved.length > 0) {
      const latest = saved[0];
      setScoreResultState(latest.result);
      setSavedAt(new Date(latest.savedAt));
      setActiveSourceEntries(latest.sourceEntries ?? {});
    }
  }, []);

  const setScoreResult = (result: ScoreResult | null) => {
    setScoreResultState(result);
    if (result) {
      const now = new Date();
      setSavedAt(now);
      const sourceEntries = parseEntries(entries);
      setActiveSourceEntries(sourceEntries);
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        result,
        savedAt: now.toISOString(),
        sourceEntries,
      };
      setHistory((prev) => {
        const next = [entry, ...prev].slice(0, MAX_HISTORY);
        persistHistory(next);
        return next;
      });
    } else {
      setActiveSourceEntries({});
    }
  };

  const deleteHistoryEntry = (id: string) => {
    setHistory((prev) => {
      const next = prev.filter((e) => e.id !== id);
      persistHistory(next);
      if (scoreResult && prev.find((e) => e.id === id)?.result === scoreResult) {
        setScoreResultState(next.length > 0 ? next[0].result : null);
        setSavedAt(next.length > 0 ? new Date(next[0].savedAt) : null);
        setActiveSourceEntries(next.length > 0 ? next[0].sourceEntries ?? {} : {});
      }
      return next;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    persistHistory([]);
    setScoreResultState(null);
    setSavedAt(null);
    setActiveSourceEntries({});
  };

  const viewHistoryEntry = (entry: HistoryEntry) => {
    setScoreResultState(entry.result);
    setSavedAt(new Date(entry.savedAt));
    setActiveSourceEntries(entry.sourceEntries ?? {});
  };

  const reset = () => {
    setEntries("");
    setExtractResult(null);
    setScoreResultState(null);
    setSavedAt(null);
    setActiveSourceEntries({});
  };

  return (
    <StillContext.Provider
      value={{
        entries,
        setEntries,
        parsedEntries,
        activeSourceEntries,
        extractResult,
        setExtractResult,
        scoreResult,
        setScoreResult,
        savedAt,
        history,
        deleteHistoryEntry,
        clearHistory,
        viewHistoryEntry,
        reset,
      }}
    >
      {children}
    </StillContext.Provider>
  );
}

export function useStill() {
  const context = useContext(StillContext);
  if (context === undefined) {
    throw new Error("useStill must be used within a StillProvider");
  }
  return context;
}

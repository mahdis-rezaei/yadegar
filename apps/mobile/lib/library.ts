import { api } from "./api";

// Library data: the full entry list, the archival "continuity" stats card, and
// the favorite / bulk-delete / sample-clear actions the web Library offers.

export interface Continuity {
  pageCount: number;
  writingSinceYear: number | null;
  spanYears: number | null;
  oldestPageAgeYears: number | null;
  reflectionCount: number;
  oldestImportedAgeYears: number | null;
  wroteFirstReflectionToday: boolean;
}

export const getContinuity = () => api<Continuity>("/continuity");

export interface LibraryEntry {
  id: string;
  title?: string | null;
  body: string;
  entryDate: string | null;
  source: string;
  favorite?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const listAllEntries = () => api<LibraryEntry[]>("/entries");

export const setFavorite = (id: string, favorite: boolean) =>
  api(`/entries/${id}`, { method: "PATCH", body: { favorite } });

export const bulkDeleteEntries = (ids: string[]) =>
  api<{ deletedCount: number }>("/entries/bulk-delete", {
    method: "POST",
    body: { ids },
  });

export const clearSampleEntries = () =>
  api("/entries/samples", { method: "DELETE" });

// The three kinds a person thinks in (mirrors the web's sourceKind).
export type SourceKind = "written" | "imported" | "sample";
export function sourceKind(source: string): SourceKind {
  if (source === "sample") return "sample";
  if (source === "manual") return "written";
  return "imported";
}

export const SOURCE_LABELS: Record<string, string> = {
  pasted_import: "imported",
  file_import: "imported",
  google_doc: "google doc",
  sample: "sample",
};

import { api } from "./api";

// API layer for the "browse + keepsake" features ported from web:
// Collections, Shelf, Capsules, Year in Pages, and the month browser (Calendar).
// All on existing backend endpoints (no second engine, no backend changes).

// --- Shared shapes ---
export interface EntryRef {
  entryId: string;
  title: string | null;
  excerpt: string;
  entryDate: string | null;
}

export interface CalendarEntry {
  id: string;
  title?: string | null;
  body: string;
  entryDate: string | null;
  source: string;
  favorite?: boolean;
}

// --- Calendar (month browser, over /entries?year=&month=) ---
export const getMonthEntries = (year: number, month: number) =>
  api<CalendarEntry[]>(`/entries?year=${year}&month=${month}`);

// --- Collections ---
export type CollectionKind =
  | "person"
  | "place"
  | "theme"
  | "thought"
  | "pair"
  | "custom";

export interface Collection {
  id: string;
  name: string;
  kind: CollectionKind;
  itemCount: number;
  containsEntry?: boolean;
}

export interface CollectionDetail {
  id: string;
  name: string;
  kind: CollectionKind;
  items: EntryRef[];
}

export const listCollections = () => api<Collection[]>("/collections");
export const getCollection = (id: string) =>
  api<CollectionDetail>(`/collections/${id}`);
export const createCollection = (name: string, kind: CollectionKind = "custom") =>
  api<Collection>("/collections", { method: "POST", body: { name, kind } });
export const deleteCollection = (id: string) =>
  api(`/collections/${id}`, { method: "DELETE" });
// Add a page to a collection (idempotent server-side).
export const addToCollection = (collectionId: string, entryId: string) =>
  api(`/collections/${collectionId}/items`, {
    method: "POST",
    body: { entryId },
  });

// --- Shelf ---
export interface ShelfItem extends EntryRef {
  favorite: boolean;
}
export const getShelf = () => api<ShelfItem[]>("/shelf");
export const addToShelf = (entryId: string) =>
  api("/shelf", { method: "POST", body: { entryId } });
export const removeFromShelf = (entryId: string) =>
  api(`/shelf/${entryId}`, { method: "DELETE" });

// --- Capsules (sealed letters to your future self) ---
export interface Capsule {
  id: string;
  createdAt: string;
  deliverAt: string;
  delivered: boolean;
  openedAt: string | null;
  body: string | null; // withheld until delivered
}
export const listCapsules = () => api<Capsule[]>("/capsules");
export const createCapsule = (body: string, deliverAt: string) =>
  api<Capsule>("/capsules", { method: "POST", body: { body, deliverAt } });
export const openCapsule = (id: string) =>
  api<Capsule>(`/capsules/${id}`, { method: "PATCH", body: { opened: true } });

// --- Year in Pages (letters/:year) ---
export interface YearInPages {
  year: number;
  pageCount: number;
  reflectionCount: number;
  favorites: EntryRef[];
}
export const getYearInPages = (year: number) =>
  api<YearInPages>(`/letters/${year}`);

// --- shared formatters ---
export function longDate(iso?: string | null): string {
  if (!iso) return "Undated";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

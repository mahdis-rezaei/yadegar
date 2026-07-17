import {
  pgTable,
  uuid,
  text,
  date,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { encryptedText } from "./encrypted";

export type EntrySource =
  | "manual"
  | "pasted_import"
  | "file_import"
  | "google_doc"
  | "sample";

export type ResurfacingPreference = "normal" | "more_often" | "never";

// Per-entry safety verdict for DATE-BASED resurfacing ("On this day", etc.).
// Computed once by the engine (POST /still/classify) and stored, so the
// date-based surfacer is a pure DB query and never makes a live model call.
// NULL = not yet classified → treated as NOT eligible (fail-safe). Only
// `safe === true` is ever surfaced. `version` is the engine PROMPT_VERSION the
// verdict was computed under, so a policy change can null these out and re-tag.
export type ResurfaceSafetyReason = "crisis" | "hard_floor";
export interface ResurfaceSafety {
  safe: boolean;
  reason: ResurfaceSafetyReason | null;
  version: string;
  classifiedAt: string;
}

// Every journal page. entry_date is intentionally NULLABLE: real lifelong
// archives contain genuinely undated pages, which live in an "undated" group
// rather than being forced a false date. The engine reads dates as
// "YYYY-MM-DD" strings, which is exactly how the `date` column serializes.
export const journalEntriesTable = pgTable("journal_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  title: encryptedText("title"),
  body: encryptedText("body").notNull(),
  // Optional rich-text layer: sanitized HTML the writer composed (bold, italic,
  // headings, lists, blockquote, muted text colors). `body` above stays the
  // canonical PLAIN TEXT — derived from this on the server — so the memory
  // engine, resurfacing excerpts, and exports never see markup. NULL = a plain
  // entry (render `body`). Encrypted at rest like the rest of the page.
  bodyRich: encryptedText("body_rich"),
  entryDate: date("entry_date"),
  source: text("source").$type<EntrySource>().notNull().default("manual"),
  sourceDocumentId: uuid("source_document_id"),
  sourceTitle: text("source_title"),
  favorite: boolean("favorite").notNull().default(false),
  resurfacingPreference: text("resurfacing_preference")
    .$type<ResurfacingPreference>()
    .notNull()
    .default("normal"),
  // Date-based-resurfacing safety verdict; NULL until the classifier cron tags
  // it. See ResurfaceSafety above. Reset to NULL whenever the body changes.
  resurfaceSafety: jsonb("resurface_safety").$type<ResurfaceSafety>(),
  // When the full page was last opened/read. NULL = never opened. Drives the
  // "Forgotten Page" surfacer (a page you haven't seen in a long while).
  lastOpenedAt: timestamp("last_opened_at", { withTimezone: true }),
  // Engine V2: a topical theme tag (home, family, grief, work…) — a shelf label,
  // NEVER a judgment. Tagged once by the classifier cron (NULL until tagged).
  // Powers diversity rotation in selection. See lib/themes.
  theme: text("theme"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  metadata: jsonb("metadata"),
});

export type JournalEntry = typeof journalEntriesTable.$inferSelect;
export type InsertJournalEntry = typeof journalEntriesTable.$inferInsert;

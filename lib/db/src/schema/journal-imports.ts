import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { encryptedText } from "./encrypted";

export type ImportSource = "paste" | "txt" | "markdown" | "google_doc";
export type ImportStatus =
  | "parsing"
  | "review"
  | "imported"
  | "failed"
  | "cancelled";

// One import session: raw text in, parsed candidates reviewed, then confirmed
// into journal_entries.
export const journalImportsTable = pgTable("journal_imports", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  source: text("source").$type<ImportSource>().notNull(),
  originalFilename: text("original_filename"),
  googleDocId: text("google_doc_id"),
  googleDocTitle: text("google_doc_title"),
  status: text("status").$type<ImportStatus>().notNull(),
  rawText: encryptedText("raw_text"),
  parsedCount: integer("parsed_count").notNull().default(0),
  importedCount: integer("imported_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type JournalImport = typeof journalImportsTable.$inferSelect;
export type InsertJournalImport = typeof journalImportsTable.$inferInsert;

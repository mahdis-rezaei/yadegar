import {
  pgTable,
  uuid,
  text,
  date,
  boolean,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { journalImportsTable } from "./journal-imports";
import { encryptedText } from "./encrypted";

export type DateConfidence = "high" | "medium" | "low" | "unknown";

// Staging rows shown for review before the user confirms an import. Confirmed
// rows become journal_entries; this table is transient working state.
export const parsedImportEntriesTable = pgTable("parsed_import_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  importId: uuid("import_id")
    .notNull()
    .references(() => journalImportsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  detectedDate: date("detected_date"),
  dateConfidence: text("date_confidence").$type<DateConfidence>().notNull(),
  body: encryptedText("body").notNull(),
  title: encryptedText("title"),
  include: boolean("include").notNull().default(true),
  orderIndex: integer("order_index"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ParsedImportEntry = typeof parsedImportEntriesTable.$inferSelect;
export type InsertParsedImportEntry =
  typeof parsedImportEntriesTable.$inferInsert;

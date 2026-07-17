import { pgTable, uuid, date, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { journalEntriesTable } from "./journal-entries";
import { encryptedText } from "./encrypted";

// A reflection written about an old entry — "letters across time." The original
// journal entry is never modified; a reflection is a separate linked object.
export const reflectionsTable = pgTable("reflections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  journalEntryId: uuid("journal_entry_id")
    .notNull()
    .references(() => journalEntriesTable.id, { onDelete: "cascade" }),
  body: encryptedText("body").notNull(),
  reflectionDate: date("reflection_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export type Reflection = typeof reflectionsTable.$inferSelect;
export type InsertReflection = typeof reflectionsTable.$inferInsert;

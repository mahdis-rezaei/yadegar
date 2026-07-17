import {
  pgTable,
  uuid,
  integer,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { journalEntriesTable } from "./journal-entries";

// The Memory Shelf: a small, intentionally-curated set of pages the user wants
// nearby RIGHT NOW. Distinct from Favorites ("this mattered," can be hundreds) —
// the shelf is "this is meaningful to me lately" and stays small. order_index
// exists so manual drag-ordering can be added later without a migration. A user
// can shelve a given page only once (unique on user + entry).
export const shelfItemsTable = pgTable(
  "shelf_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    journalEntryId: uuid("journal_entry_id")
      .notNull()
      .references(() => journalEntriesTable.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userEntryUnique: uniqueIndex("shelf_user_entry_unique").on(
      t.userId,
      t.journalEntryId,
    ),
  }),
);

export type ShelfItem = typeof shelfItemsTable.$inferSelect;
export type InsertShelfItem = typeof shelfItemsTable.$inferInsert;

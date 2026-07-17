import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { journalEntriesTable } from "./journal-entries";

// Collections are the unifying primitive behind People, Places, Themes,
// Continuity-of-a-thought, and Before & After: a user-named group of pages,
// shown chronologically. Pure curation + retrieval — never AI judgment. `kind`
// lets the UI file and frame them ("People," a side-by-side "pair," a thought
// over time). Auto-suggesting members is a future engine enhancement; the tables
// don't change for it.
export type CollectionKind =
  | "person"
  | "place"
  | "theme"
  | "thought"
  | "pair"
  | "custom";

export const collectionsTable = pgTable("collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: text("kind").$type<CollectionKind>().notNull().default("custom"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const collectionItemsTable = pgTable(
  "collection_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collectionsTable.id, { onDelete: "cascade" }),
    journalEntryId: uuid("journal_entry_id")
      .notNull()
      .references(() => journalEntriesTable.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    collEntryUnique: uniqueIndex("collection_item_unique").on(
      t.collectionId,
      t.journalEntryId,
    ),
  }),
);

export type Collection = typeof collectionsTable.$inferSelect;
export type InsertCollection = typeof collectionsTable.$inferInsert;
export type CollectionItem = typeof collectionItemsTable.$inferSelect;

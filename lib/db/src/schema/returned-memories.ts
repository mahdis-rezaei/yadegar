import {
  pgTable,
  uuid,
  text,
  date,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { journalEntriesTable } from "./journal-entries";
import { encryptedText } from "./encrypted";

// A memory the engine surfaced. Persisted only for real lenses — never
// `crisis` (→ a support response, not a memory) or `nothing` (→ honest
// silence). All resurfacing goes through the engine, so its safety gates apply.
export type MemoryLens =
  | "memory"
  | "thread"
  | "distance"
  | "wisdom"
  | "value_signal"
  | "becoming"
  | "survival";

export const returnedMemoriesTable = pgTable("returned_memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  journalEntryId: uuid("journal_entry_id").references(
    () => journalEntriesTable.id,
    { onDelete: "set null" },
  ),
  engineRunId: uuid("engine_run_id"),
  label: encryptedText("label"),
  observation: encryptedText("observation"),
  quote: encryptedText("quote"),
  quoteDate: date("quote_date"),
  lens: text("lens").$type<MemoryLens>(),
  // Engine V2: the surfaced page's topical theme (a shelf label, never a
  // judgment) — copied from the entry's theme at surface time. Powers diversity
  // rotation (don't over-surface one theme). Nullable for legacy rows.
  theme: text("theme"),
  fullEngineResponse: jsonb("full_engine_response"),
  dismissed: boolean("dismissed").notNull().default(false),
  favorite: boolean("favorite").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  openedAt: timestamp("opened_at", { withTimezone: true }),
});

export type ReturnedMemory = typeof returnedMemoriesTable.$inferSelect;
export type InsertReturnedMemory = typeof returnedMemoriesTable.$inferInsert;

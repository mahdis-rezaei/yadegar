import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

// Result cache for the two-pass engine. The key is a SHA-256 of
// stage + PROMPT_VERSION + MODEL + payload, so a cache hit is always correct
// for the current prompt — stale-version entries simply never match and get
// recomputed. This is a performance cache only; losing it costs a recompute,
// not data.
//
// Matches the live DB exactly: cache_key is the primary key (unique + not
// null); there is no separate id column.
export const stillResultsTable = pgTable("still_results", {
  cacheKey: text("cache_key").primaryKey(),
  result: jsonb("result").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type StillResult = typeof stillResultsTable.$inferSelect;
export type InsertStillResult = typeof stillResultsTable.$inferInsert;

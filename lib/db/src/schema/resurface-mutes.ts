import { pgTable, uuid, date, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// A muted date range. Pages whose entry_date falls within [startDate, endDate]
// are never resurfaced — by any date-based surfacer or the engine — without
// being deleted. This is the gentle "don't bring back this season" control (for
// a grief window, a hard year), removable at any time. The user owns what
// returns.
export const resurfaceMutesTable = pgTable("resurface_mutes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ResurfaceMute = typeof resurfaceMutesTable.$inferSelect;
export type InsertResurfaceMute = typeof resurfaceMutesTable.$inferInsert;

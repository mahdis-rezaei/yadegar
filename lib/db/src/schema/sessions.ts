import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Server-side sessions. `id` stores a SHA-256 hash of the opaque token that
// lives in the httpOnly cookie — so a database read never exposes a usable
// credential. Expired rows are ignored on lookup and pruned on logout.
export const sessionsTable = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Session = typeof sessionsTable.$inferSelect;
export type InsertSession = typeof sessionsTable.$inferInsert;

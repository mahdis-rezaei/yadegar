import { pgTable, uuid, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { encryptedText } from "./encrypted";

// A Memory Capsule: a sealed letter to a future self. Written once and SEALED —
// never editable. The body stays hidden (the API withholds it) until deliver_at
// passes and the cron delivers it; then it can be opened and read. Encrypted at
// rest like every other piece of journal text.
export const capsulesTable = pgTable("capsules", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  body: encryptedText("body").notNull(),
  deliverAt: timestamp("deliver_at", { withTimezone: true }).notNull(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Capsule = typeof capsulesTable.$inferSelect;
export type InsertCapsule = typeof capsulesTable.$inferInsert;

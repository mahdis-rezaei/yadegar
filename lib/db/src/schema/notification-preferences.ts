import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export type NudgeFrequency = "off" | "weekly" | "monthly";

// One row per user. Both nudges default to OFF (privacy-respecting for real
// users; never guilt-based). lastSent timestamps bound how often the cron sends.
export const notificationPreferencesTable = pgTable(
  "notification_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    // A gentle reminder to write ("what wants to be written today?").
    writingFrequency: text("writing_frequency")
      .$type<NudgeFrequency>()
      .notNull()
      .default("off"),
    // A page Yadegar brings back, by email ("a page worth returning to").
    memoryFrequency: text("memory_frequency")
      .$type<NudgeFrequency>()
      .notNull()
      .default("off"),
    lastWritingNudgeAt: timestamp("last_writing_nudge_at", {
      withTimezone: true,
    }),
    lastMemoryNudgeAt: timestamp("last_memory_nudge_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export type NotificationPreference =
  typeof notificationPreferencesTable.$inferSelect;
export type InsertNotificationPreference =
  typeof notificationPreferencesTable.$inferInsert;

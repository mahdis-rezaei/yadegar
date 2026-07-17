import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export type DevicePlatform = "ios" | "android";

// One row per registered device push token (Expo push tokens, e.g.
// "ExponentPushToken[...]"). A user can have several (phone + tablet). The token
// is unique so re-registering the same device upserts rather than duplicating;
// it's also the natural key the Expo Push API addresses. Pruned when Expo reports
// the token is no longer valid (DeviceNotRegistered) — see lib/push.ts. Mobile
// only; the web uses email nudges. Additive table — safe drizzle-kit push.
export const deviceTokensTable = pgTable("device_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  // The Expo push token. Unique so the same device never registers twice.
  token: text("token").notNull().unique(),
  platform: text("platform").$type<DevicePlatform>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // Bumped on every re-register so a stale token can be aged out later.
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type DeviceToken = typeof deviceTokensTable.$inferSelect;
export type InsertDeviceToken = typeof deviceTokensTable.$inferInsert;

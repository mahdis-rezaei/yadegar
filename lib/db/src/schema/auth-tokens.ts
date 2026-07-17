import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export type AuthTokenKind = "email_verify" | "password_reset";

// Single-use, expiring tokens for email verification and password reset. We
// store only a SHA-256 hash of the token; the raw token lives only in the
// emailed link, so a DB read never yields a usable token. Marked used on
// redemption.
export const authTokensTable = pgTable("auth_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  kind: text("kind").$type<AuthTokenKind>().notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AuthToken = typeof authTokensTable.$inferSelect;
export type InsertAuthToken = typeof authTokensTable.$inferInsert;

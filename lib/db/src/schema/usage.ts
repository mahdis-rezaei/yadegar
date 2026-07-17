import {
  pgTable,
  uuid,
  integer,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Per-user, per-month usage of the paid unit — a "fresh AI return" (a
// /memories/run that actually called the model, i.e. a cache miss). This is the
// basis for COGS visibility and (later) free-tier quota. Cache hits, re-opens,
// and date-based returns are free and never recorded here.
export const usageTable = pgTable(
  "usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    // First day of the month (UTC) this row aggregates.
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    // Billable returns for quota: rapid re-rolls of the same surfacing collapse
    // to one, and auto/preview/cron runs don't count (they still record cost).
    freshReturns: integer("fresh_returns").notNull().default(0),
    // True spend, every model call (re-rolls included).
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    estCostCents: integer("est_cost_cents").notNull().default(0),
    // When the last billable return was counted — used to collapse rapid
    // re-rolls (fresh:true clicks) into a single return.
    lastReturnAt: timestamp("last_return_at", { withTimezone: true }),
    // When we last emailed this user that they'd reached the month's free limit,
    // so the "you've hit your returns" lifecycle email fires at most once a period.
    limitNotifiedAt: timestamp("limit_notified_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({ uq: unique().on(t.userId, t.periodStart) }),
);

export type Usage = typeof usageTable.$inferSelect;

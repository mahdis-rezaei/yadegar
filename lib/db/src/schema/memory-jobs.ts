import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Async memory surfacing (ADR 0002). A long engine read — "Bring a page back"
// (~130s) or the voiced "On this day" (~10-67s) — runs DETACHED from the HTTP
// request: the client enqueues a job and polls, so no request hangs for minutes
// (autoscale timeout) and the user can leave and come back. Processed by an
// optimistic in-process start with a cron backstop for durability.
export type MemoryJobKind = "run" | "on_this_day";
export type MemoryJobStatus = "queued" | "running" | "done" | "error";

export const memoryJobsTable = pgTable("memory_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  kind: text("kind").$type<MemoryJobKind>().notNull(),
  // Inputs for the run (e.g. { date } for on_this_day; {} for a plain run).
  params: jsonb("params").notNull().default({}),
  // An identical job already queued/running is reused, not duplicated.
  dedupeKey: text("dedupe_key"),
  status: text("status").$type<MemoryJobStatus>().notNull().default("queued"),
  // The MemoryRunOutcome (or framed result) once finished.
  result: jsonb("result"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export type MemoryJob = typeof memoryJobsTable.$inferSelect;
export type InsertMemoryJob = typeof memoryJobsTable.$inferInsert;

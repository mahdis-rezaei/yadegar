import { and, eq, inArray, lt } from "drizzle-orm";
import { db, memoryJobsTable, type MemoryJob } from "@workspace/db";
import { runMemoryForUser } from "./memory-engine";

// Async memory surfacing (ADR 0002). A long engine read runs detached from the
// HTTP request: enqueue → poll. Processing = an optimistic in-process start (the
// fast path) plus a cron backstop (sweepMemoryJobs) for durability. The job row
// stores only a POINTER (the persisted returned_memory id) or a "nothing"
// verdict — never decrypted memory content — so plaintext never lands in
// memory_jobs.

// A 'run' legitimately takes ~minutes; only treat a 'running' job as dead (its
// instance was reclaimed) after this, so the backstop never double-runs a live one.
const STALE_RUNNING_MS = 5 * 60_000;

// Enqueue a job, reusing an in-flight identical one (dedupeKey) so a double-tap
// or a re-render never starts two engine reads. Kicks off processing
// optimistically in-process; the backstop covers a dropped start.
export async function enqueueMemoryJob(
  userId: string,
  kind: "run" | "on_this_day",
  params: Record<string, unknown>,
  dedupeKey: string,
  // Bulk warming enqueues many at once and lets the backstop drain them, so it
  // passes false to skip the optimistic in-process start (no thundering herd).
  optimistic = true,
): Promise<string> {
  const existing = await db
    .select({ id: memoryJobsTable.id })
    .from(memoryJobsTable)
    .where(
      and(
        eq(memoryJobsTable.userId, userId),
        eq(memoryJobsTable.dedupeKey, dedupeKey),
        inArray(memoryJobsTable.status, ["queued", "running"]),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0].id;

  const [row] = await db
    .insert(memoryJobsTable)
    .values({ userId, kind, params, dedupeKey })
    .returning({ id: memoryJobsTable.id });

  // Fast path: start immediately. Errors are caught and surfaced via the job row.
  if (optimistic) void processMemoryJob(row.id).catch(() => {});
  return row.id;
}

// Atomically claim a queued job (one worker wins the UPDATE…WHERE status=queued)
// and run it. Safe to call from both the optimistic start and the backstop.
export async function processMemoryJob(jobId: string): Promise<void> {
  const [job] = await db
    .update(memoryJobsTable)
    .set({ status: "running", startedAt: new Date() })
    .where(
      and(eq(memoryJobsTable.id, jobId), eq(memoryJobsTable.status, "queued")),
    )
    .returning();
  if (!job) return; // already claimed / not queued

  try {
    const result = await runJob(job);
    await db
      .update(memoryJobsTable)
      .set({ status: "done", result, finishedAt: new Date() })
      .where(eq(memoryJobsTable.id, jobId));
  } catch (err) {
    await db
      .update(memoryJobsTable)
      .set({ status: "error", error: String(err), finishedAt: new Date() })
      .where(eq(memoryJobsTable.id, jobId));
  }
}

async function runJob(job: MemoryJob): Promise<Record<string, unknown>> {
  const params = (job.params ?? {}) as Record<string, unknown>;
  if (job.kind === "run") {
    const out = await runMemoryForUser(
      job.userId,
      params as Parameters<typeof runMemoryForUser>[1],
    );
    return out.surfaced && out.memory
      ? { surfaced: true, memoryId: out.memory.id }
      : {
          surfaced: false,
          reason: out.reason ?? "nothing",
          supportMessage: out.supportMessage ?? null,
        };
  }
  if (job.kind === "on_this_day") {
    // Warm the engine cache for the voiced On-this-day; the /on-this-day/framed
    // endpoint then serves from cache (instant). No content stored on the job.
    const entryIds = Array.isArray(params.entryIds)
      ? (params.entryIds as string[])
      : [];
    if (entryIds.length > 0) {
      await runMemoryForUser(job.userId, { entryIds, preview: true });
    }
    return { warmed: true };
  }
  throw new Error(`unknown memory job kind: ${job.kind}`);
}

// Backstop: reset jobs stuck 'running' past the stale window (instance died)
// back to 'queued', then KICK pending ones fire-and-forget so the cron returns
// immediately — no long request, so no client-timeout / failure-email noise on
// cron-job.org. The optimistic start handles the common case; a job whose start
// was dropped is re-kicked on the next tick (and recovered from a dead 'running'
// via the stale reset). Bounded per tick to cap concurrent engine reads.
export async function sweepMemoryJobs(limit = 3): Promise<{ kicked: number }> {
  const staleBefore = new Date(Date.now() - STALE_RUNNING_MS);
  await db
    .update(memoryJobsTable)
    .set({ status: "queued", startedAt: null })
    .where(
      and(
        eq(memoryJobsTable.status, "running"),
        lt(memoryJobsTable.startedAt, staleBefore),
      ),
    );

  const queued = await db
    .select({ id: memoryJobsTable.id })
    .from(memoryJobsTable)
    .where(eq(memoryJobsTable.status, "queued"))
    .orderBy(memoryJobsTable.createdAt)
    .limit(limit);

  for (const { id } of queued) void processMemoryJob(id).catch(() => {});
  return { kicked: queued.length };
}

export async function getMemoryJob(
  userId: string,
  jobId: string,
): Promise<MemoryJob | null> {
  const [row] = await db
    .select()
    .from(memoryJobsTable)
    .where(
      and(eq(memoryJobsTable.id, jobId), eq(memoryJobsTable.userId, userId)),
    )
    .limit(1);
  return row ?? null;
}

import { and, eq, sql } from "drizzle-orm";
import { db, usageTable } from "@workspace/db";

// Rapid re-rolls of the same surfacing (the "look again" / "show another" buttons
// send fresh:true, forcing a real model call each click) collapse into ONE
// billable return within this window — so a user exploring doesn't burn quota,
// while the token cost of each call is still recorded.
export const REROLL_WINDOW_MS = 10 * 60 * 1000;

// Sonnet 4.6 list price (USD per 1M tokens). Prompt caching splits input into
// three tiers: uncached (full), cache-read (~0.1x), cache-write (~1.25x). Update
// if the model/pricing moves.
const USD_PER_M_INPUT = 3;
const USD_PER_M_CACHE_READ = 0.3;
const USD_PER_M_CACHE_WRITE = 3.75;
const USD_PER_M_OUTPUT = 15;

export function monthStartUTC(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

// Record a memory run for COGS + (later) quota. ONLY real model calls (cache
// misses) are metered — cache hits / re-opens / date-based returns are free and
// never recorded. Token cost accrues on every model call; `freshReturns` (the
// quota unit) increments only for a user-initiated, non-re-roll return.
export async function recordRun(
  userId: string,
  opts: {
    modelCalled: boolean;
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
    // "user" counts toward the return quota; "auto" (cron nudges, On-This-Day
    // previews) records cost only.
    kind?: "user" | "auto";
  },
): Promise<void> {
  if (!opts.modelCalled) return;
  const input = Math.max(0, Math.round(opts.inputTokens ?? 0));
  const output = Math.max(0, Math.round(opts.outputTokens ?? 0));
  const cacheRead = Math.max(0, Math.round(opts.cacheReadTokens ?? 0));
  const cacheCreate = Math.max(0, Math.round(opts.cacheCreationTokens ?? 0));
  const costCents = Math.round(
    ((input / 1e6) * USD_PER_M_INPUT +
      (cacheRead / 1e6) * USD_PER_M_CACHE_READ +
      (cacheCreate / 1e6) * USD_PER_M_CACHE_WRITE +
      (output / 1e6) * USD_PER_M_OUTPUT) *
      100,
  );
  // Store total input volume processed (billed at any tier) for visibility.
  const inputTotal = input + cacheRead + cacheCreate;
  const now = new Date();
  const period = monthStartUTC(now);

  // A new billable return? — user-initiated, and not a rapid re-roll of the one
  // we just counted.
  const [existing] = await db
    .select({ lastReturnAt: usageTable.lastReturnAt })
    .from(usageTable)
    .where(
      and(eq(usageTable.userId, userId), eq(usageTable.periodStart, period)),
    );
  const lastMs = existing?.lastReturnAt
    ? new Date(existing.lastReturnAt).getTime()
    : 0;
  const counts =
    opts.kind !== "auto" && now.getTime() - lastMs > REROLL_WINDOW_MS;
  const inc = counts ? 1 : 0;

  await db
    .insert(usageTable)
    .values({
      userId,
      periodStart: period,
      freshReturns: inc,
      inputTokens: inputTotal,
      outputTokens: output,
      estCostCents: costCents,
      lastReturnAt: counts ? now : (existing?.lastReturnAt ?? null),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [usageTable.userId, usageTable.periodStart],
      set: {
        freshReturns: sql`${usageTable.freshReturns} + ${inc}`,
        inputTokens: sql`${usageTable.inputTokens} + ${inputTotal}`,
        outputTokens: sql`${usageTable.outputTokens} + ${output}`,
        estCostCents: sql`${usageTable.estCostCents} + ${costCents}`,
        lastReturnAt: counts ? now : sql`${usageTable.lastReturnAt}`,
        updatedAt: now,
      },
    });
}

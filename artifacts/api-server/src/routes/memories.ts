import { Router } from "express";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import {
  db,
  journalEntriesTable,
  returnedMemoriesTable,
  type ReturnedMemory,
} from "@workspace/db";
import { UpdateMemoryBody, RunMemoryBody } from "@workspace/api-zod";
import type { Request, Response, NextFunction } from "express";
import { requireAuth } from "../lib/auth";
import { rateLimit } from "../lib/rate-limit";
import { runMemoryForUser } from "../lib/memory-engine";
import { enqueueMemoryJob, getMemoryJob } from "../lib/memory-jobs";
import {
  assertCanRunMemory,
  QuotaExceeded,
  QUOTA_ENFORCED,
} from "../lib/quota";

// ADR 0002: when on, long reads run as background jobs (enqueue + poll) instead
// of blocking the request. Off → the synchronous path below, byte-identical to
// before, so this is a clean dark-ship + instant rollback.
function asyncMemoryEnabled(): boolean {
  return process.env.ASYNC_MEMORY === "on";
}
import {
  onThisDayForUser,
  aroundThisTimeForUser,
  onThisDayFramedSet,
  favoritesForUser,
  forgottenForUser,
} from "../lib/on-this-day";

const router = Router();
// Scope auth to /memories only — a path-less use would 401 the internal,
// cookieless /still/* engine calls that run through this root-mounted router.
router.use("/memories", requireAuth);

// /memories/run is the costly path (two LLM calls). Cap per user to protect
// against runaway cost. requireAuth runs first, so req.userId is set.
const runLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyOf: (req) => req.userId ?? "anon",
  message: "You've brought back many pages just now — give it a little while.",
});

// Free-tier quota gate for the billable run paths (Phase 1). Runs AFTER runLimiter
// and requireAuth (so req.user is set). The counter itself lives in usage.ts and
// only increments on a real model call (re-rolls collapsed) — this gate just reads
// it and decides whether the NEXT user run is allowed. SHADOW by default: it never
// blocks, so behavior is byte-identical until STILL_QUOTA_ENFORCED=1, at which
// point a free user past their monthly allowance gets a gentle 402 (quota_exceeded)
// — never a 500, and the journal/returns shelf stay fully reachable.
async function quotaGate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const summary = await assertCanRunMemory(req.user!);
    if (summary.overCap) {
      // Visible in logs whether or not we're enforcing, so we can watch real
      // demand against the cap (free allowance OR member fair-use) before any wall.
      req.log.info(
        {
          userId: req.userId,
          plan: summary.plan,
          used: summary.used,
          enforced: QUOTA_ENFORCED,
        },
        "Fresh-return quota at/over cap",
      );
    }
    next();
  } catch (err) {
    if (err instanceof QuotaExceeded) {
      // A free user hit their monthly allowance; a member hit the fair-use ceiling
      // — different, gentler copy for someone who's already paying.
      const message =
        err.summary.plan === "member"
          ? "You've brought back an unusual number of pages this month — to keep the engine healthy we've paused new returns for a little while. Everything you've saved stays open, and new returns resume next cycle. (Reply to any Yadegar email if this is genuinely your pace and we'll sort it out.)"
          : "You've used this month's returns. Revisiting what's already returned to you is always free — and Yadegar can keep reading across your years.";
      res.status(402).json({
        error: "quota_exceeded",
        code: "quota_exceeded",
        message,
        usage: {
          plan: err.summary.plan,
          used: err.summary.used,
          limit: err.summary.limit,
          periodStart: err.summary.periodStart,
        },
      });
      return;
    }
    next(err);
  }
}

// The public shape — never leak userId, engineRunId, or the full engine trace.
function toMemory(row: ReturnedMemory) {
  return {
    id: row.id,
    label: row.label,
    observation: row.observation,
    quote: row.quote,
    quoteDate: row.quoteDate,
    lens: row.lens,
    journalEntryId: row.journalEntryId,
    dismissed: row.dismissed,
    favorite: row.favorite,
    createdAt: row.createdAt,
    openedAt: row.openedAt,
  };
}

// POST /memories/run — the heart of the product (delegates to the shared
// engine helper, also used by the cron-driven memory nudge).
router.post("/memories/run", runLimiter, quotaGate, async (req, res): Promise<void> => {
  const parsed = RunMemoryBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid run input" });
    return;
  }

  // Async (ADR 0002): enqueue and return a job to poll, so the request never
  // hangs for minutes and the user can leave and come back.
  if (asyncMemoryEnabled()) {
    try {
      // Carry the SAME inputs the sync path used (year/month/entryIds/fresh), and
      // key dedupe on them so two differently-scoped runs aren't merged.
      const jobId = await enqueueMemoryJob(
        req.userId!,
        "run",
        parsed.data,
        `run:${req.userId}:${JSON.stringify(parsed.data)}`,
      );
      res.status(202).json({ jobId, status: "queued" });
    } catch (err) {
      req.log.error({ err }, "Enqueue memory run failed");
      res.status(500).json({ error: "Failed to start the memory engine" });
    }
    return;
  }

  // Synchronous fallback (default): unchanged behavior.
  try {
    const result = await runMemoryForUser(req.userId!, parsed.data);
    if (!result.surfaced) {
      res.json({
        surfaced: false,
        reason: result.reason,
        supportMessage: result.supportMessage ?? null,
      });
      return;
    }
    res.json({ surfaced: true, memory: toMemory(result.memory!) });
  } catch (err) {
    req.log.error({ err }, "Memory run error");
    res.status(500).json({ error: "Failed to run the memory engine" });
  }
});

// GET /memories/jobs/:id — poll an async run. Declared BEFORE /memories/:id so
// "jobs" is never read as a memory id. Returns { status } while pending, and on
// done resolves to the SAME shape the synchronous run returned ({ surfaced,
// memory } | { surfaced:false, reason }) by dereferencing the stored pointer.
router.get("/memories/jobs/:id", async (req, res): Promise<void> => {
  try {
    const job = await getMemoryJob(req.userId!, req.params.id);
    if (!job) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (job.status === "error") {
      res.json({ status: "error", result: { surfaced: false, reason: "error" } });
      return;
    }
    if (job.status !== "done") {
      res.json({ status: job.status });
      return;
    }
    const r = (job.result ?? {}) as {
      surfaced?: boolean;
      memoryId?: string;
      reason?: string;
      supportMessage?: string | null;
    };
    if (r.surfaced && r.memoryId) {
      const [row] = await db
        .select()
        .from(returnedMemoriesTable)
        .where(
          and(
            eq(returnedMemoriesTable.id, r.memoryId),
            eq(returnedMemoriesTable.userId, req.userId!),
          ),
        )
        .limit(1);
      res.json({
        status: "done",
        result: row
          ? { surfaced: true, memory: toMemory(row) }
          : { surfaced: false, reason: "nothing" },
      });
      return;
    }
    res.json({
      status: "done",
      result: {
        surfaced: false,
        reason: r.reason ?? "nothing",
        supportMessage: r.supportMessage ?? null,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Memory job poll error");
    res.status(500).json({ error: "Failed to read the job" });
  }
});

// POST /memories/then-and-now { year, month? } — the "How far you've come"
// reflection: the engine reads the chosen PAST window together with your RECENT
// pages and surfaces the distance between then and now (its distance/arc mode).
// It's a scoped engine run you steer — the same async queue + reading state as
// Bring a page back, just with a pool of [that window] + [recent]. Async when
// ASYNC_MEMORY is on (→ { jobId } to poll); else synchronous (→ the result).
router.post(
  "/memories/then-and-now",
  runLimiter,
  quotaGate,
  async (req, res): Promise<void> => {
    const body = (req.body ?? {}) as { year?: unknown; month?: unknown };
    const year = Number(body.year);
    const month = body.month == null ? undefined : Number(body.month);
    if (!Number.isInteger(year) || year < 1900 || year > 3000) {
      res.status(400).json({ error: "A valid year is required" });
      return;
    }
    if (
      month !== undefined &&
      (!Number.isInteger(month) || month < 1 || month > 12)
    ) {
      res.status(400).json({ error: "Invalid month" });
      return;
    }

    try {
      // THEN = the chosen window; NOW = the most recent pages. The engine refines
      // eligibility (muted / never / safety) itself, so we only gather by date.
      const baseFilters = [
        eq(journalEntriesTable.userId, req.userId!),
        isNull(journalEntriesTable.deletedAt),
        isNotNull(journalEntriesTable.entryDate),
      ];
      const thenFilters = [
        ...baseFilters,
        sql`extract(year from ${journalEntriesTable.entryDate}) = ${year}`,
      ];
      if (month !== undefined) {
        thenFilters.push(
          sql`extract(month from ${journalEntriesTable.entryDate}) = ${month}`,
        );
      }
      const [thenRows, nowRows] = await Promise.all([
        db
          .select({ id: journalEntriesTable.id })
          .from(journalEntriesTable)
          .where(and(...thenFilters)),
        db
          .select({ id: journalEntriesTable.id })
          .from(journalEntriesTable)
          .where(and(...baseFilters))
          .orderBy(desc(journalEntriesTable.entryDate))
          .limit(12),
      ]);
      const entryIds = [
        ...new Set([
          ...thenRows.map((r) => r.id),
          ...nowRows.map((r) => r.id),
        ]),
      ];
      if (entryIds.length === 0) {
        res.json({ surfaced: false, reason: "not_enough" });
        return;
      }

      if (asyncMemoryEnabled()) {
        const jobId = await enqueueMemoryJob(
          req.userId!,
          "run",
          { entryIds },
          `tan:${req.userId}:${year}:${month ?? "all"}`,
        );
        res.status(202).json({ jobId, status: "queued" });
        return;
      }

      const result = await runMemoryForUser(req.userId!, { entryIds });
      if (!result.surfaced) {
        res.json({
          surfaced: false,
          reason: result.reason,
          supportMessage: result.supportMessage ?? null,
        });
        return;
      }
      res.json({ surfaced: true, memory: toMemory(result.memory!) });
    } catch (err) {
      req.log.error({ err }, "Then-and-now error");
      res.status(500).json({ error: "Failed to read then and now" });
    }
  },
);

// POST /memories/this-time-of-year { date? } — the voiced nostalgia for Look Back:
// the engine reads your pages from AROUND NOW (this day ±3 and this month) across
// prior years and surfaces ONE voiced page (a thread / arc is welcome here, unlike
// Today's strict single page). No input; the wider-window counterpart to Today's
// exact-day surface. Async when ASYNC_MEMORY is on.
router.post(
  "/memories/this-time-of-year",
  runLimiter,
  quotaGate,
  async (req, res): Promise<void> => {
    const dateStr = (req.body as { date?: string })?.date;
    const target =
      dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
        ? new Date(`${dateStr}T00:00:00Z`)
        : new Date();
    try {
      const [exact, around] = await Promise.all([
        onThisDayForUser(req.userId!, target),
        aroundThisTimeForUser(req.userId!, target),
      ]);
      const entryIds = [
        ...new Set([...exact, ...around].map((m) => m.entryId)),
      ];
      if (entryIds.length === 0) {
        res.json({ surfaced: false, reason: "not_enough" });
        return;
      }
      const dateKey = target.toISOString().slice(0, 10);
      if (asyncMemoryEnabled()) {
        const jobId = await enqueueMemoryJob(
          req.userId!,
          "run",
          { entryIds },
          `ttoy:${req.userId}:${dateKey}`,
        );
        res.status(202).json({ jobId, status: "queued" });
        return;
      }
      const result = await runMemoryForUser(req.userId!, { entryIds });
      if (!result.surfaced) {
        res.json({
          surfaced: false,
          reason: result.reason,
          supportMessage: result.supportMessage ?? null,
        });
        return;
      }
      res.json({ surfaced: true, memory: toMemory(result.memory!) });
    } catch (err) {
      req.log.error({ err }, "This-time-of-year error");
      res.status(500).json({ error: "Failed to read this time of year" });
    }
  },
);

// POST /memories/revisit { year, month } — "Revisit a time": the engine reads a
// chosen month and surfaces the one line worth returning to from it (voice first);
// the client then lists the period's entries beneath. Scoped by entryIds (so it's
// exactly that period, bypassing diversity). Async when ASYNC_MEMORY is on.
router.post(
  "/memories/revisit",
  runLimiter,
  quotaGate,
  async (req, res): Promise<void> => {
    const body = (req.body as { year?: unknown; month?: unknown }) ?? {};
    const year = Number(body.year);
    const month = Number(body.month);
    if (
      !Number.isInteger(year) ||
      year < 1900 ||
      year > 3000 ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      res.status(400).json({ error: "A valid year and month are required" });
      return;
    }
    try {
      const rows = await db
        .select({ id: journalEntriesTable.id })
        .from(journalEntriesTable)
        .where(
          and(
            eq(journalEntriesTable.userId, req.userId!),
            isNull(journalEntriesTable.deletedAt),
            isNotNull(journalEntriesTable.entryDate),
            sql`extract(year from ${journalEntriesTable.entryDate}) = ${year}`,
            sql`extract(month from ${journalEntriesTable.entryDate}) = ${month}`,
          ),
        );
      const entryIds = rows.map((r) => r.id);
      if (entryIds.length === 0) {
        res.json({ surfaced: false, reason: "not_enough" });
        return;
      }
      if (asyncMemoryEnabled()) {
        const jobId = await enqueueMemoryJob(
          req.userId!,
          "run",
          { entryIds },
          `revisit:${req.userId}:${year}:${month}`,
        );
        res.status(202).json({ jobId, status: "queued" });
        return;
      }
      const result = await runMemoryForUser(req.userId!, { entryIds });
      if (!result.surfaced) {
        res.json({
          surfaced: false,
          reason: result.reason,
          supportMessage: result.supportMessage ?? null,
        });
        return;
      }
      res.json({ surfaced: true, memory: toMemory(result.memory!) });
    } catch (err) {
      req.log.error({ err }, "Revisit error");
      res.status(500).json({ error: "Failed to revisit that time" });
    }
  },
);

// GET /memories — the Returns archive.
router.get("/memories", async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(returnedMemoriesTable)
      .where(eq(returnedMemoriesTable.userId, req.userId!))
      .orderBy(desc(returnedMemoriesTable.createdAt));
    res.json(rows.map(toMemory));
  } catch (err) {
    req.log.error({ err }, "List memories error");
    res.status(500).json({ error: "Failed to list memories" });
  }
});

// Resolve the ?date=YYYY-MM-DD param (the reader's local day) to a UTC-midnight
// Date, or null when the param is present but malformed. Absent → server today.
function targetDate(
  req: { query: { date?: string } },
): Date | null {
  const dateParam = req.query.date;
  if (!dateParam) return new Date();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return null;
  const d = new Date(dateParam + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

// GET /memories/on-this-day?date=YYYY-MM-DD — date-based resurfacing (see
// lib/on-this-day). Declared BEFORE /memories/:id so "on-this-day" is never read
// as a memory id. The date param is optional and defaults to the server's today;
// the client passes its local date so the window matches the reader's calendar.
router.get("/memories/on-this-day", async (req, res): Promise<void> => {
  const target = targetDate(req as { query: { date?: string } });
  if (!target) {
    res.status(400).json({ error: "Invalid date" });
    return;
  }
  try {
    res.json(await onThisDayForUser(req.userId!, target));
  } catch (err) {
    req.log.error({ err }, "On this day error");
    res.status(500).json({ error: "Failed to load on-this-day memories" });
  }
});

// GET /memories/on-this-day/framed?date=YYYY-MM-DD — the date-anchored surface,
// VOICED. Returns the raw per-year list (`years`, instant) AND a `framed` pick:
// the engine scoped to just this date's entries, so the "On this day" memory
// reads in Yadegar's voice (a chosen line + an observation) instead of a raw
// excerpt — Facebook-Memories, but warm. Falls back to the same MONTH in prior
// years when nothing is on the exact day, so it's never a dead end. The framing
// is a bonus: if the engine stays silent (thin entry), `framed` is null and the
// client still shows the raw year(s). Preview mode → no Returns row is written.
router.get("/memories/on-this-day/framed", async (req, res): Promise<void> => {
  const target = targetDate(req as { query: { date?: string } });
  if (!target) {
    res.status(400).json({ error: "Invalid date" });
    return;
  }
  try {
    // EXACT calendar day in prior years only (cross-year arcs live in Then & Now).
    const years = await onThisDayFramedSet(req.userId!, target);
    if (years.length === 0) {
      res.json({ exact: true, years: [], framed: null });
      return;
    }

    let framed: ReturnType<typeof toMemory> | null = null;
    try {
      // Voice a SINGLE dated page — the most recent year on this exact day — so
      // the lead reads as "a page from then," never a cross-year pattern.
      const out = await runMemoryForUser(req.userId!, {
        entryIds: [years[0].entryId],
        preview: true,
      });
      if (out.surfaced && out.memory) framed = toMemory(out.memory);
    } catch (err) {
      // Framing is a bonus — never fail the whole surface because the voice pass
      // errored. The client falls back to the raw year(s).
      req.log.warn({ err }, "On-this-day framing failed; serving raw years");
    }

    res.json({ exact: true, years, framed });
  } catch (err) {
    req.log.error({ err }, "On this day (framed) error");
    res.status(500).json({ error: "Failed to load on-this-day memories" });
  }
});

// GET /memories/look-back?date=YYYY-MM-DD — the dedicated browse: all the
// date-based ways a page returns, gathered. Favorites already shown in the
// on-this-day / around-this-time buckets are dropped so nothing appears twice.
router.get("/memories/look-back", async (req, res): Promise<void> => {
  const target = targetDate(req as { query: { date?: string } });
  if (!target) {
    res.status(400).json({ error: "Invalid date" });
    return;
  }
  try {
    const [onThisDay, aroundThisTime, favoritesRaw, forgottenRaw] =
      await Promise.all([
        onThisDayForUser(req.userId!, target),
        aroundThisTimeForUser(req.userId!, target),
        favoritesForUser(req.userId!),
        forgottenForUser(req.userId!),
      ]);
    // De-dupe across buckets so a page never appears twice.
    const shown = new Set([
      ...onThisDay.map((m) => m.entryId),
      ...aroundThisTime.map((m) => m.entryId),
    ]);
    const favorites = favoritesRaw.filter((m) => !shown.has(m.entryId));
    favorites.forEach((m) => shown.add(m.entryId));
    const forgotten = forgottenRaw.filter((m) => !shown.has(m.entryId));
    res.json({ onThisDay, aroundThisTime, favorites, forgotten });
  } catch (err) {
    req.log.error({ err }, "Look back error");
    res.status(500).json({ error: "Failed to load look-back memories" });
  }
});

router.get("/memories/:id", async (req, res): Promise<void> => {
  try {
    const [row] = await db
      .select()
      .from(returnedMemoriesTable)
      .where(
        and(
          eq(returnedMemoriesTable.id, req.params.id),
          eq(returnedMemoriesTable.userId, req.userId!),
        ),
      );
    if (!row) {
      res.status(404).json({ error: "Memory not found" });
      return;
    }
    res.json(toMemory(row));
  } catch (err) {
    req.log.error({ err }, "Get memory error");
    res.status(500).json({ error: "Failed to fetch memory" });
  }
});

router.patch("/memories/:id", async (req, res): Promise<void> => {
  const parsed = UpdateMemoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid update" });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.favorite !== undefined) updates.favorite = parsed.data.favorite;
  if (parsed.data.dismissed !== undefined)
    updates.dismissed = parsed.data.dismissed;
  if (parsed.data.opened === true) updates.openedAt = new Date();

  try {
    const [row] = await db
      .update(returnedMemoriesTable)
      .set(updates)
      .where(
        and(
          eq(returnedMemoriesTable.id, req.params.id),
          eq(returnedMemoriesTable.userId, req.userId!),
        ),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Memory not found" });
      return;
    }
    res.json(toMemory(row));
  } catch (err) {
    req.log.error({ err }, "Update memory error");
    res.status(500).json({ error: "Failed to update memory" });
  }
});

export default router;

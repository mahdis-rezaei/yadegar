import { Router } from "express";
import { and, eq, isNull, lte, ne, or } from "drizzle-orm";
import {
  db,
  usersTable,
  notificationPreferencesTable,
  capsulesTable,
  type NudgeFrequency,
} from "@workspace/db";
import {
  sendEmail,
  writingNudgeEmail,
  memoryNudgeEmail,
  onThisDayNudgeEmail,
  capsuleEmail,
} from "../lib/email";
import { runMemoryForUser } from "../lib/memory-engine";
import { sendPushToUser } from "../lib/push";
import { tagPendingEntries } from "../lib/resurface-safety";
import { onThisDayForUser, onThisDayFramedSet } from "../lib/on-this-day";
import { sweepMemoryJobs, enqueueMemoryJob } from "../lib/memory-jobs";

const router = Router();

// The user's local calendar day, as a UTC-midnight Date (what onThisDayForUser
// reads). So "on this day" matches the reader's calendar, not the server's.
function localDayInTz(timeZone: string | null): Date {
  try {
    const ymd = new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    return new Date(`${ymd}T00:00:00Z`);
  } catch {
    return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  }
}

// "June 2018" from a YYYY-MM-DD entry date.
function monthYear(entryDate: string): string {
  return new Date(`${entryDate}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function requireCronSecret(req: {
  header: (name: string) => string | undefined;
}): { ok: true } | { ok: false; status: number; error: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, status: 503, error: "CRON_SECRET not configured" };
  if (req.header("x-cron-secret") !== secret)
    return { ok: false, status: 401, error: "Unauthorized" };
  return { ok: true };
}

function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:5173").replace(/\/+$/, "");
}

function isDue(freq: NudgeFrequency, last: Date | null): boolean {
  if (freq === "off") return false;
  if (!last) return true;
  const days = (Date.now() - last.getTime()) / 86_400_000;
  return freq === "weekly" ? days >= 7 : days >= 28;
}

// POST /cron/run-nudges — machine-triggered (e.g. a daily Scheduled Deployment).
// Authenticated by the x-cron-secret header matching CRON_SECRET. Sends due
// writing nudges and memory nudges. Memory nudges run the engine, so they
// inherit every safety gate — crisis/nothing simply send nothing.
router.post("/cron/run-nudges", async (req, res): Promise<void> => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.status(503).json({ error: "CRON_SECRET not configured" });
    return;
  }
  if (req.header("x-cron-secret") !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const summary = {
    considered: 0,
    writingSent: 0,
    memorySent: 0,
    memorySilent: 0,
    pushSent: 0,
    capsulesDelivered: 0,
    errors: 0,
  };

  try {
    const rows = await db
      .select({ prefs: notificationPreferencesTable, user: usersTable })
      .from(notificationPreferencesTable)
      .innerJoin(
        usersTable,
        eq(notificationPreferencesTable.userId, usersTable.id),
      )
      .where(
        and(
          isNull(usersTable.deletedAt),
          or(
            ne(notificationPreferencesTable.writingFrequency, "off"),
            ne(notificationPreferencesTable.memoryFrequency, "off"),
          ),
        ),
      );

    for (const { prefs, user } of rows) {
      summary.considered++;

      // Writing nudge — a gentle reminder, no engine.
      if (isDue(prefs.writingFrequency, prefs.lastWritingNudgeAt)) {
        try {
          await sendEmail({
            to: user.email,
            ...writingNudgeEmail(`${appUrl()}/today`),
          });
          summary.writingSent++;
        } catch (err) {
          req.log.error({ err, userId: user.id }, "Writing nudge failed");
          summary.errors++;
        }
        // The native counterpart, sent alongside email to any registered devices
        // (no-op for web-only users). Never throws; a push failure is logged inside.
        try {
          const push = await sendPushToUser(user.id, {
            title: "A page is waiting",
            body: "What wants to be written today?",
            data: { type: "writing" },
          });
          if (push.sent > 0) summary.pushSent++;
        } catch (err) {
          req.log.error({ err, userId: user.id }, "Writing push failed");
        }
        await db
          .update(notificationPreferencesTable)
          .set({ lastWritingNudgeAt: new Date(), updatedAt: new Date() })
          .where(eq(notificationPreferencesTable.id, prefs.id));
      }

      // Memory nudge — DATE-FIRST: a free "on this day" return if one exists
      // today (no model call), else fall back to the engine for a deeper find.
      // Either way, send only when a real page surfaces. Gated by memory
      // sensitivity: only "open" gets UNBIDDEN memory nudges (gentle/protected
      // still receive writing nudges and can browse memories themselves).
      if (
        user.memorySensitivity === "open" &&
        isDue(prefs.memoryFrequency, prefs.lastMemoryNudgeAt)
      ) {
        try {
          const onThisDay = await onThisDayForUser(
            user.id,
            localDayInTz(user.timezone),
          );
          if (onThisDay.length > 0) {
            const item = onThisDay[0]; // most recent year
            await sendEmail({
              to: user.email,
              ...onThisDayNudgeEmail({
                monthYear: monthYear(item.entryDate),
                excerpt: item.excerpt,
                link: `${appUrl()}/library/${item.entryId}`,
              }),
            });
            summary.memorySent++;
            try {
              const push = await sendPushToUser(user.id, {
                title: `On this day, ${monthYear(item.entryDate)}`,
                body: item.excerpt.slice(0, 140),
                data: { type: "on_this_day", entryId: item.entryId },
              });
              if (push.sent > 0) summary.pushSent++;
            } catch (err) {
              req.log.error({ err, userId: user.id }, "On-this-day push failed");
            }
          } else {
            const result = await runMemoryForUser(user.id, {}, { kind: "auto" });
            if (result.surfaced && result.memory) {
              const m = result.memory;
              const link = m.journalEntryId
                ? `${appUrl()}/library/${m.journalEntryId}`
                : `${appUrl()}/returns`;
              await sendEmail({
                to: user.email,
                ...memoryNudgeEmail({
                  observation: m.observation,
                  quote: m.quote,
                  quoteDate: m.quoteDate,
                  link,
                }),
              });
              summary.memorySent++;
              // The engine already cleared every safety gate to surface this, so
              // the push only ever carries a real, showable page.
              try {
                const push = await sendPushToUser(user.id, {
                  title: "A page worth returning to",
                  body: (m.quote || m.observation || "").slice(0, 140),
                  data: { type: "memory", entryId: m.journalEntryId ?? null },
                });
                if (push.sent > 0) summary.pushSent++;
              } catch (err) {
                req.log.error({ err, userId: user.id }, "Memory push failed");
              }
            } else {
              summary.memorySilent++;
            }
          }
        } catch (err) {
          req.log.error({ err, userId: user.id }, "Memory nudge failed");
          summary.errors++;
        }
        // Update regardless so we don't re-run the engine every tick.
        await db
          .update(notificationPreferencesTable)
          .set({ lastMemoryNudgeAt: new Date(), updatedAt: new Date() })
          .where(eq(notificationPreferencesTable.id, prefs.id));
      }
    }

    // Deliver any Memory Capsules whose date has arrived (independent of nudge
    // prefs — a sealed letter is delivered regardless). Marking delivered
    // unseals it in-app even if the courtesy email fails.
    const dueCapsules = await db
      .select({ id: capsulesTable.id, email: usersTable.email })
      .from(capsulesTable)
      .innerJoin(usersTable, eq(capsulesTable.userId, usersTable.id))
      .where(
        and(
          isNull(capsulesTable.deliveredAt),
          isNull(usersTable.deletedAt),
          lte(capsulesTable.deliverAt, new Date()),
        ),
      );
    for (const cap of dueCapsules) {
      await db
        .update(capsulesTable)
        .set({ deliveredAt: new Date() })
        .where(eq(capsulesTable.id, cap.id));
      try {
        await sendEmail({ to: cap.email, ...capsuleEmail(`${appUrl()}/capsules`) });
      } catch (err) {
        req.log.error({ err, capsuleId: cap.id }, "Capsule email failed");
        summary.errors++;
      }
      summary.capsulesDelivered++;
    }

    res.json(summary);
  } catch (err) {
    req.log.error({ err }, "Cron run-nudges error");
    res.status(500).json({ error: "Failed to run nudges", ...summary });
  }
});

// POST /cron/tag-resurface-safety — machine-triggered (e.g. a Scheduled
// Deployment every few minutes). Authenticated by x-cron-secret == CRON_SECRET.
// Classifies a batch of entries that still need a date-resurfacing safety verdict
// (resurface_safety IS NULL), so the date-based surfacer stays a pure DB query.
// LAZY by default: only entries whose month-day anniversary is approaching are
// classified (the rest stay NULL → withheld → classified just before their window;
// see resurface-safety.ts), so an imported archive is tagged pay-as-used instead of
// all at once. Optional ?limit=N bounds the batch; ?all=1 bypasses the anniversary
// window for a one-off full backfill. Idempotent; the backlog drains over ticks.
router.post("/cron/tag-resurface-safety", async (req, res): Promise<void> => {
  const auth = requireCronSecret(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const limitRaw = Number((req.query as { limit?: string }).limit);
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : undefined;
  // Default (lazy) classifies only entries whose anniversary is approaching;
  // ?all=1 is the one-off full-backfill escape hatch (classify the whole archive).
  const all = (req.query as { all?: string }).all === "1";

  try {
    const summary = await tagPendingEntries(req.log, limit, { dueOnly: !all });
    res.json(summary);
  } catch (err) {
    req.log.error({ err }, "Cron tag-resurface-safety error");
    res.status(500).json({ error: "Failed to tag entries" });
  }
});

// POST /cron/process-memory-jobs — backstop for async memory surfacing (ADR
// 0002). Authenticated by x-cron-secret. Resets jobs whose worker died and
// processes pending ones; the optimistic in-process start handles the common
// case, so this rarely has work. Processes INLINE (one per tick by default) so
// the instance stays alive for the engine read — like the other engine crons it
// may exceed a short client timeout while the server finishes. Optional ?limit=N.
router.post("/cron/process-memory-jobs", async (req, res): Promise<void> => {
  const auth = requireCronSecret(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }
  const limitRaw = Number((req.query as { limit?: string }).limit);
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 20) : 3;
  try {
    const summary = await sweepMemoryJobs(limit);
    res.json(summary);
  } catch (err) {
    req.log.error({ err }, "Cron process-memory-jobs error");
    res.status(500).json({ error: "Failed to process memory jobs" });
  }
});

// POST /cron/warm-on-this-day — pre-compute the VOICED "On this day" so the Today
// page serves it from the engine cache (instant) instead of a cold ~tens-of-
// seconds read on first visit. For each non-protected user with pages near today,
// enqueue an on_this_day job over the SAME entry ids the page will read (via
// onThisDayFramedSet), then the backstop drains them. Idempotent (deduped per
// user+date); x-cron-secret. Enqueue-only (no optimistic start) so a batch never
// stampedes the engine. Daily cadence (the date changes daily).
router.post("/cron/warm-on-this-day", async (req, res): Promise<void> => {
  const auth = requireCronSecret(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }
  try {
    const users = await db
      .select({
        id: usersTable.id,
        timezone: usersTable.timezone,
        memorySensitivity: usersTable.memorySensitivity,
      })
      .from(usersTable)
      .where(isNull(usersTable.deletedAt));

    let enqueued = 0;
    for (const u of users) {
      if (u.memorySensitivity === "protected") continue;
      const target = localDayInTz(u.timezone);
      const years = await onThisDayFramedSet(u.id, target);
      if (years.length === 0) continue;
      const date = target.toISOString().slice(0, 10);
      await enqueueMemoryJob(
        u.id,
        "on_this_day",
        // Warm the SAME single entry the framed endpoint voices (most recent
        // year on this exact day) so the cache lines up.
        { entryIds: [years[0].entryId] },
        `otd:${u.id}:${date}`,
        false, // enqueue only; the backstop drains the batch
      );
      enqueued++;
    }
    res.json({ enqueued });
  } catch (err) {
    req.log.error({ err }, "Cron warm-on-this-day error");
    res.status(500).json({ error: "Failed to warm on-this-day" });
  }
});

export default router;

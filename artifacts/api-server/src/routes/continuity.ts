import { Router } from "express";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, journalEntriesTable, reflectionsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();
router.use("/continuity", requireAuth);

const IMPORTED_SOURCES = ["pasted_import", "file_import", "google_doc"];

function toDate(v: unknown): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}
function yearOf(v: unknown): number | null {
  const d = toDate(v);
  return d ? d.getUTCFullYear() : null;
}
// Whole years elapsed since a date (not counting an anniversary that hasn't
// arrived yet this year).
function fullYearsSince(v: unknown): number | null {
  const then = toDate(v);
  if (!then) return null;
  const now = new Date();
  let years = now.getUTCFullYear() - then.getUTCFullYear();
  const m = now.getUTCMonth() - then.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < then.getUTCDate())) years -= 1;
  return Math.max(0, years);
}

// GET /continuity — archival "continuity" metrics (the deliberate ANTI-streak:
// celebrate accumulation, never consistency) + a couple of gentle, true-right-now
// milestones. Pure aggregate read over unencrypted columns (counts/dates) — no
// decryption, no engine.
router.get("/continuity", async (req, res): Promise<void> => {
  try {
    const [stats] = await db
      .select({
        pageCount: sql<number>`count(*)::int`,
        oldestDate: sql<string | null>`min(${journalEntriesTable.entryDate})`,
        newestDate: sql<string | null>`max(${journalEntriesTable.entryDate})`,
        firstCreatedAt: sql<string | null>`min(${journalEntriesTable.createdAt})`,
        oldestImportedDate: sql<
          string | null
        >`min(${journalEntriesTable.entryDate}) filter (where ${journalEntriesTable.source} in (${sql.join(
          IMPORTED_SOURCES.map((s) => sql`${s}`),
          sql`, `,
        )}))`,
      })
      .from(journalEntriesTable)
      .where(
        and(
          eq(journalEntriesTable.userId, req.userId!),
          isNull(journalEntriesTable.deletedAt),
        ),
      );

    const [refl] = await db
      .select({
        reflectionCount: sql<number>`count(*)::int`,
        firstReflectionAt: sql<string | null>`min(${reflectionsTable.createdAt})`,
      })
      .from(reflectionsTable)
      .where(
        and(
          eq(reflectionsTable.userId, req.userId!),
          isNull(reflectionsTable.deletedAt),
        ),
      );

    const oldYear = yearOf(stats.oldestDate);
    const newYear = yearOf(stats.newestDate);
    const spanYears = oldYear !== null && newYear !== null ? newYear - oldYear : null;

    const firstReflection = toDate(refl.firstReflectionAt);
    const todayISO = new Date().toISOString().slice(0, 10);
    const wroteFirstReflectionToday =
      firstReflection !== null &&
      firstReflection.toISOString().slice(0, 10) === todayISO;

    res.json({
      pageCount: stats.pageCount,
      writingSinceYear: yearOf(stats.firstCreatedAt),
      spanYears,
      oldestPageAgeYears: fullYearsSince(stats.oldestDate),
      reflectionCount: refl.reflectionCount,
      oldestImportedAgeYears: stats.oldestImportedDate
        ? fullYearsSince(stats.oldestImportedDate)
        : null,
      wroteFirstReflectionToday,
    });
  } catch (err) {
    req.log.error({ err }, "Continuity error");
    res.status(500).json({ error: "Failed to load continuity" });
  }
});

export default router;

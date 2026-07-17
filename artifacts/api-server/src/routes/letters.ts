import { Router } from "express";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db, journalEntriesTable, reflectionsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();
router.use("/letters", requireAuth);

function excerpt(body: string, maxWords = 80): string {
  const trimmed = body.trim();
  const words = trimmed.split(/\s+/);
  if (words.length <= maxWords) return trimmed;
  return words.slice(0, maxWords).join(" ") + "…";
}

// GET /letters/:year — "Your Year in Pages." A yearly artifact assembled from
// signals we already have (no engine): how many pages, the favorited pages that
// stayed, and how many reflections were written. Rendered by the client as a
// typeset, printable page. Navigation surface → the user's own pages.
router.get("/letters/:year", async (req, res): Promise<void> => {
  const year = Number(req.params.year);
  if (!Number.isInteger(year) || year < 1900 || year > 3000) {
    res.status(400).json({ error: "Invalid year" });
    return;
  }

  try {
    const [counts] = await db
      .select({ pageCount: sql<number>`count(*)::int` })
      .from(journalEntriesTable)
      .where(
        and(
          eq(journalEntriesTable.userId, req.userId!),
          isNull(journalEntriesTable.deletedAt),
          sql`extract(year from ${journalEntriesTable.entryDate}) = ${year}`,
        ),
      );

    const favoriteRows = await db
      .select({
        id: journalEntriesTable.id,
        title: journalEntriesTable.title,
        body: journalEntriesTable.body,
        entryDate: journalEntriesTable.entryDate,
      })
      .from(journalEntriesTable)
      .where(
        and(
          eq(journalEntriesTable.userId, req.userId!),
          isNull(journalEntriesTable.deletedAt),
          eq(journalEntriesTable.favorite, true),
          sql`extract(year from ${journalEntriesTable.entryDate}) = ${year}`,
        ),
      )
      .orderBy(asc(journalEntriesTable.entryDate));

    const [refl] = await db
      .select({ reflectionCount: sql<number>`count(*)::int` })
      .from(reflectionsTable)
      .where(
        and(
          eq(reflectionsTable.userId, req.userId!),
          isNull(reflectionsTable.deletedAt),
          sql`extract(year from ${reflectionsTable.reflectionDate}) = ${year}`,
        ),
      );

    res.json({
      year,
      pageCount: counts.pageCount,
      reflectionCount: refl.reflectionCount,
      favorites: favoriteRows.map((r) => ({
        entryId: r.id,
        title: r.title,
        excerpt: excerpt(r.body),
        entryDate: r.entryDate,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Year letter error");
    res.status(500).json({ error: "Failed to assemble your year" });
  }
});

export default router;

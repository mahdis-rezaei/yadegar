import { Router } from "express";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db, shelfItemsTable, journalEntriesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();
router.use("/shelf", requireAuth);

function excerpt(body: string, maxWords = 80): string {
  const trimmed = body.trim();
  const words = trimmed.split(/\s+/);
  if (words.length <= maxWords) return trimmed;
  return words.slice(0, maxWords).join(" ") + "…";
}

// GET /shelf — the curated shelf, each item with its page preview, in shelf
// order. Soft-deleted entries are filtered out.
router.get("/shelf", async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select({
        entryId: journalEntriesTable.id,
        title: journalEntriesTable.title,
        body: journalEntriesTable.body,
        entryDate: journalEntriesTable.entryDate,
        favorite: journalEntriesTable.favorite,
      })
      .from(shelfItemsTable)
      .innerJoin(
        journalEntriesTable,
        eq(shelfItemsTable.journalEntryId, journalEntriesTable.id),
      )
      .where(
        and(
          eq(shelfItemsTable.userId, req.userId!),
          isNull(journalEntriesTable.deletedAt),
        ),
      )
      .orderBy(asc(shelfItemsTable.orderIndex), asc(shelfItemsTable.createdAt));

    res.json(
      rows.map((r) => ({
        entryId: r.entryId,
        title: r.title,
        excerpt: excerpt(r.body),
        entryDate: r.entryDate,
        favorite: r.favorite,
      })),
    );
  } catch (err) {
    req.log.error({ err }, "List shelf error");
    res.status(500).json({ error: "Failed to load your shelf" });
  }
});

// POST /shelf { entryId } — add a page to the shelf (idempotent). Verifies the
// page belongs to the user.
router.post("/shelf", async (req, res): Promise<void> => {
  const entryId = (req.body ?? {}).entryId;
  if (typeof entryId !== "string") {
    res.status(400).json({ error: "entryId required" });
    return;
  }
  try {
    const [entry] = await db
      .select({ id: journalEntriesTable.id })
      .from(journalEntriesTable)
      .where(
        and(
          eq(journalEntriesTable.id, entryId),
          eq(journalEntriesTable.userId, req.userId!),
          isNull(journalEntriesTable.deletedAt),
        ),
      );
    if (!entry) {
      res.status(404).json({ error: "Page not found" });
      return;
    }

    const [existing] = await db
      .select({ id: shelfItemsTable.id })
      .from(shelfItemsTable)
      .where(
        and(
          eq(shelfItemsTable.userId, req.userId!),
          eq(shelfItemsTable.journalEntryId, entryId),
        ),
      );
    if (existing) {
      res.status(200).json({ ok: true });
      return;
    }

    const [{ nextOrder }] = await db
      .select({
        nextOrder: sql<number>`coalesce(max(${shelfItemsTable.orderIndex}), -1)::int + 1`,
      })
      .from(shelfItemsTable)
      .where(eq(shelfItemsTable.userId, req.userId!));

    await db.insert(shelfItemsTable).values({
      userId: req.userId!,
      journalEntryId: entryId,
      orderIndex: nextOrder,
    });
    res.status(201).json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Add to shelf error");
    res.status(500).json({ error: "Failed to add to your shelf" });
  }
});

// DELETE /shelf/:entryId — take a page off the shelf.
router.delete("/shelf/:entryId", async (req, res): Promise<void> => {
  try {
    await db
      .delete(shelfItemsTable)
      .where(
        and(
          eq(shelfItemsTable.userId, req.userId!),
          eq(shelfItemsTable.journalEntryId, req.params.entryId),
        ),
      );
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Remove from shelf error");
    res.status(500).json({ error: "Failed to remove from your shelf" });
  }
});

export default router;

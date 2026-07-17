import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, resurfaceMutesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();
router.use("/resurface-mutes", requireAuth);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toMute(row: typeof resurfaceMutesTable.$inferSelect) {
  return {
    id: row.id,
    startDate: row.startDate,
    endDate: row.endDate,
    createdAt: row.createdAt,
  };
}

// GET /resurface-mutes — the user's muted date ranges, newest first.
router.get("/resurface-mutes", async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(resurfaceMutesTable)
      .where(eq(resurfaceMutesTable.userId, req.userId!))
      .orderBy(desc(resurfaceMutesTable.createdAt));
    res.json(rows.map(toMute));
  } catch (err) {
    req.log.error({ err }, "List resurface mutes error");
    res.status(500).json({ error: "Failed to list muted periods" });
  }
});

// POST /resurface-mutes — mute a date range so its pages never resurface.
router.post("/resurface-mutes", async (req, res): Promise<void> => {
  const { startDate, endDate } = (req.body ?? {}) as {
    startDate?: unknown;
    endDate?: unknown;
  };
  if (
    typeof startDate !== "string" ||
    typeof endDate !== "string" ||
    !ISO_DATE.test(startDate) ||
    !ISO_DATE.test(endDate)
  ) {
    res.status(400).json({ error: "startDate and endDate (YYYY-MM-DD) required" });
    return;
  }
  if (startDate > endDate) {
    res.status(400).json({ error: "startDate must be on or before endDate" });
    return;
  }
  try {
    const [row] = await db
      .insert(resurfaceMutesTable)
      .values({ userId: req.userId!, startDate, endDate })
      .returning();
    res.status(201).json(toMute(row));
  } catch (err) {
    req.log.error({ err }, "Create resurface mute error");
    res.status(500).json({ error: "Failed to mute that period" });
  }
});

// DELETE /resurface-mutes/:id — un-mute (pages from that range can return again).
router.delete("/resurface-mutes/:id", async (req, res): Promise<void> => {
  try {
    const [row] = await db
      .delete(resurfaceMutesTable)
      .where(
        and(
          eq(resurfaceMutesTable.id, req.params.id),
          eq(resurfaceMutesTable.userId, req.userId!),
        ),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Muted period not found" });
      return;
    }
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Delete resurface mute error");
    res.status(500).json({ error: "Failed to remove that mute" });
  }
});

export default router;

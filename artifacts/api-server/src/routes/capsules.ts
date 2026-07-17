import { Router } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, capsulesTable, type Capsule } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();
router.use("/capsules", requireAuth);

// Sealed until delivered: the body is withheld until deliver_at has passed and
// the cron has delivered it.
function toPublic(c: Capsule) {
  const delivered = c.deliveredAt !== null;
  return {
    id: c.id,
    createdAt: c.createdAt,
    deliverAt: c.deliverAt,
    delivered,
    openedAt: c.openedAt,
    body: delivered ? c.body : null,
  };
}

// GET /capsules — the user's capsules, soonest delivery first.
router.get("/capsules", async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(capsulesTable)
      .where(eq(capsulesTable.userId, req.userId!))
      .orderBy(asc(capsulesTable.deliverAt));
    res.json(rows.map(toPublic));
  } catch (err) {
    req.log.error({ err }, "List capsules error");
    res.status(500).json({ error: "Failed to load your capsules" });
  }
});

// POST /capsules { body, deliverAt } — seal a letter to a future self.
router.post("/capsules", async (req, res): Promise<void> => {
  const { body, deliverAt } = (req.body ?? {}) as {
    body?: unknown;
    deliverAt?: unknown;
  };
  if (typeof body !== "string" || !body.trim()) {
    res.status(400).json({ error: "Write something to seal." });
    return;
  }
  if (typeof deliverAt !== "string") {
    res.status(400).json({ error: "A delivery date is required." });
    return;
  }
  const when = new Date(deliverAt);
  if (Number.isNaN(when.getTime())) {
    res.status(400).json({ error: "Invalid delivery date." });
    return;
  }
  if (when.getTime() <= Date.now()) {
    res.status(400).json({ error: "Choose a date in the future." });
    return;
  }
  // Sanity ceiling: 100 years out.
  if (when.getTime() > Date.now() + 100 * 365 * 86_400_000) {
    res.status(400).json({ error: "That's a little too far away." });
    return;
  }
  try {
    const [row] = await db
      .insert(capsulesTable)
      .values({ userId: req.userId!, body: body.trim(), deliverAt: when })
      .returning();
    res.status(201).json(toPublic(row));
  } catch (err) {
    req.log.error({ err }, "Create capsule error");
    res.status(500).json({ error: "Failed to seal your capsule" });
  }
});

// PATCH /capsules/:id { opened: true } — mark a delivered capsule as opened.
router.patch("/capsules/:id", async (req, res): Promise<void> => {
  try {
    const [existing] = await db
      .select()
      .from(capsulesTable)
      .where(
        and(
          eq(capsulesTable.id, req.params.id),
          eq(capsulesTable.userId, req.userId!),
        ),
      );
    if (!existing) {
      res.status(404).json({ error: "Capsule not found" });
      return;
    }
    if (existing.deliveredAt && !existing.openedAt && req.body?.opened === true) {
      const [row] = await db
        .update(capsulesTable)
        .set({ openedAt: new Date() })
        .where(eq(capsulesTable.id, existing.id))
        .returning();
      res.json(toPublic(row));
      return;
    }
    res.json(toPublic(existing));
  } catch (err) {
    req.log.error({ err }, "Open capsule error");
    res.status(500).json({ error: "Failed to update the capsule" });
  }
});

export default router;

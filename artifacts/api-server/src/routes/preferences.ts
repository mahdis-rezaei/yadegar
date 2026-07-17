import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();
router.use("/preferences", requireAuth);

const SENSITIVITIES = new Set(["open", "gentle", "protected"]);

// GET /preferences — user-level preferences that aren't notification cadence.
router.get("/preferences", (req, res): void => {
  res.json({ memorySensitivity: req.user!.memorySensitivity });
});

// PATCH /preferences { memorySensitivity }
router.patch("/preferences", async (req, res): Promise<void> => {
  const value = (req.body ?? {}).memorySensitivity;
  if (typeof value !== "string" || !SENSITIVITIES.has(value)) {
    res.status(400).json({ error: "Invalid sensitivity" });
    return;
  }
  try {
    await db
      .update(usersTable)
      .set({
        memorySensitivity: value as "open" | "gentle" | "protected",
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, req.userId!));
    res.json({ memorySensitivity: value });
  } catch (err) {
    req.log.error({ err }, "Update preferences error");
    res.status(500).json({ error: "Failed to update preferences" });
  }
});

export default router;

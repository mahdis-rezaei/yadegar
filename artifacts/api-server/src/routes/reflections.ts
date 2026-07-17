import { Router } from "express";
import { and, asc, eq, isNull } from "drizzle-orm";
import {
  db,
  journalEntriesTable,
  reflectionsTable,
  type Reflection,
} from "@workspace/db";
import { CreateReflectionBody, UpdateReflectionBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router = Router();

// Scope auth to this router's two prefixes (not path-less) so it never leaks
// onto the internal /still/* engine calls. Using router.use (rather than inline
// per-route middleware) also preserves Express's path-based req.params typing.
router.use(["/entries", "/reflections"], requireAuth);

function toReflection(row: Reflection) {
  return {
    id: row.id,
    journalEntryId: row.journalEntryId,
    body: row.body,
    reflectionDate: row.reflectionDate,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// GET /entries/:id/reflections — reflections on an entry, oldest first.
router.get(
  "/entries/:id/reflections",
  async (req, res): Promise<void> => {
    try {
      const rows = await db
        .select()
        .from(reflectionsTable)
        .where(
          and(
            eq(reflectionsTable.journalEntryId, req.params.id),
            eq(reflectionsTable.userId, req.userId!),
            isNull(reflectionsTable.deletedAt),
          ),
        )
        .orderBy(asc(reflectionsTable.createdAt));
      res.json(rows.map(toReflection));
    } catch (err) {
      req.log.error({ err }, "List reflections error");
      res.status(500).json({ error: "Failed to list reflections" });
    }
  },
);

// POST /entries/:id/reflections — write a reflection on an entry.
router.post(
  "/entries/:id/reflections",
  async (req, res): Promise<void> => {
    const parsed = CreateReflectionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "A reflection needs some words" });
      return;
    }
    try {
      // The entry must exist and belong to the user.
      const [entry] = await db
        .select({ id: journalEntriesTable.id })
        .from(journalEntriesTable)
        .where(
          and(
            eq(journalEntriesTable.id, req.params.id),
            eq(journalEntriesTable.userId, req.userId!),
            isNull(journalEntriesTable.deletedAt),
          ),
        );
      if (!entry) {
        res.status(404).json({ error: "Entry not found" });
        return;
      }

      const [row] = await db
        .insert(reflectionsTable)
        .values({
          userId: req.userId!,
          journalEntryId: req.params.id,
          body: parsed.data.body,
          reflectionDate: todayISO(),
        })
        .returning();
      res.status(201).json(toReflection(row));
    } catch (err) {
      req.log.error({ err }, "Create reflection error");
      res.status(500).json({ error: "Failed to write reflection" });
    }
  },
);

// PATCH /reflections/:id — edit a reflection.
router.patch(
  "/reflections/:id",
  async (req, res): Promise<void> => {
    const parsed = UpdateReflectionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid update" });
      return;
    }
    try {
      const [row] = await db
        .update(reflectionsTable)
        .set({ body: parsed.data.body, updatedAt: new Date() })
        .where(
          and(
            eq(reflectionsTable.id, req.params.id),
            eq(reflectionsTable.userId, req.userId!),
            isNull(reflectionsTable.deletedAt),
          ),
        )
        .returning();
      if (!row) {
        res.status(404).json({ error: "Reflection not found" });
        return;
      }
      res.json(toReflection(row));
    } catch (err) {
      req.log.error({ err }, "Update reflection error");
      res.status(500).json({ error: "Failed to update reflection" });
    }
  },
);

// DELETE /reflections/:id — soft delete.
router.delete(
  "/reflections/:id",
  async (req, res): Promise<void> => {
    try {
      const [row] = await db
        .update(reflectionsTable)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(reflectionsTable.id, req.params.id),
            eq(reflectionsTable.userId, req.userId!),
            isNull(reflectionsTable.deletedAt),
          ),
        )
        .returning();
      if (!row) {
        res.status(404).json({ error: "Reflection not found" });
        return;
      }
      res.status(204).end();
    } catch (err) {
      req.log.error({ err }, "Delete reflection error");
      res.status(500).json({ error: "Failed to delete reflection" });
    }
  },
);

export default router;

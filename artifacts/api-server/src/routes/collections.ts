import { Router } from "express";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  db,
  collectionsTable,
  collectionItemsTable,
  journalEntriesTable,
  type CollectionKind,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();
router.use("/collections", requireAuth);

const KINDS = new Set<CollectionKind>([
  "person",
  "place",
  "theme",
  "thought",
  "pair",
  "custom",
]);

function excerpt(body: string, maxWords = 80): string {
  const t = body.trim();
  const w = t.split(/\s+/);
  return w.length <= maxWords ? t : w.slice(0, maxWords).join(" ") + "…";
}

// GET /collections[?entryId=] — the user's collections with item counts. When
// entryId is given, each carries `containsEntry` (powers the reader's picker).
router.get("/collections", async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select({
        id: collectionsTable.id,
        name: collectionsTable.name,
        kind: collectionsTable.kind,
        createdAt: collectionsTable.createdAt,
        itemCount: sql<number>`count(${collectionItemsTable.id})::int`,
      })
      .from(collectionsTable)
      .leftJoin(
        collectionItemsTable,
        eq(collectionItemsTable.collectionId, collectionsTable.id),
      )
      .where(eq(collectionsTable.userId, req.userId!))
      .groupBy(collectionsTable.id)
      .orderBy(asc(collectionsTable.name));

    const entryId = (req.query as { entryId?: string }).entryId;
    let contains = new Set<string>();
    if (entryId) {
      const member = await db
        .select({ collectionId: collectionItemsTable.collectionId })
        .from(collectionItemsTable)
        .innerJoin(
          collectionsTable,
          eq(collectionItemsTable.collectionId, collectionsTable.id),
        )
        .where(
          and(
            eq(collectionsTable.userId, req.userId!),
            eq(collectionItemsTable.journalEntryId, entryId),
          ),
        );
      contains = new Set(member.map((m) => m.collectionId));
    }

    res.json(
      rows.map((r) => ({ ...r, containsEntry: contains.has(r.id) })),
    );
  } catch (err) {
    req.log.error({ err }, "List collections error");
    res.status(500).json({ error: "Failed to load collections" });
  }
});

// POST /collections { name, kind }
router.post("/collections", async (req, res): Promise<void> => {
  const { name, kind } = (req.body ?? {}) as { name?: unknown; kind?: unknown };
  if (typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "A name is required" });
    return;
  }
  const k: CollectionKind =
    typeof kind === "string" && KINDS.has(kind as CollectionKind)
      ? (kind as CollectionKind)
      : "custom";
  try {
    const [row] = await db
      .insert(collectionsTable)
      .values({ userId: req.userId!, name: name.trim(), kind: k })
      .returning();
    res.status(201).json({ ...row, itemCount: 0, containsEntry: false });
  } catch (err) {
    req.log.error({ err }, "Create collection error");
    res.status(500).json({ error: "Failed to create collection" });
  }
});

// GET /collections/:id — a collection with its pages, chronological.
router.get("/collections/:id", async (req, res): Promise<void> => {
  try {
    const [collection] = await db
      .select()
      .from(collectionsTable)
      .where(
        and(
          eq(collectionsTable.id, req.params.id),
          eq(collectionsTable.userId, req.userId!),
        ),
      );
    if (!collection) {
      res.status(404).json({ error: "Collection not found" });
      return;
    }

    const items = await db
      .select({
        entryId: journalEntriesTable.id,
        title: journalEntriesTable.title,
        body: journalEntriesTable.body,
        entryDate: journalEntriesTable.entryDate,
      })
      .from(collectionItemsTable)
      .innerJoin(
        journalEntriesTable,
        eq(collectionItemsTable.journalEntryId, journalEntriesTable.id),
      )
      .where(eq(collectionItemsTable.collectionId, collection.id))
      .orderBy(sql`${journalEntriesTable.entryDate} asc nulls last`);

    res.json({
      id: collection.id,
      name: collection.name,
      kind: collection.kind,
      items: items.map((i) => ({
        entryId: i.entryId,
        title: i.title,
        excerpt: excerpt(i.body),
        entryDate: i.entryDate,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Get collection error");
    res.status(500).json({ error: "Failed to load that collection" });
  }
});

// DELETE /collections/:id — remove the collection (items cascade).
router.delete("/collections/:id", async (req, res): Promise<void> => {
  try {
    const [row] = await db
      .delete(collectionsTable)
      .where(
        and(
          eq(collectionsTable.id, req.params.id),
          eq(collectionsTable.userId, req.userId!),
        ),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Collection not found" });
      return;
    }
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Delete collection error");
    res.status(500).json({ error: "Failed to delete that collection" });
  }
});

// Verify the collection belongs to the user before touching its items.
async function ownsCollection(userId: string, id: string): Promise<boolean> {
  const [c] = await db
    .select({ id: collectionsTable.id })
    .from(collectionsTable)
    .where(and(eq(collectionsTable.id, id), eq(collectionsTable.userId, userId)));
  return !!c;
}

// POST /collections/:id/items { entryId } — add a page (idempotent).
router.post("/collections/:id/items", async (req, res): Promise<void> => {
  const entryId = (req.body ?? {}).entryId;
  if (typeof entryId !== "string") {
    res.status(400).json({ error: "entryId required" });
    return;
  }
  try {
    if (!(await ownsCollection(req.userId!, req.params.id))) {
      res.status(404).json({ error: "Collection not found" });
      return;
    }
    const [entry] = await db
      .select({ id: journalEntriesTable.id })
      .from(journalEntriesTable)
      .where(
        and(
          eq(journalEntriesTable.id, entryId),
          eq(journalEntriesTable.userId, req.userId!),
        ),
      );
    if (!entry) {
      res.status(404).json({ error: "Page not found" });
      return;
    }
    const [existing] = await db
      .select({ id: collectionItemsTable.id })
      .from(collectionItemsTable)
      .where(
        and(
          eq(collectionItemsTable.collectionId, req.params.id),
          eq(collectionItemsTable.journalEntryId, entryId),
        ),
      );
    if (!existing) {
      const [{ nextOrder }] = await db
        .select({
          nextOrder: sql<number>`coalesce(max(${collectionItemsTable.orderIndex}), -1)::int + 1`,
        })
        .from(collectionItemsTable)
        .where(eq(collectionItemsTable.collectionId, req.params.id));
      await db.insert(collectionItemsTable).values({
        collectionId: req.params.id,
        journalEntryId: entryId,
        orderIndex: nextOrder,
      });
    }
    res.status(201).json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Add collection item error");
    res.status(500).json({ error: "Failed to add to collection" });
  }
});

// DELETE /collections/:id/items/:entryId — remove a page.
router.delete(
  "/collections/:id/items/:entryId",
  async (req, res): Promise<void> => {
    try {
      if (!(await ownsCollection(req.userId!, req.params.id))) {
        res.status(404).json({ error: "Collection not found" });
        return;
      }
      await db
        .delete(collectionItemsTable)
        .where(
          and(
            eq(collectionItemsTable.collectionId, req.params.id),
            eq(collectionItemsTable.journalEntryId, req.params.entryId),
          ),
        );
      res.status(204).end();
    } catch (err) {
      req.log.error({ err }, "Remove collection item error");
      res.status(500).json({ error: "Failed to remove from collection" });
    }
  },
);

export default router;

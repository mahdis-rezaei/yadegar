import { Router } from "express";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, journalEntriesTable } from "@workspace/db";
import { CreateEntryBody, UpdateEntryBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { SAMPLE_ENTRIES } from "../lib/sample-entries";
import { sanitizeRich, richToPlainText } from "../lib/rich-text";

const router = Router();

// Defense-in-depth size caps (the generated Zod schemas have no .max()). A single
// journal entry well past these is almost certainly abuse/accident; bulk archives
// go through the separate import path, not here. express.json already caps the
// whole body at 10MB — this bounds the individual fields.
const MAX_TITLE = 500;
const MAX_BODY = 100_000; // ~100KB plain text — very generous for one entry
const MAX_BODY_RICH = 400_000; // sanitized HTML runs larger than its plain text

function entryFieldsTooLarge(d: {
  title?: string | null;
  body?: string | null;
  bodyRich?: string | null;
}): boolean {
  return (
    (d.title?.length ?? 0) > MAX_TITLE ||
    (d.body?.length ?? 0) > MAX_BODY ||
    (d.bodyRich?.length ?? 0) > MAX_BODY_RICH
  );
}

// Scope auth to this router's own paths (NOT path-less) — a path-less
// router.use would run for every request reaching this root-mounted router,
// including the internal, cookieless /still/* engine calls.
router.use("/entries", requireAuth);

// GET /entries — the Library. Filters: year, month, favorite, source.
// (No server-side text search: body/title are encrypted at rest, so they can't
// be matched with SQL ILIKE. The Library searches client-side over the list.)
router.get("/entries", async (req, res): Promise<void> => {
  try {
    const { year, month, favorite, source } = req.query as Record<
      string,
      string | undefined
    >;

    const filters = [
      eq(journalEntriesTable.userId, req.userId!),
      isNull(journalEntriesTable.deletedAt),
    ];

    if (year && /^\d{4}$/.test(year)) {
      filters.push(
        sql`extract(year from ${journalEntriesTable.entryDate}) = ${Number(year)}`,
      );
    }
    if (month && /^\d{1,2}$/.test(month)) {
      filters.push(
        sql`extract(month from ${journalEntriesTable.entryDate}) = ${Number(month)}`,
      );
    }
    if (favorite === "true") {
      filters.push(eq(journalEntriesTable.favorite, true));
    }
    if (source) {
      filters.push(eq(journalEntriesTable.source, source as never));
    }

    const rows = await db
      .select()
      .from(journalEntriesTable)
      .where(and(...filters))
      .orderBy(
        // Undated pages sort to the end; otherwise newest entry date first.
        sql`${journalEntriesTable.entryDate} desc nulls last`,
        desc(journalEntriesTable.createdAt),
      );

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "List entries route error");
    res.status(500).json({ error: "Failed to list entries" });
  }
});

// GET /entries/summary — a lightweight journaling summary (first-entry date +
// count). Powers the "Your Year in Pages" anniversary banner without loading the
// whole archive. Declared before /entries/:id so "summary" isn't read as an id.
router.get("/entries/summary", async (req, res): Promise<void> => {
  try {
    const [row] = await db
      .select({
        firstEntryDate: sql<
          string | null
        >`min(${journalEntriesTable.entryDate})`,
        count: sql<number>`count(*)::int`,
      })
      .from(journalEntriesTable)
      .where(
        and(
          eq(journalEntriesTable.userId, req.userId!),
          isNull(journalEntriesTable.deletedAt),
        ),
      );
    res.json({
      firstEntryDate: row?.firstEntryDate ?? null,
      count: row?.count ?? 0,
    });
  } catch (err) {
    req.log.error({ err }, "Entries summary route error");
    res.status(500).json({ error: "Failed to load summary" });
  }
});

// POST /entries — create a manual entry.
router.post("/entries", async (req, res): Promise<void> => {
  const parsed = CreateEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A body is required" });
    return;
  }
  if (entryFieldsTooLarge(parsed.data)) {
    res.status(413).json({ error: "This entry is too large." });
    return;
  }

  // When the writer formatted the page, the sanitized HTML is authoritative and
  // the plain `body` the engine reads is derived from it (never trusted raw).
  let body = parsed.data.body;
  let bodyRich: string | null = null;
  if (parsed.data.bodyRich && parsed.data.bodyRich.trim()) {
    bodyRich = sanitizeRich(parsed.data.bodyRich);
    body = richToPlainText(bodyRich);
  }
  if (!body.trim()) {
    res.status(400).json({ error: "A body is required" });
    return;
  }

  try {
    const [row] = await db
      .insert(journalEntriesTable)
      .values({
        userId: req.userId!,
        title: parsed.data.title ?? null,
        body,
        bodyRich,
        entryDate: parsed.data.entryDate ?? null,
        source: "manual",
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Create entry route error");
    res.status(500).json({ error: "Failed to create entry" });
  }
});

// POST /entries/samples — seed a few sample pages so a hesitant first-timer can
// feel a real return before trusting Yadegar with their own words. Idempotent:
// if samples already exist, return them rather than duplicating.
// NB: declared before /entries/:id so the ":id" matcher never captures "samples".
router.post("/entries/samples", async (req, res): Promise<void> => {
  try {
    const existing = await db
      .select()
      .from(journalEntriesTable)
      .where(
        and(
          eq(journalEntriesTable.userId, req.userId!),
          eq(journalEntriesTable.source, "sample"),
          isNull(journalEntriesTable.deletedAt),
        ),
      )
      .orderBy(sql`${journalEntriesTable.entryDate} desc nulls last`);

    if (existing.length > 0) {
      res.json(existing);
      return;
    }

    const rows = await db
      .insert(journalEntriesTable)
      .values(
        SAMPLE_ENTRIES.map((s) => ({
          userId: req.userId!,
          title: s.title,
          body: s.body,
          entryDate: s.entryDate,
          source: "sample" as const,
        })),
      )
      .returning();
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Seed sample entries route error");
    res.status(500).json({ error: "Failed to add sample pages" });
  }
});

// DELETE /entries/samples — remove the user's sample pages (soft delete).
// Declared before /entries/:id for the same routing reason as above.
router.delete("/entries/samples", async (req, res): Promise<void> => {
  try {
    await db
      .update(journalEntriesTable)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(journalEntriesTable.userId, req.userId!),
          eq(journalEntriesTable.source, "sample"),
          isNull(journalEntriesTable.deletedAt),
        ),
      );
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Clear sample entries route error");
    res.status(500).json({ error: "Failed to remove sample pages" });
  }
});

// POST /entries/bulk-delete — soft-delete many of the user's pages at once (the
// Library's "delete selected"). Scoped to the user; ignores ids that aren't
// theirs. Declared before /entries/:id so "bulk-delete" isn't read as an id.
router.post("/entries/bulk-delete", async (req, res): Promise<void> => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
    res.status(400).json({ error: "A list of ids is required" });
    return;
  }
  if (ids.length === 0) {
    res.json({ deletedCount: 0 });
    return;
  }
  try {
    const rows = await db
      .update(journalEntriesTable)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(journalEntriesTable.userId, req.userId!),
          inArray(journalEntriesTable.id, ids as string[]),
          isNull(journalEntriesTable.deletedAt),
        ),
      )
      .returning({ id: journalEntriesTable.id });
    res.json({ deletedCount: rows.length });
  } catch (err) {
    req.log.error({ err }, "Bulk delete entries route error");
    res.status(500).json({ error: "Failed to remove pages" });
  }
});

// GET /entries/:id — a single entry (must belong to the user, not deleted).
// Opening the full page records last_opened_at (drives the "Forgotten Page"
// surfacer), done in the same statement via UPDATE…RETURNING.
router.get("/entries/:id", async (req, res): Promise<void> => {
  try {
    const [row] = await db
      .update(journalEntriesTable)
      .set({ lastOpenedAt: new Date() })
      .where(
        and(
          eq(journalEntriesTable.id, req.params.id),
          eq(journalEntriesTable.userId, req.userId!),
          isNull(journalEntriesTable.deletedAt),
        ),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Get entry route error");
    res.status(500).json({ error: "Failed to fetch entry" });
  }
});

// PATCH /entries/:id — edit title/body/date/favorite/resurfacing preference.
router.patch("/entries/:id", async (req, res): Promise<void> => {
  const parsed = UpdateEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid update" });
    return;
  }
  if (entryFieldsTooLarge(parsed.data)) {
    res.status(413).json({ error: "This entry is too large." });
    return;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;

  // Resolve the rich layer first: a non-empty bodyRich is sanitized and becomes
  // the source of truth for `body`; an explicit null/empty clears formatting and
  // falls back to the plain `body` the client sent.
  let newBody = parsed.data.body;
  if (parsed.data.bodyRich !== undefined) {
    if (parsed.data.bodyRich && parsed.data.bodyRich.trim()) {
      const clean = sanitizeRich(parsed.data.bodyRich);
      updates.bodyRich = clean;
      newBody = richToPlainText(clean);
    } else {
      updates.bodyRich = null;
    }
  }
  if (newBody !== undefined) {
    if (!newBody.trim()) {
      res.status(400).json({ error: "A body is required" });
      return;
    }
    updates.body = newBody;
    // The stored safety verdict was computed for the old text; invalidate it so
    // the entry isn't date-resurfaced under a stale verdict. The classifier cron
    // re-tags it once the new text settles.
    updates.resurfaceSafety = null;
  }
  if (parsed.data.entryDate !== undefined)
    updates.entryDate = parsed.data.entryDate;
  if (parsed.data.favorite !== undefined)
    updates.favorite = parsed.data.favorite;
  if (parsed.data.resurfacingPreference !== undefined)
    updates.resurfacingPreference = parsed.data.resurfacingPreference;

  try {
    const [row] = await db
      .update(journalEntriesTable)
      .set(updates)
      .where(
        and(
          eq(journalEntriesTable.id, req.params.id),
          eq(journalEntriesTable.userId, req.userId!),
          isNull(journalEntriesTable.deletedAt),
        ),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Update entry route error");
    res.status(500).json({ error: "Failed to update entry" });
  }
});

// DELETE /entries/:id — soft delete (sets deleted_at).
router.delete("/entries/:id", async (req, res): Promise<void> => {
  try {
    const [row] = await db
      .update(journalEntriesTable)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(journalEntriesTable.id, req.params.id),
          eq(journalEntriesTable.userId, req.userId!),
          isNull(journalEntriesTable.deletedAt),
        ),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Delete entry route error");
    res.status(500).json({ error: "Failed to delete entry" });
  }
});

export default router;

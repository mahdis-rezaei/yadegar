import { Router } from "express";
import { and, asc, eq } from "drizzle-orm";
import {
  db,
  journalImportsTable,
  parsedImportEntriesTable,
  journalEntriesTable,
  type JournalImport,
  type ParsedImportEntry,
} from "@workspace/db";
import {
  ImportPasteBody,
  ImportFileBody,
  UpdateParsedEntryBody,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { parseImport } from "../lib/parse-import";

const router = Router();
// Scope auth to /imports only (see entries.ts) so it never blocks /still/*.
router.use("/imports", requireAuth);

function toParsed(row: ParsedImportEntry) {
  return {
    id: row.id,
    detectedDate: row.detectedDate,
    dateConfidence: row.dateConfidence,
    body: row.body,
    title: row.title,
    include: row.include,
    orderIndex: row.orderIndex,
  };
}

async function buildReview(imp: JournalImport) {
  const entries = await db
    .select()
    .from(parsedImportEntriesTable)
    .where(eq(parsedImportEntriesTable.importId, imp.id))
    .orderBy(asc(parsedImportEntriesTable.orderIndex));
  return {
    id: imp.id,
    source: imp.source,
    status: imp.status,
    parsedCount: imp.parsedCount,
    importedCount: imp.importedCount,
    entries: entries.map(toParsed),
  };
}

// Shared: parse raw text, create an import session + parsed rows, return review.
async function createImport(
  userId: string,
  source: "paste" | "txt" | "markdown",
  rawText: string,
  originalFilename: string | null,
) {
  const segments = parseImport(rawText);

  const [imp] = await db
    .insert(journalImportsTable)
    .values({
      userId,
      source,
      originalFilename,
      status: "review",
      rawText,
      parsedCount: segments.length,
      importedCount: 0,
    })
    .returning();

  if (segments.length > 0) {
    await db.insert(parsedImportEntriesTable).values(
      segments.map((s) => ({
        importId: imp.id,
        userId,
        detectedDate: s.detectedDate,
        dateConfidence: s.dateConfidence,
        body: s.body,
        title: s.title,
        include: true,
        orderIndex: s.orderIndex,
      })),
    );
  }

  return buildReview(imp);
}

router.post("/imports/paste", async (req, res): Promise<void> => {
  const parsed = ImportPasteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Some text to import is required" });
    return;
  }
  try {
    const review = await createImport(
      req.userId!,
      "paste",
      parsed.data.rawText,
      null,
    );
    res.json(review);
  } catch (err) {
    req.log.error({ err }, "Import paste error");
    res.status(500).json({ error: "Failed to read that text" });
  }
});

router.post("/imports/file", async (req, res): Promise<void> => {
  const parsed = ImportFileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A file with text is required" });
    return;
  }
  const source = parsed.data.filename.toLowerCase().endsWith(".md")
    ? "markdown"
    : "txt";
  try {
    const review = await createImport(
      req.userId!,
      source,
      parsed.data.rawText,
      parsed.data.filename,
    );
    res.json(review);
  } catch (err) {
    req.log.error({ err }, "Import file error");
    res.status(500).json({ error: "Failed to read that file" });
  }
});

router.get("/imports/:id/review", async (req, res): Promise<void> => {
  try {
    const [imp] = await db
      .select()
      .from(journalImportsTable)
      .where(
        and(
          eq(journalImportsTable.id, req.params.id),
          eq(journalImportsTable.userId, req.userId!),
        ),
      );
    if (!imp) {
      res.status(404).json({ error: "Import not found" });
      return;
    }
    res.json(await buildReview(imp));
  } catch (err) {
    req.log.error({ err }, "Import review error");
    res.status(500).json({ error: "Failed to load import" });
  }
});

router.patch(
  "/imports/:id/parsed/:parsedEntryId",
  async (req, res): Promise<void> => {
    const parsed = UpdateParsedEntryBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid update" });
      return;
    }
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.detectedDate !== undefined)
      updates.detectedDate = parsed.data.detectedDate;
    if (parsed.data.body !== undefined) updates.body = parsed.data.body;
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.include !== undefined)
      updates.include = parsed.data.include;

    try {
      const [row] = await db
        .update(parsedImportEntriesTable)
        .set(updates)
        .where(
          and(
            eq(parsedImportEntriesTable.id, req.params.parsedEntryId),
            eq(parsedImportEntriesTable.importId, req.params.id),
            eq(parsedImportEntriesTable.userId, req.userId!),
          ),
        )
        .returning();
      if (!row) {
        res.status(404).json({ error: "Parsed entry not found" });
        return;
      }
      res.json(toParsed(row));
    } catch (err) {
      req.log.error({ err }, "Update parsed entry error");
      res.status(500).json({ error: "Failed to update entry" });
    }
  },
);

router.post("/imports/:id/confirm", async (req, res): Promise<void> => {
  try {
    const [imp] = await db
      .select()
      .from(journalImportsTable)
      .where(
        and(
          eq(journalImportsTable.id, req.params.id),
          eq(journalImportsTable.userId, req.userId!),
        ),
      );
    if (!imp) {
      res.status(404).json({ error: "Import not found" });
      return;
    }

    const parsedRows = await db
      .select()
      .from(parsedImportEntriesTable)
      .where(
        and(
          eq(parsedImportEntriesTable.importId, imp.id),
          eq(parsedImportEntriesTable.include, true),
        ),
      );

    const source = imp.source === "google_doc" ? "google_doc" : "file_import";
    const effectiveSource = imp.source === "paste" ? "pasted_import" : source;

    if (parsedRows.length > 0) {
      await db.insert(journalEntriesTable).values(
        parsedRows.map((p) => ({
          userId: req.userId!,
          body: p.body,
          entryDate: p.detectedDate,
          source: effectiveSource as never,
          sourceDocumentId: imp.id,
          sourceTitle: imp.originalFilename ?? imp.googleDocTitle ?? null,
          title: p.title,
        })),
      );
    }

    await db
      .update(journalImportsTable)
      .set({
        status: "imported",
        importedCount: parsedRows.length,
        updatedAt: new Date(),
      })
      .where(eq(journalImportsTable.id, imp.id));

    res.json({ importedCount: parsedRows.length });
  } catch (err) {
    req.log.error({ err }, "Confirm import error");
    res.status(500).json({ error: "Failed to import entries" });
  }
});

export default router;

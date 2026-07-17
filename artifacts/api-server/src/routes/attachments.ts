import express, { Router } from "express";
import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull } from "drizzle-orm";
import {
  db,
  journalEntriesTable,
  entryAttachmentsTable,
  encryptBytes,
  decryptBytes,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { putObject, getObject, deleteObject } from "../lib/object-storage";

const router = Router();

// 10 MB ceiling on the STORED image. The client resizes/compresses before
// upload, so a real photo lands well under this; the cap is a guard rail.
const MAX_BYTES = 10 * 1024 * 1024;

// Sniff the real image type from magic bytes rather than trusting the client's
// Content-Type. Returns null for anything that isn't an image we accept — the
// route rejects those. (Client uploads are canvas-encoded to JPEG, so JPEG is
// the common case; PNG/WebP/GIF are accepted for completeness.)
function detectImageMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  )
    return "image/png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  if (
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  return null;
}

function toInt(v: unknown): number | null {
  const n = typeof v === "string" ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Auth on every attachment path. Scoped (not path-less) so it never runs for the
// cookieless internal /still/* engine calls.
router.use("/entries/:entryId/attachments", requireAuth);
router.use("/attachments", requireAuth);

// POST /entries/:entryId/attachments — upload one image (raw bytes). Optional
// ?w=&h= carry the client-known pixel size for layout. The bytes are encrypted
// before they leave the server for object storage.
router.post(
  "/entries/:entryId/attachments",
  express.raw({ type: () => true, limit: "12mb" }),
  async (req, res): Promise<void> => {
    try {
      // The page must exist and belong to the user (and not be deleted).
      const [entry] = await db
        .select({ id: journalEntriesTable.id })
        .from(journalEntriesTable)
        .where(
          and(
            eq(journalEntriesTable.id, req.params.entryId),
            eq(journalEntriesTable.userId, req.userId!),
            isNull(journalEntriesTable.deletedAt),
          ),
        );
      if (!entry) {
        res.status(404).json({ error: "Page not found" });
        return;
      }

      const data = req.body;
      if (!Buffer.isBuffer(data) || data.length === 0) {
        res.status(400).json({ error: "No image was uploaded" });
        return;
      }
      if (data.length > MAX_BYTES) {
        res.status(413).json({ error: "That image is too large" });
        return;
      }
      const mimeType = detectImageMime(data);
      if (!mimeType) {
        res.status(415).json({ error: "That file isn't an image we can keep" });
        return;
      }

      const width = toInt(req.query.w);
      const height = toInt(req.query.h);
      const objectKey = `users/${req.userId}/entries/${entry.id}/${randomUUID()}`;

      const ciphertext = encryptBytes(data);
      await putObject(objectKey, ciphertext);

      const [row] = await db
        .insert(entryAttachmentsTable)
        .values({
          userId: req.userId!,
          journalEntryId: entry.id,
          objectKey,
          mimeType,
          width,
          height,
          byteSize: ciphertext.length,
        })
        .returning({
          id: entryAttachmentsTable.id,
          mimeType: entryAttachmentsTable.mimeType,
          width: entryAttachmentsTable.width,
          height: entryAttachmentsTable.height,
          createdAt: entryAttachmentsTable.createdAt,
        });

      res.status(201).json(row);
    } catch (err) {
      req.log.error({ err }, "Attachment upload error");
      res.status(500).json({ error: "Failed to attach the image" });
    }
  },
);

// GET /entries/:entryId/attachments — list an entry's image metadata (no bytes).
router.get(
  "/entries/:entryId/attachments",
  async (req, res): Promise<void> => {
    try {
      const rows = await db
        .select({
          id: entryAttachmentsTable.id,
          mimeType: entryAttachmentsTable.mimeType,
          width: entryAttachmentsTable.width,
          height: entryAttachmentsTable.height,
          createdAt: entryAttachmentsTable.createdAt,
        })
        .from(entryAttachmentsTable)
        .where(
          and(
            eq(entryAttachmentsTable.journalEntryId, req.params.entryId),
            eq(entryAttachmentsTable.userId, req.userId!),
          ),
        )
        .orderBy(asc(entryAttachmentsTable.createdAt));
      res.json(rows);
    } catch (err) {
      req.log.error({ err }, "List attachments error");
      res.status(500).json({ error: "Failed to load images" });
    }
  },
);

// GET /attachments/:id — stream the decrypted image bytes (owner only). The id
// is immutable, so the response is safely long-cacheable but marked private.
router.get("/attachments/:id", async (req, res): Promise<void> => {
  try {
    const [row] = await db
      .select()
      .from(entryAttachmentsTable)
      .where(
        and(
          eq(entryAttachmentsTable.id, req.params.id),
          eq(entryAttachmentsTable.userId, req.userId!),
        ),
      );
    if (!row) {
      res.status(404).json({ error: "Image not found" });
      return;
    }
    const ciphertext = await getObject(row.objectKey);
    const bytes = decryptBytes(ciphertext);
    res.setHeader("Content-Type", row.mimeType);
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    res.send(bytes);
  } catch (err) {
    req.log.error({ err }, "Serve attachment error");
    res.status(500).json({ error: "Failed to load the image" });
  }
});

// DELETE /attachments/:id — remove an image (owner only). The DB row goes first;
// the object is best-effort (an orphaned encrypted blob is harmless ciphertext).
router.delete("/attachments/:id", async (req, res): Promise<void> => {
  try {
    const [row] = await db
      .delete(entryAttachmentsTable)
      .where(
        and(
          eq(entryAttachmentsTable.id, req.params.id),
          eq(entryAttachmentsTable.userId, req.userId!),
        ),
      )
      .returning({ objectKey: entryAttachmentsTable.objectKey });
    if (!row) {
      res.status(404).json({ error: "Image not found" });
      return;
    }
    try {
      await deleteObject(row.objectKey);
    } catch (err) {
      req.log.warn({ err }, "Attachment object cleanup failed (orphaned)");
    }
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Delete attachment error");
    res.status(500).json({ error: "Failed to remove the image" });
  }
});

export default router;

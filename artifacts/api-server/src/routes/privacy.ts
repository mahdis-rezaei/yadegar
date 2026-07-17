import { Router } from "express";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  journalEntriesTable,
  entryAttachmentsTable,
  reflectionsTable,
  returnedMemoriesTable,
  type JournalEntry,
  type Reflection,
} from "@workspace/db";
import { requireAuth, clearSessionCookie } from "../lib/auth";
import { deleteObject } from "../lib/object-storage";
import { revokeAppleRefreshToken } from "../lib/apple";

const router = Router();
// Scope auth to /privacy (not path-less) so it never blocks /still/*.
router.use("/privacy", requireAuth);

function fmtDate(d: string | null): string {
  if (!d) return "Undated";
  const parsed = new Date(d + "T00:00:00");
  return Number.isNaN(parsed.getTime())
    ? d
    : parsed.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
}

// Gather a user's entries for an export scope, plus their reflections grouped by
// entry. Scopes: all (default) | favorites | year (+ year param).
async function gatherForExport(
  userId: string,
  scope: string | undefined,
  year: number | undefined,
): Promise<{ entries: JournalEntry[]; reflByEntry: Map<string, Reflection[]> }> {
  const filters = [
    eq(journalEntriesTable.userId, userId),
    isNull(journalEntriesTable.deletedAt),
  ];
  if (scope === "favorites") filters.push(eq(journalEntriesTable.favorite, true));
  if (scope === "year" && year) {
    filters.push(sql`extract(year from ${journalEntriesTable.entryDate}) = ${year}`);
  }

  const entries = await db
    .select()
    .from(journalEntriesTable)
    .where(and(...filters))
    .orderBy(asc(journalEntriesTable.entryDate));

  const reflections = await db
    .select()
    .from(reflectionsTable)
    .where(
      and(eq(reflectionsTable.userId, userId), isNull(reflectionsTable.deletedAt)),
    )
    .orderBy(asc(reflectionsTable.reflectionDate));

  const ids = new Set(entries.map((e) => e.id));
  const reflByEntry = new Map<string, Reflection[]>();
  for (const r of reflections) {
    if (!ids.has(r.journalEntryId)) continue;
    const list = reflByEntry.get(r.journalEntryId) ?? [];
    list.push(r);
    reflByEntry.set(r.journalEntryId, list);
  }
  return { entries, reflByEntry };
}

// Render entries (with their reflections) as Markdown or plain text.
function renderEntries(
  entries: JournalEntry[],
  reflByEntry: Map<string, Reflection[]>,
  markdown: boolean,
): string {
  const out: string[] = [];
  for (const e of entries) {
    out.push(markdown ? `## ${fmtDate(e.entryDate)}` : fmtDate(e.entryDate));
    if (e.title && e.title.trim()) {
      out.push(markdown ? `### ${e.title.trim()}` : e.title.trim());
    }
    out.push("", e.body.trim(), "");
    for (const r of reflByEntry.get(e.id) ?? []) {
      const head = `Reflection · ${fmtDate(r.reflectionDate)}`;
      if (markdown) {
        out.push(`> **${head}**`, ">");
        for (const line of r.body.trim().split("\n")) out.push(`> ${line}`);
      } else {
        out.push(`    — ${head}`);
        for (const line of r.body.trim().split("\n")) out.push(`    ${line}`);
      }
      out.push("");
    }
    out.push(markdown ? "---" : "—", "");
  }
  return out.join("\n");
}

// Shared handler for the readable, portable text exports (+ reflections).
// ?scope=all|favorites|year & ?year=YYYY.
async function sendTextExport(
  req: import("express").Request,
  res: import("express").Response,
  markdown: boolean,
): Promise<void> {
  try {
    const q = req.query as { scope?: string; year?: string };
    const year = q.year && /^\d{4}$/.test(q.year) ? Number(q.year) : undefined;
    const { entries, reflByEntry } = await gatherForExport(
      req.userId!,
      q.scope,
      year,
    );

    const name = req.user!.name ? `${req.user!.name}'s ` : "";
    const scopeLabel =
      q.scope === "favorites"
        ? " — favorites"
        : q.scope === "year" && year
          ? ` — ${year}`
          : "";
    const on = new Date().toISOString().slice(0, 10);
    const header = markdown
      ? [`# ${name}journals${scopeLabel}`, "", `_Exported ${on} from Yadegar._`, "", ""]
      : [
          `${name}journals${scopeLabel}`.toUpperCase(),
          `Exported ${on} from Yadegar.`,
          "",
          "",
        ];

    res.type(markdown ? "text/markdown" : "text/plain");
    res.send(header.join("\n") + renderEntries(entries, reflByEntry, markdown));
  } catch (err) {
    req.log.error({ err }, "Text export error");
    res.status(500).json({ error: "Failed to export your journals" });
  }
}

// GET /privacy/export/markdown and /privacy/export/text
router.get("/privacy/export/markdown", (req, res) => sendTextExport(req, res, true));
router.get("/privacy/export/text", (req, res) => sendTextExport(req, res, false));

// GET /privacy/export — everything the user has written and been returned.
router.get("/privacy/export", async (req, res): Promise<void> => {
  try {
    const user = req.user!;

    const entries = await db
      .select()
      .from(journalEntriesTable)
      .where(
        and(
          eq(journalEntriesTable.userId, user.id),
          isNull(journalEntriesTable.deletedAt),
        ),
      )
      .orderBy(asc(journalEntriesTable.entryDate));

    const reflections = await db
      .select()
      .from(reflectionsTable)
      .where(
        and(
          eq(reflectionsTable.userId, user.id),
          isNull(reflectionsTable.deletedAt),
        ),
      )
      .orderBy(asc(reflectionsTable.createdAt));

    const memories = await db
      .select()
      .from(returnedMemoriesTable)
      .where(eq(returnedMemoriesTable.userId, user.id))
      .orderBy(desc(returnedMemoriesTable.createdAt));

    // Attachment metadata only (the encrypted bytes live in object storage and
    // are downloadable per-image via the app).
    const attachments = await db
      .select({
        id: entryAttachmentsTable.id,
        journalEntryId: entryAttachmentsTable.journalEntryId,
        mimeType: entryAttachmentsTable.mimeType,
        width: entryAttachmentsTable.width,
        height: entryAttachmentsTable.height,
        createdAt: entryAttachmentsTable.createdAt,
      })
      .from(entryAttachmentsTable)
      .where(eq(entryAttachmentsTable.userId, user.id))
      .orderBy(asc(entryAttachmentsTable.createdAt));

    res.json({
      exportedAt: new Date().toISOString(),
      account: {
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
      entries,
      reflections,
      memories,
      attachments,
    });
  } catch (err) {
    req.log.error({ err }, "Export error");
    res.status(500).json({ error: "Failed to export your data" });
  }
});

// DELETE /privacy/account — permanent. Deleting the user row cascades to every
// child table (sessions, entries, reflections, memories, imports, prefs) via
// the schema's onDelete: "cascade" foreign keys, and frees the email for reuse.
router.delete("/privacy/account", async (req, res): Promise<void> => {
  try {
    // Revoke the Sign in with Apple grant if we hold a refresh token, so the
    // account is fully severed from Apple (App Store 5.1.1(v)). Best-effort and
    // pre-delete — a revoke failure must never strand an un-deletable account.
    const appleRefreshToken = req.user?.appleRefreshToken;
    if (appleRefreshToken) {
      try {
        await revokeAppleRefreshToken(appleRefreshToken);
      } catch (err) {
        req.log.warn({ err }, "Apple token revoke on account delete failed");
      }
    }

    // Delete the user's image blobs from object storage first — the DB cascade
    // frees their rows but can't reach bytes stored outside Postgres. Best-effort
    // and pre-delete, so a storage hiccup can't strand an un-deletable account.
    try {
      const objs = await db
        .select({ objectKey: entryAttachmentsTable.objectKey })
        .from(entryAttachmentsTable)
        .where(eq(entryAttachmentsTable.userId, req.userId!));
      await Promise.allSettled(objs.map((o) => deleteObject(o.objectKey)));
    } catch (err) {
      req.log.warn({ err }, "Attachment cleanup on account delete failed");
    }

    await db.delete(usersTable).where(eq(usersTable.id, req.userId!));
    clearSessionCookie(res);
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Account deletion error");
    res.status(500).json({ error: "Failed to delete your account" });
  }
});

export default router;

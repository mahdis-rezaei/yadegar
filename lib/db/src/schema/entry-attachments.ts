import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { journalEntriesTable } from "./journal-entries";

// An image attached to a journal page. The bytes never live in Postgres: they're
// app-encrypted (AES-256-GCM, the same key as the journal text) and stored in
// object storage under `objectKey`. This table holds only the metadata + the key
// needed to fetch and decrypt them. Images are NEVER sent to the memory engine
// and NEVER resurfaced — they only appear when the writer opens the full page.
export const entryAttachmentsTable = pgTable("entry_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  journalEntryId: uuid("journal_entry_id")
    .notNull()
    .references(() => journalEntriesTable.id, { onDelete: "cascade" }),
  // Storage key (e.g. users/<uid>/entries/<eid>/<uuid>). The object at this key
  // is ciphertext; the server decrypts it in memory when serving the image.
  objectKey: text("object_key").notNull(),
  mimeType: text("mime_type").notNull(),
  // Intrinsic pixel size (for layout, supplied by the client at upload). The
  // bytes are resized client-side before upload, so these reflect the stored
  // image, not the original camera capture.
  width: integer("width"),
  height: integer("height"),
  // Size of the stored (encrypted) object, for accounting.
  byteSize: integer("byte_size"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type EntryAttachment = typeof entryAttachmentsTable.$inferSelect;
export type InsertEntryAttachment = typeof entryAttachmentsTable.$inferInsert;

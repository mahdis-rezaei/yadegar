import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Application-level encryption for sensitive journal text (AES-256-GCM,
// authenticated). The DB stores ciphertext, so a stolen database dump is
// useless without ENCRYPTION_KEY (held only in the server environment).
//
// Format: "enc:v1:" + base64(iv[12] | authTag[16] | ciphertext). Values without
// that prefix are treated as legacy plaintext and passed through unchanged, so
// turning encryption on doesn't break rows written before it existed.

const PREFIX = "enc:v1:";

// Lazy so importing the schema (e.g. for drizzle-kit DDL, which never
// encrypts/decrypts) doesn't require the key — only actual reads/writes do.
function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY must be set (64 hex chars = 32 bytes). Generate with: openssl rand -hex 32",
    );
  }
  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex characters).");
  }
  return key;
}

export function encrypt(plaintext: string): string {
  if (plaintext == null) return plaintext;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decrypt(value: string): string {
  if (value == null) return value;
  if (!value.startsWith(PREFIX)) return value; // legacy plaintext — pass through
  const buf = Buffer.from(value.slice(PREFIX.length), "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
    "utf8",
  );
}

// Binary variant of the above, for encrypting file bytes (e.g. attached images)
// before they leave the server for object storage — so a stolen bucket is just
// as useless as a stolen DB dump without ENCRYPTION_KEY. Layout is the same
// (iv[12] | authTag[16] | ciphertext) but kept as raw bytes, no base64/prefix:
// the blob is always our ciphertext, so there's no legacy-plaintext case.
export function encryptBytes(plaintext: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}

export function decryptBytes(buf: Buffer): Buffer {
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

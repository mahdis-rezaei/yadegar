// Thin wrapper over Replit Object Storage (@replit/object-storage). The client
// auto-discovers the workspace's default bucket; set OBJECT_STORAGE_BUCKET_ID to
// target a specific one. Kept behind this seam so the rest of the app deals in
// putObject/getObject/deleteObject and never the SDK's Result type — and so a
// future swap to S3/R2 is a one-file change.
//
// The import is dynamic + string-cast so a) the server only requires the SDK if
// attachments are actually used, and b) the local typecheck doesn't need the
// package installed. esbuild keeps it external (see build.mjs), so at runtime
// Node resolves it from node_modules.

type OSResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: unknown };

interface OSClient {
  uploadFromBytes(key: string, contents: Buffer): Promise<OSResult<unknown>>;
  downloadAsBytes(key: string): Promise<OSResult<Buffer | Buffer[]>>;
  delete(key: string): Promise<OSResult<unknown>>;
}

let clientPromise: Promise<OSClient> | null = null;

async function getClient(): Promise<OSClient> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const mod = await import("@replit/object-storage" as string);
      const bucketId = process.env.OBJECT_STORAGE_BUCKET_ID;
      return new mod.Client(
        bucketId ? { bucketId } : undefined,
      ) as OSClient;
    })();
  }
  return clientPromise;
}

function messageOf(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

export async function putObject(key: string, contents: Buffer): Promise<void> {
  const client = await getClient();
  const res = await client.uploadFromBytes(key, contents);
  if (!res.ok) throw new Error(`Object storage upload failed: ${messageOf(res.error)}`);
}

export async function getObject(key: string): Promise<Buffer> {
  const client = await getClient();
  const res = await client.downloadAsBytes(key);
  if (!res.ok) throw new Error(`Object storage download failed: ${messageOf(res.error)}`);
  // The SDK may return a single Buffer or an array of chunks depending on
  // version — normalize to one Buffer.
  return Array.isArray(res.value) ? Buffer.concat(res.value) : res.value;
}

export async function deleteObject(key: string): Promise<void> {
  const client = await getClient();
  const res = await client.delete(key);
  if (!res.ok) throw new Error(`Object storage delete failed: ${messageOf(res.error)}`);
}

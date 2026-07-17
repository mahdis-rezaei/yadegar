import { and, eq, inArray } from "drizzle-orm";
import { db, deviceTokensTable } from "@workspace/db";
import { logger } from "./logger";

// Push via the Expo Push API (no SDK) — the native counterpart to email nudges.
// Mirrors lib/email.ts: a thin fetch wrapper that no-ops gracefully rather than
// throwing, so a push failure never breaks the cron's email path beside it.
//
// One product rule carries over from email: pushes are gentle and opt-in, and a
// memory push only ever carries a page that actually surfaced (the engine's
// silence discipline holds — see routes/cron.ts). This module only delivers.

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
// Expo accepts up to 100 messages per request.
const CHUNK = 100;

export interface PushMessage {
  title: string;
  body: string;
  // Arbitrary payload the app reads on tap (e.g. a deep link target).
  data?: Record<string, unknown>;
}

type ExpoTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; details?: { error?: string } };

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Send to a set of raw Expo tokens. Returns the tokens Expo reports as no longer
// valid (DeviceNotRegistered) so the caller can prune them. Never throws.
async function sendToTokens(
  tokens: string[],
  msg: PushMessage,
): Promise<{ invalid: string[] }> {
  const invalid: string[] = [];
  for (const batch of chunk(tokens, CHUNK)) {
    const messages = batch.map((to) => ({
      to,
      title: msg.title,
      body: msg.body,
      data: msg.data ?? {},
      sound: "default",
    }));
    try {
      const res = await fetch(EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(messages),
      });
      if (!res.ok) {
        logger.warn(
          { status: res.status },
          "Expo push send returned non-OK; skipping batch",
        );
        continue;
      }
      const json = (await res.json().catch(() => null)) as {
        data?: ExpoTicket[];
      } | null;
      const tickets = json?.data ?? [];
      tickets.forEach((t, i) => {
        if (
          t.status === "error" &&
          t.details?.error === "DeviceNotRegistered"
        ) {
          invalid.push(batch[i]);
        }
      });
    } catch (err) {
      logger.warn({ err }, "Expo push send failed; skipping batch");
    }
  }
  return { invalid };
}

// Send one push to every device a user has registered. No-ops when the user has
// no devices (e.g. web-only). Prunes tokens Expo rejects so the table self-heals.
export async function sendPushToUser(
  userId: string,
  msg: PushMessage,
): Promise<{ sent: number; pruned: number }> {
  const rows = await db
    .select({ token: deviceTokensTable.token })
    .from(deviceTokensTable)
    .where(eq(deviceTokensTable.userId, userId));
  const tokens = rows.map((r) => r.token);
  if (tokens.length === 0) return { sent: 0, pruned: 0 };

  const { invalid } = await sendToTokens(tokens, msg);
  if (invalid.length > 0) {
    await db
      .delete(deviceTokensTable)
      .where(
        and(
          eq(deviceTokensTable.userId, userId),
          inArray(deviceTokensTable.token, invalid),
        ),
      );
  }
  return { sent: tokens.length - invalid.length, pruned: invalid.length };
}

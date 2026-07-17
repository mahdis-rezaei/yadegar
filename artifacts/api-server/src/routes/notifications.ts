import { Router } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  notificationPreferencesTable,
  deviceTokensTable,
  type NotificationPreference,
  type DevicePlatform,
} from "@workspace/db";
import { UpdateNotificationsBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router = Router();
router.use("/notifications", requireAuth);

function toPrefs(row: NotificationPreference) {
  return {
    writingFrequency: row.writingFrequency,
    memoryFrequency: row.memoryFrequency,
  };
}

// GET /notifications — returns prefs, creating a default (off/off) row if none.
router.get("/notifications", async (req, res): Promise<void> => {
  try {
    let [row] = await db
      .select()
      .from(notificationPreferencesTable)
      .where(eq(notificationPreferencesTable.userId, req.userId!));
    if (!row) {
      [row] = await db
        .insert(notificationPreferencesTable)
        .values({ userId: req.userId! })
        .returning();
    }
    res.json(toPrefs(row));
  } catch (err) {
    req.log.error({ err }, "Get notifications error");
    res.status(500).json({ error: "Failed to load preferences" });
  }
});

// PATCH /notifications — upsert the user's cadence choices.
router.patch("/notifications", async (req, res): Promise<void> => {
  const parsed = UpdateNotificationsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid preferences" });
    return;
  }
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.writingFrequency !== undefined)
    set.writingFrequency = parsed.data.writingFrequency;
  if (parsed.data.memoryFrequency !== undefined)
    set.memoryFrequency = parsed.data.memoryFrequency;

  try {
    const [row] = await db
      .insert(notificationPreferencesTable)
      .values({
        userId: req.userId!,
        writingFrequency: parsed.data.writingFrequency ?? "off",
        memoryFrequency: parsed.data.memoryFrequency ?? "off",
      })
      .onConflictDoUpdate({
        target: notificationPreferencesTable.userId,
        set,
      })
      .returning();
    res.json(toPrefs(row));
  } catch (err) {
    req.log.error({ err }, "Update notifications error");
    res.status(500).json({ error: "Failed to save preferences" });
  }
});

// POST /notifications/devices { token, platform? } — register (or refresh) this
// device's Expo push token so the nudge cron can reach it. Idempotent: the same
// token upserts (re-attaching it to this user and bumping updatedAt) rather than
// duplicating, so a re-install or a token rotation is safe to call on every app
// open. Mobile-only; the web never calls this.
router.post("/notifications/devices", async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as { token?: unknown; platform?: unknown };
  const token = typeof body.token === "string" ? body.token.trim() : "";
  // Expo push tokens look like "ExponentPushToken[...]" / "ExpoPushToken[...]".
  if (!token || !token.startsWith("Expo")) {
    res.status(400).json({ error: "A valid Expo push token is required" });
    return;
  }
  const platform =
    body.platform === "ios" || body.platform === "android"
      ? (body.platform as DevicePlatform)
      : undefined;

  try {
    await db
      .insert(deviceTokensTable)
      .values({ userId: req.userId!, token, platform })
      .onConflictDoUpdate({
        target: deviceTokensTable.token,
        // Re-attach the token to whoever registered it last (shared device) and
        // refresh platform + updatedAt.
        set: { userId: req.userId!, platform, updatedAt: new Date() },
      });
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Register device token error");
    res.status(500).json({ error: "Failed to register device" });
  }
});

// DELETE /notifications/devices { token } — unregister on sign-out so a shared
// device stops receiving this user's pushes. Scoped to the caller's own tokens.
router.delete("/notifications/devices", async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as { token?: unknown };
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    res.status(400).json({ error: "A token is required" });
    return;
  }
  try {
    await db
      .delete(deviceTokensTable)
      .where(
        and(
          eq(deviceTokensTable.userId, req.userId!),
          eq(deviceTokensTable.token, token),
        ),
      );
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Unregister device token error");
    res.status(500).json({ error: "Failed to unregister device" });
  }
});

export default router;

import { api, getToken, API_ORIGIN } from "./api";

// Settings: notification cadence, memory sensitivity, profile name, data export,
// and account deletion — all on existing backend endpoints.

export type NudgeFreq = "off" | "weekly" | "monthly";
export type MemorySensitivity = "open" | "gentle" | "protected";

export interface NotificationPrefs {
  writingFrequency: NudgeFreq;
  memoryFrequency: NudgeFreq;
}

export const getNotifications = () => api<NotificationPrefs>("/notifications");

export const updateNotifications = (patch: Partial<NotificationPrefs>) =>
  api<NotificationPrefs>("/notifications", { method: "PATCH", body: patch });

export const getPreferences = () =>
  api<{ memorySensitivity: MemorySensitivity }>("/preferences");

export const updatePreferences = (memorySensitivity: MemorySensitivity) =>
  api<{ memorySensitivity: MemorySensitivity }>("/preferences", {
    method: "PATCH",
    body: { memorySensitivity },
  });

// Muted periods (/resurface-mutes): a date range whose pages never resurface —
// the "don't bring back this season" control for a grief window or a hard year.
export interface ResurfaceMute {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  createdAt: string;
}

export const listMutes = () => api<ResurfaceMute[]>("/resurface-mutes");

export const addMute = (startDate: string, endDate: string) =>
  api<ResurfaceMute>("/resurface-mutes", {
    method: "POST",
    body: { startDate, endDate },
  });

export const deleteMute = (id: string) =>
  api(`/resurface-mutes/${id}`, { method: "DELETE" });

// Per-page resurfacing preference (PATCH /entries/:id). "never" keeps a single
// page from ever returning unbidden; "more_often" invites it back more.
export type ResurfacingPreference = "normal" | "more_often" | "never";

export const updateEntryResurfacing = (
  entryId: string,
  resurfacingPreference: ResurfacingPreference,
) =>
  api(`/entries/${entryId}`, {
    method: "PATCH",
    body: { resurfacingPreference },
  });

// PATCH /auth/me — edit the display name.
export const updateProfileName = (name: string) =>
  api("/auth/me", { method: "PATCH", body: { name } });

// DELETE /privacy/account — permanent; cascades to all the user's data.
export const deleteAccount = () =>
  api("/privacy/account", { method: "DELETE" });

// Portable exports. Markdown/text honour a scope (everything | favorites); JSON
// is the complete archive. Fetched as raw text (the shared api() helper would
// JSON-parse) so the caller can share it.
export type ExportFormat = "markdown" | "text" | "json";
export type ExportScope = "all" | "favorites";

export async function fetchExport(
  format: ExportFormat,
  scope: ExportScope = "all",
): Promise<string> {
  const token = await getToken();
  const path =
    format === "json"
      ? "privacy/export"
      : `privacy/export/${format}?scope=${scope}`;
  const res = await fetch(`${API_ORIGIN}/api/${path}`, {
    headers: {
      "X-Yadegar-Client": "mobile",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  return res.text();
}

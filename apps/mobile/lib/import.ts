import { requireOptionalNativeModule } from "expo-modules-core";
import { api } from "./api";

// Paste import: bring past journaling in by pasting text. The backend parses it
// into dated entries you review, then confirm. Mirrors the web's paste flow
// (POST /imports/paste → review → PATCH includes → POST confirm).

// True only on a build with the document picker (needs the next eas build).
export function fileImportAvailable(): boolean {
  try {
    return requireOptionalNativeModule("ExpoDocumentPicker") != null;
  } catch {
    return false;
  }
}

// Pick a .txt / .md file and read its text, to feed the same paste flow. Returns
// null if cancelled or the picker module isn't in the build yet.
export async function pickImportFileText(): Promise<string | null> {
  if (!fileImportAvailable()) return null;
  try {
    const DocumentPicker = await import("expo-document-picker");
    const res = await DocumentPicker.getDocumentAsync({
      type: ["text/plain", "text/markdown", "public.plain-text"],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.[0]) return null;
    // SDK 54: the string/file helpers live on the legacy subpath now.
    const FileSystem = await import("expo-file-system/legacy");
    return await FileSystem.readAsStringAsync(res.assets[0].uri);
  } catch {
    return null;
  }
}

export type DateConfidence = "high" | "medium" | "low" | "unknown";

export interface ParsedEntry {
  id: string;
  detectedDate?: string | null;
  dateConfidence: DateConfidence;
  body: string;
  title?: string | null;
  include: boolean;
  orderIndex?: number | null;
}

export interface ImportReview {
  id: string;
  source: string;
  status: string;
  parsedCount: number;
  importedCount: number;
  entries: ParsedEntry[];
}

export const pasteImport = (rawText: string) =>
  api<ImportReview>("/imports/paste", { method: "POST", body: { rawText } });

export const getImportReview = (id: string) =>
  api<ImportReview>(`/imports/${id}/review`);

export const updateParsedEntry = (
  importId: string,
  parsedEntryId: string,
  patch: Partial<{
    include: boolean;
    detectedDate: string | null;
    title: string | null;
    body: string;
  }>,
) =>
  api<ParsedEntry>(`/imports/${importId}/parsed/${parsedEntryId}`, {
    method: "PATCH",
    body: patch,
  });

export const confirmImport = (id: string) =>
  api<{ importedCount: number }>(`/imports/${id}/confirm`, { method: "POST" });

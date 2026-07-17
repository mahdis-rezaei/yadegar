import { requireOptionalNativeModule } from "expo-modules-core";
import { API_ORIGIN, getToken } from "./api";

// True only on a build that includes the image-picker native module. Lets us skip
// importing expo-image-picker on a build without it (importing it throws "Cannot
// find native module" out of band, escaping try/catch).
export function photosAvailable(): boolean {
  try {
    return requireOptionalNativeModule("ExpoImagePicker") != null;
  } catch {
    return false;
  }
}

// Photos on a page (entry attachments). Mirrors the web: pick from the library or
// camera, upload the raw bytes to the existing /attachments backend (encrypted at
// rest server-side), list + view + delete. The image bytes endpoint is auth'd, so
// <Image> sources carry the bearer header.
//
// expo-image-picker / expo-file-system are NATIVE modules — imported lazily and
// guarded so the file is safe to load on a build that doesn't include them yet
// (photos simply no-op until the app is rebuilt with the modules).

export interface Attachment {
  id: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  createdAt: string;
}

function authHeaders(token: string | null): Record<string, string> {
  return {
    "X-Yadegar-Client": "mobile",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

export async function listAttachments(entryId: string): Promise<Attachment[]> {
  const token = await getToken();
  const res = await fetch(
    `${API_ORIGIN}/api/entries/${entryId}/attachments`,
    { headers: authHeaders(token) },
  );
  if (!res.ok) throw new Error(`List attachments failed: ${res.status}`);
  return res.json();
}

// An <Image source> for an attachment, with the auth header the bytes route needs.
export async function attachmentSource(id: string) {
  const token = await getToken();
  return { uri: `${API_ORIGIN}/api/attachments/${id}`, headers: authHeaders(token) };
}

export async function deleteAttachment(id: string): Promise<void> {
  const token = await getToken();
  await fetch(`${API_ORIGIN}/api/attachments/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

// Pick an image from the library or camera. Returns the local file + size, or null
// (cancelled / denied / no native module). Re-encodes to JPEG via the picker's
// quality so the backend (JPEG/PNG only) accepts it.
export async function pickImage(
  from: "library" | "camera",
): Promise<{ uri: string; width?: number; height?: number } | null> {
  if (!photosAvailable()) return null;
  try {
    const ImagePicker = await import("expo-image-picker");
    if (from === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return null;
      const r = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      if (r.canceled || !r.assets?.[0]) return null;
      const a = r.assets[0];
      return { uri: a.uri, width: a.width, height: a.height };
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return null;
    const r = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7,
      // SDK 54: MediaTypeOptions removed; mediaTypes now takes a string array.
      mediaTypes: ["images"],
    });
    if (r.canceled || !r.assets?.[0]) return null;
    const a = r.assets[0];
    return { uri: a.uri, width: a.width, height: a.height };
  } catch {
    return null;
  }
}

// Upload the local image's raw bytes to the page (the backend reads raw bytes via
// express.raw). expo-file-system's BINARY_CONTENT sends the file as the body.
export async function uploadAttachment(
  entryId: string,
  fileUri: string,
  width?: number,
  height?: number,
): Promise<Attachment | null> {
  try {
    // SDK 54: uploadAsync / FileSystemUploadType live on the legacy subpath now.
    const FileSystem = await import("expo-file-system/legacy");
    const token = await getToken();
    const q = width && height ? `?w=${width}&h=${height}` : "";
    const res = await FileSystem.uploadAsync(
      `${API_ORIGIN}/api/entries/${entryId}/attachments${q}`,
      fileUri,
      {
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { ...authHeaders(token), "content-type": "image/jpeg" },
      },
    );
    if (res.status >= 200 && res.status < 300) {
      return JSON.parse(res.body) as Attachment;
    }
    return null;
  } catch {
    return null;
  }
}

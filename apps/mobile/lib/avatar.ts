import { requireOptionalNativeModule } from "expo-modules-core";

// The avatar palette — muted, on-brand tones (echoing the rich-text colours).
// A chosen colour is stored on the user; without one we derive a stable colour
// from the name so every avatar still looks intentional. Mirrors lib/avatar on web.
export const AVATAR_COLORS = [
  "#8DA174", // sage
  "#9C8BB4", // lilac
  "#E0A98C", // peach
  "#D2A857", // gold
  "#B98A8A", // mauve
  "#8AA0BE", // dusk blue
];

type AvatarUserLike = {
  name?: string | null;
  email?: string | null;
  avatarColor?: string | null;
  avatarUrl?: string | null;
} | null | undefined;

export function avatarColorFor(user: AvatarUserLike): string {
  if (user?.avatarColor) return user.avatarColor;
  const seed = (user?.name || user?.email || "?").trim();
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function avatarInitial(user: AvatarUserLike): string {
  const s = (user?.name || user?.email || "?").trim();
  return (s[0] || "?").toUpperCase();
}

// True only on a build with BOTH the image picker and the manipulator (used to
// shrink the photo under the server's avatar size cap). Checked via expo-modules-
// core so we never import a missing native module (which crashes out of band).
export function avatarPhotoAvailable(): boolean {
  try {
    return (
      requireOptionalNativeModule("ExpoImagePicker") != null &&
      requireOptionalNativeModule("ExpoImageManipulator") != null
    );
  } catch {
    return false;
  }
}

// Pick → square-crop → shrink to a ~256px JPEG data URL (kept under the server's
// 400KB avatar cap). Returns null if cancelled, denied, or the modules aren't in
// the build yet.
export async function pickAvatarDataUrl(): Promise<string | null> {
  if (!avatarPhotoAvailable()) return null;
  try {
    const ImagePicker = await import("expo-image-picker");
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return null;
    const r = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
      // SDK 54: MediaTypeOptions removed; mediaTypes now takes a string array.
      mediaTypes: ["images"],
    });
    if (r.canceled || !r.assets?.[0]) return null;
    const Manip = await import("expo-image-manipulator");
    const out = await Manip.manipulateAsync(
      r.assets[0].uri,
      [{ resize: { width: 256, height: 256 } }],
      { compress: 0.82, format: Manip.SaveFormat.JPEG, base64: true },
    );
    return out.base64 ? `data:image/jpeg;base64,${out.base64}` : null;
  } catch {
    return null;
  }
}

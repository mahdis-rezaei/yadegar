// The avatar palette, muted, on-brand tones (echoing the rich-text colours).
// A chosen colour is stored on the user; without one we derive a stable colour
// from the name so every avatar still looks intentional.
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

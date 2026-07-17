import { api } from "./api";
import type { MobileUser } from "./auth";

// Profile edits: display name, avatar colour, avatar photo (a small data: URL),
// and a signed-in password change. All on existing /auth endpoints.

export const updateProfile = (patch: {
  name?: string;
  avatarColor?: string | null;
  avatarUrl?: string | null;
}) => api<MobileUser>("/auth/me", { method: "PATCH", body: patch });

export const changePassword = (currentPassword: string, newPassword: string) =>
  api("/auth/change-password", {
    method: "POST",
    body: { currentPassword, newPassword },
  });

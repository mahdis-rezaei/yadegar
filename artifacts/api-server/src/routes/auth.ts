import { Router } from "express";
import {
  createPublicKey,
  randomBytes,
  verify as verifySignature,
} from "node:crypto";
// JsonWebKey is an ambient global type (not exported by node:crypto), so it's
// used below without an import — importing it from node:crypto is a type error.
import { eq } from "drizzle-orm";
import { db, usersTable, sessionsTable, type User } from "@workspace/db";
import {
  RegisterBody,
  LoginBody,
  VerifyEmailBody,
  RequestPasswordResetBody,
  ResetPasswordBody,
} from "@workspace/api-zod";
import {
  hashPassword,
  verifyPassword,
  createSession,
  deleteSession,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  sessionTokenFrom,
  deleteOtherUserSessions,
  SESSION_COOKIE,
  googleConfigured,
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  createAuthToken,
  consumeAuthToken,
} from "../lib/auth";
import {
  sendEmail,
  welcomeEmail,
  verificationEmail,
  passwordResetEmail,
} from "../lib/email";
import { rateLimit, ipKey } from "../lib/rate-limit";
import { getUsageSummary, QUOTA_ENFORCED } from "../lib/quota";
import { exchangeAppleAuthCode } from "../lib/apple";

const VERIFY_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const RESET_TTL_MS = 1000 * 60 * 60; // 1 hour

// Create + email a verification link. Best-effort: never throws into the caller.
async function sendVerification(
  user: User,
  log: { error: (o: unknown, m: string) => void },
): Promise<void> {
  try {
    const token = await createAuthToken(user.id, "email_verify", VERIFY_TTL_MS);
    const link = `${appUrl()}/verify-email?token=${token}`;
    const mail = verificationEmail(link);
    await sendEmail({ to: user.email, ...mail });
  } catch (err) {
    log.error({ err }, "Failed to send verification email");
  }
}

const router = Router();

// Per-IP throttle on credential endpoints to blunt brute-force / signup abuse.
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyOf: ipKey,
  message: "Too many attempts. Please wait a few minutes and try again.",
});

const OAUTH_STATE_COOKIE = "still_oauth_state";
const OAUTH_RETURN_TO_COOKIE = "still_oauth_return_to";

function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:5173").replace(/\/+$/, "");
}

function mobileReturnTo(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;

  try {
    const url = new URL(raw);
    if (
      url.protocol === "yadegar:" ||
      url.protocol === "exp:" ||
      url.protocol === "exps:" ||
      // Expo dev/preview builds deep-link via an "exp+<scheme>:" protocol
      // (e.g. "exp+yadegar:"). Without this, Google sign-in from a dev build
      // can't return to the app and falls back to the website. Safe to allow:
      // a custom scheme only opens an app registered for it (never a web
      // open-redirect — http/https are still rejected).
      url.protocol.startsWith("exp+")
    ) {
      return raw;
    }
  } catch {
    return null;
  }

  return null;
}

function appendOAuthResult(
  returnTo: string,
  params: Record<string, string>,
): string {
  const url = new URL(returnTo);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";

// A JSON Web Key, as Apple returns in its JWKS. Defined locally because
// node:crypto doesn't export JsonWebKey and the DOM lib's global isn't in this
// server's tsconfig. Fields cover the RSA (n/e) and EC (crv/x/y) keys Apple uses;
// it's structurally compatible with what createPublicKey({ format: "jwk" }) wants.
interface JsonWebKey {
  kty?: string;
  kid?: string;
  use?: string;
  alg?: string;
  n?: string;
  e?: string;
  crv?: string;
  x?: string;
  y?: string;
}

let appleKeysCache: { keys: JsonWebKey[]; expiresAt: number } | null = null;

type AppleJwtHeader = {
  alg?: string;
  kid?: string;
};

type AppleJwtPayload = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
};

function base64UrlDecode(value: string): Buffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

function parseJwtPart<T>(value: string): T {
  return JSON.parse(base64UrlDecode(value).toString("utf8")) as T;
}

function appleAudience(): string {
  return process.env.APPLE_CLIENT_ID ?? process.env.IOS_BUNDLE_ID ?? "com.yadegar.app";
}

async function applePublicKeys(): Promise<JsonWebKey[]> {
  if (appleKeysCache && appleKeysCache.expiresAt > Date.now()) {
    return appleKeysCache.keys;
  }

  const res = await fetch(APPLE_JWKS_URL);
  if (!res.ok) throw new Error(`Apple JWKS fetch failed: ${res.status}`);

  const body = (await res.json()) as { keys?: JsonWebKey[] };
  const keys = body.keys ?? [];
  appleKeysCache = {
    keys,
    expiresAt: Date.now() + 1000 * 60 * 60 * 6,
  };
  return keys;
}

async function verifyAppleIdentityToken(
  identityToken: string,
): Promise<AppleJwtPayload & { sub: string }> {
  const [encodedHeader, encodedPayload, encodedSignature] = identityToken.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error("Malformed Apple identity token");
  }

  const header = parseJwtPart<AppleJwtHeader>(encodedHeader);
  if (!header.kid || !header.alg) throw new Error("Apple token missing header");

  if (header.alg !== "RS256" && header.alg !== "ES256") {
    throw new Error(`Unsupported Apple token alg: ${header.alg}`);
  }

  const keys = await applePublicKeys();
  const jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error("Apple signing key not found");

  const publicKey = createPublicKey({ key: jwk, format: "jwk" });
  const signingInput = Buffer.from(`${encodedHeader}.${encodedPayload}`);
  const signature = base64UrlDecode(encodedSignature);

  const ok =
    header.alg === "ES256"
      ? verifySignature(
          "sha256",
          signingInput,
          { key: publicKey, dsaEncoding: "ieee-p1363" },
          signature,
        )
      : verifySignature("RSA-SHA256", signingInput, publicKey, signature);

  if (!ok) throw new Error("Apple token signature failed");

  const payload = parseJwtPart<AppleJwtPayload>(encodedPayload);
  if (payload.iss !== APPLE_ISSUER) throw new Error("Bad Apple token issuer");

  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(appleAudience())) throw new Error("Bad Apple token audience");

  if (!payload.exp || payload.exp * 1000 <= Date.now()) {
    throw new Error("Expired Apple token");
  }

  if (!payload.sub) throw new Error("Apple token missing subject");

  return payload as AppleJwtPayload & { sub: string };
}

function appleEmailIsVerified(value: unknown): boolean {
  return value === true || value === "true";
}

function appleDisplayName(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;

  const value = raw as { givenName?: unknown; familyName?: unknown };
  const parts = [value.givenName, value.familyName]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim());

  return parts.join(" ") || null;
}

// The public shape of a user — never leak passwordHash or googleId.
function toAuthUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatarUrl: u.avatarUrl,
    avatarColor: u.avatarColor,
    hasPassword: u.passwordHash != null,
    onboardingCompleted: u.onboardingCompleted,
    emailVerified: u.emailVerified,
    plan: u.plan,
    planRenewsAt: u.planRenewsAt,
  };
}

async function startSession(
  res: import("express").Response,
  userId: string,
): Promise<string> {
  const { token, expiresAt } = await createSession(userId);
  setSessionCookie(res, token, expiresAt);
  return token;
}

// Native clients can't use the httpOnly cookie, so they ask for the session token
// in the response body via this header. Web stays cookie-only (token never leaves
// the httpOnly cookie), preserving its XSS protection.
function wantsToken(req: import("express").Request): boolean {
  return req.get("X-Yadegar-Client") === "mobile";
}

// The auth response: the user, plus the bearer token for native clients only.
function authResponse(
  req: import("express").Request,
  user: User,
  token: string,
): ReturnType<typeof toAuthUser> & { token?: string } {
  return { ...toAuthUser(user), ...(wantsToken(req) ? { token } : {}) };
}

// ── Email + password ─────────────────────────────────────────────────────────

router.post("/auth/register", credentialLimiter, async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Email and a password (8+ characters) are required" });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  try {
    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email));
    // SECURITY: never attach a password (and a session) to an existing account
    // via an unauthenticated register call — including a Google-only account.
    // Doing so would let anyone who knows the email take it over. Linking a
    // password to a Google account must happen from an authenticated session
    // (a future "set a password" flow), not here.
    if (existing) {
      res.status(409).json({ error: "That email is already registered" });
      return;
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const [user] = await db
      .insert(usersTable)
      .values({ email, passwordHash, name: parsed.data.name ?? null })
      .returning();

    const token = await startSession(res, user.id);
    await sendVerification(user, req.log); // best-effort; soft verification
    // A warm welcome, separate from the confirm. Fire-and-forget so a mail
    // hiccup never fails the signup.
    sendEmail({ to: user.email, ...welcomeEmail({ name: user.name }) }).catch(
      (err) => req.log.error({ err }, "Welcome email failed"),
    );
    res.status(201).json(authResponse(req, user, token));
  } catch (err) {
    req.log.error({ err }, "Register route error");
    res.status(500).json({ error: "Failed to create account" });
  }
});

router.post("/auth/login", credentialLimiter, async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email));
    const ok = await verifyPassword(
      parsed.data.password,
      user?.passwordHash ?? null,
    );
    if (!user || !ok) {
      res.status(401).json({ error: "Incorrect email or password" });
      return;
    }
    const token = await startSession(res, user.id);
    res.json(authResponse(req, user, token));
  } catch (err) {
    req.log.error({ err }, "Login route error");
    res.status(500).json({ error: "Failed to sign in" });
  }
});


router.post(
  "/auth/apple/mobile",
  credentialLimiter,
  async (req, res): Promise<void> => {
    const body = (req.body ?? {}) as {
      identityToken?: unknown;
      fullName?: unknown;
      // The mobile client now sends Apple's single-use authorization code. To
      // satisfy App Store 5.1.1(v) (revoke Sign in with Apple tokens on account
      // deletion), exchange this for a refresh token here (client-secret JWT
      // signed with the Apple .p8 key), persist it on the user, then POST it to
      // appleid.apple.com/auth/revoke from DELETE /privacy/account. Captured now
      // so that work needs no new app build.
      authorizationCode?: unknown;
    };

    if (typeof body.identityToken !== "string" || !body.identityToken) {
      res.status(400).json({ error: "Apple identity token is required" });
      return;
    }

    try {
      const profile = await verifyAppleIdentityToken(body.identityToken);
      const verifiedEmail =
        appleEmailIsVerified(profile.email_verified) &&
        typeof profile.email === "string"
          ? profile.email.trim().toLowerCase()
          : null;
      const name = appleDisplayName(body.fullName);

      let [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.appleId, profile.sub));

      if (!user) {
        if (!verifiedEmail) {
          res.status(400).json({
            error: "Apple did not share a verified email for this account.",
          });
          return;
        }

        const [byEmail] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.email, verifiedEmail));

        if (byEmail) {
          [user] = await db
            .update(usersTable)
            .set({
              appleId: profile.sub,
              name: byEmail.name ?? name,
              emailVerified: true,
              updatedAt: new Date(),
            })
            .where(eq(usersTable.id, byEmail.id))
            .returning();
        } else {
          [user] = await db
            .insert(usersTable)
            .values({
              email: verifiedEmail,
              appleId: profile.sub,
              name,
              emailVerified: true,
            })
            .returning();

          sendEmail({
            to: user.email,
            ...welcomeEmail({ name: user.name }),
          }).catch((err) => req.log.error({ err }, "Welcome email failed"));
        }
      }

      // Exchange the single-use authorization code for a refresh token and
      // persist it, so account deletion can revoke the grant (5.1.1(v)). Wholly
      // best-effort: a failure here must never block sign-in. Runs each sign-in
      // so the stored token stays fresh and pre-feature accounts get backfilled.
      if (typeof body.authorizationCode === "string" && body.authorizationCode) {
        try {
          const refreshToken = await exchangeAppleAuthCode(body.authorizationCode);
          if (refreshToken) {
            await db
              .update(usersTable)
              .set({ appleRefreshToken: refreshToken, updatedAt: new Date() })
              .where(eq(usersTable.id, user.id));
          }
        } catch (err) {
          req.log.warn({ err }, "Apple refresh-token exchange failed");
        }
      }

      const token = await startSession(res, user.id);
      res.json(authResponse(req, user, token));
    } catch (err) {
      req.log.error({ err }, "Apple mobile auth error");
      res.status(401).json({ error: "Apple sign-in failed" });
    }
  },
);

router.post("/auth/logout", async (req, res): Promise<void> => {
  try {
    await deleteSession(req.cookies?.[SESSION_COOKIE]);
  } catch (err) {
    req.log.error({ err }, "Logout route error");
  }
  clearSessionCookie(res);
  res.status(204).end();
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  // Include this month's fresh-return usage so the client can show the allowance
  // and a gentle near-limit nudge. A single indexed row read — no model call.
  const usage = await getUsageSummary(req.user!);
  res.json({
    ...toAuthUser(req.user!),
    usage: {
      used: usage.used,
      limit: usage.limit,
      atLimit: usage.atLimit,
      // Whether the limit is actually enforced (vs shadow). The client only shows
      // "returns left" cues when this is true, so it never implies a wall that
      // isn't there yet.
      enforced: QUOTA_ENFORCED,
    },
  });
});

// Update the signed-in user's profile — display name, avatar colour, and/or an
// uploaded avatar (stored as a small data: URL in avatar_url). Each field is
// applied only when present in the body; empty values clear it.
router.patch("/auth/me", requireAuth, async (req, res): Promise<void> => {
  try {
    const raw = (req.body ?? {}) as {
      name?: unknown;
      avatarColor?: unknown;
      avatarUrl?: unknown;
    };
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if ("name" in raw) {
      if (typeof raw.name !== "string") {
        res.status(400).json({ error: "name must be a string" });
        return;
      }
      updates.name = raw.name.trim().slice(0, 80) || null;
    }
    if ("avatarColor" in raw) {
      if (raw.avatarColor !== null && typeof raw.avatarColor !== "string") {
        res.status(400).json({ error: "avatarColor must be a string or null" });
        return;
      }
      updates.avatarColor = raw.avatarColor
        ? String(raw.avatarColor).slice(0, 32)
        : null;
    }
    if ("avatarUrl" in raw) {
      if (raw.avatarUrl !== null && typeof raw.avatarUrl !== "string") {
        res.status(400).json({ error: "avatarUrl must be a string or null" });
        return;
      }
      const v = raw.avatarUrl ? String(raw.avatarUrl) : null;
      // Cap the stored avatar so a giant data: URL can't bloat the row.
      if (v && v.length > 400_000) {
        res.status(413).json({ error: "image too large" });
        return;
      }
      updates.avatarUrl = v;
    }

    const [user] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, req.userId!))
      .returning();
    res.json(toAuthUser(user));
  } catch (err) {
    req.log.error({ err }, "Update profile error");
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// Change password while signed in — verify the current one, then set the new.
router.post(
  "/auth/change-password",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      const { currentPassword, newPassword } = (req.body ?? {}) as {
        currentPassword?: unknown;
        newPassword?: unknown;
      };
      if (typeof newPassword !== "string" || newPassword.length < 8) {
        res
          .status(400)
          .json({ error: "Your new password must be at least 8 characters." });
        return;
      }
      if (!req.user!.passwordHash) {
        res.status(400).json({
          error:
            "Your account signs in with Google — there's no password to change.",
        });
        return;
      }
      const ok = await verifyPassword(
        typeof currentPassword === "string" ? currentPassword : "",
        req.user!.passwordHash,
      );
      if (!ok) {
        res.status(401).json({ error: "Your current password is incorrect." });
        return;
      }
      const passwordHash = await hashPassword(newPassword);
      await db
        .update(usersTable)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(usersTable.id, req.userId!));
      // Revoke every other session (e.g. a hijacker's) — keep this one alive.
      await deleteOtherUserSessions(req.userId!, sessionTokenFrom(req));
      res.status(204).end();
    } catch (err) {
      req.log.error({ err }, "Change password error");
      res.status(500).json({ error: "Failed to change password" });
    }
  },
);

router.post(
  "/auth/complete-onboarding",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      const [user] = await db
        .update(usersTable)
        .set({ onboardingCompleted: true, updatedAt: new Date() })
        .where(eq(usersTable.id, req.userId!))
        .returning();
      res.json(toAuthUser(user));
    } catch (err) {
      req.log.error({ err }, "Complete onboarding error");
      res.status(500).json({ error: "Failed to complete onboarding" });
    }
  },
);

// ── Email verification & password reset ──────────────────────────────────────

router.post("/auth/verify-email", async (req, res): Promise<void> => {
  const parsed = VerifyEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A token is required" });
    return;
  }
  try {
    const userId = await consumeAuthToken(parsed.data.token, "email_verify");
    if (!userId) {
      res.status(400).json({ error: "That link is invalid or has expired." });
      return;
    }
    await db
      .update(usersTable)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(usersTable.id, userId));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Verify email error");
    res.status(500).json({ error: "Failed to verify email" });
  }
});

router.post(
  "/auth/resend-verification",
  requireAuth,
  credentialLimiter,
  async (req, res): Promise<void> => {
    if (req.user!.emailVerified) {
      res.status(204).end();
      return;
    }
    await sendVerification(req.user!, req.log);
    res.status(204).end();
  },
);

router.post(
  "/auth/request-password-reset",
  credentialLimiter,
  async (req, res): Promise<void> => {
    const parsed = RequestPasswordResetBody.safeParse(req.body);
    // Always respond 204 — never reveal whether an email exists.
    if (!parsed.success) {
      res.status(204).end();
      return;
    }
    const email = parsed.data.email.trim().toLowerCase();
    try {
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email));
      if (user && user.passwordHash) {
        const token = await createAuthToken(
          user.id,
          "password_reset",
          RESET_TTL_MS,
        );
        const link = `${appUrl()}/reset-password?token=${token}`;
        const mail = passwordResetEmail(link);
        await sendEmail({ to: user.email, ...mail });
      }
    } catch (err) {
      req.log.error({ err }, "Request password reset error");
    }
    res.status(204).end();
  },
);

router.post(
  "/auth/reset-password",
  credentialLimiter,
  async (req, res): Promise<void> => {
    const parsed = ResetPasswordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "A token and an 8+ character password are required" });
      return;
    }
    try {
      const userId = await consumeAuthToken(
        parsed.data.token,
        "password_reset",
      );
      if (!userId) {
        res.status(400).json({ error: "That link is invalid or has expired." });
        return;
      }
      const passwordHash = await hashPassword(parsed.data.password);
      await db
        .update(usersTable)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(usersTable.id, userId));
      // Invalidate all existing sessions for safety.
      await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
      res.status(204).end();
    } catch (err) {
      req.log.error({ err }, "Reset password error");
      res.status(500).json({ error: "Failed to reset password" });
    }
  },
);

// ── Google OAuth ─────────────────────────────────────────────────────────────

router.get("/auth/google", (req, res): void => {
  const returnTo = mobileReturnTo(req.query.returnTo);

  if (!googleConfigured()) {
    if (returnTo) {
      res.redirect(appendOAuthResult(returnTo, { error: "google_unconfigured" }));
      return;
    }
    res.redirect(`${appUrl()}/login?error=google_unconfigured`);
    return;
  }

  const state = randomBytes(16).toString("hex");
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 10,
    path: "/",
  };

  res.cookie(OAUTH_STATE_COOKIE, state, cookieOptions);
  if (returnTo) res.cookie(OAUTH_RETURN_TO_COOKIE, returnTo, cookieOptions);

  res.redirect(buildGoogleAuthUrl(state));
});

router.get("/auth/google/callback", async (req, res): Promise<void> => {
  const { code, state } = req.query as { code?: string; state?: string };
  const expectedState = req.cookies?.[OAUTH_STATE_COOKIE] as string | undefined;
  const returnTo = mobileReturnTo(req.cookies?.[OAUTH_RETURN_TO_COOKIE]);

  res.clearCookie(OAUTH_STATE_COOKIE, { path: "/" });
  res.clearCookie(OAUTH_RETURN_TO_COOKIE, { path: "/" });

  if (!code || !state || !expectedState || state !== expectedState) {
    if (returnTo) {
      res.redirect(appendOAuthResult(returnTo, { error: "google_failed" }));
      return;
    }
    res.redirect(`${appUrl()}/login?error=google_failed`);
    return;
  }

  try {
    const profile = await exchangeGoogleCode(code);
    const email = profile.email.trim().toLowerCase();

    // Find by google id, then by email (link accounts), else create.
    let [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.googleId, profile.googleId));

    if (!user) {
      const [byEmail] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email));
      if (byEmail) {
        [user] = await db
          .update(usersTable)
          .set({
            googleId: profile.googleId,
            name: byEmail.name ?? profile.name,
            avatarUrl: byEmail.avatarUrl ?? profile.avatarUrl,
          })
          .where(eq(usersTable.id, byEmail.id))
          .returning();
      } else {
        [user] = await db
          .insert(usersTable)
          .values({
            email,
            googleId: profile.googleId,
            name: profile.name,
            avatarUrl: profile.avatarUrl,
          })
          .returning();
        // First Google sign-in for this person — welcome them (best-effort).
        sendEmail({
          to: user.email,
          ...welcomeEmail({ name: user.name }),
        }).catch((err) => req.log.error({ err }, "Welcome email failed"));
      }
    }

    const token = await startSession(res, user.id);
    if (returnTo) {
      res.redirect(appendOAuthResult(returnTo, { token }));
      return;
    }
    res.redirect(appUrl());
  } catch (err) {
    req.log.error({ err }, "Google callback error");
    if (returnTo) {
      res.redirect(appendOAuthResult(returnTo, { error: "google_failed" }));
      return;
    }
    res.redirect(`${appUrl()}/login?error=google_failed`);
  }
});

export default router;

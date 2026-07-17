import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import type { Request, Response, NextFunction } from "express";
import { and, eq, gt, isNull, ne } from "drizzle-orm";
import {
  db,
  usersTable,
  sessionsTable,
  authTokensTable,
  type User,
  type AuthTokenKind,
} from "@workspace/db";

const scrypt = promisify(scryptCb);

// ── Passwords ────────────────────────────────────────────────────────────────
// scrypt with a per-user random salt. Stored as "salt:hash" (hex). No external
// dependency, and comparison is constant-time.

const SCRYPT_KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, SCRYPT_KEYLEN)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string | null,
): Promise<boolean> {
  if (!stored) return false;
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const derived = (await scrypt(password, salt, SCRYPT_KEYLEN)) as Buffer;
  return (
    expected.length === derived.length && timingSafeEqual(expected, derived)
  );
}

// ── Sessions ─────────────────────────────────────────────────────────────────
// The cookie holds an opaque random token; the database stores only its SHA-256
// hash, so a DB leak never yields a usable credential.

export const SESSION_COOKIE = "still_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db
    .insert(sessionsTable)
    .values({ id: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function getUserForToken(
  token: string | undefined,
): Promise<User | null> {
  if (!token) return null;
  const [row] = await db
    .select({ user: usersTable })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(
      and(
        eq(sessionsTable.id, hashToken(token)),
        gt(sessionsTable.expiresAt, new Date()),
      ),
    );
  return row?.user ?? null;
}

export async function deleteSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await db.delete(sessionsTable).where(eq(sessionsTable.id, hashToken(token)));
}

// Revoke all of a user's sessions except the caller's current one (keepToken).
// Used after a password change so a stale or hijacked session can't survive,
// while the user stays signed in on the device that made the change.
export async function deleteOtherUserSessions(
  userId: string,
  keepToken: string | undefined,
): Promise<void> {
  const keepId = keepToken ? hashToken(keepToken) : null;
  await db
    .delete(sessionsTable)
    .where(
      keepId
        ? and(eq(sessionsTable.userId, userId), ne(sessionsTable.id, keepId))
        : eq(sessionsTable.userId, userId),
    );
}

// ── Single-use email tokens (verification + password reset) ──────────────────
// The raw token goes in the emailed link; only its hash is stored.

export async function createAuthToken(
  userId: string,
  kind: AuthTokenKind,
  ttlMs: number,
): Promise<string> {
  const raw = randomBytes(32).toString("hex");
  await db.insert(authTokensTable).values({
    userId,
    kind,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return raw;
}

// Validate and burn a token. Returns the userId on success, else null.
export async function consumeAuthToken(
  raw: string | undefined,
  kind: AuthTokenKind,
): Promise<string | null> {
  if (!raw) return null;
  // Atomic claim: a single conditional UPDATE that only matches while usedAt is
  // still NULL (and the token matches + isn't expired). The DB serializes the
  // write, so two concurrent requests with the same token can't both get a
  // returned row — only one wins. (Was a SELECT-then-UPDATE race window.)
  const claimed = await db
    .update(authTokensTable)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(authTokensTable.tokenHash, hashToken(raw)),
        eq(authTokensTable.kind, kind),
        isNull(authTokensTable.usedAt),
        gt(authTokensTable.expiresAt, new Date()),
      ),
    )
    .returning({ userId: authTokensTable.userId });
  return claimed[0]?.userId ?? null;
}

export function setSessionCookie(
  res: Response,
  token: string,
  expiresAt: Date,
): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

// ── Middleware ───────────────────────────────────────────────────────────────
// requireAuth attaches the authenticated user to the request, or 401s. Routes
// read `req.userId` to scope every query to the owner.

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
      userId?: string;
    }
  }
}

// The session token, from the web's httpOnly cookie OR a native client's
// `Authorization: Bearer <token>` header (same token, just delivered differently).
export function sessionTokenFrom(req: Request): string | undefined {
  const cookieToken = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (cookieToken) return cookieToken;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7).trim() || undefined;
  return undefined;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = sessionTokenFrom(req);
  const user = await getUserForToken(token);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  req.user = user;
  req.userId = user.id;
  next();
}

// ── Google OAuth (authorization-code flow, no SDK) ───────────────────────────
// We implement the minimal code flow with fetch: redirect the browser to
// Google, exchange the returned code for tokens, then read the userinfo
// endpoint. Requires GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET, and a redirect
// URI registered in the Google Cloud console.

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export function googleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
}

function googleRedirectUri(): string {
  // Allow an explicit override; otherwise derive from APP_URL.
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const base = (process.env.APP_URL ?? "http://localhost:5173").replace(
    /\/+$/,
    "",
  );
  return `${base}/api/auth/google/callback`;
}

export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export async function exchangeGoogleCode(
  code: string,
): Promise<GoogleProfile> {
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Google token exchange failed: ${tokenRes.status}`);
  }
  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) throw new Error("No access_token from Google");

  const infoRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  if (!infoRes.ok) {
    throw new Error(`Google userinfo failed: ${infoRes.status}`);
  }
  const info = (await infoRes.json()) as {
    sub: string;
    email: string;
    email_verified?: boolean | string;
    name?: string;
    picture?: string;
  };
  // Enforce Google's verified-email claim. Without this, a Google identity
  // asserting an address it does not own (email_verified=false) could link to or
  // take over an existing account that shares that email. The OIDC userinfo
  // endpoint returns a JSON boolean; tolerate the string form defensively.
  if (info.email_verified !== true && info.email_verified !== "true") {
    throw new Error("Google account email is not verified");
  }
  return {
    googleId: info.sub,
    email: info.email,
    name: info.name ?? null,
    avatarUrl: info.picture ?? null,
  };
}

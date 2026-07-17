import { createPrivateKey, sign as cryptoSign } from "node:crypto";

// Sign in with Apple — server-to-server token exchange and revocation.
//
// Apple requires that an app offering Sign in with Apple AND account deletion
// revoke the user's token when they delete their account (App Store 5.1.1(v)).
// To revoke, we need a refresh token, which we get by exchanging the single-use
// authorization code the app captures at sign-in. Both calls authenticate with
// a short-lived "client secret" — an ES256 JWT signed with the Apple .p8 key.
//
// Env (all four required; absent → these become no-ops so sign-in still works):
//   APPLE_TEAM_ID      Apple Developer Team ID (10 chars)
//   APPLE_KEY_ID       Key ID of the .p8 sign-in key
//   APPLE_PRIVATE_KEY  Contents of the .p8 (PEM; literal "\n" newlines tolerated)
//   APPLE_CLIENT_ID    The client_id (iOS bundle id, e.g. com.yadegar.app)

const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
const APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke";
const APPLE_AUD = "https://appleid.apple.com";

export function appleRevocationConfigured(): boolean {
  return Boolean(
    process.env.APPLE_TEAM_ID &&
      process.env.APPLE_KEY_ID &&
      process.env.APPLE_PRIVATE_KEY &&
      (process.env.APPLE_CLIENT_ID || process.env.IOS_BUNDLE_ID),
  );
}

function clientId(): string {
  return process.env.APPLE_CLIENT_ID ?? process.env.IOS_BUNDLE_ID ?? "com.yadegar.app";
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Build the ES256 client-secret JWT Apple's token endpoints require. Valid for
// 5 minutes — minted fresh per call, never stored.
function clientSecret(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: process.env.APPLE_KEY_ID };
  const payload = {
    iss: process.env.APPLE_TEAM_ID,
    iat: now,
    exp: now + 300,
    aud: APPLE_AUD,
    sub: clientId(),
  };

  const signingInput =
    base64UrlEncode(JSON.stringify(header)) +
    "." +
    base64UrlEncode(JSON.stringify(payload));

  // .p8 contents stored in an env var commonly arrive with escaped newlines.
  const pem = (process.env.APPLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  const key = createPrivateKey(pem);
  // "ieee-p1363" yields the raw r||s signature JWS ES256 expects (not DER).
  const signature = cryptoSign("sha256", Buffer.from(signingInput), {
    key,
    dsaEncoding: "ieee-p1363",
  });

  return signingInput + "." + base64UrlEncode(signature);
}

// Exchange the app's single-use authorization code for a refresh token. Returns
// null on any failure (or when unconfigured) — callers treat it as best-effort
// and never let it block sign-in.
export async function exchangeAppleAuthCode(
  code: string,
): Promise<string | null> {
  if (!appleRevocationConfigured()) return null;

  const res = await fetch(APPLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: "authorization_code",
      code,
    }).toString(),
  });

  if (!res.ok) {
    throw new Error(`Apple token exchange failed: ${res.status}`);
  }

  const body = (await res.json()) as { refresh_token?: unknown };
  return typeof body.refresh_token === "string" ? body.refresh_token : null;
}

// Revoke a refresh token so the Sign in with Apple grant is fully severed on
// account deletion. Best-effort: throws on HTTP failure for the caller to log.
export async function revokeAppleRefreshToken(
  refreshToken: string,
): Promise<void> {
  if (!appleRevocationConfigured()) return;

  const res = await fetch(APPLE_REVOKE_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      token: refreshToken,
      token_type_hint: "refresh_token",
    }).toString(),
  });

  if (!res.ok) {
    throw new Error(`Apple token revoke failed: ${res.status}`);
  }
}

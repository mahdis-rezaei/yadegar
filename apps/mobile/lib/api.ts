import * as SecureStore from "expo-secure-store";
import { setAuthTokenGetter, setBaseUrl } from "../../../lib/api-client-react/src/custom-fetch";

// Thin API layer for the native app. Talks to the same backend as the web; auth is
// a bearer token (kept in the device keychain) instead of the web's httpOnly
// cookie. The backend returns the token on login/register because we send the
// `X-Yadegar-Client: mobile` header. (Phase 0.x will swap this for the shared
// @workspace/api-client-react once Metro monorepo resolution is set up.)

const TOKEN_KEY = "yadegar.session";
export const API_ORIGIN = process.env.EXPO_PUBLIC_API_URL ?? "https://yadegarjournal.com";
const API_URL = `${API_ORIGIN}/api`;

setBaseUrl(API_URL);
setAuthTokenGetter(getToken);

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`HTTP ${status}`);
    this.name = "ApiError";
  }
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string | null): Promise<void> {
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      "content-type": "application/json",
      "X-Yadegar-Client": "mobile",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    throw new ApiError(res.status, await res.text().catch(() => ""));
  }
  // 204 / empty bodies
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

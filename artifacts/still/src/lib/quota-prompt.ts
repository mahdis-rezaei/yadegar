// Centralized handling for the free-tier quota signal (Phase 1). The server's
// quota gate answers an over-limit fresh return with HTTP 402 + body
// { error: "quota_exceeded", code, message, usage }. Rather than each run surface
// rendering its own thing, any caller routes a thrown request error through
// handleQuotaError(), which, if it's the quota 402, raises ONE shared upgrade
// prompt (QuotaPromptProvider). This is wired now but DORMANT in shadow mode: the
// server returns 402 only once STILL_QUOTA_ENFORCED=1, so today it never fires.

export interface QuotaUsage {
  plan?: string;
  used?: number;
  limit?: number | null;
  periodStart?: string;
}

export interface QuotaPromptPayload {
  message: string;
  usage?: QuotaUsage;
}

// A single global handler, registered by the provider mounted once at the app
// root. Module-level so non-React callers (run-job.ts) can raise the prompt.
let handler: ((p: QuotaPromptPayload) => void) | null = null;

export function registerQuotaPromptHandler(
  h: (p: QuotaPromptPayload) => void,
): () => void {
  handler = h;
  return () => {
    if (handler === h) handler = null;
  };
}

export function triggerQuotaPrompt(payload: QuotaPromptPayload): void {
  handler?.(payload);
}

// If `err` is the quota 402, raise the prompt and return true so the caller can
// stop its normal error UI. Duck-typed on status + body code: the API client's
// thrown error carries `.status` and the parsed `.data`, but the ApiError class
// isn't exported, so we don't `instanceof` it.
export function handleQuotaError(err: unknown): boolean {
  const e = err as { status?: number; data?: unknown } | null;
  if (!e || e.status !== 402) return false;
  const data = (e.data ?? {}) as {
    code?: string;
    message?: string;
    usage?: QuotaUsage;
  };
  if (data.code !== "quota_exceeded") return false;
  triggerQuotaPrompt({
    message:
      data.message ??
      "You've used this month's returns. Revisiting what's already returned to you is always free.",
    usage: data.usage,
  });
  return true;
}

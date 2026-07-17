import { customFetch, type MemoryRunResult } from "@workspace/api-client-react";
import { handleQuotaError } from "./quota-prompt";

// Shared client for the async memory engine (ADR 0002). A run-style endpoint may
// answer synchronously (a result) or asynchronously (a { jobId } to poll); these
// helpers resolve to the run result either way, so callers don't care which.

// Poll a job to completion. Bounded (~4 min) so it never spins forever.
export async function pollRunJob(jobId: string): Promise<MemoryRunResult> {
  for (let i = 0; i < 80; i++) {
    const r = await customFetch<{ status: string; result?: MemoryRunResult }>(
      `/api/memories/jobs/${jobId}`,
      { responseType: "json" },
    );
    if (r.status === "done" && r.result) return r.result;
    if (r.status === "error") return { surfaced: false, reason: "error" };
    await new Promise((res) => setTimeout(res, 3000));
  }
  return { surfaced: false, reason: "error" };
}

// POST a run-style endpoint and resolve to the run result (polling if async).
export async function runMemoryRequest(
  url: string,
  body: Record<string, unknown>,
): Promise<MemoryRunResult> {
  try {
    const resp = await customFetch<MemoryRunResult & { jobId?: string }>(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      responseType: "json",
    });
    if (resp && typeof resp.jobId === "string") return pollRunJob(resp.jobId);
    return resp as MemoryRunResult;
  } catch (err) {
    // Over the free quota (only when enforcement is on): raise the shared upgrade
    // prompt and resolve to a benign "quota" result so the surface stays calm
    // instead of showing a generic error. Any other error propagates as before.
    if (handleQuotaError(err)) return { surfaced: false, reason: "quota" };
    throw err;
  }
}

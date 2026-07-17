import { api, ApiError } from "./api";

// The engine on mobile.
// - "Bring a page back" — a scoped two-pass read of your years that returns ONE
//   page worth returning to, or stays honestly silent.
// - "On this day" — date-based resurfacing: past pages from this calendar day in
//   prior years (no model call; free).
// Same backend endpoints as web (no second engine). Look Back + the Returns
// archive arrive in later slices.

// A surfaced page the engine chose to return (toMemory in routes/memories.ts).
export interface Memory {
  id: string;
  label?: string | null;
  observation?: string | null;
  quote?: string | null;
  quoteDate?: string | null;
  lens?: string | null;
  journalEntryId?: string | null;
  dismissed: boolean;
  favorite: boolean;
  createdAt: string;
  openedAt?: string | null;
}

export interface MemoryRunResult {
  surfaced: boolean;
  reason?: string | null;
  supportMessage?: string | null;
  memory?: Memory;
}

// What each lens means, in the reader's language (never shown as a "lens").
// Mirrors the web's LENS_LABELS so the heading reads identically across surfaces.
export const LENS_LABELS: Record<string, string> = {
  memory: "A page from then",
  thread: "What kept returning",
  distance: "How far you've come",
  wisdom: "Something you seemed to know",
  value_signal: "What mattered then",
  becoming: "Who you were becoming",
  survival: "What you carried through",
};

// One date-based memory (GET /memories/on-this-day). onThisExactDay marks the
// exact calendar day in a prior year (vs merely near it).
export interface DateMemory {
  entryId: string;
  title: string | null;
  excerpt: string;
  entryDate: string;
  favorite: boolean;
  yearsAgo: number;
  onThisExactDay?: boolean;
}

// Local calendar day as YYYY-MM-DD; the window must match the reader's calendar,
// so we pass the device's local day (mirrors the web's localTodayISO).
export function localTodayISO(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

// "A year ago today" / "7 years ago, around this day" — honest about whether
// it's the exact calendar day or merely near it.
export function onThisDayLabel(m: {
  yearsAgo: number;
  onThisExactDay?: boolean;
}): string {
  const span = m.yearsAgo === 1 ? "A year ago" : `${m.yearsAgo} years ago`;
  return m.onThisExactDay ? `${span} today` : `${span}, around this day`;
}

// GET /memories/on-this-day?date= — date-based resurfacing (free, no model call).
export const getOnThisDay = (date = localTodayISO()) =>
  api<DateMemory[]>(`/memories/on-this-day?date=${date}`);

// GET /memories/on-this-day/framed?date= — the same exact-day pages, but with the
// most recent one voiced by the engine (a lens heading + observation), as the web
// shows on Today. `framed` can be null (framing is a bonus); fall back to `years`.
export interface FramedOnThisDay {
  exact: boolean;
  years: DateMemory[];
  framed: Memory | null;
}

export const getOnThisDayFramed = (date = localTodayISO()) =>
  api<FramedOnThisDay>(`/memories/on-this-day/framed?date=${date}`);

// The Look Back browse payload — every date-based way a page returns, gathered
// (GET /memories/look-back). De-duped server-side across buckets.
export interface LookBack {
  onThisDay: DateMemory[];
  aroundThisTime: DateMemory[];
  favorites: DateMemory[];
  forgotten: DateMemory[];
}

export const getLookBack = (date = localTodayISO()) =>
  api<LookBack>(`/memories/look-back?date=${date}`);

// Poll an async memory job (ADR 0002) to completion, then resolve to the same
// shape a synchronous run returns. Bounded (~4 min) so it never spins forever.
async function pollRunJob(jobId: string): Promise<MemoryRunResult> {
  for (let i = 0; i < 80; i++) {
    const r = await api<{ status: string; result?: MemoryRunResult }>(
      `/memories/jobs/${jobId}`,
    );
    if (r.status === "done" && r.result) return r.result;
    if (r.status === "error") return { surfaced: false, reason: "error" };
    await new Promise((res) => setTimeout(res, 3000));
  }
  return { surfaced: false, reason: "error" };
}

// Shared engine POST. The run may come back synchronously (a result) or as an
// async job to poll (ADR 0002). A 402 means the free quota is spent (only when
// enforcement is on) — surface it as a calm "quota" reason rather than an error.
async function postRun(path: string, body: object): Promise<MemoryRunResult> {
  try {
    const resp = await api<MemoryRunResult & { jobId?: string }>(path, {
      method: "POST",
      body,
    });
    if (resp && typeof resp.jobId === "string") return pollRunJob(resp.jobId);
    return resp as MemoryRunResult;
  } catch (err) {
    if (err instanceof ApiError && err.status === 402) {
      return { surfaced: false, reason: "quota" };
    }
    throw err;
  }
}

// POST /memories/run — "what keeps returning": the cross-time engine read. `fresh`
// bypasses the cache for a re-roll; `entryIds` scopes it to one page (the
// "forgotten page" pull). No args = the whole-archive read.
export const bringPageBack = (
  body: { fresh?: boolean; entryIds?: string[] } = {},
) => postRun("/memories/run", body);

// POST /memories/revisit { year, month } — the one line worth returning to from a
// chosen month.
export const revisitTime = (year: number, month: number) =>
  postRun("/memories/revisit", { year, month });

// POST /memories/then-and-now { year } — "how far you've come": a past year held
// up against where you are now.
export const thenAndNow = (year: number) =>
  postRun("/memories/then-and-now", { year });

// Distinct years the user has written in (newest first), derived from /entries —
// the same source the web's Look back selectors use.
export async function listEntryYears(): Promise<number[]> {
  const rows = await api<{ entryDate: string | null }[]>("/entries");
  const set = new Set<number>();
  for (const r of rows) {
    const y = r.entryDate ? Number(r.entryDate.slice(0, 4)) : NaN;
    if (Number.isInteger(y)) set.add(y);
  }
  return [...set].sort((a, b) => b - a);
}

// --- Returns archive ---

// GET /memories — every page the engine has brought back, newest first.
export const listMemories = () => api<Memory[]>("/memories");

// PATCH /memories/:id — star (favorite) or retire (dismissed) a returned page.
export const updateMemory = (
  id: string,
  patch: Partial<{ favorite: boolean; dismissed: boolean; opened: boolean }>,
) => api<Memory>(`/memories/${id}`, { method: "PATCH", body: patch });

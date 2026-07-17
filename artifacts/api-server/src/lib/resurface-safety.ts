import { and, eq, isNull, lt, ne, or, sql } from "drizzle-orm";
import {
  db,
  journalEntriesTable,
  type ResurfaceSafety,
} from "@workspace/db";

const ENGINE_BASE = `http://127.0.0.1:${process.env.PORT}/api`;

// Manual entries are written incrementally (the Today editor autosaves a single
// row many times). Wait until a manual entry has been still for this long before
// classifying, so we tag settled text, not mid-keystroke drafts. Imported /
// sample / otherwise non-manual entries are already complete → no wait.
const SETTLE_MS = 10 * 60 * 1000;

// How many entries one cron tick will classify when no ?limit is given. Each
// entry costs a classify call (crisis + hard-floor + theme), so this is tuned to
// finish within a typical 30 s scheduler timeout (e.g. cron-job.org's free tier);
// 50 overran it during re-tag backlogs. The backlog drains over successive ticks.
// For a large one-off backfill, call from a terminal (no client timeout) with a
// higher ?limit (capped at 500) and ?all=1 to bypass the anniversary window below.
const DEFAULT_BATCH = 10;

// Lazy import classification (Phase 0 COGS). Date resurfacing only ever shows an
// entry around its month-day anniversary from a PRIOR year (±3 days; see
// on-this-day.ts), and an entry whose verdict is still NULL is withheld (fail
// closed). So instead of eagerly classifying a whole imported archive up front, we
// classify only entries whose anniversary is APPROACHING — a few days back (to
// cover the currently-active resurfacing window) through a lookahead buffer (so the
// cron drains the day's cohort before it's needed). The rest stay NULL — safely
// un-surfaceable — until their window comes round, turning the import cost spike
// into a pay-as-used trickle spread across the year. Theme is invisible (engine
// soft-affinity only), so deferring it has no user-visible effect. A one-off full
// backfill is still available via the endpoint's ?all=1 escape hatch.
const CLASSIFY_LOOKAHEAD_DAYS = 30;
const CLASSIFY_LOOKBACK_DAYS = 5;

// The MM-DD anniversaries "due" for classification today: from CLASSIFY_LOOKBACK
// days before through CLASSIFY_LOOKAHEAD days after, walked as real UTC dates so
// month/leap-year boundaries are correct. Year-agnostic — an entry from any prior
// year matches on its month-day.
function dueAnniversaries(today = new Date()): string[] {
  const set = new Set<string>();
  const base = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  for (let d = -CLASSIFY_LOOKBACK_DAYS; d <= CLASSIFY_LOOKAHEAD_DAYS; d += 1) {
    const dt = new Date(base + d * 86_400_000);
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    set.add(`${mm}-${dd}`);
  }
  return [...set];
}

interface ClassifyResponse {
  crisis?: boolean;
  hardFloor?: boolean;
  theme?: string;
  version?: string;
}

// Ask the engine to classify ONE entry (POST /still/classify) → its safety
// verdict + topical theme. Throws on transport/HTTP failure so the caller leaves
// the row NULL (unclassified → not eligible) and a later tick retries — we never
// persist a guessed verdict.
export async function classifyEntry(
  text: string,
): Promise<{ safety: ResurfaceSafety; theme: string }> {
  const res = await fetch(`${ENGINE_BASE}/still/classify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`classify HTTP ${res.status}`);
  const data = (await res.json()) as ClassifyResponse;

  const crisis = data.crisis === true;
  const hardFloor = data.hardFloor === true;
  return {
    safety: {
      safe: !crisis && !hardFloor,
      reason: crisis ? "crisis" : hardFloor ? "hard_floor" : null,
      version: data.version ?? "unknown",
      classifiedAt: new Date().toISOString(),
    },
    theme: data.theme ?? "other",
  };
}

export interface TagSummary {
  considered: number;
  tagged: number;
  errors: number;
}

// Classify a batch of entries that still need a verdict (resurface_safety IS
// NULL), respecting the settle window for manual entries. Idempotent and safe to
// run on a schedule: each tick drains up to `limit` rows. Used by the
// /cron/tag-resurface-safety endpoint. Re-tagging after a PROMPT_VERSION bump is
// done by NULL-ing stale verdicts at deploy time (see the Replit sync doc), which
// makes those rows pending again here.
export async function tagPendingEntries(
  log: { error: (obj: unknown, msg: string) => void },
  limit = DEFAULT_BATCH,
  opts: { dueOnly?: boolean } = {},
): Promise<TagSummary> {
  const dueOnly = opts.dueOnly ?? true;
  const cutoff = new Date(Date.now() - SETTLE_MS);

  // Lazy default: only classify entries whose anniversary is approaching. A NULL
  // entry_date can never resurface by date, and `to_char(NULL, …)` is NULL (never
  // IN the list), so dateless entries are naturally skipped here. ?all=1 (dueOnly
  // false) bypasses this for a one-off full backfill.
  const dueWindow = dueOnly
    ? sql`to_char(${journalEntriesTable.entryDate}, 'MM-DD') in (${sql.join(
        dueAnniversaries().map((d) => sql`${d}`),
        sql`, `,
      )})`
    : undefined;

  const pending = await db
    .select({
      id: journalEntriesTable.id,
      body: journalEntriesTable.body,
    })
    .from(journalEntriesTable)
    .where(
      and(
        // Pending = missing either tag (safety or theme).
        or(
          isNull(journalEntriesTable.resurfaceSafety),
          isNull(journalEntriesTable.theme),
        ),
        isNull(journalEntriesTable.deletedAt),
        or(
          ne(journalEntriesTable.source, "manual"),
          lt(journalEntriesTable.updatedAt, cutoff),
        ),
        dueWindow,
      ),
    )
    .orderBy(journalEntriesTable.createdAt)
    .limit(limit);

  const summary: TagSummary = {
    considered: pending.length,
    tagged: 0,
    errors: 0,
  };

  for (const entry of pending) {
    try {
      const { safety, theme } = await classifyEntry(entry.body);
      // Only write to a row that still needs tagging — a concurrent edit may have
      // reset it; never clobber a fresher state.
      await db
        .update(journalEntriesTable)
        .set({ resurfaceSafety: safety, theme })
        .where(
          and(
            eq(journalEntriesTable.id, entry.id),
            or(
              isNull(journalEntriesTable.resurfaceSafety),
              isNull(journalEntriesTable.theme),
            ),
          ),
        );
      summary.tagged++;
    } catch (err) {
      log.error({ err, entryId: entry.id }, "Entry tagging failed");
      summary.errors++;
    }
  }

  return summary;
}

// Best-effort guard used by the date-based surfacer when it must decide
// eligibility in code rather than SQL.
export function isResurfaceable(safety: ResurfaceSafety | null): boolean {
  return safety?.safe === true;
}

// SQL predicate for "this entry is eligible to be resurfaced by date": classified
// AND marked safe. NULL (unclassified) and unsafe rows are excluded. Callers add
// their own user/deleted/preference/date filters.
export const resurfaceableSql = sql`(${journalEntriesTable.resurfaceSafety} ->> 'safe') = 'true'`;

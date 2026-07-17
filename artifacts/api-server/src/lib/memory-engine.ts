import { randomUUID } from "node:crypto";
import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  ne,
  sql,
} from "drizzle-orm";
import {
  db,
  journalEntriesTable,
  returnedMemoriesTable,
  type ReturnedMemory,
} from "@workspace/db";
import { notMutedSql } from "./resurface-mutes";
import { diversifiedPoolIds, capPoolByTimeSpread } from "./diversity";
import { buildAffinityProfile } from "./affinity";
import { recordRun } from "./usage";
import { notifyIfAtLimit } from "./quota";

const ENGINE_BASE = `http://127.0.0.1:${process.env.PORT}/api`;

// Most entries to feed one extraction call. Bounds PASS1 output AND latency: a
// time-spread sample of RICH entries (spanning years) yields many verbose
// candidates, so 50 still overflowed the output budget and ran ~85s. 25 keeps the
// candidate list and runtime well within bounds while still spanning the archive.
const MAX_EXTRACTION_ENTRIES = 25;

export const CRISIS_FALLBACK =
  "It sounds like you're carrying something heavy right now. You don't have to hold it alone — if you're in danger or thinking about harming yourself, please reach out to someone you trust or a crisis line in your country. You matter.";

// Call the two-pass engine as an internal service (extract → score). Crisis is
// caught at extraction and never reaches scoring. `context` (today + the
// writer's recent themes) is forwarded to scoring for the optional why-today
// tiebreak; the engine only acts on it when its WHY_TODAY_TIEBREAK flag is on,
// so this is inert (and cache-identical) until that flag is enabled.
async function callEngine(
  entries: string,
  fresh: boolean,
  context?: {
    today: string;
    recentThemes: string[];
    affinityProfile?: { favored: string[]; dismissed: string[] };
  },
  // entryDate → source-entry theme tag, used to annotate candidates so soft
  // affinity can match the TRUE source theme (not the model gloss). The entries
  // are fed with `[entryDate]` headers, so extract's evidence dates equal these
  // keys exactly.
  dateThemes?: Record<string, string[]>,
): Promise<
  | {
      crisis: { supportMessage?: string };
      modelCalled: boolean;
      usage: {
        inputTokens: number;
        outputTokens: number;
        cacheReadTokens: number;
        cacheCreationTokens: number;
      };
    }
  | {
      score: Record<string, unknown>;
      modelCalled: boolean;
      usage: {
        inputTokens: number;
        outputTokens: number;
        cacheReadTokens: number;
        cacheCreationTokens: number;
      };
    }
> {
  const q = fresh ? "?fresh=1" : "";
  const exRes = await fetch(`${ENGINE_BASE}/still/extract${q}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ entries }),
  });
  if (!exRes.ok) throw new Error(`extract HTTP ${exRes.status}`);
  const extract = (await exRes.json()) as {
    candidates?: {
      evidence?: { date?: string }[];
      [k: string]: unknown;
    }[];
    crisis?: { supportMessage?: string } | null;
    fromCache?: boolean;
    usage?: {
      inputTokens?: number;
      outputTokens?: number;
      cacheReadTokens?: number;
      cacheCreationTokens?: number;
    };
  };
  const exInput = extract.usage?.inputTokens ?? 0;
  const exOutput = extract.usage?.outputTokens ?? 0;
  const exCacheRead = extract.usage?.cacheReadTokens ?? 0;
  const exCacheCreate = extract.usage?.cacheCreationTokens ?? 0;
  const exCalled = extract.fromCache === false;
  if (extract.crisis) {
    return {
      crisis: extract.crisis,
      modelCalled: exCalled,
      usage: {
        inputTokens: exInput,
        outputTokens: exOutput,
        cacheReadTokens: exCacheRead,
        cacheCreationTokens: exCacheCreate,
      },
    };
  }

  const candidates = (extract.candidates ?? []).map((c) => {
    if (!dateThemes) return c;
    const themes = [
      ...new Set(
        (c.evidence ?? []).flatMap((e) =>
          e.date ? (dateThemes[e.date] ?? []) : [],
        ),
      ),
    ];
    return themes.length > 0 ? { ...c, themes } : c;
  });

  const scRes = await fetch(`${ENGINE_BASE}/still/score${q}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ candidates, context }),
  });
  if (!scRes.ok) throw new Error(`score HTTP ${scRes.status}`);
  const score = (await scRes.json()) as Record<string, unknown> & {
    fromCache?: boolean;
    usage?: {
      inputTokens?: number;
      outputTokens?: number;
      cacheReadTokens?: number;
      cacheCreationTokens?: number;
    };
  };
  const scInput = score.usage?.inputTokens ?? 0;
  const scOutput = score.usage?.outputTokens ?? 0;
  const scCacheRead = score.usage?.cacheReadTokens ?? 0;
  const scCacheCreate = score.usage?.cacheCreationTokens ?? 0;
  return {
    score,
    modelCalled: exCalled || score.fromCache === false,
    usage: {
      inputTokens: exInput + scInput,
      outputTokens: exOutput + scOutput,
      cacheReadTokens: exCacheRead + scCacheRead,
      cacheCreationTokens: exCacheCreate + scCacheCreate,
    },
  };
}

export interface MemoryRunOutcome {
  surfaced: boolean;
  reason?: "nothing" | "crisis" | "not_enough";
  supportMessage?: string;
  /** The persisted memory row (present only when surfaced). */
  memory?: ReturnedMemory;
}

// Gather a user's eligible entries, run the engine, and persist + return one
// memory — or report honest silence / crisis / not-enough. Shared by the
// on-demand /memories/run route and the cron-driven memory nudge.
export async function runMemoryForUser(
  userId: string,
  opts: {
    year?: number;
    month?: number;
    entryIds?: string[];
    fresh?: boolean;
    // Preview: compute + return the framed memory WITHOUT persisting a Returns
    // row or touching rotation history. Used by the date-anchored "On this day"
    // surface, which may render on every Today-page load.
    preview?: boolean;
  },
  // Metering hint: "auto" (cron nudges, On-This-Day previews) records cost but
  // never consumes the user's return quota. Defaults to a user-initiated run.
  meta?: { kind?: "user" | "auto" },
): Promise<MemoryRunOutcome> {
  const filters = [
    eq(journalEntriesTable.userId, userId),
    isNull(journalEntriesTable.deletedAt),
    ne(journalEntriesTable.resurfacingPreference, "never"),
    isNotNull(journalEntriesTable.entryDate),
    // Muted date ranges never resurface — by the engine or any date surfacer.
    notMutedSql(userId),
  ];
  if (opts.year) {
    filters.push(
      sql`extract(year from ${journalEntriesTable.entryDate}) = ${opts.year}`,
    );
  }
  if (opts.month) {
    filters.push(
      sql`extract(month from ${journalEntriesTable.entryDate}) = ${opts.month}`,
    );
  }
  if (opts.entryIds && opts.entryIds.length > 0) {
    filters.push(inArray(journalEntriesTable.id, opts.entryIds));
  }

  const eligible = await db
    .select()
    .from(journalEntriesTable)
    .where(and(...filters))
    .orderBy(journalEntriesTable.entryDate);

  if (eligible.length === 0) return { surfaced: false, reason: "not_enough" };

  // Diversity / rotation (Engine V2): unless the caller named specific entries,
  // narrow the pool to avoid re-surfacing the same page within 6 months or
  // repeating a theme shown in the last 90 days. Relaxes before ever emptying.
  let pool = eligible;
  if (!opts.entryIds || opts.entryIds.length === 0) {
    const recent = await db
      .select({
        journalEntryId: returnedMemoriesTable.journalEntryId,
        theme: returnedMemoriesTable.theme,
        createdAt: returnedMemoriesTable.createdAt,
      })
      .from(returnedMemoriesTable)
      .where(eq(returnedMemoriesTable.userId, userId));
    const keep = new Set(
      diversifiedPoolIds(
        eligible.map((e) => ({ id: e.id, theme: e.theme })),
        recent,
      ),
    );
    pool = eligible.filter((e) => keep.has(e.id));
  }

  // Bound the pool fed into extraction. PASS1 has a fixed output budget, so a
  // large archive (e.g. a multi-hundred-entry import) overflows it and the
  // candidate JSON truncates → 500 ("Something interrupted the reading"). Cap to
  // a time-spread sample so a big archive still surfaces — and still spans years
  // for thread/distance — instead of erroring. Diversity rotation keeps the
  // sample moving across runs.
  pool = capPoolByTimeSpread(pool, MAX_EXTRACTION_ENTRIES);

  const entriesStr = pool
    .map((e) => `[${e.entryDate}]\n${e.body}`)
    .join("\n\n");

  // Why-today context: today + the themes the writer has centered on lately
  // (her most recent tagged entries). Forwarded to scoring as an optional
  // tiebreak; inert until the engine's WHY_TODAY_TIEBREAK flag is enabled.
  const recentRows = await db
    .select({ theme: journalEntriesTable.theme })
    .from(journalEntriesTable)
    .where(
      and(
        eq(journalEntriesTable.userId, userId),
        isNull(journalEntriesTable.deletedAt),
        isNotNull(journalEntriesTable.theme),
      ),
    )
    .orderBy(desc(journalEntriesTable.entryDate))
    .limit(15);
  const recentThemes = [
    ...new Set(recentRows.map((r) => r.theme).filter((t): t is string => !!t)),
  ];

  // Soft-affinity profile: the writer's favored vs dismissed themes, derived from
  // favorite / "more often" / recently-opened entries (favored) and never-resurface
  // entries (dismissed). Forwarded to scoring; inert until SOFT_AFFINITY is on.
  const affinityRows = await db
    .select({
      theme: journalEntriesTable.theme,
      favorite: journalEntriesTable.favorite,
      resurfacingPreference: journalEntriesTable.resurfacingPreference,
      lastOpenedAt: journalEntriesTable.lastOpenedAt,
    })
    .from(journalEntriesTable)
    .where(
      and(
        eq(journalEntriesTable.userId, userId),
        isNull(journalEntriesTable.deletedAt),
        isNotNull(journalEntriesTable.theme),
      ),
    );
  const affinityProfile = buildAffinityProfile(
    affinityRows.map((r) => ({
      theme: r.theme,
      favorite: r.favorite,
      moreOften: r.resurfacingPreference === "more_often",
      lastOpenedAt: r.lastOpenedAt,
      dismissed: r.resurfacingPreference === "never",
    })),
  );

  const context = {
    today: new Date().toISOString().slice(0, 10),
    recentThemes,
    affinityProfile,
  };

  // entryDate → theme(s) for the pool, keyed exactly as the `[${e.entryDate}]`
  // headers fed to extract. An array per date so a date with MULTIPLE entries
  // (different themes) keeps them all, rather than one arbitrarily winning.
  const dateThemes: Record<string, string[]> = {};
  for (const e of pool) {
    if (!e.theme) continue;
    (dateThemes[String(e.entryDate)] ??= []).push(e.theme);
  }

  const out = await callEngine(
    entriesStr,
    opts.fresh === true,
    context,
    dateThemes,
  );

  // Meter the run — cache misses only (recordRun no-ops on a cache hit). Cost
  // accrues on every real model call; quota (freshReturns) only for a
  // user-initiated, non-re-roll return. Fire-and-forget: never fail a run on it.
  const runKind = meta?.kind === "auto" || opts.preview ? "auto" : "user";
  recordRun(userId, {
    modelCalled: out.modelCalled,
    inputTokens: out.usage.inputTokens,
    outputTokens: out.usage.outputTokens,
    cacheReadTokens: out.usage.cacheReadTokens,
    cacheCreationTokens: out.usage.cacheCreationTokens,
    kind: runKind,
  })
    // After the count is recorded, a user run that just reached the free limit
    // gets the one high-intent membership email (no-op in shadow / for members).
    .then(() => (runKind === "user" ? notifyIfAtLimit(userId) : undefined))
    .catch(() => {});

  if ("crisis" in out) {
    return {
      surfaced: false,
      reason: "crisis",
      supportMessage: out.crisis.supportMessage ?? CRISIS_FALLBACK,
    };
  }

  const score = out.score;
  const mode = typeof score.mode === "string" ? score.mode : undefined;
  if (!mode || mode === "nothing") return { surfaced: false, reason: "nothing" };

  const quotes = Array.isArray(score.quotes)
    ? (score.quotes as { date?: string; fragment?: string }[])
    : [];
  const firstQuote = quotes[0] ?? null;
  const quote = firstQuote?.fragment ?? null;
  const quoteDate = firstQuote?.date ?? null;

  let journalEntryId: string | null = null;
  let theme: string | null = null;
  if (quoteDate) {
    const onDate = pool.filter((e) => e.entryDate === quoteDate);
    const match =
      onDate.find(
        (e) => quote && e.body.toLowerCase().includes(quote.toLowerCase()),
      ) ?? onDate[0];
    journalEntryId = match?.id ?? null;
    theme = match?.theme ?? null;
  }

  const values = {
    userId,
    journalEntryId,
    engineRunId: randomUUID(),
    label: typeof score.label === "string" ? score.label : null,
    observation:
      typeof score.observation === "string" ? score.observation : null,
    quote,
    quoteDate,
    lens: mode as never,
    theme,
    fullEngineResponse: score,
  };

  // Preview: return the framed memory without persisting (no Returns row, no
  // effect on diversity). The transient shape carries everything the card reads.
  if (opts.preview) {
    return {
      surfaced: true,
      memory: {
        id: randomUUID(),
        createdAt: new Date(),
        ...values,
      } as unknown as ReturnedMemory,
    };
  }

  const [row] = await db
    .insert(returnedMemoriesTable)
    .values(values)
    .returning();

  return { surfaced: true, memory: row };
}

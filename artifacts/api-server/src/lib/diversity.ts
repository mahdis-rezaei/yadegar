// Engine V2 — diversity / rotation (deterministic, app-side; never touches the
// calibrated selection prompt). Given the candidate pool and the user's recent
// returns, decide which entry IDs the engine may choose among, so we avoid:
//   - re-surfacing the SAME page within ~6 months ("never twice in 6 months"), and
//   - repeating a THEME shown in the last ~90 days (the "no Grief Retrieval
//     Machine" rule) — a life is larger than its hardest chapter.
// It always relaxes before starving the engine: theme mute first, then entry
// exclusion, so a non-empty pool in → a non-empty pool out.

export interface RecentReturn {
  journalEntryId: string | null;
  theme: string | null;
  createdAt: Date;
}

export interface PoolEntry {
  id: string;
  theme: string | null;
}

const DAY = 86_400_000;
const REPEAT_PAGE_DAYS = 180; // don't re-surface the same page within 6 months
const REPEAT_THEME_DAYS = 90; // don't repeat a theme within 90 days

export function diversifiedPoolIds(
  pool: PoolEntry[],
  recent: RecentReturn[],
  now: Date = new Date(),
): string[] {
  const t = now.getTime();
  const excludedEntries = new Set(
    recent
      .filter((r) => r.journalEntryId && t - r.createdAt.getTime() <= REPEAT_PAGE_DAYS * DAY)
      .map((r) => r.journalEntryId as string),
  );
  const mutedThemes = new Set(
    recent
      .filter((r) => r.theme && t - r.createdAt.getTime() <= REPEAT_THEME_DAYS * DAY)
      .map((r) => r.theme as string),
  );

  const noRepeatPage = pool.filter((p) => !excludedEntries.has(p.id));
  const noRepeatThemeOrPage = noRepeatPage.filter(
    (p) => !p.theme || !mutedThemes.has(p.theme),
  );

  // Relax in order so diversity never empties the pool.
  if (noRepeatThemeOrPage.length > 0) return noRepeatThemeOrPage.map((p) => p.id);
  if (noRepeatPage.length > 0) return noRepeatPage.map((p) => p.id);
  return pool.map((p) => p.id);
}

// Bound how many entries feed the extraction model call. PASS1 has a fixed output
// budget, so an unbounded pool (e.g. a 445-entry bulk import) overflows it and the
// candidate JSON is truncated → parse failure → the user sees "Something
// interrupted the reading." Given a DATE-SORTED pool, pick at most `cap` entries
// evenly spaced across the whole range (always including the oldest and newest),
// so cross-time coverage — what thread/distance modes need — is preserved rather
// than collapsing to one end. Deterministic: same pool in → same sample out (so
// the score cache stays stable). Returns the pool unchanged when already <= cap.
export function capPoolByTimeSpread<T>(pool: T[], cap: number): T[] {
  if (cap <= 0 || pool.length <= cap) return pool;
  if (cap === 1) return [pool[pool.length - 1]]; // most recent
  const step = (pool.length - 1) / (cap - 1);
  const out: T[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < cap; i++) {
    const idx = Math.round(i * step);
    if (!seen.has(idx)) {
      seen.add(idx);
      out.push(pool[idx]);
    }
  }
  return out;
}

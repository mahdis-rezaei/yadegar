// why-today.ts — the personalization SEAM (ADR 0001).
//
// The scorer is context-blind: PASS2 returns pure axis scores + a winner. This
// module applies the "why today" preference AFTER scoring, deterministically,
// over the model's own scores. It can only re-rank AMONG NEAR-TIES and never
// changes a score. Today's context enters ONLY here, in code — never the scorer.
//
// Pure functions, no I/O, no model calls — unit-tested in why-today.test.ts.
// S2b wires this LOG-ONLY (decision logged, surfaced result unchanged). S2c adds
// the voice pass that actually applies an override.

import { affinityScore, type AffinityProfile } from "./affinity";

export interface WhyTodayContext {
  today?: string; // "YYYY-MM-DD"
  recentThemes?: string[];
}

// Minimal structural views of the PASS2 result + score-input candidates. Fields
// are optional because these come from parsed model JSON / zod-validated input.
export interface ScoreEntry {
  candidate_title?: string;
  mode?: string;
  emotional_center?: number;
  specificity?: number;
  discovery?: number;
  contradiction?: number;
  worth_returning_to?: number;
  resolution_penalty_fired?: boolean;
  surfaceable?: boolean;
  displayable_fragments?: string[];
}

export interface SeamCandidate {
  candidate_title?: string;
  mode?: string;
  function?: string;
  description?: string;
  evidence?: { date?: string; fragment?: string }[];
  // Source-entry theme tag(s) — annotated app-side from the candidate's evidence
  // dates. Used by soft affinity only; kept out of the model scoring payload.
  themes?: string[];
}

export interface ScoreResult {
  mode?: string;
  scores?: ScoreEntry[];
  quotes?: { date?: string; fragment?: string }[];
}

export interface WhyTodayDecision {
  fromTitle: string | null; // the model's winner
  toTitle: string | null; // the resonant candidate we'd promote
  reasons: string[]; // why it resonates (anniversary/season/theme)
  winnerEc: number;
  toEc: number;
}

// --- date parsing (self-contained; mirrors still.ts's two accepted formats) ---

const MONTH_NUMBERS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

export function parseDateParts(
  date: string | undefined,
): { year: number; month: number } | null {
  if (!date) return null;
  const iso = date.match(/^(\d{4})-(\d{2})/);
  if (iso) return { year: parseInt(iso[1], 10), month: parseInt(iso[2], 10) };
  const nat = date.match(
    /^([A-Za-z]{3,9})\.?\s+\d{1,2}(?:st|nd|rd|th)?\s*,?\s*(\d{4})/,
  );
  if (nat) {
    const month = MONTH_NUMBERS[nat[1].toLowerCase()];
    if (month) return { year: parseInt(nat[2], 10), month };
  }
  return null;
}

export type Season = "winter" | "spring" | "summer" | "fall";

// Meteorological seasons (northern hemisphere): a coarse, robust "same time of
// year" signal that doesn't depend on exact day-of-month.
export function seasonOf(month: number): Season {
  if (month === 12 || month === 1 || month === 2) return "winter";
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  return "fall";
}

// --- resonance: how much a candidate "fits today" (pure, deterministic) ---

const W_ANNIVERSARY = 3; // same month, an earlier year — strongest
const W_THEME = 2; // echoes a recent theme
const W_SEASON = 1; // same time of year (but not an anniversary)

// A bare same-season coincidence (W_SEASON alone) is too weak to override the
// model's winner — it would fire too often and too thinly. Require a REAL signal:
// an anniversary (3), a theme echo (2), or season stacked with a theme (1+2).
export const MIN_OVERRIDE_RESONANCE = 2;

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export function resonance(
  candidate: SeamCandidate,
  context: WhyTodayContext,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const todayParts = parseDateParts(context.today);
  if (todayParts) {
    const dates = (candidate.evidence ?? [])
      .map((e) => parseDateParts(e.date))
      .filter((d): d is { year: number; month: number } => d != null);

    const anniversary = dates.some(
      (d) => d.month === todayParts.month && d.year !== todayParts.year,
    );
    const sameSeason = dates.some(
      (d) => seasonOf(d.month) === seasonOf(todayParts.month),
    );
    if (anniversary) {
      score += W_ANNIVERSARY;
      reasons.push(`anniversary: written in ${monthName(todayParts.month)} of an earlier year`);
    } else if (sameSeason) {
      score += W_SEASON;
      reasons.push(`same season (${seasonOf(todayParts.month)})`);
    }
  }

  const themes = (context.recentThemes ?? [])
    .map((t) => normalize(t))
    .filter((t) => t.length >= 3);
  if (themes.length > 0) {
    const hay = normalize(
      [candidate.candidate_title, candidate.function, candidate.description]
        .filter(Boolean)
        .join(" "),
    );
    const matched = themes.filter((t) => hay.includes(t));
    if (matched.length > 0) {
      score += W_THEME;
      reasons.push(`echoes recent theme(s): ${matched.join(", ")}`);
    }
  }

  return { score, reasons };
}

function monthName(m: number): string {
  return [
    "January", "February", "March", "April", "May", "June", "July", "August",
    "September", "October", "November", "December",
  ][m - 1] ?? String(m);
}

// --- selection helpers ---

function ec(s: ScoreEntry): number {
  return typeof s.emotional_center === "number" ? s.emotional_center : 0;
}

// Identify the model's winning score entry. The result doesn't label the winner,
// so match the surfaced quotes back to the entry whose displayable_fragments
// contain them; fall back to the strongest surfaceable entry of the result mode.
export function identifyWinner(result: ScoreResult): ScoreEntry | null {
  const scores = result.scores ?? [];
  if (scores.length === 0) return null;
  if (!result.mode || result.mode === "nothing") return null;

  const surfacedFrags = (result.quotes ?? [])
    .map((q) => normalize(q.fragment ?? ""))
    .filter(Boolean);

  if (surfacedFrags.length > 0) {
    let best: ScoreEntry | null = null;
    let bestOverlap = 0;
    for (const s of scores) {
      const frags = (s.displayable_fragments ?? []).map(normalize);
      const overlap = surfacedFrags.filter((q) =>
        frags.some((f) => f === q || f.includes(q) || q.includes(f)),
      ).length;
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = s;
      }
    }
    if (best) return best;
  }

  // Fallback: strongest surfaceable entry matching the result mode.
  const candidates = scores
    .filter((s) => s.surfaceable !== false && (!result.mode || s.mode === result.mode))
    .sort((a, b) => ec(b) - ec(a));
  return candidates[0] ?? scores.slice().sort((a, b) => ec(b) - ec(a))[0] ?? null;
}

// Candidates the model scored as comparable to the winner: surfaceable, not
// resolution-penalized, not the winner, and TIED on the master axis
// (emotional_center). The tie is the whole licence for a why-today nudge — when
// two lines are equally central, the engine was already choosing between them on
// the secondary axes, so "today" is a legitimate final tiebreak there. A lower
// emotional_center means the winner is CLEARLY AHEAD on the deciding axis, and we
// must never override that (this is what the becki ec 5→4 observation taught us).
export function comparableSet(
  winner: ScoreEntry,
  scores: ScoreEntry[],
): ScoreEntry[] {
  const wEc = ec(winner);
  return scores.filter(
    (s) =>
      s !== winner &&
      s.surfaceable !== false &&
      !s.resolution_penalty_fired &&
      ec(s) === wEc,
  );
}

function titleOf(s: { candidate_title?: string }): string {
  return s.candidate_title ?? "";
}

function joinCandidate(
  entry: ScoreEntry,
  candidates: SeamCandidate[],
): SeamCandidate | null {
  const t = normalize(titleOf(entry));
  if (t) {
    const byTitle = candidates.find((c) => normalize(titleOf(c)) === t);
    if (byTitle) return byTitle;
  }
  // Fallback: match by a shared displayable fragment appearing in evidence.
  const frags = (entry.displayable_fragments ?? []).map(normalize);
  if (frags.length > 0) {
    return (
      candidates.find((c) =>
        (c.evidence ?? []).some((e) => frags.includes(normalize(e.fragment ?? ""))),
      ) ?? null
    );
  }
  return null;
}

// Lexicographic axis comparison (the engine's selection order) — used only to
// break ties BETWEEN equally-resonant candidates, deterministically.
function lexCompare(a: ScoreEntry, b: ScoreEntry): number {
  const axes: (keyof ScoreEntry)[] = [
    "emotional_center", "specificity", "discovery", "contradiction", "worth_returning_to",
  ];
  for (const ax of axes) {
    const av = typeof a[ax] === "number" ? (a[ax] as number) : 0;
    const bv = typeof b[ax] === "number" ? (b[ax] as number) : 0;
    if (av !== bv) return bv - av; // higher wins
  }
  return titleOf(a).localeCompare(titleOf(b)); // stable final tiebreak
}

// The decision. Returns null when nothing should change — which is the common
// case and ALL of: silence/empty result, no identifiable winner, the winner
// already resonates with today, or no comparable candidate resonates.
//
// NEVER lowers the silence bar, NEVER promotes a clearly-stronger or penalized
// candidate, and NEVER touches axis scores. When it returns a decision, S2c will
// regenerate the new winner's voice; in S2b it is logged only.
export function chooseWhyTodayOverride(
  result: ScoreResult,
  candidates: SeamCandidate[],
  context: WhyTodayContext,
): WhyTodayDecision | null {
  if (!result || result.mode === "nothing") return null;
  const winner = identifyWinner(result);
  if (!winner) return null;

  // If the model's own winner already fits today, there's nothing to do.
  const winnerCand = joinCandidate(winner, candidates);
  if (winnerCand && resonance(winnerCand, context).score > 0) return null;

  const comparable = comparableSet(winner, result.scores ?? []);
  if (comparable.length === 0) return null;

  const resonant = comparable
    .map((entry) => {
      const cand = joinCandidate(entry, candidates);
      const r = cand ? resonance(cand, context) : { score: 0, reasons: [] };
      return { entry, ...r };
    })
    .filter((x) => x.score >= MIN_OVERRIDE_RESONANCE);
  if (resonant.length === 0) return null;

  resonant.sort(
    (a, b) => b.score - a.score || lexCompare(a.entry, b.entry),
  );
  const choice = resonant[0];

  return {
    fromTitle: titleOf(winner) || null,
    toTitle: titleOf(choice.entry) || null,
    reasons: choice.reasons,
    winnerEc: ec(winner),
    toEc: ec(choice.entry),
  };
}

// The COMPOSED seam decision (ADR 0001): why-today + soft affinity as one
// preference over the same comparable set. Each signal is independently gated.
//
// CRITICAL GUARANTEE: when affinity is off (`profile` absent) this delegates to
// the untouched `chooseWhyTodayOverride` — so the live why-today path is provably
// identical. Only when a profile is supplied does the combined-preference path
// run (resonance counted only if `whyToday` is on, plus affinityScore), still
// confined to ec-tied / surfaceable / non-penalized candidates and still
// requiring a real signal (>= MIN_OVERRIDE_RESONANCE) that beats the winner's own
// preference — so a favored-theme winner is never overridden, and a dismissed
// winner can be gently passed over for a co-equal neighbour.
export function chooseSeamOverride(
  result: ScoreResult,
  candidates: SeamCandidate[],
  context: WhyTodayContext,
  opts: { whyToday: boolean; profile?: AffinityProfile },
): WhyTodayDecision | null {
  if (!opts.profile) {
    return opts.whyToday ? chooseWhyTodayOverride(result, candidates, context) : null;
  }
  if (!result || result.mode === "nothing") return null;
  const winner = identifyWinner(result);
  if (!winner) return null;

  const prefOf = (entry: ScoreEntry): { score: number; reasons: string[] } => {
    const cand = joinCandidate(entry, candidates);
    if (!cand) return { score: 0, reasons: [] };
    const r = opts.whyToday ? resonance(cand, context) : { score: 0, reasons: [] };
    const a = affinityScore(cand, opts.profile!);
    return { score: r.score + a.score, reasons: [...r.reasons, ...a.reasons] };
  };

  const winnerPref = prefOf(winner).score;
  const scored = comparableSet(winner, result.scores ?? [])
    .map((entry) => ({ entry, ...prefOf(entry) }))
    .filter((x) => x.score >= MIN_OVERRIDE_RESONANCE && x.score > winnerPref);
  if (scored.length === 0) return null;

  scored.sort((a, b) => b.score - a.score || lexCompare(a.entry, b.entry));
  const choice = scored[0];
  return {
    fromTitle: titleOf(winner) || null,
    toTitle: titleOf(choice.entry) || null,
    reasons: choice.reasons,
    winnerEc: ec(winner),
    toEc: ec(choice.entry),
  };
}

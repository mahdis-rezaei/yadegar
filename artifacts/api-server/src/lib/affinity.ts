// affinity.ts — soft affinity (ADR 0001, the seam's SECOND signal). Pure,
// deterministic, unit-tested. The product rule (engine-v2-build-plan, Phase 3):
// "gently boost themes the user favorites/opens; gently down-weight a theme just
// dismissed. Never punish; never visible." Anti-horoscope: optimize for
// RECOGNITION, never engagement/intensity.
//
// This is the seam's second signal — it feeds the SAME comparable re-rank as
// why-today (why-today.ts), not a second architecture. It is NOT pool-level
// favorite-weighting (that already ships at the pool stage); it is a
// selection-level nudge among candidates the model itself scored as co-equal.
//
// NOTE: not wired anywhere yet. The composition with why-today (a combined
// preference over comparableSet) lands when SOFT_AFFINITY is wired, log-only,
// after why-today is confirmed live. See docs/adr/0001-personalization-seam.md.

import type { SeamCandidate } from "./why-today";

export interface AffinityProfile {
  favored: string[]; // normalized themes the writer treasures (favorited / recently opened)
  dismissed: string[]; // normalized themes the writer pushed away (resurfacing "never")
}

// The per-entry inputs the app already has. `dismissed` mirrors
// resurfacing_preference === "never"; `lastOpenedAt` is the open signal. Keeping
// these normalized fields (not raw column names) keeps this module pure and
// decoupled from the schema.
export interface AffinityEntry {
  theme: string | null;
  favorite: boolean;
  moreOften: boolean; // resurfacing_preference === "more_often" — explicit "show this more"
  lastOpenedAt: Date | null;
  dismissed: boolean;
}

const DAY = 86_400_000;
const OPEN_WINDOW_DAYS = 90; // an "open" counts as interest only if it's recent

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

// Build the writer's affinity profile from their entries. Favorited entries and
// entries opened within the window contribute their theme to `favored`; entries
// marked never-resurface contribute to `dismissed`. A theme that is BOTH
// treasured and elsewhere dismissed is ambiguous, so we stay silent on it
// (neither boost nor penalize) — never punish. The catch-all "other" theme is
// not a signal. Pure given `entries`.
export function buildAffinityProfile(
  entries: AffinityEntry[],
  now: Date = new Date(),
): AffinityProfile {
  const t = now.getTime();
  const favored = new Set<string>();
  const dismissed = new Set<string>();

  for (const e of entries) {
    if (!e.theme) continue;
    const theme = norm(e.theme);
    if (!theme || theme === "other") continue;
    if (e.dismissed) {
      dismissed.add(theme);
      continue;
    }
    const openedRecently =
      e.lastOpenedAt != null &&
      t - e.lastOpenedAt.getTime() <= OPEN_WINDOW_DAYS * DAY;
    if (e.favorite || e.moreOften || openedRecently) favored.add(theme);
  }

  for (const d of dismissed) favored.delete(d);
  return { favored: [...favored].sort(), dismissed: [...dismissed].sort() };
}

const W_FAVORED = 2; // a real signal — same weight as why-today's theme echo
const W_DISMISSED = 2; // symmetric soft down-weight

// How much a candidate aligns with the writer's affinity profile, matched on the
// candidate's SOURCE-ENTRY theme TAG (the resurface-safety `theme`), NOT the
// model-written gloss — the DEV A/B showed gloss substring-matching is brittle
// (coincidental hits + misses the true center). Exact tag membership: positive
// for a favored theme, negative (soft) for a dismissed one, zero otherwise — a
// gentle thumb on the scale among co-equal candidates, never a gate.
export function affinityScore(
  candidate: SeamCandidate,
  profile: AffinityProfile,
): { score: number; reasons: string[] } {
  const themes = [
    ...new Set((candidate.themes ?? []).map(norm).filter(Boolean)),
  ];
  if (themes.length === 0) return { score: 0, reasons: [] };

  const favored = new Set(profile.favored.map(norm));
  const dismissed = new Set(profile.dismissed.map(norm));
  const reasons: string[] = [];
  let score = 0;

  const favs = themes.filter((t) => favored.has(t));
  if (favs.length > 0) {
    score += W_FAVORED;
    reasons.push(`favored theme(s): ${favs.join(", ")}`);
  }
  const dis = themes.filter((t) => dismissed.has(t));
  if (dis.length > 0) {
    score -= W_DISMISSED;
    reasons.push(`dismissed theme(s): ${dis.join(", ")}`);
  }

  return { score, reasons };
}

// Normalized shape the harness reasons about. The adapter (adapter.ts) maps the
// live engine's real response into this shape, so the checks never depend on the
// engine's exact JSON. If the engine output changes, edit ONLY the adapter.

export interface Quote {
  date: string;
  text: string;
}

export interface CandidateScores {
  center?: number;
  specific?: number;
  discovery?: number;
  contra?: number;
  worth?: number;
}

export interface CandidateGates {
  floors?: boolean;
  perspective?: boolean;
  evidence?: boolean;
  /** gate_displayable_quote: a safe fragment survives the quote-safety filter. */
  displayable?: boolean;
}

export interface Candidate {
  lens: string;
  /** Near-verbatim fragments this candidate is built from. */
  fragments: string[];
  scores: CandidateScores;
  gates: CandidateGates;
  resolutionPenalized?: boolean;
  surfaceable?: boolean;
  why?: string;
}

export interface EngineResult {
  mode?: string;
  candidates: Candidate[];
  result: {
    /** A lens name when something surfaced, "nothing", or "crisis" (§3.1). */
    register: string;
    label: string | null;
    observation: string | null;
    quotes: Quote[];
    /** §3.1 crisis response: warm support text, shown instead of any insight. */
    supportMessage?: string | null;
    wonAt?: string;
    why?: string;
    /**
     * Option B: the writer-initiated cross-time thread offered beneath the
     * primary. Null/absent when none qualifies (or when the primary is itself
     * a thread). Its quotes are the behind-the-door evidence (2+ time-distant).
     */
    secondaryThread?: {
      observation?: string | null;
      quotes?: Quote[];
    } | null;
  };
}

// ── Fixtures ────────────────────────────────────────────────────────────────

export type Expect = "surface" | "nothing";

export interface Fixture {
  id: string;
  /** Human label for the scorecard. */
  title: string;
  /** Full entry text fed to the engine. */
  entry: string;
  expect: Expect;
  /**
   * Lines that SHOULD win (any one counts). Near-verbatim; matched as a
   * normalized substring so punctuation/case differences don't matter.
   */
  targets?: string[];
  /** Lines that must NOT win, and ideally must not even out-rank the target. */
  antiTargets?: string[];
  /**
   * For multi-year input: the winner should be a cross-time thread/distance
   * whose quotes span ≥2 distinct years — not a single-entry line. Guards the
   * continuity thesis (§1/§5) against the gate suppressing cross-time threads.
   */
  expectSpan?: boolean;
  /**
   * Option B: a writer-initiated secondary cross-time thread should be offered
   * beneath the (single-entry) primary, spanning ≥2 distinct years.
   */
  expectSecondaryThread?: boolean;
  /**
   * §3.1: an active, present-tense crisis entry must NOT be analyzed — the
   * engine returns a warm support response (register "crisis" / supportMessage)
   * and surfaces no thread/observation/quote.
   */
  expectCrisis?: boolean;
  /**
   * §3 hard-floor lines (body/appearance/eating). These must NEVER appear in
   * any candidate fragment OR the surfaced result — not gated-but-present,
   * absent. Checked regardless of `expect`.
   */
  hardFloor?: string[];
  /**
   * Optional why-today context, forwarded to POST /still/score (http mode only).
   * Lets a case exercise the dark-shipped why-today tiebreak: set `today` /
   * `recentThemes` so a temporally- or thematically-resonant target wins a
   * near-tie. Inert unless the engine's WHY_TODAY_TIEBREAK flag is on.
   */
  context?: { today?: string; recentThemes?: string[] };
  /** Why this case exists / what it guards against. */
  note?: string;
}

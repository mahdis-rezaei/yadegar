import type { Candidate, EngineResult, Fixture } from "./types";

export interface Check {
  name: string;
  pass: boolean;
  detail: string;
}

export interface CaseReport {
  id: string;
  title: string;
  selection: Check[];
  voice: Check[];
  /** Non-fatal diagnostics (e.g. inflated specificity on an anti-target). */
  diagnostics: string[];
}

// ── helpers ───────────────────────────────────────────────────────────────

export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’“”'"]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.,!?;:…]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesLine(haystack: string, line: string): boolean {
  return norm(haystack).includes(norm(line));
}

function candidateText(c: Candidate): string {
  return c.fragments.join(" · ");
}

function resultText(r: EngineResult): string {
  return [
    r.result.observation ?? "",
    ...r.result.quotes.map((q) => q.text),
  ].join(" · ");
}

// The only ordering guarantee that's actually true and desirable: the winner
// must hold the top emotional_center among surfaceable candidates. Sub-center
// ordering is holistic by design — discovery/worth can rightly override
// specificity (e.g. Test 4: "once again we have a family" beats the higher-
// specificity "family in first row" because it's the deeper discovery). So we
// do NOT enforce strict lexicographic dominance below center — that would fail
// good picks.
function findWinner(res: EngineResult): Candidate | undefined {
  const quotes = res.result.quotes.map((q) => norm(q.text)).filter(Boolean);
  if (!quotes.length) return undefined;
  // Map the displayed quote back to its candidate by BEST overlap, not the first
  // loose match. On a "bundled" candidate (one carrying several fragments) a
  // short fragment from a DIFFERENT candidate can sit inside the displayed quote
  // (quote.includes(fragment)) and used to win the .find(), mis-mapping the
  // winner and throwing off the emotional_center check even when the engine
  // surfaced the right line. Rank: exact match > fragment contains the shown
  // quote > shown quote contains the fragment, and take the strongest.
  let best: { c: Candidate; score: number } | undefined;
  for (const c of res.candidates) {
    let score = 0;
    for (const f of c.fragments) {
      const nf = norm(f);
      if (!nf) continue;
      for (const q of quotes) {
        if (q === nf) score = Math.max(score, 3);
        else if (nf.includes(q)) score = Math.max(score, 2);
        else if (q.includes(nf)) score = Math.max(score, 1);
      }
    }
    if (score > 0 && (!best || score > best.score)) best = { c, score };
  }
  return best?.c;
}

// ── selection checks ────────────────────────────────────────────────────────

function selectionChecks(fx: Fixture, res: EngineResult): Check[] {
  const checks: Check[] = [];

  // §3 hard floor: body/appearance content must be ABSENT — not gated-but-present.
  // Scans every candidate fragment AND the surfaced result. Runs for all cases.
  if (fx.hardFloor?.length) {
    const haystack = [
      ...res.candidates.map(candidateText),
      resultText(res),
    ].join(" · ");
    const breach = fx.hardFloor.find((h) => includesLine(haystack, h));
    checks.push({
      name: "hard floor: banned content absent",
      pass: !breach,
      detail: breach
        ? `HARD FLOOR BREACH: "${breach}" present in candidates/result`
        : "no body/appearance content extracted or surfaced",
    });
  }

  // §3.1: an active-crisis entry must get a warm support response, never an
  // analysis. Pass iff it's a crisis/support response AND surfaces no insight.
  if (fx.expectCrisis) {
    const r = res.result;
    const isCrisis = r.register === "crisis" || Boolean(r.supportMessage);
    const noAnalysis = r.quotes.length === 0 && !r.secondaryThread;
    checks.push({
      name: "active crisis → support response, not analysis (§3.1)",
      pass: isCrisis && noAnalysis,
      detail: !isCrisis
        ? `expected a crisis/support response, got register=${r.register}`
        : !noAnalysis
          ? `crisis flagged but it still surfaced ${r.quotes.length} quote(s)/a thread — must not analyze`
          : "warm support response, no surfaced insight",
    });
    return checks;
  }

  if (fx.expect === "nothing") {
    const isNothing =
      res.result.register === "nothing" && !res.result.observation;
    checks.push({
      name: "returns nothing",
      pass: isNothing,
      detail: isNothing
        ? "register=nothing, no observation"
        : `expected silence, got register=${res.result.register} / "${(res.result.observation ?? "").slice(0, 60)}…"`,
    });
    return checks;
  }

  const won = resultText(res);

  // 1. a target line exists somewhere in the candidate set (extraction).
  if (fx.targets?.length) {
    const allFragments = res.candidates.map(candidateText).join(" · ");
    const found = fx.targets.find((t) => includesLine(allFragments, t));
    checks.push({
      name: "target extracted as candidate",
      pass: Boolean(found),
      detail: found
        ? `found "${found}"`
        : `NONE of [${fx.targets.map((t) => `"${t}"`).join(", ")}] is a candidate — extraction (Pass 1) bug`,
    });

    // 2. a target line won.
    const wonTarget = fx.targets.find((t) => includesLine(won, t));
    checks.push({
      name: "target won",
      pass: Boolean(wonTarget),
      detail: wonTarget
        ? `surfaced "${wonTarget}"`
        : `winner does not contain any target line`,
    });
  }

  // 3. no anti-target won.
  if (fx.antiTargets?.length) {
    const leaked = fx.antiTargets.find((a) => includesLine(won, a));
    checks.push({
      name: "anti-target did not win",
      pass: !leaked,
      detail: leaked
        ? `ANTI-TARGET surfaced: "${leaked}"`
        : "no anti-target in the winner",
    });
  }

  // 4. surfaced quotes must carry a real entry date — not empty, not "unknown".
  // (The date anchors "a page from THEN"; segmentation that drops it is a bug.)
  const badDate = res.result.quotes.find(
    (q) => !q.date.trim() || norm(q.date) === "unknown",
  );
  checks.push({
    name: "surfaced quotes have a real date",
    pass: res.result.quotes.length > 0 && !badDate,
    detail: badDate
      ? `quote date is "${badDate.date.trim() || "(empty)"}" — date attribution lost`
      : res.result.quotes.length
        ? "all quotes dated"
        : "no quotes to date",
  });

  // 5. the winner must hold the top emotional_center among surfaceable
  // candidates — EXCEPT a promoted cross-time thread, which (Option B Fix 2)
  // legitimately wins on continuity even when a single-entry line scores higher
  // center. So skip this check when the winner spans ≥2 years / is a thread.
  const winner = findWinner(res);
  const winnerYears = new Set(
    res.result.quotes.map((q) => q.date.match(/\d{4}/)?.[0]).filter(Boolean),
  );
  const winnerIsThread =
    winnerYears.size >= 2 ||
    ["thread", "distance", "continuity"].includes(res.result.register);
  if (winner && !winnerIsThread) {
    const higher = res.candidates.find(
      (c) =>
        c !== winner &&
        c.surfaceable !== false &&
        !c.resolutionPenalized &&
        (c.scores.center ?? 0) > (winner.scores.center ?? 0),
    );
    checks.push({
      name: "winner has top emotional_center",
      pass: !higher,
      detail: higher
        ? `"${higher.fragments[0]}" has higher emotional_center than the winner`
        : "winner ≥ all surfaceable on emotional_center",
    });
  }

  // 6. continuity: for multi-year input, the winner should be a cross-time
  // thread/distance whose quotes span ≥2 distinct years — not a single-entry
  // line. (The §1/§5 thesis; guards against the gate suppressing cross-time
  // threads so a single-page line wins by default.)
  if (fx.expectSpan) {
    const years = new Set(
      res.result.quotes.map((q) => q.date.match(/\d{4}/)?.[0]).filter(Boolean),
    );
    checks.push({
      name: "winner spans ≥2 years (cross-time thread)",
      pass: years.size >= 2,
      detail:
        years.size >= 2
          ? `spans ${[...years].join(", ")}`
          : `single-entry winner (years: ${[...years].join(", ") || "none"}) — a cross-time thread should win on multi-year input`,
    });
  }

  // 7. Option B: a secondary cross-time thread should be offered beneath a
  // single-entry primary, spanning ≥2 distinct years.
  if (fx.expectSecondaryThread) {
    const st = res.result.secondaryThread;
    const years = new Set(
      (st?.quotes ?? []).map((q) => q.date.match(/\d{4}/)?.[0]).filter(Boolean),
    );
    checks.push({
      name: "secondary cross-time thread offered (≥2 years)",
      pass: Boolean(st) && years.size >= 2,
      detail: !st
        ? "no secondaryThread offered — Option B pull missing"
        : years.size >= 2
          ? `secondary thread spans ${[...years].join(", ")}`
          : `secondary present but not cross-year (${[...years].join(", ") || "no dated quotes"})`,
    });
  }

  return checks;
}

// ── voice checks ────────────────────────────────────────────────────────────

const BANNED_OPENERS: RegExp[] = [
  /^there'?s a line/i,
  /^i (kept|keep) coming back/i,
  /^i (had|have) to stop on/i,
  /^i (kept|keep) stopping/i,
  /^the line that stayed/i,
  /^what stayed with me/i,
  /^i stopped on this/i,
  /^this is the line i would/i,
  /^this sentence stayed/i,
  /^of everything here/i,
  /^this felt like the center/i,
  /^i \w+ (coming back|stopping|returning) to/i,
];

const BANNED_VOCAB: string[] = [
  "knowing what it knows",
  "two things at once",
  "the writing is",
  "the writing does",
  "the entries reveal",
  "the writing demonstrates",
  "the arc",
  "the transformation",
];

const INTERIOR_CLAIMS: RegExp[] = [
  /you realized/i,
  /you learned/i,
  /you became/i,
  /you transformed/i,
  /you welcomed/i,
];

// Pull quoted spans out of an observation so we can check the voice only points
// at lines that are actually displayed. Conservative on purpose: matches double
// quotes (straight/curly) and curly single quotes, requires a space inside, and
// skips straight single quotes entirely — apostrophes in contractions ("don't")
// would otherwise create false pairs and fail good results.
function extractQuotedSnippets(s: string): string[] {
  const out: string[] = [];
  const patterns = [/"([^"]{10,}?)"/g, /“([^”]{10,}?)”/g, /‘([^’]{10,}?)’/g];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      if (m[1].includes(" ")) out.push(m[1]);
    }
  }
  return out;
}

// Longest run of consecutive (normalized) words shared between two strings.
// Used to detect when an observation re-quotes the line the card already shows
// above it: a long verbatim run means the voice is repeating, not framing.
function longestSharedWordRun(a: string, b: string): number {
  const aw = norm(a).split(" ").filter(Boolean);
  const bw = norm(b).split(" ").filter(Boolean);
  let best = 0;
  const dp = new Array(bw.length + 1).fill(0);
  for (let i = 1; i <= aw.length; i++) {
    let prev = 0;
    for (let j = 1; j <= bw.length; j++) {
      const tmp = dp[j];
      dp[j] = aw[i - 1] === bw[j - 1] ? prev + 1 : 0;
      if (dp[j] > best) best = dp[j];
      prev = tmp;
    }
  }
  return best;
}

function countSentences(s: string): number {
  // Strip embedded quoted material so a quoted "…life!" doesn't inflate the count.
  const stripped = s.replace(/['"‘’“”][^'"‘’“”]*['"‘’“”]/g, " ");
  const parts = stripped
    .split(/[.!?]+(?:\s|$)/)
    .filter((p) => p.trim().length > 0);
  return Math.max(parts.length, 1);
}

function voiceChecks(res: EngineResult): Check[] {
  const obs = (res.result.observation ?? "").trim();
  if (!obs) return [];
  const checks: Check[] = [];
  const lead = obs.replace(/^["'‘’“”]+/, "");

  const bannedOpener = BANNED_OPENERS.find((re) => re.test(lead));
  checks.push({
    name: "opener not a stock formula",
    pass: !bannedOpener,
    detail: bannedOpener ? `banned opener: ${bannedOpener}` : "ok",
  });

  const sentences = countSentences(obs);
  checks.push({
    name: "1-3 sentences",
    pass: sentences <= 3,
    detail: `${sentences} sentence(s)`,
  });

  // Concision (the 80/20 principle). NB: "shorter than the quote" in raw chars
  // is a bad metric — a 2-sentence observation will always exceed a short
  // one-line quote. What we actually want is that the observation stays small
  // and points rather than over-explains, so cap it in absolute words.
  const words = obs.split(/\s+/).filter(Boolean).length;
  checks.push({
    name: "observation is concise (≤ 45 words)",
    pass: words <= 45,
    detail: `${words} words`,
  });

  const vocab = BANNED_VOCAB.find((v) => obs.toLowerCase().includes(v));
  checks.push({
    name: "no literary/analysis vocab",
    pass: !vocab,
    detail: vocab ? `contains "${vocab}"` : "ok",
  });

  const interior = INTERIOR_CLAIMS.find((re) => re.test(obs));
  checks.push({
    name: "no interior claims",
    pass: !interior,
    detail: interior ? `interior claim: ${interior}` : "ok",
  });

  // Coherence: the observation may only quote/point at lines that are actually
  // displayed. Catches the voice ↔ quote-safety-filter conflict — an observation
  // referencing a line the filter withheld from the shown quotes.
  const displayedQuotes = res.result.quotes.map((q) => q.text).join(" · ");
  const referenced = extractQuotedSnippets(obs);
  const orphan = referenced.find((q) => !includesLine(displayedQuotes, q));
  checks.push({
    name: "observation quotes only shown lines",
    pass: !orphan,
    detail: orphan
      ? `references a line not in displayed quotes: "${orphan.slice(0, 50)}…"`
      : referenced.length
        ? "all referenced quotes are shown"
        : "no inline quotes (points without quoting)",
  });

  // No redundant restatement: the card renders the quote directly above the
  // observation, so an observation that re-quotes most of that same line reads
  // as repetition. The voice should FRAME the line, not echo it. We flag a
  // contiguous verbatim run that is ≥70% of a shown quote (min 3 words) — this
  // catches a fully restated SHORT quote (e.g. "Close your eyes Mahdis.") as
  // well as a long one, while a brief pointer fragment still passes.
  const restated = res.result.quotes.find((q) => {
    const qWords = norm(q.text).split(" ").filter(Boolean).length;
    if (qWords < 3) return false;
    const run = longestSharedWordRun(obs, q.text);
    return run >= 3 && run >= 0.7 * qWords;
  });
  checks.push({
    name: "observation doesn't restate the displayed quote",
    pass: !restated,
    detail: restated
      ? `re-quotes the shown line ("${restated.text.slice(0, 50)}…") — frame it, don't repeat it`
      : "ok",
  });

  return checks;
}

// ── diagnostics (non-fatal) ───────────────────────────────────────────────

function diagnostics(fx: Fixture, res: EngineResult): string[] {
  const out: string[] = [];
  if (!fx.antiTargets?.length) return out;
  for (const c of res.candidates) {
    const text = candidateText(c);
    const matched = fx.antiTargets.find((a) => includesLine(text, a));
    if (matched && (c.scores.specific ?? 0) > 2) {
      out.push(
        `specificity inflation: anti-target candidate ("${matched}") scored specific=${c.scores.specific} (expected ≤2 for a generic line)`,
      );
    }
  }
  return out;
}

export function evaluateCase(fx: Fixture, res: EngineResult): CaseReport {
  return {
    id: fx.id,
    title: fx.title,
    selection: selectionChecks(fx, res),
    voice: voiceChecks(res),
    diagnostics: diagnostics(fx, res),
  };
}

// ── cross-result opener uniqueness ──────────────────────────────────────────

export function openerSignature(observation: string): string {
  return norm(observation).split(" ").slice(0, 5).join(" ");
}

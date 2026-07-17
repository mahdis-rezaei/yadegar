import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseDateParts,
  seasonOf,
  resonance,
  comparableSet,
  identifyWinner,
  chooseWhyTodayOverride,
  chooseSeamOverride,
  type ScoreEntry,
  type SeamCandidate,
  type ScoreResult,
} from "./why-today";

// --- date parsing ---
test("parseDateParts handles ISO and natural formats", () => {
  assert.deepEqual(parseDateParts("2016-09-06"), { year: 2016, month: 9 });
  assert.deepEqual(parseDateParts("September 06, 2016"), { year: 2016, month: 9 });
  assert.deepEqual(parseDateParts("Sep 6, 2016"), { year: 2016, month: 9 });
  assert.equal(parseDateParts(undefined), null);
  assert.equal(parseDateParts("not a date"), null);
});

test("seasonOf maps months to meteorological seasons", () => {
  assert.equal(seasonOf(12), "winter");
  assert.equal(seasonOf(1), "winter");
  assert.equal(seasonOf(4), "spring");
  assert.equal(seasonOf(7), "summer");
  assert.equal(seasonOf(9), "fall");
});

// --- resonance ---
const cand = (over: Partial<SeamCandidate> = {}): SeamCandidate => ({
  candidate_title: "C",
  function: "",
  description: "",
  evidence: [],
  ...over,
});

test("resonance: anniversary (same month, earlier year) scores highest", () => {
  const c = cand({ evidence: [{ date: "2016-09-06", fragment: "x" }] });
  const r = resonance(c, { today: "2026-09-03" });
  assert.equal(r.score, 3);
  assert.match(r.reasons[0], /anniversary/);
});

test("resonance: same season but not same month scores low", () => {
  const c = cand({ evidence: [{ date: "2016-10-06", fragment: "x" }] });
  const r = resonance(c, { today: "2026-09-03" }); // Oct & Sep both 'fall'
  assert.equal(r.score, 1);
  assert.match(r.reasons[0], /season/);
});

test("resonance: same month same year is NOT an anniversary", () => {
  const c = cand({ evidence: [{ date: "2026-09-01", fragment: "x" }] });
  const r = resonance(c, { today: "2026-09-03" });
  // not anniversary (same year), but same season → 1
  assert.equal(r.score, 1);
});

test("resonance: theme overlap adds weight; stacks with date", () => {
  const c = cand({
    function: "recurring homesickness when far from family",
    evidence: [{ date: "2016-09-06", fragment: "x" }],
  });
  const r = resonance(c, { today: "2026-09-03", recentThemes: ["homesickness"] });
  assert.equal(r.score, 5); // anniversary 3 + theme 2
});

test("resonance: no context, no signal → 0", () => {
  assert.equal(resonance(cand(), {}).score, 0);
  assert.equal(resonance(cand({ evidence: [{ date: "2016-03-01", fragment: "x" }] }), { today: "2026-09-03" }).score, 0);
});

// --- comparableSet ---
const entry = (over: Partial<ScoreEntry> = {}): ScoreEntry => ({
  candidate_title: "E",
  surfaceable: true,
  emotional_center: 4,
  specificity: 3,
  discovery: 3,
  contradiction: 2,
  worth_returning_to: 3,
  ...over,
});

test("comparableSet: only master-axis TIES, surfaceable, not penalized", () => {
  const winner = entry({ candidate_title: "W", emotional_center: 4 });
  const scores = [
    winner,
    entry({ candidate_title: "tie", emotional_center: 4 }),
    entry({ candidate_title: "one-below", emotional_center: 3 }), // excluded (winner clearly ahead)
    entry({ candidate_title: "above", emotional_center: 5 }), // excluded (above winner)
    entry({ candidate_title: "penalized", emotional_center: 4, resolution_penalty_fired: true }),
    entry({ candidate_title: "gated", emotional_center: 4, surfaceable: false }),
  ];
  const got = comparableSet(winner, scores).map((s) => s.candidate_title).sort();
  assert.deepEqual(got, ["tie"]);
});

// --- identifyWinner ---
test("identifyWinner: matches surfaced quotes to displayable_fragments", () => {
  const result: ScoreResult = {
    mode: "memory",
    quotes: [{ date: "2016-09-06", fragment: "I am tired" }],
    scores: [
      entry({ candidate_title: "other", displayable_fragments: ["a long way"] }),
      entry({ candidate_title: "winner", displayable_fragments: ["I am tired"] }),
    ],
  };
  assert.equal(identifyWinner(result)?.candidate_title, "winner");
});

test("identifyWinner: mode 'nothing' has no winner", () => {
  assert.equal(identifyWinner({ mode: "nothing", scores: [entry()] }), null);
});

// --- chooseWhyTodayOverride ---
function scenario(): { result: ScoreResult; candidates: SeamCandidate[] } {
  // Winner is a strong-but-not-resonant line; a comparable near-tie resonates.
  const result: ScoreResult = {
    mode: "memory",
    quotes: [{ date: "2016-04-01", fragment: "the long way" }],
    scores: [
      entry({ candidate_title: "Long Way", emotional_center: 4, displayable_fragments: ["the long way"] }),
      entry({ candidate_title: "Happiest Mask", emotional_center: 4, specificity: 2, displayable_fragments: ["I am tired"] }),
    ],
  };
  const candidates: SeamCandidate[] = [
    cand({ candidate_title: "Long Way", evidence: [{ date: "2016-04-01", fragment: "the long way" }] }),
    cand({ candidate_title: "Happiest Mask", evidence: [{ date: "2016-09-06", fragment: "I am tired" }] }),
  ];
  return { result, candidates };
}

test("override: tips a real near-tie toward the resonant candidate", () => {
  const { result, candidates } = scenario();
  const d = chooseWhyTodayOverride(result, candidates, { today: "2026-09-03" });
  assert.ok(d, "expected an override decision");
  assert.equal(d!.fromTitle, "Long Way");
  assert.equal(d!.toTitle, "Happiest Mask");
});

test("override: never overrides a higher emotional_center (the becki ec 5→4 case)", () => {
  const { result, candidates } = scenario();
  result.scores![0].emotional_center = 5; // Long Way clearly ahead on the master axis
  result.scores![1].emotional_center = 4; // resonant, but one below — must NOT win
  const d = chooseWhyTodayOverride(result, candidates, { today: "2026-09-03" });
  assert.equal(d, null);
});

test("override: preserves silence (mode nothing → null)", () => {
  const { candidates } = scenario();
  const d = chooseWhyTodayOverride({ mode: "nothing", scores: [] }, candidates, { today: "2026-09-03" });
  assert.equal(d, null);
});

test("override: no decision when the winner itself already resonates", () => {
  const { result, candidates } = scenario();
  // Make the winner (Long Way) resonate with today instead.
  candidates[0].evidence = [{ date: "2015-09-10", fragment: "the long way" }];
  const d = chooseWhyTodayOverride(result, candidates, { today: "2026-09-03" });
  assert.equal(d, null);
});

test("override: no decision when no comparable candidate resonates", () => {
  const { result, candidates } = scenario();
  const d = chooseWhyTodayOverride(result, candidates, { today: "2026-01-03" }); // winter, no match
  assert.equal(d, null);
});

test("override: a bare same-season coincidence is too weak to fire", () => {
  const { result, candidates } = scenario();
  // Resonant candidate now only shares the SEASON (Oct vs today Sep = fall), not
  // the month (no anniversary) and no theme → resonance 1 < MIN_OVERRIDE_RESONANCE.
  candidates[1].evidence = [{ date: "2016-10-06", fragment: "I am tired" }];
  const d = chooseWhyTodayOverride(result, candidates, { today: "2026-09-03" });
  assert.equal(d, null);
});

// --- chooseSeamOverride (composition of why-today + soft affinity) ---
test("seam: affinity OFF (no profile) is byte-identical to chooseWhyTodayOverride", () => {
  const { result, candidates } = scenario();
  const ctx = { today: "2026-09-03" };
  assert.deepEqual(
    chooseSeamOverride(result, candidates, ctx, { whyToday: true }),
    chooseWhyTodayOverride(result, candidates, ctx),
  );
});

test("seam: both signals off → null", () => {
  const { result, candidates } = scenario();
  assert.equal(
    chooseSeamOverride(result, candidates, { today: "2026-09-03" }, { whyToday: false }),
    null,
  );
});

test("seam: affinity boosts a favored-tag comparable even with no today resonance", () => {
  const { result, candidates } = scenario();
  candidates[1].themes = ["exhaustion"]; // favored source-entry tag
  const d = chooseSeamOverride(
    result,
    candidates,
    { today: "2026-01-03" }, // winter → no why-today resonance for either
    { whyToday: true, profile: { favored: ["exhaustion"], dismissed: [] } },
  );
  assert.ok(d, "favored comparable should fire on affinity alone");
  assert.equal(d!.toTitle, "Happiest Mask");
});

test("seam: a dismissed-tag comparable is never promoted", () => {
  const { result, candidates } = scenario();
  candidates[1].themes = ["grief"];
  const d = chooseSeamOverride(
    result,
    candidates,
    { today: "2026-01-03" },
    { whyToday: true, profile: { favored: [], dismissed: ["grief"] } },
  );
  assert.equal(d, null);
});

test("seam: a favored-tag WINNER is never overridden by an equally-favored neighbour", () => {
  const { result, candidates } = scenario();
  candidates[0].themes = ["exhaustion"]; // winner favored
  candidates[1].themes = ["exhaustion"]; // comparable favored
  const d = chooseSeamOverride(
    result,
    candidates,
    { today: "2026-01-03" },
    { whyToday: true, profile: { favored: ["exhaustion"], dismissed: [] } },
  );
  assert.equal(d, null); // comparable pref not strictly greater than winner pref
});

test("seam: a today-resonant WINNER is not overridden by an affinity-favored peer", () => {
  // Architect caveat: the combined path drops why-today's winner-resonance
  // short-circuit, but the winner's resonance still counts in ITS preference —
  // so a peer favored on affinity alone (max +2) cannot beat a winner resonating
  // at 3 (anniversary). Locks in that a resonant winner stays.
  const { result, candidates } = scenario();
  candidates[0].evidence = [{ date: "2015-09-10", fragment: "the long way" }]; // winner anniversary → resonance 3
  candidates[1].evidence = [{ date: "2016-03-01", fragment: "I am tired" }]; // peer NOT resonant (March)
  candidates[1].themes = ["exhaustion"]; // peer favored on affinity alone (+2)
  const d = chooseSeamOverride(
    result,
    candidates,
    { today: "2026-09-03" },
    { whyToday: true, profile: { favored: ["exhaustion"], dismissed: [] } },
  );
  assert.equal(d, null); // winnerPref 3 (resonance) > peer 2 (affinity only)
});

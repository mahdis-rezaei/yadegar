import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAffinityProfile,
  affinityScore,
  type AffinityEntry,
  type AffinityProfile,
} from "./affinity";
import type { SeamCandidate } from "./why-today";

const NOW = new Date("2026-06-03T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const e = (over: Partial<AffinityEntry> = {}): AffinityEntry => ({
  theme: null,
  favorite: false,
  moreOften: false,
  lastOpenedAt: null,
  dismissed: false,
  ...over,
});

// --- buildAffinityProfile ---
test("favorited entries contribute their theme to favored", () => {
  const p = buildAffinityProfile([e({ theme: "Homesickness", favorite: true })], NOW);
  assert.deepEqual(p.favored, ["homesickness"]);
  assert.deepEqual(p.dismissed, []);
});

test("recently-opened counts; long-ago-opened does not", () => {
  const p = buildAffinityProfile(
    [
      e({ theme: "career", lastOpenedAt: daysAgo(10) }),
      e({ theme: "travel", lastOpenedAt: daysAgo(200) }),
    ],
    NOW,
  );
  assert.deepEqual(p.favored, ["career"]);
});

test("'more_often' preference counts as favored", () => {
  const p = buildAffinityProfile([e({ theme: "family", moreOften: true })], NOW);
  assert.deepEqual(p.favored, ["family"]);
});

test("never-resurface entries become dismissed", () => {
  const p = buildAffinityProfile([e({ theme: "grief", dismissed: true })], NOW);
  assert.deepEqual(p.dismissed, ["grief"]);
  assert.deepEqual(p.favored, []);
});

test("a theme both treasured and dismissed is dropped from favored (never punish, never boost)", () => {
  const p = buildAffinityProfile(
    [
      e({ theme: "grief", favorite: true }),
      e({ theme: "grief", dismissed: true }),
    ],
    NOW,
  );
  assert.deepEqual(p.favored, []);
  assert.deepEqual(p.dismissed, ["grief"]);
});

test("'other' catch-all and null themes are not signals", () => {
  const p = buildAffinityProfile(
    [e({ theme: "other", favorite: true }), e({ theme: null, favorite: true })],
    NOW,
  );
  assert.deepEqual(p.favored, []);
  assert.deepEqual(p.dismissed, []);
});

test("favored is deduped + sorted", () => {
  const p = buildAffinityProfile(
    [
      e({ theme: "Travel", favorite: true }),
      e({ theme: "travel", lastOpenedAt: daysAgo(1) }),
      e({ theme: "Career", favorite: true }),
    ],
    NOW,
  );
  assert.deepEqual(p.favored, ["career", "travel"]);
});

// --- affinityScore ---
const cand = (over: Partial<SeamCandidate> = {}): SeamCandidate => ({
  candidate_title: "C",
  function: "",
  description: "",
  evidence: [],
  ...over,
});

const profile = (over: Partial<AffinityProfile> = {}): AffinityProfile => ({
  favored: [],
  dismissed: [],
  ...over,
});

test("favored source-entry theme tag boosts; reason recorded", () => {
  const r = affinityScore(
    cand({ themes: ["homesickness"] }),
    profile({ favored: ["homesickness"] }),
  );
  assert.equal(r.score, 2);
  assert.match(r.reasons[0], /favored/);
});

test("dismissed theme tag soft-penalizes", () => {
  const r = affinityScore(
    cand({ themes: ["grief"] }),
    profile({ dismissed: ["grief"] }),
  );
  assert.equal(r.score, -2);
  assert.match(r.reasons[0], /dismissed/);
});

test("favored + dismissed tags both present nets to zero", () => {
  const r = affinityScore(
    cand({ themes: ["homesickness", "grief"] }),
    profile({ favored: ["homesickness"], dismissed: ["grief"] }),
  );
  assert.equal(r.score, 0);
});

test("exact-tag matching: a gloss word is NOT a match without the tag", () => {
  // The candidate's gloss mentions "career" but its source-entry tag is "travel"
  // — tag matching must NOT fire on the gloss coincidence.
  const r = affinityScore(
    cand({ function: "a career thought on the road", themes: ["travel"] }),
    profile({ favored: ["career"] }),
  );
  assert.equal(r.score, 0);
});

test("no tag match → zero, no reasons", () => {
  const r = affinityScore(cand({ themes: ["solitude"] }), profile({ favored: ["career"] }));
  assert.equal(r.score, 0);
  assert.deepEqual(r.reasons, []);
});

test("no themes on candidate → zero", () => {
  assert.equal(affinityScore(cand({}), profile({ favored: ["career"] })).score, 0);
});

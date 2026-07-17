import { test } from "node:test";
import assert from "node:assert/strict";
import { capPoolByTimeSpread } from "./diversity";

test("returns the pool unchanged when at or under the cap", () => {
  const p = [1, 2, 3];
  assert.equal(capPoolByTimeSpread(p, 5), p);
  assert.equal(capPoolByTimeSpread(p, 3), p);
});

test("caps to the requested size", () => {
  const p = Array.from({ length: 445 }, (_, i) => i);
  const out = capPoolByTimeSpread(p, 50);
  assert.ok(out.length <= 50);
  assert.ok(out.length >= 48); // rounding may dedupe a couple
});

test("always keeps the oldest and newest (cross-time coverage)", () => {
  const p = Array.from({ length: 445 }, (_, i) => i); // 0..444, date-sorted
  const out = capPoolByTimeSpread(p, 50);
  assert.equal(out[0], 0);
  assert.equal(out[out.length - 1], 444);
});

test("samples are spread, not clustered at one end", () => {
  const p = Array.from({ length: 400 }, (_, i) => i);
  const out = capPoolByTimeSpread(p, 40);
  // midpoint of the sample should be near the midpoint of the range
  const mid = out[Math.floor(out.length / 2)];
  assert.ok(mid > 150 && mid < 250, `midpoint ${mid} not centered`);
});

test("preserves ascending order", () => {
  const p = Array.from({ length: 100 }, (_, i) => i);
  const out = capPoolByTimeSpread(p, 17);
  for (let i = 1; i < out.length; i++) assert.ok(out[i] > out[i - 1]);
});

test("deterministic: same input → same output", () => {
  const p = Array.from({ length: 300 }, (_, i) => i);
  assert.deepEqual(capPoolByTimeSpread(p, 25), capPoolByTimeSpread(p, 25));
});

test("cap of 1 returns the most recent", () => {
  assert.deepEqual(capPoolByTimeSpread([10, 20, 30], 1), [30]);
});

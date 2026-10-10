// node --test tools/biome/runtime/adaptive-res.test.mjs
// Simulated phones (vsync 60 Hz, jitter, load hitches during warm-up) against the adaptive render-ratio controller.
import test from "node:test";
import assert from "node:assert/strict";
import { createAdaptiveRes } from "./adaptive-res.mjs";

function sim(fpsAt, { secs = 600, loadHitches = true, rareHitch = 0, seed = 7 } = {}) {
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const c = createAdaptiveRes({ cap: 2 });
  let t = 0, ready = false, minR = 9; const readyAt = 2500, log = [];
  while (t < secs * 1000) {
    if (!ready && t >= readyAt) { c.markReady(t); ready = true; }
    let dt = Math.max(1000 / 60, 1000 / fpsAt(c.level.ratio, c.level.detail, t)) * (0.9 + 0.2 * rnd());
    if (dt < 1000 / 60) dt = 1000 / 60;
    if (loadHitches && t < readyAt + 9000) { dt *= 1.6; if (rnd() < 0.04) dt += 150 + 600 * rnd(); }   // compiles, uploads, LOD0 fetches
    if (rareHitch && rnd() < 1 / rareHitch) dt += 300;
    t += dt;
    if (c.frame(dt, t)) log.push([Math.round(t / 1000), c.level.ratio, c.level.detail]);
    minR = Math.min(minR, c.level.ratio);
  }
  return { c, minR, log };
}
const pix = (r) => r * r;

test("ladder: cap .. floor in 0.125 steps, detail-reach rung at 1.75 before any lower ratio", () => {
  const c = createAdaptiveRes({ cap: 2 });
  assert.deepEqual(c.ladder.map((l) => l.ratio), [2, 1.875, 1.75, 1.75, 1.625, 1.5, 1.375, 1.25]);
  assert.deepEqual(c.ladder.map((l) => l.detail), [true, true, true, false, false, false, false, false]);
});
test("starts at the cap and ignores load hitches (SmiR 11:00 '1.25x from the very start')", () => {
  for (const f of [() => 60, () => 49, () => 47]) { const r = sim(f); assert.equal(r.minR, 2); assert.equal(r.c.changes, 0); }
});
test("never drops while the median is >= 44 fps, even with PiP-like 49 fps or rare 300 ms stalls", () => {
  assert.equal(sim((r) => 49 * 4 / pix(r)).c.changes, 0);
  assert.equal(sim(() => 52, { rareHitch: 400 }).c.changes, 0);
});
test("drops when genuinely slow, one rung at a time, and settles", () => {
  const r = sim((r) => 35 * 4 / pix(r));
  assert.equal(r.c.level.ratio, 1.75); assert.ok(r.c.changes <= 3);
});
test("thermal drop late in the session goes down once", () => {
  const r = sim((r, d, t) => (t < 120000 ? 58 : 40) * 4 / pix(r));
  assert.equal(r.c.level.ratio, 1.875); assert.equal(r.c.changes, 1);
});
test("cannot oscillate: a rung that fails 3 times stays closed (trap: 43 fps at 2, 61 at 1.875)", () => {
  const r = sim((x) => (x >= 2 ? 43 : 61), { secs: 1800 });
  assert.equal(r.c.level.ratio, 1.875);
  assert.ok(r.c.changes <= 5, `changes ${r.c.changes}`);
  const late = r.log.filter(([t]) => t > 200);
  assert.equal(late.length, 0, "no changes after the rung is closed");
});
test("a uniformly slow device (every frame > 250 ms) still adapts: hitch = outlier only", () => {
  const r = sim(() => 3, { loadHitches: false, secs: 120 });
  assert.equal(r.c.level.ratio, 1.25);
});

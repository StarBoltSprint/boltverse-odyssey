// node --test tools/biome/runtime/adaptive-res.test.mjs
// Simulated phones (vsync 60 Hz, jitter, load hitches during warm-up) against the quality-first render-ratio controller
// (SmiR 2026-10-10 14:02: ratio 2 at full quality by default, even at 22-25 fps; below 2 only as an emergency floor).
import test from "node:test";
import assert from "node:assert/strict";
import { createAdaptiveRes } from "./adaptive-res.mjs";

function sim(fpsAt, { secs = 600, loadHitches = true, rareHitch = 0, seed = 7 } = {}) {
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const c = createAdaptiveRes({ cap: 2 });
  let t = 0, ready = false, minR = 9, detailOff = false; const readyAt = 2500, log = [];
  while (t < secs * 1000) {
    if (!ready && t >= readyAt) { c.markReady(t); ready = true; }
    let dt = Math.max(1000 / 60, 1000 / fpsAt(c.level.ratio, t)) * (0.9 + 0.2 * rnd());
    if (dt < 1000 / 60) dt = 1000 / 60;
    if (loadHitches && t < readyAt + 9000) { dt *= 1.6; if (rnd() < 0.04) dt += 150 + 600 * rnd(); }   // compiles, uploads, LOD0 fetches
    if (rareHitch && rnd() < 1 / rareHitch) dt += 300;
    t += dt;
    if (c.frame(dt, t)) log.push([Math.round(t / 1000), c.level.ratio]);
    minR = Math.min(minR, c.level.ratio); if (!c.level.detail) detailOff = true;
  }
  return { c, minR, log, detailOff };
}
const pix = (r) => r * r;

test("no level ever turns the detail layer off; canDropDetail is false (the gate reads it)", () => {
  const c = createAdaptiveRes({ cap: 2, hasDetail: true });
  assert.equal(c.canDropDetail, false);
  assert.ok(c.ladder.every((l) => l.detail === true));
  assert.deepEqual(c.ladder.map((l) => l.ratio), [2, 1.75, 1.5, 1.25]);
  assert.equal(sim(() => 4, { loadHitches: false, secs: 120 }).detailOff, false);
});
test("stays at ratio 2 at 22-25 fps (the S20 FE at full quality) and with load hitches", () => {
  for (const f of [() => 60, () => 25, () => 22, () => 16]) { const r = sim(f); assert.equal(r.minR, 2); assert.equal(r.c.changes, 0); }
});
test("rare 300 ms stalls at 20 fps never trigger the emergency floor", () => {
  assert.equal(sim(() => 20, { rareHitch: 30 }).c.changes, 0);
});
test("emergency: under 15 fps for > 5 s drops one rung, not before", () => {
  const r = sim((x, t) => (t > 60000 && t < 66000 ? 10 : 24) * 4 / pix(x), { loadHitches: false, secs: 120 });
  assert.equal(r.log.filter(([, x]) => x < 2).length, 1, JSON.stringify(r.log));
  assert.equal(r.c.level.ratio, 2, "back to 2 once the load is gone");
  const short = sim((x, t) => (t > 60000 && t < 64000 ? 10 : 24), { loadHitches: false, secs: 120 });
  assert.equal(short.c.changes, 0, "4 s under 15 fps is not an emergency");
});
test("steps back to 2 as soon as it is predicted to hold 18 fps", () => {
  const r = sim((x, t) => (t < 90000 ? 8 : 20) * 4 / pix(x), { loadHitches: false, secs: 150 });
  const back = r.log.find(([t, x]) => t >= 90 && x === 2);
  assert.ok(back && back[0] <= 96, JSON.stringify(r.log));
});
test("a phone that really cannot hold 15 fps settles at the highest rung that does, without oscillating", () => {
  const r = sim((x) => 12 * 4 / pix(x), { loadHitches: false, secs: 900 });   // 12 fps at 2, 15.7 at 1.75, 21 at 1.5
  assert.equal(r.c.level.ratio, 1.75);
  assert.ok(r.c.changes <= 12, `changes ${r.c.changes}`);
});
test("a uniformly slow device (every frame > 250 ms) still reaches the floor: hitch = outlier only", () => {
  assert.equal(sim(() => 3, { loadHitches: false, secs: 120 }).c.level.ratio, 1.25);
});

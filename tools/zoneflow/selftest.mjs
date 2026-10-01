/**
 * Zone handoff selftest. Synthetic fixture only. Not Imagine.
 *   node tools/zoneflow/selftest.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BOLT_GALLOP,
  BOLT_IDLE,
  HITCH_MS,
  boltClip,
  createFlow,
  fadeWeights,
  isBlackFrame,
  judgeTransition,
  playbackRate,
} from "../../biome/scripts/zone-flow/zoneFlow.mjs";

assert.equal(playbackRate(0, 4), 0);
assert.equal(playbackRate(0.04, 4), 0);
assert.equal(playbackRate(2, 4), 0.5);
assert.equal(playbackRate(4, 0), 0);
assert.equal(boltClip(0), BOLT_IDLE);
assert.equal(boltClip(3), BOLT_GALLOP);
assert.equal(BOLT_GALLOP, "lock/bolt-gallop-cycle.mp4");

for (let i = 1; i < 10; i += 1) {
  const w = fadeWeights(i / 10);
  assert.ok(w.current > 0 && w.next > 0);
  assert.ok(Math.abs(w.current + w.next - 1) < 1e-9);
}
assert.equal(fadeWeights(0).current, 1);
assert.equal(fadeWeights(1).next, 1);
assert.ok(!(fadeWeights(0).current === 0 && fadeWeights(0).next === 0));

const world = JSON.parse(readFileSync("tools/zoneflow/fixture/world.json", "utf8"));
const zones = {};
for (const [id, path] of Object.entries(world.zones)) {
  zones[id] = JSON.parse(readFileSync(path, "utf8"));
}

function walk(flow) {
  const samples = [];
  const step = (pose) => {
    const sample = flow.step({ hitchMs: 16, black: false, ...pose });
    samples.push(sample);
    assert.ok(!(sample.weights.current === 0 && sample.weights.next === 0));
    const worldPlates = sample.plates.filter((p) => p.kind !== "bolt");
    const sum = worldPlates.reduce((n, p) => n + p.opacity, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
    assert.ok(worldPlates.every((p) => p.opacity === 0 || p.src));
    return sample;
  };
  return { step, samples };
}

const flow = createFlow(world, { zones });
const run = walk(flow);

let s = run.step({ x: 0, z: 0, heading: 0, speed: 0, dt: 0.016 });
assert.equal(s.mode, "zone");
assert.equal(s.zoneId, "clearing-a");
assert.equal(s.bolt, "IDLE");
assert.equal(s.clip, BOLT_IDLE);
assert.equal(s.rate, 0);
assert.deepEqual(s.loaded, ["clearing-a"]);

s = run.step({ x: 0, z: 11, heading: 0, speed: 4, dt: 0.016 });
assert.equal(s.mode, "zone");
assert.ok(s.loaded.includes("path-ab"));
assert.ok(s.loaded.includes("clearing-b"));

s = run.step({ x: 0, z: 17, heading: 0, speed: 4, dt: 0.016 });
assert.equal(s.mode, "fade");

let sawBoth = false;
for (let i = 0; i < 30; i += 1) {
  s = run.step({ x: 0, z: 17, heading: 0, speed: 4, dt: 0.02 });
  if (s.mode === "fade" && s.weights.current > 0 && s.weights.next > 0) sawBoth = true;
  if (s.mode === "corridor") break;
}
assert.equal(sawBoth, true);
assert.equal(s.mode, "corridor");
assert.equal(s.rate, 1);
assert.equal(s.bolt, "GALLOP");
assert.equal(s.clip, BOLT_GALLOP);
assert.equal(flow.media()["clearing-a"].live, false);
assert.equal(flow.media()["clearing-a"].src, "");
assert.ok(s.unloaded.includes("clearing-a"));

const stoppedAt = s.along;
s = run.step({ x: 0, z: 17, heading: 0, speed: 0, dt: 0.5 });
assert.equal(s.mode, "corridor");
assert.equal(s.rate, 0);
assert.equal(s.bolt, "IDLE");
assert.equal(s.clip, BOLT_IDLE);
assert.equal(s.along, stoppedAt);

let arrived = false;
for (let i = 0; i < 40; i += 1) {
  s = run.step({ x: 0, z: 17, heading: 0, speed: 4, dt: 0.25 });
  if (s.mode === "zone" && s.zoneId === "clearing-b") {
    arrived = true;
    break;
  }
}
assert.equal(arrived, true, `ended in ${s.mode} ${s.zoneId} along ${s.along}`);
assert.equal(flow.media()["path-ab"].live, false);
assert.equal(flow.media()["path-ab"].src, "");
assert.ok(s.plates.some((p) => p.id === "clearing-b" && p.opacity === 1));

const judged = judgeTransition(run.samples.map((item) => ({ black: item.black, hitchMs: item.hitchMs })));
assert.equal(judged.black.ok, true);
assert.equal(judged.hitch.ok, true);
assert.equal(judgeTransition([{ black: false, hitchMs: 150 }]).hitch.ok, false);
assert.equal(judgeTransition([{ black: false, hitchMs: 150 }]).hitch.limitMs, HITCH_MS);
assert.equal(judgeTransition([{ hitchMs: 16 }]).black.ok, false);

const dark = new Uint8Array(64);
const bright = new Uint8Array(64);
bright.fill(200);
assert.equal(isBlackFrame(dark), true);
assert.equal(isBlackFrame(bright), false);
assert.equal(judgeTransition([{ rgba: dark, hitchMs: 16 }]).black.ok, false);
assert.equal(judgeTransition([]), null);

const heldFlow = createFlow(world, { zones, ready: (id) => id === "clearing-a" });
const held = heldFlow.step({ x: 0, z: 17, heading: 0, speed: 4, dt: 0.016, hitchMs: 16, black: false });
assert.equal(held.held, true);
assert.equal(held.mode, "zone");
assert.equal(held.zoneId, "clearing-a");
assert.equal(held.weights.current, 1);
assert.equal(held.cleared.length, 0);
assert.equal(heldFlow.media()["clearing-a"].src.includes("clearing-a"), true);

console.log("PASS zoneflow selftest");

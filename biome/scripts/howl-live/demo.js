#!/usr/bin/env node
/** node biome/scripts/howl-live/demo.js */
import {
  HOWL,
  howlFireSec,
  howlPlayRate,
  howlFxBeam,
  howlStep,
  pickHowlLane,
} from "./howlLive.js";

function assert(name, cond) {
  if (!cond) {
    console.error("FAIL", name);
    process.exit(1);
  }
  console.log("ok", name);
}

const ch = 1280;
const near = howlFireSec(ch * 0.2, ch);
const far = howlFireSec(ch * 0.9, ch);
assert("fireSec clamp lo", near >= 0.32 && near <= 0.7);
assert("fireSec clamp hi", far >= near && far <= 0.7);
assert("playRate > 1 (KEEP is longer than the trip)", howlPlayRate(near) > 1);

const beam = howlFxBeam(360, 900, 360, 400, 180, 220);
assert("tip is above mouth (toward the rock)", beam.by < 900 && beam.dy < 900);
assert("tip inset — not past the rock y=400", Math.min(beam.by, beam.dy) > 400 - 1);
assert("widens toward the rock", beam.t1 > beam.t0);

const s0 = { howlT: 0, fireSec: 0 };
const a = howlStep(s0, 0.01, { x: 360, y: 900 }, { x: 360, y: 500 }, 160, 220, ch);
assert("first step starts the beam", a.howlT > 0 && a.howlT < 1 && !a.cut);
const s1 = { howlT: 0.99, fireSec: a.fireSec };
const b = howlStep(s1, 0.05, { x: 360, y: 900 }, { x: 360, y: 500 }, 160, 220, ch);
assert("contact cuts even if KEEP remains", b.cut === true && b.howlT === -1 && b.hit === true);
assert("arrive is 1", HOWL.arrive === 1);

assert("2-lane rail A → GPU shares, never a 3rd wall", pickHowlLane([-1, 1], [], 0.2) !== 0 || pickHowlLane([-1, 1], [], 0.8) !== 0);
assert("empty plate → a free lane", pickHowlLane([], [], 0.1) === -1 || pickHowlLane([], [], 0.1) === 0 || pickHowlLane([], [], 0.1) === 1);

console.log(
  JSON.stringify(
    {
      near: +near.toFixed(3),
      far: +far.toFixed(3),
      playRateNear: +howlPlayRate(near).toFixed(2),
      t0: +beam.t0.toFixed(1),
      t1: +beam.t1.toFixed(1),
      inset: +beam.inset.toFixed(1),
    },
    null,
    2,
  ),
);

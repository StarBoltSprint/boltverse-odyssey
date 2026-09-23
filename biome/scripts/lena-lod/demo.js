#!/usr/bin/env node
/** node biome/scripts/lena-lod/demo.js */
import { howlPose } from "../howl-live/howlLive.js";
import {
  LENA,
  RAIL,
  PLATE_ZONES,
  objectBand,
  variantOf,
  preloadOf,
  worldLod,
  bibFile,
  lenaResolve,
  lenaState,
  lenaFrame,
} from "./lenaLod.js";

function assert(name, cond) {
  if (!cond) {
    console.error("FAIL", name);
    process.exit(1);
  }
  console.log("ok", name);
}

assert("densify is not tiled", RAIL.tileDensify === false && RAIL.densify === "A" && RAIL.zones === "B");
assert("far band", objectBand(0.05) === "far" && objectBand(LENA.farMax - 0.001) === "far");
assert("mid band", objectBand(LENA.farMax) === "mid" && objectBand(LENA.midMax - 0.001) === "mid");
assert("near band", objectBand(LENA.midMax) === "near" && objectBand(1.2) === "near");
assert("variants", variantOf("far") === "generator" && variantOf("mid") === "detail" && variantOf("near") === "rock");

const early = preloadOf(0.1);
assert("far warms detail before the swap", early.show === "generator" && early.warm === "detail" && early.warmK === 0);
const edge = preloadOf(LENA.farMax - LENA.preloadLead * 0.5);
assert("crossfade opens inside the lead", edge.warm === "detail" && edge.warmK > 0 && edge.warmK < 1);
const full = preloadOf(0.9);
assert("near is the full rock", full.show === "rock" && full.warm === null && full.warmK === 0);

assert("world lod earth", worldLod(0.1) === "earth");
assert("world lod near space", worldLod(0.5) === "near-space");
assert("world lod deep space", worldLod(0.9) === "deep-space");

const bib = bibFile("earth", "quartz", "generator");
assert("bib path", bib === "biome/fx/lena/earth/quartz-generator.mp4");
let threw = false;
try {
  bibFile("earth", "../bolt", "rock");
} catch {
  threw = true;
}
assert("bib rejects a path noun", threw);

const sample = lenaResolve({ t: 0.9, climbT: 0.1, noun: "quartz" });
assert("resolve near rock on earth", sample.variant === "rock" && sample.world === "earth" && sample.contact === true);
assert("resolve does not tile", sample.tileDensify === false && sample.bib.endsWith("quartz-rock.mp4"));
assert("howl file is the KEEP path", sample.howlKeep === "biome/fx/howl/howl-attack.mp4");

const ctx = {
  now: 0,
  climbT: 0.2,
  cw: 768,
  ch: 1168,
  pawY: 980,
  destH0: 200,
  blocked: [],
  plate: [],
  nouns: ["quartz"],
};
let frame = lenaFrame(lenaState(3), 0.016, ctx);
assert("spawn exists", frame.spawns.length === 1 && frame.tileDensify === false);
const born = frame.spawns[0];
assert("spawn starts far, in front of the paws", born.band === "far" && born.pose.ground.y < ctx.pawY);
assert("spawn bib is generator", born.bib.endsWith("/quartz-generator.mp4") && born.warm === "detail");

const id = born.id;
const seen = [born.band];
let state = frame.state;
let now = 0;
for (let i = 0; i < 500 && seen[seen.length - 1] !== "near"; i++) {
  now += 0.05;
  frame = lenaFrame(state, 0.05, { ...ctx, now });
  state = frame.state;
  const live = frame.spawns.find((s) => s.id === id);
  if (!live) break;
  if (live.band !== seen[seen.length - 1]) seen.push(live.band);
}
assert("bands climb far → mid → near", seen.join(",") === "far,mid,near");
const arrived = frame.spawns.find((s) => s.id === id);
assert("arrival is the rock bib", arrived && arrived.variant === "rock" && arrived.contact === true);

const shared = lenaFrame(lenaState(9), 0.016, {
  ...ctx,
  blocked: [-1, 1],
  plate: [],
});
assert("two rail-A lanes stay shared, free corridor stays free", shared.spawns.length === 1 && shared.spawns[0].lane !== 0 && shared.spawns[0].plateZone === "road");

const side = lenaFrame(lenaState(3), 0.016, { ...ctx, plateZone: "sideL" });
const sideBorn = side.spawns[0];
const leftLane = howlPose(-1, sideBorn.z, ctx.cw, ctx.ch, ctx.destH0, ctx.pawY);
assert("plate zones name the road and both shoulders", PLATE_ZONES.join(",") === "road,sideL,sideR");
assert(
  "décor LOD may spawn on the left shoulder",
  side.sides === "gpu" &&
    side.sideClutter === false &&
    sideBorn.plateZone === "sideL" &&
    sideBorn.lane === null &&
    sideBorn.howlable === false &&
    sideBorn.gradeFromPlate === true &&
    sideBorn.pose.ground.x < leftLane.ground.x,
);
let badZone = false;
try {
  lenaFrame(lenaState(1), 0.016, { ...ctx, plateZone: "shoulder" });
} catch {
  badZone = true;
}
assert("an unnamed shoulder is not a zone", badZone);

console.log(
  JSON.stringify(
    {
      born: { t: +born.t.toFixed(3), band: born.band, bib: born.bib },
      seen,
      world: frame.world,
    },
    null,
    2,
  ),
);

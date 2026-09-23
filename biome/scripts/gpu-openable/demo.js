#!/usr/bin/env node
/** node biome/scripts/gpu-openable/demo.js */
import { howlPose } from "../howl-live/howlLive.js";
import { objectBand } from "../lena-lod/lenaLod.js";
import { LIGHT, lightLayerState, lightLayerFrame, assertLightNative } from "../gpu-light/gpuLight.js";
import {
  OPENABLE,
  KINDS,
  RAIL,
  GPU,
  openableBib,
  contentBib,
  openableState,
  openableFrame,
  openableHit,
  openableOpen,
  openableClose,
  assertOpenableNative,
} from "./gpuOpenable.js";

function assert(name, cond) {
  if (!cond) {
    console.error("FAIL", name);
    process.exit(1);
  }
  console.log("ok", name);
}

const ctx = { cw: 768, ch: 1168, pawY: 980, destH0: 180 };

assert("kinds are openable props", KINDS.join(",") === "door,chest,generator,hatch");
assert("densify is not tiled", RAIL.tileDensify === false && RAIL.coversPlate === false && RAIL.densify === "A");
assert("composite is over densify", GPU.composite === "over-densify" && GPU.bakeIntoDensify === false && GPU.raytrace === false);
assert(
  "state bibs",
  openableBib("chest", "quartz", "closed") === "biome/fx/openable/chest/quartz-closed.mp4" &&
    openableBib("hatch", "crystal", "open").endsWith("/crystal-open.mp4") &&
    openableBib("door", "rift", "transition").endsWith("-transition.mp4"),
);
assert("content bib", contentBib("chest", "shard") === "biome/fx/openable/chest/shard-content.mp4");

let threw = false;
try {
  openableBib("chest", "../bolt", "open");
} catch {
  threw = true;
}
assert("bib rejects a path noun", threw);
threw = false;
try {
  openableBib("crate", "quartz", "closed");
} catch {
  threw = true;
}
assert("bib rejects an unknown kind", threw);

const closed = openableFrame(
  openableState([{ id: "chest-1", kind: "chest", noun: "quartz", lane: "C", z: 0.08, content: "shard" }]),
  0,
  ctx,
);
const chest = closed.objects[0];
assert("starts closed", chest.phase === "closed" && chest.progress === 0 && chest.bib.endsWith("-closed.mp4") && chest.content === null);
assert("native while closed", assertOpenableNative(closed).length === 0);
assert("not painted open", closed.paintedOpen === false && closed.gpu === true && closed.hud === false && closed.bakeIntoDensify === false);
assert("near band is hittable", chest.band === "near" && chest.hittable === true && chest.contact === true);
const shared = howlPose(chest.lane, chest.z, ctx.cw, ctx.ch, ctx.destH0, ctx.pawY);
assert("same cone and ground as Howl", shared.ground.x === chest.pose.ground.x && shared.t === chest.pose.t);
assert("same band as Lena", chest.band === objectBand(chest.pose.t));
assert("hit on the prop", openableHit(closed, chest.pose.ground.x, chest.pose.ground.y) === "chest-1");
assert("miss outside the prop", openableHit(closed, 0, 0) === null);

const far = openableFrame(
  openableState([{ id: "door-far", kind: "door", noun: "rift", lane: "L", z: 0.92 }]),
  0,
  ctx,
);
assert("far band is visible and not hittable", far.objects[0].band === "far" && far.objects[0].hittable === false);
assert(
  "a far prop does not take the hit",
  openableHit(far, far.objects[0].pose.ground.x, far.objects[0].pose.ground.y) === null,
);

const opening = openableFrame(openableOpen(closed.state, "chest-1"), OPENABLE.animSec / 2, ctx);
const mid = opening.objects[0];
assert("open anim reads the transition bib", mid.phase === "opening" && mid.progress > 0 && mid.progress < 1 && mid.bib.endsWith("-transition.mp4"));
assert("content waits until open", mid.content === null);
assert("transition frame is native", assertOpenableNative(opening).length === 0);

const opened = openableFrame(opening.state, OPENABLE.animSec, ctx);
const done = opened.objects[0];
assert("anim completes on the open bib", done.phase === "open" && done.progress === 1 && done.bib.endsWith("-open.mp4"));
assert("content spawns as its own keyed bib", done.content && done.content.bib.endsWith("-content.mp4") && done.content.bakeIntoDensify === false && done.content.visible === true);
assert("open frame is native", assertOpenableNative(opened).length === 0);

const closing = openableFrame(openableClose(opened.state, "chest-1"), OPENABLE.animSec / 2, ctx);
assert("close reads the transition bib", closing.objects[0].phase === "closing" && closing.objects[0].bib.endsWith("-transition.mp4") && closing.objects[0].content === null);
const shut = openableFrame(closing.state, OPENABLE.animSec, ctx);
assert("close returns to the closed bib", shut.objects[0].phase === "closed" && shut.objects[0].bib.endsWith("-closed.mp4") && shut.objects[0].content === null);

const gen = openableFrame(
  openableState([{ id: "gen-1", kind: "generator", noun: "core", lane: "R", z: 0.25, lightId: "beam-core" }]),
  0,
  ctx,
);
assert("generator starts with the light off", gen.lightCues.length === 1 && gen.lightCues[0].on === false && gen.lightCues[0].intensity === 0);
const genOpen = openableFrame(openableOpen(gen.state, "gen-1"), OPENABLE.animSec, ctx);
const cue = genOpen.lightCues[0];
assert("an open generator cues the beam", genOpen.objects[0].phase === "open" && cue.on === true && cue.intensity === 1);
const lamp = lightLayerFrame(
  lightLayerState([{ id: "beam-core", kind: "beam", noun: "core", lane: "R", z: 0.25, on: false }]),
  LIGHT.fadeSec,
  { ...ctx, set: [cue] },
);
assert("the cue drives a light layer, not densify", lamp.layers[0].intensity === 1 && lamp.layers[0].kind === "beam" && assertLightNative(lamp).length === 0 && lamp.bakeIntoDensify === false);

assert("a HUD frame is a FAIL", assertOpenableNative({ ...opened, hud: true }).includes("HUD"));
assert("painting the open state into densify is a FAIL", assertOpenableNative({ ...opened, bakeIntoDensify: true }).includes("baked into densify"));
assert("skipping the GPU is a FAIL", assertOpenableNative({ ...opened, gpu: false }).includes("GPU"));
assert("a painted-open plate is a FAIL", assertOpenableNative({ ...opened, paintedOpen: true }).includes("painted open"));
assert("raytrace is a FAIL", assertOpenableNative({ ...opened, raytrace: true }).includes("raytrace"));
assert(
  "open stays fake-interactive on the baked look",
  opened.rtLook === "baked-imagine" && opened.fakeInteractive === true && opened.raytrace === false && opened.trueRt === "ue-hold" && opened.bounces === 0,
);
assert("claiming Imagine real-time raytracing is a FAIL", assertOpenableNative({ ...opened, realtimeImagine: true }).includes("real-time raytracing"));

console.log(
  JSON.stringify(
    {
      closed: chest.bib,
      open: done.bib,
      content: done.content.bib,
      light: lamp.layers[0].bib,
      band: chest.band,
    },
    null,
    2,
  ),
);

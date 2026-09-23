#!/usr/bin/env node
/** node biome/scripts/gpu-light/demo.js */
import { howlPose } from "../howl-live/howlLive.js";
import { objectBand } from "../lena-lod/lenaLod.js";
import {
  LIGHT,
  KINDS,
  RAIL,
  GPU,
  lightBib,
  parseTint,
  fadeIntensity,
  lightLayerState,
  lightLayerFrame,
  assertLightNative,
} from "./gpuLight.js";

function assert(name, cond) {
  if (!cond) {
    console.error("FAIL", name);
    process.exit(1);
  }
  console.log("ok", name);
}

const ctx = { cw: 768, ch: 1168, pawY: 980, destH0: 180 };

assert("kinds are light-only plates", KINDS.join(",") === "beam,glow,neon,flash");
assert("densify is not tiled", RAIL.tileDensify === false && RAIL.densify === "A" && RAIL.zones === "B");
assert("composite is over densify", GPU.composite === "over-densify" && GPU.bakeIntoDensify === false && GPU.raytrace === false);
assert("bib is a light plate", lightBib("neon", "lane") === "biome/fx/light/neon/lane.mp4");
assert("beam bib", lightBib("beam", "generator") === "biome/fx/light/beam/generator.mp4");

let threw = false;
try {
  lightBib("neon", "../road");
} catch {
  threw = true;
}
assert("bib rejects a path noun", threw);
threw = false;
try {
  lightBib("sun", "lane");
} catch {
  threw = true;
}
assert("bib rejects a non-light kind", threw);

assert("fade holds on dt 0", fadeIntensity(0.2, 1, 0, LIGHT.fadeSec) === 0.2);
assert("full fade completes in fadeSec", fadeIntensity(0, 1, LIGHT.fadeSec, LIGHT.fadeSec) === 1);
assert("half fade travels half", Math.abs(fadeIntensity(0, 1, LIGHT.fadeSec / 2, LIGHT.fadeSec) - 0.5) < 1e-9);
assert("tint hex", Math.abs(parseTint("#22e6ff").g - 0xe6 / 255) < 1e-9 && parseTint("#22e6ff").b === 1 && parseTint("#22e6ff").r < 0.2);

const off = lightLayerFrame(
  lightLayerState([{ id: "neon-c", kind: "neon", noun: "lane", lane: "C", z: 0.25, on: false, intensity: 1 }]),
  0,
  ctx,
);
assert("a declared lamp starts dark", off.layers.length === 1 && off.layers[0].intensity === 0 && off.layers[0].draw === false);
assert("native while dark", assertLightNative(off).length === 0);
assert("ambience stays on densify", off.ambience === "densify" && off.bakeIntoDensify === false && off.gpu === true && off.hud === false);
assert("not raytracing", off.raytrace === false && off.onlyLight === true && off.key === "black");
assert("does not tile", off.tileDensify === false && off.coversPlate === false && off.clock === "densify" && off.lanes === 3);

const half = lightLayerFrame(off.state, LIGHT.fadeSec / 2, { ...ctx, set: [{ id: "neon-c", on: true }] });
assert("switch-on fades, it does not pop", Math.abs(half.layers[0].intensity - 0.5) < 1e-9 && half.layers[0].on === true && half.layers[0].draw === true);
const full = lightLayerFrame(half.state, LIGHT.fadeSec / 2, ctx);
assert("fade completes at 1", Math.abs(full.layers[0].intensity - 1) < 1e-9 && full.layers[0].bib === "biome/fx/light/neon/lane.mp4");

const tinted = lightLayerFrame(full.state, 0, { ...ctx, set: [{ id: "neon-c", tint: "#22e6ff", intensity: 4 }] });
assert("tint sticks and intensity clamps", tinted.layers[0].tint.b > 0.8 && tinted.layers[0].intensityTarget === 1 && tinted.layers[0].intensity === 1);

const dim = lightLayerFrame(tinted.state, LIGHT.fadeSec / 2, { ...ctx, set: [{ id: "neon-c", on: false }] });
assert("switch-off fades toward 0", Math.abs(dim.layers[0].intensity - 0.5) < 1e-9 && dim.layers[0].on === false);

const live = full.layers[0];
const shared = howlPose(live.lane, live.z, ctx.cw, ctx.ch, ctx.destH0, ctx.pawY);
assert("same cone and ground as Howl", shared.ground.x === live.pose.ground.x && shared.ground.y === live.pose.ground.y && shared.t === live.pose.t);
assert("same band as Lena", live.band === objectBand(live.pose.t) && live.gradeFromPlate === true);
assert("quad is one lane, not the plate", live.pose.dest.w < ctx.cw * 0.5);
assert("contact only in the near band", live.contact === (live.band === "near"));

assert("a HUD frame is a FAIL", assertLightNative({ ...full, hud: true }).includes("HUD"));
assert("painting the beam into densify is a FAIL", assertLightNative({ ...full, bakeIntoDensify: true }).includes("baked into densify"));
assert("skipping the GPU is a FAIL", assertLightNative({ ...full, gpu: false }).includes("GPU"));
assert("raytrace is a FAIL", assertLightNative({ ...full, raytrace: true }).includes("raytrace"));
assert("a graded-off light is a FAIL", assertLightNative({ ...full, gradeFromPlate: false }).includes("gradeFromPlate"));

console.log(
  JSON.stringify(
    {
      bib: live.bib,
      intensity: +full.layers[0].intensity.toFixed(3),
      band: live.band,
      cone: full.cone,
    },
    null,
    2,
  ),
);

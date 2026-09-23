/**
 * GPU light layers — law 38.
 *
 * Imagine cooks a plate that is ONLY light (beam / glow / neon / flash)
 * on keyed black or transparent. This module never writes those pixels
 * into densify. Densify keeps base ambience (law 31).
 *
 * GPU owns intensity 0→1, tint, on/off, cone position, fade.
 * Placement is howlPose. Bands are Lena objectBand.
 *
 * Pack RT is not a raytracer. Imagine bakes a path-traced LOOK into
 * densify and bib pixels (rtLook "baked-imagine"). When intensity moves,
 * glossOverlay is a keyed quad graded from the plate (fakeInteractive).
 * bounces stay 0. True RT is the UE rail, HOLD. raytrace stays false.
 *
 *   import { lightLayerState, lightLayerFrame, lightBib, assertLightNative } from "./gpuLight.js";
 *
 * Copy into Live next to howlLive.js. Draw each layer whose `draw` is true
 * as a keyed quad on pose.dest, multiplied by intensity and tint.
 * gradeFromPlate. Composite OVER densify. Do not bake the beam into Video A.
 */
import { howlPose, PLATE_ZONES, normalizePlateZone, poseLane } from "../howl-live/howlLive.js";
import { objectBand } from "../lena-lod/lenaLod.js";

export { PLATE_ZONES, normalizePlateZone, poseLane };

export const LIGHT = {
  /** Seconds for intensity to travel the full 0→1 (or 1→0). */
  fadeSec: 0.35,
};

export const KINDS = ["beam", "glow", "neon", "flash"];

export const RAIL = {
  densify: "A",
  zones: "B",
  tileDensify: false,
  coversPlate: false,
};

/**
 * Honest Pack RT. Not a raytracing API.
 * rtLook: Imagine densify and bibs already look path-traced (pixels).
 * fakeInteractive: light layers + gloss overlays mimic a response. Not bounces.
 * trueRt: the UE rail. HOLD. Do not cook it here.
 */
export const RT = {
  rtLook: "baked-imagine",
  fakeInteractive: true,
  raytrace: false,
  trueRt: "ue-hold",
  bounces: 0,
  gloss: "gradeFromPlate",
};

/**
 * Densify shoulders stay relatively empty. GPU fills them.
 * Paste SIDES_PHRASE into the Video A cook. Side clutter in the plate is FAIL.
 */
export const SIDES = {
  zones: PLATE_ZONES,
  road: "gameplay",
  shoulder: "decor",
  densify: "empty",
};

export const SIDES_PHRASE =
  "Shoulders, calm void, and berms stay relatively empty. Do not bake side clutter into Video A. The GPU fills décor, lights, and openables on sideL and sideR.";

/** Cook lines. Paste into Imagine. Flat plastic lighting is FAIL. */
export const RT_PHRASE = {
  densify:
    "Path-traced look baked into the pixels: soft global illumination, reflections in the lane, soft contact shadows. Not flat plastic lighting. Not a real-time raytracer.",
  light:
    "Only the light, on pure black. Soft falloff, soft bloom, a faint reflected tint. Path-traced look in the pixels. Not flat plastic. No road.",
  openable:
    "The prop looks path-traced: soft GI, a soft contact shadow, a reflection in the lane. Keyed. Not flat plastic. Not a real-time raytracer.",
};

/** Keyed layers. All of them composite on the GPU over densify. None are painted into Video A. */
export const GPU = {
  required: true,
  composite: "over-densify",
  bakeIntoDensify: false,
  raytrace: false,
  layers: ["bolt", "lena", "howl", "path-beat", "light", "openable"],
};

export const NATIVE = {
  geometry: "densify-lanes",
  cone: "howlPose",
  lanes: 3,
  gpu: true,
  composite: GPU.composite,
  bakeIntoDensify: false,
  gradeFromPlate: true,
  hud: false,
  clock: "densify",
  tileDensify: false,
  key: "black",
  onlyLight: true,
  ambience: "densify",
  raytrace: false,
  rtLook: RT.rtLook,
  fakeInteractive: true,
  trueRt: RT.trueRt,
  bounces: 0,
  plateZones: PLATE_ZONES,
  sides: "gpu",
  sideClutter: false,
};

/** Flags stamped on every light and openable frame. */
export function rtFlags() {
  return {
    rtLook: RT.rtLook,
    fakeInteractive: RT.fakeInteractive,
    raytrace: false,
    trueRt: RT.trueRt,
    bounces: 0,
  };
}

/**
 * Optional gloss / reflect quad for one light that is drawing.
 * Same dest as the light. Graded from the plate. Zero bounces.
 * Dark lights do not draw. This does not trace rays.
 */
export function glossOverlay(layer) {
  const base = {
    kind: "gloss",
    gpu: true,
    composite: GPU.composite,
    bakeIntoDensify: false,
    gradeFromPlate: true,
    hud: false,
    raytrace: false,
    fakeInteractive: true,
    rtLook: RT.rtLook,
    bounces: 0,
  };
  if (!layer || layer.draw !== true || !layer.pose) return { ...base, draw: false };
  return {
    ...base,
    draw: true,
    id: layer.id,
    dest: layer.pose.dest,
    intensity: layer.intensity,
    tint: layer.tint,
  };
}

/**
 * Pack RT contract on a frame.
 * "raytrace" and "real-time raytracing" mean someone claimed a tracer.
 * "flat plastic" means the baked look was dropped.
 */
export function assertRtNative(frame) {
  const fails = [];
  if (!frame) return ["missing frame"];
  if (frame.rtLook !== RT.rtLook) fails.push("rt look");
  if (frame.fakeInteractive !== true) fails.push("fake interactive");
  if (frame.raytrace === true || frame.realtimeImagine === true) {
    fails.push("raytrace");
    fails.push("real-time raytracing");
  }
  if (frame.trueRt !== RT.trueRt) fails.push("true RT");
  if (frame.plastic === true || frame.rtLook === "flat-plastic") fails.push("flat plastic");
  if (frame.bounces > 0) fails.push("real-time raytracing");
  for (const gloss of frame.gloss || []) {
    if (gloss.raytrace === true || gloss.bounces > 0) fails.push("real-time raytracing");
    if (gloss.bakeIntoDensify === true) fails.push("baked into densify");
    if (gloss.draw && gloss.gradeFromPlate !== true) fails.push("gradeFromPlate");
  }
  return fails;
}

function slugNoun(noun) {
  const raw = String(noun || "lane");
  if (/[./\\]/.test(raw)) throw new Error("light bib noun");
  const s = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!s) throw new Error("light bib noun");
  return s;
}

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/** 'L' | 'C' | 'R' | -1 | 0 | 1 → cone index. Unknown → null. */
export function normalizeLane(lane) {
  if (lane === "L" || lane === "l" || lane === -1) return -1;
  if (lane === "C" || lane === "c" || lane === "M" || lane === "m" || lane === 0) return 0;
  if (lane === "R" || lane === "r" || lane === 1) return 1;
  return null;
}

/**
 * Hung Imagine bib. Light pixels only, keyed black or transparent.
 * Not a crop of densify. Not a road plate.
 */
export function lightBib(kind, noun = "lane") {
  if (!KINDS.includes(kind)) throw new Error("light kind");
  return `biome/fx/light/${kind}/${slugNoun(noun)}.mp4`;
}

/** #rgb / #rrggbb, or {r,g,b} in 0–1 (channels above 1 are 0–255). */
export function parseTint(tint) {
  if (tint == null) return { r: 1, g: 1, b: 1 };
  if (typeof tint === "string") {
    const hex = tint.trim().replace(/^#/, "");
    if (!/^[0-9a-fA-F]{6}$/.test(hex) && !/^[0-9a-fA-F]{3}$/.test(hex)) throw new Error("light tint");
    const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
    return {
      r: parseInt(full.slice(0, 2), 16) / 255,
      g: parseInt(full.slice(2, 4), 16) / 255,
      b: parseInt(full.slice(4, 6), 16) / 255,
    };
  }
  const r = Number(tint.r);
  const g = Number(tint.g);
  const b = Number(tint.b);
  if (![r, g, b].every(Number.isFinite)) throw new Error("light tint");
  const scale = r > 1 || g > 1 || b > 1 ? 255 : 1;
  return { r: clamp01(r / scale), g: clamp01(g / scale), b: clamp01(b / scale) };
}

/**
 * Intensity moves toward `target` at 1.0 per `fadeSec`.
 * A step of `fadeSec` completes a full 0→1 or 1→0. dt 0 holds.
 */
export function fadeIntensity(current, target, dt, fadeSec) {
  const from = clamp01(current);
  const to = clamp01(target);
  if (!(fadeSec > 0)) return to;
  const room = Math.max(0, Number(dt) || 0) / fadeSec;
  const delta = to - from;
  if (Math.abs(delta) <= room) return to;
  return from + Math.sign(delta) * room;
}

function placeOf(raw, fallback) {
  const plateZone = raw.plateZone != null ? normalizePlateZone(raw.plateZone) : fallback ? fallback.plateZone : "road";
  if (plateZone === null) throw new Error("plate zone");
  if (plateZone === "road") {
    const lane = raw.lane != null ? normalizeLane(raw.lane) : fallback ? fallback.lane : 0;
    if (lane === null) throw new Error("light lane");
    return { plateZone, lane, poseLane: lane };
  }
  return { plateZone, lane: null, poseLane: poseLane(plateZone, 0) };
}

function normalizeLayer(raw) {
  if (!raw || raw.id == null || raw.id === "") throw new Error("light id");
  const kind = String(raw.kind || "glow");
  if (!KINDS.includes(kind)) throw new Error("light kind");
  const placed = placeOf(raw, null);
  const z = Number.isFinite(Number(raw.z)) ? Number(raw.z) : 0.55;
  const on = raw.on === true;
  const intensity = clamp01(raw.intensity != null ? raw.intensity : 1);
  const tint = parseTint(raw.tint);
  const live = raw.live != null ? clamp01(raw.live) : on ? intensity : 0;
  return {
    id: String(raw.id),
    kind,
    noun: slugNoun(raw.noun || "lane"),
    ...placed,
    z,
    on,
    intensity,
    tint,
    live,
  };
}

/** Declared lamps. They start dark unless `on` is true. Densify ambience is not in here. */
export function lightLayerState(layers = []) {
  return {
    layers: (layers || []).map((raw) => normalizeLayer(raw)),
    clock: 0,
  };
}

function applySet(layer, set) {
  if (!set) return layer;
  const on = set.on != null ? set.on === true : layer.on;
  const intensity = set.intensity != null ? clamp01(set.intensity) : layer.intensity;
  const tint = set.tint != null ? parseTint(set.tint) : layer.tint;
  const placed = set.plateZone != null || set.lane != null ? placeOf({ ...layer, ...set }, layer) : layer;
  const z = set.z != null && Number.isFinite(Number(set.z)) ? Number(set.z) : layer.z;
  return {
    ...layer,
    on,
    intensity,
    tint,
    plateZone: placed.plateZone,
    lane: placed.lane,
    poseLane: placed.poseLane,
    z,
  };
}

/**
 * One Live tick.
 * ctx: { now, dt is the second arg, cw, ch, pawY, destH0, fadeSec, set }
 * `set` is [{ id, on, intensity, tint, lane, z }] for this tick.
 * `now` is densify plate time. If omitted, clock advances by dt.
 */
export function lightLayerFrame(state, dt, ctx = {}) {
  const step = Math.max(0, Number(dt) || 0);
  const now = ctx.now != null && ctx.now !== "" ? Number(ctx.now) : (Number(state.clock) || 0) + step;
  const cw = ctx.cw || 768;
  const ch = ctx.ch || 1168;
  const pawY = ctx.pawY != null ? ctx.pawY : ch * 0.84;
  const destH0 = ctx.destH0 || 200;
  const fadeSec = ctx.fadeSec != null ? Number(ctx.fadeSec) : LIGHT.fadeSec;
  const updates = new Map();
  for (const row of ctx.set || []) {
    if (row && row.id != null) updates.set(String(row.id), row);
  }

  const stored = [];
  const layers = [];
  for (const layer of state.layers || []) {
    const next = applySet(layer, updates.get(layer.id));
    const target = next.on ? next.intensity : 0;
    const live = fadeIntensity(layer.live, target, step, fadeSec);
    const pose = howlPose(next.poseLane, next.z, cw, ch, destH0, pawY);
    const band = objectBand(pose.t);
    stored.push({ ...next, live });
    layers.push({
      id: next.id,
      kind: next.kind,
      noun: next.noun,
      plateZone: next.plateZone,
      lane: next.lane,
      poseLane: next.poseLane,
      howlable: false,
      z: next.z,
      on: next.on,
      intensityTarget: target,
      intensity: live,
      tint: next.tint,
      bib: lightBib(next.kind, next.noun),
      pose,
      band,
      draw: live > 0.004,
      key: "black",
      onlyLight: true,
      gpu: true,
      composite: GPU.composite,
      bakeIntoDensify: false,
      gradeFromPlate: true,
      hud: false,
      inWorld: true,
      cone: "howlPose",
      contact: band === "near" && live > 0.02,
      fadeSec,
      tileDensify: false,
      ...rtFlags(),
    });
  }

  return {
    rail: RAIL.zones,
    densify: RAIL.densify,
    tileDensify: false,
    coversPlate: false,
    gpu: true,
    composite: GPU.composite,
    bakeIntoDensify: false,
    gradeFromPlate: true,
    hud: false,
    inWorld: true,
    cone: "howlPose",
    clock: "densify",
    sameClock: true,
    lanes: 3,
    plateZones: PLATE_ZONES,
    sides: "gpu",
    sideClutter: false,
    ambience: "densify",
    onlyLight: true,
    key: "black",
    ...rtFlags(),
    gloss: layers.map((layer) => glossOverlay(layer)),
    now,
    fadeSec,
    state: { layers: stored, clock: now },
    layers,
  };
}

/**
 * Empty list = the frame is a keyed light layer over densify.
 * Any string is a FAIL (baked beam, HUD, skipped GPU, raytrace, second cone).
 */
export function assertLightNative(frame) {
  const fails = [];
  if (!frame) return ["missing frame"];
  if (frame.tileDensify !== false) fails.push("densify tiled");
  if (frame.coversPlate !== false) fails.push("covers plate");
  if (frame.gpu !== true) fails.push("GPU");
  if (frame.bakeIntoDensify !== false) fails.push("baked into densify");
  if (frame.composite !== "over-densify") fails.push("composite");
  if (frame.hud !== false) fails.push("HUD");
  if (frame.inWorld !== true) fails.push("not in world");
  if (frame.gradeFromPlate !== true) fails.push("gradeFromPlate");
  if (frame.cone !== "howlPose") fails.push("cone");
  if (frame.clock !== "densify") fails.push("clock");
  if (frame.lanes !== 3) fails.push("lanes");
  if (frame.sides !== "gpu" || frame.sideClutter === true) fails.push("side clutter");
  fails.push(...assertRtNative(frame));
  if (frame.ambience !== "densify") fails.push("ambience");
  if (frame.onlyLight !== true || frame.key !== "black") fails.push("not light-only");
  for (const layer of frame.layers || []) {
    if (layer.gpu !== true || layer.bakeIntoDensify !== false || layer.composite !== "over-densify") {
      fails.push("baked into densify");
    }
    if (layer.hud !== false) fails.push("HUD");
    if (layer.gradeFromPlate !== true) fails.push("gradeFromPlate");
    if (layer.onlyLight !== true || layer.key !== "black") fails.push("not light-only");
    if (!PLATE_ZONES.includes(layer.plateZone)) fails.push("plate zone");
    if (layer.plateZone !== "road" && layer.howlable === true) fails.push("howl on side");
    if (!KINDS.includes(layer.kind)) fails.push("kind");
    if (!(layer.intensity >= 0 && layer.intensity <= 1)) fails.push("intensity");
    if (!layer.pose || !layer.pose.dest || layer.cone !== "howlPose") fails.push("cone");
    if (!layer.bib || !layer.bib.startsWith("biome/fx/light/")) fails.push("bib");
    if (/road-/.test(layer.bib)) fails.push("baked into densify");
  }
  return fails;
}

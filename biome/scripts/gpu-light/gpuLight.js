/**
 * GPU light layers — law 38.
 *
 * Imagine cooks a plate that is ONLY light (beam / glow / neon / flash)
 * on keyed black or transparent. This module never writes those pixels
 * into densify. Densify keeps base ambience (law 31).
 *
 * GPU owns intensity 0→1, tint, on/off, cone position, fade.
 * Placement is howlPose. Bands are Lena objectBand. Not raytracing.
 *
 *   import { lightLayerState, lightLayerFrame, lightBib, assertLightNative } from "./gpuLight.js";
 *
 * Copy into Live next to howlLive.js. Draw each layer whose `draw` is true
 * as a keyed quad on pose.dest, multiplied by intensity and tint.
 * gradeFromPlate. Composite OVER densify. Do not bake the beam into Video A.
 */
import { howlPose } from "../howl-live/howlLive.js";
import { objectBand } from "../lena-lod/lenaLod.js";

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
};

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

function normalizeLayer(raw) {
  if (!raw || raw.id == null || raw.id === "") throw new Error("light id");
  const kind = String(raw.kind || "glow");
  if (!KINDS.includes(kind)) throw new Error("light kind");
  const lane = normalizeLane(raw.lane != null ? raw.lane : 0);
  if (lane === null) throw new Error("light lane");
  const z = Number.isFinite(Number(raw.z)) ? Number(raw.z) : 0.55;
  const on = raw.on === true;
  const intensity = clamp01(raw.intensity != null ? raw.intensity : 1);
  const tint = parseTint(raw.tint);
  const live = raw.live != null ? clamp01(raw.live) : on ? intensity : 0;
  return {
    id: String(raw.id),
    kind,
    noun: slugNoun(raw.noun || "lane"),
    lane,
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
  const lane = set.lane != null ? normalizeLane(set.lane) : layer.lane;
  if (lane === null) throw new Error("light lane");
  const z = set.z != null && Number.isFinite(Number(set.z)) ? Number(set.z) : layer.z;
  return { ...layer, on, intensity, tint, lane, z };
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
    const pose = howlPose(next.lane, next.z, cw, ch, destH0, pawY);
    const band = objectBand(pose.t);
    stored.push({ ...next, live });
    layers.push({
      id: next.id,
      kind: next.kind,
      noun: next.noun,
      lane: next.lane,
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
    raytrace: false,
    ambience: "densify",
    onlyLight: true,
    key: "black",
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
  if (frame.raytrace === true) fails.push("raytrace");
  if (frame.ambience !== "densify") fails.push("ambience");
  if (frame.onlyLight !== true || frame.key !== "black") fails.push("not light-only");
  for (const layer of frame.layers || []) {
    if (layer.gpu !== true || layer.bakeIntoDensify !== false || layer.composite !== "over-densify") {
      fails.push("baked into densify");
    }
    if (layer.hud !== false) fails.push("HUD");
    if (layer.gradeFromPlate !== true) fails.push("gradeFromPlate");
    if (layer.onlyLight !== true || layer.key !== "black") fails.push("not light-only");
    if (!KINDS.includes(layer.kind)) fails.push("kind");
    if (!(layer.intensity >= 0 && layer.intensity <= 1)) fails.push("intensity");
    if (!layer.pose || !layer.pose.dest || layer.cone !== "howlPose") fails.push("cone");
    if (!layer.bib || !layer.bib.startsWith("biome/fx/light/")) fails.push("bib");
    if (/road-/.test(layer.bib)) fails.push("baked into densify");
  }
  return fails;
}

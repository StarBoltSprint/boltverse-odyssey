/**
 * Lena LOD + procedural spawn — law 36.
 *
 * Rail A densify stays one continuous plate. This module never slices it.
 * Rail B places Imagine keyed bibs on the same cone as Howl obstacles
 * (howlPose / pickHowlLane). Look stays the hung file. Code owns when and where.
 *
 *   import { lenaState, lenaFrame, lenaResolve, bibFile } from "./lenaLod.js";
 *
 * Copy into Live next to howlLive.js. Draw each spawn as a Bolt-style quad
 * (mark / markDest). Howl rings stay biome/fx/howl/howl-attack.mp4.
 */
import { HOWL, howlPose, pickHowlLane, mulberry32, PLATE_ZONES, normalizePlateZone, poseLane } from "../howl-live/howlLive.js";

export { PLATE_ZONES, normalizePlateZone, poseLane };

export const HOWL_KEEP = "biome/fx/howl/howl-attack.mp4";

export const LENA = {
  /** Cone t (howlPose): 0 = horizon, 1 = paws. */
  farMax: 0.34,
  midMax: 0.72,
  /** Start the crossfade this many t-units before the next band. */
  preloadLead: 0.08,
  /** climbT: 0 = ground, 1 = deep space. */
  earthMax: 0.33,
  nearSpaceMax: 0.66,
  /** Fresh spawns sit up the road, in front of the paws. */
  spawnZ0: 0.7,
  spawnZ1: 0.88,
  gapMin: 1.15,
  gapMax: 2.5,
  maxAlive: 3,
};

export const WORLDS = ["earth", "near-space", "deep-space"];
export const BANDS = ["far", "mid", "near"];
export const VARIANTS = ["generator", "detail", "rock"];

const VARIANT_OF = { far: "generator", mid: "detail", near: "rock" };
const WARM_OF = { far: "detail", mid: "rock", near: null };

export const RAIL = {
  densify: "A",
  zones: "B",
  tileDensify: false,
};

function slugNoun(noun) {
  const raw = String(noun || "quartz");
  if (/[./\\]/.test(raw)) throw new Error("lena bib noun");
  const s = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!s) throw new Error("lena bib noun");
  return s;
}

function clamp01(n) {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** far | mid | near from cone t. */
export function objectBand(t) {
  const x = Number(t) || 0;
  if (x < LENA.farMax) return "far";
  if (x < LENA.midMax) return "mid";
  return "near";
}

/** generator | detail | rock. */
export function variantOf(band) {
  const v = VARIANT_OF[band];
  if (!v) throw new Error("lena band");
  return v;
}

/**
 * Soft preload far → full near.
 * `show` is the variant on screen. `warm` is the next file to fetch.
 * `warmK` ramps 0→1 across preloadLead so the GPU can crossfade on one quad.
 */
export function preloadOf(t) {
  const band = objectBand(t);
  const show = variantOf(band);
  const warm = WARM_OF[band];
  let warmK = 0;
  if (band === "far" && t >= LENA.farMax - LENA.preloadLead) {
    warmK = clamp01((t - (LENA.farMax - LENA.preloadLead)) / LENA.preloadLead);
  } else if (band === "mid" && t >= LENA.midMax - LENA.preloadLead) {
    warmK = clamp01((t - (LENA.midMax - LENA.preloadLead)) / LENA.preloadLead);
  }
  return { band, show, warm, warmK };
}

/** earth | near-space | deep-space from climb progress. */
export function worldLod(climbT) {
  const t = Number(climbT) || 0;
  if (t < LENA.earthMax) return "earth";
  if (t < LENA.nearSpaceMax) return "near-space";
  return "deep-space";
}

function worldName(world) {
  if (WORLDS.includes(world)) return world;
  throw new Error("lena world");
}

/** Hung Imagine bib. Not a crop of densify. */
export function bibFile(world, noun, variant) {
  if (!VARIANTS.includes(variant)) throw new Error("lena variant");
  return `biome/fx/lena/${worldName(world)}/${slugNoun(noun)}-${variant}.mp4`;
}

/** Shatter is its own plate (law 32). Not inside the Howl KEEP. */
export function shatterFile(world, noun) {
  return `biome/fx/lena/${worldName(world)}/${slugNoun(noun)}-shatter.mp4`;
}

/**
 * One distance sample. Build uses this when it already has cone t.
 * tileDensify is always false.
 */
export function lenaResolve({ t, climbT, noun = "quartz", zone = "road" }) {
  const world = worldLod(climbT);
  const pre = preloadOf(t);
  const sky = zone === "sky";
  return {
    rail: RAIL.zones,
    tileDensify: false,
    world,
    band: pre.band,
    variant: pre.show,
    warm: pre.warm,
    warmK: pre.warmK,
    bib: bibFile(world, noun, pre.show),
    warmBib: pre.warm ? bibFile(world, noun, pre.warm) : null,
    shatter: shatterFile(world, noun),
    howlKeep: HOWL_KEEP,
    key: sky ? "black" : "green",
    contact: !sky && pre.band === "near",
    gradeFromPlate: true,
  };
}

export function lenaState(seed = 1) {
  return { seed: seed >>> 0 || 1, spawns: [], nextAt: 0, seq: 0 };
}

function resolveSpawn(spawn, ctx, world) {
  const plateZone = spawn.plateZone || "road";
  const poseIndex = spawn.poseLane != null ? spawn.poseLane : spawn.lane;
  const pose = howlPose(poseIndex, spawn.z, ctx.cw, ctx.ch, ctx.destH0, ctx.pawY);
  const sky = ctx.zone === "sky";
  const onSide = plateZone !== "road";
  const pre = preloadOf(pose.t);
  return {
    id: spawn.id,
    plateZone,
    lane: spawn.lane,
    poseLane: poseIndex,
    z: spawn.z,
    noun: spawn.noun,
    t: pose.t,
    band: pre.band,
    variant: pre.show,
    warm: pre.warm,
    warmK: pre.warmK,
    bib: bibFile(world, spawn.noun, pre.show),
    warmBib: pre.warm ? bibFile(world, spawn.noun, pre.warm) : null,
    shatter: shatterFile(world, spawn.noun),
    howlKeep: HOWL_KEEP,
    pose,
    key: sky ? "black" : "green",
    contact: !sky && pre.band === "near",
    gradeFromPlate: true,
    howlable: onSide ? false : pose.howlable === true,
  };
}

/**
 * Advance Rail B spawns one tick.
 * ctx: { now, climbT, cw, ch, pawY, destH0, blocked, plate, nouns, zone, plateZone }
 * plateZone defaults to "road" (gameplay lanes, Howl-eligible).
 * "sideL" | "sideR" plants décor on the shoulder and does not take a road lane.
 * Howl hits stay on the road. Densify sides stay empty; this layer fills them.
 * Returns a new state. Densify is not in the return.
 */
export function lenaFrame(state, dt, ctx) {
  const seed = state.seed >>> 0 || 1;
  let seq = state.seq | 0;
  let nextAt = Number(state.nextAt) || 0;
  const now = Number(ctx.now) || 0;
  const step = Math.max(0, Number(dt) || 0);
  const plateZone = ctx.plateZone == null || ctx.plateZone === "" ? "road" : normalizePlateZone(ctx.plateZone);
  if (plateZone === null) throw new Error("plate zone");
  const spawns = [];
  for (const s of state.spawns || []) {
    const z = s.z - step / HOWL.travel;
    if (z < HOWL.exitZ) continue;
    const keptZone = s.plateZone || "road";
    spawns.push({
      id: s.id,
      plateZone: keptZone,
      lane: s.lane,
      poseLane: s.poseLane != null ? s.poseLane : s.lane,
      z,
      noun: s.noun,
      born: s.born,
    });
  }
  const rng = mulberry32((seed + seq * 101) >>> 0);
  if (now >= nextAt) {
    const laneRoll = plateZone === "road" ? rng() : null;
    const gap = LENA.gapMin + rng() * (LENA.gapMax - LENA.gapMin);
    nextAt = now + gap;
    const lane = plateZone === "road" ? pickHowlLane(ctx.blocked || [], ctx.plate || [], laneRoll) : null;
    if (spawns.length < LENA.maxAlive && (plateZone !== "road" || lane !== null)) {
      const nouns = ctx.nouns && ctx.nouns.length ? ctx.nouns : ["quartz"];
      const noun = nouns[Math.min(nouns.length - 1, (rng() * nouns.length) | 0)];
      const z = LENA.spawnZ0 + rng() * (LENA.spawnZ1 - LENA.spawnZ0);
      seq += 1;
      if (plateZone === "road") {
        spawns.push({ id: `${seed}-${seq}`, plateZone: "road", lane, poseLane: lane, z, noun, born: now });
      } else {
        spawns.push({
          id: `${seed}-${seq}`,
          plateZone,
          lane: null,
          poseLane: poseLane(plateZone, 0),
          z,
          noun,
          born: now,
        });
      }
    }
  }
  const world = worldLod(ctx.climbT);
  return {
    rail: RAIL.zones,
    tileDensify: false,
    sides: "gpu",
    sideClutter: false,
    plateZones: PLATE_ZONES,
    world,
    state: { seed, spawns, nextAt, seq },
    spawns: spawns.map((s) => resolveSpawn(s, ctx, world)),
  };
}

import type { Hit, Kind, Volume } from "./types";

/**
 * Play. Law 52. What the paws mean. Does not import three.
 * Engine draws. This file does not.
 * One Bolt. The mesh path is the Pack KEEP. This kitchen does not cook a second wolf.
 */

/** Pack KEEP. White German Shepherd already sealed for the Pack. Not a new hero. */
export const BOLT_GLB = "lock/bolt.glb";
/** Mesh withers, meters. The plate fraction stays law 20. */
export const BOLT_WITHERS_M = 0.6;
export const BOLT_CLIPS = ["idle", "walk", "sprint"] as const;
/** The play mesh is never culled. A far tree may be. */
export const BOLT_NEVER_CULL = true;
/** Motion teacher stays the sealed cycle. The glb does not replace it. */
export const BOLT_MOTION = "lock/bolt-gallop-cycle.mp4";
export const BOLT_STYLE = "lock/bolt-back.jpg";

/** Pawn disk added to the volume radius. Not a card width. */
export const PAWN_R = 0.4;
/** Run accel. Soft replaces this while the disk holds. */
export const RUN_ACCEL = 0.18;
export const SOFT_ACCEL = 0.08;
/** Clip only. Not an LOD band. About 0.4 m at 5 m/s. */
export const SOFT_CLIP_HOLD_MS = 80;
export const GAIT_IDLE_SPEED = 0.2;
export const GAIT_SPRINT_SPEED = 4;

export const BLOCK_HIT = { push: true, speedMul: 0.35, mDelta: -0.8, yawMul: 1, forceClip: null } as const;

/** Fern. No push. One set, however many tufts. Walk even if Shift is down. */
export const FERN_HIT = {
  push: false,
  wantSpeedMul: 0.55,
  accel: SOFT_ACCEL,
  mDelta: -0.03,
  yawMul: 0.5,
  forceClip: "walk" as const,
};

/** Walking into a crystal is the soft numbers without the yaw clamp and without a forced walk. */
export const CRYSTAL_WALK = {
  push: false,
  wantSpeedMul: 0.55,
  accel: SOFT_ACCEL,
  mDelta: -0.03,
  yawMul: 1,
  forceClip: null,
  shatter: false,
} as const;

/** Debug L. A thud on the green wire means the fern was read as a block. */
export const HIT_DEBUG = { soft: "green", block: "cyan", shatter: "gold" } as const;

export function wireColor(hit: Hit): "green" | "cyan" | "gold" | null {
  if (hit === "soft") return HIT_DEBUG.soft;
  if (hit === "block") return HIT_DEBUG.block;
  if (hit === "shatter") return HIT_DEBUG.shatter;
  return null;
}

export const HOWL_RANGE = 8;
export const HOWL_CONE_DEG = 25;
/** SmiR KEEP. Law 32. Do not recook the rings. */
export const HOWL_KEEP = "biome/fx/howl/howl-attack.mp4";
/** ~1 s FX. No capsule. Cook: shard to cyan dust, transparent back, no Bolt, first still, last empty. */
export const CRYSTAL_BURST = "crystal_burst_vN";
export const BURST_MS = 1000;

export type PawTouch = "block" | "fern" | "crystal-walk" | "howl-confirm" | "howl-miss";

/**
 * Crystal shatters only on a confirmed Howl inside the cone.
 * A body overlap is the soft drag. A Howl that misses the cone is pose and audio.
 */
export function pawTouch(kind: Kind, howl: boolean, inCone: boolean, overlap: boolean): PawTouch | null {
  if (kind === "crystal" && howl && inCone) return "howl-confirm";
  if (overlap && kind === "fern") return "fern";
  if (overlap && kind === "crystal") return "crystal-walk";
  if (overlap && (kind === "bole" || kind === "elder" || kind === "ruin")) return "block";
  if (howl && !inCone) return "howl-miss";
  return null;
}

/** True when a point sits in the Howl cone. 8 m, 25 degrees. */
export function inHowlCone(
  camX: number,
  camZ: number,
  yaw: number,
  x: number,
  z: number,
): boolean {
  const dx = x - camX;
  const dz = z - camZ;
  const dist = Math.hypot(dx, dz);
  if (dist > HOWL_RANGE || dist === 0) return false;
  let d = Math.atan2(dx, dz) - yaw;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d) <= (HOWL_CONE_DEG * Math.PI) / 180;
}

export type ClipName = (typeof BOLT_CLIPS)[number];

export type PawnHit = {
  x: number;
  z: number;
  speed: number;
  wantSpeed: number;
  yawRate: number;
  m: number;
  /** Capsule proto consumes wantSpeed and yawRate. The clip waits for bolt.glb. */
  clip: ClipName | null;
  pushed: boolean;
  inSoft: boolean;
};

function disk(px: number, pz: number, vol: Volume): number | null {
  const d = Math.hypot(px - vol.x, pz - vol.z);
  return d < vol.r + PAWN_R ? d : null;
}

/** Push along pawn − tree until the disks stop overlapping. Soft never calls this. */
function pushOut(px: number, pz: number, vol: Volume): { x: number; z: number } {
  let dx = px - vol.x;
  let dz = pz - vol.z;
  let d = Math.hypot(dx, dz);
  const limit = vol.r + PAWN_R;
  if (d >= limit) return { x: px, z: pz };
  if (d < 1e-8) {
    dx = 0;
    dz = 1;
    d = 1;
  }
  const k = limit / d;
  return { x: vol.x + dx * k, z: vol.z + dz * k };
}

/**
 * One tick of volumes. Hit comes from `volume.hit`, never from a fern card.
 * Block pushes and knocks once. Soft nicks once, even if several tufts overlap.
 * Leaving the disk clears want, accel, the nick, and yaw this tick. No exit lerp.
 * `clip` is the gait note. This function does not load lock/bolt.glb.
 */
export function resolveVolumes(
  pawn: { x: number; z: number; speed: number; wantSpeed: number; yawRate: number; m: number },
  volumes: Volume[],
): PawnHit & { accel: number } {
  let x = pawn.x;
  let z = pawn.z;
  let blocked = false;
  let fern = false;
  let crystal = false;
  for (const vol of volumes) {
    if (disk(pawn.x, pawn.z, vol) === null) continue;
    if (vol.hit === "block") {
      const out = pushOut(x, z, vol);
      x = out.x;
      z = out.z;
      blocked = true;
    } else if (vol.hit === "soft") fern = true;
    else if (vol.hit === "shatter") crystal = true;
  }
  const soft = fern || crystal;
  return {
    x,
    z,
    speed: blocked ? pawn.speed * BLOCK_HIT.speedMul : pawn.speed,
    wantSpeed: soft ? pawn.wantSpeed * FERN_HIT.wantSpeedMul : pawn.wantSpeed,
    yawRate: fern ? pawn.yawRate * FERN_HIT.yawMul : pawn.yawRate,
    accel: soft ? SOFT_ACCEL : RUN_ACCEL,
    m: pawn.m + (blocked ? BLOCK_HIT.mDelta : 0) + (soft ? FERN_HIT.mDelta : 0),
    clip: fern ? "walk" : null,
    pushed: blocked,
    inSoft: fern,
  };
}

export type GaitMem = { outsideMs: number; holding: boolean };

export function resetGait(): GaitMem {
  return { outsideMs: SOFT_CLIP_HOLD_MS, holding: false };
}

/**
 * Clip table for when bolt.glb arrives. Not wired here.
 * Idle wins under 0.2. A fern forces walk the same tick, Shift included.
 * After the disk, sprint waits 80 ms. That hold is the clip only.
 */
export function stepGait(
  speed: number,
  inSoft: boolean,
  mem: GaitMem,
  dtMs: number,
  _shift = false,
): { clip: ClipName; mem: GaitMem } {
  if (inSoft) {
    const clip: ClipName = speed < GAIT_IDLE_SPEED ? "idle" : "walk";
    return { clip, mem: { outsideMs: 0, holding: true } };
  }
  let outsideMs = mem.outsideMs;
  let holding = mem.holding;
  if (holding) {
    outsideMs += dtMs;
    if (outsideMs >= SOFT_CLIP_HOLD_MS) holding = false;
  }
  const next = { outsideMs, holding };
  if (speed < GAIT_IDLE_SPEED) return { clip: "idle", mem: next };
  if (holding) return { clip: "walk", mem: next };
  if (speed < GAIT_SPRINT_SPEED) return { clip: "walk", mem: next };
  return { clip: "sprint", mem: next };
}

/**
 * Remix pools. One InstancedMesh per name. This file does not import three.
 * Idle cutouts stay in the pool. A fade (≤8) leaves the pool as its own kit.
 * Crown is the near channel only. No per-instance transparent material.
 * With zero fades the woods, the plates, and Bolt are about six draws.
 */
export const INSTANCE_POOLS = ["bole", "elder", "ruin", "crystal", "fern", "impostor", "crown"] as const;
export const IDLE_DRAWS = 6;

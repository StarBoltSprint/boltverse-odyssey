import type { Kind } from "./types";

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

export const BLOCK_HIT = { push: true, speedMul: 0.35, mDelta: -0.8 } as const;

/** Fern. No push. Walk even if Shift is down. Yaw is half. */
export const FERN_HIT = {
  push: false,
  wantSpeedMul: 0.55,
  slowerAccel: true,
  mDelta: -0.03,
  yawMul: 0.5,
  forceClip: "walk" as const,
};

/** Walking into a crystal is this. It is not a shatter. */
export const CRYSTAL_WALK = {
  push: false,
  wantSpeedMul: 0.55,
  slowerAccel: true,
  mDelta: -0.03,
  yawMul: 1,
  shatter: false,
} as const;

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

/**
 * Remix pools. One InstancedMesh per name. This file does not import three.
 * Idle cutouts stay in the pool. A fade (≤8) leaves the pool as its own kit.
 * Crown is the near channel only. No per-instance transparent material.
 * With zero fades the woods, the plates, and Bolt are about six draws.
 */
export const INSTANCE_POOLS = ["bole", "elder", "ruin", "crystal", "fern", "impostor", "crown"] as const;
export const IDLE_DRAWS = 6;

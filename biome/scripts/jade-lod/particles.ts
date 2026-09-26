/**
 * VFX playback tape. Law 53. Does not import three.
 * Birth, velocity, and life live in the buffers. The vertex shader integrates
 * p + v*t + g*t². A slot does not read its neighbors, does not read trunks,
 * and does not write SprintCore. That is weather, not a physics engine.
 * Picture-time only, the same 1/60 family as fade and SprintCore. Pause freezes
 * births and the integration. The Howl burst quad advances by sim dt in play.ts.
 * Never Date.now.
 * The look is an Imagine cutout. A missing sheet hides the points. No colored disc.
 * Howl is the verb in play.ts. These points are the stand-in and, once the mp4
 * is bound, a smaller halo. They do not pick a sphere and they do not delete a crystal.
 * Rapier, Cannon, Ammo, and Chaos are not this file. A Verlet that must land
 * is a different machine, 80 grains at most, and it is not built here.
 */

import {
  crystalBurstMp4,
  howlVerb,
  type HowlCandidate,
  type HowlVerb,
} from "./play";

export const SLOT_COUNT = 1400;
export const MOTE_DT = 0.18;
export const PAW_DT = 0.06;
export const SPRINT_MIN = 3.2;
export const BURST_COUNT = 80;
/** Halo while the burst film is bound. Stand-in stays BURST_COUNT. */
export const HALO_COUNT = 40;
export const HALO_LIFE_MIN = 0.4;
export const HALO_LIFE_MAX = 0.7;
export { HOWL_RANGE } from "./play";
/** HUD chip. Playback tape, not a compute sandbox and not a rigid solver. */
export const HUD_FX = "fx GPU";
/** This file. Not granular, not Rapier. */
export const MACHINE = "vfx-playback" as const;
/** SprintCore and fade share this step. Callers pass picture-time. */
export const SIM_HZ = 60;
/** Look lock. A flat gl_Point color is not a keep. */
export const LOOK = "imagine-cutout" as const;

/**
 * FX sheets. Cutouts, law 47. One subject, transparent, no Bolt. No binaries here.
 * Mote and paw are stills. The Howl shatter's primary picture is the burst plate.
 * Point sparks, if drawn, sample the dust sheet. An atlas may replace the three files later.
 */
export const FX_DIR = "public/decor/jade/sheets/fx";
export const FX_SHEETS = {
  mote: `${FX_DIR}/moss_dust_v0.png`,
  pollen: `${FX_DIR}/pollen_v0.png`,
  paw: `${FX_DIR}/ember_v0.png`,
  burst: `${FX_DIR}/spark_dust_v0.png`,
} as const;
/**
 * Primary shatter picture. Law 52. v0–v3. Names only.
 * Points do not replace a missing shard. Unbound film still breaks the crystal.
 */
export const BURST_PLATE = crystalBurstMp4(0);
export const MUZZLE = 1.2;

export const KIND = { mote: 0, paw: 1, burst: 2 } as const;
export type ParticleKind = (typeof KIND)[keyof typeof KIND];

/** Added as gravity(kind) * age * age. Motes rise. Paws drop. Bursts lift. Match the vert snippet. */
export const GRAVITY: Record<ParticleKind, readonly [number, number, number]> = {
  0: [0, 0.35, 0],
  1: [0, -2.4, 0],
  2: [0, 0.8, 0],
};

export const LIFE: Record<ParticleKind, number> = { 0: 1.4, 1: 0.35, 2: 0.8 };

export type FxSheets = { mote: boolean; paw: boolean; burst: boolean };

/** Missing sheet hides that kind. Never a stand-in disc. */
export function fxVisible(kind: ParticleKind, sheets: FxSheets): "draw" | "hide" {
  if (kind === KIND.mote) return sheets.mote ? "draw" : "hide";
  if (kind === KIND.paw) return sheets.paw ? "draw" : "hide";
  return sheets.burst ? "draw" : "hide";
}

export type ParticleBuffers = {
  /** xyz origin, length SLOT_COUNT * 3 */
  origin: Float32Array;
  /** xyz velocity */
  vel: Float32Array;
  birth: Float32Array;
  life: Float32Array;
  seed: Float32Array;
  kind: Float32Array;
  cursor: number;
};

export type BirthClock = { mote: number; paw: number; howl: boolean };

export function createParticles(): ParticleBuffers {
  const n = SLOT_COUNT;
  const birth = new Float32Array(n);
  birth.fill(-10);
  return {
    origin: new Float32Array(n * 3),
    vel: new Float32Array(n * 3),
    birth,
    life: new Float32Array(n),
    seed: new Float32Array(n),
    kind: new Float32Array(n),
    cursor: 0,
  };
}

export function createClock(): BirthClock {
  return { mote: -1, paw: -1, howl: false };
}

/** Next slot. The cursor wraps. A dead slot stays until this overwrites it. */
export function writeBirth(
  buf: ParticleBuffers,
  now: number,
  kind: ParticleKind,
  origin: readonly [number, number, number],
  vel: readonly [number, number, number],
  seed: number,
  life?: number,
): number {
  const i = buf.cursor;
  const o = i * 3;
  buf.origin[o] = origin[0];
  buf.origin[o + 1] = origin[1];
  buf.origin[o + 2] = origin[2];
  buf.vel[o] = vel[0];
  buf.vel[o + 1] = vel[1];
  buf.vel[o + 2] = vel[2];
  buf.birth[i] = now;
  buf.life[i] = life ?? LIFE[kind];
  buf.seed[i] = seed;
  buf.kind[i] = kind;
  buf.cursor = (i + 1) % SLOT_COUNT;
  return i;
}

function unit(n: number): number {
  let x = Math.imul(Math.floor(n * 1000) + 1, 0x9e3779b1);
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}

export type CrystalMark = {
  id: string;
  x: number;
  /** Card center when groundY is omitted. */
  y: number;
  z: number;
  h?: number;
  yaw?: number;
  variant?: number;
  groundY?: number;
  hit?: "shatter" | "block" | "soft" | "decor";
  w?: number;
};

function asCandidate(c: CrystalMark): HowlCandidate {
  const h = c.h ?? 1.6;
  return {
    id: c.id,
    x: c.x,
    z: c.z,
    h,
    yaw: c.yaw ?? 0,
    variant: c.variant ?? 0,
    hit: c.hit ?? "shatter",
    groundY: c.groundY ?? c.y - h * 0.5,
    w: c.w,
  };
}

/** Facing matches inHowlCone: yaw 0 looks down +z. */
export function muzzlePoint(
  x: number,
  y: number,
  z: number,
  yaw: number,
  dist: number = MUZZLE,
): [number, number, number] {
  return [x + Math.sin(yaw) * dist, y, z + Math.cos(yaw) * dist];
}

/**
 * Spark births at an origin the verb already chose.
 * Halo (film bound): 40 points, life 0.4–0.7. Stand-in: 80, life 0.8.
 * Does not delete a crystal and does not spawn a tree.
 */
export function birthHowl(
  buf: ParticleBuffers,
  now: number,
  origin: readonly [number, number, number],
  count: number,
  halo = false,
): void {
  for (let n = 0; n < count; n++) {
    const a = unit(now * 10 + n);
    const b = unit(now * 3 + n * 1.7);
    const ang = a * Math.PI * 2;
    const sp = halo ? 0.35 + b * 0.45 : 0.6 + b * 1.4;
    const life = halo ? HALO_LIFE_MIN + b * (HALO_LIFE_MAX - HALO_LIFE_MIN) : undefined;
    const lift = halo ? 0.15 + b * 0.25 : 0.4 + b;
    writeBirth(buf, now, KIND.burst, origin, [Math.cos(ang) * sp, lift, Math.sin(ang) * sp], n + 1, life);
  }
}

export type ParticleInput = {
  /** Picture-time seconds. Pause freezes it. Never Date.now. */
  now: number;
  bolt: readonly [number, number, number];
  yaw: number;
  /** Shift+WASD raises this. Paw sparks start above SPRINT_MIN. */
  sprintSpeed: number;
  /** Rising edge of H or Space. A hold does not fire again. */
  howlDown: boolean;
  crystals: readonly CrystalMark[];
  /** Bound Imagine sheets. Omit to keep the birth clock. A false flag skips that kind. */
  sheets?: FxSheets;
  /** Sim seconds for the burst quad. Pause passes 0, or set paused. */
  dt?: number;
  paused?: boolean;
  /** Variant mp4 is bound. False still shatters. Points stay the 80 stand-in. */
  filmBound?: (variant: number) => boolean;
};

/**
 * CPU births only. Motes every 0.18 s. Paws every 0.06 s while sprinting.
 * Howl goes through `howlVerb` (one press, one cone). Points follow that result.
 * A missing burst sheet still returns the shattered id and writes no points.
 */
export function tickBirths(
  buf: ParticleBuffers,
  clock: BirthClock,
  input: ParticleInput,
): { shattered: string | null; verb: HowlVerb } {
  const show = (kind: ParticleKind) => !input.sheets || fxVisible(kind, input.sheets) === "draw";
  const verb = howlVerb({
    howlDown: input.howlDown,
    dt: input.dt ?? 0,
    paused: input.paused,
    pawn: { x: input.bolt[0], y: input.bolt[1], z: input.bolt[2], yaw: input.yaw },
    candidates: input.crystals.map(asCandidate),
    filmBound: input.filmBound,
  });
  if (show(KIND.mote) && (clock.mote < 0 || input.now - clock.mote >= MOTE_DT)) {
    clock.mote = input.now;
    const j = unit(input.now);
    writeBirth(
      buf,
      input.now,
      KIND.mote,
      [input.bolt[0] + (j - 0.5) * 0.4, input.bolt[1] + 0.4, input.bolt[2] + (unit(input.now + 2) - 0.5) * 0.4],
      [(j - 0.5) * 0.2, 0.15, (unit(input.now + 4) - 0.5) * 0.2],
      j,
    );
  }
  if (show(KIND.paw) && input.sprintSpeed > SPRINT_MIN && (clock.paw < 0 || input.now - clock.paw >= PAW_DT)) {
    clock.paw = input.now;
    const j = unit(input.now + 8);
    writeBirth(
      buf,
      input.now,
      KIND.paw,
      [input.bolt[0], input.bolt[1], input.bolt[2]],
      [-Math.sin(input.yaw) * 0.4, 0.2, -Math.cos(input.yaw) * 0.4 * (0.5 + j)],
      j,
    );
  }
  if (verb.fired && verb.origin && verb.points > 0 && show(KIND.burst)) {
    birthHowl(buf, input.now, verb.origin, verb.points, verb.icing === "halo");
  }
  clock.howl = input.howlDown;
  return { shattered: verb.targetId, verb };
}

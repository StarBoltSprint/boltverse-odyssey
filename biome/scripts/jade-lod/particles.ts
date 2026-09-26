/**
 * GPU particle playback. Law 53. Does not import three.
 * One Points draw. The vertex shader moves the slot. The CPU only writes births.
 * Sparks are an FX overlay. They do not spawn trees and they do not draw the ground.
 */

export const SLOT_COUNT = 1400;
export const MOTE_DT = 0.18;
export const PAW_DT = 0.06;
export const SPRINT_MIN = 3.2;
export const BURST_COUNT = 80;
export const HOWL_RANGE = 8;
/** HUD chip. Playback, not a compute sandbox. */
export const HUD_FX = "fx GPU";
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
  buf.life[i] = LIFE[kind];
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

export type CrystalMark = { id: string; x: number; y: number; z: number };

/** Nearest crystal inside 8 m. Null means the burst sits in front of the muzzle. */
export function nearestCrystal(
  crystals: readonly CrystalMark[],
  x: number,
  z: number,
  range: number = HOWL_RANGE,
): CrystalMark | null {
  let best: CrystalMark | null = null;
  let bestD = range;
  for (const c of crystals) {
    const d = Math.hypot(c.x - x, c.z - z);
    if (d <= bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
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
 * Eighty cyan births. Returns the crystal id when one was inside 8 m.
 * The caller hides that card and drops its volume the same frame (law 52).
 * This function does not spawn a tree.
 */
export function birthHowl(
  buf: ParticleBuffers,
  now: number,
  bolt: readonly [number, number, number],
  yaw: number,
  crystals: readonly CrystalMark[],
): string | null {
  const hit = nearestCrystal(crystals, bolt[0], bolt[2]);
  const origin = hit ? ([hit.x, hit.y, hit.z] as const) : muzzlePoint(bolt[0], bolt[1], bolt[2], yaw);
  for (let n = 0; n < BURST_COUNT; n++) {
    const a = unit(now * 10 + n);
    const b = unit(now * 3 + n * 1.7);
    const ang = a * Math.PI * 2;
    const sp = 0.6 + b * 1.4;
    writeBirth(buf, now, KIND.burst, origin, [Math.cos(ang) * sp, 0.4 + b, Math.sin(ang) * sp], n + 1);
  }
  return hit ? hit.id : null;
}

export type ParticleInput = {
  now: number;
  bolt: readonly [number, number, number];
  yaw: number;
  /** Shift+WASD raises this. Paw sparks start above SPRINT_MIN. */
  sprintSpeed: number;
  /** Rising edge of H or Space. */
  howlDown: boolean;
  crystals: readonly CrystalMark[];
};

/**
 * CPU births only. Motes every 0.18 s. Paws every 0.06 s while sprinting.
 * A Howl edge writes 80 burst slots, or a muzzle burst when nothing is in range.
 */
export function tickBirths(
  buf: ParticleBuffers,
  clock: BirthClock,
  input: ParticleInput,
): { shattered: string | null } {
  let shattered: string | null = null;
  if (clock.mote < 0 || input.now - clock.mote >= MOTE_DT) {
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
  if (input.sprintSpeed > SPRINT_MIN && (clock.paw < 0 || input.now - clock.paw >= PAW_DT)) {
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
  if (input.howlDown && !clock.howl) {
    shattered = birthHowl(buf, input.now, input.bolt, input.yaw, input.crystals);
  }
  clock.howl = input.howlDown;
  return { shattered };
}

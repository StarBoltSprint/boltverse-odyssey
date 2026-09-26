import type { Hit, Kind, Volume } from "./types";

/**
 * Play. Law 52. What the paws mean. Does not import three.
 * Engine draws. This file does not.
 * One Bolt. The mesh path is the Pack KEEP. This kitchen does not cook a second wolf.
 */

/**
 * Hybrid KEEP. White coat, four legs. Bytes live in StarBoltSprint/bolt-hybrid.
 * This recipe does not copy them into a plate, a sheet, or a burst, and it does not cook another wolf.
 */
export const BOLT_GLB = "game/public/assets/bolt.glb";
/** Withers target, meters. Measure the KEEP once and lock the scale. */
export const BOLT_WITHERS_M = 0.6;
export const BOLT_CLIPS = ["idle", "walk", "sprint", "howl"] as const;
/** Name miss falls back to this index, then to idle. Do not synthesize a clip. */
export const BOLT_CLIP_INDEX = { idle: 0, walk: 1, sprint: 2, howl: 3 } as const;
/** The play mesh is never culled and has no LOD. A far tree may. */
export const BOLT_NEVER_CULL = true;
export const BOLT_NO_LOD = true;
/**
 * The idle clip keys translation on the bone named `root`. Strip that track.
 * SprintCore is the only translation. Two of them skate.
 */
export const BOLT_ROOT_MOTION = "strip" as const;
export const BOLT_ROOT_NODE = "root";
/** This KEEP is long on Z, and its POSITION min.y is 0. Proto yaw 0 looks down +Z. */
export const BOLT_KEEP_FACING = "+Z" as const;
/** Motion teacher stays the sealed cycle. It is not a second mesh beside the pawn. */
export const BOLT_MOTION = "lock/bolt-gallop-cycle.mp4";
export const BOLT_STYLE = "lock/bolt-back.jpg";

/** Pawn disk in xz. Not the fur, not a mesh AABB. Debug L draws it at h. */
export const PAWN_R = 0.32;
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

/** Cone reach, meters. Not a sphere. */
export const HOWL_RANGE = 8;
/** Full angle. The test uses the half-angle. */
export const HOWL_CONE_DEG = 25;
export const HOWL_HALF_DEG = 12.5;
/** Muzzle of the cone, in front of the pawn. Not the miss-burst distance. */
export const HOWL_ORIGIN_M = 0.4;
/** Open interval starts past this. A point on the nose is not a target. */
export const HOWL_INNER_M = 0.3;
/** Debug L. Gold wire, 8 m, this cone. */
export const HOWL_CONE_WIRE = "gold";
/**
 * Pose length when bolt.glb arrives. This kitchen does not load that clip.
 * H does not pause the ground plate.
 */
export const HOWL_CLIP_S = [0.4, 0.6] as const;
/** Oneshot length inside that band. The mixer does not loop it. */
export const HOWL_ONESHOT_S = 0.5;
export const HOWL_FADE_IN_MS = 60;
export const HOWL_FADE_OUT_MS = 100;
/** Walk ↔ sprint. The soft exit is the same window, not a second wait. */
export const GAIT_CROSSFADE_MS = 100;
export const CAM_BEHIND = 6.2;
export const CAM_HEIGHT = 2.4;
export const CAM_LOOK_UP = 0.7;
export const CAM_LOOK_MIN = 0.3;
/** Paw sparks sit just above the ground. */
export const PAW_LIFT = 0.12;
/** Shatter on the press frame. 0.2 s is optional and not the default. */
export const HOWL_HIT_S = 0;
export const HOWL_HIT_OPTIONAL_S = 0.2;
export const HOWL_PAUSES_GROUND = false;
/** Miss sparks sit this far in front of the pawn. */
export const MUZZLE_M = 1.2;
/** SmiR KEEP. Law 32. Do not recook the rings. */
export const HOWL_KEEP = "biome/fx/howl/howl-attack.mp4";
/**
 * Burst film names. No bytes in this PR.
 * v0–v3 match the crystal sheet. Frame 0 still is CRYSTAL_BURST_FRAME0.
 */
export const CRYSTAL_BURST_DIR = "public/decor/jade/fx";
export const CRYSTAL_BURST_FRAME0 = `${CRYSTAL_BURST_DIR}/crystal_burst_v0.png`;
/** Same quad as the crystal sheet card (two-plane crystal 0.7 × 1.6). */
export const CRYSTAL_CARD = { w: 0.7, h: 1.6 } as const;
/** Hide the burst quad after this. Picture-time seconds. */
export const BURST_FREE_S = 1.1;
export const BURST_MS = 1100;
export const CRYSTAL_BURST = crystalBurstMp4(0);

const HOWL_COS = Math.cos((HOWL_HALF_DEG * Math.PI) / 180);

export function crystalBurstMp4(variant: number): string {
  const v = ((variant % 4) + 4) % 4;
  return `${CRYSTAL_BURST_DIR}/crystal_burst_v${v}.mp4`;
}

/** yaw 0 looks down +z. Lane L/C/R later passes that lane's yaw here. */
export function howlForward(yaw: number): [number, number] {
  return [Math.sin(yaw), Math.cos(yaw)];
}

export function howlOrigin(x: number, z: number, yaw: number): [number, number] {
  const [fx, fz] = howlForward(yaw);
  return [x + fx * HOWL_ORIGIN_M, z + fz * HOWL_ORIGIN_M];
}

export type PawTouch = "block" | "fern" | "crystal-walk" | "howl-confirm" | "howl-miss";

/**
 * Crystal shatters only on a confirmed Howl inside the cone.
 * A body overlap is the soft drag. A Howl that misses the cone is pose and muzzle.
 * `inCone` is `inHowlCone`. There is not a second test.
 */
export function pawTouch(kind: Kind, howl: boolean, inCone: boolean, overlap: boolean): PawTouch | null {
  if (kind === "crystal" && howl && inCone) return "howl-confirm";
  if (overlap && kind === "fern") return "fern";
  if (overlap && kind === "crystal") return "crystal-walk";
  if (overlap && (kind === "bole" || kind === "elder" || kind === "ruin")) return "block";
  if (howl && !inCone) return "howl-miss";
  return null;
}

/**
 * One cone. Field uses the mesh yaw. The 3-lane howlPose uses this same function.
 * Range 8 m, half-angle 12.5° (25° full). Origin is the pawn plus forward × 0.4.
 * Valid distance is (0.3, 8].
 */
export function inHowlCone(
  camX: number,
  camZ: number,
  yaw: number,
  x: number,
  z: number,
): boolean {
  const [ox, oz] = howlOrigin(camX, camZ, yaw);
  const dx = x - ox;
  const dz = z - oz;
  const dist = Math.hypot(dx, dz);
  if (!(dist > HOWL_INNER_M && dist <= HOWL_RANGE)) return false;
  const [fx, fz] = howlForward(yaw);
  const dot = (dx / dist) * fx + (dz / dist) * fz;
  return dot >= HOWL_COS;
}

export type HowlCandidate = {
  id: string;
  x: number;
  z: number;
  h: number;
  yaw: number;
  variant: number;
  hit: Hit;
  groundY: number;
  w?: number;
};

/** Burst quad. Same yaw and scale as the sheet card. Freed after 1.1 s. The id stays shattered. */
export type BurstQuad = {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  w: number;
  h: number;
  variant: number;
  /** Picture-time seconds. Pause passes dt 0. */
  t: number;
  muted: true;
  playing: boolean;
  src: string | null;
};

export type HowlVerb = {
  /** Rising edge that was allowed to fire. A hold is not a second shot. */
  fired: boolean;
  pose: boolean;
  muzzle: boolean;
  targetId: string | null;
  quad: BurstQuad | null;
  /** 80 stand-in, 40 halo, 0 when this tick did not birth. */
  points: number;
  icing: "stand-in" | "halo" | null;
  origin: [number, number, number] | null;
};

const shattered = new Set<string>();
const quads = new Map<string, BurstQuad>();
let held = false;

/** True while H is down after the press has already fired. */
export function howlArmed(): boolean {
  return held;
}

export function isShattered(id: string): boolean {
  return shattered.has(id);
}

export function shatteredIds(): readonly string[] {
  return [...shattered];
}

/** Same frame as the verb. Sheet rows and volumes both drop. */
export function dropShattered<T extends { id: string }>(list: readonly T[]): T[] {
  return list.filter((item) => !shattered.has(item.id));
}

export function forgetShattered(ids: readonly string[]): void {
  for (const id of ids) {
    shattered.delete(id);
    quads.delete(id);
  }
}

export function burstOf(id: string): BurstQuad | undefined {
  return quads.get(id);
}

export function resetHowl(): void {
  shattered.clear();
  quads.clear();
  held = false;
}

/** Smallest distance inside the cone. Already shattered ids are skipped. Hit must be shatter. */
export function pickHowlTarget(
  pawnX: number,
  pawnZ: number,
  yaw: number,
  candidates: readonly HowlCandidate[],
): HowlCandidate | null {
  const [ox, oz] = howlOrigin(pawnX, pawnZ, yaw);
  let best: HowlCandidate | null = null;
  let bestD = Infinity;
  for (const c of candidates) {
    if (c.hit !== "shatter") continue;
    if (shattered.has(c.id)) continue;
    if (!inHowlCone(pawnX, pawnZ, yaw, c.x, c.z)) continue;
    const d = Math.hypot(c.x - ox, c.z - oz);
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

function ageBursts(dt: number): void {
  if (!(dt > 0)) return;
  for (const [id, q] of quads) {
    q.t += dt;
    if (q.t > BURST_FREE_S) quads.delete(id);
  }
}

/**
 * One Howl per press. Cone, one target, shatter only when hit is shatter.
 * A miss is the pose and the muzzle sparks. Nothing is deleted.
 * The burst quad advances by sim dt. Pause passes dt 0. This does not read the wall clock
 * and does not pause the ground plate.
 * Call it every picture tick, whether H is down or not, so the quad ages.
 * Then `tickField`: the field omits shattered ids on that same frame.
 */
export function howlVerb(input: {
  howlDown: boolean;
  /** Sim seconds. Ignored while paused. */
  dt: number;
  paused?: boolean;
  pawn: { x: number; z: number; yaw: number; y?: number };
  candidates: readonly HowlCandidate[];
  /** True when that variant's mp4 is bound. Unbound still breaks the crystal. */
  filmBound?: (variant: number) => boolean;
}): HowlVerb {
  ageBursts(input.paused ? 0 : input.dt);
  const rising = input.howlDown && !held;
  held = input.howlDown;
  const empty: HowlVerb = {
    fired: false,
    pose: false,
    muzzle: false,
    targetId: null,
    quad: null,
    points: 0,
    icing: null,
    origin: null,
  };
  if (!rising) return empty;

  const target = pickHowlTarget(input.pawn.x, input.pawn.z, input.pawn.yaw, input.candidates);
  if (!target) {
    const [fx, fz] = howlForward(input.pawn.yaw);
    const y = input.pawn.y ?? 0;
    return {
      fired: true,
      pose: true,
      muzzle: true,
      targetId: null,
      quad: null,
      points: 80,
      icing: "stand-in",
      origin: [input.pawn.x + fx * MUZZLE_M, y, input.pawn.z + fz * MUZZLE_M],
    };
  }

  shattered.add(target.id);
  const h = target.h > 0 ? target.h : CRYSTAL_CARD.h;
  const w = target.w ?? CRYSTAL_CARD.w;
  const bound = input.filmBound?.(target.variant) ?? false;
  const quad: BurstQuad = {
    id: target.id,
    x: target.x,
    y: target.groundY + h * 0.5,
    z: target.z,
    yaw: target.yaw,
    w,
    h,
    variant: target.variant,
    t: 0,
    muted: true,
    playing: bound,
    src: bound ? crystalBurstMp4(target.variant) : null,
  };
  quads.set(target.id, quad);
  return {
    fired: true,
    pose: true,
    muzzle: false,
    targetId: target.id,
    quad,
    points: bound ? 40 : 80,
    icing: bound ? "halo" : "stand-in",
    origin: [quad.x, quad.y, quad.z],
  };
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
 * `clip` is the fern note. The mixer reads `stepGait`. This function does not import three.
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

export type GaitMem = { outsideMs: number; holding: boolean; howlLeft: number; prev: ClipName };

export type GaitPresent = { walk?: boolean; sprint?: boolean; howl?: boolean };

export type GaitStep = {
  /** Clip the graph asked for. */
  clip: ClipName;
  /** Clip the mixer actually plays after a missing-name fallback. */
  play: ClipName;
  timeScale: number;
  /** One blend. The soft exit does not add a second delay on top of this. */
  fadeMs: number;
  /** True on the H edge even when the howl clip is missing. The cook still fires. */
  howlCook: boolean;
  mem: GaitMem;
};

export function resetGait(): GaitMem {
  return { outsideMs: SOFT_CLIP_HOLD_MS, holding: false, howlLeft: 0, prev: "idle" };
}

function walkScale(speed: number): number {
  return 0.8 + speed * 0.15;
}

function sprintScale(m: number): number {
  return 0.9 + Math.min(0.25, m * 0.02);
}

/**
 * Mixer graph for the pawn mesh. Shift does not beat a fern.
 * Howl oneshot wins, then the fallback. Idle wins under 0.2.
 * Leaving the disk holds walk 80 ms, and that is the only wait before sprint.
 * A missing howl clip holds idle or walk and still reports howlCook.
 * A missing sprint clip plays walk, scaled by speed. No second wolf.
 */
export function stepGait(
  speed: number,
  inSoft: boolean,
  mem: GaitMem,
  dtMs: number,
  _shift = false,
  extra?: { m?: number; howlEdge?: boolean; present?: GaitPresent },
): GaitStep {
  const present = {
    walk: extra?.present?.walk !== false,
    sprint: extra?.present?.sprint !== false,
    howl: extra?.present?.howl !== false,
  };
  const m = extra?.m ?? 0;
  let howlLeft = mem.howlLeft ?? 0;
  const howlCook = extra?.howlEdge === true;
  if (howlCook && present.howl) howlLeft = HOWL_ONESHOT_S;
  const howlPlaying = present.howl && howlLeft > 0;

  let outsideMs = mem.outsideMs;
  let holding = mem.holding;
  const wasHolding = holding;
  if (inSoft) {
    outsideMs = 0;
    holding = true;
  } else if (holding) {
    outsideMs += dtMs;
    if (outsideMs >= SOFT_CLIP_HOLD_MS) holding = false;
  }

  let clip: ClipName;
  if (howlPlaying) clip = "howl";
  else if (speed < GAIT_IDLE_SPEED) clip = "idle";
  else if (inSoft || holding) clip = "walk";
  else if (speed < GAIT_SPRINT_SPEED) clip = "walk";
  else clip = "sprint";

  let play = clip;
  let timeScale = 1;
  if (clip === "howl") timeScale = 1;
  else if (clip === "idle") timeScale = 1;
  else if (inSoft && clip === "walk") timeScale = 0.85;
  else if (clip === "walk") timeScale = walkScale(speed);
  else timeScale = sprintScale(m);

  if (clip === "sprint" && !present.sprint) {
    play = present.walk ? "walk" : "idle";
    timeScale = walkScale(speed);
  } else if (clip === "walk" && !present.walk) {
    play = "idle";
    timeScale = speed < GAIT_IDLE_SPEED ? 1 : walkScale(speed);
  }

  const prev = mem.prev ?? "idle";
  const releasedSoft = wasHolding && !holding && prev === "walk" && play === "sprint";
  let fadeMs = 0;
  if (howlCook && play === "howl") fadeMs = HOWL_FADE_IN_MS;
  else if (prev === "howl" && play !== "howl") fadeMs = HOWL_FADE_OUT_MS;
  else if (play !== prev) {
    const walkSprint =
      (prev === "walk" && play === "sprint") || (prev === "sprint" && play === "walk");
    fadeMs = walkSprint && releasedSoft ? SOFT_CLIP_HOLD_MS : GAIT_CROSSFADE_MS;
  }
  if (play === prev) fadeMs = 0;

  if (play === "howl") howlLeft = Math.max(0, howlLeft - dtMs / 1000);
  else howlLeft = 0;

  return {
    clip,
    play,
    timeScale,
    fadeMs,
    howlCook,
    mem: { outsideMs, holding, howlLeft, prev: play },
  };
}

/**
 * Name first. Index only when the name is absent. Never invent a clip.
 * The Hybrid KEEP currently ships `idle` alone. Walk, sprint, and howl stay named slots.
 */
export function resolveClip(
  names: readonly string[],
  want: ClipName,
): { name: string; index: number; missing: boolean } {
  const hit = names.findIndex((n) => n.toLowerCase() === want);
  if (hit >= 0) return { name: names[hit], index: hit, missing: false };
  if (want === "sprint") {
    const walk = names.findIndex((n) => n.toLowerCase() === "walk");
    if (walk >= 0) return { name: names[walk], index: walk, missing: true };
  }
  if (want !== "idle") {
    const idle = names.findIndex((n) => n.toLowerCase() === "idle");
    if (idle >= 0) return { name: names[idle], index: idle, missing: true };
  }
  const index = BOLT_CLIP_INDEX[want] ?? 0;
  return {
    name: names[index] ?? want,
    index: names.length ? Math.min(index, names.length - 1) : index,
    missing: true,
  };
}

/** Measure withers once. boundsMinY is unscaled. Paws on the ground stay at offset 0. */
export function lockBolt(measuredWithersM: number, boundsMinY = 0): { scale: number; yOffset: number } {
  const scale = measuredWithersM > 1e-4 ? BOLT_WITHERS_M / measuredWithersM : 1;
  const yOffset = -boundsMinY * scale;
  return { scale, yOffset: yOffset === 0 ? 0 : yOffset };
}

/** gltf root. Yaw 0 is +Z. A KEEP that faces +X takes π/2 once. Root motion stays stripped. */
export function placeRoot(
  bolt: { x: number; z: number; yaw: number },
  groundY: number,
  yOffset = 0,
  facing: "+Z" | "+X" = BOLT_KEEP_FACING,
): { x: number; y: number; z: number; yaw: number; rootMotion: "strip" } {
  const yawFix = facing === "+X" ? Math.PI / 2 : 0;
  return {
    x: bolt.x,
    y: groundY + yOffset,
    z: bolt.z,
    yaw: bolt.yaw + yawFix,
    rootMotion: "strip",
  };
}

/** Boom on the root. Not a bone, not a clip, not a camera baked into a plate. */
export function boomCamera(
  x: number,
  z: number,
  yaw: number,
  groundY: number,
): { x: number; y: number; z: number; lookX: number; lookY: number; lookZ: number; parent: "root" } {
  const [fx, fz] = howlForward(yaw);
  let lookY = groundY + CAM_LOOK_UP;
  const floorY = groundY + CAM_LOOK_MIN;
  if (lookY < floorY) lookY = floorY;
  return {
    x: x - fx * CAM_BEHIND,
    y: groundY + CAM_HEIGHT,
    z: z - fz * CAM_BEHIND,
    lookX: x,
    lookY,
    lookZ: z,
    parent: "root",
  };
}

export function pawSparkPoint(x: number, groundY: number, z: number): [number, number, number] {
  return [x, groundY + PAW_LIFT, z];
}

/** Debug L. The disk at h. Not the mesh bounds. */
export function debugDisc(x: number, z: number, groundY: number): { x: number; y: number; z: number; r: number } {
  return { x, y: groundY, z, r: PAWN_R };
}

/**
 * Remix pools. One InstancedMesh per name. This file does not import three.
 * Idle cutouts stay in the pool. A fade (≤8) leaves the pool as its own kit.
 * Crown is the near channel only. No per-instance transparent material.
 * With zero fades the woods, the plates, and Bolt are about six draws.
 */
export const INSTANCE_POOLS = ["bole", "elder", "ruin", "crystal", "fern", "impostor", "crown"] as const;
export const IDLE_DRAWS = 6;

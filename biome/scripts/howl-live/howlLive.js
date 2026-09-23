/**
 * Howl live aim — law 34.
 *
 * Distance-adaptive KEEP composite: Bolt mouth → rail-B dest.
 * The Imagine plate does not slide. The trapezoid is already the whole trip.
 * On howlT >= 1, pause the Howl video (even if not finished) and swap shatter.
 *
 *   import { HOWL, howlFireSec, howlFxBeam, howlPose, pickHowlLane } from "./howlLive.js";
 *
 * Copy into Live (plates.ts). Do not invent a laser or a shader of rings.
 * KEEP: biome/fx/howl/howl-attack.mp4
 */
export const HOWL = {
  travel: 6.4,
  exitZ: -0.16,
  firstDelay: 2.35,
  cooldown: 1.65,
  fireSec: 0.74,
  arrive: 1,
  shatterSec: 0.86,
  startSec: 0.04,
  /** Seconds of howl-attack.mp4 that hold the useful rings (birth → wide). */
  clipFront: 3.1,
  destroyable: true,
  jumpClears: false,
};

/** Native KEEP 784×1168. Dest length is Bolt→rock, not this. */
export const HOWL_FX_ASPECT = 784 / 1168;
export const HOWL_ASPECT = 9 / 16;
export const VP = { x: 0.514, y: 0.415 };
export const LANE_W = 0.19;

/**
 * Plate zones on the same cone.
 * road = the 3 gameplay lanes (path beat, Howl hits, critical openables).
 * sideL / sideR = shoulders, calm void, berms. Décor LOD, lights,
 * openables, and generators may sit there. Densify does not bake that clutter.
 */
export const PLATE_ZONES = ["road", "sideL", "sideR"];

/** One step outside L/R, in lane-widths. Still on the plate. Still howlPose. */
export const SHOULDER_LANE = 1.7;

/** road | sideL | sideR. shoulderL / shoulderR are aliases. Unknown → null. */
export function normalizePlateZone(zone) {
  if (zone == null || zone === "" || zone === "road" || zone === "lane" || zone === "lanes") return "road";
  if (zone === "sideL" || zone === "shoulderL" || zone === "shoulder-l") return "sideL";
  if (zone === "sideR" || zone === "shoulderR" || zone === "shoulder-r") return "sideR";
  return null;
}

/**
 * Lane index for howlPose.
 * road uses -1 | 0 | 1. sideL / sideR ignore the gameplay lane and sit on the shoulder.
 */
export function poseLane(plateZone, lane) {
  const z = normalizePlateZone(plateZone);
  if (z === "sideL") return -SHOULDER_LANE;
  if (z === "sideR") return SHOULDER_LANE;
  if (z !== "road") return null;
  if (lane === "L" || lane === "l" || lane === -1) return -1;
  if (lane === "C" || lane === "c" || lane === "M" || lane === "m" || lane === 0) return 0;
  if (lane === "R" || lane === "r" || lane === 1) return 1;
  return null;
}

/**
 * Wall-clock seconds the Howl video is allowed to play, from mouth to rock.
 * Farther rock → slightly longer (capped). Never overshoot: Live cuts at arrive.
 */
export function howlFireSec(dist, canvasH) {
  const n = dist / Math.max(canvasH, 1);
  return Math.min(0.7, Math.max(0.32, 0.3 + n * 0.72));
}

export function howlPlayRate(fireSec) {
  return HOWL.clipFront / Math.max(fireSec, 0.08);
}

/**
 * Trapezoid in pixel space. A,C = mouth (Bolt-head thick). B,D = inset tip (prop thick).
 * KEEP uv.x travels mouth → rock. Rings stay put; the video fills the beam.
 */
export function howlFxBeam(mouthX, mouthY, rockX, rockY, rockW, destW) {
  const dx = rockX - mouthX;
  const dy = rockY - mouthY;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const inset = Math.min(rockW * 0.14, len * 0.08);
  const fx = rockX - ux * inset;
  const fy = rockY - uy * inset;
  const t0 = Math.min(destW * 0.3, rockW * 0.55);
  const t1 = Math.max(rockW * 1.02, destW * 0.22);
  const hx0 = px * t0 * 0.5;
  const hy0 = py * t0 * 0.5;
  const hx1 = px * t1 * 0.5;
  const hy1 = py * t1 * 0.5;
  return {
    ax: mouthX - hx0,
    ay: mouthY - hy0,
    bx: fx - hx1,
    by: fy - hy1,
    cx: mouthX + hx0,
    cy: mouthY + hy0,
    dx: fx + hx1,
    dy: fy + hy1,
    len,
    inset,
    t0,
    t1,
  };
}

/**
 * rAF step. Call after sampling mouth/rock this frame.
 * Returns { howlT, fireSec, playRate, beam, hit, cut }.
 * `hit` = first frame of contact. `cut` = Howl must pause now.
 */
export function howlStep(state, dt, mouth, rock, rockW, destW, canvasH) {
  const dist = Math.hypot(rock.x - mouth.x, rock.y - mouth.y);
  let fireSec = state.fireSec;
  if (!(fireSec > 0)) fireSec = howlFireSec(dist, canvasH);
  const howlT = Math.min(1, (state.howlT < 0 ? 0 : state.howlT) + dt / fireSec);
  const beam = howlFxBeam(mouth.x, mouth.y, rock.x, rock.y, rockW, destW);
  const hit = howlT >= HOWL.arrive;
  return {
    howlT: hit ? -1 : howlT,
    fireSec,
    playRate: howlPlayRate(fireSec),
    beam,
    gain: 0.88 + Math.min(howlT, 1) * 0.55,
    hit,
    cut: hit,
  };
}

/** Cone plant for a rail-B obstacle. z: 1 (VP, tiny) → exitZ (past Bolt). */
export function howlPose(lane, z, cw, ch, destH0, pawY) {
  const u = 1 - z;
  const t = u <= 1 ? u ** 1.7 : 1 + (u - 1) * 1.45;
  const nearX = 0.5 + lane * LANE_W;
  const x = (VP.x + (nearX - VP.x) * Math.min(t, 1.35)) * cw;
  const groundY = VP.y * ch + (pawY - VP.y * ch) * Math.min(t, 1.12);
  const scale = 0.14 + 1.18 * Math.min(t, 1.02);
  let destH = destH0 * scale;
  let destW = destH * HOWL_ASPECT;
  const maxW = cw * 0.38;
  if (destW > maxW) {
    const k = maxW / destW;
    destW *= k;
    destH *= k;
  }
  return {
    dest: { x: x - destW / 2, y: groundY - destH * 0.92, w: destW, h: destH },
    ground: { x, y: groundY },
    t,
    scale,
    near: t >= 0.78 && t <= 1.05,
    howlable: t >= 0.18 && t <= 0.92,
    front: t > 1,
  };
}

/** Never close the last free corridor. If rail A already holds 2 lanes, return null. */
export function pickHowlLane(blocked, plate, rand) {
  const all = [-1, 0, 1];
  const occ = new Set([...blocked, ...plate]);
  if (occ.size >= 2) {
    const share = all.filter((l) => occ.has(l));
    if (!share.length) return null;
    return share[Math.min(share.length - 1, (rand * share.length) | 0)];
  }
  const prefer = all.filter((l) => !occ.has(l));
  const pool = prefer.length ? prefer : all;
  return pool[Math.min(pool.length - 1, (rand * pool.length) | 0)];
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

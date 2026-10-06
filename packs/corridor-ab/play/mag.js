/**
 * Magnification and the framing-capped chase shell.
 * Placement and sampling only. No new pixels.
 *
 * mag = FOCAL * worldExtent / (distance * sourcePixels).
 * The portrait focal matches packs/corridor-ab/play/play.js (720×1600, hfov 22.7°).
 */
import { CHASE_BOOM, CHASE_EYE, CHASE_SLIDE, chaseEye } from "./look.js";
import { RISE_M, rockBottom } from "./stream.js";
import { GATE_CLOSE_SWITCH } from "../../zone-a/play/ruins.js";

const HFOV = 22.7 * Math.PI / 180;
const ASPECT = 720 / 1600;
export const VFOV = 2 * Math.atan(Math.tan(HFOV / 2) / ASPECT);
export const FOCAL = 800 / Math.tan(VFOV / 2);
export const MAG_LIMIT = 1;
export const MAG_TARGET = 0.98;
/** Horizontal eye distance that still keeps Bolt in the lower third. */
export const BOOM_CAP = 7.45;
export const BOOM_MIN = 4.8;
/** Metres of air between the eye and a ruin face. Stops a clip. Does not invent texels. */
export const RUIN_CLEAR = 0.85;

const TILE = 1.45;
const GROUND_SRC = 1024;
const BOLT_H = 2.15;
const BOLT_SRC_H = 1168;

export const MESH = {
  boulder: {
    minY: -0.725072979927063,
    maxY: 0.2496240884065628,
    hx: 0.6472405791282654,
    hz: 0.6719579100608826,
    srcH: 512,
    size: [1.55, 1.35, 1.45],
  },
  stone: {
    minY: -0.5101956129074097,
    maxY: 0.39859840273857117,
    hx: 0.2886483371257782,
    hz: 0.2686430513858795,
    srcH: 512,
    size: [0.54, 0.95, 0.5],
  },
};

/**
 * Baked seats and local bounds from packs/zone-a/src/ruins/manifest.json.
 * open is the doorway in local x/y. The wreck has no doorway box.
 */
export const RUIN = {
  arch: {
    tpm: 155.81,
    close: 0,
    yaw: -3.1227,
    bx: -5,
    bz: 39,
    min: [-2.266, 0.013, -2.89],
    max: [2.259, 7.394, 0],
    open: [-1.303, 1.123, 0, 5.186],
  },
  gate: {
    tpm: 36.64,
    close: 182.99,
    yaw: -2.5891,
    bx: 18.451,
    bz: 25.657,
    min: [-8.078, 0, -6.82],
    max: [8.023, 27.7, 0],
    open: [-5.021, 4.421, 0.055, 18.585],
  },
  wreck: {
    tpm: 70.03,
    close: 0,
    yaw: 3.5779,
    bx: -24,
    bz: 14,
    ship: true,
    min: [-16.039, 0, -2.031],
    max: [15.996, 4.116, 2.055],
    open: null,
  },
};

export function focal() {
  return FOCAL;
}

export function groundMag(eyeY, pitch) {
  const bottom = pitch - VFOV * 0.5;
  const drop = -bottom;
  if (!(drop > 0.05)) return 0;
  const dist = eyeY / Math.sin(drop);
  return (FOCAL * (TILE / GROUND_SRC)) / dist;
}

export function boltMag(boom) {
  return (FOCAL * BOLT_H) / (Math.max(0.2, boom) * BOLT_SRC_H);
}

/** Elevation until it would pass the plate switch, then the plate's own density. */
export function ruinShownMag(kind, dist) {
  if (!(dist > 1e-4)) return Infinity;
  const spec = RUIN[kind];
  let m = FOCAL / (spec.tpm * dist);
  if (spec.close && m >= GATE_CLOSE_SWITCH) m = FOCAL / (spec.close * dist);
  return m;
}

export function artFloor(kind) {
  const spec = RUIN[kind];
  const tpm = spec.close || spec.tpm;
  return FOCAL / (tpm * MAG_TARGET);
}

export function rockShell(slot) {
  const type = slot.kind === 2 ? "boulder" : "stone";
  const mesh = MESH[type];
  const meshH = mesh.maxY - mesh.minY;
  const draw = (mesh.size[1] * slot.base * slot.emerge) / meshH;
  const y = rockBottom(slot.emerge) - mesh.minY * draw + (mesh.maxY + mesh.minY) * 0.5 * draw;
  return {
    id: type + ":" + slot.id,
    x: slot.x,
    y,
    z: slot.z,
    rad: Math.max(mesh.hx, mesh.hz) * draw,
    worldH: meshH * draw,
    srcH: mesh.srcH,
  };
}

export function rockShells(pool) {
  const out = [];
  for (let i = 0; i < pool.length; i++) {
    const slot = pool[i];
    if (!slot.on || slot.kind > 2 || slot.emerge < 0.35) continue;
    out.push(rockShell(slot));
  }
  return out;
}

/** Distance from the eye to the rock cylinder (side radius, height of the drawn mesh). */
export function rockDist(eye, rock) {
  const hl = Math.hypot(eye[0] - rock.x, eye[2] - rock.z);
  const radial = Math.max(0, hl - rock.rad);
  const half = rock.worldH * 0.5;
  const cy = Math.max(rock.y - half, Math.min(rock.y + half, eye[1]));
  return Math.hypot(radial, eye[1] - cy);
}

export function rockMag(eye, rock) {
  const dist = rockDist(eye, rock);
  if (!(dist > 1e-4)) return Infinity;
  return (FOCAL * rock.worldH) / (dist * rock.srcH);
}

function toLocal(kind, eye, slot) {
  const o = RUIN[kind];
  const s = Math.max(slot.emerge, 0.05);
  const rise = (slot.emerge - 1) * RISE_M;
  const dx = o.bx + (eye[0] - slot.x) / s - o.bx;
  const dz = o.bz + (eye[2] - slot.z) / s - o.bz;
  const y = (eye[1] - rise) / s;
  const sn = Math.sin(o.yaw);
  const cs = Math.cos(o.yaw);
  let lx;
  let lz;
  if (o.ship) {
    lx = dx * sn + dz * cs;
    lz = -dx * cs + dz * sn;
  } else {
    lx = dx * cs - dz * sn;
    lz = dx * sn + dz * cs;
  }
  return [lx, y, lz];
}

function outsideAabb(p, min, max) {
  const q = [
    Math.max(min[0], Math.min(max[0], p[0])),
    Math.max(min[1], Math.min(max[1], p[1])),
    Math.max(min[2], Math.min(max[2], p[2])),
  ];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

/**
 * Distance to the solid, in metres.
 * A doorway is empty: the piers and the lintel are the surfaces, not the box interior.
 * Inside a solid, the number is the distance to the nearest face (a clip).
 */
export function ruinFaceDist(kind, eye, slot) {
  const o = RUIN[kind];
  const p = toLocal(kind, eye, slot);
  const outside = outsideAabb(p, o.min, o.max);
  if (outside > 1e-4) return { dist: outside, inside: false };
  if (o.open) {
    const x0 = o.open[0];
    const x1 = o.open[1];
    const y0 = o.open[2];
    const y1 = o.open[3];
    if (p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1) {
      const dx = Math.min(p[0] - x0, x1 - p[0]);
      const dy = Math.min(p[1] - y0, y1 - p[1]);
      return { dist: Math.min(dx, dy), inside: false, opening: true };
    }
  }
  let d = Math.min(
    p[0] - o.min[0],
    o.max[0] - p[0],
    p[1] - o.min[1],
    o.max[1] - p[1],
    p[2] - o.min[2],
    o.max[2] - p[2],
  );
  return { dist: Math.max(0, d), inside: true };
}

/**
 * Slide the eye off near rock shells and off ruin faces.
 * Eye height stays at the chase. Horizontal distance from Bolt stays inside
 * BOOM_MIN..BOOM_CAP so the lower-third framing holds.
 */
const KINDS = ["arch", "gate", "wreck"];

function eyeCost(eye, bodyX, bodyZ, rocks, field, restA, restB) {
  let rock = 0;
  for (let i = 0; i < rocks.length; i++) rock = Math.max(rock, rockMag(eye, rocks[i]));
  let clip = 0;
  let air = 0;
  for (let k = 0; k < KINDS.length; k++) {
    const slot = field[KINDS[k]];
    if (!slot || !(slot.emerge > 0.35)) continue;
    const dist = ruinFaceDist(KINDS[k], eye, slot).dist;
    if (dist < 0.35) clip += 0.35 - dist;
    else if (dist < RUIN_CLEAR) air += RUIN_CLEAR - dist;
  }
  let da = Math.atan2(eye[0] - bodyX, eye[2] - bodyZ) - restA;
  if (da > Math.PI) da -= Math.PI * 2;
  else if (da < -Math.PI) da += Math.PI * 2;
  const boom = Math.hypot(eye[0] - bodyX, eye[2] - bodyZ);
  let cost = 0;
  if (rock > MAG_TARGET) cost += (rock - MAG_TARGET) * 100;
  cost += clip * 80;
  cost += air * 2;
  cost += Math.abs(da) * 0.15;
  cost += Math.abs(boom - restB) * 0.02;
  return cost;
}

/**
 * The cleared eye stays on the rest ray behind Bolt. Boom may lengthen up to BOOM_CAP.
 * A yaw search would slide Bolt off the centre of the phone. Ties keep the rest eye.
 */
function worstRock(eye, rocks) {
  let rock = 0;
  for (let i = 0; i < rocks.length; i++) rock = Math.max(rock, rockMag(eye, rocks[i]));
  return rock;
}

export function clearEye(eye, bodyX, bodyZ, rocks, field) {
  const restA = Math.atan2(eye[0] - bodyX, eye[2] - bodyZ);
  const restB = Math.hypot(eye[0] - bodyX, eye[2] - bodyZ) || restBoom();
  const sn = Math.sin(restA);
  const cs = Math.cos(restA);
  let under = null;
  let underCost = Infinity;
  let fallback = [eye[0], CHASE_EYE, eye[2]];
  let fallbackWorst = worstRock(fallback, rocks);
  for (let boom = BOOM_MIN; boom <= BOOM_CAP + 1e-6; boom += 0.2) {
    const trial = [bodyX + sn * boom, CHASE_EYE, bodyZ + cs * boom];
    const worst = worstRock(trial, rocks);
    const cost = eyeCost(trial, bodyX, bodyZ, rocks, field, restA, restB);
    if (worst <= MAG_TARGET && cost < underCost) {
      under = trial;
      underCost = cost;
    }
    if (worst < fallbackWorst - 1e-6 || (Math.abs(worst - fallbackWorst) < 1e-6 && boom > boomOf(fallback, bodyX, bodyZ))) {
      fallback = trial;
      fallbackWorst = worst;
    }
  }
  if (under) return under;
  return [bodyX + sn * BOOM_CAP, CHASE_EYE, bodyZ + cs * BOOM_CAP];
}

export function restEye(heading, x, z) {
  return chaseEye(heading, x, z);
}

export function boomOf(eye, x, z) {
  return Math.hypot(eye[0] - x, eye[2] - z);
}

export function restBoom() {
  return Math.hypot(CHASE_BOOM, CHASE_SLIDE);
}

/**
 * Seeded placement streaming. The corridor WFC solve stays at load.
 * This pool only seats already-cooked hulls and lofts ahead of Bolt.
 * The same seed and the same speed history rebuild the same slots.
 * Nothing here draws a pixel or builds a mesh.
 */

import { SPRINT_MAX, WALK_SPD, stepCharge, stepSpeed } from "./look.js";

export const CELL = 9;
export const NEAR_M = 14;
export const BEHIND_M = 22;
export const EMERGE_SEC = 1.15;
export const RISE_M = 2.2;
export const ROCK_SINK = 0.18;
export const POOL = 36;
export const FIELD_HALF = 48;
export const HORIZON_N = 8;
export const HORIZON_STEP = 28;
export const GATE_LAT = 16;
export const GATE_FIRST = 54;
export const PASS_BACK = 118;
export const CARPET_APRON = 40;

const KIND_STONE = 1;
const KIND_BOULDER = 2;
const KIND_ARCH = 3;
const KIND_GATE = 4;
const KIND_WRECK = 5;

const LANES = [-2.15, 2.15, -2.85, 2.85, -4.6, 4.6, -9, 9, -18, 18, -30, 30, -42, 42];

const ROCK = {
  1: { size: [0.54, 0.95, 0.5], scale: [0.7, 1] },
  2: { size: [1.55, 1.35, 1.45], scale: [0.85, 1.05] },
};

const MONU = {
  3: { first: 22, gap: 68, lateral: 0 },
  4: { first: GATE_FIRST, gap: 96, lateral: GATE_LAT },
  5: { first: 34, gap: 84, lateral: 3.6 },
};

/**
 * West edge of the one ground quad.
 * The pass shot stands PASS_BACK metres before the gate, which is west of the
 * corridor apron. The quad has to include that ground or the near floor is black.
 */
export function carpetWest(xStart, passBoltX) {
  return Math.min(xStart - CARPET_APRON, passBoltX - CARPET_APRON);
}

/** Base of a rock, metres. Settled sits ROCK_SINK below the plane. Rising is lower. */
export function rockBottom(emerge) {
  const e = emerge < 0 ? 0 : emerge > 1 ? 1 : emerge;
  return -ROCK_SINK + (e - 1) * RISE_M;
}

function lateralOf(kind, n) {
  const spec = MONU[kind];
  if (kind !== KIND_GATE) return spec.lateral;
  return (n % 2 === 0 ? 1 : -1) * spec.lateral;
}

function hash01(n) {
  let x = n >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

function mix(seed, a, b) {
  return (Math.imul(seed, 0x9e3779b1) ^ Math.imul(a, 0x85ebca6b) ^ Math.imul(b, 0xc2b2ae35)) >>> 0;
}

export function lookAhead(speed) {
  return 24 + Math.max(0, speed) * 3.6;
}

export function halfWidth(charge) {
  const c = charge < 0 ? 0 : charge > 1 ? 1 : charge;
  return 10 + 34 * c;
}

export function densityOf(charge) {
  const c = charge < 0 ? 0 : charge > 1 ? 1 : charge;
  return 0.34 + 0.66 * c;
}

function footprint(kind, scale) {
  const size = ROCK[kind].size;
  return 0.5 * Math.hypot(size[0], size[2]) * scale;
}

function blank(slot) {
  slot.on = 0;
  slot.keep = 0;
  slot.id = 0;
  slot.kind = 0;
  slot.x = 0;
  slot.z = 0;
  slot.yaw = 0;
  slot.base = 1;
  slot.emerge = 0;
  slot.r = 0;
}

export function createField(opts) {
  const pool = new Array(POOL);
  for (let i = 0; i < POOL; i++) {
    pool[i] = {
      on: 0, keep: 0, id: 0, kind: 0, x: 0, z: 0, yaw: 0, base: 1, emerge: 0, r: 0,
    };
  }
  return {
    seed: Number(opts.seed) || 1,
    x0: Number(opts.x0) || 0,
    pathZ: Number(opts.pathZ) || 0,
    speed: 0,
    charge: 0,
    pool,
    live: 0,
    arch: null,
    gate: null,
    wreck: null,
  };
}

function findId(pool, id) {
  for (let i = 0; i < pool.length; i++) if (pool[i].on && pool[i].id === id) return pool[i];
  return null;
}

function findFree(pool) {
  for (let i = 0; i < pool.length; i++) if (!pool[i].on) return pool[i];
  return null;
}

function seat(field, slot, rec, emerge) {
  slot.on = 1;
  slot.keep = 1;
  slot.id = rec.id;
  slot.kind = rec.kind;
  slot.x = rec.x;
  slot.z = rec.z;
  slot.yaw = rec.yaw;
  slot.base = rec.base;
  slot.r = rec.r;
  if (emerge != null) slot.emerge = emerge;
}

/**
 * Monument n for this bolt x. Null when the seat is outside the window.
 * nearM 0 includes a seat that has already come close (used when settling a still).
 */
export function monumentSeat(field, kind, boltX, look, behind, nearM) {
  const spec = MONU[kind];
  let n = Math.ceil((boltX - behind - field.x0 - spec.first) / spec.gap);
  if (n < 0) n = 0;
  const x = field.x0 + spec.first + n * spec.gap;
  if (x > boltX + look) return null;
  const ahead = x - boltX;
  if (nearM > 0 && ahead < nearM && ahead > -behind) {
    const n2 = n + 1;
    const x2 = field.x0 + spec.first + n2 * spec.gap;
    if (x2 <= boltX + look) {
      return { id: kind * 100000 + n2, x: x2, z: field.pathZ + lateralOf(kind, n2), n: n2, ahead: x2 - boltX };
    }
  }
  return { id: kind * 100000 + n, x, z: field.pathZ + lateralOf(kind, n), n, ahead };
}

/**
 * Tall copies of the cooked boulder and stone hulls along the horizon.
 * World x is locked to HORIZON_STEP. Same seed and same bolt x rebuild the same seats.
 * Each seat stays inside the portrait view and clear of the run.
 */
export function horizonSeats(field, boltX) {
  const half = Math.tan((22.7 * Math.PI) / 180 / 2) * 0.82;
  const first = Math.ceil((boltX + 56) / HORIZON_STEP);
  const seats = [];
  for (let rank = 0; rank < HORIZON_N; rank++) {
    const x = (first + rank) * HORIZON_STEP;
    const dist = Math.max(1, x - boltX);
    const h = mix(field.seed, first + rank + 91, rank + 5);
    const maxLat = dist * half;
    const maxH = Math.min(14, Math.max(8, (maxLat - 2.4) / 0.8));
    const height = 8 + hash01(h) * (maxH - 8);
    const foot = 0.8 * height;
    const minLat = foot + 2.4;
    const span = Math.max(0, maxLat - minLat);
    const lateral = minLat + hash01(h ^ 0x27d4eb2d) * span;
    const side = hash01(h ^ 0x1b873593) > 0.5 ? 1 : -1;
    seats.push({
      x,
      z: field.pathZ + side * lateral,
      yaw: hash01(h ^ 0x85ebca6b) * 360,
      height,
      kind: hash01(h ^ 0x165667b1) > 0.5 ? KIND_BOULDER : KIND_STONE,
      lateral: side * lateral,
    });
  }
  return seats;
}

function considerRock(field, slot, ix, lane, charge, emergeNow) {
  const id = (ix + 4000) * 64 + (lane + 8);
  const h = mix(field.seed, ix + 17, lane + 3);
  const rank = hash01(h);
  if (rank > densityOf(charge)) return false;
  const have = findId(field.pool, id);
  if (have) {
    have.keep = 1;
    if (emergeNow != null) have.emerge = emergeNow;
    return true;
  }
  const free = findFree(field.pool);
  if (!free) return false;
  const kind = hash01(h ^ 0x27d4eb2d) > 0.62 ? KIND_BOULDER : KIND_STONE;
  const span = ROCK[kind].scale;
  const base = span[0] + hash01(h ^ 0x165667b1) * (span[1] - span[0]);
  const lateral = LANES[lane];
  const jitter = (hash01(h ^ 0x1b873593) - 0.5) * 1.4;
  seat(field, free, {
    id,
    kind,
    x: ix * CELL + jitter,
    z: field.pathZ + lateral,
    yaw: hash01(h ^ 0x85ebca6b) * 360,
    base,
    r: footprint(kind, base),
  }, emergeNow == null ? 0 : emergeNow);
  return true;
}

function considerMonu(field, kind, boltX, look, behind, nearM, emergeNow) {
  const held = monumentSeat(field, kind, boltX, look, behind, 0);
  if (held && findId(field.pool, held.id)) {
    const have = findId(field.pool, held.id);
    have.keep = 1;
    have.x = held.x;
    have.z = held.z;
    if (emergeNow != null) have.emerge = emergeNow;
    return;
  }
  const rec = monumentSeat(field, kind, boltX, look, behind, nearM);
  if (!rec) return;
  const have = findId(field.pool, rec.id);
  if (have) {
    have.keep = 1;
    have.x = rec.x;
    have.z = rec.z;
    if (emergeNow != null) have.emerge = emergeNow;
    return;
  }
  for (let i = 0; i < field.pool.length; i++) {
    const slot = field.pool[i];
    if (slot.on && slot.kind === kind) {
      slot.on = 0;
      slot.keep = 0;
    }
  }
  const free = findFree(field.pool);
  if (!free) return;
  seat(field, free, {
    id: rec.id,
    kind,
    x: rec.x,
    z: rec.z,
    yaw: 90,
    base: 1,
    r: 0,
  }, emergeNow == null ? 0 : emergeNow);
}

function inWindow(dx, dz, fx, fz, rx, rz, look, behind, half) {
  const ahead = dx * fx + dz * fz;
  const side = dx * rx + dz * rz;
  if (ahead < -behind || ahead > look) return null;
  if (Math.abs(side) > half) return null;
  return ahead;
}

function fill(field, body, opt) {
  const look = opt.look != null ? opt.look : lookAhead(field.speed);
  const behind = BEHIND_M;
  const nearM = opt.nearM != null ? opt.nearM : NEAR_M;
  const half = halfWidth(field.charge);
  const emergeNow = opt.emerge;
  const yaw = body.heading * Math.PI / 180;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  for (let i = 0; i < field.pool.length; i++) field.pool[i].keep = 0;

  considerMonu(field, KIND_ARCH, body.x, look, behind, nearM, emergeNow);
  // The 22.7° lens only holds a gate 16 m off the run while it is still far.
  // A sprint looks that far. A walk keeps the shorter window, so the gate still waits.
  const gateLook = field.charge > 0.8 ? Math.max(look, 150) : look;
  considerMonu(field, KIND_GATE, body.x, gateLook, behind, nearM, emergeNow);
  considerMonu(field, KIND_WRECK, body.x, look, behind, nearM, emergeNow);

  const reach = look + behind + CELL * 2;
  const ixLo = Math.floor((body.x - reach) / CELL) - 1;
  const ixHi = Math.ceil((body.x + reach) / CELL) + 1;
  // Forward centre lanes first, so the portrait view fills before the shoulders.
  function scanRocks(mode) {
    for (let ix = ixLo; ix <= ixHi; ix++) {
      for (let lane = 0; lane < LANES.length; lane++) {
        const lateral = LANES[lane];
        if (Math.abs(lateral) > half) continue;
        const x = ix * CELL;
        const z = field.pathZ + lateral;
        const ahead = inWindow(x - body.x, z - body.z, fx, fz, rx, rz, look, behind, half);
        if (ahead == null) continue;
        const centre = Math.abs(lateral) < 6;
        if (mode === 0 && !(ahead >= 0 && centre)) continue;
        if (mode === 1 && !(ahead >= 0 && !centre)) continue;
        if (mode === 2 && ahead >= 0) continue;
        if (nearM > 0 && ahead >= 0 && ahead < nearM && !findId(field.pool, (ix + 4000) * 64 + (lane + 8))) continue;
        considerRock(field, null, ix, lane, field.charge, emergeNow);
      }
    }
  }
  scanRocks(0);
  scanRocks(1);
  scanRocks(2);

  for (let i = 0; i < field.pool.length; i++) {
    const slot = field.pool[i];
    if (!slot.on) continue;
    if (slot.keep) continue;
    const ahead = (slot.x - body.x) * fx + (slot.z - body.z) * fz;
    if (slot.emerge > 0.45 && ahead > -behind) {
      slot.keep = 1;
      continue;
    }
    blank(slot);
  }
  let live = 0;
  field.arch = null;
  field.gate = null;
  field.wreck = null;
  for (let i = 0; i < field.pool.length; i++) {
    const slot = field.pool[i];
    if (!slot.on) continue;
    live += 1;
    if (slot.kind === KIND_ARCH) field.arch = slot;
    else if (slot.kind === KIND_GATE) field.gate = slot;
    else if (slot.kind === KIND_WRECK) field.wreck = slot;
  }
  field.live = live;
}

function clearPool(field) {
  for (let i = 0; i < field.pool.length; i++) blank(field.pool[i]);
  field.live = 0;
  field.arch = null;
  field.gate = null;
  field.wreck = null;
}

/**
 * One play step. `body` is { x, z, heading, forward, gallop }.
 * Speed and charge advance here. Slots are written into the existing pool.
 */
export function stepField(field, body, dt) {
  const step = dt > 0 ? dt : 0;
  field.speed = stepSpeed(field.speed, body.forward || 0, !!body.gallop, step);
  field.charge = stepCharge(field.charge, body.forward || 0, !!body.gallop, step);
  if (step > 0) {
    for (let i = 0; i < field.pool.length; i++) {
      const slot = field.pool[i];
      if (!slot.on || slot.emerge >= 1) continue;
      slot.emerge += step / EMERGE_SEC;
      if (slot.emerge > 1) slot.emerge = 1;
    }
  }
  fill(field, body, {});
  return field;
}

/** Still frame. Pace is "walk" or "sprint". Every live slot is fully emerged. */
export function settleField(field, body, pace) {
  clearPool(field);
  const sprint = pace === "sprint";
  field.speed = sprint ? SPRINT_MAX : WALK_SPD;
  field.charge = sprint ? 1 : 0;
  fill(field, body, { nearM: 0, emerge: 1, look: lookAhead(field.speed) });
  return field;
}

export function rockDiscs(field, out) {
  let n = 0;
  for (let i = 0; i < field.pool.length; i++) {
    const slot = field.pool[i];
    if (!slot.on || slot.kind > KIND_BOULDER) continue;
    if (slot.emerge < 0.35) continue;
    const disc = out[n];
    disc.x = slot.x;
    disc.z = slot.z;
    disc.r = slot.r * slot.emerge;
    n += 1;
  }
  return n;
}

export function slotIds(field) {
  const ids = [];
  for (let i = 0; i < field.pool.length; i++) if (field.pool[i].on) ids.push(field.pool[i].id);
  ids.sort((a, b) => a - b);
  return ids;
}

export function rockCount(field) {
  let n = 0;
  for (let i = 0; i < field.pool.length; i++) {
    const slot = field.pool[i];
    if (slot.on && slot.kind <= KIND_BOULDER) n += 1;
  }
  return n;
}

export { KIND_ARCH, KIND_BOULDER, KIND_GATE, KIND_STONE, KIND_WRECK };

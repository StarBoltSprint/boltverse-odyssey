/**
 * Path beat generator — law 37.
 *
 * The chemin forms ~3s ahead of contact (lookahead), on one lane.
 * It is not painted under the paws and it is not the densify plate.
 * Densify (Rail A) stays one continuous loop. This module never slices it.
 *
 * Cone placement is howlPose. The target lane is the corridor
 * pickHowlLane left open (same occupancy, player side).
 * Imagine = the look. Code = when and which lane.
 *
 *   import { pathBeatState, pathBeatFrame, pathBeatChart } from "./pathBeat.js";
 *
 * Copy into Live next to howlLive.js. Each frame call pathBeatFrame.
 * Draw active.pose.dest as one keyed quad (mark / markDest) during the window.
 * At contact, read resolved[].result (hit | miss) against playerLane.
 */
import { HOWL, howlPose, mulberry32 } from "../howl-live/howlLive.js";

export const PATH_BEAT = {
  /** Seconds the target lane is known before the paws arrive. */
  lookahead: 3.0,
  /** Contact-to-contact gap. Wider than lookahead so one window is live. */
  gapMin: 4.5,
  gapMax: 7.5,
  /** First reveal sits this far after t=0, so the run does not open under the paws. */
  firstLead: 0.4,
  /** A frame that lands this late still counts. Older jumps are not scored. */
  contactSlack: 0.12,
};

export const CHEMIN = "biome/fx/path/chemin.mp4";

export const RAIL = {
  densify: "A",
  zones: "B",
  tileDensify: false,
  coversPlate: false,
};

const NAME = { [-1]: "L", 0: "C", 1: "R" };

export function laneName(index) {
  return NAME[index] || null;
}

/** 'L' | 'C' | 'R' | -1 | 0 | 1 → cone index. Unknown → null. */
export function normalizeLane(lane) {
  if (lane === "L" || lane === "l" || lane === -1) return -1;
  if (lane === "C" || lane === "c" || lane === "M" || lane === "m" || lane === 0) return 0;
  if (lane === "R" || lane === "r" || lane === 1) return 1;
  return null;
}

function lookSec(v) {
  const n = Number(v);
  if (n >= 0.5 && n <= 12) return n;
  return PATH_BEAT.lookahead;
}

/**
 * Player corridor. Same lanes and same occupancy set as pickHowlLane.
 * Obstacles share a taken lane so one corridor stays free.
 * This returns that free corridor — where the player SIDES.
 * null when every lane is closed (do not force a wall).
 */
export function pickPathLane(blocked, plate, rand) {
  const all = [-1, 0, 1];
  const occ = new Set([...(blocked || []), ...(plate || [])]);
  const free = all.filter((l) => !occ.has(l));
  if (!free.length) return null;
  return free[Math.min(free.length - 1, (rand * free.length) | 0)];
}

/**
 * One seeded beat. Gap is always consumed so a closed plate cannot stall the clock.
 * skip = no legal corridor this slot.
 */
export function planBeat(seed, seq, tContact, blocked, plate, lookahead = PATH_BEAT.lookahead) {
  const look = lookSec(lookahead);
  const rng = mulberry32(((seed >>> 0) + (seq * 101)) >>> 0);
  const roll = rng();
  const gap = PATH_BEAT.gapMin + rng() * (PATH_BEAT.gapMax - PATH_BEAT.gapMin);
  const laneIndex = pickPathLane(blocked, plate, roll);
  const tReveal = tContact - look;
  if (laneIndex === null) {
    return { skip: true, gap, tContact, tReveal };
  }
  return {
    skip: false,
    id: `${seed >>> 0}-${seq}`,
    lane: NAME[laneIndex],
    laneIndex,
    tReveal,
    tContact,
    gap,
  };
}

/** Offline sprint chart. Same seed math as pathBeatFrame. Does not tile densify. */
export function pathBeatChart(seed, opts = {}) {
  const look = lookSec(opts.lookahead);
  const count = Math.max(1, opts.count ?? 8);
  const blocked = opts.blocked || [];
  const plate = opts.plate || [];
  let nextContact = look + PATH_BEAT.firstLead;
  let seq = 0;
  const beats = [];
  let guard = 0;
  while (beats.length < count && guard < count * 6) {
    guard += 1;
    seq += 1;
    const planned = planBeat(seed, seq, nextContact, blocked, plate, look);
    nextContact += planned.gap;
    if (planned.skip) continue;
    beats.push({
      id: planned.id,
      lane: planned.lane,
      laneIndex: planned.laneIndex,
      tReveal: planned.tReveal,
      tContact: planned.tContact,
    });
  }
  return {
    seed: seed >>> 0 || 1,
    lookahead: look,
    rail: RAIL.zones,
    densify: RAIL.densify,
    tileDensify: false,
    coversPlate: false,
    beats,
  };
}

export function pathBeatState(seed = 1) {
  return {
    seed: seed >>> 0 || 1,
    seq: 0,
    nextContact: null,
    clock: 0,
    beats: [],
  };
}

/** hit if the player lane is the target. Missing lane is a miss. */
export function pathBeatResolve(playerLane, beat) {
  if (!beat) return "miss";
  const player = normalizeLane(playerLane);
  return player !== null && player === beat.laneIndex ? "hit" : "miss";
}

function decorate(beat, now, ctx) {
  const secondsLeft = beat.tContact - now;
  const cw = ctx.cw || 768;
  const ch = ctx.ch || 1168;
  const pawY = ctx.pawY != null ? ctx.pawY : ch * 0.84;
  const destH0 = ctx.destH0 || 200;
  const z = secondsLeft / HOWL.travel;
  const pose = howlPose(beat.laneIndex, z, cw, ch, destH0, pawY);
  return {
    id: beat.id,
    lane: beat.lane,
    laneIndex: beat.laneIndex,
    tReveal: beat.tReveal,
    tContact: beat.tContact,
    secondsLeft,
    z,
    ahead: pose.ground.y < pawY,
    pose,
    look: CHEMIN,
    tileDensify: false,
  };
}

/**
 * One Live tick.
 * ctx: { now, cw, ch, pawY, destH0, playerLane, blocked, plate, lookahead }
 * `now` is seconds. If omitted, clock advances by dt.
 * Emitted beats are revealed (lane known) and still before contact.
 * `resolved` is this frame's contact hits and misses. Those beats leave the cone.
 */
export function pathBeatFrame(state, dt, ctx) {
  const seed = state.seed >>> 0 || 1;
  const look = lookSec(ctx.lookahead != null ? ctx.lookahead : PATH_BEAT.lookahead);
  const step = Math.max(0, Number(dt) || 0);
  const now = ctx.now != null && ctx.now !== "" ? Number(ctx.now) : (Number(state.clock) || 0) + step;
  let seq = state.seq | 0;
  let nextContact = state.nextContact;
  if (nextContact == null) nextContact = look + PATH_BEAT.firstLead;

  const carried = [];
  for (const b of state.beats || []) {
    if (b && b.tContact != null) carried.push(b);
  }

  const blocked = ctx.blocked || [];
  const plate = ctx.plate || [];
  const late = now - Math.max(step, PATH_BEAT.contactSlack);
  let guard = 0;
  while (nextContact - look <= now + 1e-9 && guard < 8) {
    guard += 1;
    seq += 1;
    const planned = planBeat(seed, seq, nextContact, blocked, plate, look);
    nextContact += planned.gap;
    if (planned.skip) continue;
    if (planned.tContact < late) continue;
    carried.push({
      id: planned.id,
      lane: planned.lane,
      laneIndex: planned.laneIndex,
      tReveal: planned.tReveal,
      tContact: planned.tContact,
    });
  }

  const resolved = [];
  const open = [];
  for (const b of carried) {
    if (now + 1e-9 < b.tReveal) continue;
    if (now + 1e-9 >= b.tContact) {
      const result = pathBeatResolve(ctx.playerLane, b);
      resolved.push({
        id: b.id,
        lane: b.lane,
        laneIndex: b.laneIndex,
        tReveal: b.tReveal,
        tContact: b.tContact,
        result,
        playerLane: laneName(normalizeLane(ctx.playerLane)),
      });
      continue;
    }
    open.push(b);
  }

  const beats = open.map((b) => decorate(b, now, ctx)).sort((a, b) => a.tContact - b.tContact);
  return {
    rail: RAIL.zones,
    densify: RAIL.densify,
    tileDensify: false,
    coversPlate: false,
    lookahead: look,
    now,
    sides: ["L", "C", "R"],
    state: {
      seed,
      seq,
      nextContact,
      clock: now,
      beats: open.map((b) => ({
        id: b.id,
        lane: b.lane,
        laneIndex: b.laneIndex,
        tReveal: b.tReveal,
        tContact: b.tContact,
      })),
    },
    beats,
    active: beats[0] || null,
    resolved,
  };
}

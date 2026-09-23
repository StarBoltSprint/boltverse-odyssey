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
 * Native to the densify film, not a HUD and not a sticker:
 * one cone (howlPose) on densify's 3 lanes, gradeFromPlate,
 * approach locked to HOWL.travel (same step as Lena), shadow only
 * in the near band, soft band crossfade, in-world reveal.
 *
 *   import { pathBeatState, pathBeatFrame, pathBeatChart, assertPathNative } from "./pathBeat.js";
 *
 * Copy into Live next to howlLive.js. Each frame call pathBeatFrame.
 * Reveal the target lane IN the road (light / detail / fill) on pose.
 * Grade that quad from this densify plate. At contact, read resolved[].result.
 */
import { HOWL, howlPose, mulberry32 } from "../howl-live/howlLive.js";
import { objectBand, preloadOf } from "../lena-lod/lenaLod.js";

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

/** z units per second toward the paws. Same step lenaFrame uses. */
export const APPROACH = 1 / HOWL.travel;

/** In-world reveal. Not a screen arrow. detail on the cone is the Live op "form". */
const REVEAL_OF = { far: "light", mid: "detail", near: "fill" };
const OP_OF = { light: "light", detail: "form", fill: "fill" };

/** Keyed layers. All of them composite on the GPU over densify. None are painted into Video A. */
export const GPU = {
  required: true,
  composite: "over-densify",
  bakeIntoDensify: false,
  layers: ["bolt", "lena", "howl", "path-beat"],
};

export const NATIVE = {
  geometry: "densify-lanes",
  cone: "howlPose",
  lanes: 3,
  gpu: true,
  composite: GPU.composite,
  bakeIntoDensify: false,
  gradeFromPlate: true,
  inWorld: true,
  hud: false,
  clock: "densify",
  approach: APPROACH,
  contactShadow: "near",
  crossfade: true,
  tileDensify: false,
};

/** Cook contract. Densify picture stays a clean loop. Bibs match that world. */
export const COOK = {
  densify: "clean-3-lane-loop",
  vault: true,
  calmSides: true,
  bibs: "keyed-same-world",
  bolt: "lock/bolt-back.jpg",
  lanes: 3,
  gpu: true,
  bakeIntoDensify: false,
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
    hud: false,
    inWorld: true,
    gpu: true,
    composite: GPU.composite,
    bakeIntoDensify: false,
    gradeFromPlate: true,
    cone: "howlPose",
    clock: "densify",
    lanes: 3,
    approach: APPROACH,
    cook: COOK,
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

/**
 * Live draw hook for one revealed beat. GPU quad on the densify cone.
 * `op` is light (lane lights up), form (detail forms), or fill (void fills).
 * No beat → draw false. Never a HUD. Never a pixel written into Video A.
 */
export function pathRevealHook(beat) {
  const base = {
    hook: "path-reveal",
    gpu: true,
    composite: GPU.composite,
    bakeIntoDensify: false,
    hud: false,
    space: "world",
    gradeFromPlate: true,
  };
  if (!beat || !beat.pose) return { ...base, draw: false, op: null };
  const op = OP_OF[beat.reveal] || null;
  return {
    ...base,
    draw: true,
    inWorld: true,
    lane: beat.lane,
    laneIndex: beat.laneIndex,
    op,
    reveal: beat.reveal,
    dest: beat.pose.dest,
    ground: beat.pose.ground,
    contact: beat.contact === true,
    warm: beat.warm,
    warmK: beat.warmK,
    secondsLeft: beat.secondsLeft,
    look: beat.look || CHEMIN,
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
  const z = secondsLeft * APPROACH;
  const pose = howlPose(beat.laneIndex, z, cw, ch, destH0, pawY);
  const pre = preloadOf(pose.t);
  const band = objectBand(pose.t);
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
    space: "world",
    hud: false,
    inWorld: true,
    gpu: true,
    composite: GPU.composite,
    bakeIntoDensify: false,
    gradeFromPlate: true,
    band,
    /** light = lane lights up, detail = detail forms, fill = void fills. */
    reveal: REVEAL_OF[band],
    /** Live verb: light | form | fill. form is the mid-band detail. */
    op: OP_OF[REVEAL_OF[band]],
    warm: pre.warm,
    warmK: pre.warmK,
    contact: band === "near",
    approach: APPROACH,
    tileDensify: false,
  };
}

/**
 * Empty list = the frame is native to the densify film.
 * Any string in the list is a FAIL (HUD, sticker grade, tiled plate, wrong cone).
 */
export function assertPathNative(frame) {
  const fails = [];
  if (!frame) return ["missing frame"];
  if (frame.tileDensify !== false) fails.push("densify tiled");
  if (frame.coversPlate !== false) fails.push("covers plate");
  if (frame.gpu !== true) fails.push("GPU");
  if (frame.bakeIntoDensify !== false) fails.push("baked into densify");
  if (frame.composite !== "over-densify") fails.push("composite");
  if (frame.hud !== false) fails.push("HUD");
  if (frame.inWorld !== true) fails.push("not in world");
  if (frame.gradeFromPlate !== true) fails.push("gradeFromPlate");
  if (frame.cone !== "howlPose") fails.push("cone");
  if (frame.clock !== "densify") fails.push("clock");
  if (frame.lanes !== 3) fails.push("lanes");
  if (!(Math.abs(frame.approach - APPROACH) < 1e-12)) fails.push("approach");
  if (!frame.cook || frame.cook.densify !== COOK.densify) fails.push("cook densify");
  if (!frame.cook || frame.cook.vault !== true || frame.cook.calmSides !== true) fails.push("cook sides");
  if (!frame.cook || frame.cook.bibs !== COOK.bibs) fails.push("cook bibs");
  if (!frame.cook || frame.cook.bolt !== COOK.bolt) fails.push("bolt identity");
  if (!frame.cook || frame.cook.gpu !== true || frame.cook.bakeIntoDensify !== false) fails.push("cook GPU");
  const hook = frame.revealHook;
  if (hook) {
    if (hook.hud !== false || hook.gpu !== true || hook.bakeIntoDensify !== false) fails.push("reveal hook");
    if (hook.draw) {
      if (hook.op !== "light" && hook.op !== "form" && hook.op !== "fill") fails.push("reveal op");
      if (!hook.dest || hook.gradeFromPlate !== true || hook.space !== "world") fails.push("reveal hook");
    }
  }
  for (const b of frame.beats || []) {
    if (b.hud !== false || b.space !== "world" || b.inWorld !== true) fails.push("beat HUD");
    if (b.gpu !== true || b.bakeIntoDensify !== false) fails.push("beat baked into densify");
    if (b.gradeFromPlate !== true) fails.push("beat grade");
    if (b.contact === true && b.band !== "near") fails.push("shadow outside near");
    if (b.band === "near" && b.contact !== true) fails.push("near without shadow");
    if (b.reveal !== REVEAL_OF[b.band]) fails.push("reveal");
    if (b.op !== OP_OF[b.reveal]) fails.push("reveal op");
    if (!(Math.abs(b.approach - APPROACH) < 1e-12)) fails.push("beat approach");
  }
  return fails;
}

/**
 * One Live tick.
 * ctx: { now, cw, ch, pawY, destH0, playerLane, blocked, plate, lookahead }
 * `now` is densify plate time (the film clock). If omitted, clock advances by dt.
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
  const active = beats[0] || null;
  return {
    rail: RAIL.zones,
    densify: RAIL.densify,
    tileDensify: false,
    coversPlate: false,
    lookahead: look,
    now,
    hud: false,
    inWorld: true,
    gpu: true,
    composite: GPU.composite,
    bakeIntoDensify: false,
    gradeFromPlate: true,
    cone: "howlPose",
    clock: "densify",
    sameClock: true,
    lanes: 3,
    approach: APPROACH,
    contactShadow: "near",
    cook: COOK,
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
    active,
    revealHook: pathRevealHook(active),
    resolved,
  };
}

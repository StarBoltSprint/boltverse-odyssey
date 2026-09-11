/**
 * Lane reel picker. Cue clock: ./cue-coyote.mjs.
 * t_run counts race frames. Idle-decay gnaws m only if the picture runs and you are not playing.
 * Call onLaneTime from the player. If you forget, t_run stays 0 and you fall back to m alone.
 */

import {
  COYOTE,
  makeSheet,
  resolveFrame,
  flushOpen,
  coyoteAfter,
} from "./cue-coyote.mjs";

export { makeSheet, resolveFrame, flushOpen, coyoteAfter, COYOTE };

export const LANE = {
  early_grace_s: COYOTE.early_grace_s,
  coyote_min_s: COYOTE.min_s,
  coyote_max_s: COYOTE.max_s,
  coyote_s: COYOTE.default_s,
  hit_m: 0.1,
  miss_mul: 0.7,
  m_floor: 0.05,
  m_boot: 0.12,
  m_decay: 0.18,
  m_calm: 0.3,
  m_peak: 0.7,
  idle_tick_s: 1,
  idle_decay: 0.015,
  miss_exit: 3,
  playbackRate: 1,
  quiet_s: 8,
  lean_s: 20,
  build_s: 45,
  close_s: 70,
  seek_ignore_s: 0.5,
};

const SPRINT_KIND = new Set(["sprint", "calm", "lean", "peak"]);

export function emptyState() {
  return {
    m: LANE.m_boot,
    t_run: 0,
    lastT: null,
    kind: "sprint",
    peakBan: false,
    missStreak: 0,
    hitStreak: 0,
    idleAcc: 0,
    currentId: null,
    sheet: makeSheet([]),
  };
}

export function handoffLane() {
  return emptyState();
}

/** Bone + m. Quiet forbids peak even if m is high. */
export function wantOf(t_run, m, peakBan) {
  if (m < LANE.m_decay) return "decay";
  const t = t_run || 0;
  if (t < LANE.quiet_s) return "calm";
  if (t < LANE.lean_s) return m >= LANE.m_calm ? "lean" : "calm";
  if (t < LANE.build_s) return "lean";
  if (t <= LANE.close_s && m >= LANE.m_peak && !peakBan) return "peak";
  return "lean";
}

export const selectTier = wantOf;

export function tapFromX(x) {
  if (x < 0.4) return "A";
  if (x > 0.6) return "B";
  return "pose";
}

export function applyVerdict(state, verdict) {
  const s = { ...state };
  if (verdict === "hit") {
    s.m = Math.min(1, s.m + LANE.hit_m);
    s.hitStreak += 1;
    s.missStreak = 0;
  } else if (verdict === "miss") {
    s.m = Math.max(LANE.m_floor, s.m * LANE.miss_mul);
    s.peakBan = true;
    s.missStreak += 1;
    s.hitStreak = 0;
  } else if (verdict === "late") {
    s.peakBan = true;
    s.hitStreak = 0;
  }
  return s;
}

export function tickIdle(state, dt) {
  const s = { ...state, idleAcc: (state.idleAcc || 0) + dt };
  while (s.idleAcc >= LANE.idle_tick_s) {
    s.idleAcc -= LANE.idle_tick_s;
    s.m = Math.max(LANE.m_floor, s.m - LANE.idle_decay);
  }
  return s;
}

export const tickIdleDecay = tickIdle;

export function tickRun(state, t, { kind, held } = {}) {
  const k = kind ?? state.kind ?? "sprint";
  const s = { ...state, kind: k };
  const last = s.lastT;
  s.lastT = t;
  if (held || last == null) return s;
  const d = t - last;
  if (d < 0 || d > LANE.seek_ignore_s) return s;
  if (SPRINT_KIND.has(k)) s.t_run = (s.t_run || 0) + d;
  return s;
}

function cueOpen(sheet, t) {
  const cue = sheet?.cues?.[sheet.i];
  if (!cue) return false;
  const C = coyoteAfter(cue, sheet.cues[sheet.i + 1]);
  return t <= cue.off + C;
}

/**
 * Player clock. HOLD: lastT tracks, no ticks, no grade.
 * Idle-decay only if the plate has no open cue (decay / silent calm).
 */
export function onLaneTime(state, t, { held, kind, idlePlate, tap } = {}) {
  if (held) {
    const s = { ...state, lastT: t };
    return { state: s, sheet: s.sheet, verdict: null };
  }
  const last = state.lastT;
  let s = tickRun(state, t, { kind, held: false });
  const d = last == null ? 0 : t - last;
  const dt = d >= 0 && d <= LANE.seek_ignore_s ? d : 0;
  const idle = idlePlate || !(s.sheet?.cues && s.sheet.cues.length);
  if (dt > 0 && idle && !cueOpen(s.sheet, t)) s = tickIdle(s, dt);

  const sheet = resolveFrame({ ...s.sheet, t, tap: tap ?? null });
  s = { ...s, sheet };
  const v = sheet.verdict;
  if (v && v !== "wait" && v !== "early") s = applyVerdict(s, v);
  return { state: s, sheet, verdict: v };
}

export function pickNext(palette, state, currentId) {
  if (state.missStreak >= LANE.miss_exit) {
    return { kind: "exit", to: "hall" };
  }
  const want = selectTier(state.t_run, state.m, state.peakBan);
  const take = (tier) => {
    const list = palette?.[tier] || [];
    if (!list.length) return null;
    const other = list.find((p) => p.id !== currentId);
    return other || list[0];
  };
  const plate = take(want) || take("calm") || take("decay");
  if (!plate) return { kind: "hold" };
  return { kind: "plate", plate, tier: want };
}

/** After pickNext (penance already chosen). Does not += duration. */
export function afterJoin(state, { kind = "sprint" } = {}) {
  return { ...state, kind, peakBan: false, idleAcc: 0, lastT: 0 };
}

export function planSwap({ next, hidReady }) {
  if (!next || next.kind === "hold") {
    return { action: "hold", playbackRate: 1 };
  }
  if (next.kind === "exit") {
    return { action: "exit", to: next.to, playbackRate: 1 };
  }
  if (!hidReady) {
    return {
      action: "decay",
      plate: next.plate,
      playbackRate: 1,
      note: "hid not playing — still stays, clock hold",
    };
  }
  return {
    action: "swap",
    file: next.plate.file,
    still: next.plate.still,
    fade: 0,
    playbackRate: 1,
  };
}

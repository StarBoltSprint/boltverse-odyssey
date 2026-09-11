/**
 * Lane reel picker + tap judge. Cue clock lives in ./cue-coyote.mjs.
 * Laws: PLAY.md · COOKLANE.md · ENGINE.md (DOM swap).
 *
 *   timeupdate: sheet.t = currentTime; sheet.tap = lastTap; resolveFrame
 *   ended:      flushOpen(sheet, duration)  — last cue must not stay wait
 *   pickNext → planSwap → ENGINE hid (playbackRate = 1 always)
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
  m_calm: 0.3,
  m_lean: 0.7,
  miss_exit: 3,
  playbackRate: 1,
};

export function emptyState() {
  return {
    m: 0.12,
    peakBan: false,
    missStreak: 0,
    hitStreak: 0,
    currentId: null,
    sheet: makeSheet([]),
  };
}

export function tierOf(m, peakBan) {
  if (m < LANE.m_calm) return "calm";
  if (m < LANE.m_lean) return "lean";
  if (peakBan) return "lean";
  return "peak";
}

/** containPlate x 0..1 → hall token. Letterbox never arrives here. */
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

export function pickNext(palette, state, currentId) {
  if (state.missStreak >= LANE.miss_exit) {
    return { kind: "exit", to: "hall" };
  }
  const want = tierOf(state.m, state.peakBan);
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

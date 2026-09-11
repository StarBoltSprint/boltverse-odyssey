/**
 * Lane reel picker + tap judge. Not Imagine. Not the hall teal/gold graph.
 * Laws: PLAY.md · COOKLANE.md · ENGINE.md (DOM swap).
 *
 * Coyote is a Late *tail after off*, not a second Hit.
 *   Hit  = [on − 0.08, off]
 *   Late = (off, off + C]
 *   Miss = tap after off+C, or no tap when t > off+C
 *   Early = tap < on − 0.08 (ignore, cue stays open)
 * C = clamp(0.18, 0.28, 0.22) then min(C, next.on − off).
 * One verdict per cue. Close i (coyote) before reading Early of i+1.
 *
 * playbackRate is always 1. Speed = which plate is next, already on disk.
 */

export const LANE = {
  early_grace_s: 0.08,
  coyote_min_s: 0.18,
  coyote_max_s: 0.28,
  coyote_s: 0.22,
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
    lastCue: -1,
  };
}

export function tierOf(m, peakBan) {
  if (m < LANE.m_calm) return "calm";
  if (m < LANE.m_lean) return "lean";
  if (peakBan) return "lean";
  return "peak";
}

/** Base C then cut by the next on so grace never overlaps the next Hit. */
export function coyoteOf(cue, next) {
  let C = cue.coyote ?? LANE.coyote_s;
  C = Math.min(LANE.coyote_max_s, Math.max(LANE.coyote_min_s, C));
  if (next) C = Math.min(C, Math.max(0, next.on - cue.off));
  return C;
}

function openIndex(cues, lastCue) {
  const i = lastCue + 1;
  return i >= 0 && i < cues.length ? i : -1;
}

function sideOk(x, side) {
  if (side === "pose") return x >= 0.35 && x <= 0.65;
  if (side === "L") return x < 0.4;
  if (side === "R") return x > 0.6;
  return false;
}

function close(verdict, i) {
  return { verdict, cue: i, close: verdict !== "early" && verdict !== "idle" };
}

/**
 * Tap on containPlate (x 0..1). Letterbox never arrives here.
 * Close cue i first. Do not Hit at off−10ms then Late in the tail.
 */
export function gradeTap({ t, x, cues = [], lastCue = -1 }) {
  if (!cues.length) return close("idle", -1);
  const i = openIndex(cues, lastCue);
  if (i < 0) return close("idle", lastCue);

  const c = cues[i];
  const next = cues[i + 1];
  const C = coyoteOf(c, next);
  const on = c.on;
  const off = c.off;

  if (t < on - LANE.early_grace_s) return close("early", i);
  if (t <= off) {
    return close(sideOk(x, c.side) ? "hit" : "miss", i);
  }
  if (t <= off + C) {
    return close(sideOk(x, c.side) ? "late" : "miss", i);
  }
  return close("miss", i);
}

/**
 * No tap this frame. If the open cue's coyote has passed → Miss.
 * Picture-time only: if currentTime jumps past off+C, that is Miss (hard, honest).
 */
export function gradeClock({ t, cues = [], lastCue = -1 }) {
  if (!cues.length) return close("idle", -1);
  const i = openIndex(cues, lastCue);
  if (i < 0) return close("idle", lastCue);
  const c = cues[i];
  const C = coyoteOf(c, cues[i + 1]);
  if (t > c.off + C) return close("miss", i);
  return close("idle", i);
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

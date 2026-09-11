/**
 * Lane reel picker + tap judge. Not Imagine. Not the hall teal/gold graph.
 * Laws: PLAY.md · COOKLANE.md · ENGINE.md (DOM swap).
 *
 * Loop (player owns DOM):
 *   timeupdate(currentTime) → gradeTap → applyVerdict
 *   ended(plate)            → pickNext → planSwap
 *   ENGINE: still first, hid.src, muted, playsInline, play(),
 *           paint hid only if paused === false, then hide vis.
 *   One src= on vis = the Samsung clone. Same as hall. Don't.
 *   playbackRate is always 1. Speed = which plate is next, already on disk.
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

/**
 * x = 0..1 on containPlate (not letterbox). Letterbox tap never arrives here.
 * side: L < 0.4 · center 0.4–0.6 · R > 0.6  (same 40/20/40 as hall)
 * cue.side = "L" | "R" | "pose"
 */
export function gradeTap({ t, x, cues = [], lastCue = -1 }) {
  if (!cues.length) return { verdict: "idle", cue: -1 };

  let i = -1;
  for (let n = 0; n < cues.length; n++) {
    const c = cues[n];
    const on = c.on;
    const off = c.off;
    const coy = off + (c.coyote ?? LANE.coyote_s);
    if (t >= on - LANE.early_grace_s && t <= coy) {
      i = n;
      break;
    }
  }
  if (i < 0) return { verdict: "idle", cue: -1 };
  if (i === lastCue) return { verdict: "idle", cue: i };

  const c = cues[i];
  const on = c.on;
  const off = c.off;
  const coy = off + (c.coyote ?? LANE.coyote_s);

  if (t < on - LANE.early_grace_s) return { verdict: "early", cue: i };
  if (t < on) {
    /* 80 ms pre-on = Hit anticipation */
  } else if (t > coy) {
    return { verdict: "miss", cue: i };
  } else if (t > off) {
    return sideOk(x, c.side) ? { verdict: "late", cue: i } : { verdict: "miss", cue: i };
  }

  return sideOk(x, c.side) ? { verdict: "hit", cue: i } : { verdict: "miss", cue: i };
}

function sideOk(x, side) {
  if (side === "pose") return x >= 0.35 && x <= 0.65;
  if (side === "L") return x < 0.4;
  if (side === "R") return x > 0.6;
  return false;
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
  /* early / idle: m unchanged, no farm */
  return s;
}

/**
 * Same tier, other id if possible; else calm; else decay; else hold.
 * Repeated miss → exit the minute (hall), not a Game Over screen.
 */
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

/**
 * Intent only. Player paints with ENGINE dual-video.
 * hid not ready → hold / decay, taps live, never a black hole, never a spinner.
 */
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

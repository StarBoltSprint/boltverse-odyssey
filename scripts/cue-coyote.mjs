/**
 * Picture-time cue sheet. Media seconds only. playbackRate must stay 1.
 * Laws: PLAY.md (coyote is Late, next on cuts grace).
 *
 * wait  = still in Hit or coyote, no tap
 * early = too soon, SAME cue (index does not advance)
 * hit / late / miss = cue closes, index ++
 * ended → flushOpen so a cue left open is Miss, not eternal wait
 */

export const COYOTE = {
  early_grace_s: 0.08,
  min_s: 0.18,
  max_s: 0.28,
  default_s: 0.22,
};

export function coyoteAfter(cue, next) {
  let C = cue.coyote ?? COYOTE.default_s;
  C = Math.min(COYOTE.max_s, Math.max(COYOTE.min_s, C));
  if (next) C = Math.min(C, Math.max(0, next.on - cue.off));
  return C;
}

export function makeSheet(cues = []) {
  return {
    cues: cues.map((c) => ({ ...c })),
    i: 0,
    t: 0,
    tap: null, // "A" | "B" | "L" | "R" | "pose" | null
    verdict: null,
  };
}

function sideOk(tap, side) {
  if (!tap) return false;
  const s = side === "A" ? "L" : side === "B" ? "R" : side;
  const t = tap === "A" ? "L" : tap === "B" ? "R" : tap;
  if (s === "pose") return t === "pose";
  return t === s;
}

function close(sheet, verdict, nextI) {
  return { ...sheet, verdict, i: nextI, tap: null };
}

/** One frame. Consume tap (or silence). One verdict. */
export function resolveFrame(sheet) {
  const { cues, i, t, tap } = sheet;
  if (i < 0 || i >= cues.length) {
    return { ...sheet, verdict: null, tap: null };
  }
  const cue = cues[i];
  const C = coyoteAfter(cue, cues[i + 1]);
  const on = cue.on;
  const off = cue.off;

  if (tap) {
    if (t < on - COYOTE.early_grace_s) {
      return { ...sheet, verdict: "early", tap: null };
    }
    if (t <= off) {
      return close(sheet, sideOk(tap, cue.side) ? "hit" : "miss", i + 1);
    }
    if (t <= off + C) {
      return close(sheet, sideOk(tap, cue.side) ? "late" : "miss", i + 1);
    }
    return close(sheet, "miss", i + 1);
  }

  if (t > off + C) return close(sheet, "miss", i + 1);
  return { ...sheet, verdict: "wait", tap: null };
}

/** Video ended. Any still-open cue is Miss — no timeupdate after off+C. */
export function flushOpen(sheet, duration) {
  let s = { ...sheet, t: duration, tap: null };
  while (s.i >= 0 && s.i < s.cues.length) {
    s = resolveFrame({ ...s, t: duration, tap: null });
    if (s.verdict === "wait") {
      s = close(s, "miss", s.i + 1);
    }
    if (s.verdict !== "miss" && s.verdict !== "hit" && s.verdict !== "late") break;
  }
  return s;
}

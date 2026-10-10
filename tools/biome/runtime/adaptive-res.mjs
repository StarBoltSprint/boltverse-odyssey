// Render-ratio controller, quality-first policy (SmiR 2026-10-10 14:02). Pure logic, no DOM (adaptive-res.test.mjs).
// The phone default is the cap (ratio 2) at full quality, even at 22-25 fps. This controller never turns off the ground detail
// layer or any other quality feature: every level has detail: true and canDropDetail is false (the gate checks both).
// Below the cap only as an EMERGENCY floor:
// - 1 s windows, decided on the window's MEDIAN frame time; the warm-up after ready and windows holding an outlier hitch
//   (a frame > hitchMs AND > 3x the median) are ignored, so loading and single stalls never move it.
// - drop one rung (0.25) only after emergencyMs of consecutive windows under emergencyFps (default 15 fps for 5 s).
// - climb back as soon as the next rung up is predicted (fps x pixel ratio^2) to hold climbFps (default 18): 2 windows.
// - a rung we fell off again within 15 s of climbing to it waits 10 s, doubling, max 60 s (never closed for the session).
export function createAdaptiveRes(o = {}) {
  const cap = o.cap ?? 2, floor = Math.min(cap, o.floor ?? 1.25), step = o.step ?? 0.25;
  const warmupMs = o.warmupMs ?? 8000, hitchMs = o.hitchMs ?? 250;
  const emergencyFps = o.emergencyFps ?? 15, emergencyMs = o.emergencyMs ?? 5000, climbFps = o.climbFps ?? 18, climbWindows = o.climbWindows ?? 2;
  const dropWindows = Math.max(1, Math.ceil(emergencyMs / 1000));
  const backoffMs = o.backoffMs ?? 10000, backoffMax = o.backoffMax ?? 60000;
  const ladder = [];
  for (let r = cap; r >= floor - 1e-6; r -= step) ladder.push({ ratio: Math.round(r * 1000) / 1000, detail: true });
  let i = 0, ready = null, winStart = null, ft = [], slow = 0, fast = 0, changes = 0;
  const blockUntil = new Map(), fails = new Map(), climbedAt = new Map();
  const st = {
    get level() { return ladder[i]; }, get index() { return i; }, ladder, last: null, get changes() { return changes; },
    canDropDetail: false, policy: { cap, floor, emergencyFps, emergencyMs, climbFps },
  };
  st.markReady = (now) => { ready = now; winStart = now; ft = []; };
  /** feed one frame; returns true when the level changed */
  st.frame = (dtMs, now) => {
    if (winStart === null) winStart = now;
    ft.push(dtMs);
    if (now - winStart < 1000) return false;
    const s = ft.slice().sort((a, b) => a - b), med = s[s.length >> 1], mx = s[s.length - 1];
    const fps = 1000 / Math.max(med, 1e-3);
    ft = []; winStart = now;
    const why = ready === null ? "not-ready" : now - ready < warmupMs ? "warm-up" : mx > hitchMs && mx > 3 * med ? "hitch" : "";
    st.last = { fps, maxMs: mx, why, level: ladder[i] };
    if (why) { fast = 0; return false; }   // a hitch window does not reset the emergency count (a slow device is all hitches)
    if (fps < emergencyFps) {
      fast = 0;
      if (++slow >= dropWindows && i < ladder.length - 1) {
        if (now - (climbedAt.get(i) ?? -Infinity) < 15000) {   // we climbed here and it failed again: wait before the next try
          const n = (fails.get(i) || 0) + 1; fails.set(i, n); blockUntil.set(i, now + Math.min(backoffMax, backoffMs * 2 ** (n - 1)));
        }
        i++; slow = 0; changes++; return true;
      }
      return false;
    }
    slow = 0;
    if (i > 0) {
      const up = ladder[i - 1].ratio, pred = fps * (ladder[i].ratio / up) ** 2;
      if (pred >= climbFps && !((blockUntil.get(i - 1) || 0) > now)) {
        if (++fast >= climbWindows) { i--; fast = 0; climbedAt.set(i, now); changes++; return true; }
      } else fast = 0;
    }
    return false;
  };
  return st;
}

// Adaptive render ratio controller (Zone B, 2026-10-10 step 5). Pure logic, no DOM: unit-tested in node
// (adaptive-res.test.mjs).
// - starts at the cap; ignores the warm-up after ready (shader compiles, uploads, LOD fetches) and any 1 s window holding a
//   hitch (a frame > hitchMs AND > 3x the window median: an outlier, so a uniformly slow device still adapts); decides on the window's MEDIAN frame time (one stall cannot move it).
// - drop one rung after dropWindows valid windows under dropFps; never drops while median >= dropFps.
// - climb one rung after climbWindows valid windows >= climbFps (vsync-friendly: 60 Hz frames give 60).
// - anti-oscillation: a rung we fell off is blocked for backoff (20 s, doubling per failure, max 120 s); 1 settle window after
//   every change; a rung that fails 3 times stays closed for the session; the dead band dropFps..climbFps changes nothing.
// - ladder: cap .. floor in 0.125 steps; at detailAt the detail-reach shortening is its own rung (before any lower ratio).
export function createAdaptiveRes(o = {}) {
  const cap = o.cap ?? 2, floor = Math.min(cap, o.floor ?? 1.25), step = o.step ?? 0.125, detailAt = o.detailAt ?? 1.75;
  const warmupMs = o.warmupMs ?? 8000, hitchMs = o.hitchMs ?? 250, dropFps = o.dropFps ?? 44, climbFps = o.climbFps ?? 50;
  const dropWindows = o.dropWindows ?? 3, climbWindows = o.climbWindows ?? 3, backoffMs = o.backoffMs ?? 20000, backoffMax = o.backoffMax ?? 120000, maxFails = o.maxFails ?? 3;
  const ladder = [];
  let det = true;
  for (let r = cap; r >= floor - 1e-6; r -= step) {
    const rr = Math.round(r * 1000) / 1000;
    ladder.push({ ratio: rr, detail: det });
    if (det && o.hasDetail !== false && Math.abs(rr - detailAt) < 1e-3) { det = false; ladder.push({ ratio: rr, detail: false }); }
  }
  let i = 0, ready = null, winStart = null, ft = [], slow = 0, fast = 0, settle = 0, changes = 0;
  const blockUntil = new Map(), fails = new Map();
  const st = { get level() { return ladder[i]; }, get index() { return i; }, ladder, last: null, get changes() { return changes; } };
  st.markReady = (now) => { ready = now; winStart = now; ft = []; };
  /** feed one frame; returns true when the level changed */
  st.frame = (dtMs, now) => {
    if (winStart === null) winStart = now;
    ft.push(dtMs);
    if (now - winStart < 1000) return false;
    const s = ft.slice().sort((a, b) => a - b), med = s[s.length >> 1], mx = s[s.length - 1];
    const fps = 1000 / Math.max(med, 1e-3);
    ft = []; winStart = now;
    const why = ready === null ? "not-ready" : now - ready < warmupMs ? "warm-up" : mx > hitchMs && mx > 3 * med ? "hitch" : settle > 0 ? "settle" : "";
    st.last = { fps, maxMs: mx, why, level: ladder[i] };
    if (why) { if (why === "settle") settle--; slow = 0; fast = 0; return false; }
    if (fps < dropFps) {
      fast = 0;
      if (++slow >= dropWindows && i < ladder.length - 1) {
        const n = (fails.get(i) || 0) + 1; fails.set(i, n);
        blockUntil.set(i, n >= maxFails ? Infinity : now + Math.min(backoffMax, backoffMs * 2 ** (n - 1)));   // 3rd failure: rung closed for the session
        i++; slow = 0; settle = 1; changes++; return true;
      }
    } else if (fps >= climbFps) {
      slow = 0;
      if (++fast >= climbWindows && i > 0 && !((blockUntil.get(i - 1) || 0) > now)) { i--; fast = 0; settle = 1; changes++; return true; }
    } else { slow = 0; fast = 0; }
    return false;
  };
  return st;
}

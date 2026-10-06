/**
 * Zone A look, copied from packs/zone-a/play/play.js.
 * The stick turns yaw. A swipe on the view tilts, then the spring eases back to level.
 * Caps stay under the shake trip used on that page.
 */

export const LOOK_SENS = 0.0038;
export const LOOK_PMIN = -0.61;
export const LOOK_PMAX = 1.40;
export const LOOK_OFF_MIN = -0.9;
export const LOOK_OFF_MAX = 1.70;
export const LOOK_W_DRAG = 14;
export const LOOK_W_BACK = 2.4;
export const LOOK_V_DRAG = 2.6;
export const LOOK_V_BACK = 0.8;
export const LOOK_A_DRAG = 6;
export const LOOK_A_BACK = 0.9;
export const TURN_DPS = 150;
export const WALK_SPD = 2.85;
export const GALLOP_SPD = 4.4;

export function springLim(x, v, goal, dt, w, vmax, amax) {
  let a = w * w * (goal - x) - 2 * w * v;
  if (a > amax) a = amax;
  else if (a < -amax) a = -amax;
  let nv = v + a * dt;
  if (nv > vmax) nv = vmax;
  else if (nv < -vmax) nv = -vmax;
  return [x + nv * dt, nv];
}

export function createLook() {
  return { drag: false, goal: 0, cur: 0, v: 0, ptr: -1, ly: 0 };
}

export function stepLook(look, dt) {
  if (!(dt > 0)) return;
  if (!look.drag && look.cur === 0 && look.v === 0) return;
  const goal = look.drag ? look.goal : 0;
  const w = look.drag ? LOOK_W_DRAG : LOOK_W_BACK;
  const vmax = look.drag ? LOOK_V_DRAG : LOOK_V_BACK;
  const amax = look.drag ? LOOK_A_DRAG : LOOK_A_BACK;
  const sp = springLim(look.cur, look.v, goal, dt, w, vmax, amax);
  let x = sp[0];
  let v = sp[1];
  if (x > LOOK_OFF_MAX) { x = LOOK_OFF_MAX; if (v > 0) v = 0; }
  else if (x < LOOK_OFF_MIN) { x = LOOK_OFF_MIN; if (v < 0) v = 0; }
  if (!look.drag && Math.abs(x) < 1e-4 && Math.abs(v) < 1e-3) { x = 0; v = 0; }
  look.cur = x;
  look.v = v;
}

export function pushLook(look, dy) {
  if (!dy) return;
  let g = look.goal + dy * LOOK_SENS;
  if (g > LOOK_OFF_MAX) g = LOOK_OFF_MAX;
  else if (g < LOOK_OFF_MIN) g = LOOK_OFF_MIN;
  look.goal = g;
}

export function endLook(look) {
  look.ptr = -1;
  look.drag = false;
  look.goal = 0;
}

export function pitchOf(base, extra) {
  const add = extra || 0;
  if (!add) return base;
  let pitch = base + add;
  const lo = Math.min(base, LOOK_PMIN);
  if (pitch > LOOK_PMAX) pitch = LOOK_PMAX;
  else if (pitch < lo) pitch = lo;
  return pitch;
}

export function wrap360(deg) {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}

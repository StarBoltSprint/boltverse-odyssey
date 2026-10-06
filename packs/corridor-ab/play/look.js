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
export const SPRINT_MAX = 8.6;
export const SPRINT_ACCEL = 1.65;
export const SPRINT_EASE = 2.15;
export const CHASE_BOOM = 6.1;
export const CHASE_EYE = 3.5;
export const CHASE_SLIDE = 0.9;
/** Aim height that puts the horizon near 32% from the top of a 720×1600 view. */
export const CHASE_AIM_Y = 2.52;
export const PAW_FRAC_FALLBACK = 0.92;

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

export function forwardOf(headingDeg) {
  const y = headingDeg * Math.PI / 180;
  return [Math.sin(y), 0, Math.cos(y)];
}

/** Zone A camera right: up × horizontal forward. Stick-right turns toward this axis. */
export function chaseRight(headingDeg) {
  const y = headingDeg * Math.PI / 180;
  return [Math.cos(y), 0, -Math.sin(y)];
}

export function chaseEye(headingDeg, x, z) {
  const f = forwardOf(headingDeg);
  const r = chaseRight(headingDeg);
  return [
    x - f[0] * CHASE_BOOM + r[0] * CHASE_SLIDE,
    CHASE_EYE,
    z - f[2] * CHASE_BOOM + r[2] * CHASE_SLIDE,
  ];
}

export function chasePitch() {
  return Math.atan2(CHASE_AIM_Y - CHASE_EYE, CHASE_BOOM);
}

/** Tallest cooked monolith, metres. Pitch-up above the rest chase, radians. */
export const GATE_TOP = 28;
export const PITCH_UP_MAX = 0.22;

/**
 * Raise the chase so a tall top stays inside the frame.
 * Never returns a pitch below `current` (never looks further down).
 * The extra above the rest chase is capped.
 */
export function pitchForTall(current, topY, dist, vfov) {
  const half = vfov * 0.5;
  const angMax = Math.atan(0.9 * Math.tan(half));
  const need = Math.atan2(topY - CHASE_EYE, Math.max(1, dist)) - angMax;
  let pitch = current > need ? current : need;
  const cap = current > chasePitch() + PITCH_UP_MAX ? current : chasePitch() + PITCH_UP_MAX;
  if (pitch > cap) pitch = cap;
  if (pitch < current) pitch = current;
  return pitch;
}

/** Fraction from the top of the portrait where the eye-level horizon lands. */
export function horizonFromTop(vfov) {
  const ndc = Math.tan(-chasePitch()) / Math.tan(vfov * 0.5);
  return 0.5 - ndc * 0.5;
}

/** Fraction from the top for a point `dist` metres from the eye at `worldY`. */
export function chaseScreenY(worldY, dist, vfov, pitch) {
  const p = pitch == null ? chasePitch() : pitch;
  const ang = Math.atan2(worldY - CHASE_EYE, dist) - p;
  const ndc = Math.tan(ang) / Math.tan(vfov * 0.5);
  return 0.5 - ndc * 0.5;
}

/**
 * View matrix, column-major. The first row is zone A's camera right, so the
 * picture is not mirrored and stick-right turns to screen-right.
 * Writes into `out` (16 floats).
 */
export function chaseViewInto(out, eye, target) {
  let fx = target[0] - eye[0];
  let fy = target[1] - eye[1];
  let fz = target[2] - eye[2];
  const fl = Math.hypot(fx, fy, fz) || 1;
  fx /= fl;
  fy /= fl;
  fz /= fl;
  const hx = target[0] - eye[0];
  const hz = target[2] - eye[2];
  const hl = Math.hypot(hx, hz) || 1;
  const rx = hz / hl;
  const ry = 0;
  const rz = -hx / hl;
  let ux = fy * rz - fz * ry;
  let uy = fz * rx - fx * rz;
  let uz = fx * ry - fy * rx;
  const ul = Math.hypot(ux, uy, uz) || 1;
  ux /= ul;
  uy /= ul;
  uz /= ul;
  out[0] = rx;
  out[1] = ux;
  out[2] = -fx;
  out[3] = 0;
  out[4] = ry;
  out[5] = uy;
  out[6] = -fy;
  out[7] = 0;
  out[8] = rz;
  out[9] = uz;
  out[10] = -fz;
  out[11] = 0;
  out[12] = -(rx * eye[0] + ry * eye[1] + rz * eye[2]);
  out[13] = -(ux * eye[0] + uy * eye[1] + uz * eye[2]);
  out[14] = fx * eye[0] + fy * eye[1] + fz * eye[2];
  out[15] = 1;
  return out;
}

/**
 * Held sprint climbs toward SPRINT_MAX. How hard the stick is pushed sets the
 * acceleration. Releasing eases back to a walk, or to a stop.
 */
export function stepSpeed(speed, forward, gallop, dt) {
  const fwd = Math.abs(forward) < 0.04 ? 0 : Math.max(0, Math.min(1, forward));
  let target = 0;
  if (fwd > 0 && !gallop) target = WALK_SPD * (0.45 + 0.55 * Math.min(1, fwd / 0.72));
  if (gallop && fwd > 0) {
    const hold = Math.max(0, Math.min(1, (fwd - 0.72) / 0.28));
    const accel = SPRINT_ACCEL * (0.4 + 0.6 * Math.max(hold, 0.35));
    const next = speed + accel * dt;
    return next > SPRINT_MAX ? SPRINT_MAX : next;
  }
  if (speed > target) {
    const eased = speed - SPRINT_EASE * dt;
    return eased < target ? target : eased;
  }
  const up = speed + SPRINT_ACCEL * dt;
  return up > target ? target : up;
}

/** Charge 0..1 tracks how long sprint has been held. Density reads this. */
export function stepCharge(charge, forward, gallop, dt) {
  const fwd = forward > 0.04 ? forward : 0;
  if (gallop && fwd > 0) {
    const hold = Math.max(0.35, Math.min(1, (fwd - 0.72) / 0.28));
    const next = charge + 0.28 * hold * dt;
    return next > 1 ? 1 : next;
  }
  const eased = charge - 0.22 * dt;
  return eased < 0 ? 0 : eased;
}

/** World y of the paw row. The row sits (1 - pawFrac) up the quad, on groundY. */
export function pawLine(groundY, worldH, pawFrac) {
  const frac = pawFrac > 0 ? pawFrac : PAW_FRAC_FALLBACK;
  const y0 = -(1 - frac) * worldH;
  return groundY + y0 + (1 - frac) * worldH;
}

/** How fast a corrective offset may close, metres per second. A shove is not one frame. */
export const CHASE_PUSH_RATE = 3.4;
/** How fast a pitch step may close, radians per second. The tall-monolith snap is 0.22. */
export const CHASE_PITCH_RATE = 0.85;

export function createChase() {
  return {
    eye: [0, CHASE_EYE, 0],
    rigid: [0, CHASE_EYE, 0],
    pitch: chasePitch(),
    tp: chasePitch(),
    ready: false,
  };
}

export function resetChase(cam) {
  cam.ready = false;
}

/**
 * Largest position step a continuous sprint-plus-turn can produce in `dt`.
 * Anything larger is a shove or a shell correction and is eased.
 */
export function kinematicStep(speed, turn, dt) {
  const orbit = Math.hypot(CHASE_BOOM, CHASE_SLIDE) * Math.abs(turn || 0) * TURN_DPS * Math.PI / 180;
  return (Math.max(0, speed || 0) + orbit) * dt * 1.25 + 0.03;
}

/**
 * `rigid` is the chase parent (it turns and sprints with Bolt).
 * `target` is that parent after the magnification cone.
 * The parent delta is followed every frame, unless it is a shove larger than
 * a continuous sprint-plus-turn. The cone offset and the leftover shove ease
 * at CHASE_PUSH_RATE. A still passes `snap` and holds the settled target.
 */
export function stepChase(cam, rigid, target, pitch, dt, snap, speed, turn) {
  if (snap || !cam.ready || !(dt > 0)) {
    cam.eye = [target[0], target[1], target[2]];
    cam.rigid = [rigid[0], rigid[1], rigid[2]];
    cam.pitch = pitch;
    cam.tp = pitch;
    cam.ready = true;
    return cam;
  }
  const rdx = rigid[0] - cam.rigid[0];
  const rdy = rigid[1] - cam.rigid[1];
  const rdz = rigid[2] - cam.rigid[2];
  const rstep = Math.hypot(rdx, rdy, rdz);
  const kin = kinematicStep(speed, turn, dt);
  let fx = rdx;
  let fy = rdy;
  let fz = rdz;
  if (rstep > kin && rstep > 1e-8) {
    const k = kin / rstep;
    fx *= k;
    fy *= k;
    fz *= k;
  }
  let nx = cam.eye[0] + fx;
  let ny = cam.eye[1] + fy;
  let nz = cam.eye[2] + fz;
  const ex = target[0] - nx;
  const ey = target[1] - ny;
  const ez = target[2] - nz;
  const err = Math.hypot(ex, ey, ez);
  const allow = CHASE_PUSH_RATE * dt;
  if (err <= allow || err < 1e-8) {
    nx = target[0];
    ny = target[1];
    nz = target[2];
  } else {
    const k = allow / err;
    nx += ex * k;
    ny += ey * k;
    nz += ez * k;
  }
  cam.eye = [nx, ny, nz];
  cam.rigid = [rigid[0], rigid[1], rigid[2]];

  const dp = pitch - cam.tp;
  const pKin = LOOK_V_DRAG * dt + 0.004;
  let fp = dp;
  if (Math.abs(dp) > pKin) fp = Math.sign(dp) * pKin;
  let np = cam.pitch + fp;
  const pe = pitch - np;
  const pAllow = CHASE_PITCH_RATE * dt;
  if (Math.abs(pe) <= pAllow) np = pitch;
  else np += Math.sign(pe) * pAllow;
  cam.pitch = np;
  cam.tp = pitch;
  return cam;
}

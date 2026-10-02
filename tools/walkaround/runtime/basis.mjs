/**
 * Camera basis shared by the hull builder and the play view.
 *
 * World: Y up. Walk-around yaw 0 puts the eye on +Z looking at the origin
 * (forward -Z). Heading 0 looks along +Z; heading 90 looks along +X.
 * right = cross(forward, worldUp). up = cross(right, forward).
 * cross(worldUp, forward) mirrors every hull view. If steering feels
 * backwards, negate the turn input. Do not negate right.
 *
 * Pixels are not drawn here.
 */

export const HANDEDNESS = {
  schema: "walkaround-basis-1",
  worldUp: [0, 1, 0],
  right: "cross(forward, worldUp)",
  up: "cross(right, forward)",
  yawZeroOn: "+Z",
  positiveYawToward: "+X",
  screenRightAtYaw0: "+X",
};

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function norm(v) {
  const n = Math.hypot(v[0], v[1], v[2]);
  if (n < 1e-8) throw new Error("zero vector");
  return [v[0] / n, v[1] / n, v[2] / n];
}

export function rightMatches(forward, right) {
  let expect = cross(forward, [0, 1, 0]);
  const n = Math.hypot(expect[0], expect[1], expect[2]);
  if (n < 1e-8) return true;
  expect = [expect[0] / n, expect[1] / n, expect[2] / n];
  const d = Math.hypot(expect[0] - right[0], expect[1] - right[1], expect[2] - right[2]);
  return d < 1e-3;
}

export function angDist(a, b) {
  let d = Math.abs((((a - b) % 360) + 360) % 360);
  if (d > 180) d = 360 - d;
  return d;
}

/**
 * Eye on the ring. yawDeg 0 is +Z. Positive yaw moves the eye toward +X.
 * elevationDeg 90 looks down from above. Omit it for the legacy eyeY path.
 */
export function cameraBasis(yawDeg, distance, eyeY = 0, elevationDeg = null) {
  const yaw = (yawDeg * Math.PI) / 180;
  let position;
  let elevOut;
  if (elevationDeg == null) {
    position = [Math.sin(yaw) * distance, eyeY, Math.cos(yaw) * distance];
    elevOut = (Math.atan2(eyeY, Math.max(distance, 1e-8)) * 180) / Math.PI;
  } else {
    const elev = (elevationDeg * Math.PI) / 180;
    const horiz = Math.cos(elev) * distance;
    position = [Math.sin(yaw) * horiz, Math.sin(elev) * distance + eyeY, Math.cos(yaw) * horiz];
    elevOut = elevationDeg;
  }
  const forward = norm([-position[0], -position[1], -position[2]]);
  let worldUp = [0, 1, 0];
  let right = cross(forward, worldUp);
  if (Math.hypot(right[0], right[1], right[2]) < 1e-8) {
    worldUp = [0, 0, 1];
    right = cross(forward, worldUp);
  }
  right = norm(right);
  const up = norm(cross(right, forward));
  return { yawDeg, elevationDeg: elevOut, position, forward, right, up, distance };
}

/** Chase camera. Heading 0 looks +Z, heading 90 looks +X. */
export function chaseBasis(headingDeg) {
  const yaw = (headingDeg * Math.PI) / 180;
  const forward = [Math.sin(yaw), 0, Math.cos(yaw)];
  const right = norm(cross(forward, [0, 1, 0]));
  const up = norm(cross(right, forward));
  return { headingDeg, forward, right, up };
}

/**
 * Nearest walk-around yaw for an eye bearing. Same sign as yawDeg.
 * Bearing 90 selects yaw 90, not yaw 270.
 */
export function viewIndexForEyeYaw(bearingDeg, yawDegs) {
  if (!yawDegs.length) throw new Error("no yaws");
  let best = 0;
  let bestD = 1e9;
  for (let i = 0; i < yawDegs.length; i++) {
    const d = angDist(bearingDeg, yawDegs[i]);
    if (d < bestD - 1e-9) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** True when a collider is the zone ring worn as a wall. Stones are not that circle. */
export function isRingWall(zoneCenter, ringRadius, colliders) {
  const cx = zoneCenter[0];
  const cz = zoneCenter[1];
  return colliders.some((c) => {
    const center = c.center || [0, 0];
    const dx = center[0] - cx;
    const dz = center[1] - cz;
    return Math.hypot(dx, dz) <= 0.05 && Math.abs((c.radius_m || 0) - ringRadius) <= 0.05;
  });
}

/**
 * First footprint that contains the hero disc. Colliders are hull footprints
 * (center + radius_m), one per solid instance. Never pass the ring radius.
 */
export function blockedBy(x, z, heroR, colliders) {
  for (const c of colliders) {
    const center = c.center || [0, 0];
    const dx = x - center[0];
    const dz = z - center[1];
    const r = (c.radius_m || 0) + heroR;
    if (dx * dx + dz * dz <= r * r) return c;
  }
  return null;
}

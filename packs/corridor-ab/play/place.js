/**
 * Placement only. Maps a hung WFC corridor onto metres.
 * Does not sample a texel or build a mesh.
 */

export function gateMouth(center, headingDeg, radius) {
  const rad = (Number(headingDeg) * Math.PI) / 180;
  const c0 = Array.isArray(center) ? center : [0, 0];
  return {
    x: Number(c0[0]) + Math.sin(rad) * Number(radius),
    z: Number(c0[1] || 0) + Math.cos(rad) * Number(radius),
  };
}

/** along is metres from the first waypoint. lengthM is the corridor length. */
export function poseOnCorridor(waypoints, lengthM, along) {
  const pts = waypoints || [];
  if (!pts.length) return { x: 0, z: 0, heading: 0 };
  if (pts.length === 1) return { x: pts[0][0], z: pts[0][1], heading: 0 };
  const length = Number(lengthM) > 0 ? Number(lengthM) : 0;
  const t = length <= 0 ? 0 : Math.min(1, Math.max(0, Number(along) / length));
  const f = t * (pts.length - 1);
  const i = Math.min(pts.length - 2, Math.floor(f));
  const u = f - i;
  const a = pts[i];
  const b = pts[i + 1];
  let heading = (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI;
  if (heading < 0) heading += 360;
  return {
    x: a[0] + (b[0] - a[0]) * u,
    z: a[1] + (b[1] - a[1]) * u,
    heading,
  };
}

export function cellCenter(col, row, tileM) {
  const step = Number(tileM);
  return [(Number(col) + 0.5) * step, (Number(row) + 0.5) * step];
}

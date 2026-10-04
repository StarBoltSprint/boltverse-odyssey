/**
 * Foot contact and native scale. Code places. It does not enlarge a cutout.
 */

export function worldHeight(contentH, focal, approachM, capM) {
  const h = Number(contentH) || 0;
  const f = Number(focal) || 0;
  const approach = Number(approachM) || 0;
  const cap = Number(capM) || 0;
  if (h <= 0 || f <= 0 || approach <= 0) return 0;
  const limit = (0.98 * approach * h) / f;
  return Math.min(cap, limit);
}

export function footY(seat, bury) {
  return seat - bury;
}

/** Lowest ground under the card's bottom edge, so the skirt meets the mesh. */
export function seatMin(groundAt, x, z, yaw, planes, halfW) {
  let min = Infinity;
  const n = planes > 0 ? planes : 1;
  for (let k = 0; k < n; k++) {
    const a = yaw + (k * Math.PI) / n;
    const ux = Math.cos(a);
    const uz = -Math.sin(a);
    for (let i = -2; i <= 2; i++) {
      const t = (i / 2) * halfW;
      const h = groundAt(x + ux * t, z + uz * t);
      if (h < min) min = h;
    }
  }
  return min;
}

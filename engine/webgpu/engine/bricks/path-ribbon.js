// Shared height of the luminous ribbon and Bolt's feet.
// cut20 pinned the drawn ribbon to Bolt with a distance clamp (CPU yr + GPU rp).
// That clamp does not follow the path sample. Denser samples do not raise it.
// The ribbon Y is the path sample Y. Feet use that same sample, so they share world space.

export function cut20RibbonY({ pathY, boltY, ds }) {
  if (ds <= 0) return Math.max(pathY, boltY - 0.02 * -ds);
  const rise = boltY > 20 ? 0 : (0.03 * ds + 0.6 * (1 - Math.exp(-ds / 4)));
  return Math.min(pathY, boltY + rise);
}

// GPU rp() after the CPU clamp. dh is horizontal distance from Bolt.
export function cut20RpY({ ribbonY, boltY, dh, eyeY }) {
  const k = 1 + (0.04 - 1) * smoothstep(20, 120, eyeY);
  const dy = ribbonY - boltY;
  const lim = 0.12 * k * dh;
  const drop = 0.10 * k * dh;
  return boltY + clamp(dy, -drop, lim);
}

export function ribbonY({ pathY }) {
  return pathY;
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

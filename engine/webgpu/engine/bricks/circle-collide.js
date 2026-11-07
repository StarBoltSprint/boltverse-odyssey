// engine/bricks/circle-collide.js — dense circle slide.
// Same push-out as makeMeadowCollide, but many circles per cell (crystal clusters).
// Does not replace or edit the meadow rock grid.
export function makeCircleCollide(circles, opts = {}) {
  const boltR = opts.boltR ?? 0.42;
  const cell = opts.cell ?? 6;
  const maxStep = opts.maxStep ?? 0.12;
  const iters = opts.iters ?? 2;
  const grid = new Map();
  for (const c of circles) {
    const k = Math.floor(c.x / cell) + ',' + Math.floor(c.z / cell);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(c);
  }

  function circlesAt(x, z) {
    const C = [];
    const gx = Math.floor(x / cell), gz = Math.floor(z / cell);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const L = grid.get((gx + a) + ',' + (gz + b));
      if (L) for (const c of L) C.push(c);
    }
    return C;
  }

  function slide(x, z, psi) {
    let hit = null;
    for (let it = 0; it < iters; it++) {
      for (const c of circlesAt(x, z)) {
        let dx = x - c.x, dz = z - c.z;
        const R = c.r + boltR, d = Math.hypot(dx, dz);
        if (d >= R) continue;
        if (d < 1e-3) { dx = Math.cos(psi); dz = -Math.sin(psi); }
        else { dx /= d; dz /= d; }
        const fx = -Math.sin(psi), fz = -Math.cos(psi);
        if (dx * fx + dz * fz < -0.97) {
          const s = (dx * fz - dz * fx) >= 0 ? 1 : -1;
          dx += -fz * s * 0.3; dz += fx * s * 0.3;
          const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        }
        x = c.x + dx * R; z = c.z + dz * R;
        hit = [c.x, c.z, c.r];
      }
    }
    return { x, z, hit };
  }

  function move(x, z, psi, vx, vz, dt) {
    const dist = Math.hypot(vx, vz) * dt;
    const n = Math.max(1, Math.ceil(dist / Math.max(maxStep, 1e-4)));
    const h = dt / n;
    let hit = null;
    for (let s = 0; s < n; s++) {
      x += vx * h; z += vz * h;
      const r = slide(x, z, psi);
      x = r.x; z = r.z;
      if (r.hit) hit = r.hit;
    }
    return { x, z, hit };
  }

  return { slide, move, circlesAt, circles };
}

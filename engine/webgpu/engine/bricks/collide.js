// engine/bricks/collide.js — circle slide for rocks, boles, and the mill.
// Substep the live move so a fast gallop cannot tunnel; the demo integrator already steps at 240 Hz.
export function trunkRadius(height, scale = 0.055, minR = 0.45) {
  return Math.max(minR, height * scale);
}

export function fillTreeColliders(grid, cell, trees, scale = 0.055, minR = 0.45) {
  for (let i = 0; i < trees.length; i += 4) {
    const x = trees[i], z = trees[i + 1];
    const k = Math.floor(x / cell) + ',' + Math.floor(z / cell);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push([x, z, trunkRadius(trees[i + 2], scale, minR)]);
  }
}

export function makeMeadowCollide(opts) {
  const {
    ROCKS, rockCell, RCELL, treeGrid, TREE_GRID,
    boltR = 0.42, rockRadScale = 0.95, maxStep = 0.12, iters = 2,
  } = opts;

  function circlesAt(x, z) {
    const C = [];
    const cx0 = Math.floor(x / RCELL), cz0 = Math.floor(z / RCELL);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const k = rockCell(cx0 + a, cz0 + b) * 4;
      if (ROCKS[k] < 0) continue;
      C.push([(cx0 + a + ROCKS[k]) * RCELL, (cz0 + b + ROCKS[k + 1]) * RCELL, ROCKS[k + 2] * rockRadScale]);
    }
    const gx = Math.floor(x / TREE_GRID), gz = Math.floor(z / TREE_GRID);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const L = treeGrid.get((gx + a) + ',' + (gz + b));
      if (L) for (const t of L) C.push(t);
    }
    return C;
  }

  function slide(x, z, psi) {
    let hit = null;
    for (let it = 0; it < iters; it++) {
      for (const [ox, oz, r] of circlesAt(x, z)) {
        let dx = x - ox, dz = z - oz;
        const R = r + boltR, d = Math.hypot(dx, dz);
        if (d >= R) continue;
        if (d < 1e-3) { dx = Math.cos(psi); dz = -Math.sin(psi); }
        else { dx /= d; dz /= d; }
        const fx = -Math.sin(psi), fz = -Math.cos(psi);
        if (dx * fx + dz * fz < -0.97) {
          const s = (dx * fz - dz * fx) >= 0 ? 1 : -1;
          dx += -fz * s * 0.3; dz += fx * s * 0.3;
          const l = Math.hypot(dx, dz); dx /= l; dz /= l;
        }
        x = ox + dx * R; z = oz + dz * R;
        hit = [ox, oz, r];
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

  return { slide, move, circlesAt };
}

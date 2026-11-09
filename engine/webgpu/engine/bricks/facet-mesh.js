// engine/bricks/facet-mesh.js — triangle soup for house geometry.
// Stride 9 floats: position, normal, uv, material id. No textures of its own.
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export function createMesh() {
  const f = [];
  function tri(a, b, c, ua, ub, uc, mat) {
    const n = norm(cross(sub(b, a), sub(c, a)));
    const vs = [[a, ua], [b, ub], [c, uc]];
    for (const [p, u] of vs) f.push(p[0], p[1], p[2], mat, n[0], n[1], n[2], u[0]);
  }
  function quad(a, b, c, d, ua, ub, uc, ud, mat) {
    tri(a, b, c, ua, ub, uc, mat);
    tri(a, c, d, ua, uc, ud, mat);
  }
  function box(cx, cy, cz, sx, sy, sz, yaw, mat) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const co = Math.cos(yaw), si = Math.sin(yaw);
    const P = [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz], [-hx, hy, -hz], [hx, hy, -hz], [hx, hy, hz], [-hx, hy, hz]]
      .map(([x, y, z]) => [cx + x * co - z * si, cy + y, cz + x * si + z * co]);
    const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const face = (i0, i1, i2, i3) => quad(P[i0], P[i1], P[i2], P[i3], uv[0], uv[1], uv[2], uv[3], mat);
    face(0, 3, 2, 1);
    face(4, 5, 6, 7);
    face(3, 7, 6, 2);
    face(1, 5, 4, 0);
    face(2, 6, 5, 1);
    face(0, 4, 7, 3);
  }
  function boxBevel(cx, cy, cz, sx, sy, sz, yaw, mat, bevel) {
    const b = Math.min(bevel ?? Math.min(sx, sy, sz) * 0.08, sx * 0.28, sy * 0.28, sz * 0.28);
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const ix = hx - b, iy = hy - b, iz = hz - b;
    const co = Math.cos(yaw), si = Math.sin(yaw);
    const R = (x, y, z) => [cx + x * co - z * si, cy + y, cz + x * si + z * co];
    const q = (a, b, c, d) => {
      let A = R(...a), B = R(...b), C = R(...c), D = R(...d);
      const n = cross(sub(B, A), sub(C, A));
      const mid = [(A[0] + C[0]) / 2 - cx, (A[1] + C[1]) / 2 - cy, (A[2] + C[2]) / 2 - cz];
      if (mid[0] * n[0] + mid[1] * n[1] + mid[2] * n[2] < 0) { const t = B; B = D; D = t; }
      quad(A, B, C, D, [0, 0], [1, 0], [1, 1], [0, 1], mat);
    };
    q([-ix, hy, -iz], [ix, hy, -iz], [ix, hy, iz], [-ix, hy, iz]);
    q([-ix, -hy, iz], [ix, -hy, iz], [ix, -hy, -iz], [-ix, -hy, -iz]);
    q([-ix, -iy, hz], [ix, -iy, hz], [ix, iy, hz], [-ix, iy, hz]);
    q([ix, -iy, -hz], [-ix, -iy, -hz], [-ix, iy, -hz], [ix, iy, -hz]);
    q([hx, -iy, iz], [hx, -iy, -iz], [hx, iy, -iz], [hx, iy, iz]);
    q([-hx, -iy, -iz], [-hx, -iy, iz], [-hx, iy, iz], [-hx, iy, -iz]);
    q([-ix, hy, iz], [ix, hy, iz], [ix, iy, hz], [-ix, iy, hz]);
    q([ix, hy, -iz], [-ix, hy, -iz], [-ix, iy, -hz], [ix, iy, -hz]);
    q([ix, hy, iz], [ix, hy, -iz], [hx, iy, -iz], [hx, iy, iz]);
    q([-ix, hy, -iz], [-ix, hy, iz], [-hx, iy, iz], [-hx, iy, -iz]);
    q([-ix, -hy, -iz], [ix, -hy, -iz], [ix, -iy, -hz], [-ix, -iy, -hz]);
    q([ix, -hy, iz], [-ix, -hy, iz], [-ix, -iy, hz], [ix, -iy, hz]);
    q([ix, -hy, -iz], [ix, -hy, iz], [hx, -iy, iz], [hx, -iy, -iz]);
    q([-ix, -hy, iz], [-ix, -hy, -iz], [-hx, -iy, -iz], [-hx, -iy, iz]);
    q([ix, iy, iz], [ix, -iy, iz], [hx, -iy, iz], [hx, iy, iz]);
    q([-ix, -iy, iz], [-ix, iy, iz], [-hx, iy, iz], [-hx, -iy, iz]);
    q([ix, -iy, -iz], [ix, iy, -iz], [hx, iy, -iz], [hx, -iy, -iz]);
    q([-ix, iy, -iz], [-ix, -iy, -iz], [-hx, -iy, -iz], [-hx, iy, -iz]);
  }
  function crystal(x, y, z, radius, height, yaw, mat) {
    const N = 8;
    const ys = [0, 0.2, 0.58, 1];
    const rs = [0.62, 1, 0.55, 0];
    const rings = ys.map((t, ri) => {
      const out = [];
      for (let i = 0; i < N; i++) {
        const a = yaw + (i / N) * Math.PI * 2;
        out.push([x + Math.cos(a) * radius * rs[ri], y + height * t, z + Math.sin(a) * radius * rs[ri]]);
      }
      return out;
    });
    for (let r = 0; r < ys.length - 1; r++) {
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        const tip = rs[r + 1] === 0;
        if (tip) tri(rings[r][j], rings[r][i], [x, y + height, z], [1, 0], [0, 0], [0.5, 1], mat);
        else quad(rings[r][j], rings[r][i], rings[r + 1][i], rings[r + 1][j], [1, 0], [0, 0], [0, 1], [1, 1], mat);
      }
    }
  }
  function skyDome(r = 600, mat = 5) {
    const stacks = 14, slices = 28;
    const sph = (p, u) => [r * Math.sin(p) * Math.cos(u), r * Math.cos(p), r * Math.sin(p) * Math.sin(u)];
    for (let i = 0; i < stacks; i++) {
      const p0 = (i / stacks) * Math.PI * 0.62;
      const p1 = ((i + 1) / stacks) * Math.PI * 0.62;
      for (let j = 0; j < slices; j++) {
        const u0 = (j / slices) * Math.PI * 2;
        const u1 = ((j + 1) / slices) * Math.PI * 2;
        const a = sph(p0, u0), b = sph(p0, u1), c = sph(p1, u1), d = sph(p1, u0);
        tri(a, d, b, [0, 0], [0, 1], [1, 0], mat);
        tri(b, d, c, [1, 0], [0, 1], [1, 1], mat);
      }
    }
  }
  return {
    tri, quad, box, boxBevel, crystal, skyDome, f,
    finish() { return new Float32Array(f); },
    get count() { return f.length / 8; },
  };
}

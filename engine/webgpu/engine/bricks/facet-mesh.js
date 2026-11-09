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
  function hexPrism(cx, cy, cz, radius, height, yaw, tilt, mat, seed = 1) {
    const N = 6;
    const hsh = (k) => {
      const s = Math.sin(seed * 17.2 + k * 91.7) * 43758.5453;
      return s - Math.floor(s);
    };
    const weights = [];
    for (let i = 0; i < N; i++) weights.push(0.72 + hsh(i) * 0.55);
    const wsum = weights.reduce((a, b) => a + b, 0);
    const ang = [];
    let acc = hsh(20) * 0.5;
    for (let i = 0; i < N; i++) {
      ang.push(acc);
      acc += (weights[i] / wsum) * Math.PI * 2;
    }
    const co = Math.cos(yaw), si = Math.sin(yaw);
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const P = (x, y, z) => {
      const y1 = y * ct - z * st;
      const z1 = y * st + z * ct;
      return [cx + x * co - z1 * si, cy + y1, cz + x * si + z1 * co];
    };
    const bevel = Math.min(radius * 0.16, 0.045);
    const ring = (y, rad, h) => ang.map((a) => P(Math.cos(a) * rad, y, Math.sin(a) * rad));
    const emit = (p, nrm, h) => f.push(p[0], p[1], p[2], mat, nrm[0], nrm[1], nrm[2], h);
    const triH = (a, ha, b, hb, c, hc) => {
      let A = a, B = b, C = c, hA = ha, hB = hb, hC = hc;
      let nrm = norm(cross(sub(B, A), sub(C, A)));
      const mid = [(A[0] + B[0] + C[0]) / 3 - cx, (A[1] + B[1] + C[1]) / 3 - cy, (A[2] + B[2] + C[2]) / 3 - cz];
      if (mid[0] * nrm[0] + mid[1] * nrm[1] + mid[2] * nrm[2] < 0) {
        const t = B; B = C; C = t;
        const th = hB; hB = hC; hC = th;
        nrm = norm(cross(sub(B, A), sub(C, A)));
      }
      emit(A, nrm, hA); emit(B, nrm, hB); emit(C, nrm, hC);
    };
    const quadH = (a, ha, b, hb, c, hc, d, hd) => {
      triH(a, ha, b, hb, c, hc);
      triH(a, ha, c, hc, d, hd);
    };
    const broken = hsh(21) > 0.5;
    const lipY = height * 0.6;
    const baseOut = ring(0, radius * 0.9, 0);
    const baseIn = ring(0, Math.max(radius * 0.9 - bevel, radius * 0.55), 0);
    const lipOut = ring(lipY, radius, 0.6);
    const lipIn = ring(lipY, Math.max(radius - bevel, radius * 0.62), 0.6);
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      quadH(baseIn[i], 0, baseIn[j], 0, lipIn[j], 0.6, lipIn[i], 0.6);
      quadH(baseOut[i], 0, baseIn[i], 0, lipIn[i], 0.6, lipOut[i], 0.6);
    }
    if (!broken) {
      const tip = P(0, height, 0);
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        triH(lipIn[j], 0.6, lipIn[i], 0.6, tip, 1);
        quadH(lipOut[i], 0.6, lipIn[i], 0.6, lipIn[j], 0.6, lipOut[j], 0.6);
      }
    } else {
      const stepY = height * (0.74 + hsh(22) * 0.08);
      const stepR = radius * (0.28 + hsh(23) * 0.16);
      const off = (hsh(24) - 0.5) * stepR;
      const shelf = ring(stepY, stepR, 0.82);
      const tip = P(off, height * (0.9 + hsh(25) * 0.08), off * 0.4);
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        quadH(lipIn[i], 0.6, lipIn[j], 0.6, shelf[j], 0.82, shelf[i], 0.82);
        triH(shelf[j], 0.82, shelf[i], 0.82, tip, 1);
      }
    }
    for (let i = 1; i < N - 1; i++) triH(baseIn[0], 0, baseIn[i + 1], 0, baseIn[i], 0);
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
  function chipBlock(cx, y0, cz, sx, sy, sz, yaw, leanX, leanZ, mat, seed = 1) {
    const hsh = (k) => {
      const s = Math.sin(seed * 19.1 + k * 73.3) * 43758.5453;
      return s - Math.floor(s);
    };
    const co = Math.cos(yaw), si = Math.sin(yaw);
    const world = (x, y, z) => [cx + x * co - z * si, y, cz + x * si + z * co];
    const hx = sx / 2, hz = sz / 2;
    const corners = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
    const samples = 6;
    const loop = [];
    for (let e = 0; e < 4; e++) {
      const a = corners[e];
      const b = corners[(e + 1) % 4];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const il = Math.hypot(mid[0], mid[1]) || 1;
      const inn = [-mid[0] / il, -mid[1] / il];
      const bites = [0.34, 0.72].map((t0, k) => ({
        t: t0 + (hsh(e * 5 + k) - 0.5) * 0.1,
        r: (0.12 + hsh(e * 5 + k + 6) * 0.16) * len,
        depth: (0.08 + hsh(e * 5 + k + 11) * 0.1) * Math.min(sx, sz) * 0.45,
      }));
      for (let i = 0; i < samples; i++) {
        const t = i / samples;
        let x = a[0] + (b[0] - a[0]) * t;
        let z = a[1] + (b[1] - a[1]) * t;
        for (const bite of bites) {
          const along = (t - bite.t) * len;
          if (Math.abs(along) < bite.r) {
            const depth = bite.depth * Math.sqrt(Math.max(0, 1 - (along / bite.r) ** 2));
            x += inn[0] * depth;
            z += inn[1] * depth;
          }
        }
        loop.push([x, z]);
      }
    }
    const Y1 = y0 + sy;
    const triOut = (A, B, C) => {
      let nrm = norm(cross(sub(B, A), sub(C, A)));
      const mid = [(A[0] + B[0] + C[0]) / 3 - cx, (A[1] + B[1] + C[1]) / 3 - (y0 + sy / 2), (A[2] + B[2] + C[2]) / 3 - cz];
      if (mid[0] * nrm[0] + mid[1] * nrm[1] + mid[2] * nrm[2] < 0) tri(A, C, B, [0, 0], [0, 1], [1, 0], mat);
      else tri(A, B, C, [0, 0], [1, 0], [1, 1], mat);
    };
    for (let i = 0; i < loop.length; i++) {
      const j = (i + 1) % loop.length;
      const A = world(loop[i][0], y0, loop[i][1]);
      const B = world(loop[j][0], y0, loop[j][1]);
      const C = world(loop[j][0] + leanX, Y1, loop[j][1] + leanZ);
      const D = world(loop[i][0] + leanX, Y1, loop[i][1] + leanZ);
      triOut(A, B, C);
      triOut(A, C, D);
    }
    const top0 = world(loop[0][0] + leanX, Y1, loop[0][1] + leanZ);
    const bot0 = world(loop[0][0], y0, loop[0][1]);
    for (let i = 1; i < loop.length - 1; i++) {
      triOut(top0, world(loop[i][0] + leanX, Y1, loop[i][1] + leanZ), world(loop[i + 1][0] + leanX, Y1, loop[i + 1][1] + leanZ));
      triOut(bot0, world(loop[i + 1][0], y0, loop[i + 1][1]), world(loop[i][0], y0, loop[i][1]));
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
    tri, quad, box, boxBevel, crystal, hexPrism, chipBlock, skyDome, f,
    finish() { return new Float32Array(f); },
    get count() { return f.length / 8; },
  };
}

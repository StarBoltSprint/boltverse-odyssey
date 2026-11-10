// engine/bricks/facet-mesh.js — triangle soup for house geometry.
// Stride 9 floats: position, normal, uv, material id. No textures of its own.
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export function createMesh() {
  const f = [];
  function tri(a, b, c, ua, ub, uc, mat, forcedN) {
    const n = forcedN || norm(cross(sub(b, a), sub(c, a)));
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
    const dir = (x, y, z) => {
      const y1 = y * ct - z * st;
      const z1 = y * st + z * ct;
      return norm([x * co - z1 * si, y1, x * si + z1 * co]);
    };
    const faceN = (i) => {
      const j = (i + 1) % N;
      const a = (ang[i] + ang[j]) / 2;
      const wob = (hsh(i + 30) - 0.5) * 0.16;
      return dir(Math.cos(a) + wob, 0.07, Math.sin(a) - wob * 0.45);
    };
    const quadN = (a, ha, b, hb, c, hc, d, hd, nrm) => {
      emit(a, nrm, ha); emit(b, nrm, hb); emit(c, nrm, hc);
      emit(a, nrm, ha); emit(c, nrm, hc); emit(d, nrm, hd);
    };
    const broken = hsh(21) > 0.28;
    const lipY = height * 0.62;
    const baseOut = ring(0, radius * 1.08, 0);
    const baseIn = ring(0, Math.max(radius * 1.08 - bevel, radius * 0.55), 0);
    const lipOut = ring(lipY, radius * 0.62, 0.6);
    const lipIn = ring(lipY, Math.max(radius * 0.62 - bevel, radius * 0.34), 0.6);
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      quadH(baseIn[i], 0, baseIn[j], 0, lipIn[j], 0.6, lipIn[i], 0.6);
      quadN(baseOut[i], -0.02, baseIn[i], -0.02, lipIn[i], -0.62, lipOut[i], -0.62, faceN(i));
    }
    if (!broken) {
      const tip = P(0, height, 0);
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        triH(lipIn[j], 0.6, lipIn[i], 0.6, tip, 1);
        quadN(lipOut[i], -0.62, lipIn[i], -0.62, lipIn[j], -0.62, lipOut[j], -0.62, faceN(i));
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
    const samples = 8;
    const loop = [];
    const cap = Math.min(hx, hz) * 0.72;
    for (let e = 0; e < 4; e++) {
      const a = corners[e];
      const b = corners[(e + 1) % 4];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const il = Math.hypot(mid[0], mid[1]) || 1;
      const inn = [-mid[0] / il, -mid[1] / il];
      const edgeBite = (t0, k) => ({
        t: t0 + (hsh(e * 5 + k) - 0.5) * 0.08,
        r: 0.10 + hsh(e * 5 + k + 6) * 0.22,
        depth: Math.min(cap, 0.10 + hsh(e * 5 + k + 11) * 0.18),
      });
      const bites = [
        { t: 0.02, r: 0.12 + hsh(e + 30) * 0.14, depth: Math.min(cap, 0.12 + hsh(e + 40) * 0.16) },
        edgeBite(0.38, 1),
        edgeBite(0.72, 2),
      ];
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
    const rows = 5;
    const scoop = (x, z, yNorm, id) => {
      if (id % 4 !== 0) return [x, z];
      const il = Math.hypot(x, z) || 1;
      const inn = [-x / il, -z / il];
      const yC = 0.22 + hsh(id * 3 + 50) * 0.56;
      const r = 0.12 + hsh(id * 3 + 70) * 0.2;
      const depth = Math.min(0.22, cap * 0.55, 0.1 + hsh(id * 3 + 90) * 0.12);
      const dy = (yNorm - yC) * sy;
      let extra = Math.abs(dy) < r ? depth * Math.sqrt(Math.max(0, 1 - (dy / r) ** 2)) : 0;
      const end = Math.min(1, yNorm / 0.16) * Math.min(1, (1 - yNorm) / 0.16);
      extra = Math.min(extra, Math.hypot(x, z) * 0.42) * Math.max(0, end);
      return [x + inn[0] * extra, z + inn[1] * extra];
    };
    const rings = [];
    for (let r = 0; r <= rows; r++) {
      const yn = r / rows;
      rings.push(loop.map(([x, z], i) => {
        const p = scoop(x, z, yn, i);
        return [p[0] + leanX * yn, p[1] + leanZ * yn];
      }));
    }
    const triOut = (A, B, C) => {
      let nrm = norm(cross(sub(B, A), sub(C, A)));
      const mid = [(A[0] + B[0] + C[0]) / 3 - cx, (A[1] + B[1] + C[1]) / 3 - (y0 + sy / 2), (A[2] + B[2] + C[2]) / 3 - cz];
      if (mid[0] * nrm[0] + mid[1] * nrm[1] + mid[2] * nrm[2] < 0) tri(A, C, B, [0, 0], [0, 1], [1, 0], mat);
      else tri(A, B, C, [0, 0], [1, 0], [1, 1], mat);
    };
    for (let r = 0; r < rows; r++) {
      const yA = y0 + (sy * r) / rows;
      const yB = y0 + (sy * (r + 1)) / rows;
      for (let i = 0; i < loop.length; i++) {
        const j = (i + 1) % loop.length;
        const A = world(rings[r][i][0], yA, rings[r][i][1]);
        const B = world(rings[r][j][0], yA, rings[r][j][1]);
        const C = world(rings[r + 1][j][0], yB, rings[r + 1][j][1]);
        const D = world(rings[r + 1][i][0], yB, rings[r + 1][i][1]);
        triOut(A, B, C);
        triOut(A, C, D);
      }
    }
    const bot = rings[0].map(([x, z]) => world(x, y0, z));
    const top = rings[rows].map(([x, z]) => world(x, Y1, z));
    for (let i = 1; i < loop.length - 1; i++) {
      triOut(top[0], top[i], top[i + 1]);
      triOut(bot[0], bot[i + 1], bot[i]);
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

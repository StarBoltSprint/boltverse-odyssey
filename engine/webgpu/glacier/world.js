// Frozen rift. Noise-displaced sheets, arches, and peaks. No box primitives.
import { createMesh } from '../engine/bricks/facet-mesh.js';
import { MAT, GLACIER, planetCenter, PLANET, DRAWS } from './biome.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function noise2(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const h = (i, k) => hash(ix + i, iz + k);
  return (h(0, 0) * (1 - u) + h(1, 0) * u) * (1 - v) + (h(0, 1) * (1 - u) + h(1, 1) * u) * v;
}

function fbm2(x, z) {
  let f = 0, a = 1, s = 0, freq = 1;
  for (let i = 0; i < 4; i++) {
    f += a * noise2(x * freq, z * freq);
    s += a;
    a *= 0.5;
    freq *= 2.07;
  }
  return s ? f / s : 0;
}

export function pathX(z) {
  return 78 * Math.sin(z * 0.00082) + 28 * Math.sin(z * 0.00205 + 0.6);
}

export function pathPsi(z) {
  const dxdz = (pathX(z - 0.25) - pathX(z + 0.25)) / -0.5;
  return Math.atan2(dxdz, 1);
}

export function floorHalf(z) {
  return 20 + 6 * Math.sin(z * 0.00105) + 2.2 * Math.sin(z * 0.0034 + 0.8);
}

export function floorH(x, z) {
  const lat = x - pathX(z);
  const crevLat = 6.4 + 1.8 * Math.sin(z * 0.0047);
  const crevW = 0.42 + 0.35 * fbm2(z * 0.031, 2.2);
  const crev = Math.exp(-((lat - crevLat) ** 2) / crevW) * (2.4 + 1.1 * fbm2(z * 0.017, 4.1));
  // Wind runs down the rift. Ridges are long in z and short across, and they
  // stay off the narrow slot under Bolt so the card is not cut.
  const slot = Math.min(1, Math.max(0, (Math.abs(lat) - 0.75) / 1.4));
  const n = fbm2(lat * 0.72, z * 0.09);
  const n2 = fbm2(lat * 1.6 + 3.3, z * 0.19);
  const ridge = Math.pow(Math.max(0, (n - 0.46) / 0.54), 1.7);
  const sast = (ridge * 1.05 + (n2 - 0.5) * 0.28) * slot;
  const broad = 0.42 * Math.sin(z * 0.009) + 0.3 * Math.sin(z * (Math.PI * 2 / 12.6) + lat * 0.04);
  return broad + sast - crev;
}

export function terrH(x, z) { return floorH(x, z); }

export function wallHeight(z, side) {
  const swell = 0.5 + 0.5 * Math.sin(z * 0.00135 + side * 1.2);
  const n = fbm2(z * 0.0031, side * 2.2 + 1.4);
  return 60 + swell * 112 + n * 28;
}

export function wallPoint(z, side, u) {
  const half = floorHalf(z);
  const h = wallHeight(z, side);
  const n = fbm2(z * 0.09 + u * 3.1, side * 2.4);
  const chip = fbm2(z * 0.62, u * 9.5 + side);
  const groove = Math.exp(-((fbm2(z * 0.21, side * 5.5) - 0.5) ** 2) / 0.012);
  const base = half + 0.35;
  const bulge = Math.sin(Math.min(1, u) * Math.PI) * (3.2 + 6.5 * n);
  const ledge = u > 0.72 && u < 0.86 ? (0.86 - Math.abs(u - 0.79) * 8) * 1.6 : 0;
  const x = pathX(z) + side * (base + bulge + (chip - 0.5) * 2.2 + ledge - groove * 1.35);
  const y0 = floorH(pathX(z) + side * (half - 0.4), z);
  const thick = 0.55 + hash(Math.floor(u * 9 + side), 3) * 0.9;
  const y = y0 + Math.pow(Math.min(1, Math.max(0, u)), 0.8) * h + (n - 0.5) * thick;
  return [x, y, z];
}

function stepZ(z) {
  if (z > -45) return 0.42;
  if (z > -90) return 0.8;
  if (z > -260) return 2.2;
  if (z > -900) return 8;
  if (z > -1800) return 16;
  return 26;
}

function columns(z0, z1) {
  const zs = [z0];
  let guard = 0;
  while (zs[zs.length - 1] > z1 + 1e-3 && guard++ < 8000) {
    const z = zs[zs.length - 1];
    const wobble = 0.72 + hash(z * 9.2, 4.4) * 0.5;
    zs.push(Math.max(z1, z - stepZ(z) * wobble));
  }
  return zs;
}

function face(mesh, a, b, c, d, mat, toward) {
  const n = cross(sub(b, a), sub(c, a));
  if (dot(n, toward) < 0) mesh.quad(a, d, c, b, [0, 0], [0, 1], [1, 1], [1, 0], mat);
  else mesh.quad(a, b, c, d, [0, 0], [1, 0], [1, 1], [0, 1], mat);
}

const TURN = 75 * Math.PI / 180;

export function integrate(live, dt, input) {
  const turn = Math.max(-1, Math.min(1, input.turn || 0));
  const target = turn * TURN;
  const tau = turn === 0 ? 0.10 : 0.25;
  live.w += (target - live.w) * (1 - Math.exp(-dt / tau));
  if (turn === 0 && Math.abs(live.w) < 0.05) live.w = 0;
  live.psi += live.w * dt;
  const vx = -Math.sin(live.psi) * live.v;
  const vz = -Math.cos(live.psi) * live.v;
  let x = live.x + vx * dt;
  let z = live.z + vz * dt;
  const cx = pathX(z);
  const half = Math.max(6, floorHalf(z) - 1.3);
  const lat = x - cx;
  if (lat > half) x = cx + half;
  if (lat < -half) x = cx - half;
  live.x = x;
  live.z = z;
  const camTau = 0.11;
  const maxRel = 10 * Math.PI / 180;
  live.cam += (live.psi - live.cam) * (1 - Math.exp(-dt / camTau));
  if (live.psi - live.cam > maxRel) live.cam = live.psi - maxRel;
  if (live.cam - live.psi > maxRel) live.cam = live.psi + maxRel;
  return live;
}

export function demoSteer(live) {
  const look = live.z - 6.5;
  let d = pathPsi(look) - live.psi;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const dx = pathX(look) - live.x;
  const dz = look - live.z;
  const lat = dx * Math.cos(live.psi) + dz * -Math.sin(live.psi);
  const turn = Math.max(-1, Math.min(1, d * 0.85 - lat * 0.35));
  return { turn, run: true };
}

export function chaseInput(_t, live) {
  return demoSteer(live);
}

function addRibbon(mesh, zs, rowFn, mat, towardFn) {
  const rows = 28;
  let prev = null;
  for (const z of zs) {
    const col = [];
    for (let t = 0; t <= rows; t++) col.push(rowFn(z, t / rows));
    if (prev) {
      for (let t = 0; t < rows; t++) {
        const mid = [
          (prev[t][0] + col[t][0] + prev[t + 1][0] + col[t + 1][0]) / 4,
          (prev[t][1] + col[t][1] + prev[t + 1][1] + col[t + 1][1]) / 4,
          (prev[t][2] + col[t][2] + prev[t + 1][2] + col[t + 1][2]) / 4,
        ];
        face(mesh, prev[t], col[t], col[t + 1], prev[t + 1], mat, towardFn(mid, z));
      }
    }
    prev = col;
  }
}

function addArch(mesh, z0, spring, peak) {
  const half = floorHalf(z0) + 3;
  const segs = 28;
  const sides = 9;
  const rings = [];
  for (let s = 0; s <= segs; s++) {
    const u = s / segs;
    const lat = -half + u * 2 * half;
    const lift = Math.sin(u * Math.PI);
    const x = pathX(z0) + lat;
    const y = spring + lift * (peak - spring);
    const z = z0 + Math.sin(u * Math.PI) * 3.2 + (fbm2(u * 4.4, z0 * 0.01) - 0.5) * 2.2;
    const ring = [];
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      const chip = hash(k * 3 + Math.floor(u * 8), z0 * 0.01) > 0.72 ? 0.62 : 1;
      const rad = (2.4 + (fbm2(u * 4.2 + k, z0 * 0.02) - 0.5) * 1.5) * chip;
      const top = Math.max(0, Math.sin(a));
      const rx = rad * (0.7 - top * 0.2);
      const ry = rad * (top > 0.2 ? 0.55 : 1);
      ring.push([
        x + Math.cos(a) * rx,
        y + Math.sin(a) * ry,
        z + Math.cos(a + 0.4) * rad * 0.45,
      ]);
    }
    rings.push({ ring, x, y, z });
  }
  for (let s = 0; s < segs; s++) {
    for (let k = 0; k < sides; k++) {
      const k2 = (k + 1) % sides;
      const c0 = rings[s];
      const c1 = rings[s + 1];
      const a = c0.ring[k], b = c0.ring[k2], c = c1.ring[k2], d = c1.ring[k];
      const mid = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2];
      const axis = [(c0.x + c1.x) / 2, (c0.y + c1.y) / 2, (c0.z + c1.z) / 2];
      face(mesh, a, b, c, d, MAT.arch, sub(mid, axis));
    }
  }
}

function addFall(mesh, z0, side) {
  const cols = 14;
  const rows = 22;
  const width = 7 + fbm2(z0, side) * 8;
  const grid = [];
  for (let j = 0; j <= rows; j++) {
    const row = [];
    const t = j / rows;
    for (let i = 0; i <= cols; i++) {
      const u = i / cols;
      const z = z0 + (u - 0.5) * width;
      const wall = wallPoint(z, side, 0.78 * (1 - t) + 0.02);
      const lip = 1.4 + t * 2.2;
      const n = fbm2(z * 0.2, t * 6 + side);
      row.push([
        wall[0] - side * lip + (n - 0.5) * 0.8,
        wall[1] - t * 1.2 + (n - 0.5) * 1.6,
        wall[2] + (n - 0.5) * 0.6,
      ]);
    }
    grid.push(row);
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      face(mesh, grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i], MAT.fall, [-side, 0.05, 0]);
    }
  }
}

function addRidge(mesh, x0, z0, x1, z1, height, halfW) {
  const segs = 11;
  const sides = 4;
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len = Math.hypot(dx, dz) || 1;
  const rx = -dz / len;
  const rz = dx / len;
  const rows = [];
  for (let s = 0; s <= segs; s++) {
    const t = s / segs;
    const crest = Math.sin(t * Math.PI);
    const h = height * (0.28 + 0.72 * Math.pow(crest, 0.9)) * (0.78 + 0.22 * fbm2(t * 4.4, z0 * 0.002));
    const cx = x0 + dx * t + (fbm2(t * 3, 6) - 0.5) * halfW * 0.35;
    const cz = z0 + dz * t;
    const row = [];
    for (let k = 0; k <= sides; k++) {
      const q = k / sides * 2 - 1;
      const fall = Math.pow(Math.abs(q), 1.25);
      const span = halfW * (0.25 + 0.75 * Math.abs(q));
      row.push([cx + rx * q * span, h * (1 - fall), cz + rz * q * span]);
    }
    rows.push(row);
  }
  for (let s = 0; s < segs; s++) {
    for (let k = 0; k < sides; k++) {
      const a = rows[s][k], b = rows[s][k + 1], c = rows[s + 1][k + 1], d = rows[s + 1][k];
      const mid = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2];
      face(mesh, a, b, c, d, MAT.mountain, [mid[0] - (x0 + x1) * 0.5, 0.8, mid[2] - (z0 + z1) * 0.5]);
    }
  }
}

function makePlanet() {
  const mesh = createMesh();
  const c = planetCenter();
  const stacks = 26;
  const slices = 40;
  const r = PLANET.radius;
  for (let i = 0; i < stacks; i++) {
    const p0 = (i / stacks) * Math.PI;
    const p1 = ((i + 1) / stacks) * Math.PI;
    for (let j = 0; j < slices; j++) {
      const u0 = (j / slices) * Math.PI * 2;
      const u1 = ((j + 1) / slices) * Math.PI * 2;
      const at = (p, u) => [
        c[0] + r * Math.sin(p) * Math.cos(u),
        c[1] + r * Math.cos(p),
        c[2] + r * Math.sin(p) * Math.sin(u),
      ];
      const a = at(p0, u0), b = at(p0, u1), d = at(p1, u0), e = at(p1, u1);
      const mid = [(a[0] + e[0]) / 2, (a[1] + e[1]) / 2, (a[2] + e[2]) / 2];
      face(mesh, a, b, e, d, MAT.sky, sub(mid, c));
    }
  }
  return mesh.finish();
}

function makeIcicle() {
  const m = createMesh();
  const sides = 5;
  const radii = [0.22, 0.15, 0.28, 0.13, 0.19];
  const ring = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + 0.15 * i;
    ring.push([Math.cos(a) * radii[i], 0, Math.sin(a) * radii[i] * 0.85]);
  }
  const tip = [0.05, -1, 0.03];
  const top = [0.02, 0.06, -0.01];
  for (let i = 0; i < sides; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % sides];
    m.tri(a, b, tip, [0, 0], [1, 0], [0.5, 1], MAT.icicle);
    m.tri(top, b, a, [0.5, 1], [1, 0], [0, 0], MAT.icicle);
  }
  return m.finish();
}

function makeChunk() {
  const m = createMesh();
  const sides = 6;
  const ring = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const rad = 0.55 + hash(i, 4) * 0.5;
    ring.push([Math.cos(a) * rad, 0.08, Math.sin(a) * rad * 0.8]);
  }
  const top = [0.05, 0.72, -0.04];
  for (let i = 0; i < sides; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % sides];
    m.tri(a, b, top, [0, 0], [1, 0], [0.5, 1], MAT.drift);
    m.tri([0, 0, 0], b, a, [0.5, 0], [1, 0], [0, 0], MAT.drift);
  }
  return m.finish();
}

function makeDrift() {
  const m = createMesh();
  const sides = 7;
  const rings = [0.15, 0.55, 1];
  const ys = [0.55, 0.28, 0];
  const pts = rings.map((ry, r) => {
    const row = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const rad = ry * (0.7 + 0.35 * hash(i, r));
      row.push([Math.cos(a) * rad * 1.6, ys[r], Math.sin(a) * rad * 0.7]);
    }
    return row;
  });
  for (let r = 0; r < pts.length - 1; r++) {
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      face(m, pts[r][i], pts[r][j], pts[r + 1][j], pts[r + 1][i], MAT.drift, [0, 1, 0]);
    }
  }
  return m.finish();
}

function pushInst(list, x, y, z, yaw, sx, sy, sz, lean = 0) {
  list.push(x, y, z, yaw, sx, sy, sz, lean);
}

function smoothSnow(verts) {
  const acc = new Map();
  const key = (x, y, z) => `${Math.round(x * 40)}_${Math.round(y * 40)}_${Math.round(z * 40)}`;
  const soft = (m) => m === MAT.snow || m === MAT.wall || m === MAT.arch || m === MAT.fall;
  for (let i = 0; i < verts.length; i += 8) {
    if (!soft(Math.round(verts[i + 3]))) continue;
    const k = key(verts[i], verts[i + 1], verts[i + 2]);
    const n = acc.get(k) || [0, 0, 0];
    n[0] += verts[i + 4]; n[1] += verts[i + 5]; n[2] += verts[i + 6];
    acc.set(k, n);
  }
  for (let i = 0; i < verts.length; i += 8) {
    if (!soft(Math.round(verts[i + 3]))) continue;
    const n = acc.get(key(verts[i], verts[i + 1], verts[i + 2]));
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    verts[i + 4] = n[0] / l; verts[i + 5] = n[1] / l; verts[i + 6] = n[2] / l;
  }
}

export function buildWorld() {
  const mesh = createMesh();
  const nx = 26;
  // One ground sheet. The same lateral fractions on every row, no z offset,
  // so neighbouring quads meet and do not cross.
  const weights = [];
  for (let i = 1; i < nx; i++) weights.push(0.22 + hash(i * 2.1, 8.4) * 1.9);
  const sumW = weights.reduce((s, w) => s + w, 0);
  const fracs = [0];
  let acc = 0;
  for (const w of weights) { acc += w / sumW; fracs.push(acc); }
  fracs.push(1);
  const groundZs = [GLACIER.z0];
  let guardG = 0;
  while (groundZs[groundZs.length - 1] > GLACIER.z1 + 1e-3 && guardG++ < 8000) {
    const z = groundZs[groundZs.length - 1];
    const base = z > -55 ? 0.18 : z > -180 ? 0.5 : z > -800 ? 2.6 : z > -2000 ? 9 : 24;
    const step = base * (0.4 + hash(z * 17.3, 2.8) * 1.35);
    groundZs.push(Math.max(GLACIER.z1, z - step));
  }
  let prev = null;
  for (const z of groundZs) {
    const half = floorHalf(z) - 0.05;
    const row = fracs.map((f) => {
      const lat = -half + f * 2 * half;
      const x = pathX(z) + lat;
      return [x, floorH(x, z), z];
    });
    if (prev) {
      for (let i = 0; i < nx; i++) face(mesh, prev[i], prev[i + 1], row[i + 1], row[i], MAT.snow, [0, 1, 0]);
    }
    prev = row;
  }
  const zs = columns(GLACIER.z0, GLACIER.z1);
  addRibbon(mesh, zs, (z, u) => wallPoint(z, -1, u), MAT.wall, () => [1, 0.12, 0]);
  addRibbon(mesh, zs, (z, u) => wallPoint(z, 1, u), MAT.wall, () => [-1, 0.12, 0]);

  const arches = [-24, -70, -160, -480, -1200, -2200];
  arches.forEach((z, i) => addArch(mesh, z, 8 + (i % 2), i > 3 ? 42 : 14 + i * 2));
  [-40, -110, -260, -640, -1600].forEach((z) => addFall(mesh, z, -1));

  const bands = [
    { z: -2200, n: 4, h: 260, w: 180, len: 700, spread: 900 },
    { z: -4200, n: 3, h: 520, w: 280, len: 1100, spread: 1400 },
    { z: -6800, n: 3, h: 780, w: 360, len: 1600, spread: 1800 },
  ];
  for (const band of bands) {
    for (let i = 0; i < band.n; i++) {
      const side = (i - (band.n - 1) / 2) * band.spread;
      const jitter = (hash(i, band.z) - 0.5) * 400;
      const x = pathX(band.z) + side + jitter;
      const h = band.h * (0.75 + hash(i, band.z + 2) * 0.5);
      addRidge(mesh, x - band.len * 0.5, band.z + 180, x + band.len * 0.5, band.z - 220, h, band.w);
    }
  }

  const icicles = [];
  for (const z0 of arches) {
    const spring = 10;
    const peak = z0 < -400 ? 36 : 16;
    for (let k = 0; k < 7; k++) {
      const u = 0.18 + (k / 6) * 0.64;
      const half = floorHalf(z0) + 3;
      const lat = -half + u * 2 * half;
      const lift = Math.sin(u * Math.PI);
      const x = pathX(z0) + lat;
      const y = spring + lift * (peak - spring) - 2.1;
      const len = 0.8 + hash(z0, k) * 2.2;
      pushInst(icicles, x, y, z0, hash(k, z0) * 4, 0.35 + hash(k, 2) * 0.3, len, 0.32, (hash(k, 5) - 0.5) * 0.2);
    }
  }

  const drifts = [];
  const chunks = [];
  for (let n = 0; n < 48; n++) {
    const z = 24 - n * 6.5;
    const side = n % 2 === 0 ? 1 : -1;
    const lat = side * (2.4 + hash(n, 8) * 8);
    const x = pathX(z) + lat;
    const y = floorH(x, z);
    if (n % 3 === 0) {
      const s = 0.35 + hash(n, 11) * 0.7;
      pushInst(chunks, x, y, z, hash(n, 12) * 6, s, s * (0.7 + hash(n, 13)), s * 0.85, 0);
    } else {
      const s = 1.4 + hash(n, 11) * 2.8;
      pushInst(drifts, x, y, z, hash(n, 12) * 6, s, 0.35 + hash(n, 13) * 0.45, s * 0.55, 0);
    }
  }

  const icicleProto = makeIcicle();
  const driftProto = makeDrift();
  const chunkProto = makeChunk();
  const planet = makePlanet();
  const verts = mesh.finish();
  smoothSnow(verts);
  const instTris = (proto, list) => (proto.length / 8 / 3) * (list.length / 8);
  const worldTris = verts.length / 24;
  const planetTris = planet.length / 24;
  const budget = {
    worldTris,
    planetTris,
    icicleTris: instTris(icicleProto, icicles),
    driftTris: instTris(driftProto, drifts),
    chunkTris: instTris(chunkProto, chunks),
    draws: DRAWS.length,
    drawNames: DRAWS,
  };
  budget.totalTris = worldTris + planetTris + budget.icicleTris + budget.driftTris + budget.chunkTris;
  return {
    verts,
    planet,
    instances: {
      icicle: { proto: icicleProto, data: new Float32Array(icicles), count: icicles.length / 8 },
      drift: { proto: driftProto, data: new Float32Array(drifts), count: drifts.length / 8 },
      chunk: { proto: chunkProto, data: new Float32Array(chunks), count: chunks.length / 8 },
    },
    budget,
    extentZ: [GLACIER.z1, GLACIER.z0],
    columns: zs.length,
  };
}

export function spawn() {
  const z = 0;
  const psi = pathPsi(z);
  return { psi, x: pathX(z), z, cam: psi, w: 0, v: 0, phase: 0, run: 0 };
}

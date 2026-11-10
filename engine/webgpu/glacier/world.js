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
  const crevLat = 8.2 + 1.6 * Math.sin(z * 0.007);
  const crev = Math.exp(-((lat - crevLat) ** 2) / 1.35) * (3.8 + 1.4 * fbm2(z * 0.02, 3.3));
  const side = Math.min(1, Math.max(0, (Math.abs(lat) - 0.55) / 2.4));
  const wave = (0.24 * Math.sin(x * (Math.PI * 2 / 3.4) + z * 0.37)
    + 0.5 * Math.sin(x * (Math.PI * 2 / 8.7) - z * (Math.PI * 2 / 11.3))
    + 0.72 * Math.sin(z * (Math.PI * 2 / 15.7) + x * 0.07)) * side;
  const broad = 0.55 * Math.sin(z * 0.008) + 0.32 * Math.sin(z * (Math.PI * 2 / 11.4) + x * 0.05);
  const grain = (fbm2(x * 0.55, z * 0.48) - 0.5) * 1.05 * side;
  const pebbles = 0.26 * side * Math.sin(x * 2.15 + z * 1.63) * Math.sin(z * 1.27 - x * 0.91);
  const mound = Math.max(-0.7, Math.min(0.7, wave + grain + pebbles));
  return broad + mound - crev;
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
  const n = fbm2(z * 0.047 + u * 2.4, side * 3.1 + u * 5.5);
  const n2 = fbm2(z * 0.011, u * 1.6 + side);
  const baseX = pathX(z) + side * (half + 0.8);
  const bulge = Math.sin(u * Math.PI) * (4 + 9 * n2);
  const x = baseX + side * (bulge + (n - 0.5) * 5.2 * (0.3 + u));
  const y0 = floorH(baseX, z);
  const y = y0 + Math.pow(u, 0.86) * h + (n - 0.5) * 3.4 * u;
  const zz = z + (fbm2(z * 0.17, u * 3.3 + 8) - 0.5) * 1.1;
  return [x, y, zz];
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
  const rows = 22;
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
  const segs = 30;
  const sides = 6;
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
      const a = (k / sides) * Math.PI * 2 + u * 0.35;
      const rad = 3.4 + 1.3 * Math.sin(a * 2 + u * 5) + (fbm2(u * 3 + k, z0 * 0.02) - 0.5) * 1.1;
      ring.push([
        x + Math.cos(a) * rad * 0.55,
        y + Math.sin(a) * rad,
        z + Math.cos(a + 0.6) * rad * 0.85,
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

function addPeak(mesh, cx, cz, height, radius) {
  const rings = 7;
  const segs = 9;
  const p = (t, a) => {
    const rad = radius * (1 - t) * (0.72 + 0.4 * fbm2(Math.cos(a) * 2 + t * 3, Math.sin(a) * 2));
    const y = t * t * height * (0.92 + 0.08 * fbm2(t * 4, a));
    return [cx + Math.cos(a) * rad, y, cz + Math.sin(a) * rad];
  };
  for (let r = 0; r < rings; r++) {
    const t0 = r / rings;
    const t1 = (r + 1) / rings;
    for (let s = 0; s < segs; s++) {
      const a0 = (s / segs) * Math.PI * 2;
      const a1 = ((s + 1) / segs) * Math.PI * 2;
      const a = p(t0, a0), b = p(t0, a1), c = p(t1, a1), d = p(t1, a0);
      const mid = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2];
      face(mesh, a, b, c, d, MAT.mountain, [mid[0] - cx, 0.35, mid[2] - cz]);
    }
  }
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

function sphere(mesh) {
  const c = planetCenter();
  const stacks = 22;
  const slices = 36;
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
      face(mesh, a, b, e, d, MAT.mountain, sub(mid, c));
    }
  }
}

export function buildWorld() {
  const mesh = createMesh();
  const nx = 22;
  const groundZs = [GLACIER.z0];
  let guardG = 0;
  while (groundZs[groundZs.length - 1] > GLACIER.z1 + 1e-3 && guardG++ < 20000) {
    const z = groundZs[groundZs.length - 1];
    const base = z > -130 ? 0.145 : z > -500 ? 2.2 : z > -1600 ? 8 : 22;
    groundZs.push(Math.max(GLACIER.z1, z - base * (0.45 + hash(z * 6.1, 2.2) * 1.15)));
  }
  let prev = null;
  for (const z of groundZs) {
    const half = floorHalf(z) + 5;
    const weights = [];
    for (let i = 1; i < nx; i++) weights.push(0.28 + hash(i * 3.7, z * 8.1) * 1.55);
    const sumW = weights.reduce((s, w) => s + w, 0);
    const lats = [-half];
    let acc = -half;
    for (const w of weights) {
      acc += (w / sumW) * 2 * half;
      lats.push(acc);
    }
    lats.push(half);
    const row = lats.map((latV, i) => {
      const x = pathX(z) + latV;
      const jz = (hash(z * 4.4, i + 2) - 0.5) * 0.04;
      return [x, floorH(x, z), z + jz];
    });
    if (prev) {
      for (let i = 0; i < nx; i++) face(mesh, prev[i], prev[i + 1], row[i + 1], row[i], MAT.snow, [0, 1, 0]);
    }
    prev = row;
  }
  const zs = columns(GLACIER.z0, GLACIER.z1);
  addRibbon(mesh, zs, (z, u) => wallPoint(z, -1, u), MAT.wall, () => [1, 0.12, 0]);
  addRibbon(mesh, zs, (z, u) => wallPoint(z, 1, u), MAT.wall, () => [-1, 0.12, 0]);

  const arches = [-22, -58, -140, -420, -1100, -2100];
  arches.forEach((z, i) => addArch(mesh, z, 9 + (i % 3), i > 3 ? 48 : 16 + (i % 3) * 4));
  [-16, -48, -96, -180, -340, -720, -1500].forEach((z) => addFall(mesh, z, -1));

  const planet = planetCenter();
  for (let i = 0; i < 16; i++) {
    const along = -6800 - hash(i, 9) * 1400;
    const side = (hash(i, 4) - 0.5) * 5200;
    const h = 280 + hash(i, 2) * 640;
    let cx = pathX(along) + side;
    let cz = along;
    const dx = cx - planet[0], dy = h * 0.6 - planet[1], dz = cz - planet[2];
    if (dx * dx + dy * dy + dz * dz < (PLANET.radius + 600) ** 2) cz -= 900;
    addPeak(mesh, cx, cz, h, 160 + hash(i, 5) * 140);
  }
  sphere(mesh);

  const icicles = [];
  for (let n = 0; n < 4; n++) {
    const z0 = -20 - n * 36;
    for (let k = 0; k < 8; k++) {
      const u = 0.18 + (k / 7) * 0.64;
      const half = floorHalf(z0) * 0.82;
      const lat = -half + u * 2 * half;
      const lift = Math.sin(u * Math.PI);
      const x = pathX(z0) + lat;
      const y = 11.5 + lift * 7;
      const len = 0.7 + hash(n, k) * 1.8;
      pushInst(icicles, x, y, z0, hash(k, n) * 6, 0.45 + hash(n, k + 3) * 0.35, len, 0.38, (hash(k, 9) - 0.5) * 0.25);
    }
  }

  const drifts = [];
  for (let n = 0; n < 36; n++) {
    const z = 30 - n * 9;
    const side = n % 2 === 0 ? 1 : -1;
    const lat = side * (3.2 + hash(n, 8) * 6);
    const x = pathX(z) + lat;
    const y = floorH(x, z);
    const s = 2.4 + hash(n, 11) * 4.5;
    pushInst(drifts, x, y, z, hash(n, 12) * 6, s, 0.55 + hash(n, 13) * 0.7, s * 0.55, 0);
  }

  const icicleProto = makeIcicle();
  const driftProto = makeDrift();
  const verts = mesh.finish();
  const instTris = (proto, list) => (proto.length / 8 / 3) * (list.length / 8);
  const worldTris = verts.length / 24;
  const budget = {
    worldTris,
    icicleTris: instTris(icicleProto, icicles),
    driftTris: instTris(driftProto, drifts),
    draws: DRAWS.length,
    drawNames: DRAWS,
  };
  budget.totalTris = budget.worldTris + budget.icicleTris + budget.driftTris;
  return {
    verts,
    instances: {
      icicle: { proto: icicleProto, data: new Float32Array(icicles), count: icicles.length / 8 },
      drift: { proto: driftProto, data: new Float32Array(drifts), count: drifts.length / 8 },
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

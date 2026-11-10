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
  // Long down-rift, a few metres across, so the mid-field mesh still shows them.
  const wind = fbm2(lat * 0.18, z * 0.026);
  const wind2 = fbm2(lat * 0.42 + 2.2, z * 0.055);
  const ridge = Math.pow(Math.max(0, (wind - 0.4) / 0.6), 1.35);
  const sast = (ridge * 1.2 + (wind2 - 0.5) * 0.4) * slot;
  const broad = 0.42 * Math.sin(z * 0.009) + 0.3 * Math.sin(z * (Math.PI * 2 / 12.6) + lat * 0.04);
  return broad + sast - crev - footDent(x, z, lat);
}

function footDent(x, z, lat) {
  if (Math.abs(lat) < 0.4 || Math.abs(lat) > 1.7 || z > 8 || z < -55) return 0;
  const cell = Math.floor(z * 1.15 + (lat > 0 ? 3 : 0));
  if (hash(cell, 9.2) < 0.7) return 0;
  const zc = (cell + 0.3 + hash(cell, 2.4) * 0.45) / 1.15;
  const xc = pathX(zc) + (hash(cell, 4.1) - 0.5) * 1.5;
  const dx = x - xc;
  const dz = z - zc;
  return Math.exp(-(dx * dx / 0.07 + dz * dz / 0.12)) * 0.1;
}

export function terrH(x, z) { return floorH(x, z); }

export function wallHeight(z, side) {
  const swell = 0.5 + 0.5 * Math.sin(z * 0.00135 + side * 1.2);
  const n = fbm2(z * 0.0031, side * 2.2 + 1.4);
  return 60 + swell * 112 + n * 28;
}

const WALL_ROWS = 28;
const LEDGES = 6;

function placeWall(z, side, u, lateral) {
  const half = floorHalf(z);
  const h = wallHeight(z, side);
  const y0 = floorH(pathX(z) + side * (half - 0.4), z);
  const uu = Math.min(1, Math.max(0, u));
  const meso = (fbm2(z * 0.022 + uu * 0.4, side * 2.4) - 0.5) * 1.4;
  const y = y0 + Math.pow(uu, 0.92) * h + meso;
  const corridor = half - 1.4;
  const out = Math.max(corridor, half + 1.1 + lateral);
  return [pathX(z) + side * out, y, z];
}

function wallSample(z, side, row) {
  const u = row / (WALL_ROWS - 1);
  let off = 0;
  for (let b = 0; b < LEDGES; b++) {
    const u0 = b / LEDGES;
    const u1 = (b + 1) / LEDGES;
    if (u + 1e-6 < u0 || u > u1 + 1e-6) continue;
    const along = 0.4 + fbm2(z * 0.006 + b * 0.41, side * 1.7);
    const jut = (hash(b * 3.7, side * 2.4 + 0.6) - 0.28) * 5.2 * along;
    const local = (u - u0) / (u1 - u0);
    const lip = local > 0.8 ? (local - 0.8) / 0.2 : 0;
    off = jut + lip * (2.4 + hash(b * 1.9, side + 5) * 3.1);
    break;
  }
  const col = Math.floor(z * 0.055 + fbm2(z * 0.003, side) * 1.6);
  const colShift = (hash(col, side + 4) - 0.5) * 3.6;
  const groove = Math.exp(-((fbm2(z * 0.11, side * 3.2) - 0.47) ** 2) / 0.009) * 1.7;
  const chip = (hash(Math.floor(z * 1.7) + row * 3, side * 8 + row) - 0.5) * 1.15;
  return placeWall(z, side, u, off + colShift - groove + chip);
}

export function wallPoint(z, side, u) {
  const row = Math.min(WALL_ROWS - 1, Math.max(0, Math.round(u * (WALL_ROWS - 1))));
  return wallSample(z, side, row);
}

export function plateauH(x, z) {
  const side = x >= pathX(z) ? 1 : -1;
  const rim = wallPoint(z, side, 1);
  const rimLat = Math.abs(rim[0] - pathX(z));
  const out = Math.max(0, Math.abs(x - pathX(z)) - rimLat);
  const t = Math.min(1, out / 1500);
  const roll = (fbm2(x * 0.00085, z * 0.0005) - 0.5) * 56;
  const far = Math.min(1, Math.max(0, (-z - 700) / 5200));
  return rim[1] + (roll + far * 210 + 14) * t;
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

function archFrame(z0, index) {
  return {
    half: floorHalf(z0) * 0.9,
    foot: 8 + (index % 3) * 1.4,
    crown: index > 3 ? 28 : 15 + index * 1.6,
    thick: index > 3 ? 8.2 : 6.4,
  };
}

function archCenter(z0, u, frame) {
  const lat = -frame.half + u * 2 * frame.half;
  const lift = Math.sin(Math.min(1, Math.max(0, u)) * Math.PI);
  const y = frame.foot + lift * (frame.crown - frame.foot);
  return {
    x: pathX(z0) + lat,
    y,
    z: z0 + Math.sin(lift * Math.PI) * 1.6,
    lift,
  };
}

function addArch(mesh, z0, index) {
  const frame = archFrame(z0, index);
  const segs = 16;
  const sides = 8;
  const rings = [];
  for (let s = 0; s <= segs; s++) {
    const u = s / segs;
    const c = archCenter(z0, u, frame);
    const ring = [];
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2 - Math.PI / 2;
      const up = Math.sin(a);
      const chip = 0.58 + hash(k * 5 + Math.floor(u * 6), z0 * 0.013 + index) * 0.75;
      let rx;
      let ry;
      if (up > 0.45) {
        rx = frame.thick * (0.62 + 0.22 * chip);
        ry = frame.thick * 0.2;
      } else if (up < -0.15) {
        rx = frame.thick * (0.26 + 0.28 * chip);
        ry = frame.thick * (0.48 + 0.42 * chip);
      } else {
        rx = frame.thick * (0.32 + 0.34 * chip);
        ry = frame.thick * (0.36 + 0.22 * chip);
      }
      ring.push([
        c.x + Math.cos(a) * rx,
        c.y + up * ry,
        c.z + Math.cos(a + 0.7) * rx * 0.28,
      ]);
    }
    rings.push({ ring, x: c.x, y: c.y, z: c.z });
  }
  for (let s = 0; s < segs; s++) {
    for (let k = 0; k < sides; k++) {
      const k2 = (k + 1) % sides;
      const c0 = rings[s];
      const c1 = rings[s + 1];
      const a = c0.ring[k];
      const b = c0.ring[k2];
      const c = c1.ring[k2];
      const d = c1.ring[k];
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

function addPlateau(mesh, side) {
  const nz = 28;
  const nx = 8;
  const zFar = -10500;
  const grid = [];
  for (let j = 0; j <= nz; j++) {
    const t = j / nz;
    const z = GLACIER.z0 + (zFar - GLACIER.z0) * t;
    const rim = wallPoint(z, side, 1);
    const row = [];
    for (let i = 0; i <= nx; i++) {
      const u = i / nx;
      const reach = -7 + u * (980 + Math.min(4400, Math.max(0, -z) * 0.45));
      const x = rim[0] + side * reach;
      let y = (i === 0 ? rim[1] : plateauH(x, z)) + 0.3;
      const crackN = fbm2(x * 0.0015, z * 0.00105);
      const crack = Math.exp(-((crackN - 0.57) ** 2) / 0.0014);
      y -= crack * 16;
      row.push([x, y, z]);
    }
    grid.push(row);
  }
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = grid[j][i];
      const b = grid[j][i + 1];
      const c = grid[j + 1][i + 1];
      const d = grid[j + 1][i];
      const mid = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2];
      face(mesh, a, b, c, d, MAT.snow, [mid[0], mid[1] + 1, mid[2]]);
    }
  }
}

function addFarFloor(mesh) {
  const z0 = GLACIER.z1;
  const z1 = -10500;
  const nz = 8;
  const nx = 12;
  const grid = [];
  for (let j = 0; j <= nz; j++) {
    const z = z0 + (z1 - z0) * (j / nz);
    const left = wallPoint(z, -1, 1);
    const right = wallPoint(z, 1, 1);
    const row = [];
    for (let i = 0; i <= nx; i++) {
      const x = left[0] + (right[0] - left[0]) * (i / nx);
      const cx = pathX(z);
      const lat = Math.abs(x - cx);
      const half = floorHalf(z);
      const rimLat = Math.max(half + 1, Math.min(Math.abs(left[0] - cx), Math.abs(right[0] - cx)));
      const edge = Math.min(1, Math.max(0, (lat - half * 0.65) / Math.max(1, rimLat - half * 0.65)));
      const floor = floorH(cx, z);
      const rimY = x < cx ? left[1] : right[1];
      const far = Math.min(1, Math.max(0, (-z - 5000) / 4200));
      const y = floor + (rimY - floor) * edge + far * 90 * (1 - edge);
      row.push([x, y, z]);
    }
    grid.push(row);
  }
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = grid[j][i];
      const b = grid[j][i + 1];
      const c = grid[j + 1][i + 1];
      const d = grid[j + 1][i];
      face(mesh, a, b, c, d, MAT.snow, [0, 1, 0]);
    }
  }
}

function addRange(mesh, x0, z0, x1, z1, height, halfW) {
  const segs = 20;
  const sides = 7;
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len = Math.hypot(dx, dz) || 1;
  const rx = -dz / len;
  const rz = dx / len;
  const rows = [];
  for (let s = 0; s <= segs; s++) {
    const t = s / segs;
    const envelope = Math.sin(t * Math.PI);
    const tooth = Math.pow(Math.abs(Math.sin(t * 9.4 + z0 * 0.001)), 0.42);
    const nick = 0.55 + 0.45 * Math.abs(Math.sin(t * 17.0 + x0 * 0.0007));
    const h = height * envelope * (0.28 + 0.72 * tooth * nick);
    const cx = x0 + dx * t;
    const cz = z0 + dz * t;
    const base = plateauH(cx, cz);
    const row = [];
    for (let k = 0; k <= sides; k++) {
      const q = k / sides * 2 - 1;
      const fall = Math.pow(Math.abs(q), 0.48);
      const span = halfW * (0.12 + 0.88 * Math.abs(q));
      const jag = (hash(k * 3 + s, z0 * 0.01) - 0.5) * halfW * 0.08;
      row.push([
        cx + rx * (q * span + jag),
        base - 3 + h * (1 - fall),
        cz + rz * (q * span + jag),
      ]);
    }
    rows.push(row);
  }
  for (let s = 0; s < segs; s++) {
    for (let k = 0; k < sides; k++) {
      const a = rows[s][k];
      const b = rows[s][k + 1];
      const c = rows[s + 1][k + 1];
      const d = rows[s + 1][k];
      const mid = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2];
      face(mesh, a, b, c, d, MAT.mountain, [mid[0] - (x0 + x1) * 0.5, 1.2, mid[2] - (z0 + z1) * 0.5]);
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

function addWall(mesh, side) {
  const zs = columns(GLACIER.z0, GLACIER.z1);
  let prev = null;
  for (const z of zs) {
    const col = [];
    for (let r = 0; r < WALL_ROWS; r++) col.push(wallSample(z, side, r));
    if (prev) {
      for (let r = 0; r < WALL_ROWS - 1; r++) {
        face(mesh, prev[r], col[r], col[r + 1], prev[r + 1], MAT.wall, [-side, 0.2, 0]);
      }
    }
    prev = col;
  }
  return zs.length;
}

function smoothSnow(verts) {
  const acc = new Map();
  const key = (x, y, z) => `${Math.round(x * 40)}_${Math.round(y * 40)}_${Math.round(z * 40)}`;
  const soft = (m) => m === MAT.snow || m === MAT.wall;
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
    const half = floorHalf(z) + 2.8;
    const row = fracs.map((f) => {
      const lat = -half + f * 2 * half;
      const x = pathX(z) + lat;
      const tuck = f < 0.06 || f > 0.94 ? 0.35 : 0;
      return [x, floorH(x, z) - tuck, z];
    });
    if (prev) {
      for (let i = 0; i < nx; i++) face(mesh, prev[i], prev[i + 1], row[i + 1], row[i], MAT.snow, [0, 1, 0]);
    }
    prev = row;
  }
  const columnsN = addWall(mesh, -1) + addWall(mesh, 1);

  const arches = [-24, -70, -160, -480, -1200, -2200];
  arches.forEach((z, i) => addArch(mesh, z, i));
  [-40, -110, -260, -640, -1600].forEach((z) => addFall(mesh, z, -1));
  addPlateau(mesh, -1);
  addPlateau(mesh, 1);
  addFarFloor(mesh);

  const ranges = [
    { side: -1, z: -1050, reach: 420, len: 480, h: 70, w: 120 },
    { side: -1, z: -1750, reach: 820, len: 640, h: 120, w: 160 },
    { side: -1, z: -2500, reach: 1400, len: 560, h: 95, w: 150 },
    { side: -1, z: -1600, reach: 700, len: 900, h: 180, w: 220 },
    { side: -1, z: -3400, reach: 1400, len: 1500, h: 320, w: 340 },
    { side: -1, z: -6200, reach: 2100, len: 2200, h: 460, w: 480 },
    { side: 1, z: -2100, reach: 900, len: 1100, h: 200, w: 240 },
    { side: 1, z: -4800, reach: 1600, len: 1700, h: 380, w: 400 },
    { side: 1, z: -8600, reach: 1800, len: 2600, h: 520, w: 560 },
    { side: 0, z: -9800, reach: 0, len: 4200, h: 340, w: 700 },
  ];
  for (const r of ranges) {
    const x = pathX(r.z) + r.side * r.reach;
    addRange(mesh, x - r.len * 0.5, r.z + r.len * 0.15, x + r.len * 0.5, r.z - r.len * 0.2, r.h, r.w);
  }

  const icicles = [];
  arches.forEach((z0, index) => {
    const frame = archFrame(z0, index);
    for (let k = 0; k < 18; k++) {
      const u = 0.1 + (k / 17) * 0.8;
      const c = archCenter(z0, u, frame);
      const len = 2.6 + hash(z0, k) * 4.4;
      const hang = frame.thick * (0.95 + hash(k, z0 + 1) * 0.12);
      pushInst(
        icicles,
        c.x + (hash(k, 7) - 0.5) * 0.8,
        c.y - hang,
        c.z + 1.4,
        hash(k, z0) * 5,
        0.5 + hash(k, 2) * 0.35,
        len,
        0.42,
        (hash(k, 5) - 0.5) * 0.4,
      );
    }
  });

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
    columns: columnsN,
  };
}

export function spawn() {
  const z = 0;
  const psi = pathPsi(z);
  return { psi, x: pathX(z), z, cam: psi, w: 0, v: 0, phase: 0, run: 0 };
}

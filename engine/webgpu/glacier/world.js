// Frozen rift. Noise-displaced sheets, arches, and peaks. No box primitives.
import { createMesh } from '../engine/bricks/facet-mesh.js';
import { MAT, GLACIER, planetCenter, PLANET, DRAWS, FLAKES } from './biome.js';

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

// Long waves only. A 2 m step stays above the relief floor, and the bulge of
// a 4.5 m mesh chord stays under a couple of centimetres, so no ridge sits
// between the camera and the paws.
export function routeSmooth(z) {
  return 0.66 * Math.sin(z * 0.115) + 0.22 * Math.sin(z * 0.009 + 0.4);
}

export function floorH(x, z) {
  const lat = x - pathX(z);
  const crevLat = 6.4 + 1.8 * Math.sin(z * 0.0047);
  const crevW = 0.42 + 0.35 * fbm2(z * 0.031, 2.2);
  const crev = Math.exp(-((lat - crevLat) ** 2) / crevW) * (2.4 + 1.1 * fbm2(z * 0.017, 4.1));
  // The lane the body runs on stays the smooth route. Sastrugi start outside
  // that band, so no ridge triangle can cross the paws or the torso.
  const edge = 1.8;
  const lane = Math.min(1, Math.max(0, (Math.abs(lat) - edge) / 0.8));
  const wind = fbm2(lat * 0.11, z * 0.02);
  const wind2 = fbm2(lat * 0.2 + 2.2, z * 0.035);
  const ridge = Math.pow(Math.max(0, (wind - 0.32) / 0.68), 1.15);
  const amp = 0.35 + 0.55 * lane;
  const sast = ridge * amp + (wind2 - 0.5) * (0.1 + 0.28 * lane);
  const band = Math.min(1, Math.max(0, (Math.abs(lat) - edge) / 0.5));
  // No sine ripple on the shoulder. A 5.5 m wave lines up with the column
  // gate as the lane scrolls. The sastrugi stay.
  return routeSmooth(z) + (sast - crev - footDent(x, z, lat)) * band;
}

function footDent(x, z, lat) {
  if (Math.abs(lat) < 0.4 || Math.abs(lat) > 1.7 || z > 8 || z < -340) return 0;
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
  const near = Math.max(0, 1 - Math.max(0, -z) / 360);
  const meso = (fbm2(z * 0.022 + uu * 0.4, side * 2.4) - 0.5) * (2.6 + near * 7.5);
  const billow = (fbm2(z * 0.007, uu * 2.1 + side) - 0.5) * 11.0;
  // Narrow unequal seracs. A full-height run reads as a rectangle, and one
  // even gap between two faces reads as a slit. wallHeight() stays 60-200.
  const k = Math.floor(z * 0.07 + side * 3.0);
  const along = z * 0.07 + side * 3.0 - k;
  const width = 0.16 + hash(k, side * 4.2) * 0.2;
  const center = 0.22 + hash(k + 2, side * 1.3) * 0.56;
  const d = Math.abs(along - center) / width;
  const tooth = d < 1 ? Math.pow(1 - d, 0.65) : 0;
  const nick = 0.45 + 0.55 * hash(k, side * 9 + 1);
  const crest = 0.06 + 0.94 * tooth * nick;
  const chamfer = uu > 0.8 ? (uu - 0.8) / 0.2 : 0;
  const crown = crest * (1 - chamfer * 0.46);
  const y = y0 + Math.pow(uu, 0.76) * h * crown + meso * crown;
  const lean = (uu - 0.22) * (hash(Math.floor(z * 0.02 + side), side * 9 + 3) - 0.4) * 16;
  const pinch = 0.7 + 0.6 * Math.abs(Math.sin(z * 0.017 + side * 0.8));
  const corridor = (half - 1.4) * pinch;
  const out = Math.max(corridor, half + 1.1 + lateral + billow + lean);
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
    // Outward only. A shelf aimed at the lane reads as a flat blade on the snow.
    const jut = Math.max(0, hash(b * 3.7, side * 2.4 + 0.6) - 0.55) * 4.2 * along;
    const local = (u - u0) / (u1 - u0);
    const lip = local > 0.82 ? (local - 0.82) / 0.18 : 0;
    off = jut + lip * (1.2 + hash(b * 1.9, side + 5) * 1.6);
    break;
  }
  const col = Math.floor(z * 0.028 + fbm2(z * 0.002, side) * 1.2);
  const colShift = (hash(col, side + 4) - 0.5) * 5.5;
  const crackN = fbm2(z * 0.012, side * 2.6);
  const crevasse = Math.pow(Math.max(0, 1 - Math.abs(crackN - 0.58) / 0.16), 1.5) * 6.2;
  const nearChip = Math.max(0, 1 - Math.max(0, -z) / 360);
  const chip = (hash(Math.floor(z * 0.45) + row * 3, side * 8 + row) - 0.5) * (1.4 + nearChip * 2.8);
  return placeWall(z, side, u, off + colShift - crevasse + chip);
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
  const d = Math.max(0, -z);
  if (d < 40) return 0.5;
  if (d < 320) return 0.7 + (d - 40) * 0.006;
  if (d < 900) return 10;
  if (d < 1800) return 18;
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
  // The first two spans sit on the opening chase. Their bellies clear the
  // camera by a person-height, so the lens does not enter the ice.
  const near = index < 2 ? 8 : 0;
  return {
    half: floorHalf(z0) * 0.72,
    foot: 16 + (index % 3) * 2.2 + near,
    crown: (index > 3 ? 28 : 18 + index * 2.2) + near,
    thick: index > 3 ? 5.2 : 2.6,
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
  const near = index < 3;
  const segs = near ? 22 : 14;
  const sides = near ? 20 : 12;
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
        rx = frame.thick * (0.42 + 0.12 * chip);
        ry = frame.thick * 0.55;
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

// A sheet hung in the portrait view, left of the path, so the chase reads a fall.
// The crown is teeth, not a level rectangle.
function addCurtain(mesh, z0) {
  const cols = 14;
  const rows = 24;
  const x0 = pathX(z0) - 5.2;
  const x1 = pathX(z0) - 1.5;
  const yTop = 26;
  const yBot = routeSmooth(z0) + 0.3;
  const grid = [];
  for (let j = 0; j <= rows; j++) {
    const row = [];
    const t = j / rows;
    for (let i = 0; i <= cols; i++) {
      const u = i / cols;
      const edge = Math.min(1, Math.min(u, 1 - u) / 0.16);
      const tooth = Math.pow(Math.abs(Math.sin(u * 8.0 + z0 * 0.01)), 0.5);
      const nick = 0.3 + 0.7 * hash(i * 3, z0 * 0.02);
      const crest = edge * (0.2 + 0.8 * tooth * nick);
      const drape = Math.sin(u * Math.PI) * 0.35 * (1 - t);
      row.push([
        x0 + (x1 - x0) * u + (hash(i, z0) - 0.5) * 0.35,
        yBot + (yTop - yBot) * crest * (1 - t) + drape,
        z0 + 0.8 + Math.sin(t * Math.PI) * 0.9 + (u - 0.5) * 1.6,
      ]);
    }
    grid.push(row);
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      face(mesh, grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i], MAT.fall, [0, 0.15, 1]);
    }
  }
}

// One frozen fall. Each column has its own height, the sides drop to the
// snow, and the sheet is not a flat rectangle facing the chase.
function addStream(mesh, z0, lat0, lat1, yBot, seed) {
  const cols = 8;
  const rows = 16;
  const heights = [];
  for (let i = 0; i <= cols; i++) {
    const u = i / cols;
    const edge = Math.min(1, Math.min(u, 1 - u) / 0.2);
    const tooth = Math.pow(Math.abs(Math.sin(u * 5.5 + seed * 1.7)), 0.45);
    const nick = 0.25 + 0.75 * hash(i * 2.3, seed);
    heights.push(edge * (5 + 18 * tooth * nick));
  }
  for (let i = 1; i < heights.length; i++) {
    const cap = heights[i - 1] + 3.5;
    if (heights[i] > cap) heights[i] = cap;
  }
  for (let i = heights.length - 2; i >= 0; i--) {
    const cap = heights[i + 1] + 3.5;
    if (heights[i] > cap) heights[i] = cap;
  }
  const grid = [];
  for (let j = 0; j <= rows; j++) {
    const row = [];
    const t = j / rows;
    for (let i = 0; i <= cols; i++) {
      const u = i / cols;
      const lat = lat0 + (lat1 - lat0) * u;
      const jag = (hash(i * 1.4, seed + 3) - 0.5) * 1.1 * (0.35 + 0.65 * (1 - t));
      row.push([
        pathX(z0) + lat + jag,
        yBot + heights[i] * (1 - t),
        z0 + (hash(i, seed + 9) - 0.5) * 3.2 * (1 - t),
      ]);
    }
    grid.push(row);
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      face(mesh, grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i], MAT.fall, [0, 0.1, 1]);
    }
  }
}

// Two falls, staggered down the lane, with no lip between them. A shared
// top bar over a constant gap reads as a slit between two rectangles.
function addChaseFall(mesh, z0) {
  const yBot = routeSmooth(z0) + 0.15;
  addStream(mesh, z0, -11.2, -3.4, yBot, z0 * 0.01 + 1.3);
  addStream(mesh, z0 - 16, 2.8, 12.6, yBot, z0 * 0.01 + 4.7);
}

// A broken serac skyline across the canyon gap. Z stays constant so the
// face does not stretch, but the crest and the width are teeth, not a box.
function addHorizonRidge(mesh, z0, height, half) {
  const cols = 36;
  const rows = 8;
  const base = routeSmooth(z0);
  const grid = [];
  for (let j = 0; j <= rows; j++) {
    const row = [];
    const t = j / rows;
    for (let i = 0; i <= cols; i++) {
      const u = i / cols;
      const humpN = 4 + Math.floor(hash(z0 * 0.01, 2.2) * 3);
      const phase = u * humpN;
      const hk = Math.floor(phase);
      const hu = phase - hk;
      const width = 0.28 + hash(hk + z0 * 0.001, 6.1) * 0.34;
      const center = 0.2 + hash(hk, z0 * 0.002) * 0.6;
      const dd = Math.abs(hu - center) / width;
      const tooth = dd < 1 ? Math.pow(1 - dd, 0.55) : 0;
      const nick = 0.4 + 0.6 * hash(hk * 3, z0 * 0.003);
      const crest = tooth * nick;
      const jag = (hash(i * 5, z0 * 0.01) - 0.5) * 8 * tooth;
      row.push([pathX(z0) + (u - 0.5) * 2 * half + jag, base + t * height * crest, z0]);
    }
    grid.push(row);
  }
  const depth = 18;
  const back = grid.map((row) => row.map((p) => [p[0], p[1], p[2] - depth]));
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      face(mesh, grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i], MAT.snow, [0, 0.05, 1]);
      face(mesh, back[j][i + 1], back[j][i], back[j + 1][i], back[j + 1][i + 1], MAT.snow, [0, 0.05, -1]);
    }
  }
  for (let i = 0; i < cols; i++) {
    const a = grid[rows][i];
    const b = grid[rows][i + 1];
    const c = back[rows][i + 1];
    const d = back[rows][i];
    face(mesh, a, b, c, d, MAT.snow, [0, 1, 0]);
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
      const wall = wallPoint(z, side, 0.55 * (1 - t) + 0.02);
      const lip = 1.4 + t * 2.2;
      const n = fbm2(z * 0.2, t * 6 + side);
      const floor = floorH(wall[0], wall[2]);
      // Stay on the lower face. Climbing a serac tooth makes a diagonal
      // sheet whose UV stretch fails the gate.
      const y = Math.min(wall[1], floor + 14) - t * 1.2 + (n - 0.5) * 1.1;
      row.push([
        wall[0] - side * lip + (n - 0.5) * 0.6,
        y,
        wall[2] + (n - 0.5) * 0.4,
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
      // A deep cut beside the lane opens a dark gap. Keep the trench off the rim.
      y -= crack * (i < 2 ? 1.5 : 8);
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

function addRange(mesh, x0, z0, x1, z1, height, halfW, fine) {
  const segs = fine ? 28 : 16;
  const sides = fine ? 11 : 6;
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
  const keel = [0.02, -0.38, 0.03];
  for (let i = 0; i < sides; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % sides];
    m.tri(a, b, top, [0, 0], [1, 0], [0.5, 1], MAT.drift);
    m.tri(keel, b, a, [0.5, 0], [1, 0], [0, 0], MAT.drift);
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
      for (let r = 0; r < col.length; r++) {
        const dx = col[r][0] - prev[r][0];
        const dz = col[r][2] - prev[r][2];
        if (Math.abs(dx) > 0.75 * Math.abs(dz) && Math.abs(dz) > 1e-3) {
          col[r][0] = prev[r][0] + Math.sign(dx) * 0.75 * Math.abs(dz);
        }
      }
      for (let r = 0; r < WALL_ROWS - 1; r++) {
        face(mesh, prev[r], col[r], col[r + 1], prev[r + 1], MAT.wall, [-side, 0.2, 0]);
      }
    }
    prev = col;
  }
  return zs.length;
}

function pinRouteBand(verts) {
  for (let i = 0; i < verts.length; i += 8) {
    if (Math.round(verts[i + 3]) !== 0) continue;
    const lat = verts[i] - pathX(verts[i + 2]);
    if (Math.abs(lat) > 1.7) continue;
    const route = routeSmooth(verts[i + 2]);
    if (Math.abs(verts[i + 1] - route) > 2.5) continue;
    verts[i + 1] = route;
  }
}

function weldKey(x, y, z) {
  return `${Math.round(x * 50)}_${Math.round(y * 50)}_${Math.round(z * 50)}`;
}

// Faces more than about 37° off the nearest axis project with stretch above 1.3.
// Nudge those triangles toward that axis. Shared corners move once, so the sheet stays closed.
function relaxOffAxis(verts) {
  for (let pass = 0; pass < 5; pass++) {
    stampFaceNormals(verts);
    const acc = new Map();
    const add = (x, y, z, d) => {
      const k = weldKey(x, y, z);
      const a = acc.get(k) || [0, 0, 0, 0];
      a[0] += d[0]; a[1] += d[1]; a[2] += d[2]; a[3] += 1;
      acc.set(k, a);
    };
    for (let t = 0; t + 24 <= verts.length; t += 24) {
      const P = [0, 8, 16].map((k) => [verts[t + k], verts[t + k + 1], verts[t + k + 2]]);
      const n = [verts[t + 4], verts[t + 5], verts[t + 6]];
      const dom = Math.max(Math.abs(n[0]), Math.abs(n[1]), Math.abs(n[2]));
      if (!(dom < 0.8) || !(dom > 1e-6)) continue;
      let k = 0;
      if (Math.abs(n[1]) > Math.abs(n[k])) k = 1;
      if (Math.abs(n[2]) > Math.abs(n[k])) k = 2;
      const axis = [0, 0, 0];
      axis[k] = Math.sign(n[k]) || 1;
      const dot = n[0] * axis[0] + n[1] * axis[1] + n[2] * axis[2];
      let rx = n[1] * axis[2] - n[2] * axis[1];
      let ry = n[2] * axis[0] - n[0] * axis[2];
      let rz = n[0] * axis[1] - n[1] * axis[0];
      const rl = Math.hypot(rx, ry, rz);
      if (!(rl > 1e-6)) continue;
      rx /= rl; ry /= rl; rz /= rl;
      const ang = Math.acos(Math.min(1, Math.max(-1, dot))) - Math.acos(0.8);
      const s = Math.sin(ang), c = Math.cos(ang);
      const cx = (P[0][0] + P[1][0] + P[2][0]) / 3;
      const cy = (P[0][1] + P[1][1] + P[2][1]) / 3;
      const cz = (P[0][2] + P[1][2] + P[2][2]) / 3;
      for (const p of P) {
        const vx = p[0] - cx, vy = p[1] - cy, vz = p[2] - cz;
        const crx = ry * vz - rz * vy, cry = rz * vx - rx * vz, crz = rx * vy - ry * vx;
        const ddx = vx * c + crx * s + rx * (rx * vx + ry * vy + rz * vz) * (1 - c);
        const ddy = vy * c + cry * s + ry * (rx * vx + ry * vy + rz * vz) * (1 - c);
        const ddz = vz * c + crz * s + rz * (rx * vx + ry * vy + rz * vz) * (1 - c);
        add(p[0], p[1], p[2], [cx + ddx - p[0], cy + ddy - p[1], cz + ddz - p[2]]);
      }
    }
    if (!acc.size) break;
    for (let i = 0; i < verts.length; i += 8) {
      const a = acc.get(weldKey(verts[i], verts[i + 1], verts[i + 2]));
      if (!a) continue;
      verts[i] += Math.max(-0.6, Math.min(0.6, a[0] / a[3]));
      verts[i + 1] += Math.max(-0.6, Math.min(0.6, a[1] / a[3]));
      verts[i + 2] += Math.max(-0.6, Math.min(0.6, a[2] / a[3]));
    }
  }
  stampFaceNormals(verts);
}

// Lighting normals blend across a shared vertex when the faces agree on an
// axis. The geometric normal used for UVs stays one-per-face, so the texel
// gate does not see a skewed projection.
function shadeNormalsFor(verts) {
  const nVerts = verts.length / 8;
  const out = new Float32Array(nVerts * 3);
  const axisOf = (x, y, z) => {
    const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
    if (ay >= ax && ay >= az) return 1;
    if (ax >= az) return 0;
    return 2;
  };
  for (let i = 0; i < nVerts; i++) {
    out[i * 3] = verts[i * 8 + 4];
    out[i * 3 + 1] = verts[i * 8 + 5];
    out[i * 3 + 2] = verts[i * 8 + 6];
  }
  const acc = new Map();
  const up = (y, x, z) => y > 0.45 && y >= Math.abs(x) && y >= Math.abs(z);
  for (let i = 0; i < nVerts; i++) {
    const mat = Math.round(verts[i * 8 + 3]);
    const x = out[i * 3], y = out[i * 3 + 1], z = out[i * 3 + 2];
    if (mat === 0 && !up(y, x, z)) continue;
    const k = weldKey(verts[i * 8], verts[i * 8 + 1], verts[i * 8 + 2]) + ':' + axisOf(x, y, z);
    const a = acc.get(k) || [0, 0, 0];
    a[0] += x; a[1] += y; a[2] += z;
    acc.set(k, a);
  }
  for (let i = 0; i < nVerts; i++) {
    const mat = Math.round(verts[i * 8 + 3]);
    const x = out[i * 3], y = out[i * 3 + 1], z = out[i * 3 + 2];
    if (mat === 0 && !up(y, x, z)) continue;
    const a = acc.get(weldKey(verts[i * 8], verts[i * 8 + 1], verts[i * 8 + 2]) + ':' + axisOf(x, y, z));
    if (!a) continue;
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    const sx = a[0] / l, sy = a[1] / l, sz = a[2] / l;
    if (mat === 0 && !up(sy, sx, sz)) continue;
    out[i * 3] = sx; out[i * 3 + 1] = sy; out[i * 3 + 2] = sz;
  }
  return out;
}

// One geometric normal on all three corners. Smoothing across a shared
// vertex mixes projection axes and the texel gate then sees a skewed UV.
function stampFaceNormals(verts) {
  for (let t = 0; t + 24 <= verts.length; t += 24) {
    const ax = verts[t], ay = verts[t + 1], az = verts[t + 2];
    const bx = verts[t + 8], by = verts[t + 9], bz = verts[t + 10];
    const cx = verts[t + 16], cy = verts[t + 17], cz = verts[t + 18];
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const l = Math.hypot(nx, ny, nz);
    if (!(l > 1e-8)) continue;
    nx /= l; ny /= l; nz /= l;
    for (const k of [0, 8, 16]) {
      verts[t + k + 4] = nx;
      verts[t + k + 5] = ny;
      verts[t + k + 6] = nz;
    }
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
    const d = Math.max(0, -z);
    const base = d < 55 ? 0.2 : d < 450 ? 0.55 + (d - 55) * 0.0018 : d < 900 ? 8 : d < 2200 ? 32 : 56;
    const step = base * (0.4 + hash(z * 17.3, 2.8) * 1.35);
    groundZs.push(Math.max(GLACIER.z1, z - step));
  }
  let prev = null;
  for (const z of groundZs) {
    const cx = pathX(z);
    const leftW = wallPoint(z, -1, 0);
    const rightW = wallPoint(z, 1, 0);
    const half = Math.max(floorHalf(z) + 2.8, Math.abs(leftW[0] - cx), Math.abs(rightW[0] - cx)) + 1.2;
    const lats = fracs.map((f) => -half + f * 2 * half);
    lats.push(-0.6, 0.6);
    lats.sort((a, b) => a - b);
    const row = lats.map((lat) => {
      const x = pathX(z) + lat;
      const tuck = Math.abs(lat) > half - 1.2 ? 0.35 : 0;
      return [x, floorH(x, z) - tuck, z];
    });
    if (prev) {
      for (let i = 0; i < row.length - 1; i++) face(mesh, prev[i], prev[i + 1], row[i + 1], row[i], MAT.snow, [0, 1, 0]);
    }
    prev = row;
  }
  const columnsN = addWall(mesh, -1) + addWall(mesh, 1);

  const arches = [-24, -70, -480, -1200, -2200];
  arches.forEach((z, i) => addArch(mesh, z, i));
  [-40, -110, -260, -640, -1600].forEach((z) => addFall(mesh, z, -1));
  addCurtain(mesh, -120);
  addChaseFall(mesh, -115);
  addChaseFall(mesh, -210);
  addHorizonRidge(mesh, -520, 180, 240);
  addHorizonRidge(mesh, -980, 240, 360);
  addHorizonRidge(mesh, -1700, 320, 480);
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
    const fine = r.z > -2800;
    addRange(mesh, x - r.len * 0.5, r.z + r.len * 0.15, x + r.len * 0.5, r.z - r.len * 0.2, r.h, r.w, fine);
  }

  const icicles = [];
  arches.forEach((z0, index) => {
    if (index > 2) return;
    const frame = archFrame(z0, index);
    const nIce = 7;
    for (let k = 0; k < nIce; k++) {
      const u = 0.18 + (k / (nIce - 1)) * 0.64;
      const c = archCenter(z0, u, frame);
      const len = 1.6 + hash(z0, k) * 2.4;
      const hang = frame.thick * 0.72;
      const thick = 1.15 + hash(k, 2) * 0.55;
      pushInst(
        icicles,
        c.x,
        c.y - hang,
        c.z + 0.6,
        hash(k, z0) * 0.4,
        thick,
        len,
        thick * 0.85,
        (hash(k, 5) - 0.5) * 0.15,
      );
    }
  });
  for (let n = 0; n < 40; n++) {
    const z = 10 - n * 8.5;
    const side = n % 2 === 0 ? -1 : 1;
    const p = wallPoint(z, side, 0.38 + hash(n, 1.7) * 0.4);
    const len = 0.55 + hash(n, 2.3) * 1.5;
    const thick = 0.45 + hash(n, 3.1) * 0.5;
    pushInst(icicles, p[0] - side * 0.3, p[1] - 0.2, p[2], hash(n, 4), thick, len, thick * 0.75, (hash(n, 5) - 0.5) * 0.25);
  }
  for (const z0 of [-115, -210]) {
    for (let k = 0; k < 18; k++) {
      const side = k % 2 === 0 ? -1 : 1;
      const lat = side * (1.9 + (Math.floor(k / 2) / 8) * 7.0);
      const x = pathX(z0) + lat;
      const len = 0.7 + hash(k, z0) * 1.8;
      const y = routeSmooth(z0) + (k < 10 ? 31 : 18) - len;
      pushInst(icicles, x, y, z0 + 0.5, hash(k, 6), 0.16, len, 0.12, 0.06);
    }
  }

  const drifts = [];
  const chunks = [];
  for (let n = 0; n < 48; n++) {
    const z = 24 - n * 6.5;
    const side = n % 2 === 0 ? 1 : -1;
    // Shoulder only. A wide flat drift at |lat| ~ 2.5 fills the left of the
    // frame as a pale wedge, and its inner facet reads as a shard.
    const lat = side * (10.5 + hash(n, 8) * 6);
    const x = pathX(z) + lat;
    const y = floorH(x, z);
    if (n % 3 === 0) {
      const s = 0.32 + hash(n, 11) * 0.28;
      pushInst(chunks, x, y, z, hash(n, 12) * 6, s, s * (0.85 + hash(n, 13) * 0.3), s * 0.9, 0);
    } else {
      const s = 0.7 + hash(n, 11) * 0.55;
      pushInst(drifts, x, y, z, hash(n, 12) * 6, s, 0.4 + hash(n, 13) * 0.25, s * 0.85, 0);
    }
  }
  const icicleProto = makeIcicle();
  const driftProto = makeDrift();
  const chunkProto = makeChunk();
  const planet = makePlanet();
  const verts = mesh.finish();
  relaxOffAxis(verts);
  pinRouteBand(verts);
  stampFaceNormals(verts);
  stampFaceNormals(icicleProto);
  stampFaceNormals(driftProto);
  stampFaceNormals(chunkProto);
  const shadeNormals = shadeNormalsFor(verts);
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
  budget.particleTris = (FLAKES.near + FLAKES.mid + FLAKES.far + FLAKES.blow + FLAKES.puff) * 2;
  budget.particles = FLAKES.near + FLAKES.mid + FLAKES.far + FLAKES.blow;
  budget.puffs = FLAKES.puff;
  budget.totalTris = worldTris + planetTris + budget.icicleTris + budget.driftTris + budget.chunkTris + budget.particleTris;
  return {
    verts,
    shadeNormals,
    planet,
    instances: {
      icicle: { proto: icicleProto, data: new Float32Array(icicles), count: icicles.length / 8 },
      drift: { proto: driftProto, data: new Float32Array(drifts), count: drifts.length / 8 },
      chunk: { proto: chunkProto, data: new Float32Array(chunks), count: chunks.length / 8 },
    },
    budget,
    extentZ: [GLACIER.z1, GLACIER.z0],
    columns: columnsN,
    heightAt: snowHeightAt(verts),
  };
}

// Screen contact uses the triangle that is actually drawn, not the smooth
// floor function. A chord across a crest sits below that function, and a
// card planted on the function then floats above the snow.
function snowHeightAt(verts) {
  const buckets = new Map();
  for (let t = 0; t + 24 <= verts.length; t += 24) {
    if (Math.round(verts[t + 3]) !== 0) continue;
    const z0 = Math.min(verts[t + 2], verts[t + 10], verts[t + 18]);
    const z1 = Math.max(verts[t + 2], verts[t + 10], verts[t + 18]);
    for (let z = Math.floor(z0); z <= Math.floor(z1); z++) {
      let list = buckets.get(z);
      if (!list) { list = []; buckets.set(z, list); }
      list.push(t);
    }
  }
  return function heightAt(x, z) {
    const list = buckets.get(Math.floor(z));
    if (!list) return terrH(x, z);
    let y = null;
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      const x1 = verts[t];
      const y1 = verts[t + 1];
      const z1 = verts[t + 2];
      const x2 = verts[t + 8];
      const y2 = verts[t + 9];
      const z2 = verts[t + 10];
      const x3 = verts[t + 16];
      const y3 = verts[t + 17];
      const z3 = verts[t + 18];
      const den = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3);
      if (Math.abs(den) < 1e-8) continue;
      const a = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / den;
      const b = ((z3 - z1) * (x - x3) + (x1 - x3) * (z - z3)) / den;
      const c = 1 - a - b;
      if (a < -1e-3 || b < -1e-3 || c < -1e-3) continue;
      const hy = a * y1 + b * y2 + c * y3;
      if (y === null || hy > y) y = hy;
    }
    return y === null ? terrH(x, z) : y;
  };
}

export function spawn() {
  const z = 0;
  const psi = pathPsi(z);
  return { psi, x: pathX(z), z, cam: psi, w: 0, v: 0, phase: 0, run: 0 };
}

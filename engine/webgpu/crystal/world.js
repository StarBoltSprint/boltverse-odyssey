// crystal/world.js — walkable obsidian canyon. Geometry only. Colour is a dedicated albedo, never the key.
import { createMesh } from '../engine/bricks/facet-mesh.js';
import { MAT, CRYSTAL } from './biome.js';

const hash = (a, b) => {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

export function pathX(z) {
  return 5.2 * Math.sin(z * 0.028) + 1.6 * Math.sin(z * 0.061) + 4.8 * Math.sin(z * 0.045);
}

export function pathPsi(z) {
  const dxdz = (pathX(z - 0.25) - pathX(z + 0.25)) / -0.5;
  return Math.atan2(dxdz, 1);
}

export function terrH(x, z) {
  const lateral = x - pathX(z);
  const lip = smooth(2.6, 8.5, Math.abs(lateral)) * 0.55;
  const trench = Math.exp(-((lateral - CRYSTAL.streamLat) ** 2) / 1.15) * 0.62;
  const grain = 0.045 * Math.sin(x * 1.3 + z * 0.7) + 0.03 * Math.sin(x * 0.45 - z * 0.9);
  const roll = 0.4 * Math.sin(x * 0.07 + z * 0.045) + 0.22 * Math.sin(z * 0.11 - x * 0.05);
  const shelfT = smooth(2.4, 5.2, Math.abs(lateral));
  const shelf = Math.round(lateral / 7.5) * 0.22 * shelfT;
  return lip - trench + grain + roll + shelf;
}

export const WATER_Y = -0.28;
export const STREAM_HALF = 1.15;
const GROUND_STEP = 1.05;
const BED_Y = WATER_Y - 0.22;

// Coarse triangles chord across the trench and roof the water. Any corner a
// 1.05 m edge can join to a point inside the stream is held on a bed under the sheet.
export function groundMeshY(x, z, step = GROUND_STEP) {
  const u = x - pathX(z) - CRYSTAL.streamLat;
  const h = terrH(x, z);
  if (Math.abs(u) < STREAM_HALF + step * 2) return Math.min(h, BED_Y);
  return h;
}

function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export const TURN = 75 * Math.PI / 180;

export function integrate(live, dt, input, collide) {
  const turn = Math.max(-1, Math.min(1, input.turn || 0));
  const target = turn * TURN;
  const tau = turn === 0 ? 0.10 : 0.25;
  live.w += (target - live.w) * (1 - Math.exp(-dt / tau));
  if (turn === 0 && Math.abs(live.w) < 0.05) live.w = 0;
  live.psi += live.w * dt;
  const vx = -Math.sin(live.psi) * live.v;
  const vz = -Math.cos(live.psi) * live.v;
  const m = collide.move(live.x, live.z, live.psi, vx, vz, dt);
  live.x = m.x;
  live.z = m.z;
  live.hit = m.hit;
  const camTau = 0.11;
  const maxRel = 10 * Math.PI / 180;
  live.cam += (live.psi - live.cam) * (1 - Math.exp(-dt / camTau));
  if (live.psi - live.cam > maxRel) live.cam = live.psi - maxRel;
  if (live.cam - live.psi > maxRel) live.cam = live.psi + maxRel;
  return live;
}

// Capture route: run, a visible yaw each way, a full stop, run again, stop.
export function skyProofInput(t, live) {
  const turn = t >= 1.2 && t < 2.8;
  const up = t >= 2.8 && t < 4.4;
  live.pitch = up ? Math.sin(((t - 2.8) / 1.6) * Math.PI) * 0.72 : 0;
  if (t < 1.2) return { turn: 0, run: true };
  if (turn) return { turn: 0.42, run: true };
  if (t < 5.4) return { turn: 0, run: false };
  return { turn: 0, run: true };
}

export function proofInput(t, live) {
  // One follow path. The bend in pathX is the turn. No scripted heading whip.
  const follow = live ? demoSteer(live) : { turn: 0, run: true };
  if (t < 8.2) return follow;
  if (t < 14.0) return { turn: 0, run: false };
  if (t < 17.0) return follow;
  if (t < 19.6) return { turn: 0, run: false };
  return follow;
}

export function demoSteer(live) {
  const look = live.z - 5.5;
  let d = pathPsi(look) - live.psi;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const dx = pathX(look) - live.x;
  const dz = look - live.z;
  const lat = dx * Math.cos(live.psi) + dz * -Math.sin(live.psi);
  const turn = Math.max(-1, Math.min(1, d * 0.85 - lat * 0.42));
  return { turn, run: true };
}

export function clusterSize(seed) {
  return 5 + Math.floor(hash(seed, 3) * 8);
}

function addCluster(mesh, x, y, z, radius, height, yaw, mat, seed) {
  const n = clusterSize(seed);
  mesh.hexPrism(x, y, z, radius * 0.46, height, yaw, (hash(seed, 4) - 0.5) * 0.4, mat, seed + 3);
  for (let i = 1; i < n; i++) {
    const ang = yaw + (i / (n - 1)) * Math.PI * 2 + hash(seed, i) * 0.35;
    const dist = radius * (0.42 + hash(seed, i + 20) * 0.5);
    const rr = radius * (0.16 + hash(seed, i + 40) * 0.26);
    const hh = height * (0.32 + hash(seed, i + 60) * 0.58);
    const tilt = (hash(seed, i + 80) - 0.4) * 0.75;
    mesh.hexPrism(
      x + Math.cos(ang) * dist,
      y + (hash(seed, i + 90) - 0.2) * height * 0.12,
      z + Math.sin(ang) * dist,
      rr, hh, ang + hash(seed, i + 7), tilt, mat, seed * 13 + i,
    );
  }
}

function stackBlock(mesh, x, yBase, z, sx, sy, sz, yaw, mat) {
  const seed = Math.round(x * 10) * 13 + Math.round(z * 7);
  const tiers = 2 + Math.floor(hash(seed, 1) * 3);
  let y = yBase;
  let wx = sx;
  let wz = sz;
  const share = sy / tiers;
  for (let t = 0; t < tiers; t++) {
    const th = share * (0.82 + hash(seed, t + 3) * 0.28);
    const leanX = (hash(seed, t + 8) - 0.5) * Math.min(wx, wz) * 0.16;
    const leanZ = (hash(seed, t + 14) - 0.5) * Math.min(wx, wz) * 0.16;
    mesh.chipBlock(x, y, z, wx, th, wz, yaw + (hash(seed, t + 5) - 0.5) * 0.18, leanX, leanZ, mat, seed + t * 19);
    mesh.box(x, y + th * 0.5, z, wx * 0.7, th * 0.98, wz * 0.7, yaw, mat);
    if (t + 1 < tiers) mesh.box(x, y + th * 0.9, z, wx * 0.76, 0.5, wz * 0.76, yaw, mat);
    y += th * 0.72;
    wx *= 0.86 + hash(seed, t + 20) * 0.06;
    wz *= 0.86 + hash(seed, t + 24) * 0.06;
  }
  return y;
}

function addArch(mesh, circles, z0, span, foot, depth) {
  const c = pathX(z0);
  const base = terrH(c, z0);
  const pw = 1.8;
  const pierH = foot + 1.2;
  mesh.boxBevel(c - span / 2, base + pierH / 2, z0, pw, pierH, depth, 0, MAT.stone, 0.14);
  mesh.boxBevel(c + span / 2, base + pierH / 2, z0, pw, pierH, depth, 0, MAT.stone, 0.14);
  circles.push({ x: c - span / 2, z: z0, r: pw * 0.46 });
  circles.push({ x: c + span / 2, z: z0, r: pw * 0.46 });
  const n = 9;
  const rad = span / 2 - 0.2;
  for (let i = 0; i < n; i++) {
    const ang = Math.PI * (i + 0.5) / n;
    const x = c + Math.cos(ang) * rad;
    const y = base + foot * 0.15 + Math.sin(ang) * rad * 0.92;
    const overlap = 1.15;
    mesh.boxBevel(x, y, z0, 1.55 * overlap, 1.45, depth, 0, MAT.stone, 0.1);
  }
  for (const s of [-1, 1]) {
    const x = c + s * (span / 2 + 1.6);
    const yy = terrH(x, z0);
    mesh.boxBevel(x, yy + pierH * 0.7, z0, 1.3, pierH * 1.35, depth * 0.8, s * 0.1, MAT.stone, 0.12);
    circles.push({ x, z: z0, r: 0.75 });
  }
}

const WORLD_Z0 = -1120;
const WORLD_Z1 = 40;

function pushInst(list, x, y, z, yaw, sx, sy, sz, lean = 0) {
  list.push(x, y, z, yaw, sx, sy, sz, lean);
}

function addCanyonSide(mesh, circles, crystals, side) {
  const zs = [];
  for (let z = 36; z >= -1120; z -= (z > -260 ? 3.4 : 9)) zs.push(z);
  const strata = 7;
  const cols = zs.map((z, i) => {
    const n1 = hash(Math.round(z * 0.17), side + 5);
    const n2 = hash(Math.round(z * 0.05), side + 11);
    const base = 7.4 + n1 * 6.5;
    const h = 16 + n2 * 22;
    const yFoot = terrH(pathX(z) + side * (base + 3), z);
    const pts = [];
    const back = [];
    for (let s = 0; s <= strata; s++) {
      const t = s / strata;
      const ledge = Math.sin(z * 0.085 + s * 1.4) * 0.9;
      const overhang = s === 5 ? -1.7 : s === 2 ? 0.8 : 0;
      const talus = (1 - t) * (2.6 + n1);
      const jag = (hash(i * 3, s + 2) - 0.5) * (s === strata ? 2.6 : 0.55);
      const out = base + talus + ledge + overhang + (hash(i, s + 8) - 0.5) * 0.7;
      const y = yFoot + h * t + jag;
      pts.push([pathX(z) + side * out, y, z]);
      back.push([pathX(z) + side * (out + 2.8 + n2), yFoot + h * t * 0.9, z]);
    }
    return { pts, back, z };
  });
  const nrm = (A, B, C) => {
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
    const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    return [nx / l, ny / l, nz / l];
  };
  const quad = (A, B, C, D, chips) => {
    const n = nrm(A, B, C);
    const N = chips ? 3 : 1;
    const g = [];
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const u = i / N, v = j / N;
        const p = [
          (1 - u) * (1 - v) * A[0] + u * (1 - v) * B[0] + u * v * C[0] + (1 - u) * v * D[0],
          (1 - u) * (1 - v) * A[1] + u * (1 - v) * B[1] + u * v * C[1] + (1 - u) * v * D[1],
          (1 - u) * (1 - v) * A[2] + u * (1 - v) * B[2] + u * v * C[2] + (1 - u) * v * D[2],
        ];
        if (chips) {
          const k = (hash(Math.round(p[0] * 5) + i, Math.round(p[1] * 3) + j * 7) - 0.42) * 0.28;
          p[0] += n[0] * k; p[1] += n[1] * k; p[2] += n[2] * k;
        }
        g.push(p);
      }
    }
    const w = N + 1;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const a = g[j * w + i], b = g[j * w + i + 1], c = g[(j + 1) * w + i + 1], d = g[(j + 1) * w + i];
        mesh.tri(a, b, c, [0, 0], [1, 0], [1, 1], MAT.wall, n);
        mesh.tri(a, c, d, [0, 0], [1, 1], [0, 1], MAT.wall, n);
      }
    }
  };
  for (let i = 0; i < cols.length - 1; i++) {
    const A = cols[i];
    const B = cols[i + 1];
    const chips = A.z > -180;
    for (let s = 0; s < strata; s++) {
      quad(A.pts[s], B.pts[s], B.pts[s + 1], A.pts[s + 1], chips);
      quad(B.back[s], A.back[s], A.back[s + 1], B.back[s + 1], false);
    }
    quad(A.pts[strata], B.pts[strata], B.back[strata], A.back[strata], false);
    if (i % 5 === 0 && A.z > -900) {
      const foot = A.pts[1];
      circles.push({ x: foot[0], z: foot[2], r: 1.15 });
      const grow = A.pts[3 + (i % 3)];
      const tall = i % 10 === 0;
      const hh = tall ? 8 + hash(i, side + 4) * 14 : 2.4 + hash(i, side) * 3;
      const sc = hh / 12;
      pushInst(crystals, grow[0], grow[1], grow[2], hash(i, 2) * 6, sc, sc, sc, side * (0.35 + hash(i, 6) * 0.45));
      const baseP = A.pts[0];
      const scb = (2 + hash(i, 9) * 3) / 12;
      pushInst(crystals, baseP[0] - side * 1.2, baseP[1], baseP[2], hash(i, 8) * 4, scb, scb, scb, side * 0.15);
    }
  }
}

function makeCrystalProto() {
  const m = createMesh();
  addCluster(m, 0, 0, 0, 1.6, 12, 0.3, MAT.cyan, 7);
  m.hexPrism(3.4, 0, 0.2, 0.55, 6, 0.4, 0.25, MAT.violet, 11);
  return m.finish();
}

function makeRubbleProto() {
  const m = createMesh();
  const ring = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.15;
    const r = 0.5 + hash(4, i) * 0.55;
    ring.push([Math.cos(a) * r, 0.06 + hash(4, i + 3) * 0.22, Math.sin(a) * r * (0.65 + hash(4, i + 6) * 0.45)]);
  }
  const top = [(hash(4, 9) - 0.5) * 0.35, 0.7 + hash(4, 10) * 0.45, (hash(4, 11) - 0.5) * 0.3];
  const bot = [(hash(4, 12) - 0.5) * 0.15, 0, (hash(4, 13) - 0.5) * 0.15];
  for (let i = 0; i < 8; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % 8];
    m.tri(bot, b, a, [0, 0], [1, 0], [1, 1], MAT.wall);
    m.tri(a, b, top, [0, 0], [1, 0], [0.5, 1], MAT.wall);
  }
  return m.finish();
}

function makeShardProto() {
  const m = createMesh();
  m.hexPrism(0, 0, 0, 0.11, 0.72, 0.3, 0.45, MAT.cyan, 2);
  m.hexPrism(0.16, 0, 0.04, 0.07, 0.42, 1.2, -0.6, MAT.cyan, 6);
  return m.finish();
}

export function buildWorld() {
  const mesh = createMesh();
  const circles = [];
  const x0 = -46, x1 = 46, z0 = -260, z1 = WORLD_Z1, step = GROUND_STEP;
  for (let z = z0; z < z1; z += step) {
    for (let x = x0; x < x1; x += step) {
      const corners = [[x, z], [x + step, z], [x + step, z + step], [x, z + step]];
      const p = corners.map(([px, pz]) => [px, groundMeshY(px, pz), pz]);
      mesh.tri(p[0], p[2], p[1], [0, 0], [1, 1], [1, 0], MAT.mineral);
      mesh.tri(p[0], p[3], p[2], [0, 0], [0, 1], [1, 1], MAT.mineral);
    }
  }
  const farStep = 5.5;
  for (let z = WORLD_Z0; z < z0; z += farStep) {
    for (let x = -80; x < 80; x += farStep) {
      const corners = [[x, z], [x + farStep, z], [x + farStep, z + farStep], [x, z + farStep]];
      const p = corners.map(([px, pz]) => [px, groundMeshY(px, pz, farStep), pz]);
      mesh.tri(p[0], p[2], p[1], [0, 0], [1, 1], [1, 0], MAT.mineral);
      mesh.tri(p[0], p[3], p[2], [0, 0], [0, 1], [1, 1], MAT.mineral);
    }
  }
  const waterStep = 0.7;
  for (let z = z1 - 1; z > z0 + 1; z -= waterStep) {
    const z2 = z - waterStep;
    const strips = 4;
    const half = 1.15;
    for (let s = 0; s < strips; s++) {
      const u0 = -half + (2 * half) * s / strips;
      const u1 = -half + (2 * half) * (s + 1) / strips;
      const y = WATER_Y;
      const a = [pathX(z) + CRYSTAL.streamLat + u0, y, z];
      const b = [pathX(z) + CRYSTAL.streamLat + u1, y, z];
      const c = [pathX(z2) + CRYSTAL.streamLat + u1, y, z2];
      const d = [pathX(z2) + CRYSTAL.streamLat + u0, y, z2];
      mesh.tri(a, b, c, [0, 0], [1, 0], [1, 1], MAT.stream);
      mesh.tri(a, c, d, [0, 0], [1, 1], [0, 1], MAT.stream);
    }
    if (Math.round(z) % 3 === 0) circles.push({ x: pathX(z) + CRYSTAL.streamLat, z, r: 1.02 });
  }

  const crystals = [];
  addCanyonSide(mesh, circles, crystals, -1);
  addCanyonSide(mesh, circles, crystals, 1);
  const rubble = [];
  for (let i = 0; i < 80; i++) {
    const z = 18 - i * 14;
    const side = i % 2 === 0 ? -1 : 1;
    const lat = side * (3.2 + hash(i, 4) * 3.4);
    const x = pathX(z) + lat;
    const s = 0.55 + hash(i, 2) * 1.1;
    pushInst(rubble, x, terrH(x, z), z, hash(i, 1) * 6, s, 0.45 + hash(i, 7) * 0.9, s * (0.7 + hash(i, 3) * 0.5));
  }
  const shards = [];
  for (let i = 0; i < 70; i++) {
    const z = 10 - i * 8;
    const side = i % 2 === 0 ? -1 : 1;
    const lat = side * (1.8 + hash(i, 5) * 2.6);
    const x = pathX(z) + lat;
    const s = 0.45 + hash(i, 2) * 0.9;
    pushInst(shards, x, terrH(x, z), z, hash(i, 1) * 6, s, s * (0.7 + hash(i, 8)), s, (hash(i, 3) - 0.5) * 1.1);
  }
  const pools = [];
  for (let i = 0; i < 12; i++) {
    const z = 8 - i * 6.5;
    const side = i % 2 === 0 ? -1 : 1;
    const lat = side * (6.8 + hash(i, 31) * 2.2);
    const h = 3.4 + hash(i, 32) * 3.2;
    const x = pathX(z) + lat;
    const sc = h / 12;
    pushInst(crystals, x, terrH(x, z), z, hash(i, 33) * 5, sc, sc, sc, side * 0.25);
    if (pools.length < 24) pools.push(x, z, Math.max(2.4, h * 0.42));
  }
  const giants = [[-12, -78, 22], [13, -102, 25], [-11, -132, 20]];
  for (let i = 0; i < 8; i++) {
    const z = -8 - i * 18;
    const side = i % 2 === 0 ? -1 : 1;
    const x = pathX(z) + side * (5.5 + hash(i, 51));
    const y = terrH(x, z);
    const ring = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const r = 0.7 + hash(i, k) * 0.6;
      ring.push([x + Math.cos(a) * r, y + 0.15, z + Math.sin(a) * r * 0.8]);
    }
    const top = [x, y + 0.8 + hash(i, 52) * 0.5, z];
    for (let k = 0; k < 6; k++) {
      mesh.tri(ring[k], ring[(k + 1) % 6], top, [0, 0], [1, 0], [0.5, 1], MAT.stone);
    }
  }
  for (const [lat, z, h] of giants) {
    const x = pathX(z) + lat;
    const sc = h / 12;
    pushInst(crystals, x, terrH(x, z), z, 0.4, sc, sc, sc, Math.sign(lat) * 0.2);
    circles.push({ x, z, r: 2.1 });
    pools.push(x, z, h * 0.55);
  }
  for (let i = 0; i < 16; i++) {
    const z = 2 - i * 2.4;
    const side = i % 2 === 0 ? -1 : 1;
    const lat = side * (1.45 + hash(i, 71) * 0.55);
    const x = pathX(z) + lat;
    const s = 0.32 + hash(i, 72) * 0.28;
    pushInst(shards, x, terrH(x, z), z, hash(i, 73) * 6, s, s, s, (hash(i, 74) - 0.5) * 0.8);
  }
  for (let i = 0; i < 24; i++) {
    const z = 5 - i * 2.2;
    const side = i % 2 === 0 ? 1 : -1;
    const lat = side * (1.7 + hash(i, 81) * 0.9);
    const x = pathX(z) + lat;
    const s = 0.14 + hash(i, 82) * 0.22;
    pushInst(rubble, x, terrH(x, z), z, hash(i, 83) * 6, s, s * 0.65, s * 0.8);
  }
  for (let i = 0; i < 40; i++) {
    const z = 12 - i * 4.5;
    const side = i % 2 === 0 ? 1 : -1;
    const lat = side * (2.2 + hash(i, 41) * 2.4);
    const x = pathX(z) + lat;
    const s = 0.22 + hash(i, 42) * 0.45;
    pushInst(rubble, x, terrH(x, z), z, hash(i, 43) * 6, s, s * 0.7, s * 0.85);
  }

  const sky = createMesh();
  sky.skyDome(640, MAT.sky);
  const road = circles.filter(c => Math.abs(c.x - pathX(c.z)) - c.r > 1.2);
  const groundVerts = mesh.finish();
  const crystalProto = makeCrystalProto();
  const rubbleProto = makeRubbleProto();
  const shardProto = makeShardProto();
  const instTris = (proto, list) => (proto.length / 8 / 3) * (list.length / 8);
  return {
    verts: groundVerts,
    sky: sky.finish(),
    circles: road,
    tris: groundVerts.length / 24,
    pools,
    extentZ: [WORLD_Z0, WORLD_Z1],
    instances: {
      crystal: { proto: crystalProto, data: new Float32Array(crystals), count: crystals.length / 8 },
      rubble: { proto: rubbleProto, data: new Float32Array(rubble), count: rubble.length / 8 },
      shard: { proto: shardProto, data: new Float32Array(shards), count: shards.length / 8 },
    },
    budget: {
      uniqueTris: mesh.count / 3,
      crystalTris: instTris(crystalProto, crystals),
      rubbleTris: instTris(rubbleProto, rubble),
      shardTris: instTris(shardProto, shards),
      draws: 9,
    },
  };
}

export function spawn() {
  const psi = pathPsi(0);
  return { psi, x: pathX(0), z: 0, cam: psi, w: 0, v: 0, phase: 0, run: 0, hit: null };
}

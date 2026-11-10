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
  return lip - trench + grain;
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

function pushInst(list, x, y, z, yaw, sx, sy, sz) {
  list.push(x, y, z, yaw, sx, sy, sz, 0);
}

function makeWallProto() {
  const m = createMesh();
  m.boxBevel(0, 6.2, 0, 5.4, 12.4, 3.4, 0.04, MAT.wall, 0.16);
  m.boxBevel(0.25, 14.6, 0.15, 3.8, 5.6, 2.5, -0.06, MAT.wall, 0.12);
  m.boxBevel(-0.15, 18.4, -0.05, 2.3, 3.2, 1.7, 0.1, MAT.wall, 0.08);
  return m.finish();
}

function makeCrystalProto() {
  const m = createMesh();
  addCluster(m, 0, 0, 0, 1.6, 12, 0.3, MAT.cyan, 7);
  return m.finish();
}

function makeRubbleProto() {
  const m = createMesh();
  m.boxBevel(0, 0.35, 0, 1.4, 0.7, 1.1, 0.2, MAT.wall, 0.08);
  m.boxBevel(0.8, 0.22, 0.4, 0.7, 0.45, 0.6, -0.4, MAT.stone, 0.05);
  m.hexPrism(0.2, 0, 0.6, 0.18, 0.9, 0.5, 0.3, MAT.cyan, 3);
  m.hexPrism(-0.55, 0, -0.2, 0.12, 0.55, 1.1, -0.2, MAT.violet, 9);
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

  const walls = [];
  for (let i = 0; i < 78; i++) {
    const z = 24 - i * 14.5;
    for (const side of [-1, 1]) {
      const lat = side * (7.5 + hash(i, side + 4) * 11);
      const h = 15 + hash(i, side + 11) * 25;
      const x = pathX(z) + lat;
      const yaw = (hash(i, side + 2) - 0.5) * 0.35;
      pushInst(walls, x, terrH(x, z), z, yaw, 0.85 + hash(i, side) * 0.45, h / 20, 0.75 + hash(i, side + 6) * 0.4);
      circles.push({ x, z, r: 2.15 * (0.85 + hash(i, side) * 0.2) });
    }
  }
  const crystals = [];
  for (let i = 0; i < 52; i++) {
    const z = 12 - i * 21;
    const side = i % 2 === 0 ? -1 : 1;
    const giant = i % 3 === 0;
    const lat = side * (6.2 + hash(i, 5) * (giant ? 6 : 9));
    const h = giant ? 8 + hash(i, 8) * 17 : 3.5 + hash(i, 8) * 4;
    const s = h / 12;
    const x = pathX(z) + lat;
    pushInst(crystals, x, terrH(x, z), z, hash(i, 3) * 3, s, s, s);
    if (giant) circles.push({ x, z, r: Math.min(2.2, s * 1.4) });
    if (!giant && hash(i, 9) > 0.45) {
      const s2 = s * 0.55;
      pushInst(crystals, x + side * 2.4, terrH(x, z), z + 2.4, 1.2, s2, s2, s2);
    }
  }
  const rubble = [];
  for (let i = 0; i < 90; i++) {
    const z = 8 - i * 12;
    const side = i % 2 === 0 ? -1 : 1;
    const lat = side * (2.4 + hash(i, 4) * 2.2);
    const x = pathX(z) + lat;
    pushInst(rubble, x, terrH(x, z), z, hash(i, 1) * 6, 0.6 + hash(i, 2), 0.5 + hash(i, 7) * 0.8, 0.6 + hash(i, 3));
  }

  addArch(mesh, circles, -96, 7.2, 4.4, 6);
  addArch(mesh, circles, -140, 8.0, 4.8, 6);
  const sky = createMesh();
  sky.skyDome(640, MAT.sky);
  const road = circles.filter(c => Math.abs(c.x - pathX(c.z)) - c.r > 1.2);
  const wallProto = makeWallProto();
  const crystalProto = makeCrystalProto();
  const rubbleProto = makeRubbleProto();
  const instTris = (proto, list) => (proto.length / 8 / 3) * (list.length / 8);
  return {
    verts: mesh.finish(),
    sky: sky.finish(),
    circles: road,
    tris: mesh.count / 3,
    extentZ: [WORLD_Z0, WORLD_Z1],
    instances: {
      wall: { proto: wallProto, data: new Float32Array(walls), count: walls.length / 8 },
      crystal: { proto: crystalProto, data: new Float32Array(crystals), count: crystals.length / 8 },
      rubble: { proto: rubbleProto, data: new Float32Array(rubble), count: rubble.length / 8 },
    },
    budget: {
      uniqueTris: mesh.count / 3,
      wallTris: instTris(wallProto, walls),
      crystalTris: instTris(crystalProto, crystals),
      rubbleTris: instTris(rubbleProto, rubble),
      draws: 9,
    },
  };
}

export function spawn() {
  const psi = pathPsi(0);
  return { psi, x: pathX(0), z: 0, cam: psi, w: 0, v: 0, phase: 0, run: 0, hit: null };
}

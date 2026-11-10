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

export function buildWorld() {
  const mesh = createMesh();
  const circles = [];
  const x0 = -42, x1 = 42, z0 = -168, z1 = 28, step = 1.05;
  for (let z = z0; z < z1; z += step) {
    for (let x = x0; x < x1; x += step) {
      const corners = [[x, z], [x + step, z], [x + step, z + step], [x, z + step]];
      const p = corners.map(([px, pz]) => [px, terrH(px, pz), pz]);
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
      const y = -0.28;
      const a = [pathX(z) + CRYSTAL.streamLat + u0, y, z];
      const b = [pathX(z) + CRYSTAL.streamLat + u1, y, z];
      const c = [pathX(z2) + CRYSTAL.streamLat + u1, y, z2];
      const d = [pathX(z2) + CRYSTAL.streamLat + u0, y, z2];
      mesh.tri(a, b, c, [0, 0], [1, 0], [1, 1], MAT.stream);
      mesh.tri(a, c, d, [0, 0], [1, 1], [0, 1], MAT.stream);
    }
    if (Math.round(z) % 3 === 0) circles.push({ x: pathX(z) + CRYSTAL.streamLat, z, r: 1.02 });
  }

  for (let i = 0; i < 46; i++) {
    const z = 8 - i * 3.7;
    for (const side of [-1, 1]) {
      for (let row = 0; row < 3; row++) {
        const lat = side * (7.4 + row * 3.5 + hash(i, row + side * 4) * 1.2);
        const x = pathX(z) + lat;
        if (z > -90 && Math.abs(lat) < 16) continue;
        const sy = 2.8 + row * 4.4 + hash(i, row + 8) * (row === 2 ? 14 : 6.5);
        const sx = 2.1 + hash(i + 2, row) * 2.2;
        const sz = 1.8 + hash(row + 4, i) * 1.9;
        const yaw = (hash(i, row + 11) - 0.5) * 0.7;
        const y0 = terrH(x, z);
        const top = stackBlock(mesh, x, y0, z, sx, sy, sz, yaw, MAT.wall);
        circles.push({ x, z, r: Math.min(sx, sz) * 0.38 });
        if (row === 0 && hash(i, side + 20) > 0.28) {
          const ch = 1.4 + hash(i, side + 2) * 3.2;
          const cr = 0.34 + hash(i, side) * 0.36;
          addCluster(mesh, x, top, z, cr, ch, yaw, side < 0 ? MAT.violet : MAT.cyan, i * 17 + row + side * 9);
        }
      }
    }
  }

  for (let i = 0; i < 64; i++) {
    const z = 4 - i * 2.5;
    const side = i % 2 === 0 ? -1 : 1;
    const lat = side < 0 ? -(3.9 + hash(i, 1) * 1.8) : (5.5 + hash(i, 2) * 1.6);
    const x = pathX(z) + lat;
    if (z > -90 && Math.abs(lat) < 14) continue;
    const ch = 1.3 + hash(i, 3) * (side < 0 ? 4.8 : 4.2);
    const cr = 0.26 + hash(i, 4) * 0.48;
    addCluster(mesh, x, terrH(x, z), z, cr, ch, hash(i, 5) * 3, side < 0 ? MAT.violet : MAT.cyan, 400 + i);
    circles.push({ x, z, r: cr * 1.35 });
  }

  // Close enough to read in the 20 s route, far enough that resume does not swallow the gate.
  {
    const z = -62;
    const x = pathX(z) + 2.6;
    const y = terrH(x, z);
    const top = stackBlock(mesh, x, y, z, 2.2, 4.4, 1.6, 0.1, MAT.wall);
    addCluster(mesh, x, top, z, 0.42, 1.5, 0.4, MAT.cyan, 62);
    circles.push({ x, z, r: 0.9 });
  }
  {
    const z = -70;
    const x = pathX(z) - 2.5;
    addCluster(mesh, x, terrH(x, z), z, 0.55, 3.2, 0.4, MAT.cyan, 70);
    circles.push({ x, z, r: 0.85 });
  }
  addArch(mesh, circles, -96, 7.2, 4.4, 6);
  addArch(mesh, circles, -140, 8.0, 4.8, 6);

  // Close to the path so the first seconds show objects sliding past, not an empty plane.
  const near = [
    [-5.6, -6, 3.6, 1.15, MAT.cyan],
    [5.8, -16, 4.4, 1.3, MAT.violet],
    [-5.3, -27, 3.8, 1.2, MAT.cyan],
    [6.2, -39, 5.1, 1.45, MAT.violet],
    [-5.9, -52, 4.2, 1.25, MAT.cyan],
  ];
  for (const [lat, z, h, w, gem] of near) {
    const x = pathX(z) + lat;
    const y0 = terrH(x, z);
    const top = stackBlock(mesh, x, y0, z, w, h, w * 0.92, 0.15, MAT.wall);
    if (z !== -6) addCluster(mesh, x, top, z, 0.48, h * 0.42, 0.4, gem, 800 + z);
    circles.push({ x, z, r: w * 0.42 });
  }
  {
    const z = -11;
    const x = pathX(z) - 4.4;
    addCluster(mesh, x, terrH(x, z), z, 0.78, 2.7, 0.35, MAT.cyan, 11);
    circles.push({ x, z, r: 1.05 });
  }

  const spires = [[-18, -84, 16], [12, -92, 28], [-24, -104, 22], [22, -118, 36], [-8, -128, 19], [16, -136, 31], [-20, -148, 26], [8, -158, 40]];
  for (let i = 0; i < spires.length; i++) {
    const [lat, z, h] = spires[i];
    const x = pathX(z) + lat;
    const y0 = terrH(x, z);
    const w = 1.35 + (i % 4) * 0.55;
    const top = stackBlock(mesh, x, y0, z, w, h, w * (0.75 + (i % 3) * 0.12), i * 0.17, MAT.stone);
    addCluster(mesh, x, top, z, 0.55 + (i % 3) * 0.12, h * 0.16, i * 0.4, i % 2 ? MAT.cyan : MAT.violet, 900 + i);
    circles.push({ x, z, r: w * 0.5 });
  }

  const sky = createMesh();
  sky.skyDome(640, MAT.sky);
  const road = circles.filter(c => Math.abs(c.x - pathX(c.z)) - c.r > 1.2);
  return {
    verts: mesh.finish(),
    sky: sky.finish(),
    circles: road,
    tris: mesh.count / 3,
  };
}

export function spawn() {
  const psi = pathPsi(0);
  return { psi, x: pathX(0), z: 0, cam: psi, w: 0, v: 0, phase: 0, run: 0, hit: null };
}

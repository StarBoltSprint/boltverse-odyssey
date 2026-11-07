// crystal/world.js — walkable obsidian canyon. Geometry only. Colour comes from the key crops.
import { createMesh } from '../engine/bricks/facet-mesh.js';
import { MAT, CRYSTAL } from './biome.js';

const hash = (a, b) => {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

export function pathX(z) {
  return 5.2 * Math.sin(z * 0.028) + 1.6 * Math.sin(z * 0.061);
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

function addArch(mesh, circles, z0, span, h, depth) {
  const c = pathX(z0);
  const pw = 1.5;
  const yL = terrH(c - span / 2, z0);
  const yR = terrH(c + span / 2, z0);
  mesh.box(c - span / 2, yL + h / 2, z0, pw, h, depth, 0, MAT.stone);
  mesh.box(c + span / 2, yR + h / 2, z0, pw, h, depth, 0, MAT.stone);
  circles.push({ x: c - span / 2, z: z0, r: pw * 0.5 });
  circles.push({ x: c + span / 2, z: z0, r: pw * 0.5 });
  const n = 6;
  const rad = span / 2 - 0.15;
  for (let i = 0; i < n; i++) {
    const ang = Math.PI * (i + 0.5) / n;
    const x = c + Math.cos(ang) * rad;
    const y = terrH(c, z0) + h * 0.58 + Math.sin(ang) * rad * 0.72;
    mesh.box(x, y, z0, 1.2, 1.35, depth * 1.08, 0, MAT.stone);
  }
  const crownY = terrH(c, z0) + h * 0.58 + rad * 0.72 + 1.3;
  mesh.box(c, crownY, z0, 1.7, 2.8, depth, 0, MAT.stone);
  for (const s of [-1, 1]) {
    const x = c + s * (span / 2 + 1.45);
    const yy = terrH(x, z0);
    mesh.box(x, yy + h * 0.95, z0 + s * 0.3, 1.15, h * 1.9, 1.15, s * 0.18, MAT.stone);
    circles.push({ x, z: z0, r: 0.7 });
    mesh.crystal(x + s * 0.2, yy + h * 1.85, z0, 0.45, 3.2 + (s < 0 ? 0.8 : 0), s, s < 0 ? MAT.violet : MAT.cyan);
  }
}

export function buildWorld() {
  const mesh = createMesh();
  const circles = [];
  const x0 = -42, x1 = 42, z0 = -168, z1 = 22, step = 1.7;
  for (let z = z0; z < z1; z += step) {
    for (let x = x0; x < x1; x += step) {
      const corners = [[x, z], [x + step, z], [x + step, z + step], [x, z + step]];
      const p = corners.map(([px, pz]) => [px, terrH(px, pz), pz]);
      mesh.tri(p[0], p[2], p[1], [0, 0], [1, 1], [1, 0], MAT.mineral);
      mesh.tri(p[0], p[3], p[2], [0, 0], [0, 1], [1, 1], MAT.mineral);
    }
  }
  for (let z = z1 - 1; z > z0 + 1; z -= 1.4) {
    const cx = pathX(z) + CRYSTAL.streamLat;
    const nz = z - 1.4;
    const nx = pathX(nz) + CRYSTAL.streamLat;
    const half = 1.15;
    const y = -0.2;
    const a = [cx - half, y, z], b = [cx + half, y, z], c = [nx + half, y, nz], d = [nx - half, y, nz];
    mesh.tri(a, b, c, [0, z * 0.08], [1, z * 0.08], [1, nz * 0.08], MAT.stream);
    mesh.tri(a, c, d, [0, z * 0.08], [1, nz * 0.08], [0, nz * 0.08], MAT.stream);
    if (Math.round(z) % 3 === 0) circles.push({ x: cx, z, r: 1.02 });
  }

  for (let i = 0; i < 46; i++) {
    const z = 8 - i * 3.7;
    for (const side of [-1, 1]) {
      for (let row = 0; row < 3; row++) {
        const lat = side * (7.4 + row * 3.5 + hash(i, row + side * 4) * 1.2);
        const x = pathX(z) + lat;
        const sy = 2.4 + row * 3.1 + hash(i, row + 8) * 4.2;
        const sx = 2.3 + hash(i + 2, row) * 1.8;
        const sz = 2.1 + hash(row + 4, i) * 1.7;
        const yaw = (hash(i, row + 11) - 0.5) * 0.7;
        const y = terrH(x, z) + sy / 2;
        mesh.box(x, y, z, sx, sy, sz, yaw, MAT.stone);
        circles.push({ x, z, r: Math.min(sx, sz) * 0.38 });
        if (row === 0 && hash(i, side + 20) > 0.42) {
          const ch = 1.6 + hash(i, side + 2) * 3.4;
          const cr = 0.32 + hash(i, side) * 0.4;
          mesh.crystal(x + side * 0.3, y + sy / 2 - 0.05, z, cr, ch, yaw, side < 0 ? MAT.violet : MAT.cyan);
        }
      }
    }
  }

  for (let i = 0; i < 64; i++) {
    const z = 4 - i * 2.5;
    const side = i % 2 === 0 ? -1 : 1;
    const lat = side < 0 ? -(3.9 + hash(i, 1) * 1.8) : (5.5 + hash(i, 2) * 1.6);
    const x = pathX(z) + lat;
    const ch = 1.3 + hash(i, 3) * (side < 0 ? 4.8 : 4.2);
    const cr = 0.26 + hash(i, 4) * 0.48;
    mesh.crystal(x, terrH(x, z), z, cr, ch, hash(i, 5) * 3, side < 0 ? MAT.violet : MAT.cyan);
    circles.push({ x, z, r: cr * 0.82 });
  }

  addArch(mesh, circles, -18, 7.4, 8.6, 1.8);
  addArch(mesh, circles, -64, 8.2, 11.2, 2.1);

  const spires = [[-16, -88, 22], [20, -96, 30], [-26, -112, 26], [14, -124, 34], [-10, -142, 28], [28, -136, 24], [6, -158, 36]];
  for (let i = 0; i < spires.length; i++) {
    const [lat, z, h] = spires[i];
    const x = pathX(z) + lat;
    const y0 = terrH(x, z);
    const w = 1.6 + (i % 3) * 0.45;
    mesh.box(x, y0 + h / 2, z, w, h, w, i * 0.2, MAT.stone);
    mesh.crystal(x, y0 + h * 0.92, z, 0.7, h * 0.28, i, i % 2 ? MAT.cyan : MAT.violet);
    circles.push({ x, z, r: w * 0.55 });
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
  return { psi: 0, x: pathX(0), z: 0, cam: 0, w: 0, v: 0, phase: 0, run: 0, hit: null };
}

// Contact band on the follow frames. 0.5 m snow versus snow 3 m toward the lane.
// Names the base when a time has only one measurable foot.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { buildWorld, wallPoint, pathX, spawn, integrate, chaseInput } from './world.js';
import { followEye, lookAt, persp, mul, FOV_Y } from '../engine/bricks/follow-cam.js';
import { boltIdle } from '../bricks/bolt-idle.js';

const W = 720;
const H = 1280;
const TIMES = [5.1, 5.567, 7.9, 11.7, 24, 30];
const root = process.env.GLACIER_OUT || '/opt/cursor/artifacts/run35';

function decode(file) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], { maxBuffer: 12 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(file);
  return r.stdout;
}
function luma(buf, i) {
  const R = (buf[i] / 255) ** 2.2;
  const G = (buf[i + 1] / 255) ** 2.2;
  const B = (buf[i + 2] / 255) ** 2.2;
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
function median(a) {
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}
function matOf(sh, i) { return Math.round(sh[i] / 255 * 8 - 0.5); }

function snowWindow(buf, px, rad = 4) {
  if (!px) return null;
  const cx = px[0];
  const cy = px[1];
  const light = [];
  const aos = [];
  for (let y = Math.round(cy - rad); y <= cy + rad; y++) {
    for (let x = Math.round(cx - rad); x <= cx + rad; x++) {
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 > rad * rad) continue;
      const i = (y * W + x) * 4;
      if (matOf(buf.shade, i) !== 0) continue;
      const ny = buf.normal[i + 1] / 255 * 2 - 1;
      if (ny < 0.72) continue;
      const al = luma(buf.albedo, i);
      if (!(al > 0.05)) continue;
      light.push(luma(buf.surface, i) / al);
      aos.push(buf.shade[i + 3] / 255);
    }
  }
  if (light.length < 6) return null;
  return { n: light.length, light: median(light), ao: median(aos), px: [Math.round(cx), Math.round(cy)] };
}

function walkToSnow(buf, from, toward) {
  if (!from || !toward) return null;
  const dx = toward[0] - from[0];
  const dy = toward[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  for (let s = 0; s <= len; s += 2) {
    const x = from[0] + (dx / len) * s;
    const y = from[1] + (dy / len) * s;
    const hit = snowWindow(buf, [x, y], 3);
    if (hit && hit.ao < 0.92) return hit;
  }
  return snowWindow(buf, toward);
}

const world = buildWorld();
console.log('INST', JSON.stringify(world.budget.ao.instances));
console.log('GROUND', JSON.stringify(world.budget.ao.ground));

const idle = boltIdle();
const live = spawn();
let sim = 0;
function stepLive(h) {
  const input = chaseInput(sim, live);
  sim += h;
  idle.stepMotion(live, h, input.run);
  integrate(live, h, input);
}
function pawY() {
  const yaw = live.psi;
  const rx = -Math.cos(yaw);
  const rz = Math.sin(yaw);
  return Math.min(world.heightAt(live.x - rx * 0.11, live.z - rz * 0.11), world.heightAt(live.x + rx * 0.11, live.z + rz * 0.11));
}

const rows = [];
const dt = 1 / 60;
let k = 0;
while (k < TIMES.length) {
  stepLive(Math.min(dt, TIMES[k] - sim));
  if (sim + 1e-4 < TIMES[k]) continue;
  const bp = [live.x, pawY(), live.z];
  const cam = followEye(bp, live.cam, world.heightAt, 0);
  const view = lookAt(cam.eye, cam.tgt, [0, 1, 0]);
  const vp = mul(persp(FOV_Y, W / H, 0.08, 14000), view);
  const project = (p) => {
    const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12];
    const y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
    const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
    if (!(w > 0.05)) return null;
    const sx = (x / w * 0.5 + 0.5) * W;
    const sy = (1 - (y / w * 0.5 + 0.5)) * H;
    if (sx < -20 || sy < -20 || sx > W + 20 || sy > H + 20) return null;
    return [sx, sy];
  };
  const fx = -Math.sin(live.psi);
  const fz = -Math.cos(live.psi);
  const bases = [];
  for (const ahead of [8, 16, 28, 42]) {
    const x = live.x + fx * ahead;
    const z = live.z + fz * ahead;
    for (const side of [-1, 1]) {
      const p = wallPoint(z, side, 0);
      bases.push({ name: side < 0 ? 'wall-left' : 'wall-right', at: p, ahead });
    }
  }
  const drifts = world.instances.drift.data;
  for (let i = 0; i < drifts.length; i += 8) {
    const dx = drifts[i] - live.x;
    const dz = drifts[i + 2] - live.z;
    const along = dx * fx + dz * fz;
    if (along < 3 || along > 36) continue;
    bases.push({ name: 'drift', at: [drifts[i], drifts[i + 1], drifts[i + 2]], ahead: along });
  }
  const tag = String(TIMES[k]).replace('.', 'p');
  const dir = path.join(root, 'on');
  const buf = {
    surface: decode(path.join(dir, `t${tag}-surface.png`)),
    shade: decode(path.join(dir, `t${tag}-shade.png`)),
    normal: decode(path.join(dir, `t${tag}-normal.png`)),
    albedo: decode(path.join(dir, `t${tag}-albedo.png`)),
  };
  const measured = [];
  for (const base of bases) {
    const inward = Math.sign(pathX(base.at[2]) - base.at[0]) || 1;
    const wallPx = project(base.at);
    const x05 = base.at[0] + inward * 0.5;
    const z05 = base.at[2];
    const nearPx = project([x05, world.heightAt(x05, z05) + 0.04, z05]);
    const near = walkToSnow(buf, wallPx, nearPx) || snowWindow(buf, nearPx);
    const used = 0.5;
    const x3 = base.at[0] + inward * 3;
    const z3 = base.at[2];
    const far = snowWindow(buf, project([x3, world.heightAt(x3, z3) + 0.04, z3]));
    if (!near || !far || !(far.light > 1e-4) || !(near.ao < 0.95)) continue;
    measured.push({
      name: base.name,
      ahead: +base.ahead.toFixed(1),
      d: used,
      n: near.n,
      n3: far.n,
      ao: +near.ao.toFixed(3),
      ao3: +far.ao.toFixed(3),
      darken: +((1 - near.light / far.light).toFixed(4)),
      px: near.px,
    });
  }
  const picked = measured.slice().sort((a, b) => a.darken - b.darken)[0] || null;
  rows.push({ t: TIMES[k], n: measured.length, min: picked && picked.darken, base: picked, all: measured });
  console.log(JSON.stringify({ t: TIMES[k], n: measured.length, min: picked && picked.darken, base: picked && picked.name, ahead: picked && picked.ahead, ao: picked && picked.ao }));
  k++;
}
const out = path.join(root, 'contact.json');
fs.writeFileSync(out, JSON.stringify({ instances: world.budget.ao.instances, ground: world.budget.ao.ground, rows }, null, 2));
console.log('WROTE', out);

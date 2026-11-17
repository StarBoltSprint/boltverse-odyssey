// Round 2 scores. AO on vs AO off, both with SH. Legacy frames are the old constant.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { buildWorld, wallPoint, pathX, spawn, integrate, chaseInput } from './world.js';
import { followEye, lookAt, persp, mul, FOV_Y } from '../engine/bricks/follow-cam.js';
import { invertMat4 } from '../biome-factory/mat4.js';
import { boltIdle } from '../bricks/bolt-idle.js';
import { glacierIrr, shMeta } from './sh-sky.js';
import { srgbToLab, dE76 } from '../biome-factory/cie76.mjs';
import { shadeSnowAt } from './shade-snow-gate.mjs';

const W = 720;
const H = 1280;
const FOCAL = (H / 2) / Math.tan(FOV_Y / 2);
const TIMES = [5.1, 5.567, 7.9, 11.7, 24, 30];
const root = process.env.GLACIER_OUT || '/opt/cursor/artifacts/run33';
const legacyRoot = '/opt/cursor/artifacts/run32/before';
const NAMES = { 1: 'fall', 2: 'arch', 3: 'icicle', 4: 'drift', 6: 'wall', 7: 'mountain' };

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
  return s[Math.floor((s.length - 1) / 2)];
}
function matOf(s, i) { return Math.round(s[i] / 255 * 8 - 0.5); }
function flat(sh, n, i) {
  if (matOf(sh, i) !== 0) return false;
  const ny = n[i + 1] / 255 * 2 - 1;
  const ndl = sh[i + 1] / 255;
  return ny > 0.9 && ndl > 0.15 && ndl < 0.45;
}
function load(dir, t) {
  const tag = String(t).replace('.', 'p');
  const g = (n) => decode(path.join(dir, `t${tag}-${n}.png`));
  return { surface: g('surface'), shade: g('shade'), normal: g('normal'), albedo: g('albedo'), beauty: g('beauty'), bolt: g('bolt') };
}

const world = buildWorld();
const idle = boltIdle();
const live = spawn();
let sim = 0;
function stepLive(h) {
  const input = chaseInput(sim, live);
  sim += h;
  idle.stepMotion(live, h, input.run);
  integrate(live, h, input);
}
function paw() {
  const yaw = live.psi;
  const rx = -Math.cos(yaw);
  const rz = Math.sin(yaw);
  return Math.min(world.heightAt(live.x - rx * 0.11, live.z - rz * 0.11), world.heightAt(live.x + rx * 0.11, live.z + rz * 0.11));
}

const shots = [];
const dt = 1 / 60;
let k = 0;
while (k < TIMES.length) {
  stepLive(Math.min(dt, TIMES[k] - sim));
  if (sim + 1e-4 < TIMES[k]) continue;
  const bp = [live.x, paw(), live.z];
  const cam = followEye(bp, live.cam, world.heightAt, 0);
  const view = lookAt(cam.eye, cam.tgt, [0, 1, 0]);
  const vp = mul(persp(FOV_Y, W / H, 0.08, 14000), view);
  const ivp = invertMat4(vp);
  const project = (p) => {
    const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12];
    const y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
    const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
    if (!(w > 0)) return null;
    return [(x / w * 0.5 + 0.5) * W, (1 - (y / w * 0.5 + 0.5)) * H];
  };
  const fx = -Math.sin(live.psi);
  const fz = -Math.cos(live.psi);
  const bases = [];
  for (const ahead of [6, 14, 26, 40]) {
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
    if (along < 2 || along > 40) continue;
    if (dx * dx + dz * dz > 45 * 45) continue;
    bases.push({ name: 'drift', at: [drifts[i], drifts[i + 1], drifts[i + 2]], ahead: along });
  }
  shots.push({ t: TIMES[k], eye: cam.eye, bp, project, ivp, bases, bolt: project(bp) });
  k++;
}

function snowAt(buf, px, py, depth) {
  if (!px) return null;
  const rad = Math.max(2, Math.round(0.22 * FOCAL / Math.max(2, depth)));
  const L = [];
  const raw = [];
  const aos = [];
  const cx = px[0];
  const cy = px[1];
  for (let y = Math.round(cy - rad); y <= cy + rad; y++) {
    for (let x = Math.round(cx - rad); x <= cx + rad; x++) {
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 > rad * rad) continue;
      const i = (y * W + x) * 4;
      if (!flat(buf.shade, buf.normal, i)) continue;
      const al = luma(buf.albedo, i);
      if (!(al > 0.05)) continue;
      L.push(luma(buf.surface, i) / al);
      raw.push(luma(buf.surface, i));
      aos.push(buf.shade[i + 3] / 255);
    }
  }
  if (L.length < 6) return null;
  return { n: L.length, light: median(L), raw: median(raw), ao: median(aos), px: [cx, cy] };
}

function measureBase(buf, base, eye) {
  const dir = Math.sign(pathX(base.at[2]) - base.at[0]) || 1;
  let contact = null;
  for (const d of [0.3, 0.45, 0.6]) {
    const x = base.at[0] + dir * d;
    const z = base.at[2];
    const y = world.heightAt(x, z) + 0.05;
    const depth = Math.hypot(x - eye[0], y - eye[1], z - eye[2]);
    const hit = snowAt(buf, base.project ? null : null, 0);
    const p = buf._project([x, y, z]);
    if (!p || p[0] < 4 || p[1] < 4 || p[0] > W - 4 || p[1] > H - 4) continue;
    const w = snowAt(buf, p, depth);
    if (w) { contact = { ...w, d, depth, world: [x, z] }; break; }
  }
  if (!contact) return null;
  const x3 = base.at[0] + dir * 3;
  const z3 = base.at[2];
  const y3 = world.heightAt(x3, z3) + 0.05;
  const p3 = buf._project([x3, y3, z3]);
  const depth3 = Math.hypot(x3 - eye[0], y3 - eye[1], z3 - eye[2]);
  const far = snowAt(buf, p3, depth3);
  if (!far) return null;
  return {
    name: base.name,
    ahead: +base.ahead.toFixed(1),
    depth: +contact.depth.toFixed(1),
    d: contact.d,
    n: contact.n,
    n3: far.n,
    ao: +contact.ao.toFixed(3),
    ao3: +far.ao.toFixed(3),
    darken: +((1 - contact.light / far.light)).toFixed(4),
    px: contact.px.map((v) => Math.round(v)),
  };
}

function nearestVisible(buf, project, ivp, eye) {
  let best = null;
  for (let y = 80; y < H - 40; y += 3) {
    for (let x = 4; x < W - 4; x += 3) {
      const i = (y * W + x) * 4;
      const m = matOf(buf.shade, i);
      if (m !== 1 && m !== 4 && m !== 6 && m !== 3) continue;
      let sx = -1;
      let sy = -1;
      for (let r = 1; r <= 14 && sx < 0; r++) {
        for (let oy = -r; oy <= r; oy++) {
          for (let ox = -r; ox <= r; ox++) {
            const xx = x + ox;
            const yy = y + oy;
            if (xx < 1 || yy < 1 || xx >= W - 1 || yy >= H - 1) continue;
            if (flat(buf.shade, buf.normal, (yy * W + xx) * 4)) { sx = xx; sy = yy; break; }
          }
          if (sx >= 0) break;
        }
      }
      if (sx < 0) continue;
      const depth = Math.hypot(sx - W / 2, sy - H / 2);
      if (!best || depth < best.screen) best = { x, y, sx, sy, mat: m, name: NAMES[m] || String(m), screen: depth };
    }
  }
  if (!best) return null;
  // Step from the snow pixel away from the occluder by about 3 m using the local pixel scale.
  const dx = best.sx - best.x;
  const dy = best.sy - best.y;
  const len = Math.hypot(dx, dy) || 1;
  const mppGuess = 0.08;
  const step = Math.round(2.6 / mppGuess);
  const fx = Math.round(best.sx + (dx / len) * step);
  const fy = Math.round(best.sy + (dy / len) * step);
  const near = snowAt(buf, [best.sx, best.sy], 25);
  const far = snowAt(buf, [fx, fy], 28);
  if (!near || !far) return { name: best.name, px: [best.sx, best.sy], skip: true };
  return {
    name: best.name + ' (nearest visible)',
    px: [best.sx, best.sy],
    n: near.n,
    n3: far.n,
    ao: +near.ao.toFixed(3),
    darken: +((1 - near.light / far.light)).toFixed(4),
    how: 'nearest visible base in the follow frame',
  };
}

function openLane(buf) {
  const ndls = [];
  for (let y = 840; y <= 1020; y += 2) for (let x = 340; x <= 380; x += 2) {
    const i = (y * W + x) * 4;
    if (matOf(buf.shade, i) !== 0) continue;
    if (buf.normal[i + 1] / 255 * 2 - 1 > 0.96) ndls.push(buf.shade[i + 1] / 255);
  }
  const mid = ndls.length ? median(ndls) : 0.28;
  const lights = [];
  const raws = [];
  for (const cy of [860, 930, 1000]) {
    const L = [];
    const R = [];
    for (let y = cy - 16; y <= cy + 16; y++) for (let x = 344; x <= 376; x++) {
      const i = (y * W + x) * 4;
      if (matOf(buf.shade, i) !== 0) continue;
      const ny = buf.normal[i + 1] / 255 * 2 - 1;
      const ndl = buf.shade[i + 1] / 255;
      if (ny < 0.96 || Math.abs(ndl - mid) > 0.02) continue;
      const al = luma(buf.albedo, i);
      if (al > 0.05) { L.push(luma(buf.surface, i) / al); R.push(luma(buf.surface, i)); }
    }
    if (L.length > 40) { lights.push(median(L)); raws.push(median(R)); }
  }
  const mean = lights.reduce((s, v) => s + v, 0) / (lights.length || 1);
  const spread = lights.length >= 2 ? (Math.max(...lights) - Math.min(...lights)) / mean : null;
  const all = [];
  for (let y = 200; y < H - 40; y += 3) for (let x = 20; x < W - 20; x += 3) {
    const i = (y * W + x) * 4;
    if (!flat(buf.shade, buf.normal, i)) continue;
    all.push(luma(buf.surface, i));
  }
  return {
    spread: spread == null ? null : +spread.toFixed(4),
    raw: raws.length ? +median(raws).toFixed(4) : null,
    p50: all.length ? +median(all).toFixed(4) : null,
    p50n: all.length,
  };
}

function boltLuma(beauty, bolt) {
  let s = 0;
  let n = 0;
  for (let i = 0; i < bolt.length; i += 4) {
    if (bolt[i] < 16 && bolt[i + 1] < 16 && bolt[i + 2] < 16) continue;
    s += luma(beauty, i);
    n++;
  }
  return n ? s / n : null;
}

function shadeDE(buf) {
  const got = [];
  const pred = [];
  for (let y = 60; y < H - 40; y += 2) for (let x = 20; x < W - 20; x += 2) {
    const i = (y * W + x) * 4;
    const mat = matOf(buf.shade, i);
    const ndl = buf.shade[i + 1] / 255;
    const ndv = buf.shade[i + 2] / 255;
    const ao = buf.shade[i + 3] / 255;
    if (ndv <= 0.55 || ndl >= 0.12) continue;
    if (mat !== 6 && mat !== 1 && mat !== 2) continue;
    const N = [buf.normal[i] / 255 * 2 - 1, buf.normal[i + 1] / 255 * 2 - 1, buf.normal[i + 2] / 255 * 2 - 1];
    const alb = [buf.albedo[i], buf.albedo[i + 1], buf.albedo[i + 2]].map((c) => (c / 255) ** 2.2);
    const irr = glacierIrr(N, ao);
    let col = alb.map((c, kk) => c * irr[kk]);
    if ((mat > 0.5 && mat < 3.5) || (mat > 5.5 && mat < 6.5)) {
      const t = Math.min(1, Math.max(0, (ndl - 0.02) / 0.3));
      const sm = t * t * (3 - 2 * t);
      col = col.map((c, kk) => c + alb[kk] * [0.2, 0.26, 0.38][kk] * (1 - sm));
    }
    pred.push(col.map((c) => Math.round((Math.min(1, Math.max(0, c)) ** (1 / 2.2)) * 255)));
    got.push([buf.surface[i], buf.surface[i + 1], buf.surface[i + 2]]);
    if (got.length > 500) break;
  }
  if (got.length < 8) return { n: got.length, dE76: null };
  const lab = (pix) => {
    const labs = pix.map((p) => srgbToLab(p));
    const mid = (kk) => labs.map((v) => v[kk]).sort((a, b) => a - b)[Math.floor((labs.length - 1) / 2)];
    return [mid(0), mid(1), mid(2)];
  };
  return { n: got.length, dE76: +dE76(lab(got), lab(pred)).toFixed(2) };
}

const rows = [];
for (const shot of shots) {
  const off = load(path.join(root, 'off'), shot.t);
  const on = load(path.join(root, 'on'), shot.t);
  off._project = shot.project;
  on._project = shot.project;
  const measured = [];
  for (const base of shot.bases) {
    const a = measureBase(on, base, shot.eye);
    const b = measureBase(off, base, shot.eye);
    if (!a || !b) continue;
    measured.push({ ...a, before: b.darken, after: a.darken });
  }
  let picked = null;
  if (!measured.length) {
    picked = nearestVisible(on, shot.project, shot.ivp, shot.eye);
    const pickedOff = nearestVisible(off, shot.project, shot.ivp, shot.eye);
    if (picked && pickedOff && picked.darken != null) picked.before = pickedOff.darken;
  }
  const openOn = openLane(on);
  const openOff = openLane(off);
  let legacy = null;
  const legPath = path.join(legacyRoot, `t${String(shot.t).replace('.', 'p')}-surface.png`);
  if (fs.existsSync(legPath)) legacy = openLane(load(legacyRoot, shot.t));
  const boltOn = boltLuma(on.beauty, on.bolt);
  const boltOff = boltLuma(off.beauty, off.bolt);
  const aoDelta = openOn.raw && openOff.raw ? (openOn.raw - openOff.raw) / openOff.raw : null;
  const shDelta = openOff.raw && legacy && legacy.raw ? (openOff.raw - legacy.raw) / legacy.raw : null;
  rows.push({
    t: shot.t,
    boltX: shot.bolt ? +shot.bolt[0].toFixed(1) : null,
    boltLuma: { off: boltOff && +boltOff.toFixed(4), on: boltOn && +boltOn.toFixed(4), delta: boltOn && boltOff ? +(boltOn - boltOff).toFixed(4) : null },
    bases: measured,
    nearest: picked,
    contactMin: measured.length ? Math.min(...measured.map((m) => m.after)) : (picked && picked.darken != null ? picked.darken : null),
    contactBefore: measured.length ? median(measured.map((m) => m.before)) : (picked && picked.before != null ? picked.before : null),
    open: { on: openOn, off: openOff, legacy, aoDelta: aoDelta == null ? null : +aoDelta.toFixed(4), shDelta: shDelta == null ? null : +shDelta.toFixed(4) },
    shade: shadeDE(on),
    shadeSnow: shadeSnowAt(on, shot.t),
    shadeSnowLegacy: fs.existsSync(legPath) ? shadeSnowAt(load(legacyRoot, shot.t), shot.t) : null,
  });
  console.log(JSON.stringify({
    t: shot.t,
    n: measured.length,
    min: rows.at(-1).contactMin,
    before: rows.at(-1).contactBefore == null ? null : +Number(rows.at(-1).contactBefore).toFixed(4),
    nearest: picked && picked.name,
    aoDelta: rows.at(-1).open.aoDelta,
    shDelta: rows.at(-1).open.shDelta,
    p50: openOn.p50,
    bolt: rows.at(-1).boltLuma,
    de: rows.at(-1).shade.dE76,
    shadeB: rows.at(-1).shadeSnow.b,
    shadeDE: rows.at(-1).shadeSnow.dE76,
    legacyB: rows.at(-1).shadeSnowLegacy && rows.at(-1).shadeSnowLegacy.b,
  }));
}
const p50s = rows.map((r) => r.open.on.p50).filter((v) => v != null);
const p50 = median(p50s);
const meta = shMeta();
const sun = [0.72, 0.28, -0.63];
const sunL = Math.hypot(...sun);
const sunN = sun.map((v) => v / sunL);
const peak = glacierIrr(sunN, 1);
const report = {
  ground: world.budget.ao.ground,
  tris: world.budget.totalTris,
  draws: world.budget.draws,
  p50,
  exposureMultiplier: p50 ? +(0.708 / p50).toFixed(4) : null,
  sunFacingBeforeClamp: +Math.max(...peak).toFixed(3),
  sh: { upCool: +meta.upCool.toFixed(3), downCool: +meta.downCool.toFixed(3), flatDelta: meta.flatDelta },
  rows,
};
const out = path.join(path.dirname(new URL(import.meta.url).pathname), 'artifacts', 'run32', 'round2.json');
fs.writeFileSync(out, JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(root, 'round2.json'), JSON.stringify(report, null, 2));
console.log('P50', p50, 'x', report.exposureMultiplier, 'ground', report.ground);

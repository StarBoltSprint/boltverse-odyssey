// Remeasure saved follow-camera frames. Flat snow only, surface buffer.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { buildWorld, spawn, integrate, chaseInput } from './world.js';
import { followEye, lookAt, persp, mul, FOV_Y } from '../engine/bricks/follow-cam.js';
import { boltIdle } from '../bricks/bolt-idle.js';
import { contactProbes, openProbes } from './ao-probes.js';
import { glacierIrr, shMeta } from './sh-sky.js';
import { srgbToLab, dE76 } from '../biome-factory/cie76.mjs';

const TIMES = [5.1, 5.567, 7.9, 11.7, 24, 30];
const W = 720;
const H = 1280;
const FOCAL = (H / 2) / Math.tan(FOV_Y / 2);
const root = process.env.GLACIER_OUT || '/opt/cursor/artifacts/run32';

function decode(file) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], { maxBuffer: 12 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(file + ' ' + String(r.stderr).slice(-200));
  return r.stdout;
}
function lumaAt(buf, i) {
  const R = (buf[i] / 255) ** 2.2;
  const G = (buf[i + 1] / 255) ** 2.2;
  const B = (buf[i + 2] / 255) ** 2.2;
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
function median(a) {
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.floor((s.length - 1) / 2)];
}
function matOf(shade, i) { return Math.round(shade[i] / 255 * 8 - 0.5); }

function snowWindow(surface, shade, normal, albedo, cx, cy, depth) {
  const rad = Math.max(3, Math.round(0.4 * FOCAL / Math.max(1.2, depth)));
  const light = [];
  const raw = [];
  const aos = [];
  for (let y = Math.max(0, Math.round(cy - rad)); y <= Math.min(H - 1, Math.round(cy + rad)); y++) {
    for (let x = Math.max(0, Math.round(cx - rad)); x <= Math.min(W - 1, Math.round(cx + rad)); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > rad * rad) continue;
      const i = (y * W + x) * 4;
      if (matOf(shade, i) !== 0) continue;
      const ny = normal[i + 1] / 255 * 2 - 1;
      const ndl = shade[i + 1] / 255;
      if (ny < 0.92 || ndl < 0.2 || ndl > 0.38) continue;
      const alb = lumaAt(albedo, i);
      if (!(alb > 0.05)) continue;
      const lum = lumaAt(surface, i);
      raw.push(lum);
      light.push(lum / alb);
      aos.push(shade[i + 3] / 255);
    }
  }
  if (light.length < 8) return null;
  return { n: light.length, light: median(light), raw: median(raw), ao: median(aos) };
}

function shadeScore(surface, shade, normal, albedo, cx, cy) {
  const got = [];
  const pred = [];
  const cool = [];
  const warm = [];
  for (let y = Math.max(0, cy - 80); y <= Math.min(H - 1, cy + 16); y++) {
    for (let x = Math.max(0, cx - 28); x <= Math.min(W - 1, cx + 28); x++) {
      const i = (y * W + x) * 4;
      const mat = matOf(shade, i);
      const ndl = shade[i + 1] / 255;
      const ndv = shade[i + 2] / 255;
      const ao = shade[i + 3] / 255;
      if (ndv <= 0.55 || ndl >= 0.12) continue;
      if (mat !== 6 && mat !== 1 && mat !== 2 && mat !== 0) continue;
      const N = [normal[i] / 255 * 2 - 1, normal[i + 1] / 255 * 2 - 1, normal[i + 2] / 255 * 2 - 1];
      const alb = [albedo[i], albedo[i + 1], albedo[i + 2]].map((c) => (c / 255) ** 2.2);
      const irr = glacierIrr(N, ao);
      let col = alb.map((c, k) => c * irr[k]);
      if ((mat > 0.5 && mat < 3.5) || (mat > 5.5 && mat < 6.5)) {
        const t = Math.min(1, Math.max(0, (ndl - 0.02) / 0.3));
        const sm = t * t * (3 - 2 * t);
        col = col.map((c, k) => c + alb[k] * [0.2, 0.26, 0.38][k] * (1 - sm));
      }
      pred.push(col.map((c) => Math.round((Math.min(1, Math.max(0, c)) ** (1 / 2.2)) * 255)));
      got.push([surface[i], surface[i + 1], surface[i + 2]]);
      const br = (surface[i + 2] / 255) ** 2.2 - (surface[i] / 255) ** 2.2;
      if (N[1] > 0.25) cool.push(br);
      if (N[1] < -0.05) warm.push(br);
    }
  }
  if (got.length < 8) return { n: got.length, dE76: null, cool: null, warm: null };
  const lab = (pix) => {
    const labs = pix.map((p) => srgbToLab(p));
    const mid = (k) => labs.map((v) => v[k]).sort((p, q) => p - q)[Math.floor((labs.length - 1) / 2)];
    return [mid(0), mid(1), mid(2)];
  };
  return {
    n: got.length,
    dE76: +dE76(lab(got), lab(pred)).toFixed(2),
    cool: cool.length >= 8 ? +median(cool).toFixed(4) : null,
    warm: warm.length >= 8 ? +median(warm).toFixed(4) : null,
  };
}

function boltLuma(beauty, bolt) {
  let s = 0;
  let n = 0;
  for (let i = 0; i < bolt.length; i += 4) {
    if (bolt[i] < 16 && bolt[i + 1] < 16 && bolt[i + 2] < 16) continue;
    s += lumaAt(beauty, i);
    n++;
  }
  return n ? s / n : null;
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
  return Math.min(
    world.heightAt(live.x - rx * 0.11, live.z - rz * 0.11),
    world.heightAt(live.x + rx * 0.11, live.z + rz * 0.11),
  );
}
const probes = [];
const dt = 1 / 60;
let k = 0;
while (k < TIMES.length) {
  stepLive(Math.min(dt, TIMES[k] - sim));
  if (sim + 1e-4 < TIMES[k]) continue;
  const bp = [live.x, paw(), live.z];
  const cam = followEye(bp, live.cam, world.heightAt, 0);
  const vp = mul(persp(FOV_Y, W / H, 0.08, 14000), lookAt(cam.eye, cam.tgt, [0, 1, 0]));
  const project = (p) => {
    const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12];
    const y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
    const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
    if (!(w > 0)) return null;
    return [(x / w * 0.5 + 0.5) * W, (1 - (y / w * 0.5 + 0.5)) * H];
  };
  const bolt = project(bp);
  probes.push({
    t: TIMES[k],
    bolt,
    project,
    depthAt: (c) => Math.hypot(c[0] - cam.eye[0], c[1] - cam.eye[1], c[2] - cam.eye[2]),
    contact: contactProbes(world, project, cam.eye, W, H, bolt),
    open: openProbes(world, live, project, cam.eye, W, H, bolt),
  });
  k++;
}

function load(dir, t) {
  const tag = String(t).replace('.', 'p');
  const grab = (name) => decode(path.join(dir, `t${tag}-${name}.png`));
  return {
    surface: grab('surface'),
    shade: grab('shade'),
    normal: grab('normal'),
    albedo: grab('albedo'),
    beauty: grab('beauty'),
    bolt: grab('bolt'),
  };
}

const contactVerts = [];
for (let i = 0; i < world.verts.length / 8; i++) {
  if (Math.round(world.verts[i * 8 + 3]) !== 0) continue;
  if (world.verts[i * 8 + 5] < 0.85) continue;
  const ao = world.shadeNormals[i * 4 + 3];
  if (ao > 0.55) continue;
  contactVerts.push([world.verts[i * 8], world.verts[i * 8 + 1], world.verts[i * 8 + 2], ao]);
}

function scoreDir(dir) {
  return probes.map((pr) => {
    const buf = load(dir, pr.t);
    const clusters = new Map();
    for (const c of contactVerts) {
      const p = pr.project ? pr.project(c) : null;
      if (!p) continue;
      const x = Math.round(p[0]);
      const y = Math.round(p[1]);
      if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) continue;
      const i = (y * W + x) * 4;
      if (matOf(buf.shade, i) !== 0) continue;
      const ny = buf.normal[i + 1] / 255 * 2 - 1;
      const ndl = buf.shade[i + 1] / 255;
      if (ny < 0.9 || ndl < 0.18 || ndl > 0.4) continue;
      const alb = lumaAt(buf.albedo, i);
      if (!(alb > 0.05)) continue;
      const key = Math.round(x / 18) + ':' + Math.round(y / 10);
      const light = lumaAt(buf.surface, i) / alb;
      const prev = clusters.get(key);
      if (!prev) clusters.set(key, { x, y, lights: [light], aos: [buf.shade[i + 3] / 255], depth: pr.depthAt ? pr.depthAt(c) : 30 });
      else { prev.lights.push(light); prev.aos.push(buf.shade[i + 3] / 255); }
    }
    const contacts = [];
    for (const cl of clusters.values()) {
      if (cl.lights.length < 4) continue;
      const depth = cl.depth;
      const mpp = depth / FOCAL;
      const px3 = Math.round(3 / mpp);
      const dirx = cl.x < W / 2 ? 1 : -1;
      const fx = Math.round(cl.x + dirx * px3);
      const fy = cl.y;
      if (fx < 2 || fx >= W - 2) continue;
      const refs = [];
      for (let yy = fy - 3; yy <= fy + 3; yy++) for (let xx = fx - 4; xx <= fx + 4; xx++) {
        if (xx < 1 || yy < 1 || xx >= W - 1 || yy >= H - 1) continue;
        const i = (yy * W + xx) * 4;
        if (matOf(buf.shade, i) !== 0) continue;
        const ny = buf.normal[i + 1] / 255 * 2 - 1;
        const ndl = buf.shade[i + 1] / 255;
        if (ny < 0.9 || ndl < 0.18 || ndl > 0.4) continue;
        const alb = lumaAt(buf.albedo, i);
        if (alb > 0.05) refs.push(lumaAt(buf.surface, i) / alb);
      }
      if (refs.length < 4) continue;
      const L05 = median(cl.lights);
      const L3 = median(refs);
      contacts.push({
        x: cl.x, y: cl.y, n05: cl.lights.length, n3: refs.length,
        L05: +L05.toFixed(4), L3: +L3.toFixed(4),
        ao: +median(cl.aos).toFixed(3),
        darken: +((1 - L05 / L3)).toFixed(4),
      });
    }
    const open = [];
    for (const o of pr.open) {
      const w = snowWindow(buf.surface, buf.shade, buf.normal, buf.albedo, o.p[0], o.p[1], o.depth);
      if (!w) { open.push({ skip: true, clear: o.clear }); continue; }
      open.push({ clear: o.clear, depth: o.depth, n: w.n, light: +w.light.toFixed(4), raw: +w.raw.toFixed(4), ao: +w.ao.toFixed(3) });
    }
    const lights = open.filter((o) => o.light != null).map((o) => o.light);
    const mean = lights.reduce((s, v) => s + v, 0) / (lights.length || 1);
    const spread = lights.length >= 2 ? (Math.max(...lights) - Math.min(...lights)) / mean : null;
    const shaded = pr.contact.slice(0, 4).map((c) => shadeScore(buf.surface, buf.shade, buf.normal, buf.albedo, c.p05[0], c.p05[1]));
    const measured = contacts.filter((c) => c.darken != null);
    return {
      t: pr.t,
      boltLuma: +boltLuma(buf.beauty, buf.bolt).toFixed(4),
      boltX: pr.bolt ? +pr.bolt[0].toFixed(2) : null,
      contacts,
      contactMin: measured.length ? Math.min(...measured.map((c) => c.darken)) : null,
      contactMed: measured.length ? +median(measured.map((c) => c.darken)).toFixed(4) : null,
      measured: measured.length,
      openSpread: spread == null ? null : +spread.toFixed(4),
      openMinAo: open.filter((o) => o.ao != null).length ? Math.min(...open.filter((o) => o.ao != null).map((o) => o.ao)) : null,
      openMeanRaw: open.filter((o) => o.raw != null).length ? +median(open.filter((o) => o.raw != null).map((o) => o.raw)).toFixed(4) : null,
      open,
      shaded,
    };
  });
}

const beforeDir = path.join(root, 'before');
const afterDir = path.join(root, 'after');
const before = scoreDir(beforeDir);
const after = fs.existsSync(path.join(afterDir, 't5p1-surface.png')) ? scoreDir(afterDir) : null;
const meta = shMeta();
const summary = { meta, before, after };
const out = path.join(path.dirname(new URL(import.meta.url).pathname), 'artifacts', 'run32', 'remeasure.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({
  meta: { upLuma: meta.upLuma, oldLuma: meta.oldLuma, flatDelta: meta.flatDelta, upCool: +meta.upCool.toFixed(3), downCool: +meta.downCool.toFixed(3) },
  before: before.map((r) => ({ t: r.t, min: r.contactMin, med: r.contactMed, n: r.measured, spread: r.openSpread, ao: r.openMinAo, bolt: r.boltLuma, x: r.boltX })),
  after: after && after.map((r) => ({ t: r.t, min: r.contactMin, med: r.contactMed, n: r.measured, spread: r.openSpread, ao: r.openMinAo, bolt: r.boltLuma, x: r.boltX, de: r.shaded.map((s) => s.dE76), sign: r.shaded.map((s) => s.cool != null && s.warm != null ? +(s.cool - s.warm).toFixed(3) : null) })),
}, null, 2));

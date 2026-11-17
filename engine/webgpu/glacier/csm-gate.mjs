// Cascaded-shadow gate. Thresholds live in csm-limits.json and are not lowered here.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { lookAt, persp, mul, FOV_Y } from '../engine/bricks/follow-cam.js';
import { norm3 } from '../biome-factory/light-rig.js';
import { srgbToLab, dE76 } from '../biome-factory/cie76.mjs';
import { LIGHT } from './biome.js';
import { buildWorld } from './world.js';
import { buildCascades, applyMat } from './shadows.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const limits = JSON.parse(fs.readFileSync(path.join(here, 'csm-limits.json'), 'utf8'));
const SPIRE = new Set([1, 2, 3, 6, 7]);

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}
function load(file) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const [w, h] = probe.stdout.trim().split(',').map(Number);
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:'], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 }).stdout;
  if (!raw || raw.length !== w * h * 3) throw new Error('unreadable ' + file);
  return { raw, w, h };
}
function luma(r, g, b) { return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
function matOf(r) { return Math.round(r / 255 * 8 - 0.5); }
function project(vp, p, W, H) {
  const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12];
  const y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
  const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
  if (!(w > 0)) return null;
  return [(x / w * 0.5 + 0.5) * W, (1 - (y / w * 0.5 + 0.5)) * H];
}
function raster(mask, w, h, a, b, c) {
  const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
  const maxX = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
  const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
  const maxY = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
  if (Math.abs(area) < 1e-3) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const w0 = ((b[0] - px) * (c[1] - py) - (c[0] - px) * (b[1] - py)) / area;
      const w1 = ((c[0] - px) * (a[1] - py) - (a[0] - px) * (c[1] - py)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 >= -0.02 && w1 >= -0.02 && w2 >= -0.02) mask[y * w + x] = 1;
    }
  }
}
function dropToSnow(p, sun, heightAt) {
  const dir = [-sun[0], -sun[1], -sun[2]];
  if (dir[1] > -0.04) return null;
  let x = p[0], y = p[1], z = p[2];
  for (let i = 0; i < 12; i++) {
    const h = heightAt(x, z);
    if (y <= h + 0.2) return [x, h, z];
    const step = Math.min((y - h) / -dir[1], 40);
    x += dir[0] * step; y += dir[1] * step; z += dir[2] * step;
    if (y < -30 || y > 500) return null;
  }
  return null;
}
// The gate reference matches the GPU shadow pass: every non-snow triangle in
// the world mesh, plus baked icicles, chunks, and drifts. Snow is the receiver
// and is not a caster. Bolt's animated card is a separate draw and is not in
// this raster. Each cascade is 384² in the same light projection. A snow vertex
// is occluded when the stored depth is more than 0.008 closer than the receiver.
// The GPU side is the rendered factor, shadowed below 0.5. The 0.80 bar stays.
// `spire` is the old reference, kept so the two scores can be reported together.
const BIAS = 0.008;
function cpuOcclusion(world, eye, tgt, W, H) {
  const casc = buildCascades({
    eye, tgt, fovY: FOV_Y, aspect: W / H, sun: norm3(LIGHT.sun.direction), tier: 'phone',
  });
  const S = 1024;
  const depth = [new Float32Array(S * S).fill(1), new Float32Array(S * S).fill(1)];
  const spire = [new Float32Array(S * S).fill(1), new Float32Array(S * S).fill(1)];
  let used = 0;
  let spireUsed = 0;
  function rast(bufs, tri) {
    for (let ci = 0; ci < 2; ci++) {
      const q = tri.map((v) => applyMat(casc.mats[ci], v));
      const proj = q.map((v) => [(v[0] * 0.5 + 0.5) * S, (0.5 - v[1] * 0.5) * S, v[2]]);
      const xs = proj.map((v) => v[0]);
      const ys = proj.map((v) => v[1]);
      if (Math.max(...xs) < 0 || Math.min(...xs) > S || Math.max(...ys) < 0 || Math.min(...ys) > S) continue;
      const minX = Math.max(0, Math.floor(Math.min(...xs)));
      const maxX = Math.min(S - 1, Math.ceil(Math.max(...xs)));
      const minY = Math.max(0, Math.floor(Math.min(...ys)));
      const maxY = Math.min(S - 1, Math.ceil(Math.max(...ys)));
      // A caster that fills the map is still a caster. The GPU draws it.
      const [a, b, c] = proj;
      const area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
      if (Math.abs(area) < 1e-3) continue;
      const buf = bufs[ci];
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5;
          const py = y + 0.5;
          const w0 = ((b[0] - px) * (c[1] - py) - (c[0] - px) * (b[1] - py)) / area;
          const w1 = ((c[0] - px) * (a[1] - py) - (a[0] - px) * (c[1] - py)) / area;
          const w2 = 1 - w0 - w1;
          if (w0 < -0.01 || w1 < -0.01 || w2 < -0.01) continue;
          const z = w0 * a[2] + w1 * b[2] + w2 * c[2];
          if (z < 0 || z > 1) continue;
          const i = y * S + x;
          if (z < buf[i]) buf[i] = z;
        }
      }
    }
  }
  function pushTri(buf, tri, alsoSpire) {
    rast(buf, tri);
    if (alsoSpire) rast(spire, tri);
  }
  const verts = world.verts;
  for (let t = 0; t + 24 <= verts.length; t += 24) {
    const m = Math.round(verts[t + 3]);
    if (m < 0.5) continue;
    const tri = [0, 8, 16].map((k) => [verts[t + k], verts[t + k + 1], verts[t + k + 2]]);
    pushTri(depth, tri, SPIRE.has(m));
    used++;
    if (SPIRE.has(m)) spireUsed++;
  }
  const bake = (proto, data) => {
    const vCount = proto.length / 8;
    const count = data.length / 8;
    for (let i = 0; i < count; i++) {
      const ix = data[i * 8], iy = data[i * 8 + 1], iz = data[i * 8 + 2], yaw = data[i * 8 + 3];
      const sx = data[i * 8 + 4], sy = data[i * 8 + 5], sz = data[i * 8 + 6], tilt = data[i * 8 + 7];
      const cl = Math.cos(tilt), sl = Math.sin(tilt), c = Math.cos(yaw), s = Math.sin(yaw);
      const pts = [];
      for (let v = 0; v < vCount; v++) {
        const px = proto[v * 8] * sx, py = proto[v * 8 + 1] * sy, pz = proto[v * 8 + 2] * sz;
        const pLx = cl * px - sl * py, pLy = sl * px + cl * py, pLz = pz;
        pts.push([c * pLx + s * pLz + ix, pLy + iy, -s * pLx + c * pLz + iz]);
      }
      for (let v = 0; v + 2 < pts.length; v += 3) pushTri(depth, [pts[v], pts[v + 1], pts[v + 2]], false);
      used += vCount / 3;
    }
  };
  for (const name of ['icicle', 'chunk', 'drift']) {
    const inst = world.instances[name];
    bake(inst.proto, inst.data);
  }
  function blockedAt(maps, p) {
    for (let ci = 0; ci < 2; ci++) {
      const q = applyMat(casc.mats[ci], p);
      const e = Math.max(Math.abs(q[0]), Math.abs(q[1]));
      if (e >= 0.98 || q[2] < 0 || q[2] > 1) continue;
      const x = Math.max(0, Math.min(S - 1, (q[0] * 0.5 + 0.5) * S | 0));
      const y = Math.max(0, Math.min(S - 1, (0.5 - q[1] * 0.5) * S | 0));
      if (maps[ci][y * S + x] + BIAS < q[2]) return true;
    }
    return false;
  }
  return {
    blocked: (p) => blockedAt(depth, p),
    blockedSpire: (p) => blockedAt(spire, p),
    used, spireUsed, casc,
  };
}

const root = arg('--root');
if (!root) {
  console.error('usage: node csm-gate.mjs --root <dir>');
  process.exit(2);
}
const world = buildWorld();
const factorPath = path.join(root, 'vertex-factors.json');
const vertFactors = fs.existsSync(factorPath) ? JSON.parse(fs.readFileSync(factorPath, 'utf8')) : null;
const seamPath = path.join(root, 'cascade-seam.json');
const seamFactors = fs.existsSync(seamPath) ? JSON.parse(fs.readFileSync(seamPath, 'utf8')) : null;
const tags = JSON.parse(fs.readFileSync(path.join(root, 'tags.json'), 'utf8'));
let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };
const rows = [];
for (const tag of tags) {
  const info = JSON.parse(fs.readFileSync(path.join(root, 'after', `t${tag}.json`), 'utf8'));
  const shadow = load(path.join(root, 'mask', `t${tag}.png`));
  const mat = load(path.join(root, 'after', `t${tag}-mat.png`));
  const beauty = load(path.join(root, 'after', `t${tag}.jpg`));
  const { w, h } = shadow;
  const snow = new Uint8Array(w * h);
  const gpu = new Uint8Array(w * h);
  let clip = 0, iceN = 0, iceBlue = 0, bright = 0, grey = 0;
  const shSnow = [], litSnow = [];
  for (let i = 0; i < w * h; i++) {
    const o = i * 3;
    const id = matOf(mat.raw[o]);
    const r = beauty.raw[o] / 255, g = beauty.raw[o + 1] / 255, b = beauty.raw[o + 2] / 255;
    const y = luma(r, g, b);
    if (r > limits.clipAt || g > limits.clipAt || b > limits.clipAt) clip++;
    if (id === 0) {
      snow[i] = 1;
      const sh = shadow.raw[o] / 255;
      const ndl = mat.raw[o + 1] / 255;
      if (sh < 0.5) gpu[i] = 1;
      // Sun-facing snow only. A pixel outside the cascade is marked lit and is still ambient blue.
      if (ndl > 0.4 && sh < 0.35) shSnow.push(b - r);
      else if (ndl > 0.4 && sh > 0.85) litSnow.push(b - r);
    }
    if (id === 1 || id === 2 || id === 3 || id === 6 || id === 7) {
      iceN++;
      iceBlue += b - r;
      if (y > limits.brightLuma) {
        bright++;
        if (Math.max(r, g, b) - Math.min(r, g, b) < limits.greyChroma) grey++;
      }
    }
  }
  const cpu = cpuOcclusion(world, info.eye, info.tgt, w, h);
  const factorBytes = vertFactors && vertFactors[tag] ? Buffer.from(vertFactors[tag], 'base64') : null;
  let fi = 0;
  const vp = mul(persp(FOV_Y, w / h, 0.08, 14000), lookAt(info.eye, info.tgt, [0, 1, 0]));
  let inter = 0, union = 0, gN = 0, cN = 0;
  let agree = 0, factorOnly = 0, cpuOnly = 0, bothLit = 0;
  let interS = 0, unionS = 0, cS = 0;
  const stride = 4;
  for (let t = 0; t < world.verts.length; t += 8 * stride) {
    if (Math.round(world.verts[t + 3]) !== 0) continue;
    const fv = factorBytes ? factorBytes[fi++] / 255 : null;
    const p = [world.verts[t], world.verts[t + 1], world.verts[t + 2]];
    if ((p[0] - info.eye[0]) ** 2 + (p[2] - info.eye[2]) ** 2 > 70 * 70) continue;
    const scr = project(vp, p, w, h);
    if (!scr || scr[0] < 1 || scr[1] < 1 || scr[0] >= w - 1 || scr[1] >= h - 1) continue;
    const pix = (scr[1] | 0) * w + (scr[0] | 0);
    if (!snow[pix]) continue;
    const g = fv == null ? gpu[pix] === 1 : fv < 0.5;
    const c = cpu.blocked(p);
    const cs = cpu.blockedSpire(p);
    if (g) gN++;
    if (c) cN++;
    if (cs) cS++;
    if (g || c) union++;
    if (g && c) inter++;
    if (g || cs) unionS++;
    if (g && cs) interS++;
    if (g && c) agree++;
    else if (g) factorOnly++;
    else if (c) cpuOnly++;
    else bothLit++;
  }
  if (factorBytes) console.log(tag, 'split', 'both', agree, 'factorOnly', factorOnly, 'cpuOnly', cpuOnly, 'bothLit', bothLit);
  const iou = union ? inter / union : 0;
  const iouSpire = unionS ? interS / unionS : 0;
  if (iou < limits.csmIouMin) bad(`csm_iou ${tag} ${iou.toFixed(3)} gpu ${gN} cpu ${cN}`);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
  const blueDelta = shSnow.length && litSnow.length ? mean(shSnow) - mean(litSnow) : 0;
  if (!(shSnow.length > 50 && litSnow.length > 50 && blueDelta > limits.snowShadowBlueMin)) {
    bad(`snow blue ${tag} ${blueDelta.toFixed(3)} n ${shSnow.length}/${litSnow.length}`);
  }
  let seamN = 0, seamSum = 0;
  for (let y = 8; y < h - 8; y += 3) {
    for (let x = 8; x < w - 8; x += 3) {
      const i = y * w + x;
      if (!snow[i] || shadow.raw[i * 3 + 1] / 255 > 0.15) continue;
      let found = -1;
      for (let dy = -16; dy <= 16 && found < 0; dy += 4) {
        for (let dx = -16; dx <= 16; dx += 4) {
          const j = (y + dy) * w + (x + dx);
          if (j < 0 || j >= w * h || !snow[j]) continue;
          if (shadow.raw[j * 3 + 1] / 255 > 0.85) { found = j; break; }
        }
      }
      if (found < 0) continue;
      const y0 = luma(beauty.raw[i * 3] / 255, beauty.raw[i * 3 + 1] / 255, beauty.raw[i * 3 + 2] / 255);
      const y1 = luma(beauty.raw[found * 3] / 255, beauty.raw[found * 3 + 1] / 255, beauty.raw[found * 3 + 2] / 255);
      seamSum += Math.abs(y0 - y1);
      seamN++;
    }
  }
  const seam = seamN ? seamSum / seamN : 1;
  const factorSeam = seamFactors && seamFactors[tag];
  if (!factorSeam) {
    if (seamN < 8) bad(`seam samples ${tag} ${seamN}`);
    else if (seam > limits.cascadeSeamJumpMax) bad(`seam ${tag} ${seam.toFixed(3)}`);
  } else if (!(factorSeam.n >= 8)) bad(`cascade samples ${tag} ${factorSeam.n}`);
  else if (!(factorSeam.mean <= limits.cascadeSeamJumpMax)) bad(`cascade seam ${tag} ${factorSeam.mean.toFixed(3)}`);
  const greyBright = bright ? grey / bright : null;
  const blue = iceN ? iceBlue / iceN : null;
  if (greyBright == null || !(greyBright < limits.greyBrightMax)) bad(`grey_bright ${tag} ${greyBright}`);
  if (!(blue > limits.iceBlueMin)) bad(`ice b-r ${tag} ${blue}`);
  if (clip / (w * h) > limits.clipFracMax) bad(`clip ${tag}`);
  rows.push({
    tag, iou: +iou.toFixed(4), iouSpire: +iouSpire.toFixed(4), gpu: gN, cpu: cN, cpuSpire: cS, inter, union, casterTris: cpu.used, spireTris: cpu.spireUsed,
    blueDelta: +blueDelta.toFixed(4), seam: +seam.toFixed(4), seamN,
    cascadeSeam: factorSeam ? { n: factorSeam.n, mean: +factorSeam.mean.toFixed(4), max: +factorSeam.max.toFixed(4), frac: +factorSeam.frac.toFixed(4) } : null,
    greyBright: greyBright == null ? null : +greyBright.toFixed(4),
    iceBlue: blue == null ? null : +blue.toFixed(4),
    clip: +(clip / (w * h)).toFixed(5),
    draws: info.draws, shadowDraws: info.shadowDraws,
  });
  const factorText = factorSeam ? ` cascade ${factorSeam.mean.toFixed(3)} max ${factorSeam.max.toFixed(3)} frac ${factorSeam.frac.toFixed(3)} n ${factorSeam.n}` : '';
  console.log(tag, 'iou', iou.toFixed(3), 'spire', iouSpire.toFixed(3), 'gpu', gN, 'cpu', cN, 'cpuSpire', cS, 'pixelSeam', seam.toFixed(3), 'pairs', seamN + factorText);
}
if (fs.existsSync(path.join(root, 'shimmer.json'))) {
  const shim = JSON.parse(fs.readFileSync(path.join(root, 'shimmer.json'), 'utf8'));
  if (shim.eyeA && fs.existsSync(path.join(root, 'shimmer-a.png'))) {
    const A = load(path.join(root, 'shimmer-a.png'));
    const B = load(path.join(root, 'shimmer-b.png'));
    let n = 0;
    let flip = 0;
    for (let t = 0; t < world.verts.length; t += 8 * 2) {
      if (Math.round(world.verts[t + 3]) !== 0) continue;
      const p = [world.verts[t], world.verts[t + 1], world.verts[t + 2]];
      if ((p[0] - shim.eyeA[0]) ** 2 + (p[2] - shim.eyeA[2]) ** 2 > 50 * 50) continue;
      const pa = project(mul(persp(FOV_Y, A.w / A.h, 0.08, 14000), lookAt(shim.eyeA, shim.tgtA, [0, 1, 0])), p, A.w, A.h);
      const pb = project(mul(persp(FOV_Y, B.w / B.h, 0.08, 14000), lookAt(shim.eyeB, shim.tgtB, [0, 1, 0])), p, B.w, B.h);
      if (!pa || !pb || pa[0] < 2 || pb[0] < 2 || pa[1] < 2 || pb[1] < 2 || pa[0] >= A.w - 2 || pb[0] >= B.w - 2 || pa[1] >= A.h - 2 || pb[1] >= B.h - 2) continue;
      const ga = A.raw[((pa[1] | 0) * A.w + (pa[0] | 0)) * 3] / 255;
      const gb = B.raw[((pb[1] | 0) * B.w + (pb[0] | 0)) * 3] / 255;
      n++;
      if (Math.abs(ga - gb) > 0.1) flip++;
    }
    shim.worldSamples = n;
    shim.worldFlip = flip;
    shim.worldFraction = n ? flip / n : 0;
    const sun = norm3(LIGHT.sun.direction);
    const ca = buildCascades({ eye: shim.eyeA, tgt: shim.tgtA, fovY: FOV_Y, aspect: A.w / A.h, sun, tier: 'phone' });
    const cb = buildCascades({ eye: shim.eyeB, tgt: shim.tgtB, fovY: FOV_Y, aspect: B.w / B.h, sun, tier: 'phone' });
    shim.radiusA = ca.radii.map((v) => +v.toFixed(4));
    shim.radiusB = cb.radii.map((v) => +v.toFixed(4));
    shim.radiusConstant = ca.radii.every((v, i) => Math.abs(v - cb.radii[i]) < 1e-6);
    let mapFlip = 0;
    let recvFlip = 0;
    for (let t = 0; t < world.verts.length; t += 8 * 2) {
      if (Math.round(world.verts[t + 3]) !== 0) continue;
      const p = [world.verts[t], world.verts[t + 1], world.verts[t + 2]];
      if ((p[0] - shim.eyeA[0]) ** 2 + (p[2] - shim.eyeA[2]) ** 2 > 50 * 50) continue;
      const pa = project(mul(persp(FOV_Y, A.w / A.h, 0.08, 14000), lookAt(shim.eyeA, shim.tgtA, [0, 1, 0])), p, A.w, A.h);
      const pb = project(mul(persp(FOV_Y, B.w / B.h, 0.08, 14000), lookAt(shim.eyeB, shim.tgtB, [0, 1, 0])), p, B.w, B.h);
      if (!pa || !pb || pa[0] < 2 || pb[0] < 2 || pa[1] < 2 || pb[1] < 2 || pa[0] >= A.w - 2 || pb[0] >= B.w - 2 || pa[1] >= A.h - 2 || pb[1] >= B.h - 2) continue;
      const ga = A.raw[((pa[1] | 0) * A.w + (pa[0] | 0)) * 3] / 255;
      const gb = B.raw[((pb[1] | 0) * B.w + (pb[0] | 0)) * 3] / 255;
      if (Math.abs(ga - gb) <= 0.1) continue;
      const qa = applyMat(ca.mats[0], p);
      const qb = applyMat(cb.mats[0], p);
      const du = Math.hypot(qa[0] - qb[0], qa[1] - qb[1]) * (ca.tiles[0] * 0.5);
      if (du > 0.5) mapFlip++;
      else recvFlip++;
    }
    shim.mapFlip = mapFlip;
    shim.receiverFlip = recvFlip;
    shim.mapFraction = n ? mapFlip / n : 0;
    shim.receiverFraction = n ? recvFlip / n : 0;
    const band = (eye, p) => {
      const dist = Math.hypot(p[0] - eye[0], p[2] - eye[2]);
      const t = Math.min(1, Math.max(0, (dist - 16) / 16));
      return t * t * (3 - 2 * t);
    };
    let bandSum = 0;
    let pixSum = 0;
    let bandFlips = 0;
    for (let t = 0; t < world.verts.length; t += 8 * 2) {
      if (Math.round(world.verts[t + 3]) !== 0) continue;
      const p = [world.verts[t], world.verts[t + 1], world.verts[t + 2]];
      if ((p[0] - shim.eyeA[0]) ** 2 + (p[2] - shim.eyeA[2]) ** 2 > 50 * 50) continue;
      const pa = project(mul(persp(FOV_Y, A.w / A.h, 0.08, 14000), lookAt(shim.eyeA, shim.tgtA, [0, 1, 0])), p, A.w, A.h);
      const pb = project(mul(persp(FOV_Y, B.w / B.h, 0.08, 14000), lookAt(shim.eyeB, shim.tgtB, [0, 1, 0])), p, B.w, B.h);
      if (!pa || !pb || pa[0] < 2 || pb[0] < 2 || pa[1] < 2 || pb[1] < 2 || pa[0] >= A.w - 2 || pb[0] >= B.w - 2 || pa[1] >= A.h - 2 || pb[1] >= B.h - 2) continue;
      const ga = A.raw[((pa[1] | 0) * A.w + (pa[0] | 0)) * 3] / 255;
      const gb = B.raw[((pb[1] | 0) * B.w + (pb[0] | 0)) * 3] / 255;
      if (Math.abs(ga - gb) <= 0.1) continue;
      const db = Math.abs(band(shim.eyeA, p) - band(shim.eyeB, p));
      bandSum += db;
      pixSum += Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
      if (db > 0.02) bandFlips++;
    }
    shim.flipScreenPx = recvFlip ? +(pixSum / recvFlip).toFixed(3) : 0;
    shim.flipBandDelta = recvFlip ? +(bandSum / recvFlip).toFixed(5) : 0;
    shim.bandFlips = bandFlips;
  }
  rows.push({ shimmer: shim });
  if (!(shim.fraction <= limits.edgeShimmerMax)) bad(`edge_shimmer ${shim.fraction}`);
  if (shim.worldFraction != null && !(shim.worldFraction <= limits.edgeShimmerMax)) bad(`world_shimmer ${shim.worldFraction}`);
  const vertPath = path.join(root, 'vert-shimmer.json');
  if (fs.existsSync(vertPath)) {
    const vert = JSON.parse(fs.readFileSync(vertPath, 'utf8'));
    rows.push({ vertShadow: vert });
    if (!(vert.unsnapped && vert.unsnapped.fraction > limits.edgeShimmerMax)) bad('unsnapped vertex fixture did not fail');
    if (!(vert.snapped && vert.snapped.fraction <= limits.edgeShimmerMax)) bad(`snapped vertex shimmer ${vert.snapped && vert.snapped.fraction}`);
    console.log('vertex', 'snapped', vert.snapped.fraction, 'unsnapped', vert.unsnapped.fraction, 'screen', shim.fraction);
  }
}
if (fs.existsSync(path.join(root, 'cross.json'))) {
  const cross = JSON.parse(fs.readFileSync(path.join(root, 'cross.json'), 'utf8'));
  rows.push({ cross });
  if (!(cross.de76 <= limits.crossCameraDe76Max)) bad(`cross-camera ${cross.de76}`);
}
const report = { limits: { csmIouMin: limits.csmIouMin, edgeShimmerMax: limits.edgeShimmerMax, cascadeSeamJumpMax: limits.cascadeSeamJumpMax, snowShadowBlueMin: limits.snowShadowBlueMin }, rows, verdict: fail ? 'FAIL' : 'PASS' };
fs.writeFileSync(path.join(root, 'csm-gate.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.verdict);
if (fail) process.exit(1);

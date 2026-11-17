// Path-snow shadow coverage. Limits live in coverage-limits.json and are not lowered here.
//   node coverage-gate.mjs --root <dir>
// A time is mask/t<tag>.png plus after/t<tag>-mat.png plus after/t<tag>.json.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { lookAt, persp, mul, FOV_Y } from '../engine/bricks/follow-cam.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const limits = JSON.parse(fs.readFileSync(path.join(here, 'coverage-limits.json'), 'utf8'));

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
function project(vp, p, W, H) {
  const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12];
  const y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
  const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
  if (!(w > 0)) return null;
  return [(x / w * 0.5 + 0.5) * W, (1 - (y / w * 0.5 + 0.5)) * H];
}
function boltDisc(info, W, H) {
  const vp = mul(persp(FOV_Y, W / H, 0.08, 14000), lookAt(info.eye, info.tgt, [0, 1, 0]));
  const paw = project(vp, [info.x, info.y, info.z], W, H);
  const head = project(vp, [info.x, info.y + 1.15, info.z], W, H);
  if (!paw || !head) return null;
  const cx = (paw[0] + head[0]) * 0.5;
  const cy = (paw[1] + head[1]) * 0.5;
  const hy = Math.abs(head[1] - paw[1]) * 0.55 + 8;
  const hx = hy * 0.42;
  return { cx, cy, hx, hy };
}

const root = arg('--root');
if (!root) {
  console.error('usage: node coverage-gate.mjs --root <dir>');
  process.exit(2);
}
if (limits.shadowFracMin !== 0.15 || limits.shadowFracMax !== 0.85) {
  console.error('FAIL coverage limits moved');
  process.exit(1);
}
const tags = JSON.parse(fs.readFileSync(path.join(root, 'tags.json'), 'utf8'));
let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };
const rows = [];
for (const tag of tags) {
  const mat = load(path.join(root, 'after', `t${tag}-mat.png`));
  const shadow = load(path.join(root, 'mask', `t${tag}.png`));
  const info = JSON.parse(fs.readFileSync(path.join(root, 'after', `t${tag}.json`), 'utf8'));
  if (mat.w !== limits.frame[0] || mat.h !== limits.frame[1]) bad(`frame ${tag} ${mat.w}x${mat.h}`);
  const bolt = boltDisc(info, mat.w, mat.h);
  const y0 = Math.floor(limits.path.minRowFrac * mat.h);
  let n = 0;
  let shaded = 0;
  for (let y = y0; y < mat.h; y++) {
    for (let x = 0; x < mat.w; x++) {
      const o = (y * mat.w + x) * 3;
      if (Math.round(mat.raw[o] / 255 * 8 - 0.5) !== limits.path.mat) continue;
      if (mat.raw[o + 2] / 255 < limits.path.minNy) continue;
      if (bolt) {
        const dx = (x - bolt.cx) / bolt.hx;
        const dy = (y - bolt.cy) / bolt.hy;
        if (dx * dx + dy * dy <= 1) continue;
      }
      n++;
      if (shadow.raw[o] / 255 < limits.path.shadowBelow) shaded++;
    }
  }
  const frac = n ? shaded / n : 1;
  if (n < limits.minSamples) bad(`path samples ${tag} ${n}`);
  if (frac >= limits.shadowFracMax) bad(`path shadow ${tag} ${frac.toFixed(3)} >= ${limits.shadowFracMax}`);
  if (frac < limits.shadowFracMin) bad(`path shadow ${tag} ${frac.toFixed(3)} < ${limits.shadowFracMin}`);
  rows.push({ tag, n, shaded, frac: +frac.toFixed(4) });
  console.log(tag, 'pathShadow', frac.toFixed(3), 'n', n);
}
const report = {
  limits: { shadowFracMin: limits.shadowFracMin, shadowFracMax: limits.shadowFracMax },
  rows,
  verdict: fail ? 'FAIL' : 'PASS',
};
const out = path.join(root, 'coverage-gate.json');
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(report.verdict);
if (fail) process.exit(1);

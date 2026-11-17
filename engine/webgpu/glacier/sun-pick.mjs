// Pick a dawn sun inside sun-criterion.json. Coverage and the 24 s terminator
// are the only scores. This file does not read the tone-map or IoU gates.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { lookAt, persp, mul, FOV_Y } from '../engine/bricks/follow-cam.js';
import { buildCascades, applyMat } from './shadows.js';
import { buildWorld, floorHalf, pathX } from './world.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const rule = JSON.parse(fs.readFileSync(path.join(here, 'sun-criterion.json'), 'utf8'));
const fixture = path.join(here, 'artifacts/run33-csm/r2-fixture');
const tags = JSON.parse(fs.readFileSync(path.join(fixture, 'tags.json'), 'utf8'));
const poses = Object.fromEntries(tags.map((tag) => [tag, JSON.parse(fs.readFileSync(path.join(fixture, 'after', `t${tag}.json`), 'utf8'))]));
const world = buildWorld();
const SPIRE = new Set([1, 2, 3, 6, 7]);
const W = 720;
const H = 1280;

function project(vp, p) {
  const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12];
  const y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
  const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
  if (!(w > 0)) return null;
  return [(x / w * 0.5 + 0.5) * W, (1 - (y / w * 0.5 + 0.5)) * H];
}
function dirOf(elDeg, azDeg) {
  const el = elDeg * Math.PI / 180;
  const az = azDeg * Math.PI / 180;
  return [Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)];
}
function buildOcc(sun, eye, tgt) {
  const casc = buildCascades({ eye, tgt, fovY: FOV_Y, aspect: W / H, sun, tier: 'phone' });
  const S = 256;
  const depth = [new Float32Array(S * S).fill(1), new Float32Array(S * S).fill(1)];
  const verts = world.verts;
  function rast(buf, tri) {
    const xs = tri.map((v) => v[0]);
    const ys = tri.map((v) => v[1]);
    if (Math.max(...xs) < 0 || Math.min(...xs) > S || Math.max(...ys) < 0 || Math.min(...ys) > S) return;
    const minX = Math.max(0, Math.floor(Math.min(...xs)));
    const maxX = Math.min(S - 1, Math.ceil(Math.max(...xs)));
    const minY = Math.max(0, Math.floor(Math.min(...ys)));
    const maxY = Math.min(S - 1, Math.ceil(Math.max(...ys)));
    if (maxX - minX > S * 0.85 && maxY - minY > S * 0.85) return;
    const [a, b, c] = tri;
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    if (Math.abs(area) < 1e-4) return;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const w0 = ((b[0] - px) * (c[1] - py) - (c[0] - px) * (b[1] - py)) / area;
        const w1 = ((c[0] - px) * (a[1] - py) - (a[0] - px) * (c[1] - py)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < -0.02 || w1 < -0.02 || w2 < -0.02) continue;
        const z = w0 * a[2] + w1 * b[2] + w2 * c[2];
        if (z < 0 || z > 1) continue;
        const i = y * S + x;
        if (z < buf[i]) buf[i] = z;
      }
    }
  }
  for (let t = 0; t + 24 <= verts.length; t += 24) {
    if (!SPIRE.has(Math.round(verts[t + 3]))) continue;
    const tri = [0, 8, 16].map((k) => [verts[t + k], verts[t + k + 1], verts[t + k + 2]]);
    const mx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
    const mz = (tri[0][2] + tri[1][2] + tri[2][2]) / 3;
    if ((mx - eye[0]) ** 2 + (mz - eye[2]) ** 2 > 180 * 180) continue;
    for (let ci = 0; ci < 2; ci++) {
      const q = tri.map((v) => applyMat(casc.mats[ci], v));
      rast(depth[ci], q.map((v) => [(v[0] * 0.5 + 0.5) * S, (0.5 - v[1] * 0.5) * S, v[2]]));
    }
  }
  function blocked(p) {
    for (let ci = 0; ci < 2; ci++) {
      const q = applyMat(casc.mats[ci], p);
      const e = Math.max(Math.abs(q[0]), Math.abs(q[1]));
      if (e >= 0.98 || q[2] < 0 || q[2] > 1) continue;
      const x = Math.max(0, Math.min(S - 1, (q[0] * 0.5 + 0.5) * S | 0));
      const y = Math.max(0, Math.min(S - 1, (0.5 - q[1] * 0.5) * S | 0));
      if (depth[ci][y * S + x] + 0.008 < q[2]) return true;
    }
    return false;
  }
  return blocked;
}

function score(sun) {
  const rows = {};
  let term = null;
  for (const tag of tags) {
    const info = poses[tag];
    const eye = info.eye;
    const tgt = info.tgt;
    const vp = mul(persp(FOV_Y, W / H, 0.08, 14000), lookAt(eye, tgt, [0, 1, 0]));
    const blocked = buildOcc(sun, eye, tgt);
    let n = 0;
    let shaded = 0;
    let slope = 0;
    let litOpen = 0;
    let dark = 0;
    const verts = world.verts;
    for (let t = 0; t < verts.length; t += 8 * 6) {
      if (Math.round(verts[t + 3]) !== 0) continue;
      const p = [verts[t], verts[t + 1], verts[t + 2]];
      const ny = verts[t + 5];
      const lat = Math.abs(p[0] - pathX(p[2]));
      if (lat > floorHalf(p[2]) * 0.75) continue;
      const dx = p[0] - eye[0];
      const dz = p[2] - eye[2];
      if (dx * dx + dz * dz > 80 * 80) continue;
      if ((p[0] - info.x) ** 2 + (p[2] - info.z) ** 2 < 1.4 * 1.4) continue;
      const scr = project(vp, p);
      if (!scr || scr[0] < 4 || scr[1] < 4 || scr[0] >= W - 4 || scr[1] >= H - 4) continue;
      const ndl = Math.max(0, verts[t + 4] * sun[0] + ny * sun[1] + verts[t + 6] * sun[2]);
      const occ = blocked(p);
      if (ny >= 0.55 && scr[1] / H >= 0.4) {
        n++;
        if (occ) shaded++;
      }
      if (tag === rule.terminator.tag && ny < rule.terminator.slopeNyMax && ny >= 0.2 && scr[1] / H >= 0.28) {
        slope++;
        if (ndl >= rule.terminator.litNdl && !occ) litOpen++;
        if (ndl < rule.terminator.darkNdl) dark++;
      }
    }
    const frac = n ? shaded / n : 1;
    rows[tag] = { n, frac };
    if (tag === rule.terminator.tag) {
      term = {
        slope,
        litOpen: slope ? litOpen / slope : 0,
        dark: slope ? dark / slope : 0,
      };
    }
  }
  const fracs = tags.map((tag) => rows[tag].frac);
  const mean = fracs.reduce((s, v) => s + v, 0) / fracs.length;
  const coverage = fracs.every((f) => f >= rule.coverage.min && f < rule.coverage.max) && tags.every((tag) => rows[tag].n >= 200);
  const terminator = term && term.slope >= 40 && term.litOpen >= rule.terminator.minLitUnoccluded && term.dark >= rule.terminator.minDarkShare;
  return { rows, mean, coverage, terminator, term };
}

const found = [];
for (const el of rule.box.elevationDeg) {
  for (const az of rule.box.azimuthFromMinusZDeg) {
    const sun = dirOf(el, az);
    const s = score(sun);
    const line = tags.map((tag) => `${tag}:${s.rows[tag].frac.toFixed(2)}`).join(' ');
    console.log(`el ${el} az ${az} mean ${s.mean.toFixed(3)} cover ${s.coverage ? 'Y' : 'n'} term ${s.terminator ? 'Y' : 'n'} ${line} slope ${s.term.slope} lit ${s.term.litOpen.toFixed(2)} dark ${s.term.dark.toFixed(2)}`);
    if (s.coverage && s.terminator) found.push({ el, az, sun, mean: s.mean });
  }
}
if (!found.length) {
  console.log('NONE in the box pass coverage and the terminator');
  process.exit(2);
}
found.sort((a, b) => Math.abs(a.mean - rule.targetShadowFrac) - Math.abs(b.mean - rule.targetShadowFrac));
const pick = found[0];
console.log('PICK', JSON.stringify({
  elevationDeg: pick.el,
  azimuthFromMinusZDeg: pick.az,
  direction: pick.sun.map((v) => +v.toFixed(4)),
  meanShadow: +pick.mean.toFixed(4),
}));

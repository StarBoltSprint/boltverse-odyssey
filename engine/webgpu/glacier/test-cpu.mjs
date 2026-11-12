// CPU gates: budget, organic mesh, authored ice colour, sky anchor math, Bolt card.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DE76_MAX } from '../biome-factory/cie76.mjs';
import { shadeAt, norm3 } from '../biome-factory/light-rig.js';
import { skyLinear, skyDelta, dirFrom } from '../biome-factory/procedural-sky.js';
import { followEye, lookAt, persp, mul, FOV_Y } from '../engine/bricks/follow-cam.js';
import { invertMat4 } from '../biome-factory/mat4.js';
import { boltIdle } from '../bricks/bolt-idle.js';
import { ICE, litIce } from './albedo.js';
import { LIGHT, LIMITS, GLACIER, DRAWS } from './biome.js';
import { buildWorld, wallHeight, floorH, pathX, wallPoint, spawn, integrate, chaseInput, routeSmooth } from './world.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };

if (DE76_MAX !== 10) bad('CIE76 limit moved ' + DE76_MAX);
if (LIMITS.tris !== 200000 || LIMITS.draws !== 12) bad('budget limit moved');

for (const f of ['world.js', 'glacier.js', 'albedo.js']) {
  const text = fs.readFileSync(path.join(here, f), 'utf8');
  if (/\.box\s*\(|boxBevel|chipBlock|hexPrism/.test(text)) bad(f + ' uses a box primitive');
}
const shader = fs.readFileSync(path.join(here, 'glacier.js'), 'utf8');
if (/u\.fog|hazeAmt|fogDist/.test(shader)) bad('fog wall in the shader');

const world = buildWorld();
const span = world.extentZ[1] - world.extentZ[0];
if (span < 3000) bad('rift shorter than 3 km ' + span);
if (world.budget.totalTris > LIMITS.tris) bad('tris ' + world.budget.totalTris);
if (world.budget.draws > LIMITS.draws) bad('draws ' + world.budget.draws);
if (world.budget.draws !== DRAWS.length) bad('draw list mismatch');
if (!world.budget.drawNames.includes('icicle') || !world.budget.drawNames.includes('drift')) bad('missing instanced props');

const zs = [];
for (let z = GLACIER.z0; z >= GLACIER.z1; z -= 40) zs.push(z);
let hi = 0;
let lo = 1e9;
for (const z of zs) {
  for (const side of [-1, 1]) {
    const h = wallHeight(z, side);
    hi = Math.max(hi, h);
    lo = Math.min(lo, h);
    if (h < 60 || h > 200) bad('wall height out of 60-200 ' + h.toFixed(1) + ' at ' + z);
  }
}
if (hi < 180) bad('no tall wall ' + hi.toFixed(1));
if (lo > 100) bad('no low wall ' + lo.toFixed(1));

const verts = world.verts;
const wallZ = [];
for (let i = 3; i < verts.length; i += 8) if (Math.round(verts[i]) === 6) wallZ.push(verts[i - 1]);
wallZ.sort((a, b) => a - b);
let gap = 0;
for (let i = 1; i < wallZ.length; i++) gap = Math.max(gap, wallZ[i] - wallZ[i - 1]);
if (gap > 40) bad('wall gap ' + gap.toFixed(1) + ' m');
if (wallZ[0] > GLACIER.z1 + 30 || wallZ[wallZ.length - 1] < GLACIER.z0 - 30) bad('walls do not span the rift');

let detail = 0;
let nDet = 0;
for (let z = -10; z > -80; z -= 2) {
  const a = floorH(pathX(z), z);
  const b = floorH(pathX(z - 2), z - 2);
  detail += (a - b) ** 2;
  nDet++;
}
const rms = Math.sqrt(detail / nDet);
if (rms < 0.08) bad('ground relief under 2 m is flat ' + rms.toFixed(3));

const card = boltIdle().cfg;
if (card.cardH !== 1.15) bad('bolt card height is not the live 1.15 m');
if (Math.abs(card.cardW - 1.15 * 224 / 652) > 1e-9) bad('bolt card width drifted');

const sun = norm3(LIGHT.sun.direction);
const full = shadeAt(LIGHT, 1, 0).rgb;
for (const [name, alb] of Object.entries(ICE)) {
  if (!Array.isArray(alb)) continue;
  const prod = alb.map((a, i) => a * (LIGHT.ambient.rgb[i] + LIGHT.sun.rgb[i] * LIGHT.sun.intensity));
  if (Math.max(...prod) >= 0.96) bad(name + ' clips under full sun ' + prod.map((v) => v.toFixed(3)).join(','));
}
const blue = ICE.wallBlue.map((a, i) => a * full[i]);
if (!(blue[2] > blue[0] + 0.05)) bad('sunlit blue strata is not blue ' + blue.map((v) => v.toFixed(3)).join(','));
const n = [1, 0, 0];
const view = [1, 0, 0];
const lit = litIce(ICE.wallPale, n, view, LIGHT);
const irr = shadeAt(LIGHT, Math.max(0, sun[0]), 0).rgb;
for (let i = 0; i < 3; i++) if (Math.abs(lit[i] - ICE.wallPale[i] * irr[i]) > 1e-6) bad('front face gained specular');

let skyMax = 0;
for (let e = -10; e <= 90; e += 5) {
  for (let y = 0; y < 12; y++) {
    const c = skyLinear(dirFrom(e, y), LIGHT.sky);
    skyMax = Math.max(skyMax, c[0], c[1], c[2]);
  }
}
if (skyMax > 0.98) bad('sky clips ' + skyMax.toFixed(3));
const cameras = [[0, 2, 0], [40, 30, -80], [-20, 8, 400]];
for (const dir of [dirFrom(30, 0.4), dirFrom(55, 2.2), [0, 1, 0]]) {
  const cols = cameras.map((cam) => skyLinear(dir, LIGHT.sky));
  for (let i = 1; i < cols.length; i++) {
    const d = skyDelta(cols[0], cols[i]);
    if (d > 0) bad('sky depends on camera in the CPU function');
  }
}
const screen = (dir, yaw) => skyLinear(dir, LIGHT.sky).map((v, i) => v + 0.05 * Math.sin(yaw + i));
const dScreen = skyDelta(screen(dirFrom(40, 0.2), 0), screen(dirFrom(40, 0.2), 1.2));
if (!(dScreen > 0.015)) bad('screen-space sky control did not separate');

const eye = [0, 2, 0];
const tgt = [0, 2, -10];
const vp = mul(persp(FOV_Y, 720 / 1280, 0.08, 14000), lookAt(eye, tgt, [0, 1, 0]));
const inv = invertMat4(vp);
const ident = mul(inv, vp);
for (let i = 0; i < 16; i++) {
  const want = i % 5 === 0 ? 1 : 0;
  if (Math.abs(ident[i] - want) > 1e-4) bad('view inverse off at ' + i + ' ' + ident[i]);
}

const p = wallPoint(-30, -1, 0.4);
if (!(p[1] > floorH(p[0], p[2]))) bad('wall point is underground');

// The body column and the ray from the eye to the chest must stay above the
// snow. A ridge through the lane shows up as metres of penetration.
const idle = boltIdle();
const live = spawn();
let maxPen = 0;
let maxPenT = 0;
const dt = 1 / 30;
for (let i = 0; i < 1350; i++) {
  const t = i * dt;
  idle.stepMotion(live, dt, true);
  integrate(live, dt, chaseInput(t, live));
  const yaw = live.psi;
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rx = -fz;
  const rz = fx;
  const y0 = world.heightAt(live.x, live.z);
  let pen = 0;
  for (const s of [-0.2, 0, 0.2]) {
    for (const f of [-0.4, -0.15, 0.1, 0.35]) {
      const z = live.z + rz * s + fz * f;
      const h = world.heightAt(live.x + rx * s + fx * f, z);
      pen = Math.max(pen, h - routeSmooth(z));
    }
  }
  const bp = [live.x, y0, live.z];
  const cam = followEye(bp, live.cam, world.heightAt, 0);
  const chest = [live.x, y0 + 0.55, live.z];
  for (const u of [0.3, 0.5, 0.7]) {
    const x = cam.eye[0] + (chest[0] - cam.eye[0]) * u;
    const y = cam.eye[1] + (chest[1] - cam.eye[1]) * u;
    const z = cam.eye[2] + (chest[2] - cam.eye[2]) * u;
    pen = Math.max(pen, world.heightAt(x, z) - y);
  }
  if (pen > maxPen) { maxPen = pen; maxPenT = t; }
}
if (maxPen > 0.02) bad('body occluded by terrain ' + maxPen.toFixed(3) + ' m at t ' + maxPenT.toFixed(1));

if (fail) process.exit(1);
console.log('PASS cpu', JSON.stringify({
  tris: world.budget.totalTris,
  worldTris: world.budget.worldTris,
  icicleTris: world.budget.icicleTris,
  driftTris: world.budget.driftTris,
  draws: world.budget.draws,
  drawNames: world.budget.drawNames,
  spanM: span,
  wallM: [+lo.toFixed(1), +hi.toFixed(1)],
  wallGapM: +gap.toFixed(2),
  groundRmsM: +rms.toFixed(3),
  bodyPenM: +maxPen.toFixed(4),
  bodyPenT: +maxPenT.toFixed(1),
  cardH: card.cardH,
  skyMax: +skyMax.toFixed(3),
  de76: DE76_MAX,
}));

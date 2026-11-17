// Motion-compensated flicker fixtures. These run before the metric is used
// on a cook.
//   static camera, identical frames → about 0
//   pure camera translation, world-locked texture → about 0
//   the same translation with a screen-space shimmer → high, so it FAILs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { lookAt, persp, mul } from '../engine/bricks/follow-cam.js';
import { invertMat4 } from '../biome-factory/mat4.js';
import { bufferResidual } from './motion-flicker.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'fixtures/motion');
fs.mkdirSync(outDir, { recursive: true });

const W = 180;
const H = 320;
const FOV = 62 * Math.PI / 180;

function camera(eye, tgt) {
  const view = lookAt(eye, tgt, [0, 1, 0]);
  const proj = persp(FOV, W / H, 0.08, 400);
  const vp = mul(proj, view);
  return { eye, vp, ivp: invertMat4(vp) };
}

function ray(ivp, cam, x, y) {
  const ndcX = ((x + 0.5) / W) * 2 - 1;
  const ndcY = 1 - ((y + 0.5) / H) * 2;
  const hit = (z) => {
    const X = ivp[0] * ndcX + ivp[4] * ndcY + ivp[8] * z + ivp[12];
    const Y = ivp[1] * ndcX + ivp[5] * ndcY + ivp[9] * z + ivp[13];
    const Z = ivp[2] * ndcX + ivp[6] * ndcY + ivp[10] * z + ivp[14];
    const Ww = ivp[3] * ndcX + ivp[7] * ndcY + ivp[11] * z + ivp[15];
    return [X / Ww, Y / Ww, Z / Ww];
  };
  const far = hit(1);
  let dx = far[0] - cam[0];
  let dy = far[1] - cam[1];
  let dz = far[2] - cam[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  return { origin: cam, dir: [dx / len, dy / len, dz / len] };
}

// A flat wall at z = -40. The colour is a function of the wall's own x and y.
function paint(cam, shimmer) {
  const luma = new Float32Array(W * H);
  const depth = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = ray(cam.ivp, cam.eye, x, y);
      if (Math.abs(r.dir[2]) < 1e-6) continue;
      const t = (-40 - r.origin[2]) / r.dir[2];
      if (!(t > 0.2)) continue;
      const wx = r.origin[0] + r.dir[0] * t;
      const wy = r.origin[1] + r.dir[1] * t;
      if (Math.abs(wx) > 18 || Math.abs(wy - 2) > 14) continue;
      let v = 90 + 36 * Math.sin(wx * 0.08) + 18 * Math.sin(wy * 0.11);
      if (shimmer) v += 22 * Math.sin(x * 0.85 + y * 0.37);
      luma[y * W + x] = v;
      depth[y * W + x] = t;
    }
  }
  return { luma, depth };
}

const camA = camera([0, 2, 0], [0, 2, -40]);
const camB = camera([0.35, 2.02, -0.12], [0.35, 2.02, -40]);
const still = paint(camA, false);
const moved = paint(camB, false);
const noisy = paint(camB, true);

function pack(cam, img) {
  return {
    W, H, lumaA: still.luma, lumaB: img.luma, depthA: still.depth, depthB: img.depth,
    ivpB: cam.ivp, vpA: camA.vp, camA: camA.eye, camB: cam.eye,
  };
}

const staticRes = bufferResidual(pack(camA, still));
const slideRes = bufferResidual(pack(camB, moved));
const shimmerRes = bufferResidual(pack(camB, noisy));

const report = {
  static: staticRes,
  translation: slideRes,
  screenShimmer: shimmerRes,
};
fs.writeFileSync(path.join(outDir, 'cpu.json'), JSON.stringify(report, null, 2) + '\n');

let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };
if (!(staticRes.n > 1000)) bad('static sample is empty ' + staticRes.n);
if (!(staticRes.mean < 0.05)) bad('static camera residual ' + staticRes.mean);
if (!(slideRes.n > 1000)) bad('translation sample is empty ' + slideRes.n);
if (!(slideRes.mean < 0.35)) bad('pure translation residual ' + slideRes.mean);
if (!(shimmerRes.mean > 4)) bad('screen shimmer did not fail ' + shimmerRes.mean);
if (!(shimmerRes.mean > slideRes.mean * 8)) bad('shimmer is not clearly above the slide');

const gpuPath = path.join(outDir, 'gpu-shimmer.json');
const staticGpuPath = path.join(outDir, 'gpu-static.json');
if (fs.existsSync(gpuPath)) {
  const gpu = JSON.parse(fs.readFileSync(gpuPath, 'utf8'));
  const basePath = path.join(outDir, 'run31.json');
  let half = 1.5;
  if (fs.existsSync(basePath)) {
    const base = JSON.parse(fs.readFileSync(basePath, 'utf8'));
    const row = (base.rows || []).find((r) => Math.abs(r.t - gpu.t) < 0.05) || base.rows[0];
    half = row.flickerMotion / 2;
  }
  if (!(gpu.motion > half)) bad('run 31 mip bias -2 did not fail the motion bar ' + gpu.motion + ' vs ' + half);
  console.log('gpu fixture', JSON.stringify(gpu), 'half', half);
} else {
  console.log('gpu fixture not rendered yet');
}
if (fs.existsSync(staticGpuPath)) {
  const still = JSON.parse(fs.readFileSync(staticGpuPath, 'utf8'));
  if (!(still.motion < 0.15)) bad('gpu static camera residual ' + still.motion);
  console.log('gpu static', JSON.stringify(still));
} else {
  console.log('gpu static not rendered yet');
}

console.log(JSON.stringify(report));
if (fail) {
  console.error('FAIL motion-flicker', fail);
  process.exit(1);
}
console.log('PASS motion-flicker');

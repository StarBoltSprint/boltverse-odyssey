// Measured proof for the 45 s chase. Reads /tmp/glacier-45 (frames + telem.ndjson).
// Does not change a gate limit.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { terrH } from './world.js';

const dir = process.argv[2] || '/tmp/glacier-45';
const outDir = process.argv[3] || '/opt/cursor/artifacts';
const W = 720;
const H = 1280;
const FPS = 30;

function load(file, pix) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', pix, 'pipe:'], {
    encoding: 'buffer',
    maxBuffer: 8 * 1024 * 1024,
  });
  if (!r.stdout || r.stdout.length < W * H * 3) throw new Error('short read ' + file);
  return r.stdout;
}

const telem = fs.readFileSync(path.join(dir, 'telem.ndjson'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
if (telem.length < 2) throw new Error('telemetry short');

function hypot3(a, b) {
  const d0 = a[0] - b[0];
  const d1 = a[1] - b[1];
  const d2 = a[2] - b[2];
  return Math.hypot(d0, d1, d2);
}

const perSecond = [];
for (let s = 0; s < Math.floor((telem.length - 1) / FPS); s++) {
  const a = telem[s * FPS];
  const b = telem[Math.min(telem.length - 1, (s + 1) * FPS)];
  const bolt = Math.hypot(b.x - a.x, b.z - a.z);
  const cam = a.eye && b.eye ? hypot3(a.eye, b.eye) : null;
  const dyaw = (b.cam - a.cam) * 180 / Math.PI;
  perSecond.push({
    s,
    boltM: +bolt.toFixed(3),
    camM: cam === null ? null : +cam.toFixed(3),
    dyawDeg: +dyaw.toFixed(3),
    v: +b.v.toFixed(3),
  });
}

let travel = 0;
let cycles = 0;
for (let i = 1; i < telem.length; i++) {
  travel += Math.hypot(telem[i].x - telem[i - 1].x, telem[i].z - telem[i - 1].z);
  const dt = telem[i].t - telem[i - 1].t;
  cycles += dt * 1.95 * (telem[i].v / 7);
}
const mPerCycle = travel / cycles;
let meshAbove = 0;
let meshBelow = 0;
for (const row of telem) {
  const fn = terrH(row.x, row.z);
  meshAbove = Math.max(meshAbove, row.y - fn);
  meshBelow = Math.max(meshBelow, fn - row.y);
}

// Landmarks the camera passes (dog z, moving negative).
const marks = [
  { name: 'arch', z: -24 },
  { name: 'waterfall', z: -40 },
  { name: 'arch', z: -70 },
  { name: 'waterfall', z: -110 },
  { name: 'arch', z: -160 },
  { name: 'waterfall', z: -260 },
];
const seen = marks.map((m) => {
  const hit = telem.find((r) => r.z <= m.z);
  return { ...m, t: hit ? +hit.t.toFixed(2) : null, frame: hit ? hit.i : null };
});

// Paw gap and motion metrics. Decode every frame once.
let maxGap = -1e9;
let minGap = 1e9;
let gapAt = null;
const gaps = [];
const diffs = [];
let prevSmall = null;
let prevRgb = null;
let flickerSum = 0;
let flickerN = 0;
let flickerHp = 0;
let flickerHpN = 0;
let wallN = 0;

function lumaAt(rgb, x, y) {
  const i = (y * W + x) * 3;
  return rgb[i] * 0.2126 + rgb[i + 1] * 0.7152 + rgb[i + 2] * 0.0722;
}

// Left ice, below the sky notch. Confirmed on frame 0 of the chase.
const WALL = { x0: 8, x1: 70, y0: 300, y1: 640 };

for (let i = 0; i < telem.length; i++) {
  const id = String(telem[i].i).padStart(4, '0');
  const rgb = load(path.join(dir, `f_${id}.png`), 'rgb24');
  const mask = load(path.join(dir, `m_${id}.png`), 'rgba');
  const groundY = telem[i].boltPx[1];
  let tip = -1;
  for (let y = H - 1; y >= 700; y--) {
    const row = y * W;
    for (let x = 260; x < 470; x++) {
      const k = (row + x) * 4;
      const lum = mask[k] * 0.3 + mask[k + 1] * 0.59 + mask[k + 2] * 0.11;
      if (lum >= 12) { tip = y; break; }
    }
    if (tip >= 0) break;
  }
  const gap = tip < 0 ? null : groundY - tip;
  if (gap !== null) {
    gaps.push(+gap.toFixed(2));
    if (gap > maxGap) { maxGap = gap; gapAt = { frame: telem[i].i, t: telem[i].t, gap: +gap.toFixed(2), groundY: +groundY.toFixed(1), tip, z: +telem[i].z.toFixed(1) }; }
    if (gap < minGap) minGap = gap;
  }

  // Downsample 8x for the pop check. Skip the Bolt card.
  const sw = W / 8;
  const sh = H / 8;
  const small = new Float32Array(sw * sh);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      let s = 0;
      for (let dy = 0; dy < 8; dy++) {
        for (let dx = 0; dx < 8; dx++) s += lumaAt(rgb, x * 8 + dx, y * 8 + dy);
      }
      small[y * sw + x] = s / 64;
    }
  }
  if (prevSmall) {
    let d = 0;
    let n = 0;
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        if (x >= 32 && x <= 58 && y >= 100) continue;
        const k = y * sw + x;
        d += Math.abs(small[k] - prevSmall[k]);
        n++;
      }
    }
    diffs.push({ frame: telem[i].i, mad: d / n });
  }
  prevSmall = small;

  if (prevRgb) {
    const prev = prevRgb;
    let acc = 0;
    let hp = 0;
    let n = 0;
    for (let y = WALL.y0; y < WALL.y1; y += 2) {
      for (let x = WALL.x0; x < WALL.x1; x += 2) {
        const a = lumaAt(rgb, x, y);
        const b = lumaAt(prev, x, y);
        const dl = a - b;
        acc += Math.abs(dl);
        // High pass against a 4-pixel neighbourhood so a sliding edge is not counted as shimmer.
        let nb = 0;
        let nn = 0;
        for (const ox of [-4, 4]) {
          const p = lumaAt(prev, Math.max(0, Math.min(W - 1, x + ox)), y);
          const c = lumaAt(rgb, Math.max(0, Math.min(W - 1, x + ox)), y);
          nb += c - p;
          nn++;
        }
        hp += Math.abs(dl - nb / nn);
        n++;
      }
    }
    flickerSum += acc;
    flickerHp += hp;
    flickerN += n;
    flickerHpN += n;
    wallN++;
  }
  prevRgb = rgb;
  if (i % 100 === 0) console.log('proof frame', i, 'gap', gap === null ? 'na' : gap.toFixed(1));
}

diffs.sort((a, b) => b.mad - a.mad);
const madVals = diffs.map((d) => d.mad).sort((a, b) => a - b);
const medianMad = madVals[madVals.length >> 1];

const proof = {
  frames: telem.length,
  seconds: +((telem.length - 1) / FPS).toFixed(3),
  motion: {
    perSecond,
    minBoltM: Math.min(...perSecond.map((p) => p.boltM)),
    minCamM: Math.min(...perSecond.map((p) => p.camM)),
    maxAbsYawDegPerSec: Math.max(...perSecond.map((p) => Math.abs(p.dyawDeg))),
  },
  contact: {
    pawAlpha: 'luminance >= 12',
    gapPx: 'projected rendered-mesh row minus lowest paw pixel. Positive is air.',
    maxGapPx: +maxGap.toFixed(2),
    minGapPx: +minGap.toFixed(2),
    worst: gapAt,
    meshAboveFunctionM: +meshAbove.toFixed(3),
    meshBelowFunctionM: +meshBelow.toFixed(3),
  },
  stride: {
    strideHz: 1.95,
    speed: 7,
    designM: +(7 / 1.95).toFixed(3),
    travelM: +travel.toFixed(2),
    cycles: +cycles.toFixed(2),
    distancePerCycleM: +mPerCycle.toFixed(3),
  },
  pops: {
    medianMad: +medianMad.toFixed(3),
    top5: diffs.slice(0, 5).map((d) => ({ frame: d.frame, mad: +d.mad.toFixed(3), overMedian: +(d.mad / medianMad).toFixed(2) })),
  },
  walls: {
    region: WALL,
    meanAbsLuma: +(flickerSum / flickerN).toFixed(3),
    meanHighPassLuma: +(flickerHp / flickerHpN).toFixed(3),
    pairs: wallN,
  },
  route: seen,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'glacier-chase-45s-proof.json'), JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify({
  minCamM: proof.motion.minCamM,
  maxGapPx: proof.contact.maxGapPx,
  mPerCycle: proof.stride.distancePerCycleM,
  top: proof.pops.top5,
  flicker: proof.walls.meanHighPassLuma,
  route: seen,
}, null, 2));

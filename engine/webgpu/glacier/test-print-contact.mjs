// Blocking gates for the follow-frame crater and the planted-paw oval.
// The round-2 stills are the fixture and must FAIL. The pre-D card must PASS.
// Limits were set from those two sets and are not a knob.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const NAMES = ['t5_1.jpg', 't5_567.jpg', 't7_9.jpg', 't11_7.jpg', 't24.jpg', 't30.jpg'];
const W = 720;
const H = 1280;

// Bottom band of the follow frame, where the round-2 crater sits.
const BAND = { x0: 260, x1: 460, y0: 1088, y1: 1272 };
// A paw at that depth is about 48 px wide. A mark bigger than this is not a paw.
const PAW_PX = 48;
const BLOB_LIMIT = Math.round(PAW_PX * PAW_PX * 0.48);
const RING_LIMIT = 12;
// Soft oval under the paws on the pre-D 24 s still. Inside / ring luma.
const CONTACT = { cx: 360, cy: 1009, rx: 60, ry: 16, name: 't24.jpg' };
const PRE_D_RATIO = 0.829;
const CONTACT_TOL = 0.045;

function loadRgb(file) {
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { maxBuffer: 20 * 1024 * 1024 });
  if (raw.status !== 0) throw new Error('ffmpeg ' + file);
  return raw.stdout;
}
function luma(rgb, x, y) {
  const i = (y * W + x) * 3;
  return 0.2126 * rgb[i] + 0.7152 * rgb[i + 1] + 0.0722 * rgb[i + 2];
}

function printArtifact(rgb) {
  let rings = 0;
  const { x0, x1, y0, y1 } = BAND;
  for (let cy = y0 + 18; cy < y1 - 18; cy += 4) {
    for (let cx = x0 + 18; cx < x1 - 18; cx += 4) {
      let core = 0;
      let nc = 0;
      let rim = 0;
      let nr = 0;
      let lo = 255;
      let hi = 0;
      for (let dy = -14; dy <= 14; dy++) {
        for (let dx = -14; dx <= 14; dx++) {
          const r2 = dx * dx + dy * dy;
          const v = luma(rgb, cx + dx, cy + dy);
          if (v < lo) lo = v;
          if (v > hi) hi = v;
          if (r2 <= 25) { core += v; nc++; }
          else if (r2 >= 81 && r2 <= 196) { rim += v; nr++; }
        }
      }
      if (nc && nr && core / nc > rim / nr + 18 && hi - lo > 55) rings++;
    }
  }
  const dark = [];
  const mark = new Set();
  for (let y = y0; y < y1; y++) {
    const row = [];
    for (let x = x0; x < x1; x++) row.push(luma(rgb, x, y));
    const med = row.slice().sort((a, b) => a - b)[row.length >> 1];
    for (let x = x0; x < x1; x++) {
      if (luma(rgb, x, y) < med - 28) {
        dark.push([x, y]);
        mark.add(x + ',' + y);
      }
    }
  }
  const seen = new Set();
  let blob = 0;
  for (const [sx, sy] of dark) {
    const key = sx + ',' + sy;
    if (seen.has(key)) continue;
    const stack = [[sx, sy]];
    seen.add(key);
    let n = 0;
    while (stack.length) {
      const [x, y] = stack.pop();
      n++;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const q = (x + dx) + ',' + (y + dy);
        if (mark.has(q) && !seen.has(q)) { seen.add(q); stack.push([x + dx, y + dy]); }
      }
    }
    if (n > blob) blob = n;
  }
  const fail = rings > RING_LIMIT || blob > BLOB_LIMIT;
  return { rings, blob, pawPx: PAW_PX, blobLimit: BLOB_LIMIT, ringLimit: RING_LIMIT, verdict: fail ? 'FAIL' : 'PASS' };
}

function contactRatio(rgb) {
  const { cx, cy, rx, ry } = CONTACT;
  const inn = [];
  const out = [];
  for (let y = cy - ry * 3; y <= cy + ry * 3; y++) {
    for (let x = cx - rx * 3; x <= cx + rx * 3; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const e = nx * nx + ny * ny;
      const v = luma(rgb, x, y);
      if (v < 80) continue;
      if (e <= 1) inn.push(v);
      else if (e >= 1.8 && e <= 3.2) out.push(v);
    }
  }
  const ratio = (inn.reduce((s, v) => s + v, 0) / inn.length) / (out.reduce((s, v) => s + v, 0) / out.length);
  const lo = PRE_D_RATIO - CONTACT_TOL;
  const hi = PRE_D_RATIO + CONTACT_TOL;
  return {
    ratio: +ratio.toFixed(3),
    pixels: inn.length,
    preD: PRE_D_RATIO,
    tol: CONTACT_TOL,
    verdict: ratio >= lo && ratio <= hi ? 'PASS' : 'FAIL',
  };
}

function scoreDir(dir) {
  const prints = [];
  for (const name of NAMES) {
    const rgb = loadRgb(path.join(dir, name));
    prints.push({ name, ...printArtifact(rgb) });
  }
  const t24 = loadRgb(path.join(dir, CONTACT.name));
  const contact = contactRatio(t24);
  const printFail = prints.some((r) => r.verdict === 'FAIL');
  return {
    prints,
    contact,
    verdict: printFail || contact.verdict === 'FAIL' ? 'FAIL' : 'PASS',
  };
}

const mode = process.argv[2] || 'controls';
const fixtureDir = path.join(here, 'artifacts/run32/crater-fixture');
const preDir = path.join(here, 'artifacts/run32/pre-d');

if (mode === 'controls') {
  const fixture = scoreDir(fixtureDir);
  const pred = scoreDir(preDir);
  const report = {
    blobLimit: BLOB_LIMIT,
    ringLimit: RING_LIMIT,
    pawPx: PAW_PX,
    contact: { ...CONTACT, preD: PRE_D_RATIO, tol: CONTACT_TOL },
    fixture,
    preD: pred,
  };
  fs.writeFileSync(path.join(here, 'artifacts/run32/print-contact-controls.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (fixture.verdict !== 'FAIL') {
    console.error('FAIL negative control: round-2 crater fixture did not fail');
    process.exit(1);
  }
  if (pred.verdict !== 'PASS') {
    console.error('FAIL pre-D card did not pass print/contact');
    process.exit(1);
  }
  console.log('PASS print-contact controls (fixture FAIL, pre-D PASS)');
} else if (mode === 'dir') {
  const report = scoreDir(process.argv[3]);
  console.log(JSON.stringify(report, null, 2));
  if (report.verdict !== 'PASS') process.exit(1);
  console.log('PASS print-contact');
} else {
  console.error('usage: test-print-contact.mjs [controls|dir <path>]');
  process.exit(2);
}

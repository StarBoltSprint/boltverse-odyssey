// A print may darken the Imagine snow. It may not grow a bright lobe,
// and the grain inside it has to stay. The round-3 24 s crop is the fixture
// and must fail. Limits are the brief, not a knob.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const MEAN_LO = 0.85;
const MEAN_HI = 1.0;
const HF_MIN = 0.6;

function loadRgb(file) {
  const info = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const [w, h] = info.stdout.trim().split(',').map((n) => parseInt(n, 10));
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { maxBuffer: 20 * 1024 * 1024 });
  if (raw.status !== 0) throw new Error('ffmpeg ' + file);
  return { rgb: raw.stdout, w, h };
}
function luma(rgb, w, x, y) {
  const i = (y * w + x) * 3;
  return 0.2126 * rgb[i] + 0.7152 * rgb[i + 1] + 0.0722 * rgb[i + 2];
}

function printsIn(rgb, w, h) {
  const full = h >= 1000;
  const x0 = full ? 280 : 16;
  const x1 = full ? 540 : w - 16;
  const y0 = full ? 1088 : 16;
  const y1 = full ? Math.min(h - 8, 1268) : h - 16;
  const Y = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? null : luma(rgb, w, x, y);
  const blur = new Map();
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      let s = 0; let n = 0;
      for (let dy = -28; dy <= 28; dy += 7) {
        for (let dx = -28; dx <= 28; dx += 7) {
          const v = Y(x + dx, y + dy);
          if (v == null) continue;
          s += v; n++;
        }
      }
      blur.set(x + ',' + y, s / n);
    }
  }
  const mark = new Set();
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const v = Y(x, y);
      const b = blur.get(x + ',' + y);
      if (v != null && v > 100 && Math.abs(v - b) > 14) mark.add(x + ',' + y);
    }
  }
  const dil = new Set(mark);
  for (const key of mark) {
    const [x, y] = key.split(',').map(Number);
    for (let dy = -6; dy <= 6; dy += 2) {
      for (let dx = -6; dx <= 6; dx += 2) {
        if (dx * dx + dy * dy <= 36) dil.add((x + dx) + ',' + (y + dy));
      }
    }
  }
  const seen = new Set();
  const comps = [];
  for (const key of dil) {
    if (seen.has(key)) continue;
    const stack = [key];
    seen.add(key);
    const comp = [];
    while (stack.length) {
      const cur = stack.pop();
      const [x, y] = cur.split(',').map(Number);
      comp.push([x, y]);
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
        const n = (x + dx) + ',' + (y + dy);
        if (dil.has(n) && !seen.has(n)) { seen.add(n); stack.push(n); }
      }
    }
    if (comp.length >= 40 && comp.length <= 4000) comps.push(comp);
  }
  const rows = [];
  for (const comp of comps) {
    const inn = comp.map(([x, y]) => Y(x, y)).filter((v) => v != null);
    const xs = comp.map((p) => p[0]);
    const ys = comp.map((p) => p[1]);
    const minX = Math.min(...xs); const maxX = Math.max(...xs);
    const minY = Math.min(...ys); const maxY = Math.max(...ys);
    const inside = new Set(comp.map(([x, y]) => x + ',' + y));
    const ring = [];
    const rpts = [];
    for (let y = minY - 26; y <= maxY + 26; y += 2) {
      for (let x = minX - 26; x <= maxX + 26; x += 2) {
        if (inside.has(x + ',' + y)) continue;
        const v = Y(x, y);
        if (v == null || v < 120) continue;
        const dx = x < minX ? minX - x : x > maxX ? x - maxX : 0;
        const dy = y < minY ? minY - y : y > maxY ? y - maxY : 0;
        if (Math.max(dx, dy) >= 8 && Math.max(dx, dy) <= 26) {
          ring.push(v);
          rpts.push([x, y]);
        }
      }
    }
    if (ring.length < 20 || inn.length < 20) continue;
    ring.sort((a, b) => a - b);
    const p95 = ring[Math.floor(0.95 * (ring.length - 1))];
    const meanI = inn.reduce((s, v) => s + v, 0) / inn.length;
    const meanR = ring.reduce((s, v) => s + v, 0) / ring.length;
    const hfOf = (pts) => {
      let acc = 0; let n = 0;
      for (let i = 0; i < pts.length; i += 3) {
        const [x, y] = pts[i];
        const v = Y(x, y);
        if (v == null) continue;
        let s = 0; let c = 0;
        for (const dy of [-2, 0, 2]) {
          for (const dx of [-2, 0, 2]) {
            const q = Y(x + dx, y + dy);
            if (q == null) continue;
            s += q; c++;
          }
        }
        acc += Math.abs(v - s / c); n++;
      }
      return acc / Math.max(n, 1);
    };
    const hf = hfOf(rpts) > 1e-3 ? hfOf(comp) / hfOf(rpts) : 0;
    const ratio = meanI / meanR;
    const lobe = Math.max(...inn) > p95;
    const meanOk = ratio >= MEAN_LO && ratio <= MEAN_HI;
    const grainOk = hf >= HF_MIN;
    rows.push({
      n: comp.length,
      max: +Math.max(...inn).toFixed(1),
      p95: +p95.toFixed(1),
      ratio: +ratio.toFixed(3),
      hf: +hf.toFixed(3),
      lobe,
      verdict: !lobe && meanOk && grainOk ? 'PASS' : 'FAIL',
    });
  }
  return {
    prints: rows,
    verdict: rows.some((r) => r.verdict === 'FAIL') ? 'FAIL' : 'PASS',
  };
}

function scoreFile(file) {
  const { rgb, w, h } = loadRgb(file);
  return { file: path.basename(file), w, h, ...printsIn(rgb, w, h) };
}

const mode = process.argv[2] || 'controls';
const fixture = path.join(here, 'artifacts/run32/lobe-fixture/t24-print.jpg');
const clean = path.join(here, 'artifacts/run32/lobe-fixture/clean-snow.jpg');

if (mode === 'controls') {
  const bad = scoreFile(fixture);
  const ok = scoreFile(clean);
  const report = { mean: [MEAN_LO, MEAN_HI], hfMin: HF_MIN, fixture: bad, clean: ok };
  fs.writeFileSync(path.join(here, 'artifacts/run32/print-lobe-controls.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (bad.verdict !== 'FAIL') {
    console.error('FAIL negative control: round-3 print crop did not fail');
    process.exit(1);
  }
  if (ok.verdict !== 'PASS') {
    console.error('FAIL clean snow did not pass the print lobe gate');
    process.exit(1);
  }
  console.log('PASS print-lobe controls (fixture FAIL, clean PASS)');
} else if (mode === 'dir') {
  const dir = process.argv[3];
  const names = fs.readdirSync(dir).filter((n) => /^t.+\.jpg$/.test(n)).sort();
  const rows = names.map((n) => scoreFile(path.join(dir, n)));
  const report = { rows, verdict: rows.some((r) => r.verdict === 'FAIL') ? 'FAIL' : 'PASS' };
  console.log(JSON.stringify(report, null, 2));
  if (report.verdict !== 'PASS') process.exit(1);
  console.log('PASS print-lobe');
} else {
  console.error('usage: test-print-lobe.mjs [controls|dir <path>]');
  process.exit(2);
}

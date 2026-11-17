// Follow-camera gates for baked AO and SH. Fixture (legacy ambient, AO forced off)
// then the bake. Thresholds are the ones in artifacts/run32/GATES.md.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { serve, withChrome } from './chrome.mjs';
import { CANDIDATE } from './biome.js';
import { glacierIrr } from './sh-sky.js';
import { srgbToLab, dE76 } from '../biome-factory/cie76.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const webgpu = path.resolve(here, '..');
const TIMES = [5.1, 5.567, 7.9, 11.7, 24, 30];
const W = 720;
const H = 1280;
const FOCAL = (H / 2) / Math.tan((62 * Math.PI / 180) / 2);
const outRoot = process.env.GLACIER_OUT || '/opt/cursor/artifacts/run32';

function decodePng(buf) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], {
    input: buf, maxBuffer: 12 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(String(r.stderr).slice(-300));
  return r.stdout;
}

function lumaAt(buf, i) {
  const R = (buf[i] / 255) ** 2.2;
  const G = (buf[i + 1] / 255) ** 2.2;
  const B = (buf[i + 2] / 255) ** 2.2;
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
function median(a) {
  if (!a.length) return null;
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.floor((s.length - 1) / 2)];
}
function matOf(shade, i) { return Math.round(shade[i] / 255 * 8 - 0.5); }

function snowWindow(surface, shade, normal, albedo, bolt, cx, cy, depth) {
  // Flat snow only. ny and ndl stay in the band of an up face under this sun,
  // so slope and grain are not counted as occlusion. Overlays are not in
  // the surface buffer. The camera is still the follow camera.
  const rad = Math.max(3, Math.round(0.4 * FOCAL / Math.max(1.2, depth)));
  const light = [];
  const raw = [];
  const aos = [];
  const x0 = Math.max(0, Math.round(cx - rad));
  const y0 = Math.max(0, Math.round(cy - rad));
  const x1 = Math.min(W - 1, Math.round(cx + rad));
  const y1 = Math.min(H - 1, Math.round(cy + rad));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > rad * rad) continue;
      const i = (y * W + x) * 4;
      if (bolt && (bolt[i] > 14 || bolt[i + 1] > 14)) continue;
      if (matOf(shade, i) !== 0) continue;
      const ny = normal[i + 1] / 255 * 2 - 1;
      const ndl = shade[i + 1] / 255;
      if (ny < 0.92 || ndl < 0.2 || ndl > 0.38) continue;
      const alb = lumaAt(albedo, i);
      const lum = lumaAt(surface, i);
      if (!(alb > 0.05)) continue;
      raw.push(lum);
      light.push(lum / alb);
      aos.push(shade[i + 3] / 255);
    }
  }
  if (light.length < 8) return null;
  return { n: light.length, light: median(light), raw: median(raw), ao: median(aos), rad };
}

function shadedPatch(surface, shade, normal, albedo, cx, cy) {
  const cols = [];
  const preds = [];
  const cool = [];
  const warm = [];
  const x0 = Math.max(0, Math.round(cx - 36));
  const x1 = Math.min(W - 1, Math.round(cx + 36));
  const y0 = Math.max(0, Math.round(cy - 90));
  const y1 = Math.min(H - 1, Math.round(cy + 18));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * W + x) * 4;
      const mat = matOf(shade, i);
      const ndl = shade[i + 1] / 255;
      const ndv = shade[i + 2] / 255;
      const ao = shade[i + 3] / 255;
      if (ndv <= 0.55 || ndl >= 0.12) continue;
      if (mat !== 0 && mat !== 6 && mat !== 1 && mat !== 2) continue;
      const N = [normal[i] / 255 * 2 - 1, normal[i + 1] / 255 * 2 - 1, normal[i + 2] / 255 * 2 - 1];
      const alb = [albedo[i], albedo[i + 1], albedo[i + 2]].map((c) => (c / 255) ** 2.2);
      const irr = glacierIrr(N, ao);
      let col = alb.map((a, k) => a * irr[k]);
      if ((mat > 0.5 && mat < 3.5) || (mat > 5.5 && mat < 6.5)) {
        const t = Math.min(1, Math.max(0, (ndl - 0.02) / 0.30));
        const s = t * t * (3 - 2 * t);
        const shadeK = 1 - s;
        col = col.map((c, k) => c + alb[k] * [0.2, 0.26, 0.38][k] * shadeK);
      }
      const pred = col.map((c) => Math.round((Math.min(1, Math.max(0, c)) ** (1 / 2.2)) * 255));
      const got = [surface[i], surface[i + 1], surface[i + 2]];
      cols.push(got);
      preds.push(pred);
      const linB = (surface[i + 2] / 255) ** 2.2;
      const linR = (surface[i] / 255) ** 2.2;
      const ny = N[1];
      if (ny > 0.25) cool.push(linB - linR);
      if (ny < -0.05) warm.push(linB - linR);
    }
  }
  if (cols.length < 8) return { n: cols.length, dE76: null };
  const lab = (pix) => {
    const labs = pix.map((p) => srgbToLab(p));
    const mid = (k) => labs.map((v) => v[k]).sort((a, b) => a - b)[Math.floor((labs.length - 1) / 2)];
    return [mid(0), mid(1), mid(2)];
  };
  const dE = dE76(lab(cols), lab(preds));
  return {
    n: cols.length,
    dE76: +dE.toFixed(2),
    coolN: cool.length,
    warmN: warm.length,
    cool: cool.length ? +median(cool).toFixed(4) : null,
    warm: warm.length ? +median(warm).toFixed(4) : null,
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

function measure(frame, bufs) {
  const contacts = [];
  for (const c of frame.contact || []) {
    const a = snowWindow(bufs.surface, bufs.shade, bufs.normal, bufs.albedo, bufs.bolt, c.p05[0], c.p05[1], c.depth);
    const b = snowWindow(bufs.surface, bufs.shade, bufs.normal, bufs.albedo, bufs.bolt, c.p3[0], c.p3[1], c.depth + 2.5);
    if (!a || !b || !(b.light > 1e-4)) {
      contacts.push({ depth: c.depth, skip: true, n05: a && a.n, n3: b && b.n });
      continue;
    }
    contacts.push({
      depth: c.depth,
      mat: c.mat,
      n05: a.n,
      n3: b.n,
      L05: +a.light.toFixed(4),
      L3: +b.light.toFixed(4),
      raw05: +a.raw.toFixed(4),
      raw3: +b.raw.toFixed(4),
      darken: +((1 - a.light / b.light)).toFixed(4),
      p05: c.p05,
      p3: c.p3,
    });
  }
  const open = [];
  for (const o of frame.open || []) {
    const w = snowWindow(bufs.surface, bufs.shade, bufs.normal, bufs.albedo, bufs.bolt, o.p[0], o.p[1], o.depth);
    if (!w) { open.push({ skip: true, clear: o.clear }); continue; }
    open.push({ clear: o.clear, depth: o.depth, n: w.n, light: +w.light.toFixed(4), raw: +w.raw.toFixed(4), ao: +w.ao.toFixed(4), p: o.p });
  }
  const lights = open.filter((o) => o.light != null).map((o) => o.light);
  const mean = lights.reduce((s, v) => s + v, 0) / (lights.length || 1);
  const spread = lights.length >= 2 ? (Math.max(...lights) - Math.min(...lights)) / mean : null;
  const shaded = (frame.contact || []).slice(0, 3).map((c) => shadedPatch(bufs.surface, bufs.shade, bufs.normal, bufs.albedo, c.p05[0], c.p05[1]));
  const measured = contacts.filter((c) => c.darken != null);
  return {
    t: frame.t,
    info: frame.info,
    boltLuma: boltLuma(bufs.beauty, bufs.bolt),
    boltX: frame.info.boltPx ? +frame.info.boltPx[0].toFixed(2) : null,
    contacts,
    contactMeasured: measured.length,
    contactMinDarken: measured.length ? Math.min(...measured.map((c) => c.darken)) : null,
    contactMedianDarken: measured.length ? median(measured.map((c) => c.darken)) : null,
    open,
    openSpread: spread == null ? null : +spread.toFixed(4),
    openMeanRaw: open.filter((o) => o.raw != null).length
      ? +median(open.filter((o) => o.raw != null).map((o) => o.raw)).toFixed(4) : null,
    openMinAo: open.filter((o) => o.ao != null).length
      ? Math.min(...open.filter((o) => o.ao != null).map((o) => o.ao)) : null,
    shaded,
  };
}

async function capture(legacy, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const port = legacy ? 8771 : 8773;
  const server = await serve(webgpu, port);
  const rows = [];
  try {
    const q = legacy ? '&legacy=1' : '';
    const url = `http://127.0.0.1:${port}/glacier/glacier.html?cap=1&w=720&h=1280&candidate=${CANDIDATE}${q}`;
    await withChrome({
      debugPort: legacy ? 9421 : 9423,
      url,
      tries: 500,
      fn: async ({ evalJson }) => {
        for (const t of TIMES) {
          const frame = await evalJson(`window.__glacierAoFrame(${t}).then(r => JSON.stringify(r))`);
          if (frame.info.gpuErr) throw new Error(frame.info.gpuErr);
          const tag = String(t).replace('.', 'p');
          const bufs = {};
          for (const key of ['beauty', 'surface', 'bolt', 'shade', 'normal', 'albedo']) {
            const png = Buffer.from(frame[key], 'base64');
            const file = path.join(dir, `t${tag}-${key}.png`);
            fs.writeFileSync(file, png);
            bufs[key] = decodePng(png);
          }
          spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', path.join(dir, `t${tag}-beauty.png`), '-q:v', '2', path.join(dir, `t${tag}.jpg`)]);
          frame.t = t;
          const row = measure(frame, bufs);
          for (const c of row.contacts) {
            if (!c.p05) continue;
            const crop = path.join(dir, `t${tag}-base-${Math.round(c.depth)}.jpg`);
            const x = Math.max(0, Math.round(c.p05[0] - 70));
            const y = Math.max(0, Math.round(c.p05[1] - 90));
            const rw = Math.min(160, W - x);
            const rh = Math.min(180, H - y);
            spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', path.join(dir, `t${tag}-beauty.png`), '-vf', `crop=${rw}:${rh}:${x}:${y}`, '-q:v', '2', crop]);
            c.crop = crop;
          }
          rows.push(row);
          console.log(JSON.stringify({
            t, legacy, z: row.info.z, boltX: row.boltX,
            bases: row.contactMeasured, minDarken: row.contactMinDarken,
            openSpread: row.openSpread, openMinAo: row.openMinAo,
            shaded: row.shaded.map((s) => s.dE76),
          }));
        }
      },
    });
  } finally {
    server.close();
  }
  return rows;
}

function verdict(rows, kind) {
  const contactFails = [];
  const contactPass = [];
  for (const row of rows) {
    const measured = row.contacts.filter((c) => c.darken != null);
    if (!measured.length) {
      contactFails.push({ t: row.t, reason: 'no measurable base' });
      continue;
    }
    for (const c of measured) {
      if (c.darken < 0.15) contactFails.push({ t: row.t, darken: c.darken, depth: c.depth });
      else contactPass.push({ t: row.t, darken: c.darken, depth: c.depth });
    }
  }
  const openFails = [];
  for (const row of rows) {
    if (row.openSpread == null || !(row.openSpread < 0.02)) openFails.push({ t: row.t, spread: row.openSpread });
    if (kind === 'after' && !(row.openMinAo >= 0.97)) openFails.push({ t: row.t, ao: row.openMinAo });
  }
  const shadeFails = [];
  let shadeN = 0;
  const sign = [];
  for (const row of rows) {
    for (const s of row.shaded) {
      if (s.dE76 == null) continue;
      shadeN++;
      if (s.dE76 > 10) shadeFails.push({ t: row.t, dE76: s.dE76, n: s.n });
      if (s.cool != null && s.warm != null) sign.push({ t: row.t, cool: s.cool, warm: s.warm, ok: s.cool > s.warm });
    }
  }
  return {
    contactPass: contactFails.length === 0 && contactPass.length > 0,
    contactFails,
    contactPassN: contactPass.length,
    openPass: openFails.length === 0,
    openFails,
    shadePass: shadeFails.length === 0 && shadeN > 0,
    shadeFails,
    shadeN,
    sign,
  };
}

const fixDir = path.join(outRoot, 'before');
const afterDir = path.join(outRoot, 'after');
console.log('FIXTURE');
const before = await capture(true, fixDir);
console.log('BAKE');
const after = await capture(false, afterDir);
const fixV = verdict(before, 'fixture');
const aftV = verdict(after, 'after');
const bolt = TIMES.map((t, i) => ({
  t,
  before: before[i] && +before[i].boltLuma.toFixed(4),
  after: after[i] && +after[i].boltLuma.toFixed(4),
  delta: before[i] && after[i] ? +(after[i].boltLuma - before[i].boltLuma).toFixed(4) : null,
  xBefore: before[i] && before[i].boltX,
  xAfter: after[i] && after[i].boltX,
}));
const snowDelta = TIMES.map((t, i) => {
  const a = before[i] && before[i].openMeanRaw;
  const b = after[i] && after[i].openMeanRaw;
  return { t, before: a, after: b, delta: a && b ? +((b - a) / a).toFixed(4) : null };
});
const report = {
  fixtureContactShouldFail: !fixV.contactPass,
  fixtureOpenShouldPass: fixV.openPass,
  afterContact: aftV.contactPass,
  afterOpen: aftV.openPass,
  afterShade: aftV.shadePass,
  fixV, aftV, bolt, snowDelta,
  budget: after[0] && after[0].info,
};
const repoDir = path.join(here, 'artifacts', 'run32');
fs.mkdirSync(repoDir, { recursive: true });
fs.writeFileSync(path.join(repoDir, 'gates.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(outRoot, 'gates.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  fixtureContactShouldFail: report.fixtureContactShouldFail,
  fixtureOpenShouldPass: report.fixtureOpenShouldPass,
  afterContact: report.afterContact,
  afterOpen: report.afterOpen,
  afterShade: report.afterShade,
  bolt,
  snowDelta,
}, null, 2));
if (!report.fixtureContactShouldFail || !report.fixtureOpenShouldPass) {
  console.error('FIXTURE did not land where the gate said it must');
  process.exit(1);
}

// Blocking real-colour gate on SwiftShader pixels of the crystal scene.
// Reference = the albedo the shader sampled, times night-rig irradiance of that pixel's normal.
import { spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildWorld, terrH } from './world.js';
import { MAT } from './biome.js';
import { NIGHT } from '../biome-factory/night-rig.js';
import { WATER_WAVE } from '../biome-factory/shade.js';
import { scoreWindow } from '../biome-factory/render-colour-gate.mjs';
import { DE76_MAX } from '../biome-factory/colour-same-light.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const webgpu = path.resolve(here, '..');
const MATERIALS = [
  { id: 'ground', mat: MAT.mineral },
  { id: 'violet', mat: MAT.violet },
  { id: 'cyan', mat: MAT.cyan },
  { id: 'stone', mat: MAT.stone },
  { id: 'stream', mat: MAT.stream },
  { id: 'wall', mat: MAT.wall },
];

function norm(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }

function pickShots() {
  const sun = norm(NIGHT.moon.direction);
  const world = buildWorld();
  const v = world.verts;
  const buckets = new Map(MATERIALS.map((m) => [m.mat, []]));
  for (let i = 0; i + 24 <= v.length; i += 24) {
    const mat = Math.round(v[i + 3]);
    if (!buckets.has(mat)) continue;
    const a = [v[i], v[i + 1], v[i + 2]];
    const b = [v[i + 8], v[i + 9], v[i + 10]];
    const c = [v[i + 16], v[i + 17], v[i + 18]];
    const n = norm([v[i + 4], v[i + 5], v[i + 6]]);
    const area = 0.5 * Math.hypot(...cross(sub(b, a), sub(c, a)));
    const ndl = Math.max(0, n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]);
    const flat = n[1] > 0.75;
    if (area < 0.02) continue;
    if (flat ? ndl < 0.12 : ndl < 0.45) continue;
    const at = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    if (mat === MAT.stream && at[1] < terrH(at[0], at[2]) + 0.08) continue;
    let dist = 0.55;
    if (mat === MAT.stream) {
      // The sheet is the rest plane. The shader lifts it by up to 0.16, and the
      // near plane is 0.08, so a camera 0.1 m up clips the crest and shows the bed.
      const rise = WATER_WAVE.az * Math.sin(at[2] * WATER_WAVE.fz) + WATER_WAVE.ax * Math.sin(at[0] * WATER_WAVE.fx);
      const dydx = WATER_WAVE.ax * WATER_WAVE.fx * Math.cos(at[0] * WATER_WAVE.fx);
      const dydz = WATER_WAVE.az * WATER_WAVE.fz * Math.cos(at[2] * WATER_WAVE.fz);
      const nl = Math.hypot(dydx, 1, dydz) || 1;
      const ny = 1 / nl;
      const ndlW = Math.max(0, (-dydx * sun[0] + sun[1] - dydz * sun[2]) / nl);
      if (ny < 0.7 || ndlW < 0.12 || 0.4 - rise < 0.12) continue;
      dist = 0.4;
    }
    if (mat === MAT.violet || mat === MAT.cyan) dist = 1.15;
    buckets.get(mat).push({
      at,
      eye: [at[0] + n[0] * dist + 0.05, at[1] + n[1] * dist, at[2] + n[2] * dist],
      tgt: at,
      ndl,
      area,
    });
  }
  const shots = [];
  for (const spec of MATERIALS) {
    const faces = buckets.get(spec.mat).sort((p, q) => q.ndl - p.ndl || q.area - p.area);
    const chosen = [];
    for (const face of faces) {
      if (chosen.every((c) => Math.hypot(c.at[0] - face.at[0], c.at[2] - face.at[2]) > 1.2)) chosen.push(face);
      if (chosen.length === (spec.id === 'stream' ? 6 : 3)) break;
    }
    for (const face of chosen) shots.push({ ...spec, ...face, breakId: 0 });
  }
  return shots;
}

function listen(port) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent((req.url || '/').split('?')[0]);
      const file = path.join(webgpu, rel);
      if (!file.startsWith(webgpu) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end(); return;
      }
      const type = file.endsWith('.js') || file.endsWith('.mjs') ? 'text/javascript'
        : file.endsWith('.html') ? 'text/html'
        : file.endsWith('.png') ? 'image/png'
        : file.endsWith('.jpg') || file.endsWith('.jpeg') ? 'image/jpeg'
        : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type });
      res.end(fs.readFileSync(file));
    });
    srv.listen(port, '127.0.0.1', () => resolve(srv));
  });
}

async function chromeSession(breakId, shots) {
  const port = 9341 + (breakId || 0);
  const url = `http://127.0.0.1:8765/crystal/crystal.html?cap=1&w=720&h=1280&candidate=materials-v2-r2`;
  const profile = `/tmp/crystal-chrome-gate-${breakId}-${Date.now()}`;
  const chrome = spawn('google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu-sandbox',
    '--use-angle=swiftshader', '--enable-unsafe-webgpu', '--enable-features=Vulkan',
    '--use-vulkan=swiftshader', '--window-size=720,1280',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    url,
  ], { stdio: 'ignore' });
  const get = (pathname) => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: pathname }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });
  let ws;
  try {
    let list = '';
    for (let i = 0; i < 50 && !list.includes('webSocketDebuggerUrl'); i++) {
      await new Promise((r) => setTimeout(r, 250));
      try { list = await get('/json/list'); } catch { /* booting */ }
    }
    const pages = JSON.parse(list);
    const page = pages.find((p) => p.type === 'page' && p.url.includes('crystal')) || pages.find((p) => p.type === 'page');
    if (!page) throw new Error('no page ' + list.slice(0, 300));
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let id = 0;
    const pending = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
    const call = (method, params = {}) => new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
    await call('Runtime.enable');
    let ready = false, err = '';
    for (let i = 0; i < 160 && !ready; i++) {
      await new Promise((r) => setTimeout(r, 250));
      const ev = await call('Runtime.evaluate', { expression: 'JSON.stringify({ready: window.__crystalReady, err: window.__crystalErr || null})', returnByValue: true });
      const v = JSON.parse(ev.result.value);
      err = v.err || '';
      ready = v.ready === true;
      if (v.err) break;
    }
    if (!ready) {
      const extra = await call('Runtime.evaluate', { expression: 'JSON.stringify({err: window.__crystalErr || null, info: window.__crystalInfo || null, href: location.href})', returnByValue: true }).catch((e) => ({ result: { value: String(e) } }));
      throw new Error((err || 'page not ready') + ' ' + (extra.result && extra.result.value));
    }
    const rows = [];
    for (const shot of shots) {
      const expr = `window.__crystalGate(${JSON.stringify({
        eye: shot.eye, tgt: shot.tgt, at: shot.at, breakId, rad: 12,
      })}).then(r => JSON.stringify(r))`;
      const ev = await call('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (ev.exceptionDetails) throw new Error(JSON.stringify(ev.exceptionDetails).slice(0, 500));
      const frame = JSON.parse(ev.result.value);
      const scored = frame.ok ? scoreWindow(frame, shot.mat) : { ok: false, pixels: 0, verdict: 'UNCERTAIN', dE76: null, reason: frame.reason, gpuErr: frame.gpuErr };
      if (!scored.ok && frame.ok) scored.stats = frame.stats;
      rows.push({ id: shot.id, mat: shot.mat, ...scored, gpuErr: frame.gpuErr || null });
    }
    return rows;
  } finally {
    try { ws && ws.close(); } catch { /* ignore */ }
    chrome.kill('SIGKILL');
  }
}

function summarise(rows) {
  const by = new Map();
  for (const row of rows) {
    if (!by.has(row.id)) by.set(row.id, []);
    by.get(row.id).push(row);
  }
  return [...by.entries()].map(([id, patches]) => {
    const good = patches.filter((p) => p.ok);
    if (!good.length) return { id, patches: patches.length, verdict: 'UNCERTAIN', dE76: null, pixels: 0, stats: patches[0] && patches[0].stats, reasons: patches.map((p) => p.reason || p.pixels) };
    const worst = good.reduce((a, b) => (a.dE76 > b.dE76 ? a : b));
    return {
      id,
      patches: good.length,
      tried: patches.length,
      pixels: good.reduce((s, p) => s + p.pixels, 0),
      dE76: worst.dE76,
      verdict: worst.verdict,
      lab: worst.lab,
      predLab: worst.predLab,
      threshold: DE76_MAX,
    };
  });
}

const only = process.argv[2];
const shots = pickShots().filter((s) => !only || s.id === only);
if (!only && new Set(shots.map((s) => s.id)).size < 6) { console.error('FAIL not enough lit faces', shots.map((s) => s.id)); process.exit(1); }
const port = 8765;
const server = await listen(port);
let fail = 0;
try {
  const clean = summarise(await chromeSession(0, shots));
  const brokenShots = only && only !== 'cyan' ? [] : shots.filter((s) => s.id === 'cyan').slice(0, 2);
  const broken = brokenShots.length ? summarise(await chromeSession(MAT.cyan + 1, brokenShots)) : [];
  const ground = broken.find((r) => r.id === 'cyan');
  const report = { clean, negativeControl: ground, threshold: DE76_MAX, blocking: true };
  fs.writeFileSync(path.join(here, 'artifacts/same-light/render-table.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  for (const row of clean) {
    const need = row.id === 'stream' ? 3 : 1;
    if (row.verdict !== 'PASS' || !(row.dE76 <= DE76_MAX) || row.patches < need) {
      console.error('FAIL render gate', row.id, row);
      fail++;
    }
  }
  if (!only && (!ground || ground.verdict !== 'BLOCK' || !(ground.dE76 > DE76_MAX))) {
    console.error('FAIL negative control did not block', ground);
    fail++;
  }
} catch (err) {
  console.error('FAIL', err && err.stack || err);
  fail++;
} finally {
  server.close();
}
if (fail) process.exit(1);
console.log('PASS render-colour');

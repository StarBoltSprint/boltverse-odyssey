// The 0.015 limit is one world direction across cameras, not two directions.
// A screen-space sky must fail. The two-direction pair is printed and does not block.
import { spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { skyLinear, skyDelta, dirFrom } from '../biome-factory/procedural-sky.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const webgpu = path.resolve(here, '..');
const LIMIT = 0.015;
const art = path.join(here, 'artifacts/same-light');

function lin(byte) { return (byte / 255) ** 2.2; }
function toLin(rgb) { return [lin(rgb[0]), lin(rgb[1]), lin(rgb[2])]; }
function round5(n) { return Math.round(n * 1e5) / 1e5; }

const dirs = [];
for (const elev of [32, 46, 60, 74]) {
  for (const yaw of [0.3, 2.1]) dirs.push(dirFrom(elev, yaw));
}

function pose(eye, yaw, pitchDeg) {
  const pitch = pitchDeg * Math.PI / 180;
  const cp = Math.cos(pitch);
  const fwd = [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp];
  return {
    eye,
    tgt: [eye[0] + fwd[0], eye[1] + fwd[1], eye[2] + fwd[2]],
    yaw,
    pitch: pitchDeg,
  };
}

function aim(eye, dir, yawOff, pitchOff) {
  const yaw = Math.atan2(dir[0], dir[2]) + yawOff;
  const pitch = Math.asin(Math.max(-1, Math.min(1, dir[1]))) + pitchOff;
  return pose(eye, yaw, pitch * 180 / Math.PI);
}
const eyes = [[0, 36, 0], [28, 40, -50]];
const poses = [];
for (const eye of eyes) {
  for (const dir of dirs) {
    for (const yawOff of [-0.22, 0.22]) poses.push({ ...aim(eye, dir, yawOff, 0), dir });
  }
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

async function chromeSession() {
  const port = 9355;
  const url = 'http://127.0.0.1:8766/crystal/crystal.html?cap=1&w=720&h=1280&candidate=materials-v2-r2';
  const profile = `/tmp/crystal-chrome-sky-${Date.now()}`;
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
      const ev = await call('Runtime.evaluate', { expression: 'JSON.stringify({ready: window.__crystalReady, err: window.__crystalErr || null, sky: typeof window.__crystalSky})', returnByValue: true });
      const v = JSON.parse(ev.result.value);
      err = v.err || '';
      ready = v.ready === true && v.sky === 'function';
      if (v.err) break;
    }
    if (!ready) throw new Error(err || 'page not ready');
    const shoot = async (shot) => {
      const expr = `window.__crystalSky(${JSON.stringify(shot)}).then(r => JSON.stringify(r))`;
      const ev = await call('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (ev.exceptionDetails) throw new Error(JSON.stringify(ev.exceptionDetails).slice(0, 500));
      return JSON.parse(ev.result.value);
    };
    return { shoot, chrome };
  } catch (err) {
    try { chrome.kill('SIGKILL'); } catch { /* ignore */ }
    throw err;
  }
}

function take(frame, dirIndex) {
  const sample = frame.samples[dirIndex];
  if (!sample || sample[5] !== 5) return null;
  const gpu = toLin(sample);
  const cpu = skyLinear(dirs[dirIndex]);
  return { gpu, match: skyDelta(gpu, cpu), x: sample[3], y: sample[4] };
}

function spread(points) {
  let m = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      m = Math.max(m, Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y));
    }
  }
  return m;
}

function worst(samples) {
  let m = 0;
  for (let i = 0; i < samples.length; i++) {
    for (let j = i + 1; j < samples.length; j++) m = Math.max(m, skyDelta(samples[i].gpu, samples[j].gpu));
  }
  return m;
}

const server = await listen(8766);
let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };
try {
  const { shoot, chrome } = await chromeSession();
  try {
    const anchorFrames = [];
    for (const p of poses) anchorFrames.push(await shoot({ ...p, dirs, swim: 0, jpg: false }));
    const perDir = dirs.map(() => []);
    const anchored = anchorFrames.map(() => []);
    anchorFrames.forEach((frame, pi) => {
      dirs.forEach((_, k) => {
        const hit = take(frame, k);
        anchored[pi][k] = !!hit;
        if (hit) perDir[k].push(hit);
      });
    });
    let anchorMax = 0;
    let cpuMax = 0;
    let minSamples = Infinity;
    let minSpread = Infinity;
    const counts = [];
    perDir.forEach((hits) => {
      counts.push(hits.length);
      minSamples = Math.min(minSamples, hits.length);
      hits.forEach((h) => { cpuMax = Math.max(cpuMax, h.match); });
      if (hits.length) {
        anchorMax = Math.max(anchorMax, worst(hits));
        minSpread = Math.min(minSpread, spread(hits));
      }
    });
    if (minSamples < 4) bad('a world direction was rendered from only ' + minSamples + ' cameras');
    if (!(minSpread > 80)) bad('world directions did not move on screen, spread ' + minSpread);
    if (!(anchorMax < LIMIT)) bad('anchored sky moved ' + anchorMax);

    const eye = [0, 36, 0];
    const frames = 36;
    const seen = dirs.map(() => []);
    let temporal = 0;
    let pop = 0;
    const tmp = '/tmp/crystal-sky-turn';
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.mkdirSync(tmp, { recursive: true });
    for (let i = 0; i < frames; i++) {
      const yaw = i / frames * Math.PI * 2;
      const frame = await shoot({ ...pose(eye, yaw, 30), dirs, swim: 0, jpg: true, yaw });
      if (!frame.jpg) bad('missing turn frame ' + i);
      else fs.writeFileSync(path.join(tmp, `f_${String(i).padStart(3, '0')}.jpg`), Buffer.from(frame.jpg, 'base64'));
      dirs.forEach((_, k) => {
        const hit = take(frame, k);
        if (!hit) return;
        const prev = seen[k][seen[k].length - 1];
        if (prev) {
          const step = skyDelta(prev.gpu, hit.gpu);
          temporal = Math.max(temporal, step);
          if (step >= LIMIT) pop++;
        }
        seen[k].push(hit);
      });
    }
    const tracked = seen.filter((s) => s.length >= 2).length;
    if (tracked < 4) bad('360 turn tracked only ' + tracked + ' directions');
    if (!(temporal < LIMIT) || pop) bad('sky popped on the turn ' + temporal + ' steps ' + pop);

    const swimIdx = [];
    for (let pi = 0; pi < poses.length && swimIdx.length < 8; pi++) {
      if (anchored[pi].some(Boolean)) swimIdx.push(pi);
    }
    const swimHits = dirs.map(() => []);
    for (const pi of swimIdx) {
      const p = poses[pi];
      const frame = await shoot({ ...p, dirs, swim: 1, jpg: false, yaw: p.yaw });
      dirs.forEach((_, k) => {
        const sample = frame.samples[k];
        if (!sample || !anchored[pi][k]) return;
        swimHits[k].push({ gpu: toLin(sample), x: sample[3], y: sample[4] });
      });
    }
    let swimMax = 0;
    let swimSpread = 0;
    swimHits.forEach((hits) => {
      if (hits.length >= 2) {
        swimMax = Math.max(swimMax, worst(hits));
        swimSpread = Math.max(swimSpread, spread(hits));
      }
    });
    if (!(swimMax >= LIMIT)) bad('screen-space sky did not fail, delta ' + swimMax);
    if (!(swimSpread > 80)) bad('screen-space control did not move on screen');

    const ff = spawn('ffmpeg', [
      '-y', '-v', 'error', '-framerate', '12', '-i', path.join(tmp, 'f_%03d.jpg'),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      path.join(art, 'sky-turn.mp4'),
    ], { stdio: 'inherit' });
    const clipCode = await new Promise((resolve) => { ff.on('close', resolve); });
    if (clipCode !== 0) bad('ffmpeg clip ' + clipCode);

    const report = {
      limit: LIMIT,
      blocking: 'world-direction across cameras, and frame to frame on a 360',
      directions: dirs.length,
      cameras: poses.length,
      minSamples,
      counts,
      minScreenSpread: Math.round(minSpread),
      anchorMax: round5(anchorMax),
      cpuMatchMax: round5(cpuMax),
      turnFrames: frames,
      tracked,
      temporalMax: round5(temporal),
      pops: pop,
      yawPairAdvisory: round5(skyDelta(skyLinear(dirFrom(12, 0.2)), skyLinear(dirFrom(12, 0.55)))),
      screenSpace: { max: round5(swimMax), spread: Math.round(swimSpread), failedGate: swimMax >= LIMIT },
    };
    fs.writeFileSync(path.join(art, 'sky-anchor.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally {
    try { chrome.kill('SIGKILL'); } catch { /* ignore */ }
  }
} catch (err) {
  console.error('FAIL', err && err.stack || err);
  fail++;
} finally {
  server.close();
}
if (fail) process.exit(1);
console.log('PASS sky-anchor');

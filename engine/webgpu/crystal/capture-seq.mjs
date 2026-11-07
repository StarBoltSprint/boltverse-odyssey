// Stepped gameplay capture. One Chrome session, sim time 1/30 s per frame.
import { spawn } from 'child_process';
import fs from 'fs';
import http from 'http';

const frames = 600;
const fps = 30;
const dir = '/tmp/crystal-frames';
const log = '/tmp/crystal-cap.log';
const port = 9334;
const url = 'http://127.0.0.1:8765/crystal/crystal.html?cap=1&jpg=1&proof=1&w=720&h=1280';

fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const say = (s) => { fs.appendFileSync(log, s + '\n'); console.log(s); };

function get(pathname) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: pathname }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

fs.rmSync('/tmp/crystal-chrome-seq', { recursive: true, force: true });
const chrome = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu-sandbox',
  '--use-angle=swiftshader', '--enable-unsafe-webgpu', '--enable-features=Vulkan',
  '--use-vulkan=swiftshader', '--window-size=720,1280',
  `--remote-debugging-port=${port}`, '--user-data-dir=/tmp/crystal-chrome-seq',
  url,
], { stdio: 'ignore' });

let ws;
try {
  let list = '';
  for (let i = 0; i < 40 && !list.includes('webSocketDebuggerUrl'); i++) {
    await new Promise(r => setTimeout(r, 250));
    try { list = await get('/json/list'); } catch { /* booting */ }
  }
  const pages = JSON.parse(list);
  const page = pages.find(p => p.type === 'page' && p.url.includes('crystal')) || pages.find(p => p.type === 'page');
  if (!page) throw new Error('no page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id); pending.delete(msg.id);
      if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
      else p.resolve(msg.result);
    }
  };
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const msgId = ++id; pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
  await call('Runtime.enable');
  let ready = false;
  for (let i = 0; i < 80 && !ready; i++) {
    await new Promise(r => setTimeout(r, 250));
    const ev = await call('Runtime.evaluate', { expression: 'JSON.stringify({ready:!!window.__crystalReady, err:window.__crystalErr||null})', returnByValue: true });
    const v = JSON.parse(ev.result.value);
    if (v.err) throw new Error(v.err);
    ready = v.ready;
  }
  if (!ready) throw new Error('not ready');
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    const t = i / fps;
    const shot = await call('Runtime.evaluate', {
      expression: `window.__crystalFrame(${t}).then(r => JSON.stringify({jpg:r.jpg, info:r.info}))`,
      awaitPromise: true, returnByValue: true,
    });
    if (shot.exceptionDetails) throw new Error(JSON.stringify(shot.exceptionDetails).slice(0, 500));
    const payload = JSON.parse(shot.result.value);
    if (payload.info.gpuErr) throw new Error(payload.info.gpuErr);
    const name = `${dir}/f_${String(i).padStart(4, '0')}.jpg`;
    fs.writeFileSync(name, Buffer.from(payload.jpg, 'base64'));
    if (i % 30 === 0) say(`frame ${i} z=${payload.info.z.toFixed(1)} v=${payload.info.v.toFixed(1)} ${(Date.now() - t0) / 1000}s`);
  }
  say('FRAMES_DONE');
} finally {
  try { ws && ws.close(); } catch { /* ignore */ }
  chrome.kill('SIGKILL');
}

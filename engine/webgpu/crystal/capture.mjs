// One gameplay frame, or a timed frame sequence, from the local crystal page.
// Sim time is stepped inside the page. This does not invent a display rate.
import { spawn } from 'child_process';
import fs from 'fs';
import http from 'http';

const port = 9333;
const out = process.argv[2] || '/tmp/crystal-frame.png';
const simT = Number(process.argv[3] || 2);
const url = process.argv[4] || 'http://127.0.0.1:8765/crystal/crystal.html?cap=1&w=720&h=1280&candidate=materials-v2-r1';

function get(pathname) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: pathname }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

fs.rmSync('/tmp/crystal-chrome', { recursive: true, force: true });
const chrome = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu-sandbox',
  '--use-angle=swiftshader', '--enable-unsafe-webgpu', '--enable-features=Vulkan',
  '--use-vulkan=swiftshader', '--window-size=720,1280',
  `--remote-debugging-port=${port}`, '--user-data-dir=/tmp/crystal-chrome',
  url,
], { stdio: 'ignore' });

let ws;
try {
  let list = '';
  for (let i = 0; i < 40 && !list.includes('webSocketDebuggerUrl'); i++) {
    await new Promise(r => setTimeout(r, 250));
    try { list = await get('/json/list'); } catch { /* chrome still booting */ }
  }
  const pages = JSON.parse(list);
  const page = pages.find(p => p.type === 'page' && p.url.includes('crystal')) || pages.find(p => p.type === 'page');
  if (!page) throw new Error('no page ' + list.slice(0, 400));
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
  let ready = false, err = '', info = null;
  for (let i = 0; i < 80 && !ready; i++) {
    await new Promise(r => setTimeout(r, 250));
    const ev = await call('Runtime.evaluate', { expression: 'JSON.stringify({ready: window.__crystalReady, err: window.__crystalErr || null, info: window.__crystalInfo || null})', returnByValue: true });
    const v = JSON.parse(ev.result.value);
    err = v.err || '';
    info = v.info;
    ready = v.ready === true;
    if (v.err) break;
  }
  if (!ready) throw new Error(err || 'page not ready');
  const shot = await call('Runtime.evaluate', {
    expression: `window.__crystalFrame(${simT}).then(r => JSON.stringify({png:r.png, info:r.info}))`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (shot.exceptionDetails) throw new Error(JSON.stringify(shot.exceptionDetails));
  const payload = JSON.parse(shot.result.value);
  fs.writeFileSync(out, Buffer.from(payload.png, 'base64'));
  console.log(JSON.stringify({ out, bytes: fs.statSync(out).size, info: payload.info, gpu: info }));
} finally {
  try { ws && ws.close(); } catch { /* ignore */ }
  chrome.kill('SIGKILL');
}

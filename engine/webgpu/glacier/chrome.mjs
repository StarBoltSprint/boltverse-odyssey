// Headless Chrome + SwiftShader. One page, then a callback with Runtime.evaluate.
import { spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';

export function serve(root, port) {
  const base = path.resolve(root);
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent((req.url || '/').split('?')[0]);
      const file = path.resolve(base, '.' + rel);
      if (!file.startsWith(base) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end(); return;
      }
      const type = file.endsWith('.js') || file.endsWith('.mjs') ? 'text/javascript'
        : file.endsWith('.json') ? 'application/json'
        : file.endsWith('.html') ? 'text/html'
        : file.endsWith('.png') ? 'image/png'
        : file.endsWith('.jpg') || file.endsWith('.jpeg') ? 'image/jpeg'
        : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      res.end(fs.readFileSync(file));
    });
    srv.listen(port, '127.0.0.1', () => resolve(srv));
  });
}

export async function withChrome({ debugPort, url, fn, tries = 80 }) {
  const profile = `/tmp/glacier-chrome-${debugPort}-${Date.now()}`;
  fs.rmSync(profile, { recursive: true, force: true });
  const chrome = spawn('google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu-sandbox',
    '--use-angle=swiftshader', '--enable-unsafe-webgpu', '--enable-features=Vulkan',
    '--use-vulkan=swiftshader', '--window-size=1280,1280',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`,
    url,
  ], { stdio: 'ignore' });
  const get = (pathname) => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: debugPort, path: pathname }, (res) => {
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
    const page = pages.find((p) => p.type === 'page' && p.url.includes('glacier')) || pages.find((p) => p.type === 'page');
    if (!page) throw new Error('no page ' + list.slice(0, 300));
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let id = 0;
    const pending = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const slot = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) slot.reject(new Error(JSON.stringify(msg.error)));
        else slot.resolve(msg.result);
      }
    };
    const call = (method, params = {}) => new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
    await call('Runtime.enable');
    let ready = false;
    let err = '';
    for (let i = 0; i < tries && !ready; i++) {
      await new Promise((r) => setTimeout(r, 250));
      const ev = await call('Runtime.evaluate', {
        expression: 'JSON.stringify({ready: window.__glacierReady===true, err: window.__glacierErr||null})',
        returnByValue: true,
      });
      const v = JSON.parse(ev.result.value);
      err = v.err || '';
      ready = v.ready === true;
      if (v.err) break;
    }
    if (!ready) throw new Error(err || 'page not ready');
    const evalJson = async (expression) => {
      const ev = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (ev.exceptionDetails) throw new Error(JSON.stringify(ev.exceptionDetails).slice(0, 800));
      return JSON.parse(ev.result.value);
    };
    return await fn({ call, evalJson });
  } finally {
    try { ws && ws.close(); } catch { /* ignore */ }
    chrome.kill('SIGKILL');
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* chrome may still hold the profile */ }
  }
}

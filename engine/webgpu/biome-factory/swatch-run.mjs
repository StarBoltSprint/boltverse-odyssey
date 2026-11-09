// One Chrome session, one swatch sheet. Not a 20 s gameplay capture.
import { spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';

export async function runSwatch(outDir, port = 8771) {
  fs.mkdirSync(outDir, { recursive: true });
  const webgpu = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const httpProc = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: webgpu, stdio: 'ignore' });
  const dbg = port + 1;
  fs.rmSync('/tmp/crystal-swatch-chrome', { recursive: true, force: true });
  await new Promise(r => setTimeout(r, 300));
  const chrome = spawn('google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu-sandbox',
    '--use-angle=swiftshader', '--enable-unsafe-webgpu', '--enable-features=Vulkan',
    '--use-vulkan=swiftshader', '--window-size=768,768',
    `--remote-debugging-port=${dbg}`, '--user-data-dir=/tmp/crystal-swatch-chrome',
    `http://127.0.0.1:${port}/biome-factory/swatch.html`,
  ], { stdio: 'ignore' });
  const get = (pathname) => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: dbg, path: pathname }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
    }).on('error', reject);
  });
  let ws;
  try {
    let list = '';
    for (let i = 0; i < 40 && !list.includes('webSocketDebuggerUrl'); i++) {
      await new Promise(r => setTimeout(r, 250));
      try { list = await get('/json/list'); } catch { /* booting */ }
    }
    const pages = JSON.parse(list);
    const page = pages.find(p => p.type === 'page' && p.url.includes('swatch')) || pages.find(p => p.type === 'page');
    if (!page) throw new Error('no swatch page');
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
    let ready = false, err = '';
    for (let i = 0; i < 80 && !ready; i++) {
      await new Promise(r => setTimeout(r, 250));
      const ev = await call('Runtime.evaluate', { expression: 'JSON.stringify({ready:window.__swatchReady===true, err:window.__swatchErr||null})', returnByValue: true });
      const v = JSON.parse(ev.result.value);
      err = v.err || '';
      ready = v.ready;
      if (v.err) break;
    }
    if (!ready) throw new Error(err || 'swatch not ready');
    const shot = await call('Runtime.evaluate', {
      expression: 'JSON.stringify(window.__swatchResult)',
      returnByValue: true,
    });
    if (shot.exceptionDetails) throw new Error(JSON.stringify(shot.exceptionDetails).slice(0, 500));
    const payload = JSON.parse(shot.result.value);
    const png = path.join(outDir, 'swatch.png');
    fs.writeFileSync(png, Buffer.from(payload.png, 'base64'));
    const report = { panels: payload.panels, scales: payload.scales, shade: payload.shade, png };
    fs.writeFileSync(path.join(outDir, 'panels.json'), JSON.stringify(report, null, 2));
    return report;
  } finally {
    try { ws && ws.close(); } catch { /* ignore */ }
    chrome.kill('SIGKILL');
    httpProc.kill('SIGKILL');
  }
}

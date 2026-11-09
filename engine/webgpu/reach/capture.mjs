// Headless capture. Writes a frame-time report even when WebGPU is absent.
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const port = 8765;
const debugPort = 9333;
const W = 720, H = 1280;
const frames = Number(process.env.REACH_FRAMES || 72);
const dt = 1 / 12;

const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: repo, stdio: 'ignore' });
const chrome = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu-sandbox',
  '--user-data-dir=/tmp/reach-chrome',
  '--remote-debugging-port=' + debugPort,
  '--remote-debugging-address=127.0.0.1',
  '--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader',
  '--window-size=720,1280',
  'about:blank',
], { stdio: 'ignore' });

const report = {
  webgpu: false,
  phoneFps: null,
  medianMs: null,
  note: '',
  capture: null,
  gpuError: null,
};
let fail = '';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitJson(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch { /* chrome still booting */ }
    await sleep(250);
  }
  throw new Error('debug port closed');
}

try {
  await waitJson('http://127.0.0.1:' + debugPort + '/json/version');
  let list = await waitJson('http://127.0.0.1:' + debugPort + '/json/list');
  let page = list.find(t => t.type === 'page');
  if (!page) {
    await fetch('http://127.0.0.1:' + debugPort + '/json/new?about:blank');
    list = await waitJson('http://127.0.0.1:' + debugPort + '/json/list');
    page = list.find(t => t.type === 'page');
  }
  if (!page?.webSocketDebuggerUrl) throw new Error('no page target');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  let seq = 0;
  const wait = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && wait.has(msg.id)) { wait.get(msg.id)(msg); wait.delete(msg.id); }
  });
  const send = (method, params = {}) => new Promise(res => {
    const id = ++seq;
    wait.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
  await send('Page.enable');
  await send('Runtime.enable');
  const only = process.env.REACH_ONLY ? '&only=' + process.env.REACH_ONLY : '';
  const url = `http://127.0.0.1:${port}/engine/webgpu/reach/reach.html?cap=1&w=${W}&h=${H}${only}`;
  await send('Page.navigate', { url });
  const logs = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === 'Runtime.exceptionThrown') logs.push(String(msg.params?.exceptionDetails?.text || msg.params?.exceptionDetails?.exception?.description || 'exception'));
    if (msg.method === 'Runtime.consoleAPICalled') logs.push(msg.params?.args?.map(a => a.value || a.description).join(' '));
  });
  let ready = null;
  for (let i = 0; i < 80; i++) {
    const ev = await send('Runtime.evaluate', { expression: '({ready: window.__ready || null, href: location.href})', returnByValue: true });
    ready = ev.result?.result?.value?.ready;
    report.href = ev.result?.result?.value?.href;
    if (ready) break;
    await sleep(250);
  }
  report.ready = ready;
  report.logs = logs.slice(0, 12);
  if (ready !== true) {
    const err = await send('Runtime.evaluate', { expression: 'window.__gpuError || null', returnByValue: true });
    report.gpuError = err.result?.result?.value || null;
    report.note = ready === 'no-webgpu'
      ? 'Headless Chrome exposed no WebGPU adapter. Phone FPS was not measured.'
      : 'The page did not finish starting.';
  } else {
    report.webgpu = true;
    const bench = await send('Runtime.evaluate', {
      expression: '(async () => { try { return JSON.stringify(await window.__bench(8)); } catch (e) { return "EX " + (e && e.stack || e); } })()',
      awaitPromise: true,
      returnByValue: true,
    });
    const rawBench = bench.result?.result?.value;
    const boot = await send('Runtime.evaluate', { expression: 'JSON.stringify({boot: window.__bootError || "", lost: window.__lost || "", limits: window.__limits || null, gpu: window.__gpuError || ""})', returnByValue: true });
    report.boot = boot.result?.result?.value;
    report.benchRaw = typeof rawBench === 'string' ? rawBench.slice(0, 500) : rawBench;
    const value = typeof rawBench === 'string' && rawBench.startsWith('{') ? JSON.parse(rawBench) : null;
    if (value?.error) {
      report.gpuError = value.error;
      report.note = 'WebGPU validation failed during the timed run.';
    } else if (!value) {
      const err = await send('Runtime.evaluate', { expression: 'window.__gpuError || String(window.__ready)', returnByValue: true });
      report.gpuError = err.result?.result?.value || JSON.stringify(bench.result?.result || bench);
      report.note = 'WebGPU device started. The timed run did not return.';
    } else {
      report.benchKeys = value && Object.keys(value);
    report.medianMs = value.medianMs;
      report.minMs = value.minMs;
      report.maxMs = value.maxMs;
      report.benchFrames = value.frames;
      report.note = value.note;
      report.budgetMs = 16.7;
      report.within60 = value.medianMs <= 16.7;
    }
    const dir = fs.mkdtempSync(path.join('/tmp', 'reach-'));
    let wrote = 0;
    if (!value?.error) {
    for (let i = 0; i < frames; i++) {
      await send('Runtime.evaluate', { expression: `window.__step(${dt})`, awaitPromise: true, returnByValue: true });
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const b64 = shot.result?.data;
      if (typeof b64 !== 'string' || b64.length < 1000) {
        report.gpuError = 'screenshot empty';
        break;
      }
      fs.writeFileSync(path.join(dir, `f${String(i).padStart(3, '0')}.png`), Buffer.from(b64, 'base64'));
      wrote++;
    }
    }
    report.framesWritten = wrote;
    if (wrote === frames) {
      const out = '/opt/cursor/artifacts/obsidian-reach.mp4';
      fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
      await new Promise((res, rej) => {
        const ff = spawn('ffmpeg', [
          '-y', '-framerate', '12', '-i', path.join(dir, 'f%03d.png'),
          '-vf', 'scale=720:1280,format=yuv420p', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
          out,
        ], { stdio: 'ignore' });
        ff.on('exit', code => code === 0 ? res() : rej(new Error('ffmpeg ' + code)));
      });
      report.capture = out;
      const st = fs.statSync(out);
      report.captureBytes = st.size;
    } else {
      report.note = (report.note ? report.note + ' ' : '') + 'Capture stopped before 72 frames.';
    }
  }
  ws.close();
} catch (err) {
  fail = String(err && err.stack || err);
  report.note = report.note || 'Headless capture did not run.';
  report.error = fail;
}

server.kill('SIGTERM');
chrome.kill('SIGTERM');
const outJson = path.join(here, 'frame-report.json');
fs.writeFileSync(outJson, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(0);

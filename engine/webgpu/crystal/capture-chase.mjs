// 10 s, 720×1280, 30 fps chase. Same route twice: passes off, then TAA+SSGI.
// SwiftShader. Not a phone frame time.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire('/tmp/pw/node_modules/puppeteer-core/package.json');
const puppeteer = require('puppeteer-core');

const root = new URL('..', import.meta.url);
const outRoot = process.argv[2] || new URL('./chase-out/', import.meta.url).pathname;
const port = 8976;
const N = 300;
const args = ['--enable-unsafe-webgpu', '--enable-features=WebGPU', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox', '--no-sandbox'];

function serve() {
  return spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root.pathname, stdio: 'ignore' });
}

async function take(browser, fx, dir) {
  mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on('pageerror', (e) => console.log('PAGE', fx, String(e).slice(0, 500)));
  const url = `http://127.0.0.1:${port}/crystal/crystal.html?cap=1&w=720&h=1280&candidate=materials-v2-r2&jpg=1&fx=${fx}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction('window.__crystalReady === true || window.__crystalErr', { timeout: 180000 });
  const err = await page.evaluate('window.__crystalErr || null');
  if (err) throw new Error(fx + ' ' + err);
  await page.evaluate('window.__crystalReset && window.__crystalReset()');
  const eyes = [];
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', '30', '-i', '-', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${dir}.mp4`], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < N; i++) {
    const t = i / 30;
    const r = await page.evaluate(async (time) => {
      const shot = await window.__crystalFrame(time);
      return { jpg: shot.jpg, info: shot.info };
    }, t);
    if (r.info.gpuErr) throw new Error(fx + ' gpu ' + r.info.gpuErr);
    const buf = Buffer.from(r.jpg, 'base64');
    writeFileSync(`${dir}/f_${String(i).padStart(4, '0')}.jpg`, buf);
    ff.stdin.write(buf);
    eyes.push(r.info);
    if (i % 30 === 0) console.log(fx, 't', t.toFixed(1), 'z', r.info.z.toFixed(1), 'v', r.info.v.toFixed(2));
  }
  ff.stdin.end();
  const code = await new Promise((resolve) => ff.on('close', resolve));
  if (code !== 0) throw new Error('ffmpeg ' + code);
  writeFileSync(`${dir}/eyes.json`, JSON.stringify(eyes));
  await page.close();
  const list = createWriteStream(`${dir}/strip.txt`);
  for (let i = 0; i < N; i += 15) list.write(`file 'f_${String(i).padStart(4, '0')}.jpg'\nduration 0.5\n`);
  list.end();
  await new Promise((resolve) => list.on('close', resolve));
  const strip = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${dir}/strip.txt`, '-vf', 'scale=180:320,tile=5x4', '-frames:v', '1', `${dir}-strip.jpg`], { cwd: dir, stdio: 'inherit' });
  await new Promise((resolve) => strip.on('close', resolve));
}

const server = serve();
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args });
try {
  await take(browser, 'off', `${outRoot}/off`);
  await take(browser, 'both', `${outRoot}/on`);
} finally {
  await browser.close();
  server.kill();
}
console.log('captured', outRoot);

// Recapture only the passes-on take. Same route as capture-chase.mjs.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, createWriteStream, appendFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire('/tmp/pw/node_modules/puppeteer-core/package.json');
const puppeteer = require('puppeteer-core');
const port = 8984;
const dir = process.argv[2] || '/tmp/crystal-chase/on';
const root = '/agent/repos/Boltverse-odyssey/engine/webgpu';
const log = (m) => { appendFileSync('/tmp/crystal-on.log', m + '\n'); console.log(m); };

const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--enable-unsafe-webgpu', '--enable-features=WebGPU', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox', '--no-sandbox'],
});
mkdirSync(dir, { recursive: true });
const page = await browser.newPage();
page.on('pageerror', (e) => log('PAGE ' + String(e).slice(0, 400)));
await page.goto(`http://127.0.0.1:${port}/crystal/crystal.html?cap=1&w=720&h=1280&candidate=materials-v2-r2&jpg=1&fx=both`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction('window.__crystalReady === true || window.__crystalErr', { timeout: 120000 });
const err = await page.evaluate('window.__crystalErr || null');
if (err) throw new Error(err);
await page.evaluate('window.__crystalReset()');
const eyes = [];
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', '30', '-i', '-', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', dir.replace(/\/on$/, '') + '/on.mp4'], { stdio: ['pipe', 'inherit', 'inherit'] });
for (let i = 0; i < 300; i++) {
  const r = await page.evaluate(async (t) => {
    const s = await window.__crystalFrame(t);
    return { jpg: s.jpg, info: s.info };
  }, i / 30);
  if (r.info.gpuErr) throw new Error(r.info.gpuErr);
  const buf = Buffer.from(r.jpg, 'base64');
  writeFileSync(`${dir}/f_${String(i).padStart(4, '0')}.jpg`, buf);
  ff.stdin.write(buf);
  eyes.push(r.info);
  if (i % 30 === 0) log('on ' + (i / 30).toFixed(1) + ' z ' + r.info.z.toFixed(1));
}
ff.stdin.end();
const code = await new Promise((resolve) => ff.on('close', resolve));
if (code !== 0) throw new Error('ffmpeg ' + code);
writeFileSync(`${dir}/eyes.json`, JSON.stringify(eyes));
const list = createWriteStream(`${dir}/strip.txt`);
for (let i = 0; i < 300; i += 15) list.write(`file 'f_${String(i).padStart(4, '0')}.jpg'\nduration 0.5\n`);
list.end();
await new Promise((resolve) => list.on('close', resolve));
await new Promise((resolve) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${dir}/strip.txt`, '-vf', 'scale=180:320,tile=5x4', '-frames:v', '1', dir.replace(/\/on$/, '') + '/on-strip.jpg'], { cwd: dir, stdio: 'inherit' }).on('close', resolve));
await browser.close();
server.kill();
log('on recaptured');

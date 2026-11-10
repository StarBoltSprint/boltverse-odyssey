// Native 720x1280 @ 24 fps deterministic capture. No upscale.
// Three 15 s segments, concat-copy. Uncaptioned master is kept.
import pkg from '/tmp/node_modules/playwright-core/index.js';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const { chromium } = pkg;
const OUT = process.env.MEADOW_OUT || '/opt/cursor/artifacts/meadow-epic';
const W = 720, H = 1280, FPS = 24, DUR = 45, SEG = 15;
const URL = `http://127.0.0.1:8970/m448aaa3.html?v=9collide&cap=1&w=${W}&h=${H}&nc=meadowepic720`;
fs.mkdirSync(OUT, { recursive: true });

function ffmpegPipe(outMp4) {
  return spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outMp4,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
}

async function launch() {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: false,
    args: [
      '--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU',
      '--use-vulkan=swiftshader', '--disable-vulkan-surface',
      '--ignore-gpu-blocklist', '--enable-dawn-features=allow_unsafe_apis',
      '--no-sandbox', '--disable-dev-shm-usage',
    ],
    env: { ...process.env, VK_ICD_FILENAMES: '/opt/google/chrome/vk_swiftshader_icd.json' },
  });
  const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
  page.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 400)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__meadowReady||window.__meadowErr', { timeout: 180000 });
  const err = await page.evaluate('window.__meadowErr||null');
  if (err) throw new Error(err);
  return { browser, page };
}

async function encodeSeg(page, t0, t1, outMp4, tag) {
  const n0 = Math.round(t0 * FPS), n1 = Math.round(t1 * FPS);
  const ff = ffmpegPipe(outMp4);
  const tw = Date.now();
  for (let i = n0; i < n1; i++) {
    const t = i / FPS;
    const r = await page.evaluate(async (tt) => {
      const o = await window.__meadowFrame(tt, 0.88);
      return o.jpg;
    }, t);
    const jb = Buffer.from(r, 'base64');
    if (i === n0) {
      const proof = path.join(OUT, `_proof_${tag}.jpg`);
      fs.writeFileSync(proof, jb);
      const got = await new Promise((resolve, reject) => {
        const probe = spawn('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', proof]);
        let s = '';
        probe.stdout.on('data', (d) => { s += d; });
        probe.on('close', (c) => c ? reject(new Error('ffprobe ' + c + ' ' + s)) : resolve(s.trim()));
      });
      if (got !== `${W},${H}`) throw new Error(`capture res ${got} != ${W}x${H}`);
      console.log(`[${tag}] PROOF native jpg ${got}`);
    }
    if (!ff.stdin.write(jb)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((i - n0) % FPS === 0) {
      const dt = (Date.now() - tw) / 1000;
      const n = i - n0 + 1;
      console.log(`[${tag}] ${i}/${n1 - 1} t=${t.toFixed(1)} wall=${dt.toFixed(0)}s ${ (dt / n).toFixed(2) }s/fr jpg=${jb.length}`);
    }
    if (Number.isInteger(t) && [0, 3, 6, 8, 9, 12, 15, 20, 30, 40, 44].includes(t)) {
      fs.writeFileSync(path.join(OUT, `still_t${String(t).padStart(2, '0')}.jpg`), jb);
    }
  }
  ff.stdin.end();
  const rc = await new Promise((r) => ff.on('close', r));
  if (rc) throw new Error(`ffmpeg ${rc}`);
  console.log(`[${tag}] DONE ${outMp4} ${fs.statSync(outMp4).size}`);
}

const segs = [];
let ctx = await launch();
for (let s = 0; s < DUR / SEG; s++) {
  const t0 = s * SEG, t1 = (s + 1) * SEG;
  const file = path.join(OUT, `seg${s}.mp4`);
  try {
    await encodeSeg(ctx.page, t0, t1, file, `seg${s}`);
  } catch (e) {
    console.log('SEG FAIL', s, e);
    await ctx.browser.close().catch(() => {});
    ctx = await launch();
    await ctx.page.evaluate((t) => window.__meadowFrame(t, 0.5), t0);
    await encodeSeg(ctx.page, t0, t1, file, `seg${s}-retry`);
  }
  segs.push(file);
}
await ctx.browser.close().catch(() => {});
const list = path.join(OUT, 'concat.txt');
fs.writeFileSync(list, segs.map((p) => `file '${path.basename(p)}'\n`).join(''));
const raw = process.env.MEADOW_RAW || '/tmp/raw720.mp4';
await new Promise((resolve, reject) => {
  const p = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-i', path.join(OUT, 'seg0.mp4'),
    '-i', path.join(OUT, 'seg1.mp4'),
    '-i', path.join(OUT, 'seg2.mp4'),
    '-filter_complex', '[0:v][1:v][2:v]concat=n=3:v=1:a=0[v]',
    '-map', '[v]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-r', '24', '-an', raw,
  ]);
  p.on('close', (c) => c ? reject(new Error('concat ' + c)) : resolve());
});
console.log('RAW', raw, fs.statSync(raw).size);
fs.writeFileSync(path.join(OUT, 'cap_mode.txt'), `offline deterministic ${W}x${H}@${FPS}fps dur=${DUR}s tip=m448aaa3?v=9collide sprite bolt439_atlas native-no-upscale route=ford-aim-peel\n`);

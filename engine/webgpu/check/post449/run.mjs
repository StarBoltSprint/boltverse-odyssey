// Headless WebGPU capture for the crystal candidate.
// Frame time here is this machine, not a phone.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { decodeLuma, edgeVariance, ghostStats, mean } from './metrics.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, '../..');
const outDir = join(here, 'out');
const art = '/opt/cursor/artifacts';
mkdirSync(outDir, { recursive: true });
mkdirSync(art, { recursive: true });

const require = createRequire('/tmp/pw/node_modules/puppeteer-core/package.json');
const puppeteer = require('puppeteer-core');

const PORT = 8973;
const URL = `http://127.0.0.1:${PORT}/m449cand.html?cap=1&w=720&h=1280`;

function serve() {
  const p = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: web, stdio: ['ignore', 'pipe', 'pipe'] });
  return p;
}
function waitServer() {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server timeout')), 8000);
    const tick = () => fetch(URL).then((r) => { if (r.ok) { clearTimeout(t); resolve(); } else setTimeout(tick, 150); }).catch(() => setTimeout(tick, 150));
    setTimeout(tick, 200);
  });
}

const FLAG_SETS = [
  ['--enable-unsafe-webgpu', '--enable-features=WebGPU', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox', '--no-sandbox', '--headless=new'],
  ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-vulkan=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist', '--no-sandbox', '--headless=new'],
  ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--headless=new'],
];

async function boot() {
  let last = 'no attempt';
  for (const args of FLAG_SETS) {
    const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args });
    const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
    page.on('console', (m) => { if (m.type() === 'error') console.log('CON', m.text()); });
    page.on('pageerror', (e) => console.log('PAGE', e.message));
    try {
      await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction('window.__ready || window.__err', { timeout: 60000 });
      const err = await page.evaluate('window.__err || null');
      const gpu = await page.evaluate('window.__gpu || null');
      if (!err && gpu) return { browser, page, gpu, args };
      last = err || 'no adapter info';
      console.log('flag miss', last);
    } catch (e) {
      last = String(e);
      console.log('flag fail', last);
    }
    await browser.close();
  }
  throw new Error(last);
}

async function seq(page, spec, n) {
  const frames = [];
  for (let i = 0; i < n; i++) {
    const r = await page.evaluate(async (s) => window.__render(s), { ...spec, i, reset: i === 0 ? 1 : 0 });
    frames.push(r);
  }
  return frames;
}

function saveJpeg(b64, name) {
  const buf = Buffer.from(b64, 'base64');
  writeFileSync(join(outDir, name), buf);
  writeFileSync(join(art, name), buf);
}

async function main() {
  const server = serve();
  let browser;
  try {
    await waitServer();
    const bootR = await boot();
    browser = bootR.browser;
    const page = bootR.page;
    console.log('GPU', JSON.stringify(bootR.gpu));
    const results = { gpu: bootR.gpu, phone: 'unproven — this timing is the machine that ran the capture, not a handset' };

    // Before = the same Halton jitter with history forced off. After = the resolve.
    const jointsOff = await seq(page, { shot: 'joints', taa: 0, jitter: 1, ssgi: 0, read: 'centre' }, 10);
    const jointsOn = await seq(page, { shot: 'joints', taa: 1, ssgi: 0, read: 'centre' }, 10);
    const closeOff = await seq(page, { shot: 'close', taa: 0, jitter: 1, ssgi: 0, read: 'centre' }, 10);
    const closeOn = await seq(page, { shot: 'close', taa: 1, ssgi: 0, read: 'centre' }, 10);
    const jOff = edgeVariance(jointsOff.map((f) => decodeLuma(f.crop.b64, f.crop.w, f.crop.h)));
    const jOn = edgeVariance(jointsOn.map((f) => decodeLuma(f.crop.b64, f.crop.w, f.crop.h)));
    const cOff = edgeVariance(closeOff.map((f) => decodeLuma(f.crop.b64, f.crop.w, f.crop.h)));
    const cOn = edgeVariance(closeOn.map((f) => decodeLuma(f.crop.b64, f.crop.w, f.crop.h)));
    results.taa = {
      joints: { varianceOff: jOff.variance, varianceOn: jOn.variance, edgeOff: jOff.edge, edgeOn: jOn.edge },
      close: { varianceOff: cOff.variance, varianceOn: cOn.variance, edgeOff: cOff.edge, edgeOn: cOn.edge },
    };
    console.log('TAA', JSON.stringify(results.taa));

    const ghostFull = await seq(page, { shot: 'ghost', taa: 1, ssgi: 0, read: 'strip' }, 10);
    const ghostOpen = await seq(page, { shot: 'ghost', taa: 1, ssgi: 0, clamp: 0, reject: 0, read: 'strip' }, 10);
    const ghostOpenNoMv = await seq(page, { shot: 'ghost', taa: 1, ssgi: 0, clamp: 0, reject: 0, omv: 0, read: 'strip' }, 10);
    const ghostNoOmv = await seq(page, { shot: 'ghost', taa: 1, ssgi: 0, omv: 0, read: 'strip' }, 10);
    const decG = (rows) => rows.map((f) => {
      const img = decodeLuma(f.crop.b64, f.crop.w, f.crop.h);
      const c = f.pix.card;
      img.card = { x0: c.x0 - f.crop.x, y0: c.y0 - f.crop.y, x1: c.x1 - f.crop.x, y1: c.y1 - f.crop.y };
      return img;
    });
    results.ghost = {
      full: ghostStats(decG(ghostFull)),
      openHistory: ghostStats(decG(ghostOpen)),
      openNoObjectMv: ghostStats(decG(ghostOpenNoMv)),
      noObjectMv: ghostStats(decG(ghostNoOmv)),
    };
    console.log('GHOST', JSON.stringify(results.ghost));

    const indoorOff = await seq(page, { shot: 'indoor', taa: 0, ssgi: 0, read: 'indoor' }, 2);
    const indoorOn = await seq(page, { shot: 'indoor', taa: 0, ssgi: 1, read: 'indoor' }, 12);
    const lastOff = indoorOff[indoorOff.length - 1];
    const lastOn = indoorOn[indoorOn.length - 1];
    const region = (f, key) => mean(decodeLuma(f[key].b64, f[key].w, f[key].h).data);
    results.ssgi = {
      wallOff: region(lastOff, 'wall'), wallOn: region(lastOn, 'wall'),
      pocketOff: region(lastOff, 'pocket'), pocketOn: region(lastOn, 'pocket'),
      floorOff: region(lastOff, 'floor'), floorOn: region(lastOn, 'floor'),
      probes: lastOn.pix,
    };
    console.log('SSGI', JSON.stringify(results.ssgi));

    const still = async (name, spec) => {
      const n = spec.warmup || 0;
      for (let i = 0; i < n; i++) await page.evaluate(async (s) => window.__render(s), { ...spec, i, reset: i === 0 ? 1 : 0, jpeg: 0 });
      const r = await page.evaluate(async (s) => window.__render(s), { ...spec, i: n, reset: n === 0 ? 1 : 0 });
      if (r.jpeg) saveJpeg(r.jpeg, name);
      return r;
    };
    await still('taa-joints-before.jpg', { shot: 'joints', taa: 0, jitter: 1, ssgi: 0, jpeg: 0.86, warmup: 2 });
    await still('taa-joints-after.jpg', { shot: 'joints', taa: 1, ssgi: 0, jpeg: 0.86, warmup: 6 });
    await still('taa-close-before.jpg', { shot: 'close', taa: 0, jitter: 1, ssgi: 0, jpeg: 0.86, warmup: 2 });
    await still('taa-close-after.jpg', { shot: 'close', taa: 1, ssgi: 0, jpeg: 0.86, warmup: 6 });
    await still('ssgi-indoor-before.jpg', { shot: 'indoor', taa: 0, ssgi: 0, jpeg: 0.86, warmup: 1 });
    await still('ssgi-indoor-after.jpg', { shot: 'indoor', taa: 0, ssgi: 1, jpeg: 0.86, warmup: 11 });

    results.perf = {};
    for (const mode of [{ name: 'off', taa: 0, ssgi: 0 }, { name: 'taa', taa: 1, ssgi: 0 }, { name: 'ssgi', taa: 0, ssgi: 1 }, { name: 'both', taa: 1, ssgi: 1 }]) {
      results.perf[mode.name] = await page.evaluate(async (m) => window.__perf(8, m), mode);
      console.log('PERF', mode.name, JSON.stringify(results.perf[mode.name]));
    }

    const nPlay = 36;
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', '12', '-i', '-', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(art, 'crystal-candidate-720x1280.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
    let boltCx = null;
    for (let i = 0; i < nPlay; i++) {
      const r = await page.evaluate(async (s) => window.__render(s), { shot: 'play', i, taa: 1, ssgi: 1, reset: i === 0 ? 1 : 0, jpeg: 0.84, atlas: 1 });
      if (i === 0) boltCx = r.pix.bolt.x / 720;
      ff.stdin.write(Buffer.from(r.jpeg, 'base64'));
    }
    ff.stdin.end();
    const ffCode = await new Promise((resolve) => ff.on('close', resolve));
    results.play = { frames: nPlay, fps: 12, boltCentreX: boltCx, ffmpeg: ffCode };
    console.log('PLAY', JSON.stringify(results.play));

    writeFileSync(join(outDir, 'results.json'), JSON.stringify(results, null, 2));
    writeFileSync(join(art, 'post449-results.json'), JSON.stringify(results, null, 2));

    const fail = [];
    const tv = (label, row) => {
      if (!(row.varianceOn < row.varianceOff * 0.75)) fail.push(`${label} variance ${row.varianceOn} vs ${row.varianceOff}`);
      if (!(row.edgeOn > row.edgeOff * 0.55)) fail.push(`${label} edge collapsed ${row.edgeOn} vs ${row.edgeOff}`);
    };
    tv('joints', results.taa.joints);
    tv('close', results.taa.close);
    const g = results.ghost;
    if (!(g.full.wake < g.openHistory.wake - 0.05)) fail.push(`wake ${g.full.wake} not below open history ${g.openHistory.wake}`);
    if (!(g.openHistory.centre > g.openNoObjectMv.centre + 0.05)) fail.push(`object mv coat ${g.openHistory.centre} vs ${g.openNoObjectMv.centre}`);
    const s = results.ssgi;
    if (!(s.floorOff > s.wallOff * 1.4)) fail.push(`floor ${s.floorOff} is not brighter than the shadowed wall ${s.wallOff}`);
    const dWall = s.wallOn - s.wallOff, dPocket = s.pocketOn - s.pocketOff;
    if (!(dWall > 0.015)) fail.push(`wall gain ${dWall} is too small`);
    if (!(dWall > dPocket * 1.5)) fail.push(`leak: wall gain ${dWall} pocket gain ${dPocket}`);
    if (!(Math.abs(results.play.boltCentreX - 0.5) < 0.03)) fail.push(`bolt centre ${results.play.boltCentreX}`);
    if (ffCode !== 0) fail.push('ffmpeg ' + ffCode);
    if (fail.length) {
      console.log('FAIL\n' + fail.join('\n'));
      process.exitCode = 1;
    } else console.log('PASS');
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

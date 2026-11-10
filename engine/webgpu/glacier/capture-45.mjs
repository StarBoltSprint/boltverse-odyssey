// One 45 s third-person chase. 720×1280, 30 fps, 1350 frames.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { serve, withChrome } from './chrome.mjs';
import { CANDIDATE } from './biome.js';

const webgpu = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outDir = process.env.GLACIER_OUT || '/opt/cursor/artifacts';
const frames = Number(process.env.GLACIER_FRAMES || 1350);
const fps = 30;
const dir = '/tmp/glacier-45';
const telemPath = path.join(dir, 'telem.ndjson');
const resume = process.env.GLACIER_RESUME === '1' && fs.existsSync(telemPath);
if (!resume) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}
fs.mkdirSync(outDir, { recursive: true });
const telem = fs.createWriteStream(telemPath, { flags: resume ? 'a' : 'w' });
let start = 0;
if (resume) {
  start = fs.readFileSync(telemPath, 'utf8').trim().split('\n').filter(Boolean).length;
  console.log('resume from', start);
}

const port = 8765;
const server = await serve(webgpu, port);
const t0 = Date.now();
let fail = 0;
try {
  const chaseUrl = `http://127.0.0.1:${port}/glacier/glacier.html?cap=1&w=720&h=1280&candidate=${CANDIDATE}`;
  await withChrome({
    debugPort: 9371,
    url: chaseUrl,
    tries: 120,
    fn: async ({ evalJson }) => {
      const centers = [];
      if (resume) {
        for (const line of fs.readFileSync(telemPath, 'utf8').trim().split('\n')) {
          const row = JSON.parse(line);
          if (row.boltPx) centers.push(row.boltPx[0]);
        }
      }
      for (let i = start; i < frames; i++) {
        const t = 1 + i / fps;
        const payload = await evalJson(`window.__glacierFrame(${t}).then(r => JSON.stringify(r))`);
        if (payload.info.gpuErr) throw new Error(payload.info.gpuErr);
        const id = String(i).padStart(4, '0');
        fs.writeFileSync(path.join(dir, `f_${id}.png`), Buffer.from(payload.png, 'base64'));
        if (payload.mask) fs.writeFileSync(path.join(dir, `m_${id}.png`), Buffer.from(payload.mask, 'base64'));
        const info = payload.info;
        telem.write(JSON.stringify({
          i, t, x: info.x, z: info.z, y: info.y, psi: info.psi, cam: info.cam,
          v: info.v, phase: info.phase, eye: info.eye, boltPx: info.boltPx,
        }) + '\n');
        if (info.boltPx) centers.push(info.boltPx[0]);
        if (i % 30 === 0) {
          const px = info.boltPx ? info.boltPx.map((n) => Math.round(n)).join(',') : 'off';
          console.log(`frame ${i} z=${info.z.toFixed(1)} v=${info.v.toFixed(2)} bolt=${px} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
        }
      }
      const mid = centers.slice(30);
      const mean = mid.reduce((s, v) => s + v, 0) / mid.length;
      if (Math.abs(mean - 360) > 28) throw new Error('Bolt not centred ' + mean.toFixed(1));
      fs.writeFileSync(path.join(dir, 'center.json'), JSON.stringify({ boltCenterX: mean, n: mid.length }));
    },
  });
  telem.end();
  const mp4 = path.join(outDir, 'glacier-chase-45s.mp4');
  let crf = 20;
  for (;;) {
    const enc = spawnSync('ffmpeg', [
      '-y', '-v', 'error', '-framerate', String(fps), '-i', path.join(dir, 'f_%04d.png'),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', String(crf), '-movflags', '+faststart',
      mp4,
    ], { encoding: 'utf8' });
    if (enc.status !== 0) throw new Error(enc.stderr.slice(-500));
    const size = fs.statSync(mp4).size;
    if (size < 40 * 1024 * 1024 || crf >= 28) break;
    crf += 2;
  }
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,nb_frames,duration,codec_name,pix_fmt', '-of', 'json', mp4], { encoding: 'utf8' });
  console.log(probe.stdout);
  console.log('bytes', fs.statSync(mp4).size, 'crf', crf);
  console.log('CAPTURE_45_DONE', ((Date.now() - t0) / 1000).toFixed(1) + 's');
} catch (err) {
  console.error('FAIL', err && err.stack || err);
  fail++;
} finally {
  telem.end();
  server.close();
}
if (fail) process.exit(1);

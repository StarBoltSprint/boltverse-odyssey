// Six follow stills, planet and sky crops, optional 2 s chase.
// Not a live route. Port stays off 8970.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { serve, withChrome } from './chrome.mjs';
import { CANDIDATE } from './biome.js';
import { TIMES, loadRgb, scoreFrame, chasePoses, skyFraction, skylineRow } from './planet-sky-gate.mjs';
import { buildWorld } from './world.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const webgpu = path.resolve(here, '..');
const tag = process.argv[2] || 'before';
const outDir = path.join(here, 'artifacts/d9', tag);
const filmOnly = process.argv.includes('--film');
fs.mkdirSync(outDir, { recursive: true });

function writePng(file, b64) {
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
}

function crop(src, dst, x, y, rw, rh, W, H) {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(W, x0 + Math.round(rw));
  const y1 = Math.min(H, y0 + Math.round(rh));
  spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-vf', `crop=${x1 - x0}:${y1 - y0}:${x0}:${y0}`, dst]);
}

const port = 8779;
const server = await serve(webgpu, port);
const world = buildWorld();
const poses = chasePoses(world);
let fail = 0;
try {
  const url = `http://127.0.0.1:${port}/glacier/glacier.html?cap=1&w=720&h=1280&candidate=${CANDIDATE}`;
  const captured = await withChrome({
    debugPort: 9394,
    url,
    tries: 120,
    fn: async ({ evalJson }) => {
      const info0 = await evalJson('JSON.stringify(window.__glacierInfo)');
      const rows = [];
      if (!filmOnly) {
        const only = process.env.D9_ONLY ? Number(process.env.D9_ONLY) : null;
        for (const t of TIMES) {
          if (only != null && Math.abs(t - only) > 1e-6) continue;
          const payload = await evalJson(`window.__glacierFrame(${t}).then(r => JSON.stringify(r))`);
          if (payload.info.gpuErr) throw new Error(payload.info.gpuErr);
          const file = path.join(outDir, `t${t}.png`);
          writePng(file, payload.png);
          const mask = await evalJson('window.__glacierPlanetMask().then(r => JSON.stringify(r))');
          const maskFile = path.join(outDir, `mask-t${t}.png`);
          if (!mask.gpuErr) writePng(maskFile, mask.png);
          rows.push({ t, file, maskFile, info: { ...payload.info, cardH: info0.cardH } });
          console.log('still', t, 'bolt', payload.info.boltPx, 'tris', payload.info.tris, 'draws', payload.info.draws);
        }
      }
      let film = null;
      if (filmOnly) {
        const dir = path.join(outDir, 'film-frames');
        fs.rmSync(dir, { recursive: true, force: true });
        fs.mkdirSync(dir);
        const fps = 30;
        const n = 60;
        const t0 = 5.10;
        for (let i = 0; i < n; i++) {
          const t = +(t0 + i / fps).toFixed(5);
          const payload = await evalJson(`window.__glacierFrame(${t}).then(r => JSON.stringify({png:r.png, info:r.info}))`);
          if (payload.info.gpuErr) throw new Error(payload.info.gpuErr);
          writePng(path.join(dir, `f_${String(i).padStart(4, '0')}.png`), payload.png);
          if (i % 15 === 0) console.log('film frame', i, 'z', payload.info.z);
        }
        const mp4 = path.join(outDir, 'chase-2s.mp4');
        const enc = spawnSync('ffmpeg', [
          '-y', '-framerate', '30', '-i', path.join(dir, 'f_%04d.png'),
          '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-movflags', '+faststart',
          mp4,
        ], { encoding: 'utf8' });
        if (enc.status !== 0) throw new Error(enc.stderr.slice(-400));
        fs.rmSync(dir, { recursive: true, force: true });
        const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,nb_frames,duration,codec_name', '-of', 'json', mp4], { encoding: 'utf8' });
        film = { file: 'chase-2s.mp4', probe: JSON.parse(probe.stdout) };
        console.log('film', probe.stdout);
      }
      return { rows, film };
    },
  });
  const scores = [];
  for (const row of captured.rows) {
    const pose = poses.find((p) => p.t === row.t);
    const img = loadRgb(row.file);
    const mask = row.maskFile && fs.existsSync(row.maskFile) ? loadRgb(row.maskFile).rgb : null;
    const scored = scoreFrame(img.rgb, img.w, img.h, pose, mask);
    const cx = pose.center[0];
    const cy = pose.center[1];
    const rad = pose.rad;
    crop(row.file, path.join(outDir, `planet-t${row.t}.png`), cx - rad - 8, cy - rad - 8, rad * 2 + 16, rad * 2 + 16, img.w, img.h);
    crop(row.file, path.join(outDir, `sky-t${row.t}.png`), 0, 0, img.w, 96, img.w, img.h);
    scores.push({
      t: row.t,
      boltPx: row.info.boltPx,
      tris: row.info.tris,
      draws: row.info.draws,
      cardH: row.info.cardH,
      x: row.info.x,
      z: row.info.z,
      skyFraction: skyFraction(img.rgb, img.w, img.h, pose),
      skylineRow: skylineRow(img.rgb, img.w, img.h, pose),
      banding: scored.banding,
      planet: scored.planet,
      pass: scored.pass,
    });
  }
  const scorePath = path.join(outDir, 'scores.json');
  let prior = {};
  if (fs.existsSync(scorePath)) {
    try { prior = JSON.parse(fs.readFileSync(scorePath, 'utf8')); } catch { prior = {}; }
  }
  const report = {
    tag,
    scores: scores.length ? scores : (prior.scores || []),
    film: captured.film || prior.film || null,
  };
  fs.writeFileSync(scorePath, JSON.stringify(report, null, 2) + '\n');
  console.log(tag, scores.map((s) => `${s.t}:${s.pass ? 'PASS' : 'FAIL'}`).join(' '));
} catch (err) {
  console.error('FAIL', err && err.stack || err);
  fail++;
} finally {
  server.close();
}
if (fail) process.exit(1);

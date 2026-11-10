// World-anchored sky. The same direction, from different eyes and at different
// screen positions, stays within 0.015. A screen-space addition must fail.
// The limit is 0.015. It is not raised.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { skyDelta, dirFrom } from '../biome-factory/procedural-sky.js';
import { serve, withChrome } from './chrome.mjs';
import { CANDIDATE } from './biome.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const webgpu = path.resolve(here, '..');
const LIMIT = 0.015;

function lin(byte) { return (byte / 255) ** 2.2; }
function round5(n) { return Math.round(n * 1e5) / 1e5; }

const dirs = [dirFrom(50, 0.5), dirFrom(64, 2.4), dirFrom(76, 4.1)];
const eyes = [[0, 540, 60], [110, 470, -180]];

function pose(eye, dir, yawOff, pitchOff) {
  const yaw = Math.atan2(dir[0], dir[2]) + yawOff;
  const pitch = Math.asin(Math.max(-1, Math.min(1, dir[1]))) + pitchOff;
  const cp = Math.cos(pitch);
  const fwd = [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp];
  return {
    eye,
    tgt: [eye[0] + fwd[0] * 50, eye[1] + fwd[1] * 50, eye[2] + fwd[2] * 50],
    dir,
  };
}

const shots = [];
for (const dir of dirs) {
  for (const eye of eyes) {
    for (const yawOff of [-0.16, 0.16]) shots.push(pose(eye, dir, yawOff, yawOff * 0.25));
  }
}

const port = 8766;
const server = await serve(webgpu, port);
let fail = 0;
try {
  const url = `http://127.0.0.1:${port}/glacier/glacier.html?cap=1&w=720&h=1280&candidate=${CANDIDATE}`;
  const result = await withChrome({
    debugPort: 9355,
    url,
    fn: async ({ evalJson }) => {
      const groups = dirs.map(() => []);
      for (let i = 0; i < shots.length; i++) {
        const shot = shots[i];
        const frame = await evalJson(`window.__glacierSky(${JSON.stringify({
          eye: shot.eye, tgt: shot.tgt, swim: 0, yaw: 0, dirs: [shot.dir],
        })}).then(r => JSON.stringify(r))`);
        const sample = frame.samples && frame.samples[0];
        if (!sample || sample[5] !== 5) continue;
        groups[dirs.indexOf(shot.dir)].push([lin(sample[0]), lin(sample[1]), lin(sample[2]), sample[3], sample[4]]);
      }
      const negShot = shots[0];
      const clean = groups[0][0];
      const neg = await evalJson(`window.__glacierSky(${JSON.stringify({
        eye: negShot.eye, tgt: negShot.tgt, swim: 1, yaw: 1.3, dirs: [negShot.dir],
      })}).then(r => JSON.stringify(r))`);
      const ns = neg.samples && neg.samples[0];
      const negDelta = ns && clean ? skyDelta([lin(ns[0]), lin(ns[1]), lin(ns[2])], clean.slice(0, 3)) : null;
      return { groups, negDelta };
    },
  });
  let worst = 0;
  let samples = 0;
  const spreads = [];
  for (const g of result.groups) {
    samples += g.length;
    let span = 0;
    for (let i = 0; i < g.length; i++) {
      for (let j = i + 1; j < g.length; j++) span = Math.max(span, skyDelta(g[i], g[j]));
    }
    spreads.push(round5(span));
    worst = Math.max(worst, span);
    if (g.length < 3) { console.error('FAIL direction left the sky'); fail++; }
  }
  const report = {
    samples,
    perDirection: spreads,
    worst: round5(worst),
    limit: LIMIT,
    negativeControl: result.negDelta == null ? null : round5(result.negDelta),
    blocking: true,
  };
  fs.mkdirSync(path.join(here, 'artifacts'), { recursive: true });
  fs.writeFileSync(path.join(here, 'artifacts', 'sky-anchor.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  if (!(worst <= LIMIT)) { console.error('FAIL sky moved ' + worst); fail++; }
  if (!(result.negDelta > LIMIT)) { console.error('FAIL screen-space control did not fail ' + result.negDelta); fail++; }
} catch (err) {
  console.error('FAIL', err && err.stack || err);
  fail++;
} finally {
  server.close();
}
if (fail) process.exit(1);
console.log('PASS sky-anchor');

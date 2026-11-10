import fs from 'fs';
import { measureSky, skySeen, skyDelta, dirFrom } from './procedural-sky.js';

let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };
const page = fs.readFileSync(new URL('../crystal/crystal.js', import.meta.url), 'utf8');
const cfg = JSON.parse(fs.readFileSync(new URL('../crystal/biome.factory.json', import.meta.url), 'utf8'));
const sky = measureSky({ pageSource: page, plate: cfg.sky, procedural: cfg.proceduralSky });
if (sky.release !== 'HOLD' || sky.procedural.release !== 'HOLD') bad('sky marked released');
if (sky.procedural.status === 'PASS') bad('procedural sky was marked PASS');
if (sky.procedural.status !== 'CANDIDATE') bad('procedural status ' + sky.procedural.status + ' ' + JSON.stringify(sky.procedural.checks));
if (sky.imaginePlate.status !== 'BLOCKED') bad('plate status ' + sky.imaginePlate.status);
if (sky.procedural.checks.cameraDelta > 1e-9) bad('fixed direction changed with camera ' + sky.procedural.checks.cameraDelta);
if (sky.procedural.checks.seam > 1e-9) bad('seam ' + sky.procedural.checks.seam);
if (!sky.procedural.checks.separatePlanet) bad('planet is not a separate draw');

const cameras = [[0, 1.12, 0], [40, 3, -80], [-25, 8, 120], [0, 1.12, -54]];
const dir = dirFrom(12, 0.4);
const coupled = cameras.map(cam => {
  const c = skySeen(cam, dir);
  return [c[0] + cam[0] * 0.01, c[1], c[2]];
});
let moved = 0;
for (let i = 1; i < coupled.length; i++) moved = Math.max(moved, skyDelta(coupled[0], coupled[i]));
if (moved < 0.1) bad('camera positions did not move a coupled colour');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('PASS sky-sphere', sky.procedural.checks);

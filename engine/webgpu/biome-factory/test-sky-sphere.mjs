import fs from 'fs';
import { skyLinear, skyDelta, dirFrom, skyWgsl, SKY_CFG } from './procedural-sky.js';

let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };

const seam = skyDelta(skyLinear(dirFrom(20, 0)), skyLinear(dirFrom(20, Math.PI * 2)));
if (seam > 1e-9) bad('yaw 0 and 360 differ ' + seam);

let seamMax = 0;
for (let e = -5; e <= 80; e += 5) {
  const a = skyLinear(dirFrom(e, 0));
  const b = skyLinear(dirFrom(e, Math.PI * 2 - 0.004));
  seamMax = Math.max(seamMax, skyDelta(a, b));
}
if (seamMax > 0.02) bad('yaw seam ' + seamMax);

const pole = skyLinear([0, 1, 0]);
let poleMax = 0;
for (let i = 0; i < 48; i++) {
  const yaw = i / 48 * Math.PI * 2;
  poleMax = Math.max(poleMax, skyDelta(pole, skyLinear(dirFrom(89.4, yaw))));
}
if (poleMax > 0.08) bad('pole unstable ' + poleMax);
if (skyDelta(skyLinear([0, 1, 0]), skyLinear([0, 1, 0])) !== 0) bad('pole not single valued');

const south = skyLinear([0, -1, 0]);
let southMax = 0;
for (let i = 0; i < 24; i++) southMax = Math.max(southMax, skyDelta(south, skyLinear(dirFrom(-89.4, i))));
if (southMax > 0.08) bad('south pole unstable ' + southMax);

const wgsl = skyWgsl();
const body = wgsl.slice(wgsl.indexOf('fn skyColour'));
if (body.includes('u.cam')) bad('sky colour reads the camera');
if (!body.includes('normalize(dir)')) bad('sky is not a direction field');
if (wgsl.includes('sky-panorama') || wgsl.includes('environment.jpg')) bad('sky samples a plate');
if (SKY_CFG.scope !== 'crystal-candidate-only') bad('sky scope');
const page = fs.readFileSync(new URL('../crystal/crystal.js', import.meta.url), 'utf8');
if (!page.includes('skyColour(')) bad('canyon does not call the procedural sky');
if (page.includes('sky-panorama.jpg')) bad('canyon samples the rejected plate');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('PASS sky-sphere', { seamMax: +seamMax.toFixed(4), poleMax: +poleMax.toFixed(4), southMax: +southMax.toFixed(4) });

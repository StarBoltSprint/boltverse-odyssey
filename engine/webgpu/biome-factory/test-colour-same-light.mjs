import { compareSameLight, crystalColourStatus, dE76, srgbToLab, DE76_MAX, PRIOR_RAW } from './colour-same-light.mjs';

let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };
const neutral = { light_id: 'neutral-srgb', exposure: 1 };

const same = compareSameLight({ rgb: [120, 80, 160], ...neutral }, { rgb: [120, 80, 160], ...neutral });
if (same.verdict !== 'PASS' || same.dE76 !== 0 || !same.includesLightness) bad('identical colour');

const hue = compareSameLight({ rgb: [160, 70, 120], ...neutral }, { rgb: [70, 120, 160], ...neutral });
if (hue.verdict !== 'BLOCK' || hue.dE76 <= DE76_MAX) bad('hue deviation not blocked ' + hue.dE76);

const sat = compareSameLight({ rgb: [140, 60, 170], ...neutral }, { rgb: [110, 100, 120], ...neutral });
if (sat.verdict !== 'BLOCK' || sat.dE76 <= DE76_MAX) bad('saturation deviation not blocked ' + sat.dE76);

const light = compareSameLight({ rgb: [40, 42, 48], ...neutral }, { rgb: [180, 182, 188], ...neutral });
if (light.verdict !== 'BLOCK' || light.dE76 <= DE76_MAX) bad('lightness deviation not blocked ' + light.dE76);
const dL = Math.abs(srgbToLab([40, 42, 48])[0] - srgbToLab([180, 182, 188])[0]);
if (dL < 20) bad('fixture did not move L*');

const near = compareSameLight({ rgb: [100, 102, 104], ...neutral }, { rgb: [103, 105, 107], ...neutral });
if (near.verdict !== 'PASS' || near.dE76 > DE76_MAX) bad('small deviation ' + near.dE76);

const unknown = compareSameLight(
  { rgb: [74, 75, 77], light_id: 'imagine-albedo-neutral', exposure: 1 },
  { rgb: [18, 22, 40], light_id: 'scene-unknown', exposure: 1 },
);
if (unknown.verdict !== 'UNCERTAIN' || unknown.compared) bad('unknown light was scored');
if (!(unknown.rawDE76 > DE76_MAX)) bad('raw diagnostic missing ' + unknown.rawDE76);

const fit = compareSameLight(
  { rgb: [80, 80, 90], ...neutral, exposure: 1 },
  { rgb: [80, 80, 90], ...neutral, exposure: 1.8 },
);
if (fit.verdict !== 'UNCERTAIN') bad('exposure was fitted');

const crystal = crystalColourStatus();
if (crystal.verdict !== 'UNCERTAIN') bad('crystal key comparison was treated as decisive');
if (DE76_MAX !== 10) bad('threshold moved');
if (!PRIOR_RAW.use.includes('diagnostic')) bad('prior raw dropped');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('PASS colour-same-light', { hue: hue.dE76, sat: sat.dE76, light: light.dE76, near: near.dE76, raw: unknown.rawDE76 });

import { compareSameLight, crystalColourStatus, crystalRig, assessMaterial, srgbToLab, DE76_MAX, PRIOR_RAW } from './colour-same-light.mjs';

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

const bothUnknown = compareSameLight(
  { rgb: [90, 40, 140], light_id: 'scene-unknown', exposure: 1 },
  { rgb: [90, 40, 140], light_id: 'scene-unknown', exposure: 1 },
);
if (bothUnknown.verdict !== 'UNCERTAIN' || bothUnknown.compared) bad('two scene-unknown labels were treated as a known light');

const rows = crystalColourStatus([
  { id: 'ground', pixels: [[70, 72, 74], [71, 73, 75]] },
  { id: 'wall', pixels: [[20, 21, 22], [22, 23, 24]] },
]);
if (!Array.isArray(rows) || rows.length !== 2) bad('colour status is not per material');
if (rows.some(r => r.verdict !== 'UNCERTAIN' || r.rawLegacyDE76 !== null)) bad('missing target was scored');

const rig = crystalRig();
const lit = crystalColourStatus([
  { id: 'match', pixels: [[120, 80, 160], [120, 80, 160]], knownTarget: { rgb: [120, 80, 160], light_id: 'crystal-rig' } },
  { id: 'drift', pixels: [[120, 80, 160], [120, 80, 160]], knownTarget: { rgb: [20, 20, 20], light_id: 'crystal-rig' } },
  { id: 'none', pixels: [[120, 80, 160]], knownTarget: null },
], { sameLight: 'crystal-rig' });
if (lit[0].verdict !== 'PASS' || lit[0].notAMeasurement !== true) bad('crystal-rig match ' + JSON.stringify(lit[0]));
if (lit[1].verdict !== 'BLOCK' || !(lit[1].dE76 > 10)) bad('crystal-rig drift ' + JSON.stringify(lit[1]));
if (lit[2].verdict !== 'UNCERTAIN') bad('crystal-rig without target');
if (new Set(lit.map(r => r.exposure)).size !== 1) bad('exposure was fitted per material');
if (Math.abs(rig.exposure * rig.shade - 1) > 1e-9) bad('grey card exposure');

const fit = compareSameLight(
  { rgb: [80, 80, 90], ...neutral, exposure: 1 },
  { rgb: [80, 80, 90], ...neutral, exposure: 1.8 },
);
if (fit.verdict !== 'UNCERTAIN') bad('exposure was fitted');
if (DE76_MAX !== 10) bad('threshold moved');
if (!PRIOR_RAW.use.includes('diagnostic')) bad('prior raw dropped');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('PASS colour-same-light', { hue: hue.dE76, sat: sat.dE76, light: light.dE76, near: near.dE76, raw: unknown.rawDE76 });

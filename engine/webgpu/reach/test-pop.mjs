// Far structures stay visible across the whole approach. LOD may change. Visibility may not flicker.
import { makeHeight } from '../engine/bricks/heightfield.js';
import { HEIGHT_SPEC, STRUCTURES } from './biome.js';
import { buildSolid, lodForDistance } from '../engine/bricks/huge-structure.js';
import { planesFromVP, sphereVisible, cullWgsl } from '../engine/bricks/gpu-cull.js';
import { lookAt, persp, mul, LIVE_BOLT } from '../engine/bricks/follow-bolt.js';

let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };
const heightOf = makeHeight(HEIGHT_SPEC);
const aspect = 720 / 1280;
const spec = STRUCTURES.find(s => s.id === 'spire');
const solid = buildSolid(spec, 2, heightOf);
if (solid.crest - solid.y0 < 80) bad('spire short ' + (solid.crest - solid.y0));

const flips = [];
let prev = null;
let minPx = Infinity;
const lodChanges = [];
let prevLod = null;
for (let dist = 30; dist <= 12000; dist += 25) {
  const eye = [spec.x, solid.crest * 0.4, spec.z + dist];
  const tgt = [spec.x, solid.y0 + spec.height * 0.45, spec.z];
  const vp = mul(persp(LIVE_BOLT.fovDeg * Math.PI / 180, aspect, LIVE_BOLT.near, LIVE_BOLT.far), lookAt(eye, tgt, [0, 1, 0]));
  const on = sphereVisible(planesFromVP(vp), solid.sphere.center, solid.sphere.radius);
  if (!on) bad('hidden at ' + dist);
  if (prev === false && on) flips.push(dist);
  prev = on;
  const lod = lodForDistance(dist);
  if (prevLod !== null && lod !== prevLod) lodChanges.push([dist, lod]);
  prevLod = lod;
  const px = spec.height / dist * (1280 / (2 * Math.tan(LIVE_BOLT.fovDeg * Math.PI / 360)));
  minPx = Math.min(minPx, px);
}
if (minPx < 40) bad('spire under 40 px at far end ' + minPx);

const eye = [spec.x, solid.crest, spec.z - 400];
const tgt = [spec.x, solid.crest, spec.z - 800];
const away = sphereVisible(
  planesFromVP(mul(persp(LIVE_BOLT.fovDeg * Math.PI / 180, aspect, LIVE_BOLT.near, LIVE_BOLT.far), lookAt(eye, tgt, [0, 1, 0]))),
  solid.sphere.center,
  solid.sphere.radius,
);
if (away) bad('cull kept a spire behind the camera');

const wgsl = cullWgsl();
if (!wgsl.includes('dot(pl.xyz, s.center) + pl.w < -s.radius')) bad('gpu cull dropped the sphere test');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log(JSON.stringify({
  pass: 'pop',
  spireM: +(solid.crest - solid.y0).toFixed(1),
  farPx: +minPx.toFixed(1),
  flips,
  lodChanges,
  behindCulled: !away,
}));

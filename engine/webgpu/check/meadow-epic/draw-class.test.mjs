// Paired omit schedule. No browser, no phone, no GPU picture.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DRAW_CLASS_BUILD, OMIT, SUBMITTED, classAt, drawMask, pairDeltas } from '../../engine/bricks/draw-class.js';
import { makePassTimer } from '../../engine/bricks/pass-timer-cls.js';
import { clsFromScratch } from '../../cls-install/transform.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '../..');
const scratch = readFileSync(join(repo, 'diag-install/reference/m448aaa3.js'), 'utf8');
const page = clsFromScratch(scratch);

assert.equal(SUBMITTED.grassVerts, 988200);
assert.equal(SUBMITTED.groundVerts, 98304);
assert.equal(SUBMITTED.nearTreeVerts, 1446);
assert.equal(SUBMITTED.samples, 4);
assert.equal(DRAW_CLASS_BUILD, 'm448aaa3-cls1');

const names = Array.from({ length: 64 }, (_, i) => classAt(i));
assert.equal(names.filter((n) => n === 'all').length, 32);
for (const cls of OMIT) assert.equal(names.filter((n) => n === cls).length, 8, cls);
for (let i = 1; i < 64; i += 2) assert.equal(names[i - 1], 'all');
assert.deepEqual(names.slice(0, 8), ['all', 'no-grass', 'all', 'no-ground', 'all', 'no-trees', 'all', 'no-shadow-trees']);

const all = drawMask('all');
assert.deepEqual(all, { ground: true, trees: true, grass: true, shadowTrees: true });
assert.equal(drawMask('no-grass').grass, false);
assert.equal(drawMask('no-grass').ground, true);
assert.equal(drawMask('no-grass').shadowTrees, true);
assert.equal(drawMask('no-ground').ground, false);
assert.equal(drawMask('no-ground').grass, true);
assert.equal(drawMask('no-trees').trees, false);
assert.equal(drawMask('no-trees').shadowTrees, true);
assert.equal(drawMask('no-shadow-trees').shadowTrees, false);
assert.equal(drawMask('no-shadow-trees').trees, true);

function gpu(mainNs, shadowNs) {
  return {
    main: { status: 'ok', ns: mainNs },
    shadow: { status: 'ok', ns: shadowNs },
  };
}
const samples = [
  { cls: 'all', gpu: gpu(70e6, 26e6) },
  { cls: 'no-grass', gpu: gpu(30e6, 26e6) },
  { cls: 'all', gpu: gpu(72e6, 25e6) },
  { cls: 'no-ground', gpu: gpu(50e6, 25e6) },
  { cls: 'all', gpu: gpu(71e6, 27e6) },
  { cls: 'no-trees', gpu: gpu(60e6, 27e6) },
  { cls: 'all', gpu: gpu(69e6, 28e6) },
  { cls: 'no-shadow-trees', gpu: gpu(69e6, 8e6) },
  { cls: 'all', gpuStatus: 'dropped', gpu: null },
  { cls: 'no-grass', gpu: gpu(10e6, 10e6) },
];
const paired = pairDeltas(samples);
assert.equal(paired.delta['no-grass'].n, 1);
assert.equal(paired.delta['no-grass'].median, 40e6);
assert.equal(paired.delta['no-grass'].control.median, 0);
assert.equal(paired.delta['no-ground'].median, 22e6);
assert.equal(paired.delta['no-trees'].median, 11e6);
assert.equal(paired.delta['no-shadow-trees'].pass, 'shadow');
assert.equal(paired.delta['no-shadow-trees'].median, 20e6);
assert.equal(paired.delta['no-shadow-trees'].control.median, 0);
assert.equal(paired.pairs.length, 4);

const args = (s) => [...s.matchAll(/\b(?:pass|sp)\.draw\(([^)]*)\)/g)].map((m) => m[1]);
assert.deepEqual(args(page), args(scratch));
assert.equal(page.includes('paceFrame'), false);
assert.equal(page.includes('grassHidden'), false);
assert.equal(page.includes('stepLive(dt)'), true);
assert.equal(page.includes('const SAMPLES = 4'), true);
assert.equal(page.includes('const G = 200'), true);
assert.equal(page.includes('const SM = 1024'), true);
assert.equal(page.includes('pass.setPipeline(pBolt); pass.draw(6);'), true);
assert.equal(page.includes('mask.bolt'), false);
const groundAt = page.indexOf('pass.draw(6 * 128 * 128)');
const treeAt = page.indexOf('pass.setPipeline(pTree3)');
const boltAt = page.indexOf('pass.setPipeline(pBolt)');
const grassAt = page.indexOf('pass.draw(15, G * G)');
assert.ok(groundAt < treeAt && treeAt < boltAt && boltAt < grassAt);

globalThis.GPUBufferUsage = globalThis.GPUBufferUsage || { QUERY_RESOLVE: 1, COPY_SRC: 2, COPY_DST: 4, MAP_READ: 8 };
globalThis.GPUMapMode = globalThis.GPUMapMode || { READ: 1 };
const dev = {
  features: new Set(['timestamp-query']),
  createQuerySet() { return { destroy() {} }; },
  createBuffer() {
    return {
      mapAsync() { return Promise.resolve(); },
      getMappedRange() { return new BigInt64Array(16); },
      unmap() {},
      destroy() {},
    };
  },
};
const timer = makePassTimer(dev);
const enc = { resolveQuerySet() {}, copyBufferToBuffer() {} };
timer.begin();
timer.stamp('shadow');
timer.stamp('main');
timer.resolve(enc);
const sample = timer.record({ wallMs: 84.7, cpuPrepMs: 0.4, cpuEncodeMs: 0.4, cls: 'all' });
assert.equal(sample.cls, 'all');
const exported = timer.export();
assert.equal(exported.samples[0].cls, 'all');
assert.equal(exported.kind, 'pass-profile');
timer.destroy();

console.log('PASS draw-class', { grassVerts: SUBMITTED.grassVerts, pairs: paired.pairs.length });

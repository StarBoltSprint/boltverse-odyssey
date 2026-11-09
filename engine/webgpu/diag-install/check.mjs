// Proves the diagnostic page keeps the live play configuration and only observes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyFrames, diagOn, diagText } from './files/engine/bricks/frame-diag.js';

const root = dirname(fileURLToPath(import.meta.url));
const base = readFileSync(join(root, 'reference/m448aaa3.js'), 'utf8');
const diag = readFileSync(join(root, 'files/m448aaa3-diag.js'), 'utf8');
const html = readFileSync(join(root, 'files/m448aaa3-diag.html'), 'utf8');
const baseHtml = readFileSync(join(root, 'reference/m448aaa3.html'), 'utf8');

const keys = [
  'Math.min(devicePixelRatio, 2)',
  'const SAMPLES = 4',
  'const G = 200',
  'pass.draw(15, G * G)',
  'pass.draw(15, 150 * 150, 0, G * G)',
  'pass.draw(3, 130 * 130, 0, G * G + 150 * 150)',
  'cf[0] * 2.35',
  'persp(62 * D2R',
  'const SM = 1024',
  'const SPEED = IDLE.cfg.speed',
  'IDLE.stepMotion(live, dt, runWanted())',
  'stepLive(dt)',
  "loadTex(dev, A + 'bolt439_atlas.png', false)",
  "loadTex(dev, A + 'ground_2560.jpg', true)",
  "loadTex(dev, A + 'sky_4096x2048_wrap.jpg', false)",
];
for (const k of keys) {
  assert.ok(base.includes(k), 'baseline missing ' + k);
  assert.equal(diag.includes(k), true, 'diag missing ' + k);
  assert.equal(count(base, k), count(diag, k), 'count changed for ' + k);
}
assert.equal(base.includes('makeMeadowRoute'), false);
assert.equal(diag.includes('makeMeadowRoute'), false);
assert.equal(diag.includes("Math.min(0.05, wall)"), true);
assert.equal(diag.includes('const wall = (now - last) / 1000;'), true);
assert.equal(diag.includes('if (diag) {'), true);
assert.equal(diag.includes("import { makeFrameDiag, diagText } from './engine/bricks/frame-diag.js?v=diag1';"), true);

const baseImports = [...base.matchAll(/^import .+$/gm)].map((m) => m[0]);
for (const line of baseImports) assert.ok(diag.includes(line), 'dropped import ' + line);
const diagImports = [...diag.matchAll(/^import .+$/gm)].map((m) => m[0]);
const extra = diagImports.filter((l) => !baseImports.includes(l));
assert.deepEqual(extra, ["import { makeFrameDiag, diagText } from './engine/bricks/frame-diag.js?v=diag1';"]);

assert.equal(diagOn(''), false);
assert.equal(diagOn('?v=9collide'), false);
assert.equal(diagOn('?diag=0'), false);
assert.equal(diagOn('?diag=1'), true);
assert.match(html, /m448aaa3-diag\.js\?v=diag1/);
assert.match(html, /id="diag" hidden/);
assert.doesNotMatch(html, /m448aaa3\.js/);
assert.match(baseHtml, /m448aaa3\.js\?v=38/);
assert.equal(html.includes('canvas{display:block;width:100%;height:100%'), true);

const steady = classifyFrames(Array.from({ length: 12 }, () => ({ wall: 1 / 60, applied: 1 / 60, speed: 7 })));
assert.equal(steady.kind, 'steady');
assert.ok(Math.abs(steady.metresPerSec - 7) < 0.05);
const capped = classifyFrames(Array.from({ length: 12 }, () => ({ wall: 0.08, applied: 0.05, speed: 7 })));
assert.equal(capped.kind, 'slow-frames-capped-sim');
assert.ok(Math.abs(capped.metresPerSec - (7 * 0.05 / 0.08)) < 0.05);
const text = diagText(steady, { vendor: 'q', architecture: 'a', device: '', description: '', isFallback: false });
assert.match(text, /wall med /);
assert.match(text, /p95 /);
assert.match(text, /m\/s/);
assert.match(text, /gpu time not measured/);
assert.equal(diagText(classifyFrames([]), null).startsWith('warming'), true);

function count(s, k) { return s.split(k).length - 1; }
console.log('PASS diag-install check');

// The pace page is the installed diagnostic plus one import and a new frame loop.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, cpSync, writeFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { paceFromDiag } from './transform.mjs';
import { paceSteps } from './files/engine/bricks/sim-pace.js';

const root = dirname(fileURLToPath(import.meta.url));
const repo = join(root, '..');
const diag = readFileSync(join(repo, 'diag-install/files/m448aaa3-diag.js'), 'utf8');
const pace = readFileSync(join(root, 'files/m448aaa3-pace.js'), 'utf8');
const html = readFileSync(join(root, 'files/m448aaa3-pace.html'), 'utf8');
const diagHtml = readFileSync(join(repo, 'diag-install/files/m448aaa3-diag.html'), 'utf8');
const sim = readFileSync(join(root, 'files/engine/bricks/sim-pace.js'), 'utf8');
const simSrc = readFileSync(join(repo, 'engine/bricks/sim-pace.js'), 'utf8');
assert.equal(pace, paceFromDiag(diag));
assert.equal(sim, simSrc);

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
  "loadTex(dev, A + 'bolt439_atlas.png', false)",
  "loadTex(dev, A + 'ground_2560.jpg', true)",
  "loadTex(dev, A + 'sky_4096x2048_wrap.jpg', false)",
  'function stepLive(dt)',
];
for (const k of keys) assert.equal(count(pace, k), count(diag, k), k);
assert.equal(count(diag, 'stepLive(dt)'), 3);
assert.equal(count(pace, 'stepLive(dt)'), 2);
assert.equal(pace.includes('Math.min(0.05, wall)'), false);
assert.equal(pace.includes('makeMeadowRoute'), false);
assert.equal(diag.includes('makeMeadowRoute'), false);
const body = (s) => s.slice(s.indexOf('function stepLive(dt)'), s.indexOf('return live;\n}') + 'return live;\n}'.length);
assert.equal(body(pace), body(diag));

const style = (s) => s.slice(s.indexOf('<style>'), s.indexOf('</style>') + 8);
assert.equal(style(html), style(diagHtml));
assert.match(html, /m448aaa3-pace\.js\?v=pace1/);
assert.doesNotMatch(html, /m448aaa3-diag\.js/);
assert.doesNotMatch(html, /src="\.\/m448aaa3\.js/);
assert.match(html, /id="diag" hidden/);

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
assert.ok(Math.abs(sum(paceSteps(0.0847)) - 0.0847) < 1e-9);
assert.ok(Math.abs(sum(paceSteps(0.2051)) - 0.2051) < 1e-9);
for (const dt of paceSteps(0.2051)) assert.ok(dt <= 0.05 + 1e-12);
assert.ok(Math.abs(sum(paceSteps(2)) - 0.5) < 1e-9);

const listed = parse(readFileSync(join(root, 'manifest.sha256'), 'utf8'));
assert.deepEqual(listed.map((r) => r.dest).sort(), [
  'engine/bricks/sim-pace.js',
  'm448aaa3-pace.html',
  'm448aaa3-pace.js',
].sort());
for (const row of listed) {
  assert.equal(sha(readFileSync(join(root, 'files', row.dest))), row.sha, row.dest);
}
const guards = parse(readFileSync(join(root, 'baseline.sha256'), 'utf8'));
const guardFile = {
  'm448aaa3.html': join(repo, 'diag-install/reference/m448aaa3.html'),
  'm448aaa3.js': join(repo, 'diag-install/reference/m448aaa3.js'),
  'm448aaa3-diag.html': join(repo, 'diag-install/files/m448aaa3-diag.html'),
  'm448aaa3-diag.js': join(repo, 'diag-install/files/m448aaa3-diag.js'),
  'engine/bricks/frame-diag.js': join(repo, 'diag-install/files/engine/bricks/frame-diag.js'),
};
assert.deepEqual(guards.map((r) => r.dest).sort(), Object.keys(guardFile).sort());
for (const row of guards) assert.equal(sha(readFileSync(guardFile[row.dest])), row.sha, row.dest);

const roots = [];
try {
  const collidedRoot = guardRoot();
  writeFileSync(join(collidedRoot, 'm448aaa3-pace.html'), 'not the page');
  const collided = run(collidedRoot, 'install.sh');
  assert.equal(collided.status, 1, collided.stderr);
  assert.equal(existsSync(join(collidedRoot, 'm448aaa3-pace.js')), false);
  assert.equal(existsSync(join(collidedRoot, 'engine/bricks/sim-pace.js')), false);

  const mismatchRoot = guardRoot();
  writeFileSync(join(mismatchRoot, 'm448aaa3.js'), 'changed');
  const mismatch = run(mismatchRoot, 'install.sh');
  assert.equal(mismatch.status, 2, mismatch.stderr);
  assert.equal(existsSync(join(mismatchRoot, 'm448aaa3-pace.js')), false);

  const work = guardRoot();
  const ok = run(work, 'install.sh');
  assert.equal(ok.status, 0, ok.stderr);
  for (const row of listed) assert.equal(sha(readFileSync(join(work, row.dest))), row.sha);
  for (const row of guards) assert.equal(sha(readFileSync(join(work, row.dest))), row.sha);
  const again = run(work, 'install.sh');
  assert.equal(again.status, 0, again.stderr);
  assert.match(again.stdout, /same m448aaa3-pace.js/);
  const back = run(work, 'uninstall.sh');
  assert.equal(back.status, 0, back.stderr);
  for (const row of listed) assert.equal(existsSync(join(work, row.dest)), false);
  for (const row of guards) assert.equal(sha(readFileSync(join(work, row.dest))), row.sha);
} finally {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true });
}

function guardRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'pace-drill-'));
  roots.push(dir);
  for (const [dest, src] of Object.entries(guardFile)) {
    const out = join(dir, dest);
    mkdirSync(dirname(out), { recursive: true });
    cpSync(src, out);
  }
  return dir;
}
function sha(buf) { return createHash('sha256').update(buf).digest('hex'); }
function count(s, k) { return s.split(k).length - 1; }
function parse(text) {
  return text.split('\n').filter((l) => l && !l.startsWith('#')).map((l) => {
    const [hash, dest] = l.split(/\s+/);
    return { sha: hash, dest };
  });
}
function run(dir, script) {
  return spawnSync('sh', [join(root, script), dir], { encoding: 'utf8' });
}
console.log('PASS pace-install check');

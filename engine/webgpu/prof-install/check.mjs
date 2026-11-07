// The profile page is the pace page plus timestamp instrumentation.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, cpSync, writeFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { profFromPace } from './transform.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const repo = join(root, '..');
const pace = readFileSync(join(repo, 'pace-install/files/m448aaa3-pace.js'), 'utf8');
const prof = readFileSync(join(root, 'files/m448aaa3-prof.js'), 'utf8');
const html = readFileSync(join(root, 'files/m448aaa3-prof.html'), 'utf8');
const timer = readFileSync(join(root, 'files/engine/bricks/pass-timer.js'), 'utf8');
const timerSrc = readFileSync(join(repo, 'engine/bricks/pass-timer.js'), 'utf8');
assert.equal(prof, profFromPace(pace));
assert.equal(timer, timerSrc);
assert.equal(prof.includes('gpuTime: null'), false);
assert.equal(prof.includes('paceFrame(wall, stepLive)'), true);
assert.equal(prof.includes('makeMeadowRoute'), false);
assert.equal(pace.includes('makeMeadowRoute'), false);
const draws = (s) => s.split('\n').filter((l) => /\b(?:pass|sp)\.draw\(/.test(l));
assert.deepEqual(draws(prof), draws(pace));
assert.equal(count(prof, 'p.draw(3)'), 1);
assert.equal(count(pace, 'p.draw(3)'), 1);
const body = (s) => s.slice(s.indexOf('function stepLive(dt)'), s.indexOf('return live;\n}') + 'return live;\n}'.length);
assert.equal(body(prof), body(pace));
const keys = [
  'Math.min(devicePixelRatio, 2)',
  'const SAMPLES = 4',
  'const G = 200',
  'const SM = 1024',
  'const SPEED = IDLE.cfg.speed',
  'cf[0] * 2.35',
  "loadTex(dev, A + 'bolt439_atlas.png', false)",
  "loadTex(dev, A + 'ground_2560.jpg', true)",
  "loadTex(dev, A + 'sky_4096x2048_wrap.jpg', false)",
];
for (const k of keys) assert.equal(count(prof, k), count(pace, k), k);
assert.match(html, /m448aaa3-prof\.js\?v=prof1/);
assert.match(html, /id="diag" hidden/);
assert.doesNotMatch(html, /m448aaa3-pace\.js/);
assert.doesNotMatch(html, /m448aaa3-diag\.js/);

const listed = parse(readFileSync(join(root, 'manifest.sha256'), 'utf8'));
assert.deepEqual(listed.map((r) => r.dest).sort(), [
  'engine/bricks/pass-timer.js',
  'm448aaa3-prof.html',
  'm448aaa3-prof.js',
].sort());
for (const row of listed) assert.equal(sha(readFileSync(join(root, 'files', row.dest))), row.sha, row.dest);

const guardFile = {
  'm448aaa3.html': join(repo, 'diag-install/reference/m448aaa3.html'),
  'm448aaa3.js': join(repo, 'diag-install/reference/m448aaa3.js'),
  'm448aaa3-diag.html': join(repo, 'diag-install/files/m448aaa3-diag.html'),
  'm448aaa3-diag.js': join(repo, 'diag-install/files/m448aaa3-diag.js'),
  'engine/bricks/frame-diag.js': join(repo, 'diag-install/files/engine/bricks/frame-diag.js'),
  'm448aaa3-pace.html': join(repo, 'pace-install/files/m448aaa3-pace.html'),
  'm448aaa3-pace.js': join(repo, 'pace-install/files/m448aaa3-pace.js'),
  'engine/bricks/sim-pace.js': join(repo, 'pace-install/files/engine/bricks/sim-pace.js'),
};
const guards = parse(readFileSync(join(root, 'baseline.sha256'), 'utf8'));
assert.deepEqual(guards.map((r) => r.dest).sort(), Object.keys(guardFile).sort());
for (const row of guards) assert.equal(sha(readFileSync(guardFile[row.dest])), row.sha, row.dest);

const roots = [];
try {
  const collidedRoot = guardRoot();
  writeFileSync(join(collidedRoot, 'm448aaa3-prof.html'), 'not the page');
  const collided = run(collidedRoot, 'install.sh');
  assert.equal(collided.status, 1, collided.stderr);
  assert.equal(existsSync(join(collidedRoot, 'm448aaa3-prof.js')), false);
  assert.equal(existsSync(join(collidedRoot, 'engine/bricks/pass-timer.js')), false);

  const mismatchRoot = guardRoot();
  writeFileSync(join(mismatchRoot, 'm448aaa3-pace.js'), 'changed');
  const mismatch = run(mismatchRoot, 'install.sh');
  assert.equal(mismatch.status, 2, mismatch.stderr);
  assert.equal(existsSync(join(mismatchRoot, 'm448aaa3-prof.js')), false);

  const work = guardRoot();
  const ok = run(work, 'install.sh');
  assert.equal(ok.status, 0, ok.stderr);
  for (const row of listed) assert.equal(sha(readFileSync(join(work, row.dest))), row.sha);
  for (const row of guards) assert.equal(sha(readFileSync(join(work, row.dest))), row.sha);
  const again = run(work, 'install.sh');
  assert.equal(again.status, 0, again.stderr);
  assert.match(again.stdout, /same m448aaa3-prof.js/);
  const back = run(work, 'uninstall.sh');
  assert.equal(back.status, 0, back.stderr);
  for (const row of listed) assert.equal(existsSync(join(work, row.dest)), false);
  for (const row of guards) assert.equal(sha(readFileSync(join(work, row.dest))), row.sha);
} finally {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true });
}

function guardRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'prof-drill-'));
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
console.log('PASS prof-install check');

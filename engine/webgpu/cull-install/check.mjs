// The cull page is the pace page plus the grass wedge.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, cpSync, writeFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cullFromPace } from './transform.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const repo = join(root, '..');
const pace = readFileSync(join(repo, 'pace-install/files/m448aaa3-pace.js'), 'utf8');
const cull = readFileSync(join(root, 'files/m448aaa3-cull.js'), 'utf8');
const html = readFileSync(join(root, 'files/m448aaa3-cull.html'), 'utf8');
const mod = readFileSync(join(root, 'files/engine/bricks/grass-offscreen.js'), 'utf8');
const modSrc = readFileSync(join(repo, 'engine/bricks/grass-offscreen.js'), 'utf8');
assert.equal(cull, cullFromPace(pace));
assert.equal(mod, modSrc);
assert.equal(cull.includes('paceFrame(wall, stepLive)'), true);
assert.equal(cull.includes('const SAMPLES = 4'), true);
assert.equal(cull.includes('Math.min(devicePixelRatio, 2)'), true);
assert.equal(cull.includes('makeMeadowRoute'), false);
const draws = (s) => s.split('\n').filter((l) => /\b(?:pass|sp)\.draw\(/.test(l));
assert.deepEqual(draws(cull), draws(pace));
const body = (s) => s.slice(s.indexOf('function stepLive(dt)'), s.indexOf('return live;\n}') + 'return live;\n}'.length);
assert.equal(body(cull), body(pace));
assert.match(html, /m448aaa3-cull\.js\?v=cull1/);
assert.doesNotMatch(html, /m448aaa3-pace\.js/);

const listed = parse(readFileSync(join(root, 'manifest.sha256'), 'utf8'));
assert.deepEqual(listed.map((r) => r.dest).sort(), [
  'engine/bricks/grass-offscreen.js',
  'm448aaa3-cull.html',
  'm448aaa3-cull.js',
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
  'm448aaa3-prof.html': join(repo, 'prof-install/files/m448aaa3-prof.html'),
  'm448aaa3-prof.js': join(repo, 'prof-install/files/m448aaa3-prof.js'),
  'engine/bricks/pass-timer.js': join(repo, 'prof-install/files/engine/bricks/pass-timer.js'),
};
const guards = parse(readFileSync(join(root, 'baseline.sha256'), 'utf8'));
assert.deepEqual(guards.map((r) => r.dest).sort(), Object.keys(guardFile).sort());
for (const row of guards) assert.equal(sha(readFileSync(guardFile[row.dest])), row.sha, row.dest);

const roots = [];
try {
  const collidedRoot = guardRoot();
  writeFileSync(join(collidedRoot, 'm448aaa3-cull.html'), 'nope');
  const collided = run(collidedRoot, 'install.sh');
  assert.equal(collided.status, 1, collided.stderr);
  assert.equal(existsSync(join(collidedRoot, 'm448aaa3-cull.js')), false);

  const mismatchRoot = guardRoot();
  writeFileSync(join(mismatchRoot, 'm448aaa3-prof.js'), 'changed');
  const mismatch = run(mismatchRoot, 'install.sh');
  assert.equal(mismatch.status, 2, mismatch.stderr);
  assert.equal(existsSync(join(mismatchRoot, 'engine/bricks/grass-offscreen.js')), false);

  const work = guardRoot();
  const ok = run(work, 'install.sh');
  assert.equal(ok.status, 0, ok.stderr);
  for (const row of listed) assert.equal(sha(readFileSync(join(work, row.dest))), row.sha);
  for (const row of guards) assert.equal(sha(readFileSync(join(work, row.dest))), row.sha);
  assert.match(run(work, 'install.sh').stdout, /same m448aaa3-cull.js/);
  assert.equal(run(work, 'uninstall.sh').status, 0);
  for (const row of listed) assert.equal(existsSync(join(work, row.dest)), false);
  for (const row of guards) assert.equal(sha(readFileSync(join(work, row.dest))), row.sha);
} finally {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true });
}

function guardRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'cull-drill-'));
  roots.push(dir);
  for (const [dest, src] of Object.entries(guardFile)) {
    const out = join(dir, dest);
    mkdirSync(dirname(out), { recursive: true });
    cpSync(src, out);
  }
  return dir;
}
function sha(buf) { return createHash('sha256').update(buf).digest('hex'); }
function parse(text) {
  return text.split('\n').filter((l) => l && !l.startsWith('#')).map((l) => {
    const [hash, dest] = l.split(/\s+/);
    return { sha: hash, dest };
  });
}
function run(dir, script) {
  return spawnSync('sh', [join(root, script), dir], { encoding: 'utf8' });
}
console.log('PASS cull-install check');

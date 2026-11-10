// The occlusion page is the cull page with the ground drawn after the opaque occluders.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, cpSync, writeFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { occlFromCull } from './transform.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const repo = join(root, '..');
const cull = readFileSync(join(repo, 'cull-install/files/m448aaa3-cull.js'), 'utf8');
const occl = readFileSync(join(root, 'files/m448aaa3-occl.js'), 'utf8');
const html = readFileSync(join(root, 'files/m448aaa3-occl.html'), 'utf8');
assert.equal(occl, occlFromCull(cull));
assert.equal(occl.includes('paceFrame(wall, stepLive)'), true);
assert.equal(occl.includes('grassOffscreen(GRASS'), true);
assert.equal(occl.includes('const SAMPLES = 4'), true);
assert.equal(occl.includes('Math.min(devicePixelRatio, 2)'), true);
assert.equal(occl.includes('const SM = 1024'), true);
assert.equal(occl.includes("window.__meadowBuild = 'm448aaa3-occl1'"), true);
const body = (s) => s.slice(s.indexOf('function stepLive(dt)'), s.indexOf('return live;\n}') + 'return live;\n}'.length);
assert.equal(body(occl), body(cull));
const groundAt = occl.indexOf('pass.setPipeline(pGround); pass.draw(6 * 128 * 128);');
const grassAt = occl.indexOf('pass.setPipeline(pGrass);');
const boltAt = occl.indexOf('pass.setPipeline(pBolt); pass.draw(6);');
const skyAt = occl.indexOf('pass.setPipeline(pSky); pass.draw(3);');
assert.ok(boltAt < grassAt && grassAt < groundAt && groundAt < skyAt);
assert.match(html, /m448aaa3-occl\.js\?v=occl1/);
assert.doesNotMatch(html, /m448aaa3-cull\.js/);

const listed = parse(readFileSync(join(root, 'manifest.sha256'), 'utf8'));
assert.deepEqual(listed.map((r) => r.dest).sort(), ['m448aaa3-occl.html', 'm448aaa3-occl.js']);
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
  'm448aaa3-cull.html': join(repo, 'cull-install/files/m448aaa3-cull.html'),
  'm448aaa3-cull.js': join(repo, 'cull-install/files/m448aaa3-cull.js'),
  'engine/bricks/grass-offscreen.js': join(repo, 'cull-install/files/engine/bricks/grass-offscreen.js'),
};
const guards = parse(readFileSync(join(root, 'baseline.sha256'), 'utf8'));
assert.equal(guards.length, 14);
assert.deepEqual(guards.map((r) => r.dest).sort(), Object.keys(guardFile).sort());
for (const row of guards) assert.equal(sha(readFileSync(guardFile[row.dest])), row.sha, row.dest);

const roots = [];
try {
  const collidedRoot = guardRoot();
  writeFileSync(join(collidedRoot, 'm448aaa3-occl.html'), 'nope');
  assert.equal(run(collidedRoot, 'install.sh').status, 1);
  assert.equal(existsSync(join(collidedRoot, 'm448aaa3-occl.js')), false);
  const mismatchRoot = guardRoot();
  writeFileSync(join(mismatchRoot, 'm448aaa3-cull.js'), 'changed');
  assert.equal(run(mismatchRoot, 'install.sh').status, 2);
  assert.equal(existsSync(join(mismatchRoot, 'm448aaa3-occl.js')), false);
  const work = guardRoot();
  assert.equal(run(work, 'install.sh').status, 0);
  for (const row of listed) assert.equal(sha(readFileSync(join(work, row.dest))), row.sha);
  for (const row of guards) assert.equal(sha(readFileSync(join(work, row.dest))), row.sha);
  assert.match(run(work, 'install.sh').stdout, /same m448aaa3-occl.js/);
  assert.equal(run(work, 'uninstall.sh').status, 0);
  for (const row of listed) assert.equal(existsSync(join(work, row.dest)), false);
  for (const row of guards) assert.equal(sha(readFileSync(join(work, row.dest))), row.sha);
} finally {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true });
}

function guardRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'occl-drill-'));
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
console.log('PASS occl-install check');

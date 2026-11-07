// The class page is the normal scratch plus timestamps and a paired omit. all-frame draws match.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, cpSync, writeFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clsFromScratch } from './transform.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const repo = join(root, '..');
const scratch = readFileSync(join(repo, 'diag-install/reference/m448aaa3.js'), 'utf8');
const page = readFileSync(join(root, 'files/m448aaa3-cls.js'), 'utf8');
const html = readFileSync(join(root, 'files/m448aaa3-cls.html'), 'utf8');
assert.equal(page, clsFromScratch(scratch));
assert.equal(readFileSync(join(root, 'files/engine/bricks/draw-class.js'), 'utf8'), readFileSync(join(repo, 'engine/bricks/draw-class.js'), 'utf8'));
assert.equal(readFileSync(join(root, 'files/engine/bricks/pass-timer-cls.js'), 'utf8'), readFileSync(join(repo, 'engine/bricks/pass-timer-cls.js'), 'utf8'));
assert.match(html, /m448aaa3-cls\.js\?v=cls1/);
assert.doesNotMatch(html, /m448aaa3\.js\?v=/);
const args = (s) => [...s.matchAll(/\b(?:pass|sp)\.draw\(([^)]*)\)/g)].map((m) => m[1]);
assert.deepEqual(args(page), args(scratch));

const listed = parse(readFileSync(join(root, 'manifest.sha256'), 'utf8'));
assert.deepEqual(listed.map((r) => r.dest).sort(), [
  'engine/bricks/draw-class.js',
  'engine/bricks/pass-timer-cls.js',
  'm448aaa3-cls.html',
  'm448aaa3-cls.js',
].sort());
for (const row of listed) assert.equal(sha(readFileSync(join(root, 'files', row.dest))), row.sha, row.dest);

const guardFile = {
  'm448aaa3.html': join(repo, 'diag-install/reference/m448aaa3.html'),
  'm448aaa3.js': join(repo, 'diag-install/reference/m448aaa3.js'),
};
const guards = parse(readFileSync(join(root, 'baseline.sha256'), 'utf8'));
assert.deepEqual(guards.map((r) => r.dest).sort(), Object.keys(guardFile).sort());
for (const row of guards) assert.equal(sha(readFileSync(guardFile[row.dest])), row.sha, row.dest);

const roots = [];
try {
  const collidedRoot = guardRoot();
  writeFileSync(join(collidedRoot, 'm448aaa3-cls.html'), 'not the page');
  const collided = run(collidedRoot, 'install.sh');
  assert.equal(collided.status, 1, collided.stderr);
  assert.equal(existsSync(join(collidedRoot, 'm448aaa3-cls.js')), false);

  const mismatchRoot = guardRoot();
  writeFileSync(join(mismatchRoot, 'm448aaa3.js'), 'changed');
  const mismatch = run(mismatchRoot, 'install.sh');
  assert.equal(mismatch.status, 2, mismatch.stderr);
  assert.equal(existsSync(join(mismatchRoot, 'm448aaa3-cls.js')), false);
  assert.equal(readFileSync(join(mismatchRoot, 'm448aaa3.html'), 'utf8'), readFileSync(guardFile['m448aaa3.html'], 'utf8'));

  const work = guardRoot();
  const ok = run(work, 'install.sh');
  assert.equal(ok.status, 0, ok.stderr);
  for (const row of listed) assert.equal(sha(readFileSync(join(work, row.dest))), row.sha);
  for (const row of guards) assert.equal(sha(readFileSync(join(work, row.dest))), row.sha);
  const again = run(work, 'install.sh');
  assert.equal(again.status, 0, again.stderr);
  assert.match(again.stdout, /same m448aaa3-cls.js/);
  const back = run(work, 'uninstall.sh');
  assert.equal(back.status, 0, back.stderr);
  for (const row of listed) assert.equal(existsSync(join(work, row.dest)), false);
  for (const row of guards) assert.equal(sha(readFileSync(join(work, row.dest))), row.sha);
} finally {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true });
}

function guardRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'cls-drill-'));
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
console.log('PASS cls-install check');

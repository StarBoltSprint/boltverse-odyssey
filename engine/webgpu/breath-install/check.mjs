// The breath page is the current meadow plus the gen4b crossfade.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, cpSync, writeFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { breathFromMeadow } from './transform.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const repo = join(root, '..');
const base = readFileSync(join(repo, 'diag-install/reference/m448aaa3.js'), 'utf8');
const page = readFileSync(join(root, 'files/m448aaa3-breath.js'), 'utf8');
const html = readFileSync(join(root, 'files/m448aaa3-breath.html'), 'utf8');
const mod = readFileSync(join(root, 'files/bricks/bolt-breath.js'), 'utf8');
const modSrc = readFileSync(join(repo, 'bricks/bolt-breath.js'), 'utf8');
assert.equal(page, breathFromMeadow(base));
assert.equal(mod, modSrc);
assert.equal(page.includes('stepBreath('), true);
assert.equal(page.includes('const SAMPLES = 4'), true);
assert.equal(page.includes('Math.min(devicePixelRatio, 2)'), true);
assert.equal(page.includes('const SM = 1024'), true);
assert.equal(page.includes('pass.draw(15, G * G)'), true);
assert.equal(page.includes('U[52] = 0.0'), true);
assert.match(html, /m448aaa3-breath\.js\?v=breath1/);
assert.doesNotMatch(html, /m448aaa3\.js\?v=38/);

const listed = parse(readFileSync(join(root, 'manifest.sha256'), 'utf8'));
assert.deepEqual(listed.map((r) => r.dest).sort(), [
  'bricks/bolt-breath.js',
  'm448aaa3-breath.html',
  'm448aaa3-breath.js',
]);
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
for (const row of guards) assert.equal(sha(readFileSync(guardFile[row.dest])), row.sha, row.dest);

const roots = [];
try {
  const missing = guardRoot();
  assert.equal(run(missing, 'install.sh').status, 2);
  assert.equal(existsSync(join(missing, 'm448aaa3-breath.js')), false);
  const work = guardRoot();
  plant(work);
  assert.equal(run(work, 'install.sh').status, 0);
  for (const row of listed) assert.equal(sha(readFileSync(join(work, row.dest))), row.sha);
  for (const row of guards) assert.equal(sha(readFileSync(join(work, row.dest))), row.sha);
  assert.match(run(work, 'install.sh').stdout, /same m448aaa3-breath.js/);
  assert.equal(run(work, 'uninstall.sh').status, 0);
  for (const row of listed) assert.equal(existsSync(join(work, row.dest)), false);
  assert.equal(existsSync(join(work, 'assets/meadow/bolt_idle4b5_rgba/f0000.png')), true);
  assert.equal(existsSync(join(work, 'm448aaa3.js')), true);
} finally {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true });
}

function plant(dir) {
  const png = join(dir, 'assets/meadow/bolt_idle4b5_rgba');
  mkdirSync(png, { recursive: true });
  mkdirSync(join(dir, 'assets/meadow'), { recursive: true });
  writeFileSync(join(dir, 'assets/meadow/bolt_idle4b_loop_alpha.webm'), 'webm');
  for (let i = 0; i < 144; i++) writeFileSync(join(png, 'f' + String(i).padStart(4, '0') + '.png'), 'png');
}
function guardRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'breath-drill-'));
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
console.log('PASS breath-install check');

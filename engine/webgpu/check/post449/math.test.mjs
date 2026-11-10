import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { halton, halton8, jitterNdc, applyJitter, historyWeight, clampToNeighbourhood, makeTAA, TAA_DEFAULT } from '../../engine/taa.js';
import { marchSchedule, temporalWeight, makeSSGI, SSGI_DEFAULT } from '../../engine/ssgi.js';
import { packPost, OFF, POST_FLOATS } from '../../engine/postu.js';
import { sunVisible, segmentHitsFin, probes, buildBoxes, CRYSTAL_CANDIDATE } from '../../engine/biomes/crystal-candidate.js';
import { frame, project } from '../../engine/candcam.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');

test('Halton 8 matches the base-2 and base-3 series', () => {
  const h2 = [0.5, 0.25, 0.75, 0.125, 0.625, 0.375, 0.875, 0.0625];
  const h3 = [1 / 3, 2 / 3, 1 / 9, 4 / 9, 7 / 9, 2 / 9, 5 / 9, 8 / 9];
  for (let i = 0; i < 8; i++) {
    assert.ok(Math.abs(halton(i + 1, 2) - h2[i]) < 1e-9);
    assert.ok(Math.abs(halton(i + 1, 3) - h3[i]) < 1e-9);
    const [x, y] = halton8(i);
    assert.ok(Math.abs(x - h2[i]) < 1e-9 && Math.abs(y - h3[i]) < 1e-9);
  }
  const seen = new Set(h2.map((v) => v.toFixed(4)));
  assert.equal(seen.size, 8);
});

test('jitter stays inside half a pixel and averages near zero', () => {
  let sx = 0, sy = 0;
  for (let i = 0; i < 8; i++) {
    const [jx, jy] = jitterNdc(i, 720, 1280);
    assert.ok(Math.abs(jx) <= 1 / 720 + 1e-9);
    assert.ok(Math.abs(jy) <= 1 / 1280 + 1e-9);
    sx += jx; sy += jy;
  }
  assert.ok(Math.abs(sx / 8) < 0.15 / 720);
  assert.ok(Math.abs(sy / 8) < 0.15 / 1280);
});

test('projection jitter shifts NDC by the requested amount', () => {
  const fovy = Math.PI / 3, asp = 0.5, n = 0.05, f = 40;
  const t = 1 / Math.tan(fovy / 2);
  const P = [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, f / (n - f), -1, 0, 0, n * f / (n - f), 0];
  const J = applyJitter(P, 0.01, -0.02);
  const mul = (m, v) => {
    const o = [0, 0, 0, 0];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) o[r] += m[c * 4 + r] * v[c];
    return o;
  };
  const a = mul(P, [0, 0, -2, 1]);
  const b = mul(J, [0, 0, -2, 1]);
  assert.ok(Math.abs(b[0] / b[3] - a[0] / a[3] - 0.01) < 1e-6);
  assert.ok(Math.abs(b[1] / b[3] - a[1] / a[3] - (-0.02)) < 1e-6);
});

test('history weight is 95% when still and falls as motion grows', () => {
  const still = historyWeight({ speedPx: 0 });
  assert.ok(Math.abs(still - 0.95) < 1e-9);
  const mid = historyWeight({ speedPx: 24 });
  const fast = historyWeight({ speedPx: 48 });
  assert.ok(mid < still && fast < mid);
  assert.ok(mid < 0.4);
  const tracked = historyWeight({ dynamic: true, objSpeedPx: 24 });
  const untracked = historyWeight({ speedPx: 24 });
  assert.ok(tracked > untracked);
});

test('3x3 clamp keeps an inside sample and pulls an outside one in', () => {
  const samples = [[0.2, 0.2, 0.2], [0.4, 0.3, 0.2], [0.25, 0.22, 0.21]];
  const inside = clampToNeighbourhood([0.3, 0.25, 0.2], samples);
  assert.deepEqual(inside, [0.3, 0.25, 0.2]);
  const white = clampToNeighbourhood([1, 1, 1], samples);
  assert.ok(white[0] <= 0.4 && white[1] <= 0.3 && white[2] <= 0.21);
  assert.equal(samples.length, 3);
});

test('SSGI schedule is 32 growing steps and temporal blend caps at 8', () => {
  const s = marchSchedule();
  assert.equal(s.length, 32);
  assert.ok(s[0].step <= s[5].step && s[5].step <= s[20].step);
  assert.equal(s[0].t, s[0].prev + s[0].step);
  assert.deepEqual(temporalWeight(0, 8, false), { n: 1, w: 0 });
  assert.ok(Math.abs(temporalWeight(7, 8, false).w - 0.875) < 1e-9);
  assert.equal(temporalWeight(8, 8, false).n, 8);
  assert.equal(temporalWeight(5, 8, true).n, 1);
});

test('modules default off and the candidate turns them on', () => {
  assert.equal(TAA_DEFAULT.on, false);
  assert.equal(makeTAA().cfg.on, false);
  assert.equal(makeTAA().cfg.samples, 8);
  assert.equal(makeTAA().cfg.history, 0.95);
  assert.equal(SSGI_DEFAULT.on, false);
  assert.equal(makeSSGI().cfg.on, false);
  assert.equal(makeSSGI().cfg.rays, 2);
  assert.equal(makeSSGI().cfg.steps, 32);
  assert.equal(makeSSGI().cfg.frames, 8);
  assert.equal(makeSSGI().cfg.scale, 0.5);
  assert.equal(CRYSTAL_CANDIDATE.taa.on, true);
  assert.equal(CRYSTAL_CANDIDATE.ssgi.on, true);
  assert.equal(CRYSTAL_CANDIDATE.fog, 0);
  assert.equal(CRYSTAL_CANDIDATE.crystal.f0, 0.04);
});

test('resolve and trace shaders carry the technique', () => {
  const taa = makeTAA({ on: true }).resolve;
  assert.match(taa, /for \(var dy = -1; dy <= 1; dy\+\+\)/);
  assert.match(taa, /for \(var dx = -1; dx <= 1; dx\+\+\)/);
  assert.match(taa, /exp\(-speed/);
  assert.match(taa, /mot\.z > 0\.5/);
  const gi = makeSSGI().pass;
  assert.match(gi, /for \(var r = 0; r < 2; r\+\+\)/);
  assert.match(gi, /for \(var s = 0; s < 32; s\+\+\)/);
  assert.match(gi, /tPrev/);
  assert.match(gi, /for \(var dy = -1; dy <= 1; dy\+\+\)/);
  assert.match(gi, /d\.rgb \+ alb \* g\.rgb/);
});

test('quartz is dielectric and the scene does not reflect the room', () => {
  const src = readFileSync(join(root, 'engine/candscene.js'), 'utf8');
  assert.match(src, /0\.04/);
  assert.equal(src.includes('reflect('), false);
  assert.equal(/fn\s+fog/.test(src), false);
  assert.equal(CRYSTAL_CANDIDATE.crystal.f0 < 0.08, true);
});

test('live meadow is unchanged: no TAA key, fog still off', () => {
  const meadow = readFileSync(join(root, 'engine/biomes/meadow.js'), 'utf8');
  assert.equal(meadow.includes('taa'), false);
  assert.equal(meadow.includes('ssgi'), false);
  const live = readFileSync(join(root, 'm448aaa2.js'), 'utf8');
  assert.match(live, /fn fogMix\(c: vec3f, dist: f32\) -> vec3f \{ return c; \}/);
  assert.equal(live.includes('makeTAA'), false);
  assert.equal(live.includes('makeSSGI'), false);
});

test('sun reaches the floor and not the shadowed wall or pocket', () => {
  const p = probes();
  assert.equal(sunVisible(p.floor), true);
  assert.equal(sunVisible(p.wall), false);
  assert.equal(sunVisible(p.pocket), false);
  assert.equal(segmentHitsFin(p.pocket, p.floor), true);
  assert.equal(segmentHitsFin(p.wall, p.floor), false);
});

test('stone joints are a few millimetres and Bolt stays centred in the chase', () => {
  const s = CRYSTAL_CANDIDATE.stone;
  assert.ok(s.gapX <= 0.003 && s.gapY <= 0.003);
  const boxes = buildBoxes();
  assert.ok(boxes.count > 400);
  const play = frame('play', 0, 720, 1280);
  const pix = project(play.vp, play.bolt, 720, 1280);
  assert.ok(Math.abs(pix.x / 720 - 0.5) < 0.02, `bolt x ${pix.x}`);
  assert.equal(play.showBolt, true);
  assert.equal(frame('joints', 0).showBolt, false);
  const indoor = frame('indoor', 0, 720, 1280);
  const pr = probes();
  for (const name of ['wall', 'pocket', 'floor']) {
    const q = project(indoor.vp, pr[name], 720, 1280);
    assert.ok(q.x > 8 && q.x < 712 && q.y > 8 && q.y < 1272, `${name} ${q.x},${q.y}`);
  }
});

test('uniform pack lands history in p0', () => {
  const U = packPost({
    vp: new Array(16).fill(0), ivp: new Array(16).fill(0), prev: new Array(16).fill(0),
    eye: [1, 2, 3], frame: 4,
    history: 0.95, motionPx: 24, clamp: 1, reject: 1,
    width: 720, height: 1280, objectMv: 1, gi: 1,
    strength: 1, stepBase: 0.06, stepGrow: 1.22, giFrames: 8,
    thickness: 0.02, sky: [0.1, 0.2, 0.3],
    jx: 0, jy: 0, near: 0.05, far: 40,
    sun: [0, 1, 0], maxStep: 0.7,
    fwd: [0, 0, 1],
    bolt: [0, 0.4, 2], atlasFrame: 3,
    boltPrev: [0, 0.4, 1],
    prevEye: [0, 1, 0], prevFwd: [0, 0, 1],
    atlas: 1, exposure: 1.7, coat: 0.52,
  });
  assert.equal(U.length, POST_FLOATS);
  assert.ok(Math.abs(U[OFF.p0] - 0.95) < 1e-5);
  assert.equal(U[OFF.p1], 720);
  assert.equal(U[OFF.p2 + 3], 8);
  assert.equal(U[OFF.eye + 3], 4);
});

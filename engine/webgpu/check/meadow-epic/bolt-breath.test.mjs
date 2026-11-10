// Stop, breathe, resume. No GPU. Nominal gallop speed stays 7.
import assert from 'node:assert/strict';
import { boltIdle } from '../../bricks/bolt-idle.js';
import { stepBreath, breathFrame, rgbaName, BREATH_MEADOW, BREATH_BUILD } from '../../bricks/bolt-breath.js';

const idle = boltIdle();
const cfg = { ...BREATH_MEADOW, speed: idle.cfg.speed, blendV: idle.cfg.blendV };
assert.equal(idle.cfg.speed, 7);
assert.equal(cfg.frames, 144);
assert.equal(cfg.fps, 24);
assert.equal(cfg.xfS, 0.2);
assert.deepEqual(cfg.stamp, { sx: 286, sy: 570, sw: 156, sh: 470, dx: 55.46, dy: 35.60, dw: 260, dh: 825 });
assert.equal(rgbaName(0), 'bolt_idle4b5_rgba/f0000.png');
assert.equal(rgbaName(143), 'bolt_idle4b5_rgba/f0143.png');
assert.equal(breathFrame(0), 0);
assert.equal(breathFrame(1 / 24 + 1e-6), 1);
assert.equal(breathFrame(144 / 24), 0);

const live = { v: 7, phase: 0.2, run: 1 };
const dt = 1 / 60;
for (let i = 0; i < 30; i++) {
  idle.stepMotion(live, dt, true);
  stepBreath(live, dt, true, cfg);
}
assert.equal(live.v, 7);
assert.equal(live.breathState, 'run');
assert.equal(live.idleMix, 0);
const phaseRun = live.phase;

for (let i = 0; i < 120; i++) {
  idle.stepMotion(live, dt, false);
  stepBreath(live, dt, false, cfg);
}
assert.equal(live.v, 0);
assert.equal(live.phase, idle.cfg.idlePhase);
assert.equal(live.breathState, 'idle');
assert.equal(live.idleMix, 1);
assert.ok(live.idleT > 0.2, live.idleT);
const frameAtStop = live.breathFrame;
for (let i = 0; i < 24; i++) {
  idle.stepMotion(live, dt, false);
  stepBreath(live, dt, false, cfg);
}
assert.notEqual(live.breathFrame, frameAtStop);
assert.equal(live.v, 0);

const before = live.phase;
for (let i = 0; i < 55; i++) {
  idle.stepMotion(live, dt, true);
  stepBreath(live, dt, true, cfg);
}
assert.equal(live.v, 7);
assert.equal(live.idleMix, 0);
assert.equal(live.breathState, 'run');
assert.notEqual(live.phase, before);
assert.ok(Math.abs(live.phase - phaseRun) > 0 || live.phase !== before);

const page = await import('node:fs').then((fs) => fs.readFileSync(new URL('../../breath-install/files/m448aaa3-breath.js', import.meta.url), 'utf8'));
assert.equal(page.includes("window.__meadowBuild = BREATH_BUILD"), true);
assert.equal(page.includes('U[52] = 0.0'), true);
assert.equal(page.includes('U[53] = live.idleMix'), true);
assert.equal(page.includes('tIdle'), true);
assert.equal(page.includes('const SPEED = IDLE.cfg.speed') || page.includes('IDLE.cfg.speed'), true);
assert.equal(page.includes('pass.draw(15, G * G)'), true);
assert.equal(page.includes('const SAMPLES = 4'), true);
console.log('PASS bolt-breath', { build: BREATH_BUILD, idleT: +live.idleT.toFixed(3), frame: live.breathFrame });

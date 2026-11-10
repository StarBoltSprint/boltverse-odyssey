// Scripted gallop shared by the page and the checks. Forward is -Z, same as the meadow.

import { LIVE_BOLT, smoothEye } from '../engine/bricks/follow-bolt.js';
import { footprint, pushOut } from '../engine/bricks/huge-structure.js';
import { STRUCTURES } from './biome.js';

export function startState(heightOf) {
  const z = 40;
  return {
    x: 0, z, psi: 0, cam: 0, v: 0, phase: 0, t: 0,
    eyeY: heightOf(0, z) + LIVE_BOLT.eye,
  };
}

export function scripted(t) {
  return { throttle: t < 0.35 ? t / 0.35 : 1, psi: Math.sin(t * 0.37) * 0.22 };
}

export function stepBolt(st, dt, heightOf, drive) {
  const next = { ...st, t: st.t + dt };
  const target = LIVE_BOLT.speed * drive.throttle;
  if (next.v < target) next.v = Math.min(target, next.v + LIVE_BOLT.accel * dt);
  else next.v = Math.max(target, next.v - LIVE_BOLT.brake * dt);
  const k = 1 - Math.exp(-dt / LIVE_BOLT.tau);
  next.psi = drive.psi;
  next.cam = st.cam + (next.psi - st.cam) * k;
  const rel = next.psi - next.cam;
  if (rel > LIVE_BOLT.maxRel) next.cam = next.psi - LIVE_BOLT.maxRel;
  if (-rel > LIVE_BOLT.maxRel) next.cam = next.psi + LIVE_BOLT.maxRel;
  let x = st.x - Math.sin(next.psi) * next.v * dt;
  let z = st.z - Math.cos(next.psi) * next.v * dt;
  for (const spec of STRUCTURES) {
    const p = pushOut(footprint(spec), x, z, LIVE_BOLT.boltR);
    x = p[0]; z = p[1];
  }
  const dist = Math.hypot(x - st.x, z - st.z);
  next.x = x; next.z = z;
  next.phase = st.phase + LIVE_BOLT.strideHz * dist / LIVE_BOLT.speed;
  const poseEye = heightOf(x - Math.sin(next.cam) * -1 * 0 + 0, z);
  const ex = x + Math.sin(next.cam) * LIVE_BOLT.boom;
  const ez = z + Math.cos(next.cam) * LIVE_BOLT.boom;
  next.eyeY = smoothEye(st.eyeY, heightOf(ex, ez) + LIVE_BOLT.eye, dt);
  void poseEye;
  return next;
}

export function simulate(seconds, dt, heightOf) {
  const frames = [];
  let st = startState(heightOf);
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) {
    st = stepBolt(st, dt, heightOf, scripted(st.t));
    frames.push(st);
  }
  return frames;
}

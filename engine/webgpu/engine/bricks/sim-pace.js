// Keep Bolt on wall-clock time when a frame is slower than the collision step.
// Each step stays ≤ 0.05 s, the same chunk the live page already gives stepLive.
// Inside that chunk, collide.js still splits the move at 0.12 m.
// A single frame never simulates more than 0.5 s, so a multi-second pause cannot
// fast-forward the dog. The phone sample (median 84.7 ms, p95 205.1 ms) is inside 0.5 s.
export const STEP_CAP_S = 0.05;
export const WALL_LIMIT_S = 0.5;

export function paceSteps(wall, stepCap = STEP_CAP_S, wallLimit = WALL_LIMIT_S) {
  if (!(wall > 0)) return [];
  const budget = Math.min(wall, wallLimit);
  const steps = [];
  let left = budget;
  while (left > 1e-8 && steps.length < 64) {
    const dt = Math.min(stepCap, left);
    steps.push(dt);
    left -= dt;
  }
  return steps;
}

export function paceFrame(wall, stepLive, stepCap = STEP_CAP_S, wallLimit = WALL_LIMIT_S) {
  let applied = 0;
  for (const dt of paceSteps(wall, stepCap, wallLimit)) {
    stepLive(dt);
    applied += dt;
  }
  return applied;
}

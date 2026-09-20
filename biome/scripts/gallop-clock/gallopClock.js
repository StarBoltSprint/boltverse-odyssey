/**
 * Cook/play gallop clock — stop Grok from stepping the sealed cycle.
 *
 * HARD:
 * - Play lock/bolt-gallop-cycle.mp4 at its native fps (96), never 1-of-N.
 * - phase = (plateTime * strideHz) % 1  — NOT wall clock, NOT independent rAF.
 * - Road scroll ds must match stride (anti-skate).
 *
 * Smoke FAIL if effective dog fps << plate fps, or skate visible.
 */

'use strict';

function defaultOptions(opts = {}) {
  return {
    /** sealed cycle metadata (CANON 6s / 534 / 96fps) */
    cycleFps: opts.cycleFps ?? 96,
    cycleFrames: opts.cycleFrames ?? 534,
    cycleDuration: opts.cycleDuration ?? 534 / 96,
    /** Lane target cadence (strides / second). 14-rotary: ~3.5–4.5; use 4. */
    strideHz: opts.strideHz ?? 4,
    /** how many strides packed in one sealed cycle loop (~5.56 s ≈ 22 strides @ 4 Hz) */
    stridesPerCycle: opts.stridesPerCycle ?? 22,
    /** min acceptable dog display fps vs plate (ratio) */
    minFpsRatio: opts.minFpsRatio ?? 0.85,
    ...opts,
  };
}

/**
 * Frame index into the sealed cycle for a given plate time (seconds of picture-time).
 * Uses native cycle fps — no stepping.
 */
function frameAtPlateTime(plateTime, opts = {}) {
  const o = defaultOptions(opts);
  if (!(plateTime >= 0)) throw new Error('frameAtPlateTime: plateTime >= 0');
  // Map plate time through stride clock, then into cycle frames
  const phase = stridePhase(plateTime, o);
  const frame = Math.floor(phase * o.cycleFrames) % o.cycleFrames;
  return { frame, phase, tCycle: phase * o.cycleDuration };
}

/**
 * Continuous phase in [0,1) for one sealed cycle loop.
 * Advances at strideHz so N stridesPerCycle fit one loop.
 */
function stridePhase(plateTime, opts = {}) {
  const o = defaultOptions(opts);
  // One full cycle loop covers stridesPerCycle strides
  const loopsPerSec = o.strideHz / o.stridesPerCycle;
  const x = plateTime * loopsPerSec;
  return x - Math.floor(x);
}

/**
 * Suggested road arc-length advance per second so paw plant ≈ no skate.
 * strideLengthPx: how far the road should move per stride (from path / look).
 */
function roadSpeedForCadence(strideLengthPx, opts = {}) {
  const o = defaultOptions(opts);
  if (!(strideLengthPx > 0)) throw new Error('roadSpeedForCadence: strideLengthPx > 0');
  return strideLengthPx * o.strideHz; // px (or UV) per second along s
}

/**
 * ds for one plate frame at plateFps.
 */
function dsPerFrame(strideLengthPx, plateFps, opts = {}) {
  const o = defaultOptions(opts);
  const speed = roadSpeedForCadence(strideLengthPx, o);
  return speed / plateFps;
}

/**
 * Cook/play gate: is the compositor actually showing enough dog frames?
 * @param {number} dogFramesShown — unique cycle frames displayed over window
 * @param {number} windowSec
 * @param {number} plateFps
 */
function assertGallopClock({ dogFramesShown, windowSec, plateFps }, opts = {}) {
  const o = defaultOptions(opts);
  const fails = [];
  if (!(windowSec > 0 && plateFps > 0)) {
    throw new Error('assertGallopClock: windowSec and plateFps must be > 0');
  }
  const dogFps = dogFramesShown / windowSec;
  const ratio = dogFps / plateFps;
  // Expect roughly min(cycleFps, plateFps) effective
  const expect = Math.min(o.cycleFps, plateFps);
  if (dogFps < expect * o.minFpsRatio) {
    fails.push(
      `dogFps~${dogFps.toFixed(1)} << expect~${expect} (ratio ${ratio.toFixed(2)}) — stepping/1-of-N FAIL`
    );
  }
  if (dogFps < 20) {
    fails.push(`dogFps~${dogFps.toFixed(1)} looks stop-motion (<20)`);
  }
  if (fails.length) {
    const err = new Error('assertGallopClock FAIL: ' + fails.join('; '));
    err.fails = fails;
    throw err;
  }
  return { dogFps, ratio, expect };
}

/**
 * HTML/video element recipe for Grok Build (string — paste into player).
 */
/**
 * FAIL if a cook/play path still points at the archived 0.93s / 89-frame lock.
 */
function assertCanonCycle(opts = {}) {
  const o = defaultOptions(opts);
  if (o.cycleFrames === 89 || (o.cycleDuration > 0 && o.cycleDuration < 2)) {
    throw new Error(
      'assertCanonCycle FAIL: 0.93s/89-frame lock is ARCHIVE — do not play. CANON = 534 frames / ~5.56s / 96fps'
    );
  }
  if (o.cycleFrames !== 534 || o.cycleFps !== 96) {
    throw new Error(
      `assertCanonCycle FAIL: expected CYCLE_FRAMES=534 CYCLE_FPS=96, got frames=${o.cycleFrames} fps=${o.cycleFps}`
    );
  }
  return { cycleFrames: o.cycleFrames, cycleFps: o.cycleFps, stridesPerCycle: o.stridesPerCycle };
}

function videoClockSnippet(opts = {}) {
  const o = defaultOptions(opts);
  return [
    '// Sealed 6s cycle — native 96 fps, loop 1×, no per-frame seek',
    `const CYCLE_FPS = ${o.cycleFps};`,
    `const CYCLE_FRAMES = ${o.cycleFrames};`,
    `const STRIDES_PER_CYCLE = ${o.stridesPerCycle};`,
    'function wireGallop(videoEl) {',
    '  videoEl.loop = true;',
    '  videoEl.playbackRate = 1;',
    '  videoEl.muted = true;',
    '  videoEl.playsInline = true;',
    '  // Do NOT: seek currentTime every rAF',
    '  // Do NOT: harvest CYCLE_FRAMES canvases',
    '  // Do NOT: playbackRate hacks that drop frames',
    '  // Do NOT: play lock/bolt-gallop-cycle-0.93s-prev.mp4',
    '}',
  ].join('\n');
}

module.exports = {
  defaultOptions,
  frameAtPlateTime,
  stridePhase,
  roadSpeedForCadence,
  dsPerFrame,
  assertGallopClock,
  assertCanonCycle,
  videoClockSnippet,
};

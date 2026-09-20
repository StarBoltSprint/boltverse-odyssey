/**
 * Cook-time Bolt auto-scale for living-film Lane plates.
 * Forces cutout size from road width — Grok must not pick scale by eye.
 *
 * scale = (kLane * laneWidthPx) / boltWidthPx
 * then clamp withersFrac = (boltWithersPx * scale) / frameH into [wMin, wMax]
 *
 * Play: scale(s) = baseScale * (w(s) / wRef), clamped ~0.85–1.15 relative.
 */

'use strict';

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

function defaultOptions(opts = {}) {
  return {
    /** fraction of lane width Bolt body/stance should occupy */
    kLane: opts.kLane ?? 0.40,
    /** withers height / frame height after scale */
    withersMin: opts.withersMin ?? 0.22,
    withersMax: opts.withersMax ?? 0.32,
    /** preferred withers target when clamping */
    withersTarget: opts.withersTarget ?? 0.27,
    /** relative play scale vs spawn when road narrows/widens */
    playScaleMin: opts.playScaleMin ?? 0.85,
    playScaleMax: opts.playScaleMax ?? 1.15,
    ...opts,
  };
}

/**
 * @param {object} args
 * @param {number} args.boltWidthPx  — cutout stance/body width in source pixels (alpha bbox)
 * @param {number} args.boltWithersPx — cutout withers height in source pixels
 * @param {number} args.laneWidthPx  — road lane width at paw plant in plate pixels (from path.json w(s)*2 or measured)
 * @param {number} args.frameH       — plate frame height in pixels
 * @param {object} [opts]
 * @returns {{ scale: number, withersFrac: number, laneFrac: number, reasons: string[] }}
 */
function computeScale(args, opts = {}) {
  const o = defaultOptions(opts);
  const { boltWidthPx, boltWithersPx, laneWidthPx, frameH } = args;
  const reasons = [];

  if (!(boltWidthPx > 0 && boltWithersPx > 0 && laneWidthPx > 0 && frameH > 0)) {
    throw new Error('computeScale: all of boltWidthPx, boltWithersPx, laneWidthPx, frameH must be > 0');
  }

  // Primary: fit stance into a fraction of the lane
  let scale = (o.kLane * laneWidthPx) / boltWidthPx;
  let withersFrac = (boltWithersPx * scale) / frameH;
  let laneFrac = (boltWidthPx * scale) / laneWidthPx;

  // If withers too tall, shrink to withersMax
  if (withersFrac > o.withersMax) {
    scale = (o.withersMax * frameH) / boltWithersPx;
    reasons.push(`clamp_withers_max→${o.withersMax}`);
  }
  // If withers too short, grow toward target (but never exceed kLane*1.15 of lane)
  else if (withersFrac < o.withersMin) {
    const grow = (o.withersTarget * frameH) / boltWithersPx;
    const laneCap = (o.kLane * 1.15 * laneWidthPx) / boltWidthPx;
    scale = Math.min(grow, laneCap);
    reasons.push(`clamp_withers_min→target`);
  }

  withersFrac = (boltWithersPx * scale) / frameH;
  laneFrac = (boltWidthPx * scale) / laneWidthPx;

  return {
    scale,
    withersFrac,
    laneFrac,
    kLane: o.kLane,
    reasons,
  };
}

/**
 * Play-time scale along the ribbon: follow road width, stay near spawn scale.
 * @param {number} baseScale — from computeScale at spawn
 * @param {number} wS — half-width or full lane width at s (same unit as wRef)
 * @param {number} wRef — width at spawn used when baseScale was computed
 */
function scaleAtS(baseScale, wS, wRef, opts = {}) {
  const o = defaultOptions(opts);
  if (!(wRef > 0)) throw new Error('scaleAtS: wRef must be > 0');
  const rel = clamp(wS / wRef, o.playScaleMin, o.playScaleMax);
  return baseScale * rel;
}

/**
 * Cook gate: FAIL if result outside bands.
 */
function assertScale(result, opts = {}) {
  const o = defaultOptions(opts);
  const fails = [];
  if (result.withersFrac < o.withersMin || result.withersFrac > o.withersMax) {
    fails.push(`withersFrac ${result.withersFrac.toFixed(3)} outside [${o.withersMin},${o.withersMax}]`);
  }
  if (result.laneFrac < 0.30 || result.laneFrac > 0.55) {
    fails.push(`laneFrac ${result.laneFrac.toFixed(3)} outside [0.30,0.55] (dog≈truck or flea)`);
  }
  if (fails.length) {
    const err = new Error('assertScale FAIL: ' + fails.join('; '));
    err.fails = fails;
    throw err;
  }
  return true;
}

/**
 * Read lane width from a curvatureSample-style path table at arc-length s.
 * Expects samples with .w (half-width) or .width — returns FULL lane width in same units as table (usually UV*frameW if authored that way).
 * If table stores normalized UV widths, pass frameW to convert to pixels.
 */
function laneWidthAt(table, s, frameW = null) {
  if (!table || !table.length) throw new Error('laneWidthAt: empty table');
  // find nearest sample by s
  let best = table[0];
  let bestD = Infinity;
  for (const p of table) {
    const ps = p.s != null ? p.s : p.arc;
    if (ps == null) continue;
    const d = Math.abs(ps - s);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  let half = best.w != null ? best.w : best.width != null ? best.width : best.halfWidth;
  if (half == null) throw new Error('laneWidthAt: sample missing w/width');
  // if w looks like full width already (>0.5 in UV?) — treat as half if field is w
  let full = best.w != null ? 2 * half : half;
  if (frameW != null) full = full * frameW; // UV → px
  return full;
}

module.exports = {
  computeScale,
  scaleAtS,
  assertScale,
  laneWidthAt,
  defaultOptions,
  clamp,
};

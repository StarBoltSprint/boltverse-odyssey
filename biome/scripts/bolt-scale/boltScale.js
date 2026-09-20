/**
 * Cook-time Bolt auto-scale for living-film Lane plates.
 * Forces cutout size from road — Grok must not pick scale by eye.
 *
 * HARD: anti-truck laneFrac in [laneFracMin, laneFracMax] (default 0.30–0.55).
 * Soft: withersMin (do not grow into a truck) unless opts.hardWithersMin.
 * Measure boltWithersPx at the SHOULDERS, not ear tips.
 *
 * Prefer withersTarget of frame height, then HARD-clamp stance to the lane band.
 * Play: scale(s) = baseScale * clamp(w(s)/wRef, 0.85, 1.15).
 */

'use strict';

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

function defaultOptions(opts = {}) {
  return {
    kLane: opts.kLane ?? 0.40,
    laneFracMin: opts.laneFracMin ?? 0.30,
    laneFracMax: opts.laneFracMax ?? 0.55,
    withersMin: opts.withersMin ?? 0.22,
    withersMax: opts.withersMax ?? 0.32,
    withersTarget: opts.withersTarget ?? 0.27,
    /** grow to withersMin even if that fights the lane — default off (anti-truck wins) */
    hardWithersMin: opts.hardWithersMin ?? false,
    playScaleMin: opts.playScaleMin ?? 0.85,
    playScaleMax: opts.playScaleMax ?? 1.15,
    ...opts,
  };
}

/**
 * @param {{ boltWidthPx: number, boltWithersPx: number, laneWidthPx: number, frameH: number }} args
 *   boltWithersPx — shoulder height in source px (not ear-tip bbox)
 * @returns {{ scale: number, withersFrac: number, laneFrac: number, reasons: string[] }}
 */
function computeScale(args, opts = {}) {
  const o = defaultOptions(opts);
  const { boltWidthPx, boltWithersPx, laneWidthPx, frameH } = args;
  const reasons = [];

  if (!(boltWidthPx > 0 && boltWithersPx > 0 && laneWidthPx > 0 && frameH > 0)) {
    throw new Error('computeScale: boltWidthPx, boltWithersPx, laneWidthPx, frameH must be > 0');
  }

  // 1) Prefer withers target (shoulders, not ears)
  let scale = (o.withersTarget * frameH) / boltWithersPx;
  reasons.push('withers_target');

  // 2) HARD: clamp stance into lane fraction band (anti-truck)
  scale = clampLane(scale, boltWidthPx, laneWidthPx, o, reasons);

  // 3) withersMax: shrink only if we stay ≥ laneFracMin
  let withersFrac = (boltWithersPx * scale) / frameH;
  if (withersFrac > o.withersMax) {
    const shrink = (o.withersMax * frameH) / boltWithersPx;
    const newLane = (boltWidthPx * shrink) / laneWidthPx;
    if (newLane + 1e-6 >= o.laneFracMin) {
      scale = shrink;
      reasons.push(`clamp_withers_max→${o.withersMax}`);
    } else {
      reasons.push('withers_max_blocked_by_lane');
    }
  } else if (withersFrac < o.withersMin) {
    if (o.hardWithersMin) {
      const grow = (o.withersMin * frameH) / boltWithersPx;
      const newLane = (boltWidthPx * grow) / laneWidthPx;
      if (newLane - 1e-6 <= o.laneFracMax) {
        scale = grow;
        reasons.push(`hard_withers_min→${o.withersMin}`);
      } else {
        reasons.push('hard_withers_min_blocked_by_lane');
      }
    } else {
      reasons.push('withers_min_soft');
    }
  }

  // 4) Re-assert HARD lane (anti-truck wins)
  scale = clampLane(scale, boltWidthPx, laneWidthPx, o, reasons);

  withersFrac = (boltWithersPx * scale) / frameH;
  const laneFrac = (boltWidthPx * scale) / laneWidthPx;

  return {
    scale,
    withersFrac,
    laneFrac,
    kLane: o.kLane,
    reasons,
  };
}

function clampLane(scale, boltWidthPx, laneWidthPx, o, reasons) {
  const laneFrac = (boltWidthPx * scale) / laneWidthPx;
  if (laneFrac > o.laneFracMax) {
    reasons.push(`clamp_lane_max→${o.laneFracMax}`);
    return (o.laneFracMax * laneWidthPx) / boltWidthPx;
  }
  if (laneFrac < o.laneFracMin) {
    reasons.push(`clamp_lane_min→${o.laneFracMin}`);
    return (o.laneFracMin * laneWidthPx) / boltWidthPx;
  }
  return scale;
}

function scaleAtS(baseScale, wS, wRef, opts = {}) {
  const o = defaultOptions(opts);
  if (!(wRef > 0)) throw new Error('scaleAtS: wRef must be > 0');
  const rel = clamp(wS / wRef, o.playScaleMin, o.playScaleMax);
  return baseScale * rel;
}

/**
 * Cook gate. laneFrac is HARD. withersMin is soft unless hardWithersMin.
 */
function assertScale(result, opts = {}) {
  const o = defaultOptions(opts);
  const fails = [];
  if (result.laneFrac < o.laneFracMin - 1e-6 || result.laneFrac > o.laneFracMax + 1e-6) {
    fails.push(
      `laneFrac ${result.laneFrac.toFixed(3)} outside [${o.laneFracMin},${o.laneFracMax}] (dog≈truck or flea)`
    );
  }
  if (result.withersFrac > o.withersMax + 1e-6) {
    fails.push(`withersFrac ${result.withersFrac.toFixed(3)} above ${o.withersMax}`);
  }
  if (o.hardWithersMin && result.withersFrac < o.withersMin - 1e-6) {
    fails.push(
      `withersFrac ${result.withersFrac.toFixed(3)} below ${o.withersMin} (hardWithersMin)`
    );
  }
  if (fails.length) {
    const err = new Error(
      'assertScale FAIL: ' +
        fails.join('; ') +
        ' — check cutout bbox vs lane width (path.json w(s)); measure withers at shoulders not ears'
    );
    err.fails = fails;
    throw err;
  }
  return true;
}

/** Full lane width in px from path table sample. `w` = half-width (UV or px). */
function laneWidthAt(table, s, frameW = null) {
  if (!table || !table.length) throw new Error('laneWidthAt: empty table');
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
  let half = best.w != null ? best.w : best.halfWidth != null ? best.halfWidth : best.width;
  if (half == null) throw new Error('laneWidthAt: sample missing w/width');
  let full = best.width != null && best.w == null && best.halfWidth == null ? half : 2 * half;
  if (frameW != null && full <= 2) full *= frameW; // UV → px heuristic
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

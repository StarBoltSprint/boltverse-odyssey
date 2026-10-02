/**
 * Billboard detector. A world-locked solid changes across a 5° orbit.
 * A camera-facing card stays pixel-identical until the next 45° swap.
 *
 * The tool measures crops. It does not draw them.
 */

export const IDENTICAL_MAE = 3 / 255;
const STEP_MIN = 3;
const STEP_MAX = 7;
const MIN_PIXELS = 30;
const CROP = 24;

function angDelta(a, b) {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

function skipLabel(label) {
  if (!label) return true;
  if (label === "hero" || label === "fog") return true;
  if (label.startsWith("gate:") || label.startsWith("fog")) return true;
  return false;
}

function bbox(ids, label) {
  const idx = ids.labels.indexOf(label);
  if (idx < 0) return null;
  let x0 = ids.width;
  let y0 = ids.height;
  let x1 = -1;
  let y1 = -1;
  let n = 0;
  for (let y = 0; y < ids.height; y++) {
    for (let x = 0; x < ids.width; x++) {
      if (ids.data[y * ids.width + x] !== idx) continue;
      n++;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  if (n < MIN_PIXELS || x1 < x0) return null;
  return { x0, y0, x1, y1, n };
}

function cropRgb(rgba, width, height, box) {
  const out = new Float32Array(CROP * CROP * 3);
  const bw = box.x1 - box.x0 + 1;
  const bh = box.y1 - box.y0 + 1;
  for (let y = 0; y < CROP; y++) {
    const sy = Math.min(box.y1, box.y0 + Math.floor(((y + 0.5) * bh) / CROP));
    for (let x = 0; x < CROP; x++) {
      const sx = Math.min(box.x1, box.x0 + Math.floor(((x + 0.5) * bw) / CROP));
      const clampedY = Math.max(0, Math.min(height - 1, sy));
      const clampedX = Math.max(0, Math.min(width - 1, sx));
      const i = (clampedY * width + clampedX) * 4;
      const o = (y * CROP + x) * 3;
      out[o] = rgba[i];
      out[o + 1] = rgba[i + 1];
      out[o + 2] = rgba[i + 2];
    }
  }
  return out;
}

export function cropMae(a, b) {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) sum += Math.abs(a[i] - b[i]);
  return sum / n / 255;
}

function bearingOf(frame) {
  const snap = frame.snap || {};
  if (typeof snap.bearingDeg === "number") return snap.bearingDeg;
  if (typeof snap.hdg === "number") return snap.hdg;
  return null;
}

/**
 * frames: { id, snap, rgba, width, height, ids } already decoded.
 * Returns identical pair count. Zero is the only pass for a measured solid.
 */
export function judgeOrbit(frames) {
  const byLabel = new Map();
  for (const frame of frames) {
    if (!frame.rgba || !frame.ids || !frame.width || !frame.height) continue;
    if (frame.ids.width !== frame.width || frame.ids.height !== frame.height) continue;
    const bearing = bearingOf(frame);
    if (bearing == null) continue;
    const labels = frame.ids.labels || [];
    for (const label of labels) {
      if (skipLabel(label)) continue;
      const box = bbox(frame.ids, label);
      if (!box) continue;
      const list = byLabel.get(label) || [];
      list.push({ bearing, crop: cropRgb(frame.rgba, frame.width, frame.height, box) });
      byLabel.set(label, list);
    }
  }
  const perObject = [];
  let identical = 0;
  let pairs = 0;
  for (const [id, samples] of byLabel) {
    samples.sort((a, b) => a.bearing - b.bearing);
    let same = 0;
    let compared = 0;
    for (let i = 1; i < samples.length; i++) {
      const delta = angDelta(samples[i].bearing, samples[i - 1].bearing);
      if (delta < STEP_MIN || delta > STEP_MAX) continue;
      compared++;
      const mae = cropMae(samples[i - 1].crop, samples[i].crop);
      if (mae <= IDENTICAL_MAE) {
        same++;
        identical++;
      }
    }
    pairs += compared;
    perObject.push({ id, samples: samples.length, pairs: compared, identical: same });
  }
  return {
    objects: perObject.length,
    pairs,
    identical,
    perObject,
    ok: pairs > 0 && identical === 0,
  };
}

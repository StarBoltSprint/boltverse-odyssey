/**
 * Invisible relief for Cascade Verdance. Numbers only. No pixels.
 * Walkable interior is an irregular highland, about 6500 m2. Not a circle.
 * Slope target: walkable rise ≤ 15° and ≤ 3 m inside any 20 m window.
 */

import { uvOf, stretchOf } from "./uvfield.js";

export const TILE = 1.45;
export const MICRO = 0.1;

let uvField = null;

export function setUvField(f) {
  uvField = f;
}

export function uvAt(x, z, out) {
  return uvOf(uvField, x, z, TILE, out || [0, 0]);
}

export function stretchAt(x, z) {
  if (!uvField) {
    const e = 0.45;
    const g = Math.hypot(macroAt(x + e, z) - macroAt(x - e, z), macroAt(x, z + e) - macroAt(x, z - e)) / (2 * e);
    return Math.sqrt(1 + g * g);
  }
  return stretchOf(uvField, x, z);
}

function radiusUnit(th) {
  let r = 1;
  r += 0.28 * Math.sin(2 * th + 0.2);
  r += 0.16 * Math.sin(3 * th + 1.1);
  r += 0.08 * Math.sin(5 * th - 0.4);
  r += 0.04 * Math.sin(7 * th + 2.2);
  return r;
}

function unitArea() {
  const n = 2048;
  const d = (Math.PI * 2) / n;
  let a = 0;
  for (let i = 0; i < n; i++) {
    const r = radiusUnit(i * d);
    a += 0.5 * r * r * d;
  }
  return a;
}

const AREA = 6500;
export const SCALE = Math.sqrt(AREA / unitArea());

export function radiusAt(th) {
  return radiusUnit(th) * SCALE;
}

/** Shallow runnel used only to pick the wet-slate family. It does not cut a cliff. */
export function channelAmt(x, z) {
  const cx = 6.5 * Math.sin(z * 0.045);
  const d = Math.abs(x - cx);
  return Math.exp(-(d * d) / (2 * 7 * 7)) * Math.exp(-(z * z) / (2 * 38 * 38));
}

export function macroAt(x, z) {
  const rho = Math.hypot(x, z);
  const th = Math.atan2(x, z);
  const R = radiusAt(th);
  const u = rho / Math.max(1, R);
  let h = 0;
  // Broad swell, north-east. Amplitude 2.2 m, widths 16 m and 12 m (slope about 8°).
  const s1x = x - 22;
  const s1z = z - 16;
  h += 2.2 * Math.exp(-(s1x * s1x) / (2 * 16 * 16) - (s1z * s1z) / (2 * 12 * 12));
  // Second knoll, west. 1.5 m over 11 m.
  const s2x = x + 26;
  const s2z = z - 6;
  h += 1.5 * Math.exp(-(s2x * s2x) / (2 * 11 * 11) - (s2z * s2z) / (2 * 11 * 11));
  // Valley basin, south. Separated from both swells so a 20 m window stays under 3 m.
  const bx = x + 4;
  const bz = z + 28;
  h -= 1.6 * Math.exp(-(bx * bx) / (2 * 14 * 14) - (bz * bz) / (2 * 12 * 12));
  // Shallow runnel, a few decimetres, wide enough to walk.
  h -= 0.4 * channelAmt(x, z);
  // Soft outer lip, clamped. 0.45 m over the last stretch of the radius, not a berm.
  if (u > 0.86) {
    const t = Math.min(1, (u - 0.86) / 0.14);
    h += t * t * 0.45;
  }
  return h;
}

export function familyAt(x, z) {
  const h = macroAt(x, z);
  if (h > 0.65) return 0;
  if (h < -0.4) return 2;
  if (channelAmt(x, z) > 0.45 && h < 0.35) return 6;
  return 4;
}

let maps = [];

export function setDepthMaps(next) {
  maps = next;
}

function sampleMap(map, u, v) {
  if (!map) return 0;
  const w = map.w;
  const h = map.h;
  const x = ((u % 1) + 1) % 1;
  const y = ((v % 1) + 1) % 1;
  const fx = x * (w - 1);
  const fy = y * (h - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const d = map.data;
  const s = (ix, iy) => d[iy * w + ix];
  const a = s(x0, y0) * (1 - tx) + s(x1, y0) * tx;
  const b = s(x0, y1) * (1 - tx) + s(x1, y1) * tx;
  return a * (1 - ty) + b * ty;
}

export function microAt(x, z) {
  const fam = familyAt(x, z);
  const map = maps[fam];
  if (!map) return 0;
  const byte = sampleMap(map, x / TILE, z / TILE);
  const hp = (byte - 128) / 100;
  return hp * MICRO;
}

export function heightAt(x, z) {
  return macroAt(x, z) + microAt(x, z);
}

export function slopeAt(x, z) {
  const e = 2.0;
  const hx = macroAt(x + e, z) - macroAt(x - e, z);
  const hz = macroAt(x, z + e) - macroAt(x, z - e);
  return Math.hypot(hx, hz) / (2 * e);
}

export function contain(x, z) {
  const rho = Math.hypot(x, z);
  if (rho < 0.001) return { x, z };
  const th = Math.atan2(x, z);
  const limit = radiusAt(th) * 1.045;
  if (rho <= limit) return { x, z };
  const k = limit / rho;
  return { x: x * k, z: z * k };
}

export function areaM2() {
  return AREA;
}

export function maxRadius() {
  let m = 0;
  for (let i = 0; i < 64; i++) m = Math.max(m, radiusAt((i / 64) * Math.PI * 2));
  return m;
}

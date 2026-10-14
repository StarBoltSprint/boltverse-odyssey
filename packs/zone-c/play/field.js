/**
 * Invisible relief for Cascade Verdance. Numbers only. No pixels.
 * Walkable highland, about 148000 m2, rolling hills and one valley. Not a circle.
 * Walkable rise stays ≤ 15°. Taller cliffs are solids, not this relief.
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

const AREA = 148000;
export const SCALE = Math.sqrt(AREA / unitArea());

export function radiusAt(th) {
  return radiusUnit(th) * SCALE;
}

/** Broad valley weight. It tints the wet family. It does not cut a cliff. */
export function channelAmt(x, z) {
  const dx = x + 18;
  const dz = z - 64;
  return Math.exp(-(dx * dx) / (2 * 52 * 52) - (dz * dz) / (2 * 44 * 44));
}

function bell(x, z, cx, cz, amp, sx, sz) {
  const dx = x - cx;
  const dz = z - cz;
  return amp * Math.exp(-(dx * dx) / (2 * sx * sx) - (dz * dz) / (2 * sz * sz));
}

export function macroAt(x, z) {
  let h = 0;
  // Wide ridges. Each bell stays under about 12° on its own. Overlaps are checked in qc.
  // Separated ridges. The ground between them stays a valley, near zero.
  // Amplitude / sigma stays under the 15° peak of one bell (about 0.606 A/s).
  h += bell(x, z, 130, 24, 26, 78, 68);
  h += bell(x, z, -150, -24, 24, 80, 72);
  h += bell(x, z, 6, -156, 22, 76, 64);
  h += bell(x, z, -28, 168, 20, 74, 62);
  h += bell(x, z, 188, -96, 16, 70, 64);
  h += bell(x, z, -196, 110, 15, 68, 60);
  h += bell(x, z, 160, 140, 14, 66, 58);
  h += bell(x, z, -96, -140, 11, 70, 62);
  // Near shoulder in front of the valley spawn. Its own peak slope is about 13°.
  h += bell(x, z, 78, -36, 14, 64, 56);
  return h;
}

export function familyAt(x, z) {
  const h = macroAt(x, z);
  if (h > 26) return 0;
  if (h < 10) return 6;
  if (h < 16) return 2;
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

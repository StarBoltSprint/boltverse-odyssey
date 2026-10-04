/**
 * Invisible relief for zone B. Numbers only. No pixels.
 * Area is at least the zone A clearing. Each feature stays inside the
 * walk targets: amplitude at most 3 m, sigma at least 2.27 times amplitude.
 */

export const TILE = 1.42;
export const MICRO = 0.1;
export const MASK_M = 22;
const AREA = 7800;

function radiusUnit(th) {
  let r = 1;
  r += 0.18 * Math.sin(2 * th + 1.7);
  r += 0.16 * Math.sin(3 * th + 0.4);
  r += 0.11 * Math.sin(5 * th + 2.2);
  r += 0.07 * Math.sin(7 * th - 0.9);
  r += 0.04 * Math.sin(4 * th + 0.2);
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

export const SCALE = Math.sqrt(AREA / unitArea());

export function radiusAt(th) {
  return radiusUnit(th) * SCALE;
}

export function crackAmt(x, z) {
  const f = Math.abs(Math.sin(x * 0.11 + Math.sin(z * 0.07) * 1.2));
  const g = Math.abs(Math.sin(z * 0.09 + Math.sin(x * 0.05) * 1.1));
  return Math.min(f, g);
}

function gauss(dx, sx, dz, sz) {
  return Math.exp(-(dx * dx) / (2 * sx * sx) - (dz * dz) / (2 * sz * sz));
}

export function macroAt(x, z) {
  const rho = Math.hypot(x, z);
  const th = Math.atan2(x, z);
  const R = radiusAt(th);
  const u = rho / Math.max(1, R);
  let h = 0;
  // Far rise. A = 2.2, sigma 20 by 16. Steepest slope about 0.067.
  const hd = 0.9;
  const ax = Math.sin(hd);
  const az = Math.cos(hd);
  const along = x * ax + z * az;
  const across = -x * az + z * ax;
  const crestC = 0.48 * radiusAt(hd);
  h += 2.2 * gauss(along - crestC, 20, across, 16);
  // Second rise, opposite side, so the two do not stack.
  const hd2 = hd + Math.PI * 0.85;
  const ax2 = Math.sin(hd2);
  const az2 = Math.cos(hd2);
  const along2 = x * ax2 + z * az2;
  const across2 = -x * az2 + z * ax2;
  h += 1.6 * gauss(along2 - 0.42 * radiusAt(hd2), 18, across2, 14);
  // Shallow basin.
  h -= 1.5 * gauss(x + 16, 16, z - 6, 14);
  // Shallow channel, wide enough to stay under 15 degrees.
  const cx = 6.5 * Math.sin(z * 0.045);
  h -= 0.7 * gauss(x - cx, 9, 0, 40);
  // Low crack dip. Wavelength is long, amplitude is small.
  const crack = crackAmt(x, z);
  if (crack < 0.2) h -= (0.2 - crack) * 0.35;
  // Soft outer rise. 0.9 m across a fixed 18 m, so a narrow radius stays walkable.
  const rim0 = R - 18;
  if (rho > rim0) {
    const t = Math.min(1, (rho - rim0) / 18);
    const s = t * t * (3 - 2 * t);
    h += s * 0.9;
  }
  return h;
}

const RIDGE = 0.85;
const HOLLOW = -0.42;
const LOW = -0.08;
const BAND = 0.32;

export function familyAt(x, z) {
  return familyBlend(x, z).a;
}

/** a/b are even slot ids. w is 0 inside a family and rises toward a boundary. */
export function familyBlend(x, z) {
  const h = macroAt(x, z);
  const crack = crackAmt(x, z);
  let a = 4;
  if (h > RIDGE) a = 0;
  else if (h < HOLLOW) a = 2;
  else if (crack < 0.12) a = 6;
  else if (h < LOW) a = 2;
  let b = a;
  let w = 0;
  if (a === 0) {
    const d = h - RIDGE;
    if (d < BAND) { b = 4; w = 1 - d / BAND; }
  } else if (a === 2 && h <= HOLLOW) {
    const d = HOLLOW - h;
    if (d < BAND) { b = 4; w = 1 - d / BAND; }
  } else if (a === 6) {
    const d = 0.12 - crack;
    if (d < 0.05) { b = 4; w = 1 - d / 0.05; }
  } else if (a === 2) {
    const d = LOW - h;
    if (d < BAND) { b = 4; w = 1 - d / BAND; }
  } else {
    const dR = RIDGE - h;
    const dL = h - LOW;
    if (dR < BAND && dR <= dL) { b = 0; w = 1 - dR / BAND; }
    else if (dL < BAND) { b = 2; w = 1 - dL / BAND; }
  }
  if (w < 0) w = 0;
  if (w > 1) w = 1;
  return { a, b, w };
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
  const p = s(x0, y0) * (1 - tx) + s(x1, y0) * tx;
  const q = s(x0, y1) * (1 - tx) + s(x1, y1) * tx;
  return p * (1 - ty) + q * ty;
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
  const e = 0.45;
  const hx = heightAt(x + e, z) - heightAt(x - e, z);
  const hz = heightAt(x, z + e) - heightAt(x, z - e);
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

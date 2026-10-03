/**
 * Invisible relief for zone A. Numbers only. No pixels.
 * Walkable interior is the irregular rim at u = 1, about 6500 m2.
 */

export const TILE = 1.45;
export const MICRO = 0.1;

function radiusUnit(th) {
  let r = 1;
  r += 0.22 * Math.sin(2 * th + 0.4);
  r += 0.14 * Math.sin(3 * th + 1.15);
  r += 0.09 * Math.sin(5 * th - 0.7);
  r += 0.05 * Math.sin(7 * th + 2.05);
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

export const SCALE = Math.sqrt(6500 / unitArea());

export function radiusAt(th) {
  return radiusUnit(th) * SCALE;
}

export function crackAmt(x, z) {
  const f = Math.abs(Math.sin(x * 0.29 + Math.sin(z * 0.16) * 1.35));
  const g = Math.abs(Math.sin(z * 0.24 + Math.sin(x * 0.12) * 1.15));
  return Math.min(f, g);
}

export function macroAt(x, z) {
  const rho = Math.hypot(x, z);
  const th = Math.atan2(x, z);
  const R = radiusAt(th);
  const u = rho / Math.max(1, R);
  const hd = 0.55;
  const ax = Math.sin(hd);
  const az = Math.cos(hd);
  const along = x * ax + z * az;
  const across = -x * az + z * ax;
  const crestC = 0.62 * radiusAt(hd);
  let h = 0;
  const crest = Math.exp(-((along - crestC) ** 2) / (2 * 18 * 18) - (across ** 2) / (2 * 8.5 * 8.5));
  h += 6.4 * Math.pow(crest, 0.62);
  if (h > 5.2) h = 5.2 + (h - 5.2) * 0.18;
  const dline = Math.abs(x + 11 - 0.26 * z);
  const win = Math.exp(-((z + 4) ** 2) / (2 * 18 * 18));
  h += 3.1 * Math.exp(-(dline ** 2) / (2 * 7.4 * 7.4)) * win;
  const cx = 8.2 * Math.sin(z * 0.08);
  const cd = x - cx;
  const cwin = Math.exp(-(z * z) / (2 * 36 * 36));
  h -= 1.05 * Math.exp(-(cd * cd) / (2 * 5.6 * 5.6)) * cwin;
  const b1x = x + 20;
  const b1z = z - 9;
  h -= 2.2 * Math.exp(-(b1x * b1x) / (2 * 12 * 12) - (b1z * b1z) / (2 * 8 * 8));
  const b2x = x - 15;
  const b2z = z + 18;
  h -= 1.2 * Math.exp(-(b2x * b2x) / (2 * 13 * 13) - (b2z * b2z) / (2 * 6.2 * 6.2));
  const crack = crackAmt(x, z);
  if (crack < 0.15) h -= (0.15 - crack) * 0.7;
  if (u > 0.9) {
    const t = (u - 0.9) / 0.14;
    h += t * t * 2.6;
  }
  return h;
}

export function familyAt(x, z) {
  const h = macroAt(x, z);
  if (h > 1.25) return 0;
  if (h < -0.55) return 2;
  if (crackAmt(x, z) < 0.13) return 6;
  if (h < -0.15) return 2;
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
  let x = ((u % 1) + 1) % 1;
  let y = ((v % 1) + 1) % 1;
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
  return 6500;
}

export function maxRadius() {
  let m = 0;
  for (let i = 0; i < 64; i++) m = Math.max(m, radiusAt((i / 64) * Math.PI * 2));
  return m;
}

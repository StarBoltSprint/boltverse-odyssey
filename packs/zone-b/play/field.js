/**
 * Invisible relief for the Ember Mesa floor. Numbers only. No pixels.
 * Walkable outline is a star-shaped canyon, about 145 m along +z.
 * Heading matches play.js: th = atan2(x, z), 0 moves toward +z.
 * A check: radiusAt(0) lands on the north edge (positive z).
 */

export const TILE = 1.42;
export const MICRO = 0.1;
export const MASK_M = 22;
const AREA_TARGET = 6500;

// Hand outline in metres, before the area fit. West wall, then the south
// edge, then the east wall back to the north edge.
const RAW = [
  [-25.59, 71.8],
  [-22.64, 44.23],
  [-19.68, 17.65],
  [-19.68, -7.94],
  [-21.65, -31.57],
  [-24.6, -54.21],
  [-22.64, -71.93],
  [21.66, -71.93],
  [25.6, -51.26],
  [24.62, -27.63],
  [22.65, -5.97],
  [20.68, 15.68],
  [22.65, 41.28],
  [24.62, 71.8],
];

function shoelace(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    a += poly[i][0] * poly[j][1] - poly[j][0] * poly[i][1];
  }
  return Math.abs(a) * 0.5;
}

export const SCALE = Math.sqrt(AREA_TARGET / shoelace(RAW));

const POLY = RAW.map(([x, z]) => [x * SCALE, z * SCALE]);

function hitRay(th) {
  const dx = Math.sin(th);
  const dz = Math.cos(th);
  let best = 1e9;
  let hits = 0;
  for (let i = 0; i < POLY.length; i++) {
    const x1 = POLY[i][0];
    const z1 = POLY[i][1];
    const x2 = POLY[(i + 1) % POLY.length][0];
    const z2 = POLY[(i + 1) % POLY.length][1];
    const ex = x2 - x1;
    const ez = z2 - z1;
    const denom = ex * dz - dx * ez;
    if (Math.abs(denom) < 1e-8) continue;
    const t = (ex * z1 - ez * x1) / denom;
    const s = (dx * z1 - dz * x1) / denom;
    if (t > 0.02 && s >= -1e-4 && s <= 1 + 1e-4) {
      hits++;
      if (t < best) best = t;
    }
  }
  return { t: best > 1e8 ? 1 : best, hits };
}

export function radiusAt(th) {
  return hitRay(th).t;
}

export function rayHits(th) {
  return hitRay(th).hits;
}

function gauss(dx, sx, dz, sz) {
  return Math.exp(-(dx * dx) / (2 * sx * sx) - (dz * dz) / (2 * sz * sz));
}

function smooth(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

// Seats for the three reused butte lofts. Same order as the manifest.
// Centres sit 25 m outside the walk edge so a phone view never enlarges them.
// The mound is wide on purpose: a narrow peak stayed inside the skirt trench
// and the loft read as a block on flat sand.
export const BUTTES = [
  { x: 46, z: 22, amp: 2.8, sigma: 32 },
  { x: -48.6, z: 55, amp: 2.2, sigma: 30 },
  { x: 0, z: -96.8, amp: 2.8, sigma: 32 },
];

export const LOOP = [
  { name: "plaza", x: 0, z: 58 },
  { name: "slot", x: 0, z: 22 },
  { name: "basin", x: 2, z: -10 },
  { name: "wash", x: 0, z: -38 },
  { name: "outpost", x: 0, z: -60 },
  { name: "mesa-road", x: -12, z: 0 },
  { name: "return", x: -8, z: 45 },
];

function butteMound(x, z) {
  let h = 0;
  for (let i = 0; i < BUTTES.length; i++) {
    const b = BUTTES[i];
    h += b.amp * gauss(x - b.x, b.sigma, z - b.z, b.sigma);
  }
  return h;
}

function segDist(x, z) {
  let best = 1e9;
  for (let i = 0; i < POLY.length; i++) {
    const x1 = POLY[i][0];
    const z1 = POLY[i][1];
    const x2 = POLY[(i + 1) % POLY.length][0];
    const z2 = POLY[(i + 1) % POLY.length][1];
    const ex = x2 - x1;
    const ez = z2 - z1;
    const l2 = ex * ex + ez * ez || 1;
    let t = ((x - x1) * ex + (z - z1) * ez) / l2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const dx = x - (x1 + ex * t);
    const dz = z - (z1 + ez * t);
    const d = Math.hypot(dx, dz);
    if (d < best) best = d;
  }
  return best;
}

export function macroAt(x, z) {
  let h = 0;
  // Slot floor sits 0.6 m under the plaza across about 40 m.
  h -= 0.6 * smooth((42 - z) / 40);
  // Outpost shelf, 0.7 m, across about 22 m.
  h += 0.7 * smooth((-40 - z) / 22);
  // Basin dunes. Wavelength 40 m, amplitude under 1 m, faded at the wall.
  const wall = segDist(x, z);
  const rimIn = Math.max(0, Math.min(1, wall / 16));
  const basin = Math.exp(-((z + 10) * (z + 10)) / (2 * 16 * 16));
  const dune = Math.sin((x * Math.PI * 2) / 40 + z * 0.04) * Math.cos((z * Math.PI * 2) / 42);
  h += 0.5 * dune * basin * rimIn;
  // Butte skirts cross the rim. A wide low mound, not a second cliff.
  const mound = butteMound(x, z);
  h += mound;
  // Berm in the last 14 m, measured to the wall. It fades where the mound
  // is already the rise, so the two do not stack into a step.
  if (wall < 14) {
    const bermW = 1 - Math.min(1, mound / 1.2);
    h += smooth(1 - wall / 14) * 1.35 * bermW;
  }
  return h;
}

export function familyAt(x, z) {
  return familyBlend(x, z).a;
}

/** a/b are even slot ids. w is 0 inside a family and rises toward a boundary. */
export function familyBlend(x, z) {
  const wall = segDist(x, z);
  const rim = Math.max(0, Math.min(1, (14 - wall) / 8));
  const basin = Math.exp(-((z + 10) * (z + 10)) / (2 * 14 * 14));
  const slot = Math.exp(-((z - 22) * (z - 22)) / (2 * 16 * 16));
  const wash = Math.exp(-((z + 35) * (z + 35)) / (2 * 10 * 10));
  let a = 4;
  let b = 4;
  let w = 0;
  if (rim > 0.55) {
    a = 0;
    b = 4;
    w = 1 - (rim - 0.55) / 0.45;
  } else if (basin > slot && basin > wash && basin > 0.35) {
    a = 2;
    b = 4;
    w = 1 - Math.min(1, (basin - 0.35) / 0.4);
  } else if (slot > 0.35 || wash > 0.35) {
    a = 6;
    b = 4;
    w = 1 - Math.min(1, (Math.max(slot, wash) - 0.35) / 0.4);
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

export function wallDist(x, z) {
  return segDist(x, z);
}

export function inside(x, z) {
  const rho = Math.hypot(x, z);
  if (rho < 0.001) return true;
  return rho <= radiusAt(Math.atan2(x, z)) + 1e-2;
}

export function contain(x, z) {
  const rho = Math.hypot(x, z);
  if (rho < 0.001) return { x, z };
  const th = Math.atan2(x, z);
  const limit = radiusAt(th);
  if (rho <= limit) return { x, z };
  const k = limit / rho;
  return { x: x * k, z: z * k };
}

export function areaM2() {
  return shoelace(POLY);
}

export function maxRadius() {
  let m = 0;
  for (let i = 0; i < POLY.length; i++) {
    m = Math.max(m, Math.hypot(POLY[i][0], POLY[i][1]));
  }
  return m;
}

export function footprint() {
  return POLY.map((p) => [p[0], p[1]]);
}

// Visual skirt past the berm. The walked relief stays in macroAt.
// The old 28 m rise covered painted mesas in the sky slices. Those
// paintings are gone, so the skirt only lifts a few metres at the far fade.
export const SKIRT_FAR = 480;
export const SKIRT_LIFT = 3.5;

export function skirtLift(x, z) {
  const rho = Math.hypot(x, z);
  const R = radiusAt(Math.atan2(x, z));
  if (rho <= R) return 0;
  const d = rho - R;
  const lipD = 12;
  let y;
  if (d < lipD) {
    y = -2.2 * smooth(d / lipD);
  } else {
    const span = Math.max(1, SKIRT_FAR - R - lipD);
    const s = smooth(Math.min(1, (d - lipD) / span));
    y = -2.2 + s * (SKIRT_LIFT + 2.2);
  }
  // The lip is a trench. Cancel it on a butte mound so the loft sits on the
  // skirt instead of in the hole. This includes the first 12 m, or the
  // trench opens in front of the rock.
  const mound = butteMound(x, z);
  if (mound > 0.35 && y < 0) {
    const cover = Math.min(1, (mound - 0.35) / 1.05);
    y *= 1 - cover;
  }
  return y;
}

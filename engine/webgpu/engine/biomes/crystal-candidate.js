// Crystal candidate. TAA and SSGI are on here only.
// The live meadow biome does not import this file.
// Quartz is a dielectric (F0 0.04), rough, never chrome. No fog.

export const CRYSTAL_CANDIDATE = {
  name: 'crystal-candidate',
  fog: 0,
  taa: { on: true, history: 0.95, samples: 8, motionPx: 24, objectMv: true, clamp: true, reject: true },
  ssgi: {
    on: true, scale: 0.5, rays: 2, steps: 32, frames: 8, strength: 1,
    thickness: 0.05, stepBase: 0.045, stepGrow: 1.16, maxStep: 0.16,
    sky: [0.10, 0.13, 0.18],
  },
  crystal: { albedo: [0.58, 0.78, 0.80], f0: 0.04, spec: 0.10, emit: [0.05, 0.08, 0.09] },
  sun: [0, 0.72, -1],
  sunCol: [1.55, 1.40, 1.18],
  ambient: [0.070, 0.075, 0.080],
  exposure: 2.8,
  coat: 0.52,
  window: { z: 0.12, x0: -1.6, x1: 1.6, y0: 0.35, y1: 2.4 },
  room: { x: 3.35, y: 3.0, z1: 4.98 },
  fin: { c: [0.72, 1.15, 4.00], h: [0.06, 1.15, 0.75] },
  pocket: { c: [1.15, 1.10, 4.25], h: [0.22, 1.10, 0.45] },
  stone: {
    x0: -1.62, y0: 0.08, zFront: 4.70,
    sizeX: 0.16, sizeY: 0.12, gapX: 0.0022, gapY: 0.0022, depth: 0.05,
    cols: 20, rows: 22, ix: 10, iy: 5, noseIx: 4, noseIy: 8,
  },
  floorProbe: [0, 0.06, 3.15],
};

const n3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const num = (v) => Number(v).toFixed(5);

export function stoneCentre(cfg, ix, iy) {
  const s = cfg.stone;
  const px = s.sizeX + s.gapX;
  const py = s.sizeY + s.gapY;
  return [s.x0 + (ix + 0.5) * px, s.y0 + (iy + 0.5) * py, s.zFront + s.depth * 0.5];
}

export function probes(cfg = CRYSTAL_CANDIDATE) {
  const s = cfg.stone;
  const c = stoneCentre(cfg, s.ix, s.iy);
  const wall = [c[0], c[1], s.zFront - 0.04];
  const face = cfg.pocket.c[0] - cfg.pocket.h[0];
  const pocket = [face - 0.03, 0.72, cfg.pocket.c[2]];
  const noseC = stoneCentre(cfg, s.noseIx, s.noseIy);
  const nose = [noseC[0], noseC[1], s.zFront - 0.11];
  return { wall, pocket, floor: cfg.floorProbe.slice(), stone: c, nose };
}

function slabHit(ro, rd, bmin, bmax, tmax) {
  let t0 = 0, t1 = tmax;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(rd[a]) < 1e-6) {
      if (ro[a] < bmin[a] || ro[a] > bmax[a]) return false;
    } else {
      let s0 = (bmin[a] - ro[a]) / rd[a];
      let s1 = (bmax[a] - ro[a]) / rd[a];
      if (s0 > s1) { const k = s0; s0 = s1; s1 = k; }
      t0 = Math.max(t0, s0);
      t1 = Math.min(t1, s1);
      if (t0 > t1) return false;
    }
  }
  return t1 > 0 && t0 < tmax;
}

export function sunVisible(p, cfg = CRYSTAL_CANDIDATE) {
  const rd = n3(cfg.sun);
  if (rd[2] > -1e-4) return false;
  const t = (cfg.window.z - p[2]) / rd[2];
  if (t <= 0) return false;
  const q = [p[0] + rd[0] * t, p[1] + rd[1] * t, p[2] + rd[2] * t];
  const w = cfg.window;
  if (q[0] < w.x0 || q[0] > w.x1 || q[1] < w.y0 || q[1] > w.y1) return false;
  const f = cfg.fin;
  const bmin = [f.c[0] - f.h[0], f.c[1] - f.h[1], f.c[2] - f.h[2]];
  const bmax = [f.c[0] + f.h[0], f.c[1] + f.h[1], f.c[2] + f.h[2]];
  if (slabHit(p, rd, bmin, bmax, t)) return false;
  return true;
}

export function segmentHitsFin(a, b, cfg = CRYSTAL_CANDIDATE) {
  const rd = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const f = cfg.fin;
  const bmin = [f.c[0] - f.h[0], f.c[1] - f.h[1], f.c[2] - f.h[2]];
  const bmax = [f.c[0] + f.h[0], f.c[1] + f.h[1], f.c[2] + f.h[2]];
  return slabHit(a, rd, bmin, bmax, 1);
}

function pushBox(out, c, h, mat) {
  out.push(c[0], c[1], c[2], mat, h[0], h[1], h[2], 0);
}

export function buildBoxes(cfg = CRYSTAL_CANDIDATE) {
  const o = [];
  const R = cfg.room;
  const W = cfg.window;
  const apertureCx = (W.x0 + W.x1) * 0.5;
  const apertureHx = (W.x1 - W.x0) * 0.5;
  pushBox(o, [0, -0.06, R.z1 * 0.5], [R.x, 0.06, R.z1 * 0.5], 3);
  pushBox(o, [0, R.y + 0.06, R.z1 * 0.5], [R.x, 0.06, R.z1 * 0.5], 0);
  pushBox(o, [-R.x - 0.08, R.y * 0.5, R.z1 * 0.5], [0.08, R.y * 0.5, R.z1 * 0.5], 0);
  pushBox(o, [R.x + 0.08, R.y * 0.5, R.z1 * 0.5], [0.08, R.y * 0.5, R.z1 * 0.5], 0);
  pushBox(o, [0, R.y * 0.5, R.z1 + 0.06], [R.x, R.y * 0.5, 0.06], 0);
  const wz = W.z, whz = 0.08;
  pushBox(o, [( -R.x + W.x0) * 0.5, R.y * 0.5, wz], [(W.x0 + R.x) * 0.5, R.y * 0.5, whz], 0);
  pushBox(o, [(W.x1 + R.x) * 0.5, R.y * 0.5, wz], [(R.x - W.x1) * 0.5, R.y * 0.5, whz], 0);
  pushBox(o, [apertureCx, W.y0 * 0.5, wz], [apertureHx, W.y0 * 0.5, whz], 0);
  pushBox(o, [apertureCx, (W.y1 + R.y) * 0.5, wz], [apertureHx, (R.y - W.y1) * 0.5, whz], 0);
  const s = cfg.stone;
  const px = s.sizeX + s.gapX, py = s.sizeY + s.gapY;
  const gridW = s.cols * px, gridH = s.rows * py;
  pushBox(o, [s.x0 + gridW * 0.5, s.y0 + gridH * 0.5, s.zFront + s.depth + 0.03], [gridW * 0.5, gridH * 0.5, 0.02], 1);
  for (let iy = 0; iy < s.rows; iy++) {
    for (let ix = 0; ix < s.cols; ix++) {
      const c = stoneCentre(cfg, ix, iy);
      pushBox(o, c, [s.sizeX * 0.5, s.sizeY * 0.5, s.depth * 0.5], 0);
    }
  }
  const nose = stoneCentre(cfg, s.noseIx, s.noseIy);
  pushBox(o, [nose[0], nose[1], s.zFront - 0.06], [0.055, 0.045, 0.04], 0);
  pushBox(o, cfg.fin.c, cfg.fin.h, 0);
  pushBox(o, cfg.pocket.c, cfg.pocket.h, 0);
  pushBox(o, [-2.15, 0.75, 1.35], [0.07, 0.62, 0.07], 2);
  pushBox(o, [-2.45, 1.15, 1.85], [0.05, 0.48, 0.05], 2);
  pushBox(o, [-1.85, 0.42, 1.05], [0.06, 0.36, 0.06], 2);
  return { data: new Float32Array(o), count: o.length / 8 };
}

export function sunWgsl(cfg = CRYSTAL_CANDIDATE) {
  const rd = n3(cfg.sun);
  const w = cfg.window;
  const f = cfg.fin;
  const b0 = [f.c[0] - f.h[0], f.c[1] - f.h[1], f.c[2] - f.h[2]];
  const b1 = [f.c[0] + f.h[0], f.c[1] + f.h[1], f.c[2] + f.h[2]];
  return `
fn slabAxis(ro: f32, rd: f32, a: f32, b: f32, t0: ptr<function, f32>, t1: ptr<function, f32>) -> bool {
  if (abs(rd) < 1e-6) { return ro >= a && ro <= b; }
  let s0 = (a - ro) / rd; let s1 = (b - ro) / rd;
  *t0 = max(*t0, min(s0, s1));
  *t1 = min(*t1, max(s0, s1));
  return *t0 <= *t1;
}
fn sunVis(p: vec3f) -> f32 {
  let rd = vec3f(${num(rd[0])}, ${num(rd[1])}, ${num(rd[2])});
  if (rd.z > -1e-4) { return 0.0; }
  let tWin = (${num(w.z)} - p.z) / rd.z;
  if (tWin <= 0.0) { return 0.0; }
  let q = p + rd * tWin;
  if (q.x < ${num(w.x0)} || q.x > ${num(w.x1)} || q.y < ${num(w.y0)} || q.y > ${num(w.y1)}) { return 0.0; }
  var t0 = 0.0; var t1 = tWin;
  if (!slabAxis(p.x, rd.x, ${num(b0[0])}, ${num(b1[0])}, &t0, &t1)) { return 1.0; }
  if (!slabAxis(p.y, rd.y, ${num(b0[1])}, ${num(b1[1])}, &t0, &t1)) { return 1.0; }
  if (!slabAxis(p.z, rd.z, ${num(b0[2])}, ${num(b1[2])}, &t0, &t1)) { return 1.0; }
  if (t0 <= t1 && t1 > 0.0 && t0 < tWin) { return 0.0; }
  return 1.0;
}`;
}

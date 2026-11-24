// D9 gates. Thresholds are fixed. They are not lowered after a miss.
// Terminator: brightness gradient on the disc within 15 deg of the scene sun.
// Banding: top-band 8-bit steps <= 1 and no posterized edge.
// Limb: no channel-triple at or above 235, night rim at most 6% of the radius,
// dark limb at least 20 levels under the adjacent sky. The old bright-rim gap
// was that haze, so it is not a pass condition.
// Measured on 720x1280 follow frames.
import { spawnSync } from 'child_process';
import { SCENE_SUN } from './scene-sun.js';
import { planetCenter, PLANET } from './biome.js';
import { buildWorld, spawn, integrate, chaseInput } from './world.js';
import { followEye, lookAt, persp, mul, FOV_Y } from '../engine/bricks/follow-cam.js';
import { invertMat4 } from '../biome-factory/mat4.js';
import { boltIdle } from '../bricks/bolt-idle.js';

export const TIMES = [5.10, 5.567, 7.9, 11.70, 24, 30];
export const W = 720;
export const H = 1280;
export const TERMINATOR_DEG = 15;
export const STEP_MAX = 1;
export const LIT_GAP = 8;
export const RIM_GAP = 4;
export const PROFILE_SPAN = 8;
export const GRAD_MIN = 0.04;
export const HF_MAX = 2.5;
export const SKY_ANCHOR = 0.015;
export const DE76_MAX = 10;
export const RIM_WIDTH_MAX = 0.06;
export const DARK_LIMB_GAP = 20;

const SUN = SCENE_SUN;

function nrm(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function mulS(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function luma(r, g, b) { return 0.2126 * r + 0.7152 * g + 0.0722 * b; }

function angDiff(a, b) {
  let d = a - b;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return Math.abs(d);
}

export function loadRgb(file) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', file], { encoding: 'utf8' });
  if (probe.status !== 0) throw new Error(probe.stderr || 'ffprobe');
  const st = JSON.parse(probe.stdout).streams[0];
  const w = Number(st.width);
  const h = Number(st.height);
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { maxBuffer: w * h * 3 + 65536 });
  if (raw.status !== 0) throw new Error(raw.stderr?.toString() || 'ffmpeg');
  return { w, h, rgb: new Uint8Array(raw.stdout) };
}

function project(vp, p, w, h) {
  const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12];
  const y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
  const ww = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
  if (!(ww > 0)) return null;
  return [(x / ww * 0.5 + 0.5) * w, (1 - (y / ww * 0.5 + 0.5)) * h];
}

export function chasePoses(world) {
  const heightAt = world.heightAt;
  const idle = boltIdle();
  const live = spawn();
  const C = planetCenter();
  const R = PLANET.radius;
  const sun = nrm(SUN);
  let sim = 0;
  const dt = 1 / 60;
  const poses = [];
  for (const t of TIMES) {
    while (sim < t - 1e-6) {
      const h = Math.min(dt, t - sim);
      idle.stepMotion(live, h, true);
      integrate(live, h, chaseInput(sim, live));
      sim += h;
    }
    const ground = heightAt(live.x, live.z);
    const bp = [live.x, ground, live.z];
    const { eye, tgt } = followEye(bp, live.cam, heightAt, 0);
    const view = lookAt(eye, tgt, [0, 1, 0]);
    const vp = mul(persp(FOV_Y, W / H, 0.08, 14000), view);
    const center = project(vp, C, W, H);
    const right = [view[0], view[4], view[8]];
    const edge = project(vp, add(C, mulS(right, R)), W, H);
    const rad = center && edge ? Math.hypot(edge[0] - center[0], edge[1] - center[1]) : 0;
    const toEye = nrm(sub(eye, C));
    let lit = sub(sun, mulS(toEye, dot(sun, toEye)));
    const ll = Math.hypot(lit[0], lit[1], lit[2]) || 1;
    lit = [lit[0] / ll, lit[1] / ll, lit[2] / ll];
    const limb = project(vp, add(C, mulS(lit, R)), W, H);
    const sunDeg = center && limb ? Math.atan2(-(limb[1] - center[1]), limb[0] - center[0]) * 180 / Math.PI : null;
    poses.push({
      t,
      x: live.x,
      z: live.z,
      eye,
      tgt,
      vp,
      planet: C,
      radius: R,
      center,
      rad,
      sunDeg,
      elevDeg: Math.asin(sun[1]) * 180 / Math.PI,
    });
  }
  return poses;
}

function at(rgb, w, x, y) {
  const i = (y * w + x) * 3;
  return [rgb[i], rgb[i + 1], rgb[i + 2]];
}

function skyColumns(rgb, w, h) {
  const top = Math.min(72, h);
  const cols = [];
  for (let x = 0; x < w; x++) {
    let n = 0;
    let sr = 0;
    let sg = 0;
    let sb = 0;
    let sy = 0;
    let sy2 = 0;
    for (let y = 2; y < top; y++) {
      const [r, g, b] = at(rgb, w, x, y);
      const Y = luma(r, g, b);
      sr += r; sg += g; sb += b; sy += Y; sy2 += Y * Y; n++;
    }
    if (!n) continue;
    const medY = sy / n;
    const std = Math.sqrt(Math.max(0, sy2 / n - medY * medY));
    const br = (sb - sr) / n;
    if (medY > 125 && medY < 175 && std < 4.5 && br > 8 && br < 40) cols.push(x);
  }
  return { top, cols };
}

function trimmedMean(vals) {
  if (!vals.length) return NaN;
  const s = vals.slice().sort((a, b) => a - b);
  const lo = Math.floor(s.length * 0.1);
  const hi = Math.max(lo + 1, Math.ceil(s.length * 0.9));
  let acc = 0;
  let n = 0;
  for (let i = lo; i < hi && i < s.length; i++) { acc += s[i]; n++; }
  return n ? acc / n : NaN;
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[i];
}

export function scoreBanding(rgb, w, h) {
  const { top, cols } = skyColumns(rgb, w, h);
  if (cols.length < 40) {
    return { pass: false, reason: 'too few clear sky columns', columns: cols.length, maxStep: null, bandRun: null };
  }
  const steps = [];
  const runs = [];
  for (const x of cols) {
    const q = [];
    for (let y = 2; y < top; y++) {
      const [r, g, b] = at(rgb, w, x, y);
      q.push(Math.round(luma(r, g, b)));
    }
    let run = 1;
    let longest = 1;
    const held = [];
    let v = q[0];
    let count = 1;
    for (let i = 1; i < q.length; i++) {
      if (q[i] === q[i - 1]) { run++; longest = Math.max(longest, run); }
      else run = 1;
      if (q[i] === v) count++;
      else { held.push([v, count]); v = q[i]; count = 1; }
    }
    held.push([v, count]);
    let maxStep = 0;
    for (let i = 1; i < held.length; i++) {
      if (held[i - 1][1] >= 3 && held[i][1] >= 3) maxStep = Math.max(maxStep, Math.abs(held[i][0] - held[i - 1][0]));
    }
    steps.push(maxStep);
    runs.push(longest);
  }
  steps.sort((a, b) => a - b);
  runs.sort((a, b) => a - b);
  const maxStep = percentile(steps, 0.9);
  const bandRun = percentile(runs, 0.5);
  let hfAcc = 0;
  let hfN = 0;
  let smoothAcc = 0;
  const y0 = 4;
  const y1 = Math.min(top - 2, 64);
  for (let y = y0; y < y1; y++) {
    for (const x of cols) {
      if (x < 2 || x >= w - 2) continue;
      let acc = 0;
      let n = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const [r, g, b] = at(rgb, w, x + dx, y + dy);
          acc += luma(r, g, b);
          n++;
        }
      }
      const smooth = acc / n;
      const [r, g, b] = at(rgb, w, x, y);
      const d = luma(r, g, b) - smooth;
      hfAcc += d * d;
      smoothAcc += smooth;
      hfN++;
    }
  }
  const hfRms = hfN ? Math.sqrt(hfAcc / hfN) : null;
  const smoothMean = hfN ? smoothAcc / hfN : null;
  // A smooth reference is the 5x5 field. Its own high frequency is the residual
  // after a second, wider box, reported so the dither grain can be compared.
  let refAcc = 0;
  let refN = 0;
  for (let y = y0 + 3; y < y1 - 3; y += 2) {
    for (const x of cols) {
      if (x < 6 || x >= w - 6) continue;
      let a5 = 0;
      let n5 = 0;
      let aW = 0;
      let nW = 0;
      for (let dy = -5; dy <= 5; dy++) {
        for (let dx = -5; dx <= 5; dx++) {
          const [r, g, b] = at(rgb, w, x + dx, y + dy);
          const Y = luma(r, g, b);
          aW += Y; nW++;
          if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) { a5 += Y; n5++; }
        }
      }
      const d = a5 / n5 - aW / nW;
      refAcc += d * d;
      refN++;
    }
  }
  const smoothRms = refN ? Math.sqrt(refAcc / refN) : null;
  const pass = maxStep != null && maxStep <= STEP_MAX && bandRun != null && bandRun <= 10 && hfRms != null && hfRms <= HF_MAX;
  return {
    pass,
    columns: cols.length,
    maxStep,
    bandRun,
    hfRms: hfRms == null ? null : round(hfRms),
    smoothRms: smoothRms == null ? null : round(smoothRms),
    smoothMean: smoothMean == null ? null : round(smoothMean),
    stepLimit: STEP_MAX,
    runLimit: 10,
    hfLimit: HF_MAX,
  };
}

function isIce(r, g, b) {
  const Y = luma(r, g, b);
  return Y > 100 && (b - r) > 42;
}
function isFlake(r, g, b) {
  return luma(r, g, b) > 210;
}

function maskedPlanet(mask, w, x, y) {
  if (!mask) return false;
  const i = (y * w + x) * 3;
  return mask[i] > 4 && mask[i] < 16 && mask[i + 2] > 240;
}
function maskedNl(mask, w, x, y) {
  const i = (y * w + x) * 3;
  return mask[i + 1] > 200;
}
function maskIsNl(mask, w, h) {
  if (!mask) return false;
  // N·L debug is green on the planet and blue = 0. The planet-id mask is red ≈ 9
  // and blue = 255. The sky-id mask is green = 255 and blue = 255, so green alone
  // is not enough.
  let nl = 0;
  for (let y = 0; y < h; y += 8) {
    for (let x = 0; x < w; x += 8) {
      const i = (y * w + x) * 3;
      if (mask[i + 1] > 200 && mask[i + 2] < 16) nl++;
    }
  }
  return nl > 8;
}
function ndlSampler(pose) {
  const eye = pose.eye;
  const C = pose.planet;
  const R = pose.radius;
  const sun = nrm(SUN);
  if (!eye || !C || !pose.vp) return () => null;
  const ivp = invertMat4(pose.vp);
  return (x, y) => {
    const nx = (x / W) * 2 - 1;
    const ny = 1 - (y / H) * 2;
    const xp = ivp[0] * nx + ivp[4] * ny + ivp[8] * 0.5 + ivp[12];
    const yp = ivp[1] * nx + ivp[5] * ny + ivp[9] * 0.5 + ivp[13];
    const zp = ivp[2] * nx + ivp[6] * ny + ivp[10] * 0.5 + ivp[14];
    const wp = ivp[3] * nx + ivp[7] * ny + ivp[11] * 0.5 + ivp[15];
    if (!(Math.abs(wp) > 1e-8)) return null;
    const pt = [xp / wp, yp / wp, zp / wp];
    const dir = nrm(sub(pt, eye));
    const oc = sub(eye, C);
    const b = dot(oc, dir);
    const c = dot(oc, oc) - R * R;
    const h = b * b - c;
    if (h < 0) return null;
    const t = -b - Math.sqrt(h);
    const hit = [eye[0] + dir[0] * t, eye[1] + dir[1] * t, eye[2] + dir[2] * t];
    return dot(nrm(sub(hit, C)), sun);
  };
}

export function scorePlanet(rgb, w, h, pose, mask) {
  const cx = pose.center[0];
  const cy = pose.center[1];
  const rad = pose.rad;
  const sunDeg = pose.sunDeg;
  const samples = [];
  const nlMask = maskIsNl(mask, w, h);
  const x0 = Math.max(0, Math.floor(cx - rad));
  const x1 = Math.min(w - 1, Math.ceil(cx + rad));
  const y0 = Math.max(0, Math.floor(cy - rad));
  const y1 = Math.min(h - 1, Math.ceil(cy + rad));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const rho = Math.hypot(dx, dy) / rad;
      if (rho > 0.96) continue;
      const [r, g, b] = at(rgb, w, x, y);
      if (nlMask) {
        if (!maskedNl(mask, w, x, y)) continue;
      } else if (mask) {
        if (!maskedPlanet(mask, w, x, y)) continue;
      } else if (isIce(r, g, b) || isFlake(r, g, b)) continue;
      samples.push({ x, y, dx, dy, rho, Y: luma(r, g, b), rgb: [r, g, b] });
    }
  }
  // Body of the disc. The outer band is the silhouette rim, scored on its own.
  const body = samples.filter((p) => p.rho >= 0.15 && p.rho <= 0.5);
  let bx = 0;
  let by = 0;
  let b0 = 0;
  if (body.length >= 80) {
    // luma = a + bx * dx + by * dy
    let n = 0;
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let syy = 0;
    let sxy = 0;
    let sz = 0;
    let sxz = 0;
    let syz = 0;
    for (const p of body) {
      n++;
      sx += p.dx; sy += p.dy; sz += p.Y;
      sxx += p.dx * p.dx; syy += p.dy * p.dy; sxy += p.dx * p.dy;
      sxz += p.dx * p.Y; syz += p.dy * p.Y;
    }
    const A = [
      [n, sx, sy],
      [sx, sxx, sxy],
      [sy, sxy, syy],
    ];
    const B = [sz, sxz, syz];
    const sol = solve3(A, B);
    if (sol) {
      b0 = sol[0]; bx = sol[1]; by = sol[2];
    }
  }
  // The edge is the luma gradient on the analytic terminator (the band where N·L is
  // near zero). Craters and the limb rim sit outside that band, so they do not vote.
  const ndlAt = ndlSampler(pose);
  const band = [];
  for (const p of samples) {
    if (p.rho < 0.2 || p.rho > 0.78) continue;
    if (nlMask && !maskedNl(mask, w, p.x, p.y)) continue;
    const ndl = ndlAt(p.x + 0.5, p.y + 0.5);
    if (ndl == null || Math.abs(ndl) > 0.12) continue;
    let acc = 0;
    let n = 0;
    for (let yy = -2; yy <= 2; yy++) {
      for (let xx = -2; xx <= 2; xx++) {
        const x = p.x + xx;
        const y = p.y + yy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        if (nlMask && !maskedNl(mask, w, x, y)) continue;
        const c = at(rgb, w, x, y);
        acc += luma(c[0], c[1], c[2]);
        n++;
      }
    }
    if (n) band.push({ dx: p.dx, dy: p.dy, v: acc / n });
  }
  const edge = fitGrad(band);
  const brightDeg = edge ? edge.deg : null;
  const err = brightDeg == null || sunDeg == null ? null : angDiff(brightDeg, sunDeg);
  const magEdge = edge ? edge.mag : 0;
  const sunRad = (sunDeg || 0) * Math.PI / 180;
  const sdx = Math.cos(sunRad);
  const sdy = -Math.sin(sunRad);
  const lit = [];
  const unlit = [];
  for (const p of samples) {
    if (p.rho < 0.2 || p.rho > 0.75) continue;
    const along = p.dx * sdx + p.dy * sdy;
    if (along > rad * 0.22) lit.push(p.Y);
    else if (along < -rad * 0.22) unlit.push(p.Y);
  }
  const mean = (a) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
  const litMean = mean(lit);
  const unlitMean = mean(unlit);
  const bin = (lo, hi) => {
    const v = samples.filter((p) => p.rho >= lo && p.rho < hi).map((p) => p.Y);
    return mean(v);
  };
  const rings = [bin(0.05, 0.35), bin(0.35, 0.62), bin(0.62, 0.78), bin(0.88, 0.96)];
  const preRim = bin(0.62, 0.78);
  const rim = bin(0.88, 0.96);
  const span = rings.filter((v) => v != null);
  const profileSpan = span.length ? Math.max(...span) - Math.min(...span) : 0;
  const litGap = litMean != null && unlitMean != null ? litMean - unlitMean : null;
  const rimGap = rim != null && preRim != null ? rim - preRim : null;
  const terminatorPass = err != null && err <= TERMINATOR_DEG && band.length >= 80;
  // The bright outer ring (rimGap >= 4) was the wide night haze. Round 3
  // replaces it with the thin-rim gate in scoreLimb. Lit gap and span stay.
  const profilePass = litGap != null && litGap >= LIT_GAP && profileSpan >= PROFILE_SPAN;
  return {
    pass: terminatorPass && profilePass,
    terminatorPass,
    profilePass,
    pixels: body.length,
    bandN: band.length,
    gradPerPx: round(magEdge),
    brightDeg: brightDeg == null ? null : round(brightDeg),
    sunDeg: sunDeg == null ? null : round(sunDeg),
    angleErr: err == null ? null : round(err),
    angleLimit: TERMINATOR_DEG,
    litMean: litMean == null ? null : round(litMean),
    unlitMean: unlitMean == null ? null : round(unlitMean),
    litGap: litGap == null ? null : round(litGap),
    litN: lit.length,
    unlitN: unlit.length,
    rings: rings.map((v) => v == null ? null : round(v)),
    rimGap: rimGap == null ? null : round(rimGap),
    profileSpan: round(profileSpan),
    center: [round(cx), round(cy)],
    rad: round(rad),
  };
}

function solve3(A, B) {
  const M = A.map((row, i) => [...row, B[i]]);
  for (let c = 0; c < 3; c++) {
    let piv = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-8) return null;
    if (piv !== c) { const tmp = M[c]; M[c] = M[piv]; M[piv] = tmp; }
    const div = M[c][c];
    for (let k = c; k < 4; k++) M[c][k] /= div;
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const f = M[r][c];
      for (let k = c; k < 4; k++) M[r][k] -= f * M[c][k];
    }
  }
  return [M[0][3], M[1][3], M[2][3]];
}

export function skyFraction(rgb, w, h, pose) {
  let sky = 0;
  let n = 0;
  const cx = pose.center[0];
  const cy = pose.center[1];
  const rad = pose.rad;
  for (let y = 0; y < Math.floor(h * 0.46); y++) {
    for (let x = 0; x < w; x++) {
      n++;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy < rad * rad * 0.98) continue;
      const [r, g, b] = at(rgb, w, x, y);
      const Y = luma(r, g, b);
      const br = b - r;
      if (Y > 118 && Y < 190 && br > 4 && br < 38 && g > 110) sky++;
    }
  }
  return sky / n;
}

export function skylineRow(rgb, w, h, pose) {
  const rows = [];
  const x0 = Math.floor(w * 0.32);
  const x1 = Math.floor(w * 0.68);
  const cx = pose.center[0];
  const cy = pose.center[1];
  const rad = pose.rad;
  for (let x = x0; x < x1; x += 2) {
    for (let y = 2; y < Math.floor(h * 0.72); y++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy < (rad + 2) * (rad + 2)) continue;
      const [r, g, b] = at(rgb, w, x, y);
      const Y = luma(r, g, b);
      const br = b - r;
      const sky = Y > 118 && Y < 190 && br > 4 && br < 38 && g > 110;
      if (!sky) { rows.push(y); break; }
    }
  }
  if (!rows.length) return null;
  rows.sort((a, b) => a - b);
  return rows[rows.length >> 1];
}

function round(n) { return Math.round(n * 1000) / 1000; }

export function scoreFrame(rgb, w, h, pose, mask) {
  const banding = scoreBanding(rgb, w, h);
  const planet = scorePlanet(rgb, w, h, pose, mask);
  return {
    t: pose.t,
    w, h,
    banding,
    planet,
    skyFraction: round(skyFraction(rgb, w, h, pose)),
    skylineRow: skylineRow(rgb, w, h, pose),
    pass: banding.pass && planet.pass,
  };
}

function fitGrad(pts) {
  let n = 0;
  let sx = 0;
  let sy = 0;
  let sz = 0;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  let sxz = 0;
  let syz = 0;
  for (const p of pts) {
    n++;
    sx += p.dx; sy += p.dy; sz += p.v;
    sxx += p.dx * p.dx; syy += p.dy * p.dy; sxy += p.dx * p.dy;
    sxz += p.dx * p.v; syz += p.dy * p.v;
  }
  if (n < 40) return null;
  const sol = solve3([[n, sx, sy], [sx, sxx, sxy], [sy, sxy, syy]], [sz, sxz, syz]);
  if (!sol) return null;
  const mag = Math.hypot(sol[1], sol[2]);
  if (!(mag > 1e-6)) return null;
  return { deg: Math.atan2(-sol[2], sol[1]) * 180 / Math.PI, mag, n };
}

// Shader N.L mask: G marks the planet, R is N.L mapped from -1..1 to 0..1.
export function measureNlMask(rgb, w, h, pose) {
  const cx = pose.center[0];
  const cy = pose.center[1];
  const rad = pose.rad;
  const pts = [];
  const zero = [];
  let visible = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      if (rgb[i + 1] < 200) continue;
      const dx = x - cx;
      const dy = y - cy;
      const rho = Math.hypot(dx, dy) / rad;
      if (rho > 0.98) continue;
      visible++;
      const ndl = (rgb[i] / 255) * 2 - 1;
      if (rho >= 0.12 && rho <= 0.9) pts.push({ dx, dy, v: ndl });
      if (Math.abs(ndl) < 0.06 && rho > 0.08 && rho < 0.96) zero.push({ dx, dy, v: ndl });
    }
  }
  const grad = fitGrad(pts);
  const err = grad && pose.sunDeg != null ? angDiff(grad.deg, pose.sunDeg) : null;
  return {
    pixels: visible,
    fitN: pts.length,
    zeroN: zero.length,
    shaderDeg: grad ? round(grad.deg) : null,
    analyticDeg: pose.sunDeg == null ? null : round(pose.sunDeg),
    shaderErr: err == null ? null : round(err),
  };
}

// Fraction of the on-screen N.L = 0 arc that is not covered by ice.
export function terminatorVisibility(mask, w, h, pose) {
  const cx = pose.center[0];
  const cy = pose.center[1];
  const rad = pose.rad || 1;
  let onScreen = 0;
  let visible = 0;
  const sun = nrm(SUN);
  const eye = pose.eye;
  const C = pose.planet;
  if (!eye || !C) return null;
  const toEye = nrm(sub(eye, C));
  // Tangent basis of the plane N · sun = 0.
  let axis = Math.abs(sun[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let t1 = cross(sun, axis);
  t1 = nrm(t1);
  let t2 = nrm(cross(sun, t1));
  const R = pose.radius;
  for (let i = 0; i < 240; i++) {
    const a = (i / 240) * Math.PI * 2;
    const n = [
      t1[0] * Math.cos(a) + t2[0] * Math.sin(a),
      t1[1] * Math.cos(a) + t2[1] * Math.sin(a),
      t1[2] * Math.cos(a) + t2[2] * Math.sin(a),
    ];
    if (dot(n, toEye) < 0.04) continue;
    const p = [C[0] + n[0] * R, C[1] + n[1] * R, C[2] + n[2] * R];
    const s = project(pose.vp, p, w, h);
    if (!s) continue;
    const x = Math.round(s[0]);
    const y = Math.round(s[1]);
    if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
    const dx = s[0] - cx;
    const dy = s[1] - cy;
    if (Math.hypot(dx, dy) > rad * 1.05) continue;
    onScreen++;
    const mi = (y * w + x) * 3;
    if (mask[mi + 1] > 200) visible++;
  }
  return {
    onScreen,
    visible,
    fraction: onScreen ? round(visible / onScreen) : null,
  };
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

// Near-white: every channel >= 235 on planet pixels (disc and rim share the mesh).
// Rim width: 10%–90% of the night-side luma rise, as a fraction of the radius.
export function scoreLimb(rgb, nl, w, h, pose) {
  const cx = pose.center[0];
  const cy = pose.center[1];
  const rad = pose.rad;
  const sun = (pose.sunDeg || 0) * Math.PI / 180;
  const sdx = Math.cos(sun);
  const sdy = -Math.sin(sun);
  let white = 0;
  const litCh = [];
  let limbCh = 0;
  const darkY = [];
  const bins = new Map();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      const dx = x - cx;
      const dy = y - cy;
      const rho = Math.hypot(dx, dy) / Math.max(rad, 1);
      const planet = nl[i + 1] > 200;
      const ndl = (nl[i] / 255) * 2 - 1;
      const r = rgb[i];
      const g = rgb[i + 1];
      const b = rgb[i + 2];
      const Y = luma(r, g, b);
      if (planet && r >= 235 && g >= 235 && b >= 235) white++;
      if (planet && ndl > 0.35 && rho < 0.72) litCh.push(Math.max(r, g, b));
      if (planet && ndl > 0.25 && rho > 0.86) limbCh = Math.max(limbCh, r, g, b);
      if (planet && ndl < -0.05 && rho > 0.97) darkY.push(Y);
      // Planet-only night profile, so ice in the wedge does not set the rise.
      if (planet && ndl < -0.02 && rho <= 1.02) {
        const key = Math.round(rho * 50) / 50;
        const slot = bins.get(key) || { y: 0, n: 0, planet: 0 };
        slot.y += Y;
        slot.n++;
        slot.planet++;
        bins.set(key, slot);
      }
      if (!planet && rho > 1.02 && rho < 1.18) {
        const along = dx * sdx + dy * sdy;
        if (along < -rad * 0.2) {
          const key = Math.round(rho * 50) / 50;
          const slot = bins.get(key) || { y: 0, n: 0, planet: 0 };
          slot.y += Y;
          slot.n++;
          bins.set(key, slot);
        }
      }
    }
  }
  const keys = [...bins.keys()].sort((a, b) => a - b);
  const meanOf = (list) => {
    let y = 0;
    let n = 0;
    for (const k of list) { y += bins.get(k).y; n += bins.get(k).n; }
    return n ? y / n : null;
  };
  const inside = keys.filter((k) => k >= 0.45 && k <= 0.62 && bins.get(k).n >= 8);
  const outside = keys.filter((k) => k >= 1.04 && k <= 1.16 && bins.get(k).n >= 8);
  const yIn = meanOf(inside);
  const ySky = meanOf(outside);
  let rho10 = null;
  let rho90 = null;
  if (yIn != null && ySky != null && ySky > yIn + 5) {
    const l10 = yIn + 0.1 * (ySky - yIn);
    const l90 = yIn + 0.9 * (ySky - yIn);
    // Walk in from the sky so an interior bump does not start the rise.
    const inward = keys.filter((k) => k <= 1.2).sort((a, b) => b - a);
    for (const k of inward) {
      const v = bins.get(k).y / bins.get(k).n;
      if (rho90 == null && v <= l90) rho90 = k;
      if (v <= l10) { rho10 = k; break; }
    }
  }
  const width = rho10 != null && rho90 != null ? rho90 - rho10 : null;
  litCh.sort((a, b) => a - b);
  const p99 = litCh.length ? litCh[Math.min(litCh.length - 1, Math.floor(litCh.length * 0.99))] : null;
  const dark = darkY.length ? darkY.reduce((s, v) => s + v, 0) / darkY.length : null;
  return {
    pass: white === 0 && width != null && width <= RIM_WIDTH_MAX && dark != null && ySky != null && dark < ySky - DARK_LIMB_GAP,
    nearWhite: white,
    rimWidth: width == null ? null : round(width),
    rimWidthPx: width == null ? null : round(width * rad),
    yIn: yIn == null ? null : round(yIn),
    ySky: ySky == null ? null : round(ySky),
    darkLimb: dark == null ? null : round(dark),
    darkGap: dark != null && ySky != null ? round(ySky - dark) : null,
    litP99: p99,
    limbMaxChannel: limbCh || null,
    limbUnderP99: p99 != null && limbCh < p99,
  };
}

export function sunCheck() {
  const s = nrm(SUN);
  const elev = Math.asin(s[1]) * 180 / Math.PI;
  return {
    direction: [...SUN],
    elevationDeg: round(elev),
    elevationOk: Math.abs(elev - 34) < 0.05,
    unchanged: SUN[0] === 0.6161 && SUN[1] === 0.5592 && SUN[2] === 0.5547,
  };
}

const FIXTURES = [
  ['t10', 11.70, 'artifacts/run31/frames/t10.jpg'],
  ['t24', 24, 'artifacts/run31/frames/t24.jpg'],
  ['t30', 30, 'artifacts/run31/frames/t30.jpg'],
];

async function fixtureMain() {
  const { dirname, join } = await import('path');
  const { fileURLToPath } = await import('url');
  const fs = await import('fs');
  const here = dirname(fileURLToPath(import.meta.url));
  const world = buildWorld();
  const poses = chasePoses(world);
  const byT = new Map(poses.map((p) => [p.t, p]));
  const rows = [];
  let failGates = 0;
  for (const [name, t, rel] of FIXTURES) {
    const pose = byT.get(t);
    const img = loadRgb(join(here, rel));
    const row = scoreFrame(img.rgb, img.w, img.h, pose);
    row.file = rel;
    row.name = name;
    rows.push(row);
    const termFail = !row.planet.terminatorPass;
    const bandFail = !row.banding.pass;
    if (termFail) failGates++;
    if (bandFail) failGates++;
    console.log(name, 'terminator', row.planet.terminatorPass ? 'PASS' : 'FAIL', 'err', row.planet.angleErr, 'grad', row.planet.gradPerPx, 'px', row.planet.pixels, 'litGap', row.planet.litGap, 'rim', row.planet.rimGap);
    console.log('   banding', row.banding.pass ? 'PASS' : 'FAIL', 'step', row.banding.maxStep, 'run', row.banding.bandRun, 'hf', row.banding.hfRms, 'smooth', row.banding.smoothRms, 'cols', row.banding.columns);
  }
  const report = {
    fixture: 'run31',
    sun: sunCheck(),
    required: 'each frame FAILs the terminator gate and the banding gate',
    rows,
    bothFailed: rows.every((r) => !r.planet.terminatorPass && !r.banding.pass),
  };
  const out = join(here, 'artifacts/d9/fixture-before.json');
  fs.mkdirSync(join(here, 'artifacts/d9'), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log('wrote', out, 'bothFailed', report.bothFailed);
  if (!report.bothFailed) process.exit(1);
}

if (process.argv[1] && process.argv[1].endsWith('planet-sky-gate.mjs')) {
  fixtureMain();
}

// House procedural sky. Direction only. Not an Imagine JPEG and not a camera-locked plane.
// Crystal candidate exception. Materials stay Imagine textures.
// Atmosphere colours come from the NIGHT rig. Nebula and stars stay on that same field.
import { NIGHT } from './night-rig.js';

export const SKY_CFG = {
  scope: 'crystal-candidate-only',
  source: 'house-procedural',
  zenith: NIGHT.sky.zenith,
  horizon: NIGHT.sky.horizon,
  nebulaViolet: NIGHT.sky.nebulaViolet,
  nebulaCyan: NIGHT.sky.nebulaCyan,
  star: NIGHT.sky.star,
  nebulaScale: NIGHT.sky.nebulaScale,
  starGrid: NIGHT.sky.starGrid,
  nebulaFloor: NIGHT.sky.nebulaFloor,
  nebulaHf: NIGHT.sky.nebulaHf,
  nebulaGain: NIGHT.sky.nebulaGain,
};

export function hash31(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function lerp(a, b, t) { return a + (b - a) * t; }
function smooth(t) { return t * t * (3 - 2 * t); }

export function valueNoise(p) {
  const x = Math.floor(p[0]), y = Math.floor(p[1]), z = Math.floor(p[2]);
  const fx = p[0] - x, fy = p[1] - y, fz = p[2] - z;
  const u = smooth(fx), v = smooth(fy), w = smooth(fz);
  const h = (i, j, k) => hash31(x + i, y + j, z + k);
  const c00 = lerp(h(0, 0, 0), h(1, 0, 0), u);
  const c10 = lerp(h(0, 1, 0), h(1, 1, 0), u);
  const c01 = lerp(h(0, 0, 1), h(1, 0, 1), u);
  const c11 = lerp(h(0, 1, 1), h(1, 1, 1), u);
  return lerp(lerp(c00, c10, v), lerp(c01, c11, v), w);
}

function norm(d) {
  const l = Math.hypot(d[0], d[1], d[2]) || 1;
  return [d[0] / l, d[1] / l, d[2] / l];
}

function fbm(p, octaves, pers) {
  let f = 0, amp = 1, freq = 1, sum = 0;
  for (let i = 0; i < octaves; i++) {
    f += amp * valueNoise([p[0] * freq, p[1] * freq, p[2] * freq]);
    sum += amp;
    amp *= pers;
    freq *= 2.03;
  }
  return sum > 0 ? f / sum : 0;
}

function smooth01(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

export function skyLinear(dir, cfg = SKY_CFG) {
  const n = norm(dir);
  const elev = Math.min(1, Math.max(0, (n[1] + 0.08) / 0.7));
  const e = elev * elev * (3 - 2 * elev);
  const atmo = cfg.zenith.map((z, i) => cfg.horizon[i] + (z - cfg.horizon[i]) * e);
  // 3D noise of the unit direction. A low octave on x/z only read as curtains.
  const s = cfg.nebulaScale;
  const pers = cfg.nebulaHf == null ? 0.5 : cfg.nebulaHf;
  const w1 = fbm([n[0] * s + 2.2, n[1] * s + 0.4, n[2] * s + 5.1], 2, pers);
  const w2 = fbm([n[0] * s + 8.3, n[1] * s + 1.7, n[2] * s + 0.6], 2, pers);
  const w3 = fbm([n[0] * s + 0.5, n[1] * s + 6.4, n[2] * s + 3.3], 2, pers);
  const q = [n[0] * s + (w1 - 0.5) * 1.7, n[1] * s + (w2 - 0.5) * 1.7, n[2] * s + (w3 - 0.5) * 1.7];
  const cloud = fbm(q, 3, pers);
  const dust = fbm([q[0] * 1.8 + 4.2, q[1] * 1.8 + 1.1, q[2] * 1.8 + 7.7], 2, pers);
  const tintN = fbm([q[0] * 0.65 + 3.0, q[1] * 0.65 + 9.0, q[2] * 0.65 + 2.0], 1, pers);
  const axis = [0.55, 0.35, 0.76];
  const al = Math.hypot(axis[0], axis[1], axis[2]);
  const along = Math.abs((n[0] * axis[0] + n[1] * axis[1] + n[2] * axis[2]) / al);
  const band = Math.exp(-along * along * 24);
  const liftT = Math.min(1, Math.max(0, (n[1] - 0.02) / 0.5));
  const lift = liftT * liftT * (3 - 2 * liftT);
  const wisp = Math.pow(smooth01((cloud - 0.42) / 0.38), 1.25);
  const lane = smooth01((dust - 0.46) / 0.28);
  const veil = 1 - 0.82 * lane;
  const gain = cfg.nebulaGain == null ? 1.7 : cfg.nebulaGain;
  const neb = wisp * veil * band * lift * gain;
  const dustDark = lane * band * lift * 0.42;
  const out = atmo.map((v, i) => v * (1 - dustDark) + (cfg.nebulaViolet[i] * (1 - tintN) + cfg.nebulaCyan[i] * tintN) * neb);
  const g = cfg.starGrid;
  const base = [Math.floor(n[0] * g), Math.floor(n[1] * g), Math.floor(n[2] * g)];
  const f = [n[0] * g - base[0], n[1] * g - base[1], n[2] * g - base[2]];
  let spark = 0;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      for (let k = -1; k <= 1; k++) {
        const id = [base[0] + i, base[1] + j, base[2] + k];
        const h = hash31(id[0], id[1], id[2]);
        if (h < 0.965) continue;
        const br = 0.82 + hash31(id[0] + 2.2, id[1] + 8.1, id[2] + 1.4) * 0.28;
        const sz = 82 + hash31(id[0] + 4.4, id[1] + 0.7, id[2] + 6.6) * 16;
        const ox = hash31(id[0] + 19.2, id[1], id[2]);
        const oy = hash31(id[0], id[1] + 19.2, id[2]);
        const oz = hash31(id[0], id[1], id[2] + 19.2);
        const dx = f[0] - i - ox, dy = f[1] - j - oy, dz = f[2] - k - oz;
        spark += br * Math.exp(-(dx * dx + dy * dy + dz * dz) * sz);
      }
    }
  }
  return out.map((v, i) => v + cfg.star[i] * spark);
}

export function dirFrom(elevDeg, yawRad) {
  const e = elevDeg * Math.PI / 180;
  const c = Math.cos(e);
  return [Math.sin(yawRad) * c, Math.sin(e), Math.cos(yawRad) * c];
}

export function skyDelta(a, b) {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
}

export function skySeen(camera, dir) {
  const world = camera.map((c, i) => c + dir[i] * 640);
  const d = world.map((w, i) => w - camera[i]);
  return skyLinear(d);
}

export function measureSky({ pageSource = '', plate = null, procedural = null } = {}) {
  const seam = skyDelta(skyLinear(dirFrom(20, 0)), skyLinear(dirFrom(20, Math.PI * 2)));
  let poleMax = 0;
  const pole = skyLinear([0, 1, 0]);
  for (let i = 0; i < 48; i++) poleMax = Math.max(poleMax, skyDelta(pole, skyLinear(dirFrom(89.4, i / 48 * Math.PI * 2))));
  let southMax = 0;
  const south = skyLinear([0, -1, 0]);
  for (let i = 0; i < 24; i++) southMax = Math.max(southMax, skyDelta(south, skyLinear(dirFrom(-89.4, i))));
  const cameras = [[0, 1.12, 0], [40, 3, -80], [-25, 8, 120], [0, 1.12, -54]];
  const dirs = [dirFrom(12, 0.4), dirFrom(40, 2.1), dirFrom(-8, 4.2), [0, 1, 0]];
  let cameraDelta = 0;
  for (const dir of dirs) {
    const cols = cameras.map(cam => skySeen(cam, dir));
    for (let i = 1; i < cols.length; i++) cameraDelta = Math.max(cameraDelta, skyDelta(cols[0], cols[i]));
  }
  let motionStep = 0;
  const moving = [12, 4, -30];
  for (let i = 0; i < 180; i++) {
    const yaw = i * Math.PI / 180;
    motionStep = Math.max(motionStep, skyDelta(skySeen(moving, dirFrom(15, yaw)), skySeen(moving, dirFrom(15, yaw + Math.PI / 180))));
  }
  const planetDir = norm([-0.2, 0.35, -1]);
  const planetRing = ringStep(planetDir);
  const otherRing = ringStep(dirFrom(18, 1.1));
  const call = pageSource.includes('skyColour(normalize(v.w - u.cam.xyz))');
  const separatePlanet = pageSource.includes("pass.setPipeline(pSky)") && pageSource.includes("pass.setPipeline(pPlanet)") && pageSource.includes('fsPlanet');
  const scopeOk = !procedural || procedural.scope === 'crystal-candidate-only';
  const checks = {
    seam: +seam.toExponential(2),
    poleMax: round4(poleMax),
    southMax: round4(southMax),
    cameraDelta: round4(cameraDelta),
    motionStep: round4(motionStep),
    planetRing: round4(planetRing),
    otherRing: round4(otherRing),
    callSite: call,
    separatePlanet,
  };
  const measuredOk = seam < 1e-9 && poleMax < 0.08 && southMax < 0.08 && cameraDelta < 1e-9 && motionStep < 0.5 && planetRing < 0.08 && otherRing < 0.08 && call && separatePlanet && scopeOk;
  const [w, h] = plate?.resolution || [];
  const equirect = h > 0 && w === h * 2;
  const plateStatus = !plate ? 'ABSENT' : (plate.status === 'BLOCKED' || !equirect || plate.wrapPass !== true) ? 'BLOCKED' : 'DECLARED';
  return {
    imaginePlate: { status: plateStatus, equirect, wrapPass: plate?.wrapPass ?? null, release: 'HOLD' },
    procedural: {
      status: !procedural ? 'ABSENT' : measuredOk ? 'CANDIDATE' : 'FAIL',
      scope: procedural?.scope || null,
      release: 'HOLD',
      checks,
    },
    release: 'HOLD',
  };
}

function ringStep(dir) {
  let m = 0;
  const n = norm(dir);
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    const bit = 3 * Math.PI / 180;
    const side = norm([n[0] + Math.cos(a) * bit, n[1] + Math.sin(a) * bit * 0.2, n[2] + Math.sin(a) * bit]);
    m = Math.max(m, skyDelta(skyLinear(n), skyLinear(side)));
  }
  return m;
}
function round4(n) { return Math.round(n * 10000) / 10000; }

export function skyWgsl() {
  const c = SKY_CFG;
  const v3 = (a) => `vec3f(${a[0]}, ${a[1]}, ${a[2]})`;
  return `
fn skyHash(p: vec3f) -> f32 {
  return fract(sin(p.x * 127.1 + p.y * 311.7 + p.z * 74.7) * 43758.5453);
}
fn skyNoise(p: vec3f) -> f32 {
  let i = floor(p); let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let c00 = mix(skyHash(i), skyHash(i + vec3f(1.0, 0.0, 0.0)), u.x);
  let c10 = mix(skyHash(i + vec3f(0.0, 1.0, 0.0)), skyHash(i + vec3f(1.0, 1.0, 0.0)), u.x);
  let c01 = mix(skyHash(i + vec3f(0.0, 0.0, 1.0)), skyHash(i + vec3f(1.0, 0.0, 1.0)), u.x);
  let c11 = mix(skyHash(i + vec3f(0.0, 1.0, 1.0)), skyHash(i + vec3f(1.0, 1.0, 1.0)), u.x);
  return mix(mix(c00, c10, u.y), mix(c01, c11, u.y), u.z);
}
fn skyFbm2(p: vec3f) -> f32 {
  let pers = ${c.nebulaHf == null ? 0.5 : c.nebulaHf};
  let a = skyNoise(p);
  let b = skyNoise(p * 2.03) * pers;
  return (a + b) / (1.0 + pers);
}
fn skyFbm3(p: vec3f) -> f32 {
  let pers = ${c.nebulaHf == null ? 0.5 : c.nebulaHf};
  var f = skyNoise(p);
  var amp = pers;
  var freq = 2.03;
  f += amp * skyNoise(p * freq);
  var sum = 1.0 + amp;
  amp *= pers;
  freq *= 2.03;
  f += amp * skyNoise(p * freq);
  sum += amp;
  return f / sum;
}
fn skySmooth(t: f32) -> f32 {
  let x = clamp(t, 0.0, 1.0);
  return x * x * (3.0 - 2.0 * x);
}
fn skyColour(dir: vec3f) -> vec3f {
  let n = normalize(dir);
  let elev = clamp((n.y + 0.08) / 0.7, 0.0, 1.0);
  let e = elev * elev * (3.0 - 2.0 * elev);
  let atmo = mix(${v3(c.horizon)}, ${v3(c.zenith)}, e);
  let s = ${c.nebulaScale};
  let w1 = skyFbm2(n * s + vec3f(2.2, 0.4, 5.1));
  let w2 = skyFbm2(n * s + vec3f(8.3, 1.7, 0.6));
  let w3 = skyFbm2(n * s + vec3f(0.5, 6.4, 3.3));
  let q = n * s + (vec3f(w1, w2, w3) - vec3f(0.5)) * 1.7;
  let cloud = skyFbm3(q);
  let dust = skyFbm2(q * 1.8 + vec3f(4.2, 1.1, 7.7));
  let tintN = skyNoise(q * 0.65 + vec3f(3.0, 9.0, 2.0));
  let axis = normalize(vec3f(0.55, 0.35, 0.76));
  let along = abs(dot(n, axis));
  let band = exp(-along * along * 24.0);
  let liftT = clamp((n.y - 0.02) / 0.5, 0.0, 1.0);
  let lift = liftT * liftT * (3.0 - 2.0 * liftT);
  let wisp = pow(skySmooth((cloud - 0.42) / 0.38), 1.25);
  let lane = skySmooth((dust - 0.46) / 0.28);
  let veil = 1.0 - 0.82 * lane;
  let neb = wisp * veil * band * lift * ${(c.nebulaGain == null ? 1.7 : c.nebulaGain)};
  let dustDark = lane * band * lift * 0.42;
  var col = atmo * (1.0 - dustDark) + mix(${v3(c.nebulaViolet)}, ${v3(c.nebulaCyan)}, tintN) * neb;
  let g = ${c.starGrid}.0;
  let base = floor(n * g);
  let f = n * g - base;
  var spark = 0.0;
  for (var i = -1; i <= 1; i++) {
    for (var j = -1; j <= 1; j++) {
      for (var k = -1; k <= 1; k++) {
        let id = base + vec3f(f32(i), f32(j), f32(k));
        let h = skyHash(id);
        if (h < 0.965) { continue; }
        let br = 0.82 + skyHash(id + vec3f(2.2, 8.1, 1.4)) * 0.28;
        let sz = 82.0 + skyHash(id + vec3f(4.4, 0.7, 6.6)) * 16.0;
        let ox = skyHash(id + vec3f(19.2, 0.0, 0.0));
        let oy = skyHash(id + vec3f(0.0, 19.2, 0.0));
        let oz = skyHash(id + vec3f(0.0, 0.0, 19.2));
        let d = f - vec3f(f32(i), f32(j), f32(k)) - vec3f(ox, oy, oz);
        spark += br * exp(-dot(d, d) * sz);
      }
    }
  }
  return col + ${v3(c.star)} * spark;
}
`;
}

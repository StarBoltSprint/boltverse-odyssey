// House procedural sky. Colour is a function of world direction only.
// A camera move must not change the colour of a direction. Not an Imagine JPEG.

export function hash31(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function lerp(a, b, t) { return a + (b - a) * t; }
function smooth(t) { return t * t * (3 - 2 * t); }
function clamp01(t) { return Math.min(1, Math.max(0, t)); }

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

function fbm2(p, pers) {
  const a = valueNoise(p);
  const b = valueNoise([p[0] * 2.03, p[1] * 2.03, p[2] * 2.03]) * pers;
  return (a + b) / (1 + pers);
}

function fbm3(p, pers) {
  let f = valueNoise(p);
  let amp = pers;
  let freq = 2.03;
  f += amp * valueNoise([p[0] * freq, p[1] * freq, p[2] * freq]);
  let sum = 1 + amp;
  amp *= pers;
  freq *= 2.03;
  f += amp * valueNoise([p[0] * freq, p[1] * freq, p[2] * freq]);
  sum += amp;
  return f / sum;
}

export function skyLinear(dir, cfg) {
  const n = norm(dir);
  const elev = clamp01((n[1] + 0.08) / 0.7);
  const e = elev * elev * (3 - 2 * elev);
  const atmo = cfg.zenith.map((z, i) => cfg.horizon[i] + (z - cfg.horizon[i]) * e);
  const s = cfg.nebulaScale;
  const pers = cfg.nebulaHf == null ? 0.5 : cfg.nebulaHf;
  const w1 = fbm2([n[0] * s + 2.2, n[1] * s + 0.4, n[2] * s + 5.1], pers);
  const w2 = fbm2([n[0] * s + 8.3, n[1] * s + 1.7, n[2] * s + 0.6], pers);
  const w3 = fbm2([n[0] * s + 0.5, n[1] * s + 6.4, n[2] * s + 3.3], pers);
  const shift = cfg.nebulaShift || [0.6, -2.4, -1.2];
  const q = [
    n[0] * s + (w1 - 0.5) * 1.7 + shift[0],
    n[1] * s + (w2 - 0.5) * 1.7 + shift[1],
    n[2] * s + (w3 - 0.5) * 1.7 + shift[2],
  ];
  const cloud = fbm3(q, pers);
  const dust = fbm2([q[0] * 1.8 + 4.2, q[1] * 1.8 + 1.1, q[2] * 1.8 + 7.7], pers);
  const tintN = valueNoise([q[0] * 0.65 + 3.0, q[1] * 0.65 + 9.0, q[2] * 0.65 + 2.0]);
  const axis = norm(cfg.nebulaAxis || [0.9, 0.42, 0.16]);
  const along = Math.abs(n[0] * axis[0] + n[1] * axis[1] + n[2] * axis[2]);
  const band = Math.exp(-along * along * 7.5);
  const liftT = clamp01((n[1] + 0.02) / 0.22);
  const lift = liftT * liftT * (3 - 2 * liftT);
  const zenT = clamp01((n[1] - 0.88) / 0.12);
  const zen = 1 - zenT * zenT * (3 - 2 * zenT);
  const sm = (t) => { const x = clamp01(t); return x * x * (3 - 2 * x); };
  const wisp = Math.pow(sm((cloud - 0.42) / 0.38), 1.25);
  const scatter = Math.pow(sm((cloud - 0.6) / 0.28), 1.4);
  const lane = sm((dust - 0.46) / 0.28);
  const veil = 1 - 0.82 * lane;
  const gain = cfg.nebulaGain == null ? 1.55 : cfg.nebulaGain;
  const neb = (wisp * veil * band + scatter * 0.16) * lift * zen * gain;
  const dustDark = lane * band * lift * zen * 0.34;
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

export function skyWgsl(cfg) {
  const v3 = (a) => `vec3f(${a[0]}, ${a[1]}, ${a[2]})`;
  const shift = cfg.nebulaShift || [0.6, -2.4, -1.2];
  const axis = cfg.nebulaAxis || [0.9, 0.42, 0.16];
  const pers = cfg.nebulaHf == null ? 0.5 : cfg.nebulaHf;
  const gain = cfg.nebulaGain == null ? 1.55 : cfg.nebulaGain;
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
  let pers = ${pers};
  let a = skyNoise(p);
  let b = skyNoise(p * 2.03) * pers;
  return (a + b) / (1.0 + pers);
}
fn skyFbm3(p: vec3f) -> f32 {
  let pers = ${pers};
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
  let atmo = mix(${v3(cfg.horizon)}, ${v3(cfg.zenith)}, e);
  let s = ${cfg.nebulaScale};
  let w1 = skyFbm2(n * s + vec3f(2.2, 0.4, 5.1));
  let w2 = skyFbm2(n * s + vec3f(8.3, 1.7, 0.6));
  let w3 = skyFbm2(n * s + vec3f(0.5, 6.4, 3.3));
  let q = n * s + (vec3f(w1, w2, w3) - vec3f(0.5)) * 1.7 + ${v3(shift)};
  let cloud = skyFbm3(q);
  let dust = skyFbm2(q * 1.8 + vec3f(4.2, 1.1, 7.7));
  let tintN = skyNoise(q * 0.65 + vec3f(3.0, 9.0, 2.0));
  let axis = normalize(${v3(axis)});
  let along = abs(dot(n, axis));
  let band = exp(-along * along * 7.5);
  let liftT = clamp((n.y + 0.02) / 0.22, 0.0, 1.0);
  let lift = liftT * liftT * (3.0 - 2.0 * liftT);
  let zenT = clamp((n.y - 0.88) / 0.12, 0.0, 1.0);
  let zen = 1.0 - zenT * zenT * (3.0 - 2.0 * zenT);
  let wisp = pow(skySmooth((cloud - 0.42) / 0.38), 1.25);
  let scatter = pow(skySmooth((cloud - 0.6) / 0.28), 1.4);
  let lane = skySmooth((dust - 0.46) / 0.28);
  let veil = 1.0 - 0.82 * lane;
  let neb = (wisp * veil * band + scatter * 0.16) * lift * zen * ${gain};
  let dustDark = lane * band * lift * zen * 0.34;
  var col = atmo * (1.0 - dustDark) + mix(${v3(cfg.nebulaViolet)}, ${v3(cfg.nebulaCyan)}, tintN) * neb;
  let g = ${cfg.starGrid}.0;
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
  return col + ${v3(cfg.star)} * spark;
}
`;
}

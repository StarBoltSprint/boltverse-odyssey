// House procedural sky. Direction only. Not an Imagine JPEG and not a camera-locked plane.
// Crystal candidate exception. Materials stay Imagine textures.

export const SKY_CFG = {
  scope: 'crystal-candidate-only',
  source: 'house-procedural',
  zenith: [0.012, 0.016, 0.055],
  horizon: [0.03, 0.042, 0.078],
  nebulaViolet: [0.11, 0.035, 0.16],
  nebulaCyan: [0.02, 0.09, 0.15],
  star: [0.75, 0.82, 0.95],
  nebulaScale: 2.6,
  starGrid: 42,
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

export function skyLinear(dir, cfg = SKY_CFG) {
  const n = norm(dir);
  const elev = Math.min(1, Math.max(0, (n[1] + 0.08) / 0.7));
  const e = elev * elev * (3 - 2 * elev);
  const atmo = cfg.zenith.map((z, i) => cfg.horizon[i] + (z - cfg.horizon[i]) * e);
  const q = [n[0] * cfg.nebulaScale, n[1] * cfg.nebulaScale, n[2] * cfg.nebulaScale];
  const a = valueNoise(q);
  const b = valueNoise([q[0] * 2.05 + 4.2, q[1] * 2.05 + 1.3, q[2] * 2.05 + 7.1]);
  const neb = Math.max(0, a * 0.62 + b * 0.38);
  const shaped = neb * neb;
  const tint = valueNoise([q[2] * 1.4 + 2.0, q[0] * 1.4, q[1] * 1.4 + 3.0]);
  const out = atmo.map((v, i) => v + (cfg.nebulaViolet[i] * (1 - tint) + cfg.nebulaCyan[i] * tint) * shaped * 0.9);
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
        const ox = hash31(id[0] + 19.2, id[1], id[2]);
        const oy = hash31(id[0], id[1] + 19.2, id[2]);
        const oz = hash31(id[0], id[1], id[2] + 19.2);
        const dx = f[0] - i - ox, dy = f[1] - j - oy, dz = f[2] - k - oz;
        spark += Math.exp(-(dx * dx + dy * dy + dz * dz) * 90);
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
fn skyColour(dir: vec3f) -> vec3f {
  let n = normalize(dir);
  let elev = clamp((n.y + 0.08) / 0.7, 0.0, 1.0);
  let e = elev * elev * (3.0 - 2.0 * elev);
  let atmo = mix(${v3(c.horizon)}, ${v3(c.zenith)}, e);
  let q = n * ${c.nebulaScale};
  let a = skyNoise(q);
  let b = skyNoise(q * 2.05 + vec3f(4.2, 1.3, 7.1));
  let neb = max(a * 0.62 + b * 0.38, 0.0);
  let shaped = neb * neb;
  let tint = skyNoise(vec3f(q.z * 1.4 + 2.0, q.x * 1.4, q.y * 1.4 + 3.0));
  var col = atmo + mix(${v3(c.nebulaViolet)}, ${v3(c.nebulaCyan)}, tint) * shaped * 0.9;
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
        let ox = skyHash(id + vec3f(19.2, 0.0, 0.0));
        let oy = skyHash(id + vec3f(0.0, 19.2, 0.0));
        let oz = skyHash(id + vec3f(0.0, 0.0, 19.2));
        let d = f - vec3f(f32(i), f32(j), f32(k)) - vec3f(ox, oy, oz);
        spark += exp(-dot(d, d) * 90.0);
      }
    }
  }
  return col + ${v3(c.star)} * spark;
}
`;
}

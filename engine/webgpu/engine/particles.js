// engine/particles.js — extracted from the meadow (v445) as a reusable module; cfg overrides the defaults
const f = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
export const PARTICLES_DEFAULT = {};
export function makeParticles(cfg = {}) { const c = { ...PARTICLES_DEFAULT, ...cfg };
  return /* wgsl */`
fn h1(i: u32, k: f32) -> f32 { return hash2(vec2f(f32(i) * 0.6180339 + k, k * 1.731 + f32(i) * 0.0137)); }
fn wrapW(seedp: vec2f, R: f32) -> vec2f { return u.cam.xz + (fract((seedp - u.cam.xz) / R + 0.5) - 0.5) * R; }  // world-locked torus around the camera
fn bb(wp: vec3f, c: vec2f, sz: f32) -> vec4f { let f = normalize(wp - u.cam.xyz); let r = normalize(cross(f, vec3f(0, 1, 0))); let up = cross(r, f);
  return u.vp * vec4f(wp + (r * c.x + up * c.y) * sz, 1.0); }
fn edgeFade(wp: vec3f, R: f32) -> f32 { let d = length(wp.xz - u.cam.xz); return smoothstep(0.5 * R, 0.36 * R, d) * smoothstep(0.5, 1.6, length(wp - u.cam.xyz)); }
fn airWind(t: f32) -> vec2f { return vec2f(0.8, 0.6) * (0.55 * t) + vec2f(-0.6, 0.8) * (0.9 * sin(t * 0.07)); }
const QX = array<f32,6>(-1.0, 1.0, 1.0, -1.0, 1.0, -1.0); const QY = array<f32,6>(-1.0, -1.0, 1.0, -1.0, 1.0, 1.0);
// dust / pollen motes catching the sun
@vertex fn vs_mote(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> AO {
  var o: AO; let t = u.cam.w; let R = 26.0; let ph = h1(ii, 4.0) * 6.28;
  let sw = vec2f(sin(t * 0.37 + ph) + 0.5 * sin(t * 0.91 + ph * 2.0), cos(t * 0.29 + ph * 1.3) + 0.5 * cos(t * 0.73 + ph)) * 0.35;
  let xz = wrapW(vec2f(h1(ii, 1.0), h1(ii, 2.0)) * R + airWind(t) * (0.6 + 0.6 * h1(ii, 5.0)) + sw, R);
  let y = 0.12 + pow(h1(ii, 3.0), 1.6) * 4.0 + 0.25 * sin(t * 0.5 + ph);
  let wp = vec3f(xz.x, y, xz.y); let c = vec2f(QX[vi], QY[vi]);
  let dist = length(wp - u.cam.xyz); let sz = (0.008 + 0.012 * h1(ii, 6.0)) * (1.0 + dist * 0.06);
  o.p = bb(wp, c, sz); o.uv = c; o.kind = 0u;
  let fwd = pow(max(dot(normalize(wp - u.cam.xyz), u.sun.xyz), 0.0), 3.0);
  let tw = 0.55 + 0.45 * sin(t * (1.5 + 2.0 * h1(ii, 7.0)) + ph);                 // slow twinkle as motes turn in the light
  let glint = pow(max(sin(t * 0.9 + ph * 3.0), 0.0), 40.0) * step(0.85, h1(ii, 8.0)) * 2.5;
  let I = (0.22 + 1.3 * fwd + glint) * tw * edgeFade(wp, R) / (1.0 + dist * 0.12);
  o.col = vec4f(vec3f(1.0, 0.90, 0.62) * I * 0.8, 0.0); return o; }
// dandelion seeds drifting on the wind
@vertex fn vs_seed(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> AO {
  var o: AO; let t = u.cam.w; let R = 34.0; let ph = h1(ii, 14.0) * 6.28;
  let xz = wrapW(vec2f(h1(ii, 11.0), h1(ii, 12.0)) * R + airWind(t) * (2.2 + h1(ii, 15.0)) + vec2f(sin(t * 0.6 + ph), cos(t * 0.45 + ph)) * 0.6, R);
  let y = 0.35 + h1(ii, 13.0) * 3.0 + 0.45 * sin(t * 0.33 + ph) + 0.15 * sin(t * 1.7 + ph);
  let wp = vec3f(xz.x, y, xz.y); let c = vec2f(QX[vi], QY[vi]);
  o.p = bb(wp, c, 0.035 + 0.015 * h1(ii, 16.0)); o.uv = c; o.kind = 1u;
  let fwd = pow(max(dot(normalize(wp - u.cam.xyz), u.sun.xyz), 0.0), 2.0);
  let a = 0.85 * edgeFade(wp, R) * (1.0 - smoothstep(14.0, 17.0, length(wp - u.cam.xyz)));
  o.col = vec4f(vec3f(0.92, 0.92, 0.86) * (0.85 + 0.6 * fwd), a); return o; }
// butterflies: two flapping wings, wandering paths
@vertex fn vs_fly(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> AO {
  var o: AO; let t = u.cam.w; let R = 30.0; let ph = h1(ii, 24.0) * 6.28;
  let base = wrapW(vec2f(h1(ii, 21.0), h1(ii, 22.0)) * R + airWind(t) * 0.3, R);
  let pth = vec2f(sin(t * 0.43 + ph) * 2.2 + sin(t * 1.1 + ph * 2.0) * 0.5, cos(t * 0.37 + ph) * 2.2 + cos(t * 0.9 + ph) * 0.5);
  let vel = vec2f(cos(t * 0.43 + ph) * 0.95 + cos(t * 1.1 + ph * 2.0) * 0.55, -sin(t * 0.37 + ph) * 0.81 - sin(t * 0.9 + ph) * 0.45);
  let pos = vec3f(base.x + pth.x, 0.45 + 0.5 * h1(ii, 23.0) + 0.18 * sin(t * 2.3 + ph) + 0.08 * sin(t * 7.0 + ph), base.y + pth.y);
  let hd = normalize(vel + vec2f(1e-4)); let fw = vec3f(hd.x, 0.0, hd.y); let sideV = vec3f(-hd.y, 0.0, hd.x);
  let flap = sin(t * 13.0 + ph * 5.0) * 0.95; let wing = vi / 6u; let c = vec2f(QX[vi % 6u], QY[vi % 6u]);
  let sgn = select(-1.0, 1.0, wing == 1u); let span = (c.x * 0.5 + 0.5);                // 0 at body, 1 at wing tip
  let sz = 0.045 + 0.02 * h1(ii, 25.0);
  let dirW = sideV * cos(flap) * sgn + vec3f(0.0, sin(flap), 0.0);
  let wp = pos + dirW * span * sz * 1.6 + fw * c.y * sz;
  o.p = u.vp * vec4f(wp, 1.0); o.uv = vec2f(span, c.y); o.kind = 2u;
  var pal = array<vec3f,4>(vec3f(0.96, 0.95, 0.88), vec3f(0.98, 0.86, 0.30), vec3f(0.95, 0.55, 0.18), vec3f(0.60, 0.72, 0.95));
  let cc = pal[u32(h1(ii, 26.0) * 3.99)] * (0.75 + 0.35 * abs(cos(flap)));
  o.col = vec4f(cc, edgeFade(pos, R)); return o; }
// distant bird flocks (chevrons) high in the sky
@vertex fn vs_bird(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> AO {
  var o: AO; let t = u.cam.w; let fl = ii / 9u; let bi = ii % 9u; let R = 700.0;
  let fc0 = wrapW(vec2f(h1(fl, 31.0), h1(fl, 32.0)) * R + vec2f(t * 6.0, t * 2.0), R);
  let ang = t * 0.06 + f32(fl) * 2.1; let fc = fc0 + vec2f(cos(ang), sin(ang)) * 50.0;
  let hd = vec2f(-sin(ang), cos(ang)); let sd = vec2f(-hd.y, hd.x);
  let row = f32((bi + 1u) / 2u); let sgn = select(-1.0, 1.0, (bi % 2u) == 0u);
  let off = -hd * row * 3.2 + sd * row * 2.8 * sgn + vec2f(sin(t * 0.8 + f32(bi)), cos(t * 0.6 + f32(bi) * 1.7)) * 0.8;
  let pos = vec3f(fc.x + off.x, 75.0 + 25.0 * h1(fl, 33.0) + sin(t * 0.5 + f32(bi)) * 0.6, fc.y + off.y);
  let flap = sin(t * 7.0 + f32(bi) * 1.3) * 0.6;
  // two thin triangles: body->left tip, body->right tip
  let wing = vi / 3u; let k = vi % 3u; let ws = select(-1.0, 1.0, wing == 1u);
  let sd3 = vec3f(sd.x, 0.0, sd.y); let hd3 = vec3f(hd.x, 0.0, hd.y); let span = 0.55;
  var wp = pos;
  if (k == 1u) { wp = pos + sd3 * ws * span + vec3f(0.0, flap * span, 0.0) - hd3 * 0.25; }
  if (k == 2u) { wp = pos + hd3 * 0.18; }
  let dist = length(pos - u.cam.xyz); let grow = max(1.0, dist / 260.0);   // keep >= ~2 px on screen
  wp = pos + (wp - pos) * grow;
  o.p = u.vp * vec4f(wp, 1.0); o.uv = vec2f(0.0); o.kind = 3u;
  let vis = smoothstep(120.0, 180.0, dist) * smoothstep(380.0, 320.0, dist);
  o.col = vec4f(mix(vec3f(0.17, 0.19, 0.22), HAZE, 0.30), 0.85 * vis); return o; }
// v445 dust puffs kicked up by each paw strike on the dirt path
@vertex fn vs_dust(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> AO {
  var o: AO; let P = prints[ii / 3u]; let kk = f32(ii % 3u); let age = u.cam.w - P.w - 0.03 * kk; let c = vec2f(QX[vi], QY[vi]);
  o.uv = c; o.kind = 6u; o.col = vec4f(0.0); o.p = vec4f(2.0, 2.0, 2.0, 1.0);
  if (age < 0.0 || age > 1.7) { return o; }
  let r1 = hash2(P.xy * 13.1 + kk); let r2 = hash2(P.xy * 7.7 + kk * 3.1); let fw = vec2f(-sin(P.z), -cos(P.z)); let rt = vec2f(-fw.y, fw.x);
  let e = 1.0 - exp(-age * 2.4);
  let xz = P.xy + (-fw * (0.20 + 0.35 * r1) + rt * (r2 - 0.5) * 0.55) * e + vec2f(0.8, 0.6) * 0.12 * age;
  let wp = vec3f(xz.x, terrH(xz) + 0.03 + (0.08 + 0.28 * r1) * e, xz.y);
  o.p = bb(wp, c, 0.05 + 0.24 * e * (0.7 + 0.6 * r2));
  let a = 0.34 * pow(1.0 - age / 1.7, 2.0) * smoothstep(0.0, 0.06, age);
  o.col = vec4f(vec3f(0.80, 0.70, 0.55) * (0.85 + 0.25 * r2), a); return o; }
`; }

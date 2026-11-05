// engine/river.js — reusable procedural river (house WebGPU). Per-biome config in, {wgsl, js} out.
// cfg: { pts:[[x,z],..] centre polyline, halfW, wVar, depth, bank, drop (water below banks), flow (m/s),
//        shallow:[r,g,b], deep:[r,g,b], absorb:[r,g,b], foam:[r,g,b], wet:[r,g,b], shoreRocks: 0..1 }
export const RIVER_DEFAULT = { pts: [[0, 0], [0, -100]], halfW: 2.6, wVar: 0.6, depth: 0.9, bank: 3.0, drop: 0.24, flow: 1.1, fords: [], fordR: 4.5,
  shallow: [0.33, 0.42, 0.34], deep: [0.04, 0.12, 0.13], absorb: [2.6, 1.0, 0.75], foam: [0.92, 0.95, 0.93], wet: [0.55, 0.50, 0.45], shoreRocks: 0.55 };
const f = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
const v3 = (a) => `vec3f(${a.map(f).join(', ')})`;
export function makeRiver(user, h0js) {
  const c = { ...RIVER_DEFAULT, ...user }, P = c.pts, N = P.length;
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const M = c.halfW + c.wVar + c.bank + 1; const BB = [x0 - M, z0 - M, x1 + M, z1 + M];
  // ---- JS side (collision, placement): same maths as WGSL
  const info = (x, z) => { let best = 1e9, tx = 0, tz = -1, cx = x, cz = z, s = 0, acc = 0, sd = 0;
    if (x < BB[0] || z < BB[1] || x > BB[2] || z > BB[3]) return { d: 1e9 };
    for (let i = 0; i < N - 1; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1]; const ex = bx - ax, ez = bz - az, L2 = ex * ex + ez * ez, L = Math.sqrt(L2);
      const h = Math.min(1, Math.max(0, ((x - ax) * ex + (z - az) * ez) / L2)); const qx = ax + ex * h, qz = az + ez * h, d = Math.hypot(x - qx, z - qz);
      if (d < best) { best = d; tx = ex / L; tz = ez / L; cx = qx; cz = qz; s = acc + h * L; sd = Math.sign((x - qx) * -tz + (z - qz) * tx) || 1; } acc += L; }
    return { d: best, tx, tz, cx, cz, s, side: sd, W: c.halfW + c.wVar * Math.sin(s * 0.07) }; };
  const ford = (x, z) => { let k = 0; for (const [fx, fz] of c.fords) k = Math.max(k, Math.exp(-((x - fx) ** 2 + (z - fz) ** 2) / (c.fordR * c.fordR))); return k; };
  const prof = (d, W, fk = 0) => { const k = Math.min(d / W, 1); return -c.drop - 0.08 + 0.05 * fk - c.depth * (1 - 0.85 * fk) * (1 - k * k); };
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const carve = (x, z, h) => { const r = info(x, z); if (r.d > 1e8) return h; const b = ss(r.W, r.W + c.bank, r.d); return (h0js(r.cx, r.cz) + prof(r.d, r.W, ford(x, z))) * (1 - b) + h * b; };
  const level = (x, z) => { const r = info(x, z); return r.d > 1e8 ? -1e9 : h0js(r.cx, r.cz) - c.drop; };
  const collide = (x, z) => { const r = info(x, z); const lim = r.W - 0.9; if (r.d > 1e8) return [x, z, 0]; if (r.d > lim || ford(x, z) > 0.45) return [x, z, r.d < r.W ? 1 : 0]; // deep water: push back to the shallows (splash flag)
    const nx = (x - r.cx) / Math.max(r.d, 1e-3), nz = (z - r.cz) / Math.max(r.d, 1e-3); return [r.cx + nx * lim, r.cz + nz * lim, 1]; };
  const inWater = (x, z) => { const r = info(x, z); return r.d < r.W + 0.4; };
  // ---- WGSL side
  const pts = P.map(([x, z]) => `vec2f(${f(x)}, ${f(z)})`).join(', ');
  const wgsl = /* wgsl */`
// ---- engine/river.js
const RIV_N = ${N}u; const RIV_P = array<vec2f, ${N}>(${pts});
const RIV_NF = ${Math.max(c.fords.length,1)}u; const RIV_F = array<vec2f, ${Math.max(c.fords.length,1)}>(${(c.fords.length ? c.fords : [[1e6, 1e6]]).map(([x, z]) => `vec2f(${f(x)}, ${f(z)})`).join(', ')});
fn rivFord(p: vec2f) -> f32 { var k = 0.0; for (var i = 0u; i < RIV_NF; i++) { let d = p - RIV_F[i]; k = max(k, exp(-dot(d, d) / ${f(c.fordR * c.fordR)})); } return k; }
const RIV_BB = vec4f(${BB.map(f).join(', ')});
struct RivI { d: f32, t: vec2f, c: vec2f, s: f32, W: f32 };
fn rivInfo(p: vec2f) -> RivI { var r: RivI; r.d = 1e9; r.t = vec2f(0.0, -1.0); r.c = p; r.s = 0.0; r.W = ${f(c.halfW)};
  if (p.x < RIV_BB.x || p.y < RIV_BB.y || p.x > RIV_BB.z || p.y > RIV_BB.w) { return r; }
  var acc = 0.0;
  for (var i = 0u; i < RIV_N - 1u; i++) { let a = RIV_P[i]; let e = RIV_P[i + 1u] - a; let L = length(e);
    let h = clamp(dot(p - a, e) / (L * L), 0.0, 1.0); let q = a + e * h; let d = length(p - q);
    if (d < r.d) { r.d = d; r.t = e / L; r.c = q; r.s = acc + h * L; } acc += L; }
  r.W = ${f(c.halfW)} + ${f(c.wVar)} * sin(r.s * 0.07); return r; }
fn rivProf(d: f32, W: f32, fk: f32) -> f32 { let k = min(d / W, 1.0); return -${f(c.drop)} - 0.08 + 0.05 * fk - ${f(c.depth)} * (1.0 - 0.85 * fk) * (1.0 - k * k); }
fn rivCarve(p: vec2f, h: f32) -> f32 { let r = rivInfo(p); if (r.d > 1e8) { return h; }
  let b = smoothstep(r.W, r.W + ${f(c.bank)}, r.d); return mix(terrH0(r.c) + rivProf(r.d, r.W, rivFord(p)), h, b); }
fn rivGrass(p: vec2f) -> f32 { let r = rivInfo(p); if (r.d > 1e8) { return 1.0; } return smoothstep(r.W + 0.1, r.W + 1.6 + 0.8 * vnoise(p * 1.7), r.d); }
fn rivWave(q: vec2f) -> f32 { return vnoise(q * 1.9) * 0.55 + vnoise(q * 4.3 + 7.1) * 0.30 + vnoise(q * 9.7 + 3.3) * 0.15; }
fn rivFlowH(q: vec2f, t: vec2f, tm: f32) -> f32 { // two-phase flow map: no stretching, no pulsing seams
  let ph0 = fract(tm * 0.35); let ph1 = fract(tm * 0.35 + 0.5); let sp = ${f(c.flow)} / 0.35;
  let a = rivWave(q - t * ph0 * sp); let b = rivWave(q - t * ph1 * sp + 11.0);
  let w = abs(ph0 - 0.5) * 2.0; return mix(a, b, w); }
// shade the river surface over a ground fragment at world w; bed = already-lit bed colour (approx. refraction), sh = sun shadow
fn rivShade(w: vec3f, bed: vec3f, sh: f32, foamX: f32) -> vec4f {
  let r = rivInfo(w.xz); if (r.d > r.W + ${f(c.bank)}) { return vec4f(0.0); }
  let wl = terrH0(r.c) - ${f(c.drop)}; let wd = wl - w.y; if (wd <= 0.0) { return vec4f(0.0); }
  let E = u.cam.xyz; let tt = clamp((E.y - wl) / max(E.y - w.y, 1e-3), 0.0, 1.0); let ws = E + (w - E) * tt;   // view ray hits the flat surface
  let tm = u.cam.w; let e = 0.05; let q = ws.xz * 1.0;
  let h = rivFlowH(q, r.t, tm); let hx = rivFlowH(q + vec2f(e, 0.0), r.t, tm); let hz = rivFlowH(q + vec2f(0.0, e), r.t, tm);
  let dist = length(ws - E); let amp = 0.10 * (1.0 - smoothstep(25.0, 90.0, dist)) + 0.025;
  let n = normalize(vec3f(-(hx - h) / e * amp, 1.0, -(hz - h) / e * amp));
  let V = normalize(E - ws); let R = reflect(-V, n);
  let fr = 0.02 + 0.45 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
  let sky = 0.42 * mix(vec3f(0.62, 0.72, 0.78), vec3f(0.30, 0.50, 0.80), smoothstep(0.0, 0.6, R.y));
  let refl = mix(vec3f(0.045, 0.085, 0.05), sky, smoothstep(0.05, 0.38, R.y + 0.06 * vnoise(ws.xz * 0.4)));   // far bank + trees mirrored at grazing angles
  let spec = pow(max(dot(R, u.sun.xyz), 0.0), 220.0) * 9.0 * sh + pow(max(dot(R, u.sun.xyz), 0.0), 24.0) * 0.35 * sh;
  let rd = refract(-V, n, 0.75); let pl = wd / max(-rd.y, 0.25);          // refracted ray + its path length through the water volume
  let wb = ws + rd * pl;                                                   // where the refracted ray meets the bed
  let ab = exp(-${v3(c.absorb)} * (wd + pl) * 1.3);
  // ford: clear water over sunlit gravel with caustics + small riffles (not a flat green sheet)
  let fk = rivFord(w.xz); let peb = 0.6 * vnoise(wb.xz * 3.1) + 0.4 * vnoise(wb.xz * 7.3 + 3.7);
  let gravel = mix(vec3f(0.14, 0.12, 0.08), vec3f(0.42, 0.36, 0.26), smoothstep(0.25, 0.8, peb));
  let caus = pow(abs(sin(vnoise(wb.xz * 1.3 + vec2f(tm * 0.35, 0.0)) * 14.0)), 12.0) * sh;   // thin moving caustic lines
  let bedF = mix(bed * ${v3(c.shallow)} * 1.3 * (0.8 + 0.4 * vnoise(wb.xz * 2.2)), gravel * (0.12 + 0.55 * sh) * (0.85 + 0.7 * caus), fk);
  let body = mix(${v3(c.deep)} * (0.55 + 0.45 * sh), bedF, mix(ab, max(ab, vec3f(0.50, 0.74, 0.78)), fk));
  var col = mix(body, refl, fr + 0.12 * smoothstep(8.0, 30.0, dist)) + vec3f(1.0, 0.95, 0.85) * spec;
  // foam: wet shore line + caller-supplied obstacle foam (rocks, wheel), broken up by the flowing noise
  let shore = (1.0 - smoothstep(0.0, 0.05, wd)) * (1.0 - smoothstep(0.2, 0.6, fk));   // a ford is shallow everywhere: no shore band over it
  let fx = max(foamX, fk * 0.5 * smoothstep(0.62, 0.9, peb));
  let fm = clamp(max(shore * 0.8, fx) * smoothstep(0.35, 0.75, h + 0.25 * fx), 0.0, 1.0);
  col = mix(col, ${v3(c.foam)} * (0.55 + 0.5 * sh), fm * 0.85);
  return vec4f(col, smoothstep(0.0, 0.025, wd)); }   // a = water coverage (soft edge)
fn rivWL(p: vec2f) -> f32 { let r = rivInfo(p); if (r.d > r.W + 0.2) { return -1e9; } return terrH0(r.c) - ${f(c.drop)}; }   // water surface height (or -1e9 outside)
fn rivWet(p: vec2f, y: f32) -> f32 { let r = rivInfo(p); if (r.d > 1e8) { return 0.0; } let wl = terrH0(r.c) - ${f(c.drop)}; return 1.0 - smoothstep(0.0, 0.07, y - wl); }
`;
  return { cfg: c, wgsl, info, carve, level, collide, inWater, BB };
}

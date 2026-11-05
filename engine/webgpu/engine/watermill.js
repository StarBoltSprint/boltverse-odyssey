// engine/watermill.js — reusable futuristic watermill prop (house WebGPU, procedural boxes, crystal never chrome). v6: stone/wood house+wheel (mt 6) so it reads solid; crystal accents mt7 only (no holographic wireframe).
// cfg: { river (makeRiver result), s (arc length along river, m), side (+1/-1 bank), h0 (JS ground height fn),
//        R wheel radius, dip, stone, roof, wood, crystal colours, glow }
export const MILL_DEFAULT = { s: 40, side: 1, R: 1.7, dip: 0.42, stone: [0.80, 0.78, 0.72], stone2: [0.52, 0.50, 0.46], roof: [0.30, 0.40, 0.42],
  wood: [0.36, 0.27, 0.19], crystal: [0.35, 1.25, 1.45], glow: 1.0 };
const f = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
const v3 = (a) => `vec3f(${a.map(f).join(', ')})`;
export function makeMill(user) {
  const c = { ...MILL_DEFAULT, ...user }, rv = c.river, P = rv.cfg.pts;
  // locate the bank point at arc length s
  let acc = 0, ax = P[0][0], az = P[0][1], tx = 0, tz = -1;
  for (let i = 0; i < P.length - 1; i++) { const ex = P[i + 1][0] - P[i][0], ez = P[i + 1][1] - P[i][1], L = Math.hypot(ex, ez);
    if (acc + L >= c.s || i === P.length - 2) { const h = Math.min(1, (c.s - acc) / L); ax = P[i][0] + ex * h; az = P[i][1] + ez * h; tx = ex / L; tz = ez / L; break; } acc += L; }
  const W = rv.cfg.halfW + rv.cfg.wVar * Math.sin(c.s * 0.07);
  const nx = -tz * c.side, nz = tx * c.side;             // from river centre toward this bank
  const bx = ax + nx * (W + 0.15), bz = az + nz * (W + 0.15);     // bank edge (origin, local z points to the water)
  const Z = [-nx, -nz], X = [tx, tz];
  const g0 = rv.carve(bx - nx * 2.4, bz - nz * 2.4, c.h0(bx - nx * 2.4, bz - nz * 2.4));   // ground under the house
  const wl = c.h0(ax, az) - rv.cfg.drop, zW = W * 0.45 + 0.15;  // wheel sits in the outer half of the channel
  const yW = wl - g0, yA = yW + c.R - c.dip;
  const omega = rv.cfg.flow / c.R;
  const hx = bx + nx * 2.4, hz = bz + nz * 2.4;   // house sits on the bank, away from the water (local z < 0)
  const colliders = [[hx, hz, 2.9]];   // house core + 4 plinth corners (plinth half 2.3 x 2.1, Bolt footprint 0.22) so the take never clips a corner
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) colliders.push([hx + X[0] * sx * 1.95 + nx * sz * 1.75, hz + X[1] * sx * 1.95 + nz * sz * 1.75, 0.75]);
  const wheelXZ = [bx + Z[0] * zW, bz + Z[1] * zW];
  const wgslCommon = /* wgsl */`
// ---- engine/watermill.js (shared)
const MILL_O = vec3f(${f(bx)}, ${f(g0)}, ${f(bz)}); const MILL_X = vec3f(${f(X[0])}, 0.0, ${f(X[1])}); const MILL_Z = vec3f(${f(Z[0])}, 0.0, ${f(Z[1])});
const MILL_R = ${f(c.R)}; const MILL_ZW = ${f(zW)}; const MILL_YA = ${f(yA)}; const MILL_OM = ${f(omega)}; const MILL_WL = ${f(wl)};
fn millFoam(p: vec2f) -> f32 { // soft paddle churn + broken trail (no painted rings / pylon disc)
  let o = MILL_O.xz + MILL_Z.xz * MILL_ZW; let q = p - o; let lx = dot(q, MILL_X.xz); let lz = dot(q, MILL_Z.xz);
  let cut = sqrt(max(MILL_R * MILL_R - (MILL_R - ${f(c.dip)}) * (MILL_R - ${f(c.dip)}), 0.01));
  let brk = 0.45 + 0.55 * vnoise(p * 7.0 + vec2f(u.cam.w * 0.9, 0.0));
  let a = exp(-pow(max(abs(lx) - cut, 0.0) / 0.9, 2.0) - pow(lz / 1.5, 2.0)) * 0.55 * brk;
  let tr = exp(-pow(lz / (1.2 + 0.14 * max(lx, 0.0)), 2.0)) * smoothstep(0.0, 0.8, lx) * exp(-max(lx, 0.0) / 9.0) * 0.35 * brk;
  let py = (1.0 - smoothstep(0.20, 0.70, length(q - MILL_Z.xz * 0.75))) * 0.18 * brk;
  return clamp(a + tr + py, 0.0, 1.0); }
`;
  const wgslPM = /* wgsl */`
// ---- engine/watermill.js (geometry, PROPS module: VO / OFF / lit)
const MILL_NB = 76u;
fn cubeV(i: u32) -> vec3f { var f = array<vec3f,6>(vec3f(1,0,0), vec3f(-1,0,0), vec3f(0,1,0), vec3f(0,-1,0), vec3f(0,0,1), vec3f(0,0,-1));
  var qa = array<vec2f,6>(vec2f(-1,-1), vec2f(1,-1), vec2f(1,1), vec2f(-1,-1), vec2f(1,1), vec2f(-1,1));
  let n = f[i / 6u]; let q = qa[i % 6u]; var a = vec3f(n.y, n.z, n.x); var b = cross(n, a); if (dot(cross(a, b), n) < 0.0) { b = -b; }
  return n + a * q.x + b * q.y; }
struct MB { c: vec3f, ax: vec3f, ay: vec3f, az: vec3f, h: vec3f, col: vec3f, mt: u32 };
fn mb(c: vec3f, h: vec3f, col: vec3f, mt: u32) -> MB { var b: MB; b.c = c; b.ax = vec3f(1,0,0); b.ay = vec3f(0,1,0); b.az = vec3f(0,0,1); b.h = h; b.col = col; b.mt = mt; return b; }
fn millBox(k: u32, tm: f32) -> MB {
  let ST = ${v3(c.stone)}; let ST2 = ${v3(c.stone2)}; let RF = ${v3(c.roof)}; let WD = ${v3(c.wood)}; let CR = ${v3(c.crystal)};
  let HC = vec3f(0.0, 0.0, -2.4); let pulse = 0.75 + 0.25 * sin(tm * 2.2);
  let Wc = vec3f(0.0, MILL_YA, MILL_ZW); let ang = -tm * MILL_OM;
  if (k == 0u) { return mb(HC + vec3f(0.0, 1.55, 0.0), vec3f(2.0, 1.55, 1.8), ST, 6u); }
  if (k == 1u) { return mb(HC + vec3f(0.0, 0.05, 0.0), vec3f(2.3, 0.45, 2.1), ST2, 6u); }
  if (k <= 3u) { let s = select(-1.0, 1.0, k == 2u); var b = mb(HC + vec3f(0.0, 3.62, s * 0.98), vec3f(2.35, 0.09, 1.22), RF, 6u);
    b.ay = vec3f(0.0, 0.866, s * 0.5); b.az = vec3f(0.0, -s * 0.5, 0.866); return b; }
  if (k <= 7u) { let i = f32(k - 4u); let sx = select(-1.0, 1.0, (k % 2u) == 0u); let sz = select(-1.0, 1.0, k >= 6u);   // crystal corner strips
    var b = mb(HC + vec3f(sx * 2.02, 1.6, sz * 1.82), vec3f(0.05, 1.5, 0.05), CR * pulse, 7u); return b; }
  if (k <= 9u) { let sz = select(-1.0, 1.0, k == 9u); return mb(HC + vec3f(0.0, 2.35, sz * 1.82), vec3f(2.0, 0.035, 0.03), CR * pulse, 7u); }   // crystal band
  if (k <= 11u) { let sx = select(-1.0, 1.0, k == 11u); return mb(HC + vec3f(sx * 2.02, 2.35, 0.0), vec3f(0.03, 0.035, 1.8), CR * pulse, 7u); }
  if (k == 12u) { return mb(HC + vec3f(0.0, 4.13, 0.0), vec3f(2.4, 0.05, 0.05), CR * pulse * 1.2, 7u); }              // ridge line
  if (k == 13u) { return mb(HC + vec3f(0.0, 1.4, 1.83), vec3f(0.55, 0.65, 0.02), CR * (0.55 + 0.25 * pulse), 7u); }   // crystal window (water face)
  if (k == 14u) { return mb(vec3f(0.0, MILL_YA, (MILL_ZW - 0.6) * 0.5 - 0.0), vec3f(0.09, 0.09, (MILL_ZW + 0.6) * 0.5 + 0.45), ST2, 6u); }   // axle
  if (k == 15u) { let yb = MILL_WL - MILL_O.y - 1.0; return mb(vec3f(0.0, (MILL_YA + yb) * 0.5, MILL_ZW + 0.75), vec3f(0.16, (MILL_YA - yb) * 0.5 + 0.12, 0.16), ST, 6u); }   // outer pylon
  if (k == 16u) { var b = mb(Wc, vec3f(0.2, 0.2, 0.55), CR * 1.3 * pulse, 7u); b.ax = vec3f(cos(ang * 2.0), sin(ang * 2.0), 0.0); b.ay = vec3f(-b.ax.y, b.ax.x, 0.0); return b; }  // crystal hub
  if (k == 17u) { return mb(HC + vec3f(0.0, 0.6, 1.95), vec3f(0.5, 0.6, 0.12), WD, 6u); }   // door
  let j = k - 18u;
  if (j < 32u) { let seg = j % 16u; let sz = select(-0.44, 0.44, j >= 16u); let th = ang + (f32(seg) + 0.5) * 0.3927;   // rims
    let rd = vec3f(cos(th), sin(th), 0.0); var b = mb(Wc + rd * MILL_R + vec3f(0.0, 0.0, sz), vec3f(0.06, MILL_R * 0.2, 0.05), WD, 6u);
    b.ax = rd; b.ay = vec3f(-rd.y, rd.x, 0.0); return b; }
  let j2 = j - 32u;
  if (j2 < 14u) { let th = ang + f32(j2) * 0.4488; let rd = vec3f(cos(th), sin(th), 0.0);      // paddles
    var b = mb(Wc + rd * (MILL_R - 0.28), vec3f(0.32, 0.035, 0.47), WD * 1.1, 6u); b.ax = rd; b.ay = vec3f(-rd.y, rd.x, 0.0); return b; }
  let j3 = j2 - 14u;
  if (j3 < 6u) { let th = ang + f32(j3) * 1.0472; let rd = vec3f(cos(th), sin(th), 0.0);        // spokes
    var b = mb(Wc + rd * MILL_R * 0.5 + vec3f(0.0, 0.0, -0.44), vec3f(MILL_R * 0.5, 0.045, 0.04), WD, 6u); b.ax = rd; b.ay = vec3f(-rd.y, rd.x, 0.0); return b; }
  let j4 = j3 - 6u;   // crystal veins on the outer spokes (6)
  let th = ang + f32(j4) * 1.0472 + 0.5236; let rd = vec3f(cos(th), sin(th), 0.0);
  var b = mb(Wc + rd * MILL_R * 0.5 + vec3f(0.0, 0.0, 0.46), vec3f(MILL_R * 0.47, 0.03, 0.025), CR * pulse, 7u); b.ax = rd; b.ay = vec3f(-rd.y, rd.x, 0.0); return b; }
@vertex fn vs_mill(@builtin(vertex_index) vi: u32) -> VO {
  var o: VO; o.p = OFF; o.k = vec2f(1.0, 1.0); o.x4 = vec4f(0.0);
  let b = millBox(vi / 36u, u.cam.w); let cv = cubeV(vi % 36u) * b.h;
  let lp = b.c + b.ax * cv.x + b.ay * cv.y + b.az * cv.z;
  let w = MILL_O + MILL_X * lp.x + vec3f(0.0, lp.y, 0.0) + MILL_Z * lp.z;
  o.p = u.vp * vec4f(w, 1.0); o.w = w; o.n = vec3f(0.0, 1.0, 0.0); o.col = b.col; o.mt = b.mt; return o; }
`;
  const wgslAir = /* wgsl */`
// ---- engine/watermill.js splashes (AIR module): droplets flung off the paddles as they leave the water
@vertex fn vs_splash(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> AO {
  var o: AO; let c = vec2f(QX[vi], QY[vi]); o.uv = c; o.kind = 6u; o.p = vec4f(2.0, 2.0, 2.0, 1.0); o.col = vec4f(0.0);
  let life = 0.9; let t0 = u.cam.w + h1(ii, 41.0) * life; let age = fract(t0 / life) * life; let gen = floor(t0 / life);
  let r1 = hash2(vec2f(f32(ii), gen) * 0.37); let r2 = hash2(vec2f(gen, f32(ii)) * 0.71 + 3.0); let r3 = hash2(vec2f(f32(ii) * 1.3, gen + 9.0));
  let cut = sqrt(max(MILL_R * MILL_R - (MILL_R - ${f(c.dip)}) * (MILL_R - ${f(c.dip)}), 0.01));
  let side = select(-1.0, 1.0, r3 > 0.35);   // mostly where the paddles rise out
  let p0 = vec3f(side * cut * (0.8 + 0.3 * r1), MILL_WL - MILL_O.y + 0.02, MILL_ZW + (r2 - 0.5) * 0.9);
  let v0 = vec3f(side * (0.4 + 0.9 * r2), 1.2 + 1.8 * r1, (r3 - 0.5) * 0.8);
  let lp = p0 + v0 * age + vec3f(0.0, -4.9 * age * age, 0.0);
  if (lp.y < MILL_WL - MILL_O.y - 0.02) { return o; }
  let w = MILL_O + MILL_X * lp.x + vec3f(0.0, lp.y, 0.0) + MILL_Z * lp.z;
  o.p = bb(w, c, 0.035 + 0.05 * r1); o.col = vec4f(vec3f(0.92, 0.96, 0.97), 0.55 * (1.0 - age / life)); return o; }
`;
  return { cfg: c, wgslCommon, wgslPM, wgslAir, colliders, verts: 76 * 36, wheelXZ, house: [hx, hz] };
}

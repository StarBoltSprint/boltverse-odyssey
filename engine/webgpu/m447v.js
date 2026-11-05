// v439meadowWolf — house WebGPU meadow tip (route C: keyed Bolt gallop clip on a camera-facing card + analytic sun shadow) (standalone; does not touch main.js / pinned tips)
// World-locked equirect sky + world-UV ground plate (2560²) + instanced 3D grass + baked-vertex Bolt trot.
const qs = new URLSearchParams(location.search); const LV = qs.get('lv') === '1';  // cap a scripted live run (collision proof)
const CINE = qs.get('cine') === '1'; const DEMO = qs.get('demo') === '1', CAP = qs.get('cap') === '1';
const hud = document.getElementById('hud');
if (CAP) hud.style.display = 'none';
const A = './assets/meadow/';
const SPEED = 7.0;          // m/s, constant
const STRIDE_HZ = 1.95;     // gallop cycles/s at SPEED (3.59 m per stride, paws match ground); scales with actual speed
const CAM_TAU = 0.11;       // camera yaw follow time-constant (s)
const MAX_REL = 10 * Math.PI / 180; // Bolt yaw vs camera clamp
const MAX_ROLL = 8 * Math.PI / 180;
const _q7 = new URLSearchParams(location.search); const ANG_GAIN = +(_q7.get('ag') || 2.5), ORB = +(_q7.get('orb') || 0), FORCE_L = _q7.has('lay') ? +_q7.get('lay') : -1, PARX = +(_q7.get('par') || 1), RELIT = _q7.has('relit') ? +_q7.get('relit') : 1;
const CAM_LAT = +(new URLSearchParams(location.search).get('lat') ?? -0.012);  // camera lateral offset (0 = Bolt centred)

// ---------- v440 rocks as data (shared by GPU + collision) and circle colliders ----------
const RK = 64, RCELL = 9.0, ROCKS = new Float32Array(RK * RK * 4);   // per cell (period 576 m): ox, oz (in cell units, -1 = none), radius, spare
{ let st = 0x9e3779b9; const rnd = () => { st ^= st << 13; st >>>= 0; st ^= st >>> 17; st ^= st << 5; st >>>= 0; return st / 4294967296; };
  for (let i = 0; i < RK * RK; i++) { const e = rnd() < 0.16, ox = 0.25 + 0.5 * rnd(), oz = 0.25 + 0.5 * rnd(), r = 0.6 + 0.5 * rnd();
    ROCKS.set(e ? [ox, oz, r, 0] : [-1, -1, 0, 0], i * 4); } }
const rockCell = (cx, cz) => (((cz % RK) + RK) % RK) * RK + (((cx % RK) + RK) % RK);
const BOLT_R = 0.42, TREE_GRID = 16, treeGrid = new Map();
function collide(x, z, psi) { // push Bolt out of rock / trunk circles; tangent slide, head-on hits pick a side so it never freezes
  for (let it = 0; it < 2; it++) {
    const cx0 = Math.floor(x / RCELL), cz0 = Math.floor(z / RCELL);
    const C = [];
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const k = rockCell(cx0 + a, cz0 + b) * 4; if (ROCKS[k] < 0) continue;
      C.push([(cx0 + a + ROCKS[k]) * RCELL, (cz0 + b + ROCKS[k + 1]) * RCELL, ROCKS[k + 2] * 0.95]); }
    const gx = Math.floor(x / TREE_GRID), gz = Math.floor(z / TREE_GRID);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const L = treeGrid.get((gx + a) + ',' + (gz + b)); if (L) for (const t of L) C.push(t); }
    for (const [ox, oz, r] of C) { let dx = x - ox, dz = z - oz; const R = r + BOLT_R, d = Math.hypot(dx, dz); if (d >= R) continue;
      if (d < 1e-3) { dx = Math.cos(psi); dz = -Math.sin(psi); } else { dx /= d; dz /= d; }
      const fx = -Math.sin(psi), fz = -Math.cos(psi);
      if (dx * fx + dz * fz < -0.97) { const s = (dx * fz - dz * fx) >= 0 ? 1 : -1; dx += -fz * s * 0.3; dz += fx * s * 0.3; const l = Math.hypot(dx, dz); dx /= l; dz /= l; }
      x = ox + dx * R; z = oz + dz * R; collide.hit = [ox, oz, r]; } }
  return [x, z]; }
// ---------- deterministic demo drive ----------
const D2R = Math.PI / 180;
// [start s, duration s, angle deg (+ = left)]
const TURNS = [[2,4,90],[7,4,-90],[12,12,360],[26,4,-90],[31,4,120],[36,12,-360],[50,4,90],[54,7,-180],[61,12,360],[75,4,-90],[80,4,90],[85,4,-45]];
function omegaAt(t) { let w = 0; for (const [s, d, a] of TURNS) { if (t >= s && t < s + d) w += (a * D2R / d) * (1 - Math.cos(2 * Math.PI * (t - s) / d)); } return w; }
const HITS = []; window.__hits = HITS;
const DT = 1 / 240, NT = Math.ceil(100 / DT) + 2;
const TR = { psi: new Float64Array(NT), x: new Float64Array(NT), z: new Float64Array(NT), cam: new Float64Array(NT), w: new Float64Array(NT) };
{ let psi = 0, x = 0, z = 0, cam = 0;
  for (let i = 0; i < NT; i++) { const t = i * DT, w = omegaAt(t);
    TR.psi[i] = psi; TR.x[i] = x; TR.z[i] = z; TR.cam[i] = cam; TR.w[i] = w;
    psi += w * DT; x += -Math.sin(psi) * SPEED * DT; z += -Math.cos(psi) * SPEED * DT; collide.hit = null; [x, z] = collide(x, z, psi); if (collide.hit) HITS.push([+(i * DT).toFixed(2), ...collide.hit.map(v => +v.toFixed(2))]);
    cam += (psi - cam) * (1 - Math.exp(-DT / CAM_TAU));
    if (psi - cam > MAX_REL) cam = psi - MAX_REL; if (cam - psi > MAX_REL) cam = psi + MAX_REL; } }
function sampleTR(t) { const f = Math.min(Math.max(t / DT, 0), NT - 2), i = Math.floor(f), u = f - i, L = (k) => TR[k][i] * (1 - u) + TR[k][i + 1] * u;
  return { psi: L('psi'), x: L('x'), z: L('z'), cam: L('cam'), w: L('w') }; }
// seamless demo loop: each 90 s cycle continues from where the last one ended (no reset cut)
function sampleLoop(t) { const k = Math.max(0, Math.floor(t / 90)), r = sampleTR(t - 90 * k); if (!k) return r;
  const E = sampleTR(90); let P = 0, X = 0, Z = 0;
  for (let j = 0; j < k; j++) { const c = Math.cos(P), s = Math.sin(P); X += E.x * c + E.z * s; Z += -E.x * s + E.z * c; P += E.psi; }
  const c = Math.cos(P), s = Math.sin(P);
  return { psi: r.psi + P, cam: r.cam + P, w: r.w, x: X + r.x * c + r.z * s, z: Z - r.x * s + r.z * c }; }
// world-placed trees (parallax): scattered in clumps, kept >= 10 m off the demo path
function makeTrees() {
  const P = []; for (let t = 0; t <= 95; t += 0.2) { const r = sampleTR(t); P.push([r.x, r.z]); }
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const M = 260, C = 7, out = [];
  const h = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
  for (let gx = Math.floor((x0 - M) / C); gx <= (x1 + M) / C; gx++) for (let gz = Math.floor((z0 - M) / C); gz <= (z1 + M) / C; gz++) {
    const clump = 0.5 + 0.5 * Math.sin(gx * 0.21 + 1.3) * Math.sin(gz * 0.17 + 0.4) + 0.3 * Math.sin(gx * 0.07 - gz * 0.05);
    if (h(gx, gz) > Math.max(0, clump - 0.30) * 1.2) continue;
    const x = (gx + h(gx + 3.1, gz)) * C, z = (gz + h(gx, gz + 7.7)) * C;
    let dmin = 1e9; for (const [px, pz] of P) { const d = (px - x) ** 2 + (pz - z) ** 2; if (d < dmin) dmin = d; }
    dmin = Math.sqrt(dmin); if (dmin < 55 || dmin > M) continue;
    out.push(x, z, 11 + 12 * h(gx + 11.0, gz + 5.0), h(gx + 2.2, gz + 9.9)); }
  return new Float32Array(out);
}
// free-play state (keyboard / touch) when not in demo
const _h2 = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
const _vn = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, wx = fx * fx * (3 - 2 * fx), wy = fy * fy * (3 - 2 * fy);
  const a = _h2(ix, iy), b = _h2(ix + 1, iy), c = _h2(ix, iy + 1), d = _h2(ix + 1, iy + 1); return (a + (b - a) * wx) + ((c + (d - c) * wx) - (a + (b - a) * wx)) * wy; };
const _ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const pathX = (z) => 6 + 9 * Math.sin(z * 0.021) + 4 * Math.sin(z * 0.053 + 1.3);
const terrH = (x, z) => { const h = 0.75 * Math.sin(x * 0.051 + z * 0.023) + 0.55 * Math.sin(-x * 0.031 + z * 0.067 + 1.7) + 0.22 * Math.sin(x * 0.13 + z * 0.11 + 0.4) + 0.12 * Math.sin(-x * 0.19 + z * 0.23 + 2.1);
  return h * _ss(3, 18, Math.hypot(x, z)) - 0.10 * (1 - _ss(0.6, 1.6, Math.abs(x - pathX(z)) * 0.93)); };
window.__terrH = terrH;
const live = { psi: 0, x: 0, z: 0, cam: 0, w: 0, turn: 0, v: SPEED, phase: 0 };
window.__live = live; window.__stepLive = dt => stepLive(dt);  // read-only hook for the scripted input test
// v439 input fix: turn is derived every frame from what is *currently held* (keys set + live pointers + gamepad),
// so a lost keyup / pointercancel (phone gestures, blur, finger slid off screen) can no longer leave a stuck turn.
const held = new Set(), ptrs = new Map();
const K_L = ['a', 'arrowleft', 'q'], K_R = ['d', 'arrowright'];
addEventListener('keydown', e => { held.add(e.key.toLowerCase()); });
addEventListener('keyup', e => { held.delete(e.key.toLowerCase()); });
const clearInput = () => { held.clear(); ptrs.clear(); };
addEventListener('blur', clearInput); document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
const pSide = e => (e.clientX < innerWidth / 2 ? 1 : -1);
addEventListener('pointerdown', e => { ptrs.set(e.pointerId, pSide(e)); e.target.setPointerCapture?.(e.pointerId); }, { passive: true });
addEventListener('pointermove', e => { if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, pSide(e)); }, { passive: true });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) addEventListener(ev, e => ptrs.delete(e.pointerId));
addEventListener('touchend', e => { if (!e.touches.length) ptrs.clear(); }); addEventListener('touchcancel', () => ptrs.clear());
addEventListener('contextmenu', e => e.preventDefault());
function turnInput() { let t = 0;
  if (K_L.some(k => held.has(k))) t += 1; if (K_R.some(k => held.has(k))) t -= 1;
  for (const v of ptrs.values()) t += v;
  for (const g of (navigator.getGamepads ? navigator.getGamepads() : [])) { if (g && Math.abs(g.axes[0]) > 0.25) t -= g.axes[0]; }
  return Math.max(-1, Math.min(1, t)); }
function stepLive(dt) { live.turn = turnInput(); const target = live.turn * 75 * D2R;
  live.w += (target - live.w) * (1 - Math.exp(-dt / (target === 0 ? 0.10 : 0.25)));   // release returns to straight fast
  if (target === 0 && Math.abs(live.w) < 0.05) live.w = 0;                           // no residual drift
  live.psi += live.w * dt; live.x += -Math.sin(live.psi) * live.v * dt; live.z += -Math.cos(live.psi) * live.v * dt; [live.x, live.z] = collide(live.x, live.z, live.psi);
  live.phase = (live.phase + dt * STRIDE_HZ * live.v / SPEED) % 1;   // cadence follows actual ground speed
  live.cam += (live.psi - live.cam) * (1 - Math.exp(-dt / CAM_TAU));
  if (live.psi - live.cam > MAX_REL) live.cam = live.psi - MAX_REL; if (live.cam - live.psi > MAX_REL) live.cam = live.psi + MAX_REL; return live; }

// ---------- math ----------
const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]], cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const norm = a => { const l = Math.hypot(...a); return a.map(v => v / l); }, dot = (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function lookAt(e, c, up) { const f = norm(sub(c, e)), s = norm(cross(f, up)), u = cross(s, f);
  return [s[0],u[0],-f[0],0, s[1],u[1],-f[1],0, s[2],u[2],-f[2],0, -dot(s,e),-dot(u,e),dot(f,e),1]; }
function persp(fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2); return [t/asp,0,0,0, 0,t,0,0, 0,0,f/(n-f),-1, 0,0,n*f/(n-f),0]; }
function mul(a, b) { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c*4+r] += a[k*4+r] * b[c*4+k]; return o; }
function inv(m) { const a = m, o = new Array(16); const [a00,a01,a02,a03,a10,a11,a12,a13,a20,a21,a22,a23,a30,a31,a32,a33] = a;
  const b00=a00*a11-a01*a10,b01=a00*a12-a02*a10,b02=a00*a13-a03*a10,b03=a01*a12-a02*a11,b04=a01*a13-a03*a11,b05=a02*a13-a03*a12,b06=a20*a31-a21*a30,b07=a20*a32-a22*a30,b08=a20*a33-a23*a30,b09=a21*a32-a22*a31,b10=a21*a33-a23*a31,b11=a22*a33-a23*a32;
  const d = 1/(b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06);
  o[0]=(a11*b11-a12*b10+a13*b09)*d;o[1]=(a02*b10-a01*b11-a03*b09)*d;o[2]=(a31*b05-a32*b04+a33*b03)*d;o[3]=(a22*b04-a21*b05-a23*b03)*d;o[4]=(a12*b08-a10*b11-a13*b07)*d;o[5]=(a00*b11-a02*b08+a03*b07)*d;o[6]=(a32*b02-a30*b05-a33*b01)*d;o[7]=(a20*b05-a22*b02+a23*b01)*d;o[8]=(a10*b10-a11*b08+a13*b06)*d;o[9]=(a01*b08-a00*b10-a03*b06)*d;o[10]=(a30*b04-a31*b02+a33*b00)*d;o[11]=(a21*b02-a20*b04-a23*b00)*d;o[12]=(a11*b07-a10*b09-a12*b06)*d;o[13]=(a00*b09-a01*b07+a02*b06)*d;o[14]=(a31*b01-a30*b03-a32*b00)*d;o[15]=(a20*b03-a21*b01+a22*b00)*d; return o; }

// ---------- WGSL ----------
const COMMON = /* wgsl */`
struct U { vp: mat4x4f, ivp: mat4x4f, cam: vec4f, bolt: vec4f, bp: vec4f, grid: vec4f, sun: vec4f, misc: vec4f, svp: mat4x4f, c0: mat4x4f, c1: mat4x4f, tr: vec4f, b7: vec4f, b8: vec4f };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var gtex: texture_2d<f32>;
@group(0) @binding(3) var stex: texture_2d<f32>;
@group(0) @binding(6) var smap: texture_depth_2d;
@group(0) @binding(7) var scmp: sampler_comparison;
@group(0) @binding(9) var atex: texture_2d<f32>;
@group(0) @binding(15) var<storage, read> rockT: array<vec4f>;
@group(0) @binding(16) var tDirt: texture_2d<f32>;
@group(0) @binding(17) var<storage, read> prints: array<vec4f, 96>;   // v445 paw prints: x, z, yaw, time
fn rockAt(rc: vec2f) -> vec4f { let m = vec2i(rc) % 64; let q = (m + 64) % 64; return rockT[q.y * 64 + q.x]; }
const PI = 3.14159265;
const HOR = vec3f(0.50, 0.68, 0.88);
const HAZE = vec3f(0.46, 0.56, 0.58);
fn hash2(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn hash3(p: vec3f) -> f32 { return fract(sin(dot(p, vec3f(127.1, 311.7, 74.7))) * 43758.5453); }
fn vnoise(p: vec2f) -> f32 { let i = floor(p); let f = fract(p); let w = f*f*(3.0-2.0*f);
  return mix(mix(hash2(i), hash2(i+vec2f(1,0)), w.x), mix(hash2(i+vec2f(0,1)), hash2(i+vec2f(1,1)), w.x), w.y); }
fn pathX(z: f32) -> f32 { return 6.0 + 9.0 * sin(z * 0.021) + 4.0 * sin(z * 0.053 + 1.3); }        // v443 dirt path centre line
fn pathD(p: vec2f) -> f32 { return abs(p.x - pathX(p.y)) * 0.93; }
fn pathW(p: vec2f) -> f32 { let pd = pathD(p) + (vnoise(p * 1.3) - 0.5) * 0.45 + (vnoise(p * 5.0) - 0.5) * 0.18; return 1.0 - smoothstep(0.45, 1.35, pd); }  // v444p dirt weight, noisy edge
fn terrH(p: vec2f) -> f32 { // v443 gentle relief (same formula in JS)
  let h = 0.75 * sin(p.x * 0.051 + p.y * 0.023) + 0.55 * sin(-p.x * 0.031 + p.y * 0.067 + 1.7) + 0.22 * sin(p.x * 0.13 + p.y * 0.11 + 0.4) + 0.12 * sin(-p.x * 0.19 + p.y * 0.23 + 2.1);
  return h * smoothstep(3.0, 18.0, length(p)) - 0.10 * (1.0 - smoothstep(0.6, 1.6, pathD(p))); }
fn terrN(p: vec2f) -> vec3f { let e = 0.35; return normalize(vec3f(terrH(p - vec2f(e, 0)) - terrH(p + vec2f(e, 0)), 2.0 * e, terrH(p - vec2f(0, e)) - terrH(p + vec2f(0, e)))); }
fn segD(p: vec2f, a: vec2f, b: vec2f) -> f32 { let pa = p - a; let ba = b - a; let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
fn lmk(p: vec2f) -> vec4f { // world-locked ground landmarks: rgb tint mul, a = grass height mul (0 = rock)
  var tint = vec3f(1.0); var hm = 1.0;
  let dp = smoothstep(0.55, 0.70, vnoise(p / 9.0 + 3.3));                      // darker lush patches
  tint *= mix(vec3f(1.0), vec3f(0.55, 0.66, 0.58), dp); hm *= mix(1.0, 1.2, dp);
  let q = (p.x * 0.8 + p.y * 0.6 + 7.0 * sin(p.y * 0.031 + p.x * 0.012));       // mowed paths with stripes
  let pd = abs(fract(q / 31.0) - 0.5) * 31.0; let mw = 1.0 - smoothstep(1.1, 1.6, pd);
  let stripe = step(0.5, fract(q / 0.9));
  tint *= mix(vec3f(1.0), mix(vec3f(1.25, 1.18, 0.80), vec3f(1.05, 1.08, 0.75), stripe), mw); hm *= mix(1.0, 0.30, mw);
  { let dm = pathW(p); if (dm > 0.0) {                                           // v444p soft dirt edge: grass thins into tufts
      let tuft = smoothstep(0.35, 0.75, (1.0 - dm) * 1.15 + (vnoise(p * 4.3) - 0.5) * 0.9 + (vnoise(p * 13.0) - 0.5) * 0.35);
      hm *= tuft; tint *= mix(vec3f(1.0), vec3f(1.10, 1.02, 0.78), dm);
      if (hm < 0.02) { return vec4f(tint, -1.0); } } }
  let rc = floor(p / 9.0); let RQ = rockAt(rc);                            // rocks (v440: data table shared with collision)
  if (RQ.x >= 0.0) { let cpos = (rc + RQ.xy) * 9.0;
    let rad = RQ.z; let rv = p - cpos; let rd = length(rv * vec2f(1.0, 1.35)) / rad * (1.0 + 0.30 * (vnoise(normalize(rv + vec2f(1e-4)) * 2.2 + rc) - 0.5));
    if (rd < 1.0) { let sh = (0.45 + 0.55 * sqrt(1.0 - rd * rd)) * (0.75 + 0.35 * dot(normalize(rv + vec2f(1e-4)), -u.sun.xz) * rd) + 0.30 * (vnoise(p * 7.0) - 0.5) + 0.15 * (vnoise(p * 23.0) - 0.5);
      return vec4f(vec3f(0.13, 0.15, 0.08) * (0.45 + 0.55 * rd) + 0.0 * sh, -1.0); }  // contact shade under the 3D rock
    if (rd < 1.30) { hm *= 1.25; tint *= 0.7; } }
  return vec4f(tint, hm);
}
fn flowerC(p: vec2f) -> f32 { let c = floor(p / 5.0); if (hash2(c + 8.8) > 0.30) { return 0.0; }
  let cp = (c + vec2f(0.3 + 0.4 * hash2(c + 1.1), 0.3 + 0.4 * hash2(c + 2.2))) * 5.0;
  return 1.0 - smoothstep(0.5, 1.0, length(p - cp) / (1.0 + 0.7 * hash2(c + 3.3))); }
fn flowerCol(p: vec2f) -> vec3f { let k = hash2(floor(p / 5.0) + 6.6);
  return select(select(vec3f(1.0, 0.85, 0.15), vec3f(0.98, 0.97, 0.92), k > 0.4), vec3f(0.75, 0.35, 0.90), k > 0.75); }
// v442 cascaded sun shadow map: 2 cascades side by side in a 2048x1024 depth atlas, 4-tap PCF
var<private> csmSkip: bool = false;
fn csmTap(M: mat4x4f, ci: f32, bias: f32, w: vec3f, four: bool) -> f32 {
  let q = M * vec4f(w, 1.0); let uv = vec2f((q.x * 0.5 + 0.5 + ci) * 0.5, 0.5 - q.y * 0.5); let z = q.z - bias;
  if (!four) { return textureSampleCompareLevel(smap, scmp, uv, z); }
  let tx = vec2f(0.8 / 2048.0, 0.8 / 1024.0);
  return 0.25 * (textureSampleCompareLevel(smap, scmp, uv + vec2f(-tx.x, -tx.y), z) + textureSampleCompareLevel(smap, scmp, uv + vec2f(tx.x, -tx.y), z)
        + textureSampleCompareLevel(smap, scmp, uv + vec2f(-tx.x, tx.y), z) + textureSampleCompareLevel(smap, scmp, uv + vec2f(tx.x, tx.y), z)); }
fn csm(w: vec3f) -> f32 {   // v442: 2 cascades, 4-tap PCF near, 1 tap (hw 2x2 compare) far, blended seam
  if (u.misc.w > 0.5 || csmSkip) { return 1.0; }
  let q0 = u.c0 * vec4f(w, 1.0); let e0 = max(abs(q0.x), abs(q0.y));
  let q1 = u.c1 * vec4f(w, 1.0); let e1 = max(abs(q1.x), abs(q1.y));
  var s1 = 1.0; if (e1 < 0.99) { s1 = mix(1.0, csmTap(u.c1, 1.0, 0.00045, w, false), smoothstep(0.99, 0.85, e1)); }
  if (e0 >= 0.95) { return s1; }
  let s0 = csmTap(u.c0, 0.0, 0.00010, w, true);
  return mix(s0, s1, smoothstep(0.75, 0.95, e0)); }
fn shadowW(w: vec3f) -> f32 { return min(boltSh(w), mix(0.30, 1.0, csm(w))); }
fn boltA(f: u32, uv: vec2f) -> f32 { if (any(uv < vec2f(0.0)) || any(uv > vec2f(1.0))) { return 0.0; }
  let g = vec2f(f32(f % 8u), f32(f / 8u)); return textureSampleLevel(atex, samp, (g + clamp(uv, vec2f(0.003), vec2f(0.997))) / vec2f(8.0, 4.0), 0.0).a; }
fn boltSh(w: vec3f) -> f32 { // v445: the drawn Bolt sprite (same gallop frame, same card + bank) projected along the sun => shadow matches Bolt
  let b = u.bolt.xyz;
  if (length(w.xz - b.xz) > 5.0 || w.y - b.y > 1.6) { return 1.0; }
  let toE = normalize(u.sun.xz + vec2f(1e-4)); let nrm = vec3f(toE.x, 0.0, toE.y); let rt = vec3f(-toE.y, 0.0, toE.x);   // caster card turned to face the sun => full silhouette, never edge-on
  let L = u.sun.xyz;
  let tt = dot(b + nrm * 0.02 - w, nrm) / dot(L, nrm); if (tt <= 0.0) { return 1.0; }
  let r = w + L * tt - b; let rx = dot(r, rt); let ry = r.y;
  let cr = cos(u.bp.x); let sr = -sin(u.bp.x); let lx = rx * cr + ry * sr; let ly = -rx * sr + ry * cr;   // undo the bank
  let uv = vec2f(-lx / 0.395092 + 0.5, 1.0 - ((ly + 0.035) / 1.15 + 0.0092025));
  let ff = u.bp.w; let fa = u32(floor(ff)) % 32u; let fb = (fa + 1u) % 32u; let k = fract(ff);
  let pen = (0.006 + 0.022 * clamp(tt, 0.0, 1.5)) * vec2f(1.0 / 0.395092, 1.0 / 1.15);   // penumbra grows with distance to the caster
  var a = 0.0;
  for (var j = 0; j < 5; j++) { let o = select(vec2f(0.0), vec2f(cos(f32(j) * 1.5708), sin(f32(j) * 1.5708)) * pen, j > 0);
    a += mix(boltA(fa, uv + o), boltA(fb, uv + o), k) * select(0.15, 0.40, j == 0); }
  a = smoothstep(0.10, 0.85, a);
  let con = smoothstep(0.0, 0.32, length(w.xz - b.xz));   // tiny contact darkening under the paws
  if (u.b8.w > 0.5) { // v447: soft contact shadow, an ellipse along the gallop (paws spread fore/aft)
    let fw = vec2f(-sin(u.bolt.w), -cos(u.bolt.w)); let d = w.xz - b.xz; let e = vec2f(dot(d, fw) / 0.62, dot(d, vec2f(-fw.y, fw.x)) / 0.24);
    let c2 = smoothstep(0.0, 1.0, length(e)); return mix(1.0, 0.30, a) * mix(0.58, 1.0, c2) * mix(0.80, 1.0, con); }
  return mix(1.0, 0.30, a) * mix(0.72, 1.0, con);
}
fn rutH(p: vec2f) -> f32 { // v445 wheel ruts: real depressed grooves with raised lips (metres)
  let sx = p.x - pathX(p.y); let wob = (vnoise(vec2f(p.y * 0.35, 1.7)) - 0.5) * 0.10;
  let a = sx - 0.36 + wob; let b = sx + 0.36 + wob;
  let g = exp(-pow(a / 0.085, 2.0)) + exp(-pow(b / 0.085, 2.0));
  let lip = exp(-pow((abs(a) - 0.155) / 0.045, 2.0)) + exp(-pow((abs(b) - 0.155) / 0.045, 2.0));
  let tread = 0.5 + 0.5 * sin(p.y * 41.0 + vnoise(p * 3.0) * 2.0);
  return -0.058 * g * (0.88 + 0.12 * tread) + 0.016 * lip * (0.7 + 0.6 * vnoise(p * 2.3)); }
fn pH(q: vec2f, dm: f32) -> f32 { return (rutH(q) + (textureSampleLevel(tDirt, samp, q * 0.42, 1.5).g - 0.45) * 0.035) * dm; }
fn printsAt(p: vec2f) -> vec3f { // v445 paw print depth (0..1) at p, p+x, p+z
  var d = vec3f(0.0); let e = 0.008;
  for (var i = 0u; i < 96u; i++) { let P = prints[i]; let age = u.cam.w - P.w; if (age < 0.0 || age > 10.0) { continue; }
    let q0 = p - P.xy; if (dot(q0, q0) > 0.012) { continue; }
    let fw = vec2f(-sin(P.z), -cos(P.z)); let rt = vec2f(-fw.y, fw.x); let fade = 1.0 - smoothstep(5.5, 10.0, age);
    for (var j = 0; j < 3; j++) { let q = q0 + select(select(vec2f(0.0, e), vec2f(e, 0.0), j == 1), vec2f(0.0), j == 0);
      let l = vec2f(dot(q, rt), dot(q, fw)) / 1.3;
      var s = 1.0 - smoothstep(0.65, 1.0, length((l - vec2f(0.0, -0.010)) / vec2f(0.027, 0.023)));
      s = max(s, 1.0 - smoothstep(0.55, 1.0, length(l - vec2f(-0.027, 0.020)) / 0.0105));
      s = max(s, 1.0 - smoothstep(0.55, 1.0, length(l - vec2f(-0.010, 0.032)) / 0.0110));
      s = max(s, 1.0 - smoothstep(0.55, 1.0, length(l - vec2f(0.010, 0.032)) / 0.0110));
      s = max(s, 1.0 - smoothstep(0.55, 1.0, length(l - vec2f(0.027, 0.020)) / 0.0105));
      d[j] = max(d[j], s * fade); } }
  return d; }
fn groundAlbedo(p: vec2f) -> vec3f { // two rotated scales + macro tint => no visible tiling
  let r = mat2x2f(0.8, -0.6, 0.6, 0.8);
  let a = textureSample(gtex, samp, p / 7.3).rgb;
  let b = textureSample(gtex, samp, (r * p) / 19.1 + vec2f(0.37, 0.71)).rgb;
  let m = vnoise(p / 31.0) * 0.6 + vnoise(p / 9.0) * 0.4;
  var c = mix(a, b, 0.42);
  c *= mix(0.82, 1.12, m);
  c = mix(c, c * vec3f(1.10, 1.02, 0.80), smoothstep(0.62, 0.9, vnoise(p / 47.0 + 3.1)) * 0.5);
  return c;
}
fn groundAlbedoV(p: vec2f) -> vec3f { // two rotated scales + macro tint => no visible tiling
  let r = mat2x2f(0.8, -0.6, 0.6, 0.8);
  let a = textureSampleLevel(gtex, samp, p / 7.3, 5.0).rgb;
  let b = textureSampleLevel(gtex, samp, (r * p) / 19.1 + vec2f(0.37, 0.71), 5.0).rgb;
  let m = vnoise(p / 31.0) * 0.6 + vnoise(p / 9.0) * 0.4;
  var c = mix(a, b, 0.42);
  c *= mix(0.82, 1.12, m);
  c = mix(c, c * vec3f(1.10, 1.02, 0.80), smoothstep(0.62, 0.9, vnoise(p / 47.0 + 3.1)) * 0.5);
  return c;
}
fn fogMix(c: vec3f, dist: f32) -> vec3f { let f = 1.0 - exp(-dist * 0.0065); return mix(c, HAZE, clamp(f, 0.0, 1.0) * 0.75); }
fn tonemap(c: vec3f) -> vec4f { let x = c * 1.05; let t = (x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14); return vec4f(pow(clamp(t, vec3f(0), vec3f(1)), vec3f(1.0/2.2)), 1.0); }
`;
const SKY = COMMON + /* wgsl */`
struct VO { @builtin(position) p: vec4f, @location(0) ndc: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO { var q = array<vec2f,3>(vec2f(-1,-1), vec2f(3,-1), vec2f(-1,3)); var o: VO; o.p = vec4f(q[i], 1.0, 1.0); o.ndc = q[i]; return o; }
@fragment fn fs(v: VO) -> @location(0) vec4f {
  let h = u.ivp * vec4f(v.ndc, 1.0, 1.0); let d = normalize(h.xyz / h.w - u.cam.xyz);
  let lon = atan2(d.x, -d.z); let lat = asin(clamp(d.y, -1.0, 1.0));
  let uv = vec2f(lon / (2.0*PI) + 0.5, 0.5 - lat / PI);
  var c = textureSampleLevel(stex, samp, uv, 0.0).rgb;
  if (u.misc.z > 0.5) { return vec4f(fract(uv.x), fract(uv.x*16.0), 0.0, 1.0); }
  let sd = max(dot(d, u.sun.xyz), 0.0); c += vec3f(1.0, 0.93, 0.8) * (pow(sd, 900.0) * 6.0 + pow(sd, 18.0) * 0.18);
  if (d.y > 0.01) { let pc = (u.cam.xz + d.xz / max(d.y, 0.06) * 900.0) / 1500.0 + vec2f(u.cam.w * 0.0040, u.cam.w * 0.0016);
    let fb = vnoise(pc) * 0.50 + vnoise(pc * 2.03 + 5.2) * 0.25 + vnoise(pc * 4.11 + 9.7) * 0.15 + vnoise(pc * 8.3 + vec2f(u.cam.w * 0.01, 0.0)) * 0.10;
    let cov = smoothstep(0.60, 0.82, fb) * smoothstep(0.02, 0.20, d.y);
    let cs = mix(vec3f(0.70, 0.76, 0.86), vec3f(1.00, 0.98, 0.95), smoothstep(0.52, 0.85, fb)) + vec3f(1.0, 0.92, 0.75) * pow(sd, 6.0) * 0.35;
    c = mix(c, cs, cov * 0.45); }
  c = mix(c, HOR, smoothstep(0.05, 0.0, d.y) * 0.6);
  if (d.y < 0.0) { c = HAZE; }
  // distant hills / tree line, world-locked by azimuth (periodic in lon, no seam)
  let hill = 0.050 + 0.022 * sin(lon * 3.0 + 1.3) + 0.010 * sin(lon * 7.0 + 0.4) + 0.004 * sin(lon * 17.0 + 2.2);
  let trees = hill + 0.006 * max(0.0, sin(lon * 41.0)) * (0.5 + 0.5 * sin(lon * 5.0)) + 0.004 * abs(sin(lon * 113.0)) * step(0.2, sin(lon * 9.0 + 1.0));
  let far = 0.075 + 0.030 * sin(lon * 2.0 + 4.0) + 0.012 * sin(lon * 11.0) + 0.004 * sin(lon * 29.0);
  if (d.y < far) { let fk = clamp((far - d.y) / 0.05, 0.0, 1.0); c = mix(vec3f(0.46, 0.56, 0.68), vec3f(0.34, 0.45, 0.55), fk); }
  if (d.y < trees) { let k = clamp((trees - d.y) / 0.02, 0.0, 1.0); c = mix(vec3f(0.26, 0.38, 0.30), vec3f(0.16, 0.27, 0.17), k); c = mix(c, HAZE, 0.35); }
  c = mix(c, HAZE, exp(-abs(d.y) * 30.0) * 0.45);   // soft haze band on the horizon
  return tonemap(c * 1.0);
}`;
const GROUND = COMMON + /* wgsl */`
struct VO { @builtin(position) p: vec4f, @location(0) w: vec3f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO { var q = array<vec2f,6>(vec2f(-1,-1), vec2f(1,-1), vec2f(1,1), vec2f(-1,-1), vec2f(1,1), vec2f(-1,1));
  let ci = i / 6u; let GN = 128u; let cx = f32(ci % GN); let cz = f32(ci / GN); let g = (vec2f(cx, cz) + (q[i % 6u] * 0.5 + 0.5)) / f32(GN) * 2.0 - 1.0;
  let gs = sign(g) * pow(abs(g), vec2f(2.2)) * 900.0; let cc = floor(u.cam.xz / 4.0) * 4.0;   // v443 terrain grid: dense near camera, snapped
  let xz = cc + gs; let w = vec3f(xz.x, terrH(xz), xz.y); var o: VO; o.p = u.vp * vec4f(w, 1.0); o.w = w; return o; }
@fragment fn fs(v: VO) -> @location(0) vec4f {
  let p = v.w.xz; var alb = groundAlbedo(p) * 0.78;  // under-grass soil/thatch darker
  let LM = lmk(p); if (LM.w < 0.0 && pathW(p) <= 0.0) { alb = LM.rgb * 0.62; } else { alb *= LM.rgb; }
  // v445 dirt path: parallax-occlusion ruts with lips, self-shadowed relief, paw prints, real pebble meshes (shadow/AO here)
  let dm = pathW(p); let gx = dpdx(p); let gy = dpdy(p);
  var nb = vec3f(0.0); var pAO = 1.0; var pSh = 1.0;
  if (dm > 0.0) {
    let V = normalize(u.cam.xyz - v.w); let dcam = length(u.cam.xyz - v.w); var q = p;
    let pf = 1.0 - smoothstep(12.0, 18.0, dcam);
    if (pf > 0.0) { let k = V.xz / max(V.y, 0.16) * pf; let top = 0.02; let N = 14; let dh = 0.097 / f32(N);
      var prevD = top - pH(p + k * top, dm); var prevH = top; q = p + k * (top - 0.097);
      for (var i = 1; i <= N; i++) { let h = top - dh * f32(i); let qi = p + k * h; let dd = h - pH(qi, dm);
        if (dd <= 0.0) { let f = prevD / max(prevD - dd, 1e-5); q = p + k * mix(prevH, h, f); break; } prevD = dd; prevH = h; } }
    let tuv = q * 0.42; let tuv2 = q * 0.11 + vec2f(0.37, 0.71);
    let d0 = textureSampleGrad(tDirt, samp, tuv, gx * 0.42, gy * 0.42).rgb; let d1 = textureSampleGrad(tDirt, samp, tuv2, gx * 0.11, gy * 0.11).rgb;
    var dirt = d0 * mix(0.80, 1.15, d1.g / max(dot(d1, vec3f(0.33)), 1e-3) * 0.5) * (0.85 + 0.25 * vnoise(q * 0.6));
    let ee = 0.012; let hc = pH(q, dm); var hx = pH(q + vec2f(ee, 0.0), dm); var hz = pH(q + vec2f(0.0, ee), dm);
    var pd = vec3f(0.0); if (length(q - u.bolt.xz) < 75.0 && dcam < 22.0) { pd = printsAt(q); }
    let hcp = hc - 0.022 * pd.x * dm; hx -= 0.022 * pd.y * dm; hz -= 0.022 * pd.z * dm * 1.0;
    nb = vec3f(-(hx - hcp) / ee + 0.013 * dm * (pd.y - pd.x) / 0.008 * 0.0, 0.0, -(hz - hcp) / ee) * pf * 0.35 + vec3f(-(pd.y - pd.x), 0.0, -(pd.z - pd.x)) * dm * 2.2;
    let sx = q.x - pathX(q.y); let mid = exp(-pow(sx / 0.16, 2.0)); dirt = mix(dirt, dirt * vec3f(1.08, 1.0, 0.86), 0.35 * mid);
    let rutd = clamp(-rutH(q) / 0.058, 0.0, 1.0); dirt *= mix(vec3f(1.0), vec3f(0.90, 0.86, 0.82), rutd * dm);   // packed, slightly moist groove floor
    dirt *= mix(vec3f(1.0), vec3f(0.58, 0.54, 0.50), pd.x * dm);                                                    // compressed soil in the print
    pAO = clamp(1.0 + hcp * 4.0, 0.74, 1.10);
    if (pf > 0.0) { let sd = normalize(u.sun.xz + vec2f(1e-4)); let sl = u.sun.y / max(length(u.sun.xz), 0.05);   // relief self-shadow toward the sun
      var vis = 1.0; for (var j = 1; j <= 5; j++) { let dj = 0.028 * f32(j); vis = min(vis, smoothstep(-0.004, 0.006, hcp + dj * sl - pH(q + sd * dj, dm))); }
      pSh = mix(1.0, mix(0.66, 1.0, vis), pf); }
    let pc = floor(p / 0.32);                                                                       // pebble contact shadow + AO (meshes drawn in PEB)
    if (hash2(pc + 4.7) > 0.80) { let pp = (pc + vec2f(0.25 + 0.5 * hash2(pc + 1.3), 0.25 + 0.5 * hash2(pc + 2.9))) * 0.32; let pr = 0.022 + 0.034 * hash2(pc + 7.1);
      if (pathW(pp) > 0.25) { let so = -u.sun.xz / max(u.sun.y, 0.2) * pr * 0.65;
        pSh *= mix(0.42, 1.0, smoothstep(0.55, 1.15, length(p - pp - so) / (pr * 1.05)));
        pAO *= mix(0.55, 1.0, smoothstep(0.85, 1.7, length(p - pp) / pr)); } }
    alb = mix(alb, dirt * 0.70 * mix(1.0, pAO, dm), dm);
  }
  let fcg = flowerC(p) * step(0.72, hash2(floor(p * 12.0))) * smoothstep(18.0, 24.0, length(p - u.cam.xz)); alb = mix(alb, flowerCol(p) * 0.6, fcg * 0.85);
  let sh = shadowW(v.w) * pSh;
  if (u.misc.z > 0.5) { return vec4f(sh, sh, sh, 1.0); }
  let n = normalize(terrN(p) + nb); let L = max(dot(n, u.sun.xyz), 0.0);
  var c = alb * (vec3f(1.0, 0.96, 0.88) * 2.2 * L * sh + vec3f(0.42, 0.55, 0.75) * 0.55 * mix(0.55, 1.0, sh) * pAO);
  c = fogMix(c, length(v.w - u.cam.xyz));
  return tonemap(c);
}`;
const PEB = COMMON + /* wgsl */`
@group(0) @binding(12) var tRock: texture_2d<f32>;
struct VO { @builtin(position) p: vec4f, @location(0) w: vec3f, @location(1) @interpolate(flat) tint: vec3f };
// v445 pebbles: real faceted 3D stones, same hash grid as the ground's contact shadow; 6x4 lat-long rock per cell
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  var o: VO; o.p = vec4f(2.0, 2.0, 2.0, 1.0); o.w = vec3f(0.0); o.tint = vec3f(0.0);
  let i = ii % 10u; let j = ii / 10u;
  let cz = floor((u.bolt.z + 4.0) / 0.32) - f32(j); let cx = floor(pathX(cz * 0.32 + 0.16) / 0.32) - 5.0 + f32(i); let pc = vec2f(cx, cz);
  if (hash2(pc + 4.7) <= 0.80) { return o; }
  let pp = (pc + vec2f(0.25 + 0.5 * hash2(pc + 1.3), 0.25 + 0.5 * hash2(pc + 2.9))) * 0.32; let pr = 0.022 + 0.034 * hash2(pc + 7.1);
  let dm = pathW(pp); if (dm <= 0.25 || length(pp - u.cam.xz) > 26.0) { return o; }
  let qd = vi / 6u; let cn = vi % 6u; var du = array<u32,6>(0u, 1u, 1u, 0u, 1u, 0u); var dv = array<u32,6>(0u, 0u, 1u, 0u, 1u, 1u);
  let lo = (qd % 6u + du[cn]) % 6u; let la = qd / 6u + dv[cn];
  let th = f32(lo) / 6.0 * 6.2831853 + hash2(pc + 5.5) * 6.28; let ph = f32(la) / 4.0 * PI;
  var d = vec3f(sin(ph) * cos(th), cos(ph), sin(ph) * sin(th));
  let rj = select(0.78 + 0.40 * hash2(pc * 3.1 + vec2f(f32(lo), f32(la) * 7.0)), 1.0, la == 0u || la == 4u);
  let fl = 0.45 + 0.30 * hash2(pc + 8.3); let el = 0.8 + 0.5 * hash2(pc + 6.1);
  let lp = vec3f(d.x * el, d.y * fl, d.z) * pr * rj;
  let base = vec3f(pp.x, terrH(pp) + rutH(pp) * dm - pr * fl * 0.30, pp.y);
  o.w = base + lp; o.p = u.vp * vec4f(o.w, 1.0);
  let k = hash2(pc + 9.9); o.tint = mix(vec3f(0.50, 0.45, 0.38), vec3f(0.66, 0.62, 0.56), k) * mix(vec3f(1.0), vec3f(1.06, 0.95, 0.82), step(0.6, hash2(pc + 3.7)));
  return o; }
@fragment fn fs(v: VO) -> @location(0) vec4f {
  var n = normalize(cross(dpdy(v.w), dpdx(v.w))); if (dot(n, u.cam.xyz - v.w) < 0.0) { n = -n; }
  let an = abs(n); let tw = an / (an.x + an.y + an.z); let q = v.w * 5.0;
  let r = textureSample(tRock, samp, q.zy).rgb * tw.x + textureSample(tRock, samp, q.xz).rgb * tw.y + textureSample(tRock, samp, q.xy).rgb * tw.z;
  let alb = v.tint * (0.30 + 0.55 * dot(r, vec3f(0.333)));
  let sh = shadowW(v.w + n * 0.004); let L = max(dot(n, u.sun.xyz), 0.0);
  var c = alb * (vec3f(1.0, 0.96, 0.88) * 2.2 * L * sh + vec3f(0.42, 0.55, 0.75) * 0.55 * mix(0.55, 1.0, sh) * (0.55 + 0.45 * n.y));
  c = fogMix(c, length(v.w - u.cam.xyz)); return tonemap(c * 0.72); }`;
const GRASS = COMMON + /* wgsl */`
const GR1 = 150u; const SR1 = 0.21; const GR2 = 130u; const SR2 = 0.60;
struct VO { @builtin(position) p: vec4f, @location(0) col: vec3f, @location(1) h: f32, @location(2) w: vec3f, @location(3) n: vec3f };
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  // LOD rings (v439 far grass): ring0 = original dense patch; ring1/ring2 = sparser, wider, taller blades out to ~60 m.
  let G0 = u32(u.grid.w); let N0 = G0 * G0; let N1 = GR1 * GR1;
  var G = G0; var s = u.grid.z; var j = ii; var ctr = u.grid.xy; var ring = 0u;
  let fwd = normalize(u.bolt.xz - u.cam.xz + vec2f(1e-4));
  if (ii >= N0 + N1) { ring = 2u; j = ii - N0 - N1; G = GR2; s = SR2; ctr = u.cam.xz + fwd * 40.0; }
  else if (ii >= N0) { ring = 1u; j = ii - N0; G = GR1; s = SR1; ctr = u.cam.xz + fwd * 14.0; }
  let ho = select(vec2f(0.0), vec2f(311.0, 173.0) * f32(ring), ring > 0u);       // decorrelate rings
  let cell = vec2f(f32(j % G), f32(j / G)) - f32(G) * 0.5 + round(ctr / s);    // world cell id (stable per ring)
  let r1 = hash2(cell + ho); let r2 = hash2(cell + 17.3 + ho); let r3 = hash2(cell + 41.7 + ho); let r4 = hash2(cell + 93.1 + ho);
  let root = (cell + vec2f(r1, r2)) * s;
  let dist = length(root - u.cam.xz);
  var fade = 1.0 - smoothstep(6.0, 11.5, dist);
  if (ring == 1u) { fade = smoothstep(6.0, 11.5, dist) * (1.0 - smoothstep(22.0, 28.0, dist)); }
  if (ring == 2u) { fade = smoothstep(22.0, 28.0, dist) * (1.0 - smoothstep(42.0, 60.0, dist)); }
  let behind = dot(root - u.cam.xz, fwd) < -2.0;                               // cull blades behind the camera
  let lodS = select(1.0, s / 0.07, ring > 0u);                                   // coverage scale per ring
  let patchv = vnoise(root / 3.1) * 0.6 + vnoise(root / 0.9) * 0.4;
  let LM = lmk(root);
  let hd = hash2(root * 1.37 + vec2f(f32(ring) * 9.1, 3.3)); let fadeD = clamp((fade - hd) * 6.0 + 0.5, 0.0, 1.0); /* world-hash dither handover */
  let H = (0.12 + 0.16 * r3) * mix(0.6, 1.3, patchv) * fadeD * max(LM.w, 0.0) * select(1.0, select(0.80, 0.95, ring == 1u), ring > 0u) * select(1.0, 0.0, behind);
  let W = (0.016 + 0.010 * r4) * mix(1.0, lodS, select(0.30, 0.42, ring == 1u));
  // 7-point blade: 3 pairs + tip, 5 triangles
  var tri = array<u32,15>(0u,1u,2u, 2u,1u,3u, 2u,3u,4u, 4u,3u,5u, 4u,5u,6u);
  var far3 = array<u32,3>(0u,1u,6u); let k = select(tri[vi], far3[min(vi, 2u)], ring > 0u);  /* far rings: 1-triangle blades */ let lvl = f32(k / 2u) / 3.0; let side = select(-1.0, 1.0, (k % 2u) == 1u);
  let t = select(lvl, 1.0, k == 6u); let sd = select(side, 0.0, k == 6u);
  let ang = r1 * 6.2831; let dir = vec2f(cos(ang), sin(ang)); let perp = vec2f(-dir.y, dir.x);
  let wt = u.cam.w; let wj = hash2(root * 2.7 + 1.9) * 6.28; /* irregular gusts: noise octaves scrolled in different directions + per-blade phase */
  let wind = (vnoise(root * 0.11 + vec2f(wt * 0.23, wt * 0.07)) - 0.5) * 0.9 + (vnoise(root * 0.37 + vec2f(-wt * 0.11, wt * 0.31)) - 0.5) * 0.5 + sin(wt * 2.3 + wj) * 0.08;
  let bend = (0.25 + 0.35 * r2) + wind * 0.25;
  // brush aside near Bolt
  // v443 interactive grass: blades bend away from Bolt and his recent trail, recovering behind him
  let bd = root - u.bolt.xz; let bl = length(bd); let b1 = root - u.tr.xy; let b2 = root - u.tr.zw;
  let p0 = exp(-bl * bl * 4.0) * 1.0; let p1 = exp(-dot(b1, b1) * 5.0) * 0.55; let p2 = exp(-dot(b2, b2) * 6.0) * 0.22;
  let pv = normalize(bd + vec2f(1e-4)) * p0 + normalize(b1 + vec2f(1e-4)) * p1 + normalize(b2 + vec2f(1e-4)) * p2; let push = min(length(pv), 1.0);
  let off2 = dir * bend * t * t * H * (1.0 - 0.6 * push) + pv * 0.85 * t * H;
  let wpos = vec3f(root.x + perp.x * W * sd * (1.0 - t) + off2.x, terrH(root) + H * t * (1.0 - 0.45 * push), root.y + perp.y * W * sd * (1.0 - t) + off2.y);
  var o: VO; o.p = u.vp * vec4f(wpos, 1.0);
  let gc = groundAlbedoV(root);
  o.col = mix(gc * 0.55, gc * 1.35 + vec3f(0.03, 0.05, 0.0), t) * mix(0.85, 1.15, r4);
  let fl = smoothstep(0.78, 0.86, vnoise(root / 2.3 + 7.7)) * step(0.55, r2);
  let fc = select(select(vec3f(0.95, 0.93, 0.85), vec3f(0.95, 0.80, 0.20), r3 > 0.5), vec3f(0.62, 0.45, 0.85), r4 > 0.7);
  o.col *= select(LM.rgb, vec3f(1.0), LM.w < 0.0);
  o.col = mix(o.col, fc, fl * smoothstep(0.75, 0.95, t) * select(1.0, 0.0, ring > 0u));
  let fcl = flowerC(root) * step(0.15, r2);
  o.col = mix(o.col, flowerCol(root) * mix(0.85, 1.1, r4), fcl * smoothstep(0.70, 0.90, t) * select(0.25, 0.0, ring > 0u));
  o.h = t; o.w = wpos; o.n = normalize(vec3f(dir.x * 0.6, 1.0, dir.y * 0.6));
  return o;
}
@fragment fn fs(v: VO) -> @location(0) vec4f {
  let sh = shadowW(v.w); let sh2 = mix(sh, 1.0, v.h * 0.05);
  let L = clamp(dot(v.n, u.sun.xyz) * 0.6 + 0.45, 0.0, 1.0);
  let ao = mix(0.45, 1.0, v.h);
  var c = v.col * (vec3f(1.0, 0.96, 0.86) * 2.1 * L * sh2 + vec3f(0.40, 0.55, 0.75) * 0.5 * mix(0.50, 1.0, sh2)) * ao;
  let V = normalize(u.cam.xyz - v.w); c += vec3f(0.55, 0.7, 0.2) * pow(max(dot(-V, u.sun.xyz), 0.0), 4.0) * v.h * 0.35; // translucency
  c = fogMix(c, length(v.w - u.cam.xyz));
  return tonemap(c);
}`;


const PROPS = COMMON + /* wgsl */`
@group(0) @binding(8) var<storage, read> trees: array<vec4f>;
struct VO { @builtin(position) p: vec4f, @location(0) col: vec3f, @location(1) w: vec3f, @location(2) n: vec3f, @location(3) k: vec2f, @location(4) @interpolate(flat) mt: u32, @location(5) x4: vec4f };
@group(0) @binding(14) var tClu: texture_2d<f32>;
@group(0) @binding(10) var tBark: texture_2d<f32>;
@group(0) @binding(11) var tLeaf: texture_2d<f32>;
@group(0) @binding(12) var tRock: texture_2d<f32>;
@group(0) @binding(13) var tMoss: texture_2d<f32>;
const OFF = vec4f(0.0, 0.0, -2.0, 1.0);
fn sph(q: u32, R: u32, S: u32) -> vec3f { // lat-long unit sphere, 6 verts per quad
  var du = array<u32,6>(0u,1u,1u,0u,1u,0u); var dv = array<u32,6>(0u,0u,1u,0u,1u,1u);
  let quad = q / 6u; let c = q % 6u; let i = quad % S + du[c]; let j = quad / S + dv[c];
  let th = f32(i) / f32(S) * 6.2831853; let ph = f32(j) / f32(R) * PI;
  return vec3f(sin(ph) * cos(th), cos(ph), sin(ph) * sin(th)); }
fn fwdv() -> vec2f { return normalize(u.bolt.xz - u.cam.xz + vec2f(1e-4)); }
fn lit(v: VO, nf: vec3f, rough: f32) -> vec3f {
  let sh = shadowW(v.w);
  let L = max(dot(nf, u.sun.xyz), 0.0) * mix(1.0, 0.85, rough) + 0.12;
  let amb = vec3f(0.42, 0.55, 0.75) * (0.45 + 0.35 * nf.y);
  return v.col * (vec3f(1.0, 0.96, 0.86) * 2.0 * L * sh + amb * mix(0.55, 1.0, sh)) * v.k.x; }
// ---- rocks: same 9 m cells / spots as lmk(), noise-displaced low-poly spheres
@vertex fn vs_rock(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  var o: VO; o.p = OFF; o.col = vec3f(0); o.w = vec3f(0); o.n = vec3f(0, 1, 0); o.k = vec2f(1, 1);
  let RG = 12u; let ctr = u.cam.xz + fwdv() * 40.0;
  let rc = vec2f(f32(ii % RG), f32(ii / RG)) - f32(RG) * 0.5 + floor(ctr / 9.0);
  let RQ = rockAt(rc); if (RQ.x < 0.0) { return o; }
  let cpos = (rc + RQ.xy) * 9.0;
  if (dot(cpos - u.cam.xz, fwdv()) < -3.0) { return o; }
  let rad = RQ.z;
  let d = sph(vi, 6u, 10u); let dn = normalize(d.xz + vec2f(1e-4));
  let rimN = 1.0 + 0.30 * (vnoise(dn * 2.2 + rc) - 0.5);                     // matches the lmk outline
  let bump = 1.0 + 0.26 * (vnoise(d.xy * 3.1 + rc * 1.3) - 0.5) + 0.16 * (vnoise(d.zy * 6.3 + rc) - 0.5) + 0.08 * (vnoise(d.xz * 13.0 + rc) - 0.5);
  let ht = rad * (0.30 + 0.45 * hash2(rc + 7.3));
  let lp = vec3f(d.x * rad / rimN * 0.95, max(d.y, -0.3) * ht, d.z * rad / 1.35 / rimN * 0.95) * bump;
  let a = hash2(rc + 9.1) * 0.5 - 0.25; let ca = cos(a); let sa = sin(a);      // small yaw jitter
  let w = vec3f(cpos.x + lp.x * ca - lp.z * sa, terrH(cpos) + lp.y - ht * 0.32, /* v440: rocks stay put (Bolt collides instead of rocks sinking) */ cpos.y + lp.x * sa + lp.z * ca);
  o.p = u.vp * vec4f(w, 1.0); o.w = w;
  let g = vnoise(w.xz * 3.0 + 11.0);
  let gt = groundAlbedoV(w.xz); let rn = vnoise(w.xz * 9.0 + w.y * 7.0) * 0.6 + vnoise(w.xz * 31.0) * 0.4;
  let moss = smoothstep(0.35, 0.75, d.y + 0.25 * (vnoise(w.xz * 5.0) - 0.5));
  o.col = mix(vec3f(0.10, 0.095, 0.085), gt * 0.30, 0.30) * mix(0.50, 1.20, rn);
  o.col = mix(o.col, vec3f(0.06, 0.10, 0.03) * mix(0.7, 1.2, rn), moss * 0.75);
  o.k = vec2f(mix(0.45, 1.0, smoothstep(-0.10, 0.35, w.y / max(ht, 0.01))), 1.0);   // contact darkening at the base
  o.mt = 1u; o.n = vec3f(moss, 0.0, 0.0);
  return o; }
// ---- 3D flowers: stem + 5-petal head, world-locked inside flowerC clumps
@vertex fn vs_flower(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  var o: VO; o.p = OFF; o.col = vec3f(0); o.w = vec3f(0); o.n = vec3f(0, 1, 0); o.k = vec2f(1, 0); o.mt = 0u;
  let FG = 70u; let s = 0.48; let ctr = u.cam.xz + fwdv() * 15.0;
  let cell = vec2f(f32(ii % FG), f32(ii / FG)) - f32(FG) * 0.5 + round(ctr / s);
  let r1 = hash2(cell + 3.3); let r2 = hash2(cell + 8.1); let r3 = hash2(cell + 2.7);
  let root = (cell + vec2f(r1, r2)) * s;
  let fc = flowerC(root); if (fc < 0.35 || r3 > 0.55) { return o; }
  if (lmk(root).w <= 0.0) { return o; }
  let dist = length(root - u.cam.xz); if (dot(root - u.cam.xz, fwdv()) < -1.0) { return o; }
  let sc = 1.0 - smoothstep(16.0, 22.0, dist); if (sc <= 0.0) { return o; }
  let H = (0.22 + 0.16 * r1) * sc; let sw = 0.006 + 0.004 * smoothstep(4.0, 20.0, dist);
  let side = normalize(vec2f(-(u.cam.z - root.y), u.cam.x - root.x) + vec2f(1e-4));
  let lean = (vec2f(r2, r3) - 0.5) * 0.10 + vec2f(sin(u.cam.w * 1.7 + root.x * 0.35), 0.0) * 0.03;
  let gy = terrH(root); let top = vec3f(root.x + lean.x * H, gy + H, root.y + lean.y * H);
  var w: vec3f;
  if (vi < 6u) { var qx = array<f32,6>(-1.0, 1.0, 1.0, -1.0, 1.0, -1.0); var qy = array<f32,6>(0.0, 0.0, 1.0, 0.0, 1.0, 1.0);
    let y = qy[vi]; w = mix(vec3f(root.x, gy, root.y), top, y) + vec3f(side.x, 0.0, side.y) * qx[vi] * sw * (1.0 - 0.5 * y);
    o.col = vec3f(0.10, 0.22, 0.05); o.n = normalize(vec3f(side.y, 0.4, -side.x)); o.k = vec2f(mix(0.5, 1.0, y), 0.0); }
  else { let pi = (vi - 6u) / 3u; let c = (vi - 6u) % 3u; let pr = (0.045 + 0.025 * r2) * max(sc, 0.4) * (1.0 + 0.6 * smoothstep(5.0, 20.0, dist));
    let a0 = f32(pi) * 1.2566 + r1 * 6.28; let aa = a0 + select(-0.34, 0.34, c == 2u);
    w = select(top + vec3f(cos(aa) * pr, 0.010 - 0.012 * pr / 0.05, sin(aa) * pr), top + vec3f(0.0, 0.006, 0.0), c == 0u);
    o.col = select(flowerCol(root), vec3f(0.95, 0.80, 0.25), c == 0u && pi == 0u) ; o.n = vec3f(0.0, 1.0, 0.0); o.k = vec2f(1.0, 0.0); }
  o.p = u.vp * vec4f(w, 1.0); o.w = w; return o; }
// ---- v440 3D trees: trunk -> 6 branches -> 18 twigs (seeded per tree), leaf-cluster cards at twig ends, 2-layer drifting wind
struct Seg { a: vec3f, b: vec3f, r0: f32, r1: f32 };
fn hs(sd: f32, k: f32) -> f32 { return hash2(vec2f(sd * 91.7 + k * 1.37, k * 0.711 + sd * 3.1)); }
fn rotY(v: vec3f, a: f32) -> vec3f { let c = cos(a); let s = sin(a); return vec3f(v.x * c - v.z * s, v.y, v.x * s + v.z * c); }
fn tTop(sd: f32, con: bool) -> vec3f { return vec3f((hs(sd, 1.0) - 0.5) * 0.10, select(0.70, 0.98, con), (hs(sd, 2.0) - 0.5) * 0.10); }
fn brSeg(sd: f32, i: u32, con: bool) -> Seg { let fi = f32(i); var s: Seg;
  let tt = select(0.25 + 0.075 * fi, 0.26 + 0.115 * fi, con); s.a = tTop(sd, con) * tt;
  let az = fi * 2.39996 + sd * 6.2831 + (hs(sd, 10.0 + fi) - 0.5) * 0.7;
  let el = select(0.30 + 0.45 * hs(sd, 20.0 + fi) + 0.05 * fi, -0.22 + 0.15 * hs(sd, 20.0 + fi), con);
  let L = select((0.50 - 0.035 * fi) * (0.8 + 0.4 * hs(sd, 30.0 + fi)), (0.36 - 0.05 * fi) * (0.85 + 0.3 * hs(sd, 30.0 + fi)), con);
  s.b = s.a + rotY(vec3f(cos(el), sin(el), 0.0), az) * L; s.r0 = select(0.026 - 0.0022 * fi, 0.009 - 0.001 * fi, con); s.r1 = 0.004; return s; }
fn twSeg(sd: f32, j: u32, con: bool) -> Seg { let br = brSeg(sd, j / 3u, con); let k = f32(j % 3u); var s: Seg;
  s.a = mix(br.a, br.b, 0.40 + 0.28 * k); let bd = normalize(br.b - br.a);
  let side = select(-1.0, 1.0, ((j + u32(sd * 7.0)) % 2u) == 0u) * (0.55 + 0.5 * hs(sd, 40.0 + f32(j))) * select(1.0, 0.25, k > 1.5);
  let d = normalize(rotY(bd, side) + vec3f(0.0, select(0.55, 0.10, con), 0.0));
  s.b = s.a + d * length(br.b - br.a) * select(0.55, 0.42, con) * (1.0 - 0.15 * k); s.r0 = 0.004; s.r1 = 0.0015; return s; }
fn tSeg(sd: f32, i: u32, con: bool) -> Seg { if (i == 0u) { var s: Seg; s.a = vec3f(0.0); s.b = tTop(sd, con); s.r0 = select(0.050, 0.036, con); s.r1 = select(0.018, 0.008, con); return s; }
  if (i < 7u) { return brSeg(sd, i - 1u, con); } return twSeg(sd, i - 7u, con); }
fn treeWind(tp: vec2f) -> vec2f { let wt = u.cam.w;
  let w = (vnoise(tp * 0.11 + vec2f(wt * 0.23, wt * 0.07)) - 0.5) * 0.9 + (vnoise(tp * 0.37 + vec2f(-wt * 0.11, wt * 0.31)) - 0.5) * 0.5;
  return vec2f(0.8, 0.6) * (0.35 + w) + vec2f(-0.6, 0.8) * (0.25 * sin(wt * 1.3 + tp.x * 0.2)); }
fn treeV(vi0: u32, ii: u32, mid: bool) -> VO {
  var vi = vi0; if (mid) { if (vi0 >= 210u) { let q = vi0 - 210u; let cl0 = q / 12u; vi = 750u + select(54u + cl0 - 18u, cl0, cl0 < 18u) * 12u + q % 6u; } }  // v442 LOD: far = exact subset of near (trunk+limbs, 22 camera-facing clusters)
  var o: VO; o.p = OFF; o.col = vec3f(0); o.w = vec3f(0); o.n = vec3f(0, 1, 0); o.k = vec2f(1, 1); o.x4 = vec4f(0);
  let T = trees[ii]; let tp = T.xy; let H = T.z; let sd = T.w; let con = fract(sd * 7.0) > 0.88;
  let NS = 25u; var lp: vec3f; let wv = treeWind(tp); let wt = u.cam.w;
  // v441 continuous LOD: one model; twigs/leaf clusters are thinned by a stable per-element rank (shrink, never pop),
  // and the whole tree dithers out over 115-145 m while the far crown dithers in (complementary screen dither).
  let td = length(tp - u.cam.xz); let keep = 1.0 - smoothstep(40.0, 140.0, td); let dis = 0.0;   // v442: no dither; by 140 m near model == far subset exactly
  if (vi < NS * 30u) { // tapered 5-sided segment
    let si = vi / 30u; let sg = tSeg(sd, si, con); let q = vi % 30u;
    var sk = 1.0; if (si >= 7u) { let rs = hs(sd, 200.0 + f32(si)); sk = smoothstep(rs, rs + 0.12, keep * 1.12); if (sk <= 0.0) { return o; } } let quad = q / 6u; let c = q % 6u;
    var du = array<u32,6>(0u,1u,1u,0u,1u,0u); var dv = array<u32,6>(0u,0u,1u,0u,1u,1u);
    let th = f32(quad + du[c]) / 5.0 * 6.2831853; let vv = f32(dv[c]);
    let ax = normalize(sg.b - sg.a); let e1 = normalize(cross(ax, select(vec3f(0, 1, 0), vec3f(1, 0, 0), abs(ax.y) > 0.9))); let e2 = cross(ax, e1);
    let r = mix(sg.r0, sg.r1, vv) * sk; o.x4 = vec4f(0.0, 0.0, 0.0, dis);
    lp = (mix(sg.a, sg.b, vv) + (e1 * cos(th) + e2 * sin(th)) * r) * H;
    o.col = vec3f(0.22, 0.17, 0.12); o.k = vec2f(select(0.8, 0.65, vi >= 30u), 1.0); o.mt = 2u;
    o.n = vec3f(th / 6.2831853, (dot(sg.a, ax) + vv * length(sg.b - sg.a)) * H, r * H); }
  else { // leaf-cluster cards: 2 crossed quads per cluster
    let q = vi - NS * 30u; let cl = q / 12u; let qq = (q / 6u) % 2u; let c = q % 6u;
    let NC = 58u; if (cl >= NC) { return o; }
    var ctr: vec3f; var sz: f32;
    if (cl < NC - 4u) { let sgi = 7u + cl % 18u; let sg = tSeg(sd, sgi, con); let k = f32(cl / 18u);
      ctr = mix(sg.a, sg.b, 0.28 + 0.27 * k) + (vec3f(hs(sd, 40.0 + f32(cl)), hs(sd, 45.0 + f32(cl)), hs(sd, 47.0 + f32(cl))) - 0.5) * 0.11; sz = select(0.135, 0.12, con); if (cl < 18u) { sz *= mix(1.0, 1.8, 1.0 - keep); } else { let rc = hs(sd, 300.0 + f32(cl)) * 0.88 + 0.02; sz *= smoothstep(rc, rc + 0.1, keep); } }
    else { ctr = tTop(sd, con) + vec3f(hs(sd, 50.0 + f32(cl)) - 0.5, -0.25, hs(sd, 60.0 + f32(cl)) - 0.5) * select(0.34, 0.16, con); sz = select(0.15, 0.10, con) * mix(1.0, 1.6, 1.0 - keep); }
    if (qq == 1u) { sz *= smoothstep(0.55, 0.9, keep); } else { sz *= mix(1.0, 1.15, smoothstep(0.9, 0.55, keep)); }   // crossed quad fades out by 140 m => far LO = facing quads only
    if (sz <= 0.0) { return o; } let cs = f32(cl) + sd * 13.0; sz *= (0.8 + 0.45 * hs(sd, 70.0 + f32(cl))) * select(1.0, 0.75, con);
    var qx = array<f32,6>(-1.0, 1.0, 1.0, -1.0, 1.0, -1.0); var qy = array<f32,6>(-1.0, -1.0, 1.0, -1.0, 1.0, 1.0);
    let cxy = vec2f(qx[c], qy[c]);
    let wc = vec3f(tp.x, 0.0, tp.y) + ctr * H; let toC = normalize(wc - u.cam.xyz);
    var rx: vec3f; var ry: vec3f;
    if (qq == 0u) { rx = normalize(cross(toC, vec3f(0, 1, 0))); ry = cross(rx, toC); }   // camera-facing card
    else { let a = cs * 2.7; rx = vec3f(cos(a), 0.0, sin(a)); ry = normalize(vec3f(-sin(a) * 0.7, 0.7, cos(a) * 0.7)); }
    let ra = cs * 1.9; let rc = vec2f(cxy.x * cos(ra) - cxy.y * sin(ra), cxy.x * sin(ra) + cxy.y * cos(ra));  // spin the card texture
    lp = ctr * H + (rx * rc.x + ry * rc.y) * sz * H;
    lp += vec3f(sin(wt * 3.1 + cs * 5.0), 0.5 * sin(wt * 2.3 + cs), cos(wt * 2.7 + cs * 3.0)) * 0.006 * H * (1.0 + length(wv)); // leaf flutter
    let cc = select(vec3f(0.0, 0.60, 0.0), vec3f(0.0, 0.58, 0.0), con);
    let nrm = normalize(ctr - cc + vec3f(0.0, 0.25, 0.0));
    o.n = nrm; o.x4 = vec4f(cxy + 1.0, hs(sd, 80.0 + f32(cl)), dis); o.mt = 5u;
    let leaf = mix(groundAlbedoV(tp) * 0.30, vec3f(0.06, 0.13, 0.06), 0.70);
    o.col = mix(select(leaf, leaf * vec3f(0.8, 0.85, 0.95), con), HAZE * 0.25, 0.06) * 0.68 * mix(0.75, 1.25, hs(sd, 90.0 + f32(cl))) * select(1.0, 0.62, cl < 54u && cl / 18u == 0u && !con);   // lush v442: inner clusters darker
    o.k = vec2f(mix(0.45, 1.05, clamp(dot(nrm, normalize(ctr - cc)) * 0.5 + 0.5, 0.0, 1.0)) * mix(0.7, 1.0, clamp(ctr.y * 1.3, 0.0, 1.0)), 0.0); }
  let hb = clamp(lp.y / H, 0.0, 1.2); let bend = hb * hb * 0.045 * H;   // trunk base fixed, crown sways
  lp += vec3f(wv.x * bend, -0.15 * bend * length(wv) * hb, wv.y * bend);
  let w = vec3f(tp.x + lp.x, lp.y + terrH(tp) - 0.05, tp.y + lp.z); o.p = u.vp * vec4f(w, 1.0); o.w = w; return o; }
@vertex fn vs_tree(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO { return treeV(vi, ii, false); }
@vertex fn vs_treeMid(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO { return treeV(vi, ii, true); }
@vertex fn vs_treeFar(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO { // far LOD: one low-poly crown
  var o: VO; o.mt = 4u; let T = trees[ii]; let H = T.z; let sd = T.w; let d = sph(vi, 3u, 7u); let con = fract(sd * 7.0) > 0.88;
  let nz = 1.0 + 0.45 * (vnoise(d.xz * 2.6 + sd * 31.0) - 0.5) + 0.2 * (vnoise(d.xy * 6.0 + sd * 7.0) - 0.5);
  let lp = (vec3f(0.0, 0.58, 0.0) + d * select(vec3f(0.42, 0.34, 0.42), vec3f(0.30, 0.44, 0.30), con) * nz) * H;
  let wv = treeWind(T.xy) * (lp.y / H) * (lp.y / H) * 0.045 * H; let w = vec3f(T.x + lp.x + wv.x, max(lp.y, 0.0) + terrH(T.xy) - 0.05, T.y + lp.z + wv.y); o.p = u.vp * vec4f(w, 1.0); o.w = w; o.n = vec3f(0, 1, 0); o.x4 = vec4f(0.0, 0.0, 0.0, 1.0 - smoothstep(112.0, 135.0, length(T.xy - u.cam.xz)));
  let leaf = mix(groundAlbedoV(T.xy) * 0.30, vec3f(0.06, 0.13, 0.06), 0.70); o.col = mix(select(leaf, leaf * vec3f(0.8, 0.85, 0.95), con), HAZE * 0.25, 0.12) * mix(0.8, 1.2, hash2(vec2f(sd, f32(vi / 6u))));
  o.n = normalize(d + 0.45 * (vec3f(hash2(vec2f(f32(vi), sd)), hash2(vec2f(sd, f32(vi) * 1.7)), hash2(vec2f(f32(vi) * 0.3, sd + 2.0))) - 0.5)); o.col *= 0.85;
  o.k = vec2f(mix(0.40, 1.0, d.y * 0.5 + 0.5), 0.0); o.mt = 4u; return o; }
@fragment fn fs_shadow(v: VO) { if (v.mt == 5u) { if (textureSampleLevel(tClu, samp, v.x4.xy, 0.0).a < 0.45) { discard; } } }
@fragment fn fs(v: VO) -> @location(0) vec4f {
  let fn0 = normalize(cross(dpdx(v.w), dpdy(v.w)));
  var nf = select(fn0, -fn0, dot(fn0, u.cam.xyz - v.w) < 0.0);              // faceted (flat) normal, facing camera
  nf = select(normalize(v.n), nf, v.k.y > 0.5);
  let gx = dpdx(v.w); let gy = dpdy(v.w); let bx = dpdx(v.n.xy); let by = dpdy(v.n.xy); let ux = dpdx(v.x4.xy); let uy = dpdy(v.x4.xy);
  var vv = v; let dd0 = length(v.w - u.cam.xyz);
  if (v.x4.w != 0.0) { let dn = fract(52.9829189 * fract(dot(floor(v.p.xy), vec2f(0.06711056, 0.00583715))));   // stable screen dither, near/far complementary
    if ((v.x4.w > 0.0 && dn < v.x4.w) || (v.x4.w < 0.0 && dn >= 1.0 + v.x4.w)) { discard; } }
  if (v.mt == 5u) { if (textureSampleLevel(tClu, samp, v.x4.xy, 0.0).a < 0.45) { discard; } }   // v442: early alpha test
  if (v.mt != 0u) {
    let bw = pow(abs(nf), vec3f(4.0)); let tw = bw / (bw.x + bw.y + bw.z);
    var t = vec3f(1.0); var m = vec3f(1.0);
    if (v.mt == 1u) { let q = v.w * 0.9;
      let r = textureSampleGrad(tRock, samp, q.zy, gx.zy * 0.9, gy.zy * 0.9) * tw.x + textureSampleGrad(tRock, samp, q.xz, gx.xz * 0.9, gy.xz * 0.9) * tw.y + textureSampleGrad(tRock, samp, q.xy, gx.xy * 0.9, gy.xy * 0.9) * tw.z;
      let g = textureSampleGrad(tMoss, samp, q.xz * 1.3, gx.xz * 1.17, gy.xz * 1.17).rgb;
      let mw = clamp(v.n.x * 0.8 + smoothstep(0.55, 0.95, nf.y) * 0.5, 0.0, 1.0);
      t = mix(r.rgb, g, mw); m = mix(vec3f(0.2427, 0.2421, 0.2207), vec3f(0.1044, 0.1014, 0.0193), mw); }
    else if (v.mt == 2u) { /* cylindrical: u around the trunk, v up the trunk */
      t = textureSampleGrad(tBark, samp, vec2f(v.n.x * 2.0, v.n.y * 0.45), bx * vec2f(2.0, 0.45), by * vec2f(2.0, 0.45)).rgb; m = vec3f(0.106, 0.0849, 0.0649); }
    else if (v.mt == 3u) { let q = v.w * 0.55;
      t = (textureSampleGrad(tLeaf, samp, q.zy, gx.zy * 0.55, gy.zy * 0.55) * tw.x + textureSampleGrad(tLeaf, samp, q.xz, gx.xz * 0.55, gy.xz * 0.55) * tw.y + textureSampleGrad(tLeaf, samp, q.xy, gx.xy * 0.55, gy.xy * 0.55) * tw.z).rgb; m = vec3f(0.0726, 0.1115, 0.0192); }
    else if (v.mt == 5u) { let lt = textureSampleGrad(tClu, samp, v.x4.xy, ux, uy); t = lt.rgb; m = vec3f(0.177, 0.291, 0.037); }
    else { t = textureSampleGrad(tLeaf, samp, v.w.xz * 0.12 + v.w.y * 0.07, gx.xz * 0.12 + gx.y * 0.07, gy.xz * 0.12 + gy.y * 0.07).rgb; m = vec3f(0.0726, 0.1115, 0.0192); }
    let lum = vec3f(0.2126, 0.7152, 0.0722); let det = t / max(m, vec3f(1e-3));
    let tc = t * (dot(v.col, lum) / max(dot(m, lum), 1e-4));
    let fade = select(1.0, 1.0 - 0.6 * smoothstep(60.0, 200.0, dd0), v.mt == 4u);
    vv.col = mix(v.col, mix(v.col * det, tc, 0.35), fade);
  }
  csmSkip = v.mt == 5u && dd0 > 40.0;   // leaves past 40 m: no shadow lookup
  var c = lit(vv, nf, 0.5); csmSkip = false;
  if (v.mt == 5u) { let Vd = normalize(v.w - u.cam.xyz); c += vv.col * vec3f(1.0, 0.95, 0.6) * pow(max(dot(Vd, u.sun.xyz), 0.0), 5.0) * 0.85 * v.k.x + vv.col * vec3f(0.9, 1.0, 0.45) * 0.35 * pow(max(dot(Vd, u.sun.xyz), 0.0), 2.0); } // sun through leaves (v442 brighter)
  let dd = length(v.w - u.cam.xyz); let tnear = select(1.0, mix(0.3, 1.0, smoothstep(40.0, 240.0, dd)), v.mt == 2u || v.mt == 5u); c = fogMix(c, dd * tnear); c = mix(c, HAZE, smoothstep(185.0, 225.0, dd));   // far trees melt into haze before the 225 m cut
  if (v.k.y > 0.5 && dd > 40.0) { c = mix(c, HAZE, 0.10); }
  return tonemap(c); }`;

const TREES = COMMON + /* wgsl */`
@group(0) @binding(8) var<storage, read> trees: array<vec4f>;
struct VO { @builtin(position) p: vec4f, @location(0) uv: vec2f, @location(1) w: vec3f, @location(2) sd: f32, @location(3) hh: f32 };
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  let T = trees[ii]; var q = array<vec2f,6>(vec2f(-1,0), vec2f(1,0), vec2f(1,1), vec2f(-1,0), vec2f(1,1), vec2f(-1,1));
  let c = q[vi % 6u]; let a = T.w * 6.2831 + select(0.0, 1.5708, vi >= 6u);
  let H = T.z; let Wd = H * 0.75;
  let w = vec3f(T.x + cos(a) * c.x * Wd, c.y * H, T.y + sin(a) * c.x * Wd);
  var o: VO; o.p = u.vp * vec4f(w, 1.0); o.uv = c; o.w = w; o.sd = T.w; o.hh = H; return o;
}
@fragment fn fs(v: VO) -> @location(0) vec4f {
  let x = v.uv.x; let y = v.uv.y; let con = fract(v.sd * 7.0) > 0.55;
  let n = vnoise(vec2f(x * 6.0 + v.sd * 40.0, y * 9.0)) * 0.5 + vnoise(vec2f(x * 17.0, y * 21.0 + v.sd * 13.0)) * 0.5;
  let n2 = vnoise(vec2f(x * 31.0 + v.sd * 9.0, y * 37.0)); let n3 = vnoise(vec2f(x * 70.0, y * 80.0 + v.sd * 5.0));
  let prof = select(0.55 + 0.45 * sin(y * 3.0), 1.0 - y * 0.85, con);           // broad mass vs taller spire
  let edge = prof * (0.80 + (n - 0.5) * 0.55 + (n2 - 0.5) * 0.35 + (n3 - 0.5) * 0.18);
  let crown = y > 0.10 && abs(x) < edge && y < 0.97 - (n2 - 0.5) * 0.15;
  if (!crown) { discard; }
  let nr = normalize(vec3f(x, 0.5 + (n2 - 0.5), 0.6));
  let alb = vec3f(0.08, 0.15, 0.09) * mix(0.6, 1.3, n2 * 0.6 + n3 * 0.4);
  let L = clamp(dot(nr, u.sun.xyz) * 0.5 + 0.5, 0.0, 1.0);
  var c = alb * (vec3f(1.0, 0.95, 0.85) * 1.8 * L + vec3f(0.42, 0.55, 0.75) * 0.6) * mix(0.55, 1.0, y);
  c = fogMix(c, length(v.w - u.cam.xyz)); c = mix(c, HAZE, 0.10 + 0.15 * (1.0 - y));
  return tonemap(c);
}`;
const CARD_H = 1.15, CARD_W = 1.15 * 224 / 652, CARD_FOOT = 6 / 652;
const BOLT_OLD = COMMON + /* wgsl */`
struct VO { @builtin(position) p: vec4f, @location(0) uv: vec2f, @location(1) w: vec3f };
@vertex fn vs(@builtin(vertex_index) vi: u32) -> VO {
  var q = array<vec2f,6>(vec2f(-0.5,0), vec2f(0.5,0), vec2f(0.5,1), vec2f(-0.5,0), vec2f(0.5,1), vec2f(-0.5,1));
  let c = q[vi]; let b = vec3f(u.bolt.x, u.bolt.y, u.bolt.z);
  let toE = normalize(vec2f(u.cam.x - b.x, u.cam.z - b.z)); let rt = vec3f(-toE.y, 0.0, toE.x);
  let lx = c.x * ${CARD_W}; let ly = (c.y - ${CARD_FOOT}) * ${CARD_H} - 0.035;  // paws sink into the grass
  let cr = cos(u.bp.x); let sr = -sin(u.bp.x);                      // bank INTO the turn (left turn => top tilts left), about the paws
  let rx = lx * cr - ly * sr; let ry = lx * sr + ly * cr;
  let w = b + rt * rx + vec3f(0.0, ry, 0.0) + vec3f(toE.x, 0.0, toE.y) * 0.02;
  var o: VO; o.p = u.vp * vec4f(w, 1.0); o.uv = vec2f(-c.x + 0.5, 1.0 - c.y); o.w = w; return o;
}
fn cell(f: u32, uv: vec2f) -> vec4f { let g = vec2f(f32(f % 8u), f32(f / 8u)); return textureSampleLevel(atex, samp, (g + clamp(uv, vec2f(0.003), vec2f(0.997))) / vec2f(8.0, 4.0), 0.0); }
@fragment fn fs(v: VO) -> @location(0) vec4f {
  let ff = u.bp.w; let a = u32(floor(ff)) % 32u; let bb = (a + 1u) % 32u; let k = fract(ff);
  let s = mix(cell(a, v.uv), cell(bb, v.uv), k);
  if (s.a < 0.10) { discard; }
  var c = s.rgb;                                                     // linear (srgb texture), straight alpha (v439: no un-premultiply => no dark sRGB fringe)
  let hgt = v.w.y - u.bolt.y;
  c = mix(c, vec3f(dot(c, vec3f(0.3, 0.59, 0.11))), 0.25) * 1.16; c *= vec3f(0.98, 0.99, 1.0) * mix(0.70, 1.0, smoothstep(-0.03, 0.32, hgt));    // warm meadow sun, legs pick up ground shade
  c = mix(c, c * vec3f(0.80, 1.04, 0.70) + vec3f(0.010, 0.022, 0.004), smoothstep(0.38, 0.0, hgt) * 0.55);   // ground-colour bounce
  c *= mix(0.55, 1.0, csm(v.w + vec3f(0.0, 0.15, 0.0)));   // v442: Bolt goes into tree/rock shade
  let dist = length(v.w - u.cam.xyz); c = mix(c, HAZE, clamp(1.0 - exp(-dist * 0.0065), 0.0, 1.0) * 0.75);
  return vec4f(pow(clamp(c, vec3f(0), vec3f(1)), vec3f(1.0 / 2.2)), s.a);
}`;

const BOLT_NEW = COMMON + /* wgsl */`
const BOBA = 0.05; const BOBP = 0.333; const LP = array<f32,4>(24.00000,24.00000,24.00000,17.00000); const LCW = array<f32,4>(384.00000,384.00000,384.00000,768.00000); const LCH = array<f32,4>(896.00000,896.00000,896.00000,448.00000); const LCOL = array<f32,4>(8.00000,8.00000,8.00000,4.00000); const LWM = array<f32,4>(0.50481,0.62143,0.62142,1.55054); const LHM = array<f32,4>(1.17789,1.45000,1.45000,0.90448); const LOX = array<f32,4>(0.00006,-0.01562,0.01390,0.00680);
const LSC = array<f32,4>(1.00000,1.23860,1.24540,1.12700); const LOY = array<f32,4>(0.0,-0.0430,-0.0560,0.0750);   // v447v13 per-angle on-screen size match to the straight-run view (b447/size/screen.py)
@group(0) @binding(18) var tCol: texture_2d_array<f32>;
@group(0) @binding(19) var tNor: texture_2d_array<f32>;
struct VO { @builtin(position) p: vec4f, @location(0) lm: vec2f, @location(1) w: vec3f };
fn cardWH() -> vec2f { let a = u32(u.b7.y); let b = u32(u.b7.z); return vec2f(max(LWM[a] * LSC[a], LWM[b] * LSC[b]), max(LHM[a] * LSC[a] + LOY[a], LHM[b] * LSC[b] + LOY[b])); }
@vertex fn vs(@builtin(vertex_index) vi: u32) -> VO {
  var q = array<vec2f,6>(vec2f(-0.5,0), vec2f(0.5,0), vec2f(0.5,1), vec2f(-0.5,0), vec2f(0.5,1), vec2f(-0.5,1));
  let c = q[vi]; let b = vec3f(u.bolt.x, u.bolt.y, u.bolt.z); let WH = cardWH() * vec2f(1.04, 1.10);
  let toE = normalize(vec2f(u.cam.x - b.x, u.cam.z - b.z)); let rt = vec3f(-toE.y, 0.0, toE.x);
  let lx = c.x * WH.x; let ly = c.y * WH.y - 0.035;
  let cr = cos(u.bp.x); let sr = -sin(u.bp.x);
  let rx = lx * cr - ly * sr; let ry = lx * sr + ly * cr;
  let w = b + rt * rx + vec3f(0.0, ry, 0.0) + vec3f(toE.x, 0.0, toE.y) * 0.02;
  var o: VO; o.p = u.vp * vec4f(w, 1.0); o.lm = vec2f(-lx, ly + 0.035); o.w = w; return o;   // rt points screen-left => texture u runs along -rt
}
// one layer (angle) at gallop phase: colour (straight alpha) + normal/depth, 2-frame blend
fn lUV(l: u32, f: u32, uv: vec2f) -> vec2f { let g = vec2f(f32(f % u32(LCOL[l])), f32(f / u32(LCOL[l]))); let cs = vec2f(LCW[l], LCH[l]) / vec2f(3072.0, 2688.0);
  let px = 1.5 / vec2f(LCW[l], LCH[l]); return (g + clamp(uv, px, 1.0 - px)) * cs; }
struct LS { c: vec4f, n: vec4f };
fn layerS(l: u32, lm0: vec2f, mir: f32) -> LS {
  var r: LS; r.c = vec4f(0.0); r.n = vec4f(0.5, 0.5, 1.0, 0.0);
  let lm = (lm0 - vec2f(0.0, LOY[l])) / LSC[l];
  let uv = vec2f((lm.x * mir + LOX[l]) / LWM[l] + 0.5, 1.0 - (lm.y / LHM[l] + 2.0 / LCH[l]));
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { return r; }
  let ff = fract(u.b7.x) * LP[l]; let P = u32(LP[l]); let a = u32(floor(ff)) % P; let bb = (a + 1u) % P; let k = fract(ff);
  let ua = lUV(l, a, uv); let ub = lUV(l, bb, uv);
  r.c = mix(textureSampleLevel(tCol, samp, ua, l, 0.0), textureSampleLevel(tCol, samp, ub, l, 0.0), k);
  r.n = mix(textureSampleLevel(tNor, samp, ua, l, 0.0), textureSampleLevel(tNor, samp, ub, l, 0.0), k);
  if (mir < 0.0) { r.n.x = 1.0 - r.n.x; }
  return r; }
fn both(lm: vec2f) -> LS { let la = u32(u.b7.y); let lb = u32(u.b7.z); let k = u.b7.w;
  let ma = select(1.0, -1.0, la == 3u && u.b8.x < 0.0); let mb = select(1.0, -1.0, lb == 3u && u.b8.x < 0.0);
  var A = layerS(la, lm, ma); if (k > 0.002) { let B = layerS(lb, lm, mb);
    // v3 dissolve: no 50/50 ghost; the near (high-depth) parts of the incoming view take over first, with a static fine-grain edge
    let dep = max(A.n.a, B.n.a); let gq = floor(lm * 160.0); let thr = clamp(0.15 + 0.5 * (1.0 - dep) + 0.35 * hash2(gq), 0.0, 1.0);
    let kk = smoothstep(thr - 0.10, thr + 0.10, k * 1.2 - 0.1);
    let kg = smoothstep(0.42, 0.58, k); let ov = smoothstep(0.3, 0.8, min(A.c.a, B.c.a)); let kp = mix(kg, kk, ov);   // outside the shared body: one fast silhouette swap, no union halo
    let ca = A.c.rgb * A.c.a * (1.0 - kp) + B.c.rgb * B.c.a * kp; let al = mix(A.c.a, B.c.a, kp);
    let wa = A.c.a * (1.0 - kp); let wb = B.c.a * kp; let nn = (A.n * wa + B.n * wb) / max(wa + wb, 1e-4);
    A.c = vec4f(ca / max(al, 1e-4), al); A.n = nn; }
  return A; }
@fragment fn fs(v: VO) -> FO {
  let b = u.bolt.xyz; let toE2 = normalize(vec2f(u.cam.x - b.x, u.cam.z - b.z)); let rt = vec3f(-toE2.y, 0.0, toE2.x); let toE = vec3f(toE2.x, 0.0, toE2.y);
  let cr = cos(u.bp.x); let sr = -sin(u.bp.x); let upB = vec3f(0.0, cr, 0.0) - rt * sr; let rtB = rt * cr + vec3f(0.0, sr, 0.0);
  // parallax: per-pixel depth offset from the actual view ray through this texel (camera height / lateral offset / turns)
  let V = normalize(u.cam.xyz - v.w); let vz = max(dot(V, toE), 0.25); let vxy = vec2f(-dot(V, rtB), dot(V, upB)) / vz;
  let DM = 0.16 * u.b8.y;    // body thickness (m) the depth map spans
  // v447: speed-synced suspension bob for the generated side angles (their clips float); back keeps the sprite's own bob
  let wq = select(0.0, 1.0, u32(u.b7.y) != 0u) * (1.0 - u.b7.w) + select(0.0, 1.0, u32(u.b7.z) != 0u) * u.b7.w;
  let bob = BOBA * wq * (0.5 - 0.5 * cos(6.2831853 * fract(u.b7.x + BOBP)));
  let lm0 = v.lm - vec2f(0.0, bob);
  var lm = lm0; var S = both(lm);
  for (var it = 0; it < 2; it++) { lm = lm0 - vxy * (S.n.a - 0.5) * DM; S = both(lm); }
  // soft edges into the grass: keep coverage soft, fade the paw tips into the blades
  let hgt = v.w.y - u.bolt.y;
  var al = smoothstep(0.06, 0.62, S.c.a) * mix(0.55, 1.0, smoothstep(-0.02, 0.10, hgt));
  if (al < 0.04) { discard; }
  let nc = S.n.xyz * 2.0 - 1.0; let N = normalize(-rtB * nc.x + upB * nc.y + toE * max(nc.z, 0.05));
  let h = S.n.a;
  var c = S.c.rgb;
  c = mix(c, vec3f(dot(c, vec3f(0.3, 0.59, 0.11))), 0.18) * 1.10;
  // relight: the video lighting is soft/frontal; we add sun wrap-diffuse, sky fill, fur-hollow occlusion, rim + back spec
  let L = u.sun.xyz; let sh = mix(0.55, 1.0, csm(v.w + vec3f(0.0, 0.15, 0.0)));
  let ndl = dot(N, L); let wrap = clamp((ndl + 0.35) / 1.35, 0.0, 1.0);
  let sky = mix(vec3f(0.30, 0.32, 0.26), vec3f(0.55, 0.66, 0.80), N.y * 0.5 + 0.5);
  let ao = mix(0.62, 1.0, smoothstep(0.05, 0.55, h)) * mix(0.70, 1.0, smoothstep(-0.03, 0.32, hgt));
  let lit = (vec3f(1.0, 0.95, 0.84) * 1.05 * wrap * sh + sky * 0.72) * ao;
  let litc = max(lit * 0.82, vec3f(0.80, 0.80, 0.82));   // floor: backlit coat stays the same white dog as the sprite
  c = c * mix(vec3f(1.0), litc, u.b8.z);
  let rim = pow(1.0 - max(nc.z, 0.0), 2.5) * (0.35 + 0.65 * clamp(dot(-V, L) * 0.5 + 0.6, 0.0, 1.0)) * sh;
  c += vec3f(1.0, 0.88, 0.62) * rim * 0.22 * u.b8.z;
  let H = normalize(L + V); let spec = pow(max(dot(N, H), 0.0), 28.0) * smoothstep(0.1, 0.6, N.y) * smoothstep(0.4, 0.8, h) * sh;
  c += vec3f(1.0, 0.94, 0.80) * spec * 0.18 * u.b8.z;
  c = mix(c, c * vec3f(0.80, 1.04, 0.70) + vec3f(0.010, 0.022, 0.004), smoothstep(0.38, 0.0, hgt) * 0.5);   // ground bounce
  let edge = 1.0 - smoothstep(0.35, 0.95, S.c.a);
  c = mix(c, c * 0.6 + vec3f(0.30, 0.40, 0.48) * 0.5, edge * 0.12);   // sky tint on the fur fringe
  let dist = length(v.w - u.cam.xyz); c = mix(c, HAZE, clamp(1.0 - exp(-dist * 0.0065), 0.0, 1.0) * 0.75);
  var o: FO; o.c = vec4f(pow(clamp(c, vec3f(0), vec3f(1)), vec3f(1.0 / 2.2)), al);
  let wd = v.w + toE * (h - 0.5) * DM * 1.4; let pc = u.vp * vec4f(wd, 1.0); o.d = pc.z / pc.w; return o;
}
struct FO { @location(0) c: vec4f, @builtin(frag_depth) d: f32 };
`;
const BMODE = new URLSearchParams(location.search).get('bolt') || 'v';
const BOLT0 = BMODE === 'sprite' ? BOLT_OLD : BOLT_NEW;
const BOLT = new URLSearchParams(location.search).get('bm') === '1' ? BOLT0.replace('var o: FO; o.c = vec4f(pow(clamp(c', 'var o: FO; c = vec3f(1.0, 0.0, 1.0); al = 1.0; o.c = vec4f(pow(clamp(c') : BOLT0;   // v447v10 capture-only: flat magenta Bolt for on-screen bbox measurement

const AIR = COMMON + /* wgsl */`
struct AO { @builtin(position) p: vec4f, @location(0) col: vec4f, @location(1) uv: vec2f, @location(2) @interpolate(flat) kind: u32 };
@group(0) @binding(8) var<storage, read> trees: array<vec4f>;
// soft ground shadow under near/mid trees: one blurred ellipse per tree, cast away from the sun
@vertex fn vs_tsh(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> AO {
  var o: AO; let T = trees[ii]; let H = T.z; let c = vec2f(QX[vi], QY[vi]);
  let sh = -normalize(u.sun.xz + vec2f(1e-4)) * H * 0.22; let ax = normalize(vec2f(sh.x, sh.y) + vec2f(1e-4)); let ay = vec2f(-ax.y, ax.x);
  let r = H * 0.36; let xz = T.xy + sh + (ax * c.x * 1.35 + ay * c.y) * r;
  o.p = u.vp * vec4f(xz.x, 0.28, xz.y, 1.0); o.uv = c; o.kind = 5u; o.col = vec4f(0.0, 0.0, 0.0, 0.38 * smoothstep(170.0, 120.0, length(T.xy - u.cam.xz))); return o; }
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
  if (ii >= 288u) { let j = ii - 288u; let ph = u.b7.x * 2.0 - f32(j) / 12.0; let ag = fract(ph) / 0.98; let sid = floor(ph);   // 2 puffs per stride
    let r1 = hash2(vec2f(sid, f32(j % 12u)) * 1.7); let r2 = hash2(vec2f(f32(j % 12u), sid) * 3.3);
    let fw = vec2f(-sin(u.bolt.w), -cos(u.bolt.w)); let rt = vec2f(-fw.y, fw.x); let vel = length(u.bolt.xz - u.tr.xy) / 0.22;
    let e = 1.0 - exp(-ag * 3.0); let xz = u.bolt.xz - fw * (vel * ag * 0.98 / 3.9 + 0.25) + rt * (r2 - 0.5) * 0.4 + (-fw * 0.3 + rt * (r1 - 0.5) * 0.3) * e;
    let wp = vec3f(xz.x, terrH(xz) + 0.04 + (0.05 + 0.22 * r1) * e, xz.y);
    o.p = bb(wp, c, 0.06 + 0.22 * e); let a2 = 0.16 * pow(1.0 - ag, 2.0) * smoothstep(0.0, 0.08, ag) * u.b8.w * smoothstep(1.0, 3.0, vel);
    o.col = vec4f(vec3f(0.74, 0.70, 0.56) * (0.85 + 0.25 * r2), a2); return o; }
  if (age < 0.0 || age > 1.7) { return o; }
  let r1 = hash2(P.xy * 13.1 + kk); let r2 = hash2(P.xy * 7.7 + kk * 3.1); let fw = vec2f(-sin(P.z), -cos(P.z)); let rt = vec2f(-fw.y, fw.x);
  let e = 1.0 - exp(-age * 2.4);
  let xz = P.xy + (-fw * (0.20 + 0.35 * r1) + rt * (r2 - 0.5) * 0.55) * e + vec2f(0.8, 0.6) * 0.12 * age;
  let wp = vec3f(xz.x, terrH(xz) + 0.03 + (0.08 + 0.28 * r1) * e, xz.y);
  o.p = bb(wp, c, 0.05 + 0.24 * e * (0.7 + 0.6 * r2));
  let a = 0.34 * pow(1.0 - age / 1.7, 2.0) * smoothstep(0.0, 0.06, age);
  o.col = vec4f(vec3f(0.80, 0.70, 0.55) * (0.85 + 0.25 * r2), a); return o; }
// soft sun shafts / warm bloom over the scene (fullscreen, additive)
@vertex fn vs_glow(@builtin(vertex_index) i: u32) -> AO { var q = array<vec2f,3>(vec2f(-1,-1), vec2f(3,-1), vec2f(-1,3)); var o: AO; o.p = vec4f(q[i], 0.0, 1.0); o.uv = q[i]; o.kind = 4u; o.col = vec4f(0); return o; }
@fragment fn fs(v: AO) -> @location(0) vec4f {
  if (v.kind == 0u) { let r2 = dot(v.uv, v.uv); if (r2 > 1.0) { discard; } let g = exp(-r2 * 3.5); return vec4f(v.col.rgb * g, 0.0); }
  if (v.kind == 1u) { let r = length(v.uv); if (r > 1.0) { discard; } let th = atan2(v.uv.y, v.uv.x);
    let rays = pow(abs(cos(th * 6.0)), 6.0) * smoothstep(1.0, 0.3, r) * 0.6 + smoothstep(0.75, 0.0, r) * 0.25 + smoothstep(0.22, 0.12, r) * 0.9;
    let a = clamp(rays, 0.0, 1.0) * v.col.a; return vec4f(v.col.rgb * a, a); }
  if (v.kind == 2u) { let s = v.uv.x; let y = v.uv.y; let edge = (1.0 - 0.55 * s * s) * (0.55 + 0.45 * sin(s * 2.8 + 0.3));
    if (abs(y) > edge || s < 0.03) { discard; } let rim = smoothstep(edge - 0.18, edge, abs(y)) + smoothstep(0.8, 1.0, s);
    let cc = mix(v.col.rgb, vec3f(0.08, 0.07, 0.06), clamp(rim, 0.0, 1.0) * 0.8); return vec4f(cc * v.col.a, v.col.a); }
  if (v.kind == 5u) { let r2 = dot(v.uv, v.uv); if (r2 > 1.0) { discard; } let a = v.col.a * (1.0 - smoothstep(0.15, 1.0, r2)); return vec4f(0.0, 0.0, 0.0, a); }
  if (v.kind == 3u) { return vec4f(v.col.rgb * v.col.a, v.col.a); }
  if (v.kind == 6u) { let r2 = dot(v.uv, v.uv); if (r2 > 1.0) { discard; } let a = v.col.a * (1.0 - smoothstep(0.05, 1.0, r2)) * (0.65 + 0.5 * vnoise(v.uv * 2.5 + v.col.rg * 9.0)); return vec4f(v.col.rgb * a, a); }
  let h = u.ivp * vec4f(v.uv, 1.0, 1.0); let d = normalize(h.xyz / h.w - u.cam.xyz);
  let sd = max(dot(d, u.sun.xyz), 0.0); let sx = normalize(cross(u.sun.xyz, vec3f(0, 1, 0))); let sy = cross(sx, u.sun.xyz);
  let th = atan2(dot(d, sy), dot(d, sx)); let t = u.cam.w;
  let rays = vnoise(vec2f(th * 9.0 + 40.0, t * 0.08)) * 0.6 + vnoise(vec2f(th * 23.0 + 10.0, -t * 0.05)) * 0.4;
  let lowA = smoothstep(-0.25, 0.25, d.y + 0.15);
  let g = pow(sd, 6.0) * 0.07 + pow(sd, 2.5) * smoothstep(0.45, 0.85, rays) * 0.05 * lowA + pow(sd, 40.0) * 0.06;
  return vec4f(vec3f(1.0, 0.88, 0.62) * g, 0.0); }`;

// ---------- init ----------
async function loadTex(dev, url, mips) {
  const bmp = await createImageBitmap(await (await fetch(url)).blob(), { colorSpaceConversion: 'none' });
  const levels = mips ? Math.floor(Math.log2(Math.max(bmp.width, bmp.height))) + 1 : 1;
  const tex = dev.createTexture({ size: [bmp.width, bmp.height], format: 'rgba8unorm-srgb', mipLevelCount: levels, usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
  for (let l = 0; l < levels; l++) { const w = Math.max(1, bmp.width >> l), h = Math.max(1, bmp.height >> l);
    const b = l === 0 ? bmp : await createImageBitmap(bmp, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
    dev.queue.copyExternalImageToTexture({ source: b }, { texture: tex, mipLevel: l }, [w, h]); }
  return { tex, w: bmp.width, h: bmp.height };
}
async function loadArr(dev, suf, format) {   // v447: 4 gallop angles (back, 3/4 L, 3/4 R, profile) as one array texture
  const names = ['back', 'q3l', 'q3r', 'prof']; const bm = await Promise.all(names.map(async n => createImageBitmap(await (await fetch(A + 'bolt447_' + n + suf + '.png?v=8')).blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' })));
  const tex = dev.createTexture({ size: [bm[0].width, bm[0].height, 4], format, usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
  bm.forEach((b, i) => dev.queue.copyExternalImageToTexture({ source: b }, { texture: tex, origin: [0, 0, i] }, [b.width, b.height])); return tex; }
async function main() {
  const ad = await navigator.gpu?.requestAdapter(); if (!ad) { hud.textContent = 'No WebGPU'; return; }
  const dev = await ad.requestDevice({ requiredLimits: { maxStorageBufferBindingSize: Math.min(ad.limits.maxStorageBufferBindingSize, 256 << 20) } });
  const canvas = document.getElementById('c');
  const W = parseInt(qs.get('w')) || Math.round(innerWidth * Math.min(devicePixelRatio, 2));
  const Hh = parseInt(qs.get('h')) || Math.round(innerHeight * Math.min(devicePixelRatio, 2));
  canvas.width = W; canvas.height = Hh;
  const fmt = CAP ? 'rgba8unorm' : navigator.gpu.getPreferredCanvasFormat();
  const ctx = CAP ? null : canvas.getContext('webgpu'); if (ctx) ctx.configure({ device: dev, format: fmt, alphaMode: 'opaque' });
  const [g, s, at] = await Promise.all([loadTex(dev, A + 'ground_2560.jpg', true), loadTex(dev, A + 'sky_4096x2048_wrap.jpg', false), loadTex(dev, A + 'bolt439_atlas.png', false)]);
  const PT = await Promise.all(['bark','leaf','rock','moss'].map(n => loadTex(dev, A + 'tex_' + n + '.jpg', true))); const CLU = await loadTex(dev, A + 'tex_leafclu.png', true); const DIRT = await loadTex(dev, A + 'tex_dirt.jpg', true);
  const [BC, BN] = await Promise.all([loadArr(dev, '_c', 'rgba8unorm-srgb'), loadArr(dev, '_n', 'rgba8unorm')]);
  const V = 0, NI = 0, F = 32;
  const mk = (data, usage) => { const b = dev.createBuffer({ size: (data.byteLength + 3) & ~3, usage: usage | GPUBufferUsage.COPY_DST }); dev.queue.writeBuffer(b, 0, data); return b; };
  const fb = mk(new Float32Array(4), GPUBufferUsage.STORAGE), cb = mk(new Float32Array(4), GPUBufferUsage.STORAGE);
  const TRD = makeTrees(); for (let i = 0; i < TRD.length; i += 4) { const k = Math.floor(TRD[i] / TREE_GRID) + ',' + Math.floor(TRD[i+1] / TREE_GRID); if (!treeGrid.has(k)) treeGrid.set(k, []); treeGrid.get(k).push([TRD[i], TRD[i+1], TRD[i+2] * 0.034]); }
  const rkb = mk(ROCKS, GPUBufferUsage.STORAGE); const PR = new Float32Array(96 * 4).fill(-100); const prb = mk(PR, GPUBufferUsage.STORAGE);
  if (LV) { const ti = +(qs.get('tree') || 0) * 4; live.x = TRD[ti] + 0.25; live.z = TRD[ti + 1] + +(qs.get('lvd') || 14); live.psi = live.cam = 0; window.__lvTree = [TRD[ti], TRD[ti+1], TRD[ti+2] * 0.034]; } const NTREE = TRD.length / 4; const TRS = new Float32Array(TRD.length); const tb = mk(TRD, GPUBufferUsage.STORAGE);
  const ub = dev.createBuffer({ size: 512, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const samp = dev.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', addressModeU: 'repeat', addressModeV: 'repeat', maxAnisotropy: 8 });
  const skySamp = samp;
  const SAMPLES = 4;
  const bgl = dev.createBindGroupLayout({ entries: [
    { binding: 0, visibility: 3, buffer: {} }, { binding: 1, visibility: 3, sampler: {} },
    { binding: 2, visibility: 3, texture: {} }, { binding: 3, visibility: 3, texture: {} },
    { binding: 4, visibility: 1, buffer: { type: 'read-only-storage' } }, { binding: 5, visibility: 3, buffer: { type: 'read-only-storage' } },
    { binding: 6, visibility: 3, texture: { sampleType: 'depth' } }, { binding: 7, visibility: 3, sampler: { type: 'comparison' } }, { binding: 8, visibility: 1, buffer: { type: 'read-only-storage' } }, { binding: 9, visibility: 2, texture: {} }, { binding: 10, visibility: 2, texture: {} }, { binding: 11, visibility: 2, texture: {} }, { binding: 12, visibility: 2, texture: {} }, { binding: 13, visibility: 2, texture: {} }, { binding: 14, visibility: 2, texture: {} }, { binding: 15, visibility: 3, buffer: { type: 'read-only-storage' } }, { binding: 16, visibility: 2, texture: {} }, { binding: 17, visibility: 3, buffer: { type: 'read-only-storage' } }, { binding: 18, visibility: 2, texture: { viewDimension: '2d-array' } }, { binding: 19, visibility: 2, texture: { viewDimension: '2d-array' } } ] });
  const SM = 1024; const smTex = dev.createTexture({ size: [SM * 2, SM], format: 'depth32float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
  const cmpS = dev.createSampler({ compare: 'less-equal', magFilter: 'linear', minFilter: 'linear' });
  const bg = dev.createBindGroup({ layout: bgl, entries: [ { binding: 0, resource: { buffer: ub } }, { binding: 1, resource: skySamp },
    { binding: 2, resource: g.tex.createView() }, { binding: 3, resource: s.tex.createView() }, { binding: 4, resource: { buffer: fb } }, { binding: 5, resource: { buffer: cb } },
    { binding: 6, resource: smTex.createView() }, { binding: 7, resource: cmpS }, { binding: 8, resource: { buffer: tb } }, { binding: 9, resource: at.tex.createView() }, ...PT.map((t, i) => ({ binding: 10 + i, resource: t.tex.createView() })), { binding: 14, resource: CLU.tex.createView() }, { binding: 15, resource: { buffer: rkb } }, { binding: 16, resource: DIRT.tex.createView() }, { binding: 17, resource: { buffer: prb } }, { binding: 18, resource: BC.createView({ dimension: '2d-array' }) }, { binding: 19, resource: BN.createView({ dimension: '2d-array' }) } ] });
  const layout = dev.createPipelineLayout({ bindGroupLayouts: [bgl] });
  // v442 shadow passes: same bind group shape, own uniform (vp = cascade matrix), caster list, dummy depth at binding 6
  const dumD = dev.createTexture({ size: [1, 1], format: 'depth32float', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT });
  const TRSS = new Float32Array(TRD.length); const tbS = mk(TRD, GPUBufferUsage.STORAGE);
  const ubS = [0, 1].map(() => dev.createBuffer({ size: 512, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }));
  const bgS = ubS.map(b => dev.createBindGroup({ layout: bgl, entries: [ { binding: 0, resource: { buffer: b } }, { binding: 1, resource: skySamp },
    { binding: 2, resource: g.tex.createView() }, { binding: 3, resource: s.tex.createView() }, { binding: 4, resource: { buffer: fb } }, { binding: 5, resource: { buffer: cb } },
    { binding: 6, resource: dumD.createView() }, { binding: 7, resource: cmpS }, { binding: 8, resource: { buffer: tbS } }, { binding: 9, resource: at.tex.createView() }, ...PT.map((t, i) => ({ binding: 10 + i, resource: t.tex.createView() })), { binding: 14, resource: CLU.tex.createView() }, { binding: 15, resource: { buffer: rkb } }, { binding: 16, resource: DIRT.tex.createView() }, { binding: 17, resource: { buffer: prb } }, { binding: 18, resource: BC.createView({ dimension: '2d-array' }) }, { binding: 19, resource: BN.createView({ dimension: '2d-array' }) } ] }));
  const SHQ = qs.get('sh') !== '0';
  const pipe = (code, depthWrite, cull) => { const m = dev.createShaderModule({ code });
    return dev.createRenderPipeline({ layout, vertex: { module: m, entryPoint: 'vs' }, fragment: { module: m, entryPoint: 'fs', targets: [{ format: fmt }] },
      primitive: { topology: 'triangle-list', cullMode: cull }, multisample: { count: SAMPLES },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: depthWrite, depthCompare: depthWrite ? 'less' : 'less-equal' } }); };
  const pSky = pipe(SKY, false, 'none'), pGround = pipe(GROUND, true, 'none'), pGrass = pipe(GRASS, true, 'none'), pTrees = pipe(TREES, true, 'none');
  const pm = dev.createShaderModule({ code: qs.get('lf') === '1' ? PROPS.replace('// v442: early alpha test', 'if (v.mt == 5u) { return vec4f(0.1, 0.3, 0.1, 1.0); }') : PROPS });
  const pipe3 = (vsn) => dev.createRenderPipeline({ layout, vertex: { module: pm, entryPoint: vsn }, fragment: { module: pm, entryPoint: 'fs', targets: [{ format: fmt }] }, primitive: { topology: 'triangle-list', cullMode: 'none' }, multisample: { count: SAMPLES }, depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' } });
  const pipeS = (vsn) => dev.createRenderPipeline({ layout, vertex: { module: pm, entryPoint: vsn }, fragment: { module: pm, entryPoint: 'fs_shadow', targets: [] }, primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less', depthBias: 1, depthBiasSlopeScale: 1.5 } });
  const pTreeS = pipeS('vs_tree'), pTreeLoS = pipeS('vs_treeMid'), pRockS = pipeS('vs_rock');
  const pTreeMid = pipe3('vs_treeMid'), pTreeFar = pipe3('vs_treeFar'), pRock = pipe3('vs_rock'), pFlower = pipe3('vs_flower'), pTree3 = pipe3('vs_tree');
  const am = dev.createShaderModule({ code: AIR }); const PB = { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } };
  const pipeA = (vsn) => dev.createRenderPipeline({ layout, vertex: { module: am, entryPoint: vsn }, fragment: { module: am, entryPoint: 'fs', targets: [{ format: fmt, blend: PB }] }, primitive: { topology: 'triangle-list', cullMode: 'none' }, multisample: { count: SAMPLES }, depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'less' } });
  const pMote = pipeA('vs_mote'), pSeed = pipeA('vs_seed'), pFly = pipeA('vs_fly'), pBird = pipeA('vs_bird'), pGlow = pipeA('vs_glow'), pTsh = pipeA('vs_tsh');
  const AIRQ = qs.get('air') !== '0', N_MOTE = 800, N_SEED = 110, N_FLY = 9, N_BIRD = 27;
  const pPeb = pipe(PEB, true, 'none'), pDust = pipeA('vs_dust');
  const bm = dev.createShaderModule({ code: BOLT });
  const pBolt = dev.createRenderPipeline({ layout, vertex: { module: bm, entryPoint: 'vs' }, fragment: { module: bm, entryPoint: 'fs', targets: [{ format: fmt }] },
    primitive: { topology: 'triangle-list', cullMode: 'none' }, multisample: { count: SAMPLES, alphaToCoverageEnabled: true },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' } });
  const PQ = qs.get('post') !== '0'; const NOTR = qs.get('tr') === '0', NON = qs.get('tr') === '1', NOF = qs.get('tr') === '2';
  const TU = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;
  const sceneT = dev.createTexture({ size: [W, Hh], format: 'rgba8unorm', usage: TU });
  const qW = Math.max(1, W >> 2), qH = Math.max(1, Hh >> 2);
  const qT = [0, 1, 2, 3].map(() => dev.createTexture({ size: [qW, qH], format: 'rgba8unorm', usage: TU }));   // [blurC, bloom] x ping/pong
  const linS = dev.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
  const POST = /* wgsl */`
struct U { vp: mat4x4f, ivp: mat4x4f, cam: vec4f, bolt: vec4f, bp: vec4f, grid: vec4f, sun: vec4f, misc: vec4f, svp: mat4x4f, c0: mat4x4f, c1: mat4x4f, tr: vec4f };
@group(0) @binding(0) var<uniform> u: U; @group(0) @binding(1) var ls: sampler;
@group(0) @binding(2) var tA: texture_2d<f32>; @group(0) @binding(3) var tB: texture_2d<f32>;
@group(0) @binding(4) var tD: texture_depth_multisampled_2d; @group(0) @binding(5) var tS: texture_2d<f32>;
struct PO { @builtin(position) p: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> PO { var q = array<vec2f,3>(vec2f(-1,-1), vec2f(3,-1), vec2f(-1,3)); var o: PO; o.p = vec4f(q[i], 0.0, 1.0); o.uv = vec2f(q[i].x * 0.5 + 0.5, 0.5 - q[i].y * 0.5); return o; }
struct M2 { @location(0) a: vec4f, @location(1) b: vec4f };
fn bright(c: vec3f) -> vec3f { let l = dot(c, vec3f(0.2126, 0.7152, 0.0722)); return c * smoothstep(0.68, 0.95, l); }
@fragment fn fs_down(v: PO) -> M2 { let px = 1.0 / vec2f(textureDimensions(tA));   // 4x4 box at full res via 4 bilinear taps
  var c = vec3f(0); var b = vec3f(0);
  for (var j = 0; j < 4; j++) { let o = vec2f(f32(j % 2) * 2.0 - 1.0, f32(j / 2) * 2.0 - 1.0) * px; let s = textureSampleLevel(tA, ls, v.uv + o, 0.0).rgb; c += s; b += bright(s); }
  var m: M2; m.a = vec4f(c * 0.25, 1.0); m.b = vec4f(b * 0.25, 1.0); return m; }
fn blur(t: texture_2d<f32>, uv: vec2f, d: vec2f) -> vec3f {   // 9-tap gaussian in 5 bilinear taps
  return textureSampleLevel(t, ls, uv, 0.0).rgb * 0.227 + (textureSampleLevel(t, ls, uv + d * 1.385, 0.0).rgb + textureSampleLevel(t, ls, uv - d * 1.385, 0.0).rgb) * 0.316
       + (textureSampleLevel(t, ls, uv + d * 3.231, 0.0).rgb + textureSampleLevel(t, ls, uv - d * 3.231, 0.0).rgb) * 0.070; }
@fragment fn fs_bh(v: PO) -> M2 { let d = vec2f(1.0 / f32(textureDimensions(tA).x), 0.0); var m: M2; m.a = vec4f(blur(tA, v.uv, d), 1.0); m.b = vec4f(blur(tB, v.uv, d * 1.6), 1.0); return m; }
@fragment fn fs_bv(v: PO) -> M2 { let d = vec2f(0.0, 1.0 / f32(textureDimensions(tA).y)); var m: M2; m.a = vec4f(blur(tA, v.uv, d), 1.0); m.b = vec4f(blur(tB, v.uv, d * 1.6), 1.0); return m; }
@fragment fn fs_final(v: PO) -> @location(0) vec4f {
  let dim = vec2f(textureDimensions(tS)); let ip = vec2i(v.uv * dim);
  var c = textureLoad(tS, ip, 0).rgb;
  // light far depth of field (sky + > ~120 m), linearised from the perspective depth
  let zd = textureLoad(tD, ip, 0); let n = 0.05; let f = 2000.0; let zl = n * f / (f - zd * (f - n));
  let dof = smoothstep(90.0, 320.0, zl) * 0.55;
  c = mix(c, textureSampleLevel(tA, ls, v.uv, 0.0).rgb, dof);
  // bloom (screen add, soft)
  let bl = textureSampleLevel(tB, ls, v.uv, 0.0).rgb; c = c + bl * 0.45 * (1.0 - c * 0.5);
  // filmic shoulder/toe on the display signal + grade: warm highlights, teal-cool shadows, gentle saturation, vignette
  var x = pow(clamp(c, vec3f(0), vec3f(1.2)), vec3f(2.2));
  x = x * 1.06; x = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14) * 1.12;   // re-shoulder
  let l = dot(x, vec3f(0.2126, 0.7152, 0.0722));
  x = mix(vec3f(l), x, 1.07);
  x = x * mix(vec3f(0.96, 1.0, 1.05), vec3f(1.04, 1.0, 0.94), smoothstep(0.05, 0.6, l));
  let vg = length((v.uv - 0.5) * vec2f(1.0, dim.y / dim.x * 0.6)); x *= mix(1.0, 0.86, smoothstep(0.35, 0.95, vg));
  return vec4f(pow(clamp(x, vec3f(0), vec3f(1)), vec3f(1.0 / 2.2)), 1.0); }`;
  const pmP = dev.createShaderModule({ code: POST });
  const pbgl = dev.createBindGroupLayout({ entries: [ { binding: 0, visibility: 2, buffer: {} }, { binding: 1, visibility: 2, sampler: {} }, { binding: 2, visibility: 2, texture: {} }, { binding: 3, visibility: 2, texture: {} },
    { binding: 4, visibility: 2, texture: { sampleType: 'depth', multisampled: true } }, { binding: 5, visibility: 2, texture: {} } ] });
  const pl = dev.createPipelineLayout({ bindGroupLayouts: [pbgl] });
  const pP = (fs, fmts) => dev.createRenderPipeline({ layout: pl, vertex: { module: pmP, entryPoint: 'vs' }, fragment: { module: pmP, entryPoint: fs, targets: fmts.map(format => ({ format })) }, primitive: { topology: 'triangle-list' } });
  const pDown = pP('fs_down', ['rgba8unorm', 'rgba8unorm']), pBH = pP('fs_bh', ['rgba8unorm', 'rgba8unorm']), pBV = pP('fs_bv', ['rgba8unorm', 'rgba8unorm']), pFin = pP('fs_final', [fmt]);
  const msaa = dev.createTexture({ size: [W, Hh], format: fmt, sampleCount: SAMPLES, usage: GPUTextureUsage.RENDER_ATTACHMENT });
  const depth = dev.createTexture({ size: [W, Hh], format: 'depth24plus', sampleCount: SAMPLES, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
  const pbg = (a, b) => dev.createBindGroup({ layout: pbgl, entries: [ { binding: 0, resource: { buffer: ub } }, { binding: 1, resource: linS }, { binding: 2, resource: a.createView() }, { binding: 3, resource: b.createView() },
    { binding: 4, resource: depth.createView() }, { binding: 5, resource: sceneT.createView() } ] });
  const bgDown = pbg(sceneT, sceneT), bgBH = pbg(qT[0], qT[1]), bgBV = pbg(qT[2], qT[3]), bgFin = pbg(qT[0], qT[1]);
  const pPass = (enc, views, pipe, bgp) => { const p = enc.beginRenderPass({ colorAttachments: views.map(v => ({ view: v.createView ? v.createView() : v, loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1] })) }); p.setPipeline(pipe); p.setBindGroup(0, bgp); p.draw(3); p.end(); };
  const off = CAP ? dev.createTexture({ size: [W, Hh], format: fmt, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC }) : null;
  const bpr = Math.ceil(W * 4 / 256) * 256; const rb = CAP ? dev.createBuffer({ size: bpr * Hh, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }) : null;
  const G = 200, SP = 0.07, sun = norm([0.80, 0.50, 0.12]);
  window.__meadowInfo = { trees: NTREE, ver: 'v447angles', route: 'C-card', ground: [g.w, g.h], sky: [s.w, s.h], V, F, tris: NI / 3, shadow: 'csm2+spriteBolt', blades: G * G + 150 * 150 + 130 * 130, W, H: Hh };

  const CASC = [null, null], CR0 = 15, CR1 = 70;
  const TRAIL = [];
  // v445 paw prints: 4 strikes per gallop stride, kept 10 s, only on the dirt path
  const PAWS = [[0.00, -0.24, -0.065], [0.08, -0.24, 0.065], [0.42, 0.26, -0.06], [0.50, 0.26, 0.06]];
  const posAt = (t) => { let st = sampleLoop(t); if (qs.get('pathcam') === '1') { const z = 30 - 4.2 * t, dX = (pathX(z + 0.01) - pathX(z - 0.01)) / 0.02, a = Math.atan(dX); st = { ...st, x: pathX(z) + 0.15, z, psi: a }; } return st; };
  const putPrint = (i, x, z, psi, ph, tp) => { const fx = -Math.sin(psi), fz = -Math.cos(psi); const px = x + fx * ph[1] - fz * ph[2], pz = z + fz * ph[1] + fx * ph[2];
    if (Math.abs(px - pathX(pz)) > 0.95) return false; PR.set([px, pz, psi + (ph[2] > 0 ? 0.08 : -0.08), tp], i * 4); return true; };
  let prRing = 0, prevPh = 0;
  function updatePrints(t) {
    if ((DEMO || CAP) && !LV) { PR.fill(-100); let n = 0; for (let s = Math.floor(t * STRIDE_HZ); s >= 0 && n < 96; s--) { if ((s + 1) / STRIDE_HZ < t - 10) break;
        for (const ph of PAWS) { const tp = (s + ph[0]) / STRIDE_HZ; if (tp > t || tp < t - 10 || n >= 96) continue; const st = posAt(tp); if (putPrint(n, st.x, st.z, st.psi, ph, tp)) n++; } } }
    else { const cur = live.phase; for (const ph of PAWS) { const c = cur >= prevPh ? (ph[0] > prevPh && ph[0] <= cur) : (ph[0] > prevPh || ph[0] <= cur);
        if (c && live.v > 0.5 && putPrint(prRing, live.x, live.z, live.psi, ph, t)) prRing = (prRing + 1) % 96; } prevPh = cur; }
    dev.queue.writeBuffer(prb, 0, PR); }
  function frameState(t) {
    let st = (DEMO || CAP) && !LV ? sampleLoop(t) : live;
    if (qs.get('pathcam') === '1') { const z = 30 - 4.2 * t, dX = (pathX(z + 0.01) - pathX(z - 0.01)) / 0.02, a = Math.atan(dX); st = { ...st, x: pathX(z) + 0.15, z, psi: a, cam: a, w: a }; }  // capture-only: follow the dirt path
    const fw = (a) => [-Math.sin(a), 0, -Math.cos(a)];
    const cf = fw(st.cam), bp = [st.x, 0, st.z];
    const cr = [-cf[2], 0, cf[0]];  // camera-right
    const eye = [bp[0] - cf[0] * 2.35 + cr[0] * CAM_LAT, 1.12, bp[2] - cf[2] * 2.35 + cr[2] * CAM_LAT];
    const tgt = [bp[0] + cf[0] * 2.2 + cr[0] * CAM_LAT, 0.66, bp[2] + cf[2] * 2.2 + cr[2] * CAM_LAT];
    bp[1] = terrH(bp[0], bp[2]);   // v443: Bolt rides the terrain; camera follows a smoothed height (relief is gentle => no jumps)
    { const he = terrH(eye[0], eye[2]), ht = terrH(tgt[0], tgt[2]); const hc = (he + 2 * bp[1] + ht) / 4; eye[1] += Math.max(hc, he + 0.45 - 1.12 + 0.6); tgt[1] += (bp[1] * 2 + ht) / 3; }
    if (CINE) { // v443 cinematic camera (X clip): eased keyframes [t, orbit angle, distance, height, target height]
      const K = [[0,0.35,1.15,0.26,0.42],[2.5,0.15,1.5,0.34,0.48],[5.5,0,2.35,1.12,0.66],[10,0,2.6,1.2,0.66],[13,0.28,2.0,0.55,0.58],[16,-0.28,2.2,0.6,0.6],[19,0.25,1.7,0.42,0.55],[22,-0.22,1.8,0.45,0.55],[25.5,0.0,2.4,0.9,0.62],[29,0.25,7.5,3.6,1.6],[40,0.1,8.5,4.2,1.8]];
      let i = 0; while (i < K.length - 2 && t >= K[i + 1][0]) i++; const A = K[i], B = K[i + 1]; let k = Math.min(1, Math.max(0, (t - A[0]) / (B[0] - A[0]))); k = k * k * (3 - 2 * k);
      const P = A.map((v, j) => v + (B[j] - v) * k); const ca = st.cam + P[1]; const bw = [-Math.sin(ca), -Math.cos(ca)];
      eye[0] = bp[0] - bw[0] * P[2]; eye[2] = bp[2] - bw[1] * P[2]; const ge = terrH(eye[0], eye[2]); eye[1] = Math.max(ge + 0.18, (ge + bp[1]) / 2 + P[3]);
      tgt[0] = bp[0] + cf[0] * 0.6; tgt[2] = bp[2] + cf[2] * 0.6; tgt[1] = bp[1] + P[4]; }
    if (qs.get('side') === '1') { eye[0] = bp[0] + cr[0] * 4.0; eye[1] = 0.9; eye[2] = bp[2] + cr[2] * 4.0; tgt[0] = bp[0]; tgt[1] = 0.7; tgt[2] = bp[2]; }
    if (ORB) { // v447 capture: slow orbit around Bolt (shows the angle blend + parallax); radius/height kept
      const oa = ORB * Math.sin(2 * Math.PI * t / 12), co = Math.cos(oa), so = Math.sin(oa);
      const rot = (q) => { const dx = q[0] - bp[0], dz = q[2] - bp[2]; q[0] = bp[0] + dx * co - dz * so; q[2] = bp[2] + dx * so + dz * co; }; rot(eye); rot(tgt); }
    const view = lookAt(eye, tgt, [0, 1, 0]); const proj = persp(62 * D2R, W / Hh, 0.05, 2000);
    const vp = mul(proj, view), ivp = inv(vp);
    const phase = (DEMO || CAP) && !LV ? t * STRIDE_HZ : live.phase; const ff = (phase % 1) * F;
    const roll = Math.max(-MAX_ROLL, Math.min(MAX_ROLL, st.w * 0.15));
    const pitch = st.w, bob = 0;  // baked into the Blender gallop
    const gc = [eye[0] + cf[0] * 6.0, eye[2] + cf[2] * 6.0].map(v => Math.round(v / SP) * SP);
    const U = new Float32Array(128); U.set(vp, 0); U.set(ivp, 16);
    U.set([eye[0], eye[1], eye[2], t], 32); U.set([bp[0], bp[1], bp[2], st.psi], 36); U.set([roll, pitch, bob, ff], 40);
    U.set([gc[0], gc[1], SP, G], 44); U.set([...sun, 0], 48); U.set([V, F, qs.get('dbg') === '1' ? 1 : 0, 0], 52);
    { // sun-space ortho for shadow map, centred on Bolt
      const c = [bp[0], 0.5, bp[2]], e = [c[0] + sun[0] * 6, c[1] + sun[1] * 6, c[2] + sun[2] * 6];
      const sv = lookAt(e, c, [0, 1, 0]); const r = 1.9, n = 0.5, f = 12;
      const o = new Float32Array([1/r,0,0,0, 0,1/r,0,0, 0,0,-1/(f-n),0, 0,0,-n/(f-n),1]);
      U.set(mul(o, sv), 56); }
    { const casc = (c, r) => { const e = [c[0] + sun[0] * 200, c[1] + sun[1] * 200, c[2] + sun[2] * 200]; const sv = lookAt(e, c, [0, 1, 0]); const n = 1, f = 400;
        const M = mul([1/r,0,0,0, 0,1/r,0,0, 0,0,-1/(f-n),0, 0,0,-n/(f-n),1], sv); M[12] = Math.round(M[12] * 512) / 512; M[13] = Math.round(M[13] * 512) / 512; return M; };  // texel-snapped => no shimmer
      CASC[0] = casc([eye[0] + cf[0] * 11, 0, eye[2] + cf[2] * 11], CR0); CASC[1] = casc([eye[0] + cf[0] * 50, 0, eye[2] + cf[2] * 50], CR1);
      U.set(CASC[0], 72); U.set(CASC[1], 88);
      { let a, b; if ((DEMO || CAP) && !LV) { a = sampleLoop(Math.max(0, t - 0.22)); b = sampleLoop(Math.max(0, t - 0.5)); a = [a.x, a.z]; b = [b.x, b.z]; }
        else { TRAIL.push([performance.now(), live.x, live.z]); while (TRAIL.length > 2 && performance.now() - TRAIL[0][0] > 600) TRAIL.shift();
          const pick = (ms) => { const n = performance.now(); for (let i = TRAIL.length - 1; i >= 0; i--) if (n - TRAIL[i][0] >= ms) return [TRAIL[i][1], TRAIL[i][2]]; return [TRAIL[0][1], TRAIL[0][2]]; }; a = pick(220); b = pick(500); }
        U.set([a[0], a[1], b[0], b[1]], 104); } if (qs.get('sh') === '0') U[55] = 1; }
    { // v447 angle blend: signed yaw of Bolt vs the view ray (+ a lean from the turn rate), back -> 3/4 -> profile
      const vx = bp[0] - eye[0], vz = bp[2] - eye[2], fx = -Math.sin(st.psi), fz = -Math.cos(st.psi);
      const rel = -Math.atan2(vx * fz - vz * fx, vx * fx + vz * fz);    // >0: Bolt heads to the left of the view ray (psi up = left turn)
      const cR = 12 * D2R; let a = (rel + (ANG_GAIN - 1) * Math.max(-cR, Math.min(cR, rel)) + st.w * 0.30) * 180 / Math.PI;   // small chase-cam yaws exaggerated, real orbits 1:1
      a = Math.max(-90, Math.min(90, a)); const A = Math.abs(a);
      const side = a >= 0 ? 1 : 2;   // q3l / q3r
      let la, lb, k; const sm = x => x * x * (3 - 2 * x);
      const cl = x => Math.max(0, Math.min(1, x));   // hold each angle, short crossfades (a long 50/50 mix of two silhouettes reads as a ghost)
      if (A < 47) { la = 0; lb = side; k = sm(cl((A - 19) / 8)); } else { la = side; lb = 3; k = sm(cl((A - 63) / 8)); }
      if (FORCE_L >= 0) { la = lb = FORCE_L; k = 0; }
      U.set([phase, la, lb, k], 108); U.set([a >= 0 ? -1 : 1, PARX, RELIT, BMODE === 'sprite' ? 0 : 1], 112); window.__ang = [rel, a, la, lb, k]; }
    return { U, st, roll };
  }
  function render(t) {
    const { U, st, roll } = frameState(t); dev.queue.writeBuffer(ub, 0, U); updatePrints(t);
    // v440 tree LOD on CPU: frustum + behind cull, near (<60 m) = full branching tree, mid (<170 m) = branches + big clusters, far = 1-crown LOD
    const fx = -Math.sin(st.cam), fz = -Math.cos(st.cam), ex = st.x - fx * 2.35, ez = st.z - fz * 2.35; let nN = 0, nM = 0, nF = 0; const mid = [], far = [];
    const tanH = ORB ? 1e3 : Math.tan(31 * D2R) * W / Hh * 1.12;
    for (let i = 0; i < NTREE; i++) { const dx = TRD[i*4] - ex, dz = TRD[i*4+1] - ez, H = TRD[i*4+2]; const fd = dx * fx + dz * fz; if (fd < -H && !ORB) continue;
      if (Math.abs(dx * fz - dz * fx) > Math.max(fd, 0) * tanH + H * 0.7 + 2) continue;
      const d2 = dx * dx + dz * dz; if (d2 > 225 * 225) continue; if (d2 > 150 * 150 && (TRD[i*4+3] * 13.7 % 1) < 0.35) continue; if (d2 < 150 * 150) { TRS.set(TRD.subarray(i*4, i*4+4), nN * 4); nN++; } else far.push(i); }
    for (const i of mid) { TRS.set(TRD.subarray(i*4, i*4+4), (nN + nM) * 4); nM++; }
    for (const i of far) { if (nN + nF >= NTREE) break; TRS.set(TRD.subarray(i*4, i*4+4), (nN + nM + nF) * 4); nF++; }
    nF += nM;  // write span below covers near+mid+far
    dev.queue.writeBuffer(tb, 0, TRS, 0, (nN + nF) * 4); window.__treeLOD = [nN, nM, nF - nM];
    const target = CAP ? off : ctx.getCurrentTexture();
    const enc = dev.createCommandEncoder();
    if (SHQ) { // v442 shadow casters: all trees around cascade 1 (no camera frustum cull), near model < 60 m from the eye, far crown beyond
      const cx = st.x - fx * 2.35 + fx * 50, cz = st.z - fz * 2.35 + fz * 50; let nS = 0; const fS = [];
      for (let i = 0; i < NTREE; i++) { const tx = TRD[i*4], tz = TRD[i*4+1], H = TRD[i*4+2]; const qx = tx - cx, qz = tz - cz; const R = CR1 * 1.42 + H * 0.6; if (qx * qx + qz * qz > R * R) continue;
        const dx = tx - ex, dz = tz - ez; if (dx * dx + dz * dz < 150 * 150) { TRSS.set(TRD.subarray(i*4, i*4+4), nS * 4); nS++; } else fS.push(i); }
      let nFS = 0; for (const i of fS) { TRSS.set(TRD.subarray(i*4, i*4+4), (nS + nFS) * 4); nFS++; }
      dev.queue.writeBuffer(tbS, 0, TRSS, 0, (nS + nFS) * 4);
      for (let ci = 0; ci < 2; ci++) { U.set(CASC[ci], 0); dev.queue.writeBuffer(ubS[ci], 0, U); }
      const sp = enc.beginRenderPass({ colorAttachments: [], depthStencilAttachment: { view: smTex.createView(), depthLoadOp: 'clear', depthClearValue: 1, depthStoreOp: 'store' } });
      for (let ci = 0; ci < 2; ci++) { sp.setViewport(ci * SM, 0, SM, SM, 0, 1); sp.setScissorRect(ci * SM, 0, SM, SM); sp.setBindGroup(0, bgS[ci]);
        sp.setPipeline(pRockS); sp.draw(360, 144);
        if (nS) { sp.setPipeline(pTreeS); sp.draw(25 * 30 + 58 * 12, nS); }
        if (ci === 1 && nFS) { sp.setPipeline(pTreeLoS); sp.draw(210 + 22 * 6, nFS, 0, nS); } }
      sp.end(); window.__shadowCasters = [nS, nFS]; }
    const pass = enc.beginRenderPass({ colorAttachments: [{ view: msaa.createView(), resolveTarget: (PQ ? sceneT : target).createView(), loadOp: 'clear', storeOp: 'discard', clearValue: [0.5, 0.68, 0.88, 1] }],
      depthStencilAttachment: { view: depth.createView(), depthLoadOp: 'clear', depthClearValue: 1, depthStoreOp: PQ ? 'store' : 'discard' } });
    pass.setBindGroup(0, bg);
    pass.setPipeline(pGround); pass.draw(6 * 128 * 128);
    pass.setPipeline(pTree3); if (nN && !NOTR && !NON) pass.draw(25 * 30 + 58 * 12, nN); pass.setPipeline(pTreeMid); if (nF - nM && !NOTR && !NOF) pass.draw(210 + 22 * 6, nF - nM, 0, nN + nM);   // 3D trees (old card pass pTrees kept unused)
    pass.setPipeline(pPeb); pass.draw(144, 960);
    pass.setPipeline(pRock); pass.draw(360, 144); pass.setPipeline(pFlower); pass.draw(21, 70 * 70);
    pass.setPipeline(pBolt); pass.draw(6);
    if (qs.get('dbg') !== '1' && qs.get('bm') !== '1') { pass.setPipeline(pGrass); pass.draw(15, G * G); pass.draw(3, 150 * 150 + 130 * 130, 0, G * G); }
    pass.setPipeline(pSky); pass.draw(3);
    pass.setPipeline(pDust); pass.draw(6, 288 + 24);
    if (AIRQ) { pass.setPipeline(pBird); pass.draw(6, N_BIRD); pass.setPipeline(pFly); pass.draw(12, N_FLY); pass.setPipeline(pSeed); pass.draw(6, N_SEED); pass.setPipeline(pMote); pass.draw(6, N_MOTE); pass.setPipeline(pGlow); pass.draw(3); }
    pass.end();
    if (PQ) { pPass(enc, [qT[0], qT[1]], pDown, bgDown); pPass(enc, [qT[2], qT[3]], pBH, bgBH); pPass(enc, [qT[0], qT[1]], pBV, bgBV); pPass(enc, [target], pFin, bgFin); }
    if (CAP) enc.copyTextureToBuffer({ texture: off }, { buffer: rb, bytesPerRow: bpr }, [W, Hh]);
    dev.queue.submit([enc.finish()]);
    return { psi: st.psi, cam: st.cam, x: st.x, z: st.z, w: st.w, roll };
  }
  if (CAP) {
    const c2 = new OffscreenCanvas(W, Hh), x2 = c2.getContext('2d');
    window.__meadowFrame = async (t, q = 0.9) => { if (LV) for (let k = +(qs.get('lvs') || 1); k > 0; k--) stepLive(1 / 30); const info = render(t); await rb.mapAsync(GPUMapMode.READ);
      const src = new Uint8Array(rb.getMappedRange()); const img = new ImageData(W, Hh);
      for (let y = 0; y < Hh; y++) img.data.set(src.subarray(y * bpr, y * bpr + W * 4), y * W * 4);
      rb.unmap(); x2.putImageData(img, 0, 0);
      const blob = await c2.convertToBlob({ type: 'image/jpeg', quality: q }); const buf = new Uint8Array(await blob.arrayBuffer());
      let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      return { jpg: btoa(s), info }; };
    window.__perf = async (n, t = 16) => { await dev.queue.onSubmittedWorkDone(); const a = performance.now(); for (let i = 0; i < n; i++) { render(t + i / 30); await dev.queue.onSubmittedWorkDone(); } return (performance.now() - a) / n; };
    window.__meadowReady = true; return;
  }
  let t0 = performance.now(), last = t0;
  const loop = (now) => { const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now; if (!DEMO) stepLive(dt);
    const i = render(t); hud.textContent = `v439meadowWolf${DEMO ? ' · demo' : ''} · ${Math.round(((i.psi * 180 / Math.PI) % 360 + 360) % 360)}°`; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
main().catch(e => { hud.textContent = 'ERR ' + e; console.error(e); window.__meadowErr = String(e); });

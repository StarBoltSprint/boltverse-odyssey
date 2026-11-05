// m448aaa3 — idle via bricks/bolt-idle; house collide via engine/bricks/collide.js (substep slide + bole trunk). Does not touch m447v gait baseline.
// World-locked equirect sky + world-UV ground plate (2560²) + instanced 3D grass + baked-vertex Bolt trot.
import { makePath } from './engine/path.js?v=2'; import { makeShadows } from './engine/shadows.js?v=2'; import { makeFootprints } from './engine/footprints.js?v=2'; import { makeTreesGPU } from './engine/trees.js?v=2'; import { makeParticles } from './engine/particles.js?v=2'; import { makeAtmosphere } from './engine/atmosphere.js?v=1'; import { makeGI } from './engine/gi.js?v=1'; import { makeWindGPU } from './engine/wind.js?v=1';
import { makeRiver } from './engine/river.js?v=41';
import { makeMill } from './engine/watermill.js?v=29';
import { makeGrassGPU } from './engine/grass.js?v=2';
import { makePost } from './engine/postfx.js?v=1';
import { MEADOW } from './engine/biomes/meadow.js?v=27';
import { makeMeadowCollide, fillTreeColliders, trunkRadius } from './engine/bricks/collide.js?v=1';
import { makeFog } from './engine/fog.js?v=1';
import { boltIdle, measureAtlasFeet, pickPlantedFrame } from './bricks/bolt-idle.js?v=9';
import { makeMeadowRoute } from './engine/bricks/meadow-route.js?v=1';
const qs = new URLSearchParams(location.search); const LV = qs.get('lv') === '1';  // cap a scripted live run (collision proof)
const CINE = qs.get('cine') === '1'; const DEMO = qs.get('demo') === '1', CAP = qs.get('cap') === '1';
const hud = document.getElementById('hud');
if (CAP) hud.style.display = 'none';
const A = './assets/meadow/';
const FOG = makeFog(MEADOW.fog);
const IDLE = boltIdle({ ...MEADOW.boltIdle });
const SPEED = IDLE.cfg.speed;
const STRIDE_HZ = IDLE.cfg.strideHz;
const ACCEL = IDLE.cfg.accel;
const BRAKE = IDLE.cfg.brake;
const IDLE_PHASE = IDLE.cfg.idlePhase;
const V_IDLE = IDLE.cfg.vIdle;
const CAM_TAU = 0.11;       // camera yaw follow time-constant (s)
const MAX_REL = 10 * Math.PI / 180; // Bolt yaw vs camera clamp
const MAX_ROLL = 8 * Math.PI / 180;
const CAM_LAT = +(new URLSearchParams(location.search).get('lat') ?? -0.012);  // camera lateral offset (0 = Bolt centred)

// ---------- v440 rocks as data (shared by GPU + collision) and circle colliders ----------
const RK = 64, RCELL = 9.0, ROCKS = new Float32Array(RK * RK * 4);   // per cell (period 576 m): ox, oz (in cell units, -1 = none), radius, spare
{ let st = 0x9e3779b9; const rnd = () => { st ^= st << 13; st >>>= 0; st ^= st >>> 17; st ^= st << 5; st >>>= 0; return st / 4294967296; };
  for (let i = 0; i < RK * RK; i++) { const e = rnd() < 0.16, ox = 0.25 + 0.5 * rnd(), oz = 0.25 + 0.5 * rnd(), r = 0.6 + 0.5 * rnd();
    ROCKS.set(e ? [ox, oz, r, 0] : [-1, -1, 0, 0], i * 4); } }
const rockCell = (cx, cz) => (((cz % RK) + RK) % RK) * RK + (((cx % RK) + RK) % RK);
const CC = MEADOW.collide || {};
const BOLT_R = CC.boltR ?? 0.42, TREE_GRID = 16, treeGrid = new Map();
// house brick: circle slide + substeps (engine/bricks/collide.js)
const HC = makeMeadowCollide({ ROCKS, rockCell, RCELL, treeGrid, TREE_GRID, boltR: BOLT_R, rockRadScale: CC.rockRadScale ?? 0.95, maxStep: CC.maxStep ?? 0.12, iters: CC.iters ?? 2 });
function collide(x, z, psi) { // thin wrapper: brick slide + river banks
  const r = HC.slide(x, z, psi); collide.hit = r.hit; x = r.x; z = r.z;
  if (RIV) { const w = RIV.collide(x, z); x = w[0]; z = w[1]; collide.splash = w[2]; }
  return [x, z]; }
// ---------- deterministic demo drive ----------
const D2R = Math.PI / 180;
// [start s, duration s, angle deg (+ = left)]
const TURNS = [[2,4,90],[7,4,-90],[12,12,360],[26,4,-90],[31,4,120],[36,12,-360],[50,4,90],[54,7,-180],[61,12,360],[75,4,-90],[80,4,90],[85,4,-45]];
function omegaAt(t) { let w = 0; for (const [s, d, a] of TURNS) { if (t >= s && t < s + d) w += (a * D2R / d) * (1 - Math.cos(2 * Math.PI * (t - s) / d)); } return w; }
const HITS = []; window.__hits = HITS;
const DT = 1 / 240, NT = Math.ceil(100 / DT) + 2;
const PH = new Float64Array(NT);
const TR = { psi: new Float64Array(NT), x: new Float64Array(NT), z: new Float64Array(NT), cam: new Float64Array(NT), w: new Float64Array(NT) };
function nearC(x, z) { const C = [], cx0 = Math.floor(x / RCELL), cz0 = Math.floor(z / RCELL);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const k = rockCell(cx0 + a, cz0 + b) * 4; if (ROCKS[k] < 0) continue; C.push([(cx0 + a + ROCKS[k]) * RCELL, (cz0 + b + ROCKS[k + 1]) * RCELL, ROCKS[k + 2] * 0.95]); }
  const gx = Math.floor(x / TREE_GRID), gz = Math.floor(z / TREE_GRID);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const L = treeGrid.get((gx + a) + ',' + (gz + b)); if (L) for (const t of L) C.push(t); } return C; }
function avoidW(x, z, psi) { const fx = -Math.sin(psi), fz = -Math.cos(psi); let w = 0;
  for (const [ox, oz, r] of nearC(x + fx * 3.0, z + fz * 3.0)) { const dx = ox - x, dz = oz - z, along = dx * fx + dz * fz; if (along < 0.2 || along > 6.0) continue;
    const lat = dx * fz - dz * fx, need = r + BOLT_R + 0.9; if (Math.abs(lat) > need) continue;
    w += (lat >= 0 ? -1 : 1) * 2.4 * (1 - Math.abs(lat) / need) * (1 - along / 6.0) * 2.2; }   // turn away from the side the obstacle is on
  return Math.max(-3.0, Math.min(3.0, w)); }
function buildTR() {
  HITS.length = 0;
  // Stunt TURNS (360° through the mill) retired: that yaw whip plus the house
  // collider is why the mill vanished around t=18–20. Route aims the ford,
  // holds the mill ahead, peels outside the house, then runs straight.
  const route = makeMeadowRoute({ ford: [-3.6, -40.5], house: MILL.house });
  let psi = 0, x = 0, z = 0, cam = 0, ph = 0;
  for (let i = 0; i < NT; i++) {
    const w = route.omega(x, z, psi);
    PH[i] = ph; const x0 = x, z0 = z; TR.psi[i] = psi; TR.x[i] = x; TR.z[i] = z; TR.cam[i] = cam; TR.w[i] = w;
    psi += w * DT;
    x += -Math.sin(psi) * SPEED * DT; z += -Math.cos(psi) * SPEED * DT;
    collide.hit = null; [x, z] = collide(x, z, psi);
    if (collide.hit) HITS.push([+(i * DT).toFixed(2), ...collide.hit.map(v => +v.toFixed(2))]);
    ph += STRIDE_HZ * Math.hypot(x - x0, z - z0) / SPEED;
    cam += (psi - cam) * (1 - Math.exp(-DT / CAM_TAU));
    if (psi - cam > MAX_REL) cam = psi - MAX_REL; if (cam - psi > MAX_REL) cam = psi + MAX_REL;
  }
  window.__routePhase = route.phase();
}
function phaseAt(t) { const k = Math.max(0, Math.floor(t / 90)), r = t - 90 * k, f = Math.min(r / DT, NT - 2), i = Math.floor(f), u = f - i; return k * PH[Math.round(90 / DT)] + PH[i] * (1 - u) + PH[i + 1] * u; }
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
    dmin = Math.sqrt(dmin); if (dmin < 55 || dmin > M) continue; if (RIV) { const r = RIV.info(x, z); if (r.d < r.W + RIV.cfg.bank + 2) continue; }
    out.push(x, z, 11 + 12 * h(gx + 11.0, gz + 5.0), h(gx + 2.2, gz + 9.9)); }
  return new Float32Array(out);
}
// free-play state (keyboard / touch) when not in demo
const _h2 = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
const _vn = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, wx = fx * fx * (3 - 2 * fx), wy = fy * fy * (3 - 2 * fy);
  const a = _h2(ix, iy), b = _h2(ix + 1, iy), c = _h2(ix, iy + 1), d = _h2(ix + 1, iy + 1); return (a + (b - a) * wx) + ((c + (d - c) * wx) - (a + (b - a) * wx)) * wy; };
const _ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const pathX = (z) => 6 + 9 * Math.sin(z * 0.021) + 4 * Math.sin(z * 0.053 + 1.3);
const terrH0 = (x, z) => { const h = 0.75 * Math.sin(x * 0.051 + z * 0.023) + 0.55 * Math.sin(-x * 0.031 + z * 0.067 + 1.7) + 0.22 * Math.sin(x * 0.13 + z * 0.11 + 0.4) + 0.12 * Math.sin(-x * 0.19 + z * 0.23 + 2.1);
  return h * _ss(3, 18, Math.hypot(x, z)) - 0.10 * (1 - _ss(0.6, 1.6, Math.abs(x - pathX(z)) * 0.93)); };
var RIV = makeRiver(MEADOW.river, terrH0);
// scratch-only: keep engine foam/reflection; mild near-cam ripple bump only
RIV.wgsl = RIV.wgsl
  .replace('let amp = 0.045 * (1.0 - smoothstep(20.0, 80.0, dist)) + 0.012;',
           'let amp = 0.070 * (1.0 - smoothstep(18.0, 70.0, dist)) + 0.018;');
const terrH = (x, z) => RIV.carve(x, z, terrH0(x, z));
const MILL = makeMill({ ...MEADOW.mill, river: RIV, h0: terrH0 });
window.__terrH = terrH; window.__riv = RIV; window.__mill = MILL;
{ // shore rocks: clear rock cells in the channel, seed rocks on the banks (same table => mesh + collision + foam)
  let st = 0x51f15e; const rnd = () => { st ^= st << 13; st >>>= 0; st ^= st >>> 17; st ^= st << 5; st >>>= 0; return st / 4294967296; };
  const [bx0, bz0, bx1, bz1] = RIV.BB;
  for (let cx = Math.floor(bx0 / RCELL); cx <= bx1 / RCELL; cx++) for (let cz = Math.floor(bz0 / RCELL); cz <= bz1 / RCELL; cz++) {
    const k = rockCell(cx, cz) * 4, r0 = rnd(), r1 = rnd(), r2 = rnd();
    if (ROCKS[k] >= 0) { const r = RIV.info((cx + ROCKS[k]) * RCELL, (cz + ROCKS[k + 1]) * RCELL); if (r.d < r.W + RIV.cfg.bank + 1.5) ROCKS.set([-1, -1, 0, 0], k); }
    const r = RIV.info((cx + 0.5) * RCELL, (cz + 0.5) * RCELL); if (r.d > 12 || r0 > MEADOW.river.shoreRocks) continue;
    const side = r1 < 0.5 ? -1 : 1, off = r.W - 0.3 + r2 * 0.9;   // half in the water, half on the bank
    const x = r.cx - r.tz * side * off, z = r.cz + r.tx * side * off;
    const mh = Math.hypot(x - MILL.house[0], z - MILL.house[1]); if (mh < 6.5) continue;
    if (Math.floor(x / RCELL) !== cx || Math.floor(z / RCELL) !== cz) continue;
    ROCKS.set([x / RCELL - cx, z / RCELL - cz, 0.55 + 0.45 * rnd(), 1], k); } }
buildTR();
const live = { psi: 0, x: 0, z: 0, cam: 0, w: 0, turn: 0, v: 0, phase: IDLE_PHASE, run: 0 };
window.__live = live; window.__stepLive = dt => stepLive(dt);  // read-only hook for the scripted input test
window.__setRun = on => { if (on) held.add('w'); else { held.delete('w'); held.delete('arrowup'); held.delete(' '); } };
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
function runWanted() {
  if (['w', 'arrowup', ' '].some(k => held.has(k))) return true;
  if (ptrs.size > 0) return true;   // touch/pointer engage = run (L/R still steer)
  for (const g of (navigator.getGamepads ? navigator.getGamepads() : [])) {
    if (!g) continue;
    if (g.buttons[0]?.pressed || g.buttons[7]?.pressed) return true;
    if (g.axes[1] < -0.25) return true;
  }
  return false;
}
function stepLive(dt) {
  live.turn = turnInput(); const target = live.turn * 75 * D2R;
  live.w += (target - live.w) * (1 - Math.exp(-dt / (target === 0 ? 0.10 : 0.25)));
  if (target === 0 && Math.abs(live.w) < 0.05) live.w = 0;
  IDLE.stepMotion(live, dt, runWanted());   // bricks/bolt-idle: accel/brake/phase/breath/tail
  live.psi += live.w * dt;
  { const vx = -Math.sin(live.psi) * live.v, vz = -Math.cos(live.psi) * live.v;
    const m = HC.move(live.x, live.z, live.psi, vx, vz, dt); live.x = m.x; live.z = m.z; collide.hit = m.hit;
    if (RIV) { const w = RIV.collide(live.x, live.z); live.x = w[0]; live.z = w[1]; collide.splash = w[2]; } }
  live.cam += (live.psi - live.cam) * (1 - Math.exp(-dt / CAM_TAU));
  if (live.psi - live.cam > MAX_REL) live.cam = live.psi - MAX_REL;
  if (live.cam - live.psi > MAX_REL) live.cam = live.psi + MAX_REL;
  return live;
}

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
const ENG = { path: makePath(MEADOW.path), shadows: makeShadows({ ...MEADOW.shadows, bolt: new URLSearchParams(location.search).get('bsh') === '0' ? 0 : 1 }), footprints: makeFootprints(MEADOW.footprints), trees: makeTreesGPU(MEADOW.trees), particles: makeParticles(MEADOW.particles), gi: makeGI(MEADOW.gi), wind: makeWindGPU(MEADOW.wind), atmo: makeAtmosphere({ ...MEADOW.atmo, alt: +(new URLSearchParams(location.search).get('alt') || MEADOW.atmo.alt || 0) }) };
const COMMON = /* wgsl */`
${ENG.wind}
${ENG.gi}
struct U { vp: mat4x4f, ivp: mat4x4f, cam: vec4f, bolt: vec4f, bp: vec4f, grid: vec4f, sun: vec4f, misc: vec4f, svp: mat4x4f, c0: mat4x4f, c1: mat4x4f, tr: vec4f };
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
${FOG.hazeConst}const GI_ON = ${new URLSearchParams(location.search).get('gi') === '0' ? 'false' : 'true'};
${ENG.atmo}
fn hash2(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn hash3(p: vec3f) -> f32 { return fract(sin(dot(p, vec3f(127.1, 311.7, 74.7))) * 43758.5453); }
fn vnoise(p: vec2f) -> f32 { let i = floor(p); let f = fract(p); let w = f*f*(3.0-2.0*f);
  return mix(mix(hash2(i), hash2(i+vec2f(1,0)), w.x), mix(hash2(i+vec2f(0,1)), hash2(i+vec2f(1,1)), w.x), w.y); }
${ENG.path}
fn terrH(p: vec2f) -> f32 { return rivCarve(p, terrH0(p)); }
fn terrH0(p: vec2f) -> f32 { // v443 gentle relief (same formula in JS)
  let h = 0.75 * sin(p.x * 0.051 + p.y * 0.023) + 0.55 * sin(-p.x * 0.031 + p.y * 0.067 + 1.7) + 0.22 * sin(p.x * 0.13 + p.y * 0.11 + 0.4) + 0.12 * sin(-p.x * 0.19 + p.y * 0.23 + 2.1);
  return h * smoothstep(3.0, 18.0, length(p)) - 0.10 * (1.0 - smoothstep(0.6, 1.6, pathD(p))); }
${MILL.wgslCommon}
${RIV.wgsl}
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
  let rg = rivGrass(p); hm *= rg; tint *= mix(vec3f(0.62, 0.66, 0.50), vec3f(1.0), rg);
  return vec4f(tint, hm);
}
fn flowerC(p: vec2f) -> f32 { let c = floor(p / 5.0); if (hash2(c + 8.8) > 0.30) { return 0.0; }
  let cp = (c + vec2f(0.3 + 0.4 * hash2(c + 1.1), 0.3 + 0.4 * hash2(c + 2.2))) * 5.0;
  return 1.0 - smoothstep(0.5, 1.0, length(p - cp) / (1.0 + 0.7 * hash2(c + 3.3))); }
fn flowerCol(p: vec2f) -> vec3f { let k = hash2(floor(p / 5.0) + 6.6);
  return select(select(vec3f(1.0, 0.85, 0.15), vec3f(0.98, 0.97, 0.92), k > 0.4), vec3f(0.75, 0.35, 0.90), k > 0.75); }
${ENG.shadows}
${ENG.footprints}
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
${FOG.fogMix.trim()}
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
  // distant hills / tree line, world-locked by azimuth (periodic in lon, no seam)
  let hill = 0.050 + 0.022 * sin(lon * 3.0 + 1.3) + 0.010 * sin(lon * 7.0 + 0.4) + 0.004 * sin(lon * 17.0 + 2.2);
  let trees = hill + 0.006 * max(0.0, sin(lon * 41.0)) * (0.5 + 0.5 * sin(lon * 5.0)) + 0.004 * abs(sin(lon * 113.0)) * step(0.2, sin(lon * 9.0 + 1.0));
  let far = 0.075 + 0.030 * sin(lon * 2.0 + 4.0) + 0.012 * sin(lon * 11.0) + 0.004 * sin(lon * 29.0);
  if (d.y < far) { let fk = clamp((far - d.y) / 0.05, 0.0, 1.0); c = mix(vec3f(0.46, 0.56, 0.68), vec3f(0.34, 0.45, 0.55), fk); }
  if (d.y < trees) { let k = clamp((trees - d.y) / 0.035, 0.0, 1.0); c = mix(vec3f(0.26, 0.38, 0.30), vec3f(0.16, 0.27, 0.17), k); }
  ${FOG.skyHaze}
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
  let fcg = rivGrass(p) * flowerC(p) * step(0.72, hash2(floor(p * 12.0))) * smoothstep(18.0, 24.0, length(p - u.cam.xz)); alb = mix(alb, flowerCol(p) * 0.6, fcg * 0.85);
  let wet = rivWet(p, v.w.y); alb = mix(alb, alb * vec3f(0.10, 0.12, 0.09), wet * 1.0);  // Art LOOK #5 — wet dark waterline+lip
  let sh = shadowW(v.w) * pSh;
  if (u.misc.z > 0.5) { return vec4f(sh, sh, sh, 1.0); }
  let n = normalize(terrN(p) + nb); let L = max(dot(n, u.sun.xyz), 0.0);
  var c = alb * (vec3f(1.0, 0.96, 0.88) * 2.2 * L * sh + select(vec3f(0.42, 0.55, 0.75) * 0.55, giAmb(n, v.w) * 0.85, GI_ON) * mix(0.55, 1.0, sh) * pAO);
  // Art LOOK #5 v25 — soft wet sheen only (no grazing white dashed z-fight streaks)
  c += alb * vec3f(0.55, 0.62, 0.58) * pow(max(dot(reflect(-normalize(u.cam.xyz - v.w), n), u.sun.xyz), 0.0), 96.0) * wet * 0.12 * sh;
  var wa = 0.0; if (wet > 0.0) { var fx = millFoam(p);
    let rc = floor(p / 9.0); let RQ = rockAt(rc); if (RQ.x >= 0.0) { let rd = length(p - (rc + RQ.xy) * 9.0) / RQ.z; fx = max(fx, exp(-pow((rd - 1.12) / 0.65, 2.0)) * 0.16 * (0.35 + 0.65 * vnoise(p * 11.0 + u.cam.w * 0.9)) * smoothstep(0.2, 0.75, vnoise(p * 3.7 + 2.1))); }  // soft broken rock foam
    let bw = p - u.bolt.xz; let bl = length(bw); let brk = smoothstep(0.25, 0.8, vnoise(bw * 28.0 - vec2f(0.0, u.cam.w * 5.0))) * smoothstep(0.2, 0.7, vnoise(bw * 11.0 + u.cam.w * 1.3));
    fx = max(fx, exp(-pow((bl - 0.18 - 0.08 * vnoise(bw * 22.0 + vec2f(u.cam.w * 2.4, 0.0))) / 0.14, 2.0)) * 0.07 * brk * (1.0 - step(0.32, bl)) * step(0.5, wet) * step(u.bolt.y - 0.6, v.w.y));   // Bolt wake: faint broken foam
    let wv = rivShade(v.w, c, sh, fx); c = mix(c, wv.rgb, wv.a); wa = wv.a; }
  c = fogMix(c, length(v.w - u.cam.xyz) * (1.0 - 0.6 * wa));
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
const GRASS = COMMON + makeGrassGPU(MEADOW.grass || {});


const PROPS = COMMON + /* wgsl */`
${MILL.wgslPM}
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
  let amb = select(vec3f(0.42, 0.55, 0.75) * (0.45 + 0.35 * nf.y), giAmb(nf, v.w), GI_ON);
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
${ENG.trees}
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
    else if (v.mt == 6u) { let q = v.w * 1.4;
      t = (textureSampleGrad(tRock, samp, q.zy, gx.zy * 1.4, gy.zy * 1.4) * tw.x + textureSampleGrad(tRock, samp, q.xz, gx.xz * 1.4, gy.xz * 1.4) * tw.y + textureSampleGrad(tRock, samp, q.xy, gx.xy * 1.4, gy.xy * 1.4) * tw.z).rgb; m = vec3f(0.2427, 0.2421, 0.2207); }
    else if (v.mt == 8u) { let Vd = normalize(u.cam.xyz - v.w); let ndv = abs(dot(nf, Vd)); let fr = 0.03 + 0.18 * pow(1.0 - ndv, 5.0);
      let Rv = reflect(-Vd, nf); let skyc = mix(vec3f(0.50, 0.68, 0.78), vec3f(0.25, 0.42, 0.60), smoothstep(-0.1, 0.7, Rv.y));
      let q1 = v.w.y * 1.3 + dot(v.w.xz, vec2f(0.41, 0.23)); let q2 = v.w.y * 1.3 - dot(v.w.xz, vec2f(0.23, 0.41)); let q3 = v.w.y * 2.6;
      let ld = min(min(0.5 - abs(fract(q1) - 0.5), 0.5 - abs(fract(q2) - 0.5)), 0.5 - abs(fract(q3) - 0.5));
      let lines = 1.0 - smoothstep(0.0, 0.045 + 0.9 * (abs(gx.y) + abs(gy.y)) * 1.1, ld);
      let sh8 = csm(v.w + nf * 0.05); let ndl = max(dot(nf, u.sun.xyz), 0.0);
      let ao8 = mix(0.52, 1.0, smoothstep(0.0, 0.08, ld));
      // F0<=0.21 dielectric (Lighting frmax); frosted cyan-white KEEP; Art #2 emissive edges (cyan, not chrome grey)
      let body = v.col * (0.34 + 0.68 * sh8 * ndl + 0.26 * (1.0 - ndv) + 0.14 * sh8) * ao8;
      let rim = vec3f(0.22, 0.62, 0.78) * fr * 0.55;
      let edgeEm = vec3f(0.18, 0.78, 0.95) * pow(1.0 - ndv, 2.2) * 0.70;   // Art #3 clearly lit cyan facet edges
      let spark = pow(max(dot(Rv, u.sun.xyz), 0.0), 120.0) * 0.45 * sh8;
      var c8 = mix(body, skyc * 0.30 + body * 0.70, fr * 0.55) + rim + edgeEm + vec3f(0.20, 0.70, 0.85) * lines * 1.35 + vec3f(0.90, 0.96, 1.0) * spark;
      c8 = fogMix(c8, length(v.w - u.cam.xyz) * 0.20); return tonemap(c8); }
    else if (v.mt == 7u) { let Vd = normalize(u.cam.xyz - v.w); let ndv = abs(dot(nf, Vd)); let fr = 0.04 + 0.18 * pow(1.0 - ndv, 4.0);   // F0-ish <=0.22, cyan emissive accent — NEVER chrome
      let sh7 = shadowW(v.w + nf * 0.02); let ndl = max(dot(nf, u.sun.xyz), 0.0);
      let glow = v.col * (0.55 + 0.40 * (1.0 - ndv));   // lit-crystal inner glow (cyan from v.col)
      let body = mix(glow, v.col * (0.28 + 0.75 * ndl * sh7), 0.50);
      let rim = vec3f(0.22, 0.80, 0.98) * fr * 0.75;
      let spark = pow(max(dot(reflect(-Vd, nf), u.sun.xyz), 0.0), 90.0) * 0.30 * sh7;
      var c7 = body + rim + vec3f(0.18, 0.82, 1.0) * pow(1.0 - ndv, 1.8) * 0.85 + vec3f(0.85, 0.95, 1.0) * spark;
      c7 = fogMix(c7, length(v.w - u.cam.xyz) * 0.30); return tonemap(c7); }
    else { t = textureSampleGrad(tLeaf, samp, v.w.xz * 0.12 + v.w.y * 0.07, gx.xz * 0.12 + gx.y * 0.07, gy.xz * 0.12 + gy.y * 0.07).rgb; m = vec3f(0.0726, 0.1115, 0.0192); }
    let lum = vec3f(0.2126, 0.7152, 0.0722); let det = t / max(m, vec3f(1e-3));
    let tc = t * (dot(v.col, lum) / max(dot(m, lum), 1e-4));
    let fade = select(1.0, 1.0 - 0.6 * smoothstep(60.0, 200.0, dd0), v.mt == 4u);
    vv.col = select(mix(v.col, mix(v.col * det, tc, 0.35), fade), v.col * mix(vec3f(0.95), det, 0.28), v.mt == 6u);
  }
  csmSkip = v.mt == 5u && dd0 > 40.0;   // leaves past 40 m: no shadow lookup
  var c = lit(vv, nf, 0.5); csmSkip = false;
  if (v.mt == 5u) { let Vd = normalize(v.w - u.cam.xyz); c += vv.col * vec3f(1.0, 0.95, 0.6) * pow(max(dot(Vd, u.sun.xyz), 0.0), 5.0) * 0.85 * v.k.x + vv.col * vec3f(0.9, 1.0, 0.45) * 0.35 * pow(max(dot(Vd, u.sun.xyz), 0.0), 2.0); } // sun through leaves (v442 brighter)
  let dd = length(v.w - u.cam.xyz); var tnear = select(1.0, mix(0.3, 1.0, smoothstep(40.0, 240.0, dd)), v.mt == 2u || v.mt == 5u); if (v.mt == 6u || v.mt == 7u) { tnear = 0.18; } c = fogMix(c, dd * tnear);   // aaa2: no far HAZE melt / fog wall
  // aaa2: no extra HAZE on far props
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
  c = fogMix(c, length(v.w - u.cam.xyz)); c = ${FOG.treeWashExpr('c','y')};
  return tonemap(c);
}`;
const CARD_H = IDLE.cfg.cardH, CARD_W = IDLE.cfg.cardW, CARD_FOOT = IDLE.cfg.cardFootRun;
const BOLT = COMMON + /* wgsl */`
${IDLE.wgsl}
struct VO { @builtin(position) p: vec4f, @location(0) uv: vec2f, @location(1) w: vec3f };
@vertex fn vs(@builtin(vertex_index) vi: u32) -> VO {
  var q = array<vec2f,6>(vec2f(-0.5,0), vec2f(0.5,0), vec2f(0.5,1), vec2f(-0.5,0), vec2f(0.5,1), vec2f(-0.5,1));
  let c = q[vi]; let b = vec3f(u.bolt.x, u.bolt.y, u.bolt.z);
  let toE = normalize(vec2f(u.cam.x - b.x, u.cam.z - b.z)); let rt = vec3f(-toE.y, 0.0, toE.x);
  let lr = idleCardLy(c); let lx = lr.x; let ly = lr.y;   // bricks/bolt-idle: ground-snap + bottom-anchored breath
  let cr = cos(u.bp.x); let sr = -sin(u.bp.x);                      // bank INTO the turn (left turn => top tilts left), about the paws
  let rx = lx * cr - ly * sr; let ry = lx * sr + ly * cr;
  let w = b + rt * rx + vec3f(0.0, ry, 0.0) + vec3f(toE.x, 0.0, toE.y) * 0.02;
  var o: VO; o.p = u.vp * vec4f(w, 1.0); o.uv = vec2f(-c.x + 0.5, 1.0 - c.y); o.w = w; return o;
}
fn cell(f: u32, uv: vec2f) -> vec4f { let g = vec2f(f32(f % 8u), f32(f / 8u)); return textureSampleLevel(atex, samp, (g + clamp(uv, vec2f(0.003), vec2f(0.997))) / vec2f(8.0, 4.0), 0.0); }
@fragment fn fs(v: VO) -> @location(0) vec4f {
  let ff = u.bp.w; let a = u32(floor(ff)) % 32u; let bb = (a + 1u) % 32u; let k = fract(ff);
  let gph = ff / 32.0 * 6.2831853; let lw = smoothstep(0.60, 0.88, v.uv.y); let sw = smoothstep(0.40, 0.60, v.uv.x);
  let spd = u.bp.z; let lift = 0.045 * lw * ((1.0 - sw) * max(sin(gph), 0.0) + sw * max(-sin(gph), 0.0)) * smoothstep(0.25, 1.2, spd) * (1.0 - u.misc.x);  // no lift when idle
  let wlB = rivWL(u.bolt.xz); let sub = wlB - v.w.y;
  let wob = select(0.0, sin(v.uv.y * 90.0 + u.cam.w * 7.0) * 0.006, sub > 0.0);
  let uvs = idleTailUV(v.uv + vec2f(wob, lift));   // bricks/bolt-idle: tail-region warp
  let s = mix(cell(a, uvs), cell(bb, uvs), k);
  if (s.a < 0.10) { discard; }
  var c = s.rgb;
  let hgt = v.w.y - u.bolt.y;
  c = mix(c, vec3f(dot(c, vec3f(0.3, 0.59, 0.11))), 0.25) * 1.16; c *= vec3f(0.98, 0.99, 1.0) * mix(0.70, 1.0, smoothstep(-0.03, 0.32, hgt));
  c = mix(c, c * vec3f(0.80, 1.04, 0.70) + vec3f(0.010, 0.022, 0.004), smoothstep(0.38, 0.0, hgt) * 0.55);
  c *= mix(0.55, 1.0, csm(v.w + vec3f(0.0, 0.15, 0.0)));
  if (sub > 0.0) { c = mix(c * exp(-vec3f(2.4, 1.0, 0.75) * sub * 5.0), vec3f(0.06, 0.13, 0.13), clamp(sub * 3.0, 0.0, 0.6)); }
  c += vec3f(0.85, 0.92, 0.95) * exp(-pow(sub / 0.012, 2.0)) * 0.5 * step(-1e8, wlB);
  let dist = length(v.w - u.cam.xyz); c = ${FOG.boltHazeExpr('c','dist')};
  return vec4f(pow(clamp(c, vec3f(0), vec3f(1)), vec3f(1.0 / 2.2)), s.a);
}`;

const AIR = COMMON + /* wgsl */`
struct AO { @builtin(position) p: vec4f, @location(0) col: vec4f, @location(1) uv: vec2f, @location(2) @interpolate(flat) kind: u32 };
@group(0) @binding(8) var<storage, read> trees: array<vec4f>;
// soft ground shadow under near/mid trees: one blurred ellipse per tree, cast away from the sun
@vertex fn vs_tsh(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> AO {
  var o: AO; let T = trees[ii]; let H = T.z; let c = vec2f(QX[vi], QY[vi]);
  let sh = -normalize(u.sun.xz + vec2f(1e-4)) * H * 0.22; let ax = normalize(vec2f(sh.x, sh.y) + vec2f(1e-4)); let ay = vec2f(-ax.y, ax.x);
  let r = H * 0.36; let xz = T.xy + sh + (ax * c.x * 1.35 + ay * c.y) * r;
  o.p = u.vp * vec4f(xz.x, 0.28, xz.y, 1.0); o.uv = c; o.kind = 5u; o.col = vec4f(0.0, 0.0, 0.0, 0.38 * smoothstep(170.0, 120.0, length(T.xy - u.cam.xz))); return o; }
${ENG.particles}
// bricks/bolt-idle: soft contact ellipse under paws while idle
@vertex fn vs_idleContact(@builtin(vertex_index) vi: u32) -> AO {
  var o: AO; let c = vec2f(QX[vi], QY[vi]); let b = u.bolt.xz; let R = mix(0.16, 0.28, u.misc.x);
  let xz = b + c * R; o.p = u.vp * vec4f(xz.x, u.bolt.y + 0.02, xz.y, 1.0); o.uv = c; o.kind = 7u;
  o.col = vec4f(0.0, 0.0, 0.0, u.misc.x * 0.42); return o; }
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
  if (v.kind == 7u) { let r2 = dot(v.uv, v.uv); if (r2 > 1.0) { discard; } let a = v.col.a * (1.0 - smoothstep(0.05, 1.0, r2)); return vec4f(0.0, 0.0, 0.0, a); }  // bricks/bolt-idle contact
  let h = u.ivp * vec4f(v.uv, 1.0, 1.0); let d = normalize(h.xyz / h.w - u.cam.xyz);
  let sd = max(dot(d, u.sun.xyz), 0.0); let sx = normalize(cross(u.sun.xyz, vec3f(0, 1, 0))); let sy = cross(sx, u.sun.xyz);
  let th = atan2(dot(d, sy), dot(d, sx)); let t = u.cam.w;
  let rays = vnoise(vec2f(th * 9.0 + 40.0, t * 0.08)) * 0.6 + vnoise(vec2f(th * 23.0 + 10.0, -t * 0.05)) * 0.4;
  let lowA = smoothstep(-0.25, 0.25, d.y + 0.15);
  let g = pow(sd, 6.0) * 0.07 + pow(sd, 2.5) * smoothstep(0.45, 0.85, rays) * 0.05 * lowA + pow(sd, 40.0) * 0.06;
  return vec4f(vec3f(1.0, 0.88, 0.62) * g, 0.0); }
${MILL.wgslAir}
`;

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
async function main() {
  const ad = await navigator.gpu?.requestAdapter(); if (!ad) { hud.textContent = 'No WebGPU'; return; }
  const dev = await ad.requestDevice({ requiredLimits: { maxStorageBufferBindingSize: Math.min(ad.limits.maxStorageBufferBindingSize, 256 << 20) } });
  const canvas = document.getElementById('c');
  const W = parseInt(qs.get('w')) || Math.round(innerWidth * Math.min(devicePixelRatio, 2));
  const Hh = parseInt(qs.get('h')) || Math.round(innerHeight * Math.min(devicePixelRatio, 2));
  canvas.width = W; canvas.height = Hh;
  const fmt = CAP ? 'rgba8unorm' : navigator.gpu.getPreferredCanvasFormat();
  const ctx = CAP ? null : canvas.getContext('webgpu'); if (ctx) ctx.configure({ device: dev, format: fmt, alphaMode: 'opaque' });
  const [g, s, at, atlasFeet] = await Promise.all([
    loadTex(dev, A + 'ground_2560.jpg', true),
    loadTex(dev, A + 'sky_4096x2048_wrap.jpg', false),
    loadTex(dev, A + 'bolt439_atlas.png', false),
    (async () => {
      const bmp = await createImageBitmap(await (await fetch(A + 'bolt439_atlas.png')).blob(), { colorSpaceConversion: 'none' });
      const cv = new OffscreenCanvas(bmp.width, bmp.height); const cx = cv.getContext('2d', { willReadFrequently: true });
      cx.drawImage(bmp, 0, 0); const id = cx.getImageData(0, 0, bmp.width, bmp.height);
      return measureAtlasFeet(id.data, id.width, id.height, { cols: IDLE.cfg.atlasCols, rows: IDLE.cfg.atlasRows, alphaThresh: IDLE.cfg.alphaThresh });
    })(),
  ]);
  { const m = IDLE.setFeet(atlasFeet.feet, atlasFeet.paws);
    const planted = pickPlantedFrame(atlasFeet);
    IDLE.applyPlanted(planted);
    // ?broken=1 reproduces the failed motion-review clip: mid-stride freeze, no breath/tail, hard snap, pop restart, tree spawn
    if (qs.get('broken') === '1') {
      IDLE.cfg.idleFrame = 0; IDLE.cfg.idlePhase = 0;
      IDLE.cfg.breathAmp = 0; IDLE.cfg.tailBaseAmp = 0; IDLE.cfg.tailAmp = 0;
      IDLE.cfg.settleTau = 0.001; IDLE.cfg.blendV = 0.01;
      IDLE.cfg.launchBlend = 0.08; IDLE.cfg.launchAccelScale = 1.0;
      IDLE.state.footCy = IDLE.footFor(0);
      live.phase = 0;
      console.warn('[aaa3] BROKEN idle mode (motion-review fail repro)');
    }
    live.phase = IDLE.cfg.idlePhase;
    window.__idleFeet = {
      footCy: IDLE.cfg.feet[IDLE.cfg.idleFrame],
      paws0: atlasFeet.paws[IDLE.cfg.idleFrame],
      planted,
      broken: qs.get('broken') === '1',
      idleFrame: IDLE.cfg.idleFrame,
      idlePhase: IDLE.cfg.idlePhase,
      breathAmp: IDLE.cfg.breathAmp,
      tailBaseAmp: IDLE.cfg.tailBaseAmp,
      settleTau: IDLE.cfg.settleTau,
      launchBlend: IDLE.cfg.launchBlend,
      blendV: IDLE.cfg.blendV,
      build: 'm448aaa3-idle-v9',
    };
    console.log('[bolt-idle] planted', planted.idleFrame, 'phase', planted.idlePhase.toFixed(4), 'footCy', planted.footCy.toFixed(4), 'nPaws', planted.nPaws); }
  const PT = await Promise.all(['bark','leaf','rock','moss'].map(n => loadTex(dev, A + 'tex_' + n + '.jpg', true))); const CLU = await loadTex(dev, A + 'tex_leafclu.png', true); const DIRT = await loadTex(dev, A + 'tex_dirt.jpg', true);
  const V = 0, NI = 0, F = 32;
  const mk = (data, usage) => { const b = dev.createBuffer({ size: (data.byteLength + 3) & ~3, usage: usage | GPUBufferUsage.COPY_DST }); dev.queue.writeBuffer(b, 0, data); return b; };
  const fb = mk(new Float32Array(4), GPUBufferUsage.STORAGE), cb = mk(new Float32Array(4), GPUBufferUsage.STORAGE);
  for (const [x, z, r] of MILL.colliders) { const k = Math.floor(x / TREE_GRID) + ',' + Math.floor(z / TREE_GRID); if (!treeGrid.has(k)) treeGrid.set(k, []); treeGrid.get(k).push([x, z, r]); }
  const TRD = makeTrees(); fillTreeColliders(treeGrid, TREE_GRID, TRD, CC.trunkScale ?? 0.055, CC.trunkMin ?? 0.45);
  buildTR(); const rkb = mk(ROCKS, GPUBufferUsage.STORAGE); const PR = new Float32Array(96 * 4).fill(-100); const prb = mk(PR, GPUBufferUsage.STORAGE);
  if (LV) {
    // clear-of-trees spawn: camera sits ~2.35 m behind bolt (psi=0 → +Z). Prefer open meadow.
    // broken mode forces a near-tree spawn so camera_spawn check fails
    const forceTree = qs.get('broken') === '1' ? (qs.get('tree') || '3') : qs.get('tree');
    if (forceTree != null && forceTree !== '') {
      const ti = +forceTree * 4; live.x = TRD[ti] + 0.25; live.z = TRD[ti + 1] + +(qs.get('lvd') || 14); live.psi = live.cam = 0;
      window.__lvTree = [TRD[ti], TRD[ti+1], trunkRadius(TRD[ti+2], CC.trunkScale ?? 0.055, CC.trunkMin ?? 0.45)];
    } else {
      const cands = [[0,0],[6,-18],[-6,-18],[0,-28],[14,-36],[-14,-36],[8,-50],[-8,-50],[20,-70],[-20,-70],[0,-90]];
      let best = cands[0], bestD = -1;
      const clearOf = (x, z) => {
        let md = 1e9;
        for (let i = 0; i < TRD.length; i += 4) {
          const d = Math.hypot(x - TRD[i], z - TRD[i+1]) - trunkRadius(TRD[i+2], CC.trunkScale ?? 0.055, CC.trunkMin ?? 0.45);
          if (d < md) md = d;
        }
        return md;
      };
      for (const [x, z] of cands) {
        const camZ = z + 2.35; // eye behind bolt at psi=0
        const score = Math.min(clearOf(x, z), clearOf(x, camZ), clearOf(x, (z + camZ) * 0.5));
        if (score > bestD) { bestD = score; best = [x, z]; }
      }
      live.x = best[0]; live.z = best[1]; live.psi = live.cam = 0;
      window.__lvClear = { x: best[0], z: best[1], clearM: bestD };
      console.log('[aaa3] clear spawn', best, 'clearM', bestD.toFixed(2));
    }
  } const NTREE = TRD.length / 4; const TRS = new Float32Array(TRD.length); const tb = mk(TRD, GPUBufferUsage.STORAGE);
  const ub = dev.createBuffer({ size: 512, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const samp = dev.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', addressModeU: 'repeat', addressModeV: 'repeat', maxAnisotropy: 8 });
  const skySamp = samp;
  const SAMPLES = 4;
  const bgl = dev.createBindGroupLayout({ entries: [
    { binding: 0, visibility: 3, buffer: {} }, { binding: 1, visibility: 3, sampler: {} },
    { binding: 2, visibility: 3, texture: {} }, { binding: 3, visibility: 3, texture: {} },
    { binding: 4, visibility: 1, buffer: { type: 'read-only-storage' } }, { binding: 5, visibility: 3, buffer: { type: 'read-only-storage' } },
    { binding: 6, visibility: 3, texture: { sampleType: 'depth' } }, { binding: 7, visibility: 3, sampler: { type: 'comparison' } }, { binding: 8, visibility: 1, buffer: { type: 'read-only-storage' } }, { binding: 9, visibility: 2, texture: {} }, { binding: 10, visibility: 2, texture: {} }, { binding: 11, visibility: 2, texture: {} }, { binding: 12, visibility: 2, texture: {} }, { binding: 13, visibility: 2, texture: {} }, { binding: 14, visibility: 2, texture: {} }, { binding: 15, visibility: 3, buffer: { type: 'read-only-storage' } }, { binding: 16, visibility: 2, texture: {} }, { binding: 17, visibility: 3, buffer: { type: 'read-only-storage' } } ] });
  const SM = 1024; const smTex = dev.createTexture({ size: [SM * 2, SM], format: 'depth32float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
  const cmpS = dev.createSampler({ compare: 'less-equal', magFilter: 'linear', minFilter: 'linear' });
  const bg = dev.createBindGroup({ layout: bgl, entries: [ { binding: 0, resource: { buffer: ub } }, { binding: 1, resource: skySamp },
    { binding: 2, resource: g.tex.createView() }, { binding: 3, resource: s.tex.createView() }, { binding: 4, resource: { buffer: fb } }, { binding: 5, resource: { buffer: cb } },
    { binding: 6, resource: smTex.createView() }, { binding: 7, resource: cmpS }, { binding: 8, resource: { buffer: tb } }, { binding: 9, resource: at.tex.createView() }, ...PT.map((t, i) => ({ binding: 10 + i, resource: t.tex.createView() })), { binding: 14, resource: CLU.tex.createView() }, { binding: 15, resource: { buffer: rkb } }, { binding: 16, resource: DIRT.tex.createView() }, { binding: 17, resource: { buffer: prb } } ] });
  const layout = dev.createPipelineLayout({ bindGroupLayouts: [bgl] });
  // v442 shadow passes: same bind group shape, own uniform (vp = cascade matrix), caster list, dummy depth at binding 6
  const dumD = dev.createTexture({ size: [1, 1], format: 'depth32float', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT });
  const TRSS = new Float32Array(TRD.length); const tbS = mk(TRD, GPUBufferUsage.STORAGE);
  const ubS = [0, 1].map(() => dev.createBuffer({ size: 512, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }));
  const bgS = ubS.map(b => dev.createBindGroup({ layout: bgl, entries: [ { binding: 0, resource: { buffer: b } }, { binding: 1, resource: skySamp },
    { binding: 2, resource: g.tex.createView() }, { binding: 3, resource: s.tex.createView() }, { binding: 4, resource: { buffer: fb } }, { binding: 5, resource: { buffer: cb } },
    { binding: 6, resource: dumD.createView() }, { binding: 7, resource: cmpS }, { binding: 8, resource: { buffer: tbS } }, { binding: 9, resource: at.tex.createView() }, ...PT.map((t, i) => ({ binding: 10 + i, resource: t.tex.createView() })), { binding: 14, resource: CLU.tex.createView() }, { binding: 15, resource: { buffer: rkb } }, { binding: 16, resource: DIRT.tex.createView() }, { binding: 17, resource: { buffer: prb } } ] }));
  const SHQ = qs.get('sh') !== '0';
  const pipe = (code, depthWrite, cull, bias) => { const m = dev.createShaderModule({ code });
    const ds = { format: 'depth24plus', depthWriteEnabled: depthWrite, depthCompare: depthWrite ? 'less' : 'less-equal' };
    if (bias) { ds.depthBias = 8; ds.depthBiasSlopeScale = 5.0; ds.depthBiasClamp = 0.04; }  // Art LOOK #5 — kill coplanar bank z-fight dashes
    return dev.createRenderPipeline({ layout, vertex: { module: m, entryPoint: 'vs' }, fragment: { module: m, entryPoint: 'fs', targets: [{ format: fmt }] },
      primitive: { topology: 'triangle-list', cullMode: cull }, multisample: { count: SAMPLES },
      depthStencil: ds }); };
  const pSky = pipe(SKY, false, 'none', false), pGround = pipe(GROUND, true, 'none', true), pGrass = pipe(GRASS, true, 'none', false), pTrees = pipe(TREES, true, 'none', false);
  const pm = dev.createShaderModule({ code: qs.get('lf') === '1' ? PROPS.replace('// v442: early alpha test', 'if (v.mt == 5u) { return vec4f(0.1, 0.3, 0.1, 1.0); }') : PROPS });
  const pipe3 = (vsn) => dev.createRenderPipeline({ layout, vertex: { module: pm, entryPoint: vsn }, fragment: { module: pm, entryPoint: 'fs', targets: [{ format: fmt }] }, primitive: { topology: 'triangle-list', cullMode: 'none' }, multisample: { count: SAMPLES }, depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' } });
  const pipeS = (vsn) => dev.createRenderPipeline({ layout, vertex: { module: pm, entryPoint: vsn }, fragment: { module: pm, entryPoint: 'fs_shadow', targets: [] }, primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less', depthBias: 1, depthBiasSlopeScale: 1.5 } });
  const pTreeS = pipeS('vs_tree'), pTreeLoS = pipeS('vs_treeMid'), pRockS = pipeS('vs_rock');
  const pTreeMid = pipe3('vs_treeMid'), pTreeFar = pipe3('vs_treeFar'), pRock = pipe3('vs_rock'), pFlower = pipe3('vs_flower'), pTree3 = pipe3('vs_tree');
  const am = dev.createShaderModule({ code: AIR }); const PB = { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } };
  const pipeA = (vsn) => dev.createRenderPipeline({ layout, vertex: { module: am, entryPoint: vsn }, fragment: { module: am, entryPoint: 'fs', targets: [{ format: fmt, blend: PB }] }, primitive: { topology: 'triangle-list', cullMode: 'none' }, multisample: { count: SAMPLES }, depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'less' } });
  const pMote = pipeA('vs_mote'), pSeed = pipeA('vs_seed'), pFly = pipeA('vs_fly'), pBird = pipeA('vs_bird'), pGlow = pipeA('vs_glow'), pTsh = pipeA('vs_tsh'), pIdleContact = pipeA('vs_idleContact');
  const AIRQ = qs.get('air') !== '0', N_MOTE = 800, N_SEED = 110, N_FLY = 9, N_BIRD = 27;
  const pPeb = pipe(PEB, true, 'none', false), pDust = pipeA('vs_dust'), pSplash = pipeA('vs_splash'), pMill = pipe3('vs_mill'), pMillS = pipeS('vs_mill');
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
const POSTFX = makePost(MEADOW.post);
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
${POSTFX.wgsl}
@fragment fn fs_final(v: PO) -> @location(0) vec4f {
  let dim = vec2f(textureDimensions(tS)); let ip = vec2i(v.uv * dim);
  var c = textureLoad(tS, ip, 0).rgb;
  // light far depth of field (sky + > ~120 m), linearised from the perspective depth
  let zd = textureLoad(tD, ip, 0); let n = 0.05; let f = 2000.0; let zl = n * f / (f - zd * (f - n));
  // DOF fold from m448dof: earlier+stronger far blur (far-band sharp ratio <0.8)
  let dof = ${FOG.dofExpr('zl')} * ${new URLSearchParams(location.search).get('dof') === '0' ? '0.0' : '1.0'};
  let dq = 3.5 / vec2f(textureDimensions(tA));
  let tblur = textureSampleLevel(tA, ls, v.uv, 0.0).rgb;
  let fb = (textureSampleLevel(tA, ls, v.uv + vec2f(dq.x, dq.y), 0.0).rgb + textureSampleLevel(tA, ls, v.uv + vec2f(-dq.x, dq.y), 0.0).rgb + textureSampleLevel(tA, ls, v.uv + vec2f(dq.x, -dq.y), 0.0).rgb + textureSampleLevel(tA, ls, v.uv - dq, 0.0).rgb) * 0.25;
  c = mix(c, mix(tblur, fb, 0.65), dof);
  // bloom (screen add, soft)
  let bl = textureSampleLevel(tB, ls, v.uv, 0.0).rgb; c = c + bl * 0.45 * (1.0 - c * 0.5);
  c = c + godRays(v.uv, tB, tD, dim) * (1.0 - c * 0.6);
  // filmic shoulder/toe on the display signal + grade: warm highlights, teal-cool shadows, gentle saturation, vignette
  var x = pow(clamp(c, vec3f(0), vec3f(1.2)), vec3f(2.2));
  x = x * 1.06; x = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14) * 1.12;   // re-shoulder
  x = gradeAAA(x, v.uv, dim);
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
  window.__meadowInfo = { trees: NTREE, ver: 'v448aaa3', route: 'C-card', ground: [g.w, g.h], sky: [s.w, s.h], V, F, tris: NI / 3, shadow: 'csm2+spriteBolt', blades: G * G + 150 * 150 + 130 * 130, W, H: Hh };

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
    { const wl = RIV.level(bp[0], bp[2]); const wd = wl - bp[1]; if (wd > 0.02) bp[1] -= Math.min(0.16, wd * 0.55); }  // wade: deeper sink so feet plant
    { const he = terrH(eye[0], eye[2]), ht = terrH(tgt[0], tgt[2]); const hc = (he + 2 * bp[1] + ht) / 4; eye[1] += Math.max(hc, he + 0.45 - 1.12 + 0.6); tgt[1] += (bp[1] * 2 + ht) / 3; }
    if (CINE) { // v443 cinematic camera (X clip): eased keyframes [t, orbit angle, distance, height, target height]
      const K = [[0,0.35,1.15,0.26,0.42],[2.5,0.15,1.5,0.34,0.48],[5.5,0,2.35,1.12,0.66],[10,0,2.6,1.2,0.66],[13,0.28,2.0,0.55,0.58],[16,-0.28,2.2,0.6,0.6],[19,0.25,1.7,0.42,0.55],[22,-0.22,1.8,0.45,0.55],[25.5,0.0,2.4,0.9,0.62],[29,0.25,7.5,3.6,1.6],[40,0.1,8.5,4.2,1.8]];
      let i = 0; while (i < K.length - 2 && t >= K[i + 1][0]) i++; const A = K[i], B = K[i + 1]; let k = Math.min(1, Math.max(0, (t - A[0]) / (B[0] - A[0]))); k = k * k * (3 - 2 * k);
      const P = A.map((v, j) => v + (B[j] - v) * k); const ca = st.cam + P[1]; const bw = [-Math.sin(ca), -Math.cos(ca)];
      eye[0] = bp[0] - bw[0] * P[2]; eye[2] = bp[2] - bw[1] * P[2]; const ge = terrH(eye[0], eye[2]); eye[1] = Math.max(ge + 0.18, (ge + bp[1]) / 2 + P[3]);
      tgt[0] = bp[0] + cf[0] * 0.6; tgt[2] = bp[2] + cf[2] * 0.6; tgt[1] = bp[1] + P[4]; }
    if (qs.get('mcam')) { const wx = MILL.wheelXZ, hs = MILL.house, a = +(qs.get('mcam')) + 0.15 * Math.sin(t * 0.25); const dx = wx[0] - hs[0], dz = wx[1] - hs[1], L = Math.hypot(dx, dz) || 1; const ux = dx / L, uz = dz / L;
      const D = +(qs.get('md') || 9); eye[0] = wx[0] + (ux * Math.cos(a) - uz * Math.sin(a)) * D; eye[2] = wx[1] + (uz * Math.cos(a) + ux * Math.sin(a)) * D; eye[1] = RIV.level(wx[0], wx[1]) + +(qs.get('mh') || 1.6); tgt[0] = wx[0]; tgt[2] = wx[1]; tgt[1] = RIV.level(wx[0], wx[1]) + 0.9; }
    if (qs.get('side') === '1') { eye[0] = bp[0] + cr[0] * 4.0; eye[1] = 0.9; eye[2] = bp[2] + cr[2] * 4.0; tgt[0] = bp[0]; tgt[1] = 0.7; tgt[2] = bp[2]; }
    const view = lookAt(eye, tgt, [0, 1, 0]); const proj = persp(62 * D2R, W / Hh, 0.05, 2000);
    const vp = mul(proj, view), ivp = inv(vp);
    const phase = (DEMO || CAP) && !LV ? phaseAt(t) : live.phase; const ff = (phase % 1) * F;
    const roll = Math.max(-MAX_ROLL, Math.min(MAX_ROLL, st.w * 0.15));
    const pitch = st.w, bob = (DEMO || CAP) && !LV ? SPEED : live.v;  // aaa2: bob carries speed for idle lift gate
    const gc = [eye[0] + cf[0] * 6.0, eye[2] + cf[2] * 6.0].map(v => Math.round(v / SP) * SP);
    const U = new Float32Array(128); U.set(vp, 0); U.set(ivp, 16);
    U.set([eye[0], eye[1], eye[2], t], 32); U.set([bp[0], bp[1], bp[2], st.psi], 36); U.set([roll, pitch, bob, ff], 40);
    U.set([gc[0], gc[1], SP, G], 44); U.set([...sun, 0], 48); U.set([V, F, 0, 0], 52);
    { const life = IDLE.sample(); IDLE.writeUniforms(U, life); if (qs.get('dbg') === '1') U[54] = 1; window.__idleLife = life; }
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
    return { U, st, roll };
  }
  function render(t) {
    const { U, st, roll } = frameState(t); dev.queue.writeBuffer(ub, 0, U); updatePrints(t);
    // v440 tree LOD on CPU: frustum + behind cull, near (<60 m) = full branching tree, mid (<170 m) = branches + big clusters, far = 1-crown LOD
    const fx = -Math.sin(st.cam), fz = -Math.cos(st.cam), ex = st.x - fx * 2.35, ez = st.z - fz * 2.35; let nN = 0, nM = 0, nF = 0; const mid = [], far = [];
    const tanH = Math.tan(31 * D2R) * W / Hh * 1.12;
    for (let i = 0; i < NTREE; i++) { const dx = TRD[i*4] - ex, dz = TRD[i*4+1] - ez, H = TRD[i*4+2]; const fd = dx * fx + dz * fz; if (fd < -H) continue;
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
        sp.setPipeline(pRockS); sp.draw(360, 144); sp.setPipeline(pMillS); sp.draw(MILL.verts);
        if (nS) { sp.setPipeline(pTreeS); sp.draw(25 * 30 + 58 * 12, nS); }
        if (ci === 1 && nFS) { sp.setPipeline(pTreeLoS); sp.draw(210 + 22 * 6, nFS, 0, nS); } }
      sp.end(); window.__shadowCasters = [nS, nFS]; }
    const pass = enc.beginRenderPass({ colorAttachments: [{ view: msaa.createView(), resolveTarget: (PQ ? sceneT : target).createView(), loadOp: 'clear', storeOp: 'discard', clearValue: [0.5, 0.68, 0.88, 1] }],
      depthStencilAttachment: { view: depth.createView(), depthLoadOp: 'clear', depthClearValue: 1, depthStoreOp: PQ ? 'store' : 'discard' } });
    pass.setBindGroup(0, bg);
    pass.setPipeline(pGround); pass.draw(6 * 128 * 128);
    pass.setPipeline(pTree3); if (nN && !NOTR && !NON) pass.draw(25 * 30 + 58 * 12, nN); pass.setPipeline(pTreeMid); if (nF - nM && !NOTR && !NOF) pass.draw(210 + 22 * 6, nF - nM, 0, nN + nM);   // 3D trees (old card pass pTrees kept unused)
    pass.setPipeline(pPeb); pass.draw(144, 960);
    pass.setPipeline(pRock); pass.draw(360, 144); pass.setPipeline(pMill); pass.draw(MILL.verts); pass.setPipeline(pFlower); pass.draw(21, 70 * 70);
    { const life = IDLE.sample(); if (life.idleAmt > 0.05) { pass.setPipeline(pIdleContact); pass.draw(6); } }
    pass.setPipeline(pBolt); pass.draw(6);
    if (qs.get('dbg') !== '1') { pass.setPipeline(pGrass); pass.draw(15, G * G); pass.draw(15, 150 * 150, 0, G * G); pass.draw(3, 130 * 130, 0, G * G + 150 * 150); }
    pass.setPipeline(pSky); pass.draw(3);
    pass.setPipeline(pDust); pass.draw(6, 288); pass.setPipeline(pSplash); pass.draw(6, 96);
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
    window.__sl = sampleLoop; window.__ph = phaseAt; window.__wade = (x, z) => RIV.level(x, z) - terrH(x, z); window.__STRIDE = STRIDE_HZ; window.__SPEED = SPEED; window.__IDLE = IDLE; window.__boltGpuTs = performance.now(); window.__meadowReady = true; return;
  }
  let t0 = performance.now(), last = t0;
  const loop = (now) => { const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now; if (!DEMO) stepLive(dt);
    const i = render(t); hud.textContent = `v448aaa3${DEMO ? ' · demo' : ''} · ${Math.round(((i.psi * 180 / Math.PI) % 360 + 360) % 360)}°`; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
main().catch(e => { hud.textContent = 'ERR ' + e; console.error(e); window.__meadowErr = String(e); });

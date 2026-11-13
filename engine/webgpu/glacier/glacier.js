// Glacier abyss candidate. Dawn rig, procedural ice albedo, live bolt439 card.
// Not on a live route. The page stays blank unless candidate=glacier-abyss-dawn.
import { boltIdle } from '../bricks/bolt-idle.js';
import { followEye, lookAt, persp, mul, FOV_Y } from '../engine/bricks/follow-cam.js';
import { invertMat4 } from '../biome-factory/mat4.js';
import { lightWgsl, norm3, sunOf } from '../biome-factory/light-rig.js';
import { skyWgsl } from '../biome-factory/procedural-sky.js';
import { albedoWgsl } from './albedo.js';
import { CANDIDATE, GLACIER, LIGHT, DRAWS, planetCenter, PLANET, FLAKES } from './biome.js';
import { buildWorld, chaseInput, integrate, spawn, pathX, floorH } from './world.js';

const qs = new URLSearchParams(location.search);
const CAP = qs.get('cap') === '1';
const DEMO = qs.get('demo') === '1' || CAP;
const SHOT = qs.get('shot');
const hud = document.getElementById('hud');
if (CAP && hud) hud.style.display = 'none';

const canvas = document.getElementById('c');
const W = Number(qs.get('w')) || 720;
const H = Number(qs.get('h')) || 1280;
canvas.width = W;
canvas.height = H;

let gatePose = null;
let gateMode = 0;
let gateBreak = 0;
let skySwim = 0;
let skyYaw = 0;
let simClock = 0;

const IDLE = boltIdle();
const world = buildWorld();
const live = spawn();
const held = new Set();
const ptrs = new Map();
const sunDir = norm3(sunOf(LIGHT).direction);
const pCenter = planetCenter();

function playerInput() {
  let t = 0;
  if (['a', 'arrowleft', 'q'].some((k) => held.has(k))) t += 1;
  if (['d', 'arrowright'].some((k) => held.has(k))) t -= 1;
  for (const v of ptrs.values()) t += v;
  const run = ['w', 'arrowup', ' '].some((k) => held.has(k)) || ptrs.size > 0;
  return { turn: Math.max(-1, Math.min(1, t)), run };
}

const FLAKE_N = FLAKES.near + FLAKES.mid + FLAKES.far + FLAKES.blow + FLAKES.puff;
const FLAKE_SNOW = FLAKE_N - FLAKES.puff;
const flakes = new Float32Array(FLAKE_N * 8);
const flakeVel = new Float32Array(FLAKE_N * 3);
let puffArm = 0;
const HALF_W = Math.atan(Math.tan(FOV_Y / 2) * (W / H));
const HALF_H = FOV_Y / 2;
function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function flakeKind(i) {
  if (i < FLAKES.near) return 0;
  if (i < FLAKES.near + FLAKES.mid) return 1;
  if (i < FLAKES.near + FLAKES.mid + FLAKES.far) return 2;
  if (i < FLAKE_SNOW) return 3;
  return 4;
}
function camBox() {
  const bp = [live.x, floorH(live.x, live.z), live.z];
  const { eye, cf, cr } = followEye(bp, live.cam, floorH, 0);
  return { eye, cf, cr };
}
function curlAt(x, y, z) {
  const t = simClock;
  const a = Math.sin(x * 0.31 + t * 1.1);
  const b = Math.sin(y * 0.37 + t * 0.8 + 2.1);
  const c = Math.sin(z * 0.23 - t * 0.9 + 1.1);
  const d = Math.sin((x + z) * 0.19 + y * 0.15 + t * 1.4);
  const e = Math.sin(x * 0.53 - y * 0.41 + t * 1.7);
  return [b - d * 0.7 + e * 0.6, c * 0.9 + a * 0.8 - d * 0.4, a - b * 0.5 + d];
}
function gustAt(t) {
  const u = (t % 9) / 9;
  if (u < 0.42) return 0.08;
  if (u < 0.55) return 0.08 + (u - 0.42) / 0.13 * 0.92;
  if (u < 0.78) return 1;
  return Math.max(0.08, 1 - (u - 0.78) / 0.22 * 0.92);
}
function screenPx(depth, seed, low) {
  const focal = (H / 2) / Math.tan(HALF_H);
  const d = Math.max(0.4, depth);
  let px;
  if (d < 2.4) px = low ? 2.4 + seed * 2.2 : 6 + seed * 4;
  else if (d < 8) px = low ? 1.8 + seed * 2.2 : 3 + seed * 3;
  else px = 1 + seed * 1.2;
  return (px / focal) * d;
}
function seedFlake(i, cam) {
  const kind = flakeKind(i);
  const o = i * 8;
  if (kind === 4) {
    flakes[o + 3] = 0;
    flakes[o + 4] = 0.12;
    flakes[o + 5] = 2;
    flakes[o + 6] = 1;
    flakes[o + 7] = 0;
    return;
  }
  const h = hash(i * 1.7 + simClock * 0.17, 4.2);
  const h2 = hash(i * 3.1, simClock * 0.13 + 9.4);
  const h3 = hash(i * 5.3, 2.2);
  let depth;
  let layer;
  let v;
  if (kind === 0) {
    depth = 0.8 + h * 3.2;
    layer = 0;
    v = h3 * 2 - 1;
  } else if (kind === 1) {
    depth = 3.5 + h * 8;
    layer = 0.4;
    v = h3 * 2 - 1;
  } else if (kind === 2) {
    depth = 10 + h * 22;
    layer = 1;
    v = h3 * 2 - 1;
  } else {
    depth = 1.4 + h * 6;
    layer = 3;
    v = -0.2 - h3 * 0.7;
  }
  const size = screenPx(depth, h3, v < 0);
  const u = h2 * 2 - 1;
  const span = kind === 3 ? 1.05 : 1.22;
  const halfW = Math.tan(HALF_W) * depth * span;
  const halfH = Math.tan(HALF_H) * depth * span;
  const x = cam.eye[0] + cam.cf[0] * depth + cam.cr[0] * u * halfW;
  const z = cam.eye[2] + cam.cf[2] * depth + cam.cr[2] * u * halfW;
  let y = cam.eye[1] + v * halfH;
  const ground = floorH(x, z);
  if (kind === 3) y = ground + 0.12 + h * 1.15;
  else if (y < ground + 0.08) y = ground + 0.08 + h * 0.4;
  flakes[o] = x;
  flakes[o + 1] = y;
  flakes[o + 2] = z;
  flakes[o + 3] = 0.02;
  flakes[o + 4] = size;
  flakes[o + 5] = layer;
  flakes[o + 6] = 0;
  flakes[o + 7] = h3;
}
function flakeInside(i, cam) {
  const o = i * 8;
  const dx = flakes[o] - cam.eye[0];
  const dy = flakes[o + 1] - cam.eye[1];
  const dz = flakes[o + 2] - cam.eye[2];
  const depth = dx * cam.cf[0] + dz * cam.cf[2];
  const kind = flakeKind(i);
  const far = kind === 2 ? 36 : (kind === 0 ? 7.5 : 16);
  if (depth < 0.35 || depth > far) return false;
  const rx = dx * cam.cr[0] + dz * cam.cr[2];
  const halfW = Math.tan(HALF_W) * depth * 1.35;
  const halfH = Math.tan(HALF_H) * depth * 1.35;
  return Math.abs(rx) < halfW && Math.abs(dy) < halfH;
}
function stepFlakes(dt) {
  const cam = camBox();
  if (flakes[4] === 0) {
    for (let i = 0; i < FLAKE_N; i++) seedFlake(i, cam);
  }
  const strike = Math.floor(live.phase * 2);
  if (simClock > 1.15 && strike !== puffArm) {
    puffArm = strike;
    const yaw = live.psi;
    const rx = -Math.cos(yaw);
    const rz = Math.sin(yaw);
    for (let k = 0; k < 2; k++) {
      const slot = FLAKE_SNOW + (Math.abs(strike) * 2 + k) % FLAKES.puff;
      const side = k === 0 ? 0.11 : -0.11;
      const px = live.x + rx * side;
      const pz = live.z + rz * side;
      flakes[slot * 8] = px;
      flakes[slot * 8 + 1] = floorH(px, pz) + 0.03;
      flakes[slot * 8 + 2] = pz;
      flakes[slot * 8 + 3] = 0.02;
      flakes[slot * 8 + 4] = 0.025;
      flakes[slot * 8 + 5] = 2;
      flakes[slot * 8 + 6] = 1;
      flakes[slot * 8 + 7] = side;
    }
  }
  const g = gustAt(simClock);
  const wind = [0.2 + g * 2.6, -0.28 + g * 0.1, 0.08 + g * 0.85];
  for (let i = 0; i < FLAKE_N; i++) {
    const o = i * 8;
    const puff = flakes[o + 6] > 0.5;
    if (puff) {
      if (flakes[o + 7] === 0) { flakes[o + 3] = 0; continue; }
      const age = flakes[o + 3] + dt / 0.6;
      if (age >= 1) { flakes[o + 3] = 0; flakes[o + 7] = 0; continue; }
      flakes[o + 3] = age;
      const dir = flakes[o + 7] < 0 ? -1 : 1;
      flakes[o] += dir * dt * 0.16;
      flakes[o + 1] += dt * (0.7 + age * 0.35);
      flakes[o + 2] += dt * 0.04;
      flakes[o + 4] = 0.022 + age * 0.045;
      continue;
    }
    if (flakes[o + 3] < 1) flakes[o + 3] = Math.min(1, flakes[o + 3] + dt / 0.35);
    const curl = curlAt(flakes[o], flakes[o + 1], flakes[o + 2]);
    const flutter = Math.sin(simClock * (5 + (i % 4)) + i * 0.7) * (0.25 + g * 1.1);
    const blow = flakeKind(i) === 3;
    const up = flakes[o + 7] > 0.8 ? 0.55 + g * 1.4 : 0;
    const speed = blow ? 0.7 + g * 1.8 : (flakeKind(i) === 2 ? 0.45 : 0.75 + g * 0.4);
    const vx = (wind[0] + curl[0] * (0.9 + g) + flutter) * speed;
    const vy = wind[1] + curl[1] * (0.7 + g * 0.8) + up + flutter * 0.2;
    const vz = (wind[2] + curl[2] * (0.8 + g) - flutter * 0.35) * speed;
    flakeVel[i * 3] = vx;
    flakeVel[i * 3 + 1] = vy;
    flakeVel[i * 3 + 2] = vz;
    flakes[o] += vx * dt;
    flakes[o + 1] += vy * dt;
    flakes[o + 2] += vz * dt;
    const depthNow = Math.max(0.45, (flakes[o] - cam.eye[0]) * cam.cf[0] + (flakes[o + 2] - cam.eye[2]) * cam.cf[2]);
    flakes[o + 4] = screenPx(depthNow, flakes[o + 7], flakes[o + 1] < cam.eye[1] - 0.15);
    if (flakes[o + 1] < 4) {
      const ground = floorH(flakes[o], flakes[o + 2]);
      if (flakes[o + 1] < ground + 0.05) flakes[o + 1] = ground + 0.05;
    }
    if (!flakeInside(i, cam) || (blow && flakes[o + 1] - floorH(flakes[o], flakes[o + 2]) > 2.2)) seedFlake(i, cam);
  }
}
function pawGround() {
  const yaw = live.psi;
  const rx = -Math.cos(yaw);
  const rz = Math.sin(yaw);
  const left = world.heightAt(live.x - rx * 0.11, live.z - rz * 0.11);
  const right = world.heightAt(live.x + rx * 0.11, live.z + rz * 0.11);
  return Math.min(left, right);
}
function stepLive(dt) {
  const input = DEMO ? chaseInput(simClock, live) : playerInput();
  simClock += dt;
  IDLE.stepMotion(live, dt, input.run);
  integrate(live, dt, input);
  stepFlakes(dt);
  return live;
}

const WGSL = /* wgsl */`
struct U {
  vp: mat4x4f, ivp: mat4x4f, cam: vec4f, bolt: vec4f, bp: vec4f, grid: vec4f, sun: vec4f, misc: vec4f, spin: vec4f, planet: vec4f,
};
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var atex: texture_2d<f32>;
@group(0) @binding(3) var snowArr: texture_2d_array<f32>;
@group(0) @binding(4) var iceArr: texture_2d_array<f32>;
@group(0) @binding(5) var planetTex: texture_2d<f32>;
@group(0) @binding(6) var fallArr: texture_2d_array<f32>;
@group(0) @binding(7) var archArr: texture_2d_array<f32>;
@group(0) @binding(8) var seracArr: texture_2d_array<f32>;
struct VO { @builtin(position) p: vec4f, @location(0) w: vec3f, @location(1) n: vec3f, @location(2) uv: vec2f, @location(3) mat: f32, @location(4) lit: vec3f };
struct SO { @builtin(position) p: vec4f, @location(0) ndc: vec2f };
struct BO { @builtin(position) p: vec4f, @location(0) uv: vec2f, @location(1) w: vec3f };
struct CO { @builtin(position) p: vec4f, @location(0) uv: vec2f, @location(1) k: f32 };

${lightWgsl(LIGHT)}
${skyWgsl(LIGHT.sky)}
${albedoWgsl()}
${IDLE.wgsl}

@vertex fn vs(@location(0) a: vec4f, @location(1) b: vec4f) -> VO {
  var o: VO;
  o.p = u.vp * vec4f(a.xyz, 1.0);
  o.w = a.xyz; o.n = b.xyz; o.uv = vec2f(b.w, a.w); o.mat = a.w; o.lit = b.xyz;
  return o;
}
@vertex fn vsWorld(@location(0) a: vec4f, @location(1) b: vec4f, @location(4) shade: vec3f) -> VO {
  var o: VO;
  o.p = u.vp * vec4f(a.xyz, 1.0);
  o.w = a.xyz; o.n = b.xyz; o.uv = vec2f(b.w, a.w); o.mat = a.w; o.lit = shade;
  return o;
}
@vertex fn vsInst(@location(0) a: vec4f, @location(1) b: vec4f, @location(2) i0: vec4f, @location(3) i1: vec4f) -> VO {
  let sc = i1.xyz;
  let p0 = vec3f(a.x * sc.x, a.y * sc.y, a.z * sc.z);
  let cl = cos(i1.w); let sl = sin(i1.w);
  let pL = vec3f(cl * p0.x - sl * p0.y, sl * p0.x + cl * p0.y, p0.z);
  let nL = vec3f(cl * b.x - sl * b.y, sl * b.x + cl * b.y, b.z);
  let c = cos(i0.w); let s = sin(i0.w);
  let pr = vec3f(c * pL.x + s * pL.z, pL.y, -s * pL.x + c * pL.z) + i0.xyz;
  let nr = normalize(vec3f(c * nL.x + s * nL.z, nL.y, -s * nL.x + c * nL.z));
  var o: VO;
  o.p = u.vp * vec4f(pr, 1.0);
  o.w = pr; o.n = nr; o.lit = nr; o.uv = vec2f(b.w, 0.0); o.mat = a.w;
  return o;
}
@vertex fn vsSky(@builtin(vertex_index) vi: u32) -> SO {
  var q = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var o: SO;
  o.p = vec4f(q[vi], 0.0, 1.0);
  o.ndc = q[vi];
  return o;
}
fn darken15(c: vec3f) -> vec3f {
  let y = max(dot(c, vec3f(0.2126, 0.7152, 0.0722)), 1e-5);
  let L = 116.0 * pow(y, 1.0 / 3.0) - 16.0;
  let L2 = L - 15.0;
  if (L2 < 2.0) { return c * vec3f(0.35, 0.12, 0.55) + vec3f(0.05, 0.0, 0.03); }
  let y2 = pow((L2 + 16.0) / 116.0, 3.0);
  return c * (y2 / y);
}
@fragment fn fsSky(v: SO) -> @location(0) vec4f {
  let hw = u.ivp * vec4f(v.ndc, 1.0, 1.0);
  var sky = skyColour(normalize(hw.xyz / hw.w - u.cam.xyz));
  if (u.spin.z > 0.5) {
    let s = clamp(v.p.x / 720.0, 0.0, 1.0);
    sky = sky + vec3f(0.045, 0.02, 0.07) * s + vec3f(0.03, 0.0, 0.05) * fract(u.spin.w * 0.37);
  }
  if (u.misc.z > 0.5 && u.misc.z < 1.5) { return vec4f(5.5 / 8.0, 1.0, 1.0, 1.0); }
  return present(sky);
}
@fragment fn fs(v: VO) -> @location(0) vec4f {
  let gx = dpdx(v.w);
  let gy = dpdy(v.w);
  let nUv = normalize(v.n);
  var n = normalize(v.lit);
  let m = v.mat;
  let dist = length(v.w - u.cam.xyz);
  let alb = albedoOf(m, v.w, nUv, gx, gy);
  let view = normalize(u.cam.xyz - v.w);
  let ndv = clamp(dot(n, view), 0.0, 1.0);
  let ndl = clamp(dot(n, sunN()), 0.0, 1.0);
  let mode = u.misc.z;
  if (mode > 1.5) { return present(alb); }
  if (mode > 0.5 && mode < 1.5) {
    let near = select(0.0, 1.0, dist < 40.0);
    return vec4f((m + 0.5) / 8.0, ndl, clamp(n.y, 0.0, 1.0), ndv * near);
  }
  var nLit = n;
  if (u.sun.w > 5.5 && u.sun.w < 6.5 && m < 0.5) { nLit = vec3f(0.0, 1.0, 0.0); }
  var col = litIce(alb, nLit, view);
  let iceEdge = smoothstep(0.52, 0.06, ndv) * ndl;
  if ((m > 0.5 && m < 3.5) || (m > 5.5 && m < 6.5)) {
    col = col + vec3f(0.03, 0.08, 0.16) * iceEdge;
    let shade = 1.0 - smoothstep(0.02, 0.32, ndl);
    let rim = pow(1.0 - ndv, 1.8) * smoothstep(0.55, 0.18, ndv);
    col = col + alb * vec3f(0.20, 0.26, 0.38) * shade;
    col = col + alb * vec3f(0.42, 0.52, 0.70) * rim * 0.7;
  }
  // Run 11 dither. Walls, arches, falls, and distant rock fade in by noise.
  // Snow is not discarded, so the horizon ridge stays solid. No fog.
  if ((m > 0.5 && m < 2.5) || (m > 5.5 && m < 7.5)) {
    let cover = smoothstep(460.0, 160.0, dist);
    let n = fract(sin(dot(v.p.xy, vec2f(12.9898, 78.233))) * 43758.5453);
    if (cover < n) { discard; }
  }
  let aerial = smoothstep(280.0, 6200.0, dist);
  let horizon = skyColour(normalize(v.w - u.cam.xyz));
  col = mix(col, horizon, aerial * 0.62);
  if (m > 6.5 && m < 7.5) {
    let rim = pow(1.0 - ndv, 1.6) * smoothstep(0.0, 0.35, ndl);
    let head = max(col.r, max(col.g, col.b));
    col = col + vec3f(0.9, 0.36, 0.22) * rim * clamp(1.15 - head, 0.0, 1.0) * (1.0 - aerial * 0.25);
  }
  if (u.misc.w > 0.5 && abs(m - (u.misc.w - 1.0)) < 0.25) { col = darken15(col); }
  return present(col);
}
@fragment fn fsPlanet(v: VO) -> @location(0) vec4f {
  let n = normalize(v.n);
  let q = normalize(v.w - u.planet.xyz);
  let uv = vec2f(atan2(q.z, q.x) * 0.1591549 + 0.5, asin(clamp(q.y, -1.0, 1.0)) * 0.31831 + 0.5);
  let alb = textureSampleGrad(planetTex, samp, uv, dpdx(uv), dpdy(uv)).rgb;
  let view = normalize(u.cam.xyz - v.w);
  let ndv = clamp(dot(n, view), 0.0, 1.0);
  var col = alb * dawnIrr(n);
  let limb = smoothstep(0.0, 0.22, ndv);
  col = col * mix(0.22, 1.0, limb);
  return present(min(col, vec3f(0.9)));
}
@vertex fn vsBolt(@builtin(vertex_index) vi: u32) -> BO {
  var q = array<vec2f, 6>(vec2f(-0.5, 0), vec2f(0.5, 0), vec2f(0.5, 1), vec2f(-0.5, 0), vec2f(0.5, 1), vec2f(-0.5, 1));
  let c = q[vi]; let b = vec3f(u.bolt.x, u.bolt.y, u.bolt.z);
  let toE = normalize(vec2f(u.cam.x - b.x, u.cam.z - b.z)); let rt = vec3f(-toE.y, 0.0, toE.x);
  let lr = idleCardLy(c); let lx = lr.x; let ly = lr.y - u.spin.x;
  let cr = cos(u.bp.x); let sr = -sin(u.bp.x);
  let rx = lx * cr - ly * sr; let ry = lx * sr + ly * cr;
  let w = b + rt * rx + vec3f(0.0, ry, 0.0);
  var o: BO; o.p = u.vp * vec4f(w, 1.0); o.uv = vec2f(-c.x + 0.5, 1.0 - c.y); o.w = w; return o;
}
fn cell(f: u32, uv: vec2f) -> vec4f {
  let g = vec2f(f32(f % 8u), f32(f / 8u));
  return textureSampleLevel(atex, samp, (g + clamp(uv, vec2f(0.003), vec2f(0.997))) / vec2f(8.0, 4.0), 0.0);
}
@fragment fn fsBolt(v: BO) -> @location(0) vec4f {
  let ff = u.bp.w; let a = u32(floor(ff)) % 32u; let bb = (a + 1u) % 32u; let k = fract(ff);
  let gph = ff / 32.0 * 6.2831853; let lw = smoothstep(0.60, 0.88, v.uv.y); let sw = smoothstep(0.40, 0.60, v.uv.x);
  let spd = u.bp.z;
  let lift = 0.045 * lw * ((1.0 - sw) * max(sin(gph), 0.0) + sw * max(-sin(gph), 0.0)) * smoothstep(0.25, 1.2, spd) * (1.0 - u.misc.x);
  let uvs = idleTailUV(v.uv + vec2f(0.0, lift));
  let s = mix(cell(a, uvs), cell(bb, uvs), k);
  if (s.a < select(0.12, 0.04, u.misc.y > 0.001)) { discard; }
  var c = s.rgb;
  c = mix(c, vec3f(dot(c, vec3f(0.3, 0.59, 0.11))), 0.12) * 1.08;
  let hgt = v.w.y - u.bolt.y;
  let bounce = max(u.grid.xyz, vec3f(0.55));
  c *= mix(vec3f(1.0), bounce, smoothstep(0.34, 0.02, hgt) * 0.22);
  c *= mix(0.82, 1.0, smoothstep(-0.02, 0.25, hgt));
  return vec4f(pow(clamp(c, vec3f(0.0), vec3f(1.0)), vec3f(1.0 / 2.2)), s.a);
}
@vertex fn vsContact(@builtin(vertex_index) vi: u32) -> CO {
  var q = array<vec2f, 6>(vec2f(-1, -1), vec2f(1, -1), vec2f(1, 1), vec2f(-1, -1), vec2f(1, 1), vec2f(-1, 1));
  let corner = vi % 6u;
  let which = vi / 6u;
  let c = q[corner];
  let b = u.bolt;
  let psi = b.w;
  let fwd = vec2f(-sin(psi), -cos(psi));
  let right = vec2f(fwd.y, -fwd.x);
  var w: vec3f;
  var kind = 0.0;
  if (which == 0u) {
    w = vec3f(b.x + right.x * (c.x * 0.09 - 0.11) + fwd.x * c.y * 0.05, b.y + 0.02, b.z + right.y * (c.x * 0.09 - 0.11) + fwd.y * c.y * 0.06);
  } else if (which == 1u) {
    w = vec3f(b.x + right.x * (c.x * 0.09 + 0.11) + fwd.x * c.y * 0.05, b.y + 0.02, b.z + right.y * (c.x * 0.09 + 0.11) + fwd.y * c.y * 0.06);
    kind = 1.0;
  } else {
    let n = f32(which - 2u);
    let sway = select(-0.12, 0.12, (which & 1u) == 0u);
    let dist = 0.65 + n * 0.28;
    w = vec3f(b.x - fwd.x * dist + right.x * (c.x * 0.16 + sway), b.y + 0.1, b.z - fwd.y * dist + right.y * (c.x * 0.16 + sway));
    kind = 2.0;
  }
  var o: CO; o.p = u.vp * vec4f(w, 1.0); o.uv = c; o.k = kind; return o;
}
@fragment fn fsContact(v: CO) -> @location(0) vec4f {
  let r2 = dot(v.uv, v.uv); if (r2 > 1.0) { discard; }
  let paw = (1.0 - smoothstep(0.05, 1.0, r2)) * 0.62;
  let shade = (1.0 - smoothstep(0.05, 1.0, r2)) * 0.55;
  let print = (1.0 - smoothstep(0.08, 0.95, r2)) * 0.7;
  let blob = mix(paw, shade, step(0.5, v.k));
  let a = select(blob, print, v.k > 1.5);
  return vec4f(0.02, 0.025, 0.04, a);
}
struct FO { @builtin(position) p: vec4f, @location(0) uv: vec2f, @location(1) fade: f32, @location(2) layer: f32, @location(3) seed: f32 };
@vertex fn vsFlake(@builtin(vertex_index) vi: u32, @location(0) a: vec4f, @location(1) b: vec4f) -> FO {
  var q = array<vec2f, 6>(vec2f(-1, -1), vec2f(1, -1), vec2f(1, 1), vec2f(-1, -1), vec2f(1, 1), vec2f(-1, 1));
  let c = q[vi % 6u];
  let toC = u.cam.xyz - a.xyz;
  let to = normalize(toC);
  let right = normalize(cross(vec3f(0.0, 1.0, 0.0), to));
  let up = cross(to, right);
  let ang = b.w * 6.28318 + u.cam.w * (2.2 + b.w * 5.0);
  let ca = cos(ang);
  let sa = sin(ang);
  let rx = c.x * ca - c.y * sa;
  let ry = c.x * sa + c.y * ca;
  let near = b.z < 0.15;
  let motion = vec3f(sin(a.w), 0.04, cos(a.w));
  let streak = select(0.0, b.x * 1.15, near && a.y > u.cam.y);
  let wpos = a.xyz + right * rx * b.x + up * ry * b.x + motion * ry * streak;
  var o: FO;
  o.p = u.vp * vec4f(wpos, 1.0);
  o.uv = c;
  o.fade = b.y;
  o.layer = b.z;
  o.seed = b.w;
  return o;
}
@fragment fn fsFlake(v: FO) -> @location(0) vec4f {
  let puff = v.layer > 1.5 && v.layer < 2.5;
  let near = v.layer < 0.15;
  let e = v.uv * vec2f(1.0, select(1.0, 0.38, near));
  let r = length(e);
  if (r > 1.0) { discard; }
  let soft = pow(1.0 - smoothstep(0.0, 1.0, r), select(1.35, 1.05, puff));
  let uv = vec2f(v.seed, 0.41) + v.uv * select(0.12, 0.06, v.layer > 0.5);
  let tex = textureSampleLevel(snowArr, samp, uv, 0, 1.0);
  let sun = normalize(u.sun.xyz);
  let lit = 0.62 + 0.38 * clamp(dot(sun, vec3f(0.15, 0.95, 0.2)), 0.0, 1.0);
  var col = mix(vec3f(0.9, 0.94, 1.0), tex.rgb, 0.22) * lit;
  col = min(col, vec3f(0.9));
  var gain = 0.82;
  if (v.layer > 2.5) { gain = 0.62; }
  else if (v.layer > 1.5) {
    col = min(vec3f(0.9, 0.94, 0.98) * lit, vec3f(0.9));
    gain = 0.72;
  } else if (v.layer > 0.7) { gain = 0.55; }
  else if (v.layer > 0.2) { gain = 0.74; }
  let a = soft * v.fade * gain;
  return vec4f(col, a);
}
`;

function establishEye() {
  const z = -700;
  return {
    eye: [pathX(30), 155, 50],
    tgt: [pathX(z), 36, z],
  };
}

async function main() {
  if (qs.get('candidate') !== CANDIDATE) {
    if (hud) hud.textContent = 'HOLD — isolated candidate. ?candidate=' + CANDIDATE;
    window.__glacierReady = false;
    window.__glacierErr = 'candidate flag required';
    return;
  }
  const ad = await navigator.gpu.requestAdapter();
  if (!ad) {
    window.__glacierErr = 'No WebGPU';
    window.__glacierReady = false;
    return;
  }
  if (!ad.features.has('texture-compression-astc')) {
    window.__glacierErr = 'texture-compression-astc missing';
    window.__glacierReady = false;
    return;
  }
  const dev = await ad.requestDevice({ requiredFeatures: ['texture-compression-astc'] });
  window.__glacierGpu = {
    features: [...dev.features],
    maxTextureDimension2D: ad.limits.maxTextureDimension2D,
    maxSamplerAnisotropy: ad.limits.maxSamplerAnisotropy,
  };
  const ctx = canvas.getContext('webgpu');
  const fmt = 'rgba8unorm';
  ctx.configure({
    device: dev, format: fmt, alphaMode: 'opaque',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST,
  });

  const res = await fetch(new URL(GLACIER.bolt, import.meta.url).href);
  if (!res.ok) throw new Error('bolt atlas missing');
  const bmp = await createImageBitmap(await res.blob(), { colorSpaceConversion: 'none' });
  const atlas = dev.createTexture({
    size: [bmp.width, bmp.height], format: 'rgba8unorm-srgb',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  dev.queue.copyExternalImageToTexture({ source: bmp }, { texture: atlas }, [bmp.width, bmp.height]);
  function srgbToLin(u) {
    const x = u / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  }
  function linToSrgb(x) {
    const y = x <= 0.0031308 ? x * 12.92 : 1.055 * (x ** (1 / 2.4)) - 0.055;
    return Math.max(0, Math.min(255, Math.round(y * 255)));
  }
  // Box-filter in linear light. A bitmap resize of the original aliases the
  // fine bubbles into salt at the mip the wall actually samples.
  async function mipCanvases(bitmap) {
    const base = new OffscreenCanvas(bitmap.width, bitmap.height);
    const bctx = base.getContext('2d', { willReadFrequently: true });
    bctx.drawImage(bitmap, 0, 0);
    const out = [base];
    let w = bitmap.width;
    let h = bitmap.height;
    let ctx = bctx;
    while (w > 1 || h > 1) {
      const src = ctx.getImageData(0, 0, w, h).data;
      const nw = Math.max(1, w >> 1);
      const nh = Math.max(1, h >> 1);
      const dst = new Uint8ClampedArray(nw * nh * 4);
      for (let y = 0; y < nh; y++) {
        for (let x = 0; x < nw; x++) {
          let r = 0, g = 0, b = 0, a = 0, n = 0;
          for (let dy = 0; dy < 2; dy++) {
            for (let dx = 0; dx < 2; dx++) {
              const sx = Math.min(w - 1, x * 2 + dx);
              const sy = Math.min(h - 1, y * 2 + dy);
              const i = (sy * w + sx) * 4;
              r += srgbToLin(src[i]);
              g += srgbToLin(src[i + 1]);
              b += srgbToLin(src[i + 2]);
              a += src[i + 3];
              n++;
            }
          }
          const o = (y * nw + x) * 4;
          dst[o] = linToSrgb(r / n);
          dst[o + 1] = linToSrgb(g / n);
          dst[o + 2] = linToSrgb(b / n);
          dst[o + 3] = a / n;
        }
      }
      const next = new OffscreenCanvas(nw, nh);
      const nctx = next.getContext('2d', { willReadFrequently: true });
      nctx.putImageData(new ImageData(dst, nw, nh), 0, 0);
      out.push(next);
      ctx = nctx;
      w = nw;
      h = nh;
    }
    return out;
  }
  async function loadAlbedo(file) {
    const res = await fetch(new URL(file, import.meta.url).href);
    if (!res.ok) throw new Error('albedo missing ' + file);
    const img = await createImageBitmap(await res.blob(), { colorSpaceConversion: 'none' });
    const mips = await mipCanvases(img);
    const tex = dev.createTexture({
      size: [img.width, img.height], mipLevelCount: mips.length, format: 'rgba8unorm-srgb',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    for (let level = 0; level < mips.length; level++) {
      const src = mips[level];
      dev.queue.copyExternalImageToTexture({ source: src }, { texture: tex, mipLevel: level }, [src.width, src.height]);
    }
    return tex;
  }
  async function loadArray(files) {
    const imgs = [];
    for (const file of files) {
      const res = await fetch(new URL(file, import.meta.url).href);
      if (!res.ok) throw new Error('albedo missing ' + file);
      imgs.push(await createImageBitmap(await res.blob(), { colorSpaceConversion: 'none' }));
    }
    const w0 = imgs[0].width;
    const h0 = imgs[0].height;
    const chains = [];
    for (const img of imgs) chains.push(await mipCanvases(img));
    const levels = chains[0].length;
    const tex = dev.createTexture({
      size: [w0, h0, imgs.length], mipLevelCount: levels, format: 'rgba8unorm-srgb',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    for (let layer = 0; layer < chains.length; layer++) {
      for (let level = 0; level < levels; level++) {
        const src = chains[layer][level];
        dev.queue.copyExternalImageToTexture({ source: src }, { texture: tex, mipLevel: level, origin: [0, 0, layer] }, [src.width, src.height]);
      }
    }
    return tex;
  }
  async function loadAstcArray(files) {
    const layers = [];
    for (const file of files) {
      const res = await fetch(new URL(file, import.meta.url).href);
      if (!res.ok) throw new Error('albedo missing ' + file);
      const buf = await res.arrayBuffer();
      const view = new DataView(buf);
      const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
      if (magic !== 'AST4') throw new Error('bad atlas ' + file);
      const count = view.getUint32(12, true);
      const levels = [];
      let o = 16;
      for (let i = 0; i < count; i++) {
        const w = view.getUint32(o, true);
        const h = view.getUint32(o + 4, true);
        const n = view.getUint32(o + 8, true);
        o += 12;
        levels.push({ w, h, data: new Uint8Array(buf, o, n) });
        o += n;
      }
      layers.push(levels);
    }
    const base = layers[0][0];
    let gpuBytes = 0;
    for (const levels of layers) for (const mip of levels) gpuBytes += mip.data.byteLength;
    window.__glacierSnowBytes = gpuBytes;
    const tex = dev.createTexture({
      size: [base.w, base.h, layers.length],
      mipLevelCount: layers[0].length,
      format: 'astc-4x4-unorm-srgb',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    for (let layer = 0; layer < layers.length; layer++) {
      for (let level = 0; level < layers[layer].length; level++) {
        const mip = layers[layer][level];
        const blocksX = mip.w >> 2;
        const blocksY = mip.h >> 2;
        const rowBytes = blocksX * 16;
        const padded = (rowBytes + 255) & ~255;
        let data = mip.data;
        if (padded !== rowBytes) {
          const packed = new Uint8Array(padded * blocksY);
          for (let y = 0; y < blocksY; y++) packed.set(mip.data.subarray(y * rowBytes, y * rowBytes + rowBytes), y * padded);
          data = packed;
        } else if (data.byteOffset !== 0) {
          data = data.slice();
        }
        dev.queue.writeTexture(
          { texture: tex, mipLevel: level, origin: [0, 0, layer] },
          data,
          { bytesPerRow: padded },
          [mip.w, mip.h, 1],
        );
      }
    }
    return tex;
  }
  // Run 18 stills. The quilted atlases stay on disk and are not sampled.
  const snowTex = await loadArray(['./tex/crust/v1.jpg', './tex/crust/v2.jpg', './tex/crust/v3.jpg', './tex/crust/v4.jpg']);
  let snowAstc = null;
  try {
    snowAstc = await loadAstcArray(['./tex/crust-diag/v1.astcpack', './tex/crust-diag/v2.astcpack', './tex/crust-diag/v3.astcpack', './tex/crust-diag/v4.astcpack']);
  } catch (err) {
    snowAstc = null;
  }
  const wallTex = await loadArray(['./tex/glacier-ice/v1.jpg', './tex/glacier-ice/v2.jpg', './tex/glacier-ice/v3.jpg', './tex/glacier-ice/v4.jpg']);
  const fallTex = await loadArray(['./tex/fall-ice/v1.jpg', './tex/fall-ice/v2.jpg', './tex/fall-ice/v3.jpg', './tex/fall-ice/v4.jpg']);
  const archTex = await loadArray(['./tex/arch-ice/v1.jpg', './tex/arch-ice/v2.jpg', './tex/arch-ice/v3.jpg', './tex/arch-ice/v4.jpg']);
  const seracTex = await loadArray(['./tex/serac/v1.jpg', './tex/serac/v2.jpg', './tex/serac/v3.jpg', './tex/serac/v4.jpg']);
  const planetTex = await loadAlbedo('./tex/glacier-planet-surface.jpg');

  const mk = (data, usage) => {
    const size = (data.byteLength + 3) & ~3;
    const b = dev.createBuffer({ size, usage, mappedAtCreation: true });
    new Float32Array(b.getMappedRange()).set(data);
    b.unmap();
    return b;
  };
  const vb = mk(world.verts, GPUBufferUsage.VERTEX);
  const shadeVb = mk(world.shadeNormals, GPUBufferUsage.VERTEX);
  const mkInst = (slot) => ({
    proto: mk(slot.proto, GPUBufferUsage.VERTEX),
    inst: mk(slot.data, GPUBufferUsage.VERTEX),
    verts: slot.proto.length / 8,
    count: slot.count,
  });
  const icicleI = mkInst(world.instances.icicle);
  const driftI = mkInst(world.instances.drift);
  const chunkI = mkInst(world.instances.chunk);
  const planetBuf = mk(world.planet, GPUBufferUsage.VERTEX);
  const planetVerts = world.planet.length / 8;
  const ub = dev.createBuffer({ size: 256, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const aniso = Math.min(16, ad.limits.maxSamplerAnisotropy || 1);
  window.__glacierAniso = aniso;
  const samp = dev.createSampler({
    magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', maxAnisotropy: aniso,
    addressModeU: 'repeat', addressModeV: 'repeat',
  });
  const bgl = dev.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: {} },
    { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: '2d-array' } },
    { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: '2d-array' } },
    { binding: 5, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    { binding: 6, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: '2d-array' } },
    { binding: 7, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: '2d-array' } },
    { binding: 8, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: '2d-array' } },
  ] });
  const snowEntries = (snow) => [
    { binding: 0, resource: { buffer: ub } },
    { binding: 1, resource: samp },
    { binding: 2, resource: atlas.createView() },
    { binding: 3, resource: snow.createView({ dimension: '2d-array' }) },
    { binding: 4, resource: wallTex.createView({ dimension: '2d-array' }) },
    { binding: 5, resource: planetTex.createView() },
    { binding: 6, resource: fallTex.createView({ dimension: '2d-array' }) },
    { binding: 7, resource: archTex.createView({ dimension: '2d-array' }) },
    { binding: 8, resource: seracTex.createView({ dimension: '2d-array' }) },
  ];
  const bg = dev.createBindGroup({ layout: bgl, entries: snowEntries(snowTex) });
  const bgAstc = snowAstc ? dev.createBindGroup({ layout: bgl, entries: snowEntries(snowAstc) }) : null;
  let drawBg = bg;
  const layout = dev.createPipelineLayout({ bindGroupLayouts: [bgl] });
  const mod = dev.createShaderModule({ code: WGSL });
  if (mod.getCompilationInfo) {
    const info = await mod.getCompilationInfo();
    const errs = info.messages.filter((m) => m.type === 'error').map((m) => m.message);
    if (errs.length) throw new Error(errs.join('\n'));
  }
  const vbuf = { arrayStride: 32, attributes: [
    { shaderLocation: 0, offset: 0, format: 'float32x4' },
    { shaderLocation: 1, offset: 16, format: 'float32x4' },
  ] };
  const SAMPLES = GLACIER.msaa;
  const pipe = (vs, fs, alpha, depthWrite, depthCompare) => dev.createRenderPipeline({
    layout,
    vertex: { module: mod, entryPoint: vs, buffers: vs === 'vs' ? [vbuf] : [] },
    fragment: { module: mod, entryPoint: fs, targets: [{ format: fmt, blend: alpha ? { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } } : undefined }] },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    multisample: { count: SAMPLES, alphaToCoverageEnabled: vs === 'vsBolt' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: depthWrite, depthCompare },
  });
  const instBuf = { arrayStride: 32, stepMode: 'instance', attributes: [
    { shaderLocation: 2, offset: 0, format: 'float32x4' },
    { shaderLocation: 3, offset: 16, format: 'float32x4' },
  ] };
  const shadeBuf = { arrayStride: 12, attributes: [
    { shaderLocation: 4, offset: 0, format: 'float32x3' },
  ] };
  const pWorld = dev.createRenderPipeline({
    layout,
    vertex: { module: mod, entryPoint: 'vsWorld', buffers: [vbuf, shadeBuf] },
    fragment: { module: mod, entryPoint: 'fs', targets: [{ format: fmt }] },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    multisample: { count: SAMPLES },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
  });
  const pInst = dev.createRenderPipeline({
    layout,
    vertex: { module: mod, entryPoint: 'vsInst', buffers: [vbuf, instBuf] },
    fragment: { module: mod, entryPoint: 'fs', targets: [{ format: fmt }] },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    multisample: { count: SAMPLES },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
  });
  const pSky = pipe('vsSky', 'fsSky', false, false, 'always');
  const pBolt = pipe('vsBolt', 'fsBolt', false, true, 'less');
  const pPlanet = pipe('vs', 'fsPlanet', false, true, 'less');
  const pContact = pipe('vsContact', 'fsContact', true, false, 'less');
  const flakeStep = { arrayStride: 32, stepMode: 'instance', attributes: [
    { shaderLocation: 0, offset: 0, format: 'float32x4' },
    { shaderLocation: 1, offset: 16, format: 'float32x4' },
  ] };
  const pFlake = dev.createRenderPipeline({
    layout,
    vertex: { module: mod, entryPoint: 'vsFlake', buffers: [flakeStep] },
    fragment: { module: mod, entryPoint: 'fsFlake', targets: [{ format: fmt, blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } } }] },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    multisample: { count: SAMPLES },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'less' },
  });
  const flakeGpu = new Float32Array(FLAKE_N * 8);
  const flakeBuf = dev.createBuffer({
    size: flakeGpu.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const msaa = dev.createTexture({ size: [W, H], format: fmt, sampleCount: SAMPLES, usage: GPUTextureUsage.RENDER_ATTACHMENT });
  const depth = dev.createTexture({ size: [W, H], format: 'depth24plus', sampleCount: SAMPLES, usage: GPUTextureUsage.RENDER_ATTACHMENT });
  const off = dev.createTexture({ size: [W, H], format: fmt, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
  const bpr = Math.ceil(W * 4 / 256) * 256;
  const rb = dev.createBuffer({ size: bpr * H, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  const U = new Float32Array(64);
  let lastEye = [0, 0, 0];
  const worldVerts = world.verts.length / 8;

  const PAW_FRAC = [
    0.0874, 0.0690, 0.0567, 0.0506, 0.0414, 0.0322, 0.0261, 0.0307,
    0.0982, 0.1304, 0.1426, 0.1273, 0.1212, 0.1104, 0.0997, 0.1196,
    0.1396, 0.1012, 0.0721, 0.0506, 0.0383, 0.0322, 0.0199, 0.0077,
    0.0690, 0.1380, 0.1580, 0.1396, 0.1242, 0.1135, 0.1058, 0.0997,
  ];

  let snowDiag = 0;
  function fillU(t) {
    const bp = [live.x, pawGround(), live.z];
    let { eye, tgt } = followEye(bp, live.cam, world.heightAt, 0);
    if (SHOT === 'establish') {
      const est = establishEye();
      eye = est.eye;
      tgt = est.tgt;
    }
    if (gatePose) {
      eye = gatePose.eye;
      tgt = gatePose.tgt;
    }
    const view = lookAt(eye, tgt, [0, 1, 0]);
    const proj = persp(FOV_Y, W / H, 0.08, 14000);
    const vp = mul(proj, view);
    U.set(vp, 0);
    U.set(invertMat4(vp), 16);
    lastEye = [eye[0], eye[1], eye[2]];
    U.set([eye[0], eye[1], eye[2], t], 32);
    U.set([bp[0], bp[1], bp[2], live.psi], 36);
    const ff = (live.phase % 1) * 32;
    const roll = Math.max(-8 * Math.PI / 180, Math.min(8 * Math.PI / 180, live.w * 0.15));
    U.set([roll, live.w, live.v, ff], 40);
    const f0 = Math.floor(ff) % 32;
    const f1 = (f0 + 1) % 32;
    const pawFrac = Math.min(PAW_FRAC[f0], PAW_FRAC[f1]);
    const pawLy = (pawFrac - 6 / 652) * 1.15 - 0.095;
    U[56] = pawLy + 0.02;
    U.set([0.70, 0.78, 0.88, 0], 44);
    U.set([sunDir[0], sunDir[1], sunDir[2], snowDiag], 48);
    IDLE.writeUniforms(U, IDLE.sample());
    U[53] = 0;
    U[54] = gateMode;
    U[55] = gateBreak;
    U[58] = skySwim;
    U[59] = skyYaw;
    U.set([pCenter[0], pCenter[1], pCenter[2], PLANET.radius], 60);
  }

  function beginPass(enc, clear) {
    return enc.beginRenderPass({
      colorAttachments: [{ view: msaa.createView(), resolveTarget: off.createView(), loadOp: 'clear', storeOp: 'discard', clearValue: clear }],
      depthStencilAttachment: { view: depth.createView(), depthLoadOp: 'clear', depthClearValue: 1, depthStoreOp: 'discard' },
    });
  }

  function renderFixed(t) {
    fillU(t);
    dev.queue.writeBuffer(ub, 0, U);
    if (!gatePose) {
      for (let i = 0; i < FLAKE_N; i++) {
        const o = i * 8;
        flakeGpu[o] = flakes[o];
        flakeGpu[o + 1] = flakes[o + 1];
        flakeGpu[o + 2] = flakes[o + 2];
        flakeGpu[o + 3] = Math.atan2(flakeVel[i * 3], flakeVel[i * 3 + 2]);
        flakeGpu[o + 4] = flakes[o + 4];
        const life = Math.min(1, Math.max(0, flakes[o + 3]));
        const puff = flakes[o + 6] > 0.5;
        flakeGpu[o + 5] = Math.sin(life * Math.PI * (puff ? 1 : 0.5));
        flakeGpu[o + 6] = flakes[o + 5];
        const seed = flakes[o] * 0.17 + flakes[o + 2] * 0.09;
        flakeGpu[o + 7] = seed - Math.floor(seed);
      }
      dev.queue.writeBuffer(flakeBuf, 0, flakeGpu);
    }
    const enc = dev.createCommandEncoder();
    const pass = beginPass(enc, [0, 0, 0, 1]);
    pass.setBindGroup(0, drawBg);
    pass.setPipeline(pSky); pass.draw(3);
    pass.setPipeline(pPlanet); pass.setVertexBuffer(0, planetBuf); pass.draw(planetVerts);
    pass.setPipeline(pWorld); pass.setVertexBuffer(0, vb); pass.setVertexBuffer(1, shadeVb); pass.draw(worldVerts);
    pass.setPipeline(pInst);
    pass.setVertexBuffer(0, icicleI.proto); pass.setVertexBuffer(1, icicleI.inst); pass.draw(icicleI.verts, icicleI.count);
    pass.setVertexBuffer(0, chunkI.proto); pass.setVertexBuffer(1, chunkI.inst); pass.draw(chunkI.verts, chunkI.count);
    pass.setVertexBuffer(0, driftI.proto); pass.setVertexBuffer(1, driftI.inst); pass.draw(driftI.verts, driftI.count);
    if (!gatePose) {
      pass.setPipeline(pContact); pass.draw(60);
      pass.setPipeline(pFlake);
      pass.setVertexBuffer(0, flakeBuf);
      pass.draw(6, FLAKE_N);
      pass.setPipeline(pBolt); pass.draw(6);
    }
    pass.end();
    enc.copyTextureToBuffer({ texture: off }, { buffer: rb, bytesPerRow: bpr }, [W, H]);
    if (!CAP) {
      const show = enc2(dev, ctx, off, W, H);
      dev.queue.submit([enc.finish(), show]);
    } else {
      dev.queue.submit([enc.finish()]);
    }
  }

  window.__glacierInfo = {
    biome: GLACIER.id,
    candidate: CANDIDATE,
    release: false,
    visualKeep: false,
    W, H,
    msaa: SAMPLES,
    tris: world.budget.totalTris,
    worldTris: world.budget.worldTris,
    icicleTris: world.budget.icicleTris,
    driftTris: world.budget.driftTris,
    draws: DRAWS.length,
    drawNames: DRAWS,
    extentZ: world.extentZ,
    columns: world.columns,
    bolt: 'bolt439_atlas',
    cardH: IDLE.cfg.cardH,
    cardW: IDLE.cfg.cardW,
    fog: 0,
    planetRadius: PLANET.radius,
  };

  const c2 = new OffscreenCanvas(W, H);
  const x2 = c2.getContext('2d', { willReadFrequently: true });

  function projectPixel(p) {
    const x = U[0] * p[0] + U[4] * p[1] + U[8] * p[2] + U[12];
    const y = U[1] * p[0] + U[5] * p[1] + U[9] * p[2] + U[13];
    const w = U[3] * p[0] + U[7] * p[1] + U[11] * p[2] + U[15];
    if (!(w > 0)) return null;
    return [(x / w * 0.5 + 0.5) * W, (1 - (y / w * 0.5 + 0.5)) * H];
  }
  function flakeCoverage() {
    const q = { tl: 0, tr: 0, bl: 0, br: 0, center: 0, onScreen: 0 };
    let n = 0;
    let mx = 0;
    let my = 0;
    let mz = 0;
    for (let i = 0; i < FLAKE_SNOW; i++) {
      const o = i * 8;
      if (flakes[o + 3] < 0.2) continue;
      const p = projectPixel([flakes[o], flakes[o + 1], flakes[o + 2]]);
      if (p && p[0] >= 0 && p[0] < W && p[1] >= 0 && p[1] < H) {
        q.onScreen++;
        if (p[0] < W * 0.5 && p[1] < H * 0.5) q.tl++;
        else if (p[1] < H * 0.5) q.tr++;
        else if (p[0] < W * 0.5) q.bl++;
        else q.br++;
        if (p[0] > W * 0.3 && p[0] < W * 0.7 && p[1] > H * 0.35 && p[1] < H * 0.65) q.center++;
      }
      mx += flakeVel[i * 3];
      my += flakeVel[i * 3 + 1];
      mz += flakeVel[i * 3 + 2];
      n++;
    }
    mx /= n || 1;
    my /= n || 1;
    mz /= n || 1;
    let vvx = 0;
    let vvy = 0;
    let vvz = 0;
    let align = 0;
    const ml = Math.hypot(mx, my, mz) || 1;
    let headings = 0;
    let headingN = 0;
    for (let i = 0; i < FLAKE_SNOW; i++) {
      if (flakes[i * 8 + 3] < 0.2) continue;
      const vx = flakeVel[i * 3];
      const vy = flakeVel[i * 3 + 1];
      const vz = flakeVel[i * 3 + 2];
      vvx += (vx - mx) ** 2;
      vvy += (vy - my) ** 2;
      vvz += (vz - mz) ** 2;
      const s = Math.hypot(vx, vy, vz) || 1;
      align += (vx * mx + vy * my + vz * mz) / (s * ml);
      headings += Math.atan2(vx, vz);
      headingN++;
    }
    let headMean = headings / (headingN || 1);
    let headVar = 0;
    let up = 0;
    let hi = 0;
    for (let i = 0; i < FLAKE_SNOW; i++) {
      if (flakes[i * 8 + 3] < 0.2) continue;
      hi++;
      const vx = flakeVel[i * 3];
      const vz = flakeVel[i * 3 + 2];
      let d = Math.atan2(vx, vz) - headMean;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      headVar += d * d;
      if (flakeVel[i * 3 + 1] > 0.15) up++;
    }
    n = n || 1;
    const focal = (H / 2) / Math.tan(HALF_H);
    const bins = { near: [], mid: [], far: [] };
    const heads = [];
    for (let i = 0; i < FLAKE_SNOW; i += 6) {
      const o = i * 8;
      const depthCam = Math.hypot(flakes[o] - lastEye[0], flakes[o + 2] - lastEye[2]);
      const px = flakes[o + 4] / Math.max(0.4, depthCam) * focal;
      const bin = depthCam < 2.4 ? bins.near : depthCam < 8 ? bins.mid : bins.far;
      bin.push(px);
      heads.push(+Math.atan2(flakeVel[i * 3], flakeVel[i * 3 + 2]).toFixed(3));
    }
    const summ = (arr) => {
      if (!arr.length) return { n: 0, min: 0, mid: 0, max: 0 };
      const s = arr.slice().sort((a, b) => a - b);
      return { n: s.length, min: +s[0].toFixed(2), mid: +s[s.length >> 1].toFixed(2), max: +s[s.length - 1].toFixed(2) };
    };
    return {
      quadrants: q,
      sizePx: { near: summ(bins.near), mid: summ(bins.mid), far: summ(bins.far) },
      headings: heads,
      velMean: [+mx.toFixed(3), +my.toFixed(3), +mz.toFixed(3)],
      velVar: [+(vvx / n).toFixed(3), +(vvy / n).toFixed(3), +(vvz / n).toFixed(3)],
      velVarSum: +((vvx + vvy + vvz) / n).toFixed(3),
      align: +(align / n).toFixed(3),
      headingVar: +(headVar / (headingN || 1)).toFixed(3),
      upwardFrac: +(up / (hi || 1)).toFixed(3),
    };
  }
  function cropRead(src, cx, cy, rad) {
    const out = [];
    const x0 = Math.max(0, Math.floor(cx - rad));
    const y0 = Math.max(0, Math.floor(cy - rad));
    const x1 = Math.min(W - 1, Math.ceil(cx + rad));
    const y1 = Math.min(H - 1, Math.ceil(cy + rad));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * bpr + x * 4;
        out.push([src[i], src[i + 1], src[i + 2], src[i + 3], x, y]);
      }
    }
    return out;
  }
  async function readback() {
    await dev.queue.onSubmittedWorkDone();
    await rb.mapAsync(GPUMapMode.READ);
    const src = new Uint8Array(rb.getMappedRange().slice(0));
    rb.unmap();
    return src;
  }
  async function readFrame() {
    dev.pushErrorScope('validation');
    renderFixed(simClock);
    const gpuErr = await dev.popErrorScope();
    const src = await readback();
    return { src, gpuErr: gpuErr ? String(gpuErr.message || gpuErr) : null };
  }
  function renderBoltMask() {
    const enc = dev.createCommandEncoder();
    const pass = beginPass(enc, [0, 0, 0, 1]);
    pass.setBindGroup(0, drawBg);
    pass.setPipeline(pBolt);
    pass.draw(6);
    pass.end();
    enc.copyTextureToBuffer({ texture: off }, { buffer: rb, bytesPerRow: bpr }, [W, H]);
    dev.queue.submit([enc.finish()]);
  }
  async function blobOf(src, type, quality) {
    const img = new ImageData(W, H);
    for (let y = 0; y < H; y++) img.data.set(src.subarray(y * bpr, y * bpr + W * 4), y * W * 4);
    x2.putImageData(img, 0, 0);
    const blob = await c2.convertToBlob(quality ? { type, quality } : { type });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  }

  function snowGrid(src, maskSrc) {
    const bin = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * bpr + x * 4;
        const lum = maskSrc[i] * 0.3 + maskSrc[i + 1] * 0.59 + maskSrc[i + 2] * 0.11;
        if (lum > 12) bin[y * W + x] = 1;
      }
    }
    let minX = W, minY = H, maxX = -1, maxY = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (bin[y * W + x]) {
      if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y;
    }
    const mask = new Uint8Array(W * H);
    if (maxX >= 0) {
      const rad = 8;
      const x0 = Math.max(0, minX - rad), y0 = Math.max(0, minY - rad);
      const x1 = Math.min(W - 1, maxX + rad), y1 = Math.min(H - 1, maxY + rad);
      const tmp = new Uint8Array(W * H);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const a = Math.max(0, x - rad), b = Math.min(W - 1, x + rad);
        const row = y * W;
        for (let k = a; k <= b; k++) if (bin[row + k]) { tmp[row + x] = 1; break; }
      }
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        const a = Math.max(0, y - rad), b = Math.min(H - 1, y + rad);
        for (let k = a; k <= b; k++) if (tmp[k * W + x]) { mask[y * W + x] = 1; break; }
      }
    }
    const y0 = Math.floor(H * 0.55), y1 = Math.floor(H * 0.96);
    const sig = new Float64Array(W);
    let rows = 0;
    for (let y = y0; y < y1; y += 2) {
      rows++;
      const row = new Float64Array(W);
      const known = new Uint8Array(W);
      for (let x = 0; x < W; x++) {
        if (mask[y * W + x]) continue;
        const i = y * bpr + x * 4;
        row[x] = src[i] * 0.3 + src[i + 1] * 0.59 + src[i + 2] * 0.11;
        known[x] = 1;
      }
      for (let x = 0; x < W; x++) {
        if (known[x]) continue;
        let left = x - 1, right = x + 1;
        while (left >= 0 && !known[left]) left--;
        while (right < W && !known[right]) right++;
        const a = left >= 0 ? row[left] : (right < W ? row[right] : 0);
        const b = right < W ? row[right] : a;
        const u = left >= 0 && right > left ? (x - left) / (right - left) : 0;
        row[x] = a + (b - a) * u;
      }
      for (let x = 0; x < W; x++) sig[x] += row[x];
    }
    for (let x = 0; x < W; x++) sig[x] /= rows || 1;
    const hp = new Float64Array(W);
    for (let i = 0; i < W; i++) hp[i] = sig[i] - sig[Math.max(0, i - 24)];
    let mean = 0;
    for (let i = 0; i < W; i++) mean += hp[i];
    mean /= W;
    let v = 0;
    for (let i = 0; i < W; i++) v += (hp[i] - mean) ** 2;
    v /= W;
    if (v < 1e-6) return 0;
    const ac = (lag) => {
      let c = 0;
      const m = W - lag;
      for (let i = 0; i < m; i++) c += (hp[i] - mean) * (hp[i + lag] - mean);
      return c / (m * v);
    };
    const peak = Math.max(ac(8), ac(16), ac(24));
    const beside = (ac(11) + ac(13) + ac(19) + ac(21)) / 4;
    return peak / (Math.abs(beside) + 0.08);
  }

  function nearSharp(src, maskSrc) {
    const y0 = Math.floor(H * 0.82), y1 = Math.floor(H * 0.96);
    let acc = 0;
    let n = 0;
    const lumaAt = (x, y) => {
      const i = y * bpr + x * 4;
      return src[i] * 0.3 + src[i + 1] * 0.59 + src[i + 2] * 0.11;
    };
    const masked = (x, y) => {
      const i = y * bpr + x * 4;
      return maskSrc[i] * 0.3 + maskSrc[i + 1] * 0.59 + maskSrc[i + 2] * 0.11 > 12;
    };
    for (let y = y0 + 1; y < y1 - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (masked(x, y)) continue;
        const c = lumaAt(x, y);
        const lap = Math.abs(4 * c - lumaAt(x - 1, y) - lumaAt(x + 1, y) - lumaAt(x, y - 1) - lumaAt(x, y + 1));
        acc += lap;
        n++;
      }
    }
    return n ? acc / n : 0;
  }

  let sim = 0;
  const DIAG = [
    [0, 'baseline', false],
    [1, 'mip0', false],
    [2, 'mipBias+1', false],
    [3, 'bilinear', false],
    [4, 'aniso8', false],
    [5, 'liftOff', false],
    [6, 'normalUp', false],
    [0, 'astc', true],
  ];
  async function scoreHere() {
    const frame = await readFrame();
    renderBoltMask();
    const maskSrc = await readback();
    return { peak: snowGrid(frame.src, maskSrc), sharp: nearSharp(frame.src, maskSrc), gpuErr: frame.gpuErr };
  }
  window.__glacierPeak = async (t) => {
    const dt = 1 / 60;
    while (sim < t - 1e-5) { const h = Math.min(dt, t - sim); stepLive(h); sim += h; }
    snowDiag = 0;
    drawBg = bg;
    const row = await scoreHere();
    return {
      peak: row.peak,
      z: live.z, x: live.x, psi: live.psi,
      eye: lastEye,
      gpuErr: row.gpuErr,
    };
  };
  const FOOT = [
    [0, 'baseline'],
    [10, 'k0.25'],
    [11, 'k0.50'],
    [12, 'k0.75'],
  ];
  window.__glacierFoot = async (t) => {
    const dt = 1 / 60;
    while (sim < t - 1e-5) { const h = Math.min(dt, t - sim); stepLive(h); sim += h; }
    const rows = [];
    for (const [mode, name] of FOOT) {
      snowDiag = mode;
      drawBg = bg;
      const row = await scoreHere();
      rows.push({ name, peak: row.peak, sharp: row.sharp, gpuErr: row.gpuErr });
    }
    snowDiag = 0;
    return { t, rows };
  };
  window.__glacierTable = async (t) => {
    const dt = 1 / 60;
    while (sim < t - 1e-5) { const h = Math.min(dt, t - sim); stepLive(h); sim += h; }
    const rows = [];
    for (const [mode, name, astc] of DIAG) {
      if (astc && !bgAstc) { rows.push({ name, peak: null, skip: 'no astc' }); continue; }
      snowDiag = mode;
      drawBg = astc ? bgAstc : bg;
      const row = await scoreHere();
      rows.push({ name, peak: row.peak, gpuErr: row.gpuErr });
    }
    snowDiag = 0;
    drawBg = bg;
    return { t, z: live.z, rows };
  };
  window.__glacierFrame = async (t) => {
    const dt = 1 / 60;
    while (sim < t - 1e-5) { const h = Math.min(dt, t - sim); stepLive(h); sim += h; }
    const showMat = window.__glacierShowMat === true;
    if (showMat) gateMode = 1;
    const frame = await readFrame();
    if (showMat) gateMode = 0;
    const png = await blobOf(frame.src, 'image/png');
    renderBoltMask();
    const maskSrc = await readback();
    const mask = await blobOf(maskSrc, 'image/png');
    const bp = [live.x, pawGround(), live.z];
    const pix = projectPixel(bp);
    return {
      png,
      mask,
      info: {
        x: live.x, z: live.z, psi: live.psi, cam: live.cam, phase: live.phase,
        v: live.v, y: bp[1], eye: lastEye,
        boltPx: pix, W, H,
        tris: world.budget.totalTris, particleTris: world.budget.particleTris, draws: DRAWS.length,
        flakes: flakeCoverage(),
        gpuErr: frame.gpuErr,
      },
    };
  };
  window.__glacierGate = async (shot) => {
    gatePose = { eye: shot.eye, tgt: shot.tgt };
    gateBreak = shot.breakId || 0;
    gateMode = 0;
    const colour = await readFrame();
    gateMode = 1;
    const mask = await readFrame();
    gateMode = 2;
    const albedo = await readFrame();
    gateMode = 0;
    gatePose = null;
    const pix = projectPixel(shot.at);
    if (!pix) return { ok: false, reason: 'behind camera', gpuErr: colour.gpuErr };
    const rad = shot.rad || 12;
    return {
      ok: true,
      px: pix,
      colour: cropRead(colour.src, pix[0], pix[1], rad),
      mask: cropRead(mask.src, pix[0], pix[1], rad),
      albedo: cropRead(albedo.src, pix[0], pix[1], rad),
      gpuErr: colour.gpuErr || mask.gpuErr || albedo.gpuErr,
    };
  };
  window.__glacierSky = async (shot) => {
    gatePose = { eye: shot.eye, tgt: shot.tgt };
    skySwim = shot.swim ? 1 : 0;
    skyYaw = shot.yaw || 0;
    gateMode = 0;
    const colour = await readFrame();
    gateMode = 1;
    const mask = await readFrame();
    gateMode = 0;
    skySwim = 0;
    skyYaw = 0;
    gatePose = null;
    const samples = [];
    for (const dir of shot.dirs || []) {
      const at = [shot.eye[0] + dir[0] * 800, shot.eye[1] + dir[1] * 800, shot.eye[2] + dir[2] * 800];
      const p = projectPixel(at);
      if (!p) { samples.push(null); continue; }
      const x = Math.round(p[0]);
      const y = Math.round(p[1]);
      if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) { samples.push(null); continue; }
      const i = y * bpr + x * 4;
      const mat = Math.round(mask.src[i] / 255 * 8 - 0.5);
      samples.push([colour.src[i], colour.src[i + 1], colour.src[i + 2], x, y, mat]);
    }
    return { ok: true, samples, gpuErr: colour.gpuErr };
  };
  window.__glacierReady = true;
  if (hud) hud.textContent = 'glacier candidate — not live';
  if (!CAP) {
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      stepLive(dt);
      renderFixed(simClock);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

function enc2(dev, ctx, off, W, H) {
  const enc = dev.createCommandEncoder();
  enc.copyTextureToTexture({ texture: off }, { texture: ctx.getCurrentTexture() }, [W, H]);
  return enc.finish();
}

main().catch((e) => {
  window.__glacierErr = String(e && e.stack || e);
  window.__glacierReady = false;
  if (hud) hud.textContent = window.__glacierErr.slice(0, 180);
});

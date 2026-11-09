// crystal/crystal.js — obsidian canyon on the house WebGPU path.
// Live bolt439 card, meadow follow camera. Albedo is a dedicated tile, never the art key.
import { boltIdle, measureAtlasFeet, pickPlantedFrame } from '../bricks/bolt-idle.js';
import { stepBreath, BREATH_MEADOW, makeBreathClip, BREATH_BUILD, breathMixWgsl } from '../bricks/bolt-breath.js';
import { makeCircleCollide } from '../engine/bricks/circle-collide.js';
import { followEye, lookAt, persp, mul, FOV_Y } from '../engine/bricks/follow-cam.js';
import { createPlanetMesh, prepareSurfaceRGBA, frontYaw, planetCenter } from '../engine/bricks/planet-sphere.js';
import { CRYSTAL, PLANET } from './biome.js';
import { materialGate, TILE_M, ALBEDO } from './materials.js';
import { shadeFns, SHADE, tileScales, WATER_WAVE } from '../biome-factory/shade.js';
import { LIGHT, lightWgsl } from './light.js';
import { buildWorld, demoSteer, proofInput, skyProofInput, integrate, spawn, terrH, pathX } from './world.js';
import { skyWgsl } from '../biome-factory/procedural-sky.js';

const SC = tileScales();
const qs = new URLSearchParams(location.search);
const CAP = qs.get('cap') === '1';
const DEMO = qs.get('demo') === '1' || CAP;
const PROOF = qs.get('proof') === '1';
const SHOT = qs.get('shot');
const SKYPROOF = qs.get('skyproof') === '1';
let simClock = 0;
const hud = document.getElementById('hud');
if (CAP && hud) hud.style.display = 'none';

const IDLE = boltIdle({ strideHz: 22 / (534 / 96) });
const BREATH = { ...BREATH_MEADOW, speed: IDLE.cfg.speed, blendV: IDLE.cfg.blendV };
const world = buildWorld();
const collide = makeCircleCollide(world.circles, { boltR: CRYSTAL.boltR });
const live = spawn();
const held = new Set();
const ptrs = new Map();
const K_L = ['a', 'arrowleft', 'q'];
const K_R = ['d', 'arrowright'];

addEventListener('keydown', e => { held.add(e.key.toLowerCase()); });
addEventListener('keyup', e => { held.delete(e.key.toLowerCase()); });
const clearInput = () => { held.clear(); ptrs.clear(); };
addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
const pSide = e => (e.clientX < innerWidth / 2 ? 1 : -1);
addEventListener('pointerdown', e => { ptrs.set(e.pointerId, pSide(e)); }, { passive: true });
addEventListener('pointermove', e => { if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, pSide(e)); }, { passive: true });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) addEventListener(ev, e => ptrs.delete(e.pointerId));

function playerInput() {
  let t = 0;
  if (K_L.some(k => held.has(k))) t += 1;
  if (K_R.some(k => held.has(k))) t -= 1;
  for (const v of ptrs.values()) t += v;
  const run = ['w', 'arrowup', ' '].some(k => held.has(k)) || ptrs.size > 0;
  return { turn: Math.max(-1, Math.min(1, t)), run };
}

function stepLive(dt) {
  const input = SKYPROOF ? skyProofInput(simClock, live) : PROOF ? proofInput(simClock, live) : DEMO ? demoSteer(live) : playerInput();
  simClock += dt;
  IDLE.stepMotion(live, dt, input.run);
  stepBreath(live, dt, input.run, BREATH);
  integrate(live, dt, input, collide);
  return live;
}

const WGSL = /* wgsl */`
struct U {
  vp: mat4x4f, ivp: mat4x4f, cam: vec4f, bolt: vec4f, bp: vec4f, grid: vec4f, sun: vec4f, misc: vec4f, fog: vec4f,
  c0: vec4f, c1: vec4f, c2: vec4f, c3: vec4f, c4: vec4f, c5: vec4f, c6: vec4f,
  planet: vec4f, spin: vec4f, atmo: vec4f,
};
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var groundTex: texture_2d<f32>;
@group(0) @binding(6) var wallTex: texture_2d<f32>;
@group(0) @binding(7) var crysTex: texture_2d<f32>;
@group(0) @binding(8) var archTex: texture_2d<f32>;
@group(0) @binding(9) var violetTex: texture_2d<f32>;
@group(0) @binding(10) var streamTex: texture_2d<f32>;
@group(0) @binding(3) var atex: texture_2d<f32>;
@group(0) @binding(4) var planetTex: texture_2d<f32>;
@group(0) @binding(5) var planetSamp: sampler;
struct VO { @builtin(position) p: vec4f, @location(0) w: vec3f, @location(1) n: vec3f, @location(2) uv: vec2f, @location(3) mat: f32 };
@vertex fn vs(@location(0) a: vec4f, @location(1) b: vec4f) -> VO {
  var p = a.xyz; let n = b.xyz;
  if (a.w > 4.5 && a.w < 5.5) {
    p = p + u.cam.xyz;
  } else if (a.w > 3.5 && a.w < 4.5) {
    let t = u.cam.w;
    p.y += ${WATER_WAVE.az} * sin(p.z * ${WATER_WAVE.fz} + t * ${WATER_WAVE.oz}) + ${WATER_WAVE.ax} * sin(p.x * ${WATER_WAVE.fx} - t * ${WATER_WAVE.ox});
  }
  var o: VO;
  o.p = u.vp * vec4f(p, 1.0);
  o.w = p; o.n = n; o.uv = vec2f(b.w, 0.0); o.mat = a.w; return o;
}
${shadeFns()}
${skyWgsl()}
${lightWgsl()}
fn pathXg(z: f32) -> f32 { return 5.2 * sin(z * 0.028) + 1.6 * sin(z * 0.061) + 4.8 * sin(z * 0.045); }
fn terrHs(p: vec2f) -> f32 {
  let lateral = p.x - pathXg(p.y);
  let ad = abs(lateral);
  let t = clamp((ad - 2.6) / 5.9, 0.0, 1.0);
  let lip = (t * t * (3.0 - 2.0 * t)) * 0.55;
  let d = lateral - 3.55;
  let trench = exp(-(d * d) / 1.15) * 0.62;
  return lip - trench + 0.045 * sin(p.x * 1.3 + p.y * 0.7) + 0.03 * sin(-p.x * 0.45 + p.y * 0.9);
}
fn groundN(p: vec2f) -> vec3f {
  let e = 0.45;
  let hx = terrHs(p + vec2f(e, 0.0)) - terrHs(p - vec2f(e, 0.0));
  let hz = terrHs(p + vec2f(0.0, e)) - terrHs(p - vec2f(0.0, e));
  return normalize(vec3f(-hx, 2.0 * e, -hz));
}
fn rotY(p: vec3f, a: f32) -> vec3f {
  let c = cos(a); let s = sin(a);
  return vec3f(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}
fn planetUV(n: vec3f) -> vec2f {
  return vec2f(fract(atan2(n.x, n.z) / 6.2831853 + 0.5), acos(clamp(n.y, -1.0, 1.0)) / 3.14159265);
}
struct PVO { @builtin(position) p: vec4f, @location(0) n: vec3f, @location(1) w: vec3f };
@vertex fn vsPlanet(@location(0) p: vec3f, @location(1) n: vec3f) -> PVO {
  let r = rotY(p, u.spin.x);
  let world = u.planet.xyz + r * u.planet.w;
  var o: PVO; o.p = u.vp * vec4f(world, 1.0); o.n = rotY(n, u.spin.x); o.w = world; return o;
}
@vertex fn vsLimb(@location(0) p: vec3f, @location(1) n: vec3f) -> PVO {
  let r = rotY(p, u.spin.x);
  let world = u.planet.xyz + r * (u.planet.w * u.spin.y);
  var o: PVO; o.p = u.vp * vec4f(world, 1.0); o.n = rotY(n, u.spin.x); o.w = world; return o;
}
@fragment fn fsPlanet(v: PVO) -> @location(0) vec4f {
  let n = normalize(v.n);
  let alb = textureSampleLevel(planetTex, planetSamp, planetUV(n), 0.0).rgb;
  let day = smoothstep(-0.05, 0.2, dot(n, sunN()));
  let ndv = abs(dot(n, normalize(u.cam.xyz - v.w)));
  var c = alb * (0.045 + 0.955 * day);
  c *= mix(0.78, 1.0, smoothstep(0.0, 0.4, ndv));
  return vec4f(pow(clamp(c, vec3f(0.0), vec3f(1.0)), vec3f(1.0 / 2.2)), 1.0);
}
@fragment fn fsLimb(v: PVO) -> @location(0) vec4f {
  let n = normalize(v.n);
  let ndv = abs(dot(n, normalize(u.cam.xyz - v.w)));
  let rim = pow(clamp(1.0 - ndv, 0.0, 1.0), 1.65);
  let lit = smoothstep(-0.2, 0.45, dot(n, sunN()));
  let a = rim * (0.2 + 0.8 * lit);
  if (a < 0.03) { discard; }
  return vec4f(u.atmo.rgb, a);
}
@fragment fn fs(v: VO) -> @location(0) vec4f {
  var n = normalize(v.n);
  let scG = ${SC.ground};
  let scW = ${SC.wall};
  let scC = ${SC.crystal};
  let scA = ${SC.architecture};
  let scV = ${SC.violet};
  let scS = ${SC.stream};
  var gnd = textureSample(groundTex, samp, v.w.xz * scG).rgb;
  let gOff = textureSample(groundTex, samp, v.w.xz * scG + vec2f(0.37, 0.53)).rgb;
  let gN = skyNoise(vec3f(v.w.x * 0.17, v.w.z * 0.17, 3.0));
  gnd = mix(gnd, gOff, smoothstep(0.46, 0.54, gN));
  let wall = triMix(
    textureSample(wallTex, samp, v.w.zy * scW).rgb,
    textureSample(wallTex, samp, v.w.xz * scW).rgb,
    textureSample(wallTex, samp, v.w.xy * scW).rgb, n);
  let cry = triMix(
    textureSample(crysTex, samp, v.w.zy * scC).rgb,
    textureSample(crysTex, samp, v.w.xz * scC).rgb,
    textureSample(crysTex, samp, v.w.xy * scC).rgb, n);
  let arch = triMix(
    textureSample(archTex, samp, v.w.zy * scA).rgb,
    textureSample(archTex, samp, v.w.xz * scA).rgb,
    textureSample(archTex, samp, v.w.xy * scA).rgb, n);
  let vio = triMix(
    textureSample(violetTex, samp, v.w.zy * scV).rgb,
    textureSample(violetTex, samp, v.w.xz * scV).rgb,
    textureSample(violetTex, samp, v.w.xy * scV).rgb, n);
  let flow = vec2f(v.w.x, v.w.z + u.cam.w * 0.35) * scS;
  let waterAlb = textureSample(streamTex, samp, flow).rgb;
  let tip = clamp(v.uv.x, 0.0, 1.0);
  let view0 = normalize(u.cam.xyz - v.w);
  let ip = v.w + view0 * (0.16 * (1.0 - tip));
  let inner = triMix(
    textureSample(crysTex, samp, ip.zy * scC).rgb,
    textureSample(crysTex, samp, ip.xz * scC).rgb,
    textureSample(crysTex, samp, ip.xy * scC).rgb, n);
  let m = v.mat;
  if (m > 4.5 && m < 5.5) {
    return present(skyColour(normalize(v.w - u.cam.xyz)));
  }
  var alb = wall;
  if (m < 0.5) {
    n = groundN(v.w.xz);
    alb = gnd;
  } else if (m < 1.5) { alb = vio; }
  else if (m < 2.5) { alb = cry; }
  else if (m < 3.5) { alb = arch; }
  else if (m < 4.5) {
    let t = u.cam.w;
    n = waterN(v.w, t);
    alb = waterAlb;
  }
  let view = normalize(u.cam.xyz - v.w);
  let crystal = select(0.0, 1.0, m > 0.5 && m < 2.5);
  let water = select(0.0, 1.0, m > 3.5 && m < 4.5);
  let ndl = clamp(dot(n, sunN()), 0.0, 1.0);
  var col = shadeAlb(alb, n, view, ${SHADE.waterSpec} * water);
  let ndv = clamp(dot(n, view), 0.0, 1.0);
  let block = select(0.0, 1.0, m > 5.5 || (m > 2.5 && m < 3.5));
  let skyDir = normalize(vec3f(n.x * 0.45, 0.72 + max(n.y, 0.0) * 0.35, n.z * 0.45));
  let skyFace = skyColour(skyDir);
  let skyLin = dot(skyFace, vec3f(0.2126, 0.7152, 0.0722));
  let fill = clamp(skyLin * ${LIGHT.fillGain}.0, ${LIGHT.fillMin}, ${LIGHT.fillMax});
  let F = ${LIGHT.f0} + (1.0 - ${LIGHT.f0}) * pow(1.0 - ndv, 5.0);
  let relief = normalize(n + conchGrad(v.w, n) * ${LIGHT.relief});
  let refl = reflect(-view, relief);
  let broad = normalize(mix(refl, relief, ${LIGHT.roughness}));
  let env = skyColour(broad);
  let bevel = smoothstep(0.18, 0.42, abs(n.y)) * (1.0 - smoothstep(0.72, 0.92, abs(n.y)));
  let ridge = 1.0 - smoothstep(0.0, 0.03, conchGap(faceUV(v.w, n)));
  let sheen = env * (F + ridge * 0.32) * (1.0 - ${LIGHT.roughness} * 0.35) * (1.0 + bevel * 0.65);
  let blockLit = alb * (fill + ${LIGHT.sunCoeff}.0 * ndl) + sheen;
  col = mix(col, blockLit, block);
  let dist = length(v.w - u.cam.xyz);
  let far = smoothstep(55.0, 130.0, dist);
  let rim = pow(1.0 - ndv, 2.4);
  let rimCol = alb * ${LIGHT.rimGain};
  let rimK = min(${LIGHT.rimMix}, rim * (0.35 + 0.45 * far));
  col = mix(col, rimCol, rimK * block);
  let align = clamp(dot(n, normalize(vec3f(0.12, 0.96, 0.08))) * 0.5 + 0.5, 0.0, 1.0);
  let face = 0.40 + 1.10 * align;
  let through = skyColour(normalize(sunN() - n));
  let sil = pow(1.0 - ndv, 2.0);
  let crack = fractureAmt(v.w + view * 0.05, view);
  let spark = pow(clamp(dot(n, normalize(sunN() + view)), 0.0, 1.0), ${LIGHT.sparkPow}.0);
  let edgeLit = pow(1.0 - ndv, 5.5);
  let gemCol = alb * face * (0.18 + 0.40 * ndl) * (0.42 + 0.58 * tip)
    + alb * through * sil * (1.1 + 1.8 * tip)
    + alb * crack * ${LIGHT.fractureGain}
    + alb * edgeLit * ${LIGHT.gemEdge}
    + alb * spark * ${LIGHT.sparkle}
    + inner * (1.0 - tip) * 0.18;
  col = mix(col, gemCol, crystal);
  let waterFres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
  col = mix(col, col * ${SHADE.waterFresnelDark}, waterFres * water * ${SHADE.waterFresnelMix});
  let haze = smoothstep(70.0, 190.0, dist);
  let skyFar = skyColour(normalize(vec3f(v.w.x - u.cam.x, 0.12, v.w.z - u.cam.z)));
  col = mix(col, skyFar, haze * 0.55);
  return vec4f(pow(clamp(col, vec3f(0.0), vec3f(1.0)), vec3f(1.0 / 2.2)), 1.0);
}
${IDLE.wgsl}
struct BO { @builtin(position) p: vec4f, @location(0) uv: vec2f, @location(1) w: vec3f };
@vertex fn vsBolt(@builtin(vertex_index) vi: u32) -> BO {
  var q = array<vec2f, 6>(vec2f(-0.5, 0), vec2f(0.5, 0), vec2f(0.5, 1), vec2f(-0.5, 0), vec2f(0.5, 1), vec2f(-0.5, 1));
  let c = q[vi]; let b = vec3f(u.bolt.x, u.bolt.y, u.bolt.z);
  let toE = normalize(vec2f(u.cam.x - b.x, u.cam.z - b.z)); let rt = vec3f(-toE.y, 0.0, toE.x);
  let lr = idleCardLy(c); let lx = lr.x; let ly = lr.y;
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
  let mixed = breathMix(s.rgb, s.a, uvs);
  if (mixed.a < select(0.12, 0.04, u.misc.y > 0.001)) { discard; }
  var c = mixed.rgb;
  c = mix(c, vec3f(dot(c, vec3f(0.3, 0.59, 0.11))), 0.12) * 1.08;
  let hgt = v.w.y - u.bolt.y;
  let bounce = max(u.grid.xyz, vec3f(0.55));
  c *= mix(vec3f(1.0), bounce, smoothstep(0.34, 0.02, hgt) * 0.22);
  c *= mix(0.82, 1.0, smoothstep(-0.02, 0.25, hgt));
  return vec4f(pow(clamp(c, vec3f(0.0), vec3f(1.0)), vec3f(1.0 / 2.2)), mixed.a);
}
${breathMixWgsl()}
struct CO { @builtin(position) p: vec4f, @location(0) uv: vec2f };
@vertex fn vsContact(@builtin(vertex_index) vi: u32) -> CO {
  var q = array<vec2f, 6>(vec2f(-1, -1), vec2f(1, -1), vec2f(1, 1), vec2f(-1, -1), vec2f(1, 1), vec2f(-1, 1));
  let c = q[vi]; let b = u.bolt;
  let w = vec3f(b.x + c.x * 0.34, b.y + 0.025, b.z + c.y * 0.22);
  var o: CO; o.p = u.vp * vec4f(w, 1.0); o.uv = c; return o;
}
@fragment fn fsContact(v: CO) -> @location(0) vec4f {
  let r2 = dot(v.uv, v.uv); if (r2 > 1.0) { discard; }
  let a = (1.0 - smoothstep(0.2, 1.0, r2)) * 0.38;
  return vec4f(0.0, 0.0, 0.0, a);
}
`;

function srgbToLin(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

async function loadCanvasMips(dev, canvas) {
  const w = canvas.width, h = canvas.height;
  const levels = Math.floor(Math.log2(Math.max(w, h))) + 1;
  const tex = dev.createTexture({
    size: [w, h], format: 'rgba8unorm-srgb', mipLevelCount: levels,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  for (let l = 0; l < levels; l++) {
    const lw = Math.max(1, w >> l), lh = Math.max(1, h >> l);
    const src = l === 0 ? canvas : await createImageBitmap(canvas, { resizeWidth: lw, resizeHeight: lh, resizeQuality: 'high' });
    dev.queue.copyExternalImageToTexture({ source: src }, { texture: tex, mipLevel: l }, [lw, lh]);
  }
  return tex;
}

async function loadTex(dev, url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('asset missing ' + url + ' HTTP ' + res.status);
  const bmp = await createImageBitmap(await res.blob(), { colorSpaceConversion: 'none' });
  dev.pushErrorScope('validation');
  const tex = dev.createTexture({
    size: [bmp.width, bmp.height], format: 'rgba8unorm-srgb',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  dev.queue.copyExternalImageToTexture({ source: bmp }, { texture: tex }, [bmp.width, bmp.height]);
  const err = await dev.popErrorScope();
  if (err) throw new Error('texture ' + url + ': ' + (err.message || err));
  return { tex, w: bmp.width, h: bmp.height, bmp };
}

async function loadAlbedo(dev, url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('asset missing ' + url + ' HTTP ' + res.status);
  const bmp = await createImageBitmap(await res.blob(), { colorSpaceConversion: 'none' });
  const cv = new OffscreenCanvas(bmp.width, bmp.height);
  cv.getContext('2d').drawImage(bmp, 0, 0);
  const tex = await loadCanvasMips(dev, cv);
  return { tex, w: bmp.width, h: bmp.height, bmp };
}

async function main() {
  const gate = materialGate(qs);
  window.__crystalMaterials = gate;
  if (!gate.render) {
    if (hud) hud.textContent = 'HOLD — matériaux en attente';
    window.__crystalReady = false;
    return;
  }
  const ad = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
  if (!ad) { hud.textContent = 'No WebGPU'; window.__crystalErr = 'No WebGPU'; window.__crystalReady = false; return; }
  const dev = await ad.requestDevice();
  const gpuErrors = [];
  const noteErr = async (label, fn) => {
    dev.pushErrorScope('validation');
    const value = await fn();
    const err = await dev.popErrorScope();
    if (err) throw new Error(label + ': ' + (err.message || err));
    return value;
  };
  dev.addEventListener('uncapturederror', (e) => gpuErrors.push(String(e.error?.message || e.error || e)));
  const canvas = document.getElementById('c');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const W = parseInt(qs.get('w'), 10) || Math.round(innerWidth * dpr);
  const H = parseInt(qs.get('h'), 10) || Math.round(innerHeight * dpr);
  canvas.width = W; canvas.height = H;
  const fmt = CAP ? 'rgba8unorm' : navigator.gpu.getPreferredCanvasFormat();
  const ctx = CAP ? null : canvas.getContext('webgpu');
  if (ctx) ctx.configure({ device: dev, format: fmt, alphaMode: 'opaque' });
  const SAMPLES = CRYSTAL.msaa;

  const meadowRoot = new URL('../assets/meadow/', import.meta.url).href;
  const matRoot = new URL('../biome-factory/fixtures/materials-v2/', import.meta.url);
  const breathClip = await makeBreathClip(dev, meadowRoot);
  const [ground, wall, crystalAlb, archAlb, violetAlb, streamAlb, atlas, feet, planetBmp] = await Promise.all([
    loadAlbedo(dev, new URL(ALBEDO.ground, matRoot).href),
    loadAlbedo(dev, new URL(ALBEDO.wall, matRoot).href),
    loadAlbedo(dev, new URL(ALBEDO.crystal, matRoot).href),
    loadAlbedo(dev, new URL(ALBEDO.architecture, matRoot).href),
    loadAlbedo(dev, new URL(ALBEDO.violet, matRoot).href),
    loadAlbedo(dev, new URL(ALBEDO.stream, matRoot).href),
    loadTex(dev, new URL(CRYSTAL.bolt, import.meta.url).href),
    (async () => {
      const bmp = await createImageBitmap(await (await fetch(new URL(CRYSTAL.bolt, import.meta.url).href)).blob(), { colorSpaceConversion: 'none' });
      const cv = new OffscreenCanvas(bmp.width, bmp.height);
      const cx = cv.getContext('2d', { willReadFrequently: true });
      cx.drawImage(bmp, 0, 0);
      const id = cx.getImageData(0, 0, bmp.width, bmp.height);
      return measureAtlasFeet(id.data, id.width, id.height, { cols: 8, rows: 4, alphaThresh: 16 });
    })(),
    createImageBitmap(await (await fetch(new URL(PLANET.file, import.meta.url).href)).blob(), { colorSpaceConversion: 'none' }),
  ]);
  const planetPrepared = await (async () => {
    const cv = new OffscreenCanvas(planetBmp.width, planetBmp.height);
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(planetBmp, 0, 0);
    const id = cx.getImageData(0, 0, planetBmp.width, planetBmp.height);
    const out = prepareSurfaceRGBA(id.data, planetBmp.width, planetBmp.height, PLANET.seamBand, PLANET.poleRows);
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = 8; y < 28; y++) for (let x = 0; x < planetBmp.width; x += 8) {
      const i = (y * planetBmp.width + x) * 4;
      r += out[i]; g += out[i + 1]; b += out[i + 2]; n++;
    }
    const lin = (c) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
    cx.putImageData(new ImageData(out, planetBmp.width, planetBmp.height), 0, 0);
    return { canvas: cv, atmo: [lin(r / n), lin(g / n), lin(b / n)] };
  })();
  const planetTex = await loadCanvasMips(dev, planetPrepared.canvas);
  const pCenter = planetCenter(PLANET.dir, PLANET.distance);
  const pYaw = frontYaw(PLANET.dir);
  const atmo = planetPrepared.atmo;
  const planetVerts = createPlanetMesh();
  const planted = pickPlantedFrame(feet);
  IDLE.setFeet(feet.feet, feet.paws);
  IDLE.applyPlanted(planted);
  live.phase = IDLE.cfg.idlePhase;

  const bounce = await (async () => {
    const cv = new OffscreenCanvas(ground.bmp.width, ground.bmp.height);
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(ground.bmp, 0, 0);
    const id = cx.getImageData(0, 0, ground.bmp.width, ground.bmp.height);
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < id.data.length; i += 64) { r += id.data[i]; g += id.data[i + 1]; b += id.data[i + 2]; n++; }
    return [srgbToLin(r / n / 255), srgbToLin(g / n / 255), srgbToLin(b / n / 255)];
  })();
  const fogCol = [0, 0, 0];
  const sun = LIGHT.sun;
  const sunL = Math.hypot(...sun);

  const mk = (data, usage) => {
    const size = (data.byteLength + 3) & ~3;
    const b = dev.createBuffer({ size, usage, mappedAtCreation: true });
    new Float32Array(b.getMappedRange()).set(data);
    b.unmap();
    return b;
  };
  const vb = mk(world.verts, GPUBufferUsage.VERTEX);
  const sb = mk(world.sky, GPUBufferUsage.VERTEX);
  const ub = dev.createBuffer({ size: 512, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const aniso = Math.min(8, ad.limits.maxSamplerAnisotropy || 1);
  const samp = await noteErr('sampler', async () => dev.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', addressModeU: 'repeat', addressModeV: 'repeat', maxAnisotropy: aniso }));
  const bgl = dev.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: {} },
    { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    { binding: 5, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    { binding: 6, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    { binding: 7, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    { binding: 8, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    { binding: 9, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    { binding: 10, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    { binding: 18, visibility: GPUShaderStage.FRAGMENT, texture: {} },
  ] });
  const planetSamp = dev.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', addressModeU: 'repeat', addressModeV: 'clamp-to-edge', maxAnisotropy: aniso });
  const bg = await noteErr('bind group', async () => dev.createBindGroup({ layout: bgl, entries: [
    { binding: 0, resource: { buffer: ub } },
    { binding: 1, resource: samp },
    { binding: 2, resource: ground.tex.createView() },
    { binding: 3, resource: atlas.tex.createView() },
    { binding: 4, resource: planetTex.createView() },
    { binding: 5, resource: planetSamp },
    { binding: 6, resource: wall.tex.createView() },
    { binding: 7, resource: crystalAlb.tex.createView() },
    { binding: 8, resource: archAlb.tex.createView() },
    { binding: 9, resource: violetAlb.tex.createView() },
    { binding: 10, resource: streamAlb.tex.createView() },
    { binding: 18, resource: breathClip.texture.createView() },
  ] }));
  const layout = dev.createPipelineLayout({ bindGroupLayouts: [bgl] });
  const mod = dev.createShaderModule({ code: WGSL });
  const vbuf = { arrayStride: 32, attributes: [
    { shaderLocation: 0, offset: 0, format: 'float32x4' },
    { shaderLocation: 1, offset: 16, format: 'float32x4' },
  ] };
  const pipe = (vs, fs, alpha, depthWrite) => dev.createRenderPipeline({
    layout,
    vertex: { module: mod, entryPoint: vs, buffers: vs === 'vs' ? [vbuf] : [] },
    fragment: { module: mod, entryPoint: fs, targets: [{ format: fmt, blend: alpha ? { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } } : undefined }] },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    multisample: { count: SAMPLES, alphaToCoverageEnabled: vs === 'vsBolt' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: depthWrite, depthCompare: 'less' },
  });
  const pWorld = pipe('vs', 'fs', false, true);
  const pSky = pipe('vs', 'fs', false, false);
  const pBolt = pipe('vsBolt', 'fsBolt', false, true);
  const pContact = pipe('vsContact', 'fsContact', true, false);
  const pbuf = { arrayStride: 24, attributes: [
    { shaderLocation: 0, offset: 0, format: 'float32x3' },
    { shaderLocation: 1, offset: 12, format: 'float32x3' },
  ] };
  const pvb = mk(planetVerts, GPUBufferUsage.VERTEX);
  const pCount = planetVerts.length / 6;
  const pipeP = (vs, fs, blend, depthWrite) => dev.createRenderPipeline({
    layout,
    vertex: { module: mod, entryPoint: vs, buffers: [pbuf] },
    fragment: { module: mod, entryPoint: fs, targets: [{ format: fmt, blend }] },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    multisample: { count: SAMPLES },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: depthWrite, depthCompare: 'less' },
  });
  const limbBlend = { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } };
  const pPlanet = pipeP('vsPlanet', 'fsPlanet', undefined, true);
  const pLimb = pipeP('vsLimb', 'fsLimb', limbBlend, false);
  const compileNotes = [];
  if (mod.getCompilationInfo) {
    const ci = await mod.getCompilationInfo();
    for (const m of ci.messages) compileNotes.push(m.message);
  }
  const msaa = dev.createTexture({ size: [W, H], format: fmt, sampleCount: SAMPLES, usage: GPUTextureUsage.RENDER_ATTACHMENT });
  const depth = dev.createTexture({ size: [W, H], format: 'depth24plus', sampleCount: SAMPLES, usage: GPUTextureUsage.RENDER_ATTACHMENT });
  const off = dev.createTexture({ size: [W, H], format: fmt, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
  const bpr = Math.ceil(W * 4 / 256) * 256;
  const rb = CAP ? dev.createBuffer({ size: bpr * H, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }) : null;
  const infoErr = [];
  dev.addEventListener?.('uncapturederror', e => { infoErr.push(String(e.error || e)); window.__crystalErr = infoErr.join(' | '); });

  const crops = new Float32Array(7 * 4);
  const U = new Float32Array(128);
  U.set(crops, 60);
  // fog.rgb + strength, grid.w = fog start. crops live at float 60.
  function fillU(t) {
    const bp = [live.x, terrH(live.x, live.z), live.z];
    let { eye, tgt } = followEye(bp, live.cam, terrH, 0);
    if (live.pitch) tgt[1] = eye[1] + Math.tan(live.pitch) * 4.2;
    if (SHOT === 'wall' || SHOT === 'crystal') {
      const z = SHOT === 'wall' ? -6 : -11;
      const x = pathX(z) + (SHOT === 'wall' ? -5.6 : -4.4);
      const y = terrH(x, z);
      eye = SHOT === 'wall' ? [x + 2.2, y + 1.55, z + 0.05] : [x + 2.5, y + 1.25, z + 1.15];
      tgt = SHOT === 'wall' ? [x, y + 1.7, z] : [x, y + 1.2, z];
    }
    const view = lookAt(eye, tgt, [0, 1, 0]);
    const proj = persp(FOV_Y, W / H, 0.08, 5200);
    const vp = mul(proj, view);
    U.set(vp, 0);
    U.set([eye[0], eye[1], eye[2], t], 32);
    U.set([bp[0], bp[1], bp[2], live.psi], 36);
    const ff = (live.phase % 1) * 32;
    const roll = Math.max(-8 * Math.PI / 180, Math.min(8 * Math.PI / 180, live.w * 0.15));
    U.set([roll, live.w, live.v, ff], 40);
    U.set([bounce[0], bounce[1], bounce[2], CRYSTAL.fogDist[0]], 44);
    U.set([sun[0] / sunL, sun[1] / sunL, sun[2] / sunL, 0], 48);
    IDLE.writeUniforms(U, IDLE.sample());
    U[52] = 0;
    U[53] = live.idleMix || 0;
    U.set([fogCol[0], fogCol[1], fogCol[2], 0], 56);
    U.set(crops, 60);
    U.set([pCenter[0], pCenter[1], pCenter[2], PLANET.radius], 88);
    U.set([pYaw, PLANET.limb, 0, 0], 92);
    U.set([atmo[0], atmo[1], atmo[2], 1], 96);
  }

  const skyVerts = world.sky.length / 8;
  const worldVerts = world.verts.length / 8;
  function renderFixed(t) {
    fillU(t);
    dev.queue.writeBuffer(ub, 0, U);
    const target = CAP ? off : ctx.getCurrentTexture();
    const enc = dev.createCommandEncoder();
    const pass = enc.beginRenderPass({
      colorAttachments: [{ view: msaa.createView(), resolveTarget: target.createView(), loadOp: 'clear', storeOp: 'discard', clearValue: [0, 0, 0, 1] }],
      depthStencilAttachment: { view: depth.createView(), depthLoadOp: 'clear', depthClearValue: 1, depthStoreOp: 'discard' },
    });
    breathClip.sync(live.idleT || 0);
    pass.setBindGroup(0, bg);
    pass.setPipeline(pSky); pass.setVertexBuffer(0, sb); pass.draw(skyVerts);
    pass.setPipeline(pPlanet); pass.setVertexBuffer(0, pvb); pass.draw(pCount);
    pass.setPipeline(pWorld); pass.setVertexBuffer(0, vb); pass.draw(worldVerts);
    pass.setPipeline(pLimb); pass.setVertexBuffer(0, pvb); pass.draw(pCount);
    if (!SHOT) {
      pass.setPipeline(pContact); pass.draw(6);
      pass.setPipeline(pBolt); pass.draw(6);
    }
    pass.end();
    if (CAP) enc.copyTextureToBuffer({ texture: off }, { buffer: rb, bytesPerRow: bpr }, [W, H]);
    dev.queue.submit([enc.finish()]);
  }

  window.__crystalInfo = {
    biome: CRYSTAL.id, W, H, msaa: SAMPLES, dprCap: 2, tris: worldVerts / 3, skyVerts,
    candidate: gate.candidate, release: gate.release, missing: gate.missing, tiles: TILE_M,
    referenceTexture: false, bolt: 'bolt439_atlas', breath: BREATH_BUILD,
    compile: compileNotes,
    breathClip: BREATH.clipName, breathRgba: BREATH.rgbaDir, breathFrames: BREATH.frames,
    planet: PLANET.sha256, circles: world.circles.length, fov: 62, worldVerts,
  };
  window.__live = live;
  window.__terrH = terrH;

  if (CAP) {
    const c2 = new OffscreenCanvas(W, H);
    const x2 = c2.getContext('2d', { willReadFrequently: true });
    let sim = 0;
    window.__crystalFrame = async (t) => {
      // Frame-sized steps. bolt-idle drops any step that stays under vIdle, so 240 Hz never leaves the stop.
      const dt = 1 / 60;
      while (sim < t - 1e-5) { const h = Math.min(dt, t - sim); stepLive(h); sim += h; }
      dev.pushErrorScope('validation');
      renderFixed(t);
      const gpuErr = await dev.popErrorScope();
      await dev.queue.onSubmittedWorkDone();
      await rb.mapAsync(GPUMapMode.READ);
      const src = new Uint8Array(rb.getMappedRange());
      const img = new ImageData(W, H);
      for (let y = 0; y < H; y++) img.data.set(src.subarray(y * bpr, y * bpr + W * 4), y * W * 4);
      rb.unmap();
      x2.putImageData(img, 0, 0);
      const useJpg = qs.get('jpg') === '1';
      const blob = await c2.convertToBlob(useJpg ? { type: 'image/jpeg', quality: 0.92 } : { type: 'image/png' });
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = '';
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      const info = { x: live.x, z: live.z, psi: live.psi, v: live.v, y: terrH(live.x, live.z), idleMix: live.idleMix || 0, breathFrame: live.breathFrame || 0, breathState: live.breathState || 'run', missing: gate.missing, gpuErr: gpuErr ? String(gpuErr.message || gpuErr) : null };
      if (useJpg) return { jpg: btoa(s), info };
      return { png: btoa(s), info, compile: compileNotes };
    };
    window.__crystalReady = true;
    return;
  }

  let t0 = performance.now(), last = t0;
  const loop = (now) => {
    const t = (now - t0) / 1000;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    stepLive(dt);
    renderFixed(t);
    if (hud) hud.textContent = `crystal · ${live.v > 0.2 ? 'run' : 'stop'}`;
    requestAnimationFrame(loop);
  };
  window.__crystalReady = true;
  requestAnimationFrame(loop);
}

main().catch(e => {
  if (hud) hud.textContent = 'ERR ' + e;
  console.error(e);
  window.__crystalErr = String(e && e.stack || e);
  window.__crystalReady = false;
});

// Obsidian Reach — isolated km-scale page. Does not touch the meadow.
import { makeAtmosphere } from '../engine/atmosphere.js?v=1';
import { makeHeight, heightWgsl } from '../engine/bricks/heightfield.js';
import { buildWindow, LEVELS } from '../engine/bricks/terrain-clipmap.js';
import { cullWgsl, planesFromVP } from '../engine/bricks/gpu-cull.js';
import { buildSolid, lodForDistance } from '../engine/bricks/huge-structure.js';
import { LIVE_BOLT, cameraPose, lookAt, persp, mul } from '../engine/bricks/follow-bolt.js';
import { shadeFns, scaleLiteral } from '../biome-factory/shade.js';
import { HEIGHT_SPEC, LIBRARY, STRUCTURES, SUN, TILE_M } from './biome.js';
import { startState, stepBolt, scripted } from './run.js';

export const DRAW_CALLS = 5;
const TILE = scaleLiteral(TILE_M);
const heightOf = makeHeight(HEIGHT_SPEC);
const qs = typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search);

export function terrainShader(manualGamma) {
  const out = manualGamma ? 'present(lit)' : 'vec4f(clamp(lit, vec3f(0.0), vec3f(1.0)), 1.0)';
  return /* wgsl */`
struct U {
  vp: mat4x4f,
  cam: vec4f,
  bolt: vec4f,
  bp: vec4f,
  sun: vec4f,
  fwd: vec4f,
  right: vec4f,
  up: vec4f,
  misc: vec4f,
}
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var stone: texture_2d_array<f32>;
@group(0) @binding(3) var atlas: texture_2d<f32>;
@group(0) @binding(4) var<storage, read> vis: array<u32>;
${heightWgsl(HEIGHT_SPEC)}
${shadeFns()}
struct In { @location(0) p: vec3f, @location(1) pid: f32, @location(2) mat: f32 }
struct VO { @builtin(position) p: vec4f, @location(0) w: vec3f, @location(1) @interpolate(flat) mat: f32 }
@vertex fn vsWorld(in: In) -> VO {
  var o: VO;
  let id = u32(in.pid);
  if (id < arrayLength(&vis) && vis[id] == 0u) { o.p = vec4f(2.0, 2.0, 2.0, 1.0); o.w = in.p; o.mat = in.mat; return o; }
  o.w = in.p; o.mat = in.mat; o.p = u.vp * vec4f(in.p, 1.0); return o;
}
@fragment fn fsWorld(v: VO) -> @location(0) vec4f {
  var n = normalize(cross(dpdx(v.w), dpdy(v.w)));
  let view = normalize(u.cam.xyz - v.w);
  if (dot(n, view) < 0.0) { n = -n; }
  let layer = i32(v.mat + 0.5);
  let k = ${TILE};
  let sx = textureSample(stone, samp, v.w.zy * k, layer).rgb;
  let sy = textureSample(stone, samp, v.w.xz * k, layer).rgb;
  let sz = textureSample(stone, samp, v.w.xy * k, layer).rgb;
  let alb = triMix(sx, sy, sz, n);
  let lit0 = shadeAlb(alb, n, view, 0.02);
  let km = length(v.w - u.cam.xyz) * 0.001;
  let tau = vec3f(5.8e-3, 13.5e-3, 33.1e-3) * km;
  let lit = lit0 * exp(-tau) * 2.2;
  return ${out};
}

struct SO { @builtin(position) p: vec4f, @location(0) uv: vec2f }
@vertex fn vsSky(@builtin(vertex_index) i: u32) -> SO {
  var q = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var o: SO; o.p = vec4f(q[i], 0.0, 1.0); o.uv = q[i]; return o;
}
${makeAtmosphere({ alt: 0, blend: 1, exposure: 6 })}
@fragment fn fsSky(v: SO) -> @location(0) vec4f {
  let dir = normalize(u.fwd.xyz + u.right.xyz * v.uv.x * u.misc.x + u.up.xyz * v.uv.y * u.misc.y);
  var col = atmoSky(dir, normalize(u.sun.xyz), u.cam.y);
  col = col / (1.0 + col);
  ${manualGamma ? 'return present(col);' : 'return vec4f(clamp(col, vec3f(0.0), vec3f(1.0)), 1.0);'}
}

struct BO { @builtin(position) p: vec4f, @location(0) uv: vec2f, @location(1) w: vec3f }
@vertex fn vsBolt(@builtin(vertex_index) vi: u32) -> BO {
  var q = array<vec2f, 6>(vec2f(-0.5, 0.0), vec2f(0.5, 0.0), vec2f(0.5, 1.0), vec2f(-0.5, 0.0), vec2f(0.5, 1.0), vec2f(-0.5, 1.0));
  let c = q[vi];
  let b = vec3f(u.bolt.x, u.bolt.y, u.bolt.z);
  let toE = normalize(vec2f(u.cam.x - b.x, u.cam.z - b.z));
  let rt = vec3f(-toE.y, 0.0, toE.x);
  let lx = c.x * ${LIVE_BOLT.cardW};
  let ly = (c.y - ${LIVE_BOLT.cardFoot}) * ${LIVE_BOLT.cardH} - ${LIVE_BOLT.pawSink};
  let w = b + rt * lx + vec3f(0.0, ly, 0.0);
  var o: BO; o.p = u.vp * vec4f(w, 1.0); o.uv = vec2f(-c.x + 0.5, 1.0 - c.y); o.w = w; return o;
}
fn cell(f: u32, uv: vec2f) -> vec4f {
  let g = vec2f(f32(f % 8u), f32(f / 8u));
  return textureSampleLevel(atlas, samp, (g + clamp(uv, vec2f(0.003), vec2f(0.997))) / vec2f(8.0, 4.0), 0.0);
}
@fragment fn fsBolt(v: BO) -> @location(0) vec4f {
  let ff = u.bp.w;
  let a = u32(floor(ff)) % 32u;
  let b = (a + 1u) % 32u;
  let s = mix(cell(a, v.uv), cell(b, v.uv), fract(ff));
  if (s.a < 0.45) { discard; }
  var c = s.rgb;
  let dist = length(v.w - u.cam.xyz);
  let km = dist * 0.001;
  c = c * exp(-vec3f(5.8e-3, 13.5e-3, 33.1e-3) * km);
  ${manualGamma ? 'return vec4f(pow(clamp(c, vec3f(0.0), vec3f(1.0)), vec3f(1.0 / 2.2)), s.a);' : 'return vec4f(c, s.a);'}
}
`;
}

const PATCHES = LEVELS * 64;

function sunN() {
  const l = Math.hypot(SUN[0], SUN[1], SUN[2]) || 1;
  return [SUN[0] / l, SUN[1] / l, SUN[2] / l];
}

function packTerrain(win) {
  let tris = 0;
  for (const L of win.levels) tris += L.idx.length / 3;
  const v = new Float32Array(tris * 3 * 5);
  const spheres = [];
  const box = new Map();
  let n = 0;
  win.levels.forEach((L, li) => {
    for (let t = 0; t < L.idx.length; t += 3) {
      const ids = [L.idx[t], L.idx[t + 1], L.idx[t + 2]];
      const patch = li * 64 + L.patchOf[ids[0]];
      for (const id of ids) {
        const o = id * 3;
        v[n++] = L.pos[o]; v[n++] = L.pos[o + 1]; v[n++] = L.pos[o + 2];
        v[n++] = patch; v[n++] = 0;
        let b = box.get(patch);
        if (!b) { b = { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] }; box.set(patch, b); }
        for (let k = 0; k < 3; k++) {
          b.min[k] = Math.min(b.min[k], L.pos[o + k]);
          b.max[k] = Math.max(b.max[k], L.pos[o + k]);
        }
      }
    }
  });
  for (const [patch, b] of box) {
    const c = [(b.min[0] + b.max[0]) * 0.5, (b.min[1] + b.max[1]) * 0.5, (b.min[2] + b.max[2]) * 0.5];
    const r = 0.5 * Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]);
    spheres.push({ patch, center: c, radius: r });
  }
  return { v: v.subarray(0, n), spheres, tris };
}

function packStructures(cam) {
  const parts = [];
  const spheres = [];
  for (let i = 0; i < STRUCTURES.length; i++) {
    const spec = STRUCTURES[i];
    const d = Math.hypot(cam[0] - spec.x, cam[1] - spec.z);
    const solid = buildSolid(spec, lodForDistance(d), heightOf);
    const patch = PATCHES + i;
    const v = new Float32Array(solid.idx.length * 5);
    let n = 0;
    for (let t = 0; t < solid.idx.length; t++) {
      const o = solid.idx[t] * 4;
      v[n++] = solid.pos[o]; v[n++] = solid.pos[o + 1]; v[n++] = solid.pos[o + 2];
      v[n++] = patch; v[n++] = solid.pos[o + 3];
    }
    parts.push(v);
    spheres.push({ patch, center: solid.sphere.center, radius: solid.sphere.radius, id: spec.id });
  }
  let len = 0;
  for (const p of parts) len += p.length;
  const v = new Float32Array(len);
  let o = 0;
  for (const p of parts) { v.set(p, o); o += p.length; }
  return { v, spheres };
}

async function loadBitmap(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('missing ' + url);
  return createImageBitmap(await res.blob(), { colorSpaceConversion: 'none' });
}

async function main() {
  window.__stage = 'start';
  const canvas = document.getElementById('c');
  const dbg = document.getElementById('dbg');
  if (qs.get('debug') === '1' && dbg) dbg.style.display = 'block';
  window.__stage = 'adapter';
  const ad = await Promise.race([
    navigator.gpu?.requestAdapter() ?? Promise.resolve(null),
    new Promise(resolve => setTimeout(() => resolve(null), 8000)),
  ]);
  if (!ad) { window.__ready = 'no-webgpu'; if (dbg) dbg.textContent = 'No WebGPU'; return; }
  const dev = await ad.requestDevice({
    requiredLimits: {
      maxStorageBuffersInVertexStage: ad.limits.maxStorageBuffersInVertexStage,
    },
  });
  window.__limits = { vertexStorage: ad.limits.maxStorageBuffersInVertexStage };
  dev.lost.then((info) => { window.__lost = info.message; });
  dev.addEventListener('uncapturederror', (e) => {
    const msg = e.error?.message || String(e.error || e);
    window.__val = (window.__val ? window.__val + '\n' : '') + msg;
    window.__gpuError = msg;
  });
  const W = parseInt(qs.get('w'), 10) || Math.max(2, Math.round(innerWidth * Math.min(devicePixelRatio || 1, 2)));
  const H = parseInt(qs.get('h'), 10) || Math.max(2, Math.round(innerHeight * Math.min(devicePixelRatio || 1, 2)));
  canvas.width = W; canvas.height = H;
  const fmt = navigator.gpu.getPreferredCanvasFormat();
  const manualGamma = !String(fmt).includes('srgb');
  const ctx = canvas.getContext('webgpu');
  ctx.configure({ device: dev, format: fmt, alphaMode: 'opaque' });

  const stone = dev.createTexture({
    size: [1024, 1024, 4], format: 'rgba8unorm-srgb',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  window.__stage = 'textures';
  const root = new URL('../../../', import.meta.url);
  for (let layer = 0; layer < LIBRARY.length; layer++) {
    const bmp = await loadBitmap(new URL(LIBRARY[layer].source, root).href);
    dev.queue.copyExternalImageToTexture({ source: bmp }, { texture: stone, origin: [0, 0, layer] }, [1024, 1024, 1]);
  }
  const atlasBmp = await loadBitmap(new URL('../assets/meadow/bolt439_atlas.png', import.meta.url).href);
  const atlas = dev.createTexture({
    size: [atlasBmp.width, atlasBmp.height], format: 'rgba8unorm-srgb',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  dev.queue.copyExternalImageToTexture({ source: atlasBmp }, { texture: atlas }, [atlasBmp.width, atlasBmp.height]);
  await dev.queue.onSubmittedWorkDone();

  window.__stage = 'shader';
  const mod = dev.createShaderModule({ code: terrainShader(manualGamma) });
  const cullMod = dev.createShaderModule({ code: cullWgsl() });
  const info = await mod.getCompilationInfo();
  const errs = info.messages.filter(m => m.type === 'error');
  if (errs.length) { window.__gpuError = errs.map(m => m.lineNum + ':' + m.message).join('\n'); window.__ready = 'shader'; return; }

  window.__stage = 'pipelines';
  const bgl = dev.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
    { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: '2d-array' } },
    { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    { binding: 4, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
  ] });
  const cullBgl = dev.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
    { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
    { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
  ] });
  const layout = dev.createPipelineLayout({ bindGroupLayouts: [bgl] });
  const cullLayout = dev.createPipelineLayout({ bindGroupLayouts: [cullBgl] });
  const depthFmt = 'depth24plus';
  const pipe = (vs, fs, depth) => dev.createRenderPipeline({
    layout, vertex: { module: mod, entryPoint: vs, buffers: vs === 'vsWorld' ? [{
      arrayStride: 20,
      attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' },
        { shaderLocation: 1, offset: 12, format: 'float32' },
        { shaderLocation: 2, offset: 16, format: 'float32' },
      ],
    }] : [] },
    fragment: { module: mod, entryPoint: fs, targets: [{ format: 'rgba8unorm' }] },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: depth ? { format: depthFmt, depthWriteEnabled: true, depthCompare: 'less' } : undefined,
  });
  const pSky = dev.createRenderPipeline({
    layout, vertex: { module: mod, entryPoint: 'vsSky' },
    fragment: { module: mod, entryPoint: 'fsSky', targets: [{ format: 'rgba8unorm' }] },
    primitive: { topology: 'triangle-list' },
    depthStencil: { format: depthFmt, depthWriteEnabled: false, depthCompare: 'always' },
  });
  const pWorld = pipe('vsWorld', 'fsWorld', true);
  const pBolt = dev.createRenderPipeline({
    layout, vertex: { module: mod, entryPoint: 'vsBolt' },
    fragment: { module: mod, entryPoint: 'fsBolt', targets: [{ format: 'rgba8unorm' }] },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: { format: depthFmt, depthWriteEnabled: true, depthCompare: 'less' },
  });
  const pCull = dev.createComputePipeline({ layout: cullLayout, compute: { module: cullMod, entryPoint: 'cs' } });
  const blitMod = dev.createShaderModule({ code: `
struct O { @builtin(position) p: vec4f, @location(0) uv: vec2f }
@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var tex: texture_2d<f32>;
@vertex fn vs(@builtin(vertex_index) i: u32) -> O {
  var q = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var o: O; o.p = vec4f(q[i], 0.0, 1.0); o.uv = vec2f(q[i].x * 0.5 + 0.5, 0.5 - q[i].y * 0.5); return o;
}
@fragment fn fs(v: O) -> @location(0) vec4f { return textureSample(tex, samp, v.uv); }
` });
  const blitBgl = dev.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
  ] });
  const pBlit = dev.createRenderPipeline({
    layout: dev.createPipelineLayout({ bindGroupLayouts: [blitBgl] }),
    vertex: { module: blitMod, entryPoint: 'vs' },
    fragment: { module: blitMod, entryPoint: 'fs', targets: [{ format: fmt }] },
    primitive: { topology: 'triangle-list' },
  });

  const aniso = Math.min(4, ad.limits.maxSamplerAnisotropy || 1);
  const samp = dev.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'repeat', addressModeV: 'repeat', maxAnisotropy: aniso });
  const clamp = dev.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
  const ub = dev.createBuffer({ size: 256, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const vis = dev.createBuffer({ size: (PATCHES + 8) * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
  dev.queue.writeBuffer(vis, 0, new Uint32Array(PATCHES + 8).fill(1));
  const sphereBuf = dev.createBuffer({ size: (PATCHES + 8) * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  const planeBuf = dev.createBuffer({ size: 96, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const bg = dev.createBindGroup({ layout: bgl, entries: [
    { binding: 0, resource: { buffer: ub } },
    { binding: 1, resource: samp },
    { binding: 2, resource: stone.createView({ dimension: '2d-array' }) },
    { binding: 3, resource: atlas.createView() },
    { binding: 4, resource: { buffer: vis } },
  ] });
  const cullBg = dev.createBindGroup({ layout: cullBgl, entries: [
    { binding: 0, resource: { buffer: sphereBuf } },
    { binding: 1, resource: { buffer: vis } },
    { binding: 2, resource: { buffer: planeBuf } },
  ] });
  const color = dev.createTexture({ size: [W, H], format: 'rgba8unorm', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC });
  const depth = dev.createTexture({ size: [W, H], format: depthFmt, usage: GPUTextureUsage.RENDER_ATTACHMENT });
  const blitBg = dev.createBindGroup({ layout: blitBgl, entries: [
    { binding: 0, resource: clamp }, { binding: 1, resource: color.createView() },
  ] });
  const bpr = Math.ceil(W * 4 / 256) * 256;
  const read = dev.createBuffer({ size: bpr * H, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  const vTerrain = dev.createBuffer({ size: 16 * 1024 * 1024, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  const vStruct = dev.createBuffer({ size: 2 * 1024 * 1024, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });

  const sun = sunN();
  const aspect = W / H;
  const tanY = Math.tan(LIVE_BOLT.fovDeg * Math.PI / 360);
  let st = startState(heightOf);
  const keys = new Set();
  addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  let holding = false;
  canvas.addEventListener('pointerdown', () => { holding = true; });
  addEventListener('pointerup', () => { holding = false; });

  let tCount = 0, sCount = 0, sphereCount = 0;
  function upload(pose) {
    const view = lookAt(pose.eye, pose.tgt, [0, 1, 0]);
    const proj = persp(LIVE_BOLT.fovDeg * Math.PI / 180, aspect, LIVE_BOLT.near, LIVE_BOLT.far);
    const vp = mul(proj, view);
    const U = new Float32Array(64);
    U.set(vp, 0);
    U.set([pose.eye[0], pose.eye[1], pose.eye[2], st.t], 16);
    U.set([pose.bp[0], pose.bp[1], pose.bp[2], st.psi], 20);
    U.set([0, 0, st.v, (st.phase % 1) * 32], 24);
    U.set([sun[0], sun[1], sun[2], 0], 28);
    U.set([pose.fwd[0], pose.fwd[1], pose.fwd[2], 0], 32);
    U.set([pose.right[0], pose.right[1], pose.right[2], 0], 36);
    U.set([pose.up[0], pose.up[1], pose.up[2], 0], 40);
    U.set([tanY * aspect, tanY, 0, LIVE_BOLT.far], 44);
    dev.queue.writeBuffer(ub, 0, U);
    const win = buildWindow(st.x, st.z, heightOf);
    const terr = packTerrain(win);
    const structs = packStructures([st.x, st.z]);
    dev.queue.writeBuffer(vTerrain, 0, terr.v);
    dev.queue.writeBuffer(vStruct, 0, structs.v);
    tCount = terr.v.length / 5;
    sCount = structs.v.length / 5;
    const spheres = terr.spheres.concat(structs.spheres);
    sphereCount = spheres.length;
    const sb = new Float32Array((PATCHES + 8) * 4);
    for (const s of spheres) {
      const o = s.patch * 4;
      sb[o] = s.center[0]; sb[o + 1] = s.center[1]; sb[o + 2] = s.center[2]; sb[o + 3] = s.radius;
    }
    dev.queue.writeBuffer(sphereBuf, 0, sb);
    const planes = planesFromVP(vp);
    const pb = new Float32Array(24);
    planes.forEach((p, i) => { pb[i * 4] = p[0]; pb[i * 4 + 1] = p[1]; pb[i * 4 + 2] = p[2]; pb[i * 4 + 3] = p[3]; });
    dev.queue.writeBuffer(planeBuf, 0, pb);
    const cpu = cullList(planes, spheres.map(s => ({ center: s.center, radius: s.radius })));
    window.__cpuVis = cpu.reduce((a, b) => a + b, 0);
    window.__spheres = spheres.length;
    return { vp, cpu };
  }

  function encode() {
    const pose = cameraPose(st, heightOf);
    upload(pose);
    const enc = dev.createCommandEncoder();
    if (qs.get('only') !== 'sky') {
      const c = enc.beginComputePass();
      c.setPipeline(pCull); c.setBindGroup(0, cullBg); c.dispatchWorkgroups(Math.ceil((PATCHES + 8) / 64)); c.end();
    }
    const pass = enc.beginRenderPass({
      colorAttachments: [{ view: color.createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1] }],
      depthStencilAttachment: { view: depth.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' },
    });
    pass.setPipeline(pSky); pass.setBindGroup(0, bg); pass.draw(3);
    if (qs.get('only') !== 'sky') {
      pass.setPipeline(pWorld); pass.setVertexBuffer(0, vTerrain); pass.draw(tCount);
      pass.setVertexBuffer(0, vStruct); pass.draw(sCount);
      pass.setPipeline(pBolt); pass.draw(6);
    }
    pass.end();
    const swap = enc.beginRenderPass({
      colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1] }],
    });
    swap.setPipeline(pBlit); swap.setBindGroup(0, blitBg); swap.draw(3); swap.end();
    if (qs.get('cap') === '1') enc.copyTextureToBuffer({ texture: color }, { buffer: read, bytesPerRow: bpr, rowsPerImage: H }, [W, H]);
    dev.queue.submit([enc.finish()]);
    window.__draws = DRAW_CALLS;
    if (dbg && dbg.style.display !== 'none') dbg.textContent = 'Obsidian Reach  ' + st.x.toFixed(0) + ' ' + st.z.toFixed(0);
  }

  function drive(dt) {
    if (qs.get('run') === '1' || qs.get('cap') === '1') return scripted(st.t);
    let psi = st.psi;
    if (keys.has('a') || keys.has('arrowleft')) psi += 1.5 * dt;
    if (keys.has('d') || keys.has('arrowright')) psi -= 1.5 * dt;
    const throttle = (holding || keys.has('w') || keys.has('arrowup')) ? 1 : 0;
    return { throttle, psi };
  }

  window.__step = async (dt) => {
    st = stepBolt(st, dt, heightOf, drive(dt));
    encode();
    await dev.queue.onSubmittedWorkDone();
    return st.t;
  };
  window.__grab = async () => {
    encode();
    await dev.queue.onSubmittedWorkDone();
    await read.mapAsync(GPUMapMode.READ);
    const mapped = new Uint8Array(read.getMappedRange());
    const tight = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) tight.set(mapped.subarray(y * bpr, y * bpr + W * 4), y * W * 4);
    read.unmap();
    let s = '';
    for (let i = 0; i < tight.length; i += 8192) s += String.fromCharCode.apply(null, tight.subarray(i, Math.min(tight.length, i + 8192)));
    return btoa(s);
  };
  window.__bench = async (n = 20) => {
    const samples = [];
    for (let i = 0; i < n; i++) {
      st = stepBolt(st, 1 / 60, heightOf, scripted(st.t));
      const t0 = performance.now();
      encode();
      await dev.queue.onSubmittedWorkDone();
      if (window.__lost) return { error: window.__lost, frames: i };
      samples.push(performance.now() - t0);
    }
    samples.sort((a, b) => a - b);
    const median = samples[Math.floor(samples.length / 2)];
    return {
      medianMs: median,
      minMs: samples[0],
      maxMs: samples[samples.length - 1],
      frames: n,
      gpuTimestamps: false,
      note: 'Headless queue round-trip, includes clipmap rebuild. Not a phone FPS.',
    };
  };
  window.__ready = true;
  window.__size = [W, H];

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000) || 1 / 60;
    last = now;
    if (!(qs.get('cap') === '1' && window.__paused)) {
      st = stepBolt(st, dt, heightOf, drive(dt));
      encode();
    }
    requestAnimationFrame(loop);
  }
  if (qs.get('cap') !== '1') requestAnimationFrame(loop);
  else {
    window.__stage = 'boot';
    try {
      encode();
      await dev.queue.onSubmittedWorkDone();
    } catch (e) {
      window.__bootError = (window.__val || '') + ' || ' + (window.__lost || '') + ' || ' + (e.message || e);
    }
    if (!window.__bootError) window.__bootError = window.__val || window.__lost || '';
  }
}

if (typeof navigator !== 'undefined') main().catch((err) => {
  window.__ready = 'error';
  window.__gpuError = (window.__stage || '?') + ' | ' + (err && (err.stack || err.message) || err);
});

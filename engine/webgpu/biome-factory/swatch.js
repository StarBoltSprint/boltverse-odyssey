// One close-up sheet. Same sampler, sRGB format, world UV scale, and shadeAlb as the canyon.
import { lookAt, persp, mul } from '../engine/bricks/follow-cam.js';
import { createMesh } from '../engine/bricks/facet-mesh.js';
import { CRYSTAL } from '../crystal/biome.js';
import { ALBEDO, TILE_M } from '../crystal/materials.js';
import { shadeFns, tileScales } from './shade.js';

const S = 256;
const qs = new URLSearchParams(location.search);
const canvas = document.getElementById('c');
canvas.width = S;
canvas.height = S;
const SC = tileScales();
const sun = CRYSTAL.sun;

const WGSL = /* wgsl */`
struct U { vp: mat4x4f, cam: vec4f, sun: vec4f, mode: vec4f };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var tex: texture_2d<f32>;
struct VO { @builtin(position) p: vec4f, @location(0) w: vec3f, @location(1) n: vec3f, @location(2) uv: vec2f };
@vertex fn vs(@location(0) a: vec4f, @location(1) b: vec4f) -> VO {
  var o: VO;
  o.p = u.vp * vec4f(a.xyz, 1.0);
  o.w = a.xyz; o.n = b.xyz; o.uv = vec2f(b.w, a.w); return o;
}
${shadeFns()}
fn triSample(p: vec3f, n: vec3f, sc: f32) -> vec3f {
  return triMix(
    textureSample(tex, samp, p.zy * sc).rgb,
    textureSample(tex, samp, p.xz * sc).rgb,
    textureSample(tex, samp, p.xy * sc).rgb, n);
}
@fragment fn fs(v: VO) -> @location(0) vec4f {
  let mode = u32(u.mode.x);
  let sc = u.mode.y;
  let view = normalize(u.cam.xyz - v.w);
  if (mode == 0u) { return present(textureSampleLevel(tex, samp, clamp(v.uv, vec2f(0.0), vec2f(1.0)), 0.0).rgb); }
  if (mode == 3u) {
    let alb = textureSampleLevel(tex, samp, clamp(v.uv, vec2f(0.0), vec2f(1.0)), 0.0).rgb;
    return present(shadeAlb(alb, normalize(v.n), view, 0.0));
  }
  var n = normalize(v.n);
  var alb: vec3f;
  if (mode == 2u) { return present(textureSample(tex, samp, v.w.xz * sc).rgb); }
  if (u.mode.z > 0.5) { n = waterN(v.w, 0.0); }
  if (u.mode.w > 0.5) { alb = triSample(v.w, n, sc); }
  else { alb = textureSample(tex, samp, v.w.xz * sc).rgb; }
  let specW = select(0.0, 0.06, u.mode.w > 1.5);
  return present(shadeAlb(alb, n, view, specW));
}
`;

function rawQuad() {
  const f = [];
  const p = (x, z, u, v) => f.push(x, 0, z, v, 0, 1, 0, u);
  p(-1, -1, 0, 0); p(1, 1, 1, 1); p(1, -1, 1, 0);
  p(-1, -1, 0, 0); p(-1, 1, 0, 1); p(1, 1, 1, 1);
  return new Float32Array(f);
}

function plane(mesh, x0, x1, z0, z1) {
  mesh.tri([x0, 0, z0], [x1, 0, z1], [x1, 0, z0], [0, 0], [1, 1], [1, 0], 0);
  mesh.tri([x0, 0, z0], [x0, 0, z1], [x1, 0, z1], [0, 0], [0, 1], [1, 1], 0);
}

async function loadAlbedo(dev, url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('asset missing ' + url + ' HTTP ' + res.status);
  const bmp = await createImageBitmap(await res.blob(), { colorSpaceConversion: 'none' });
  const cv = new OffscreenCanvas(bmp.width, bmp.height);
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(bmp, 0, 0);
  const id = cx.getImageData(0, 0, bmp.width, bmp.height);
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < id.data.length; i += 64) { r += id.data[i]; g += id.data[i + 1]; b += id.data[i + 2]; n++; }
  const levels = Math.floor(Math.log2(Math.max(bmp.width, bmp.height))) + 1;
  const tex = dev.createTexture({
    size: [bmp.width, bmp.height], format: 'rgba8unorm-srgb', mipLevelCount: levels,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  for (let l = 0; l < levels; l++) {
    const lw = Math.max(1, bmp.width >> l), lh = Math.max(1, bmp.height >> l);
    const src = l === 0 ? cv : await createImageBitmap(cv, { resizeWidth: lw, resizeHeight: lh, resizeQuality: 'high' });
    dev.queue.copyExternalImageToTexture({ source: src }, { texture: tex, mipLevel: l }, [lw, lh]);
  }
  return { tex, mean: [r / n, g / n, b / n], w: bmp.width, h: bmp.height };
}

function rampTexture(dev) {
  const w = 256, h = 32;
  const cv = new OffscreenCanvas(w, h);
  const cx = cv.getContext('2d');
  const g = cx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, '#000');
  g.addColorStop(1, '#fff');
  cx.fillStyle = g;
  cx.fillRect(0, 0, w, h);
  const tex = dev.createTexture({
    size: [w, h], format: 'rgba8unorm-srgb',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  dev.queue.copyExternalImageToTexture({ source: cv }, { texture: tex }, [w, h]);
  return tex;
}

function meshOf(build) {
  const mesh = createMesh();
  build(mesh);
  return mesh.finish();
}

function ortho(l, r, b, t, n, f) {
  return [2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, 1 / (n - f), 0, (l + r) / (l - r), (t + b) / (b - t), n / (n - f), 1];
}
function stats(px) {
  const ch = [[], [], []];
  for (let i = 0; i < px.length; i += 16) {
    if (px[i] + px[i + 1] + px[i + 2] === 0) continue;
    ch[0].push(px[i]); ch[1].push(px[i + 1]); ch[2].push(px[i + 2]);
  }
  const one = (a) => {
    const n = a.length || 1;
    const mean = a.reduce((s, v) => s + v, 0) / n;
    let d = 0;
    for (const v of a) d += (v - mean) ** 2;
    return { mean: Math.round(mean * 100) / 100, pstdev: Math.round(Math.sqrt(d / n) * 100) / 100, n };
  };
  return { r: one(ch[0]), g: one(ch[1]), b: one(ch[2]) };
}

function mae(a, b) {
  return Math.round(((Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3) * 100) / 100;
}

async function main() {
  const ad = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
  if (!ad) throw new Error('No WebGPU');
  const dev = await ad.requestDevice();
  const fmt = 'rgba8unorm';
  const root = new URL('./fixtures/materials-v2/', import.meta.url);
  const files = {};
  for (const [id, name] of Object.entries(ALBEDO)) files[id] = await loadAlbedo(dev, new URL(name, root).href);
  const ramp = rampTexture(dev);
  const aniso = Math.min(8, ad.limits.maxSamplerAnisotropy || 1);
  const samp = dev.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', addressModeU: 'repeat', addressModeV: 'repeat', maxAnisotropy: aniso });
  const ub = dev.createBuffer({ size: 256, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const bgl = dev.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: {} },
    { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} },
  ] });
  const layout = dev.createPipelineLayout({ bindGroupLayouts: [bgl] });
  const mod = dev.createShaderModule({ code: WGSL });
  const pipe = dev.createRenderPipeline({
    layout,
    vertex: { module: mod, entryPoint: 'vs', buffers: [{ arrayStride: 32, attributes: [
      { shaderLocation: 0, offset: 0, format: 'float32x4' },
      { shaderLocation: 1, offset: 16, format: 'float32x4' },
    ] }] },
    fragment: { module: mod, entryPoint: 'fs', targets: [{ format: fmt }] },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    multisample: { count: 4 },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
  });
  const msaa = dev.createTexture({ size: [S, S], format: fmt, sampleCount: 4, usage: GPUTextureUsage.RENDER_ATTACHMENT });
  const depth = dev.createTexture({ size: [S, S], format: 'depth24plus', sampleCount: 4, usage: GPUTextureUsage.RENDER_ATTACHMENT });
  const off = dev.createTexture({ size: [S, S], format: fmt, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
  const bpr = 256 * 4;
  const rb = dev.createBuffer({ size: bpr * S, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });

  const panels = [];
  const down = [0, 0, -1];
  function add(id, verts, eye, tgt, up, tex, mode, scale, water, tri) {
    panels.push({ id, verts, eye, tgt, up, tex, mode, scale, water, tri });
  }
  const full = rawQuad();
  add('ground-raw', full, [0, 3, 0], [0, 0, 0], down, files.ground.tex, 0, 1, 0, 0);
  add('ground-lit', full, [0, 3, 0], [0, 0, 0], down, files.ground.tex, 3, 1, 0, 0);
  add('ground-uv', meshOf(m => plane(m, 0, 6, 0, 2)), [3, 8, 1], [3, 0, 1], down, files.ground.tex, 2, Number(SC.ground), 0, 0);
  panels[panels.length - 1].ortho = [-3, 3, -1, 1, 0.05, 30];
  add('wall-bevel', meshOf(m => m.boxBevel(0, 1.1, 0, 1.4, 2.2, 0.5, 0.5, 0, 0.16)), [1.8, 1.5, 2.2], [0, 1.0, 0], [0, 1, 0], files.wall.tex, 1, Number(SC.wall), 0, 1);
  add('cyan-gem', meshOf(m => m.crystal(0, 0, 0, 0.42, 1.5, 0.4, 0)), [1.1, 0.9, 1.5], [0, 0.7, 0], [0, 1, 0], files.crystal.tex, 1, Number(SC.crystal), 0, 2);
  add('violet-gem', meshOf(m => m.crystal(0, 0, 0, 0.42, 1.5, 0.9, 0)), [1.1, 0.9, 1.5], [0, 0.7, 0], [0, 1, 0], files.violet.tex, 1, Number(SC.violet), 0, 2);
  add('stream', meshOf(m => plane(m, -1, 1, -1, 1)), [0, 2.2, 0.2], [0, 0, 0], down, files.stream.tex, 1, Number(SC.stream), 1, 0);
  add('ramp-raw', full, [0, 3, 0], [0, 0, 0], down, ramp, 0, 1, 0, 0);
  add('ramp-lit', full, [0, 3, 0], [0, 0, 0], down, ramp, 3, 1, 0, 0);
  for (const id of ['ground-raw', 'ground-lit', 'ramp-raw', 'ramp-lit']) {
    panels.find(p => p.id === id).ortho = [-1, 1, -1, 1, 0.05, 20];
  }

  const sheet = new OffscreenCanvas(S * 3, S * 3);
  const sx = sheet.getContext('2d');
  const out = [];
  for (let i = 0; i < panels.length; i++) {
    const p = panels[i];
    const U = new Float32Array(32);
    const view = lookAt(p.eye, p.tgt, p.up);
    const proj = p.ortho ? ortho(...p.ortho) : persp(40 * Math.PI / 180, 1, 0.05, 40);
    U.set(mul(proj, view), 0);
    U.set([p.eye[0], p.eye[1], p.eye[2], 0], 16);
    U.set([sun[0], sun[1], sun[2], 0], 20);
    U.set([p.mode, p.scale, p.water, p.tri], 24);
    dev.queue.writeBuffer(ub, 0, U);
    const vb = dev.createBuffer({ size: (p.verts.byteLength + 3) & ~3, usage: GPUBufferUsage.VERTEX, mappedAtCreation: true });
    new Float32Array(vb.getMappedRange()).set(p.verts);
    vb.unmap();
    const bg = dev.createBindGroup({ layout: bgl, entries: [
      { binding: 0, resource: { buffer: ub } },
      { binding: 1, resource: samp },
      { binding: 2, resource: p.tex.createView() },
    ] });
    const enc = dev.createCommandEncoder();
    const pass = enc.beginRenderPass({
      colorAttachments: [{ view: msaa.createView(), resolveTarget: off.createView(), loadOp: 'clear', storeOp: 'discard', clearValue: [0, 0, 0, 1] }],
      depthStencilAttachment: { view: depth.createView(), depthLoadOp: 'clear', depthClearValue: 1, depthStoreOp: 'discard' },
    });
    pass.setPipeline(pipe);
    pass.setBindGroup(0, bg);
    pass.setVertexBuffer(0, vb);
    pass.draw(p.verts.length / 8);
    pass.end();
    enc.copyTextureToBuffer({ texture: off }, { buffer: rb, bytesPerRow: bpr }, [S, S]);
    dev.queue.submit([enc.finish()]);
    await dev.queue.onSubmittedWorkDone();
    await rb.mapAsync(GPUMapMode.READ);
    const src = new Uint8Array(rb.getMappedRange());
    const img = new ImageData(S, S);
    img.data.set(src.subarray(0, S * S * 4));
    rb.unmap();
    sx.putImageData(img, (i % 3) * S, Math.floor(i / 3) * S);
    const st = stats(img.data);
    const row = { id: p.id, ...st };
    if (p.id === 'ground-raw') row.sourceMean = files.ground.mean.map(v => Math.round(v * 100) / 100);
    if (p.id === 'ground-uv') {
      let sad = 0, n = 0;
      const span = 6;
      const dx = Math.round(S * (TILE_M.ground / span));
      for (let y = 40; y < S - 40; y += 4) {
        for (let x = 8; x < S - dx - 8; x += 8) {
          const i0 = (y * S + x) * 4, i1 = (y * S + x + dx) * 4;
          sad += Math.abs(img.data[i0] - img.data[i1]) + Math.abs(img.data[i0 + 1] - img.data[i1 + 1]) + Math.abs(img.data[i0 + 2] - img.data[i1 + 2]);
          n++;
        }
      }
      row.periodSad = Math.round((sad / Math.max(1, n)) * 100) / 100;
      row.periodPx = dx;
      row.tileMetres = TILE_M.ground;
    }
    if (p.id === 'ramp-raw' || p.id === 'ramp-lit') {
      const left = img.data[(128 * S + 8) * 4];
      const right = img.data[(128 * S + S - 9) * 4];
      row.ends = [left, right];
      row.spread = Math.abs(right - left);
    }
    out.push(row);
  }
  const blob = await sheet.convertToBlob({ type: 'image/png' });
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  window.__swatchResult = { png: btoa(s), panels: out, scales: SC, shade: 'shadeAlb' };
  window.__swatchReady = true;
}

main().catch(e => { window.__swatchErr = String(e && e.stack || e); window.__swatchReady = false; });

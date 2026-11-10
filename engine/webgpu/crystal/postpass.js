// Optional TAA + SSGI on the crystal canyon. Off unless the page asks.
// The live meadow page does not import this.
import { makeTAA } from '../engine/taa.js';
import { makeSSGI } from '../engine/ssgi.js';
import { packPost } from '../engine/postu.js';

const TAA = makeTAA({ on: true, history: 0.95, samples: 8, motionPx: 24, objectMv: true, clamp: true, reject: true });
const SSGI = makeSSGI({
  on: true, scale: 0.5, rays: 2, steps: 32, frames: 8, strength: 1,
  thickness: 0.08, stepBase: 0.1, stepGrow: 1.18, maxStep: 0.7,
  sky: [0.02, 0.03, 0.05],
});

const TONE = /* wgsl */`
struct U { vp: mat4x4f, ivp: mat4x4f, prev: mat4x4f, eye: vec4f, p0: vec4f, p1: vec4f, p2: vec4f, p3: vec4f, p4: vec4f, sun: vec4f, fwd: vec4f, bolt: vec4f, boltPrev: vec4f, prevEye: vec4f, prevFwd: vec4f, extra: vec4f };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(7) var tCurr: texture_2d<f32>;
fn loadC(t: texture_2d<f32>, p: vec2i) -> vec4f {
  let d = vec2i(textureDimensions(t));
  return textureLoad(t, clamp(p, vec2i(0), d - vec2i(1)), 0);
}
struct PO { @builtin(position) p: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> PO {
  var q = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var o: PO;
  o.p = vec4f(q[i], 0.0, 1.0);
  o.uv = vec2f(q[i].x * 0.5 + 0.5, 0.5 - q[i].y * 0.5);
  return o;
}
@fragment fn fs_tone(v: PO) -> @location(0) vec4f {
  let dim = vec2f(textureDimensions(tCurr));
  let c = max(loadC(tCurr, vec2i(v.uv * dim)).rgb, vec3f(0.0));
  return vec4f(pow(clamp(c, vec3f(0.0), vec3f(1.0)), vec3f(1.0 / 2.2)), 1.0);
}
`;

async function compile(dev, code, label) {
  const m = dev.createShaderModule({ label, code });
  if (m.getCompilationInfo) {
    const info = await m.getCompilationInfo();
    const err = info.messages.filter(x => x.type === 'error');
    if (err.length) throw new Error(label + '\n' + err.map(e => (e.lineNum || '') + ': ' + e.message).join('\n'));
  }
  return m;
}

export async function createCrystalPost(dev, W, H, displayFormat = 'rgba8unorm') {
  const F16 = 'rgba16float';
  const usage = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;
  const tex = (w, h, format = F16) => dev.createTexture({ size: [w, h], format, usage });
  const direct = tex(W, H), albedo = tex(W, H), normal = tex(W, H), motion = tex(W, H);
  const comp = [tex(W, H), tex(W, H)];
  const hist = [tex(W, H), tex(W, H)];
  const gw = Math.max(1, W >> 1), gh = Math.max(1, H >> 1);
  const giRaw = tex(gw, gh), giHist = [tex(gw, gh), tex(gw, gh)], giFilt = tex(gw, gh);
  const dummy = tex(4, 4);
  const depth = dev.createTexture({ size: [W, H], format: 'depth32float', usage: GPUTextureUsage.RENDER_ATTACHMENT });
  const ub = dev.createBuffer({ size: 1024, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const floatTex = { sampleType: 'unfilterable-float' };
  const giMod = await compile(dev, SSGI.pass, 'crystal-ssgi');
  const taaMod = await compile(dev, TAA.resolve, 'crystal-taa');
  const toneMod = await compile(dev, TONE, 'crystal-tone');
  const giBGL = dev.createBindGroupLayout({ entries: [0, 2, 3, 4, 6, 9, 10, 11].map((binding) => binding === 0
    ? { binding, visibility: GPUShaderStage.FRAGMENT, buffer: {} }
    : { binding, visibility: GPUShaderStage.FRAGMENT, texture: floatTex }) });
  const taaBGL = dev.createBindGroupLayout({ entries: [0, 5, 7, 8].map((binding) => binding === 0
    ? { binding, visibility: GPUShaderStage.FRAGMENT, buffer: {} }
    : { binding, visibility: GPUShaderStage.FRAGMENT, texture: floatTex }) });
  const toneBGL = dev.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: {} },
    { binding: 7, visibility: GPUShaderStage.FRAGMENT, texture: floatTex },
  ] });
  const one = [{ format: F16 }];
  const pipe = (mod, fs, layout, targets) => dev.createRenderPipeline({
    layout, label: fs,
    vertex: { module: mod, entryPoint: 'vs' },
    fragment: { module: mod, entryPoint: fs, targets },
    primitive: { topology: 'triangle-list' },
  });
  const giLayout = dev.createPipelineLayout({ bindGroupLayouts: [giBGL] });
  const pTrace = pipe(giMod, 'fs_trace', giLayout, one);
  const pTemp = pipe(giMod, 'fs_temporal', giLayout, one);
  const pFilt = pipe(giMod, 'fs_filter', giLayout, one);
  const pComp = pipe(giMod, 'fs_comp', giLayout, one);
  const pTaa = pipe(taaMod, 'fs_taa', dev.createPipelineLayout({ bindGroupLayouts: [taaBGL] }), one);
  const pTone = pipe(toneMod, 'fs_tone', dev.createPipelineLayout({ bindGroupLayouts: [toneBGL] }), [{ format: displayFormat }]);
  let compRead = 1, histRead = 1, giRead = 1;
  const giBG = (map) => dev.createBindGroup({ layout: giBGL, entries: [
    { binding: 0, resource: { buffer: ub } },
    { binding: 2, resource: map.direct.createView() },
    { binding: 3, resource: map.albedo.createView() },
    { binding: 4, resource: map.normal.createView() },
    { binding: 6, resource: map.prev.createView() },
    { binding: 9, resource: map.giRaw.createView() },
    { binding: 10, resource: map.giHist.createView() },
    { binding: 11, resource: map.giFilt.createView() },
  ] });
  const fs = (enc, pipeline, bg, target) => {
    const pass = enc.beginRenderPass({ colorAttachments: [{ view: target.createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0] }] });
    pass.setPipeline(pipeline); pass.setBindGroup(0, bg); pass.draw(3); pass.end();
  };
  const clear = (enc, list) => {
    for (const t of list) {
      const p = enc.beginRenderPass({ colorAttachments: [{ view: t.createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0] }] });
      p.end();
    }
  };
  return {
    direct, albedo, normal, motion, depth,
    targets: [{ format: F16 }, { format: F16 }, { format: F16 }, { format: F16 }],
    reset(enc) { clear(enc, [...comp, ...hist, ...giHist, giRaw, giFilt]); compRead = 1; histRead = 1; giRead = 1; },
    draw(enc, display, pack, { taa, ssgi, reset }) {
      dev.queue.writeBuffer(ub, 0, pack);
      if (reset) clear(enc, [...comp, ...hist, ...giHist, giRaw, giFilt]);
      const prev = comp[compRead];
      const compWrite = 1 - compRead;
      const histWrite = 1 - histRead;
      const giWrite = 1 - giRead;
      if (ssgi) {
        fs(enc, pTrace, giBG({ direct, albedo, normal, prev, giRaw: dummy, giHist: giHist[giRead], giFilt }), giRaw);
        fs(enc, pTemp, giBG({ direct, albedo, normal, prev, giRaw, giHist: giHist[giRead], giFilt }), giHist[giWrite]);
        fs(enc, pFilt, giBG({ direct, albedo, normal, prev, giRaw, giHist: giHist[giWrite], giFilt: dummy }), giFilt);
        giRead = giWrite;
      }
      fs(enc, pComp, giBG({ direct, albedo, normal, prev, giRaw, giHist: giHist[giRead], giFilt }), comp[compWrite]);
      let linear = comp[compWrite];
      if (taa) {
        const bg = dev.createBindGroup({ layout: taaBGL, entries: [
          { binding: 0, resource: { buffer: ub } },
          { binding: 5, resource: motion.createView() },
          { binding: 7, resource: comp[compWrite].createView() },
          { binding: 8, resource: hist[histRead].createView() },
        ] });
        fs(enc, pTaa, bg, hist[histWrite]);
        linear = hist[histWrite];
        histRead = histWrite;
      }
      compRead = compWrite;
      const toneBG = dev.createBindGroup({ layout: toneBGL, entries: [
        { binding: 0, resource: { buffer: ub } },
        { binding: 7, resource: linear.createView() },
      ] });
      const pass = enc.beginRenderPass({ colorAttachments: [{ view: display.createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1] }] });
      pass.setPipeline(pTone); pass.setBindGroup(0, toneBG); pass.draw(3); pass.end();
    },
    pack: packPost,
    cfg: { taa: TAA.cfg, ssgi: SSGI.cfg },
  };
}

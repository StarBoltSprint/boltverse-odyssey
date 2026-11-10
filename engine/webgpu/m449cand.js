// Isolated crystal candidate. TAA and SSGI are exercised here.
// m448aaa2 (live meadow) is not imported and is not modified.
import { CRYSTAL_CANDIDATE, buildBoxes, probes } from './engine/biomes/crystal-candidate.js';
import { frame, project, mul, inv } from './engine/candcam.js';
import { sceneWgsl, toneWgsl } from './engine/candscene.js';
import { makeTAA, applyJitter, jitterNdc } from './engine/taa.js';
import { makeSSGI } from './engine/ssgi.js';
import { packPost } from './engine/postu.js';
import { makeGpuTimer } from './engine/bricks/perf-gputime.js';

const qs = new URLSearchParams(location.search);
const CAP = qs.get('cap') === '1';
const CFG = CRYSTAL_CANDIDATE;
const W = parseInt(qs.get('w') || '720', 10);
const H = parseInt(qs.get('h') || '1280', 10);
const hud = document.getElementById('hud');
if (CAP) hud.style.display = 'none';

const TAA = makeTAA(CFG.taa);
const SSGI = makeSSGI(CFG.ssgi);
const SKY = CFG.ssgi.sky;

function b64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const align256 = (n) => Math.ceil(n / 256) * 256;

async function main() {
  const ad = await navigator.gpu?.requestAdapter();
  if (!ad) { window.__err = 'no webgpu'; hud.textContent = window.__err; return; }
  const feats = [];
  if (ad.features.has('timestamp-query')) feats.push('timestamp-query');
  const dev = await ad.requestDevice({ requiredFeatures: feats });
  const info = ad.info || {};
  window.__gpu = {
    vendor: info.vendor || '', architecture: info.architecture || '', device: info.device || '',
    description: info.description || '', features: [...dev.features],
  };
  dev.addEventListener?.('uncapturederror', (e) => { window.__err = String(e.error || e); console.error(e); });

  const canvas = document.getElementById('c');
  canvas.width = W; canvas.height = H;
  const canvasFmt = CAP ? null : navigator.gpu.getPreferredCanvasFormat();
  const ctx = CAP ? null : canvas.getContext('webgpu');
  if (ctx) ctx.configure({ device: dev, format: canvasFmt, alphaMode: 'opaque' });

  const F16 = 'rgba16float';
  try { const t = dev.createTexture({ size: [1, 1], format: F16, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING }); t.destroy(); }
  catch (e) { window.__err = 'rgba16float unsupported: ' + e; hud.textContent = window.__err; return; }

  async function compile(code, label) {
    const m = dev.createShaderModule({ label, code });
    const inf = await m.getCompilationInfo();
    const err = inf.messages.filter((x) => x.type === 'error');
    if (err.length) throw new Error(label + '\n' + err.map((e) => (e.lineNum || '') + ': ' + e.message).join('\n'));
    return m;
  }
  const sceneMod = await compile(sceneWgsl(CFG), 'scene');
  const giMod = await compile(SSGI.pass, 'ssgi');
  const taaMod = await compile(TAA.resolve, 'taa');
  const toneMod = await compile(toneWgsl(), 'tone');

  const colorUsage = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC;
  const tex = (w, h, format) => dev.createTexture({ size: [w, h], format, usage: colorUsage });
  const direct = tex(W, H, F16), albedo = tex(W, H, F16), normal = tex(W, H, F16), motion = tex(W, H, F16);
  const comp = [tex(W, H, F16), tex(W, H, F16)];
  const hist = [tex(W, H, F16), tex(W, H, F16)];
  const gw = Math.max(1, W >> 1), gh = Math.max(1, H >> 1);
  const giRaw = tex(gw, gh, F16);
  const giHist = [tex(gw, gh, F16), tex(gw, gh, F16)];
  const giFilt = tex(gw, gh, F16);
  const dummy = tex(4, 4, F16);
  const display = tex(W, H, 'rgba8unorm');
  const depth = dev.createTexture({ size: [W, H], format: 'depth32float', usage: GPUTextureUsage.RENDER_ATTACHMENT });

  const boxes = buildBoxes(CFG);
  const boxBuf = dev.createBuffer({ size: boxes.data.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  dev.queue.writeBuffer(boxBuf, 0, boxes.data);
  let atlasView = dummy.createView();
  let atlasOk = false;
  try {
    const bmp = await createImageBitmap(await (await fetch('./assets/meadow/bolt439_atlas.png')).blob(), { colorSpaceConversion: 'none' });
    const at = dev.createTexture({ size: [bmp.width, bmp.height], format: 'rgba8unorm-srgb', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
    dev.queue.copyExternalImageToTexture({ source: bmp }, { texture: at }, [bmp.width, bmp.height]);
    atlasView = at.createView();
    atlasOk = true;
  } catch (e) { console.warn('atlas', e); }
  const samp = dev.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });

  const ub = dev.createBuffer({ size: 256 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const sceneBGL = dev.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: {} },
  ] });
  const sceneBGL1 = dev.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
    { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
    { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
  ] });
  const sceneBG0 = dev.createBindGroup({ layout: sceneBGL, entries: [{ binding: 0, resource: { buffer: ub } }] });
  const sceneBG1 = dev.createBindGroup({ layout: sceneBGL1, entries: [
    { binding: 0, resource: { buffer: boxBuf } }, { binding: 1, resource: atlasView }, { binding: 2, resource: samp },
  ] });
  const floatTex = { sampleType: 'unfilterable-float' };
  const giBGL = dev.createBindGroupLayout({ entries: [0, 2, 3, 4, 6, 9, 10, 11].map((binding) => binding === 0
    ? { binding, visibility: GPUShaderStage.FRAGMENT, buffer: {} }
    : { binding, visibility: GPUShaderStage.FRAGMENT, texture: floatTex }) });
  const taaBGL = dev.createBindGroupLayout({ entries: [0, 5, 7, 8].map((binding) => binding === 0
    ? { binding, visibility: GPUShaderStage.FRAGMENT, buffer: {} }
    : { binding, visibility: GPUShaderStage.FRAGMENT, texture: floatTex }) });
  const toneBGL = dev.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: {} },
    { binding: 7, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'unfilterable-float' } },
  ] });
  const presentBGL = dev.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: {} },
    { binding: 7, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
  ] });

  const targets16 = [{ format: F16 }, { format: F16 }, { format: F16 }, { format: F16 }];
  const pipe = (mod, vs, fs, layout, fmts, depthOn) => {
    const desc = {
      layout, label: fs,
      vertex: { module: mod, entryPoint: vs },
      fragment: { module: mod, entryPoint: fs, targets: fmts },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
    };
    if (depthOn) desc.depthStencil = { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' };
    return dev.createRenderPipeline(desc);
  };
  const sceneLayout = dev.createPipelineLayout({ bindGroupLayouts: [sceneBGL, sceneBGL1] });
  const pBox = pipe(sceneMod, 'vs_box', 'fs_box', sceneLayout, targets16, true);
  const pBolt = pipe(sceneMod, 'vs_bolt', 'fs_bolt', sceneLayout, targets16, true);
  const giLayout = dev.createPipelineLayout({ bindGroupLayouts: [giBGL] });
  const one16 = [{ format: F16 }];
  const pTrace = pipe(giMod, 'vs', 'fs_trace', giLayout, one16, false);
  const pTemp = pipe(giMod, 'vs', 'fs_temporal', giLayout, one16, false);
  const pFilt = pipe(giMod, 'vs', 'fs_filter', giLayout, one16, false);
  const pComp = pipe(giMod, 'vs', 'fs_comp', giLayout, one16, false);
  const taaLayout = dev.createPipelineLayout({ bindGroupLayouts: [taaBGL] });
  const pTaa = pipe(taaMod, 'vs', 'fs_taa', taaLayout, one16, false);
  const toneLayout = dev.createPipelineLayout({ bindGroupLayouts: [toneBGL] });
  const pTone = pipe(toneMod, 'vs', 'fs_tone', toneLayout, [{ format: 'rgba8unorm' }], false);
  const presentLayout = dev.createPipelineLayout({ bindGroupLayouts: [presentBGL] });
  const pPresent = ctx ? pipe(toneMod, 'vs', 'fs_present', presentLayout, [{ format: canvasFmt }], false) : null;

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
  const taaBG = (curr, histTex) => dev.createBindGroup({ layout: taaBGL, entries: [
    { binding: 0, resource: { buffer: ub } },
    { binding: 5, resource: motion.createView() },
    { binding: 7, resource: curr.createView() },
    { binding: 8, resource: histTex.createView() },
  ] });
  const toneBG = (src, layout) => dev.createBindGroup({ layout, entries: [
    { binding: 0, resource: { buffer: ub } },
    { binding: 7, resource: src.createView() },
  ] });

  const timer = makeGpuTimer(dev, 8);
  let compRead = 1, histRead = 1, giRead = 1;
  let prevVP = null, prevEye = [0, 0, 0], prevFwd = [0, 0, 1];
  const PR = probes();

  function fsPass(enc, pipeline, bg, target, stamp) {
    const desc = { colorAttachments: [{ view: target.createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0] }] };
    if (stamp) desc.timestampWrites = stamp;
    const pass = enc.beginRenderPass(desc);
    pass.setPipeline(pipeline); pass.setBindGroup(0, bg); pass.draw(3); pass.end();
  }

  async function readLuma(src, x, y, rw, rh) {
    const w = Math.max(1, Math.min(rw, W)), h = Math.max(1, Math.min(rh, H));
    const x0 = Math.max(0, Math.min(W - w, x | 0)), y0 = Math.max(0, Math.min(H - h, y | 0));
    const bpr = align256(w * 8);
    const buf = dev.createBuffer({ size: bpr * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const enc = dev.createCommandEncoder();
    enc.copyTextureToBuffer({ texture: src, origin: [x0, y0, 0] }, { buffer: buf, bytesPerRow: bpr }, [w, h]);
    dev.queue.submit([enc.finish()]);
    await buf.mapAsync(GPUMapMode.READ);
    const view = new DataView(buf.getMappedRange());
    const data = new Float32Array(w * h);
    for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) {
      const o = row * bpr + col * 8;
      const r = view.getFloat16(o, true), g = view.getFloat16(o + 2, true), b = view.getFloat16(o + 4, true);
      data[row * w + col] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    buf.unmap(); buf.destroy();
    return { w, h, x: x0, y: y0, b64: b64(new Uint8Array(data.buffer)) };
  }

  async function readJpeg(q) {
    const bpr = align256(W * 4);
    const buf = dev.createBuffer({ size: bpr * H, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const enc = dev.createCommandEncoder();
    enc.copyTextureToBuffer({ texture: display }, { buffer: buf, bytesPerRow: bpr }, [W, H]);
    dev.queue.submit([enc.finish()]);
    await buf.mapAsync(GPUMapMode.READ);
    const src = new Uint8Array(buf.getMappedRange());
    const img = new ImageData(W, H);
    for (let y = 0; y < H; y++) img.data.set(src.subarray(y * bpr, y * bpr + W * 4), y * W * 4);
    buf.unmap(); buf.destroy();
    const oc = new OffscreenCanvas(W, H);
    oc.getContext('2d').putImageData(img, 0, 0);
    const blob = await oc.convertToBlob({ type: 'image/jpeg', quality: q });
    return b64(new Uint8Array(await blob.arrayBuffer()));
  }

  function render(spec) {
    const shot = spec.shot || 'play';
    const i = spec.i | 0;
    const cam = frame(shot, i, W, H);
    const taaOn = spec.taa ? 1 : 0;
    const giOn = spec.ssgi ? 1 : 0;
    const reset = !!spec.reset || i === 0;
    const jitterOn = !!(taaOn || spec.jitter);
    const [jx, jy] = jitterOn ? jitterNdc(i, W, H) : [0, 0];
    const proj = applyJitter(cam.proj, jx, jy);
    const useVP = jitterOn ? mul(proj, cam.view) : cam.vp;
    const ivp = inv(useVP);
    if (reset || !prevVP) { prevVP = useVP.slice(); prevEye = cam.eye.slice(); prevFwd = cam.fwd.slice(); }
    const U = packPost({
      vp: useVP, ivp, prev: prevVP,
      eye: cam.eye, frame: i,
      history: (taaOn && !reset) ? CFG.taa.history : 0,
      motionPx: CFG.taa.motionPx,
      clamp: spec.clamp === 0 ? 0 : 1,
      reject: spec.reject === 0 ? 0 : 1,
      width: W, height: H,
      objectMv: spec.omv === 0 ? 0 : 1,
      gi: giOn,
      strength: CFG.ssgi.strength,
      stepBase: CFG.ssgi.stepBase, stepGrow: CFG.ssgi.stepGrow, giFrames: CFG.ssgi.frames,
      thickness: CFG.ssgi.thickness, sky: SKY,
      jx, jy, near: cam.near, far: cam.far,
      sun: unit(CFG.sun), maxStep: CFG.ssgi.maxStep,
      fwd: cam.fwd,
      bolt: cam.bolt, atlasFrame: cam.atlasFrame,
      boltPrev: cam.boltPrev,
      prevEye, prevFwd,
      atlas: (spec.atlas === 0 || !atlasOk) ? 0 : (shot === 'play' ? 1 : 0),
      exposure: CFG.exposure, coat: CFG.coat,
    });
    dev.queue.writeBuffer(ub, 0, U);
    const compWrite = 1 - compRead, histWrite = 1 - histRead, giWrite = 1 - giRead;
    const t0 = performance.now();
    timer.begin();
    const enc = dev.createCommandEncoder();
    if (reset) {
      for (const t of [...hist, ...giHist, ...comp, giRaw, giFilt]) {
        const clr = enc.beginRenderPass({ colorAttachments: [{ view: t.createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0] }] });
        clr.end();
      }
    }
    const sceneDesc = {
      colorAttachments: [
        { view: direct.createView(), loadOp: 'clear', storeOp: 'store', clearValue: [SKY[0], SKY[1], SKY[2], 0] },
        { view: albedo.createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0] },
        { view: normal.createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 1, 0, 0] },
        { view: motion.createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0] },
      ],
      depthStencilAttachment: { view: depth.createView(), depthLoadOp: 'clear', depthClearValue: 1, depthStoreOp: 'store' },
    };
    const sceneStamp = timer.pass('scene');
    if (sceneStamp) sceneDesc.timestampWrites = sceneStamp;
    const scenePass = enc.beginRenderPass(sceneDesc);
    scenePass.setPipeline(pBox); scenePass.setBindGroup(0, sceneBG0); scenePass.setBindGroup(1, sceneBG1); scenePass.draw(36, boxes.count);
    if (cam.showBolt && spec.bolt !== 0) { scenePass.setPipeline(pBolt); scenePass.draw(6); }
    scenePass.end();
    const prevTex = comp[compRead];
    if (giOn) {
      fsPass(enc, pTrace, giBG({ direct, albedo, normal, prev: prevTex, giRaw: dummy, giHist: giHist[giRead], giFilt }), giRaw, timer.pass('ssgi-trace'));
      fsPass(enc, pTemp, giBG({ direct, albedo, normal, prev: prevTex, giRaw, giHist: giHist[giRead], giFilt }), giHist[giWrite], timer.pass('ssgi-temporal'));
      fsPass(enc, pFilt, giBG({ direct, albedo, normal, prev: prevTex, giRaw, giHist: giHist[giWrite], giFilt: dummy }), giFilt, timer.pass('ssgi-filter'));
    }
    fsPass(enc, pComp, giBG({ direct, albedo, normal, prev: prevTex, giRaw, giHist: giHist[giRead], giFilt }), comp[compWrite], timer.pass('composite'));
    let linear = comp[compWrite];
    if (taaOn) {
      fsPass(enc, pTaa, taaBG(comp[compWrite], hist[histRead]), hist[histWrite], timer.pass('taa'));
      linear = hist[histWrite];
    }
    fsPass(enc, pTone, toneBG(linear, toneBGL), display, timer.pass('tonemap'));
    if (pPresent && spec.present !== 0) {
      const canvasTex = ctx.getCurrentTexture();
      fsPass(enc, pPresent, toneBG(display, presentBGL), canvasTex, undefined);
    }
    timer.resolve(enc);
    dev.queue.submit([enc.finish()]);
    prevVP = useVP.slice(); prevEye = cam.eye.slice(); prevFwd = cam.fwd.slice();
    compRead = compWrite;
    if (taaOn) histRead = histWrite;
    if (giOn) giRead = giWrite;
    const corners = [[-0.25, -0.425], [0.25, -0.425], [0.25, 0.425], [-0.25, 0.425]]
      .map(([x, y]) => project(useVP, [cam.bolt[0] + x, cam.bolt[1] + y, cam.bolt[2]], W, H));
    const pix = {
      wall: project(useVP, PR.wall, W, H),
      pocket: project(useVP, PR.pocket, W, H),
      floor: project(useVP, PR.floor, W, H),
      bolt: project(useVP, cam.bolt, W, H),
      look: project(useVP, cam.target, W, H),
      card: {
        x0: Math.min(...corners.map((p) => p.x)), y0: Math.min(...corners.map((p) => p.y)),
        x1: Math.max(...corners.map((p) => p.x)), y1: Math.max(...corners.map((p) => p.y)),
      },
    };
    return { ms: performance.now() - t0, linear, pix, cam };
  }

  const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  let chain = Promise.resolve();
  window.__render = (spec) => {
    const run = chain.then(() => renderAndRead(spec));
    chain = run.then(() => {}, () => {});
    return run;
  };
  async function renderAndRead(specIn) {
    const spec = specIn || {};
    const r = render(spec);
    await dev.queue.onSubmittedWorkDone();
    if (window.__err && /error/i.test(window.__err) && !window.__err.startsWith('no ')) throw new Error(window.__err);
    const out = { ms: r.ms, pix: r.pix, showBolt: r.cam.showBolt };
    const read = spec.read || 'none';
    if (read === 'centre') {
      out.crop = await readLuma(r.linear, (W - 96) / 2, (H - 96) / 2, 96, 96);
    } else if (read === 'indoor') {
      const cropAt = async (p, n) => readLuma(r.linear, p.x - n / 2, p.y - n / 2, n, n);
      out.wall = await cropAt(r.pix.wall, 32);
      out.pocket = await cropAt(r.pix.pocket, 32);
      out.floor = await cropAt(r.pix.floor, 32);
    } else if (read === 'strip') {
      const y = Math.round(r.pix.bolt.y - 48);
      out.crop = await readLuma(r.linear, 0, y, W, 96);
    }
    if (spec.jpeg) out.jpeg = await readJpeg(spec.jpeg);
    return out;
  }

  window.__perf = async (n = 20, mode = {}) => {
    for (let i = 0; i < 3; i++) render({ shot: 'play', i, taa: mode.taa ? 1 : 0, ssgi: mode.ssgi ? 1 : 0, reset: i === 0, present: 0, bolt: 1 });
    await dev.queue.onSubmittedWorkDone();
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      render({ shot: 'play', i: 3 + i, taa: mode.taa ? 1 : 0, ssgi: mode.ssgi ? 1 : 0, reset: 0, present: 0, bolt: 1 });
      await dev.queue.onSubmittedWorkDone();
    }
    const wall = (performance.now() - t0) / n;
    let gpu = null;
    if (timer.ok) {
      render({ shot: 'play', i: 8, taa: mode.taa ? 1 : 0, ssgi: mode.ssgi ? 1 : 0, present: 0 });
      await dev.queue.onSubmittedWorkDone();
      gpu = await timer.read();
    }
    return { wall, gpu, timestamp: timer.ok };
  };

  window.__project = (shot, i) => {
    const cam = frame(shot, i | 0, W, H);
    const P = (p) => project(cam.vp, p, W, H);
    return { wall: P(PR.wall), pocket: P(PR.pocket), floor: P(PR.floor), bolt: P(cam.bolt), look: P(cam.target), showBolt: cam.showBolt };
  };
  window.__boxes = boxes.count;
  window.__ready = true;
  hud.textContent = `crystal candidate · ${boxes.count} boxes · f16`;

  if (!CAP) {
    const shot = qs.get('shot') || 'play';
    const fx = qs.get('fx') || 'both';
    let i = 0, last = performance.now();
    const loop = async (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      i += dt * 12;
      const fi = Math.floor(i);
      try {
        render({
          shot, i: fi,
          taa: fx === 'taa' || fx === 'both' ? 1 : 0,
          ssgi: fx === 'ssgi' || fx === 'both' ? 1 : 0,
          reset: fi === 0 && i < 0.2,
          present: 1,
        });
        hud.textContent = `${shot} · ${fx} · f ${fi}`;
      } catch (e) { hud.textContent = String(e); window.__err = String(e); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

main().catch((e) => { window.__err = String(e); console.error(e); const h = document.getElementById('hud'); if (h) h.textContent = String(e); });

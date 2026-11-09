// Profiling page = the pace page plus pass timestamps. Motion, draws and shaders stay.
export function profFromPace(src) {
  const banner = '// m448aaa3-prof — same picture and pace as m448aaa3-pace. Adds pass timestamps. Not a stutter fix.\n';
  let out = banner + src;
  const swaps = [
    [
      "import { paceFrame } from './engine/bricks/sim-pace.js?v=pace1';",
      "import { paceFrame } from './engine/bricks/sim-pace.js?v=pace1';\nimport { makePassTimer } from './engine/bricks/pass-timer.js?v=prof1';",
    ],
    [
      "  const dev = await ad.requestDevice({ requiredLimits: { maxStorageBufferBindingSize: Math.min(ad.limits.maxStorageBufferBindingSize, 256 << 20) } });\n  if (DIAG) {\n    let info = ad.info || {};\n    if (typeof ad.requestAdapterInfo === 'function') { try { info = await ad.requestAdapterInfo(); } catch (e) { info = ad.info || info; } }\n    window.__meadowAdapter = { vendor: info.vendor || '', architecture: info.architecture || '', device: info.device || '', description: info.description || '', isFallback: !!ad.isFallbackAdapter };\n  }",
      "  const devReq = { requiredLimits: { maxStorageBufferBindingSize: Math.min(ad.limits.maxStorageBufferBindingSize, 256 << 20) } };\n  const wantTs = !!(ad.features && ad.features.has('timestamp-query'));\n  let dev;\n  try { dev = await ad.requestDevice(wantTs ? { ...devReq, requiredFeatures: ['timestamp-query'] } : devReq); }\n  catch (e) { dev = await ad.requestDevice(devReq); }\n  {\n    let info = ad.info || {};\n    if (typeof ad.requestAdapterInfo === 'function') { try { info = await ad.requestAdapterInfo(); } catch (e) { info = ad.info || info; } }\n    window.__meadowAdapter = { vendor: info.vendor || '', architecture: info.architecture || '', device: info.device || '', description: info.description || '', isFallback: !!ad.isFallbackAdapter, timestampQuery: !!(dev.features && dev.features.has('timestamp-query')) };\n  }\n  const passTimer = makePassTimer(dev);",
    ],
    [
      "  const pPass = (enc, views, pipe, bgp) => { const p = enc.beginRenderPass({ colorAttachments: views.map(v => ({ view: v.createView ? v.createView() : v, loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1] })) }); p.setPipeline(pipe); p.setBindGroup(0, bgp); p.draw(3); p.end(); };",
      "  const pPass = (enc, views, pipe, bgp, passName) => { const stamp = passTimer.stamp(passName); const p = enc.beginRenderPass({ colorAttachments: views.map(v => ({ view: v.createView ? v.createView() : v, loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1] })), ...(stamp ? { timestampWrites: stamp } : {}) }); p.setPipeline(pipe); p.setBindGroup(0, bgp); p.draw(3); p.end(); };",
    ],
    [
      "  function render(t) {\n    const { U, st, roll } = frameState(t); dev.queue.writeBuffer(ub, 0, U); updatePrints(t);",
      "  function render(t) {\n    const prep0 = performance.now();\n    passTimer.begin();\n    const { U, st, roll } = frameState(t); dev.queue.writeBuffer(ub, 0, U); updatePrints(t);",
    ],
    [
      "    const target = CAP ? off : ctx.getCurrentTexture();\n    const enc = dev.createCommandEncoder();",
      "    const target = CAP ? off : ctx.getCurrentTexture();\n    const cpuPrepMs = performance.now() - prep0;\n    const enc0 = performance.now();\n    const enc = dev.createCommandEncoder();",
    ],
    [
      "      const sp = enc.beginRenderPass({ colorAttachments: [], depthStencilAttachment: { view: smTex.createView(), depthLoadOp: 'clear', depthClearValue: 1, depthStoreOp: 'store' } });",
      "      const shadowWrites = passTimer.stamp('shadow'); const sp = enc.beginRenderPass({ colorAttachments: [], depthStencilAttachment: { view: smTex.createView(), depthLoadOp: 'clear', depthClearValue: 1, depthStoreOp: 'store' }, ...(shadowWrites ? { timestampWrites: shadowWrites } : {}) });",
    ],
    [
      "    const pass = enc.beginRenderPass({ colorAttachments: [{ view: msaa.createView(), resolveTarget: (PQ ? sceneT : target).createView(), loadOp: 'clear', storeOp: 'discard', clearValue: [0.5, 0.68, 0.88, 1] }],\n      depthStencilAttachment: { view: depth.createView(), depthLoadOp: 'clear', depthClearValue: 1, depthStoreOp: PQ ? 'store' : 'discard' } });",
      "    const mainWrites = passTimer.stamp('main'); const pass = enc.beginRenderPass({ colorAttachments: [{ view: msaa.createView(), resolveTarget: (PQ ? sceneT : target).createView(), loadOp: 'clear', storeOp: 'discard', clearValue: [0.5, 0.68, 0.88, 1] }],\n      depthStencilAttachment: { view: depth.createView(), depthLoadOp: 'clear', depthClearValue: 1, depthStoreOp: PQ ? 'store' : 'discard' }, ...(mainWrites ? { timestampWrites: mainWrites } : {}) });",
    ],
    [
      "    if (PQ) { pPass(enc, [qT[0], qT[1]], pDown, bgDown); pPass(enc, [qT[2], qT[3]], pBH, bgBH); pPass(enc, [qT[0], qT[1]], pBV, bgBV); pPass(enc, [target], pFin, bgFin); }\n    if (CAP) enc.copyTextureToBuffer({ texture: off }, { buffer: rb, bytesPerRow: bpr }, [W, Hh]);\n    dev.queue.submit([enc.finish()]);\n    return { psi: st.psi, cam: st.cam, x: st.x, z: st.z, w: st.w, roll };",
      "    if (PQ) { pPass(enc, [qT[0], qT[1]], pDown, bgDown, 'post-down'); pPass(enc, [qT[2], qT[3]], pBH, bgBH, 'post-blur-h'); pPass(enc, [qT[0], qT[1]], pBV, bgBV, 'post-blur-v'); pPass(enc, [target], pFin, bgFin, 'post-final'); }\n    if (CAP) enc.copyTextureToBuffer({ texture: off }, { buffer: rb, bytesPerRow: bpr }, [W, Hh]);\n    passTimer.resolve(enc);\n    dev.queue.submit([enc.finish()]);\n    const cpuEncodeMs = performance.now() - enc0;\n    return { psi: st.psi, cam: st.cam, x: st.x, z: st.z, w: st.w, roll, cpuPrepMs, cpuEncodeMs };",
    ],
    [
      "      const text = JSON.stringify(window.__meadowDiag());",
      "      const text = JSON.stringify(window.__meadowProf());",
    ],
    [
      "  if (diag) window.__meadowDiag = () => ({ ...diag.report(), adapter: window.__meadowAdapter || null, canvas: [canvas.width, canvas.height], dpr: devicePixelRatio, gpuTime: null, err: window.__meadowErr || null });",
      "  window.__meadowProf = () => passTimer.export({ adapter: window.__meadowAdapter || null, canvas: [canvas.width, canvas.height], dpr: devicePixelRatio, err: window.__meadowErr || null });\n  if (diag) window.__meadowDiag = () => window.__meadowProf();",
    ],
    [
      "    const applied = DEMO ? 0 : paceFrame(wall, stepLive);\n    const i = render(t); hud.textContent = `v448aaa3-pace${DEMO ? ' · demo' : ''} · ${Math.round(((i.psi * 180 / Math.PI) % 360 + 360) % 360)}°`;\n    if (diag) {\n      diag.push(wall, applied, live.v);\n      if (diagShown === 0 || now - diagShown >= 500) {\n        diagShown = now;\n        if (diagBox) diagBox.hidden = false;\n        if (diagTextEl) diagTextEl.textContent = diagText(diag.report(), window.__meadowAdapter || null);\n      }\n    }",
      "    const applied = DEMO ? 0 : paceFrame(wall, stepLive);\n    const i = render(t);\n    passTimer.record({ wallMs: wall * 1000, cpuPrepMs: i.cpuPrepMs, cpuEncodeMs: i.cpuEncodeMs });\n    passTimer.kick();\n    hud.textContent = `v448aaa3-prof${DEMO ? ' · demo' : ''} · ${Math.round(((i.psi * 180 / Math.PI) % 360 + 360) % 360)}°`;\n    if (diag) {\n      diag.push(wall, applied, live.v);\n      if (diagShown === 0 || now - diagShown >= 500) {\n        diagShown = now;\n        if (diagBox) diagBox.hidden = false;\n        if (diagTextEl) diagTextEl.textContent = passTimer.overlay();\n      }\n    }",
    ],
  ];
  for (const [oldText, newText] of swaps) {
    if (!out.includes(oldText)) throw new Error('pace pattern missing: ' + oldText.slice(0, 80));
    out = out.replace(oldText, newText);
  }
  if (out.includes('gpuTime: null')) throw new Error('old gpuTime null remains');
  if (!out.includes("passTimer.stamp('shadow')")) throw new Error('shadow stamp missing');
  if (!out.includes("passTimer.stamp('main')")) throw new Error('main stamp missing');
  if (!out.includes('paceFrame(wall, stepLive)')) throw new Error('pace removed');
  return out;
}

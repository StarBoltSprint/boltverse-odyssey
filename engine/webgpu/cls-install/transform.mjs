// Draw-class page = the normal meadow scratch plus pass timestamps and a paired omit schedule.
// Motion, resolution, MSAA, densities, Bolt, collision and idle stay. all-frames keep every draw.
import { DRAW_CLASS_BUILD } from '../engine/bricks/draw-class.js';

export function clsFromScratch(src) {
  const banner = `// ${DRAW_CLASS_BUILD} — same draws as the normal meadow on all-frames. Omits one class on the paired frames so a phone export can name the expensive draw. Not a shipped cut.\n`;
  let out = banner + src;
  const swaps = [
    [
      "import { boltIdle, measureAtlasFeet, pickPlantedFrame } from './bricks/bolt-idle.js?v=9';",
      "import { boltIdle, measureAtlasFeet, pickPlantedFrame } from './bricks/bolt-idle.js?v=9';\nimport { makePassTimer } from './engine/bricks/pass-timer-cls.js?v=cls1';\nimport { DRAW_CLASS_BUILD, classAt, drawMask, pairDeltas, READING, SUBMITTED } from './engine/bricks/draw-class.js?v=cls1';",
    ],
    [
      "  const dev = await ad.requestDevice({ requiredLimits: { maxStorageBufferBindingSize: Math.min(ad.limits.maxStorageBufferBindingSize, 256 << 20) } });",
      "  const devReq = { requiredLimits: { maxStorageBufferBindingSize: Math.min(ad.limits.maxStorageBufferBindingSize, 256 << 20) } };\n  const wantTs = !!(ad.features && ad.features.has('timestamp-query'));\n  let dev;\n  try { dev = await ad.requestDevice(wantTs ? { ...devReq, requiredFeatures: ['timestamp-query'] } : devReq); }\n  catch (e) { dev = await ad.requestDevice(devReq); }\n  {\n    let info = ad.info || {};\n    if (typeof ad.requestAdapterInfo === 'function') { try { info = await ad.requestAdapterInfo(); } catch (e) { info = ad.info || info; } }\n    window.__meadowAdapter = { vendor: info.vendor || '', architecture: info.architecture || '', device: info.device || '', description: info.description || '', isFallback: !!ad.isFallbackAdapter, timestampQuery: !!(dev.features && dev.features.has('timestamp-query')) };\n  }\n  const passTimer = makePassTimer(dev);",
    ],
    [
      "  const pPass = (enc, views, pipe, bgp) => { const p = enc.beginRenderPass({ colorAttachments: views.map(v => ({ view: v.createView ? v.createView() : v, loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1] })) }); p.setPipeline(pipe); p.setBindGroup(0, bgp); p.draw(3); p.end(); };",
      "  const pPass = (enc, views, pipe, bgp, passName) => { const stamp = passTimer.stamp(passName); const p = enc.beginRenderPass({ colorAttachments: views.map(v => ({ view: v.createView ? v.createView() : v, loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1] })), ...(stamp ? { timestampWrites: stamp } : {}) }); p.setPipeline(pipe); p.setBindGroup(0, bgp); p.draw(3); p.end(); };",
    ],
    [
      "  function render(t) {\n    const { U, st, roll } = frameState(t); dev.queue.writeBuffer(ub, 0, U); updatePrints(t);",
      "  let clsFrame = 0, clsLocked = false;\n  function render(t) {\n    const prep0 = performance.now();\n    passTimer.begin();\n    const drawCls = clsLocked ? 'all' : classAt(clsFrame);\n    const mask = drawMask(drawCls);\n    const { U, st, roll } = frameState(t); dev.queue.writeBuffer(ub, 0, U); updatePrints(t);",
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
      "        sp.setPipeline(pRockS); sp.draw(360, 144); sp.setPipeline(pMillS); sp.draw(MILL.verts);\n        if (nS) { sp.setPipeline(pTreeS); sp.draw(25 * 30 + 58 * 12, nS); }\n        if (ci === 1 && nFS) { sp.setPipeline(pTreeLoS); sp.draw(210 + 22 * 6, nFS, 0, nS); } }",
      "        sp.setPipeline(pRockS); sp.draw(360, 144); sp.setPipeline(pMillS); sp.draw(MILL.verts);\n        if (mask.shadowTrees && nS) { sp.setPipeline(pTreeS); sp.draw(25 * 30 + 58 * 12, nS); }\n        if (mask.shadowTrees && ci === 1 && nFS) { sp.setPipeline(pTreeLoS); sp.draw(210 + 22 * 6, nFS, 0, nS); } }",
    ],
    [
      "    const pass = enc.beginRenderPass({ colorAttachments: [{ view: msaa.createView(), resolveTarget: (PQ ? sceneT : target).createView(), loadOp: 'clear', storeOp: 'discard', clearValue: [0.5, 0.68, 0.88, 1] }],\n      depthStencilAttachment: { view: depth.createView(), depthLoadOp: 'clear', depthClearValue: 1, depthStoreOp: PQ ? 'store' : 'discard' } });",
      "    const mainWrites = passTimer.stamp('main'); const pass = enc.beginRenderPass({ colorAttachments: [{ view: msaa.createView(), resolveTarget: (PQ ? sceneT : target).createView(), loadOp: 'clear', storeOp: 'discard', clearValue: [0.5, 0.68, 0.88, 1] }],\n      depthStencilAttachment: { view: depth.createView(), depthLoadOp: 'clear', depthClearValue: 1, depthStoreOp: PQ ? 'store' : 'discard' }, ...(mainWrites ? { timestampWrites: mainWrites } : {}) });",
    ],
    [
      "    pass.setPipeline(pGround); pass.draw(6 * 128 * 128);\n    pass.setPipeline(pTree3); if (nN && !NOTR && !NON) pass.draw(25 * 30 + 58 * 12, nN); pass.setPipeline(pTreeMid); if (nF - nM && !NOTR && !NOF) pass.draw(210 + 22 * 6, nF - nM, 0, nN + nM);   // 3D trees (old card pass pTrees kept unused)",
      "    if (mask.ground) { pass.setPipeline(pGround); pass.draw(6 * 128 * 128); }\n    if (mask.trees) { pass.setPipeline(pTree3); if (nN && !NOTR && !NON) pass.draw(25 * 30 + 58 * 12, nN); pass.setPipeline(pTreeMid); if (nF - nM && !NOTR && !NOF) pass.draw(210 + 22 * 6, nF - nM, 0, nN + nM); }   // 3D trees (old card pass pTrees kept unused)",
    ],
    [
      "    if (qs.get('dbg') !== '1') { pass.setPipeline(pGrass); pass.draw(15, G * G); pass.draw(15, 150 * 150, 0, G * G); pass.draw(3, 130 * 130, 0, G * G + 150 * 150); }",
      "    if (qs.get('dbg') !== '1' && mask.grass) { pass.setPipeline(pGrass); pass.draw(15, G * G); pass.draw(15, 150 * 150, 0, G * G); pass.draw(3, 130 * 130, 0, G * G + 150 * 150); }",
    ],
    [
      "    if (PQ) { pPass(enc, [qT[0], qT[1]], pDown, bgDown); pPass(enc, [qT[2], qT[3]], pBH, bgBH); pPass(enc, [qT[0], qT[1]], pBV, bgBV); pPass(enc, [target], pFin, bgFin); }\n    if (CAP) enc.copyTextureToBuffer({ texture: off }, { buffer: rb, bytesPerRow: bpr }, [W, Hh]);\n    dev.queue.submit([enc.finish()]);\n    return { psi: st.psi, cam: st.cam, x: st.x, z: st.z, w: st.w, roll };",
      "    if (PQ) { pPass(enc, [qT[0], qT[1]], pDown, bgDown, 'post-down'); pPass(enc, [qT[2], qT[3]], pBH, bgBH, 'post-blur-h'); pPass(enc, [qT[0], qT[1]], pBV, bgBV, 'post-blur-v'); pPass(enc, [target], pFin, bgFin, 'post-final'); }\n    if (CAP) enc.copyTextureToBuffer({ texture: off }, { buffer: rb, bytesPerRow: bpr }, [W, Hh]);\n    passTimer.resolve(enc);\n    dev.queue.submit([enc.finish()]);\n    const cpuEncodeMs = performance.now() - enc0;\n    return { psi: st.psi, cam: st.cam, x: st.x, z: st.z, w: st.w, roll, cpuPrepMs, cpuEncodeMs, drawCls };",
    ],
    [
      "  let t0 = performance.now(), last = t0;\n  const loop = (now) => { const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now; if (!DEMO) stepLive(dt);\n    const i = render(t); hud.textContent = `v448aaa3${DEMO ? ' · demo' : ''} · ${Math.round(((i.psi * 180 / Math.PI) % 360 + 360) % 360)}°`; requestAnimationFrame(loop); };\n  requestAnimationFrame(loop);",
      "  let t0 = performance.now(), last = t0;\n  const diagBox = document.getElementById('diag');\n  const diagTextEl = document.getElementById('diagtext');\n  const diagBtn = document.getElementById('diagcopy');\n  if (diagBtn) {\n    const stop = (e) => { e.stopPropagation(); };\n    diagBtn.addEventListener('pointerdown', stop, true);\n    diagBtn.addEventListener('pointerup', stop, true);\n    diagBtn.addEventListener('click', (e) => {\n      e.stopPropagation();\n      const text = JSON.stringify(window.__meadowClass());\n      const box = document.getElementById('diagjson');\n      if (box) box.value = text;\n      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});\n    });\n  }\n  window.__meadowClass = () => {\n    const profile = passTimer.export({ adapter: window.__meadowAdapter || null, canvas: [canvas.width, canvas.height], dpr: devicePixelRatio, err: window.__meadowErr || null });\n    const paired = pairDeltas(profile.samples);\n    return { ...profile, kind: 'draw-class', build: DRAW_CLASS_BUILD, submitted: SUBMITTED, locked: clsLocked, reading: READING, delta: paired.delta };\n  };\n  const loop = (now) => { const wall = (now - last) / 1000; const t = (now - t0) / 1000; const dt = Math.min(0.05, wall); last = now; if (!DEMO) stepLive(dt);\n    const i = render(t);\n    if (!clsLocked) {\n      passTimer.record({ wallMs: wall * 1000, cpuPrepMs: i.cpuPrepMs, cpuEncodeMs: i.cpuEncodeMs, cls: i.drawCls });\n      clsFrame += 1;\n      if (clsFrame >= 64) clsLocked = true;\n    }\n    passTimer.kick();\n    hud.textContent = `${DRAW_CLASS_BUILD}${DEMO ? ' · demo' : ''} · ${i.drawCls}${clsLocked ? ' · locked' : ''} · ${Math.round(((i.psi * 180 / Math.PI) % 360 + 360) % 360)}°`;\n    if (diagBox && (clsFrame === 1 || clsLocked || now - t0 >= 500)) {\n      diagBox.hidden = false;\n      if (diagTextEl) {\n        const d = window.__meadowClass().delta;\n        const line = (k) => d[k] && d[k].n ? `${k} n${d[k].n} med ${(d[k].median / 1e6).toFixed(1)}ms` : `${k} —`;\n        diagTextEl.textContent = `${DRAW_CLASS_BUILD} ${clsLocked ? 'locked' : 'recording ' + clsFrame + '/64'}\\n${line('no-grass')}\\n${line('no-ground')}\\n${line('no-trees')}\\n${line('no-shadow-trees')}`;\n      }\n    }\n    requestAnimationFrame(loop); };\n  requestAnimationFrame(loop);",
    ],
  ];
  for (const [oldText, newText] of swaps) {
    if (!out.includes(oldText)) throw new Error('scratch pattern missing: ' + oldText.slice(0, 90));
    if (out.split(oldText).length !== 2) throw new Error('scratch pattern not unique: ' + oldText.slice(0, 60));
    out = out.replace(oldText, newText);
  }
  if (!out.includes("passTimer.stamp('shadow')")) throw new Error('shadow stamp missing');
  if (!out.includes("passTimer.stamp('main')")) throw new Error('main stamp missing');
  if (!out.includes('stepLive(dt)')) throw new Error('scratch step removed');
  if (out.includes('paceFrame')) throw new Error('pace mixed in');
  if (out.includes('grassHidden')) throw new Error('grass wedge mixed in');
  const groundAt = out.indexOf('pass.draw(6 * 128 * 128)');
  const treeAt = out.indexOf('pass.setPipeline(pTree3)');
  const grassAt = out.indexOf('pass.draw(15, G * G)');
  const boltAt = out.indexOf('pass.setPipeline(pBolt)');
  if (!(groundAt < treeAt && treeAt < boltAt && boltAt < grassAt)) throw new Error('draw order moved');
  if (out.includes('if (mask.bolt)') || out.includes('mask.bolt')) throw new Error('bolt was gated');
  return out;
}

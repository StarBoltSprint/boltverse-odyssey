// Occlusion page = the cull page, with opaque occluders drawn before the ground.
// Ground is the heavy fragment shader. It was drawn first, then covered.
export function occlFromCull(src) {
  const banner = '// m448aaa3-occl1 — pace and grass wedge, ground drawn after the opaque occluders.\n';
  let out = banner + src;
  const oldDraw = [
    '    pass.setPipeline(pGround); pass.draw(6 * 128 * 128);',
    '    pass.setPipeline(pTree3); if (nN && !NOTR && !NON) pass.draw(25 * 30 + 58 * 12, nN); pass.setPipeline(pTreeMid); if (nF - nM && !NOTR && !NOF) pass.draw(210 + 22 * 6, nF - nM, 0, nN + nM);   // 3D trees (old card pass pTrees kept unused)',
    '    pass.setPipeline(pPeb); pass.draw(144, 960);',
    '    pass.setPipeline(pRock); pass.draw(360, 144); pass.setPipeline(pMill); pass.draw(MILL.verts); pass.setPipeline(pFlower); pass.draw(21, 70 * 70);',
    '    { const life = IDLE.sample(); if (life.idleAmt > 0.05) { pass.setPipeline(pIdleContact); pass.draw(6); } }',
    '    pass.setPipeline(pBolt); pass.draw(6);',
    "    if (qs.get('dbg') !== '1') { pass.setPipeline(pGrass); pass.draw(15, G * G); pass.draw(15, 150 * 150, 0, G * G); pass.draw(3, 130 * 130, 0, G * G + 150 * 150); }",
    '    pass.setPipeline(pSky); pass.draw(3);',
  ].join('\n');
  const newDraw = [
    '    pass.setPipeline(pTree3); if (nN && !NOTR && !NON) pass.draw(25 * 30 + 58 * 12, nN); pass.setPipeline(pTreeMid); if (nF - nM && !NOTR && !NOF) pass.draw(210 + 22 * 6, nF - nM, 0, nN + nM);   // 3D trees (old card pass pTrees kept unused)',
    '    pass.setPipeline(pPeb); pass.draw(144, 960);',
    '    pass.setPipeline(pRock); pass.draw(360, 144); pass.setPipeline(pMill); pass.draw(MILL.verts); pass.setPipeline(pFlower); pass.draw(21, 70 * 70);',
    '    pass.setPipeline(pBolt); pass.draw(6);',
    "    if (qs.get('dbg') !== '1') { pass.setPipeline(pGrass); pass.draw(15, G * G); pass.draw(15, 150 * 150, 0, G * G); pass.draw(3, 130 * 130, 0, G * G + 150 * 150); }",
    '    pass.setPipeline(pGround); pass.draw(6 * 128 * 128);',
    '    { const life = IDLE.sample(); if (life.idleAmt > 0.05) { pass.setPipeline(pIdleContact); pass.draw(6); } }',
    '    pass.setPipeline(pSky); pass.draw(3);',
  ].join('\n');
  if (!out.includes(oldDraw)) throw new Error('draw block missing');
  out = out.replace(oldDraw, newDraw);
  const oldDiag = 'if (diag) window.__meadowDiag = () => ({ ...diag.report(), adapter: window.__meadowAdapter || null, canvas: [canvas.width, canvas.height], dpr: devicePixelRatio, gpuTime: null, err: window.__meadowErr || null });';
  const newDiag = "window.__meadowBuild = 'm448aaa3-occl1'; if (diag) window.__meadowDiag = () => ({ ...diag.report(), build: window.__meadowBuild, adapter: window.__meadowAdapter || null, canvas: [canvas.width, canvas.height], dpr: devicePixelRatio, gpuTime: null, err: window.__meadowErr || null });";
  if (!out.includes(oldDiag)) throw new Error('diag export missing');
  out = out.replace(oldDiag, newDiag);
  out = out.replaceAll('v448aaa3-cull', 'v448aaa3-occl1');
  const oldRet = 'return { jpg: btoa(s), info };';
  const newRet = "if (qs.get('px') === '1') { let raw = ''; const px = new Uint8Array(img.data.buffer); for (let i = 0; i < px.length; i += 0x8000) raw += String.fromCharCode.apply(null, px.subarray(i, i + 0x8000)); return { raw: btoa(raw), w: W, h: Hh, build: 'm448aaa3-occl1', info }; } return { jpg: btoa(s), info };";
  if (!out.includes(oldRet)) throw new Error('frame return missing');
  out = out.replace(oldRet, newRet);
  if (!out.includes('paceFrame(wall, stepLive)')) throw new Error('pace removed');
  if (!out.includes('grassOffscreen(GRASS')) throw new Error('wedge removed');
  return out;
}

// Cull page = the pace page, plus a grass wedge that drops blades outside the camera.
export function cullFromPace(src) {
  const banner = '// m448aaa3-cull — same picture intent as m448aaa3-pace. Grass vertices outside the camera wedge are not shaded.\n';
  let out = banner + src;
  const swaps = [
    [
      "import { paceFrame } from './engine/bricks/sim-pace.js?v=pace1';",
      "import { paceFrame } from './engine/bricks/sim-pace.js?v=pace1';\nimport { grassOffscreen, grassTanHalfH } from './engine/bricks/grass-offscreen.js?v=cull1';",
    ],
    [
      "pGrass = pipe(GRASS, true, 'none', false)",
      "pGrass = pipe(grassOffscreen(GRASS, grassTanHalfH(W / Hh)), true, 'none', false)",
    ],
    [
      'hud.textContent = `v448aaa3-pace${DEMO ? \' · demo\' : \'\'}',
      'hud.textContent = `v448aaa3-cull${DEMO ? \' · demo\' : \'\'}',
    ],
  ];
  for (const [oldText, newText] of swaps) {
    if (!out.includes(oldText)) throw new Error('pace pattern missing: ' + oldText.slice(0, 70));
    out = out.replace(oldText, newText);
  }
  if (out.split('grassOffscreen(GRASS').length !== 2) throw new Error('grass wrap count');
  if (!out.includes('paceFrame(wall, stepLive)')) throw new Error('pace removed');
  return out;
}

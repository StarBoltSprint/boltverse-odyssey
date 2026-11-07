// Build the pace page from the installed diagnostic page. The only edits are the
// import and the frame loop. Shaders, draws, camera, and stepLive stay as they are.
export function paceFromDiag(src) {
  const banner = '// m448aaa3-pace — same picture as the installed diagnostic. Wall time is simulated in steps of at most 0.05 s.\n';
  const imp = "import { makeFrameDiag, diagText } from './engine/bricks/frame-diag.js?v=diag1';";
  const add = imp + "\nimport { paceFrame } from './engine/bricks/sim-pace.js?v=pace1';";
  if (!src.includes(imp)) throw new Error('diagnostic import missing');
  if (src.includes('sim-pace.js')) throw new Error('diagnostic already imports sim-pace');
  let out = banner + src.replace(imp, add);
  const oldLoop = [
    '    const wall = (now - last) / 1000;',
    '    const t = (now - t0) / 1000, dt = Math.min(0.05, wall); last = now; if (!DEMO) stepLive(dt);',
    '    const i = render(t); hud.textContent = `v448aaa3${DEMO ? \' · demo\' : \'\'} · ${Math.round(((i.psi * 180 / Math.PI) % 360 + 360) % 360)}°`;',
    '    if (diag) {',
    '      diag.push(wall, dt, live.v);',
  ].join('\n');
  const newLoop = [
    '    const wall = (now - last) / 1000;',
    '    const t = (now - t0) / 1000;',
    '    last = now;',
    '    const applied = DEMO ? 0 : paceFrame(wall, stepLive);',
    '    const i = render(t); hud.textContent = `v448aaa3-pace${DEMO ? \' · demo\' : \'\'} · ${Math.round(((i.psi * 180 / Math.PI) % 360 + 360) % 360)}°`;',
    '    if (diag) {',
    '      diag.push(wall, applied, live.v);',
  ].join('\n');
  if (!out.includes(oldLoop)) throw new Error('diagnostic loop missing');
  out = out.replace(oldLoop, newLoop);
  if (out.includes('Math.min(0.05, wall)')) throw new Error('capped wall step still in the page');
  if (out.split('paceFrame(wall, stepLive)').length !== 2) throw new Error('pace call count');
  return out;
}

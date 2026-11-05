// perf-shadowcache: decides which shadow cascades must be re-rendered this frame (any biome).
// near cascade: every frame. far cascades: every `farEvery` frames, or at once when the light/eye moved more than `moveTol` m.
export function makeShadowCache({ cascades = 2, farEvery = 2, moveTol = 0.5 } = {}) {
  let frame = 0; const lastX = new Float64Array(cascades).fill(1e9), lastZ = new Float64Array(cascades).fill(1e9), need = new Uint8Array(cascades);
  return { need, update(ex, ez, force = false) { frame++;
    for (let c = 0; c < cascades; c++) { const moved = Math.hypot(ex - lastX[c], ez - lastZ[c]) > moveTol * (c + 1) * 4;
      need[c] = force || c === 0 || farEvery <= 1 || moved || (frame % farEvery) === (c % farEvery) ? 1 : 0; if (need[c]) { lastX[c] = ex; lastZ[c] = ez; } }
    return need; } };
}

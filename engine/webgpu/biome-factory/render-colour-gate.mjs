// Rendered real-colour gate. Reference = the albedo the shader sampled,
// times the biome rig irradiance of that pixel's normal.
// CIE76 limit stays 10. Lightness is included. A darkened shader must block.
import { srgbToLab, dE76, DE76_MAX } from './cie76.mjs';

function lin22(c) {
  return (c / 255) ** 2.2;
}
function present22(lin) {
  const x = Math.min(1, Math.max(0, lin));
  return Math.round((x ** (1 / 2.2)) * 255);
}
function medianLab(pixels) {
  const labs = pixels.map(srgbToLab);
  const mid = (k) => labs.map((v) => v[k]).sort((a, b) => a - b)[Math.floor((labs.length - 1) / 2)];
  return [mid(0), mid(1), mid(2)];
}
function round2(n) { return Math.round(n * 100) / 100; }

export function predictRgb(alb, ndl, ny, shadeAt) {
  const irr = shadeAt(ndl, ny).rgb;
  return [0, 1, 2].map((i) => present22(lin22(alb[i]) * irr[i]));
}

export function scoreWindow(shot, expectMat, shadeAt, predictNormal) {
  const colour = [];
  const pred = [];
  const n = Math.min(shot.colour.length, shot.mask.length, shot.albedo.length);
  for (let i = 0; i < n; i++) {
    const m = shot.mask[i];
    const mat = Math.round(m[0] / 255 * 8 - 0.5);
    const ndl = m[1] / 255;
    const ny = m[2] / 255;
    const ndv = m[3] / 255;
    if (mat !== expectMat || ndv < 0.55) continue;
    if ((ny > 0.7 ? ndl < 0.1 : ndl < 0.4)) continue;
    const alb = shot.albedo[i];
    colour.push([shot.colour[i][0], shot.colour[i][1], shot.colour[i][2]]);
    if (predictNormal && shot.normal && shot.normal[i]) {
      const nr = shot.normal[i];
      const N = [nr[0] / 255 * 2 - 1, nr[1] / 255 * 2 - 1, nr[2] / 255 * 2 - 1];
      const ao = nr[3] / 255;
      const irr = predictNormal(N, ao);
      const lin = [alb[0], alb[1], alb[2]].map(lin22);
      pred.push([0, 1, 2].map((k) => present22(lin[k] * irr[k])));
    } else {
      pred.push(predictRgb([alb[0], alb[1], alb[2]], ndl, ny, shadeAt));
    }
  }
  if (colour.length < 8) return { ok: false, pixels: colour.length, verdict: 'UNCERTAIN', dE76: null, threshold: DE76_MAX };
  const lab = medianLab(colour).map(round2);
  const predLab = medianLab(pred).map(round2);
  const dE = dE76(lab, predLab);
  return {
    ok: true,
    pixels: colour.length,
    dE76: round2(dE),
    verdict: dE > DE76_MAX ? 'BLOCK' : 'PASS',
    threshold: DE76_MAX,
    includesLightness: true,
    lab,
    predLab,
  };
}

// Same-light colour gate. CIE76 threshold stays 10. L* is part of the distance.
// A night-key measurement and a shadowless albedo do not share a light, so they are UNCERTAIN.
// This does not fit a per-material exposure, drop luminance, or recover albedo from an unknown scene.

export const DE76_MAX = 10;

export function srgbToLin(c) {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

export function srgbToLab(rgb) {
  const c = rgb.map(srgbToLin);
  const X = (0.4124 * c[0] + 0.3576 * c[1] + 0.1805 * c[2]) / 0.95047;
  const Y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const Z = (0.0193 * c[0] + 0.1192 * c[1] + 0.9505 * c[2]) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function dE76(a, b) {
  const dL = a[0] - b[0], da = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt(dL * dL + da * da + db * db);
}

function labMedian(pixels) {
  const labs = pixels.map(srgbToLab);
  const n = labs.length;
  const mid = (k) => labs.map(v => v[k]).sort((a, b) => a - b)[Math.floor((n - 1) / 2)];
  return [mid(0), mid(1), mid(2)];
}

function underSameExposure(rgb, exposure) {
  return rgb.map(v => {
    const lin = Math.min(1, Math.max(0, srgbToLin(v) * exposure));
    const x = lin <= 0.0031308 ? 12.92 * lin : 1.055 * lin ** (1 / 2.4) - 0.055;
    return Math.min(255, Math.max(0, x * 255));
  });
}

// sample: { rgb:[r,g,b] | pixels:[[r,g,b],...], light_id, exposure }
export function compareSameLight(sample, reference) {
  const sLab = sample.pixels ? labMedian(sample.pixels) : srgbToLab(sample.rgb);
  const rLab = reference.pixels ? labMedian(reference.pixels) : srgbToLab(reference.rgb);
  const rawDE76 = dE76(sLab, rLab);
  const sameId = sample.light_id && sample.light_id === reference.light_id;
  const expS = sample.exposure == null ? 1 : sample.exposure;
  const expR = reference.exposure == null ? 1 : reference.exposure;
  if (!sameId || expS !== expR) {
    return {
      verdict: 'UNCERTAIN',
      compared: false,
      threshold: DE76_MAX,
      rawDE76: round(rawDE76),
      reason: !sameId
        ? 'light ids differ or are unknown; scene light is not recovered and exposure is not fitted'
        : 'exposure differs; per-material exposure is not fitted to force a pass',
    };
  }
  const sLit = sample.pixels
    ? labMedian(sample.pixels.map(p => underSameExposure(p, expS)))
    : srgbToLab(underSameExposure(sample.rgb, expS));
  const rLit = reference.pixels
    ? labMedian(reference.pixels.map(p => underSameExposure(p, expR)))
    : srgbToLab(underSameExposure(reference.rgb, expR));
  const dE = dE76(sLit, rLit);
  return {
    verdict: dE > DE76_MAX ? 'BLOCK' : 'PASS',
    compared: true,
    threshold: DE76_MAX,
    dE76: round(dE),
    rawDE76: round(rawDE76),
    light_id: sample.light_id,
    exposure: expS,
    includesLightness: true,
  };
}

function round(n) { return Math.round(n * 100) / 100; }

export const PRIOR_RAW = {
  method: 'texture median Lab versus key-region median Lab, no shared light',
  source: 'biome-guards README 2026-11-08: crystal v2 materials dE76 19-66 against threshold 10',
  use: 'diagnostic only; not a colour pass and not a colour fail of the albedo',
};

export function crystalColourStatus() {
  return compareSameLight(
    { rgb: [74, 75, 77], light_id: 'imagine-albedo-neutral', exposure: 1 },
    { rgb: [18, 22, 40], light_id: 'scene-unknown', exposure: 1 },
  );
}

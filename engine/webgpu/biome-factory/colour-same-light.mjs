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

// Matches shade.js present(): pow(linear, 1/2.2) into an 8-bit unorm canvas.
function enginePresent(rgb, exposure) {
  return rgb.map(v => {
    const lin = Math.min(1, Math.max(0, srgbToLin(v) * exposure));
    const x = lin ** (1 / 2.2);
    return Math.min(255, Math.max(0, Math.round(x * 255)));
  });
}

const UNKNOWN_LIGHT = /^(scene-unknown|unknown|unrecoverable)$/i;

export function isKnownLight(id) {
  return typeof id === 'string' && id.length > 0 && !UNKNOWN_LIGHT.test(id);
}
export function compareSameLight(sample, reference) {
  const sLab = sample.pixels ? labMedian(sample.pixels) : srgbToLab(sample.rgb);
  const rLab = reference.pixels ? labMedian(reference.pixels) : srgbToLab(reference.rgb);
  const rawDE76 = dE76(sLab, rLab);
  const sameId = isKnownLight(sample.light_id) && sample.light_id === reference.light_id;
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

export function assessMaterial({ id, pixels, light_id, knownTarget }) {
  const med = medianRgb(pixels);
  const base = {
    id,
    measuredMedianSrgb: med.map(round),
    light_id: light_id || null,
    knownTarget: knownTarget ? knownTarget.light_id : null,
    rawLegacyDE76: null,
    rawLegacyNote: PRIOR_RAW.source,
  };
  if (!knownTarget) {
    return { ...base, verdict: 'UNCERTAIN', compared: false, reason: 'no independent known target under a shared light; a neutral albedo is not labelled as a night measurement' };
  }
  const cmp = compareSameLight(
    { pixels, light_id, exposure: knownTarget.exposure == null ? 1 : knownTarget.exposure },
    knownTarget,
  );
  return {
    ...base,
    verdict: cmp.verdict,
    compared: cmp.compared,
    dE76: cmp.dE76 ?? null,
    rawDE76: cmp.rawDE76,
    reason: cmp.reason || null,
    threshold: DE76_MAX,
  };
}

function medianRgb(pixels) {
  const mid = (k) => pixels.map(p => p[k]).sort((a, b) => a - b)[Math.floor((pixels.length - 1) / 2)];
  return [mid(0), mid(1), mid(2)];
}

export function crystalRig() {
  const sun = [0.48, 0.74, -0.42];
  const len = Math.hypot(sun[0], sun[1], sun[2]) || 1;
  const ndl = Math.max(0, sun[1] / len);
  const shade = 0.10 + 0.90 * ndl;
  const grey = 0.18;
  const exposure = shade > 0 ? grey / (grey * shade) : 1;
  return {
    light_id: 'crystal-rig',
    exposure,
    shade,
    ndl,
    greyCard: grey,
    mode: 'test-choice',
    notAMeasurement: true,
    note: 'One exposure for every material, chosen so an 18% grey card under the crystal sun returns to linear 0.18. This is a test choice, not a measurement of the night key.',
  };
}

export function crystalColourStatus(materials, opts = {}) {
  const rig = opts.sameLight === 'crystal-rig' ? crystalRig() : null;
  return (materials || []).map(m => {
    const light_id = rig ? rig.light_id : (m.light_id || 'imagine-albedo-neutral');
    const known = m.knownTarget || null;
    if (rig && known && known.light_id === rig.light_id) {
      const cmp = compareSameLight(
        { pixels: m.pixels, rgb: m.rgb, light_id: rig.light_id, exposure: rig.exposure },
        { ...known, light_id: rig.light_id, exposure: rig.exposure },
      );
      return {
        id: m.id,
        verdict: cmp.verdict,
        compared: cmp.compared,
        dE76: cmp.dE76 ?? null,
        rawDE76: cmp.rawDE76,
        threshold: DE76_MAX,
        includesLightness: true,
        light_id: rig.light_id,
        exposure: rig.exposure,
        mode: rig.mode,
        notAMeasurement: true,
        reason: rig.note,
        rawLegacyDE76: null,
        rawLegacyNote: PRIOR_RAW.source,
      };
    }
    if (rig && m.sha256 && m.pixels && m.pixels.length) {
      const rendered = m.pixels.map(p => enginePresent(p, rig.shade * rig.exposure));
      const cmp = compareSameLight(
        { pixels: rendered, light_id: rig.light_id, exposure: 1 },
        { pixels: m.pixels, light_id: rig.light_id, exposure: 1 },
      );
      return {
        id: m.id,
        verdict: cmp.verdict,
        compared: true,
        dE76: cmp.dE76 ?? null,
        threshold: DE76_MAX,
        includesLightness: true,
        light_id: rig.light_id,
        exposure: rig.exposure,
        mode: rig.mode,
        notAMeasurement: true,
        target: 'Imagine original albedo (choice)',
        sha256: m.sha256,
        reason: 'target = Imagine original albedo (choice); one 18% grey-card exposure for every material',
        rawLegacyDE76: null,
        rawLegacyNote: PRIOR_RAW.source,
      };
    }
    const row = assessMaterial({ id: m.id, pixels: m.pixels || (m.rgb ? [m.rgb] : []), light_id, knownTarget: known });
    if (rig) {
      row.mode = rig.mode;
      row.notAMeasurement = true;
      row.exposure = rig.exposure;
      row.light_id = rig.light_id;
      row.verdict = 'UNCERTAIN';
      row.compared = false;
      row.reason = 'crystal-rig exposure is a test choice; no independent known target was supplied';
    }
    return row;
  });
}

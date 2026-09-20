/**
 * Vector despill for Lane cutouts (cook / comp).
 * Measure cyc + coat + plate wrap → subtract excess screen axis,
 * replace toward coat (core) or plate (edge).
 *
 * Work in linear / plate working RGB. Not a key. Not for the road plate.
 */

function avg(samples) {
  if (!samples || !samples.length) throw new Error('need samples');
  const n = samples.length;
  const o = [0, 0, 0];
  for (const s of samples) {
    o[0] += s[0];
    o[1] += s[1];
    o[2] += s[2];
  }
  return [o[0] / n, o[1] / n, o[2] / n];
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(a, k) {
  return [a[0] * k, a[1] * k, a[2] * k];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function len(a) {
  return Math.hypot(a[0], a[1], a[2]);
}

function lerp3(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

/**
 * @param {number[][]} cycSamples   empty cyc / green holes
 * @param {number[][]} coatSamples  clean fur (no spill)
 * @param {number[][]} plateSamples shoulder wrap from the road plate
 */
function buildModel(cycSamples, coatSamples, plateSamples) {
  const s = avg(cycSamples);
  const n = avg(coatSamples);
  const tEdge = avg(plateSamples);
  const tCore = n.slice();
  const axis = sub(s, n);
  const axisLen = Math.max(len(axis), 1e-8);
  const axisHat = scale(axis, 1 / axisLen);

  // Floor: screen coord of coat mean (should be ~0)
  const uCoat = dot(sub(n, n), axis) / (axisLen * axisLen); // 0
  // Use max screen coord among coat samples as floor (protect coat green)
  let uFloor = 0;
  for (const c of coatSamples) {
    const u = dot(sub(c, n), axis) / (axisLen * axisLen);
    if (u > uFloor) uFloor = u;
  }

  // Magenta residual axis (approx R+B - G direction)
  const magenta = normalize3([1, -0.5, 1]);

  return {
    s,
    n,
    tCore,
    tEdge,
    axis,
    axisLen,
    axisHat,
    uCoat: uFloor,
    magenta,
  };
}

function normalize3(v) {
  const L = Math.max(len(v), 1e-8);
  return scale(v, 1 / L);
}

function screenU(c, model) {
  return dot(sub(c, model.n), model.axis) / (model.axisLen * model.axisLen);
}

/**
 * @param {number[]} rgb
 * @param {object} model
 * @param {number} k         strength along screen axis
 * @param {number} edge      0 = core, 1 = fringe
 * @param {number} [kMagenta]
 */
function despillPixel(rgb, model, k = 0.75, edge = 0, kMagenta = 0.25) {
  const u = screenU(rgb, model);
  const beta = k * Math.max(0, u - model.uCoat);
  if (beta <= 0 && edge <= 0) return rgb.slice();

  const t = lerp3(model.tCore, model.tEdge, clamp01(edge));
  // Remove excess along screen, add toward target
  let out = sub(rgb, scale(model.axisHat, beta * model.axisLen));
  out = add(out, scale(sub(t, model.n), beta));

  // Weak magenta suppress (post G-pull)
  const m = model.magenta;
  const mAmt = kMagenta * Math.max(0, dot(sub(out, t), m));
  out = sub(out, scale(m, mAmt));

  return [
    Math.max(0, out[0]),
    Math.max(0, out[1]),
    Math.max(0, out[2]),
  ];
}

/**
 * @param {{ rgb:number[], a:number, premul?:boolean, edge?:number }} sample
 */
function despillSample(sample, model, opts = {}) {
  const k = opts.k == null ? 0.75 : opts.k;
  const kMagenta = opts.kMagenta == null ? 0.25 : opts.kMagenta;
  const edge = sample.edge == null ? 0 : sample.edge;
  let rgb = sample.rgb.slice();
  const a = sample.a == null ? 1 : sample.a;

  if (sample.premul && a > 1e-6) {
    rgb = [rgb[0] / a, rgb[1] / a, rgb[2] / a];
  }

  rgb = despillPixel(rgb, model, k, edge, kMagenta);

  if (sample.premul) {
    rgb = [rgb[0] * a, rgb[1] * a, rgb[2] * a];
  }

  return { rgb, a };
}

module.exports = {
  buildModel,
  despillPixel,
  despillSample,
};

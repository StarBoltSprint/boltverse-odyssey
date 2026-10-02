/**
 * Play-time sky composite. Mixes Imagine pixels only.
 * A seam weight is a convex combination of two slice texels.
 * A living layer is the current frame of an Imagine video, sampled at a
 * per-slice time offset. No pixel is invented.
 *
 * Classic script: window.BoltSky. Node: import this file, then read globalThis.BoltSky.
 * The repo package is "type": "module", so require() does not receive the API.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.BoltSky = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const SEAM_FRAC_MIN = 0.02;
  const SEAM_FRAC_MAX = 0.04;
  const SEAM_FRAC = 0.03;
  const SKY_VIDEOS_MAX = 3;
  const SKY_TEX_MAX = 48 * 1024 * 1024;
  const COMBINED_MIN_SEC = 600;
  const OFFSET_MIN_SEC = 0.75;

  function gcd(a, b) {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y) {
      const t = y;
      y = x % y;
      x = t;
    }
    return x || 1;
  }

  function combinedRepeatSec(durations) {
    if (!durations.length) return 0;
    let acc = Math.max(1, Math.round(durations[0] * 10));
    for (let i = 1; i < durations.length; i++) {
      const item = Math.max(1, Math.round(durations[i] * 10));
      acc = (acc / gcd(acc, item)) * item;
    }
    return acc / 10;
  }

  function resolveSeamBlend(opts) {
    const gateOk = !!(opts && opts.gateOk);
    const requested = opts ? opts.seamBlend : undefined;
    if (!gateOk) return { enabled: false, frac: 0, reason: "gate has not passed" };
    if (requested === false || requested === "off") return { enabled: false, frac: 0, reason: "off" };
    const frac = clampFrac(opts && opts.seamFrac);
    return { enabled: true, frac, reason: "gate passed" };
  }

  function clampFrac(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return SEAM_FRAC;
    return Math.min(SEAM_FRAC_MAX, Math.max(SEAM_FRAC_MIN, n));
  }

  function blendSeam(left, right, width, height, frac) {
    const f = clampFrac(frac);
    const band = Math.max(1, Math.round(width * f));
    const out = new Uint8Array(left.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 3;
        if (x < width - band) {
          out[i] = left[i];
          out[i + 1] = left[i + 1];
          out[i + 2] = left[i + 2];
          continue;
        }
        const u = (x - (width - band) + 0.5) / band;
        const xr = x - (width - band);
        const j = (y * width + Math.min(width - 1, xr)) * 3;
        for (let c = 0; c < 3; c++) {
          const mixed = left[i + c] * (1 - u) + right[j + c] * u;
          out[i + c] = Math.round(mixed);
        }
      }
    }
    return { rgba: out, band, frac: f };
  }

  function layerTime(t, offsetSec, durationSec) {
    const d = Number(durationSec);
    if (!Number.isFinite(d) || d <= 0) return 0;
    let x = (Number(t) + Number(offsetSec || 0)) % d;
    if (x < 0) x += d;
    return x;
  }

  function offsetsDiverge(offsets, minSep) {
    const sep = minSep || OFFSET_MIN_SEC;
    const errors = [];
    for (let i = 0; i < offsets.length; i++) {
      const j = (i + 1) % offsets.length;
      if (offsets.length < 2) break;
      if (Math.abs(offsets[i] - offsets[j]) < sep) {
        errors.push("slice " + i + " and " + j + " start within " + sep + "s");
      }
    }
    return errors;
  }

  function oneShotGaps(count, minGap, maxGap, rng) {
    const gaps = [];
    const lo = Number(minGap);
    const hi = Number(maxGap);
    for (let i = 0; i < count; i++) {
      const u = rng ? rng() : Math.random();
      gaps.push(lo + u * (hi - lo));
    }
    return gaps;
  }

  function skyPlan(opts) {
    const o = opts || {};
    const layers = Array.isArray(o.layers) ? o.layers : [];
    const offsets = Array.isArray(o.offsets) ? o.offsets.map(Number) : [];
    const seam = resolveSeamBlend(o);
    const durations = layers.map((layer) => Number(layer.durationSec));
    const errors = [];
    const sliceCount = Number(o.sliceCount || offsets.length || 0);
    if (layers.length && sliceCount > 1 && offsets.length !== sliceCount) {
      errors.push("each slice needs its own start offset");
    }
    if (layers.length > SKY_VIDEOS_MAX) {
      errors.push("sky videos " + layers.length + " exceed " + SKY_VIDEOS_MAX);
    }
    let tex = 0;
    const timed = layers.map((layer) => {
      const bytes = Number(layer.texBytes || 0);
      tex += bytes;
      return {
        id: layer.id,
        durationSec: Number(layer.durationSec),
        texBytes: bytes,
        file: layer.file || null,
        times: offsets.map((offset) => layerTime(o.t || 0, offset, layer.durationSec)),
      };
    });
    if (tex > SKY_TEX_MAX) errors.push("sky texture bytes " + tex + " exceed " + SKY_TEX_MAX);
    errors.push(...offsetsDiverge(offsets));
    const oneShots = Array.isArray(o.oneShots) ? o.oneShots : [];
    const concurrent = layers.length + (oneShots.length ? 1 : 0);
    if (concurrent > SKY_VIDEOS_MAX) {
      errors.push("sky decoders " + concurrent + " exceed " + SKY_VIDEOS_MAX + " with a one-shot playing");
    }
    const combined = combinedRepeatSec(durations.filter((d) => d > 0));
    if (durations.length && combined < COMBINED_MIN_SEC) {
      errors.push("combined repeat " + combined + "s is under " + COMBINED_MIN_SEC + "s");
    }
    return {
      ok: errors.length === 0,
      errors,
      seam,
      layers: timed,
      offsets,
      oneShots,
      activeVideos: concurrent,
      texBytes: tex,
      combinedRepeatSec: combined,
      limits: { videos: SKY_VIDEOS_MAX, texBytes: SKY_TEX_MAX, combinedMinSec: COMBINED_MIN_SEC },
    };
  }

  function bindSkyPerf(perf, plan) {
    if (!perf || !plan) return;
    for (const layer of plan.layers || []) {
      const id = "sky:" + (layer.id || "layer");
      if (typeof perf.noteVideo === "function") perf.noteVideo(id);
      if (layer.texBytes && typeof perf.noteTexture === "function") perf.noteTexture(id, layer.texBytes);
    }
  }

  return {
    SEAM_FRAC,
    SEAM_FRAC_MIN,
    SEAM_FRAC_MAX,
    SKY_VIDEOS_MAX,
    SKY_TEX_MAX,
    COMBINED_MIN_SEC,
    resolveSeamBlend,
    blendSeam,
    layerTime,
    offsetsDiverge,
    oneShotGaps,
    combinedRepeatSec,
    skyPlan,
    bindSkyPerf,
  };
});

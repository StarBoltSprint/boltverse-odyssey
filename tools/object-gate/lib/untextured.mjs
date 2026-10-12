// Blocking untextured-area. A visible face with no Imagine plate reads as flat
// grey, flat white (MeshBasic default), or the atlas's black padding.
//
// Thresholds, measured on the object mask of a phone render:
//   maxFraction  0.005   bad pixels / object pixels
//   grey         chroma ≤ 12 and luma in [60, 210]   (flat fallback grey)
//   black        luma < 14                            (empty atlas / missing sample)
//   white        luma > 248 and chroma ≤ 8            (default untextured material)
// Views the gate renders: 8 m, 30 m, hero (key camera), orbit (45°).

export const UNTEX_LIMITS = {
  maxFraction: 0.005,
  greyChroma: 12,
  greyLuma: [60, 210],
  blackLuma: 14,
  whiteLuma: 248,
  whiteChroma: 8,
};

export function isUntextured(r, g, b, limits = UNTEX_LIMITS) {
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  if (luma < limits.blackLuma) return true;
  if (luma > limits.whiteLuma && chroma <= limits.whiteChroma) return true;
  if (chroma <= limits.greyChroma && luma >= limits.greyLuma[0] && luma <= limits.greyLuma[1]) return true;
  return false;
}

/** rgba, mask: Uint8Array length w*h*4 and w*h (mask > 127 = object). */
export function scoreUntextured(rgba, mask, limits = UNTEX_LIMITS) {
  let on = 0, bad = 0;
  const n = mask.length;
  for (let i = 0; i < n; i++) {
    if (mask[i] <= 127) continue;
    on++;
    const o = i * 4;
    if (isUntextured(rgba[o], rgba[o + 1], rgba[o + 2], limits)) bad++;
  }
  const fraction = on ? bad / on : 1;
  return {
    objectPx: on,
    badPx: bad,
    fraction: +fraction.toFixed(5),
    pass: on > 0 && fraction <= limits.maxFraction,
    limits,
  };
}

export function texturedFixture(w = 48, h = 64) {
  const rgba = new Uint8Array(w * h * 4);
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    mask[i] = 255;
    rgba[i * 4] = 150 + (x % 40);
    rgba[i * 4 + 1] = 30 + (y % 25);
    rgba[i * 4 + 2] = 20 + ((x + y) % 20);
    rgba[i * 4 + 3] = 255;
  }
  return { rgba, mask, w, h };
}

/** A plated rock with a flat grey wall on the right third. */
export function greyWallFixture(w = 48, h = 64) {
  const pic = texturedFixture(w, h);
  for (let y = 0; y < h; y++) for (let x = Math.floor(w * 0.55); x < w; x++) {
    const i = y * w + x;
    pic.rgba[i * 4] = 140;
    pic.rgba[i * 4 + 1] = 140;
    pic.rgba[i * 4 + 2] = 140;
  }
  return pic;
}

// CIE76 with lightness. The limit is 10. It is not a knob.
// Lab uses the IEC sRGB curve. The renderer and the predictor share one grade.

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

/** Law 12 — plant Bolt on the 1-point ribbon, not a flat SHIFT_FRAC.
 * P = C + \u03bb w N. Straight nationale → N = (1,0), \u03bb = lane −1|0|1.
 * Lane centers sit at ±2w (one-lane half-width w). 3-lane span = 6w.
 */
export type RibbonSample = { s: number; x: number; y: number; w: number };

export type Ribbon = {
  chap: string;
  camera: string;
  plant: number;
  samples: readonly RibbonSample[];
};

export const RIBBON: Ribbon = {
  chap: "prismwake",
  camera: "1point",
  plant: 0.8,
  samples: [
    { s: 0.0, x: 0.5, y: 0.86, w: 0.1085 },
    { s: 0.35, x: 0.5, y: 0.7, w: 0.087 },
    { s: 0.7, x: 0.5, y: 0.48, w: 0.055 },
    { s: 1.0, x: 0.5, y: 0.22, w: 0.028 },
  ],
};

export function widthAt(y: number, rib: Ribbon = RIBBON): number {
  const s = rib.samples;
  if (!s.length) return 0.09;
  if (y >= s[0]!.y) return s[0]!.w;
  const last = s[s.length - 1]!;
  if (y <= last.y) return last.w;
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i]!;
    const b = s[i + 1]!;
    if (y <= a.y && y >= b.y) {
      const t = (a.y - y) / Math.max(1e-6, a.y - b.y);
      return a.w + (b.w - a.w) * t;
    }
  }
  return s[0]!.w;
}

/** Pixel X offset from canvas center for lane −1|0|1 at plant Y. */
export function laneShiftPx(cw: number, lane: number, y = RIBBON.plant, rib: Ribbon = RIBBON): number {
  return lane * 2 * widthAt(y, rib) * cw;
}

/** Law 22-m: success never wraps to empty. Miss drops one tier. */
export function nextOnSuccess(cur: number, n: number): number {
  if (n <= 1) return 0;
  if (cur + 1 >= n) return n - 1;
  return cur + 1;
}

export function nextOnMiss(cur: number): number {
  return cur > 0 ? cur - 1 : 0;
}

/**
 * Far hills are one coarse loft, repeated on the crest plate already in the
 * feature atlas. They sit outside the walkable rim. No collider.
 */
export const HILL_PART = {
  halfX: 0.58,
  halfZ: 0.35,
  stations: [
    [0, 1.16, 0.70, 0.04, 0.96, 0.02],
    [0.28, 1.02, 0.60, 0.04, 0.96, 0.28],
    [0.62, 0.74, 0.44, 0.04, 0.96, 0.62],
    [0.86, 0.40, 0.24, 0.04, 0.96, 0.86],
    [1, 0.12, 0.08, 0.04, 0.96, 0.98],
  ],
};

export const HILL_ANGLES = [0.15, 0.85, 1.45, 2.15, 2.75, 3.45, 4.15, 4.85, 5.55];
export const HILL_H = 9.5;

/** Repeats of the crest plate so the hill stays at magnification ≤ 0.98 from the rim. */
export function hillRepeat(focal, plateH, worldH) {
  let n = 1;
  const h = worldH || HILL_H;
  while (n < 4 && (focal * h) / (0.98 * plateH * n) > 14) n += 1;
  return n;
}

/** Metres from the walkable rim to the hill's inner face. */
export function hillFaceDist(focal, plateH, worldH, repeats) {
  return (focal * worldH) / (0.98 * plateH * repeats);
}

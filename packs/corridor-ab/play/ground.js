/**
 * The ground quad rides with Bolt. Fog reaches 1 before the far edge,
 * and the horizon hulls stand past that fog so the line is not a cut.
 */

export const FOG_NEAR = 46;
export const FOG_FAR = 108;
export const GROUND_AHEAD = 200;
export const GROUND_BACK = 40;
export const GROUND_HALF = 90;

export function groundRectFor(x, z) {
  return [
    x - GROUND_BACK,
    z - GROUND_HALF,
    x + GROUND_AHEAD,
    z + GROUND_HALF,
  ];
}

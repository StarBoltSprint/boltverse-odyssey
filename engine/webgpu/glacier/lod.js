// Screen-error LOD and the ice value layer. One rig. No sky mix.
import { FOV_Y } from '../engine/bricks/follow-cam.js';

export const LOD = {
  errLo: 1,
  errHi: 2,
  valueNear: 90,
  valueFar: 360,
  valueScale: 0.36,
  coarseSegs: 8,
  coarseSides: 4,
  inset: 0.25,
  screenH: 1280,
};

export function mpp(dist, h = LOD.screenH) {
  return Math.max(1e-4, dist * 2 * Math.tan(FOV_Y / 2) / h);
}

export function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

// Chord error of a sine crest split into `segs` pieces.
export function crestSagitta(height, segs) {
  return height * (Math.PI / segs) ** 2 / 8;
}

// signedErr > 0 coarse, < 0 fine sibling, 0 terminal surface.
export function lodCover(signedErr, dist) {
  if (!signedErr) return 1;
  const errPx = Math.abs(signedErr) / mpp(dist);
  const fade = smoothstep(LOD.errLo, LOD.errHi, errPx);
  return signedErr > 0 ? 1 - fade : fade;
}

export function valueAt(dist) {
  const reach = smoothstep(LOD.valueNear, LOD.valueFar, dist);
  return 1 + (LOD.valueScale - 1) * reach;
}

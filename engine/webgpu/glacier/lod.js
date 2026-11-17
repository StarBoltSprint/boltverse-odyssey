// Screen-error LOD. Colour is not a function of distance.
import { FOV_Y } from '../engine/bricks/follow-cam.js';

export const LOD = {
  errLo: 1,
  errHi: 2,
  coarseSegs: 8,
  coarseSides: 4,
  inset: 0.25,
  screenH: 1280,
};

export function expectedMipLevels(w, h) {
  return Math.floor(Math.log2(Math.max(1, w, h))) + 1;
}

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

// Toksvig 2004. s = length of the filtered normal. 1 means no variance.
export function toksvigPower(power, s) {
  const len = Math.min(1, Math.max(1e-3, s));
  return power * len / (len + power * (1 - len));
}

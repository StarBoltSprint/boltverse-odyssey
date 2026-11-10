// Skip grass blades whose whole reach sits outside the camera wedge.
// The reach covers the blade's horizontal offset in engine/grass.js (wind, bend, width).
// The wedge uses the same vertical FOV and aspect as the page projection. It does not
// change a blade that can meet the frustum. Portrait makes the side wedge narrow.

export const GRASS_VFOV_DEG = 62;
export const GRASS_REACH_M = 2.5;
export const GRASS_WEDGE_PAD_M = 2;

export function grassHorizReachM() {
  const windMax = 0.5 * 0.9 + 0.5 * 0.5 + 0.08;
  const bendMax = 0.25 + 0.35 + windMax * 0.25;
  const wdirMax = Math.hypot(0.8, 0.6) * (0.18 + 0.32 * windMax);
  const pushMax = (1 + 0.55 + 0.22) * 0.85;
  const heightMax = 0.28 * 1.3 * 1.55 * 1.2 * 1.25;
  const widthMax = 0.026 * (1 + 0.3 * (0.6 / 0.07 - 1));
  return (bendMax + wdirMax + pushMax) * heightMax + widthMax;
}

export function grassTanHalfH(aspect) {
  return Math.tan((GRASS_VFOV_DEG * Math.PI / 180) / 2) * aspect;
}

// True when every point within GRASS_REACH_M of the root is outside the horizontal wedge
// or behind the camera. fwd and right are unit xz vectors. right = (-fwd.y, fwd.x).
export function grassWedgeM() {
  return GRASS_REACH_M + GRASS_WEDGE_PAD_M;
}

export function grassRootOffscreen(rootX, rootZ, camX, camZ, fwdX, fwdZ, tanHalfH, reach = grassWedgeM()) {
  const dx = rootX - camX;
  const dz = rootZ - camZ;
  const depth = dx * fwdX + dz * fwdZ;
  const side = Math.abs(dx * -fwdZ + dz * fwdX);
  return depth < -reach || side > Math.max(depth, 0) * tanHalfH + reach;
}

export function grassOffscreen(wgsl, tanHalfH) {
  const needle = 'let root = (cell + vec2f(r1, r2)) * s;';
  if (!wgsl.includes(needle)) throw new Error('grass root line missing');
  const tan = Number(tanHalfH).toFixed(8);
  const reach = grassWedgeM().toFixed(2);
  const fn = `fn grassHidden(root: vec2f, fwd: vec2f) -> bool {
  let rel = root - u.cam.xz; let depth = dot(rel, fwd); let side = abs(dot(rel, vec2f(-fwd.y, fwd.x)));
  return depth < -${reach} || side > max(depth, 0.0) * ${tan} + ${reach};
}
fn grassBlank() -> VO { var o: VO; o.p = vec4f(0.0, 0.0, -2.0, 1.0); o.col = vec3f(0.0); o.h = 0.0; o.w = vec3f(0.0); o.n = vec3f(0.0, 1.0, 0.0); return o; }
`;
  const vs = wgsl.indexOf('@vertex fn vs(');
  if (vs < 0) throw new Error('grass vertex missing');
  return wgsl.slice(0, vs) + fn + wgsl.slice(vs).replace(
    needle,
    `${needle}\n  if (grassHidden(root, fwd)) { return grassBlank(); }`,
  );
}

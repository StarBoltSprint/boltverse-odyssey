export interface Cam {
  x: number;
  y: number;
  zoom: number;
}

export function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function screenToWorld(
  cam: Cam,
  sx: number,
  sy: number,
  vw: number,
  vh: number,
) {
  return {
    x: cam.x + (sx - vw / 2) / cam.zoom,
    y: cam.y + (sy - vh / 2) / cam.zoom,
  };
}

export function zoomAt(
  cam: Cam,
  sx: number,
  sy: number,
  factor: number,
  vw: number,
  vh: number,
  minZ: number,
  maxZ: number,
): Cam {
  const before = screenToWorld(cam, sx, sy, vw, vh);
  const zoom = clamp(cam.zoom * factor, minZ, maxZ);
  const next: Cam = { x: cam.x, y: cam.y, zoom };
  const after = screenToWorld(next, sx, sy, vw, vh);
  next.x += before.x - after.x;
  next.y += before.y - after.y;
  return next;
}

export function clampCam(cam: Cam, limit: number): Cam {
  const slack = VIDEO_SLACK / Math.max(cam.zoom, 0.08);
  const L = limit + slack;
  return {
    x: clamp(cam.x, -L, L),
    y: clamp(cam.y, -L, L),
    zoom: cam.zoom,
  };
}

const VIDEO_SLACK = 80;

export const PERSP = 2800;
export const PITCH_MAX = 0.46;

export function rotateYawPitch(
  x: number,
  y: number,
  z: number,
  yaw: number,
  pitch: number,
) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  return { x: x1, y: y * cp - z1 * sp, z: y * sp + z1 * cp };
}

export function projectPersp(x: number, y: number, z: number) {
  const s = PERSP / (PERSP + z);
  return { x: x * s, y: y * s, z, s };
}

export function worldTransform(cam: Cam, vw: number, vh: number) {
  return `translate(${vw / 2}px, ${vh / 2}px) scale(${cam.zoom}) translate(${-cam.x}px, ${-cam.y}px)`;
}

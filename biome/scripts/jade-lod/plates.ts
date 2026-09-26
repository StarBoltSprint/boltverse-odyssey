/**
 * Ground and sky films. Law 46. Empty of collide-able objects.
 * Picture-time, not wall clock. No png/mp4 bytes in this repo — names only.
 */

export const GROUND_FILE = "jade_ground.mp4";
export const SKY_FILE = "jade_sky.mp4";

/** uv.x = worldX/24 + 0.02*sin(pictureTime); uv.y = worldZ/24. */
export function groundUv(
  worldX: number,
  worldZ: number,
  pictureTime: number,
): { x: number; y: number } {
  return {
    x: worldX / 24 + 0.02 * Math.sin(pictureTime),
    y: worldZ / 24,
  };
}

/** Same clip, UV/1.7, opacity ~0.2, 8 cm lower. Roots and puddles. Still does not place trunks. */
export function groundUvSecond(
  worldX: number,
  worldZ: number,
  pictureTime: number,
): { x: number; y: number; opacity: number; yOffset: number } {
  const uv = groundUv(worldX, worldZ, pictureTime);
  return { x: uv.x / 1.7, y: uv.y / 1.7, opacity: 0.2, yOffset: -0.08 };
}

/** Dome / sphere. Yaw only. No pitch flip. */
export function skyYaw(camYaw: number): number {
  return camYaw;
}

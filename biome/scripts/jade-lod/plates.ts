/**
 * Ground and sky films. Law 48. The room, not the furniture.
 * pictureTime is the sim clock (same family as fade dt). Pause passes a frozen time.
 * Never Date.now. No mp4/jpg bytes in this repo — names only.
 * The valley tint is law 54. It is a shader multiply, not a road in the mp4.
 */

import { pathDist, tintAlbedo } from "./path";
import { SEED } from "./types";

export const PLATE_DIR = "public/decor/jade/plates";
export const TILE = 24;

export const GROUND_FILE = "jade_ground.mp4";
export const GROUND_POSTER = "jade_ground_poster.jpg";
/** Optional. Engine may crawl this still with the same UV when the video is late. */
export const GROUND_STILL = "jade_ground_still.jpg";
export const SKY_FILE = "jade_sky.mp4";
export const SKY_POSTER = "jade_sky_poster.jpg";

export const SKY_R_MIN = 80;
export const SKY_R_MAX = 120;

/**
 * u = worldX / TILE + 0.02 * sin(pictureTime * 0.15)
 * v = worldZ / TILE
 * TILE = 24 m
 */
export function groundUv(
  worldX: number,
  worldZ: number,
  pictureTime: number,
): { u: number; v: number } {
  return {
    u: worldX / TILE + 0.02 * Math.sin(pictureTime * 0.15),
    v: worldZ / TILE,
  };
}

/**
 * Same ground film. TILE * 1.7, opacity 0.18–0.22, y = heightfield - 0.08, depth write off.
 * Does not place trunks.
 */
export function groundUvRoots(
  worldX: number,
  worldZ: number,
  pictureTime: number,
): { u: number; v: number; opacity: number; yOffset: number; depthWrite: false } {
  const tile = TILE * 1.7;
  return {
    u: worldX / tile + 0.02 * Math.sin(pictureTime * 0.15),
    v: worldZ / tile,
    opacity: 0.2,
    yOffset: -0.08,
    depthWrite: false,
  };
}

/**
 * Sphere or hemisphere. Center follows cam xz. y stays locked.
 * rotation.y = camYaw. rotation.x = rotation.z = 0. No pitch.
 */
export function skyPose(
  camX: number,
  camZ: number,
  camYaw: number,
): { x: number; y: number; z: number; rotX: 0; rotY: number; rotZ: 0 } {
  return { x: camX, y: 0, z: camZ, rotX: 0, rotY: camYaw, rotZ: 0 };
}

/** @deprecated use skyPose. Yaw only. */
export function skyYaw(camYaw: number): number {
  return camYaw;
}

/**
 * Shader strip only. Law 54. albedo *= mix(1, 0.72, strip).
 * The mp4 stays a floor. Do not paint this valley into the plate.
 */
export function groundAlbedo(
  worldX: number,
  worldZ: number,
  albedo: number = 1,
  s: number = SEED,
): number {
  return tintAlbedo(albedo, pathDist(worldX, worldZ, s));
}

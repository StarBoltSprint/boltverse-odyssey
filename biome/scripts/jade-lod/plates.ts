/**
 * Plate tableau. Law 48. One biome per cook. Ember and Jade share this kitchen.
 * The room is the mp4 pair, not a canvas stand-in. Names only. No bytes here.
 * pictureTime is the sim clock. Pause passes a frozen time. Never Date.now.
 * The valley tint is law 54. It is a shader multiply, not a road in the mp4.
 */

import { pathDist, tintAlbedo, tintStrip } from "./path";
import { SEED } from "./types";

export type BiomeId = "ember" | "jade";
/** Live room. Lab is the pre-plate cross bench. */
export type PlateMode = "lab" | "tableau";
export const PLATE_MODE: PlateMode = "tableau";
/** Thrown once the tableau is the room. Leaving a canvas plane up is FAIL. */
export const CANVAS_PLANE = false;
/** The tableau already holds the far grove. Live far instances stay off. */
export const PLATE_CARRIES_FAR = true;

export const BIOMES = ["ember", "jade"] as const;
export const TILE = 24;
/** Weak wind. A stronger crawl skates the sheets. */
export const UV_AMP = 0.015;
export const UV_OMEGA = 0.12;
export const LOOP_S = [8, 10] as const;
export const GROUND_PX = 2048;
export const SKY_W = 2048;
export const SKY_H = 1024;

export function plateDir(biome: BiomeId): string {
  return `public/decor/${biome}/plates`;
}

export function plateFiles(biome: BiomeId): {
  ground: string;
  groundPoster: string;
  sky: string;
  skyPoster: string;
} {
  const dir = plateDir(biome);
  return {
    ground: `${dir}/${biome}_ground.mp4`,
    groundPoster: `${dir}/${biome}_ground_poster.jpg`,
    sky: `${dir}/${biome}_sky.mp4`,
    skyPoster: `${dir}/${biome}_sky_poster.jpg`,
  };
}

/** Jade names. Same bytes as plateFiles("jade"). */
export const PLATE_DIR = plateDir("jade");
export const GROUND_FILE = "jade_ground.mp4";
export const GROUND_POSTER = "jade_ground_poster.jpg";
export const SKY_FILE = "jade_sky.mp4";
export const SKY_POSTER = "jade_sky_poster.jpg";

export const SKY_R_MIN = 90;
export const SKY_R_MAX = 120;

/** Copy verbatim onto both prompts of that biome. Sheets use the same phrase. */
export const LIGHT_LOCK = {
  ember:
    "blood-red moon locked upper-center, volcanic dusk, lava key from the cracks, cool ash fill, no second sun, no daylight",
  jade: "late-day gold key upper-left, cool cyan canopy fill, no second sun, no blood moon, no noon",
} as const;

export const PLATE_SUFFIX =
  "loopable, first frame matches last frame, no camera move, no dog, no wolf, no German Shepherd, no creature, no text, no UI";

/** On-path multiply. Jade darkens. Ember glows. Inverse of the hung 0.72, not a new road. */
export const TINT_JADE = 0.72;
export const TINT_EMBER = 1 / TINT_JADE;

/**
 * u = worldX / 24 + 0.015 * sin(pictureTime * 0.12)
 * v = worldZ / 24
 * Grain in the mp4. This crawl is the only engine travel.
 */
export function groundUv(
  worldX: number,
  worldZ: number,
  pictureTime: number,
): { u: number; v: number } {
  return {
    u: worldX / TILE + UV_AMP * Math.sin(pictureTime * UV_OMEGA),
    v: worldZ / TILE,
  };
}

/**
 * Not the tableau. The live ground plane stays y = 0. Do not warp the film with h.
 */
export function groundUvRoots(
  worldX: number,
  worldZ: number,
  pictureTime: number,
): { u: number; v: number; opacity: number; yOffset: number; depthWrite: false } {
  const tile = TILE * 1.7;
  return {
    u: worldX / tile + UV_AMP * Math.sin(pictureTime * UV_OMEGA),
    v: worldZ / tile,
    opacity: 0.2,
    yOffset: 0,
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
 * Shader strip only. Law 54. Jade darkens (0.72). Ember glows (the inverse).
 * The mp4 stays a floor. Ember cracks may glow in the film. They are not a paved road.
 */
export function plateAlbedo(
  biome: BiomeId,
  worldX: number,
  worldZ: number,
  albedo: number = 1,
  s: number = SEED,
): number {
  const end = biome === "ember" ? TINT_EMBER : TINT_JADE;
  const strip = tintStrip(pathDist(worldX, worldZ, s));
  return albedo * (1 + (end - 1) * strip);
}

/** Jade darken. Same as plateAlbedo("jade", ...). */
export function groundAlbedo(
  worldX: number,
  worldZ: number,
  albedo: number = 1,
  s: number = SEED,
): number {
  return tintAlbedo(albedo, pathDist(worldX, worldZ, s));
}

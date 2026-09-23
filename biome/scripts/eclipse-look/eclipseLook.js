/**
 * Laws 40 + 41 — Nebula Lane cycle and the eclipse look.
 * Copy the numbers. Regenerate the plates and the planet clips. Do not treat an mp4 as the law.
 * Yaw is off unless the live plate is eclipse. uLook stays 0 while yaw is on.
 */
export const NEBULA_CYCLE = {
  order: ["nebula", "shore", "disk", "eclipse"],
  holdSec: 30,
  fadeSec: 3.2,
  preloadSec: 3,
  howlFireSec: 0.28,
  trimHead: { shore: 1, eclipse: 2 },
};

export const ECLIPSE_LOOK = {
  onlyBiome: "eclipse",
  tanY: 0.42,
  maxYaw: 0.62,
  dragPx: 16,
  dragDenom: 0.42,
  easeIn: 14,
  easeOut: 3.2,
  roadZ: -1,
  planet: {
    ang: 0.66,
    dist: 1.2,
    heightK: 0.82,
    iceSide: 1,
    giantSide: 2,
  },
  yawEpsilon: 0.0008,
  icePrompt:
    "A single ice planet, centered, filling most of the square. Pale blue-white surface, a thin copper crescent along the right limb, faint cold atmosphere. Pure black background, no stars, no nebula, no text. It slowly rotates. Camera locked.",
  giantPrompt:
    "A single gas giant, centered, filling most of the square. Thin copper ring, copper rim light on the right, cold blue glint on the left, dark amber bands. Pure black background, no stars, no text. It slowly rotates. Camera locked.",
};

/** Inverse of the world yaw used on the road plane. Sky rays use this so stars stay put. */
export const SKY_RAY = `
vec3 ray = normalize(vec3(vNdc.x * uTanX, vNdc.y * uTanY, -1.0));
float c = cos(uYaw);
float s = sin(uYaw);
vec3 w = vec3(c * ray.x - s * ray.z, ray.y, s * ray.x + c * ray.z);
`;

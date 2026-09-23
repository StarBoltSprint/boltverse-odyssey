/**
 * Law 39 — Imagine live light.
 * The prop is an Imagine video filmed in the plate's colors.
 * The GPU keys black and returns the video color. It does not regrade.
 * Copy the thresholds. Regenerate the clip per biome. Do not reuse a nebula crystal on frost.
 */
export const IMAGINE_LIVE = {
  cleanLuma0: 0.04,
  cleanLuma1: 0.18,
  howlLuma0: 0.035,
  howlLuma1: 0.16,
  crystal: {
    aspect: "2:3",
    res: "720p",
    seconds: 6,
    baseUv: 0.92,
    spawnZ0: 0.32,
    spawnZJitter: 0.1,
    drift: 0.055,
    despawnZ: 0.05,
    maxAlive: 2,
    gapMin: 2.4,
    gapJitter: 1.8,
    height0: 0.09,
    heightT: 0.12,
    shatterSec: 0.32,
    tapPad: 36,
    prompt:
      "A single tall faceted crystal, like a precious quartz shard, isolated on a pure solid black background. The crystal stands upright in the center, its base touching the bottom edge of the frame, the whole stone visible with space above the tip. Facets are sharp and photographic. Light inside the stone shifts between magenta, teal, and gold, matching a nebula. The crystal slowly turns in place, facets catching light, no camera move, no cut, no ground plane, no text, no other objects. Cinematic, high detail, seamless slow spin.",
  },
  howlRing: {
    aspect: "1:1",
    res: "720p",
    seconds: 6,
    prompt:
      "A single luminous shockwave ring, centered, isolated on a pure solid black background. One ring only, not touching the edges, with plenty of black around it. The ring is a thin torus of nebula light: magenta and violet gas, a teal inner edge, and gold sparks traveling around the circle. It slowly pulses and breathes, light sliding through the ring the way light moves inside a crystal. No fire, no flame, no second ring, no ground, no camera move, no text, no other objects.",
  },
};

export const CLEAN_FS = `
float luma = dot(p.rgb, vec3(0.299, 0.587, 0.114));
float live = smoothstep(${0.04}, ${0.18}, luma);
gl_FragColor = vec4(p.rgb * live * uGain, live * uGain);
`;

export function crystalHeight(canvasH, t, shatter) {
  const pop = shatter > 0 ? 1 + shatter * 1.6 : 1;
  const u = Math.min(1, Math.max(0, t));
  return canvasH * (0.09 + 0.12 * u) * pop;
}

export function spawnCrystalZ(rand) {
  return 0.32 + rand * 0.1;
}

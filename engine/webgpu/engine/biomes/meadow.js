// engine/biomes/meadow.js — the meadow's per-biome config for the reusable engine modules
export const MEADOW = {
  river: { pts: [[60, -44], [20, -38], [0, -42], [-20, -37], [-29, -47], [-55, -62], [-80, -70], [-110, -78], [-150, -80]],
    fords: [[-40.2, -53.5], [-3.6, -40.5]], fordR: 4.5,
    halfW: 2.6, wVar: 0.6, depth: 0.9, bank: 3.0, drop: 0.24, flow: 1.1, shoreRocks: 0.55,
    shallow: [0.36, 0.42, 0.32], deep: [0.05, 0.13, 0.14], absorb: [2.4, 1.0, 0.75], foam: [0.92, 0.95, 0.93] },
  mill: { s: 119, side: 1, R: 1.7, dip: 0.42, stone: [0.34, 0.31, 0.26], stone2: [0.18, 0.16, 0.14], roof: [0.12, 0.15, 0.16], wood: [0.32, 0.23, 0.12], crystal: [0.12, 0.35, 0.45] },
  path: { x0: 6, a1: 9, f1: 0.021, a2: 4, f2: 0.053, p2: 1.3 },
  shadows: { floor: 0.30 },
  footprints: { life: 10 },
  trees: { sway: 0.045 },
  wind: { gust: 1.3, detail: 0.6, flutter: 0.12, scale: 0.11 },
  particles: {},
  gi: { bounce: 1.0, sky_k: 0.9 },
  atmo: { alt: 0, blend: 0.35, exposure: 14 },
  post: { rays: 0.15, sat: 1.08, contrast: 1.05 },
};

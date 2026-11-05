// per-biome perf settings for the perf-* bricks. Add a key per biome; nothing here is meadow-specific code.
export const PERF = {
  meadow: { trees: { nearR: 150, farR: 225, farKeep: 0.65 }, shadow: { cascades: 2, farEvery: 2, moveTol: 0.5 } },
  pawGalaxy: { trees: { nearR: 150, farR: 225, farKeep: 0.65 }, shadow: { cascades: 2, farEvery: 2, moveTol: 0.5 } },
};

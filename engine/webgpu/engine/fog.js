// engine/fog.js — per-biome aerial. Meadow capture stays clear: identity mix, no fog wall.
// Other biomes may pass { haze } later. The expressions are spliced into the page shaders.
export function makeFog(cfg = {}) {
  const haze = Number(cfg.haze) || 0;
  return {
    hazeConst: `const HAZE = vec3f(0.55, 0.68, 0.82);\n`,
    fogMix: `fn fogMix(c: vec3f, dist: f32) -> vec3f { return mix(c, HAZE, ${haze.toFixed(3)} * smoothstep(40.0, 280.0, dist)); }`,
    skyHaze: ``,
    dofExpr: (z) => `smoothstep(90.0, 320.0, ${z}) * 0.35`,
    boltHazeExpr: (col) => col,
    treeWashExpr: (col) => col,
  };
}

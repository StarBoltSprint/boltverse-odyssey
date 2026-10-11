// Scores only. The layers stay the eight Imagine ground tiles. Height picks crests,
// slopes and the sunk lane; the macro splat already in the shader stays.

const HOOK = "sc[7] = sB.w;";
const EXTRA = `
  sc[7] = sB.w;
  {
    float hh = vW.y;
    float steep = smoothstep(0.10, 0.40, 1.0 - nGeo.y);
    float crest = smoothstep(uHLo + (uHHi - uHLo) * 0.55, uHHi, hh);
    float trough = 1.0 - smoothstep(uHLo, uHLo + (uHHi - uHLo) * 0.38, hh);
    sc[2] += trough * (1.0 - steep) * 0.9;
    sc[5] += trough * (1.0 - steep) * 0.55;
    sc[6] += trough * 0.65;
    sc[4] += crest * (1.0 - steep) * 0.95;
    sc[0] += (1.0 - crest) * (1.0 - trough) * 0.15;
    sc[7] += steep * 0.75;
    sc[3] += steep * trough * 0.35;
  }`;

export function patchHeightSplat(material, hLo, hHi) {
  let src = material.fragmentShader;
  if (!src.includes(HOOK)) throw new Error("ground splat hook missing");
  if (!src.includes("uniform float uHLo")) {
    src = src.replace(
      "uniform vec4 uGroundWA, uGroundWB, uGroundRotA, uGroundRotB;",
      "uniform vec4 uGroundWA, uGroundWB, uGroundRotA, uGroundRotB;\nuniform float uHLo; uniform float uHHi;",
    );
  }
  src = src.replace(HOOK, EXTRA);
  material.fragmentShader = src;
  material.uniforms.uHLo = { value: hLo };
  material.uniforms.uHHi = { value: hHi };
  material.needsUpdate = true;
}

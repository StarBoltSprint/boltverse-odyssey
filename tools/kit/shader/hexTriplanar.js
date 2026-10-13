// Hex (simplex-grid) tiling + triplanar projection for three.js MeshStandardMaterial.
// Same math as tools/materials/materials.py hex_bake(): 3 hashed, offset (and for snow rotated) samples
// blended with sharpened weights and a variance-preserving mix, so a 1024 tile does not repeat visibly.
// Usage:
//   import { applyHexTriplanar } from './hexTriplanar.js';
//   applyHexTriplanar(mat, { tileM: 2.0, rotate: false, keyGain: [1,1,1] });   // mat.map / normalMap set
// px/m on screen = tile_px / tileM. Measure it live with probePxPerM(), never offline.
export function applyHexTriplanar(material, { tileM = 2.0, rotate = false, keyGain = [1, 1, 1], sharp = 3.0 } = {}) {
  material.userData.hex = { tileM, rotate, keyGain, sharp };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTileM = { value: tileM };
    shader.uniforms.uRot = { value: rotate ? 1 : 0 };
    shader.uniforms.uGain = { value: keyGain };
    shader.uniforms.uSharp = { value: sharp };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed,1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWP; varying vec3 vWN;
uniform float uTileM; uniform int uRot; uniform vec3 uGain; uniform float uSharp;
vec2 h2(vec2 c){ float h = fract(sin(dot(c, vec2(127.1,311.7))) * 43758.5453); return vec2(fract(h*0.6180339*7.0), fract(h*0.4142135*13.0)); }
vec4 hexSample(sampler2D t, vec2 uv){
  vec2 U = uv * 2.0; float sk = (U.x + U.y) * 0.3660254; vec2 i0 = floor(U + sk);
  float un = (i0.x + i0.y) * 0.2113249; vec2 x0 = U - (i0 - un);
  vec2 o1 = x0.x > x0.y ? vec2(1.0,0.0) : vec2(0.0,1.0);
  vec2 cs[3]; cs[0] = i0; cs[1] = i0 + o1; cs[2] = i0 + vec2(1.0);
  vec4 acc = vec4(0.0); float ws = 0.0; float w2 = 0.0; vec4 mean = textureLod(t, vec2(0.5), 10.0);
  for (int k = 0; k < 3; k++) {
    vec2 c = cs[k]; vec2 g = c - (c.x + c.y) * 0.2113249; vec2 d = x0 - (g - (i0 - un));
    float w = pow(max(0.5 - dot(d,d), 0.0), 2.0 * uSharp);
    vec2 o = h2(c); vec2 q = uv;
    if (uRot == 1) { float a = floor(o.x * 4.0) * 1.5707963; q = mat2(cos(a), sin(a), -sin(a), cos(a)) * q; }
    acc += w * (texture(t, q + o) - mean); ws += w; w2 += w * w;
  }
  return acc / max(sqrt(w2), 1e-5) + mean;  // == normalise by sum, divide by sqrt(sum w^2)
}
vec4 triHex(sampler2D t){
  vec3 w = pow(abs(normalize(vWN)), vec3(4.0)); w /= (w.x + w.y + w.z);
  vec3 p = vWP / uTileM;
  return hexSample(t, p.zy) * w.x + hexSample(t, p.xy * vec2(1.0,-1.0)) * w.z + hexSample(t, p.xz) * w.y;
}`)
      .replace('#include <map_fragment>', `#ifdef USE_MAP
  vec4 sampledDiffuseColor = triHex(map); sampledDiffuseColor.rgb *= uGain; diffuseColor *= sampledDiffuseColor;
#endif`);
  };
  material.customProgramCacheKey = () => `hexTri:${tileM}:${rotate}`;
  return material;
}

// Live texel density: world metres per screen pixel at the centre ray hit, times tile px / tile m.
// Returns screen px per world metre and texture px per metre; PASS needs tex px/m >= 500 and
// screen px/m <= tex px/m (no magnification) at the 3 m spine camera.
export function probePxPerM(renderer, camera, hitDistanceM, tilePx, tileM) {
  const h = renderer.domElement.height;
  const worldH = 2 * hitDistanceM * Math.tan((camera.fov * Math.PI / 180) / 2);
  return { screenPxPerM: h / worldH, texPxPerM: tilePx / tileM, magnified: h / worldH > tilePx / tileM };
}

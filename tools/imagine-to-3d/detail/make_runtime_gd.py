"""runtime/biome-runtime.js -> runtime/biome-runtime-gd.js (staging): adds the close-range ground detail layer."""
import re, sys
src = "/workspace/zb-preview-1008/runtime/biome-runtime.js"; dst = "/workspace/zb-preview-1008/runtime/biome-runtime-gd.js"
s = open(src).read()

# 1) uniforms from biome.ground.detail
old = "    uGroundShadow: pom.shadow ?? 0.45,\n  };\n}"
assert old in s
new = """    uGroundShadow: pom.shadow ?? 0.45,
    ...groundDetailUniforms(g.detail),
  };
}
/** Close-range detail layer (2026-10-10 staging). d = biome.ground.detail (gdet/ground-detail.json). */
export function groundDetailUniforms(d) {
  const on = !!(d && d.enabled !== false);
  d = d || {};
  const a8 = (v, def) => { const o = (v || []).slice(0, 8); while (o.length < 8) o.push(def); return o; };
  const hs = a8(d.hardSlice, -1), hst = a8(d.hardStr, 0), hf = a8(d.hardFloor, 0);
  const sl = d.sliceLum || [1, 0.55, 0.8], sn = d.sliceNrm || [1, 0.8, 0.9], sr = (d.sliceRotDeg || [12, 180, 180]).map((x) => (x * Math.PI) / 180);
  return {
    uGDetOn: on ? 1 : 0, uGDetTileM: d.tileM ?? 1.8125, uGDetNear: d.nearM ?? 15, uGDetFar: d.farM ?? 30,
    uGDetLum: sl.slice(0, 3), uGDetNrmS: sn.slice(0, 3), uGDetRot: sr.slice(0, 3),
    uGDetSliceA: hs.slice(0, 4), uGDetSliceB: hs.slice(4, 8), uGDetStrA: hst.slice(0, 4), uGDetStrB: hst.slice(4, 8),
    uGDetFloorA: hf.slice(0, 4), uGDetFloorB: hf.slice(4, 8),
    uGDetMask: (d.sandMask || [0.55, 0.85]).slice(0, 2), uGDetMacro: d.macroVar ?? 0.5, uGDetDbg: 0,
  };
}"""
s = s.replace(old, new)

# 2) GLSL: declarations + hex tiling
old = "struct GroundSample { vec3 c; vec3 n; };"
assert old in s
new = """struct GroundSample { vec3 c; vec3 n; };
// ---- close-range detail (staging 2026-10-10): packed slices R = Imagine luma ratio / 2, GB = DA-V2 normal xy
uniform mediump sampler2DArray uGDet;
uniform float uGDetOn, uGDetTileM, uGDetNear, uGDetFar, uGDetMacro, uGDetDbg;
uniform vec3 uGDetLum, uGDetNrmS, uGDetRot;
uniform vec2 uGDetMask;
uniform vec4 uGDetSliceA, uGDetSliceB, uGDetStrA, uGDetStrB, uGDetFloorA, uGDetFloorB;"""
s = s.replace(old, new)

old = "vec3 biomeGroundV(vec2 wxz, vec3 nGeo, vec3 toEye, float dist) {"
assert old in s
new = """// Hex tiling (Mikkelsen 2022, 3 taps): each hex vertex gets a hashed offset + rotation (|a| <= rotMax), the
// 3 taps are blended with sharpened barycentrics x the tap's own luma (higher grain wins) -> no grid, no blur.
// textureGrad with the rotated gradients: no mip seam. Returns (luma ratio, normal xy in the unrotated frame).
vec3 gdTap(float S, vec2 st, vec2 v, vec2 gx, vec2 gy, float rotMax, out float lum) {
  vec4 h = gHash4(v * vec2(1.731, 9.137) + S * 17.31 + 3.7);
  float a = (h.x * 2.0 - 1.0) * rotMax;
  vec2 cen = vec2(v.x, (v.y + 0.57735027 * v.x) / 1.15470054) / 3.4641016;   // vertex in st space
  vec2 u = gRot(st - cen, a) + cen + h.yz * 7.0;
  vec3 r = textureGrad(uGDet, vec3(u, S), gRot(gx, a), gRot(gy, a)).rgb;
  lum = r.x;
  vec2 n = gRot(r.yz * 2.0 - 1.0, -a);
  return vec3(r.x * 2.0, n);
}
vec3 gdHex(float S, vec2 st, vec2 gx, vec2 gy, float rotMax) {
  vec2 s = st * 3.4641016;
  vec2 sk = vec2(s.x, -0.57735027 * s.x + 1.15470054 * s.y);
  vec2 base = floor(sk);
  vec3 t = vec3(fract(sk), 0.0); t.z = 1.0 - t.x - t.y;
  float sg = step(0.0, -t.z), s2 = 2.0 * sg - 1.0;
  vec3 w = vec3(-t.z * s2, sg - t.y * s2, sg - t.x * s2);
  float l1, l2, l3;
  vec3 a1 = gdTap(S, st, base + vec2(sg, sg), gx, gy, rotMax, l1);
  vec3 a2 = gdTap(S, st, base + vec2(sg, 1.0 - sg), gx, gy, rotMax, l2);
  vec3 a3 = gdTap(S, st, base + vec2(1.0 - sg, sg), gx, gy, rotMax, l3);
  vec3 W = mix(vec3(1.0), vec3(l1, l2, l3) * 2.0, 0.6) * pow(w, vec3(7.0));
  W /= max(W.x + W.y + W.z, 1e-5);
  return a1 * W.x + a2 * W.y + a3 * W.z;
}
float gd8(vec4 A, vec4 B, int i) { return i < 4 ? A[i] : B[i - 4]; }
vec3 biomeGroundV(vec2 wxz, vec3 nGeo, vec3 toEye, float dist) {
  vec2 wxz0 = wxz;"""
s = s.replace(old, new)

# 3) apply before macro
old = "  // macro variation from the base plate itself (Imagine pixels at macroScale, blurred mip): breaks the 8 m rhythm\n"
assert old in s
new = """  // close-range Imagine detail (512 px/m): full under uGDetNear, smooth fade to 0 at uGDetFar. Surface only, never shape.
  float gdFade = uGDetOn * (1.0 - smoothstep(uGDetNear, uGDetFar, dist));
  if (gdFade > 0.002) {
    vec3 m0d = textureLod(uGroundTex, vec3(0.5, 0.5, 0.0), 16.0).rgb;
    float sandM = smoothstep(uGDetMask.x, uGDetMask.y, gLum(col) / max(gLum(m0d), 1e-3));
    float w2d = 0.0;
    if (d < uGroundEdge * 1.5) w2d = 0.5 * (1.0 - smoothstep(0.0, uGroundEdge, d));
    float hs1 = gd8(uGDetSliceA, uGDetSliceB, i1), hs2 = gd8(uGDetSliceA, uGDetSliceB, i2);
    float st1 = gd8(uGDetStrA, uGDetStrB, i1), st2 = gd8(uGDetStrA, uGDetStrB, i2);
    float fl = mix(gd8(uGDetFloorA, uGDetFloorB, i1), gd8(uGDetFloorA, uGDetFloorB, i2), w2d);
    float hardW = max(1.0 - sandM, fl);
    vec2 dst = wxz / uGDetTileM;                                   // POM-shifted position, continuous gradients:
    float k = uGroundTileM / uGDetTileM; vec2 dgx = gx * k, dgy = gy * k;
    float mv = 1.0 + uGDetMacro * (gNoise1(wxz0 * 0.11 + 5.1) * 2.0 - 1.0);   // ~9 m strength variation
    vec3 acc = vec3(0.0);
    float wS = 1.0 - hardW;
    if (wS > 0.01) { vec3 q = gdHex(0.0, dst, dgx, dgy, uGDetRot.x); acc += wS * vec3((q.x - 1.0) * uGDetLum.x, q.yz * uGDetNrmS.x); }
    float wh1 = hardW * st1 * (hs2 == hs1 ? 1.0 : 1.0 - w2d), wh2 = hs2 == hs1 ? 0.0 : hardW * st2 * w2d;
    if (hs1 > -0.5 && wh1 > 0.01) {
      vec3 q = gdHex(hs1, dst + vec2(0.37, 0.71), dgx, dgy, hs1 < 1.5 ? uGDetRot.y : uGDetRot.z);
      vec2 ls = hs1 < 1.5 ? vec2(uGDetLum.y, uGDetNrmS.y) : vec2(uGDetLum.z, uGDetNrmS.z);
      acc += wh1 * vec3((q.x - 1.0) * ls.x, q.yz * ls.y);
    }
    if (hs2 > -0.5 && wh2 > 0.01) {
      vec3 q = gdHex(hs2, dst + vec2(0.37, 0.71), dgx, dgy, hs2 < 1.5 ? uGDetRot.y : uGDetRot.z);
      vec2 ls = hs2 < 1.5 ? vec2(uGDetLum.y, uGDetNrmS.y) : vec2(uGDetLum.z, uGDetNrmS.z);
      acc += wh2 * vec3((q.x - 1.0) * ls.x, q.yz * ls.y);
    }
    acc *= gdFade * mv;
    col *= max(1.0 + acc.x, 0.0);
    nt = normalize(vec3(nt.xy + acc.yz, max(nt.z, 0.05)));
  }
  // macro variation from the base plate itself (Imagine pixels at macroScale, blurred mip): breaks the 8 m rhythm
"""
s = s.replace(old, new)

# 4) debug output: fade map
old = "c = biomeGroundV(vW.xz, nG, toEye, dist); c = biomeFog(c, dist, vW.y); outColor = vec4(c, 1.0); }"
assert old in s
new = ("c = biomeGroundV(vW.xz, nG, toEye, dist); c = biomeFog(c, dist, vW.y); "
       "if (uGDetDbg > 0.5) { float f = uGDetOn * (1.0 - smoothstep(uGDetNear, uGDetFar, dist)); c = vec3(f, 0.0, 1.0 - f) * 0.5; } "
       "outColor = vec4(c, 1.0); }")
s = s.replace(old, new)

# 5) material binds the detail texture
old = "export function createGroundMaterial(THREE, biome, layers, normals = null) {\n  const pack = { ...groundUniforms(biome), ...fogUniforms(biome) };\n  if (!normals) pack.uGroundRelief = 0;\n  const uniforms = { uGroundTex: { value: layers }, uGroundNrm: { value: normals || layers } };"
assert old in s
new = "export function createGroundMaterial(THREE, biome, layers, normals = null, detail = null) {\n  const pack = { ...groundUniforms(biome), ...fogUniforms(biome) };\n  if (!normals) pack.uGroundRelief = 0;\n  if (!detail) pack.uGDetOn = 0;\n  const uniforms = { uGroundTex: { value: layers }, uGroundNrm: { value: normals || layers }, uGDet: { value: detail || layers } };"
s = s.replace(old, new)
# toU: vec2 support
s = s.replace("const toU = (v) => (Array.isArray(v) ? (v.length === 4 ? new THREE.Vector4(...v) : new THREE.Vector3(...v)) : v);",
              "const toU = (v) => (Array.isArray(v) ? (v.length === 4 ? new THREE.Vector4(...v) : v.length === 2 ? new THREE.Vector2(...v) : new THREE.Vector3(...v)) : v);")
open(dst, "w").write(s); print("wrote", dst)

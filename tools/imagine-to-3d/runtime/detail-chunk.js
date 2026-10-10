// imagine-to-3d hybrid texturing, layer 2: tiling Imagine DETAIL on top of the unique native macro plates (layer 1).
// Same math as the shipped ground detail (detail/make_runtime_gd.py gdHex: Mikkelsen 3-tap hex tiling, hashed
// offset + rotation per hex vertex, luma-weighted sharpened barycentrics, textureGrad with rotated gradients), made
// standalone for any object shader. Slices are baked by detail/bake_detail.py from EXISTING seamless Imagine crops:
// R = Imagine luma ratio / 2 (mean 0.5), GB = Depth Anything V2 tangent normal xy. 928 px over 1.8125 m = 512 px/m.
// Surface only (never moves a vertex). Full strength under uI3dDetNear (15 m), smooth fade to 0 at uI3dDetFar (30 m),
// so the silhouette and the far image never change (approach-morph safe). Dominant-axis world projection: 3 taps.
// Usage (three.js ShaderMaterial / onBeforeCompile):
//   import { DETAIL_GLSL, detailUniforms } from "./detail-chunk.js";
//   fragment: DETAIL_GLSL + "...  vec3 dn = i3dDetail(vWorldPos, normalize(vWorldNormal), dist, slice);  col *= dn.x; n = perturb(n, dn.yz);"
export const DETAIL_GLSL = /* glsl */ `
uniform mediump sampler2DArray uI3dDet;
uniform float uI3dDetOn, uI3dDetTileM, uI3dDetNear, uI3dDetFar, uI3dDetLum, uI3dDetNrm, uI3dDetRot;
vec4 i3dHash4(vec2 p) {
  vec4 p4 = fract(vec4(p.xyxy) * vec4(0.1031, 0.1030, 0.0973, 0.1099) + 0.0804);
  p4 += dot(p4, p4.wzxy + 33.33);
  return fract((p4.xxyz + p4.yzzw) * p4.zywx);
}
vec2 i3dRot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
vec3 i3dTap(float S, vec2 st, vec2 v, vec2 gx, vec2 gy, out float lum) {
  vec4 h = i3dHash4(v * vec2(1.731, 9.137) + S * 17.31 + 3.7);
  float a = (h.x * 2.0 - 1.0) * uI3dDetRot;
  vec2 cen = vec2(v.x, (v.y + 0.57735027 * v.x) / 1.15470054) / 3.4641016;
  vec2 u = i3dRot(st - cen, a) + cen + h.yz * 7.0;
  vec3 r = textureGrad(uI3dDet, vec3(u, S), i3dRot(gx, a), i3dRot(gy, a)).rgb;
  lum = r.x;
  return vec3(r.x * 2.0, i3dRot(r.yz * 2.0 - 1.0, -a));
}
vec3 i3dHex(float S, vec2 st) {
  vec2 gx = dFdx(st), gy = dFdy(st);
  vec2 s = st * 3.4641016;
  vec2 sk = vec2(s.x, -0.57735027 * s.x + 1.15470054 * s.y);
  vec2 base = floor(sk);
  vec3 t = vec3(fract(sk), 0.0); t.z = 1.0 - t.x - t.y;
  float sg = step(0.0, -t.z), s2 = 2.0 * sg - 1.0;
  vec3 w = vec3(-t.z * s2, sg - t.y * s2, sg - t.x * s2);
  float l1, l2, l3;
  vec3 a1 = i3dTap(S, st, base + vec2(sg, sg), gx, gy, l1);
  vec3 a2 = i3dTap(S, st, base + vec2(sg, 1.0 - sg), gx, gy, l2);
  vec3 a3 = i3dTap(S, st, base + vec2(1.0 - sg, sg), gx, gy, l3);
  vec3 W = mix(vec3(1.0), vec3(l1, l2, l3) * 2.0, 0.6) * pow(w, vec3(7.0));
  W /= max(W.x + W.y + W.z, 1e-5);
  return a1 * W.x + a2 * W.y + a3 * W.z;
}
// returns (albedo multiplier, tangent normal offset xy); (1, 0, 0) beyond uI3dDetFar (no fetch at all there)
vec3 i3dDetail(vec3 wp, vec3 wn, float dist, float slice) {
  float f = uI3dDetOn * (1.0 - smoothstep(uI3dDetNear, uI3dDetFar, dist));
  if (f < 0.002) return vec3(1.0, 0.0, 0.0);
  vec3 an = abs(wn);
  vec2 st = (an.y > max(an.x, an.z) ? wp.xz : (an.x > an.z ? wp.zy : wp.xy)) / uI3dDetTileM;
  vec3 q = i3dHex(slice, st);
  return vec3(max(1.0 + (q.x - 1.0) * uI3dDetLum * f, 0.0), q.yz * uI3dDetNrm * f);
}
`;
/** d = detail.json written by auto.py's detail stage (tileM, nearM, farM, lum, nrm, rotDeg). */
export function detailUniforms(d = {}, tex = null) {
  return {
    uI3dDet: { value: tex }, uI3dDetOn: { value: tex && d.enabled !== false ? 1 : 0 }, uI3dDetTileM: { value: d.tileM ?? 1.8125 },
    uI3dDetNear: { value: d.nearM ?? 15 }, uI3dDetFar: { value: d.farM ?? 30 }, uI3dDetLum: { value: d.lum ?? 0.8 },
    uI3dDetNrm: { value: d.nrm ?? 0.9 }, uI3dDetRot: { value: ((d.rotDeg ?? 180) * Math.PI) / 180 },
  };
}

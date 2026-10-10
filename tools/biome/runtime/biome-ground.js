/**
 * biome-ground.js - Zone B ground shader + its uniform packs (split out of biome-runtime.js, which re-exports all of it:
 * import from either file). Splat + bombing + micro-relief + POM + close-range 512 px/m detail. Phone perf rule
 * (docs/METHOD/phone-perf.md): only remove work that never reaches the screen; G_OLDPOM / G_IMPLICIT are A/B and
 * diagnostic defines, never shipped.
 */
import { headingToDir } from "./biome-runtime.js";

// ------------------------------------------------------------------ ground: splat + texture bombing (one pass)
/** Per-material bombing mode (bible ground.materials[i].bomb): "free" any angle, "r90" quarter turns, "r180" half
 *  turns (ripples / slab lattices keep their axis), "none" plain repeat + no offset (rails keep their line). */
export const GROUND_BOMB_MODES = { none: 0, free: 1, r90: 2, r180: 3 };
const DEFAULT_BOMB = ["r180", "free", "r180", "free", "r180", "r180", "none", "free"];

/** Uniform pack for GROUND_GLSL (8 layers max, packed in 2 vec4). Weights come from the bible; a weight <= 0
 *  removes the layer. bombing.grid = variant regions per tile, bombing.offset = max UV shift (tile fraction). */
export function groundUniforms(biome) {
  const g = biome.ground || {}, bo = g.bombing || {}, sp = g.splat || {};
  const mats = (g.materials || []).slice(0, 8);
  const w = [0, 0, 0, 0, 0, 0, 0, 0], r = [0, 0, 0, 0, 0, 0, 0, 0];
  mats.forEach((m, i) => {
    w[i] = Math.max(0, m.weight ?? 1);
    const mode = m.bomb ?? DEFAULT_BOMB[i] ?? "free";
    if (!(mode in GROUND_BOMB_MODES)) throw new Error(`ground material ${m.id}: bomb "${mode}" is not one of ${Object.keys(GROUND_BOMB_MODES)}`);
    r[i] = GROUND_BOMB_MODES[mode];
  });
  const rel = g.relief || {};
  const pom = rel.pom || {};
  const sun = biome.sun || {};
  return {
    uGroundTileM: g.tileMeters ?? 8,
    uGroundCells: bo.grid ?? 3,
    uGroundOffset: bo.offset ?? 0.15,
    uGroundBomb: bo.enabled === false ? 0 : 1,
    uGroundSeed: (sp.seed ?? biome.seed ?? 1) % 997,
    uGroundSplatM: sp.scaleM ?? 60,
    uGroundEdge: sp.edge ?? 0.12,
    uGroundMacro: g.macroScale ?? 0.08,
    uGroundMacroAmt: sp.macroAmount ?? 0.35,
    uGroundWA: w.slice(0, 4), uGroundWB: w.slice(4, 8),
    uGroundRotA: r.slice(0, 4), uGroundRotB: r.slice(4, 8),
    // relief.enabled -> 0 skips every normal fetch. Sun is the bible sun (azimuth 90 = +X).
    uGroundRelief: rel.enabled === false ? 0 : 1,
    uGroundNrmStr: rel.normalStrength ?? 1,
    uGroundSunDir: headingToDir(sun.azimuthDeg ?? 90, sun.elevationDeg ?? 8),
    uGroundSunAmb: rel.sunAmbient ?? 0.55,
    // "xyh": normal map RG = tangent xy, B = plate height 0..1 (z rebuilt). Default "xyz" = the old RGB normal.
    uGroundPacked: rel.normalPacking === "xyh" ? 1 : 0,
    // parallax occlusion + self-shadow, only with packed height. depthM = plate top above sand (world metres).
    uGroundPom: rel.normalPacking === "xyh" && pom.enabled !== false ? 1 : 0,
    uGroundPomDepth: (pom.depthM ?? 0.035) / (g.tileMeters ?? 8),
    uGroundPomFade: pom.fadeM ?? 15,
    uGroundPomSteps: Math.max(2, Math.min(12, pom.steps ?? 10)),
    uGroundShadow: pom.shadow ?? 0.45,
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
    uGOpt: 0,   // perf pass: 1 = layer means from uniforms + hex tap skipping (set by the page)
  };
}

/** `vec3 biomeGround(vec2 worldXZ, vec3 nGeo)` -> linear albedo. Plates carry their light; nGeo is the terrain normal.
 *  Splat: 8 seeded value-noise scores (2 vec4 octaves) scaled by the bible weights, only the TOP 2 layers are
 *  sampled, joined over uGroundEdge with a height (= albedo luminance) bias. Bombing per layer: a cheap 2-sample
 *  stochastic blend (iq "texture variation" form): a value noise at grid/tile frequency picks variant k and k+1
 *  (hashed offset + rotation), blended across the noise bands -> no cell seams, no repeating grid. The blend is
 *  variance-preserving (Heitz-Neyret style, mean from the layer's last mip) so blend zones keep contrast and grain
 *  instead of going soft. textureGrad with the continuous UV gradients rotated per variant: no mip seams.
 *  Micro-relief (uGroundRelief > 0): the matching texel of uGroundNrm (Sobel of the plate, same uv / grad) is
 *  unpacked, its xy rotated by -a when the variant rotated the uv by +a, blended with the same weights as the
 *  colour, then lit RELATIVE to flat ground so a flat normal keeps the baked plate exactly.
 *  Fetches, one pass, no extra draw call. Worst case (bombing on, both splat layers, relief on) = 12:
 *    4 albedo textureGrad (2 variants x 2 layers) + 4 normal textureGrad + 2 layer-mean textureLod
 *    + 1 macro textureGrad + 1 base-mean textureLod.
 *  uGroundRelief == 0 skips the 4 normal fetches (uniform branch) and skips the relight, so the colour matches
 *  the pre-relief shader. Bombing off is fewer (2 albedo + 2 normal + macro + base mean = 6).
 *  biomeGroundV + relief.pom (normalPacking "xyh"), only closer than pom.fadeM (default 15 m): + 2 x (n + 1) height taps
 *  (both variants, n = 5..10 steps by view angle, early exit on hit) + 4 shadow taps -> up to 26 more on the nearest
 *  pixels, 0 beyond fadeM (uniform-ish branch). The page drops POM first when the phone can't hold ~42 fps. */
export const GROUND_GLSL = /* glsl */ `
// bench switch (2026-10-10): G_IMPLICIT = hardware derivatives instead of explicit gradients (Adreno textureGrad cost test)
#ifdef G_IMPLICIT
#define GTG(s, c, dx, dy) texture(s, c)
#else
#define GTG(s, c, dx, dy) textureGrad(s, c, dx, dy)
#endif

uniform mediump sampler2DArray uGroundTex;
uniform mediump sampler2DArray uGroundNrm;   // derived normals, same layout as uGroundTex (flipY false, row 0 = v 0)
// G_HR8 (lossless): POM / height reads come from an R8 copy of the height channel (uGroundNrm.b, same bytes, 1/4 the
// bandwidth of the RGBA8 normal array). Up to 28 height fetches per pixel in the POM loop; colour/normal reads unchanged.
// Build and bind the copy with createHeightArray() / setHeightR8() (ground-fill.mjs).
#ifdef G_HR8
uniform mediump sampler2DArray uGroundH;
#define G_HTEX uGroundH
#define G_HCH r
#else
#define G_HTEX uGroundNrm
#define G_HCH b
#endif
uniform float uGroundTileM, uGroundCells, uGroundOffset, uGroundBomb, uGroundSeed, uGroundSplatM, uGroundEdge;
uniform float uGroundMacro, uGroundMacroAmt, uGroundRelief, uGroundNrmStr, uGroundSunAmb;
uniform float uGroundPacked, uGroundPom, uGroundPomDepth, uGroundPomFade, uGroundPomSteps, uGroundShadow;
uniform vec3 uGroundSunDir;
uniform vec4 uGroundWA, uGroundWB, uGroundRotA, uGroundRotB;
struct GroundSample { vec3 c; vec3 n; };
// ---- close-range detail (staging 2026-10-10): packed slices R = Imagine luma ratio / 2, GB = DA-V2 normal xy
uniform mediump sampler2DArray uGDet;
uniform float uGDetOn, uGDetTileM, uGDetNear, uGDetFar, uGDetMacro, uGDetDbg;
uniform vec3 uGDetLum, uGDetNrmS, uGDetRot;
uniform vec2 uGDetMask;
uniform vec4 uGDetSliceA, uGDetSliceB, uGDetStrA, uGDetStrB, uGDetFloorA, uGDetFloorB;
uniform float uGOpt;
uniform vec3 uGroundMean[8];   // linear mean of each plate (= its 1x1 mip), filled by the page when uGOpt = 1
vec3 gMean(float L) { return uGOpt > 0.5 ? uGroundMean[int(L)] : textureLod(uGroundTex, vec3(0.5, 0.5, L), 16.0).rgb; }
float gHash1(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031 + uGroundSeed * 0.01237);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec4 gHash4(vec2 p) {
  vec4 p4 = fract(vec4(p.xyxy) * vec4(0.1031, 0.1030, 0.0973, 0.1099) + uGroundSeed * 0.00731);
  p4 += dot(p4, p4.wzxy + 33.33);
  return fract((p4.xxyz + p4.yzzw) * p4.zywx);
}
vec4 gNoise4(vec2 x) {
  vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gHash4(i), gHash4(i + vec2(1.0, 0.0)), f.x), mix(gHash4(i + vec2(0.0, 1.0)), gHash4(i + vec2(1.0, 1.0)), f.x), f.y);
}
float gNoise1(vec2 x) {
  vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gHash1(i), gHash1(i + vec2(1.0, 0.0)), f.x), mix(gHash1(i + vec2(0.0, 1.0)), gHash1(i + vec2(1.0, 1.0)), f.x), f.y);
}
float gLum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec2 gRot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
float gAngle(float mode, float h) {
  if (mode < 1.5) return h * 6.2831853;                    // free
  if (mode < 2.5) return floor(h * 4.0) * 1.5707963;       // quarter turns
  return floor(h * 2.0) * 3.1415927;                       // half turns
}
// tangent normal from the derived map. ang is the xy rotation back into the unrotated tile (0, or -a).
vec3 gUnpackN(vec3 raw, float ang) {
  vec3 nt = raw * 2.0 - 1.0;
  if (uGroundPacked > 0.5) nt.z = sqrt(max(1.0 - dot(nt.xy, nt.xy), 1e-4));   // B carries the plate height
  nt.xy = gRot(nt.xy, ang) * uGroundNrmStr;
  return normalize(nt);
}
// variant transform of layer L (hashed rotation a about the tile centre + offset): shared by colour, normal, height
void gVariantXf(float L, float mode, float k, out float a, out vec2 off) {
  vec4 h = gHash4(vec2(k * 7.13 + L * 31.7, L * 3.1 + k * 0.37));
  a = gAngle(mode, h.x);
  off = (h.yz * 2.0 - 1.0) * uGroundOffset;
}
float gHeight(float L, vec2 uvb, float a, vec2 off, vec2 rgx, vec2 rgy) {
  return GTG(G_HTEX, vec3(gRot(uvb - 0.5, a) + 0.5 + off, L), rgx, rgy).G_HCH;
}
// one variant of layer L: hashed offset + rotation about the tile centre. Normal fetch only when relief is on.
GroundSample gVariant(float L, float mode, float k, vec2 uv, vec2 gx, vec2 gy) {
  float a; vec2 off;
  gVariantXf(L, mode, k, a, off);
  vec2 u = gRot(uv - 0.5, a) + 0.5 + off;
  vec2 rgx = gRot(gx, a), rgy = gRot(gy, a);
  vec3 c = GTG(uGroundTex, vec3(u, L), rgx, rgy).rgb;
  vec3 nrm = vec3(0.0, 0.0, 1.0);
  if (uGroundRelief > 0.0) nrm = gUnpackN(GTG(uGroundNrm, vec3(u, L), rgx, rgy).rgb, -a);
  return GroundSample(c, nrm);
}
GroundSample gLayer(float L, float mode, vec2 uv, vec2 gx, vec2 gy, vec2 wxz) {
  if (uGroundBomb < 0.5 || mode < 0.5) {
    vec3 c = GTG(uGroundTex, vec3(uv, L), gx, gy).rgb;
    vec3 nrm = vec3(0.0, 0.0, 1.0);
    if (uGroundRelief > 0.0) nrm = gUnpackN(GTG(uGroundNrm, vec3(uv, L), gx, gy).rgb, 0.0);
    return GroundSample(c, nrm);
  }
  float nse = gNoise1(wxz * (uGroundCells / uGroundTileM) + L * 13.7) * 8.0;
  float k = floor(nse), f = fract(nse);
  GroundSample s1 = gVariant(L, mode, k, uv, gx, gy);
  GroundSample s2 = gVariant(L, mode, k + 1.0, uv, gx, gy);
  vec3 m = gMean(L);     // layer mean (last mip, 1 texel; uniform in opt mode)
  float b = smoothstep(0.25, 0.75, f + (gLum(s2.c) - gLum(s1.c)) * 0.6); // height-biased: the higher grain wins
  vec3 c = m + ((s1.c - m) * (1.0 - b) + (s2.c - m) * b) * inversesqrt((1.0 - b) * (1.0 - b) + b * b);
  vec3 nrm = vec3(0.0, 0.0, 1.0);
  if (uGroundRelief > 0.0) nrm = normalize(s1.n * (1.0 - b) + s2.n * b);
  return GroundSample(max(c, vec3(0.0)), nrm);
}
// Parallax occlusion on the dominant layer, with BOTH bombing variants blended exactly like its colour (same hashed
// rotation / offset per variant, same noise band), solved in base uv and applied to every sample: the march runs once
// per pixel and plates in the height always match the plates you see. sh = sun-side self-shadow 0..1 (2 taps).
float gHeight2(float L, vec2 uvb, float a1, vec2 o1, float a2, vec2 o2, float b, vec2 gx, vec2 gy) {
  float h1 = gHeight(L, uvb, a1, o1, gRot(gx, a1), gRot(gy, a1));
  if (b < 0.01) return h1;
  float h2 = gHeight(L, uvb, a2, o2, gRot(gx, a2), gRot(gy, a2));
  return mix(h1, h2, b);
}
// step 7 (lossless): the same math with cos/sin and the rotated gradients computed ONCE per pixel instead of at every POM
// step (gRot = cos/sin + the same 2x2 formula). Bit-identical inputs to the same fetches. #define G_OLDPOM = old path (A/B).
vec2 gRotC(vec2 v, vec2 cs) { return vec2(cs.x * v.x - cs.y * v.y, cs.y * v.x + cs.x * v.y); }
float gHeight2C(float L, vec2 uvb, vec2 c1, vec2 o1, vec2 c2, vec2 o2, float b, vec2 g1x, vec2 g1y, vec2 g2x, vec2 g2y) {
  float h1 = GTG(G_HTEX, vec3(gRotC(uvb - 0.5, c1) + 0.5 + o1, L), g1x, g1y).G_HCH;
  if (b < 0.01) return h1;
  float h2 = GTG(G_HTEX, vec3(gRotC(uvb - 0.5, c2) + 0.5 + o2, L), g2x, g2y).G_HCH;
  return mix(h1, h2, b);
}
vec2 gPom(float L, float mode, vec2 uv, vec2 gx, vec2 gy, vec2 wxz, vec3 Vt, vec3 Lt, float fade, out float sh) {
  sh = 0.0;
  float a1 = 0.0, a2 = 0.0, b = 0.0; vec2 o1 = vec2(0.0), o2 = vec2(0.0);
  if (uGroundBomb > 0.5 && mode > 0.5) {
    float nse = gNoise1(wxz * (uGroundCells / uGroundTileM) + L * 13.7) * 8.0;
    float k = floor(nse);
    gVariantXf(L, mode, k, a1, o1);
    gVariantXf(L, mode, k + 1.0, a2, o2);
    b = smoothstep(0.25, 0.75, fract(nse));
    if (b > 0.99) { a1 = a2; o1 = o2; b = 0.0; }
  }
#ifdef G_OLDPOM
#define GH2(P_) gHeight2(L, P_, a1, o1, a2, o2, b, gx, gy)
#else
  vec2 c1 = vec2(cos(a1), sin(a1)), c2 = vec2(cos(a2), sin(a2));
  vec2 g1x = gRotC(gx, c1), g1y = gRotC(gy, c1), g2x = gRotC(gx, c2), g2y = gRotC(gy, c2);
#define GH2(P_) gHeight2C(L, P_, c1, o1, c2, o2, b, g1x, g1y, g2x, g2y)
#endif
  float scale = uGroundPomDepth * fade;
  vec2 P = Vt.xy / max(Vt.z, 0.25) * scale;              // full-depth shift (uv), grazing clamped
  float n = floor(mix(uGroundPomSteps, uGroundPomSteps * 0.5, clamp(Vt.z, 0.0, 1.0)));
  if (uGOpt > 0.5) n = max(3.0, floor(n * (0.5 + 0.5 * fade)));   // opt: fewer steps as the parallax fades out with distance
  float dl = 1.0 / n; vec2 dP = P * dl;
  vec2 cur = uv; float depth = 0.0;
  float hd = 1.0 - GH2(cur);   // depth below the plate tops
  float prevHd = hd; float prevDepth = 0.0;
  for (int i = 0; i < 12; i++) {
    if (float(i) >= n || depth >= hd) break;
    prevHd = hd; prevDepth = depth;
    cur -= dP; depth += dl;
    hd = 1.0 - GH2(cur);
  }
  float after = hd - depth, before = prevHd - prevDepth;
  float w = clamp(after / (after - before + 1e-5), 0.0, 1.0);
  vec2 hit = mix(cur, cur + dP, w);
  float h0 = 1.0 - mix(depth, prevDepth, w);
  if (uGroundShadow > 0.0 && Lt.z > 0.02) {
    vec2 S = Lt.xy / Lt.z * scale;                         // uv run per unit of height toward the sun
    // contact shade, not a full cast shadow: darkest against the plate, fading out over ~the plate's shadow length
    for (int j = 0; j < 2; j++) {
      float t = j == 0 ? 0.3 : 0.8;
      float hj = h0 + (1.0 - h0) * t;
      float hs = GH2(hit + S * (hj - h0));
      sh = max(sh, clamp((hs - hj) * 6.0, 0.0, 1.0) * (1.0 - 0.6 * t));
    }
  }
  return hit - uv;
#undef GH2
}
// Hex tiling (Mikkelsen 2022, 3 taps): each hex vertex gets a hashed offset + rotation (|a| <= rotMax), the
// 3 taps are blended with sharpened barycentrics x the tap's own luma (higher grain wins) -> no grid, no blur.
// textureGrad with the rotated gradients: no mip seam. Returns (luma ratio, normal xy in the unrotated frame).
vec3 gdTap(float S, vec2 st, vec2 v, vec2 gx, vec2 gy, float rotMax, out float lum) {
  vec4 h = gHash4(v * vec2(1.731, 9.137) + S * 17.31 + 3.7);
  float a = (h.x * 2.0 - 1.0) * rotMax;
  vec2 cen = vec2(v.x, (v.y + 0.57735027 * v.x) / 1.15470054) / 3.4641016;   // vertex in st space
  vec2 u = gRot(st - cen, a) + cen + h.yz * 7.0;
  vec3 r = GTG(uGDet, vec3(u, S), gRot(gx, a), gRot(gy, a)).rgb;
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
  vec3 wp = pow(w, vec3(7.0));
  // opt: a tap whose sharpened barycentric weight is < 2 % of the sum is not fetched (cell interiors: 1 tap)
  vec3 use = uGOpt > 0.5 ? step(vec3(0.02), wp / max(wp.x + wp.y + wp.z, 1e-6)) : vec3(1.0);
  float l1 = 0.5, l2 = 0.5, l3 = 0.5;
  vec3 a1 = vec3(1.0, 0.0, 0.0), a2 = a1, a3 = a1;
  if (use.x > 0.5) a1 = gdTap(S, st, base + vec2(sg, sg), gx, gy, rotMax, l1);
  if (use.y > 0.5) a2 = gdTap(S, st, base + vec2(sg, 1.0 - sg), gx, gy, rotMax, l2);
  if (use.z > 0.5) a3 = gdTap(S, st, base + vec2(1.0 - sg, sg), gx, gy, rotMax, l3);
  vec3 W = mix(vec3(1.0), vec3(l1, l2, l3) * 2.0, 0.6) * wp * use;
  W /= max(W.x + W.y + W.z, 1e-5);
  return a1 * W.x + a2 * W.y + a3 * W.z;
}
float gd8(vec4 A, vec4 B, int i) { return i < 4 ? A[i] : B[i - 4]; }
vec3 biomeGroundV(vec2 wxz, vec3 nGeo, vec3 toEye, float dist) {
  vec2 wxz0 = wxz;
  vec2 uv = wxz / uGroundTileM;
  vec2 gx = dFdx(uv), gy = dFdy(uv);
  vec2 sp = wxz / uGroundSplatM;
  vec4 nA = gNoise4(sp) * 0.65 + gNoise4(sp * 2.31 + 17.3) * 0.35;
  vec4 nB = gNoise4(sp + 41.7) * 0.65 + gNoise4(sp * 2.31 + 63.1) * 0.35;
  float sc[8]; float rot[8];
  vec4 sA = mix(vec4(-9.0), nA * (0.55 + 0.45 * uGroundWA), step(1e-4, uGroundWA));
  vec4 sB = mix(vec4(-9.0), nB * (0.55 + 0.45 * uGroundWB), step(1e-4, uGroundWB));
  sA.x += 0.06;                                                       // layer 0 = base layer
  sc[0] = sA.x; sc[1] = sA.y; sc[2] = sA.z; sc[3] = sA.w; sc[4] = sB.x; sc[5] = sB.y; sc[6] = sB.z; sc[7] = sB.w;
  rot[0] = uGroundRotA.x; rot[1] = uGroundRotA.y; rot[2] = uGroundRotA.z; rot[3] = uGroundRotA.w;
  rot[4] = uGroundRotB.x; rot[5] = uGroundRotB.y; rot[6] = uGroundRotB.z; rot[7] = uGroundRotB.w;
  int i1 = 0, i2 = 1;
  if (sc[1] > sc[0]) { i1 = 1; i2 = 0; }
  for (int i = 2; i < 8; i++) {
    if (sc[i] > sc[i1]) { i2 = i1; i1 = i; } else if (sc[i] > sc[i2]) { i2 = i; }
  }
  vec3 T = normalize(vec3(1.0, 0.0, 0.0) - nGeo * nGeo.x);   // tangent frame of the uv (u = +X, v = +Z)
  vec3 B = cross(T, nGeo);
  float shadow = 0.0;
  float pomFade = uGroundPom * uGroundRelief * (1.0 - smoothstep(uGroundPomFade * 0.6, uGroundPomFade, dist));
  if (pomFade > 0.001) {
    vec3 V = normalize(toEye);
    vec3 Vt = vec3(dot(V, T), dot(V, B), dot(V, nGeo));
    vec3 Lt = vec3(dot(uGroundSunDir, T), dot(uGroundSunDir, B), dot(uGroundSunDir, nGeo));
    pomFade *= 0.4 + 0.6 * smoothstep(0.0, uGroundEdge * 1.5, sc[i1] - sc[i2]);   // half-blended layers: less
    vec2 d = gPom(float(i1), rot[i1], uv, gx, gy, wxz, Vt, Lt, pomFade, shadow);
    uv += d; wxz += d * uGroundTileM;
    shadow *= pomFade;
  }
  GroundSample a1 = gLayer(float(i1), rot[i1], uv, gx, gy, wxz);
  float d = sc[i1] - sc[i2];
  vec3 col = a1.c;
  vec3 nt = a1.n;
  if (d < uGroundEdge * 1.5) {
    GroundSample a2 = gLayer(float(i2), rot[i2], uv, gx, gy, wxz);
    float w2 = 0.5 * (1.0 - smoothstep(0.0, uGroundEdge, d + (gLum(a1.c) - gLum(a2.c)) * 0.25));
    col = mix(a1.c, a2.c, w2);
    if (uGroundRelief > 0.0) nt = normalize(mix(a1.n, a2.n, w2));
  }
  // close-range Imagine detail (512 px/m): full under uGDetNear, smooth fade to 0 at uGDetFar. Surface only, never shape.
  float gdFade = uGDetOn * (1.0 - smoothstep(uGDetNear, uGDetFar, dist));
  if (gdFade > 0.002) {
    vec3 m0d = gMean(0.0);
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
  vec3 mac = GTG(uGroundTex, vec3(uv * uGroundMacro, 0.0), gx * uGroundMacro * 6.0, gy * uGroundMacro * 6.0).rgb;
  vec3 m0 = gMean(0.0);
  col *= mix(1.0, clamp(gLum(mac) / max(gLum(m0), 1e-3), 0.6, 1.5), uGroundMacroAmt);
  // relight vs flat ground. Relief off: this whole block is skipped, colour stays the baked plate.
  if (uGroundRelief > 0.0) {
    vec3 n = normalize(T * nt.x + B * nt.y + nGeo * nt.z);
    float ratio = (uGroundSunAmb + max(dot(n, uGroundSunDir), 0.0)) / (uGroundSunAmb + max(uGroundSunDir.y, 0.0));
    col *= mix(1.0, clamp(ratio, 0.55, 1.6), uGroundRelief);
    col *= 1.0 - uGroundShadow * shadow;                 // contact shade on the sand behind a plate (away from sun)
  }
  return col;
}
vec3 biomeGround(vec2 wxz, vec3 nGeo) { return biomeGroundV(wxz, nGeo, nGeo, 1e9); }
`;

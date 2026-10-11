/**
 * biome-runtime.js - the game side of the biome bible (biome/1). Module only: NOT wired into any zone yet.
 *
 * Everything visual that code is allowed to add (law 67: fog sampled from the sky, one light grade, capped bloom;
 * IN TEST 2026-10-08: vignette + ~4 % grain) is read from the same bible JSON that wrote the Imagine prompts, so
 * no colour or number is retyped in game code.
 *
 * Engine-agnostic core (the game is raw WebGL2):
 *   fogUniforms(biome)         -> plain numbers for the 3-band fog chunk (warm near -> cool far, height falloff, desat)
 *   FOG_GLSL                   -> `vec3 biomeFog(vec3 col, float dist, float worldY)` (linear colour space)
 *   gradeUniforms(biome)       -> lift / gamma / gain / saturation / contrast / vignette / grain
 *   GRADE_FRAG                 -> full-screen pass: linear -> sRGB, grade, vignette, hash grain (one pass, no composer)
 *   SKY_EQUIRECT_GLSL          -> `vec3 biomeSky(sampler2D map, vec3 dir)` 2:1 equirect lookup without the wrap seam
 *   groundUniforms(biome)      -> numbers for GROUND_GLSL (tile metres, bombing grid / offset / per-layer rotation, splat)
 *   GROUND_GLSL                -> `vec3 biomeGround(vec2 worldXZ, vec3 nGeo)`: seeded top-2 splat of 8 layers + 2-sample bombing,
 *                                 micro-relief from 8 derived normal maps lit by the low sun (relative to flat).
 *                                 `biomeGroundV(worldXZ, nGeo, toEye, dist)` adds (relief.pom, normalPacking "xyh"):
 *                                 parallax occlusion on raised plates + sun-side self-shadow, faded out by distance
 *   createDuneField(biome)     -> seeded dune heightfield: fieldHeight / surfaceHeight (= LOD0 mesh) / normalAt / cells
 *   createTerrainStreamer(f)   -> cells around the camera, LOD rings, merged into ONE geometry (one draw call)
 *   groundContact(f, s, dt)    -> Bolt's feet on the drawn surface (snap, gravity, no invisible walls)
 *   createCameraRig(biome)     -> FOV breathing with speed (base -> sprint, damped); trauma is OFF unless the bible
 *                                 enables it (owner rule: no camera shake, ever)
 *   rendererSettings(biome)    -> NoToneMapping, sRGB out, antialias false, pixel-ratio cap, scene fog null
 *   headingToDir(deg, elDeg)   -> world direction (run direction = -Z, heading clockwise seen from above: 90 = +X)
 *   bindUniforms(gl, prog, u)  -> uploads a uniform pack with raw WebGL2
 * Ground shader + uniform packs live in biome-ground.js (re-exported here).
 * Optional three.js adapters (pass THREE in, nothing is imported): patchMaterialFog, createGradePass, createSkySphere,
 * createGroundMaterial, createPlanet.
 */

export const BIOME_RUNTIME_VERSION = 1;

// ------------------------------------------------------------------ colour helpers
export function hexToSrgb(hex) {
  const h = String(hex).replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}
export function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
export function hexToLinear(hex) {
  return hexToSrgb(hex).map(srgbToLinear);
}
const isHex = (v) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);

export async function loadBiome(url, fetchImpl = globalThis.fetch) {
  const r = await fetchImpl(url);
  if (!r.ok) throw new Error(`biome ${url}: HTTP ${r.status}`);
  const b = await r.json();
  if (b.schema !== "biome/1") throw new Error(`biome ${url}: schema ${b.schema} is not biome/1`);
  return b;
}

/** World direction for a heading (deg, clockwise seen from above, 0 = run direction = -Z) and elevation (deg). */
export function headingToDir(headingDeg, elevationDeg = 0) {
  const h = (headingDeg * Math.PI) / 180, e = (elevationDeg * Math.PI) / 180;
  return [Math.sin(h) * Math.cos(e), Math.sin(e), -Math.cos(h) * Math.cos(e)];
}

// ------------------------------------------------------------------ fog
/** Uniform pack for FOG_GLSL. Colours are linear (the chunk runs before any tone mapping / sRGB encode). */
export function fogUniforms(biome) {
  const f = biome.fog || {};
  const bands = (f.bands || []).slice(0, 3);
  while (bands.length < 3) bands.push(bands[bands.length - 1] || { dist: f.far || 220, color: f.color, amount: 0.8 });
  const col = (b) => hexToLinear(isHex(b.color) ? b.color : isHex(f.color) ? f.color : "#808080");
  return {
    uFogC0: col(bands[0]), uFogC1: col(bands[1]), uFogC2: col(bands[2]),
    uFogD: bands.map((b) => b.dist),
    uFogA: bands.map((b) => Math.min(1, Math.max(0, b.amount))),
    uFogDesat: f.desat ?? 0.25,
    uFogHeight: f.heightFalloff ?? 0.06,
  };
}

export const FOG_GLSL = /* glsl */ `
uniform vec3 uFogC0, uFogC1, uFogC2;  // warm near -> horizon -> cool far (linear)
uniform vec3 uFogD;                   // band distances (m)
uniform vec3 uFogA;                   // fog amount reached at each band
uniform float uFogDesat;              // how much distant pixels lose saturation (x amount)
uniform float uFogHeight;             // 1 / metres: high parts of mesas keep more of their own colour
vec3 biomeFog(vec3 col, float dist, float worldY) {
  float s0 = smoothstep(0.0, uFogD.x, dist);
  float s1 = smoothstep(uFogD.x, uFogD.y, dist);
  float s2 = smoothstep(uFogD.y, uFogD.z, dist);
  float a = uFogA.x * s0 + (uFogA.y - uFogA.x) * s1 + (uFogA.z - uFogA.y) * s2;
  a *= mix(1.0, 0.35, smoothstep(2.0, 2.0 + 1.0 / max(uFogHeight, 1e-3), worldY));
  vec3 fc = mix(mix(uFogC0, uFogC1, s1), uFogC2, s2);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(l), uFogDesat * a);
  return mix(col, fc, clamp(a, 0.0, 1.0));
}
`;

// ------------------------------------------------------------------ grade + vignette + grain (one full-screen pass)
export function gradeUniforms(biome) {
  const l = biome.lut || {}, p = biome.post || {};
  const v = p.vignette || {};
  const runtimeLut = !!p.runtimeLut; // plates are graded offline (qc.py) by default: no second grade at runtime
  return {
    uLift: runtimeLut ? l.lift || [0, 0, 0] : [0, 0, 0],
    uGamma: runtimeLut ? l.gamma || [1, 1, 1] : [1, 1, 1],
    uGain: runtimeLut ? l.gain || [1, 1, 1] : [1, 1, 1],
    uSat: runtimeLut ? l.saturation ?? 1 : 1,
    uContrast: p.contrast ?? 1.0,
    uPow: p.gamma ?? 1.0,
    uVig: [v.start ?? 0.72, v.end ?? 1.15, v.strength ?? 0.28],
    uGrain: p.grain ?? 0.04,
  };
}

export const GRADE_FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D tScene; // linear scene colour, same size as the drawing buffer (read 1:1 with texelFetch)
uniform vec3 uLift, uGamma, uGain;
uniform float uSat, uContrast, uPow, uGrain, uFrame;
uniform vec3 uVig;             // start, end, strength (outer ~25 % only)
uniform mediump sampler2D tSoft; // half-res soft transparent layers (premultiplied rgb, a = coverage)
uniform float uSoftOn;
uniform float uUp, uSharp;     // perf pass: uUp 1 = scene target smaller than the screen (bilinear + RCAS), uSharp = RCAS amount 0..1
in vec2 vUv;
out vec4 outColor;
// Film grain hash: 32-bit integer PCG (exact on every GPU). The old fract(sin(dot(p, (12.9898, 78.233))) * 43758.5453)
// drew fine diagonal / horizontal stripes over the whole frame on Android (Mali / Adreno reduce sin's argument in
// low precision, so neighbouring pixels' hashes line up). uFrame reseeds it every frame (animated, no fixed pattern).
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 toSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  vec3 lin;
  if (uUp < 0.5) lin = texelFetch(tScene, ivec2(gl_FragCoord.xy), 0).rgb;
  else {
    // FSR1 RCAS-style contrast-adaptive sharpening on the bilinear upsample (AMD FidelityFX RCAS lobe, linear light)
    vec2 ts = 1.0 / vec2(textureSize(tScene, 0));
    vec3 e = texture(tScene, vUv).rgb;
    vec3 b = texture(tScene, vUv + vec2(0.0, -ts.y)).rgb, d = texture(tScene, vUv + vec2(-ts.x, 0.0)).rgb;
    vec3 f = texture(tScene, vUv + vec2(ts.x, 0.0)).rgb, h = texture(tScene, vUv + vec2(0.0, ts.y)).rgb;
    vec3 mn4 = min(min(b, d), min(f, h)), mx4 = max(max(b, d), max(f, h));
    vec3 hitMin = mn4 / (4.0 * mx4 + 1e-4), hitMax = (1.0 - mx4) / (4.0 * mn4 - 4.0 - 1e-4);
    vec3 lr = max(-hitMin, hitMax);
    float lobe = max(-0.1875, min(max(lr.r, max(lr.g, lr.b)), 0.0)) * uSharp;
    lin = (lobe * (b + d + f + h) + e) / (4.0 * lobe + 1.0);
  }
  if (uSoftOn > 0.5) { vec4 sl = texture(tSoft, vUv); lin = lin * (1.0 - sl.a) + sl.rgb; }   // over-composite, linear light
  vec3 c = toSrgb(clamp(lin, 0.0, 1.0));
  c = pow(clamp(c * uGain + uLift * (1.0 - c), 0.0, 1.0), 1.0 / max(uGamma, vec3(1e-3)));   // same math as qc.py
  float y = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(y), c, uSat);
  c = pow(max(c, 0.0), vec3(uPow));
  c = clamp((c - 0.5) * uContrast + 0.5, 0.0, 1.0);
  float v = smoothstep(uVig.x, uVig.y, length(vUv - 0.5) * 1.4142);
  c = mix(c, c * (1.0 - uVig.z), v);
  uvec3 h = pcg3d(uvec3(uvec2(gl_FragCoord.xy), uint(uFrame)));
  float n = float(h.x >> 8u) * (1.0 / 16777216.0);       // 24 bits -> exact in fp32
  c += (n - 0.5) * uGrain;
  outColor = vec4(c, 1.0);
}
`;

export const FULLSCREEN_VERT = /* glsl */ `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);   // one triangle, no buffers
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

// ------------------------------------------------------------------ sky (2:1 equirect from stitch_sky.py)
/** u = heading / 360 (0 = run direction, clockwise), v = 0 at the zenith. Gradients picked from the continuous
 *  copy of u so the wrap column never samples the smallest mip (no seam line). No planet in this map. */
export const SKY_EQUIRECT_GLSL = /* glsl */ `
vec3 biomeSky(sampler2D map, vec3 dir) {
  dir = normalize(dir);
  float u = atan(dir.x, -dir.z) * 0.15915494 + 1.0;
  float v = acos(clamp(dir.y, -1.0, 1.0)) * 0.31830989;
  float u1 = fract(u), u2 = fract(u + 0.5) - 0.5;
  vec2 g1x = dFdx(vec2(u1, v)), g1y = dFdy(vec2(u1, v));
  vec2 g2x = dFdx(vec2(u2, v)), g2y = dFdy(vec2(u2, v));
  bool use2 = abs(g2x.x) + abs(g2y.x) < abs(g1x.x) + abs(g1y.x);
  return textureGrad(map, vec2(u1, v), use2 ? g2x : g1x, use2 ? g2y : g1y).rgb;
}
`;

// ------------------------------------------------------------------ ground (tools/biome/runtime/biome-ground.js)
import { GROUND_GLSL, groundUniforms } from "./biome-ground.js";
export { GROUND_BOMB_MODES, groundUniforms, groundDetailUniforms, GROUND_GLSL } from "./biome-ground.js";

// ------------------------------------------------------------------ ground relief: seeded dune heightfield + Bolt contact
/** Seeded, deterministic dune field for the zone (world metres, run direction -Z, +X = heading 90).
 *  fieldHeight(x, z): long swell + transverse dunes (gentle windward side, slip face, sinuous crests) + small dunes,
 *  shallow hollows on a jittered grid, drifts piled on the windward side of ruin anchors, and a mostly runnable
 *  avenue (gentle undulation, the dunes fade in over `blendM`). surfaceHeight(x, z) is the SAME triangle
 *  interpolation as the LOD0 mesh (2 m lattice) -> feet sit exactly on the drawn surface. */
export function createDuneField(biome, opts = {}) {
  const g = biome.ground || {}, R = { ...(g.relief || {}), ...opts };
  const enabled = R.enabled !== false;
  const seed = (R.seed ?? biome.seed ?? 1) | 0;
  const du = { ampM: 9, wavelengthM: 160, windDeg: 60, windwardFrac: 0.75, smallAmpM: 1.8, smallWavelengthM: 46, swellAmpM: 4, swellWavelengthM: 620, ...(R.dunes || {}) };
  const av = { halfWidthM: 14, blendM: 30, meanderM: 6, meanderWavelengthM: 1380, ampM: 1.2, wavelengthM: 90, ...(R.avenue || {}) };
  const ho = { cellM: 140, chance: 0.5, depthM: [1.5, 3.5], radiusM: [18, 34], ...(R.hollows || {}) };
  const dr = { heightM: [2.5, 5.5], radiusM: [14, 24], ...(R.drifts || {}) };
  const cellM = R.cellM ?? 64, lods = R.lods ?? [[96, 32], [192, 16], [400, 8]];
  const lattice = cellM / lods[0][1];
  const TAU = Math.PI * 2;
  const hash = (ix, iz, k) => {                      // integer hash -> [0,1)
    let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iz | 0, 668265263) ^ Math.imul(seed + k * 1013, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const vnoise = (x, z, k) => {
    const ix = Math.floor(x), iz = Math.floor(z); let fx = x - ix, fz = z - iz;
    fx = fx * fx * fx * (fx * (fx * 6 - 15) + 10); fz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
    const a = hash(ix, iz, k), b = hash(ix + 1, iz, k), c = hash(ix, iz + 1, k), d = hash(ix + 1, iz + 1, k);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  };
  const wr = (du.windDeg * Math.PI) / 180, wx = Math.sin(wr), wz = -Math.cos(wr);   // wind blows toward this heading
  const ridge = (f, a) => {                          // f in [0,1): windward rise over a, slip face over 1 - a
    if (f < a) { const t = f / a; return t * t * (3 - 2 * t); }
    const t = (f - a) / (1 - a); return 1 - t * t * (3 - 2 * t);
  };
  const avenueX = (z) => av.meanderM * Math.sin((z / av.meanderWavelengthM) * TAU);
  // drift anchors: placeholder ruin sites (tower canyon both sides of the avenue), replaced by object placements
  const anchors = Array.isArray(dr.anchors) ? dr.anchors : (() => {
    const out = [];
    for (let i = -12; i <= 12; i++) for (const side of [-1, 1]) {
      const z = i * 80 + (hash(i, side, 71) - 0.5) * 30, x = avenueX(z) + side * (34 + hash(i, side, 72) * 24);
      out.push({ x, z, r: dr.radiusM[0] + hash(i, side, 73) * (dr.radiusM[1] - dr.radiusM[0]), h: dr.heightM[0] + hash(i, side, 74) * (dr.heightM[1] - dr.heightM[0]) });
    }
    return out;
  })();
  function fieldHeight(x, z) {
    if (!enabled) return 0;
    const u = x * wx + z * wz, v = x * wz - z * wx;                       // along / across the wind
    const swell = du.swellAmpM * (vnoise(x / du.swellWavelengthM, z / du.swellWavelengthM, 1) - 0.5) * 2;
    const warp = (vnoise(v / 460, u / 700, 2) - 0.5) * 0.7 + (vnoise(v / 170, u / 300, 3) - 0.5) * 0.12;  // sinuous crests
    const p = u / du.wavelengthM + warp;
    const amp = du.ampM * (0.45 + 0.55 * vnoise(x / 300, z / 300, 4));
    const big = amp * ridge(p - Math.floor(p), du.windwardFrac);
    const p2 = u / du.smallWavelengthM + warp * 1.2 + vnoise(x / 150, z / 150, 5) * 0.5;
    const small = du.smallAmpM * ridge(p2 - Math.floor(p2), 0.7) * vnoise(x / 90, z / 90, 6);
    let h = swell + big + small;
    // shallow hollows on a jittered grid
    const ci = Math.floor(x / ho.cellM), cj = Math.floor(z / ho.cellM);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const i = ci + a, j = cj + b;
      if (hash(i, j, 21) > ho.chance) continue;
      const hx = (i + 0.2 + 0.6 * hash(i, j, 22)) * ho.cellM, hz = (j + 0.2 + 0.6 * hash(i, j, 23)) * ho.cellM;
      const r = ho.radiusM[0] + hash(i, j, 24) * (ho.radiusM[1] - ho.radiusM[0]);
      const d2 = ((x - hx) ** 2 + (z - hz) ** 2) / (r * r);
      if (d2 < 9) h -= (ho.depthM[0] + hash(i, j, 25) * (ho.depthM[1] - ho.depthM[0])) * Math.exp(-d2 * 1.6);
    }
    // avenue: gentle, not flat; the dune field fades in over blendM
    const ax = Math.abs(x - avenueX(z));
    const t = Math.min(1, Math.max(0, (ax - av.halfWidthM) / av.blendM)), k = t * t * (3 - 2 * t);
    const street = swell + av.ampM * Math.sin((z / av.wavelengthM) * TAU + vnoise(x / 50, z / 50, 7) * 2) + 0.15 * big;
    let out = street + (h - street) * k;
    // drifts piled on the windward side of ruin anchors
    for (const an of anchors) {
      // drift body centred upwind of the ruin (stretched along the wind), so the pile leans on its windward face
      const dx = x - (an.x - wx * an.r * 0.45), dz = z - (an.z - wz * an.r * 0.45);
      const along = dx * wx + dz * wz, across = dx * wz - dz * wx;
      const d2 = (along * along) / (1.3 * an.r * an.r) + (across * across) / (an.r * an.r);
      if (d2 < 9) out += an.h * Math.exp(-d2);
    }
    return out;
  }
  /** Height of the drawn LOD0 surface: two triangles per lattice square, diagonal (i,j)->(i+1,j+1) like the mesh. */
  function surfaceHeight(x, z) {
    const gx = x / lattice, gz = z / lattice, i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
    const h00 = fieldHeight(i * lattice, j * lattice), h11 = fieldHeight((i + 1) * lattice, (j + 1) * lattice);
    if (fx >= fz) { const h10 = fieldHeight((i + 1) * lattice, j * lattice); return h00 + (h10 - h00) * fx + (h11 - h10) * fz; }
    const h01 = fieldHeight(i * lattice, (j + 1) * lattice); return h00 + (h11 - h01) * fx + (h01 - h00) * fz;
  }
  function normalAt(x, z, e = 0.75) {
    const hx = fieldHeight(x + e, z) - fieldHeight(x - e, z), hz = fieldHeight(x, z + e) - fieldHeight(x, z - e);
    const n = [-hx, 2 * e, -hz], l = Math.hypot(...n); return [n[0] / l, n[1] / l, n[2] / l];
  }
  const slopeDegAt = (x, z) => (Math.acos(Math.min(1, normalAt(x, z)[1])) * 180) / Math.PI;
  /** One cell (cx, cz) at `res` quads per side: positions, normals, uint32 indices, + a skirt (hides LOD cracks). */
  function cellGeometry(cx, cz, res) {
    const n = res + 1, step = cellM / res, skirt = R.skirtM ?? 1.5;
    const vCount = n * n + 4 * n, pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3);
    let v = 0;
    const put = (x, y, z) => { const nn = normalAt(x, z); pos.set([x, y, z], v * 3); nor.set(nn, v * 3); return v++; };
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = cx * cellM + i * step, z = cz * cellM + j * step; put(x, fieldHeight(x, z), z); }
    const idx = [];
    for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      idx.push(a, d, b, a, c, d);                    // diagonal a->d = (i,j)->(i+1,j+1), CCW seen from +Y
    }
    const edges = [[...Array(n).keys()].map((i) => i), [...Array(n).keys()].map((i) => res * n + (res - i)),
      [...Array(n).keys()].map((j) => (res - j) * n), [...Array(n).keys()].map((j) => j * n + res)];
    for (const e of edges) {
      const base = e.map((k) => put(pos[k * 3], pos[k * 3 + 1] - skirt, pos[k * 3 + 2]));
      for (let k = 0; k < e.length - 1; k++) idx.push(e[k], base[k], e[k + 1], e[k + 1], base[k], base[k + 1]);
    }
    return { positions: pos.subarray(0, v * 3), normals: nor.subarray(0, v * 3), indices: Uint32Array.from(idx), tris: idx.length / 3 };
  }
  return { enabled, seed, cellM, lods, lattice, anchors, fieldHeight, surfaceHeight, normalAt, slopeDegAt, avenueX, cellGeometry };
}

/** Streams the dune field by cell around the camera into ONE merged geometry (one draw call). LOD per ring
 *  (bible relief.lods = [[maxDistM, quadsPerCell], ...]); cells behind the camera beyond the first ring are culled.
 *  update() rebuilds only when the camera crosses a cell or turns past `turnDeg`; cell meshes are cached. */
export function createTerrainStreamer(field, { turnDeg = 25, cacheMax = 600 } = {}) {
  const cache = new Map(); let key = "";
  const lodFor = (d) => { for (const [m, r] of field.lods) if (d <= m) return r; return 0; };
  return {
    cache,
    update(camX, camZ, headingDeg = 0) {
      const C = field.cellM, ccx = Math.floor(camX / C), ccz = Math.floor(camZ / C);
      const hq = Math.round(headingDeg / turnDeg);
      const k = `${ccx},${ccz},${hq}`;
      if (k === key) return null;
      key = k;
      const far = field.lods[field.lods.length - 1][0], rr = Math.ceil(far / C) + 1;
      const h = (headingDeg * Math.PI) / 180, fx = Math.sin(h), fz = -Math.cos(h);
      const parts = []; let vtx = 0, idn = 0, tris = 0;
      for (let j = -rr; j <= rr; j++) for (let i = -rr; i <= rr; i++) {
        const cx = ccx + i, cz = ccz + j, mx = (cx + 0.5) * C - camX, mz = (cz + 0.5) * C - camZ;
        const d = Math.max(0, Math.hypot(mx, mz) - C * 0.7072);
        const res = lodFor(d); if (!res) continue;
        if (d > field.lods[0][0] && (mx * fx + mz * fz) / (Math.hypot(mx, mz) + 1e-6) < -0.35) continue;   // behind
        const ck = `${cx},${cz},${res}`;
        let gm = cache.get(ck);
        if (!gm) { gm = field.cellGeometry(cx, cz, res); cache.set(ck, gm); if (cache.size > cacheMax) cache.delete(cache.keys().next().value); }
        parts.push(gm); vtx += gm.positions.length / 3; idn += gm.indices.length; tris += gm.tris;
      }
      const positions = new Float32Array(vtx * 3), normals = new Float32Array(vtx * 3), indices = new Uint32Array(idn);
      let vo = 0, io = 0;
      for (const gm of parts) {
        positions.set(gm.positions, vo * 3); normals.set(gm.normals, vo * 3);
        for (let q = 0; q < gm.indices.length; q++) indices[io + q] = gm.indices[q] + vo;
        vo += gm.positions.length / 3; io += gm.indices.length;
      }
      return { positions, normals, indices, tris, cells: parts.length };
    },
  };
}

/** Bolt on the dunes: feet = drawn surface, snap down small steps when grounded (no floating on the way down a
 *  dune), gravity otherwise. The field stays under maxSlopeDeg by construction, so nothing is an invisible wall;
 *  above `slideDeg` (never reached on this field) Bolt would slide along the slope instead of stopping. */
export function groundContact(field, s, dt, { gravity = 24, snapM = 0.35, slideDeg = 38 } = {}) {
  const feet = field.surfaceHeight(s.x, s.z);
  let { y, vy = 0, grounded = false } = s;
  if (grounded && vy <= 0 && y - feet <= snapM) { y = feet; vy = 0; grounded = true; }
  else {
    vy -= gravity * dt; y += vy * dt;
    if (y <= feet) { y = feet; vy = 0; grounded = true; } else grounded = false;
  }
  const n = field.normalAt(s.x, s.z), slope = (Math.acos(Math.min(1, n[1])) * 180) / Math.PI;
  return { ...s, y, vy, grounded, feet, normal: n, slopeDeg: slope, sliding: grounded && slope > slideDeg };
}

// ------------------------------------------------------------------ camera feel
/** FOV opens with speed (Grok chat: base 58 -> sprint 70, damp 4, vertical degrees). Trauma (landing shake) stays
 *  OFF unless biome.camera.trauma.enabled: owner rule "no camera shake, ever" (METHOD.md, Camera row). */
export function createCameraRig(biome) {
  const c = biome.camera || {};
  const base = c.fovBase ?? 58, sprint = c.fovSprint ?? 70, damp = c.fovDamp ?? 4;
  const tr = c.trauma || {};
  const traumaOn = !!tr.enabled;
  let fov = base, trauma = 0, t = 0;
  return {
    get fov() { return fov; },
    get trauma() { return trauma; },
    land(amount = tr.landing ?? 0.35) { if (traumaOn) trauma = Math.min(1, trauma + amount); },
    /** speed01: 0 walk .. 1 full sprint. Returns {fovDeg, rollRad, liftM} to apply to the chase camera. */
    update(dt, speed01) {
      t += dt;
      const target = base + (sprint - base) * speed01 * speed01;
      fov = target + (fov - target) * Math.exp(-damp * dt); // THREE.MathUtils.damp equivalent
      let roll = 0, lift = 0;
      if (traumaOn) {
        trauma = Math.max(0, trauma - dt * (tr.decayPerSec ?? 1.6));
        const s = trauma * trauma;
        roll = Math.sin(t * 20) * (tr.rollRad ?? 0.004) * s;
        lift = Math.sin(t * 31) * (tr.liftM ?? 0.02) * s;
      }
      return { fovDeg: fov, rollRad: roll, liftM: lift };
    },
  };
}

export function rendererSettings(biome) {
  const c = biome.camera || {}, p = biome.post || {};
  return {
    toneMapping: "NoToneMapping",         // plates already carry their light; ACES on top splits them again
    outputColorSpace: "srgb",
    antialias: false,
    pixelRatioCap: c.pixelRatioCap ?? 1.5,
    sceneFog: null,                       // FOG_GLSL does the fog; never scene.fog on top
    bloom: p.bloom && p.bloom.enabled ? p.bloom : null,
    near: c.near ?? 0.2, far: c.far ?? 400,
  };
}

/** Raw WebGL2: upload a uniform pack (numbers, vec2/3/4 arrays). Missing uniforms are skipped. */
export function bindUniforms(gl, prog, pack) {
  for (const [k, v] of Object.entries(pack)) {
    const loc = gl.getUniformLocation(prog, k);
    if (loc == null) continue;
    if (typeof v === "number") gl.uniform1f(loc, v);
    else if (v.length === 2) gl.uniform2fv(loc, v);
    else if (v.length === 3) gl.uniform3fv(loc, v);
    else if (v.length === 4) gl.uniform4fv(loc, v);
  }
}

// ------------------------------------------------------------------ optional three.js adapters (THREE passed in)
/** Inject the 3-band fog into a MeshBasicMaterial (unlit Imagine skins), before tone mapping / sRGB encode. */
export function patchMaterialFog(THREE, material, biome) {
  const u = fogUniforms(biome);
  material.fog = false;
  material.onBeforeCompile = (sh) => {
    for (const [k, v] of Object.entries(u)) sh.uniforms[k] = { value: Array.isArray(v) ? new THREE.Vector3(...v) : v };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vBiomeWorld;")
      .replace("#include <project_vertex>", `#include <project_vertex>
  vec4 bwp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    bwp = instanceMatrix * bwp;
  #endif
  vBiomeWorld = (modelMatrix * bwp).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vBiomeWorld;\n" + FOG_GLSL)
      .replace("#include <tonemapping_fragment>",
        "gl_FragColor.rgb = biomeFog(gl_FragColor.rgb, distance(vBiomeWorld, cameraPosition), vBiomeWorld.y);\n#include <tonemapping_fragment>");
  };
  material.needsUpdate = true;
  return material;
}

export function createGradePass(THREE, biome, opts = {}) {
  const u = gradeUniforms(biome);
  const uniforms = { tScene: { value: null }, uFrame: { value: 0 }, uUp: { value: 0 }, uSharp: { value: opts.sharp ?? 0.6 }, tSoft: { value: null }, uSoftOn: { value: 0 } };
  // soft layers (opts.srgb8 path): big soft transparent sheets drawn at half resolution into their own RGBA8 target, depth-tested by
  // hand against the full-res scene depth, then over-composited here. Thin / sharp things (grains, beam, rings, moons) stay full res.
  const SOFT_LAYER = 5, soft = [], softDepth = { value: null }, softT = { value: 0 }, softK = { value: new THREE.Vector2(2, 2) };
  let softRT = null, softDiv = opts.softDiv ?? 2;
  const clearC = new THREE.Color();
  let scale = 1;   // scene target = drawing buffer x scale (dynamic resolution, opts.srgb8 path)
  for (const [k, v] of Object.entries(u)) uniforms[k] = { value: Array.isArray(v) ? new THREE.Vector3(...v) : v };
  // This three.js prepends #define lines on RawShaderMaterial, so an embedded #version is illegal.
  // Put the version on glslVersion (it is emitted first) and strip the copy inside the chunks.
  const stripVer = (s) => s.replace(/^\s*#version\s+300\s+es\s*/, "");
  // opt (srgb8) path: colour math in mediump (fp16 ALU on Adreno/Mali); screen coordinates stay highp (2400 rows)
  const fragSrc = opts.srgb8 ? GRADE_FRAG.replace("precision highp float;", "precision mediump float;").replace("in vec2 vUv;", "in highp vec2 vUv;").replace("vec2 ts = ", "highp vec2 ts = ") : GRADE_FRAG;
  const material = new THREE.RawShaderMaterial({ uniforms, vertexShader: stripVer(FULLSCREEN_VERT), fragmentShader: stripVer(fragSrc),
    depthTest: false, depthWrite: false, glslVersion: THREE.GLSL3 });
  const scene = new THREE.Scene();
  const tri = new THREE.Mesh(new THREE.BufferGeometry(), material);
  tri.geometry.setDrawRange(0, 3); tri.frustumCulled = false;
  tri.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(9), 3));
  scene.add(tri);
  const camera = new THREE.Camera();
  let target = null;
  return {
    material,
    get scale() { return scale; }, set scale(v) { scale = Math.min(1, Math.max(0.3, v)); },
    get target() { return target; },
    get softDiv() { return softDiv; }, set softDiv(v) { softDiv = v; },
    /** Move a transparent object to the half-res soft pass (opts.srgb8 only). Additive materials keep their colour
     *  equation but stop writing alpha (alpha = coverage of the normal-blended sheets only). */
    addSoft(obj) {
      if (!opts.srgb8 || soft.includes(obj)) return false;
      obj.layers.set(SOFT_LAYER); soft.push(obj);
      for (const m of [].concat(obj.material)) {
        if (m.blending === THREE.AdditiveBlending) {
          m.blending = THREE.CustomBlending; m.blendEquation = THREE.AddEquation;
          m.blendSrc = m.premultipliedAlpha ? THREE.OneFactor : THREE.SrcAlphaFactor; m.blendDst = THREE.OneFactor;
          m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor;
        } else if (m.blending !== THREE.NormalBlending || m.premultipliedAlpha) throw new Error("soft layer blending " + m.blending);
        const prev = m.onBeforeCompile;
        m.onBeforeCompile = (sh, r) => {
          prev && prev.call(m, sh, r);
          sh.uniforms.tSoftDepth = softDepth; sh.uniforms.uSoftK = softK; sh.uniforms.uSoftT = softT;
          const re = /void\s+main\s*\(\s*(void)?\s*\)\s*\{/;
          if (!re.test(sh.fragmentShader)) throw new Error("soft layer: no main()");
          sh.fragmentShader = sh.fragmentShader.replace(re, "uniform highp sampler2D tSoftDepth; uniform vec2 uSoftK; uniform float uSoftT;\nvoid main(){\n" +
            "  if (uSoftT > 0.5 && gl_FragCoord.z > texelFetch(tSoftDepth, ivec2(gl_FragCoord.xy * uSoftK), 0).r) discard;   // depth test vs full-res scene\n");
        };
        const key = m.customProgramCacheKey.bind(m);
        m.customProgramCacheKey = () => key() + "|soft1";
        m.needsUpdate = true;
      }
      return true;
    },
    get softObjects() { return soft; },
    /** Render `world` into a linear target, then grade to the screen. One extra full-screen pass. */
    render(renderer, world, worldCamera) {
      const s = renderer.getDrawingBufferSize(new THREE.Vector2());
      const w = Math.max(1, Math.round(s.x * scale)), h = Math.max(1, Math.round(s.y * scale));
      const wantDepth = !!opts.srgb8 && soft.length > 0;   // depth texture only when the soft pass exists (else plain renderbuffer: no depth store)
      if (!target || target.width !== w || target.height !== h || !!target.depthTexture !== wantDepth) {
        target?.dispose();
        // opts.srgb8: RGBA8 sRGB target (hardware linear->sRGB on write, sRGB->linear on read): half the bytes of
        // RGBA16F, no float-render extension. The grade clamps to 0..1 anyway, so nothing above 1 is lost.
        target = opts.srgb8
          ? new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false })
          : new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
        if (opts.srgb8) target.texture.colorSpace = THREE.SRGBColorSpace;
        if (wantDepth) { target.depthTexture = new THREE.DepthTexture(w, h); target.depthTexture.type = THREE.UnsignedIntType; }
      }
      const softOn = soft.length > 0 && softDiv > 1 && soft.some((o) => o.visible);
      if (softOn) {
        const sw = Math.max(1, Math.ceil(w / softDiv)), sh = Math.max(1, Math.ceil(h / softDiv));
        if (!softRT || softRT.width !== sw || softRT.height !== sh) {
          softRT?.dispose();
          softRT = new THREE.WebGLRenderTarget(sw, sh, { type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace, depthBuffer: false,
            minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
          softRT.texture.colorSpace = THREE.SRGBColorSpace;
        }
        softK.value.set(w / sw, h / sh);
      }
      uniforms.uUp.value = w === s.x && h === s.y ? 0 : 1;
      // soft pass off (softDiv 1, nothing visible): soft objects drawn in the main pass as before (no depth texture read)
      const m0 = worldCamera.layers.mask;
      if (!softOn && soft.length) { softDepth.value = null; softT.value = 0; worldCamera.layers.enable(SOFT_LAYER); }
      renderer.setRenderTarget(target); renderer.render(world, worldCamera);   // soft objects sit on SOFT_LAYER: not drawn here
      worldCamera.layers.mask = m0;
      uniforms.uSoftOn.value = softOn ? 1 : 0;
      if (softOn) {
        const ac = renderer.autoClear, su = renderer.shadowMap.autoUpdate, ca = renderer.getClearAlpha(), cm = worldCamera.layers.mask, bg = world.background;
        renderer.getClearColor(clearC);
        renderer.shadowMap.autoUpdate = false; world.background = null;
        renderer.setRenderTarget(softRT); renderer.setClearColor(0x000000, 0); renderer.clear(true, false, false);
        renderer.autoClear = false; worldCamera.layers.set(SOFT_LAYER); softDepth.value = target.depthTexture; softT.value = 1;
        renderer.render(world, worldCamera);
        worldCamera.layers.mask = cm; renderer.autoClear = ac; renderer.shadowMap.autoUpdate = su; world.background = bg;
        renderer.setClearColor(clearC, ca);
        uniforms.tSoft.value = softRT.texture;
      }
      renderer.setRenderTarget(null);
      uniforms.tScene.value = target.texture; uniforms.uFrame.value = (uniforms.uFrame.value + 1) % 4096;
      renderer.render(scene, camera);
    },
  };
}

export function createSkySphere(THREE, biome, equirectTexture, radius = 900) {
  const material = new THREE.ShaderMaterial({
    uniforms: { map: { value: equirectTexture } }, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: "varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }",
    fragmentShader: "uniform sampler2D map; varying vec3 vDir;\n" + SKY_EQUIRECT_GLSL +
      "void main(){ gl_FragColor = vec4(biomeSky(map, vDir), 1.0);\n#include <colorspace_fragment>\n}",
  });
  equirectTexture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 32), material);
  // drawn AFTER every depth-writing opaque (far plane via xyww, depth-tested): sky pixels hidden behind towers / mesas / the
  // ground are never shaded. Same image as drawing it first (docs/METHOD/phone-perf.md, lossless draw order). Give the
  // ground mesh renderOrder 1 (after the other opaques) and depth-write-free opaque meshes 3.
  mesh.renderOrder = 2; mesh.frustumCulled = false;
  return mesh;
}

/** Ground material (splat + bombing + micro-relief + 3-band fog), one draw call. `layers` = a
 *  THREE.DataArrayTexture of the 8 plates (sRGB, RepeatWrapping, mipmaps). `normals` is the derived normal
 *  array (linear, same layout). null normals forces uGroundRelief 0 and binds `layers` as a dummy sampler
 *  so the uniform branch never fetches it. Vertex stage passes world position and the world `normal`
 *  attribute (a flat plane's attribute is (0,1,0)). GLSL3: this three.js build does not alias gl_FragColor
 *  when glslVersion is GLSL3, so the fragment writes `outColor`. */
export function createGroundMaterial(THREE, biome, layers, normals = null, detail = null) {
  const pack = { ...groundUniforms(biome), ...fogUniforms(biome) };
  if (!normals) pack.uGroundRelief = 0;
  if (!detail) pack.uGDetOn = 0;
  const uniforms = { uGroundTex: { value: layers }, uGroundNrm: { value: normals || layers }, uGDet: { value: detail || layers },
    uGroundMean: { value: Array.from({ length: 8 }, () => new THREE.Vector3()) } };
  const toU = (v) => (Array.isArray(v) ? (v.length === 4 ? new THREE.Vector4(...v) : v.length === 2 ? new THREE.Vector2(...v) : new THREE.Vector3(...v)) : v);
  for (const [k, v] of Object.entries(pack)) uniforms[k] = { value: toU(v) };
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms, fog: false,
    vertexShader: "out vec3 vW; out vec3 vN; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }",
    fragmentShader: "in vec3 vW;\nin vec3 vN;\n" + GROUND_GLSL + FOG_GLSL +
      "out vec4 outColor;\nvoid main(){ vec3 nG = normalize(vN); vec3 toEye = cameraPosition - vW; float dist = length(toEye); vec3 c = biomeGroundV(vW.xz, nG, toEye, dist); c = biomeFog(c, dist, vW.y); if (uGDetDbg > 0.5) { float f = uGDetOn * (1.0 - smoothstep(uGDetNear, uGDetFar, dist)); c = vec3(f, 0.0, 1.0 - f) * 0.5; } outColor = vec4(c, 1.0); }",
  });
}

/** Real rotating planet + ring mesh (never painted into the sky plate). Ring texture: inner edge = top row. */
export function createPlanet(THREE, biome, { map, ringMap } = {}) {
  const p = biome.planet || {};
  const group = new THREE.Group();
  const [dx, dy, dz] = headingToDir(p.azimuthDeg ?? 270, p.elevationDeg ?? 20);
  const dist = p.distance ?? 600;
  group.position.set(dx * dist, dy * dist, dz * dist);
  const body = new THREE.Mesh(new THREE.SphereGeometry(p.radius ?? 80, 48, 32), new THREE.MeshBasicMaterial({ map, fog: false }));
  group.add(body);
  let ring = null;
  if (p.ring && ringMap) {
    const g = new THREE.RingGeometry(p.ring.inner, p.ring.outer, 96, 1);
    const pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), r = Math.hypot(x, y);
      uv.setXY(i, (Math.atan2(y, x) / (2 * Math.PI) + 1) % 1, 1 - (r - p.ring.inner) / (p.ring.outer - p.ring.inner));
    }
    ring = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: ringMap, transparent: true, premultipliedAlpha: true,
      side: THREE.DoubleSide, depthWrite: false, fog: false }));
    ring.rotation.x = -Math.PI / 2 + ((p.ring.tiltDeg ?? 18) * Math.PI) / 180;
    group.add(ring);
  }
  const spin = ((p.spinDegPerSec ?? 0.86) * Math.PI) / 180, rspin = (((p.ring && p.ring.spinDegPerSec) ?? 2.3) * Math.PI) / 180;
  return { group, body, ring, update(dt) { body.rotation.y += dt * spin; if (ring) ring.rotation.z += dt * rspin; } };
}

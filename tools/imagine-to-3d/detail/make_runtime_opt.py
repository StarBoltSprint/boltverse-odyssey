"""Perf pass on runtime/biome-runtime-gd.js (in place, idempotent guard). All new paths are behind uniforms / options,
so ?opt=0 renders exactly as before."""
p = "/workspace/zb-preview-1008/runtime/biome-runtime-gd.js"
s = open(p).read()
if "uGOpt" in s: raise SystemExit("already patched")
def rep(a, b, n=1):
    global s
    assert s.count(a) >= 1, a[:80]
    s = s.replace(a, b) if n == 0 else s.replace(a, b, n)
# --- uniforms
rep("uGDetMask: (d.sandMask || [0.55, 0.85]).slice(0, 2), uGDetMacro: d.macroVar ?? 0.5, uGDetDbg: 0,",
    "uGDetMask: (d.sandMask || [0.55, 0.85]).slice(0, 2), uGDetMacro: d.macroVar ?? 0.5, uGDetDbg: 0,\n    uGOpt: 0,   // perf pass: 1 = layer means from uniforms + hex tap skipping (set by the page)")
rep("uniform vec4 uGDetSliceA, uGDetSliceB, uGDetStrA, uGDetStrB, uGDetFloorA, uGDetFloorB;",
    "uniform vec4 uGDetSliceA, uGDetSliceB, uGDetStrA, uGDetStrB, uGDetFloorA, uGDetFloorB;\nuniform float uGOpt;\nuniform vec3 uGroundMean[8];   // linear mean of each plate (= its 1x1 mip), filled by the page when uGOpt = 1\nvec3 gMean(float L) { return uGOpt > 0.5 ? uGroundMean[int(L)] : textureLod(uGroundTex, vec3(0.5, 0.5, L), 16.0).rgb; }")
# struct is declared before the uniforms? gMean uses uGroundTex declared above struct: check order
rep("  vec3 m = textureLod(uGroundTex, vec3(0.5, 0.5, L), 16.0).rgb;     // layer mean (last mip, 1 texel)",
    "  vec3 m = gMean(L);     // layer mean (last mip, 1 texel; uniform in opt mode)")
rep("    vec3 m0d = textureLod(uGroundTex, vec3(0.5, 0.5, 0.0), 16.0).rgb;", "    vec3 m0d = gMean(0.0);")
rep("  vec3 m0 = textureLod(uGroundTex, vec3(0.5, 0.5, 0.0), 16.0).rgb;", "  vec3 m0 = gMean(0.0);")
# --- hex tap skipping
old = """  float l1, l2, l3;
  vec3 a1 = gdTap(S, st, base + vec2(sg, sg), gx, gy, rotMax, l1);
  vec3 a2 = gdTap(S, st, base + vec2(sg, 1.0 - sg), gx, gy, rotMax, l2);
  vec3 a3 = gdTap(S, st, base + vec2(1.0 - sg, sg), gx, gy, rotMax, l3);
  vec3 W = mix(vec3(1.0), vec3(l1, l2, l3) * 2.0, 0.6) * pow(w, vec3(7.0));"""
new = """  vec3 wp = pow(w, vec3(7.0));
  // opt: a tap whose sharpened barycentric weight is < 2 % of the sum is not fetched (cell interiors: 1 tap)
  vec3 use = uGOpt > 0.5 ? step(vec3(0.02), wp / max(wp.x + wp.y + wp.z, 1e-6)) : vec3(1.0);
  float l1 = 0.5, l2 = 0.5, l3 = 0.5;
  vec3 a1 = vec3(1.0, 0.0, 0.0), a2 = a1, a3 = a1;
  if (use.x > 0.5) a1 = gdTap(S, st, base + vec2(sg, sg), gx, gy, rotMax, l1);
  if (use.y > 0.5) a2 = gdTap(S, st, base + vec2(sg, 1.0 - sg), gx, gy, rotMax, l2);
  if (use.z > 0.5) a3 = gdTap(S, st, base + vec2(1.0 - sg, sg), gx, gy, rotMax, l3);
  vec3 W = mix(vec3(1.0), vec3(l1, l2, l3) * 2.0, 0.6) * wp * use;"""
rep(old, new)
# --- material: means uniform
rep("const uniforms = { uGroundTex: { value: layers }, uGroundNrm: { value: normals || layers }, uGDet: { value: detail || layers } };",
    "const uniforms = { uGroundTex: { value: layers }, uGroundNrm: { value: normals || layers }, uGDet: { value: detail || layers },\n    uGroundMean: { value: Array.from({ length: 8 }, () => new THREE.Vector3()) } };")
# --- grade: sRGB8 target + internal scale + RCAS
rep("uniform vec3 uVig;             // start, end, strength (outer ~25 % only)",
    "uniform vec3 uVig;             // start, end, strength (outer ~25 % only)\nuniform float uUp, uSharp;     // perf pass: uUp 1 = scene target smaller than the screen (bilinear + RCAS), uSharp = RCAS amount 0..1")
old = "  vec3 c = toSrgb(clamp(texelFetch(tScene, ivec2(gl_FragCoord.xy), 0).rgb, 0.0, 1.0));"
new = """  vec3 lin;
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
  vec3 c = toSrgb(clamp(lin, 0.0, 1.0));"""
rep(old, new)
rep("export function createGradePass(THREE, biome) {\n  const u = gradeUniforms(biome);\n  const uniforms = { tScene: { value: null }, uFrame: { value: 0 } };",
    "export function createGradePass(THREE, biome, opts = {}) {\n  const u = gradeUniforms(biome);\n  const uniforms = { tScene: { value: null }, uFrame: { value: 0 }, uUp: { value: 0 }, uSharp: { value: opts.sharp ?? 0.6 } };\n  let scale = 1;   // scene target = drawing buffer x scale (dynamic resolution, opts.srgb8 path)")
old = """      const s = renderer.getDrawingBufferSize(new THREE.Vector2());
      if (!target || target.width !== s.x || target.height !== s.y) {
        target?.dispose();
        target = new THREE.WebGLRenderTarget(s.x, s.y, { type: THREE.HalfFloatType });
      }"""
new = """      const s = renderer.getDrawingBufferSize(new THREE.Vector2());
      const w = Math.max(1, Math.round(s.x * scale)), h = Math.max(1, Math.round(s.y * scale));
      if (!target || target.width !== w || target.height !== h) {
        target?.dispose();
        // opts.srgb8: RGBA8 sRGB target (hardware linear->sRGB on write, sRGB->linear on read): half the bytes of
        // RGBA16F, no float-render extension. The grade clamps to 0..1 anyway, so nothing above 1 is lost.
        target = opts.srgb8
          ? new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false })
          : new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
        if (opts.srgb8) target.texture.colorSpace = THREE.SRGBColorSpace;
      }
      uniforms.uUp.value = w === s.x && h === s.y ? 0 : 1;"""
rep(old, new)
rep("  return {\n    material,\n    /** Render `world` into a linear target",
    "  return {\n    material,\n    get scale() { return scale; }, set scale(v) { scale = Math.min(1, Math.max(0.3, v)); },\n    get target() { return target; },\n    /** Render `world` into a linear target")
open(p, "w").write(s); print("patched")

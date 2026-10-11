// Zone B phone upscaler (SmiR 2026-10-10 14:38, chosen on compare.html mode B): the scene is drawn at an internal ratio
// (default 1.5) into an RGBA8 sRGB target, upscaled to the canvas (min(2, device)) with an edge-preserving Catmull-Rom
// (bicubic, 9 taps via 5 bilinear fetches, de-ringed by clamping to the 2x2 source neighbourhood like FSR1 EASU), then
// sharpened with RCAS (FidelityFX lobe, default 0.8) at full resolution into the grade pass target; the grade runs as usual.
// Same shaders as tools/perf/phone-bench/cmp.mjs mode B (RCAS reads are clamped to the image edge here).
export function createEasuRcas(THREE, o = {}) {
  const VERT = `out vec2 vUv;\nvoid main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); vUv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
  const rt = (w, h) => { const t = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
    t.texture.colorSpace = THREE.SRGBColorSpace; return t; };
  const pass = (frag, uniforms) => {
    const m = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, uniforms, vertexShader: VERT, depthTest: false, depthWrite: false,
      fragmentShader: "precision highp float;\nprecision highp sampler2D;\nin vec2 vUv;\nout vec4 outColor;\n" + frag });
    const s = new THREE.Scene(), tri = new THREE.Mesh(new THREE.BufferGeometry(), m);
    tri.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(9), 3)); tri.geometry.setDrawRange(0, 3); tri.frustumCulled = false; s.add(tri);
    return { s, m };
  };
  // pass 1: de-ringed Catmull-Rom upsample (linear light: the sRGB8 targets decode on read and encode on write)
  const up = pass(`uniform sampler2D tLow;
void main() {
  vec2 sz = vec2(textureSize(tLow, 0)), p = vUv * sz - 0.5, f = fract(p), c = floor(p) + 0.5;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f)), w1 = 1.0 + f * f * (-2.5 + 1.5 * f), w2 = f * (0.5 + f * (2.0 - 1.5 * f)), w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2, t0 = (c - 1.0) / sz, t3 = (c + 2.0) / sz, t12 = (c + w2 / w12) / sz;
  vec3 r = (texture(tLow, vec2(t12.x, t0.y)).rgb * w12.x * w0.y + texture(tLow, vec2(t0.x, t12.y)).rgb * w0.x * w12.y
         + texture(tLow, t12).rgb * w12.x * w12.y + texture(tLow, vec2(t3.x, t12.y)).rgb * w3.x * w12.y + texture(tLow, vec2(t12.x, t3.y)).rgb * w12.x * w3.y);
  r /= (w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y);
  ivec2 mx = textureSize(tLow, 0) - 1, q = clamp(ivec2(c - 0.5), ivec2(0), mx), q1 = min(q + 1, mx);   // de-ring: clamp to the 2x2 source texels (as EASU does)
  vec3 a = texelFetch(tLow, q, 0).rgb, b = texelFetch(tLow, ivec2(q1.x, q.y), 0).rgb, d = texelFetch(tLow, ivec2(q.x, q1.y), 0).rgb, e = texelFetch(tLow, q1, 0).rgb;
  outColor = vec4(clamp(r, min(min(a, b), min(d, e)), max(max(a, b), max(d, e))), 1.0);
}`, { tLow: { value: null } });
  // pass 2: RCAS at full resolution (drawn into the grade pass's scene target; the grade then runs as usual)
  const rc = pass(`uniform sampler2D tUp; uniform float uSharp;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy), mx = textureSize(tUp, 0) - 1;
  vec3 e = texelFetch(tUp, p, 0).rgb, b = texelFetch(tUp, max(p + ivec2(0, -1), ivec2(0)), 0).rgb, d = texelFetch(tUp, max(p + ivec2(-1, 0), ivec2(0)), 0).rgb;
  vec3 f = texelFetch(tUp, min(p + ivec2(1, 0), mx), 0).rgb, h = texelFetch(tUp, min(p + ivec2(0, 1), mx), 0).rgb;
  vec3 mn4 = min(min(b, d), min(f, h)), mx4 = max(max(b, d), max(f, h));
  vec3 hitMin = mn4 / (4.0 * mx4 + 1e-4), hitMax = (1.0 - mx4) / (4.0 * mn4 - 4.0 - 1e-4);
  vec3 lr = max(-hitMin, hitMax);
  float lobe = max(-0.1875, min(max(lr.r, max(lr.g, lr.b)), 0.0)) * uSharp;
  outColor = vec4((lobe * (b + d + f + h) + e) / (4.0 * lobe + 1.0), 1.0);
}`, { tUp: { value: null }, uSharp: { value: o.sharp ?? 0.8 } });
  const cam2 = new THREE.Camera(), v2 = new THREE.Vector2();
  let lowRT = null, upRT = null;
  return {
    kind: "easu-rcas",
    get sharp() { return rc.m.uniforms.uSharp.value; }, set sharp(v) { rc.m.uniforms.uSharp.value = v; },
    /** scale = internal / canvas ratio (< 1). Draws `world` at that scale, upscales + sharpens, then grades to the canvas. */
    render(renderer, world, camera, grade, scale) {
      const s = renderer.getDrawingBufferSize(v2), w = Math.max(1, Math.round(s.x * scale)), h = Math.max(1, Math.round(s.y * scale));
      if (!lowRT || lowRT.width !== w || lowRT.height !== h) { lowRT?.dispose(); lowRT = rt(w, h); }
      if (!upRT || upRT.width !== s.x || upRT.height !== s.y) { upRT?.dispose(); upRT = rt(s.x, s.y); }
      renderer.setRenderTarget(lowRT); renderer.clear(); renderer.render(world, camera);
      up.m.uniforms.tLow.value = lowRT.texture; renderer.setRenderTarget(upRT); renderer.render(up.s, cam2);
      rc.m.uniforms.tUp.value = upRT.texture; grade.scale = 1; grade.render(renderer, rc.s, cam2);
    },
  };
}

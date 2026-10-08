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
 *   createCameraRig(biome)     -> FOV breathing with speed (base -> sprint, damped); trauma is OFF unless the bible
 *                                 enables it (owner rule: no camera shake, ever)
 *   rendererSettings(biome)    -> NoToneMapping, sRGB out, antialias false, pixel-ratio cap, scene fog null
 *   headingToDir(deg, elDeg)   -> world direction (run direction = -Z, heading clockwise seen from above: 90 = +X)
 *   bindUniforms(gl, prog, u)  -> uploads a uniform pack with raw WebGL2
 * Optional three.js adapters (pass THREE in, nothing is imported): patchMaterialFog, createGradePass, createSkySphere,
 * createPlanet.
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
uniform sampler2D tScene;      // linear scene colour
uniform vec3 uLift, uGamma, uGain;
uniform float uSat, uContrast, uPow, uGrain, uFrame;
uniform vec3 uVig;             // start, end, strength (outer ~25 % only)
in vec2 vUv;
out vec4 outColor;
vec3 toSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  vec3 c = toSrgb(clamp(texture(tScene, vUv).rgb, 0.0, 1.0));
  c = pow(clamp(c * uGain + uLift * (1.0 - c), 0.0, 1.0), 1.0 / max(uGamma, vec3(1e-3)));   // same math as qc.py
  float y = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(y), c, uSat);
  c = pow(max(c, 0.0), vec3(uPow));
  c = clamp((c - 0.5) * uContrast + 0.5, 0.0, 1.0);
  float v = smoothstep(uVig.x, uVig.y, length(vUv - 0.5) * 1.4142);
  c = mix(c, c * (1.0 - uVig.z), v);
  float n = fract(sin(dot(gl_FragCoord.xy + uFrame, vec2(12.9898, 78.233))) * 43758.5453);
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

export function createGradePass(THREE, biome) {
  const u = gradeUniforms(biome);
  const uniforms = { tScene: { value: null }, uFrame: { value: 0 } };
  for (const [k, v] of Object.entries(u)) uniforms[k] = { value: Array.isArray(v) ? new THREE.Vector3(...v) : v };
  const material = new THREE.RawShaderMaterial({ uniforms, vertexShader: FULLSCREEN_VERT, fragmentShader: GRADE_FRAG,
    depthTest: false, depthWrite: false, glslVersion: null });
  const scene = new THREE.Scene();
  const tri = new THREE.Mesh(new THREE.BufferGeometry(), material);
  tri.geometry.setDrawRange(0, 3); tri.frustumCulled = false;
  tri.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(9), 3));
  scene.add(tri);
  const camera = new THREE.Camera();
  let target = null;
  return {
    material,
    /** Render `world` into a linear target, then grade to the screen. One extra full-screen pass. */
    render(renderer, world, worldCamera) {
      const s = renderer.getDrawingBufferSize(new THREE.Vector2());
      if (!target || target.width !== s.x || target.height !== s.y) {
        target?.dispose();
        target = new THREE.WebGLRenderTarget(s.x, s.y, { type: THREE.HalfFloatType });
      }
      renderer.setRenderTarget(target); renderer.render(world, worldCamera);
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
  mesh.renderOrder = -1; mesh.frustumCulled = false;
  return mesh;
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

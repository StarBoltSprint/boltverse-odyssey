// Unreal-look runtime. Colours and the LUT come from look.json / lut.png, sampled from Imagine images.
import { FILMIC_FRAG, BLOOM_FRAG } from "./curves.mjs";

const VERT = `out vec2 vUv;
void main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); vUv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

// Occlusion mask, radial-blurred toward the sun. Colour texels come from the Imagine atlas. Placement and intensity are uniforms.
const SHAFT_FRAG = `precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tScene;
uniform sampler2D tAtlas;
uniform vec2 uSun;
uniform vec4 uSunRect;
uniform vec4 uRayRect;
uniform float uRim;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); } // not a colour: Rec.709 luma weights
vec3 atlasAt(vec4 rect, vec2 st) {
  return texture(tAtlas, vec2(mix(rect.x, rect.z, st.x), mix(rect.y, rect.w, st.y))).rgb;
}
float openAt(vec2 p) {
  if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) return 0.0;
  return smoothstep(0.04, 0.20, luma(texture(tScene, p).rgb));
}
void main() {
  vec2 toSun = uSun - vUv;
  float acc = 0.0;
  float wsum = 0.0;
  for (int i = 1; i <= 16; i++) {
    float t = float(i) / 16.0;
    float w = 1.0 - t;
    acc += openAt(vUv + toSun * t) * w;
    wsum += w;
  }
  float shaft = acc / max(wsum, 1e-4);
  float dist = length(toSun);
  float near = smoothstep(0.42, 0.02, dist);
  float disc = smoothstep(0.012, 0.0, dist);
  float halo = smoothstep(0.055, 0.012, dist);
  float L0 = luma(texture(tScene, vUv).rgb);
  float sky = smoothstep(0.05, 0.18, L0);
  float lx = luma(texture(tScene, vUv + vec2(0.0025, 0.0)).rgb);
  float ly = luma(texture(tScene, vUv + vec2(0.0, 0.0025)).rgb);
  float edge = smoothstep(0.08, 0.22, abs(lx - L0) + abs(ly - L0));
  vec3 core = atlasAt(uSunRect, vec2(0.50, 0.50));
  vec3 glow = atlasAt(uSunRect, vec2(0.50, 0.72));
  vec3 ray = atlasAt(uRayRect, vec2(0.50, 0.42));
  vec3 add = core * disc + glow * halo * max(sky, disc) + ray * shaft * near * sky + glow * edge * uRim;
  outColor = vec4(add, 1.0);
}`;

function flag(q, name, def) {
  if (q.get("look") === "0") return false;
  if (q.get(name) === "0") return false;
  if (q.get(name) === "1") return true;
  return !!def;
}

function pass(THREE, frag, uniforms) {
  const m = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms,
    vertexShader: VERT,
    fragmentShader: frag,
    depthTest: false,
    depthWrite: false,
  });
  const s = new THREE.Scene();
  const tri = new THREE.Mesh(new THREE.BufferGeometry(), m);
  tri.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(9), 3));
  tri.geometry.setDrawRange(0, 3);
  tri.frustumCulled = false;
  s.add(tri);
  return { s, m };
}

function rt(THREE, w, h) {
  const t = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.UnsignedByteType,
    depthBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
  });
  t.texture.colorSpace = THREE.LinearSRGBColorSpace;
  return t;
}

export async function attach(ctx) {
  try {
    const extra = await import("./features.mjs");
    window.__lookInstall = {
      bake: extra.installBake,
      env: extra.installEnv,
      fog: extra.installFog,
      shadows: extra.installShadows,
      sprites: extra.installSprites,
    };
  } catch (err) {
    console.warn("look features", err);
  }
  const q = new URLSearchParams(location.search);
  let look = null;
  try {
    look = await (await fetch("./look/look.json?t=" + Date.now())).json();
  } catch (err) {
    console.warn("look.json", err);
    return { ok: false, reason: "no look.json" };
  }
  const features = look.features || {};
  window.__lookSun = features.sun || null;
  const on = {
    grade: flag(q, "grade", features.grade && features.grade.enabled),
    sun: flag(q, "sun", features.sun && features.sun.enabled),
    bloom: flag(q, "bloom", !(features.grade && features.grade.bloom && features.grade.bloom.enabled === false)),
    bake: flag(q, "bake", features.bake && features.bake.enabled),
    env: flag(q, "env", features.env && features.env.enabled),
    fog: flag(q, "fog", features.fog && features.fog.enabled),
    shadows: flag(q, "shadows", features.shadows && features.shadows.enabled),
    sprites: flag(q, "sprites", features.sprites && features.sprites.enabled),
  };
  const state = { ok: true, on, applied: {} };
  window.__look = state;
  if (on.grade && features.grade && ctx.grade && ctx.grade.render) state.applied.grade = installGrade(ctx, features.grade, on.bloom);
  if (on.bake && features.bake && ctx.installBake) state.applied.bake = await ctx.installBake(features.bake);
  else if (on.bake && features.bake && window.__lookInstall && window.__lookInstall.bake) state.applied.bake = await window.__lookInstall.bake(ctx, features.bake);
  if (on.env && features.env && window.__lookInstall && window.__lookInstall.env) state.applied.env = await window.__lookInstall.env(ctx, features.env);
  if (on.fog && features.fog && window.__lookInstall && window.__lookInstall.fog) state.applied.fog = window.__lookInstall.fog(ctx, features.fog);
  if (on.shadows && features.shadows && window.__lookInstall && window.__lookInstall.shadows) state.applied.shadows = window.__lookInstall.shadows(ctx, features.shadows);
  if (on.sprites && features.sprites && window.__lookInstall && window.__lookInstall.sprites) state.applied.sprites = await window.__lookInstall.sprites(ctx, features.sprites);
  return state;
}

function installGrade(ctx, feat, bloomOn) {
  const { THREE, renderer, grade } = ctx;
  const cam = new THREE.Camera();
  const size = new THREE.Vector2();
  const filmic = pass(THREE, FILMIC_FRAG, {
    tScene: { value: null },
    tLut: { value: null },
    tBloom: { value: null },
    uExposure: { value: feat.exposure },
    uCurve: { value: feat.curve === "agx" ? 1 : 0 },
    uLut: { value: feat.lutStrength },
    uBloom: { value: Math.min(feat.bloom.strength, feat.bloom.strengthCap) },
    uBloomOn: { value: 0 },
    uLutN: { value: (feat.lut && feat.lut.n) || 16 },
    tMatch: { value: null },
    tShaft: { value: null },
    uShaft: { value: 0 },
  });
  const ramp = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) ramp.set([i, i, i, 255], i * 4);
  const placeholder = new THREE.DataTexture(ramp, 256, 1);
  placeholder.colorSpace = THREE.NoColorSpace;
  placeholder.magFilter = THREE.LinearFilter;
  placeholder.minFilter = THREE.LinearFilter;
  placeholder.needsUpdate = true;
  filmic.m.uniforms.tMatch.value = placeholder;
  const black = new Uint8Array(4);
  const blank = new THREE.DataTexture(black, 1, 1);
  blank.colorSpace = THREE.NoColorSpace;
  blank.needsUpdate = true;
  filmic.m.uniforms.tShaft.value = blank;
  const bloom = pass(THREE, BLOOM_FRAG, {
    tSrc: { value: null },
    uThreshold: { value: feat.bloom.threshold.value },
    uMode: { value: 0 },
    uTexel: { value: new THREE.Vector2(1, 1) },
  });
  const qGrade = new URLSearchParams(location.search).get("grade");
  const curveId = qGrade === "id" ? 2 : feat.curve === "match" ? 3 : feat.curve === "agx" ? 1 : 0;
  filmic.m.uniforms.uCurve.value = curveId;
  if (qGrade === "id") filmic.m.uniforms.uBloom.value = 0;
  const loader = new THREE.TextureLoader();
  const sunFeat = window.__lookSun;
  const sunOn = sunFeat && sunFeat.enabled && sunFeat.uv && sunFeat.atlas && new URLSearchParams(location.search).get("sun") !== "0";
  let shaftPass = null;
  let shaftRT = null;
  if (sunOn) {
    shaftPass = pass(THREE, SHAFT_FRAG, {
      tScene: { value: null },
      tAtlas: { value: blank },
      uSun: { value: new THREE.Vector2(sunFeat.uv[0], 1 - sunFeat.uv[1]) },
      uSunRect: { value: new THREE.Vector4(...(sunFeat.sunRect || [0, 0, 1, 1])) },
      uRayRect: { value: new THREE.Vector4(...(sunFeat.rayRect || [0, 0, 1, 1])) },
      uRim: { value: sunFeat.rim == null ? 0.9 : sunFeat.rim },
    });
    loader.load("./" + sunFeat.atlas, (tex) => {
      tex.colorSpace = THREE.NoColorSpace;
      tex.flipY = false;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      shaftPass.m.uniforms.tAtlas.value = tex;
    });
    filmic.m.uniforms.uShaft.value = qGrade === "id" ? 0 : (sunFeat.intensity == null ? 1 : sunFeat.intensity);
  }
  if (feat.lut && feat.lut.file) loader.load("./look/" + feat.lut.file, (tex) => {
    tex.colorSpace = THREE.NoColorSpace;
    tex.flipY = false;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    filmic.m.uniforms.tLut.value = tex;
  });
  const matchFile = feat.match && feat.match.file;
  if (matchFile) {
    loader.load("./look/" + matchFile, (tex) => {
      tex.colorSpace = THREE.NoColorSpace;
      tex.flipY = false;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      filmic.m.uniforms.tMatch.value = tex;
    });
  }
  let bloomRT = null, blurRT = null;
  const useBloom = bloomOn && feat.bloom.strength > 0;
  const inner = grade.render.bind(grade);
  const origRender = renderer.render.bind(renderer);
  let skip = false;
  renderer.render = function (sc, camera) {
    if (skip && sc && sc.children && sc.children.some((o) => o.material === grade.material)) return;
    return origRender(sc, camera);
  };
  grade.render = function (ren, world, camera) {
    if (window.__look && window.__look.on && window.__look.on.grade === false) return inner(ren, world, camera);
    skip = true;
    try { inner(ren, world, camera); }
    finally { skip = false; }
    const src = grade.target && grade.target.texture;
    if (!src) return inner(ren, world, camera);
    const draw = ren.getDrawingBufferSize(size);
    if (shaftPass && filmic.m.uniforms.uShaft.value > 0) {
      if (!shaftRT || shaftRT.width !== draw.x || shaftRT.height !== draw.y) {
        shaftRT?.dispose();
        shaftRT = rt(THREE, draw.x, draw.y);
      }
      shaftPass.m.uniforms.tScene.value = src;
      ren.setRenderTarget(shaftRT);
      origRender(shaftPass.s, cam);
      filmic.m.uniforms.tShaft.value = shaftRT.texture;
    }
    filmic.m.uniforms.tScene.value = src;
    filmic.m.uniforms.uBloomOn.value = 0;
    if (useBloom && window.__look.on.bloom !== false) {
      const scale = feat.bloom.scale || 0.25;
      const w = Math.max(1, Math.round(draw.x * scale));
      const h = Math.max(1, Math.round(draw.y * scale));
      if (!bloomRT || bloomRT.width !== w || bloomRT.height !== h) {
        bloomRT?.dispose(); blurRT?.dispose();
        bloomRT = rt(THREE, w, h); blurRT = rt(THREE, w, h);
      }
      bloom.m.uniforms.uMode.value = 0;
      bloom.m.uniforms.tSrc.value = src;
      ren.setRenderTarget(bloomRT); origRender(bloom.s, cam);
      bloom.m.uniforms.uMode.value = 1;
      bloom.m.uniforms.uTexel.value.set(1 / w, 1 / h);
      bloom.m.uniforms.tSrc.value = bloomRT.texture;
      ren.setRenderTarget(blurRT); origRender(bloom.s, cam);
      bloom.m.uniforms.uMode.value = 2;
      bloom.m.uniforms.tSrc.value = blurRT.texture;
      ren.setRenderTarget(bloomRT); origRender(bloom.s, cam);
      filmic.m.uniforms.tBloom.value = bloomRT.texture;
      filmic.m.uniforms.uBloomOn.value = 1;
    }
    ren.setRenderTarget(null);
    origRender(filmic.s, cam);
  };
  return { curve: feat.curve, exposure: feat.exposure, lut: feat.lutStrength, bloom: useBloom };
}

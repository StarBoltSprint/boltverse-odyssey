import { createKeyedField, loadGrid } from "./keyed-field.mjs";
import { patchHeightSplat } from "./height-splat.mjs";
// Zone B (Ember Mesa redo) free-walk preview: same biome runtime as the engine stills
// (sky v2 equirect, 8 ground plates + bombing + micro-relief, seeded dune field, 3 fog bands, grade).
import * as THREE from "/live/three.module.js";
const V = "8";
import * as R from "/live/runtime/biome-runtime-v61.js?v=61";   // v61 live (2026-10-10 14:xx): v60 + ground detail layer, perf path, PRE, quality-first ratio 2
import { mountObjects } from "/live/objects-t7.mjs?v=58";   // TEX7 v58 (Grok Bot facade): merged LOD0 draws, R8 section pool, detail layer. Keep in merges.
import { createAllRoundBuilder } from "/live/terrain-build.mjs";
import { createAdaptiveRes } from "/live/runtime/adaptive-res-v3.mjs?v=3";   // quality-first: full quality, emergency floor only
import { createEasuRcas } from "/live/runtime/upscale-easu.mjs?v=1";   // v62 (SmiR 14:38): internal 1.5 -> canvas 2, EASU-style + RCAS 0.8

const $ = (id) => document.getElementById(id);
const loadEl = $("load");
const say = (t) => { loadEl.textContent = t; };
window.__errors = [];
window.addEventListener("error", (e) => { window.__errors.push(String(e.message)); say("Erreur : " + e.message); loadEl.style.display = "flex"; });

const biome = await (await fetch(`/live/biome.json?v=${V}`)).json();
// v61: close-range ground detail layer (512 px/m, SmiR-approved); ?gdet=0 turns it off
const QD = new URLSearchParams(location.search);
biome.ground.detail = await (await fetch("/live/gdet/ground-detail.json?g=2")).json();
if (QD.get("gdet") === "0") biome.ground.detail.enabled = false;

let done = 0; const total = 20;
const tick = () => say(`Chargement… ${++done}/${total}`);
async function bitmap(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + " HTTP " + r.status);
  const bmp = await createImageBitmap(await r.blob());
  tick();
  return bmp;
}
function rgba(bmp, size) {
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(bmp, 0, 0, size, size);
  return g.getImageData(0, 0, size, size).data;
}
function arrayTexture(data, size, depth, colorSpace) {
  const tex = new THREE.DataArrayTexture(data, size, size, depth);
  tex.format = THREE.RGBAFormat; tex.type = THREE.UnsignedByteType; tex.colorSpace = colorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true; tex.needsUpdate = true;
  return tex;
}

say("Chargement…");
const ids = [0, 1, 2, 3, 4, 5, 6, 7];
const [albBmps, nrmBmps, skyBmp] = await Promise.all([
  Promise.all(ids.map((i) => bitmap(`/live/assets/ground/ground-g${i}.jpg`))),
  Promise.all(ids.map((i) => bitmap(`/live/assets/normal/ground-g${i}-nh.jpg?v=${V}`))),
  bitmap("/live/assets/sky/sky-equirect.jpg"),
]);
const DS = 928, dNames = biome.ground.detail.slices;
const detBmps = await Promise.all(dNames.map((n) => bitmap(`/live/gdet/gdet-${n}.jpg?g=1`)));
const detBytes = new Uint8Array(DS * DS * 4 * dNames.length);
detBmps.forEach((b, i) => { if (b.width !== DS || b.height !== DS) throw new Error("detail slice not native " + DS); detBytes.set(rgba(b, DS), i * DS * DS * 4); });
const detail = arrayTexture(detBytes, DS, dNames.length, THREE.NoColorSpace);
const albedoBytes = new Uint8Array(1024 * 1024 * 4 * 8);
const normalBytes = new Uint8Array(1024 * 1024 * 4 * 8);
ids.forEach((i) => {
  albedoBytes.set(rgba(albBmps[i], 1024), i * 1024 * 1024 * 4);
  normalBytes.set(rgba(nrmBmps[i], 1024), i * 1024 * 1024 * 4);
});
const albedo = arrayTexture(albedoBytes, 1024, 8, THREE.SRGBColorSpace);
const normals = arrayTexture(normalBytes, 1024, 8, THREE.NoColorSpace);
const skyTex = new THREE.Texture(skyBmp);
skyTex.colorSpace = THREE.SRGBColorSpace;
skyTex.wrapS = THREE.RepeatWrapping; skyTex.wrapT = THREE.ClampToEdgeWrapping;
skyTex.magFilter = THREE.LinearFilter; skyTex.minFilter = THREE.LinearMipmapLinearFilter;
skyTex.generateMipmaps = true; skyTex.needsUpdate = true;

// ---------------------------------------------------------------- renderer (biome rendererSettings)
const rs = R.rendererSettings(biome);
const canvas = $("view");
// perf pass (2026-10-10): ?opt=1 = canvas at the device pixel ratio, scene drawn into an RGBA8 sRGB target at a dynamic
// internal pixel ratio (<= ?cap=, default = device), upsampled + RCAS-sharpened in the grade pass; no canvas MSAA (the
// scene target never had MSAA; the canvas only received the full-screen grade triangle); POM 6 steps under 10 m;
// layer means as uniforms; hex detail taps skipped where their weight < 2 %. ?dyn=0 freezes the internal ratio,
// ?sharp=0..1 RCAS amount. Without opt=1 everything is as before (?cap= then caps the canvas ratio).
const OPT = QD.get("opt") !== "0";   // perf path is the default (as in v58+); ?opt=0 = the v57 path
const CAPQ = QD.has("cap") && isFinite(+QD.get("cap")) ? +QD.get("cap") : null;
const PRMAX = QD.get('pr') === 'max';
const DPR = window.devicePixelRatio || 1;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !OPT, alpha: false, powerPreference: "high-performance" });
// step 3b (SmiR 10:22, 30 fps at 1.25x): the canvas at the full device ratio (2.6-3) cost a fixed full-screen grade + RCAS
// + compositor pass at ~2.6 Mpx whatever the internal ratio. Now the canvas follows the adaptive level (= internal ratio,
// 1 fetch grade, no RCAS); only the short sprint dip renders below it (RCAS upsample). ?canvas=dpr = old behaviour.
const CANVAS_DPR = QD.get("canvas") === "dpr";
const prCap = OPT ? (CANVAS_DPR ? Math.min(DPR, 4) : Math.min(DPR, CAPQ ?? (PRMAX ? 4 : 2))) : CAPQ ?? (PRMAX ? 4 : rs.pixelRatioCap);
let pr = Math.min(DPR, prCap);
renderer.setPixelRatio(pr);
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.NoToneMapping;
const gl = renderer.getContext();
const canFloatRT = !!(gl.getExtension("EXT_color_buffer_half_float") || gl.getExtension("EXT_color_buffer_float"));
// grade pass does linear -> sRGB itself; without float render targets fall back to a direct sRGB render
renderer.outputColorSpace = canFloatRT || OPT ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 1);
renderer.shadowMap.enabled = true;
renderer._useLegacyLights = true;
const aniso = renderer.capabilities.getMaxAnisotropy();
albedo.anisotropy = aniso; normals.anisotropy = aniso; skyTex.anisotropy = aniso; detail.anisotropy = aniso;
canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); say("Le téléphone a coupé le rendu 3D : recharge la page."); loadEl.style.display = "flex"; });

const keyedGrid = await loadGrid('/data/height.bin', '/data/height.json');
const field = createKeyedField(biome, keyedGrid);
const grade = OPT ? R.createGradePass(THREE, biome, { srgb8: true, sharp: QD.has("sharp") ? +QD.get("sharp") : 0.6 })
  : canFloatRT ? R.createGradePass(THREE, biome) : null;
// internal (scene) pixel ratio for opt mode
// v62 (SmiR 2026-10-10 14:38, compare.html A vs B: no visible difference): the canvas stays at min(2, device); the scene is
// drawn at internal ratio 1.5 and upscaled with EASU-style Catmull-Rom + RCAS 0.8. Native: ?native=1 or ?pr=2 (?pr=<n> = internal n).
const NATIVE = QD.get("native") === "1";
const PRQ = QD.has("pr") && isFinite(+QD.get("pr")) ? +QD.get("pr") : null;
const INT_DEFAULT = 1.5;
const capInt = OPT ? Math.min(pr, NATIVE || PRMAX ? pr : PRQ ?? INT_DEFAULT) : pr;
const ups = OPT && QD.get("ups") !== "bilinear" ? createEasuRcas(THREE, { sharp: QD.has("rcas") ? +QD.get("rcas") : 0.8 }) : null;   // ?ups=bilinear = the grade's bilinear + RCAS 0.6 path
const minInt = Math.min(capInt, 1.25);
let capDyn = capInt, intPr = capInt;
const dynOn = OPT && QD.get("dyn") !== "0";
// SmiR 2026-10-10 14:02: the phone default is ratio 2 at full quality even at 22-25 fps. The controller never touches the
// detail layer or any quality feature; below the cap only as an emergency floor (< 15 fps for > 5 s), back to 2 asap.
const ares = dynOn && QD.get("lockq") !== "1" ? createAdaptiveRes({ cap: capInt, floor: minInt }) : null;
const SPRINT_DIP = QD.get("sprintdip") === "1";   // the old sprint dip (0.85x cap while running) is off by default: never below 2 by default
window.__ares = ares;
if (OPT) grade.scale = intPr / pr;
// one frame of the scene: below the canvas ratio through the EASU + RCAS upscaler, else native (grade only)
const drawScene = () => {
  if (!grade) return renderer.render(world, camera);
  if (ups && intPr < pr - 0.01) return ups.render(renderer, world, camera, grade, intPr / pr);
  grade.scale = intPr / pr; grade.render(renderer, world, camera);
};
const rig = R.createCameraRig(biome);

const world = new THREE.Scene();
const sky = R.createSkySphere(THREE, biome, skyTex, 300);   // at infinity: follows the camera (see frame loop)
world.add(sky);
try { await (await import("/live/sky1/sky-t7.mjs?v=58")).mountSky({ THREE, R, biome, sky }); } catch (err) { console.warn("sky1", err); }   // sky job (2026-10-09): guarded, old sky stays on failure
sky.traverse((o) => {
  const mats = o.material ? [].concat(o.material) : [];
  for (const m of mats) {
    for (const k of Object.keys(m)) if (m[k] && m[k].isTexture) m[k].anisotropy = aniso;
    if (m.uniforms) for (const k of Object.keys(m.uniforms)) {
      const t = m.uniforms[k] && m.uniforms[k].value;
      if (t && t.isTexture) t.anisotropy = aniso;
    }
  }
});
const ground = new THREE.Mesh(new THREE.BufferGeometry(), R.createGroundMaterial(THREE, biome, albedo, normals, detail));
patchHeightSplat(ground.material, field.hLo, field.hHi);
// quality ladder: 1) parallax + self-shadow off (normal + bevel only), 2) then lower the pixel ratio
const groundU = ground.material.uniforms;
if (OPT) {
  groundU.uGOpt.value = 1;
  groundU.uGroundPomFade.value = 10; groundU.uGroundPomSteps.value = 6;     // POM: 3-6 steps by view angle, 0 beyond 10 m
  // plate means (linear) = their 1x1 mip, as uniforms: no textureLod per pixel
  const s2l = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const lut = new Float32Array(256).map((_, i) => s2l(i / 255));
  for (let L = 0; L < 8; L++) {
    let r = 0, g = 0, b = 0; const o = L * 1024 * 1024 * 4, n = 1024 * 1024;
    for (let i = 0; i < n; i += 7) { r += lut[albedoBytes[o + i * 4]]; g += lut[albedoBytes[o + i * 4 + 1]]; b += lut[albedoBytes[o + i * 4 + 2]]; }
    const k = Math.ceil(n / 7); groundU.uGroundMean.value[L].set(r / k, g / k, b / k);
  }
}
const setPom = (on) => { groundU.uGroundPom.value = on && biome.ground.relief.normalPacking === "xyh" ? 1 : 0; };
ground.frustumCulled = false;
world.add(ground);
// ---- step 8 (lossless, A/B-proven): ?hr8=0 / ?pre=1 switches. window.__groundFill({ hr8, pre }) flips them live (bench rows).
const heightTex = (() => {   // R8 copy of the height channel (normal.b): the same bytes, 1/4 of the bandwidth per POM read
  const n = 1024 * 1024 * 8, h = new Uint8Array(n);
  for (let i = 0; i < n; i++) h[i] = normalBytes[i * 4 + 2];
  const t = new THREE.DataArrayTexture(h, 1024, 1024, 8);
  t.format = THREE.RedFormat; t.type = THREE.UnsignedByteType; t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = normals.anisotropy; t.needsUpdate = true; return t;
})();
const groundPre = new THREE.Mesh(ground.geometry, new THREE.ShaderMaterial({   // depth-only pass, the ground's own vertex code
  glslVersion: ground.material.glslVersion, vertexShader: ground.material.vertexShader,
  fragmentShader: "void main() {}", colorWrite: false, side: ground.material.side }));
groundPre.frustumCulled = false; groundPre.renderOrder = 0.5; groundPre.visible = false;
Object.defineProperty(groundPre, "geometry", { get: () => ground.geometry, set: () => {}, configurable: true });   // same buffers, same frame (no 1-frame lag on terrain swaps)
world.add(groundPre);
window.__groundFill = (o = {}) => {
  const m = ground.material, d = { ...(m.defines || {}) };
  if (o.hr8 != null) { if (o.hr8) { d.G_HR8 = 1; m.uniforms.uGroundH.value = heightTex; } else delete d.G_HR8; m.defines = d; m.needsUpdate = true; }
  if (o.pre != null) groundPre.visible = !!o.pre;
  return { hr8: !!(m.defines && m.defines.G_HR8), pre: groundPre.visible };
};
window.__groundFill({ hr8: QD.get("hr8") === "1", pre: QD.get("pre") !== "0" });   // PRE default ON (phone v4: -5.8 ms, spread 0.5); HR8 stays a switch

const camera = new THREE.PerspectiveCamera(biome.camera.fovBase ?? 58, innerWidth / innerHeight, rs.near, rs.far);
camera.rotation.order = "YXZ";
// Towers load after the ground. A failure warns and leaves the dune walk running.
let objs = { collide() {}, update() {} };
try {
  objs = await mountObjects({ THREE, R, biome, field, world, camera, renderer });
} catch (err) {
  window.__objError = String(err && err.stack ? err.stack : err);
  console.warn("objects", err);
}
// mesas (2026-10-09): guarded, the scene runs unchanged on failure
try {
  const mz = await (await import("./mesas/mesas-v11.mjs?v=scene-strict")).mountMesas({ THREE, R, biome, field, world, camera, renderer });
  const o0 = objs, c0 = o0.collide.bind(o0), u0 = o0.update.bind(o0);
  objs = Object.assign({}, o0, { collide: (s) => { c0(s); mz.collide(s); c0(s); }, update: (c) => { u0(c); mz.update(c); } });
} catch (err) { window.__mesaError = String(err && err.stack ? err.stack : err); console.warn("mesas", err); }

// staging step 3 (2026-10-10): big soft transparent sheets (sand veils, god-rays) at half resolution, composited in the
// grade pass (opt path only). OFF by default: measured coverage is tiny (veils <= 0.16 screen, god-rays <= 0.05), so the
// extra depth texture + composite would cost more than it saves on a tiler. ?soft=1 turns it on for A/B; ?softdiv=N.
const SOFT_NAMES = ["air-sand-veils", "sky1-godrays"];
const softWire = () => {
  if (!grade || !grade.addSoft || QD.get("soft") !== "1") return [];
  if (QD.has("softdiv")) grade.softDiv = +QD.get("softdiv");
  const got = []; world.traverse((o) => { if (SOFT_NAMES.includes(o.name) && grade.addSoft(o)) got.push(o.name); });
  return got;
};
window.__soft = softWire();
setTimeout(() => { window.__soft = window.__soft.concat(softWire()); }, 4000);

// staging step 3: sand-grain vertex cull (opt path). 160k grain vertices each ran the full vertex shader (5 texture fetches +
// ~150 ALU) every frame, although ~85 % are off screen (portrait FOV) or dead (burst grains between gusts, field grains past
// their fade). A grain whose head and tail are both provably invisible (same decision for both ends: it uses only per-grain
// values) is sent outside the clip volume before any fetch. Visible grains are untouched. ?gcull=0 for A/B.
const grainCull = () => {
  if (!OPT) return "off";
  let r = "none";
  world.traverse((o) => {
    if (o.name !== "air-sand-grains" || !o.material || !o.material.isShaderMaterial || o.material.userData.gcull) return;
    const m = o.material, vs = m.vertexShader;
    const mm = vs.match(/if \(burst < 0\.5\) xz = mod\(xz - uCam\.xz \+ ([\d.]+), ([\d.]+)\) - [\d.]+ \+ uCam\.xz;/);
    if (!mm || !/void main\(\)\{/.test(vs) || !/float G1 = /.test(vs)) { r = "anchor-missing"; console.warn("grain cull: shader changed, not patched"); return; }
    const R = +mm[1], fade = (0.95 * R + 0.1).toFixed(2);
    m.vertexShader = vs.replace("void main(){", "uniform float uGCull;\nvoid main(){").replace(mm[0], mm[0] + `
        if (uGCull > 0.5) {   // grain cull (staging step 3): both ends share this decision
          vec4 vc = viewMatrix * vec4(xz.x, uCam.y, xz.y, 1.0);
          float zf = -vc.z + 5.0;                                  // depth upper bound for any lift / pitch
          bool dead = burst > 0.5 ? G1 <= 0.0 : length(xz - uCam.xz) >= ${fade};
          dead = dead || zf < 2.0 || abs(projectionMatrix[0][0] * vc.x) > zf * 1.1 + 0.5;
          if (dead) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); vA = 0.0; vMie = 0.0; vSandUv = vec2(0.0); vSprayUv = vec2(0.0); return; }
        }`);
    m.uniforms.uGCull = { value: QD.get("gcull") === "0" ? 0 : 1 };
    m.userData.gcull = true; m.needsUpdate = true; r = "patched R=" + R;
  });
  return r;
};
window.__gcull = grainCull();

// step 7 (2026-10-10, lossless): draw order. The sky dome (renderOrder -1) was drawn FIRST over the whole screen and the ground
// before the towers / mesas, so every sky pixel behind the ground and every ground pixel behind a tower was fully shaded and
// then overwritten. Now: opaques (towers, mesas, slabs...) -> ground -> sky dome (at the far plane, depth-tested: it only
// shades the pixels nothing covers) -> opaque meshes that do not write depth (kept after the sky, as before) -> transparents.
// Depth testing makes the result order-independent: same pixels, less shading. ?order=0 = old order (A/B).
const ORDER = QD.get("order") !== "0";
const drawOrder = () => {
  if (!ORDER) return 0;
  let n = 0;
  ground.renderOrder = 1; sky.renderOrder = 2;
  world.traverse((o) => {
    if (o === sky || o === ground || !(o.isMesh || o.isInstancedMesh) || !o.material) return;
    const ms = [].concat(o.material);
    if (ms.every((m) => !m.transparent && m.depthWrite === false) && o.renderOrder <= 2) { o.renderOrder = 3; n++; }
  });
  return n;
};
window.__order = { on: ORDER, noDepthOpaques: drawOrder() };
// perf self-report for the object gate (tools/object-gate runtime rows "perf: ...", METHOD phone-perf)
window.__perfReport = () => {   // v62: cap = default internal ratio, canvasCap = canvas ratio cap, upscale = easu-rcas | native
  let maxOpaque = -Infinity;
  world.traverse((o) => { if (o === sky || o === ground || !o.isMesh || !o.visible || !o.material) return; const ms = [].concat(o.material);
    if (ms.every((m) => !m.transparent && m.depthWrite !== false)) maxOpaque = Math.max(maxOpaque, o.renderOrder); });
  return { canvasRatio: renderer.getPixelRatio(), dpr: DPR, cap: capInt, canvasCap: prCap, internalRatio: +intPr.toFixed(3), upscale: OPT && capInt < pr - 0.01 ? (ups ? ups.kind : "bilinear-rcas") : "native", rcas: ups ? ups.sharp : null, detailOn: groundU.uGDetOn.value > 0, opt: OPT, adaptive: !!(typeof ares !== "undefined" && ares), adaptiveCanDropDetail: !!(ares && (ares.canDropDetail !== false || ares.ladder.some((l) => !l.detail))), adaptiveDropsBelowCapAbove: ares && ares.policy ? ares.policy.emergencyFps : null, sprintDip: typeof SPRINT_DIP !== "undefined" ? SPRINT_DIP : true, detailNear: groundU.uGDetNear.value, detailFar: groundU.uGDetFar.value,
    skyOrder: sky.renderOrder, groundOrder: ground.renderOrder, maxOpaqueOrder: maxOpaque, skyDepthTest: sky.material.depthTest !== false };
};

setTimeout(() => (window.__order.later = drawOrder()), 3000); setTimeout(() => (window.__order.later2 = drawOrder()), 10000);

// ---------------------------------------------------------------- terrain streaming (worker, main-thread fallback)
let worker = null, pending = false, builtKey = "", reqId = 0;
let mainBuild = null;
function applyMesh(m) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(m.positions, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(m.normals, 3));
  g.setIndex(new THREE.BufferAttribute(m.indices, 1));
  const old = ground.geometry; ground.geometry = g; old.dispose();
  window.__terrain = { cells: m.cells, tris: m.tris };
  pending = false;
}
// Staging: main-thread mesh from the keyed field. The live worker still builds the old dunes.
function requestTerrain(x, z, force) {
  const C = field.cellM, k = `${Math.floor(x / C)},${Math.floor(z / C)}`;
  if ((k === builtKey && !force) || pending) return;
  builtKey = k; pending = true;
  if (!mainBuild) mainBuild = createAllRoundBuilder(field);
  applyMesh(mainBuild(x, z));
}

// ---------------------------------------------------------------- viewer state
// optional pose in the URL (close-up checks): ?x=&z=&yaw=&pitch=&eye=&hud=0
const Q = new URLSearchParams(location.search);
const qn = (k, d) => (Q.has(k) && isFinite(+Q.get(k)) ? +Q.get(k) : d);
const hasPose = Q.has("x") || Q.has("z");
const keyedPose = field.camera;
const spawn = !hasPose && keyedPose ? keyedPose : (!hasPose && objs.spawn ? objs.spawn : null);
const EYE = qn("eye", spawn ? spawn.eye : 3.0);
const st = {
  x: qn("x", spawn ? spawn.x : field.avenueX(0)),
  z: qn("z", spawn ? spawn.z : 0),
  yaw: qn("yaw", spawn ? spawn.yaw : 0),
  pitch: qn("pitch", spawn ? spawn.pitch : -2),
  y: 0,
};
if (Q.get("pom") === "0") setPom(false);
if (grade && Q.get("grain") === "0") grade.material.uniforms.uGrain.value = 0;
const lockQ = Q.get("lockq") === "1";
const DET_NEAR = groundU.uGDetNear.value, DET_FAR = groundU.uGDetFar.value;   // checks: keep the quality fixed
window.__quality = { pr, pom: groundU.uGroundPom.value };
if (Q.get("hud") === "0") for (const id of ["tag", "fps", "help", "run"]) $(id).style.display = "none";
st.y = field.surfaceHeight(st.x, st.z) + EYE;
window.__st = st;
window.__gdTHREE = THREE;
window.__gdProf = { world, grade, sky, ground, renderer, camera, render: drawScene };
window.__gd = { field, camera, groundU, rig, detailSize: DS, tileM: biome.ground.detail.tileM, plateTileM: biome.ground.tileMeters, aniso };
if (QD.get("gdbg") === "1") groundU.uGDetDbg.value = 1;
const WALK = 6, RUN = 19;
let running = false;
const runBtn = $("run");
const setRun = (v) => { running = v; runBtn.classList.toggle("on", v); };
runBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); setRun(!running); });

// touch: left half = virtual joystick, right half = look
const stickEl = $("stick"), knob = $("knob");
let stick = null, look = null;
const move = { x: 0, y: 0 };
const LOOK_SENS = 0.22; // deg per css px
canvas.addEventListener("pointerdown", (e) => {
  hideHelp();
  if (e.pointerType === "mouse") { look = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); return; }
  if (e.clientX < innerWidth * 0.5 && !stick) {
    stick = { id: e.pointerId, cx: e.clientX, cy: e.clientY };
    stickEl.style.left = e.clientX + "px"; stickEl.style.top = e.clientY + "px"; stickEl.style.display = "block";
    knob.style.transform = "translate(0,0)";
  } else if (!look) {
    look = { id: e.pointerId, x: e.clientX, y: e.clientY };
  }
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (stick && e.pointerId === stick.id) {
    let dx = e.clientX - stick.cx, dy = e.clientY - stick.cy; const r = Math.hypot(dx, dy), max = 50;
    if (r > max) { dx *= max / r; dy *= max / r; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    move.x = dx / max; move.y = -dy / max;
  } else if (look && e.pointerId === look.id) {
    st.yaw += (e.clientX - look.x) * LOOK_SENS;
    st.pitch = Math.max(-75, Math.min(75, st.pitch - (e.clientY - look.y) * LOOK_SENS));
    look.x = e.clientX; look.y = e.clientY;
  }
});
const endPtr = (e) => {
  if (stick && e.pointerId === stick.id) { stick = null; move.x = move.y = 0; stickEl.style.display = "none"; }
  if (look && e.pointerId === look.id) look = null;
};
canvas.addEventListener("pointerup", endPtr);
canvas.addEventListener("pointercancel", endPtr);

// desktop keys
const keys = new Set();
addEventListener("keydown", (e) => { keys.add(e.code); if (e.code === "ShiftLeft" || e.code === "ShiftRight") setRun(true); hideHelp(); });
addEventListener("keyup", (e) => { keys.delete(e.code); if (e.code === "ShiftLeft" || e.code === "ShiftRight") setRun(false); });
addEventListener("blur", () => keys.clear());

const helpEl = $("help");
let helpTimer = setTimeout(hideHelp, 9000);
function hideHelp() { helpEl.style.opacity = "0"; clearTimeout(helpTimer); }

addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
});

// ---------------------------------------------------------------- loop
window.__renderer = renderer;
window.__measurePasses = () => {
  const info = renderer.info;
  const was = renderer.shadowMap.enabled;
  const shot = () => {
    info.reset();
    drawScene();
    return { calls: info.render.calls, tris: info.render.triangles };
  };
  renderer.shadowMap.enabled = false;
  info.reset();
  renderer.render(world, camera);
  const scenePass = { calls: info.render.calls, tris: info.render.triangles };
  const mainPass = shot();
  renderer.shadowMap.enabled = true;
  const both = shot();
  renderer.shadowMap.enabled = was;
  return {
    scene: scenePass,
    main: mainPass,
    both,
    shadow: {
      calls: Math.max(0, both.calls - mainPass.calls),
      tris: Math.max(0, both.tris - mainPass.tris),
    },
  };
};
const fpsEl = $("fps");
let last = performance.now(), acc = 0, frames = 0, slowWindows = 0, fastWindows = 0;
function frame(now) {
  const rawDt = (now - last) / 1000, dt = Math.min(0.05, rawDt); last = now;
  let mx = move.x, my = move.y;
  if (keys.has("KeyW") || keys.has("KeyZ") || keys.has("ArrowUp")) my += 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) my -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) mx += 1;
  if (keys.has("KeyA") || keys.has("KeyQ") || keys.has("ArrowLeft")) mx -= 1;
  const mag = Math.min(1, Math.hypot(mx, my));
  const speed = (running ? RUN : WALK) * mag;
  if (mag > 0.01) {
    const n = Math.hypot(mx, my), f = R.headingToDir(st.yaw, 0), r = R.headingToDir(st.yaw + 90, 0);
    st.x += (f[0] * my + r[0] * mx) / n * speed * dt;
    st.z += (f[2] * my + r[2] * mx) / n * speed * dt;
  }
  objs.collide(st);
  const targetY = field.surfaceHeight(st.x, st.z) + EYE;
  st.y += (targetY - st.y) * (1 - Math.exp(-10 * dt));
  if (st.y < targetY - 0.8) st.y = targetY - 0.8; // never dip into a crest
  requestTerrain(st.x, st.z);

  const cam = rig.update(dt, Math.min(1, speed / RUN));
  const fovQ = (QD.get("fov") && isFinite(+QD.get("fov"))) ? +QD.get("fov") : cam.fovDeg;
  camera.fov = fovQ; camera.updateProjectionMatrix();
  camera.position.set(st.x, st.y, st.z);
  sky.position.copy(camera.position);   // no black sky beyond 300 m from the origin
  const rollQ = (QD.get("roll") && isFinite(+QD.get("roll"))) ? +QD.get("roll") : 0;
  camera.rotation.set((st.pitch * Math.PI) / 180, (-st.yaw * Math.PI) / 180, (rollQ * Math.PI) / 180);

  objs.update(camera);
  if (dynOn) {   // sprint / fast motion: a little lower; standing and walking: the cap (if the fps allows)
    const want = Math.max(minInt, SPRINT_DIP && running && mag > 0.3 ? Math.min(capDyn, capInt * 0.85) : capDyn);
    if (Math.abs(want - intPr) > 0.01) intPr = want;
  }
  drawScene();

  // fps + gentle auto quality (drop pixel ratio if the phone can't hold ~45 fps)
  if (ares && ares.frame(rawDt * 1000, now)) {
    capDyn = ares.level.ratio;
    // quality-first: the detail layer reach is never changed here (ares levels always have detail: true)
  }
  acc += rawDt; frames++;   // real time (dt is capped for movement only)
  if (acc >= 1) {
    const fps = frames / acc;
    fpsEl.textContent = `${fps.toFixed(0)} fps`;
    window.__fps = fps;
    if (OPT) {
      if (dynOn && !lockQ) {
        // step 5: decisions moved to runtime/adaptive-res.mjs (fed every frame above)
      }
    } else if (QD.get("legacyq") === "1" && fps < 42 && !lockQ && (groundU.uGroundPom.value > 0 || pr > 1)) {   // old auto-quality (drops POM / detail): only on request
      if (++slowWindows >= 2) {
        if (groundU.uGroundPom.value > 0) setPom(false);
        else if (groundU.uGDetOn.value > 0 && groundU.uGDetFar.value > 20) { groundU.uGDetNear.value = 8; groundU.uGDetFar.value = 16; }   // detail: shorter reach before the pixel ratio
        else { pr = Math.max(1, pr - 0.25); renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight, false); }
        slowWindows = 0;
      }
    } else slowWindows = 0;
    window.__quality = { pr, pom: groundU.uGroundPom.value, detFar: groundU.uGDetFar.value, opt: OPT, intPr: +intPr.toFixed(3), capDyn };
    if (OPT && QD.get("hud") !== "0") fpsEl.textContent = `${(ares && ares.last ? ares.last.fps : fps).toFixed(0)} fps · ${intPr.toFixed(2)}x`;
    if (ares) window.__quality.ares = { ...ares.last, index: ares.index, changes: ares.changes };
    acc = 0; frames = 0;
  }
  requestAnimationFrame(frame);
}

requestTerrain(st.x, st.z, true);
// wait for the first terrain mesh before showing the scene
await new Promise((res) => { const w = () => (window.__terrain ? res() : setTimeout(w, 30)); w(); });
loadEl.style.display = "none";
// Staging only. Live objects bury a plinth 3–6 m. Feet sit 0.2 m in the keyed field.
function flushSeats() {
  const rows = [];
  const m4 = new THREE.Matrix4();
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const note = (name, sink) => rows.push({ name, sink: Math.round(sink * 1000) / 1000 });
  world.traverse((o) => {
    const n = o.name || "";
    if (o.isInstancedMesh && n.startsWith("inst-")) {
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m4);
        m4.decompose(p, q, sc);
        const g = field.surfaceHeight(p.x, p.z);
        const sink = g - p.y;
        if (sink > 0.5 || sink < -0.5) {
          p.y = g - 0.2;
          m4.compose(p, q, sc);
          o.setMatrixAt(i, m4);
        }
        note(n + "#" + i, g - p.y);
      }
      o.instanceMatrix.needsUpdate = true;
    } else if (o.isMesh && (n.startsWith("spire") || n.startsWith("mesa-"))) {
      o.updateWorldMatrix(true, false);
      const e = o.matrixWorld.elements;
      const g = field.surfaceHeight(e[12], e[14]);
      const sink = g - e[13];
      if (sink > 0.5 || sink < -0.5) {
        if (o.matrixAutoUpdate === false) {
          o.matrix.elements[13] += (g - 0.2) - e[13];
          o.matrixWorld.elements[13] += (g - 0.2) - e[13];
        } else {
          o.position.y += (g - 0.2) - e[13];
        }
      }
      o.updateWorldMatrix(true, false);
      const e2 = o.matrixWorld.elements;
      note(n, field.surfaceHeight(e2[12], e2[14]) - e2[13]);
    }
  });
  const sinks = rows.map((r) => r.sink);
  window.__seat = {
    n: rows.length,
    maxAbs: sinks.length ? Math.round(Math.max(...sinks.map((v) => Math.abs(v))) * 1000) / 1000 : null,
    rows: rows.slice(0, 40),
  };
}
flushSeats();
window.__ready = true;
if (ares) ares.markReady(performance.now());
requestAnimationFrame(frame);

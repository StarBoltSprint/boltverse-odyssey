// Vision hero. One instanced mesh, no emissive. The basis stays in the matrix.
import * as THREE from "./three.module.js";
import { GLTFLoader } from "./objects1/jsm/loaders/GLTFLoader.js";

const Q = new URLSearchParams(location.search);
const meta = await fetch("./objects1/vision/tower-meta.json").then((r) => r.json());
const wait = () => new Promise((res) => {
  const t = setInterval(() => {
    if (window.__ready && window.__renderer) { clearInterval(t); res(); }
  }, 200);
});
await wait();

const renderer = window.__renderer;
let scene = null;
const orig = renderer.render.bind(renderer);
renderer.render = function (s, c) {
  if (s && s.isScene && !scene) scene = s;
  if (window.__fusionCam && c && c.isPerspectiveCamera) window.__fusionCam.value.copy(c.position);
  if (window.__fusionPose && c && c.isPerspectiveCamera) {
    const p = window.__fusionPose;
    c.matrixAutoUpdate = true;
    c.position.set(p.x, p.y, p.z);
    c.up.set(0, 1, 0);
    c.lookAt(p.tx, p.ty, p.tz);
    if (p.fov) c.fov = p.fov;
    c.updateProjectionMatrix();
    c.updateMatrixWorld(true);
    if (window.__fusionCam) window.__fusionCam.value.copy(c.position);
  } else if (Q.has("visionKey") && window.__ogTags && window.__fusionFit && c && c.isPerspectiveCamera && !window.__visionFree) {
    // Inside the blade the sheet was a dark plane. A pose already outside stays,
    // so the close shot can read the ladder. A pose a few metres off the glass
    // (the low portrait) pulls back along its own direction until the tower fits.
    const fit = window.__fusionFit;
    const min = new THREE.Vector3(...fit.min);
    const max = new THREE.Vector3(...fit.max);
    const box = new THREE.Box3(min, max);
    const center = min.clone().add(max).multiplyScalar(0.5);
    const size = max.clone().sub(min);
    const radius = 0.5 * Math.hypot(size.x, size.y, size.z);
    const gap = box.distanceToPoint(c.position);
    const inside = box.containsPoint(c.position);
    if (inside || gap < 10) {
      const dir = c.position.clone().sub(center);
      if (dir.lengthSq() < 4) dir.copy(new THREE.Vector3(...(meta.toward || [0, 0, 1])));
      dir.normalize();
      let dist = 12;
      if (!inside && gap >= 2.5) {
        const fov = ((c.fov || 58) * Math.PI) / 180;
        const aspect = c.aspect || 0.45;
        const fovX = 2 * Math.atan(Math.tan(fov / 2) * aspect);
        const half = Math.min(fov, fovX) / 2;
        dist = (radius / Math.max(0.05, Math.sin(half))) * 1.12;
      }
      const p = center.clone();
      for (let i = 0; i < 80; i++) {
        p.addScaledVector(dir, Math.max(4, dist / 20));
        if (!box.containsPoint(p) && box.distanceToPoint(p) >= dist) break;
      }
      c.matrixAutoUpdate = true;
      c.position.copy(p);
      c.up.set(0, 1, 0);
      c.lookAt(center);
      c.updateProjectionMatrix();
      c.updateMatrixWorld(true);
      if (window.__fusionCam) window.__fusionCam.value.copy(c.position);
    }
  } else if (Q.has("visionKey") && !window.__ogTags && !window.__visionFree && c && c.isPerspectiveCamera && meta.keycam) {
    c.matrixAutoUpdate = false;
    c.matrix.fromArray(meta.keycam.mw);
    c.matrix.decompose(c.position, c.quaternion, c.scale);
    c.matrixWorld.copy(c.matrix);
    c.fov = meta.keycam.fov || 80;
    c.aspect = (meta.keycam.width || 1280) / (meta.keycam.height || 720);
    c.updateProjectionMatrix();
  }
  return orig(s, c);
};
for (let i = 0; i < 4; i++) await new Promise((r) => requestAnimationFrame(r));
if (!scene) throw new Error("vision tower: no scene");

const gltf = await new GLTFLoader().loadAsync("./objects1/vision/tower.glb?v=fusion10");
let src = null;
gltf.scene.traverse((o) => { if (!src && o.isMesh) src = o; });
const aniso = renderer.capabilities.getMaxAnisotropy();
const albedo = new THREE.TextureLoader().load("./objects1/vision/albedo.png?v=fusion10");
albedo.colorSpace = THREE.SRGBColorSpace;
albedo.anisotropy = aniso;
albedo.flipY = false;
albedo.wrapS = THREE.ClampToEdgeWrapping;
albedo.wrapT = THREE.ClampToEdgeWrapping;
albedo.minFilter = THREE.LinearMipmapLinearFilter;
albedo.magFilter = THREE.LinearFilter;
albedo.generateMipmaps = true;
const normal = new THREE.TextureLoader().load("./objects1/vision/normal.png?v=fusion10");
normal.colorSpace = THREE.NoColorSpace || THREE.LinearSRGBColorSpace;
normal.anisotropy = aniso;
normal.flipY = false;
normal.wrapS = THREE.ClampToEdgeWrapping;
normal.wrapT = THREE.ClampToEdgeWrapping;
normal.minFilter = THREE.LinearMipmapLinearFilter;
normal.magFilter = THREE.LinearFilter;
normal.generateMipmaps = true;

// Unlit Imagine plate. MeshStandard multiplied this pre-lit albedo by the page
// sun. The front normal faces away from that sun, so the lit ortho was a
// near-black maroon (gate Lab L* 0.1) while the albedo shade stayed bright.
const lit = new THREE.MeshBasicMaterial({ map: albedo, toneMapped: false });
const relief = new THREE.MeshStandardMaterial({
  color: 0x8a8a8a, normalMap: normal, metalness: 0, roughness: 1,
  emissive: new THREE.Color(0x000000),
});
const unlit = new THREE.MeshBasicMaterial({ map: albedo });
// Phase 2 only. A missing or unready plate must not touch the lit shader.
let nearDoc = { ready: false };
try {
  const nr = await fetch("./objects1/vision/near.json?v=fusion7");
  if (nr.ok) nearDoc = await nr.json();
} catch (e) { nearDoc = { ready: false }; }
if (nearDoc && nearDoc.ready) {
  const nearTex = new THREE.TextureLoader().load("./objects1/vision/near-atlas.png?v=fusion7");
  nearTex.flipY = false;
  nearTex.colorSpace = THREE.SRGBColorSpace;
  nearTex.wrapS = THREE.ClampToEdgeWrapping;
  nearTex.wrapT = THREE.ClampToEdgeWrapping;
  const fade = nearDoc.crossfade_m || [40, 15];
  const uCam = { value: new THREE.Vector3() };
  window.__fusionCam = uCam;
  lit.onBeforeCompile = (sh) => {
    sh.uniforms.uNear = { value: nearTex };
    sh.uniforms.uCam = uCam;
    sh.uniforms.uFade0 = { value: fade[0] };
    sh.uniforms.uFade1 = { value: fade[1] };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vFusionWorld;")
      .replace("#include <project_vertex>", `#include <project_vertex>
vec4 fusionWp = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
fusionWp = instanceMatrix * fusionWp;
#endif
fusionWp = modelMatrix * fusionWp;
vFusionWorld = fusionWp.xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
uniform sampler2D uNear;
uniform vec3 uCam;
uniform float uFade0;
uniform float uFade1;
varying vec3 vFusionWorld;`)
      .replace("#include <map_fragment>", `#include <map_fragment>
{
  float fusionDist = distance(uCam, vFusionWorld);
  float fusionK = smoothstep(uFade0, uFade1, fusionDist);
  vec4 fusionNear = texture2D(uNear, vMapUv);
  diffuseColor.rgb = mix(diffuseColor.rgb, fusionNear.rgb, fusionK);
}`);
  };
  lit.needsUpdate = true;
}
const mesh = new THREE.InstancedMesh(src.geometry, lit, 1);
mesh.name = "inst-tower-hero";
mesh.castShadow = true;
mesh.receiveShadow = true;
mesh.frustumCulled = false;
const M = new THREE.Matrix4();
// This solid is local metres. The staged hero uses right/up/toward/origin.
// meta.cameraSpace on this file is the key camera. Applying it moves the
// tower off the staged footprint (placement is out of scope).
if (meta.right && meta.up && meta.toward && meta.origin) {
  M.makeBasis(
    new THREE.Vector3(...meta.right),
    new THREE.Vector3(...meta.up),
    new THREE.Vector3(...meta.toward),
  );
  M.setPosition(...meta.origin);
} else if (meta.cameraSpace && meta.keycam && meta.keycam.mw) {
  M.fromArray(meta.keycam.mw);
} else {
  throw new Error("vision tower: no basis and no camera matrix");
}
mesh.setMatrixAt(0, M);
mesh.instanceMatrix.needsUpdate = true;
mesh.updateMatrixWorld(true);
// Seat the AABB on the median ground under the footprint. A pit column inside
// that footprint is lifted to the median. Outside it, the dune stays.
if (window.__zbField && typeof window.__zbField.surfaceHeight === "function") {
  const box0 = new THREE.Box3().setFromObject(mesh);
  const samples = [];
  const n = 5;
  const sx = box0.max.x - box0.min.x;
  const sz = box0.max.z - box0.min.z;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = box0.min.x + ((i + 0.5) / n) * sx;
    const z = box0.min.z + ((j + 0.5) / n) * sz;
    samples.push(window.__zbField.surfaceHeight(x, z));
  }
  samples.sort((a, b) => a - b);
  const median = samples[(samples.length / 2) | 0];
  // Seat on the highest sample. A median through a pit sinks the whole tower
  // and leaves the deep columns in the air. The plinth then lifts every
  // footprint column up to that floor, so the base is not buried either.
  const floor = samples[samples.length - 1];
  const lift = floor - box0.min.y;
  M.elements[13] += lift;
  mesh.setMatrixAt(0, M);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.updateMatrixWorld(true);
  if (mesh.geometry.boundingBox) mesh.geometry.boundingBox = null;
  window.__visionSeat = {
    lift: +lift.toFixed(3),
    baseY: +(box0.min.y + lift).toFixed(3),
    groundMin: +samples[0].toFixed(3),
    groundMedian: +median.toFixed(3),
    groundMax: +floor.toFixed(3),
  };
  const rawH = window.__zbField.surfaceHeight.bind(window.__zbField);
  const minX = box0.min.x, maxX = box0.max.x, minZ = box0.min.z, maxZ = box0.max.z;
  window.__zbField.surfaceHeight = (x, z) => {
    const h = rawH(x, z);
    if (x < minX || x > maxX || z < minZ || z > maxZ) return h;
    return Math.max(h, floor);
  };
  window.__visionPlinth = {
    floor: +floor.toFixed(3),
    median: +median.toFixed(3),
    minX: +minX.toFixed(2), maxX: +maxX.toFixed(2),
    minZ: +minZ.toFixed(2), maxZ: +maxZ.toFixed(2),
    rule: "footprint columns raised to the max sampled ground",
  };
}
const fitBox = new THREE.Box3().setFromObject(mesh);
window.__fusionFit = { min: fitBox.min.toArray(), max: fitBox.max.toArray() };
scene.add(mesh);
window.__visionTower = mesh;
// Grazing light, only while the relief shade is on, so a step reads as an edge.
const rake = new THREE.DirectionalLight(0xffffff, 0);
rake.name = "vision-rake";
{
  const right = new THREE.Vector3(...meta.right);
  const up = new THREE.Vector3(...meta.up);
  const toward = new THREE.Vector3(...meta.toward);
  const origin = new THREE.Vector3(...meta.origin);
  rake.position.copy(origin).addScaledVector(right, 90).addScaledVector(up, 50).addScaledVector(toward, 8);
  rake.target.position.copy(origin).addScaledVector(up, 70);
  scene.add(rake.target);
}
scene.add(rake);
// The static shadow fit ran before this mesh existed, so the hero cast nothing.
// A tight contact ortho (not an expanded city frustum) plus a neutral multiply.
// The colour camera does not draw the layer-1 caster. The darkening is not in the albedo.
const caster = new THREE.Mesh(src.geometry, new THREE.MeshBasicMaterial({ color: 0xffffff }));
caster.name = "vision-shadow-caster";
caster.layers.set(1);
caster.castShadow = true;
caster.frustumCulled = false;
caster.matrixAutoUpdate = false;
caster.matrix.copy(M);
caster.matrixWorld.copy(M);
scene.add(caster);
{
  let light = null;
  scene.traverse((o) => { if (!light && o.isDirectionalLight && o.castShadow && o.name === "zb-shadow") light = o; });
  scene.traverse((o) => {
    const mat = o.material;
    if (!mat || typeof mat.fragmentShader !== "string") return;
    if (mat.fragmentShader.includes("vec3(0.34, 0.36, 0.42)")) {
      mat.fragmentShader = mat.fragmentShader.replace("vec3(0.34, 0.36, 0.42)", "vec3(0.40, 0.40, 0.40)");
      mat.needsUpdate = true;
    }
  });
  if (light && light.shadow && light.shadow.camera) {
    const cam = light.shadow.camera;
    cam.layers.enable(0);
    cam.layers.enable(1);
    const applyFit = () => {
      mesh.updateMatrixWorld(true);
      light.updateMatrixWorld(true);
      light.target.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(mesh);
      const down = new THREE.Vector3().subVectors(light.target.position, light.position);
      down.y = 0;
      if (down.lengthSq() < 1e-8) down.set(0, 0, 1);
      down.normalize();
      // The gate looks ~60 m down-sun of the footprint. Spill past that so the
      // contact is on open ground, not hidden under the tower mask.
      box.expandByVector(down.clone().multiplyScalar(140));
      box.expandByVector(down.clone().multiplyScalar(-16));
      box.min.y -= 8;
      cam.position.copy(light.position);
      cam.up.set(0, 1, 0);
      cam.lookAt(light.target.position);
      cam.updateMatrixWorld(true);
      const inv = cam.matrixWorldInverse;
      const v = new THREE.Vector3();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      const xs = [box.min.x, box.max.x], ys = [box.min.y, box.max.y], zs = [box.min.z, box.max.z];
      for (const x of xs) for (const y of ys) for (const z of zs) {
        v.set(x, y, z).applyMatrix4(inv);
        x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x);
        y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
        z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z);
      }
      const pad = 8;
      cam.left = x0 - pad; cam.right = x1 + pad;
      cam.bottom = y0 - pad; cam.top = y1 + pad;
      cam.near = Math.max(0.5, -z1 - 30);
      cam.far = Math.max(cam.near + 10, -z0 + 80);
      scene.traverse((o) => {
        const u = o.material && o.material.uniforms && o.material.uniforms.uShadowDepthM;
        if (u) u.value = cam.far - cam.near;
        const on = o.material && o.material.uniforms && o.material.uniforms.uShadowOn;
        if (on) on.value = 1;
      });
      window.__visionShadow = {
        left: +cam.left.toFixed(1), right: +cam.right.toFixed(1),
        bottom: +cam.bottom.toFixed(1), top: +cam.top.toFixed(1),
        near: +cam.near.toFixed(1), far: +cam.far.toFixed(1),
        tint: [0.4, 0.4, 0.4],
      };
    };
    // The city fit runs after this module and would drop the hero from the map.
    // Re-apply whenever that fit writes the projection, then for a few frames.
    const origUpdate = cam.updateProjectionMatrix.bind(cam);
    let fitting = false;
    cam.updateProjectionMatrix = function () {
      if (fitting) return origUpdate();
      fitting = true;
      try { applyFit(); return origUpdate(); }
      finally { fitting = false; }
    };
    applyFit();
    origUpdate();
    light.shadow.needsUpdate = true;
    renderer.shadowMap.needsUpdate = true;
    let frames = 0;
    const tick = () => {
      applyFit();
      origUpdate();
      light.shadow.needsUpdate = true;
      renderer.shadowMap.needsUpdate = true;
      if (++frames < 12) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

const hidden = [];
window.__setShade = (mode) => {
  mesh.material = mode === "relief" ? relief : mode === "albedo" ? unlit : lit;
  rake.intensity = mode === "relief" ? 4.2 : 0;
  const isolate = mode === "relief" || mode === "albedo";
  if (isolate && !hidden.length) {
    scene.traverse((o) => {
      if (o !== mesh && o.isMesh && o.visible) { o.visible = false; hidden.push(o); }
    });
  }
  if (!isolate) {
    hidden.forEach((o) => { o.visible = true; });
    hidden.length = 0;
  }
  return mode;
};

const foot = [meta.origin[0], meta.origin[2]];
if (window.__air && Array.isArray(window.__air.feet)) window.__air.feet.unshift(foot);
const hw = 24, hd = 14;
const ox = meta.origin[0], oz = meta.origin[2];
const solid = [[ox - hw, oz - hd], [ox + hw, oz - hd], [ox + hw, oz + hd], [ox - hw, oz + hd]];
window.__objectsGate = window.__objectsGate || {};
window.__objectsGate.footprints = window.__objectsGate.footprints || [];
window.__objectsGate.footprints.unshift({ id: "tower-hero", solid });
window.__objectsGate.texel = window.__objectsGate.texel || {};
window.__objectsGate.texel["tower-hero"] = { pxPerM: meta.uniquePxPerM, detailPxPerM: meta.detailPxPerM };
window.__visionPerf = { draws: 1, tris: src.geometry.index ? src.geometry.index.count / 3 : src.geometry.attributes.position.count / 3, texMiB: 11 };
window.__visionTower = mesh;
window.__visionSilhouette = (x, y, z, tx, ty, tz, W, H) => {
  const cam = new THREE.PerspectiveCamera(58, W / H, 0.2, 4000);
  cam.position.set(x, y, z);
  cam.lookAt(tx, ty, tz);
  cam.updateMatrixWorld(true);
  const vp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  const inst = new THREE.Matrix4();
  mesh.getMatrixAt(0, inst);
  const pos = src.geometry.attributes.position;
  const index = src.geometry.index;
  const n = index ? index.count : pos.count;
  const p = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const scr = [[0, 0], [0, 0], [0, 0]];
  const bits = new Uint8Array(W * H);
  for (let t = 0; t < n; t += 3) {
    let ok = true;
    for (let k = 0; k < 3; k++) {
      const vi = index ? index.getX(t + k) : t + k;
      p[k].fromBufferAttribute(pos, vi).applyMatrix4(inst).applyMatrix4(vp);
      if (p[k].z < -1 || p[k].z > 1) ok = false;
      scr[k][0] = (p[k].x * 0.5 + 0.5) * W;
      scr[k][1] = (1 - (p[k].y * 0.5 + 0.5)) * H;
    }
    if (!ok) continue;
    const ys = scr.map((s) => s[1]);
    const y0 = Math.max(0, Math.floor(Math.min(...ys)));
    const y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)));
    for (let yy = y0; yy <= y1; yy++) {
      const xs = [];
      for (let e = 0; e < 3; e++) {
        const a = scr[e], b = scr[(e + 1) % 3];
        if ((a[1] <= yy && b[1] > yy) || (b[1] <= yy && a[1] > yy)) {
          const u = (yy - a[1]) / ((b[1] - a[1]) || 1e-6);
          xs.push(a[0] + (b[0] - a[0]) * u);
        }
      }
      if (xs.length < 2) continue;
      const xa = Math.max(0, Math.floor(Math.min(...xs)));
      const xb = Math.min(W - 1, Math.ceil(Math.max(...xs)));
      for (let xx = xa; xx <= xb; xx++) bits[yy * W + xx] = 1;
    }
  }
  return Array.from(bits);
};

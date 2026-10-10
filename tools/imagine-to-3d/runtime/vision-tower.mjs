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
  // Object-gate sets __ogTags before any script. Key-compare does not. Lock only the key shot.
  if (Q.has("visionKey") && !window.__ogTags && !window.__visionFree && c && c.isPerspectiveCamera && meta.keycam) {
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

const gltf = await new GLTFLoader().loadAsync("./objects1/vision/tower.glb");
let src = null;
gltf.scene.traverse((o) => { if (!src && o.isMesh) src = o; });
const aniso = renderer.capabilities.getMaxAnisotropy();
const albedo = new THREE.TextureLoader().load("./objects1/vision/albedo.png");
albedo.colorSpace = THREE.SRGBColorSpace;
albedo.anisotropy = aniso;
albedo.minFilter = THREE.LinearMipmapLinearFilter;
albedo.magFilter = THREE.LinearFilter;
albedo.generateMipmaps = true;
const normal = new THREE.TextureLoader().load("./objects1/vision/normal.png");
normal.colorSpace = THREE.NoColorSpace || THREE.LinearSRGBColorSpace;
normal.anisotropy = aniso;
normal.minFilter = THREE.LinearMipmapLinearFilter;
normal.magFilter = THREE.LinearFilter;
normal.generateMipmaps = true;

const lit = new THREE.MeshStandardMaterial({
  map: albedo, normalMap: normal, metalness: 0.08, roughness: 0.72,
  emissive: new THREE.Color(0x000000), emissiveIntensity: 0,
});
const relief = new THREE.MeshStandardMaterial({
  color: 0x8a8a8a, normalMap: normal, metalness: 0, roughness: 1,
  emissive: new THREE.Color(0x000000),
});
const unlit = new THREE.MeshBasicMaterial({ map: albedo });
const mesh = new THREE.InstancedMesh(src.geometry, lit, 1);
mesh.name = "inst-tower-hero";
mesh.castShadow = true;
mesh.receiveShadow = true;
mesh.frustumCulled = false;
const M = new THREE.Matrix4().makeBasis(
  new THREE.Vector3(...meta.right),
  new THREE.Vector3(...meta.up),
  new THREE.Vector3(...meta.toward),
);
M.setPosition(...meta.origin);
mesh.setMatrixAt(0, M);
mesh.instanceMatrix.needsUpdate = true;
scene.add(mesh);
// The static shadow fit ran before this mesh existed, so the hero cast nothing.
// Expand that ortho to the tower, and add a layer-1 caster the colour camera does not draw.
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
  if (light && light.shadow && light.shadow.camera) {
    const cam = light.shadow.camera;
    cam.layers.enable(1);
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    const inv = cam.matrixWorldInverse;
    const v = new THREE.Vector3();
    let z0 = Infinity, z1 = -Infinity;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      v.set(x, y, z).applyMatrix4(inv);
      cam.left = Math.min(cam.left, v.x - 4);
      cam.right = Math.max(cam.right, v.x + 4);
      cam.bottom = Math.min(cam.bottom, v.y - 4);
      cam.top = Math.max(cam.top, v.y + 4);
      z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z);
    }
    cam.near = Math.min(cam.near, Math.max(1, -z1 - 20));
    cam.far = Math.max(cam.far, -z0 + 900);
    cam.updateProjectionMatrix();
    scene.traverse((o) => {
      const u = o.material && o.material.uniforms && o.material.uniforms.uShadowDepthM;
      if (u) u.value = cam.far - cam.near;
    });
    renderer.shadowMap.needsUpdate = true;
  }
}

const hidden = [];
window.__setShade = (mode) => {
  mesh.material = mode === "relief" ? relief : mode === "albedo" ? unlit : lit;
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

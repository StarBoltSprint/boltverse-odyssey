// Zone C solids staging. Causeway stays the kept heightfield. Five solids share
// one key texture on their key-visible group. Hidden faces sample plate-atlas.jpg
// (the 11 validated plates, native). Same index buffer at every distance.
import * as THREE from "/three.module.js";
import { PLATE_FRAG, PLATE_VERT } from "/lib/keyed-field.mjs";

const params = new URLSearchParams(location.search);
const along0 = Number(params.get("along") || 0);
const lat0 = Number(params.get("lat") || 0);
const view = document.getElementById("view");
const renderer = new THREE.WebGLRenderer({ canvas: view, antialias: false, alpha: false });
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;
const aniso = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(51.47, window.innerWidth / window.innerHeight, 0.05, 400);
window.__errors = [];
window.addEventListener("error", (e) => window.__errors.push(String(e.message || e.error || e)));

const meta = await (await fetch("/terrain-data/height.json")).json();
const plates = await (await fetch("/terrain-data/plates.json")).json();
const solids = await (await fetch("/data/solids.json")).json();
const plan = await (await fetch("/zone-c-plate-plan.json")).json();
const heights = new Float32Array(await (await fetch("/terrain-data/height.bin")).arrayBuffer());
if (heights.length !== meta.nx * meta.nz) throw new Error("height bin size");

const clear = new THREE.Color();
clear.setRGB(solids.clearSrgb[0], solids.clearSrgb[1], solids.clearSrgb[2], THREE.SRGBColorSpace);
renderer.setClearColor(clear, 1);
const css = `rgb(${Math.round(solids.clearSrgb[0] * 255)}, ${Math.round(solids.clearSrgb[1] * 255)}, ${Math.round(solids.clearSrgb[2] * 255)})`;
document.documentElement.style.background = css;
document.body.style.background = css;
const loadEl = document.getElementById("load");
if (loadEl) loadEl.style.background = css;

function dataTex(bytes, w, h, filter) {
  const tex = new THREE.DataTexture(bytes, w, h, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.flipY = false;
  tex.magFilter = filter;
  tex.minFilter = filter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = aniso;
  tex.needsUpdate = true;
  return tex;
}

const weightBytes = new Uint8Array(await (await fetch("/terrain-data/weight.bin")).arrayBuffer());
const tintBytes = new Uint8Array(await (await fetch("/terrain-data/tint.bin")).arrayBuffer());
const tileBytes = new Uint8Array(await (await fetch("/terrain-data/tile.bin")).arrayBuffer());
const { nx, nz } = meta;
const [ntx, ntz] = plates.tileN;
if (weightBytes.length !== nx * nz * 4) throw new Error("weight bin");
if (tintBytes.length !== nx * nz * 4) throw new Error("tint bin");
if (tileBytes.length !== ntx * ntz * 4) throw new Error("tile bin");
const uWeight = dataTex(weightBytes, nx, nz, THREE.LinearFilter);
const uTint = dataTex(tintBytes, nx, nz, THREE.LinearFilter);
const uTile = dataTex(tileBytes, ntx, ntz, THREE.NearestFilter);
uWeight.name = "uWeight";
uTint.name = "uTint";
uTile.name = "uTile";

let readyCount = 0;
const needTex = 6;
function markTex() { readyCount += 1; }
function imageTex(url, wrap) {
  const tex = new THREE.TextureLoader().load(url, markTex, undefined, (err) => {
    window.__errors.push("texture " + url + " " + err);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = wrap;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = aniso;
  return tex;
}
const uKey = imageTex("/key-zc1.jpg", THREE.ClampToEdgeWrapping);
const uAtlas = imageTex("/data/plate-atlas.jpg", THREE.ClampToEdgeWrapping);
uAtlas.name = "plate-atlas";
const plateTex = [1, 2, 3, 4].map((i) => imageTex("/plates/moss-top-" + i + ".jpg", THREE.RepeatWrapping));
uKey.name = "key-zc1";

const { step, origin } = meta;
const ox = origin[0], oz = origin[1];
const pos = new Float32Array(nx * nz * 3);
const uv = new Float32Array(nx * nz * 2);
const tileM = plates.tileM;
for (let iz = 0; iz < nz; iz++) {
  for (let ix = 0; ix < nx; ix++) {
    const k = iz * nx + ix;
    const x = ox + ix * step;
    const z = oz + iz * step;
    pos[k * 3] = x;
    pos[k * 3 + 1] = heights[k];
    pos[k * 3 + 2] = z;
    uv[k * 2] = x / tileM;
    uv[k * 2 + 1] = z / tileM;
  }
}
const geo = new THREE.BufferGeometry();
geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
const means = plates.means;
const mat = new THREE.ShaderMaterial({
  vertexShader: PLATE_VERT,
  fragmentShader: PLATE_FRAG,
  uniforms: {
    uKey: { value: uKey },
    uP0: { value: plateTex[0] },
    uP1: { value: plateTex[1] },
    uP2: { value: plateTex[2] },
    uP3: { value: plateTex[3] },
    uWeight: { value: uWeight },
    uTint: { value: uTint },
    uTile: { value: uTile },
    uEye: { value: new THREE.Vector3(...plates.eye) },
    uRight: { value: new THREE.Vector3(...plates.right) },
    uUp: { value: new THREE.Vector3(...plates.up) },
    uFwd: { value: new THREE.Vector3(...plates.forward) },
    uKeyP: { value: new THREE.Vector2(...plates.keyP) },
    uGridOrigin: { value: new THREE.Vector2(...plates.gridOrigin) },
    uGridSize: { value: new THREE.Vector2(...plates.gridSize) },
    uTile0: { value: new THREE.Vector2(...plates.tile0) },
    uTileN: { value: new THREE.Vector2(ntx, ntz) },
    uTileM: { value: tileM },
    uMean0: { value: new THREE.Vector3(...means[0]) },
    uMean1: { value: new THREE.Vector3(...means[1]) },
    uMean2: { value: new THREE.Vector3(...means[2]) },
    uMean3: { value: new THREE.Vector3(...means[3]) },
  },
  side: THREE.FrontSide,
  toneMapped: false,
});
const causeway = new THREE.Mesh(geo, mat);
causeway.name = "causeway";
scene.add(causeway);

const packBuf = await (await fetch("/data/solids.bin")).arrayBuffer();
const packBytes = new Uint8Array(packBuf);
const keyVP = new THREE.Matrix4();
const keyPos = new THREE.Vector3();
function installKeyProj(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uKeyProj = { value: uKey };
    shader.uniforms.uKeyVP = { value: keyVP };
    shader.uniforms.uKeyPos = { value: keyPos };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSolWorld;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvSolWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSolWorld;\nuniform sampler2D uKeyProj;\nuniform mat4 uKeyVP;\nuniform vec3 uKeyPos;")
      .replace("#include <map_fragment>", `#include <map_fragment>
{
  vec3 nGeo = cross(dFdx(vSolWorld), dFdy(vSolWorld));
  float nLen = length(nGeo);
  if (nLen > 1e-5) {
    vec3 n = nGeo / nLen;
    vec3 toKey = uKeyPos - vSolWorld;
    float tLen = length(toKey);
    if (tLen > 1e-4 && dot(n, toKey / tLen) > 0.25) {
      vec4 clip = uKeyVP * vec4(vSolWorld, 1.0);
      vec2 ndc = clip.xy / clip.w;
      if (clip.w > 0.0 && abs(ndc.x) < 1.0 && abs(ndc.y) < 1.0) {
        diffuseColor.rgb = texture2D(uKeyProj, ndc * 0.5 + 0.5).rgb;
      }
    }
  }
}`);
  };
  mat.customProgramCacheKey = () => "zone-c-keyproj";
}
const keyMat = new THREE.MeshBasicMaterial({ map: uKey, toneMapped: false });
const plateMat = new THREE.MeshBasicMaterial({ map: uAtlas, toneMapped: false });
// Key projection stays on the key group only. Putting the key sampler on the
// plate material made the gate score atlas UVs against the 16:9 key (stretch
// 1.333) and painted black key-corners over side faces.
installKeyProj(keyMat);
const solidMeshes = [];
for (const o of solids.objects) {
  const floats = o.verts * o.floats;
  const f = new Float32Array(packBuf, o.vertByteOffset, floats);
  const idx = new Uint32Array(packBuf, o.indexByteOffset, o.tris * 3);
  const g = new THREE.BufferGeometry();
  const positions = new Float32Array(o.verts * 3);
  const uvs = new Float32Array(o.verts * 2);
  for (let i = 0; i < o.verts; i++) {
    positions[i * 3] = f[i * 6];
    positions[i * 3 + 1] = f[i * 6 + 1];
    positions[i * 3 + 2] = f[i * 6 + 2];
    uvs[i * 2] = f[i * 6 + 3];
    uvs[i * 2 + 1] = f[i * 6 + 4];
  }
  g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  const keyCount = o.keyTris * 3;
  const rest = o.tris * 3 - keyCount;
  const mats = [];
  if (keyCount > 0) {
    g.addGroup(0, keyCount, mats.length);
    mats.push(keyMat);
  }
  if (rest > 0) {
    g.addGroup(keyCount, rest, mats.length);
    mats.push(plateMat);
  }
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, mats.length === 1 ? mats[0] : mats);
  mesh.name = o.name;
  mesh.frustumCulled = false;
  scene.add(mesh);
  solidMeshes.push(mesh);
}
if (packBytes.byteLength !== packBuf.byteLength) throw new Error("solids bin");

const CORRIDOR = 12;
const LENGTH = (nz - 1) * step;

function lodIndex(alongM) {
  const baseCell = alongM >= 60 ? 2 : alongM >= 30 ? 1 : 0.5;
  const stride = Math.max(1, Math.round(baseCell / step));
  const drop = Math.max(0, alongM - 8);
  const rows = Math.max(1, Math.round((LENGTH - drop) / step));
  const izMax = Math.min(nz - 1, rows);
  const ixL = Math.round((-CORRIDOR / 2 - ox) / step);
  const ixR = Math.round((CORRIDOR / 2 - ox) / step);
  const index = [];
  const quad = (iz0, ix0, iz1, ix1) => {
    const a = iz0 * nx + ix0;
    const b = iz0 * nx + ix1;
    const c = iz1 * nx + ix0;
    const d = iz1 * nx + ix1;
    index.push(a, c, b, b, c, d);
  };
  for (let iz = 0; iz < izMax; iz++) {
    for (let ix = ixL; ix < ixR; ix++) quad(iz, ix, iz + 1, ix + 1);
  }
  for (let iz = 0; iz < izMax; iz += stride) {
    const iz1 = Math.min(iz + stride, izMax);
    if (iz1 === iz) continue;
    for (let ix = 0; ix < ixL; ix += stride) {
      const ix1 = Math.min(ix + stride, ixL);
      if (ix1 > ix) quad(iz, ix, iz1, ix1);
    }
    for (let ix = ixR; ix < nx - 1; ix += stride) {
      const ix1 = Math.min(ix + stride, nx - 1);
      if (ix1 > ix) quad(iz, ix, iz1, ix1);
    }
  }
  return { idx: index, baseCell, triangles: index.length / 3 };
}

let lod = { baseCell: 0.5, triangles: 0 };
function applyLod(alongM) {
  const built = lodIndex(alongM);
  geo.setIndex(built.idx);
  lod = { baseCell: built.baseCell, triangles: built.triangles };
}

function heightAt(x, z) {
  let fx = (x - ox) / step;
  let fz = (z - oz) / step;
  fx = Math.min(nx - 1.001, Math.max(0, fx));
  fz = Math.min(nz - 1.001, Math.max(0, fz));
  const x0 = Math.floor(fx), z0 = Math.floor(fz);
  const tx = fx - x0, tz = fz - z0;
  const x1 = Math.min(x0 + 1, nx - 1), z1 = Math.min(z0 + 1, nz - 1);
  const h00 = heights[z0 * nx + x0], h10 = heights[z0 * nx + x1];
  const h01 = heights[z1 * nx + x0], h11 = heights[z1 * nx + x1];
  return h00 * (1 - tx) * (1 - tz) + h10 * tx * (1 - tz) + h01 * (1 - tx) * tz + h11 * tx * tz;
}

function snapKeyCamera() {
  const keyCam = new THREE.PerspectiveCamera(meta.camera.fov, 1792 / 1008, 0.05, 400);
  keyCam.up.set(0, 1, 0);
  keyCam.rotation.order = "YXZ";
  keyCam.position.set(0, heightAt(0, 0) + meta.camera.eye, 0);
  keyCam.rotation.set(meta.camera.pitch * Math.PI / 180, -(meta.camera.yaw || 0) * Math.PI / 180, 0);
  keyCam.updateMatrixWorld(true);
  keyCam.updateProjectionMatrix();
  keyVP.multiplyMatrices(keyCam.projectionMatrix, keyCam.matrixWorldInverse);
  keyPos.copy(keyCam.position);
}

function place(alongM, latM = 0) {
  const pitch = meta.camera.pitch * Math.PI / 180;
  const yaw = (meta.camera.yaw || 0) * Math.PI / 180;
  const eye = meta.camera.eye;
  const x = latM;
  const z = -alongM;
  const y = heightAt(x, z) + eye;
  camera.up.set(0, 1, 0);
  camera.rotation.order = "YXZ";
  camera.position.set(x, y, z);
  camera.rotation.set(pitch, -yaw, 0);
  camera.fov = meta.camera.fov;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  applyLod(alongM);
  return { x, y, z, alongM, latM };
}

const plated = {};
for (const o of solids.objects) {
  const bag = o.plated || o.pending || {};
  plated[o.name] = Object.entries(bag).map(([n, info]) => {
    const spec = plan.plates.find((p) => p.n === Number(n));
    return {
      n: Number(n),
      id: info.id || (spec ? spec.id : "plate-" + n),
      tris: info.tris,
      kinds: info.kinds,
      file: info.file || (spec ? spec.file : null),
      bound: info.bound === true && info.tris > 0,
    };
  });
}
window.__solids = {
  names: solids.objects.map((o) => o.name),
  plated,
  pending: {},
  drawCalls: 0,
  sameHull: solids.objects.every((o) => o.sameHull),
  instanced: false,
};

snapKeyCamera();
place(along0, lat0);
window.__sceneReady = false;
const bootAt = performance.now();
window.__terrain = { place, heightAt, meta, plates, lod, aniso };

function tick() {
  renderer.render(scene, camera);
  window.__solids.drawCalls = renderer.info.render.calls;
  window.__terrain.drawCalls = renderer.info.render.calls;
  window.__terrain.triangles = renderer.info.render.triangles;
  if (readyCount >= needTex && performance.now() - bootAt > 700 && !window.__sceneReady) {
    window.__sceneReady = true;
    if (loadEl) loadEl.remove();
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

window.__ogHost = {
  THREE, scene, camera, renderer,
  groundHeight: heightAt,
  path: [[0, 0], [0, -8], [0, -30], [0, -60], [0, -90]],
  setPose: ({ x, z, y = null, eye = 1.508, look = null }) => {
    const yy = y == null ? heightAt(x, z) + eye : y;
    camera.up.set(0, 1, 0);
    camera.position.set(x, yy, z);
    if (look) camera.lookAt(look[0], look[1], look[2]);
    else {
      const pitch = meta.camera.pitch * Math.PI / 180;
      camera.rotation.order = "YXZ";
      camera.rotation.set(pitch, 0, 0);
    }
    camera.updateMatrixWorld(true);
    const along = -z;
    applyLod(Math.max(0, along));
    return { x, y: yy, z };
  },
  freeze: () => {},
};

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

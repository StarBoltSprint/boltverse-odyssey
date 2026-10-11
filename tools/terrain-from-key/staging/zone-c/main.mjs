// Zone C staging. One unlit mesh. Key where it is dense, four moss plates beyond.
// The live preview is not imported. Shader source is /lib/keyed-field.mjs.
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
const aniso = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(51.47, window.innerWidth / window.innerHeight, 0.05, 400);
window.__errors = [];
window.addEventListener("error", (e) => window.__errors.push(String(e.message || e.error || e)));

const meta = await (await fetch("/data/height.json")).json();
const plates = await (await fetch("/data/plates.json")).json();
const buf = await (await fetch("/data/height.bin")).arrayBuffer();
const heights = new Float32Array(buf);
if (heights.length !== meta.nx * meta.nz) throw new Error("height bin size");

const clear = new THREE.Color();
clear.setRGB(plates.clearSrgb[0], plates.clearSrgb[1], plates.clearSrgb[2], THREE.SRGBColorSpace);
renderer.setClearColor(clear, 1);
document.documentElement.style.background = plates.clearHex;
document.body.style.background = plates.clearHex;
const loadEl = document.getElementById("load");
if (loadEl) loadEl.style.background = plates.clearHex;

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

const weightBytes = new Uint8Array(await (await fetch("/data/weight.bin")).arrayBuffer());
const tintBytes = new Uint8Array(await (await fetch("/data/tint.bin")).arrayBuffer());
const tileBytes = new Uint8Array(await (await fetch("/data/tile.bin")).arrayBuffer());
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
const needTex = 5;
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
const mesh = new THREE.Mesh(geo, mat);
mesh.name = "causeway";
scene.add(mesh);

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
  const idx = [];
  const quad = (iz0, ix0, iz1, ix1) => {
    const a = iz0 * nx + ix0;
    const b = iz0 * nx + ix1;
    const c = iz1 * nx + ix0;
    const d = iz1 * nx + ix1;
    idx.push(a, c, b, b, c, d);
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
  return { idx, baseCell, triangles: idx.length / 3, rows };
}

let lod = { baseCell: 0.5, triangles: 0 };
function applyLod(alongM) {
  const built = lodIndex(alongM);
  geo.setIndex(built.idx);
  lod = { baseCell: built.baseCell, triangles: built.triangles, rows: built.rows };
  geo.computeVertexNormals();
  const n = geo.getAttribute("normal");
  let up = 0;
  let down = 0;
  for (let i = 1; i < n.count; i += Math.max(1, Math.floor(n.count / 32))) {
    if (n.getY(i) >= 0) up++;
    else down++;
  }
  if (down > up) throw new Error("ground winding faces down");
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
  return { x, y, z, alongM, latM, lod };
}

function groundVisiblePose(D) {
  // Eye height, D metres back from a point on the plate field. The key projection
  // stops near 12 m, and that photo is coarser than the phone bar. The pitched
  // key ray also puts the eye under the mesh, so a front-face ray misses.
  const s = 12 + D;
  const z = -s;
  const y = heightAt(0, z);
  const zCam = z + D;
  return {
    x: 0,
    y: heightAt(0, zCam) + meta.camera.eye,
    z: zCam,
    look: [0, y + 0.15, z],
    aimM: 0,
    normal: [0, 1, 0],
  };
}

function groundPose(name) {
  const s = name === "low-portrait" ? 6 : 4;
  const z = -s;
  const y = heightAt(0, z);
  const back = name === "low-portrait" ? 1.4 : 0.6;
  const eye = name === "low-portrait" ? 1.2 : 1.5;
  return {
    kind: "persp",
    eye: [0, y + eye, z + back],
    target: [0, y + 0.02, z - 7],
    up: [0, 1, 0],
    fovY: name === "low-portrait" ? 58 : 50,
    width: 412,
    height: 915,
    near: 0.05,
    far: 40,
  };
}

function plateFrame() {
  return { cx: 0, cz: -6, half: 6 };
}

place(along0, lat0);
window.__sceneReady = false;
const bootAt = performance.now();
window.__terrain = {
  place, heightAt, meta, plates, lod, aniso,
  groundVisiblePose, groundPose, plateFrame,
};

function tick() {
  renderer.render(scene, camera);
  const info = renderer.info.render;
  window.__terrain.drawCalls = info.calls;
  window.__terrain.triangles = info.triangles;
  window.__terrain.lod = lod;
  window.__terrain.aniso = aniso;
  if (readyCount >= needTex && performance.now() - bootAt > 700 && !window.__sceneReady) {
    window.__sceneReady = true;
    if (loadEl) loadEl.style.display = "none";
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
    camera.updateMatrixWorld(true);
    return { x, y: yy, z };
  },
  freeze: () => {},
};

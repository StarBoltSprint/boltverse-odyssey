// Zone C staging. One unlit mesh. The live preview is not imported.
import * as THREE from "/three.module.js";

const params = new URLSearchParams(location.search);
const along = Number(params.get("along") || 0);
const view = document.getElementById("view");
const renderer = new THREE.WebGLRenderer({ canvas: view, antialias: false, alpha: false });
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.setClearColor(0x000000, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(51.47, window.innerWidth / window.innerHeight, 0.05, 400);

const meta = await (await fetch("/data/height.json")).json();
const buf = await (await fetch("/data/height.bin")).arrayBuffer();
const heights = new Float32Array(buf);
if (heights.length !== meta.nx * meta.nz) throw new Error("height bin size");
let albedoReady = false;
const bootAt = performance.now();
const albedo = new THREE.TextureLoader().load("/data/albedo.png", () => { albedoReady = true; });
albedo.colorSpace = THREE.SRGBColorSpace;
albedo.wrapS = albedo.wrapT = THREE.ClampToEdgeWrapping;
albedo.magFilter = THREE.LinearFilter;
albedo.minFilter = THREE.LinearMipmapLinearFilter;
albedo.generateMipmaps = true;
albedo.anisotropy = 8;

const { nx, nz, step, origin } = meta;
const ox = origin[0], oz = origin[1];
const pos = new Float32Array(nx * nz * 3);
const uv = new Float32Array(nx * nz * 2);
for (let iz = 0; iz < nz; iz++) {
  for (let ix = 0; ix < nx; ix++) {
    const k = iz * nx + ix;
    pos[k * 3] = ox + ix * step;
    pos[k * 3 + 1] = heights[k];
    pos[k * 3 + 2] = oz + iz * step;
    uv[k * 2] = ix / (nx - 1);
    uv[k * 2 + 1] = 1 - iz / (nz - 1);
  }
}
const geo = new THREE.BufferGeometry();
geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: albedo, side: THREE.FrontSide }));
mesh.name = "causeway";
scene.add(mesh);

// Same hull as lod_counts: path corridor ±6 m stays at `step`. Flat flanks use
// 0.5 / 1 / 2 m. Cells more than 8 m behind the eye are not indexed.
const CORRIDOR = 12;
const S_FAR = -oz;
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
    // +Y normal when the cell is flat (a, c, b).
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

function place(alongM) {
  // geom.camera_axes: yaw 0, pitch about X, order YXZ, rotation.y = -yaw.
  const pitch = meta.camera.pitch * Math.PI / 180;
  const yaw = (meta.camera.yaw || 0) * Math.PI / 180;
  const eye = meta.camera.eye;
  const x = 0;
  const z = -alongM;
  const y = heightAt(x, z) + eye;
  camera.up.set(0, 1, 0);
  camera.rotation.order = "YXZ";
  camera.position.set(x, y, z);
  camera.rotation.set(pitch, -yaw, 0);
  camera.fov = meta.camera.fov;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const sp = Math.sin(pitch), cp = Math.cos(pitch);
  if (Math.abs(dir.x) > 1e-3 || Math.abs(dir.y - sp) > 1e-3 || Math.abs(dir.z + cp) > 1e-3) {
    throw new Error("camera forward " + dir.x + "," + dir.y + "," + dir.z);
  }
  applyLod(alongM);
  return { x, y, z, alongM, lod };
}

place(along);
window.__sceneReady = false;
window.__terrain = { place, heightAt, meta, lod };

function tick() {
  renderer.render(scene, camera);
  const info = renderer.info.render;
  window.__terrain.drawCalls = info.calls;
  window.__terrain.triangles = info.triangles;
  window.__terrain.lod = lod;
  if (albedoReady && performance.now() - bootAt > 700 && !window.__sceneReady) {
    window.__sceneReady = true;
    const load = document.getElementById("load");
    if (load) load.style.display = "none";
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

window.__ogHost = {
  THREE, scene, camera, renderer,
  groundHeight: heightAt,
  path: [[0, 0], [0, -8], [0, -30], [0, -60], [0, -90]],
  setPose: ({ x, z, eye = 1.508 }) => {
    const y = heightAt(x, z) + eye;
    camera.position.set(x, y, z);
    return { x, y, z };
  },
  freeze: () => {},
};

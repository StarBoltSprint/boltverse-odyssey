// Zone B hero tower — TP01 projected albedo, one mesh, game sun, no emissive key face.
// Staging only. Draws: body group + trim group + dune-seat = 3.
const wait = (f) => new Promise((r) => { const t = setInterval(() => { if (f()) { clearInterval(t); r(); } }, 200); });
await wait(() => window.__ready && window.__renderer && window.__gdTHREE);
const T = window.__gdTHREE, R = window.__renderer;
let scene = null;
let isoOn = false;
const Q = new URLSearchParams(location.search);
const showW = Q.get("tw") === "w";
const keyOn = Q.get("cam") === "key";

const orig = R.render.bind(R);
R.render = (s, c) => {
  if (!scene && s && s.isScene && c && c.isPerspectiveCamera) scene = s;
  if (s && s.isScene && c && c.isPerspectiveCamera) {
    if (keyOn && c.matrix) {
      const qc = window.__tower && window.__tower.qc;
      if (qc && qc.mw && qc.pm) {
        c.matrixAutoUpdate = false;
        c.matrix.fromArray(qc.mw);
        c.matrixWorld.copy(c.matrix);
        c.projectionMatrix.fromArray(qc.pm);
        c.projectionMatrixInverse.copy(c.projectionMatrix).invert();
      }
    }
    if (isoOn) {
      s.traverse((o) => {
        if (!(o.isMesh || o.isInstancedMesh || o.isPoints || o.isLine || o.isSprite)) return;
        if (o.userData._pvSet !== 1) { o.userData._pv = o.visible; o.userData._pvSet = 1; }
        o.visible = o.name === "tower-hero";
      });
      if (s.userData._isoBg === undefined) { s.userData._isoBg = s.background; s.background = new T.Color(0x000000); }
    } else if (s.userData._isoBg !== undefined) {
      s.traverse((o) => {
        if (o.userData && o.userData._pvSet === 1) { o.visible = o.userData._pv; o.userData._pvSet = 0; }
      });
      s.background = s.userData._isoBg;
      s.userData._isoBg = undefined;
    }
  }
  return orig(s, c);
};
await wait(() => scene);

const qc = await fetch("./tower-meta.json").then((r) => r.json());
const buf = await fetch("./tower.bin").then((r) => r.arrayBuffer());
const dv = new DataView(buf);
const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
if (magic !== "TP01") throw new Error("tower.bin " + magic);
let o = 4;
const nV = dv.getUint32(o, true); o += 4;
const nI = dv.getUint32(o, true); o += 4;
const nTV = dv.getUint32(o, true); o += 4;
const nTI = dv.getUint32(o, true); o += 4;
o += 8;
function f32(n) {
  const a = new Float32Array(buf.slice(o, o + n * 4));
  o += n * 4;
  return a;
}
function u32(n) {
  const a = new Uint32Array(buf.slice(o, o + n * 4));
  o += n * 4;
  return a;
}
const pos = f32(nV * 3);
const uv = f32(nV * 2);
const idx = u32(nI);
const tpos = f32(nTV * 3);
const tuv = f32(nTV * 2);
const tidx = u32(nTI);

function loadTex(url, color) {
  return new Promise((ok, bad) => {
    new T.TextureLoader().load(url, (tex) => {
      tex.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
      tex.flipY = false;
      tex.wrapS = tex.wrapT = T.ClampToEdgeWrapping;
      tex.magFilter = T.LinearFilter;
      tex.minFilter = T.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      tex.anisotropy = R.capabilities.getMaxAnisotropy();
      tex.needsUpdate = true;
      ok(tex);
    }, undefined, bad);
  });
}
const [albedo, trimTex, weight, sand] = await Promise.all([
  loadTex("./albedo.png", true),
  loadTex("./trim.png", true),
  loadTex("./weight.png", false),
  loadTex("./sand.png", true).catch(() => null),
]);
let detail = null;
try { detail = await loadTex("./objects1/tex/detail-hp.png", false); } catch (e) { detail = null; }
if (detail) { detail.wrapS = detail.wrapT = T.RepeatWrapping; }

const nBody = pos.length / 3;
const nTrimV = tpos.length / 3;
const allP = new Float32Array(pos.length + tpos.length);
allP.set(pos, 0); allP.set(tpos, pos.length);
const allU = new Float32Array(uv.length + tuv.length);
allU.set(uv, 0); allU.set(tuv, uv.length);
const allI = new Uint32Array(idx.length + tidx.length);
allI.set(idx, 0);
for (let i = 0; i < tidx.length; i++) allI[idx.length + i] = tidx[i] + nBody;

const geo = new T.BufferGeometry();
geo.setAttribute("position", new T.BufferAttribute(allP, 3));
geo.setAttribute("uv", new T.BufferAttribute(allU, 2));
geo.setIndex(new T.BufferAttribute(allI, 1));
geo.addGroup(0, idx.length, 0);
geo.addGroup(idx.length, tidx.length, 1);
geo.computeVertexNormals();

const bodyMat = new T.MeshStandardMaterial({
  map: showW ? weight : albedo,
  roughness: 0.62,
  metalness: 0.08,
  emissive: new T.Color(0x000000),
  emissiveIntensity: 0,
});
const trimMat = new T.MeshStandardMaterial({
  map: trimTex,
  roughness: 0.35,
  metalness: 0.55,
  emissive: new T.Color(0x000000),
  emissiveIntensity: 0,
});
if (detail && !showW) {
  bodyMat.onBeforeCompile = (sh) => {
    sh.uniforms.uDet = { value: detail };
    sh.uniforms.uDetW = { value: 0.35 };
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform sampler2D uDet;\nuniform float uDetW;")
      .replace(
        "#include <map_fragment>",
        "#include <map_fragment>\n{\n float det = texture2D(uDet, vMapUv * 48.0).r;\n diffuseColor.rgb *= mix(1.0, 0.82 + det * 0.36, uDetW);\n}",
      );
  };
}
const mesh = new T.Mesh(geo, [bodyMat, trimMat]);
mesh.name = "tower-hero";
mesh.castShadow = true;
mesh.receiveShadow = true;
mesh.frustumCulled = false;
mesh.matrixAutoUpdate = false;
mesh.matrix.identity();
mesh.updateMatrixWorld(true);
scene.add(mesh);

await wait(() => window.__zbField && typeof window.__zbField.surfaceHeight === "function");
const field = window.__zbField;
const origH = field.surfaceHeight.bind(field);
const fp = qc.footprint;
const x0 = fp[0], x1 = fp[1], z0 = fp[2], z1 = fp[3];
const topY = qc.baseY + (qc.raiseM || 2);
const fall = 12;
function bump(x, z) {
  const dx = x < x0 ? x0 - x : x > x1 ? x - x1 : 0;
  const dz = z < z0 ? z0 - z : z > z1 ? z - z1 : 0;
  const d = Math.hypot(dx, dz);
  if (d >= fall) return 0;
  const k = 1 - d / fall;
  return k * k;
}
const cols = 10, rows = 10;
const duneP = [];
const duneU = [];
const duneI = [];
for (let j = 0; j <= rows; j++) {
  for (let i = 0; i <= cols; i++) {
    const x = x0 - fall + (x1 - x0 + 2 * fall) * (i / cols);
    const z = z0 - fall + (z1 - z0 + 2 * fall) * (j / rows);
    const h0 = origH(x, z);
    const y = h0 + (topY - h0) * bump(x, z);
    duneP.push(x, y, z);
    duneU.push(i / cols, j / rows);
  }
}
const stride = cols + 1;
for (let j = 0; j < rows; j++) {
  for (let i = 0; i < cols; i++) {
    const a = j * stride + i;
    duneI.push(a, a + 1, a + stride, a + 1, a + stride + 1, a + stride);
  }
}
const dg = new T.BufferGeometry();
dg.setAttribute("position", new T.Float32BufferAttribute(duneP, 3));
dg.setAttribute("uv", new T.Float32BufferAttribute(duneU, 2));
dg.setIndex(duneI);
dg.computeVertexNormals();
if (sand) { sand.wrapS = sand.wrapT = T.RepeatWrapping; sand.repeat.set(4, 4); }
const dmat = new T.MeshStandardMaterial({
  map: sand || albedo,
  roughness: 0.92,
  metalness: 0.0,
  emissive: new T.Color(0x000000),
  emissiveIntensity: 0,
});
const dune = new T.Mesh(dg, dmat);
dune.name = "dune-seat";
dune.receiveShadow = true;
dune.castShadow = false;
dune.frustumCulled = false;
scene.add(dune);
if (!field.__towerSeat) {
  field.surfaceHeight = (x, z) => {
    const h = origH(x, z);
    const k = bump(x, z);
    return k > 0 ? Math.max(h, h + (topY - h) * k) : h;
  };
  field.__towerSeat = 1;
}

function fitShadow() {
  const sun = window.__zbDebug && window.__zbDebug.sun;
  if (!sun || !sun.shadow) return;
  const cam = sun.shadow.camera;
  sun.updateMatrixWorld(true);
  cam.updateMatrixWorld(true);
  const inv = cam.matrixWorldInverse;
  const box = new T.Box3().setFromObject(mesh);
  const v = new T.Vector3();
  let xa = cam.left, xb = cam.right, ya = cam.bottom, yb = cam.top;
  const xs = [box.min.x, box.max.x], ys = [box.min.y, box.max.y], zs = [box.min.z, box.max.z];
  for (const x of xs) for (const y of ys) for (const z of zs) {
    v.set(x, y, z).applyMatrix4(inv);
    xa = Math.min(xa, v.x); xb = Math.max(xb, v.x);
    ya = Math.min(ya, v.y); yb = Math.max(yb, v.y);
  }
  cam.left = xa - 6; cam.right = xb + 6; cam.bottom = ya - 6; cam.top = yb + 6;
  cam.updateProjectionMatrix();
  R.shadowMap.needsUpdate = true;
}
fitShadow();

const tris = (idx.length + tidx.length) / 3;
function gpuMiB(tex, ch) {
  const im = tex && tex.image;
  if (!im || !im.width || !im.height) return 0;
  return (im.width * im.height * ch * (4 / 3)) / (1024 * 1024);
}
window.__tower = {
  mesh, dune, qc,
  only: (on) => { isoOn = !!on; },
  stats: () => ({
    draws: 3,
    tris,
    bodyTris: idx.length / 3,
    trimTris: tidx.length / 3,
    texMiB: +(gpuMiB(albedo, 4) + gpuMiB(trimTex, 4) + gpuMiB(weight, 1) + gpuMiB(sand, 4) + gpuMiB(detail, 1)).toFixed(2),
  }),
};
window.__towerReady = true;

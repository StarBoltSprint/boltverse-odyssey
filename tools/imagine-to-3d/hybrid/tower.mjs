// Zone B hero tower — planar wedge, key projection beyond ~40 m, Imagine flanks, real trim.
// Staging only. Two draws: body + merged trim.
const wait = (f) => new Promise((r) => { const t = setInterval(() => { if (f()) { clearInterval(t); r(); } }, 200); });
await wait(() => window.__ready && window.__renderer && window.__gdTHREE);
const T = window.__gdTHREE, R = window.__renderer;
let scene = null;
let isoOn = false;
const orig = R.render.bind(R);
R.render = (s, c) => {
  if (!scene && s && s.isScene && c && c.isPerspectiveCamera) scene = s;
  // Only the perspective world pass. The v62 upscale is an ortho quad; hiding it clears the canvas.
  if (s && s.isScene && c && c.isPerspectiveCamera) {
    if (isoOn) {
      s.traverse((o) => {
        if (!(o.isMesh || o.isInstancedMesh || o.isPoints || o.isLine || o.isSprite)) return;
        if (o.userData._pvSet !== 1) { o.userData._pv = o.visible; o.userData._pvSet = 1; }
        o.visible = o.name === "tower-hero" || o.name === "tower-hero-trim";
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
if (magic !== "TW01") throw new Error("tower.bin " + magic);
let o = 4;
function takeF(nComp) {
  const count = dv.getUint32(o, true); o += 4;
  const f = new Float32Array(buf.slice(o, o + count * nComp * 4));
  o += count * nComp * 4;
  return f;
}
const pos = takeF(3), uv = takeF(2), uvKey = takeF(2), face = takeF(1);
const nTrim = dv.getUint32(o, true); o += 4;
const trimPos = new Float32Array(buf.slice(o, o + nTrim * 3 * 4)); o += nTrim * 3 * 4;
const trimMetal = new Float32Array(buf.slice(o, o + nTrim * 4)); o += nTrim * 4;
const trimColor = new Float32Array(buf.slice(o, o + nTrim * 3 * 4));

const Q = new URLSearchParams(location.search);
const show0 = Q.get("tw") === "w" ? 1 : 0;

function dataTex(bytes, w, h, format, typeCount) {
  const tex = new T.DataTexture(bytes, w, h, format, T.UnsignedByteType);
  tex.colorSpace = T.NoColorSpace;
  tex.flipY = false;
  tex.wrapS = tex.wrapT = T.ClampToEdgeWrapping;
  tex.magFilter = T.LinearFilter;
  tex.minFilter = T.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  tex.userData.bytes = bytes.byteLength * 1.333;
  return tex;
}
async function loadPair(name, w, h) {
  const [y, c] = await Promise.all([
    fetch(`./tex/${name}-y.bin`).then((r) => r.arrayBuffer()),
    fetch(`./tex/${name}-c.bin`).then((r) => r.arrayBuffer()),
  ]);
  return {
    y: dataTex(new Uint8Array(y), w, h, T.RedFormat),
    c: dataTex(new Uint8Array(c), w >> 1, h >> 1, T.RGFormat),
  };
}
const pack = qc.pack;
const [keyTex, keyRawTex, detImg, right, left, back] = await Promise.all([
  new Promise((ok) => new T.TextureLoader().load("./albedo-key.png", ok)),
  new Promise((ok) => new T.TextureLoader().load("./atlas-key.png", ok)),
  new Promise((ok) => new T.TextureLoader().load("./objects1/tex/detail-hp.png", ok)),
  loadPair("right", pack.right.w, pack.right.h),
  loadPair("left", pack.left.w, pack.left.h),
  loadPair("back", pack.back.w, pack.back.h),
]);
for (const tex of [keyTex, keyRawTex]) {
  tex.colorSpace = T.SRGBColorSpace;
  tex.flipY = false;
  tex.wrapS = tex.wrapT = T.ClampToEdgeWrapping;
  tex.magFilter = T.LinearFilter;
  tex.minFilter = T.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = R.capabilities.getMaxAnisotropy();
}
// upload detail as R8 (the PNG is mode L; the loader may expand it — count the real image)
detImg.colorSpace = T.NoColorSpace;
detImg.wrapS = detImg.wrapT = T.RepeatWrapping;
detImg.magFilter = T.LinearFilter;
detImg.minFilter = T.LinearMipmapLinearFilter;
detImg.generateMipmaps = true;
detImg.anisotropy = R.capabilities.getMaxAnisotropy();

const body = new T.BufferGeometry();
body.setAttribute("position", new T.BufferAttribute(pos, 3));
body.setAttribute("uv", new T.BufferAttribute(uv, 2));
body.setAttribute("uvKey", new T.BufferAttribute(uvKey, 2));
body.setAttribute("aFace", new T.BufferAttribute(face, 1));
body.computeVertexNormals();
// front should face the key camera
{
  const n = new T.Vector3(), p = new T.Vector3();
  const cam = new T.Vector3(...qc.camPos);
  let dot = 0, k = 0;
  for (let i = 0; i < face.length; i += 3) {
    if (face[i] > 0.5) continue;
    const a = new T.Vector3().fromBufferAttribute(body.attributes.position, i);
    const b = new T.Vector3().fromBufferAttribute(body.attributes.position, i + 1);
    const c = new T.Vector3().fromBufferAttribute(body.attributes.position, i + 2);
    n.crossVectors(b.clone().sub(a), c.clone().sub(a));
    p.copy(a).add(b).add(c).multiplyScalar(1 / 3);
    dot += n.dot(cam.clone().sub(p));
    k++;
  }
  if (k && dot < 0) {
    const swapAttr = (attr, stride) => {
      const a = attr.array;
      for (let i = 0; i < a.length; i += stride * 3) {
        for (let k2 = 0; k2 < stride; k2++) {
          const t = a[i + k2]; a[i + k2] = a[i + stride + k2]; a[i + stride + k2] = t;
        }
      }
      attr.needsUpdate = true;
    };
    swapAttr(body.attributes.position, 3);
    swapAttr(body.attributes.uv, 2);
    swapAttr(body.attributes.uvKey, 2);
    swapAttr(body.attributes.aFace, 1);
    body.computeVertexNormals();
  }
}

const VS = `
attribute float aFace;
varying float vFace;
varying vec2 vUv;
varying vec3 vW;
varying vec3 vN;
void main() {
  vFace = aFace;
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FS = `
uniform sampler2D uKey, uKeyRaw, uDet;
uniform sampler2D uRY, uRC, uLY, uLC, uBY, uBC;
uniform vec3 uCam, uSand;
uniform vec4 uCrop;
uniform vec2 uPM;
uniform mat4 uKeyView;
uniform float uShowW, uY0, uH, uD;
uniform vec2 uSpanB;

vec4 i3dHash4(vec2 p) {
  vec4 p4 = fract(vec4(p.xyxy) * vec4(0.1031, 0.1030, 0.0973, 0.1099) + 0.0804);
  p4 += dot(p4, p4.wzxy + 33.33);
  return fract((p4.xxyz + p4.yzzw) * p4.zywx);
}
vec2 i3dRot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
float i3dTap(vec2 st, vec2 v, vec2 gx, vec2 gy) {
  vec4 h = i3dHash4(v * vec2(1.731, 9.137) + 3.7);
  float a = (h.x * 2.0 - 1.0) * 3.14159265;
  vec2 cen = vec2(v.x, (v.y + 0.57735027 * v.x) / 1.15470054) / 3.4641016;
  vec2 u = i3dRot(st - cen, a) + cen + h.yz * 7.0;
  return textureGrad(uDet, u, i3dRot(gx, a), i3dRot(gy, a)).r;
}
float towerDet(vec3 wp, vec3 wn, float dist) {
  float f = 1.0 - smoothstep(30.0, 50.0, dist);
  if (f < 0.002) return 1.0;
  vec3 an = abs(wn);
  vec2 st = (an.y > max(an.x, an.z) ? wp.xz : (an.x > an.z ? wp.zy : wp.xy)) / 2.0;
  vec2 gx = dFdx(st), gy = dFdy(st);
  vec2 s = st * 3.4641016;
  vec2 sk = vec2(s.x, -0.57735027 * s.x + 1.15470054 * s.y);
  vec2 base = floor(sk);
  vec3 t = vec3(fract(sk), 0.0); t.z = 1.0 - t.x - t.y;
  float sg = step(0.0, -t.z);
  float l1 = i3dTap(st, base + vec2(sg, sg), gx, gy);
  float l2 = i3dTap(st, base + vec2(sg, 1.0 - sg), gx, gy);
  float l3 = i3dTap(st, base + vec2(1.0 - sg, sg), gx, gy);
  float s2 = 2.0 * sg - 1.0;
  vec3 w = vec3(-t.z * s2, sg - t.y * s2, sg - t.x * s2);
  vec3 W = mix(vec3(1.0), vec3(l1, l2, l3) * 2.0, 0.6) * pow(max(w, 0.0), vec3(7.0));
  W /= max(W.x + W.y + W.z, 1e-5);
  float lum = l1 * W.x + l2 * W.y + l3 * W.z;
  return max(1.0 + (lum - 0.5) * 2.0 * 0.35 * f, 0.0);
}
vec3 ycc(sampler2D yTex, sampler2D cTex, vec2 st) {
  float Y = texture2D(yTex, st).r;
  vec2 C = texture2D(cTex, st).rg - 0.5;
  return clamp(vec3(Y + 1.5748 * C.y, Y - 0.187324 * C.x - 0.468124 * C.y, Y + 1.8556 * C.x), 0.0, 1.0);
}
vec2 keyUv(vec3 wp) {
  vec4 cam = uKeyView * vec4(wp, 1.0);
  float z = max(1e-3, -cam.z);
  vec2 ndc = vec2(uPM.x * cam.x / z, uPM.y * cam.y / z);
  vec2 px = vec2((ndc.x + 1.0) * 0.5 * 1280.0, (1.0 - ndc.y) * 0.5 * 720.0);
  return (px - uCrop.xy) / uCrop.zw;
}
void towerAlbedo(inout vec4 diffuseColor, vec2 uvIn, inout vec3 emit) {
  vec3 n = normalize(vN);
  vec3 toK = normalize(uCam - vW);
  float facing = smoothstep(0.42, 0.58, dot(n, toK));
  float dist = distance(vW, cameraPosition);
  float far = smoothstep(30.0, 50.0, dist);
  float wKey = (vFace < 0.5) ? facing * far : 0.0;
  vec2 kuv = clamp(keyUv(vW), 0.0, 1.0);
  vec3 keyC = texture2D(uKey, kuv).rgb;
  vec3 keyPhoto = texture2D(uKeyRaw, kuv).rgb;
  float hh = clamp((vW.y - uY0) / uH, 0.0, 1.0);
  vec3 plate = uSand;
  if (vFace < 0.5) plate = keyC;
  else if (vFace < 1.5) plate = ycc(uRY, uRC, vec2(clamp(uvIn.y / uD, 0.0, 1.0), 1.0 - hh));
  else if (vFace < 2.5) plate = ycc(uLY, uLC, vec2(clamp(uvIn.y / uD, 0.0, 1.0), 1.0 - hh));
  else if (vFace < 3.5) plate = ycc(uBY, uBC, vec2(clamp(uvIn.x / uSpanB.x, 0.0, 1.0), 1.0 - clamp(uvIn.y / uSpanB.y, 0.0, 1.0)));
  vec3 alb = mix(plate, keyC, wKey);
  float det = towerDet(vW, n, dist);
  alb *= det;
  if (uShowW > 0.5) {
    emit = vec3(wKey, 1.0 - wKey, facing);
    diffuseColor.rgb = vec3(0.0);
    return;
  }
  // The key camera looks at the shaded face (game sun is behind it). Delighted albedo
  // under that sun goes black. Put the raw key back as emissive on that face so the
  // hero view keeps the photo, and leave a little diffuse so a sun hit still adds.
  // Flanks stay lit plates (no emissive).
  if (vFace < 0.5) {
    emit = keyPhoto * det;
    diffuseColor.rgb = alb * 0.12;
  } else {
    emit = vec3(0.0);
    diffuseColor.rgb = alb;
  }
}
`;
// MeshStandard lighting: replace the map sample, keep lights and shadows.
const mat = new T.MeshStandardMaterial({ map: keyTex, color: 0xffffff, roughness: 0.62, metalness: 0.22, side: T.FrontSide });
const spanB = qc.faceSpanM["3"] || [42.6, 159.4];
const keyView = new T.Matrix4().fromArray(qc.mw).invert();
mat.onBeforeCompile = (sh) => {
  sh.uniforms.uKey = { value: keyTex };
  sh.uniforms.uKeyRaw = { value: keyRawTex };
  sh.uniforms.uDet = { value: detImg };
  sh.uniforms.uRY = { value: right.y }; sh.uniforms.uRC = { value: right.c };
  sh.uniforms.uLY = { value: left.y }; sh.uniforms.uLC = { value: left.c };
  sh.uniforms.uBY = { value: back.y }; sh.uniforms.uBC = { value: back.c };
  sh.uniforms.uCam = { value: new T.Vector3(...qc.camPos) };
  sh.uniforms.uSand = { value: new T.Color().setRGB(qc.sand[0], qc.sand[1], qc.sand[2], T.SRGBColorSpace) };
  sh.uniforms.uCrop = { value: new T.Vector4(qc.crop[0], qc.crop[1], qc.crop[2] - qc.crop[0], qc.crop[3] - qc.crop[1]) };
  sh.uniforms.uPM = { value: new T.Vector2(qc.pm[0], qc.pm[5]) };
  sh.uniforms.uKeyView = { value: keyView };
  sh.uniforms.uShowW = { value: show0 };
  sh.uniforms.uY0 = { value: qc.baseY };
  sh.uniforms.uH = { value: qc.height };
  sh.uniforms.uD = { value: qc.depth };
  sh.uniforms.uSpanB = { value: new T.Vector2(spanB[0], spanB[1]) };
  sh.vertexShader = "attribute float aFace;\nvarying float vFace;\nvarying vec3 vW;\nvarying vec3 vN;\n" + sh.vertexShader
    .replace("#include <uv_pars_vertex>", "#include <uv_pars_vertex>")
    .replace("#include <project_vertex>", "#include <project_vertex>\n vFace = aFace; vec4 twW = modelMatrix * vec4(transformed, 1.0); vW = twW.xyz; vN = normalize(mat3(modelMatrix) * objectNormal);");
  sh.fragmentShader = "varying float vFace;\nvarying vec3 vW;\nvarying vec3 vN;\n" + FS + "\n" + sh.fragmentShader
    .replace("#include <map_fragment>", "towerAlbedo(diffuseColor, vMapUv, totalEmissiveRadiance);");
  mat.userData.sh = sh;
};
const mesh = new T.Mesh(body, mat);
mesh.name = "tower-hero";
mesh.castShadow = true;
mesh.receiveShadow = true;
mesh.frustumCulled = false;

const tg = new T.BufferGeometry();
tg.setAttribute("position", new T.BufferAttribute(trimPos, 3));
tg.setAttribute("color", new T.BufferAttribute(trimColor, 3));
tg.setAttribute("aMetal", new T.BufferAttribute(trimMetal, 1));
tg.computeVertexNormals();
const tmat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.7, side: T.FrontSide });
tmat.onBeforeCompile = (sh) => {
  sh.vertexShader = "attribute float aMetal;\nvarying float vMetal;\n" + sh.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n vMetal = aMetal;");
  sh.fragmentShader = "varying float vMetal;\n" + sh.fragmentShader.replace("#include <metalnessmap_fragment>", "float metalnessFactor = clamp(vMetal, 0.0, 1.0);");
};
const trim = new T.Mesh(tg, tmat);
trim.name = "tower-hero-trim";
trim.castShadow = true;
trim.receiveShadow = true;
trim.frustumCulled = false;
scene.add(mesh);
scene.add(trim);

function fitShadow() {
  const sun = window.__zbDebug && window.__zbDebug.sun;
  if (!sun || !sun.shadow) return;
  const cam = sun.shadow.camera;
  sun.updateMatrixWorld(true);
  cam.updateMatrixWorld(true);
  const inv = cam.matrixWorldInverse;
  const box = new T.Box3().setFromObject(mesh);
  const v = new T.Vector3();
  let x0 = cam.left, x1 = cam.right, y0 = cam.bottom, y1 = cam.top;
  const xs = [box.min.x, box.max.x], ys = [box.min.y, box.max.y], zs = [box.min.z, box.max.z];
  for (const x of xs) for (const y of ys) for (const z of zs) {
    v.set(x, y, z).applyMatrix4(inv);
    x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x);
    y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
  }
  cam.left = x0 - 6; cam.right = x1 + 6; cam.bottom = y0 - 6; cam.top = y1 + 6;
  cam.updateProjectionMatrix();
  R.shadowMap.needsUpdate = true;
}
fitShadow();

function only(on) { isoOn = !!on; }
window.__tower = {
  mesh, trim, qc,
  setShowW: (b) => { if (mat.userData.sh) mat.userData.sh.uniforms.uShowW.value = b ? 1 : 0; },
  only,
  stats: () => ({
    bodyTris: pos.length / 9, trimTris: nTrim / 3,
    draws: 2,
  }),
};
window.__towerReady = true;

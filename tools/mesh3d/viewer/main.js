import * as THREE from "three";

const params = new URLSearchParams(location.search);
const phoneW = Number(params.get("w") || 720);
const phoneH = Number(params.get("h") || 1600);
const buryOn = params.get("bury") !== "0";
const root = params.get("root") || "..";

const canvas = document.getElementById("view");
canvas.width = phoneW;
canvas.height = phoneH;

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: false,
  premultipliedAlpha: false,
});
renderer.setPixelRatio(1);
renderer.setSize(phoneW, phoneH, false);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

const asset = await fetch(`${root}/out/asset.json`).then((r) => r.json());
const geometry = parseObj(await fetch(`${root}/out/${asset.mesh}`).then((r) => r.text()));

const views = [];
for (const view of asset.views) {
  const tex = await loadTexture(`${root}/inputs/ship/${view.file}`);
  const depth = new THREE.WebGLRenderTarget(view.width, view.height, {
    type: THREE.FloatType,
    format: THREE.RedFormat,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
  });
  const fovY = (view.fovYDeg * Math.PI) / 180;
  const fy = (view.height * 0.5) / Math.tan(fovY * 0.5);
  views.push({ ...view, tex, depth, fy });
}

const depthUniforms = {
  camPos: { value: new THREE.Vector3() },
  camRight: { value: new THREE.Vector3() },
  camUp: { value: new THREE.Vector3() },
  camFwd: { value: new THREE.Vector3() },
  fy: { value: 1 },
  wh: { value: new THREE.Vector2(1, 1) },
};
const depthMat = new THREE.ShaderMaterial({
  uniforms: depthUniforms,
  side: THREE.FrontSide,
  vertexShader: `
    uniform vec3 camPos, camRight, camUp, camFwd;
    uniform float fy;
    uniform vec2 wh;
    varying float vZ;
    void main() {
      vec3 rel = position - camPos;
      float x = dot(rel, camRight);
      float y = dot(rel, camUp);
      float z = dot(rel, camFwd);
      vZ = z;
      float u = (wh.x - 1.0) * 0.5 + fy * (x / z);
      float v = (wh.y - 1.0) * 0.5 - fy * (y / z);
      float ndcX = ((u + 0.5) / wh.x) * 2.0 - 1.0;
      float ndcY = 1.0 - ((v + 0.5) / wh.y) * 2.0;
      float ndcZ = clamp(z / 20.0, 0.0, 1.0);
      gl_Position = vec4(ndcX * z, ndcY * z, ndcZ * z, z);
    }
  `,
  fragmentShader: `
    varying float vZ;
    void main() { gl_FragColor = vec4(vZ, 0.0, 0.0, 1.0); }
  `,
});
const depthMesh = new THREE.Mesh(geometry, depthMat);
const depthScene = new THREE.Scene();
depthScene.add(depthMesh);
const dummy = new THREE.Camera();

for (const view of views) {
  const c = view.camera;
  depthUniforms.camPos.value.set(c.position[0], c.position[1], c.position[2]);
  depthUniforms.camRight.value.set(c.right[0], c.right[1], c.right[2]);
  depthUniforms.camUp.value.set(c.up[0], c.up[1], c.up[2]);
  depthUniforms.camFwd.value.set(c.forward[0], c.forward[1], c.forward[2]);
  depthUniforms.fy.value = view.fy;
  depthUniforms.wh.value.set(view.width, view.height);
  renderer.setRenderTarget(view.depth);
  renderer.setViewport(0, 0, view.width, view.height);
  renderer.setScissorTest(false);
  renderer.setClearColor(0x000000, 1);
  renderer.clear();
  renderer.render(depthScene, dummy);
}
renderer.setRenderTarget(null);
renderer.setViewport(0, 0, phoneW, phoneH);
renderer.setClearColor(0x000000, 0);

const uniforms = {
  viewerYaw: { value: 0 },
  groundY: { value: asset.groundY },
  bury: { value: buryOn ? 1 : 0 },
  zBias: { value: asset.zBias },
  srcCount: { value: views.length },
};
for (let i = 0; i < 6; i++) {
  const view = views[i];
  uniforms[`map${i}`] = { value: view ? view.tex : null };
  uniforms[`dep${i}`] = { value: view ? view.depth.texture : null };
  uniforms[`pos${i}`] = { value: new THREE.Vector3() };
  uniforms[`right${i}`] = { value: new THREE.Vector3(1, 0, 0) };
  uniforms[`up${i}`] = { value: new THREE.Vector3(0, 1, 0) };
  uniforms[`fwd${i}`] = { value: new THREE.Vector3(0, 0, 1) };
  uniforms[`yaw${i}`] = { value: 0 };
  uniforms[`size${i}`] = { value: new THREE.Vector2(1, 1) };
  uniforms[`fy${i}`] = { value: 1 };
  if (!view) continue;
  const c = view.camera;
  uniforms[`pos${i}`].value.set(c.position[0], c.position[1], c.position[2]);
  uniforms[`right${i}`].value.set(c.right[0], c.right[1], c.right[2]);
  uniforms[`up${i}`].value.set(c.up[0], c.up[1], c.up[2]);
  uniforms[`fwd${i}`].value.set(c.forward[0], c.forward[1], c.forward[2]);
  uniforms[`yaw${i}`].value = view.yawDeg;
  uniforms[`size${i}`].value.set(view.width, view.height);
  uniforms[`fy${i}`].value = view.fy;
}

const decl = [0, 1, 2, 3, 4, 5]
  .map(
    (i) => `
    uniform sampler2D map${i};
    uniform sampler2D dep${i};
    uniform vec3 pos${i};
    uniform vec3 right${i};
    uniform vec3 up${i};
    uniform vec3 fwd${i};
    uniform float yaw${i};
    uniform vec2 size${i};
    uniform float fy${i};`,
  )
  .join("\n");

const material = new THREE.ShaderMaterial({
  uniforms,
  transparent: true,
  depthWrite: true,
  side: THREE.FrontSide,
  vertexShader: `
    varying vec3 vWorld;
    void main() {
      vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vWorld;
    uniform float viewerYaw, groundY, bury, zBias, srcCount;
    ${decl}
    float wrapDeg(float d) { return mod(d + 180.0, 360.0) - 180.0; }
    vec4 fetchMap(int id, vec2 uv) {
      if (id == 0) return texture2D(map0, uv);
      if (id == 1) return texture2D(map1, uv);
      if (id == 2) return texture2D(map2, uv);
      if (id == 3) return texture2D(map3, uv);
      if (id == 4) return texture2D(map4, uv);
      return texture2D(map5, uv);
    }
    float fetchDep(int id, vec2 uv) {
      if (id == 0) return texture2D(dep0, uv).r;
      if (id == 1) return texture2D(dep1, uv).r;
      if (id == 2) return texture2D(dep2, uv).r;
      if (id == 3) return texture2D(dep3, uv).r;
      if (id == 4) return texture2D(dep4, uv).r;
      return texture2D(dep5, uv).r;
    }
    vec3 P(int id) { if (id==0) return pos0; if (id==1) return pos1; if (id==2) return pos2; if (id==3) return pos3; if (id==4) return pos4; return pos5; }
    vec3 R(int id) { if (id==0) return right0; if (id==1) return right1; if (id==2) return right2; if (id==3) return right3; if (id==4) return right4; return right5; }
    vec3 U(int id) { if (id==0) return up0; if (id==1) return up1; if (id==2) return up2; if (id==3) return up3; if (id==4) return up4; return up5; }
    vec3 F(int id) { if (id==0) return fwd0; if (id==1) return fwd1; if (id==2) return fwd2; if (id==3) return fwd3; if (id==4) return fwd4; return fwd5; }
    float Yw(int id) { if (id==0) return yaw0; if (id==1) return yaw1; if (id==2) return yaw2; if (id==3) return yaw3; if (id==4) return yaw4; return yaw5; }
    vec2 S(int id) { if (id==0) return size0; if (id==1) return size1; if (id==2) return size2; if (id==3) return size3; if (id==4) return size4; return size5; }
    float Fy(int id) { if (id==0) return fy0; if (id==1) return fy1; if (id==2) return fy2; if (id==3) return fy3; if (id==4) return fy4; return fy5; }

    void main() {
      if (bury > 0.5 && vWorld.y < groundY) discard;
      vec3 acc = vec3(0.0);
      float wsum = 0.0;
      for (int i = 0; i < 6; i++) {
        if (float(i) >= srcCount) break;
        float delta = abs(wrapDeg(viewerYaw - Yw(i)));
        if (delta > 45.0) continue;
        float w = cos(radians(delta));
        vec3 rel = vWorld - P(i);
        float x = dot(rel, R(i));
        float y = dot(rel, U(i));
        float z = dot(rel, F(i));
        if (z < 1e-3) continue;
        vec2 wh = S(i);
        float u = (wh.x - 1.0) * 0.5 + Fy(i) * (x / z);
        float v = (wh.y - 1.0) * 0.5 - Fy(i) * (y / z);
        if (u < 0.0 || v < 0.0 || u > wh.x - 1.0 || v > wh.y - 1.0) continue;
        vec2 uv = (vec2(floor(u), floor(v)) + 0.5) / wh;
        vec4 src = fetchMap(i, uv);
        if (src.a < 0.06) continue;
        float recorded = fetchDep(i, uv);
        if (recorded < 1e-3) continue;
        if (z > recorded + zBias) continue;
        acc += w * src.rgb;
        wsum += w;
      }
      if (wsum <= 0.0) discard;
      gl_FragColor = vec4(acc / wsum, 1.0);
    }
  `,
});

const scene = new THREE.Scene();
scene.add(new THREE.Mesh(geometry, material));
const camera = new THREE.PerspectiveCamera(30, phoneW / phoneH, 0.05, 80);

function placeOrbit(yawDeg) {
  const elev = (asset.elevationDeg * Math.PI) / 180;
  const yaw = (yawDeg * Math.PI) / 180;
  const dist = asset.viewDistance;
  const horiz = Math.cos(elev) * dist;
  camera.position.set(Math.sin(yaw) * horiz, Math.sin(elev) * dist, Math.cos(yaw) * horiz);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);
  camera.fov = verticalFov(asset.hfovDeg, phoneW, phoneH);
  camera.aspect = phoneW / phoneH;
  camera.updateProjectionMatrix();
  uniforms.viewerYaw.value = yawDeg;
}

function draw(yawDeg) {
  placeOrbit(yawDeg);
  renderer.setRenderTarget(null);
  renderer.setViewport(0, 0, phoneW, phoneH);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, camera);
}

let yaw = Number(params.get("yaw") || 0);
draw(yaw);
window.__SHOT_READY = renderer.getContext().getError() === 0;
window.__GL_ERROR = renderer.getContext().getError();
window.renderYaw = (deg) => {
  draw(Number(deg));
  window.__SHOT_READY = true;
  return canvas.toDataURL("image/png");
};

if (!params.has("still")) {
  const clock = new THREE.Clock();
  const spin = () => {
    yaw = (yaw + clock.getDelta() * 20) % 360;
    draw(yaw);
    requestAnimationFrame(spin);
  };
  if (!params.has("yaw")) requestAnimationFrame(spin);
}

function verticalFov(hfovDeg, width, height) {
  const hfov = (hfovDeg * Math.PI) / 180;
  return ((2 * Math.atan(Math.tan(hfov * 0.5) * (height / width))) * 180) / Math.PI;
}

function parseObj(text) {
  const pos = [];
  const nrm = [];
  const faces = [];
  for (const line of text.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === "v") pos.push(parts.slice(1).map(Number));
    else if (parts[0] === "vn") nrm.push(parts.slice(1).map(Number));
    else if (parts[0] === "f") faces.push(parts.slice(1).map((tok) => Number(tok.split("/")[0]) - 1));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos.flat(), 3));
  if (nrm.length === pos.length) geo.setAttribute("normal", new THREE.Float32BufferAttribute(nrm.flat(), 3));
  geo.setIndex(faces.flat());
  return geo;
}

function loadTexture(url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        tex.minFilter = THREE.NearestFilter;
        tex.magFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        tex.colorSpace = THREE.NoColorSpace;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.needsUpdate = true;
        resolve(tex);
      },
      undefined,
      reject,
    );
  });
}

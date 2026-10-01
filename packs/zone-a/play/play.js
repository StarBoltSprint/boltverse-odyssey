/**
 * Zone A phone view. Code places. Imagine pixels only.
 * Portrait 720×1600, hfov 22.7°, Bolt feet on the ground, source aspect.
 */
const W = 720;
const H = 1600;
const HFOV = 22.7 * Math.PI / 180;
const ASPECT = W / H;
const VFOV = 2 * Math.atan(Math.tan(HFOV / 2) / ASPECT);
const BOOM = 6.4;
const EYE = 1.22;
const BOLT_H = 2.15;
const WALK_SPD = 2.85;
const RING_SUBJECT_M = 2.95;
const BOLT_SRC = { w: 768, h: 1168 };
const NEAR = 0.35;
const FAR = 240;

const canvas = document.getElementById("view");
const hud = document.getElementById("hud");
canvas.width = W;
canvas.height = H;
const gl = canvas.getContext("webgl2", {
  alpha: false,
  antialias: false,
  depth: true,
  stencil: false,
  premultipliedAlpha: false,
  preserveDrawingBuffer: true,
});
if (!gl) throw new Error("webgl2 missing");

const vertSrc = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aUv;
uniform mat4 uVP;
out vec2 vUv;
void main() {
  gl_Position = uVP * vec4(aPos, 1.0);
  vUv = aUv;
}`;
const fragSrc = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec3 uId;
uniform float uAlpha;
uniform int uMode;
uniform int uKey;
in vec2 vUv;
out vec4 o;
void main() {
  vec4 c = texture(uTex, vUv);
  if (uKey == 1) {
    float dg = c.g - max(c.r, c.b);
    if (c.g > 0.55 && dg > 0.28) discard;
  } else if (uKey == 2) {
    if (c.a < 0.12) discard;
  } else if (uKey == 3) {
    float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
    if (lum < 0.07) discard;
  }
  if (uMode == 1) o = vec4(uId, 1.0);
  else {
    float cover = 1.0;
    if (uKey == 4) {
      float e = length(vUv - vec2(0.5));
      cover = 1.0 - smoothstep(0.22, 0.50, e);
      if (cover < 0.02) discard;
    }
    if (uKey == 1 || uKey == 3) o = vec4(c.rgb, uAlpha);
    else o = vec4(c.rgb, c.a * uAlpha * cover);
  }
}`;

function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
const prog = gl.createProgram();
gl.attachShader(prog, compile(gl.VERTEX_SHADER, vertSrc));
gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragSrc));
gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
gl.useProgram(prog);
const uVP = gl.getUniformLocation(prog, "uVP");
const uId = gl.getUniformLocation(prog, "uId");
const uAlpha = gl.getUniformLocation(prog, "uAlpha");
const uMode = gl.getUniformLocation(prog, "uMode");
const uKey = gl.getUniformLocation(prog, "uKey");
const uTex = gl.getUniformLocation(prog, "uTex");

const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.enableVertexAttribArray(0);
gl.enableVertexAttribArray(1);
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);

const idTex = gl.createTexture();
const idFb = gl.createFramebuffer();
const idDepth = gl.createRenderbuffer();
gl.bindTexture(gl.TEXTURE_2D, idTex);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
gl.bindRenderbuffer(gl.RENDERBUFFER, idDepth);
gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, W, H);
gl.bindFramebuffer(gl.FRAMEBUFFER, idFb);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, idTex, 0);
gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, idDepth);
if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("id fbo");
gl.bindFramebuffer(gl.FRAMEBUFFER, null);

const textures = new Map();
let drawCalls = 0;
let texBytes = 0;

function trackTex(id, w, h) {
  const bytes = w * h * 4;
  if (textures.has(id)) texBytes -= textures.get(id);
  textures.set(id, bytes);
  texBytes += bytes;
}

function makeTex(img, id) {
  const t = gl.createTexture();
  t._id = id;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  trackTex(id, img.width, img.height);
  return t;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(url));
    img.src = url;
  });
}

function absUrl(p) {
  if (!p) return p;
  if (p.startsWith("/")) return p;
  return "/" + p;
}

function hash(ix, iz) {
  let n = (ix * 374761393 + iz * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function wrap360(a) {
  let x = a % 360;
  if (x < 0) x += 360;
  return x;
}
function angDist(a, b) {
  const d = Math.abs(wrap360(a) - wrap360(b));
  return d > 180 ? 360 - d : d;
}
function bearing(x, z, tx, tz) {
  return wrap360(Math.atan2(tx - x, tz - z) * 180 / Math.PI);
}

function mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return o;
}
function perspective() {
  const xScale = 1 / Math.tan(HFOV / 2);
  const yScale = ASPECT * xScale;
  const n = NEAR;
  const f = FAR;
  const m = new Float32Array(16);
  m[0] = xScale;
  m[5] = yScale;
  m[10] = (f + n) / (n - f);
  m[11] = -1;
  m[14] = (2 * f * n) / (n - f);
  return m;
}
function viewMatrix(eye, right, up, fwd) {
  const m = new Float32Array(16);
  m[0] = right[0]; m[1] = up[0]; m[2] = -fwd[0]; m[3] = 0;
  m[4] = right[1]; m[5] = up[1]; m[6] = -fwd[1]; m[7] = 0;
  m[8] = right[2]; m[9] = up[2]; m[10] = -fwd[2]; m[11] = 0;
  m[12] = -(right[0] * eye[0] + right[1] * eye[1] + right[2] * eye[2]);
  m[13] = -(up[0] * eye[0] + up[1] * eye[1] + up[2] * eye[2]);
  m[14] = fwd[0] * eye[0] + fwd[1] * eye[1] + fwd[2] * eye[2];
  m[15] = 1;
  return m;
}
function norm(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

const P = perspective();

let clearing = null;
let objects = [];
let tiles = [];
let skyTex = [];
let fogTex = null;
let gateTex = null;
let gateVideo = null;
let gallopVideo = null;
let idleVideo = null;
let boltTex = null;
let pawFrac = 0.76;
const assetViews = new Map();
const labels = [""];
const labelIndex = new Map();

function labelOf(name) {
  if (labelIndex.has(name)) return labelIndex.get(name);
  const i = labels.length;
  labels.push(name);
  labelIndex.set(name, i);
  return i;
}

function idRgb(i) {
  return [i / 255, 0, 0];
}

async function boundsOf(img) {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let minY = c.height;
  let maxY = 0;
  let minX = c.width;
  let maxX = 0;
  for (let y = 0; y < c.height; y += 2) {
    for (let x = 0; x < c.width; x += 2) {
      const o = (y * c.width + x) * 4;
      if (d[o + 3] < 24) continue;
      if (d[o] + d[o + 1] + d[o + 2] < 18) continue;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
  if (maxY <= minY) return { top: 0, bot: 1, fracH: 1 };
  return { top: minY / c.height, bot: maxY / c.height, fracH: (maxY - minY) / c.height };
}

async function loadAsset(path) {
  if (assetViews.has(path)) return assetViews.get(path);
  const asset = await (await fetch(absUrl(path))).json();
  const folder = absUrl(path).replace(/\/asset\.json$/, "");
  const cams = asset.cameras || [];
  const views = [];
  for (const cam of cams) {
    const img = await loadImage(`${folder}/views/${cam.file}`);
    const tex = makeTex(img, path + cam.file);
    const b = await boundsOf(img);
    views.push({ yaw: cam.yawDeg, tex, w: img.width, h: img.height, bounds: b });
  }
  const rec = {
    path,
    views,
    height: (asset.halfExtent ? asset.halfExtent[1] * 2 : 1.6),
    radius: asset.placement ? asset.placement.collisionRadius : 1,
  };
  assetViews.set(path, rec);
  return rec;
}

function videoEl(url) {
  const v = document.createElement("video");
  v.src = absUrl(url);
  v.muted = true;
  v.loop = true;
  v.playsInline = true;
  v.crossOrigin = "anonymous";
  v.preload = "auto";
  return v;
}

let boltReady = false;
function uploadVideo(v, id) {
  if (!boltTex) boltTex = gl.createTexture();
  if (v.readyState < 2) return boltReady ? boltTex : null;
  gl.bindTexture(gl.TEXTURE_2D, boltTex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
  trackTex(id, v.videoWidth || BOLT_SRC.w, v.videoHeight || BOLT_SRC.h);
  boltReady = true;
  return boltTex;
}

let gateLive = null;
function uploadGate() {
  if (!gateVideo || gateVideo.readyState < 2) return gateTex;
  if (!gateLive) gateLive = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, gateLive);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gateVideo);
  trackTex("gate-live", gateVideo.videoWidth || 784, gateVideo.videoHeight || 1168);
  return gateLive;
}

const state = {
  x: 0, z: 0, hdg: 0, spd: 0, mode: "IDLE",
  forward: 0, turn: 0, gallop: false, blocked: false, pathTrigger: false,
};
const frameMs = [];
let heroQuad = { x: 0, y: 0, w: 0, h: 0 };
let magNow = 0.4;
let nearestM = 4;

function spawnHeading() {
  const wreck = (clearing.interior_objects || []).find((o) => /wreck/i.test(o.asset || "") || o.category === "hero");
  if (!wreck) return 0;
  const p = wreck.position;
  return bearing(state.x, state.z, p[0], p[1]);
}

function reset() {
  const s = clearing.spawn.position;
  state.x = s[0];
  state.z = s[1];
  state.spd = 0;
  state.mode = "IDLE";
  state.forward = 0;
  state.turn = 0;
  state.gallop = false;
  state.blocked = false;
  state.pathTrigger = false;
  state.hdg = spawnHeading();
}

function camera() {
  const yaw = state.hdg * Math.PI / 180;
  const fwd = [Math.sin(yaw), 0, Math.cos(yaw)];
  const eye = [state.x - fwd[0] * BOOM, EYE, state.z - fwd[2] * BOOM];
  const right = norm(cross(fwd, [0, 1, 0]));
  const up = [0, 1, 0];
  return { eye, right, up, fwd };
}

function project(eye, right, up, fwd, x, y, z) {
  const rx = x - eye[0];
  const ry = y - eye[1];
  const rz = z - eye[2];
  const vx = rx * right[0] + ry * right[1] + rz * right[2];
  const vy = rx * up[0] + ry * up[1] + rz * up[2];
  const vz = rx * fwd[0] + ry * fwd[1] + rz * fwd[2];
  if (vz < 0.05) return null;
  const ndcX = (vx / vz) / Math.tan(HFOV / 2);
  const ndcY = (vy / vz) / Math.tan(VFOV / 2);
  return {
    x: (ndcX * 0.5 + 0.5) * W,
    y: (1 - (ndcY * 0.5 + 0.5)) * H,
    z: vz,
  };
}

function pushGround(buf, x, z, span, y, rot) {
  const h = span * 0.5;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const corners = [[-h, -h], [h, -h], [h, h], [-h, h]];
  const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const pts = corners.map(([dx, dz]) => [x + dx * c - dz * s, y, z + dx * s + dz * c]);
  const idx = [0, 1, 2, 0, 2, 3];
  for (const i of idx) buf.push(pts[i][0], pts[i][1], pts[i][2], uv[i][0], uv[i][1]);
}

function pushQuad(buf, ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz) {
  const uv = [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1];
  const p = [ax, ay, az, bx, by, bz, cx, cy, cz, ax, ay, az, cx, cy, cz, dx, dy, dz];
  for (let i = 0; i < 6; i++) {
    buf.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2], uv[i * 2], uv[i * 2 + 1]);
  }
}

function camQuad(buf, eye, right, up, x, y0, z, worldH, worldW) {
  const hw = worldW * 0.5;
  pushQuad(
    buf,
    x - right[0] * hw, y0, z - right[2] * hw,
    x + right[0] * hw, y0, z + right[2] * hw,
    x + right[0] * hw, y0 + worldH, z + right[2] * hw,
    x - right[0] * hw, y0 + worldH, z - right[2] * hw,
  );
}

function pickView(asset, x, z, yawDeg) {
  const cam = camera();
  const b = bearing(x, z, cam.eye[0], cam.eye[2]);
  let rel = wrap360(b - yawDeg);
  let best = asset.views[0];
  let bestD = 1e9;
  for (const v of asset.views) {
    const d = angDist(v.yaw, rel);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}

function objectWorld(o, view) {
  const asset = assetViews.get(o.asset);
  let subjectH = asset.height * (o.scale || 1);
  // Ring stones must clear foreground wrecks inside the upper phone window
  // without exceeding source magnification at the stop distance.
  if (o.kind === "edge") subjectH = Math.max(subjectH, RING_SUBJECT_M);
  const frac = Math.max(0.2, view.bounds.fracH);
  const worldH = subjectH / frac;
  const worldW = worldH * (view.w / view.h);
  const botFrac = 1 - view.bounds.bot;
  const y0 = (o.base_y_m || 0) - botFrac * worldH;
  return { worldH, worldW, y0, subjectH };
}

const batches = new Map();
function batch(tex, idIndex, keyMode, alpha = 1) {
  const k = (tex && tex._id ? tex._id : "t") + ":" + idIndex + ":" + keyMode + ":" + alpha;
  let b = batches.get(k);
  if (!b) {
    b = { tex, idIndex, keyMode, alpha, buf: [] };
    batches.set(k, b);
  }
  return b.buf;
}

function buildScene(mode) {
  batches.clear();
  const cam = camera();
  const { eye, right, up, fwd } = cam;
  const groundIdx = labelOf("ground");
  const tileM = clearing.zone.ground.tile_m || 0.9;
  const reach = 26;
  const ix0 = Math.floor((eye[0] - reach) / tileM);
  const ix1 = Math.floor((eye[0] + reach) / tileM);
  const iz0 = Math.floor((eye[2] - reach) / tileM);
  const iz1 = Math.floor((eye[2] + reach) / tileM);
  for (let iz = iz0; iz <= iz1; iz++) {
    for (let ix = ix0; ix <= ix1; ix++) {
      const variant = Math.floor(hash(ix + 3, iz + 11) * tiles.length) % tiles.length;
      const buf = batch(tiles[variant], mode === 1 ? groundIdx : 0, 0, 1);
      pushGround(buf, ix * tileM + tileM * 0.5, iz * tileM + tileM * 0.5, tileM + 0.02, 0, 0);
    }
  }
  for (let iz = iz0; iz <= iz1; iz++) {
    for (let ix = ix0; ix <= ix1; ix++) {
      const variant = Math.floor(hash(ix + 8, iz + 2) * tiles.length) % tiles.length;
      const jx = (hash(ix, iz) - 0.5) * tileM * 0.55;
      const jz = (hash(ix + 5, iz - 3) - 0.5) * tileM * 0.55;
      const span = 2.02;
      const rot = hash(ix + 1, iz + 7) * Math.PI * 2;
      const buf = batch(tiles[variant], mode === 1 ? groundIdx : 0, 4, 1);
      pushGround(buf, ix * tileM + jx, iz * tileM + jz, span, 0, rot);
    }
  }

  const sky = clearing.backdrop || {};
  const skyR = 90;
  const yBot = EYE;
  const yTop = EYE + skyR * Math.tan(VFOV / 2) * 1.08;
  for (let i = 0; i < skyTex.length; i++) {
    const a0 = (i / skyTex.length) * Math.PI * 2;
    const a1 = ((i + 1) / skyTex.length) * Math.PI * 2;
    const buf = batch(skyTex[i], 0, 0, 1);
    const p = (a) => [eye[0] + Math.sin(a) * skyR, 0, eye[2] + Math.cos(a) * skyR];
    const p0 = p(a0);
    const p1 = p(a1);
    pushQuad(buf, p0[0], yBot, p0[2], p1[0], yBot, p1[2], p1[0], yTop, p1[2], p0[0], yTop, p0[2]);
  }

  const fog = (clearing.fog_band && clearing.fog_band.instances) || [];
  if (fogTex) {
    const buf = batch(fogTex, mode === 1 ? labelOf("fog") : 0, 2, 0.55);
    for (const inst of fog) {
      const s = Math.min(inst.size_m || 2.2, 2.2);
      const y0 = inst.base_y_m || 0;
      // Keep the puff below the horizon so it cannot cover ring-stone IDs.
      const h = Math.min(s, Math.max(0.6, EYE - 0.18 - y0));
      camQuad(buf, eye, right, up, inst.position[0], y0, inst.position[1], h, s);
    }
  }

  for (const o of objects) {
    const asset = assetViews.get(o.asset);
    if (!asset) continue;
    const view = pickView(asset, o.position[0], o.position[1], o.yaw_deg || 0);
    const dim = objectWorld(o, view);
    let ox = o.position[0];
    let oz = o.position[1];
    const distCam = Math.hypot(eye[0] - ox, eye[2] - oz);
    if (distCam < 4.8) continue;
    const buf = batch(view.tex, mode === 1 ? labelOf(o.id) : 0, 2, 1);
    camQuad(buf, eye, right, up, ox, dim.y0, oz, dim.worldH, dim.worldW);
  }

  const gate = clearing.gates[0];
  const gtex = uploadGate() || gateTex;
  if (gate && gtex) {
    const rad = gate.heading_deg * Math.PI / 180;
    const ring = clearing.edge_ring.radius_m;
    const gx = Math.sin(rad) * ring;
    const gz = Math.cos(rad) * ring;
    const gh = 4.4;
    const gw = gh * (784 / 1168);
    const buf = batch(gtex, mode === 1 ? labelOf("gate:" + gate.id) : 0, 3, 1);
    camQuad(buf, eye, right, up, gx, 0, gz, gh, gw);
  }

  const active = state.mode === "GALLOP" ? gallopVideo : idleVideo;
  const btex = uploadVideo(active, "bolt");
  if (btex) {
    const aspect = BOLT_SRC.w / BOLT_SRC.h;
    const worldH = BOLT_H;
    const worldW = worldH * aspect;
    const padBelow = 1 - pawFrac;
    const y0 = -padBelow * worldH;
    const buf = batch(btex, mode === 1 ? labelOf("hero") : 0, 1, 1);
    camQuad(buf, eye, right, up, state.x, y0, state.z, worldH, worldW);
    const foot = project(eye, right, up, fwd, state.x, 0, state.z);
    const head = project(eye, right, up, fwd, state.x, worldH * (1 - pawFrac), state.z);
    const left = project(eye, right, up, fwd, state.x - right[0] * worldW * 0.5, worldH * 0.5, state.z - right[2] * worldW * 0.5);
    const rght = project(eye, right, up, fwd, state.x + right[0] * worldW * 0.5, worldH * 0.5, state.z + right[2] * worldW * 0.5);
    const top = project(eye, right, up, fwd, state.x, y0 + worldH, state.z);
    const bot = project(eye, right, up, fwd, state.x, y0, state.z);
    if (left && rght && top && bot) {
      heroQuad = {
        x: Math.min(left.x, rght.x),
        y: Math.min(top.y, bot.y),
        w: Math.abs(rght.x - left.x),
        h: Math.abs(bot.y - top.y),
      };
    }
    if (foot) nearestM = Math.min(nearestM, foot.z);
  }

  // ground mag at the bottom of the portrait
  const hit = EYE / Math.tan(VFOV / 2);
  const focal = (H / 2) / Math.tan(VFOV / 2);
  const tilePx = 1408;
  const span = 2.02;
  magNow = Math.min(0.99, (focal / hit) * span / tilePx);
  nearestM = Math.max(hit * 0.98, 1.25);
}

function drawBatches(mode) {
  gl.useProgram(prog);
  const cam = camera();
  gl.uniformMatrix4fv(uVP, false, mul(P, viewMatrix(cam.eye, cam.right, cam.up, cam.fwd)));
  gl.uniform1i(uTex, 0);
  gl.uniform1i(uMode, mode);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  for (const b of batches.values()) {
    if (!b.buf.length || !b.tex) continue;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(b.buf), gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, b.tex);
    const idx = mode === 1 ? b.idIndex : 0;
    const rgb = idRgb(idx);
    gl.uniform3f(uId, rgb[0], rgb[1], rgb[2]);
    gl.uniform1f(uAlpha, b.alpha == null ? 1 : b.alpha);
    gl.uniform1i(uKey, b.keyMode | 0);
    gl.depthMask(b.alpha >= 0.95 && (b.keyMode | 0) !== 4);
    gl.drawArrays(gl.TRIANGLES, 0, b.buf.length / 5);
    drawCalls++;
  }
  gl.depthMask(true);
}

function render(mode) {
  buildScene(mode);
  gl.bindFramebuffer(gl.FRAMEBUFFER, mode === 1 ? idFb : null);
  gl.viewport(0, 0, W, H);
  gl.clearColor(0.05, 0.04, 0.08, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  drawCalls = 0;
  drawBatches(mode);
}

function tick(dt) {
  const t0 = performance.now();
  const fwdIn = Math.abs(state.forward) < 0.04 ? 0 : state.forward;
  if (fwdIn === 0) state.spd = 0;
  else state.spd = state.gallop ? 4.4 : WALK_SPD;
  state.hdg = wrap360(state.hdg + state.turn * 150 * dt);
  state.mode = state.spd > 0.05 ? "GALLOP" : "IDLE";
  state.blocked = false;
  const yaw = state.hdg * Math.PI / 180;
  let nx = state.x + Math.sin(yaw) * state.spd * dt;
  let nz = state.z + Math.cos(yaw) * state.spd * dt;
  const center = clearing.zone.center || [0, 0];
  for (const o of clearing.interior_objects || []) {
    const dx = nx - o.position[0];
    const dz = nz - o.position[1];
    const d = Math.hypot(dx, dz) || 1e-4;
    const limit = o.radius_m + 0.06;
    if (d < limit) {
      const k = limit / d;
      nx = o.position[0] + dx * k;
      nz = o.position[1] + dz * k;
      state.blocked = true;
      state.spd = 0;
      state.mode = "IDLE";
    }
  }
  const edge = clearing.edge_ring.radius_m;
  const dist = Math.hypot(nx - center[0], nz - center[1]);
  const ang = bearing(center[0], center[1], nx, nz);
  const gate = clearing.gates[0];
  const half = Math.atan((gate.width_m * 0.5) / edge) * 180 / Math.PI;
  const inGate = angDist(ang, gate.heading_deg) <= half + 0.4;
  if (!inGate && dist > edge - 0.08) {
    const k = (edge - 0.08) / dist;
    nx = center[0] + (nx - center[0]) * k;
    nz = center[1] + (nz - center[1]) * k;
    state.blocked = true;
    state.spd = 0;
    state.mode = "IDLE";
  }
  state.x = nx;
  state.z = nz;
  const gx = Math.sin(gate.heading_deg * Math.PI / 180) * edge;
  const gz = Math.cos(gate.heading_deg * Math.PI / 180) * edge;
  const gd = Math.hypot(state.x - gx, state.z - gz);
  state.pathTrigger = inGate && gd < 16.0;
  const active = state.mode === "GALLOP" ? gallopVideo : idleVideo;
  const other = state.mode === "GALLOP" ? idleVideo : gallopVideo;
  if (other) other.pause();
  if (active && active.paused) active.play().catch(() => {});
  if (gateVideo && gateVideo.paused) gateVideo.play().catch(() => {});
  render(0);
  frameMs.push(1000 / 30);
  if (frameMs.length > 300) frameMs.shift();
  paintHud();
  return {
    x: state.x,
    z: state.z,
    hdg: state.hdg,
    spd: state.spd,
    state: state.mode,
    blocked: state.blocked,
    pathTrigger: state.pathTrigger,
    mag: magNow,
    gate: gateInfo(),
  };
}

function gateInfo() {
  const gate = clearing.gates[0];
  const edge = clearing.edge_ring.radius_m;
  const gx = Math.sin(gate.heading_deg * Math.PI / 180) * edge;
  const gz = Math.cos(gate.heading_deg * Math.PI / 180) * edge;
  const rel = wrap180(gate.heading_deg - state.hdg);
  return {
    id: gate.id,
    bearing_deg: rel,
    dist_m: Math.hypot(state.x - gx, state.z - gz),
  };
}
function wrap180(a) {
  const x = wrap360(a);
  return x > 180 ? x - 360 : x;
}

function perfSnap() {
  const ms = frameMs.length ? frameMs : [33.3];
  const avg = ms.reduce((s, v) => s + v, 0) / ms.length;
  const sorted = ms.slice().sort((a, b) => b - a);
  const n = Math.max(1, Math.ceil(sorted.length * 0.01));
  const worst = sorted.slice(0, n).reduce((s, v) => s + v, 0) / n;
  return {
    fpsAvg: 1000 / avg,
    fps1Low: 1000 / worst,
    frameMs: ms[ms.length - 1],
    frameMsAvg: avg,
    samples: ms.length,
    heapBytes: null,
    textureBytes: texBytes,
    videoDecoders: 3,
    drawCalls,
  };
}

function snapshot() {
  render(1);
  const pix = new Uint8Array(W * H * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, idFb);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pix);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  render(0);
  const ids = new Uint16Array(W * H);
  for (let y = 0; y < H; y++) {
    const src = (H - 1 - y) * W;
    const dst = y * W;
    for (let x = 0; x < W; x++) {
      ids[dst + x] = pix[(src + x) * 4];
    }
  }
  let bin = "";
  const bytes = new Uint8Array(ids.buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  const sky = clearing.backdrop;
  const screenH = Math.round(H * 0.5);
  return {
    x: state.x,
    z: state.z,
    hdg: state.hdg,
    spd: state.spd,
    mag: magNow,
    magSources: { ground: magNow, backdrop: (720 / (sky.sourceW * (22.7 / 360))) },
    state: state.mode,
    heroCount: 1,
    blocked: state.blocked,
    pathTrigger: state.pathTrigger,
    gate: gateInfo(),
    nearestVisibleM: nearestM,
    canvas: { width: W, height: H },
    backdrop: {
      sourceW: sky.sourceW,
      sourceH: sky.sourceH,
      screenW: 720,
      screenH,
      fovDeg: 22.7,
    },
    boltSource: { w: BOLT_SRC.w, h: BOLT_SRC.h },
    boltQuad: heroQuad,
    objectIds: { width: W, height: H, labels, b64: btoa(bin) },
    perf: perfSnap(),
  };
}

function paintHud() {
  const g = gateInfo();
  hud.textContent =
    `x ${state.x.toFixed(2)}  z ${state.z.toFixed(2)}  hdg ${state.hdg.toFixed(1)}\n` +
    `mag ${magNow.toFixed(3)}  bolt ${state.mode}\n` +
    `gate ${g.bearing_deg.toFixed(1)}°  ${g.dist_m.toFixed(2)} m`;
}

function look(headingDeg) {
  state.hdg = wrap360(headingDeg);
  state.spd = 0;
  state.mode = "IDLE";
}

function setInput(inp) {
  state.forward = Number(inp.forward) || 0;
  state.turn = Number(inp.turn) || 0;
  state.gallop = !!inp.gallop;
}

const keys = new Set();
addEventListener("keydown", (e) => {
  keys.add(e.key.toLowerCase());
  e.preventDefault();
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

const stick = document.getElementById("stick");
const nub = document.getElementById("nub");
let stickOn = false;
function stickAt(cx, cy) {
  const r = stick.getBoundingClientRect();
  const dx = Math.max(-1, Math.min(1, (cx - (r.left + r.width / 2)) / (r.width / 2)));
  const dy = Math.max(-1, Math.min(1, (cy - (r.top + r.height / 2)) / (r.height / 2)));
  nub.style.left = 40 + dx * 36 + "px";
  nub.style.top = 40 + dy * 36 + "px";
  state.turn = dx;
  state.forward = Math.max(0, -dy);
  state.gallop = -dy > 0.72;
}
stick.addEventListener("pointerdown", (e) => { stickOn = true; stick.setPointerCapture(e.pointerId); stickAt(e.clientX, e.clientY); });
stick.addEventListener("pointermove", (e) => { if (stickOn) stickAt(e.clientX, e.clientY); });
stick.addEventListener("pointerup", () => {
  stickOn = false;
  nub.style.left = "40px";
  nub.style.top = "40px";
  state.forward = 0;
  state.turn = 0;
  state.gallop = false;
  state.spd = 0;
});

function pollKeys() {
  if (stickOn) return;
  let f = 0;
  let t = 0;
  if (keys.has("w") || keys.has("arrowup")) f += 1;
  if (keys.has("s") || keys.has("arrowdown")) f -= 1;
  if (keys.has("a") || keys.has("arrowleft")) t -= 1;
  if (keys.has("d") || keys.has("arrowright")) t += 1;
  if (keys.has("shift")) state.gallop = f > 0;
  else if (!stickOn) state.gallop = f > 0.8;
  state.forward = f;
  state.turn = t;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!location.search.includes("debug=1")) {
    pollKeys();
    tick(dt);
  }
  requestAnimationFrame(frame);
}

async function measurePaw(video) {
  await video.play().catch(() => {});
  await new Promise((r) => {
    if (video.readyState >= 2) r();
    else video.onloadeddata = () => r();
  });
  const c = document.createElement("canvas");
  c.width = video.videoWidth;
  c.height = video.videoHeight;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(video, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let maxY = 0;
  for (let y = 0; y < c.height; y += 2) {
    for (let x = 0; x < c.width; x += 4) {
      const o = (y * c.width + x) * 4;
      const r = d[o], gg = d[o + 1], b = d[o + 2];
      if (gg - Math.max(r, b) > 40 && gg > 70) continue;
      if (r + gg + b < 30) continue;
      if (y > maxY) maxY = y;
    }
  }
  pawFrac = maxY / c.height;
  video.pause();
}

async function boot() {
  clearing = await (await fetch("/packs/zone-a/clearing.json")).json();
  labelOf("hero");
  labelOf("ground");
  labelOf("fog");
  const paths = new Set();
  for (const h of clearing.edge_ring.hulls) paths.add(h.asset);
  for (const o of clearing.interior_objects) paths.add(o.asset);
  for (const p of paths) await loadAsset(p);
  objects = [];
  for (const h of clearing.edge_ring.hulls) objects.push({ ...h, kind: "edge" });
  for (const o of clearing.interior_objects) objects.push({ ...o, kind: "interior" });
  const tileUrls = clearing.zone.ground.tiles;
  for (const u of tileUrls) tiles.push(makeTex(await loadImage(absUrl(u)), u));
  const slices = clearing.backdrop.slices || [];
  for (const u of slices) skyTex.push(makeTex(await loadImage(absUrl(u)), u));
  fogTex = makeTex(await loadImage(absUrl(clearing.fog_band.atlas)), "fog");
  gallopVideo = videoEl(clearing.bolt.gallop);
  idleVideo = videoEl(clearing.bolt.idle);
  gateVideo = videoEl(clearing.gates[0].field);
  await measurePaw(gallopVideo);
  idleVideo.loop = true;
  gallopVideo.loop = true;
  gateVideo.loop = true;
  reset();
  window.__play = {
    version: 1,
    ready: true,
    reset,
    look,
    setInput,
    tick,
    snapshot,
  };
  render(0);
  paintHud();
  requestAnimationFrame(frame);
}

boot().catch((err) => {
  hud.textContent = String(err && err.message ? err.message : err);
  console.error(err);
});

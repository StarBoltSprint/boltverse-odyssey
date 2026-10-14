/**
 * Zone A phone view. Code places. Imagine pixels only.
 * Portrait 720×1600, hfov 22.7°. Solids are world-locked hulls.
 */
import { loadWorldHull } from "./hullmesh.js";
import { createTerrain } from "./terrain.js";

const W = 720;
const H = 1600;
const HFOV = 22.7 * Math.PI / 180;
const ASPECT = W / H;
const VFOV = 2 * Math.atan(Math.tan(HFOV / 2) / ASPECT);
const FOCAL = (H / 2) / Math.tan(VFOV / 2);
const BOOM = 4.0;
const EYE = 1.22;
const BOLT_H = 2.15;
const WALK_SPD = 2.85;
const BOLT_SRC = { w: 768, h: 1168 };
const GATE_SRC = { w: 784, h: 1168 };
const NEAR = 0.35;
const FAR = 240;
const MIN_BOOM = (FOCAL * BOLT_H) / BOLT_SRC.h + 0.04;
const MAX_BOOM = BOOM / 0.62;

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

const anisoExt = gl.getExtension("EXT_texture_filter_anisotropic");
const anisoMax = anisoExt ? gl.getParameter(anisoExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 0;
const terrain = createTerrain(gl, {
  anisoExt, anisoMax, trackTex, loadImage, absUrl, W, H, FOCAL, VFOV, NEAR, FAR,
});
let useRelief = false;
let shot = null;

function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function program(vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

const surfProg = program(`#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aUv;
layout(location=2) in float aLayer;
uniform mat4 uVP;
uniform vec3 uEye;
uniform float uFollow;
uniform float uEyeBase;
out vec3 vLocal;
void main() {
  vec3 p = aPos;
  if (uFollow > 0.5) p += uEye;
  gl_Position = uVP * vec4(p, 1.0);
  vLocal = aPos;
}`, `#version 300 es
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray uTex;
uniform sampler2D uZenith;
uniform sampler2D uStars;
uniform sampler2D uDust;
uniform sampler2D uNebula;
uniform vec3 uId;
uniform int uMode;
uniform float uEl0;
uniform float uEl1;
uniform float uLayers;
uniform vec3 uMix;
uniform float uFlip;
in vec3 vLocal;
out vec4 o;
void main() {
  if (uMode == 1) {
    o = vec4(uId, 1.0);
    return;
  }
  vec3 dir = normalize(vLocal);
  float horiz = length(dir.xz);
  float az = horiz < 1e-4 ? 0.0 : atan(dir.x, dir.z);
  if (az < 0.0) az += 6.28318530718;
  float el = asin(clamp(dir.y, -1.0, 1.0));
  float v = clamp((el - uEl0) / max(0.001, uEl1 - uEl0), 0.0, 1.0);
  if (uFlip > 0.5) v = 1.0 - v;
  float turns = az / 6.28318530718;
  float lf = turns * max(1.0, uLayers);
  float layer = floor(lf);
  float uu = fract(lf);
  float nxt = mod(layer + 1.0, max(1.0, uLayers));
  vec3 col = texture(uTex, vec3(uu, v, layer)).rgb;
  float seam = smoothstep(0.97, 1.0, uu);
  vec3 edge = texture(uTex, vec3(0.0, v, nxt)).rgb;
  col = mix(col, edge, seam);
  float capT = smoothstep(uEl1 - 0.03, uEl1 + 0.01, el);
  vec2 capUv = clamp(vec2(0.5) + vec2(dir.x, dir.z) * (2.2 / max(dir.y, 0.25)), 0.0, 1.0);
  vec3 zen = texture(uZenith, capUv).rgb;
  col = mix(col, zen, capT);
  // One full-frame veil is not a horizontal loop. Keep the pole, soften only that join.
  float veil = horiz < 0.08 ? 1.0 : smoothstep(0.0, 0.02, min(turns, 1.0 - turns));
  vec2 suv = vec2(turns, v);
  col = mix(col, texture(uStars, suv).rgb, uMix.x * veil);
  col = mix(col, texture(uDust, suv).rgb, uMix.y * veil);
  col = mix(col, texture(uNebula, suv).rgb, uMix.z * veil);
  o = vec4(col, 1.0);
}`);

const fogProg = program(`#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aP;
layout(location=2) in vec4 aS;
uniform mat4 uVP;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uEye;
uniform vec2 uFade;
out vec2 vUv;
out float vAlpha;
flat out float vId;
void main() {
  vec3 c = vec3(aP.x, aP.y + aP.w, aP.z);
  vec3 p = c + uRight * (aCorner.x - 0.5) * aS.x + uUp * (aCorner.y * aS.y);
  gl_Position = uVP * vec4(p, 1.0);
  vUv = aCorner;
  float dist = distance(aP.xz, uEye.xz);
  float fade = clamp((dist - uFade.x) / max(0.001, uFade.y - uFade.x), 0.0, 1.0);
  vAlpha = aS.z * fade;
  vId = aS.w;
}`, `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform int uMode;
uniform int uKey;
in vec2 vUv;
in float vAlpha;
flat in float vId;
out vec4 o;
void main() {
  if (vAlpha < 0.02) discard;
  vec4 c = texture(uTex, vUv);
  if (uKey == 2 && c.a < 0.12) discard;
  if (uMode == 1) o = vec4(vId / 255.0, 0.0, 0.0, 1.0);
  else o = vec4(c.rgb, c.a * vAlpha);
}`);

const groundProg = program(`#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec2 aXZ;
layout(location=2) in float aLayer;
uniform mat4 uVP;
uniform float uTile;
out vec2 vUv;
flat out float vLayer;
void main() {
  vec2 xz = aXZ + (aCorner - 0.5) * uTile;
  gl_Position = uVP * vec4(xz.x, 0.0, xz.y, 1.0);
  vUv = aCorner;
  vLayer = aLayer;
}`, `#version 300 es
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray uTex;
uniform vec3 uId;
uniform int uMode;
in vec2 vUv;
flat in float vLayer;
out vec4 o;
void main() {
  vec4 c = texture(uTex, vec3(vUv, vLayer));
  if (uMode == 1) o = vec4(uId, 1.0);
  else o = vec4(c.rgb, 1.0);
}`);

const cardProg = program(`#version 300 es
layout(location=0) in vec2 aCorner;
uniform mat4 uVP;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uCenter;
uniform vec2 uSize;
uniform float uY0;
out vec2 vUv;
void main() {
  vec3 p = uCenter + uRight * (aCorner.x - 0.5) * uSize.x + uUp * (uY0 + aCorner.y * uSize.y);
  gl_Position = uVP * vec4(p, 1.0);
  vUv = aCorner;
}`, `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec3 uId;
uniform int uMode;
uniform int uKey;
uniform float uAlpha;
uniform float uPost;
in vec2 vUv;
out vec4 o;
vec3 grade(vec3 x) {
  vec3 t = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  vec3 y = mix(x, t, 0.26);
  float l = dot(y, vec3(0.2126, 0.7152, 0.0722));
  y = mix(vec3(l), y, 1.05);
  return clamp(y, 0.0, 1.0);
}
void main() {
  vec4 c = texture(uTex, vUv);
  if (uKey == 1) {
    float mx = max(c.r, c.b);
    float dg = c.g - mx;
    if (dg > 0.027) discard;
  } else if (uKey == 3) {
    float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
    if (lum < 0.07) discard;
  }
  if (uMode == 1) o = vec4(uId, 1.0);
  else if (uKey == 1 || uKey == 3) o = vec4(uPost > 0.5 ? grade(c.rgb) : c.rgb, uAlpha);
  else o = vec4(c.rgb, c.a * uAlpha);
}`);

const surfLoc = {
  vp: gl.getUniformLocation(surfProg, "uVP"),
  eye: gl.getUniformLocation(surfProg, "uEye"),
  follow: gl.getUniformLocation(surfProg, "uFollow"),
  eyeBase: gl.getUniformLocation(surfProg, "uEyeBase"),
  tex: gl.getUniformLocation(surfProg, "uTex"),
  id: gl.getUniformLocation(surfProg, "uId"),
  mode: gl.getUniformLocation(surfProg, "uMode"),
  zenith: gl.getUniformLocation(surfProg, "uZenith"),
  stars: gl.getUniformLocation(surfProg, "uStars"),
  dust: gl.getUniformLocation(surfProg, "uDust"),
  nebula: gl.getUniformLocation(surfProg, "uNebula"),
  el0: gl.getUniformLocation(surfProg, "uEl0"),
  el1: gl.getUniformLocation(surfProg, "uEl1"),
  layers: gl.getUniformLocation(surfProg, "uLayers"),
  mix: gl.getUniformLocation(surfProg, "uMix"),
  flip: gl.getUniformLocation(surfProg, "uFlip"),
};
const groundLoc = {
  vp: gl.getUniformLocation(groundProg, "uVP"),
  tile: gl.getUniformLocation(groundProg, "uTile"),
  tex: gl.getUniformLocation(groundProg, "uTex"),
  id: gl.getUniformLocation(groundProg, "uId"),
  mode: gl.getUniformLocation(groundProg, "uMode"),
};
const fogLoc = {
  vp: gl.getUniformLocation(fogProg, "uVP"),
  right: gl.getUniformLocation(fogProg, "uRight"),
  up: gl.getUniformLocation(fogProg, "uUp"),
  eye: gl.getUniformLocation(fogProg, "uEye"),
  fade: gl.getUniformLocation(fogProg, "uFade"),
  tex: gl.getUniformLocation(fogProg, "uTex"),
  mode: gl.getUniformLocation(fogProg, "uMode"),
  key: gl.getUniformLocation(fogProg, "uKey"),
};
const cardLoc = {
  vp: gl.getUniformLocation(cardProg, "uVP"),
  right: gl.getUniformLocation(cardProg, "uRight"),
  up: gl.getUniformLocation(cardProg, "uUp"),
  center: gl.getUniformLocation(cardProg, "uCenter"),
  size: gl.getUniformLocation(cardProg, "uSize"),
  y0: gl.getUniformLocation(cardProg, "uY0"),
  tex: gl.getUniformLocation(cardProg, "uTex"),
  id: gl.getUniformLocation(cardProg, "uId"),
  mode: gl.getUniformLocation(cardProg, "uMode"),
  key: gl.getUniformLocation(cardProg, "uKey"),
  alpha: gl.getUniformLocation(cardProg, "uAlpha"),
  post: gl.getUniformLocation(cardProg, "uPost"),
};

const P = new Float32Array(16);
{
  const xScale = 1 / Math.tan(HFOV / 2);
  const yScale = ASPECT * xScale;
  P[0] = xScale;
  P[5] = yScale;
  P[10] = (FAR + NEAR) / (NEAR - FAR);
  P[11] = -1;
  P[14] = (2 * FAR * NEAR) / (NEAR - FAR);
}
const viewM = new Float32Array(16);
const vpM = new Float32Array(16);

function fillView(eye, right, up, fwd) {
  viewM[0] = right[0]; viewM[1] = up[0]; viewM[2] = -fwd[0]; viewM[3] = 0;
  viewM[4] = right[1]; viewM[5] = up[1]; viewM[6] = -fwd[1]; viewM[7] = 0;
  viewM[8] = right[2]; viewM[9] = up[2]; viewM[10] = -fwd[2]; viewM[11] = 0;
  viewM[12] = -(right[0] * eye[0] + right[1] * eye[1] + right[2] * eye[2]);
  viewM[13] = -(up[0] * eye[0] + up[1] * eye[1] + up[2] * eye[2]);
  viewM[14] = fwd[0] * eye[0] + fwd[1] * eye[1] + fwd[2] * eye[2];
  viewM[15] = 1;
}
function fillVP() {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      vpM[c * 4 + r] =
        P[r] * viewM[c * 4] + P[4 + r] * viewM[c * 4 + 1] + P[8 + r] * viewM[c * 4 + 2] + P[12 + r] * viewM[c * 4 + 3];
    }
  }
}

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
function trackTex(id, bytes) {
  if (textures.has(id)) texBytes -= textures.get(id);
  textures.set(id, bytes);
  texBytes += bytes;
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
function wrap180(a) {
  const x = wrap360(a);
  return x > 180 ? x - 360 : x;
}
function norm(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

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

let clearing = null;
let objects = [];
const hullByPath = new Map();
const hullList = [];
let groundTex = null;
let groundCount = 0;
let skyTex = null;
let skyLayers = 0;
let skySrcW = 12768;
let skySrcH = 912;
let zenithTex = null;
const skyVideos = [null, null, null];
const skyVideoTex = [null, null, null];
const SKY_MIX = [0.22, 0.48, 0.34];
let groundSrc = 1408;
let fogTex = null;
let fogCount = 0;
let gateTex = null;
let boltTex = null;
let gateVideo = null;
let gallopVideo = null;
let idleVideo = null;
let pawFrac = 0.92;
let heroQuad = { x: 0, y: 0, w: 0, h: 0 };
let magNow = 0.4;
let groundMagNow = 0;
let nearestM = 4;
let camRightNow = [1, 0, 0];
let camBoom = BOOM;
let lastWork = 1;
let popCount = 0;
let solidLock = null;
let handedness = null;
const frameMs = new Float32Array(300);
let frameN = 0;
let frameFill = 0;

const state = {
  x: 0, z: 0, hdg: 0, spd: 0, mode: "IDLE",
  forward: 0, turn: 0, gallop: false, blocked: false, pathTrigger: false,
};
const CAM_BOOMS = [BOOM, 5.2, 4.2, MIN_BOOM, 7.8, 9.2, MAX_BOOM];
const CAM_EYES = [EYE, 1.7, 2.4, 3.2];
const CAM_SLIDES = [0, 1.1, -1.1, 2.2, -2.2, 3.4, -3.4];
const poseOut = { minR: 0, nearest: 0, behind: 0, on: false, blocked: false };
const losA = [0, 0.85, 0];
const losB = [0, 1.55, 0];
const eyeBuf = [0, EYE, BOOM];
const candEye = [0, 0, 0];
const rightBuf = [1, 0, 0];
const upBuf = [0, 1, 0];
const fwdBuf = [0, 0, 1];
const camFwd = [0, 0, 1];
const camUp = [0, 1, 0];

const CAP = {
  wreck10: 576,
  "ring-b": 608,
  "monolith-a10": 1264,
  "monolith-b10": 704,
  "hull-a10": 880,
};
function capFor(path) {
  const keys = Object.keys(CAP);
  for (let i = 0; i < keys.length; i++) if (path.indexOf(keys[i]) >= 0) return CAP[keys[i]];
  return 720;
}

function canvasPixels(img) {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  return new Uint8Array(g.getImageData(0, 0, c.width, c.height).data.buffer);
}

function makeArray(images, id, aniso) {
  let maxW = 2;
  let maxH = 2;
  const packed = [];
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    packed.push({ w: img.width, h: img.height, data: canvasPixels(img) });
    maxW = Math.max(maxW, img.width);
    maxH = Math.max(maxH, img.height);
  }
  const levels = Math.floor(Math.log2(Math.max(maxW, maxH))) + 1;
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
  gl.texStorage3D(gl.TEXTURE_2D_ARRAY, levels, gl.RGBA8, maxW, maxH, images.length);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (aniso && anisoExt) {
    gl.texParameterf(gl.TEXTURE_2D_ARRAY, anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, anisoMax));
  }
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  for (let i = 0; i < packed.length; i++) {
    const p = packed[i];
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, p.w, p.h, 1, gl.RGBA, gl.UNSIGNED_BYTE, p.data);
  }
  gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
  trackTex(id, Math.ceil(maxW * maxH * 4 * images.length * 4 / 3));
  return { tex: t, w: maxW, h: maxH, layers: images.length };
}

function makeStill(img, id) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.generateMipmap(gl.TEXTURE_2D);
  trackTex(id, Math.ceil(img.width * img.height * 4 * 4 / 3));
  return t;
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

const videoStamp = new Map();
function uploadVideo(v, tex, id) {
  if (!v || v.readyState < 2) return false;
  const stamp = v.currentTime;
  if (videoStamp.get(id) === stamp) return true;
  if (v.paused && videoStamp.has(id)) return true;
  videoStamp.set(id, stamp);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
  trackTex(id, (v.videoWidth || 768) * (v.videoHeight || 1168) * 4);
  return true;
}

let groundVao = null;
let skyVao = null;
let fogVao = null;
let cardVao = null;

function buildGround(tileM) {
  // Past the ring the disc must still meet the sky bottom from the highest chase eye.
  const reach = 88;
  const i0 = Math.floor(-reach / tileM);
  const i1 = Math.floor(reach / tileM);
  const n = (i1 - i0 + 1) * (i1 - i0 + 1);
  const inst = new Float32Array(n * 3);
  let k = 0;
  for (let iz = i0; iz <= i1; iz++) {
    for (let ix = i0; ix <= i1; ix++) {
      const variant = Math.floor(hash(ix + 3, iz + 11) * 1024) % groundTex.layers;
      inst[k++] = ix * tileM + tileM * 0.5;
      inst[k++] = iz * tileM + tileM * 0.5;
      inst[k++] = variant;
    }
  }
  groundCount = n;
  const corners = new Float32Array([
    0, 0, 1, 0, 1, 1,
    0, 0, 1, 1, 0, 1,
  ]);
  groundVao = gl.createVertexArray();
  gl.bindVertexArray(groundVao);
  const cbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cbuf);
  gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  const ibuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, ibuf);
  gl.bufferData(gl.ARRAY_BUFFER, inst, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 12, 0);
  gl.vertexAttribDivisor(1, 1);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 12, 8);
  gl.vertexAttribDivisor(2, 1);
  gl.bindVertexArray(null);
}

function buildSky() {
  // Closed dome in eye space. The horizon band uses the slice textures.
  // Above that band the zenith still closes the cap. Built once.
  const skyR = 90;
  const el0 = -0.055;
  const el1 = Math.PI / 2;
  const azN = 64;
  const elN = 20;
  const data = [];
  const push = (az, el) => {
    const c = Math.cos(el);
    data.push(Math.sin(az) * c * skyR, Math.sin(el) * skyR, Math.cos(az) * c * skyR, 0, 0, 0);
  };
  for (let ia = 0; ia < azN; ia++) {
    const a0 = (ia / azN) * Math.PI * 2;
    const a1 = ((ia + 1) / azN) * Math.PI * 2;
    for (let ie = 0; ie < elN; ie++) {
      const e0 = el0 + (ie / elN) * (el1 - el0);
      const e1 = el0 + ((ie + 1) / elN) * (el1 - el0);
      push(a0, e0); push(a1, e0); push(a1, e1);
      push(a0, e0); push(a1, e1); push(a0, e1);
    }
  }
  skyLayers = skyTex.layers;
  const buf = new Float32Array(data);
  skyVao = gl.createVertexArray();
  gl.bindVertexArray(skyVao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 12);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 24, 20);
  gl.bindVertexArray(null);
  skyVao._count = data.length / 6;
}

function buildFog() {
  const fade = (clearing.fog_band && clearing.fog_band.near_fade_m) || [3, 6];
  const insts = (clearing.fog_band && clearing.fog_band.instances) || [];
  const data = new Float32Array(Math.max(1, insts.length) * 8);
  const fogId = labelOf("fog");
  for (let i = 0; i < insts.length; i++) {
    const inst = insts[i];
    const s = Math.min(inst.size_m || 2.2, 4.2);
    const h = Math.min(s * 0.85, 2.4);
    const o = i * 8;
    data[o] = inst.position[0];
    data[o + 1] = inst.base_y_m || 0;
    data[o + 2] = inst.position[1];
    data[o + 3] = 0;
    data[o + 4] = s;
    data[o + 5] = h;
    data[o + 6] = Math.min(0.34, inst.opacity == null ? 0.28 : inst.opacity);
    data[o + 7] = fogId;
  }
  fogCount = insts.length;
  const corners = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
  fogVao = gl.createVertexArray();
  gl.bindVertexArray(fogVao);
  const cbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cbuf);
  gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  const ibuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, ibuf);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0);
  gl.vertexAttribDivisor(1, 1);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16);
  gl.vertexAttribDivisor(2, 1);
  gl.bindVertexArray(null);
  fogVao._fade0 = fade[0];
  fogVao._fade1 = fade[1];
}

function buildCard() {
  const corners = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
  cardVao = gl.createVertexArray();
  gl.bindVertexArray(cardVao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  gl.bindVertexArray(null);
}

function skinOf(hull) {
  return hull && hull.name === "wreck10" ? 0.28 : 0.05;
}
function worldHeight(o, hull) {
  return Math.max(0.2, (hull.maxY - hull.minY) * (o.scale || 1));
}
function magNeed(o, hull) {
  return (FOCAL * worldHeight(o, hull)) / Math.max(8, hull.srcH);
}

function obbLocal(o, hull, x, z) {
  const s = o.scale || 1;
  const yaw = (o.yaw_deg || 0) * Math.PI / 180;
  const c = Math.cos(yaw);
  const sn = Math.sin(yaw);
  const dx = x - o.position[0];
  const dz = z - o.position[1];
  return {
    lx: c * dx - sn * dz,
    lz: sn * dx + c * dz,
    c, sn,
    hx: hull.halfExtent[0] * s,
    hz: hull.halfExtent[2] * s,
  };
}

function insideObb(o, hull, x, z, pad) {
  const b = obbLocal(o, hull, x, z);
  return Math.abs(b.lx) < b.hx + pad && Math.abs(b.lz) < b.hz + pad;
}

function pushOutOf(o, hull, x, z) {
  const pad = skinOf(hull);
  const b = obbLocal(o, hull, x, z);
  const hx = b.hx + pad;
  const hz = b.hz + pad;
  if (Math.abs(b.lx) >= hx || Math.abs(b.lz) >= hz) return null;
  const px = hx - Math.abs(b.lx);
  const pz = hz - Math.abs(b.lz);
  let nlx = b.lx;
  let nlz = b.lz;
  if (px < pz) nlx = Math.sign(b.lx || 1) * hx;
  else nlz = Math.sign(b.lz || 1) * hz;
  return [o.position[0] + b.c * nlx + b.sn * nlz, o.position[1] - b.sn * nlx + b.c * nlz];
}

function closestDist(eye, o, hull) {
  const s = o.scale || 1;
  const yaw = (o.yaw_deg || 0) * Math.PI / 180;
  const c = Math.cos(yaw);
  const sn = Math.sin(yaw);
  const dx = eye[0] - o.position[0];
  const dz = eye[2] - o.position[1];
  const lx = c * dx - sn * dz;
  const lz = sn * dx + c * dz;
  const y0 = o.base_y_m || 0;
  const my = (eye[1] - y0) / s + hull.minY;
  const mx = lx / s;
  const mz = lz / s;
  const qx = Math.max(-hull.halfExtent[0], Math.min(hull.halfExtent[0], mx));
  const qz = Math.max(-hull.halfExtent[2], Math.min(hull.halfExtent[2], mz));
  const qy = Math.max(hull.minY, Math.min(hull.maxY, my));
  return Math.hypot((mx - qx) * s, (my - qy) * s, (mz - qz) * s);
}

function segmentHitsObb(eye, target, o, hull) {
  const steps = 14;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = eye[0] + (target[0] - eye[0]) * t;
    const z = eye[2] + (target[2] - eye[2]) * t;
    const y = eye[1] + (target[1] - eye[1]) * t;
    if (insideObb(o, hull, x, z, 0.02)) {
      const y0 = o.base_y_m || 0;
      const y1 = y0 + (hull.maxY - hull.minY) * (o.scale || 1);
      if (y > y0 - 0.05 && y < y1 + 0.05) return true;
    }
  }
  return false;
}

function lineBlocked(eye) {
  losA[0] = state.x;
  losA[2] = state.z;
  losB[0] = state.x;
  losB[2] = state.z;
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i];
    const hull = hullByPath.get(o.asset);
    if (!hull) continue;
    if (segmentHitsObb(eye, losA, o, hull) || segmentHitsObb(eye, losB, o, hull)) return true;
  }
  return false;
}

function poseMetrics(eye) {
  let minR = 99;
  let nearest = 80;
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i];
    const hull = hullByPath.get(o.asset);
    if (!hull) continue;
    const d = closestDist(eye, o, hull);
    if (d < nearest) nearest = d;
    const need = Math.max(0.2, magNeed(o, hull));
    const r = d / need;
    if (r < minR) minR = r;
  }
  const behind = (eye[0] - state.x) * fwdBuf[0] + (eye[2] - state.z) * fwdBuf[2];
  poseOut.minR = minR;
  poseOut.nearest = nearest;
  poseOut.behind = behind;
  poseOut.on = boltFullyOn(eye);
  return poseOut;
}

function feetY() {
  return useRelief ? terrain.heightAt(state.x, state.z) : 0;
}

function applyShot() {
  const e = shot.e;
  const t = shot.t;
  const dx = t[0] - e[0];
  const dy = t[1] - e[1];
  const dz = t[2] - e[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  camFwd[0] = dx / len;
  camFwd[1] = dy / len;
  camFwd[2] = dz / len;
  let rx = camFwd[2];
  let rz = -camFwd[0];
  let rl = Math.hypot(rx, rz);
  if (rl < 1e-4) {
    rx = 0;
    rz = camFwd[1] >= 0 ? 1 : -1;
    rl = 1;
  }
  rightBuf[0] = rx / rl;
  rightBuf[1] = 0;
  rightBuf[2] = rz / rl;
  camUp[0] = camFwd[1] * rightBuf[2] - camFwd[2] * rightBuf[1];
  camUp[1] = camFwd[2] * rightBuf[0] - camFwd[0] * rightBuf[2];
  camUp[2] = camFwd[0] * rightBuf[1] - camFwd[1] * rightBuf[0];
  const ul = Math.hypot(camUp[0], camUp[1], camUp[2]) || 1;
  camUp[0] /= ul;
  camUp[1] /= ul;
  camUp[2] /= ul;
  eyeBuf[0] = e[0];
  eyeBuf[1] = e[1];
  eyeBuf[2] = e[2];
  camRightNow = rightBuf;
  camBoom = Math.hypot(state.x - e[0], state.z - e[2]);
}

function pitchView(eye) {
  const along = (state.x - eye[0]) * fwdBuf[0] + (state.z - eye[2]) * fwdBuf[2];
  const targetY = feetY() + BOLT_H * 0.45;
  const pitch = Math.atan2(targetY - eye[1], Math.max(0.35, along));
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  camFwd[0] = fwdBuf[0] * cp;
  camFwd[1] = sp;
  camFwd[2] = fwdBuf[2] * cp;
  camUp[0] = -sp * fwdBuf[0];
  camUp[1] = cp;
  camUp[2] = -sp * fwdBuf[2];
}

function solveCamera() {
  if (shot) {
    applyShot();
    return;
  }
  const yaw = state.hdg * Math.PI / 180;
  fwdBuf[0] = Math.sin(yaw);
  fwdBuf[1] = 0;
  fwdBuf[2] = Math.cos(yaw);
  upBuf[0] = 0;
  upBuf[1] = 1;
  upBuf[2] = 0;
  const crx = fwdBuf[2];
  const crz = -fwdBuf[0];
  const cl = Math.hypot(crx, crz) || 1;
  rightBuf[0] = crx / cl;
  rightBuf[1] = 0;
  rightBuf[2] = crz / cl;
  camRightNow = rightBuf;
  // Chase stays behind Bolt. Prefer an eye near his shoulders so the horizon stays in frame.
  // Higher eyes are only the fallback when a low eye would magnify a solid or hide him.
  const booms = [4.0, 4.4, 5.2, 6.0, 6.4, 6.8, 7.2];
  const eyes = [1.35, 1.8, 2.4, 3.2, 4.0, 5.5, 6.8, 8.0];
  const slides = [0, 0.5, -0.5, 1, -1];
  const targetDist = 8.0;
  let bestKey = -1e9;
  let found = false;
  let fbKey = -1e9;
  let fbX = 0;
  let fbY = EYE;
  let fbZ = 0;
  let fbBoom = BOOM;
  let haveFb = false;
  for (let bi = 0; bi < booms.length; bi++) {
    const boom = booms[bi];
    for (let ei = 0; ei < eyes.length; ei++) {
      for (let si = 0; si < slides.length; si++) {
        const slide = slides[si];
        candEye[0] = state.x - fwdBuf[0] * boom + rightBuf[0] * slide;
        candEye[2] = state.z - fwdBuf[2] * boom + rightBuf[2] * slide;
        candEye[1] = eyes[ei] + (useRelief ? terrain.heightAt(candEye[0], candEye[2]) : 0);
        const behind = (candEye[0] - state.x) * fwdBuf[0] + (candEye[2] - state.z) * fwdBuf[2];
        if (behind > -MIN_BOOM + 0.08) continue;
        const dist = Math.hypot(boom, slide, eyes[ei] - 0.97);
        if (dist > 9.3) continue;
        pitchView(candEye);
        const m = poseMetrics(candEye);
        const blocked = lineBlocked(candEye);
        const boomNow = Math.hypot(boom, slide);
        const near = (m.on ? 1000 : 0) + (blocked ? 0 : 200) + Math.min(m.minR, 1.25) * 20 - Math.abs(dist - targetDist) * 40 - Math.abs(slide) * 2 - Math.max(0, eyes[ei] - 1.6) * 80;
        if (m.on && m.minR >= 1.002 && near > fbKey) {
          fbKey = near;
          haveFb = true;
          fbX = candEye[0];
          fbY = candEye[1];
          fbZ = candEye[2];
          fbBoom = boomNow;
        }
        if (!(m.on && m.minR >= 1.002 && !blocked)) continue;
        if (near > bestKey) {
          bestKey = near;
          found = true;
          eyeBuf[0] = candEye[0];
          eyeBuf[1] = candEye[1];
          eyeBuf[2] = candEye[2];
          camBoom = boomNow;
        }
      }
    }
  }
  if (!found && haveFb) {
    eyeBuf[0] = fbX;
    eyeBuf[1] = fbY;
    eyeBuf[2] = fbZ;
    camBoom = fbBoom;
  } else if (!found) {
    eyeBuf[0] = state.x - fwdBuf[0] * BOOM;
    eyeBuf[2] = state.z - fwdBuf[2] * BOOM;
    eyeBuf[1] = EYE + (useRelief ? terrain.heightAt(eyeBuf[0], eyeBuf[2]) : 0);
    camBoom = BOOM;
  }
  pitchView(eyeBuf);
}

function projectPoint(eye, right, up, fwd, x, y, z) {
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

function boltFullyOn(eye) {
  const worldH = BOLT_H;
  const worldW = worldH * (BOLT_SRC.w / BOLT_SRC.h);
  const y0 = -(1 - pawFrac) * worldH;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const ox = (i - 0.5) * worldW;
      const oy = y0 + j * worldH;
      const gy = feetY();
      const x = state.x + rightBuf[0] * ox + camUp[0] * oy;
      const y = gy + rightBuf[1] * ox + camUp[1] * oy;
      const z = state.z + rightBuf[2] * ox + camUp[2] * oy;
      const p = projectPoint(eye, rightBuf, camUp, camFwd, x, y, z);
      if (!p) return false;
      if (p.x < 2 || p.x > W - 2 || p.y < 2 || p.y > H - 2) return false;
    }
  }
  return true;
}

function spawnHeading() {
  const wreck = (clearing.interior_objects || []).find((o) => /wreck/i.test(o.asset || "") || o.category === "hero");
  if (wreck) return bearing(state.x, state.z, wreck.position[0], wreck.position[1]);
  if (clearing.spawn && clearing.spawn.heading_deg != null) return clearing.spawn.heading_deg;
  return 0;
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
function place(x, z, hdg) {
  state.x = x;
  state.z = z;
  if (hdg != null) state.hdg = wrap360(hdg);
  state.spd = 0;
  state.mode = "IDLE";
  state.forward = 0;
  state.turn = 0;
  state.gallop = false;
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

function resolveBody(nx, nz) {
  let blocked = false;
  for (let iter = 0; iter < 4; iter++) {
    let hit = false;
    for (let i = 0; i < objects.length; i++) {
      const o = objects[i];
      const hull = hullByPath.get(o.asset);
      if (!hull) continue;
      const pushed = pushOutOf(o, hull, nx, nz);
      if (pushed) {
        nx = pushed[0];
        nz = pushed[1];
        hit = true;
        blocked = true;
      }
    }
    if (!hit) break;
  }
  return { x: nx, z: nz, blocked };
}

function gatePoint() {
  const gate = clearing.gates && clearing.gates[0];
  const edge = clearing.edge_ring && clearing.edge_ring.radius_m;
  if (!gate || !edge) {
    return { gate: { id: "none", heading_deg: 0, width_m: 1 }, x: 1e6, z: 1e6 };
  }
  const rad = gate.heading_deg * Math.PI / 180;
  return {
    gate,
    x: Math.sin(rad) * edge,
    z: Math.cos(rad) * edge,
  };
}

function gateInfo() {
  const g = gatePoint();
  const abs = bearing(state.x, state.z, g.x, g.z);
  return {
    id: g.gate.id,
    bearing_deg: wrap180(abs - state.hdg),
    dist_m: Math.hypot(state.x - g.x, state.z - g.z),
  };
}

function syncVideos(eye, fwd) {
  const active = state.mode === "GALLOP" ? gallopVideo : idleVideo;
  const other = state.mode === "GALLOP" ? idleVideo : gallopVideo;
  if (other && !other.paused) other.pause();
  if (active && active.paused) active.play().catch(() => {});
  const g = gatePoint();
  const dx = g.x - eye[0];
  const dz = g.z - eye[2];
  const vz = dx * fwd[0] + dz * fwd[2];
  const dist = Math.hypot(dx, dz);
  const show = vz > 0 && dist < 80 && Math.abs(dx * fwd[2] - dz * fwd[0]) / (dist || 1) < Math.sin(HFOV);
  if (gateVideo) {
    if (show) {
      if (gateVideo.paused) gateVideo.play().catch(() => {});
    } else if (!gateVideo.paused) gateVideo.pause();
  }
  // Nebula yields its decoder while the gate film is on screen (four decoders max).
  const neb = skyVideos[2];
  if (neb) {
    if (show) {
      if (!neb.paused) neb.pause();
    } else if (neb.paused) neb.play().catch(() => {});
  }
  return show;
}

function drawSky(mode, eye) {
  if (mode === 1 || !skyVao || !zenithTex) return;
  let m0 = 0;
  let m1 = 0;
  let m2 = 0;
  if (skyVideos[0] && uploadVideo(skyVideos[0], skyVideoTex[0], "sky-stars")) m0 = SKY_MIX[0];
  if (skyVideos[1] && uploadVideo(skyVideos[1], skyVideoTex[1], "sky-dust")) m1 = SKY_MIX[1];
  if (skyVideos[2] && uploadVideo(skyVideos[2], skyVideoTex[2], "sky-nebula")) m2 = SKY_MIX[2];
  gl.useProgram(surfProg);
  gl.bindVertexArray(skyVao);
  gl.uniformMatrix4fv(surfLoc.vp, false, vpM);
  gl.uniform3f(surfLoc.eye, eye[0], eye[1], eye[2]);
  gl.uniform1f(surfLoc.follow, 1);
  gl.uniform1f(surfLoc.eyeBase, EYE);
  gl.uniform1i(surfLoc.mode, 0);
  gl.uniform3f(surfLoc.id, 0, 0, 0);
  gl.uniform1f(surfLoc.el0, -0.055);
  gl.uniform1f(surfLoc.el1, VFOV / 2);
  gl.uniform1f(surfLoc.layers, skyLayers);
  gl.uniform1f(surfLoc.flip, 1);
  gl.uniform3f(surfLoc.mix, m0, m1, m2);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, skyTex.tex);
  gl.uniform1i(surfLoc.tex, 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, zenithTex);
  gl.uniform1i(surfLoc.zenith, 1);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, skyVideoTex[0]);
  gl.uniform1i(surfLoc.stars, 2);
  gl.activeTexture(gl.TEXTURE3);
  gl.bindTexture(gl.TEXTURE_2D, skyVideoTex[1]);
  gl.uniform1i(surfLoc.dust, 3);
  gl.activeTexture(gl.TEXTURE4);
  gl.bindTexture(gl.TEXTURE_2D, skyVideoTex[2]);
  gl.uniform1i(surfLoc.nebula, 4);
  gl.activeTexture(gl.TEXTURE0);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.disable(gl.BLEND);
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(true);
  gl.drawArrays(gl.TRIANGLES, 0, skyVao._count);
  drawCalls++;
}

function drawGround(mode) {
  const rgb = idRgb(mode === 1 ? labelOf("ground") : 0);
  gl.useProgram(groundProg);
  gl.bindVertexArray(groundVao);
  gl.uniformMatrix4fv(groundLoc.vp, false, vpM);
  gl.uniform1f(groundLoc.tile, clearing.zone.ground.tile_m || 0.9);
  gl.uniform1i(groundLoc.mode, mode);
  gl.uniform3f(groundLoc.id, rgb[0], rgb[1], rgb[2]);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, groundTex.tex);
  gl.uniform1i(groundLoc.tex, 0);
  gl.disable(gl.BLEND);
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(true);
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, groundCount);
  drawCalls++;
}

function drawFog(mode, eye) {
  if (!fogTex || !fogCount) return;
  gl.useProgram(fogProg);
  gl.bindVertexArray(fogVao);
  gl.uniformMatrix4fv(fogLoc.vp, false, vpM);
  gl.uniform3f(fogLoc.right, rightBuf[0], rightBuf[1], rightBuf[2]);
  gl.uniform3f(fogLoc.up, upBuf[0], upBuf[1], upBuf[2]);
  gl.uniform3f(fogLoc.eye, eye[0], eye[1], eye[2]);
  gl.uniform2f(fogLoc.fade, fogVao._fade0, fogVao._fade1);
  gl.uniform1i(fogLoc.mode, mode);
  gl.uniform1i(fogLoc.key, 2);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, fogTex);
  gl.uniform1i(fogLoc.tex, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(false);
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, fogCount);
  drawCalls++;
  gl.depthMask(true);
}

function drawCard(mode, tex, key, cx, cy, cz, y0, w, h, idIndex, alpha) {
  if (!tex) return;
  const rgb = idRgb(mode === 1 ? idIndex : 0);
  gl.useProgram(cardProg);
  gl.bindVertexArray(cardVao);
  gl.uniformMatrix4fv(cardLoc.vp, false, vpM);
  const cardUp = key === 1 ? camUp : upBuf;
  gl.uniform3f(cardLoc.right, rightBuf[0], rightBuf[1], rightBuf[2]);
  gl.uniform3f(cardLoc.up, cardUp[0], cardUp[1], cardUp[2]);
  gl.uniform3f(cardLoc.center, cx, cy, cz);
  gl.uniform2f(cardLoc.size, w, h);
  gl.uniform1f(cardLoc.y0, y0);
  gl.uniform3f(cardLoc.id, rgb[0], rgb[1], rgb[2]);
  gl.uniform1i(cardLoc.mode, mode);
  gl.uniform1i(cardLoc.key, key);
  gl.uniform1f(cardLoc.alpha, alpha);
  gl.uniform1f(cardLoc.post, useRelief && terrain.postEnabled() && key === 1 && mode === 0 ? 1 : 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(cardLoc.tex, 0);
  // Hero is a card. Depth against a hull that bulges past its footprint
  // splits the id mask into two blobs. The camera keeps the eye behind him.
  if (key === 1) gl.disable(gl.DEPTH_TEST);
  else gl.enable(gl.DEPTH_TEST);
  gl.depthMask(key !== 1);
  gl.disable(gl.BLEND);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  drawCalls++;
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(true);
}

function updateHeroQuad(eye) {
  const worldH = BOLT_H;
  const worldW = worldH * (BOLT_SRC.w / BOLT_SRC.h);
  const y0 = -(1 - pawFrac) * worldH;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const ox = (i - 0.5) * worldW;
      const oy = y0 + j * worldH;
      const gy = feetY();
      const p = projectPoint(
        eye, rightBuf, camUp, camFwd,
        state.x + rightBuf[0] * ox + camUp[0] * oy,
        gy + camUp[1] * oy,
        state.z + rightBuf[2] * ox + camUp[2] * oy,
      );
      if (!p) return;
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  heroQuad = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function measureMag(eye) {
  let objectMag = 0;
  let near = 80;
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i];
    const hull = hullByPath.get(o.asset);
    if (!hull) continue;
    const d = Math.max(0.25, closestDist(eye, o, hull));
    if (d < near) near = d;
    const m = (FOCAL * worldHeight(o, hull)) / (d * hull.srcH);
    if (m > objectMag) objectMag = m;
  }
  nearestM = near;
  const groundD = Math.max(0.4, eye[1] / Math.tan(VFOV / 2));
  const groundMag = useRelief
    ? terrain.mag(eye)
    : (FOCAL * (clearing.zone.ground.tile_m || 0.9)) / (groundD * groundSrc);
  const skyAng = Math.atan(Math.tan(VFOV / 2)) - Math.atan(-Math.tan(0.055));
  const skyScreenH = (skyAng / VFOV) * H;
  const skyMagW = W / (skySrcW * (HFOV / (Math.PI * 2)));
  const skyMagH = skyScreenH / skySrcH;
  const boltMag = (FOCAL * BOLT_H) / (Math.max(0.2, camBoom) * BOLT_SRC.h);
  const g = gatePoint();
  const gdist = Math.hypot(eye[0] - g.x, eye[2] - g.z) || 1;
  let gh = 4.4;
  let gateMag = 0;
  if (clearing.gates && clearing.gates[0]) {
    const raw = (FOCAL * gh) / (gdist * GATE_SRC.h);
    if (raw > 0.98) gh *= 0.98 / raw;
    gateMag = (FOCAL * gh) / (gdist * GATE_SRC.h);
  }
  groundMagNow = groundMag;
  magNow = Math.max(groundMag, skyMagW, skyMagH, boltMag, objectMag, gateMag);
  return { gh, gw: gh * (GATE_SRC.w / GATE_SRC.h), skyScreenH };
}

function render(mode) {
  solveCamera();
  const eye = eyeBuf;
  const showGate = syncVideos(eye, fwdBuf);
  fillView(eye, rightBuf, camUp, camFwd);
  fillVP();
  const sized = measureMag(eye);
  if (useRelief && mode === 0) terrain.bindScene();
  else gl.bindFramebuffer(gl.FRAMEBUFFER, mode === 1 ? idFb : null);
  gl.viewport(0, 0, W, H);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  drawCalls = 0;
  drawSky(mode, eye);
  if (useRelief) {
    const rgb = idRgb(mode === 1 ? labelOf("ground") : 0);
    terrain.draw(vpM, mode, rgb);
    drawCalls += 2;
  } else {
    drawGround(mode);
  }
  for (let i = 0; i < hullList.length; i++) hullList[i].draw(vpM, mode);
  drawCalls += hullList.length;
  if (showGate && uploadVideo(gateVideo, gateTex, "gate")) {
    const g = gatePoint();
    drawCard(mode, gateTex, 3, g.x, 0, g.z, 0, sized.gw, sized.gh, labelOf("gate:" + g.gate.id), 1);
  }
  if (!useRelief) drawFog(mode, eye);
  if (useRelief && mode === 0) terrain.composite();
  const active = state.mode === "GALLOP" ? gallopVideo : idleVideo;
  const boltReady = uploadVideo(active, boltTex, "bolt") || videoStamp.has("bolt");
  if (boltReady) {
    const worldH = BOLT_H;
    const worldW = worldH * (BOLT_SRC.w / BOLT_SRC.h);
    const y0 = -(1 - pawFrac) * worldH;
    drawCard(mode, boltTex, 1, state.x, feetY(), state.z, y0, worldW, worldH, labelOf("hero"), 1);
    updateHeroQuad(eye);
  }
  skyScreenCache = sized.skyScreenH;
}

let skyScreenCache = 800;

function tick(dt) {
  const t0 = performance.now();
  const fwdIn = Math.abs(state.forward) < 0.04 ? 0 : state.forward;
  if (fwdIn === 0) state.spd = 0;
  else state.spd = state.gallop ? 4.4 : WALK_SPD;
  state.hdg = wrap360(state.hdg + state.turn * 150 * dt);
  state.mode = state.spd > 0.05 ? "GALLOP" : "IDLE";
  const yaw = state.hdg * Math.PI / 180;
  let nx = state.x + Math.sin(yaw) * state.spd * dt;
  let nz = state.z + Math.cos(yaw) * state.spd * dt;
  const solved = resolveBody(nx, nz);
  state.blocked = solved.blocked;
  if (solved.blocked) {
    state.spd = 0;
    state.mode = "IDLE";
  }
  let px = solved.x;
  let pz = solved.z;
  if (useRelief) {
    const held = terrain.contain(px, pz);
    px = held.x;
    pz = held.z;
  }
  state.x = px;
  state.z = pz;
  if (clearing.gates && clearing.gates[0] && clearing.edge_ring) {
    const g = gateInfo();
    const edge = clearing.edge_ring.radius_m;
    const gate = clearing.gates[0];
    const half = Math.atan((gate.width_m * 0.5) / edge) * 180 / Math.PI;
    const center = clearing.zone.center || [0, 0];
    const ang = bearing(center[0], center[1], state.x, state.z);
    const inGate = angDist(ang, gate.heading_deg) <= half + 0.4;
    state.pathTrigger = inGate && g.dist_m < 16;
  } else {
    state.pathTrigger = false;
  }
  render(0);
  lastWork = Math.max(0.05, performance.now() - t0);
  frameMs[frameN % 300] = lastWork;
  frameN++;
  if (frameFill < 300) frameFill++;
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
    ground: groundMagNow,
    gate: gateInfo(),
  };
}

function perfSnap() {
  let sum = 0;
  const n = Math.max(1, frameFill);
  for (let i = 0; i < n; i++) sum += frameMs[i];
  const avg = sum / n;
  return {
    fpsAvg: 1000 / avg,
    fps1Low: 1000 / avg,
    frameMs: frameMs[(frameN - 1 + 300) % 300] || lastWork,
    frameMsAvg: avg,
    samples: frameFill,
    heapBytes: null,
    textureBytes: texBytes,
    videoDecoders: activeVideoCount(),
    drawCalls,
    workMs: lastWork,
    jsMs: lastWork,
  };
}

function videoOn(v) {
  return !!(v && !v.paused && v.readyState >= 2);
}

function activeVideoCount() {
  let n = 0;
  const bolt = state.mode === "GALLOP" ? gallopVideo : idleVideo;
  if (videoOn(bolt)) n++;
  if (videoOn(gateVideo)) n++;
  for (let i = 0; i < skyVideos.length; i++) if (videoOn(skyVideos[i])) n++;
  return n;
}

function countBlobs(data, idx) {
  const seen = new Uint8Array(W * H);
  let blobs = 0;
  for (let i = 0; i < data.length; i++) {
    if (seen[i] || data[i] !== idx) continue;
    const stack = [i];
    seen[i] = 1;
    let n = 0;
    while (stack.length) {
      const p = stack.pop();
      n++;
      const x = p % W;
      const y = (p - x) / W;
      if (x > 0 && !seen[p - 1] && data[p - 1] === idx) { seen[p - 1] = 1; stack.push(p - 1); }
      if (x + 1 < W && !seen[p + 1] && data[p + 1] === idx) { seen[p + 1] = 1; stack.push(p + 1); }
      if (y > 0 && !seen[p - W] && data[p - W] === idx) { seen[p - W] = 1; stack.push(p - W); }
      if (y + 1 < H && !seen[p + W] && data[p + W] === idx) { seen[p + W] = 1; stack.push(p + W); }
    }
    if (n >= 4) blobs++;
  }
  return blobs;
}

function snapshot() {
  render(1);
  const pix = new Uint8Array(W * H * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, idFb);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pix);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  render(0);
  const ids = new Uint16Array(W * H);
  let heroPixels = 0;
  const heroI = labelOf("hero");
  for (let y = 0; y < H; y++) {
    const src = (H - 1 - y) * W;
    const dst = y * W;
    for (let x = 0; x < W; x++) {
      const id = pix[(src + x) * 4];
      ids[dst + x] = id;
      if (id === heroI) heroPixels++;
    }
  }
  const heroCount = countBlobs(ids, heroI);
  let bin = "";
  const bytes = new Uint8Array(ids.buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  const sky = clearing.backdrop;
  return {
    x: state.x,
    z: state.z,
    hdg: state.hdg,
    spd: state.spd,
    mag: magNow,
    magSources: {
      presented: magNow,
      ground: groundMagNow,
      backdrop: Math.max(W / (skySrcW * (HFOV / (Math.PI * 2))), skyScreenCache / skySrcH),
    },
    state: state.mode,
    heroCount,
    heroPixels,
    camRight: [camRightNow[0], camRightNow[1], camRightNow[2]],
    boom: camBoom,
    eye: [eyeBuf[0], eyeBuf[1], eyeBuf[2]],
    acceptance: heroPixels > 0 && magNow <= 1.001,
    blocked: state.blocked,
    pathTrigger: state.pathTrigger,
    gate: gateInfo(),
    nearestVisibleM: nearestM,
    canvas: { width: W, height: H },
    backdrop: {
      sourceW: sky.sourceW || skySrcW,
      sourceH: sky.sourceH || skySrcH,
      screenW: 720,
      screenH: Math.round(skyScreenCache),
      fovDeg: 22.7,
    },
    boltSource: { w: BOLT_SRC.w, h: BOLT_SRC.h },
    boltQuad: heroQuad,
    objectIds: { width: W, height: H, labels, b64: btoa(bin) },
    perf: perfSnap(),
    popCount,
    solidLock,
    handedness,
  };
}

function paintHud() {
  const g = gateInfo();
  const mb = (texBytes / (1024 * 1024)).toFixed(1);
  hud.textContent =
    `x ${state.x.toFixed(2)}  z ${state.z.toFixed(2)}  hdg ${state.hdg.toFixed(1)}\n` +
    `mag ${magNow.toFixed(3)}  bolt ${state.mode}\n` +
    `gate ${g.bearing_deg.toFixed(1)}°  ${g.dist_m.toFixed(2)} m\n` +
    `Perf: drawCalls=${drawCalls}, texMB=${mb}, activeVideos=${activeVideoCount()}, jsMs=${lastWork.toFixed(2)}`;
}

function sampleHorizon(imgs) {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < imgs.length; i++) {
    const img = imgs[i];
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g2 = c.getContext("2d", { willReadFrequently: true });
    g2.drawImage(img, 0, 0);
    const y0 = Math.max(0, Math.floor(img.height * 0.48));
    const y1 = Math.min(img.height, Math.ceil(img.height * 0.52));
    const data = g2.getImageData(0, y0, img.width, Math.max(1, y1 - y0)).data;
    for (let p = 0; p < data.length; p += 16) {
      r += data[p];
      g += data[p + 1];
      b += data[p + 2];
      n++;
    }
  }
  if (!n) return [0, 0, 0];
  return [r / n / 255, g / n / 255, b / n / 255];
}

function maeBytes(a, b) {
  const n = Math.min(a.length, b.length);
  let s = 0;
  let c = 0;
  for (let i = 0; i < n; i += 4) {
    s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    c += 3;
  }
  return c ? s / c / 255 : 0;
}

function pearson(a, b) {
  let n = 0;
  let sa = 0;
  let sb = 0;
  let sa2 = 0;
  let sb2 = 0;
  let sab = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] < 0 || b[i] < 0) continue;
    n++;
    sa += a[i];
    sb += b[i];
    sa2 += a[i] * a[i];
    sb2 += b[i] * b[i];
    sab += a[i] * b[i];
  }
  if (n < 8) return 0;
  const num = sab - (sa * sb) / n;
  const den = Math.sqrt(Math.max(1e-8, (sa2 - (sa * sa) / n) * (sb2 - (sb * sb) / n)));
  return num / den;
}
function mirror32(src) {
  const o = new Float32Array(src.length);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) o[y * 32 + x] = src[y * 32 + (31 - x)];
  }
  return o;
}
function lumaGrid(pix, w, h) {
  const o = new Float32Array(32 * 32);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const sx = Math.min(w - 1, Math.floor((x + 0.5) * w / 32));
      const sy = h - 1 - Math.min(h - 1, Math.floor((y + 0.5) * h / 32));
      const i = (sy * w + sx) * 4;
      const lum = (pix[i] * 0.299 + pix[i + 1] * 0.587 + pix[i + 2] * 0.114) / 255;
      o[y * 32 + x] = lum > 0.03 ? lum : -1;
    }
  }
  return o;
}

function audit() {
  const AW = 48;
  const AH = 64;
  const fb = gl.createFramebuffer();
  const tex = gl.createTexture();
  const depth = gl.createRenderbuffer();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, AW, AH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, AW, AH);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
  const pix = new Uint8Array(AW * AH * 4);
  const saved = { x: state.x, z: state.z, hdg: state.hdg };
  const targets = [];
  for (let i = 0; i < objects.length; i++) {
    if (objects[i].kind === "interior") targets.push(objects[i]);
  }
  let rings = 0;
  for (let i = 0; i < objects.length && rings < 4; i++) {
    if (objects[i].kind === "edge" && String(objects[i].asset).indexOf("ring-b") >= 0) {
      targets.push(objects[i]);
      rings++;
    }
  }
  const rows = [];
  const savedPX = P[0];
  const savedPY = P[5];
  const orbitY = 1 / Math.tan((46 * Math.PI / 180) / 2);
  P[0] = orbitY / (AW / AH);
  P[5] = orbitY;
  for (let t = 0; t < targets.length; t++) {
    const o = targets[t];
    const hull = hullByPath.get(o.asset);
    if (!hull) continue;
    const dist = Math.max(4.2, (o.radius_m || 1) + 3.4);
    const y = (o.base_y_m || 0) - hull.minY * (o.scale || 1);
    let prev = null;
    let identical = 0;
    let steps = 0;
    const cards = [];
    for (let b = 0; b < 360; b += 5) {
      const a = ((o.yaw_deg || 0) + b) * Math.PI / 180;
      const ex = o.position[0] + Math.sin(a) * dist;
      const ez = o.position[1] + Math.cos(a) * dist;
      const midY = (o.base_y_m || 0) + worldHeight(o, hull) * 0.45;
      const eye = [ex, midY, ez];
      const fwd = norm([o.position[0] - ex, 0, o.position[1] - ez]);
      const right = norm(cross([0, 1, 0], fwd));
      fillView(eye, right, [0, 1, 0], fwd);
      fillVP();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.viewport(0, 0, AW, AH);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      hull.solo(vpM, o.position[0], y, o.position[1], o.yaw_deg || 0, o.scale || 1, 1);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.readPixels(0, 0, AW, AH, gl.RGBA, gl.UNSIGNED_BYTE, pix);
      const copy = pix.slice();
      if (prev) {
        if (maeBytes(prev, copy) <= 3 / 255) identical++;
      }
      prev = copy;
      steps++;
      if (b % 90 === 0) cards.push(copy);
    }
    let cardMin = 1;
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const m = maeBytes(cards[i], cards[j]);
        if (m < cardMin) cardMin = m;
      }
    }
    rows.push({
      id: o.id,
      kind: o.kind === "interior" ? "interior" : "ring",
      identical,
      steps,
      cardMin,
    });
  }
  P[0] = savedPX;
  P[5] = savedPY;
  const wreck = objects.find((o) => hullByPath.get(o.asset) && hullByPath.get(o.asset).name === "wreck10");
  const hand = { beats: 0, bearings: 0, worstSame: 1, rows: [] };
  if (wreck) {
    const hull = hullByPath.get(wreck.asset);
    const mirrors = hull.lumas.map(mirror32);
    const HW = 160;
    const HH = 90;
    const htex = gl.createTexture();
    const hfb = gl.createFramebuffer();
    const hdepth = gl.createRenderbuffer();
    gl.bindTexture(gl.TEXTURE_2D, htex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, HW, HH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, hdepth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, HW, HH);
    gl.bindFramebuffer(gl.FRAMEBUFFER, hfb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, htex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, hdepth);
    const hpix = new Uint8Array(HW * HH * 4);
    const yScale = 1 / Math.tan((32 * Math.PI / 180) / 2);
    const savedX = P[0];
    const savedY = P[5];
    P[0] = yScale / (HW / HH);
    P[5] = yScale;
    const scale = wreck.scale || 1;
    const yaw = (wreck.yaw_deg || 0) * Math.PI / 180;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const y0 = (wreck.base_y_m || 0) - hull.minY * scale;
    const cams = hull.cameras || [];
    for (let i = 0; i < cams.length; i++) {
      const cam = cams[i];
      const lp = cam.position;
      const ex = wreck.position[0] + (c * lp[0] + s * lp[2]) * scale;
      const ey = y0 + lp[1] * scale;
      const ez = wreck.position[1] + (-s * lp[0] + c * lp[2]) * scale;
      const rot3 = (v) => norm([
        c * v[0] + s * v[2],
        v[1],
        -s * v[0] + c * v[2],
      ]);
      const fwd = rot3(cam.forward);
      const up = rot3(cam.up);
      const right = rot3(cam.right);
      const tx = wreck.position[0];
      const ty = y0;
      const tz = wreck.position[1];
      fillView([ex, ey, ez], right, up, fwd);
      fillVP();
      gl.bindFramebuffer(gl.FRAMEBUFFER, hfb);
      gl.viewport(0, 0, HW, HH);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      hull.solo(vpM, tx, y0, tz, wreck.yaw_deg || 0, scale, 1);
      gl.bindFramebuffer(gl.FRAMEBUFFER, hfb);
      gl.readPixels(0, 0, HW, HH, gl.RGBA, gl.UNSIGNED_BYTE, hpix);
      const grid = lumaGrid(hpix, HW, HH);
      const same = pearson(grid, hull.lumas[i]);
      const flip = pearson(grid, mirrors[i]);
      if (same + 0.03 > flip) hand.beats++;
      hand.bearings++;
      if (same < hand.worstSame) hand.worstSame = same;
      hand.rows.push({ bearing: cam.yaw, yaw: cam.yaw, same, mirror: flip });
    }
    P[0] = savedX;
    P[5] = savedY;
    gl.deleteFramebuffer(hfb);
    gl.deleteTexture(htex);
    gl.deleteRenderbuffer(hdepth);
  }
  gl.deleteFramebuffer(fb);
  gl.deleteTexture(tex);
  gl.deleteRenderbuffer(depth);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, W, H);
  state.x = saved.x;
  state.z = saved.z;
  state.hdg = saved.hdg;
  solidLock = { objects: rows };
  handedness = hand;
  return { solidLock, handedness: hand };
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
      const r = d[o];
      const gg = d[o + 1];
      const b = d[o + 2];
      if (gg - Math.max(r, b) > 40 && gg > 70) continue;
      if (r + gg + b < 30) continue;
      if (y > maxY) maxY = y;
    }
  }
  pawFrac = maxY / c.height;
  video.pause();
}

async function boot() {
  try {
    clearing = await (await fetch("/packs/zone-a/clearing.json")).json();
    labelOf("hero");
    labelOf("ground");
    labelOf("fog");
    const paths = [];
    const seen = new Set();
    const add = (p) => { if (!seen.has(p)) { seen.add(p); paths.push(p); } };
    const edgeHulls = (clearing.edge_ring && clearing.edge_ring.hulls) || [];
    const interiors = clearing.interior_objects || [];
    for (const h of edgeHulls) add(h.asset);
    for (const o of interiors) add(o.asset);
    for (const p of paths) {
      const hull = await loadWorldHull(gl, absUrl(p), (id, bytes) => trackTex(id, bytes), { maxH: capFor(p) });
      hullByPath.set(p, hull);
      hullList.push(hull);
    }
    objects = [];
    for (const h of edgeHulls) objects.push({ ...h, kind: "edge" });
    for (const o of interiors) objects.push({ ...o, kind: "interior" });
    for (let i = 0; i < objects.length; i++) {
      const o = objects[i];
      const hull = hullByPath.get(o.asset);
      if (!hull) continue;
      const y = (o.base_y_m || 0) - hull.minY * (o.scale || 1);
      hull.addInstance(o.position[0], y, o.position[1], o.yaw_deg || 0, o.scale || 1, labelOf(o.id));
    }
    for (let i = 0; i < hullList.length; i++) hullList[i].upload();
    const ground = clearing.zone.ground;
    if (ground.depth && ground.mask && ground.details) {
      useRelief = true;
      await terrain.load(ground);
      groundSrc = terrain.srcW();
    } else {
      const tileUrls = ground.tiles;
      const tileImgs = [];
      for (const u of tileUrls) tileImgs.push(await loadImage(absUrl(u)));
      groundSrc = tileImgs[0].width;
      groundTex = makeArray(tileImgs, "ground", true);
      buildGround(ground.tile_m || 0.9);
    }
    const slices = clearing.backdrop.slices || [];
    const skyImgs = [];
    for (const u of slices) skyImgs.push(await loadImage(absUrl(u)));
    skySrcW = 0;
    skySrcH = skyImgs[0] ? skyImgs[0].height : 912;
    for (let i = 0; i < skyImgs.length; i++) skySrcW += skyImgs[i].width;
    skyTex = makeArray(skyImgs, "sky", false);
    buildSky();
    zenithTex = makeStill(await loadImage(absUrl("packs/zone-a/src/sky-cap/zenith.png")), "sky-zenith");
    const loopUrls = [
      "packs/zone-a/src/sky/stars.mp4",
      "packs/zone-a/src/sky/dust.mp4",
      "packs/zone-a/src/sky/nebula.mp4",
    ];
    for (let i = 0; i < loopUrls.length; i++) {
      skyVideoTex[i] = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, skyVideoTex[i]);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const px = new Uint8Array([0, 0, 0, 255]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
      skyVideos[i] = videoEl(loopUrls[i]);
      skyVideos[i].loop = true;
    }
    if (useRelief) terrain.setFog(sampleHorizon(skyImgs));
    if (clearing.fog_band && clearing.fog_band.atlas) {
      fogTex = makeStill(await loadImage(absUrl(clearing.fog_band.atlas)), "fog");
      buildFog();
    }
    buildCard();
    boltTex = gl.createTexture();
    gateTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, boltTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, gateTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gallopVideo = videoEl(clearing.bolt.gallop);
    idleVideo = videoEl(clearing.bolt.idle);
    gallopVideo.loop = true;
    idleVideo.loop = true;
    if (clearing.gates && clearing.gates[0] && clearing.gates[0].field) {
      gateVideo = videoEl(clearing.gates[0].field);
      gateVideo.loop = true;
    }
    await measurePaw(gallopVideo);
    for (let i = 0; i < skyVideos.length; i++) {
      const v = skyVideos[i];
      await new Promise((r) => {
        if (v.readyState >= 2) r();
        else v.addEventListener("loadeddata", () => r(), { once: true });
      });
      await v.play().catch(() => {});
    }
    await idleVideo.play().catch(() => {});
    await new Promise((r) => {
      if (idleVideo.readyState >= 2) r();
      else idleVideo.onloadeddata = () => r();
    });
    idleVideo.pause();
    trackTex("id", W * H * 4);
    reset();
    window.__play = {
      version: 3,
      ready: true,
      reset, look, place, setInput, tick, snapshot, audit,
      lookAt(e, t) { shot = { e, t }; },
      clearShot() { shot = null; },
      setPost(on) { terrain.setPost(on); },
      groundInfo() { return terrain.info(); },
      heightAt(x, z) { return terrain.heightAt(x, z); },
    };
    render(0);
    paintHud();
    const err = gl.getError();
    if (err) hud.textContent += "\nGL " + err;
    requestAnimationFrame(frame);
  } catch (e) {
    hud.textContent = "BOOT " + (e && e.stack ? e.stack : e);
    window.__play = { ready: false, error: String(e) };
  }
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

boot();

/**
 * Zone A phone view. Code places. Imagine pixels only.
 * Portrait 720×1600, hfov 22.7°. Solids are world-locked hulls.
 */
import { loadWorldHull } from "./hullmesh.js";
import { createTerrain } from "./terrain.js";
import { mountRocks } from "./rocks.js";
import { mountRuins } from "./ruins.js";

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
// Debug HUD (position, heading, mag, gate, perf) only behind an explicit flag: ?debug=1.
// Players see no text once loaded (loading progress and a boot error stay).
const SHOW_HUD = /[?&]debug=1(&|$)/.test(location.search);
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
uniform sampler2DArray uUpper;
uniform sampler2DArray uHigh;
uniform sampler2D uZenith;
uniform vec3 uId;
uniform int uMode;
uniform float uElH0;
uniform float uElH1;
uniform float uElU0;
uniform float uElU1;
uniform float uElK0;
uniform float uElK1;
uniform float uCapEl;
uniform float uLayers;
uniform float uUpperLayers;
uniform float uHighLayers;
uniform float uHasUpper;
uniform float uHasHigh;
uniform float uAzBias;
uniform vec3 uOvH;
uniform vec3 uOvU;
uniform vec3 uOvK;
in vec3 vLocal;
out vec4 o;
// Each slice keeps its own Imagine pixels. It is widened in azimuth only as far as the band's own
// magnification allows (ov.y = band mag limit / slice mag at the band bottom, ov.z = cos of that bottom),
// capped at ov.x of a slice. The overlap shows both neighbours and crossfades them: no new pixels, no stretch.
vec3 bandTex(sampler2DArray tex, float u, float v, float layer, vec2 gx, vec2 gy) {
  return textureGrad(tex, vec3(u, v, layer), gx, gy).rgb;
}
vec3 sampleBand(sampler2DArray tex, float layers, float turns, float el, float e0, float e1, vec3 ov) {
  float n = max(1.0, layers);
  float v = 1.0 - clamp((el - e0) / max(0.001, e1 - e0), 0.0, 1.0);
  float o = clamp(ov.y * ov.z / max(0.05, cos(el)) - 1.0, 0.0, ov.x);
  float s = 1.0 / (1.0 + o);
  float p = turns * n;
  float i = floor(p);
  float f = p - i;
  vec2 dp = vec2(dFdx(p), dFdy(p));
  dp -= n * floor(dp / n + 0.5);
  vec2 ds = vec2(dFdx(s), dFdy(s));
  vec2 dv = vec2(dFdx(v), dFdy(v));
  vec2 duA = dp * s + (f - 0.5) * ds;
  vec3 col = bandTex(tex, (f - 0.5) * s + 0.5, v, i, vec2(duA.x, dv.x), vec2(duA.y, dv.y));
  float h = 0.5 * o;
  if (o > 0.001 && f > 1.0 - h) {
    vec2 duB = dp * s + (f - 1.5) * ds;
    vec3 b = bandTex(tex, (f - 1.5) * s + 0.5, v, mod(i + 1.0, n), vec2(duB.x, dv.x), vec2(duB.y, dv.y));
    col = mix(col, b, smoothstep(0.0, 1.0, (f - 1.0 + h) / o));
  } else if (o > 0.001 && f < h) {
    vec2 duB = dp * s + (f + 0.5) * ds;
    vec3 b = bandTex(tex, (f + 0.5) * s + 0.5, v, mod(i - 1.0 + n, n), vec2(duB.x, dv.x), vec2(duB.y, dv.y));
    col = mix(b, col, smoothstep(0.0, 1.0, (f + h) / o));
  }
  return col;
}
float bandWeight(float el, float e0, float e1, float enterW, float leaveW) {
  float enter = smoothstep(e0, e0 + max(0.02, enterW), el);
  float leave = 1.0 - smoothstep(e1 - max(0.02, leaveW), e1, el);
  return enter * leave;
}
void main() {
  if (uMode == 1) {
    o = vec4(uId, 1.0);
    return;
  }
  vec3 dir = normalize(vLocal);
  float az = atan(dir.x, dir.z) + uAzBias;
  az = mod(az, 6.28318530718);
  if (az < 0.0) az += 6.28318530718;
  float el = asin(clamp(dir.y, -1.0, 1.0));
  float turns = az / 6.28318530718;
  float hu = uHasUpper > 0.5 ? max(0.05, uElH1 - uElU0) : 0.02;
  float uk = uHasHigh > 0.5 ? max(0.05, uElU1 - uElK0) : 0.02;
  float kc = max(0.05, uElK1 - uCapEl);
  float wH = 1.0 - smoothstep(uElH1 - hu, uElH1, el);
  float wU = uHasUpper * bandWeight(el, uElU0, uElU1, hu, uk);
  float wK = uHasHigh * bandWeight(el, uElK0, uElK1, uk, kc);
  float wC = smoothstep(uCapEl - kc, min(uCapEl + 0.02, uElK1), el);
  vec3 acc = sampleBand(uTex, uLayers, turns, el, uElH0, uElH1, uOvH) * wH;
  if (wU > 0.001) acc += sampleBand(uUpper, uUpperLayers, turns, el, uElU0, uElU1, uOvU) * wU;
  if (wK > 0.001) acc += sampleBand(uHigh, uHighLayers, turns, el, uElK0, uElK1, uOvK) * wK;
  float hlen = length(dir.xz);
  float capR = clamp((1.57079632679 - el) / max(0.001, 1.57079632679 - uCapEl), 0.0, 1.0);
  vec2 nrm = hlen < 1e-4 ? vec2(0.0) : dir.xz / hlen;
  float ca = cos(uAzBias);
  float sa = sin(uAzBias);
  nrm = vec2(ca * nrm.x - sa * nrm.y, sa * nrm.x + ca * nrm.y);
  vec2 capUv = vec2(0.5) + nrm * capR * 0.5;
  if (wC > 0.001) acc += texture(uZenith, capUv).rgb * wC;
  o = vec4(acc / max(0.001, wH + wU + wK + wC), 1.0);
}`);

const skyLayerProg = program(`#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aTile;
layout(location=2) in vec2 aPhase;
layout(location=3) in vec4 aMeteor;
uniform mat4 uVP;
uniform vec3 uEye;
uniform float uAzBias;
uniform float uRadius;
uniform float uTime;
uniform float uScroll;
uniform float uMeteor;
uniform vec2 uMetDuty;
out vec2 vUv;
flat out vec2 vTile;
flat out vec4 vMet;
// Meteor tiles (uMeteor = 1): each sparse tile shows the whole frame once (no drift, no wrap), so a streak never
// jumps at a tile edge. aMeteor = window centre (frame UV), period s, time offset s. The tile is on screen
// for part of its own period with a soft fade in and out: a timing offset per tile, never a new pixel.
void main() {
  float az = aTile.x + (aCorner.x - 0.5) * aTile.z + uAzBias;
  float el = aTile.y + (aCorner.y - 0.5) * aTile.w;
  float c = cos(el);
  vec3 p = vec3(sin(az) * c, sin(el), cos(az) * c) * uRadius + uEye;
  gl_Position = uVP * vec4(p, 1.0);
  vec2 drift = vec2(aPhase.x + aPhase.y * uTime, aPhase.y * uTime * 0.15);
  vUv = aCorner + drift * uScroll;
  vTile = aTile.xy;
  vMet = vec4(0.0);
  if (uMeteor > 0.5) {
    float ph = mod(uTime + aMeteor.w, aMeteor.z);
    float on = uMetDuty.x * aMeteor.z;
    float env = smoothstep(0.0, uMetDuty.y, ph) * (1.0 - smoothstep(on - uMetDuty.y, on, ph));
    vUv = aCorner;
    vMet = vec4(aMeteor.xy, env, 1.0);
  }
}`, `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform float uGain;
uniform float uKey;
uniform vec3 uMetWin;
in vec2 vUv;
flat in vec2 vTile;
flat in vec4 vMet;
out vec4 o;
void main() {
  vec3 s = texture(uTex, fract(vUv)).rgb;
  float lum = dot(s, vec3(0.299, 0.587, 0.114));
  float key = smoothstep(uKey, uKey + 0.06, lum);
  if (vMet.w > 0.5) {
    // Soft elliptical alpha window held inside the frame: a streak fades in and out, it is never cut.
    float d = length((vUv - vMet.xy) / uMetWin.xy);
    key *= (1.0 - smoothstep(uMetWin.z, 1.0, d)) * vMet.z;
  }
  o = vec4(s * uGain * key, 1.0);
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
  upper: gl.getUniformLocation(surfProg, "uUpper"),
  high: gl.getUniformLocation(surfProg, "uHigh"),
  elH0: gl.getUniformLocation(surfProg, "uElH0"),
  elH1: gl.getUniformLocation(surfProg, "uElH1"),
  elU0: gl.getUniformLocation(surfProg, "uElU0"),
  elU1: gl.getUniformLocation(surfProg, "uElU1"),
  elK0: gl.getUniformLocation(surfProg, "uElK0"),
  elK1: gl.getUniformLocation(surfProg, "uElK1"),
  capEl: gl.getUniformLocation(surfProg, "uCapEl"),
  layers: gl.getUniformLocation(surfProg, "uLayers"),
  upperLayers: gl.getUniformLocation(surfProg, "uUpperLayers"),
  highLayers: gl.getUniformLocation(surfProg, "uHighLayers"),
  hasUpper: gl.getUniformLocation(surfProg, "uHasUpper"),
  hasHigh: gl.getUniformLocation(surfProg, "uHasHigh"),
  azBias: gl.getUniformLocation(surfProg, "uAzBias"),
  ovH: gl.getUniformLocation(surfProg, "uOvH"),
  ovU: gl.getUniformLocation(surfProg, "uOvU"),
  ovK: gl.getUniformLocation(surfProg, "uOvK"),
};
const skyLayerLoc = {
  vp: gl.getUniformLocation(skyLayerProg, "uVP"),
  eye: gl.getUniformLocation(skyLayerProg, "uEye"),
  azBias: gl.getUniformLocation(skyLayerProg, "uAzBias"),
  radius: gl.getUniformLocation(skyLayerProg, "uRadius"),
  time: gl.getUniformLocation(skyLayerProg, "uTime"),
  scroll: gl.getUniformLocation(skyLayerProg, "uScroll"),
  tex: gl.getUniformLocation(skyLayerProg, "uTex"),
  gain: gl.getUniformLocation(skyLayerProg, "uGain"),
  key: gl.getUniformLocation(skyLayerProg, "uKey"),
  meteor: gl.getUniformLocation(skyLayerProg, "uMeteor"),
  metDuty: gl.getUniformLocation(skyLayerProg, "uMetDuty"),
  metWin: gl.getUniformLocation(skyLayerProg, "uMetWin"),
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

// Phone over 4G: a big PNG can drop mid-transfer. Load at most 4 at a time,
// retry with backoff, and share one promise per URL so prefetch and boot agree.
const imgCache = new Map();
const imgQueue = [];
let imgActive = 0;
let imgDone = 0;
function imageOnce(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(url));
    img.src = url;
  });
}
function pumpImages() {
  while (imgActive < 4 && imgQueue.length) {
    imgActive++;
    imgQueue.shift()();
  }
}
function loadProgress() {
  if (!window.__play) hud.textContent = "loading " + imgDone + "/" + imgCache.size;
}
function loadImage(url) {
  if (imgCache.has(url)) return imgCache.get(url);
  const p = new Promise((resolve, reject) => {
    imgQueue.push(async () => {
      try {
        for (let a = 0; ; a++) {
          try {
            const img = await imageOnce(a ? url + (url.includes("?") ? "&" : "?") + "retry=" + a : url);
            imgDone++;
            loadProgress();
            resolve(img);
            return;
          } catch (e) {
            if (a >= 3) throw e;
            await new Promise((r) => setTimeout(r, 1000 * 2 ** a));
          }
        }
      } catch (e) {
        reject(e);
      } finally {
        imgActive--;
        pumpImages();
      }
    });
    pumpImages();
  });
  imgCache.set(url, p);
  loadProgress();
  return p;
}
function prefetchImages(urls) {
  for (const u of urls) if (u) loadImage(absUrl(u)).catch(() => {});
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
let skyUpper = null;
let skyHigh = null;
let skyLayers = 0;
let skySrcW = 12768;
let skySrcH = 912;
let zenithTex = null;
let zenithSrc = 1024;
const skyVideos = [null, null, null];
const skyVideoTex = [null, null, null];
const SKY_VIDEO_IDS = ["sky-stars", "sky-dust", "sky-nebula"];
const SKY_GAIN = [0.1, 0.04, 1.5];
// Meteor layer key 0.30 (keyed from the loop's own brightness): keeps the streaks, drops the cyan cloud wisps.
const SKY_KEY = [0.12, 0.08, 0.30];
const SKY_TILE_AZ_N = 17;
const SKY_TILE_EL_N = 8;
const SKY_TILE_AZ = 360 / SKY_TILE_AZ_N;
const SKY_TILE_EL = 11.25;
let skyTileVao = null;
let skyTileCount = 0;
// Meteors (nebula slot): a few sparse tiles, not the full 17 x 8 grid, so streaks never line up in a rain grid.
// Chase view (pitch about +3 deg, vfov 48.1 deg) sees sky from the relief silhouette (about 8-10 deg up) to
// about 27 deg up. Window centres sit in that band; tiles may hang below it, only the window is visible.
const METEOR = {
  tiles: 36, // scattered over every azimuth, windows never overlap
  elLoDeg: 7, elHiDeg: 18, // window centre elevation band
  win: [0.40, 0.16, 0.55], // window radii in frame UV (x, y) and flat core fraction
  duty: 0.32, fadeSec: 0.8, // share of each tile's own period it is on, fade in/out
  periodSec: [6, 11],
};
let meteorVao = null;
let meteorCount = 0;
const meteorInfo = [];
let meteorShow = true; // debug hook only (QC A/B); always true in play
let skyManifest = null;
const skyBand = {
  h0: -1.5 * Math.PI / 180,
  h1: 24 * Math.PI / 180,
  u0: 19 * Math.PI / 180,
  u1: 56 * Math.PI / 180,
  k0: 52 * Math.PI / 180,
  k1: 77.5 * Math.PI / 180,
  cap: 74.6 * Math.PI / 180,
};
const skyMagParts = {
  horizon: 0, upper: 0, high: 0, cap: 0, stars: 0, dust: 0, nebula: 0,
};
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
let lastRuinMag = null;
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
// Held chase pose. The eye eases toward it. A fresh score must beat the hold
// by CAM_HYST before the pose changes, so the grid cannot chatter each frame.
const CAM_HYST = 80;
const camHold = { boom: 6, eye: 1.35, slide: 0, live: false };
// Ruins: the chase line must not pass through a drawn face, and the eye keeps the near plane off it.
// The boom eases in (rate-limited) before a face would cut the line, and eases back out after.
const RUIN_BODY_R = 0.3;
const RUIN_HEAD = 0.9;
const RUIN_LINE_EPS = 0.12;
const RUIN_EYE_GAP = 0.45;
const RUIN_MIN_LEN = 1.6;
const RUIN_IN_RATE = 4.0;
const RUIN_OUT_RATE = 2.0;
const RUIN_EYE_CLEAR = 0.85;
const RUIN_HARD_MIN = 1.0;
// The boom may swing around Bolt (whole rig, so Bolt keeps his screen place) when the line
// straight behind him is walled in, e.g. turning round deep in the hangar or under the arch.
const RUIN_SWING = [0, 25, -25, 50, -50, 75, -75, 100, -100, 130, -130];
const RUIN_SWING_RATE = 150;
// Boom length and swing move as critically damped springs with a speed and an acceleration cap,
// so the eye's velocity never jumps (a rate-limited chase flips velocity when its goal turns).
const RUIN_LEN_W_IN = 9;
const RUIN_LEN_W_OUT = 3.5;
const RUIN_LEN_ACC = 14;
const RUIN_LEN_ACC_URGENT = 40;
const RUIN_SWING_W = 4;
const RUIN_SWING_ACC = 420;
// Hard eye guard: never nearer than RUIN_EYE_SAFE to a face (near plane 0.35 m, corner 0.39 m,
// field error about half a voxel diagonal), softened over RUIN_EYE_SOFT. Never under the relief.
const RUIN_EYE_SAFE = 0.5;
const RUIN_EYE_SOFT = 0.25;
const RUIN_EYE_FLOOR = 0.35;
const RUIN_EYE_SUB = 0.04;
const RUIN_EYE_JUMP = 0.4;
// Chase heading near a ruin: the rig follows Bolt's heading through a capped critically damped
// spring instead of rigidly, so turning on the spot in the hangar (150 deg/s) cannot whip the
// eye round into the hull. Off the ruins the chase heading is Bolt's heading, unchanged.
const CAM_YAW_W = 5;
const CAM_YAW_RATE_RUIN = 80;
const CAM_YAW_RATE_FREE = 400;
const CAM_YAW_ACC = 500;
const CAM_YAW_ACC_RUIN = 160;
const camYaw = { h: 0, v: 0, ready: false, lag: false, last: 0 };
const RUIN_OFF_W = 6;
const RUIN_OFF_V = 4;
const RUIN_OFF_ACC = 20;
const RUIN_RISES = [0.6, 0.35, 0.15, 0];
const RUIN_RISE_W = 4;
const RUIN_RISE_V = 1.2;
const RUIN_RISE_ACC = 5;
const ruinCam = {
  rise: 1, riseV: 0, riseGoal: 1,
  eye: [0, 0, 0], want: [0, 0, 0], off: [0, 0, 0], offV: [0, 0, 0], eyeLive: false,
  len: 0, lenV: 0, full: 0, ready: false, clamped: false, yaw: 0, yawV: 0, goal: 0, dbg: null,
  fe: [0, 0, 0], fv: [0, 0, 0], tp: [0, 0, 0], fReady: false, fLag: false };
// Last stage near a ruin: the drawn eye tracks the solved eye (position and velocity) through a
// critically damped follower whose acceleration is capped below the shake threshold, so a face
// contact, a swing or a boom ease can bend the eye's path but never reverse it frame to frame.
// Off the ruins it hands over once converged and the eye is the solved eye, unchanged.
const RUIN_EYE_W = 10;
const RUIN_EYE_ACC = 30;
const RUIN_EYE_HARD = 0.4;
// Eased pose changes are also speed-capped so a far target cannot swoop the eye.
const CAM_RATE_BOOM = 3.0;
const CAM_RATE_EYE = 1.5;
const CAM_RATE_SLIDE = 1.5;
let ruinContact = false;
let ruinStall = 0;
const CAM_W = 10;
const CAM_ACC = 9;
const camSm = { ready: false, boom: 6, eye: 1.35, slide: 0, boomV: 0, eyeV: 0, slideV: 0, ground: 0, feet: 0 };
let camStepDt = 0;
let camPitch = 0;

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
  if (!v) return false;
  // A loop seek can drop readyState for one frame. Keep the last upload.
  if (v.readyState < 2) return videoStamp.has(id);
  const stamp = v.currentTime;
  if (videoStamp.get(id) === stamp) return true;
  if (v.paused && videoStamp.has(id)) return true;
  videoStamp.set(id, stamp);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
  trackTex(id, (v.videoWidth || 848) * (v.videoHeight || 480) * 4);
  return true;
}

function downscaleWidth(img, targetW) {
  if (!img || img.width <= targetW + 1) return img;
  const c = document.createElement("canvas");
  c.width = targetW | 0;
  c.height = img.height;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

function releaseImages(list) {
  if (!list) return;
  for (let i = 0; i < list.length; i++) {
    const img = list[i];
    if (img && typeof img.src === "string") img.src = "";
  }
}

function rgbBytes(img) {
  const rgba = canvasPixels(img);
  const rgb = new Uint8Array(img.width * img.height * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    rgb[j] = rgba[i];
    rgb[j + 1] = rgba[i + 1];
    rgb[j + 2] = rgba[i + 2];
  }
  return rgb;
}

function makeSkyArray(images, id) {
  let maxW = 2;
  let maxH = 2;
  const packed = [];
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    packed.push({ w: img.width, h: img.height, data: rgbBytes(img) });
    maxW = Math.max(maxW, img.width);
    maxH = Math.max(maxH, img.height);
  }
  const levels = Math.floor(Math.log2(Math.max(maxW, maxH))) + 1;
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
  gl.texStorage3D(gl.TEXTURE_2D_ARRAY, levels, gl.RGB8, maxW, maxH, images.length);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  for (let i = 0; i < packed.length; i++) {
    const p = packed[i];
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, p.w, p.h, 1, gl.RGB, gl.UNSIGNED_BYTE, p.data);
  }
  gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
  trackTex(id, Math.ceil(maxW * maxH * 3 * images.length * 4 / 3));
  return { tex: t, w: maxW, h: maxH, layers: images.length };
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
  const elN = 28;
  const data = [];
  const push = (az, el) => {
    const c = Math.cos(el);
    data.push(Math.sin(az) * c * skyR, Math.sin(el) * skyR, Math.cos(az) * c * skyR, 0, 0, 0);
  };
  for (let ia = 0; ia < azN; ia++) {
    const a0 = (ia / azN) * Math.PI * 2;
    const a1 = ((ia + 1) / azN) * Math.PI * 2;
    for (let ie = 0; ie < elN - 1; ie++) {
      const e0 = el0 + (ie / elN) * (el1 - el0);
      const e1 = el0 + ((ie + 1) / elN) * (el1 - el0);
      push(a0, e0); push(a1, e0); push(a1, e1);
      push(a0, e0); push(a1, e1); push(a0, e1);
    }
    const eBase = el0 + ((elN - 1) / elN) * (el1 - el0);
    push(a0, eBase);
    push(a1, eBase);
    push(0, el1);
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
  buildSkyTiles();
}

function buildSkyTiles() {
  const corners = new Float32Array([
    0, 0, 1, 0, 1, 1,
    0, 0, 1, 1, 0, 1,
  ]);
  const azN = SKY_TILE_AZ_N;
  const elN = SKY_TILE_EL_N;
  const azSpan = (Math.PI * 2) / azN;
  const el0 = -2 * Math.PI / 180;
  const el1 = el0 + elN * SKY_TILE_EL * Math.PI / 180;
  const elSpan = (el1 - el0) / elN;
  skyTileCount = azN * elN;
  const inst = new Float32Array(skyTileCount * 6);
  let k = 0;
  for (let ie = 0; ie < elN; ie++) {
    for (let ia = 0; ia < azN; ia++) {
      inst[k++] = (ia + 0.5) * azSpan;
      inst[k++] = el0 + (ie + 0.5) * elSpan;
      inst[k++] = azSpan;
      inst[k++] = elSpan;
      inst[k++] = (ia * 0.37 + ie * 0.53) % 1;
      inst[k++] = 0.015 + ((ia * 3 + ie * 5) % 7) * 0.004;
    }
  }
  skyTileVao = gl.createVertexArray();
  gl.bindVertexArray(skyTileVao);
  const cbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cbuf);
  gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  const ibuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, ibuf);
  gl.bufferData(gl.ARRAY_BUFFER, inst, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 24, 0);
  gl.vertexAttribDivisor(1, 1);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 24, 16);
  gl.vertexAttribDivisor(2, 1);
  gl.bindVertexArray(null);
  buildMeteorTiles(cbuf, azSpan, elSpan);
}

// Sparse, irregular meteor tiles. Same tile size as the full-dome layers (magnification unchanged), whole frame
// per tile. Each tile carries an alpha window held inside the frame; the window centre (not the tile) is placed
// by a seeded jittered draw in the chase-view sky band, and no two windows overlap.
function buildMeteorTiles(cbuf, azSpan, elSpan) {
  let seed = 0x5eed1;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const d2r = Math.PI / 180;
  const [rx, ry] = METEOR.win;
  const sepAz = 2 * rx * azSpan;
  const sepEl = 2 * ry * elSpan;
  const placed = [];
  for (let tries = 0; placed.length < METEOR.tiles && tries < 20000; tries++) {
    const az = rnd() * Math.PI * 2;
    const el = (METEOR.elLoDeg + rnd() * (METEOR.elHiDeg - METEOR.elLoDeg)) * d2r;
    let ok = true;
    for (const q of placed) {
      let da = Math.abs(az - q.az);
      da = Math.min(da, Math.PI * 2 - da);
      if (da < sepAz && Math.abs(el - q.el) < sepEl) { ok = false; break; }
    }
    if (ok) placed.push({ az, el });
  }
  meteorCount = placed.length;
  meteorInfo.length = 0;
  const inst = new Float32Array(meteorCount * 10);
  let k = 0;
  for (let i = 0; i < meteorCount; i++) {
    const p = placed[i];
    const cx = 0.42 + rnd() * 0.16;
    const cy = 0.3 + rnd() * 0.4;
    inst[k++] = p.az - (cx - 0.5) * azSpan;
    inst[k++] = p.el - (cy - 0.5) * elSpan;
    inst[k++] = azSpan;
    inst[k++] = elSpan;
    inst[k++] = 0;
    inst[k++] = 0;
    inst[k++] = cx;
    inst[k++] = cy;
    inst[k++] = METEOR.periodSec[0] + rnd() * (METEOR.periodSec[1] - METEOR.periodSec[0]);
    inst[k++] = rnd() * 40;
    meteorInfo.push({ azDeg: p.az / d2r, elDeg: p.el / d2r, periodSec: inst[k - 2], offsetSec: inst[k - 1] });
  }
  meteorVao = gl.createVertexArray();
  gl.bindVertexArray(meteorVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, cbuf);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  const mbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, mbuf);
  gl.bufferData(gl.ARRAY_BUFFER, inst, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 40, 0);
  gl.vertexAttribDivisor(1, 1);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 40, 16);
  gl.vertexAttribDivisor(2, 1);
  gl.enableVertexAttribArray(3);
  gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 40, 24);
  gl.vertexAttribDivisor(3, 1);
  gl.bindVertexArray(null);
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
  if (!useRelief) return 0;
  const g = terrain.heightAt(state.x, state.z);
  // A ruin face within one step of the relief (a sill, a hull foot) is floor.
  return ruinLayer ? g + ruinLayer.lift(state.x, state.z) : g;
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

function pitchView(eye, lookFeet) {
  const along = (state.x - eye[0]) * fwdBuf[0] + (state.z - eye[2]) * fwdBuf[2];
  const feet = lookFeet == null ? feetY() : lookFeet;
  const targetY = feet + BOLT_H * 0.45;
  const pitch = Math.atan2(targetY - eye[1], Math.max(0.35, along));
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  camFwd[0] = fwdBuf[0] * cp;
  camFwd[1] = sp;
  camFwd[2] = fwdBuf[2] * cp;
  camUp[0] = -sp * fwdBuf[0];
  camUp[1] = cp;
  camUp[2] = -sp * fwdBuf[2];
  camPitch = pitch;
}

function chase(cur, goal, dt, tau) {
  if (!(dt > 0)) return goal;
  return cur + (goal - cur) * (1 - Math.exp(-dt / tau));
}

// One step of a critically damped spring toward goal. |v| <= vmax, |dv/dt| <= amax. Returns [x, v].
function springLim(x, v, goal, dt, w, vmax, amax) {
  let a = w * w * (goal - x) - 2 * w * v;
  if (a > amax) a = amax;
  else if (a < -amax) a = -amax;
  let nv = v + a * dt;
  if (nv > vmax) nv = vmax;
  else if (nv < -vmax) nv = -vmax;
  return [x + nv * dt, nv];
}

function solveCamera() {
  if (shot) {
    applyShot();
    camPitch = Math.atan2(camFwd[1], Math.hypot(camFwd[0], camFwd[2]));
    camStepDt = 0;
    return;
  }
  const dtYaw = camStepDt > 0 ? Math.min(0.05, camStepDt) : 0;
  if (!camYaw.ready || !camSm.ready) {
    camYaw.h = state.hdg;
    camYaw.v = 0;
    camYaw.lag = false;
    camYaw.ready = true;
  } else if (dtYaw > 0) {
    const nearYaw = !!ruinLayer && ruinLayer.near(state.x, state.z, 10);
    const err = wrap180(state.hdg - camYaw.h);
    // Leaving the ruins, the lag converges on the free chase (faster cap), then hands over.
    if (nearYaw) camYaw.lag = true;
    else if (Math.abs(err) < 0.05 && Math.abs(camYaw.v) < 0.5) camYaw.lag = false;
    if (camYaw.lag) {
      // Critically damped, rate-capped. Near a ruin the rig trails a fast turn; leaving the ruins
      // Bolt's turn rate is fed forward so a steady turn converges with no standing lag.
      const omega = nearYaw ? 0 : wrap180(state.hdg - camYaw.last) / dtYaw;
      const vmax = nearYaw ? CAM_YAW_RATE_RUIN : CAM_YAW_RATE_FREE;
      let acc = CAM_YAW_W * CAM_YAW_W * err + 2 * CAM_YAW_W * (omega - camYaw.v);
      // Near a ruin the orbit's angular acceleration stays under what the eye follower can track.
      const amax = nearYaw ? CAM_YAW_ACC_RUIN : CAM_YAW_ACC;
      if (acc > amax) acc = amax;
      else if (acc < -amax) acc = -amax;
      let nv = camYaw.v + acc * dtYaw;
      if (nv > vmax) nv = vmax;
      else if (nv < -vmax) nv = -vmax;
      camYaw.h = wrap360(camYaw.h + nv * dtYaw);
      camYaw.v = nv;
    } else {
      camYaw.h = state.hdg;
      camYaw.v = 0;
    }
  }
  camYaw.last = state.hdg;
  const yaw = camYaw.h * Math.PI / 180;
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
  // The winner is a target. Hysteresis holds it, and the eye eases. Raw heightAt is not copied.
  const booms = [4.0, 4.4, 5.2, 6.0, 6.4, 6.8, 7.2];
  const eyes = [1.35, 1.8, 2.4, 3.2, 4.0, 5.5, 6.8, 8.0];
  const slides = [0, 0.5, -0.5, 1, -1];
  const targetDist = 8.0;
  let bestKey = -1e9;
  let found = false;
  let bestBoom = 6;
  let bestEye = 1.35;
  let bestSlide = 0;
  let fbKey = -1e9;
  let fbBoom = BOOM;
  let fbEye = EYE;
  let fbSlide = 0;
  let haveFb = false;
  let holdKey = -1e9;
  let holdHard = false;
  const dt = camStepDt > 0 ? Math.min(0.05, camStepDt) : 0;
  camStepDt = 0;
  const ruinNear = !!ruinLayer && ruinLayer.near(state.x, state.z, 10);
  const headY = feetY() + RUIN_HEAD;
  // Under the arch or in the hangar a low eye keeps the chase line inside the opening.
  // Score only: legality (and so the snap path) is untouched.
  const ruinHere = ruinNear ? ruinLayer.where(state.x, state.z) : null;
  const ruinLow = ruinNear && (ruinCam.clamped || !!(ruinHere && ruinHere.covered));
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
        // A chase line through a ruin face only costs score. It never makes a pose illegal,
        // so it cannot force the snap path below.
        const ruinCut = ruinNear && ruinLayer.segFree(state.x, headY, state.z, candEye[0], candEye[1], candEye[2], RUIN_LINE_EPS) < 0.999;
        const near = (m.on ? 1000 : 0) + (blocked ? 0 : 200) + Math.min(m.minR, 1.25) * 20 - Math.abs(dist - targetDist) * 40 - Math.abs(slide) * 2 - Math.max(0, eyes[ei] - 1.6) * (ruinLow ? 230 : 80) - (ruinCut ? 300 : 0);
        const hard = m.on && m.minR >= 1.002 && !blocked;
        const isHold = camHold.live && boom === camHold.boom && eyes[ei] === camHold.eye && slide === camHold.slide;
        if (isHold) {
          holdKey = near;
          holdHard = hard;
        }
        if (m.on && m.minR >= 1.002 && near > fbKey) {
          fbKey = near;
          haveFb = true;
          fbBoom = boom;
          fbEye = eyes[ei];
          fbSlide = slide;
        }
        if (!hard) continue;
        if (near > bestKey) {
          bestKey = near;
          found = true;
          bestBoom = boom;
          bestEye = eyes[ei];
          bestSlide = slide;
        }
      }
    }
  }
  let useBoom = bestBoom;
  let useEye = bestEye;
  let useSlide = bestSlide;
  let legal = found;
  if (camHold.live && holdHard && (!found || bestKey - holdKey < CAM_HYST)) {
    useBoom = camHold.boom;
    useEye = camHold.eye;
    useSlide = camHold.slide;
    legal = true;
  } else if (!found && haveFb) {
    useBoom = fbBoom;
    useEye = fbEye;
    useSlide = fbSlide;
    legal = false;
  } else if (!found) {
    useBoom = BOOM;
    useEye = EYE;
    useSlide = 0;
    legal = false;
  }
  camHold.boom = useBoom;
  camHold.eye = useEye;
  camHold.slide = useSlide;
  camHold.live = true;
  // An illegal hold snaps onto a legal pose so a solid never sits above magnification 1.
  // A legal change eases. Terrain height eases either way, so relief cannot kick the eye.
  const snapPose = !camSm.ready || !legal;
  if (snapPose) {
    camSm.boom = useBoom;
    camSm.eye = useEye;
    camSm.slide = useSlide;
    camSm.boomV = camSm.eyeV = camSm.slideV = 0;
  } else if (dt > 0) {
    // Critically damped, speed- and acceleration-capped: a pose change starts and ends without
    // a velocity step, so the eye never kicks (the old first-order chase jumped to full speed).
    let sp = springLim(camSm.boom, camSm.boomV, useBoom, dt, CAM_W, CAM_RATE_BOOM, CAM_ACC);
    camSm.boom = sp[0];
    camSm.boomV = sp[1];
    sp = springLim(camSm.eye, camSm.eyeV, useEye, dt, CAM_W, CAM_RATE_EYE, CAM_ACC);
    camSm.eye = sp[0];
    camSm.eyeV = sp[1];
    sp = springLim(camSm.slide, camSm.slideV, useSlide, dt, CAM_W, CAM_RATE_SLIDE, CAM_ACC);
    camSm.slide = sp[0];
    camSm.slideV = sp[1];
  }
  eyeBuf[0] = state.x - fwdBuf[0] * camSm.boom + rightBuf[0] * camSm.slide;
  eyeBuf[2] = state.z - fwdBuf[2] * camSm.boom + rightBuf[2] * camSm.slide;
  const rawG = useRelief ? terrain.heightAt(eyeBuf[0], eyeBuf[2]) : 0;
  if (snapPose) camSm.ground = rawG;
  else if (dt > 0) camSm.ground = chase(camSm.ground, rawG, dt, 0.28);
  eyeBuf[1] = camSm.eye + camSm.ground;
  const rawFeet = feetY();
  if (snapPose) camSm.feet = rawFeet;
  else if (dt > 0) camSm.feet = chase(camSm.feet, rawFeet, dt, 0.22);
  camSm.ready = true;
  let backX = state.x - eyeBuf[0];
  let backZ = state.z - eyeBuf[2];
  let backL = Math.hypot(backX, backZ);
  if (backL < MIN_BOOM && backL > 1e-4) {
    eyeBuf[0] = state.x - backX / backL * MIN_BOOM;
    eyeBuf[2] = state.z - backZ / backL * MIN_BOOM;
    backL = MIN_BOOM;
  }
  ruinBoom(dt, snapPose);
  camBoom = Math.hypot(state.x - eyeBuf[0], state.z - eyeBuf[2]);
  pitchView(eyeBuf, camSm.feet);
}

// Shorten the chase line smoothly where a ruin face would cut it (arch pier, hull wall).
// Look-ahead on Bolt's own collided path starts the ease before the face arrives.
// When the line straight back is walled in, the whole rig swings round Bolt to the side
// with room (eased, speed-capped), so the eye never sits inside stone or hull.
// Longest boom along v whose line clears every face and whose eye keeps RUIN_EYE_CLEAR
// (the near plane is 0.35 m). Below RUIN_MIN_LEN it only goes on to RUIN_HARD_MIN when the eye
// would otherwise touch a face. A floored eye that still touches scores negative so a swing
// to a roomier side wins.
function ruinAllow(px, hy, pz, vx, vy, vz, full) {
  const f = ruinLayer.segFree(px, hy, pz, px + vx, hy + vy, pz + vz, RUIN_LINE_EPS);
  let len = f < 1 ? Math.max(0, f * full - RUIN_EYE_GAP) : full;
  const floor = Math.min(RUIN_MIN_LEN, full);
  const hard = Math.min(RUIN_HARD_MIN, full);
  let clr = 99;
  for (;;) {
    const k = Math.max(len, hard) / full;
    clr = ruinLayer.clearance(px + vx * k, hy + vy * k, pz + vz * k);
    if (clr >= RUIN_EYE_CLEAR) break;
    if (len <= hard) break;
    if (len <= floor && clr >= RUIN_EYE_CLEAR * 0.5) break;
    len -= 0.1;
  }
  if (clr < RUIN_EYE_CLEAR) return Math.max(len, hard) - (RUIN_EYE_CLEAR - clr) * 8;
  return len;
}

function rotXZ(x, z, deg) {
  const a = deg * Math.PI / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c + z * s, z * c - x * s];
}

function ruinBoom(dt, snap) {
  const hy = camSm.feet + RUIN_HEAD;
  const vx0 = eyeBuf[0] - state.x;
  const vyFull = eyeBuf[1] - hy;
  const vz0 = eyeBuf[2] - state.z;
  const full0 = Math.hypot(vx0, vyFull, vz0);
  if (!(full0 > 1e-4)) return;
  const fresh = !ruinCam.ready || snap;
  const near = !!ruinLayer && ruinLayer.near(state.x, state.z, full0 + 6);
  // Rise: share of the chase eye's height over Bolt's head that the line keeps. Under a lintel
  // or a hull deck a lower, flatter line has room where the high one hits the ceiling.
  let vy = vyFull * ruinCam.rise;
  let full = Math.hypot(vx0, vy, vz0);
  // Swing goal: straight back unless it is walled in; then the side with the most room.
  let goal = 0;
  if (near) {
    const comfy = Math.min(full, MIN_BOOM + 0.1);
    const score = (deg) => {
      const r = rotXZ(vx0, vz0, deg);
      return Math.min(ruinAllow(state.x, hy, state.z, r[0], vy, r[1], full), comfy) - Math.abs(deg) / 400;
    };
    const s0 = score(0);
    if (s0 < comfy - 1e-3) {
      let best = 0;
      let bestS = s0;
      for (let i = 1; i < RUIN_SWING.length; i++) {
        const v = score(RUIN_SWING[i]);
        if (v > bestS) {
          bestS = v;
          best = RUIN_SWING[i];
        }
      }
      const keep = fresh ? -1e9 : score(ruinCam.goal);
      goal = bestS > keep + 0.3 ? best : ruinCam.goal;
    }
  }
  // Turning on the spot near a ruin: the rig may only swing the way Bolt turns (or hold), so the
  // view never swings back against the turn (owner rule: zero jitter in the hangar turn).
  const spin = near && !fresh && Math.abs(state.spd) < 0.3 && state.turn ? Math.sign(state.turn) : 0;
  if (spin) {
    if (spin * (goal - ruinCam.yaw) < 0 && goal !== ruinCam.goal) {
      let best = ruinCam.goal;
      if (spin * (best - ruinCam.yaw) < 0) best = ruinCam.yaw;
      goal = best;
    }
    if (spin * ruinCam.yawV < 0) ruinCam.yawV = 0;
  }
  if (fresh) {
    ruinCam.yaw = goal;
    ruinCam.yawV = 0;
  } else if (dt > 0) {
    const sw = springLim(ruinCam.yaw, ruinCam.yawV, goal, dt, RUIN_SWING_W, RUIN_SWING_RATE, RUIN_SWING_ACC);
    ruinCam.yaw = sw[0];
    ruinCam.yawV = sw[1];
    if (spin && spin * ruinCam.yawV < 0) ruinCam.yawV = 0;
  }
  ruinCam.goal = goal;
  if (Math.abs(ruinCam.yaw) < 0.05 && Math.abs(ruinCam.yawV) < 0.5 && goal === 0) {
    ruinCam.yaw = 0;
    ruinCam.yawV = 0;
  }
  const r = rotXZ(vx0, vz0, ruinCam.yaw);
  const vx = r[0];
  const vz = r[1];
  let riseGoal = 1;
  if (near) {
    const comfy = Math.min(full0, MIN_BOOM + 0.1);
    const scoreRise = (k) => {
      const y = vyFull * k;
      const f = Math.hypot(vx0, y, vz0);
      return Math.min(ruinAllow(state.x, hy, state.z, vx, y, vz, f), comfy) + k * 0.4;
    };
    let best = 1;
    let bestS = scoreRise(1);
    if (bestS < comfy + 0.4 - 1e-3) {
      for (const k of RUIN_RISES) {
        const v = scoreRise(k);
        if (v > bestS) {
          bestS = v;
          best = k;
        }
      }
    }
    const keep = fresh ? -1e9 : scoreRise(ruinCam.riseGoal);
    riseGoal = bestS > keep + 0.25 ? best : ruinCam.riseGoal;
  }
  ruinCam.riseGoal = riseGoal;
  if (fresh) {
    ruinCam.rise = riseGoal;
    ruinCam.riseV = 0;
  } else if (dt > 0) {
    const sr = springLim(ruinCam.rise, ruinCam.riseV, riseGoal, dt, RUIN_RISE_W, RUIN_RISE_V, RUIN_RISE_ACC);
    ruinCam.rise = Math.max(0, Math.min(1, sr[0]));
    ruinCam.riseV = sr[1];
  }
  if (!near && Math.abs(ruinCam.rise - 1) < 1e-3) {
    ruinCam.rise = 1;
    ruinCam.riseV = 0;
  }
  vy = vyFull * ruinCam.rise;
  full = Math.hypot(vx0, vy, vz0);
  let allow = full;
  let now = full;
  if (near) {
    // Look far enough ahead that the speed-capped ease finishes before the face arrives.
    const ahead = [0, 0.3, 0.6, 1.0, 1.4];
    for (let i = 0; i < ahead.length; i++) {
      let ax = state.x;
      let az = state.z;
      if (ahead[i] > 0 && state.spd > 0) {
        const yaw = state.hdg * Math.PI / 180;
        const p = ruinLayer.collide(state.x, state.z, state.x + Math.sin(yaw) * state.spd * ahead[i], state.z + Math.cos(yaw) * state.spd * ahead[i], RUIN_BODY_R);
        ax = p.x;
        az = p.z;
      }
      const a = ruinAllow(ax, hy, az, vx, vy, vz, full);
      if (i === 0) now = a;
      allow = Math.min(allow, a);
    }
  }
  const target = Math.max(Math.min(RUIN_HARD_MIN, full), allow);
  if (fresh) {
    ruinCam.len = target;
    ruinCam.lenV = 0;
  } else if (dt > 0) {
    const shrink = target < ruinCam.len;
    // If the eye is already about to touch a face (a turn swept it in), shrink twice as fast,
    // still with a capped acceleration so the eye does not kick.
    const urgent = shrink && ruinCam.len > Math.max(Math.min(RUIN_HARD_MIN, full), now) + 0.25;
    const sp = springLim(
      ruinCam.len, ruinCam.lenV, target, dt,
      shrink ? RUIN_LEN_W_IN : RUIN_LEN_W_OUT,
      shrink ? RUIN_IN_RATE * (urgent ? 2 : 1) : RUIN_OUT_RATE,
      urgent ? RUIN_LEN_ACC_URGENT : RUIN_LEN_ACC,
    );
    ruinCam.len = sp[0];
    ruinCam.lenV = sp[1];
  }
  ruinCam.ready = true;
  if (ruinCam.len > full - 1e-3) {
    // On the free chase the spring rides the free boom, velocity included, so a later ease-in
    // starts from the boom's own motion instead of from rest.
    ruinCam.lenV = dt > 0 && ruinCam.full > 0 ? Math.max(-8, Math.min(8, (full - ruinCam.full) / dt)) : 0;
    ruinCam.len = full;
  }
  ruinCam.full = full;
  ruinCam.clamped = ruinCam.len < full - 0.01 || ruinCam.rise < 0.99;
  const k = ruinCam.len / full;
  eyeBuf[0] = state.x + vx * k;
  eyeBuf[1] = hy + vy * k;
  eyeBuf[2] = state.z + vz * k;
  let turn = ruinCam.yaw;
  // Eye follower (ruins only). Off the ruins the eye is the chase eye, unchanged.
  // Near a ruin the eye is a small sphere that cannot enter a face: it moves from where it was
  // toward the chase eye in short substeps and slides along any face it meets (RUIN_EYE_SAFE from
  // it, so the 0.35 m near plane never opens stone or hull). A chase eye that jumps further than
  // RUIN_EYE_JUMP in one frame keeps the excess as an offset that a capped spring takes back, so a
  // re-solved pose glides instead of popping. In free space the offset is zero and the eye is rigid.
  const dsx = eyeBuf[0];
  const dsy = eyeBuf[1];
  const dsz = eyeBuf[2];
  const live = near && ruinCam.eyeLive && !fresh && dt > 0;
  if (!live) {
    ruinCam.off[0] = ruinCam.off[1] = ruinCam.off[2] = 0;
    ruinCam.offV[0] = ruinCam.offV[1] = ruinCam.offV[2] = 0;
  } else {
    const jx = dsx - ruinCam.want[0];
    const jy = dsy - ruinCam.want[1];
    const jz = dsz - ruinCam.want[2];
    const jl = Math.hypot(jx, jy, jz);
    if (jl > RUIN_EYE_JUMP) {
      const ex = 1 - RUIN_EYE_JUMP / jl;
      ruinCam.off[0] -= jx * ex;
      ruinCam.off[1] -= jy * ex;
      ruinCam.off[2] -= jz * ex;
    }
    for (let i = 0; i < 3; i++) {
      const sp = springLim(ruinCam.off[i], ruinCam.offV[i], 0, dt, RUIN_OFF_W, RUIN_OFF_V, RUIN_OFF_ACC);
      ruinCam.off[i] = sp[0];
      ruinCam.offV[i] = sp[1];
    }
    let px = ruinCam.eye[0];
    let py = ruinCam.eye[1];
    let pz = ruinCam.eye[2];
    const tx = dsx + ruinCam.off[0];
    const ty = dsy + ruinCam.off[1];
    const tz = dsz + ruinCam.off[2];
    const L = Math.hypot(tx - px, ty - py, tz - pz);
    const n = Math.max(1, Math.ceil(L / RUIN_EYE_SUB));
    let gx = 0;
    let gy = 0;
    let gz = 0;
    for (let i = 1; i <= n; i++) {
      // Aim each substep at the remaining target so a slide keeps heading for it.
      const rem = n - i + 1;
      px += (tx - px) / rem;
      py += (ty - py) / rem;
      pz += (tz - pz) / rem;
      // Hard core inside the substeps: never closer than RUIN_EYE_SAFE to a face.
      const c = ruinLayer.clearance(px, py, pz);
      if (c < RUIN_EYE_SAFE) {
        const g = ruinLayer.clearGrad(px, py, pz);
        if (g) {
          px += g[0] * (RUIN_EYE_SAFE - c);
          py += g[1] * (RUIN_EYE_SAFE - c);
          pz += g[2] * (RUIN_EYE_SAFE - c);
          gx = g[0];
          gy = g[1];
          gz = g[2];
        }
      }
    }
    {
      // Soft band once per frame (C1 in the clearance): the eye eases off a face it nears
      // instead of hitting the hard core, so the slide has no kink.
      const c = ruinLayer.clearance(px, py, pz);
      const s1 = RUIN_EYE_SAFE + RUIN_EYE_SOFT;
      if (c < s1) {
        const g = ruinLayer.clearGrad(px, py, pz);
        if (g) {
          const k = ((s1 - c) * (s1 - c)) / (4 * RUIN_EYE_SOFT);
          px += g[0] * k;
          py += g[1] * k;
          pz += g[2] * k;
          gx = g[0];
          gy = g[1];
          gz = g[2];
        }
      }
    }
    const floorY = (useRelief ? terrain.heightAt(px, pz) : 0) + RUIN_EYE_FLOOR;
    if (py < floorY) py = floorY;
    // What the faces took off the target stays in the offset (no velocity kept into the face).
    const nox = px - dsx;
    const noy = py - dsy;
    const noz = pz - dsz;
    if (gx || gy || gz) {
      // Touching a face: drop the offset velocity that points into it (inelastic), keep the slide.
      const vin = ruinCam.offV[0] * gx + ruinCam.offV[1] * gy + ruinCam.offV[2] * gz;
      if (vin < 0) {
        ruinCam.offV[0] -= vin * gx;
        ruinCam.offV[1] -= vin * gy;
        ruinCam.offV[2] -= vin * gz;
      }
    }
    ruinCam.off[0] = nox;
    ruinCam.off[1] = noy;
    ruinCam.off[2] = noz;
    eyeBuf[0] = px;
    eyeBuf[1] = py;
    eyeBuf[2] = pz;
  }
  // The follower's own result is its state for the next frame (before the smoothing below).
  const fx = eyeBuf[0];
  const fy = eyeBuf[1];
  const fz = eyeBuf[2];
  if (fresh || !(dt > 0) || !ruinCam.fReady) {
    for (let i = 0; i < 3; i++) {
      ruinCam.fe[i] = eyeBuf[i];
      ruinCam.fv[i] = 0;
      ruinCam.tp[i] = eyeBuf[i];
    }
    ruinCam.fReady = true;
    ruinCam.fLag = false;
  } else {
    const fe = ruinCam.fe;
    const fv = ruinCam.fv;
    const tv = [(fx - ruinCam.tp[0]) / dt, (fy - ruinCam.tp[1]) / dt, (fz - ruinCam.tp[2]) / dt];
    if (near) ruinCam.fLag = true;
    else if (Math.hypot(fx - fe[0], fy - fe[1], fz - fe[2]) < 1e-3 && Math.hypot(tv[0] - fv[0], tv[1] - fv[1], tv[2] - fv[2]) < 0.05) ruinCam.fLag = false;
    if (ruinCam.fLag) {
      const w = RUIN_EYE_W;
      let ax = w * w * (fx - fe[0]) + 2 * w * (tv[0] - fv[0]);
      let ay = w * w * (fy - fe[1]) + 2 * w * (tv[1] - fv[1]);
      let az = w * w * (fz - fe[2]) + 2 * w * (tv[2] - fv[2]);
      const an = Math.hypot(ax, ay, az);
      if (an > RUIN_EYE_ACC) {
        const k = RUIN_EYE_ACC / an;
        ax *= k;
        ay *= k;
        az *= k;
      }
      fv[0] += ax * dt;
      fv[1] += ay * dt;
      fv[2] += az * dt;
      fe[0] += fv[0] * dt;
      fe[1] += fv[1] * dt;
      fe[2] += fv[2] * dt;
      // Safety only (the follower already keeps RUIN_EYE_SAFE): the near plane never opens a face.
      if (ruinLayer) {
        const c = ruinLayer.clearance(fe[0], fe[1], fe[2]);
        if (c < RUIN_EYE_HARD) {
          const g = ruinLayer.clearGrad(fe[0], fe[1], fe[2]);
          if (g) {
            for (let i = 0; i < 3; i++) fe[i] += g[i] * (RUIN_EYE_HARD - c);
            const vin = fv[0] * g[0] + fv[1] * g[1] + fv[2] * g[2];
            if (vin < 0) for (let i = 0; i < 3; i++) fv[i] -= vin * g[i];
          }
        }
      }
      const floorY = (useRelief ? terrain.heightAt(fe[0], fe[2]) : 0) + RUIN_EYE_FLOOR;
      if (fe[1] < floorY) {
        fe[1] = floorY;
        if (fv[1] < 0) fv[1] = 0;
      }
    } else {
      fe[0] = fx;
      fe[1] = fy;
      fe[2] = fz;
      fv[0] = tv[0];
      fv[1] = tv[1];
      fv[2] = tv[2];
    }
    ruinCam.tp[0] = fx;
    ruinCam.tp[1] = fy;
    ruinCam.tp[2] = fz;
    eyeBuf[0] = fe[0];
    eyeBuf[1] = fe[1];
    eyeBuf[2] = fe[2];
  }
  {
    // Keep looking at Bolt: turn the rig by the angle the follower and the smoothing moved the
    // eye round him.
    const hx0 = dsx - state.x;
    const hz0 = dsz - state.z;
    const hx1 = eyeBuf[0] - state.x;
    const hz1 = eyeBuf[2] - state.z;
    const l0 = Math.hypot(hx0, hz0);
    const l1 = Math.hypot(hx1, hz1);
    if (l0 > 1e-4 && l1 > 1e-4) {
      const c = (hx0 * hx1 + hz0 * hz1) / (l0 * l1);
      const sn = (hz0 * hx1 - hx0 * hz1) / (l0 * l1);
      turn += Math.atan2(sn, c) * 180 / Math.PI;
    }
  }
  if (SHOW_HUD) ruinCam.dbg = { chase: [vx0 + state.x, vyFull + hy, vz0 + state.z], want: [dsx, dsy, dsz], len: ruinCam.len, full, yaw: ruinCam.yaw, goal: ruinCam.goal, rise: ruinCam.rise, off: ruinCam.off.slice(), near, live, foll: [fx, fy, fz], fLag: ruinCam.fLag };
  ruinCam.eyeLive = near;
  ruinCam.want[0] = dsx;
  ruinCam.want[1] = dsy;
  ruinCam.want[2] = dsz;
  ruinCam.eye[0] = fx;
  ruinCam.eye[1] = fy;
  ruinCam.eye[2] = fz;
  if (turn !== 0) {
    const f = rotXZ(fwdBuf[0], fwdBuf[2], turn);
    fwdBuf[0] = f[0];
    fwdBuf[2] = f[1];
    const rr = rotXZ(rightBuf[0], rightBuf[2], turn);
    rightBuf[0] = rr[0];
    rightBuf[2] = rr[1];
  }
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
  camSm.ready = false;
  camYaw.ready = false;
  camHold.live = false;
  ruinCam.ready = false;
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
  camSm.ready = false;
  camYaw.ready = false;
  camHold.live = false;
  ruinCam.ready = false;
}
function look(headingDeg) {
  state.hdg = wrap360(headingDeg);
  state.spd = 0;
  state.mode = "IDLE";
  camSm.ready = false;
  camHold.live = false;
  ruinCam.ready = false;
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

// Vertical slice joints: neighbours overlap and crossfade. A slice may widen only until its horizontal
// magnification reaches the band's own current limit (the larger of its width and height mag), so the
// band mag never rises. Overlap is at most SKY_SEAM_MAX of a slice spacing.
const SKY_SEAM_MAX = 0.25;
const seamCache = [];
function seamOverlap(srcW, srcH, azDeg, el0, el1) {
  for (let i = 0; i < seamCache.length; i++) {
    const c = seamCache[i];
    if (c.srcW === srcW && c.srcH === srcH && c.azDeg === azDeg && c.el0 === el0 && c.el1 === el1) return c;
  }
  const pxH = W / (HFOV * 180 / Math.PI);
  const pxV = H / (VFOV * 180 / Math.PI);
  const span = Math.max(0.01, (el1 - el0) * 180 / Math.PI);
  const cos0 = Math.cos(el0);
  const magW = pxH * cos0 * azDeg / srcW;
  const magH = pxV * span / srcH;
  const limit = Math.max(magW, magH);
  const headroom = Math.max(1, limit / Math.max(1e-6, magW));
  const o0 = Math.min(SKY_SEAM_MAX, headroom - 1);
  const c = { srcW, srcH, azDeg, el0, el1, headroom, cos0, magW: magW * (1 + o0), magH };
  if (seamCache.length > 8) seamCache.length = 0;
  seamCache.push(c);
  return c;
}

function drawSky(mode, eye) {
  if (mode === 1 || !skyVao || !zenithTex || !skyTex) return;
  const yaw = state.hdg * Math.PI / 180;
  gl.useProgram(surfProg);
  gl.bindVertexArray(skyVao);
  gl.uniformMatrix4fv(surfLoc.vp, false, vpM);
  gl.uniform3f(surfLoc.eye, eye[0], eye[1], eye[2]);
  gl.uniform1f(surfLoc.follow, 1);
  gl.uniform1f(surfLoc.eyeBase, EYE);
  gl.uniform1i(surfLoc.mode, 0);
  gl.uniform3f(surfLoc.id, 0, 0, 0);
  gl.uniform1f(surfLoc.elH0, skyBand.h0);
  gl.uniform1f(surfLoc.elH1, skyBand.h1);
  gl.uniform1f(surfLoc.elU0, skyBand.u0);
  gl.uniform1f(surfLoc.elU1, skyBand.u1);
  gl.uniform1f(surfLoc.elK0, skyBand.k0);
  gl.uniform1f(surfLoc.elK1, skyBand.k1);
  gl.uniform1f(surfLoc.capEl, skyBand.cap);
  gl.uniform1f(surfLoc.layers, skyLayers);
  gl.uniform1f(surfLoc.upperLayers, skyUpper ? skyUpper.layers : 1);
  gl.uniform1f(surfLoc.highLayers, skyHigh ? skyHigh.layers : 1);
  gl.uniform1f(surfLoc.hasUpper, skyUpper ? 1 : 0);
  gl.uniform1f(surfLoc.hasHigh, skyHigh ? 1 : 0);
  gl.uniform1f(surfLoc.azBias, yaw * 0.006);
  const ovH = skyTex ? seamOverlap(skyTex.w, skyTex.h, skyBand.hAz || 45, skyBand.h0, skyBand.h1) : null;
  const ovU = skyUpper ? seamOverlap(skyUpper.w, skyUpper.h, skyBand.uAz || 45, skyBand.u0, skyBand.u1) : null;
  const ovK = skyHigh ? seamOverlap(skyHigh.w, skyHigh.h, skyBand.kAz || 45, skyBand.k0, skyBand.k1) : null;
  gl.uniform3f(surfLoc.ovH, ovH ? SKY_SEAM_MAX : 0, ovH ? ovH.headroom : 1, ovH ? ovH.cos0 : 1);
  gl.uniform3f(surfLoc.ovU, ovU ? SKY_SEAM_MAX : 0, ovU ? ovU.headroom : 1, ovU ? ovU.cos0 : 1);
  gl.uniform3f(surfLoc.ovK, ovK ? SKY_SEAM_MAX : 0, ovK ? ovK.headroom : 1, ovK ? ovK.cos0 : 1);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, skyTex.tex);
  gl.uniform1i(surfLoc.tex, 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, zenithTex);
  gl.uniform1i(surfLoc.zenith, 1);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, skyUpper ? skyUpper.tex : skyTex.tex);
  gl.uniform1i(surfLoc.upper, 2);
  gl.activeTexture(gl.TEXTURE3);
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, skyHigh ? skyHigh.tex : skyTex.tex);
  gl.uniform1i(surfLoc.high, 3);
  gl.activeTexture(gl.TEXTURE0);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.disable(gl.BLEND);
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(true);
  gl.drawArrays(gl.TRIANGLES, 0, skyVao._count);
  drawCalls++;
  drawSkyLayers(eye, yaw);
}

function drawSkyLayers(eye, yaw) {
  if (!skyTileVao) return;
  const bias = [
    yaw * 0.002,
    yaw * 0.02 + (eye[0] + eye[2]) * 0.0004,
    yaw * 0.012,
  ];
  gl.useProgram(skyLayerProg);
  gl.bindVertexArray(skyTileVao);
  gl.uniformMatrix4fv(skyLayerLoc.vp, false, vpM);
  gl.uniform3f(skyLayerLoc.eye, eye[0], eye[1], eye[2]);
  gl.uniform1f(skyLayerLoc.radius, 86);
  gl.uniform1f(skyLayerLoc.time, performance.now() * 0.001);
  gl.uniform1f(skyLayerLoc.scroll, 1.0);
  gl.uniform1i(skyLayerLoc.tex, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(false);
  for (let i = 0; i < 3; i++) {
    let gain = 0;
    if (skyVideos[i] && uploadVideo(skyVideos[i], skyVideoTex[i], SKY_VIDEO_IDS[i])) gain = SKY_GAIN[i];
    if (gain <= 0) continue;
    gl.uniform1f(skyLayerLoc.gain, gain);
    gl.uniform1f(skyLayerLoc.key, SKY_KEY[i]);
    gl.uniform1f(skyLayerLoc.azBias, bias[i]);
    gl.uniform1f(skyLayerLoc.scroll, 1.0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, skyVideoTex[i]);
    if (i === 2 && meteorVao && !meteorShow) continue;
    if (i === 2 && meteorVao) {
      gl.uniform1f(skyLayerLoc.meteor, 1.0);
      gl.uniform2f(skyLayerLoc.metDuty, METEOR.duty, METEOR.fadeSec);
      gl.uniform3f(skyLayerLoc.metWin, METEOR.win[0], METEOR.win[1], METEOR.win[2]);
      gl.bindVertexArray(meteorVao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, meteorCount);
      gl.uniform1f(skyLayerLoc.meteor, 0.0);
      gl.bindVertexArray(skyTileVao);
    } else {
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, skyTileCount);
    }
    drawCalls++;
  }
  gl.depthMask(true);
  gl.disable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
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
  if (rockLayer) {
    const pm = rockLayer.mag(eye, FOCAL);
    if (pm > objectMag) objectMag = pm;
  }
  if (ruinLayer) {
    const rm = ruinLayer.mag(eye, FOCAL);
    lastRuinMag = rm;
    if (rm.m > objectMag) objectMag = rm.m;
  } else lastRuinMag = null;
  nearestM = near;
  const groundD = Math.max(0.4, eye[1] / Math.tan(VFOV / 2));
  const groundMag = useRelief
    ? terrain.mag(eye)
    : (FOCAL * (clearing.zone.ground.tile_m || 0.9)) / (groundD * groundSrc);
  const skyAng = Math.atan(Math.tan(VFOV / 2)) - Math.atan(-Math.tan(0.055));
  const skyScreenH = (skyAng / VFOV) * H;
  const pxH = W / (HFOV * 180 / Math.PI);
  const pxV = H / (VFOV * 180 / Math.PI);
  const bandMag = (srcW, srcH, azDeg, el0, el1) => {
    if (!srcW || !srcH) return 0;
    const ov = seamOverlap(srcW, srcH, azDeg, el0, el1);
    return Math.max(ov.magW, ov.magH);
  };
  skyMagParts.horizon = skyTex ? bandMag(skyTex.w, skyTex.h, skyBand.hAz || 45, skyBand.h0, skyBand.h1) : 0;
  skyMagParts.upper = skyUpper ? bandMag(skyUpper.w, skyUpper.h, skyBand.uAz || 45, skyBand.u0, skyBand.u1) : 0;
  skyMagParts.high = skyHigh ? bandMag(skyHigh.w, skyHigh.h, skyBand.kAz || 45, skyBand.k0, skyBand.k1) : 0;
  if (zenithSrc > 0) {
    const circ = 360 * Math.cos(skyBand.cap);
    const pxPer = (Math.PI * zenithSrc) / Math.max(1, circ);
    skyMagParts.cap = Math.max(pxH, pxV) / pxPer;
  }
  const tileMag = Math.max(pxH * skyTileAzDeg / skyVideoW, pxV * skyTileElDeg / skyVideoH);
  skyMagParts.stars = tileMag;
  skyMagParts.dust = tileMag;
  skyMagParts.nebula = tileMag;
  const skyMagW = skyMagParts.horizon;
  const skyMagH = skyMagParts.horizon;
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
  magNow = Math.max(
    groundMag, skyMagW, skyMagH, boltMag, objectMag, gateMag,
    skyMagParts.upper, skyMagParts.high, skyMagParts.cap,
    skyMagParts.stars, skyMagParts.dust, skyMagParts.nebula,
  );
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
  if (rockLayer) {
    rockLayer.draw(vpM);
    drawCalls += rockLayer.draws;
  }
  if (ruinLayer) {
    ruinLayer.draw(vpM, mode);
    if (mode !== 1) drawCalls += ruinLayer.draws;
  }
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

// opt.draw === false (debug walks only): solve body and camera, skip the GL draw.
function tick(dt, opt) {
  const t0 = performance.now();
  camStepDt = dt > 0 ? dt : 0;
  const fwdIn = Math.abs(state.forward) < 0.04 ? 0 : state.forward;
  if (fwdIn === 0) state.spd = 0;
  else state.spd = state.gallop ? 4.4 : WALK_SPD;
  state.hdg = wrap360(state.hdg + state.turn * 150 * dt);
  state.mode = state.spd > 0.05 ? "GALLOP" : "IDLE";
  const yaw = state.hdg * Math.PI / 180;
  let nx = state.x + Math.sin(yaw) * state.spd * dt;
  let nz = state.z + Math.cos(yaw) * state.spd * dt;
  const ox = state.x;
  const oz = state.z;
  const solved = resolveBody(nx, nz);
  ruinContact = false;
  if (ruinLayer) {
    // Tight colliders from the drawn faces: slide along a wall, walk through an opening.
    const slid = ruinLayer.collide(ox, oz, solved.x, solved.z, RUIN_BODY_R);
    solved.x = slid.x;
    solved.z = slid.z;
    ruinContact = slid.contact;
    const want = Math.hypot(nx - ox, nz - oz);
    const got = Math.hypot(slid.x - ox, slid.z - oz);
    const prog = want > 1e-5 ? got / want : 1;
    // Only a head-on push stalls the gallop (with hysteresis, so the clip cannot flicker).
    if (slid.contact && want > 1e-5 && prog < 0.12) ruinStall++;
    else if (!slid.contact || prog > 0.3) ruinStall = 0;
    if (ruinStall >= 3) solved.blocked = true;
  }
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
  // Motion, the camera and magnification still run without the GL draw.
  if (opt && opt.draw === false) {
    solveCamera();
    measureMag(eyeBuf);
  } else render(0);
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
    ruinContact,
    ruinCamClamped: ruinCam.clamped,
    ruinCamSwing: ruinCam.yaw,
    boom: camBoom,
    feetY: feetY(),
    pathTrigger: state.pathTrigger,
    eyeX: eyeBuf[0],
    eyeY: eyeBuf[1],
    eyeZ: eyeBuf[2],
    pitch: camPitch * 180 / Math.PI,
    mag: magNow,
    ground: groundMagNow,
    ruinMag: lastRuinMag,
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
      backdrop: skyMagParts.horizon,
      skySlice: skyMagParts.horizon,
      skyUpper: skyMagParts.upper,
      skyHigh: skyMagParts.high,
      skyCap: skyMagParts.cap,
      skyStars: skyMagParts.stars,
      skyDust: skyMagParts.dust,
      skyNebula: skyMagParts.nebula,
    },
    state: state.mode,
    heroCount,
    heroPixels,
    camRight: [camRightNow[0], camRightNow[1], camRightNow[2]],
    boom: camBoom,
    eye: [eyeBuf[0], eyeBuf[1], eyeBuf[2]],
    pitch: camPitch * 180 / Math.PI,
    acceptance: heroPixels > 0 && magNow <= 1.001,
    firstFrameMs,
    blocked: state.blocked,
    rockLoadMs,
    rocks: rockLayer ? rockLayer.info() : null,
    ruinLoadMs,
    ruins: ruinLayer ? ruinLayer.info() : null,
    pathTrigger: state.pathTrigger,
    gate: gateInfo(),
    nearestVisibleM: nearestM,
    canvas: { width: W, height: H },
    backdrop: {
      sourceW: skySrcW,
      sourceH: skySrcH,
      screenW: 720,
      screenH: Math.round(pxBandScreen()),
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
  if (!SHOW_HUD) {
    if (hud.textContent) hud.textContent = "";
    return;
  }
  const g = gateInfo();
  const mb = (texBytes / (1024 * 1024)).toFixed(1);
  hud.textContent =
    `x ${state.x.toFixed(2)}  z ${state.z.toFixed(2)}  hdg ${state.hdg.toFixed(1)}\n` +
    `mag ${magNow.toFixed(3)}  bolt ${state.mode}\n` +
    `gate ${g.bearing_deg.toFixed(1)}°  ${g.dist_m.toFixed(2)} m\n` +
    `Perf: drawCalls=${drawCalls}, texMB=${mb}, activeVideos=${activeVideoCount()}, jsMs=${lastWork.toFixed(2)}`;
}

function pxBandScreen() {
  const pxV = H / (VFOV * 180 / Math.PI);
  return pxV * (skyBand.h1 - skyBand.h0) * 180 / Math.PI;
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
    const y0 = Math.max(0, Math.floor(img.height * 0.72));
    const y1 = Math.min(img.height, Math.ceil(img.height * 0.9));
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

function deg(rad) { return rad * Math.PI / 180; }

function applySkyDisplay(display) {
  if (!display) return;
  const bands = display.bands || [];
  const find = (id) => bands.find((b) => b.id === id);
  const h = find("horizon");
  const u = find("upper");
  const k = find("high");
  if (h) { skyBand.h0 = deg(h.elBottomDeg); skyBand.h1 = deg(h.elTopDeg); skyBand.hAz = h.azimuthDeg || 45; }
  if (u) { skyBand.u0 = deg(u.elBottomDeg); skyBand.u1 = deg(u.elTopDeg); skyBand.uAz = u.azimuthDeg || 45; }
  if (k) { skyBand.k0 = deg(k.elBottomDeg); skyBand.k1 = deg(k.elTopDeg); skyBand.kAz = k.azimuthDeg || 45; }
  if (display.cap && display.cap.elStartDeg != null) skyBand.cap = deg(display.cap.elStartDeg);
  const tile = (display.videoTiles || [])[0];
  if (tile && tile.azimuthDeg && tile.elevationDeg) {
    skyTileAzDeg = tile.azimuthDeg;
    skyTileElDeg = tile.elevationDeg;
  }
}

let skyTileAzDeg = SKY_TILE_AZ;
let skyTileElDeg = SKY_TILE_EL;
let skyVideoW = 848;
let skyVideoH = 480;
let firstFrameMs = null;
let bootT0 = 0;
let rockLayer = null;
let rockLoadMs = 0;
let ruinLayer = null;
let ruinLoadMs = 0;

async function loadBand(manifest, id) {
  const display = manifest && manifest.display;
  const band = display && (display.bands || []).find((b) => b.id === id);
  const files = band && band.files;
  if (!Array.isArray(files) || !files.length) return null;
  const imgs = [];
  for (let i = 0; i < files.length; i++) {
    imgs.push(await loadImage(absUrl("packs/zone-a/src/sky/" + files[i])));
  }
  return imgs;
}

async function boot() {
  try {
    bootT0 = performance.now();
    hud.textContent = "loading";
    clearing = await (await fetch("/packs/zone-a/clearing.json")).json();
    {
      const g = clearing.zone.ground;
      prefetchImages([...(g.tiles || []), ...(g.depth || []), g.mask, ...(g.details || []), ...((clearing.backdrop && clearing.backdrop.slices) || [])]);
    }
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
    skyManifest = await (await fetch(absUrl("packs/zone-a/src/sky/sky.json"))).json();
    {
      const bands = (skyManifest.display && skyManifest.display.bands) || [];
      const band = (id) => ((bands.find((b) => b.id === id) || {}).files || []).map((f) => "packs/zone-a/src/sky/" + f);
      prefetchImages([...band("upper"), ...band("high"), "packs/zone-a/src/sky-cap/zenith.png", clearing.fog_band && clearing.fog_band.atlas]);
    }
    applySkyDisplay(skyManifest.display);
    const slices = clearing.backdrop.slices || [];
    const skyImgs = [];
    for (const u of slices) skyImgs.push(await loadImage(absUrl(u)));
    skySrcW = 0;
    skySrcH = skyImgs[0] ? skyImgs[0].height : 912;
    for (let i = 0; i < skyImgs.length; i++) skySrcW += skyImgs[i].width;
    const horizonFog = useRelief ? sampleHorizon(skyImgs) : null;
    const horizonFit = skyImgs.map((im) => downscaleWidth(im, 1500));
    skyTex = makeSkyArray(horizonFit, "sky");
    releaseImages(skyImgs);
    const hold = document.createElement("canvas");
    hold.width = 2;
    hold.height = 2;
    zenithTex = makeStill(hold, "sky-zenith");
    buildSky();
    reset();
    render(0);
    if (firstFrameMs == null) firstFrameMs = performance.now() - bootT0;
    try {
      const rockT0 = performance.now();
      rockLayer = await mountRocks(gl, {
        absUrl,
        loadImage,
        trackTex,
        labelOf,
        heightAt: (x, z) => (useRelief ? terrain.heightAt(x, z) : 0),
      });
      rockLoadMs = rockLayer.loadMs || (performance.now() - rockT0);
      for (let i = 0; i < rockLayer.hulls.length; i++) {
        const row = rockLayer.hulls[i];
        hullByPath.set(row.path, row.hull);
        hullList.push(row.hull);
      }
      for (let i = 0; i < rockLayer.objects.length; i++) objects.push(rockLayer.objects[i]);
    } catch (err) {
      console.warn("rocks", err);
      rockLayer = null;
    }
    try {
      const ruinT0 = performance.now();
      ruinLayer = await mountRuins(gl, {
        absUrl,
        loadImage,
        trackTex,
        heightAt: (x, z) => (useRelief ? terrain.heightAt(x, z) : 0),
      });
      ruinLoadMs = ruinLayer.loadMs || (performance.now() - ruinT0);
    } catch (err) {
      console.warn("ruins", err);
      ruinLayer = null;
    }
    const upperImgs = await loadBand(skyManifest, "upper");
    const highImgs = await loadBand(skyManifest, "high");
    if (upperImgs) {
      skyUpper = makeSkyArray(upperImgs.map((im) => downscaleWidth(im, 1380)), "sky-upper");
      releaseImages(upperImgs);
    }
    if (highImgs) {
      skyHigh = makeSkyArray(highImgs.map((im) => downscaleWidth(im, 930)), "sky-high");
      releaseImages(highImgs);
    }
    const zenithImg = await loadImage(absUrl("packs/zone-a/src/sky-cap/zenith.png"));
    zenithSrc = zenithImg.width;
    const prevZ = zenithTex;
    zenithTex = makeStill(zenithImg, "sky-zenith");
    if (prevZ) gl.deleteTexture(prevZ);
    releaseImages([zenithImg]);
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
    if (useRelief && horizonFog) terrain.setFog(horizonFog);
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
      hud.textContent = "loading sky video " + (i + 1) + "/" + skyVideos.length;
      await new Promise((r) => {
        if (v.readyState >= 2) r();
        else {
          v.addEventListener("loadeddata", () => r(), { once: true });
          v.addEventListener("error", () => r(), { once: true });
          setTimeout(r, 20000);
        }
      });
      await v.play().catch(() => {});
    }
    if (skyVideos[0] && skyVideos[0].videoWidth) {
      skyVideoW = skyVideos[0].videoWidth;
      skyVideoH = skyVideos[0].videoHeight;
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
      skyInfo() {
        return skyVideos.map((v) => (v ? { d: v.duration, t: v.currentTime, rs: v.readyState, paused: v.paused } : null));
      },
      meteorTiles() { return meteorInfo.map((m) => ({ ...m })); },
      meteorsOn(on) { meteorShow = !!on; },
      camInfo() { return { pitchDeg: camPitch * 180 / Math.PI, vfovDeg: VFOV * 180 / Math.PI, hfovDeg: HFOV * 180 / Math.PI }; },
      seekSky(i, t) {
        const v = skyVideos[i];
        if (!v || !Number.isFinite(t)) return false;
        v.currentTime = Math.max(0, Math.min(t, (v.duration || t) - 0.001));
        return true;
      },
      setPost(on) { terrain.setPost(on); },
      groundInfo() { return terrain.info(); },
      heightAt(x, z) { return terrain.heightAt(x, z); },
      ruinInfo() { return ruinLayer ? ruinLayer.info() : null; },
      /** Texture budget and draw split (tooling): every tracked texture in bytes, and the draws per layer. */
      texReport() {
        return {
          textures: [...textures.entries()].map(([id, b]) => ({ id, mb: +(b / 1048576).toFixed(2) })).sort((a, b) => b.mb - a.mb),
          draws: { hulls: hullList.length, rocks: rockLayer ? rockLayer.draws : 0, ruins: ruinLayer ? ruinLayer.draws : 0, terrain: useRelief ? 2 : 1, total: drawCalls },
        };
      },
      ruinWhere(x, z) { return ruinLayer ? ruinLayer.where(x == null ? state.x : x, z == null ? state.z : z) : null; },
      ruinProbe() {
        if (!ruinLayer) return {};
        return ruinLayer.probe(eyeBuf, camFwd, camRightNow, camUp, FOCAL, Math.tan(HFOV / 2), Math.tan(VFOV / 2));
      },
      ruinClearance(x, y, z) { return ruinLayer ? ruinLayer.clearance(x, y, z) : 99; },
      camState() {
        return {
          eye: [eyeBuf[0], eyeBuf[1], eyeBuf[2]],
          fwd: [camFwd[0], camFwd[1], camFwd[2]],
          boom: camBoom,
          clamped: ruinCam.clamped,
          swing: ruinCam.yaw,
          boltMag: (FOCAL * BOLT_H) / (Math.max(0.2, camBoom) * BOLT_SRC.h),
          feet: feetY(),
          dbg: ruinCam.dbg,
        };
      },
    };
    render(0);
    paintHud();
    const err = gl.getError();
    if (err && SHOW_HUD) hud.textContent += "\nGL " + err;
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

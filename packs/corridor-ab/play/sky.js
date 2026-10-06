/**
 * Zone A sky, used as the corridor backdrop.
 * Closed dome: horizon, upper, and high slice arrays, zenith cap,
 * then one instanced draw of the stars, dust, and nebula loops.
 * The mesh follows the eye, so every heading and tilt stays inside the dome.
 */

const SKY_SEAM_MAX = 0.25;
const SKY_MAG_CAP = 0.993;
const SKY_GAIN = [0.1, 0.04, 1.5];
const SKY_KEY = [0.12, 0.08, 0.3];
const SKY_TILE_AZ_N = 17;
const SKY_TILE_EL_N = 8;
const METEOR = {
  tiles: 36,
  elLoDeg: 7,
  elHiDeg: 18,
  win: [0.4, 0.16, 0.55],
  duty: 0.32,
  fadeSec: 0.8,
  periodSec: [6, 11],
};

const SURF_VS = `#version 300 es
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
}`;

const SURF_FS = `#version 300 es
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
}`;

const LAYER_VS = `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aTile;
layout(location=2) in vec2 aPhase;
layout(location=3) in vec4 aMeteor;
layout(location=4) in float aLayer;
uniform mat4 uVP;
uniform vec3 uEye;
uniform float uBias0;
uniform float uBias1;
uniform float uBias2;
uniform float uRadius;
uniform float uTime;
uniform float uScroll;
uniform vec2 uMetDuty;
out vec2 vUv;
flat out vec2 vTile;
flat out vec4 vMet;
flat out float vLayer;
void main() {
  float bias = uBias0;
  if (aLayer > 1.5) bias = uBias2;
  else if (aLayer > 0.5) bias = uBias1;
  float az = aTile.x + (aCorner.x - 0.5) * aTile.z + bias;
  float el = aTile.y + (aCorner.y - 0.5) * aTile.w;
  float c = cos(el);
  vec3 p = vec3(sin(az) * c, sin(el), cos(az) * c) * uRadius + uEye;
  gl_Position = uVP * vec4(p, 1.0);
  vLayer = aLayer;
  vTile = aTile.xy;
  if (aLayer > 1.5) {
    float ph = mod(uTime + aMeteor.w, aMeteor.z);
    float on = uMetDuty.x * aMeteor.z;
    float env = smoothstep(0.0, uMetDuty.y, ph) * (1.0 - smoothstep(on - uMetDuty.y, on, ph));
    vUv = aCorner;
    vMet = vec4(aMeteor.xy, env, 1.0);
  } else {
    vec2 drift = vec2(aPhase.x + aPhase.y * uTime, aPhase.y * uTime * 0.15);
    vUv = aCorner + drift * uScroll;
    vMet = vec4(0.0);
  }
}`;

const LAYER_FS = `#version 300 es
precision highp float;
uniform sampler2D uTex0;
uniform sampler2D uTex1;
uniform sampler2D uTex2;
uniform float uGain0;
uniform float uGain1;
uniform float uGain2;
uniform float uKey0;
uniform float uKey1;
uniform float uKey2;
uniform vec3 uMetWin;
in vec2 vUv;
flat in vec2 vTile;
flat in float vLayer;
flat in vec4 vMet;
out vec4 o;
void main() {
  float gain = uGain0;
  float keyU = uKey0;
  vec3 s;
  if (vLayer > 1.5) {
    gain = uGain2;
    keyU = uKey2;
    s = texture(uTex2, fract(vUv)).rgb;
  } else if (vLayer > 0.5) {
    gain = uGain1;
    keyU = uKey1;
    s = texture(uTex1, fract(vUv)).rgb;
  } else {
    s = texture(uTex0, fract(vUv)).rgb;
  }
  if (gain <= 0.0) discard;
  float lum = dot(s, vec3(0.299, 0.587, 0.114));
  float key = smoothstep(keyU, keyU + 0.06, lum);
  if (vMet.w > 0.5) {
    float d = length((vUv - vMet.xy) / uMetWin.xy);
    key *= (1.0 - smoothstep(uMetWin.z, 1.0, d)) * vMet.z;
  }
  o = vec4(s * gain * key, 1.0);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || "sky shader");
  }
  return shader;
}

function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p) || "sky link");
  }
  return p;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(url));
    img.src = url;
  });
}

function rgbBytes(img) {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const rgba = g.getImageData(0, 0, c.width, c.height).data;
  const rgb = new Uint8Array(img.width * img.height * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    rgb[j] = rgba[i];
    rgb[j + 1] = rgba[i + 1];
    rgb[j + 2] = rgba[i + 2];
  }
  return rgb;
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

export async function mountSky(gl, env) {
  const abs = env.absUrl;
  const viewW = env.viewW || 720;
  const viewH = env.viewH || 1600;
  const hfov = env.hfov;
  const vfov = env.vfov;
  let texBytes = 0;
  const track = (bytes) => {
    texBytes += bytes;
    if (env.trackTex) env.trackTex(bytes);
  };
  const manifest = await (await fetch(abs("packs/zone-a/src/sky/sky.json"))).json();
  const bands = (manifest.display && manifest.display.bands) || [];
  const find = (id) => bands.find((b) => b.id === id);
  const deg = (n) => n * Math.PI / 180;
  const horizon = find("horizon");
  const upper = find("upper");
  const high = find("high");
  const skyBand = {
    h0: deg(horizon.elBottomDeg),
    h1: deg(horizon.elTopDeg),
    hAz: horizon.azimuthDeg,
    u0: deg(upper.elBottomDeg),
    u1: deg(upper.elTopDeg),
    uAz: upper.azimuthDeg,
    k0: deg(high.elBottomDeg),
    k1: deg(high.elTopDeg),
    kAz: high.azimuthDeg,
    cap: deg(manifest.display.cap.elStartDeg),
  };
  const seamCache = [];
  function seamOverlap(srcW, srcH, azDeg, el0, el1) {
    for (let i = 0; i < seamCache.length; i++) {
      const c = seamCache[i];
      if (c.srcW === srcW && c.srcH === srcH && c.azDeg === azDeg && c.el0 === el0 && c.el1 === el1) return c;
    }
    const pxH = viewW / (hfov * 180 / Math.PI);
    const pxV = viewH / (vfov * 180 / Math.PI);
    const span = Math.max(0.01, (el1 - el0) * 180 / Math.PI);
    const cos0 = Math.cos(el0);
    const magW = pxH * cos0 * azDeg / srcW;
    const magH = pxV * span / srcH;
    const limit = Math.max(magW, magH);
    const headroom = Math.max(1, limit / Math.max(1e-6, magW));
    const row = { srcW, srcH, azDeg, el0, el1, headroom, cos0, magW: magW * (1 + Math.min(SKY_SEAM_MAX, headroom - 1)), magH };
    if (seamCache.length > 8) seamCache.length = 0;
    seamCache.push(row);
    return row;
  }
  function fitBandMag(images, azDeg, el0, el1) {
    if (!images || !images.length) return images;
    let maxW = 0;
    let maxH = 0;
    for (let i = 0; i < images.length; i++) {
      maxW = Math.max(maxW, images[i].width);
      maxH = Math.max(maxH, images[i].height);
    }
    const ov = seamOverlap(maxW, maxH, azDeg, el0, el1);
    const mag = Math.max(ov.magW, ov.magH);
    if (!(mag > 0) || mag >= SKY_MAG_CAP) return images;
    const scale = mag / SKY_MAG_CAP;
    return images.map((im) => {
      const w = Math.max(1, Math.ceil(im.width * scale));
      const h = Math.max(1, Math.ceil(im.height * scale));
      if (w >= im.width && h >= im.height) return im;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d");
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.drawImage(im, 0, 0, w, h);
      return c;
    });
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
    track(Math.ceil(maxW * maxH * 3 * images.length * 4 / 3));
    return { tex: t, w: maxW, h: maxH, layers: images.length, id };
  }
  async function loadBand(band) {
    const files = band.files === "slices" ? manifest.slices : band.files;
    const imgs = [];
    for (let i = 0; i < files.length; i++) {
      imgs.push(await loadImage(abs("packs/zone-a/src/sky/" + files[i])));
    }
    return imgs;
  }
  const horizonImgs = await loadBand(horizon);
  const skyTex = makeSkyArray(
    fitBandMag(horizonImgs.map((im) => downscaleWidth(im, 1500)), skyBand.hAz, skyBand.h0, skyBand.h1),
    "sky",
  );
  releaseImages(horizonImgs);
  const upperImgs = await loadBand(upper);
  const skyUpper = makeSkyArray(upperImgs.map((im) => downscaleWidth(im, 1380)), "sky-upper");
  releaseImages(upperImgs);
  const highImgs = await loadBand(high);
  const skyHigh = makeSkyArray(
    fitBandMag(highImgs.map((im) => downscaleWidth(im, 930)), skyBand.kAz, skyBand.k0, skyBand.k1),
    "sky-high",
  );
  releaseImages(highImgs);
  const zenithImg = await loadImage(abs("packs/zone-a/src/sky-cap/zenith.png"));
  const zenithTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, zenithTex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  const zenithRgb = rgbBytes(zenithImg);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8, zenithImg.width, zenithImg.height, 0, gl.RGB, gl.UNSIGNED_BYTE, zenithRgb);
  gl.generateMipmap(gl.TEXTURE_2D);
  track(Math.ceil(zenithImg.width * zenithImg.height * 3 * 4 / 3));
  releaseImages([zenithImg]);

  const skyR = 90;
  const el0 = -0.055;
  const el1 = Math.PI / 2;
  const azN = 64;
  const elN = 28;
  const dome = [];
  const push = (az, el) => {
    const c = Math.cos(el);
    dome.push(Math.sin(az) * c * skyR, Math.sin(el) * skyR, Math.cos(az) * c * skyR, 0, 0, 0);
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
  const skyVao = gl.createVertexArray();
  gl.bindVertexArray(skyVao);
  const vbo = gl.createBuffer();
  const domeData = new Float32Array(dome);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, domeData, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 12);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 24, 20);
  gl.bindVertexArray(null);
  const domeCount = dome.length / 6;

  const tileAz = (Math.PI * 2) / SKY_TILE_AZ_N;
  const tileEl = 11.25 * Math.PI / 180;
  const elLo = -2 * Math.PI / 180;
  const tileCount = SKY_TILE_AZ_N * SKY_TILE_EL_N;
  const tileInst = new Float32Array(tileCount * 6);
  let k = 0;
  for (let ie = 0; ie < SKY_TILE_EL_N; ie++) {
    for (let ia = 0; ia < SKY_TILE_AZ_N; ia++) {
      tileInst[k++] = (ia + 0.5) * tileAz;
      tileInst[k++] = elLo + (ie + 0.5) * tileEl;
      tileInst[k++] = tileAz;
      tileInst[k++] = tileEl;
      tileInst[k++] = (ia * 0.37 + ie * 0.53) % 1;
      tileInst[k++] = 0.015 + ((ia * 3 + ie * 5) % 7) * 0.004;
    }
  }
  let mseed = 0x5eed1;
  const rnd = () => {
    mseed = (mseed * 1664525 + 1013904223) >>> 0;
    return mseed / 4294967296;
  };
  const d2r = Math.PI / 180;
  const sepAz = 2 * METEOR.win[0] * tileAz;
  const sepEl = 2 * METEOR.win[1] * tileEl;
  const placed = [];
  for (let tries = 0; placed.length < METEOR.tiles && tries < 20000; tries++) {
    const az = rnd() * Math.PI * 2;
    const el = (METEOR.elLoDeg + rnd() * (METEOR.elHiDeg - METEOR.elLoDeg)) * d2r;
    let ok = true;
    for (let i = 0; i < placed.length; i++) {
      const q = placed[i];
      let da = Math.abs(az - q.az);
      da = Math.min(da, Math.PI * 2 - da);
      if (da < sepAz && Math.abs(el - q.el) < sepEl) { ok = false; break; }
    }
    if (ok) placed.push({ az, el });
  }
  const meteor = [];
  for (let i = 0; i < placed.length; i++) {
    const p = placed[i];
    const cx = 0.42 + rnd() * 0.16;
    const cy = 0.3 + rnd() * 0.4;
    meteor.push(
      p.az - (cx - 0.5) * tileAz,
      p.el - (cy - 0.5) * tileEl,
      tileAz,
      tileEl,
      0,
      0,
      cx,
      cy,
      METEOR.periodSec[0] + rnd() * (METEOR.periodSec[1] - METEOR.periodSec[0]),
      rnd() * 40,
    );
  }
  const layerN = tileCount * 2 + placed.length;
  const layerData = new Float32Array(layerN * 11);
  let o = 0;
  for (let layer = 0; layer < 2; layer++) {
    for (let i = 0; i < tileCount; i++) {
      const s = i * 6;
      layerData[o++] = tileInst[s];
      layerData[o++] = tileInst[s + 1];
      layerData[o++] = tileInst[s + 2];
      layerData[o++] = tileInst[s + 3];
      layerData[o++] = tileInst[s + 4];
      layerData[o++] = tileInst[s + 5];
      layerData[o++] = 0;
      layerData[o++] = 0;
      layerData[o++] = 1;
      layerData[o++] = 0;
      layerData[o++] = layer;
    }
  }
  for (let i = 0; i < placed.length; i++) {
    const s = i * 10;
    for (let j = 0; j < 10; j++) layerData[o++] = meteor[s + j];
    layerData[o++] = 2;
  }
  const corners = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
  const layerVao = gl.createVertexArray();
  gl.bindVertexArray(layerVao);
  const cbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cbuf);
  gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  const ibuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, ibuf);
  gl.bufferData(gl.ARRAY_BUFFER, layerData, gl.STATIC_DRAW);
  const stride = 44;
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 0);
  gl.vertexAttribDivisor(1, 1);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 16);
  gl.vertexAttribDivisor(2, 1);
  gl.enableVertexAttribArray(3);
  gl.vertexAttribPointer(3, 4, gl.FLOAT, false, stride, 24);
  gl.vertexAttribDivisor(3, 1);
  gl.enableVertexAttribArray(4);
  gl.vertexAttribPointer(4, 1, gl.FLOAT, false, stride, 40);
  gl.vertexAttribDivisor(4, 1);
  gl.bindVertexArray(null);

  const surf = program(gl, SURF_VS, SURF_FS);
  const layerProg = program(gl, LAYER_VS, LAYER_FS);
  const surfLoc = {
    vp: gl.getUniformLocation(surf, "uVP"),
    eye: gl.getUniformLocation(surf, "uEye"),
    follow: gl.getUniformLocation(surf, "uFollow"),
    eyeBase: gl.getUniformLocation(surf, "uEyeBase"),
    tex: gl.getUniformLocation(surf, "uTex"),
    zenith: gl.getUniformLocation(surf, "uZenith"),
    upper: gl.getUniformLocation(surf, "uUpper"),
    high: gl.getUniformLocation(surf, "uHigh"),
    mode: gl.getUniformLocation(surf, "uMode"),
    id: gl.getUniformLocation(surf, "uId"),
    elH0: gl.getUniformLocation(surf, "uElH0"),
    elH1: gl.getUniformLocation(surf, "uElH1"),
    elU0: gl.getUniformLocation(surf, "uElU0"),
    elU1: gl.getUniformLocation(surf, "uElU1"),
    elK0: gl.getUniformLocation(surf, "uElK0"),
    elK1: gl.getUniformLocation(surf, "uElK1"),
    capEl: gl.getUniformLocation(surf, "uCapEl"),
    layers: gl.getUniformLocation(surf, "uLayers"),
    upperLayers: gl.getUniformLocation(surf, "uUpperLayers"),
    highLayers: gl.getUniformLocation(surf, "uHighLayers"),
    hasUpper: gl.getUniformLocation(surf, "uHasUpper"),
    hasHigh: gl.getUniformLocation(surf, "uHasHigh"),
    azBias: gl.getUniformLocation(surf, "uAzBias"),
    ovH: gl.getUniformLocation(surf, "uOvH"),
    ovU: gl.getUniformLocation(surf, "uOvU"),
    ovK: gl.getUniformLocation(surf, "uOvK"),
  };
  const layerLoc = {
    vp: gl.getUniformLocation(layerProg, "uVP"),
    eye: gl.getUniformLocation(layerProg, "uEye"),
    bias0: gl.getUniformLocation(layerProg, "uBias0"),
    bias1: gl.getUniformLocation(layerProg, "uBias1"),
    bias2: gl.getUniformLocation(layerProg, "uBias2"),
    radius: gl.getUniformLocation(layerProg, "uRadius"),
    time: gl.getUniformLocation(layerProg, "uTime"),
    scroll: gl.getUniformLocation(layerProg, "uScroll"),
    gain0: gl.getUniformLocation(layerProg, "uGain0"),
    gain1: gl.getUniformLocation(layerProg, "uGain1"),
    gain2: gl.getUniformLocation(layerProg, "uGain2"),
    key0: gl.getUniformLocation(layerProg, "uKey0"),
    key1: gl.getUniformLocation(layerProg, "uKey1"),
    key2: gl.getUniformLocation(layerProg, "uKey2"),
    metDuty: gl.getUniformLocation(layerProg, "uMetDuty"),
    metWin: gl.getUniformLocation(layerProg, "uMetWin"),
    tex0: gl.getUniformLocation(layerProg, "uTex0"),
    tex1: gl.getUniformLocation(layerProg, "uTex1"),
    tex2: gl.getUniformLocation(layerProg, "uTex2"),
  };

  const videos = [];
  const videoTex = [];
  const stamps = new Map();
  const loops = (manifest.layers || []).map((row) => "packs/zone-a/src/sky/" + row.file);
  for (let i = 0; i < loops.length; i++) {
    const v = document.createElement("video");
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = abs(loops[i]);
    videos.push(v);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    videoTex.push(tex);
    v.play().catch(() => {});
  }

  function uploadVideo(v, tex, id) {
    if (!v || v.readyState < 2) return stamps.has(id);
    const stamp = v.currentTime;
    if (stamps.get(id) === stamp) return true;
    if (v.paused && stamps.has(id)) return true;
    stamps.set(id, stamp);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
    return true;
  }

  function draw(vp, eye, yaw) {
    let draws = 0;
    gl.useProgram(surf);
    gl.bindVertexArray(skyVao);
    gl.uniformMatrix4fv(surfLoc.vp, false, vp);
    gl.uniform3f(surfLoc.eye, eye[0], eye[1], eye[2]);
    gl.uniform1f(surfLoc.follow, 1);
    gl.uniform1f(surfLoc.eyeBase, eye[1]);
    gl.uniform1i(surfLoc.mode, 0);
    gl.uniform3f(surfLoc.id, 0, 0, 0);
    gl.uniform1f(surfLoc.elH0, skyBand.h0);
    gl.uniform1f(surfLoc.elH1, skyBand.h1);
    gl.uniform1f(surfLoc.elU0, skyBand.u0);
    gl.uniform1f(surfLoc.elU1, skyBand.u1);
    gl.uniform1f(surfLoc.elK0, skyBand.k0);
    gl.uniform1f(surfLoc.elK1, skyBand.k1);
    gl.uniform1f(surfLoc.capEl, skyBand.cap);
    gl.uniform1f(surfLoc.layers, skyTex.layers);
    gl.uniform1f(surfLoc.upperLayers, skyUpper.layers);
    gl.uniform1f(surfLoc.highLayers, skyHigh.layers);
    gl.uniform1f(surfLoc.hasUpper, 1);
    gl.uniform1f(surfLoc.hasHigh, 1);
    gl.uniform1f(surfLoc.azBias, yaw * 0.006);
    const ovH = seamOverlap(skyTex.w, skyTex.h, skyBand.hAz, skyBand.h0, skyBand.h1);
    const ovU = seamOverlap(skyUpper.w, skyUpper.h, skyBand.uAz, skyBand.u0, skyBand.u1);
    const ovK = seamOverlap(skyHigh.w, skyHigh.h, skyBand.kAz, skyBand.k0, skyBand.k1);
    gl.uniform3f(surfLoc.ovH, SKY_SEAM_MAX, ovH.headroom, ovH.cos0);
    gl.uniform3f(surfLoc.ovU, SKY_SEAM_MAX, ovU.headroom, ovU.cos0);
    gl.uniform3f(surfLoc.ovK, SKY_SEAM_MAX, ovK.headroom, ovK.cos0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, skyTex.tex);
    gl.uniform1i(surfLoc.tex, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, zenithTex);
    gl.uniform1i(surfLoc.zenith, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, skyUpper.tex);
    gl.uniform1i(surfLoc.upper, 2);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, skyHigh.tex);
    gl.uniform1i(surfLoc.high, 3);
    gl.activeTexture(gl.TEXTURE0);
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.drawArrays(gl.TRIANGLES, 0, domeCount);
    draws += 1;

    const gain = [0, 0, 0];
    for (let i = 0; i < videos.length; i++) {
      if (videos[i].paused && videos[i].readyState >= 2) videos[i].play().catch(() => {});
      if (uploadVideo(videos[i], videoTex[i], "sky-v" + i)) gain[i] = SKY_GAIN[i] || 0;
    }
    if (gain[0] > 0 || gain[1] > 0 || gain[2] > 0) {
      gl.useProgram(layerProg);
      gl.bindVertexArray(layerVao);
      gl.uniformMatrix4fv(layerLoc.vp, false, vp);
      gl.uniform3f(layerLoc.eye, eye[0], eye[1], eye[2]);
      gl.uniform1f(layerLoc.bias0, yaw * 0.002);
      gl.uniform1f(layerLoc.bias1, yaw * 0.02 + (eye[0] + eye[2]) * 0.0004);
      gl.uniform1f(layerLoc.bias2, yaw * 0.012);
      gl.uniform1f(layerLoc.radius, 86);
      gl.uniform1f(layerLoc.time, performance.now() * 0.001);
      gl.uniform1f(layerLoc.scroll, 1);
      gl.uniform1f(layerLoc.gain0, gain[0]);
      gl.uniform1f(layerLoc.gain1, gain[1]);
      gl.uniform1f(layerLoc.gain2, gain[2]);
      gl.uniform1f(layerLoc.key0, SKY_KEY[0]);
      gl.uniform1f(layerLoc.key1, SKY_KEY[1]);
      gl.uniform1f(layerLoc.key2, SKY_KEY[2]);
      gl.uniform2f(layerLoc.metDuty, METEOR.duty, METEOR.fadeSec);
      gl.uniform3f(layerLoc.metWin, METEOR.win[0], METEOR.win[1], METEOR.win[2]);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, videoTex[0]);
      gl.uniform1i(layerLoc.tex0, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, videoTex[1]);
      gl.uniform1i(layerLoc.tex1, 1);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, videoTex[2]);
      gl.uniform1i(layerLoc.tex2, 2);
      gl.activeTexture(gl.TEXTURE0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(false);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, layerN);
      draws += 1;
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
    return draws;
  }

  function activeVideos() {
    let n = 0;
    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      if (v && !v.paused && v.readyState >= 2) n += 1;
    }
    return n;
  }

  return { draw, texBytes, activeVideos, ready: true };
}

/**
 * Ground mesh, detail cards, and the light post pass.
 * Visible samples are Imagine stills. Shape stays in field.js.
 */

import {
  TILE,
  SCALE,
  MASK_M,
  heightAt,
  macroAt,
  familyBlend,
  slopeAt,
  contain,
  radiusAt,
  setDepthMaps,
  maxRadius,
  areaM2,
} from "./field.js";

const GRADE_FN = `
uniform float uGradeMix;
uniform float uSat;
vec3 grade(vec3 x) {
  vec3 t = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  vec3 y = mix(x, t, uGradeMix);
  float l = dot(y, vec3(0.2126, 0.7152, 0.0722));
  y = mix(vec3(l), y, uSat);
  return clamp(y, 0.0, 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

function hash(ix, iz) {
  let n = (ix * 374761393 + iz * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function pixelsOf(img) {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  return new Uint8Array(g.getImageData(0, 0, c.width, c.height).data.buffer);
}

export function createTerrain(gl, env) {
  const ext = env.anisoExt;
  const anisoMax = env.anisoMax || 1;
  let alb = null;
  let maskTex = null;
  let detailTex = null;
  let mesh = null;
  let cards = null;
  let srcW = 1024;
  let post = null;
  let postOn = true;
  const info = { tris: 0, cards: 0, area: areaM2(), minH: 0, maxH: 0, maxSlope: 0 };
  const look = {
    fogDensity: 0.02,
    fogCap: 0.6,
    gradeMix: 0.28,
    saturation: 1.06,
    bloomGain: 0.08,
    bloomThreshold: 0.82,
  };

  const groundProg = program(gl, `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aUv;
layout(location=2) in float aFam;
layout(location=3) in vec2 aMask;
layout(location=4) in float aFamB;
layout(location=5) in float aW;
uniform mat4 uVP;
out vec2 vUv;
out vec2 vMask;
flat out float vFam;
flat out float vFamB;
out float vW;
void main() {
  gl_Position = uVP * vec4(aPos, 1.0);
  vUv = aUv;
  vMask = aMask;
  vFam = aFam;
  vFamB = aFamB;
  vW = aW;
}`, `#version 300 es
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray uAlb;
uniform sampler2D uMask;
uniform vec3 uId;
uniform int uMode;
in vec2 vUv;
in vec2 vMask;
flat in float vFam;
flat in float vFamB;
in float vW;
out vec4 o;
void main() {
  vec2 d = fwidth(vUv);
  float m = texture(uMask, vMask).r;
  vec4 a0 = textureGrad(uAlb, vec3(fract(vUv), vFam), d, vec2(d.y, d.x));
  vec4 a1 = textureGrad(uAlb, vec3(fract(vUv), vFam + 1.0), d, vec2(d.y, d.x));
  vec3 ca = mix(a0.rgb, a1.rgb, m);
  vec3 c = ca;
  if (vW > 0.001) {
    vec4 b0 = textureGrad(uAlb, vec3(fract(vUv), vFamB), d, vec2(d.y, d.x));
    vec4 b1 = textureGrad(uAlb, vec3(fract(vUv), vFamB + 1.0), d, vec2(d.y, d.x));
    vec3 cb = mix(b0.rgb, b1.rgb, m);
    float t = smoothstep(m - 0.1, m + 0.1, vW);
    c = mix(ca, cb, t);
  }
  if (uMode == 1) o = vec4(uId, 1.0);
  else o = vec4(c, 1.0);
}`);

  const cardProg = program(gl, `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aP;
layout(location=2) in vec4 aS;
layout(location=3) in float aUh;
uniform mat4 uVP;
out vec2 vUv;
flat out float vLayer;
void main() {
  float yaw = aP.w;
  vec3 right = vec3(cos(yaw), 0.0, -sin(yaw));
  vec3 p = vec3(aP.x, aP.y, aP.z) + right * (aCorner.x - 0.5) * aS.x + vec3(0.0, aCorner.y * aS.y, 0.0);
  gl_Position = uVP * vec4(p, 1.0);
  vUv = vec2((1.0 - aS.w) * 0.5 + aCorner.x * aS.w, (1.0 - aCorner.y) * aUh);
  vLayer = aS.z;
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
  if (c.a < 0.18) discard;
  if (uMode == 1) o = vec4(uId, 1.0);
  else o = vec4(c.rgb, c.a);
}`);

  const postProg = program(gl, `#version 300 es
layout(location=0) in vec2 aCorner;
out vec2 vUv;
void main() {
  vUv = aCorner;
  gl_Position = vec4(aCorner * 2.0 - 1.0, 0.0, 1.0);
}`, `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform sampler2D uDepth;
uniform sampler2D uBloom;
uniform vec3 uFog;
uniform vec2 uNearFar;
uniform float uFogOn;
uniform float uBloomOn;
uniform float uFogDensity;
uniform float uFogCap;
uniform float uBloomGain;
in vec2 vUv;
out vec4 o;
${GRADE_FN}
void main() {
  vec3 col = texture(uScene, vUv).rgb;
  float depth = texture(uDepth, vUv).r;
  float ndc = depth * 2.0 - 1.0;
  float n = uNearFar.x;
  float f = uNearFar.y;
  float viewZ = (2.0 * n * f) / (f + n - ndc * (f - n));
  if (uFogOn < 0.5) { o = vec4(col, 1.0); return; }
  float fog = clamp(1.0 - exp(-uFogDensity * viewZ), 0.0, uFogCap);
  col = mix(col, uFog, fog);
  vec3 bloom = texture(uBloom, vUv).rgb;
  col += bloom * uBloomGain * uBloomOn;
  o = vec4(grade(col), 1.0);
}`);

  const brightProg = program(gl, `#version 300 es
layout(location=0) in vec2 aCorner;
out vec2 vUv;
void main() {
  vUv = aCorner;
  gl_Position = vec4(aCorner * 2.0 - 1.0, 0.0, 1.0);
}`, `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform float uBloomThr;
in vec2 vUv;
out vec4 o;
void main() {
  vec3 c = texture(uScene, vUv).rgb;
  float m = max(c.r, max(c.g, c.b));
  float k = clamp((m - uBloomThr) / max(0.05, 1.0 - uBloomThr), 0.0, 1.0);
  o = vec4(c * k, 1.0);
}`);

  const blurProg = program(gl, `#version 300 es
layout(location=0) in vec2 aCorner;
out vec2 vUv;
void main() {
  vUv = aCorner;
  gl_Position = vec4(aCorner * 2.0 - 1.0, 0.0, 1.0);
}`, `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uDir;
in vec2 vUv;
out vec4 o;
void main() {
  vec3 s = texture(uTex, vUv).rgb * 0.227;
  s += texture(uTex, vUv + uDir * 1.384).rgb * 0.316;
  s += texture(uTex, vUv - uDir * 1.384).rgb * 0.316;
  s += texture(uTex, vUv + uDir * 3.231).rgb * 0.070;
  s += texture(uTex, vUv - uDir * 3.231).rgb * 0.070;
  o = vec4(s, 1.0);
}`);

  const gLoc = {
    vp: gl.getUniformLocation(groundProg, "uVP"),
    alb: gl.getUniformLocation(groundProg, "uAlb"),
    mask: gl.getUniformLocation(groundProg, "uMask"),
    id: gl.getUniformLocation(groundProg, "uId"),
    mode: gl.getUniformLocation(groundProg, "uMode"),
  };
  const cLoc = {
    vp: gl.getUniformLocation(cardProg, "uVP"),
    tex: gl.getUniformLocation(cardProg, "uTex"),
    id: gl.getUniformLocation(cardProg, "uId"),
    mode: gl.getUniformLocation(cardProg, "uMode"),
  };

  const quad = gl.createVertexArray();
  const qbuf = gl.createBuffer();
  gl.bindVertexArray(quad);
  gl.bindBuffer(gl.ARRAY_BUFFER, qbuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  gl.bindVertexArray(null);

  function makeArray(images, id, repeat) {
    let maxW = 2;
    let maxH = 2;
    const packed = images.map((img) => {
      maxW = Math.max(maxW, img.width);
      maxH = Math.max(maxH, img.height);
      return { w: img.width, h: img.height, data: pixelsOf(img) };
    });
    const levels = Math.floor(Math.log2(Math.max(maxW, maxH))) + 1;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, levels, gl.RGBA8, maxW, maxH, images.length);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, wrap);
    if (ext) gl.texParameterf(gl.TEXTURE_2D_ARRAY, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, anisoMax));
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    for (let i = 0; i < packed.length; i++) {
      const p = packed[i];
      if (p.w !== maxW || p.h !== maxH) {
        const full = new Uint8Array(maxW * maxH * 4);
        for (let y = 0; y < p.h; y++) {
          full.set(p.data.subarray(y * p.w * 4, (y + 1) * p.w * 4), y * maxW * 4);
        }
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, maxW, maxH, 1, gl.RGBA, gl.UNSIGNED_BYTE, full);
      } else {
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, p.w, p.h, 1, gl.RGBA, gl.UNSIGNED_BYTE, p.data);
      }
    }
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    env.trackTex(id, Math.ceil(maxW * maxH * 4 * images.length * 4 / 3));
    return { tex: t, w: maxW, h: maxH, layers: images.length };
  }

  function make2D(img, id) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    env.trackTex(id, Math.ceil(img.width * img.height * 4 * 4 / 3));
    return t;
  }

  function buildMesh() {
    const reach = maxRadius() * 1.08;
    const n = 300;
    const step = (reach * 2) / n;
    const positions = [];
    const uvs = [];
    const fams = [];
    const masks = [];
    const indexOf = new Int32Array((n + 1) * (n + 1));
    indexOf.fill(-1);
    let minH = 99;
    let maxH = -99;
    let maxSlope = 0;
    let count = 0;
    for (let iz = 0; iz <= n; iz++) {
      for (let ix = 0; ix <= n; ix++) {
        const x = -reach + ix * step;
        const z = -reach + iz * step;
        const rho = Math.hypot(x, z);
        const lim = radiusAt(Math.atan2(x, z)) * 1.08;
        if (rho > lim + step) continue;
        const y = heightAt(x, z);
        if (y < minH) minH = y;
        if (y > maxH) maxH = y;
        indexOf[iz * (n + 1) + ix] = count++;
        positions.push(x, y, z);
        uvs.push(x / TILE, z / TILE);
        const blend = familyBlend(x, z);
        fams.push(blend.a, blend.b, blend.w);
        masks.push(x / MASK_M, z / MASK_M);
      }
    }
    const idx = [];
    for (let iz = 0; iz < n; iz++) {
      for (let ix = 0; ix < n; ix++) {
        const a = indexOf[iz * (n + 1) + ix];
        const b = indexOf[iz * (n + 1) + ix + 1];
        const c = indexOf[(iz + 1) * (n + 1) + ix];
        const d = indexOf[(iz + 1) * (n + 1) + ix + 1];
        if (a < 0 || b < 0 || c < 0 || d < 0) continue;
        const cx = -reach + (ix + 0.5) * step;
        const cz = -reach + (iz + 0.5) * step;
        if (Math.hypot(cx, cz) > radiusAt(Math.atan2(cx, cz)) * 1.06) continue;
        idx.push(a, c, b, b, c, d);
        if (((ix + iz) & 15) === 0) {
          const s = slopeAt(cx, cz);
          const u = Math.hypot(cx, cz) / radiusAt(Math.atan2(cx, cz));
          if (u < 0.92 && s > maxSlope) maxSlope = s;
        }
      }
    }
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    const inter = new Float32Array(count * 10);
    for (let i = 0; i < count; i++) {
      const o = i * 10;
      inter[o] = positions[i * 3];
      inter[o + 1] = positions[i * 3 + 1];
      inter[o + 2] = positions[i * 3 + 2];
      inter[o + 3] = uvs[i * 2];
      inter[o + 4] = uvs[i * 2 + 1];
      inter[o + 5] = fams[i * 3];
      inter[o + 6] = masks[i * 2];
      inter[o + 7] = masks[i * 2 + 1];
      inter[o + 8] = fams[i * 3 + 1];
      inter[o + 9] = fams[i * 3 + 2];
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, inter, gl.STATIC_DRAW);
    const stride = 40;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 20);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, stride, 24);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, stride, 32);
    gl.enableVertexAttribArray(5);
    gl.vertexAttribPointer(5, 1, gl.FLOAT, false, stride, 36);
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    info.tris = idx.length / 3;
    info.minH = minH;
    info.maxH = maxH;
    info.maxSlope = maxSlope;
    info.verts = count;
    mesh = { vao, count: idx.length };
  }

  function buildCards(imgs) {
    const sizes = [
      { h: 0.28, w: 0.28 * (imgs[0].width / imgs[0].height) },
      { h: 0.16, w: 0.16 * (imgs[1].width / imgs[1].height) },
      { h: 0.3, w: 0.3 * (imgs[2].width / imgs[2].height) },
    ];
    const reach = maxRadius() * 0.9;
    const inst = [];
    let placed = 0;
    for (let i = 0; i < 4000 && placed < 200; i++) {
      const x = (hash(i, 2) - 0.5) * 2 * reach;
      const z = (hash(i, 5) - 0.5) * 2 * reach;
      const rho = Math.hypot(x, z);
      const R = radiusAt(Math.atan2(x, z));
      if (rho > R * 0.88) continue;
      const e = 1.6;
      const ms = Math.hypot(macroAt(x + e, z) - macroAt(x - e, z), macroAt(x, z + e) - macroAt(x, z - e)) / (2 * e);
      if (ms > 0.7) continue;
      const fam = familyAt(x, z);
      let kind = 2;
      if (fam === 0) kind = 0;
      else if (fam === 2) kind = 1;
      else if (fam === 4) kind = hash(i, 8) > 0.55 ? 0 : 2;
      else kind = 2;
      if (kind === 1 && hash(i, 4) > 0.55) continue;
      if (kind === 0 && hash(i, 6) > 0.72) continue;
      const yaw = hash(i, 7) * Math.PI;
      const sc = 0.72 + hash(i, 9) * 0.28;
      const sz = sizes[kind];
      const y = heightAt(x, z) - 0.02;
      const uw = imgs[kind].width / detailTex.w;
      const uh = imgs[kind].height / detailTex.h;
      inst.push(x, y, z, yaw, sz.w * sc, sz.h * sc, kind, uw, uh);
      inst.push(x, y, z, yaw + Math.PI * 0.5, sz.w * sc, sz.h * sc, kind, uw, uh);
      placed++;
    }
    const data = new Float32Array(inst);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, qbuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ib);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const stride = 36;
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 16);
    gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 32);
    gl.vertexAttribDivisor(3, 1);
    gl.bindVertexArray(null);
    info.cards = data.length / 9;
    cards = { vao, count: data.length / 9 };
  }

  function target(w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return tex;
  }

  function initPost() {
    const bw = env.W >> 1;
    const bh = env.H >> 1;
    const scene = target(env.W, env.H);
    const depth = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, depth);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, env.W, env.H, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, scene, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT16, env.W, env.H, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
    }
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error("scene fbo");
    }
    const halfA = target(bw, bh);
    const halfB = target(bw, bh);
    const halfFb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    post = { scene, depth, fb, halfA, halfB, halfFb, bw, bh, fog: [0.5, 0.5, 0.5] };
    env.trackTex("post", env.W * env.H * 4 + bw * bh * 8);
  }

  function drawQuad(prog) {
    gl.useProgram(prog);
    gl.bindVertexArray(quad);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  return {
    SCALE,
    TILE,
    heightAt,
    slopeAt,
    contain,
    radiusAt,
    info: () => info,
    setPost(on) { postOn = !!on; },
    postEnabled() { return postOn; },
    setFog(rgb) { if (post) post.fog = rgb; },
    setLook(next) {
      if (!next) return;
      for (const k of Object.keys(look)) {
        if (typeof next[k] === "number") look[k] = next[k];
      }
    },
    bindScene() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, post.fb);
      gl.viewport(0, 0, env.W, env.H);
    },
    async load(ground) {
      const tiles = [];
      for (const u of ground.tiles) tiles.push(await env.loadImage(env.absUrl(u)));
      srcW = tiles[0].width;
      alb = makeArray(tiles, "ground", false);
      const depths = [];
      for (const u of ground.depth) {
        const img = await env.loadImage(env.absUrl(u));
        const data = pixelsOf(img);
        const lum = new Float32Array(img.width * img.height);
        for (let i = 0; i < lum.length; i++) lum[i] = data[i * 4];
        depths.push({ w: img.width, h: img.height, data: lum });
      }
      setDepthMaps(depths);
      maskTex = make2D(await env.loadImage(env.absUrl(ground.mask)), "mask");
      const cuts = [];
      for (const u of ground.details || []) cuts.push(await env.loadImage(env.absUrl(u)));
      if (cuts.length) {
        detailTex = makeArray(cuts, "detail", false);
        buildCards(cuts);
      }
      buildMesh();
      initPost();
    },
    draw(vp, mode, id) {
      if (!mesh) return;
      gl.useProgram(groundProg);
      gl.bindVertexArray(mesh.vao);
      gl.uniformMatrix4fv(gLoc.vp, false, vp);
      gl.uniform1i(gLoc.mode, mode);
      gl.uniform3f(gLoc.id, id[0], id[1], id[2]);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, alb.tex);
      gl.uniform1i(gLoc.alb, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, maskTex);
      gl.uniform1i(gLoc.mask, 1);
      gl.disable(gl.BLEND);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
      if (!cards || !cards.count) return;
      gl.useProgram(cardProg);
      gl.bindVertexArray(cards.vao);
      gl.uniformMatrix4fv(cLoc.vp, false, vp);
      gl.uniform1i(cLoc.mode, mode);
      gl.uniform3f(cLoc.id, id[0], id[1], id[2]);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, detailTex.tex);
      gl.uniform1i(cLoc.tex, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, cards.count);
      gl.disable(gl.BLEND);
    },
    composite() {
      if (!post) return;
      const fogOn = postOn ? 1 : 0;
      const bloomOn = postOn ? 1 : 0;
      gl.bindFramebuffer(gl.FRAMEBUFFER, post.halfFb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, post.halfA, 0);
      gl.viewport(0, 0, post.bw, post.bh);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.useProgram(brightProg);
      gl.uniform1i(gl.getUniformLocation(brightProg, "uScene"), 0);
      gl.uniform1f(gl.getUniformLocation(brightProg, "uBloomThr"), look.bloomThreshold);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, post.scene);
      drawQuad(brightProg);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, post.halfB, 0);
      gl.useProgram(blurProg);
      gl.uniform1i(gl.getUniformLocation(blurProg, "uTex"), 0);
      gl.uniform2f(gl.getUniformLocation(blurProg, "uDir"), 1 / post.bw, 0);
      gl.bindTexture(gl.TEXTURE_2D, post.halfA);
      drawQuad(blurProg);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, post.halfA, 0);
      gl.uniform2f(gl.getUniformLocation(blurProg, "uDir"), 0, 1 / post.bh);
      gl.bindTexture(gl.TEXTURE_2D, post.halfB);
      drawQuad(blurProg);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, env.W, env.H);
      gl.useProgram(postProg);
      gl.uniform1i(gl.getUniformLocation(postProg, "uScene"), 0);
      gl.uniform1i(gl.getUniformLocation(postProg, "uDepth"), 1);
      gl.uniform1i(gl.getUniformLocation(postProg, "uBloom"), 2);
      gl.uniform3f(gl.getUniformLocation(postProg, "uFog"), post.fog[0], post.fog[1], post.fog[2]);
      gl.uniform2f(gl.getUniformLocation(postProg, "uNearFar"), env.NEAR, env.FAR);
      gl.uniform1f(gl.getUniformLocation(postProg, "uFogOn"), fogOn);
      gl.uniform1f(gl.getUniformLocation(postProg, "uBloomOn"), bloomOn);
      gl.uniform1f(gl.getUniformLocation(postProg, "uFogDensity"), look.fogDensity);
      gl.uniform1f(gl.getUniformLocation(postProg, "uFogCap"), look.fogCap);
      gl.uniform1f(gl.getUniformLocation(postProg, "uBloomGain"), look.bloomGain);
      gl.uniform1f(gl.getUniformLocation(postProg, "uGradeMix"), look.gradeMix);
      gl.uniform1f(gl.getUniformLocation(postProg, "uSat"), look.saturation);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, post.scene);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, post.depth);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, post.halfA);
      drawQuad(postProg);
      gl.enable(gl.DEPTH_TEST);
    },
    mag(eye) {
      const gy = heightAt(eye[0], eye[2]);
      const elev = Math.max(0.35, eye[1] - gy);
      const groundD = elev / Math.tan(env.VFOV / 2);
      const span = 2.2;
      const slope = Math.hypot(
        heightAt(eye[0] + span, eye[2]) - heightAt(eye[0] - span, eye[2]),
        heightAt(eye[0], eye[2] + span) - heightAt(eye[0], eye[2] - span),
      ) / (2 * span);
      const stretch = 1 / Math.max(0.55, Math.cos(Math.atan(slope)));
      let m = (env.FOCAL * TILE * stretch) / (groundD * srcW);
      if (cards) {
        const near = Math.max(0.8, Math.hypot(4, elev));
        const detailH = 0.3;
        const detailSrc = 700;
        m = Math.max(m, (env.FOCAL * detailH) / (near * detailSrc));
      }
      return m;
    },
    srcW: () => srcW,
  };
}

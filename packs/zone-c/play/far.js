/**
 * Far cliffs and ridges. Lofted measured sections, one unlit Imagine skin each.
 * Valley mist reuses the sky mist video. No new colour.
 */

import { macroAt, radiusAt } from "./field.js";

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

// Face the origin. Front of the loft is local -Z.
function yawTowardOrigin(x, z) {
  return Math.atan2(-x, z);
}

export async function mountFar(gl, env) {
  const spec = await (await fetch(env.absUrl("packs/zone-c/src/far/mesh.json"))).json();
  const skins = [];
  for (const name of ["cliff.jpg", "ridge.jpg"]) {
    skins.push(await env.loadImage(env.absUrl("packs/zone-c/src/far/" + name)));
  }
  const texH = skins.map((im) => im.height);
  const maxW = Math.max(...skins.map((im) => im.width));
  const maxH = Math.max(...texH);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
  const levels = Math.floor(Math.log2(Math.max(maxW, maxH))) + 1;
  gl.texStorage3D(gl.TEXTURE_2D_ARRAY, levels, gl.RGB8, maxW, maxH, skins.length);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  for (let i = 0; i < skins.length; i++) {
    const im = skins[i];
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, im.width, im.height, 1, gl.RGB, gl.UNSIGNED_BYTE, im);
  }
  gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
  env.trackTex("far", Math.ceil(maxW * maxH * 3 * skins.length * 4 / 3));

  // worldH is the crest. Distance keeps magnification ≤ 1 from the walkable rim.
  const places = [
    { part: "cliff", x: 40, z: 520, worldH: 42 },
    { part: "cliff", x: -480, z: 80, worldH: 36 },
    { part: "cliff", x: 460, z: -220, worldH: 38 },
    { part: "ridge", x: -360, z: -420, worldH: 28 },
    { part: "ridge", x: 220, z: -520, worldH: 26 },
    { part: "ridge", x: 520, z: 260, worldH: 24 },
  ];
  for (const p of places) p.yaw = yawTowardOrigin(p.x, p.z);

  const pos = [];
  const uv = [];
  const skin = [];
  const idx = [];
  let base = 0;
  const bounds = [];
  for (const p of places) {
    const part = spec[p.part];
    const src = part.positions;
    const uvs = part.uvs;
    const n = src.length / 3;
    const c = Math.cos(p.yaw);
    const s = Math.sin(p.yaw);
    let minX = 1e9;
    let maxX = -1e9;
    let minZ = 1e9;
    let maxZ = -1e9;
    let top = 0;
    for (let i = 0; i < n; i++) {
      const lx = src[i * 3] * p.worldH;
      const ly = src[i * 3 + 1] * p.worldH;
      const lz = src[i * 3 + 2] * p.worldH;
      const wx = p.x + lx * c - lz * s;
      const wz = p.z + lx * s + lz * c;
      const wy = ly + env.heightAt(wx, wz);
      pos.push(wx, wy, wz);
      uv.push(uvs[i * 2], uvs[i * 2 + 1]);
      skin.push(p.part === "cliff" ? 0 : 1);
      if (wx < minX) minX = wx;
      if (wx > maxX) maxX = wx;
      if (wz < minZ) minZ = wz;
      if (wz > maxZ) maxZ = wz;
      if (ly > top) top = ly;
    }
    for (let k = 0; k < part.idx.length; k++) idx.push(base + part.idx[k]);
    base += n;
    bounds.push({
      x: p.x, z: p.z, h: top, texH: texH[p.part === "cliff" ? 0 : 1],
      minX, maxX, minZ, maxZ,
    });
  }

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  const inter = new Float32Array(pos.length / 3 * 6);
  for (let i = 0; i < pos.length / 3; i++) {
    const o = i * 6;
    inter[o] = pos[i * 3];
    inter[o + 1] = pos[i * 3 + 1];
    inter[o + 2] = pos[i * 3 + 2];
    inter[o + 3] = uv[i * 2];
    inter[o + 4] = uv[i * 2 + 1];
    inter[o + 5] = skin[i];
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, inter, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 12);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 24, 20);
  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  const solidProg = program(gl, `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aUv;
layout(location=2) in float aSkin;
uniform mat4 uVP;
out vec2 vUv;
flat out float vSkin;
void main() {
  gl_Position = uVP * vec4(aPos, 1.0);
  vUv = aUv;
  vSkin = aSkin;
}`, `#version 300 es
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray uTex;
uniform vec3 uId;
uniform int uMode;
in vec2 vUv;
flat in float vSkin;
out vec4 o;
void main() {
  vec3 c = texture(uTex, vec3(vUv, vSkin)).rgb;
  if (uMode == 1) o = vec4(uId, 1.0);
  else o = vec4(c, 1.0);
}`);

  // Morning mist sits in the lower saddles. One video, one draw.
  const sheets = [];
  const reach = 280;
  for (let i = 0; i < 48 && sheets.length < 14; i++) {
    const a = i * 2.399;
    const r = 40 + (i % 7) * 28;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r * 0.85;
    if (Math.hypot(x, z) > reach) continue;
    const th = Math.atan2(x, z);
    if (Math.hypot(x, z) > radiusAt(th) * 0.82) continue;
    const h = macroAt(x, z);
    if (h > 18) continue;
    sheets.push(x, h + 1.4, z, 26 + (i % 3) * 4, 7.5);
  }
  const mistVao = gl.createVertexArray();
  gl.bindVertexArray(mistVao);
  const corners = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
  const cbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cbuf);
  gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  const ib = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, ib);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sheets), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 20, 0);
  gl.vertexAttribDivisor(1, 1);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 20, 12);
  gl.vertexAttribDivisor(2, 1);
  gl.bindVertexArray(null);

  const mistProg = program(gl, `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec3 aP;
layout(location=2) in vec2 aS;
uniform mat4 uVP;
uniform float uTime;
out vec2 vUv;
void main() {
  vec3 p = aP + vec3((aCorner.x - 0.5) * aS.x, aCorner.y * aS.y, 0.0);
  gl_Position = uVP * vec4(p, 1.0);
  vUv = aCorner + vec2(uTime * 0.02, 0.0);
}`, `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform float uKey;
in vec2 vUv;
out vec4 o;
void main() {
  vec3 s = texture(uTex, fract(vUv)).rgb;
  float lum = dot(s, vec3(0.299, 0.587, 0.114));
  float a = smoothstep(uKey, uKey + 0.08, lum);
  if (a < 0.04) discard;
  o = vec4(s, a * 0.55);
}`);

  const sLoc = {
    vp: gl.getUniformLocation(solidProg, "uVP"),
    tex: gl.getUniformLocation(solidProg, "uTex"),
    id: gl.getUniformLocation(solidProg, "uId"),
    mode: gl.getUniformLocation(solidProg, "uMode"),
  };
  const mLoc = {
    vp: gl.getUniformLocation(mistProg, "uVP"),
    time: gl.getUniformLocation(mistProg, "uTime"),
    tex: gl.getUniformLocation(mistProg, "uTex"),
    key: gl.getUniformLocation(mistProg, "uKey"),
  };

  function magAt(eye, focal) {
    let m = 0;
    for (let i = 0; i < bounds.length; i++) {
      const b = bounds[i];
      const dx = Math.max(b.minX - eye[0], 0, eye[0] - b.maxX);
      const dz = Math.max(b.minZ - eye[2], 0, eye[2] - b.maxZ);
      const dist = Math.max(8, Math.hypot(dx, dz));
      const texels = (focal * b.h) / dist;
      m = Math.max(m, texels / b.texH);
    }
    return m;
  }

  return {
    draws: 2,
    sheets: sheets.length / 5,
    mag: magAt,
    draw(vp, mode, mistTex, now) {
      gl.useProgram(solidProg);
      gl.bindVertexArray(vao);
      gl.uniformMatrix4fv(sLoc.vp, false, vp);
      gl.uniform1i(sLoc.mode, mode);
      gl.uniform3f(sLoc.id, mode === 1 ? 0.15 : 0, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
      gl.uniform1i(sLoc.tex, 0);
      gl.disable(gl.BLEND);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_INT, 0);
      if (mode === 1 || !mistTex || !sheets.length) return;
      gl.useProgram(mistProg);
      gl.bindVertexArray(mistVao);
      gl.uniformMatrix4fv(mLoc.vp, false, vp);
      gl.uniform1f(mLoc.time, now);
      gl.uniform1f(mLoc.key, 0.12);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, mistTex);
      gl.uniform1i(mLoc.tex, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, sheets.length / 5);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    },
  };
}

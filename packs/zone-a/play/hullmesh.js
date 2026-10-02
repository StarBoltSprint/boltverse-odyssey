/**
 * Instanced world-locked hulls. Imagine pixels stay in the source views.
 * One drawElementsInstanced per asset. Geometry uploads once.
 */
const MAX_VIEWS = 8;
const MAX_INST = 64;

function parseMesh(buf) {
  const head = new DataView(buf, 0, 20);
  const magic = String.fromCharCode(head.getUint8(0), head.getUint8(1), head.getUint8(2), head.getUint8(3));
  if (magic !== "MSH1") throw new Error("mesh magic " + magic);
  const vc = head.getUint32(4, true);
  const ic = head.getUint32(8, true);
  const flags = head.getUint32(12, true);
  if (flags !== 1) throw new Error("mesh flags " + flags);
  let off = 20;
  const verts = new Float32Array(buf, off, vc * 3);
  off += vc * 3 * 4;
  const normals = new Float32Array(buf, off, vc * 3);
  off += vc * 3 * 4;
  const indices = new Uint32Array(buf.slice(off, off + ic * 4));
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < vc; i++) {
    const y = verts[i * 3 + 1];
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { vc, ic, verts, normals, indices, minY, maxY };
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
  return sh;
}

let sharedProg = null;
let sharedLoc = null;

function shader(gl) {
  if (sharedProg) return;
  const vs = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=3) in vec4 aM0;
layout(location=4) in vec4 aM1;
layout(location=5) in vec4 aM2;
layout(location=6) in vec4 aM3;
layout(location=7) in float aId;
uniform mat4 uVP;
out vec3 vLocal;
out vec3 vNrm;
flat out float vId;
void main() {
  mat4 M = mat4(aM0, aM1, aM2, aM3);
  gl_Position = uVP * M * vec4(aPos, 1.0);
  vLocal = aPos;
  vNrm = aNrm;
  vId = aId;
}`;
  const fs = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2DArray;
uniform highp sampler2DArray uViews;
uniform int uViewCount;
uniform vec3 uCamPos[8];
uniform vec3 uCamRight[8];
uniform vec3 uCamUp[8];
uniform vec3 uCamForward[8];
uniform float uFov[8];
uniform vec2 uViewSize[8];
uniform vec2 uTexSize;
uniform float uHand;
uniform int uMode;
in vec3 vLocal;
in vec3 vNrm;
flat in float vId;
out vec4 o;
void project(int i, vec3 p, out vec2 uv, out float z) {
  vec3 rel = p - uCamPos[i];
  z = dot(rel, uCamForward[i]);
  float x = dot(rel, uCamRight[i]);
  float y = dot(rel, uCamUp[i]);
  vec2 sz = uViewSize[i];
  float fy = (sz.y * 0.5) / tan(radians(uFov[i]) * 0.5);
  uv.x = (sz.x - 1.0) * 0.5 + uHand * fy * (x / max(z, 1e-4));
  uv.y = (sz.y - 1.0) * 0.5 - fy * (y / max(z, 1e-4));
}
void main() {
  vec3 n = normalize(vNrm);
  float bestW = -1.0;
  int bestI = 0;
  float faceW = -1.0;
  int faceI = 0;
  float anyA = -1.0;
  int anyI = 0;
  for (int i = 0; i < 8; i++) {
    if (i >= uViewCount) break;
    vec3 toCam = uCamPos[i] - vLocal;
    float nd = clamp(dot(n, normalize(toCam)), 0.0, 1.0);
    float w = pow(nd, 8.0);
    if (w > faceW) { faceW = w; faceI = i; }
    vec2 uv; float z;
    project(i, vLocal, uv, z);
    vec2 sz = uViewSize[i];
    ivec2 px = ivec2(int(floor(uv.x + 0.5)), int(floor(uv.y + 0.5)));
    bool inside = z > 0.0001 && px.x >= 1 && px.y >= 1 && px.x < int(sz.x) - 1 && px.y < int(sz.y) - 1;
    float a = 0.0;
    if (inside) a = texelFetch(uViews, ivec3(px, i), 0).a;
    if (inside && a > anyA) { anyA = a; anyI = i; }
    float wv = (inside && a > 0.45) ? w : 0.0;
    if (wv > bestW) { bestW = wv; bestI = i; }
  }
  int useI = bestW > 0.0 ? bestI : (anyA > 0.2 ? anyI : faceI);
  vec2 uv; float z;
  project(useI, vLocal, uv, z);
  vec2 sz = uViewSize[useI];
  vec2 tuv = clamp((uv + 0.5) / uTexSize, vec2(0.5) / uTexSize, (sz - 0.5) / uTexSize);
  vec4 src = texture(uViews, vec3(tuv, float(useI)));
  if (src.a < 0.35 && anyA > 0.2 && anyI != useI) {
    vec2 uvA; float zA;
    project(anyI, vLocal, uvA, zA);
    vec2 tuvA = clamp((uvA + 0.5) / uTexSize, vec2(0.5) / uTexSize, (uViewSize[anyI] - 0.5) / uTexSize);
    vec4 alt = texture(uViews, vec3(tuvA, float(anyI)));
    if (alt.a > src.a) src = alt;
  }
  if (src.a < 0.2) {
    vec2 uvF; float zF;
    project(faceI, vLocal, uvF, zF);
    vec2 tuvF = clamp((uvF + 0.5) / uTexSize, vec2(0.5) / uTexSize, (uViewSize[faceI] - 0.5) / uTexSize);
    vec4 altF = texture(uViews, vec3(tuvF, float(faceI)));
    if (altF.a > src.a) src = altF;
  }
  if (uMode == 1) o = vec4(vId / 255.0, 0.0, 0.0, 1.0);
  else o = vec4(src.rgb, 1.0);
}`;
  sharedProg = gl.createProgram();
  gl.attachShader(sharedProg, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(sharedProg, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(sharedProg);
  if (!gl.getProgramParameter(sharedProg, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(sharedProg));
  const u = (n) => gl.getUniformLocation(sharedProg, n);
  sharedLoc = {
    vp: u("uVP"),
    views: u("uViews"),
    count: u("uViewCount"),
    pos: u("uCamPos"),
    right: u("uCamRight"),
    up: u("uCamUp"),
    fwd: u("uCamForward"),
    fov: u("uFov"),
    size: u("uViewSize"),
    texSize: u("uTexSize"),
    hand: u("uHand"),
    mode: u("uMode"),
  };
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(url));
    img.src = url;
  });
}

function fitCanvas(img, maxH) {
  const scale = Math.min(1, maxH / img.height);
  const w = Math.max(2, Math.round(img.width * scale));
  const h = Math.max(2, Math.round(img.height * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.imageSmoothingEnabled = scale < 1;
  g.drawImage(img, 0, 0, w, h);
  const data = new Uint8Array(g.getImageData(0, 0, w, h).data.buffer);
  const lw = 32;
  const lh = 32;
  const luma = new Float32Array(lw * lh);
  for (let y = 0; y < lh; y++) {
    for (let x = 0; x < lw; x++) {
      const sx = Math.min(w - 1, Math.floor((x + 0.5) * w / lw));
      const sy = Math.min(h - 1, Math.floor((y + 0.5) * h / lh));
      const o = (sy * w + sx) * 4;
      const a = data[o + 3];
      luma[y * lw + x] = a > 40 ? (data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114) / 255 : -1;
    }
  }
  return { w, h, data, luma };
}

export async function loadWorldHull(gl, assetUrl, onBytes, opts) {
  shader(gl);
  const maxH = Math.max(64, (opts && opts.maxH) || 720);
  const folder = assetUrl.replace(/\/asset\.json$/, "");
  const asset = await (await fetch(assetUrl)).json();
  const meshBuf = await (await fetch(folder + "/" + ((asset.files && asset.files.mesh) || "mesh.bin"))).arrayBuffer();
  const mesh = parseMesh(meshBuf);
  const cams = (asset.cameras || []).slice(0, MAX_VIEWS);
  if (!cams.length) throw new Error("hull has no cameras " + assetUrl);
  const images = [];
  for (const cam of cams) images.push(fitCanvas(await loadImage(folder + "/views/" + cam.file), maxH));
  let maxW = 2;
  let maxDimH = 2;
  for (const img of images) {
    maxW = Math.max(maxW, img.w);
    maxDimH = Math.max(maxDimH, img.h);
  }
  const levels = Math.floor(Math.log2(Math.max(maxW, maxDimH))) + 1;
  const viewsTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, viewsTex);
  gl.texStorage3D(gl.TEXTURE_2D_ARRAY, levels, gl.RGBA8, maxW, maxDimH, cams.length);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, img.w, img.h, 1, gl.RGBA, gl.UNSIGNED_BYTE, img.data);
  }
  gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
  const bytes = Math.ceil(maxW * maxDimH * 4 * cams.length * 4 / 3);
  if (onBytes) onBytes(assetUrl, bytes);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  const inter = new ArrayBuffer(mesh.vc * 24);
  const f32 = new Float32Array(inter);
  for (let i = 0; i < mesh.vc; i++) {
    f32[i * 6] = mesh.verts[i * 3];
    f32[i * 6 + 1] = mesh.verts[i * 3 + 1];
    f32[i * 6 + 2] = mesh.verts[i * 3 + 2];
    f32[i * 6 + 3] = mesh.normals[i * 3];
    f32[i * 6 + 4] = mesh.normals[i * 3 + 1];
    f32[i * 6 + 5] = mesh.normals[i * 3 + 2];
  }
  gl.bufferData(gl.ARRAY_BUFFER, f32, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

  const inst = new Float32Array(MAX_INST * 17);
  const ibuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, ibuf);
  gl.bufferData(gl.ARRAY_BUFFER, inst.byteLength, gl.STATIC_DRAW);
  const stride = 17 * 4;
  for (let c = 0; c < 4; c++) {
    gl.enableVertexAttribArray(3 + c);
    gl.vertexAttribPointer(3 + c, 4, gl.FLOAT, false, stride, c * 16);
    gl.vertexAttribDivisor(3 + c, 1);
  }
  gl.enableVertexAttribArray(7);
  gl.vertexAttribPointer(7, 1, gl.FLOAT, false, stride, 64);
  gl.vertexAttribDivisor(7, 1);
  gl.bindVertexArray(null);

  const pos = [];
  const right = [];
  const up = [];
  const fwd = [];
  const fov = [];
  const sz = [];
  const yaws = [];
  const lumas = [];
  for (let i = 0; i < cams.length; i++) {
    const cam = cams[i];
    const img = images[i];
    pos.push(cam.position[0], cam.position[1], cam.position[2]);
    right.push(cam.right[0], cam.right[1], cam.right[2]);
    up.push(cam.up[0], cam.up[1], cam.up[2]);
    fwd.push(cam.forward[0], cam.forward[1], cam.forward[2]);
    fov.push(cam.fovYDeg);
    sz.push(img.w, img.h);
    yaws.push(cam.yawDeg || 0);
    lumas.push(img.luma);
  }
  while (pos.length < MAX_VIEWS * 3) {
    pos.push(0, 0.2, 8);
    right.push(1, 0, 0);
    up.push(0, 1, 0);
    fwd.push(0, 0, -1);
    fov.push(32);
    sz.push(maxW, maxDimH);
  }
  let count = 0;
  let saved = null;
  let savedN = 0;

  function writeInstance(index, x, y, z, yawDeg, scale, idIndex) {
    const a = yawDeg * Math.PI / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const o = index * 17;
    inst[o] = c * scale;
    inst[o + 1] = 0;
    inst[o + 2] = -s * scale;
    inst[o + 3] = 0;
    inst[o + 4] = 0;
    inst[o + 5] = scale;
    inst[o + 6] = 0;
    inst[o + 7] = 0;
    inst[o + 8] = s * scale;
    inst[o + 9] = 0;
    inst[o + 10] = c * scale;
    inst[o + 11] = 0;
    inst[o + 12] = x;
    inst[o + 13] = y;
    inst[o + 14] = z;
    inst[o + 15] = 1;
    inst[o + 16] = idIndex;
  }

  function addInstance(x, y, z, yawDeg, scale, idIndex) {
    if (count >= MAX_INST) return;
    writeInstance(count, x, y, z, yawDeg, scale, idIndex);
    count++;
  }

  function upload() {
    gl.bindBuffer(gl.ARRAY_BUFFER, ibuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, inst);
  }

  function draw(vp, mode) {
    if (!count) return;
    const loc = sharedLoc;
    gl.useProgram(sharedProg);
    gl.bindVertexArray(vao);
    gl.uniformMatrix4fv(loc.vp, false, vp);
    gl.uniform1i(loc.count, cams.length);
    gl.uniform3fv(loc.pos, pos);
    gl.uniform3fv(loc.right, right);
    gl.uniform3fv(loc.up, up);
    gl.uniform3fv(loc.fwd, fwd);
    gl.uniform1fv(loc.fov, fov);
    gl.uniform2fv(loc.size, sz);
    gl.uniform2f(loc.texSize, maxW, maxDimH);
    gl.uniform1f(loc.hand, -1);
    gl.uniform1i(loc.mode, mode | 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, viewsTex);
    gl.uniform1i(loc.views, 0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.drawElementsInstanced(gl.TRIANGLES, mesh.ic, gl.UNSIGNED_INT, 0, count);
    gl.bindVertexArray(null);
  }

  function solo(vp, x, y, z, yawDeg, scale, idIndex) {
    savedN = count;
    saved = inst.slice(0, Math.max(1, count) * 17);
    count = 0;
    addInstance(x, y, z, yawDeg, scale, idIndex);
    upload();
    draw(vp, 0);
    if (saved) inst.set(saved);
    count = savedN;
    upload();
  }

  return {
    addInstance,
    upload,
    draw,
    solo,
    minY: mesh.minY,
    maxY: mesh.maxY,
    halfExtent: asset.halfExtent || [1, 1, 1],
    approach: asset.approach && asset.approach.minDistance ? asset.approach.minDistance : 6,
    srcH: maxDimH,
    srcW: maxW,
    name: asset.name || assetUrl,
    yaws,
    lumas,
    cameras: cams.map((cam) => ({
      yaw: cam.yawDeg || 0,
      position: cam.position,
      right: cam.right,
      up: cam.up,
      forward: cam.forward,
      fov: cam.fovYDeg,
    })),
    indexCount: mesh.ic,
  };
}

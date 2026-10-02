/**
 * World-locked hull for every solid. One mount per asset.
 * Repeated stones are instances of that mount, not extra mounts and not cards.
 *
 * Imagine pixels stay in the view PNGs. This file places the mesh and picks
 * the already-shot view per fragment (best facing, stored cameras). It does
 * not shade, tint, or draw a pixel of its own. Sampling is texelFetch of the
 * original PNG.
 *
 * Camera right is the vector stored in asset.json, which is
 * cross(forward, worldUp). A mirrored right is refused at load.
 *
 *   const hull = await mountHull(gl, "hulls/ring-b/asset.json");
 *   hull.setInstances(clearing.edge_ring.hulls);   // once
 *   hull.draw(vp, 0, [1, 1, 1]);                    // colour
 *   hull.collide(x, z, heroRadius);                 // footprint, not the ring radius
 */

import { HANDEDNESS, blockedBy, isRingWall, rightMatches } from "./basis.mjs";

const MAX_VIEWS = 8;

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
  off += ic * 4;
  const groups = new Uint16Array(buf, off, vc);
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < vc; i++) {
    const y = verts[i * 3 + 1];
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { vc, ic, verts, normals, groups, indices, minY, maxY };
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
  return sh;
}

function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
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

async function rgbaOf(url) {
  const img = await loadImage(url);
  if (img.width > 2048 || img.height > 2048) {
    throw new Error("Imagine still " + url + " is " + img.width + "x" + img.height + ", limit 2048");
  }
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  return { w: img.width, h: img.height, data: new Uint8Array(g.getImageData(0, 0, img.width, img.height).data.buffer) };
}

function assertCamera(cam) {
  if (!cam.forward || !cam.right) throw new Error("camera " + cam.file + " has no basis");
  if (!rightMatches(cam.forward, cam.right)) {
    throw new Error("handedness: " + cam.file + " right is mirrored. Expected " + HANDEDNESS.right);
  }
}

function readInstance(inst) {
  let x = 0;
  let y = 0;
  let z = 0;
  if (Array.isArray(inst.position)) {
    if (inst.position.length === 2) {
      x = inst.position[0];
      z = inst.position[1];
      y = inst.base_y_m || 0;
    } else {
      x = inst.position[0];
      y = inst.position[1];
      z = inst.position[2];
    }
  } else {
    x = inst.x || 0;
    y = inst.y || inst.base_y_m || 0;
    z = inst.z || 0;
  }
  return {
    id: inst.id || "",
    x, y, z,
    yaw: inst.yawDeg ?? inst.yaw_deg ?? 0,
    scale: inst.scale ?? 1,
  };
}

function yawMatrix(x, y, z, yawDeg, scale) {
  const a = (yawDeg * Math.PI) / 180;
  const c = Math.cos(a) * scale;
  const s = Math.sin(a) * scale;
  return new Float32Array([
    c, 0, -s, 0,
    0, scale, 0, 0,
    s, 0, c, 0,
    x, y, z, 1,
  ]);
}

const zVS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
uniform vec3 uEye, uRight, uUp, uForward;
uniform float uFovY;
uniform vec2 uSize;
out float vZ;
void main() {
  vec3 rel = aPos - uEye;
  float z = dot(rel, uForward);
  float x = dot(rel, uRight);
  float y = dot(rel, uUp);
  float fy = (uSize.y * 0.5) / tan(radians(uFovY) * 0.5);
  float u = (uSize.x - 1.0) * 0.5 + fy * (x / max(z, 1e-4));
  float v = (uSize.y - 1.0) * 0.5 - fy * (y / max(z, 1e-4));
  float ndcX = ((u + 0.5) / uSize.x) * 2.0 - 1.0;
  float ndcY = 1.0 - ((v + 0.5) / uSize.y) * 2.0;
  float ndcZ = clamp((z - 0.02) / (16.0 - 0.02), 0.0, 1.0) * 2.0 - 1.0;
  gl_Position = vec4(ndcX * (z > 0.0 ? 1.0 : 0.0), ndcY, ndcZ, z > 0.0 ? 1.0 : 0.0);
  vZ = z;
}`;

const zFS = `#version 300 es
precision highp float;
in float vZ;
out vec4 o;
void main() {
  float n = clamp(vZ / 16.0, 0.0, 1.0);
  float e = n * 16777215.0;
  float r = floor(mod(e, 256.0));
  float g = floor(mod(floor(e / 256.0), 256.0));
  float b = floor(mod(floor(e / 65536.0), 256.0));
  o = vec4(r, g, b, 255.0) / 255.0;
}`;

const cVS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in mat4 aModel;
uniform mat4 uVP;
out vec3 vLocal;
out vec3 vNrm;
void main() {
  gl_Position = uVP * aModel * vec4(aPos, 1.0);
  vLocal = aPos;
  vNrm = aNrm;
}`;

const cFS = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2DArray;
uniform highp sampler2DArray uViews;
uniform highp sampler2DArray uDepth;
uniform int uViewCount;
uniform vec3 uCamPos[8];
uniform vec3 uCamRight[8];
uniform vec3 uCamUp[8];
uniform vec3 uCamForward[8];
uniform float uFov[8];
uniform vec2 uViewSize[8];
uniform float uBias;
uniform float uSeam;
uniform int uMode;
uniform vec3 uId;
in vec3 vLocal;
in vec3 vNrm;
out vec4 o;
float unpack(vec4 c) {
  float e = c.r * 255.0 + c.g * 255.0 * 256.0 + c.b * 255.0 * 65536.0;
  return e / 16777215.0 * 16.0;
}
void project(int i, vec3 p, out vec2 uv, out float z) {
  vec3 rel = p - uCamPos[i];
  z = dot(rel, uCamForward[i]);
  float x = dot(rel, uCamRight[i]);
  float y = dot(rel, uCamUp[i]);
  vec2 sz = uViewSize[i];
  float fy = (sz.y * 0.5) / tan(radians(uFov[i]) * 0.5);
  uv.x = (sz.x - 1.0) * 0.5 + fy * (x / max(z, 1e-4));
  uv.y = (sz.y - 1.0) * 0.5 - fy * (y / max(z, 1e-4));
}
void main() {
  vec3 n = normalize(vNrm);
  float bestW = -1.0;
  int bestI = 0;
  float secondW = -1.0;
  int secondI = -1;
  float faceW = -1.0;
  int faceI = 0;
  bool anyVis = false;
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
    bool inside = z > 0.0001 && px.x >= 0 && px.y >= 0 && px.x < int(sz.x) && px.y < int(sz.y);
    bool mask = false;
    bool occ = false;
    if (inside) {
      vec4 src = texelFetch(uViews, ivec3(px, i), 0);
      mask = src.a > 0.5;
      float zRef = unpack(texelFetch(uDepth, ivec3(px, i), 0));
      occ = z <= zRef + uBias;
    }
    float wv = (inside && mask && occ && w > 0.0) ? w : 0.0;
    if (wv > 0.0) anyVis = true;
    if (wv > bestW) {
      secondW = bestW; secondI = bestI;
      bestW = wv; bestI = i;
    } else if (wv > secondW) {
      secondW = wv; secondI = i;
    }
  }
  if (!anyVis) { bestI = faceI; bestW = 0.0; secondW = -1.0; secondI = -1; }
  vec2 uv; float z;
  project(bestI, vLocal, uv, z);
  ivec2 px = ivec2(int(floor(uv.x + 0.5)), int(floor(uv.y + 0.5)));
  vec2 sz = uViewSize[bestI];
  px = clamp(px, ivec2(0), ivec2(int(sz.x) - 1, int(sz.y) - 1));
  vec4 src = texelFetch(uViews, ivec3(px, bestI), 0);
  if (src.a < 0.5) discard;
  vec3 col = src.rgb;
  if (secondW > 0.0 && bestW > 0.0 && secondW / max(bestW, 1e-6) >= uSeam) {
    vec2 uv2; float z2;
    project(secondI, vLocal, uv2, z2);
    ivec2 px2 = ivec2(int(floor(uv2.x + 0.5)), int(floor(uv2.y + 0.5)));
    vec2 sz2 = uViewSize[secondI];
    px2 = clamp(px2, ivec2(0), ivec2(int(sz2.x) - 1, int(sz2.y) - 1));
    vec4 sec = texelFetch(uViews, ivec3(px2, secondI), 0);
    if (sec.a > 0.5) {
      float m = bestW / max(bestW + secondW, 1e-6);
      col = col * m + sec.rgb * (1.0 - m);
    }
  }
  if (uMode == 1) o = vec4(uId, 1.0);
  else o = vec4(col, 1.0);
}`;

export async function mountHull(gl, assetUrl) {
  const folder = assetUrl.replace(/\/asset\.json$/, "");
  const asset = await (await fetch(assetUrl)).json();
  if (asset.handedness && asset.handedness.right && asset.handedness.right !== HANDEDNESS.right) {
    throw new Error("handedness contract " + asset.handedness.right);
  }
  const meshBuf = await (await fetch(folder + "/" + ((asset.files && asset.files.mesh) || "mesh.bin"))).arrayBuffer();
  const mesh = parseMesh(meshBuf);
  const cams = (asset.cameras || []).filter((cam) => (cam.group || "body") === "body").slice(0, MAX_VIEWS);
  if (!cams.length) throw new Error("hull has no cameras");
  for (const cam of cams) assertCamera(cam);

  const images = [];
  let maxW = 1;
  let maxH = 1;
  for (const cam of cams) {
    const img = await rgbaOf(folder + "/views/" + cam.file);
    images.push(img);
    maxW = Math.max(maxW, img.w);
    maxH = Math.max(maxH, img.h);
  }

  const savedViewport = gl.getParameter(gl.VIEWPORT);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

  const viewsTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, viewsTex);
  gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, maxW, maxH, cams.length);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, img.w, img.h, 1, gl.RGBA, gl.UNSIGNED_BYTE, img.data);
  }

  const depthTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, depthTex);
  gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, maxW, maxH, cams.length);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

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
  gl.bufferData(gl.ARRAY_BUFFER, inter, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

  const instBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
  const ident = yawMatrix(0, 0, 0, 0, 1);
  gl.bufferData(gl.ARRAY_BUFFER, ident, gl.STATIC_DRAW);
  for (let col = 0; col < 4; col++) {
    gl.enableVertexAttribArray(2 + col);
    gl.vertexAttribPointer(2 + col, 4, gl.FLOAT, false, 64, col * 16);
    gl.vertexAttribDivisor(2 + col, 1);
  }

  const zProg = program(gl, zVS, zFS);
  const cProg = program(gl, cVS, cFS);
  const fbo = gl.createFramebuffer();
  const rb = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, maxW, maxH);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
  gl.useProgram(zProg);
  gl.bindVertexArray(vao);
  gl.enable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  for (let i = 0; i < cams.length; i++) {
    const cam = cams[i];
    gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, depthTex, 0, i);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error("hull depth fbo " + i);
    }
    gl.viewport(0, 0, cam.width, cam.height);
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform3fv(gl.getUniformLocation(zProg, "uEye"), cam.position);
    gl.uniform3fv(gl.getUniformLocation(zProg, "uRight"), cam.right);
    gl.uniform3fv(gl.getUniformLocation(zProg, "uUp"), cam.up);
    gl.uniform3fv(gl.getUniformLocation(zProg, "uForward"), cam.forward);
    gl.uniform1f(gl.getUniformLocation(zProg, "uFovY"), cam.fovYDeg);
    gl.uniform2f(gl.getUniformLocation(zProg, "uSize"), cam.width, cam.height);
    gl.drawElements(gl.TRIANGLES, mesh.ic, gl.UNSIGNED_INT, 0);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(fbo);
  gl.deleteRenderbuffer(rb);
  gl.bindVertexArray(null);
  gl.viewport(savedViewport[0], savedViewport[1], savedViewport[2], savedViewport[3]);

  const loc = {
    vp: gl.getUniformLocation(cProg, "uVP"),
    views: gl.getUniformLocation(cProg, "uViews"),
    depth: gl.getUniformLocation(cProg, "uDepth"),
    count: gl.getUniformLocation(cProg, "uViewCount"),
    pos: gl.getUniformLocation(cProg, "uCamPos"),
    right: gl.getUniformLocation(cProg, "uCamRight"),
    up: gl.getUniformLocation(cProg, "uCamUp"),
    fwd: gl.getUniformLocation(cProg, "uCamForward"),
    fov: gl.getUniformLocation(cProg, "uFov"),
    size: gl.getUniformLocation(cProg, "uViewSize"),
    bias: gl.getUniformLocation(cProg, "uBias"),
    seam: gl.getUniformLocation(cProg, "uSeam"),
    mode: gl.getUniformLocation(cProg, "uMode"),
    id: gl.getUniformLocation(cProg, "uId"),
  };
  const pos = [];
  const right = [];
  const up = [];
  const fwd = [];
  const fov = [];
  const sz = [];
  for (const cam of cams) {
    pos.push(...cam.position);
    right.push(...cam.right);
    up.push(...cam.up);
    fwd.push(...cam.forward);
    fov.push(cam.fovYDeg);
    sz.push(cam.width, cam.height);
  }
  while (pos.length < MAX_VIEWS * 3) {
    pos.push(0, 0, 1);
    right.push(1, 0, 0);
    up.push(0, 1, 0);
    fwd.push(0, 0, -1);
    fov.push(40);
    sz.push(1, 1);
  }
  const bias = 2.5 * Math.min(...(asset.voxelSize || [0.05]));
  const footRadius = (asset.footprint && asset.footprint.radius_m) || (asset.placement && asset.placement.collisionRadius) || 0.5;
  let instances = [];
  let instanceCount = 1;

  function setInstances(list) {
    const rows = (list || []).map(readInstance);
    instances = rows;
    instanceCount = rows.length;
    const data = new Float32Array(Math.max(1, instanceCount) * 16);
    rows.forEach((row, i) => data.set(yawMatrix(row.x, row.y, row.z, row.yaw, row.scale), i * 16));
    gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  }

  function draw(vp, mode, idRgb) {
    if (!instanceCount) return;
    gl.useProgram(cProg);
    gl.bindVertexArray(vao);
    gl.uniformMatrix4fv(loc.vp, false, vp);
    gl.uniform1i(loc.count, cams.length);
    gl.uniform3fv(loc.pos, pos);
    gl.uniform3fv(loc.right, right);
    gl.uniform3fv(loc.up, up);
    gl.uniform3fv(loc.fwd, fwd);
    gl.uniform1fv(loc.fov, fov);
    gl.uniform2fv(loc.size, sz);
    gl.uniform1f(loc.bias, bias);
    gl.uniform1f(loc.seam, asset.seamRatio || 0.65);
    gl.uniform1i(loc.mode, mode | 0);
    const id = idRgb || [1, 1, 1];
    gl.uniform3f(loc.id, id[0], id[1], id[2]);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, viewsTex);
    gl.uniform1i(loc.views, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, depthTex);
    gl.uniform1i(loc.depth, 1);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.drawElementsInstanced(gl.TRIANGLES, mesh.ic, gl.UNSIGNED_INT, 0, instanceCount);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
  }

  function colliders() {
    return instances.map((row) => ({
      id: row.id,
      center: [row.x, row.z],
      radius_m: footRadius * (row.scale || 1),
      source: "hull-footprint",
    }));
  }

  setInstances([]);

  return {
    draw,
    setInstances,
    collide(x, z, heroR) {
      return blockedBy(x, z, heroR || 0, colliders());
    },
    colliders,
    footprintRadius: footRadius,
    refusesRingWall(zoneCenter, ringRadius) {
      return isRingWall(zoneCenter, ringRadius, colliders());
    },
    minY: mesh.minY,
    maxY: mesh.maxY,
    halfExtent: asset.halfExtent,
    approach: asset.approach && asset.approach.minDistance ? asset.approach.minDistance : 8,
    vertexCount: mesh.vc,
    instanceCount: () => instanceCount,
  };
}

/** One mount per asset url. Instances carry every copy of that solid. */
export async function mountSolids(gl, entries) {
  const out = [];
  for (const entry of entries) {
    const hull = await mountHull(gl, entry.url || entry.asset);
    hull.setInstances(entry.instances || []);
    out.push(hull);
  }
  return out;
}

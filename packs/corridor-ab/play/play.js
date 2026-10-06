/**
 * Walk the hung corridor with zone A's look, sky, and solids.
 * The corridor solve stays at load. Hulls and lofts stream ahead while Bolt runs.
 */

window.addEventListener("error", (event) => {
  document.title = "ERR " + (event.message || "error");
});
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  document.title = "REJ " + (reason && reason.message ? reason.message : reason);
});

import { createFlow, BOLT_GALLOP, BOLT_IDLE } from "../../../biome/scripts/zone-flow/zoneFlow.mjs";
import { poseOnCorridor } from "./place.js";
import {
  CHASE_BOOM,
  CHASE_EYE,
  CHASE_SLIDE,
  chasePitch,
  chaseViewInto,
  createLook,
  endLook,
  PAW_FRAC_FALLBACK,
  pitchOf,
  pushLook,
  stepLook,
  TURN_DPS,
  wrap360,
} from "./look.js";
import { pushDiscs, RUN_YAW } from "./scatter.js";
import { POOL, RISE_M, createField, rockCount, settleField, stepField } from "./stream.js";
import { mountSky } from "./sky.js";
import { mountRuins } from "../../zone-a/play/ruins.js";
import { loadWorldHull } from "../../zone-a/play/hullmesh.js";

const params = new URLSearchParams(location.search);
const shot = params.get("shot");
const debug = params.get("debug") === "1";
const shotDeg = Number(params.get("deg") || 90);
const shotAt = Number(params.get("at") || 0.5);
const shotTilt = shot === "tilt" || params.get("tilt") === "1";
const HFOV = 22.7 * Math.PI / 180;
const ASPECT = 720 / 1600;
const VFOV = 2 * Math.atan(Math.tan(HFOV / 2) / ASPECT);
const BOLT_H = 2.15;

const canvas = document.getElementById("view");
const hud = document.getElementById("hud");
const stick = document.getElementById("stick");
const nub = document.getElementById("nub");
canvas.width = 720;
canvas.height = 1600;
if (debug) hud.style.display = "block";
if (shot && stick) stick.style.display = "none";

const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, preserveDrawingBuffer: true });
if (!gl) throw new Error("webgl2 missing");

function absUrl(path) {
  const text = String(path || "");
  return text.startsWith("/") ? text : "/" + text.replace(/^\.\//, "");
}

const world = await fetch("../world.json").then((r) => r.json());
const layout = await fetch("../path-layout.json").then((r) => r.json());
const zones = {};
for (const [id, listed] of Object.entries(world.zones)) {
  const name = listed.split("/").pop();
  zones[id] = await fetch("../" + name).then((r) => r.json());
}
const flow = createFlow(world, { zones });
const corridor = layout.corridors[0];
const tileM = layout.grid.tile_m;
const seed = Number(params.get("seed") || layout.seed || 1);

let texBytes = 0;
function trackTex(id, bytes) {
  texBytes += Number(bytes) || 0;
}

const sky = await mountSky(gl, {
  absUrl,
  viewW: 720,
  viewH: 1600,
  hfov: HFOV,
  vfov: VFOV,
});
texBytes += sky.texBytes;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(url));
    img.src = url;
  });
}

const assets = [];
const layerOf = new Map();
for (const cell of layout.grid.cells) {
  if (!layerOf.has(cell.asset)) {
    layerOf.set(cell.asset, assets.length);
    assets.push(cell.asset);
  }
}
const images = [];
for (let i = 0; i < assets.length; i++) images.push(await loadImage(absUrl(assets[i])));
let maxW = 2;
let maxH = 2;
for (const img of images) {
  maxW = Math.max(maxW, img.width);
  maxH = Math.max(maxH, img.height);
}
const groundLevels = Math.floor(Math.log2(Math.max(maxW, maxH))) + 1;
const groundTex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D_ARRAY, groundTex);
gl.texStorage3D(gl.TEXTURE_2D_ARRAY, groundLevels, gl.RGBA8, maxW, maxH, images.length);
gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
const aniso = gl.getExtension("EXT_texture_filter_anisotropic");
if (aniso) {
  const maxA = gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 1;
  gl.texParameterf(gl.TEXTURE_2D_ARRAY, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, maxA));
}
gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
for (let i = 0; i < images.length; i++) {
  const img = images[i];
  const scratch = document.createElement("canvas");
  scratch.width = img.width;
  scratch.height = img.height;
  const ctx = scratch.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const pixels = new Uint8Array(ctx.getImageData(0, 0, img.width, img.height).data.buffer);
  gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, img.width, img.height, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
}
gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
texBytes += Math.ceil(maxW * maxH * 4 * images.length * 4 / 3);

const solved = new Map();
const fillLayers = [];
for (const cell of layout.grid.cells) {
  solved.set(cell.x + "," + cell.y, layerOf.get(cell.asset));
  if (cell.role === "fill") {
    const layer = layerOf.get(cell.asset);
    if (!fillLayers.includes(layer)) fillLayers.push(layer);
  }
}
if (!fillLayers.length) fillLayers.push(0);

function hash2(ix, iz) {
  let n = (ix * 374761393 + iz * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

const xStart = corridor.waypoints[0][0];
const xEnd = corridor.waypoints[corridor.waypoints.length - 1][0];
const pathZ = corridor.waypoints[0][1];
const ix0 = Math.floor((xStart - 40) / tileM);
const ix1 = Math.floor((xEnd + 160) / tileM);
const iz0 = Math.floor((pathZ - 70) / tileM);
const iz1 = Math.floor((pathZ + 70) / tileM);
const groundInst = new Float32Array((ix1 - ix0 + 1) * (iz1 - iz0 + 1) * 3);
let gk = 0;
for (let iz = iz0; iz <= iz1; iz++) {
  for (let ix = ix0; ix <= ix1; ix++) {
    const col = Math.floor(ix);
    const row = Math.floor(iz);
    const known = solved.get(col + "," + row);
    const layer = known == null ? fillLayers[Math.floor(hash2(ix, iz) * fillLayers.length) % fillLayers.length] : known;
    groundInst[gk++] = (ix + 0.5) * tileM;
    groundInst[gk++] = (iz + 0.5) * tileM;
    groundInst[gk++] = layer;
  }
}
const groundCount = gk / 3;

const GROUND_VS = `#version 300 es
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
}`;
const GROUND_FS = `#version 300 es
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray uTex;
in vec2 vUv;
flat in float vLayer;
out vec4 o;
void main() {
  o = vec4(texture(uTex, vec3(vUv, vLayer)).rgb, 1.0);
}`;
const BOLT_VS = `#version 300 es
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
}`;
const BOLT_FS = `#version 300 es
precision highp float;
uniform sampler2D uTex;
in vec2 vUv;
out vec4 o;
void main() {
  vec4 c = texture(uTex, vUv);
  if (c.g - max(c.r, c.b) > 0.027) discard;
  o = vec4(c.rgb, 1.0);
}`;

function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "shader");
  return shader;
}
function link(vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "link");
  return p;
}
const groundProg = link(GROUND_VS, GROUND_FS);
const boltProg = link(BOLT_VS, BOLT_FS);
const gLoc = {
  vp: gl.getUniformLocation(groundProg, "uVP"),
  tile: gl.getUniformLocation(groundProg, "uTile"),
  tex: gl.getUniformLocation(groundProg, "uTex"),
};
const bLoc = {
  vp: gl.getUniformLocation(boltProg, "uVP"),
  right: gl.getUniformLocation(boltProg, "uRight"),
  up: gl.getUniformLocation(boltProg, "uUp"),
  center: gl.getUniformLocation(boltProg, "uCenter"),
  size: gl.getUniformLocation(boltProg, "uSize"),
  y0: gl.getUniformLocation(boltProg, "uY0"),
  tex: gl.getUniformLocation(boltProg, "uTex"),
};

const corners = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
const groundVao = gl.createVertexArray();
gl.bindVertexArray(groundVao);
const cornerBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuf);
gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
const instBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
gl.bufferData(gl.ARRAY_BUFFER, groundInst, gl.STATIC_DRAW);
gl.enableVertexAttribArray(1);
gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 12, 0);
gl.vertexAttribDivisor(1, 1);
gl.enableVertexAttribArray(2);
gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 12, 8);
gl.vertexAttribDivisor(2, 1);
gl.bindVertexArray(null);

const boltVao = gl.createVertexArray();
gl.bindVertexArray(boltVao);
const boltCorners = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, boltCorners);
gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
gl.bindVertexArray(null);

const field = createField({
  seed,
  x0: xStart,
  pathZ,
});
const rockManifest = await fetch(absUrl("packs/zone-a/src/rocks/manifest.json")).then((r) => r.json());
const hulls = {};
for (const type of ["boulder", "stone"]) {
  const spec = rockManifest.types[type];
  const file = rockManifest.assets[type];
  hulls[type] = await loadWorldHull(gl, absUrl(file), trackTex, { maxH: spec.maxTex || 512 });
}
const poses = {
  arch: { x: 0, z: pathZ, scale: 0, rise: 0 },
  gate: { x: 0, z: pathZ, scale: 0, rise: 0 },
  wreck: { x: 0, z: pathZ, scale: 0, rise: 0 },
};
const ruins = await mountRuins(gl, {
  absUrl,
  loadImage,
  trackTex,
  heightAt: () => 0,
  placements: {
    arch: { x: 0, z: pathZ, yaw: RUN_YAW },
    gate: { x: 0, z: pathZ, yaw: RUN_YAW },
    wreck: { x: 0, z: pathZ, yaw: RUN_YAW },
  },
});
ruins.setPoses(poses);

function openingClear(mon) {
  if (!mon || !(mon.scale > 0.85)) return false;
  const slid = ruins.collide(mon.x - 2.5, mon.z, mon.x + 2.5, mon.z, 0.3);
  return Math.abs(slid.z - mon.z) < 0.45 && slid.x > mon.x;
}
function pierBlocks(mon) {
  if (!mon || !(mon.scale > 0.85)) return false;
  const side = mon.z + 1.8;
  const slid = ruins.collide(mon.x - 1, side, mon.x + 1, side, 0.3);
  return slid.contact || Math.abs(slid.z - side) > 0.12;
}
let archOpen = false;
let archPier = false;

const discBuf = new Array(POOL);
for (let i = 0; i < POOL; i++) discBuf[i] = { x: 0, z: 0, r: 0 };
let discN = 0;

function applyPoses() {
  const names = ["arch", "gate", "wreck"];
  for (let i = 0; i < names.length; i++) {
    const slot = field[names[i]];
    const pose = poses[names[i]];
    if (!slot || slot.emerge < 0.02) {
      pose.scale = 0;
      pose.rise = -40;
      continue;
    }
    pose.x = slot.x;
    pose.z = slot.z;
    pose.scale = slot.emerge;
    pose.rise = (slot.emerge - 1) * RISE_M;
  }
}

function syncRocks() {
  hulls.boulder.reset();
  hulls.stone.reset();
  discN = 0;
  for (let i = 0; i < field.pool.length; i++) {
    const slot = field.pool[i];
    if (!slot.on || slot.kind > 2 || slot.emerge < 0.02) continue;
    const type = slot.kind === 2 ? "boulder" : "stone";
    const hull = hulls[type];
    const spec = rockManifest.types[type];
    const meshH = Math.max(0.05, hull.maxY - hull.minY);
    const drawScale = (spec.objectSize[1] * slot.base * slot.emerge) / meshH;
    const y = -hull.minY * drawScale + (slot.emerge - 1) * RISE_M;
    hull.addInstance(slot.x, y, slot.z, slot.yaw, drawScale, 0);
    if (slot.emerge >= 0.35 && discN < discBuf.length) {
      const disc = discBuf[discN];
      disc.x = slot.x;
      disc.z = slot.z;
      disc.r = 0.5 * Math.hypot(spec.objectSize[0], spec.objectSize[2]) * drawScale;
      discN += 1;
    }
  }
  for (let i = discN; i < discBuf.length; i++) discBuf[i].r = 0;
  hulls.boulder.upload();
  hulls.stone.upload();
}

const idle = document.createElement("video");
idle.muted = true;
idle.loop = true;
idle.playsInline = true;
idle.preload = "auto";
idle.src = absUrl(BOLT_IDLE);
const gallop = document.createElement("video");
gallop.muted = true;
gallop.loop = true;
gallop.playsInline = true;
gallop.preload = "auto";
const boltTex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, boltTex);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
let boltStamp = -1;
let boltReady = false;
idle.addEventListener("loadeddata", () => { boltReady = true; });
idle.play().catch(() => {});

function videoOn(v) {
  return !!(v && v.src && !v.paused && v.readyState >= 2);
}
function activeBolt() {
  return videoOn(gallop) ? gallop : idle;
}
const paceShot = shot === "walk" || shot === "sprint";
function useBolt(moving) {
  if (shot && !paceShot && shot !== "film") return;
  const want = moving ? gallop : idle;
  const other = moving ? idle : gallop;
  if (moving && !gallop.src) gallop.src = absUrl(BOLT_GALLOP);
  if (!other.paused) other.pause();
  if (want.paused) want.play().catch(() => {});
}

const startZone = zones[world.start];
let x = startZone.spawn.position[0];
let z = startZone.spawn.position[1];
let heading = startZone.spawn.heading_deg;
let speed = 0;
let prevMode = "zone";
const camLook = createLook();
if (shotTilt) {
  camLook.cur = 1.05;
  camLook.goal = 1.05;
}
const state = { forward: 0, turn: 0, gallop: false };
let lastSample = null;

function flowSpeed() {
  if (!(speed > 0.05)) return 0;
  const yaw = heading * Math.PI / 180;
  const along = Math.sin(yaw) * speed;
  const onPath = Math.abs(z - pathZ) < 8 && x > xStart - 4 && x < xEnd + 4;
  return onPath && along > 0.2 ? along : 0;
}

function stepFlow(dt, walk) {
  const sample = flow.step({
    dt,
    x,
    z,
    heading,
    speed: walk,
    hitchMs: Math.min(1000, dt * 1000),
    black: false,
  });
  if (sample.mode === "zone" && prevMode !== "zone" && sample.zoneId && sample.zoneId !== world.start) {
    const gate = (zones[sample.zoneId].gates || [])[0];
    if (gate && gate.position) {
      x = gate.position[0];
      z = gate.position[1];
      heading = wrap360(Number(gate.heading_deg) + 180);
    }
  }
  prevMode = sample.mode;
  lastSample = sample;
  return sample;
}

function moveBody(dt) {
  const filming = shot === "film";
  if (shot && !filming) return;
  if (filming) {
    state.forward = 1;
    state.gallop = true;
    state.turn = 0;
  }
  stepLook(camLook, dt);
  const fwdIn = Math.abs(state.forward) < 0.04 ? 0 : state.forward;
  heading = wrap360(heading + state.turn * TURN_DPS * dt);
  stepField(field, { x, z, heading, forward: fwdIn, gallop: state.gallop }, dt);
  speed = field.speed;
  applyPoses();
  syncRocks();
  const yaw = heading * Math.PI / 180;
  const nx = x + Math.sin(yaw) * speed * dt;
  const nz = z + Math.cos(yaw) * speed * dt;
  const slid = ruins.collide(x, z, nx, nz, 0.3);
  const pushed = pushDiscs(slid.x, slid.z, discBuf, 0.3);
  x = pushed.x;
  z = pushed.z;
  archOpen = openingClear(poses.arch);
  archPier = pierBlocks(poses.arch);
  useBolt(speed > 0.05);
}

function pumpAlong(target) {
  for (let i = 0; i < 8000; i += 1) {
    const sample = stepFlow(0.05, 4);
    if (sample.mode === "corridor") {
      const pose = poseOnCorridor(corridor.waypoints, corridor.length_m, Math.min(target, sample.along));
      x = pose.x;
      z = pose.z;
      heading = 90;
      if (sample.along >= target) return;
    } else {
      const pose = poseOnCorridor(corridor.waypoints, corridor.length_m, 0);
      const dx = pose.x - x;
      const dz = pose.z - z;
      const dist = Math.hypot(dx, dz) || 1;
      heading = wrap360((Math.atan2(dx, dz) * 180) / Math.PI);
      x += (dx / dist) * 0.2;
      z += (dz / dist) * 0.2;
    }
  }
}

if (paceShot || shot === "film") {
  x = xStart + 6;
  z = pathZ;
  heading = 90;
  if (paceShot) {
    settleField(field, { x, z, heading, forward: 1, gallop: shot === "sprint" }, shot);
    speed = field.speed;
    useBolt(shot === "sprint");
  }
  applyPoses();
  syncRocks();
  archOpen = openingClear(poses.arch);
  archPier = pierBlocks(poses.arch);
  stepFlow(0, 0);
} else if (shot) {
  pumpAlong(corridor.length_m * Math.min(0.92, Math.max(0.05, shotAt)));
  heading = wrap360(shotDeg);
  speed = 0;
  settleField(field, { x, z, heading, forward: 1, gallop: false }, "walk");
  applyPoses();
  syncRocks();
  stepFlow(0, 0);
} else {
  stepFlow(0, 0);
  stepField(field, { x, z, heading, forward: 0, gallop: false }, 0);
  applyPoses();
  syncRocks();
}

function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}
function lookAt(eye, target, up) {
  let zx = eye[0] - target[0];
  let zy = eye[1] - target[1];
  let zz = eye[2] - target[2];
  let zl = Math.hypot(zx, zy, zz) || 1;
  zx /= zl; zy /= zl; zz /= zl;
  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  let xl = Math.hypot(xx, xy, xz) || 1;
  xx /= xl; xy /= xl; xz /= xl;
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  return new Float32Array([
    xx, yx, zx, 0,
    xy, yy, zy, 0,
    xz, yz, zz, 0,
    -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
    -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
    -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
    1,
  ]);
}
const projBuf = new Float32Array(16);
const viewBuf = new Float32Array(16);
const vpBuf = new Float32Array(16);
const eyeBuf = [0, 0, 0];
const aimBuf = [0, 0, 0];
function perspectiveInto(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  projBuf[0] = f / aspect; projBuf[1] = 0; projBuf[2] = 0; projBuf[3] = 0;
  projBuf[4] = 0; projBuf[5] = f; projBuf[6] = 0; projBuf[7] = 0;
  projBuf[8] = 0; projBuf[9] = 0; projBuf[10] = (far + near) * nf; projBuf[11] = -1;
  projBuf[12] = 0; projBuf[13] = 0; projBuf[14] = 2 * far * near * nf; projBuf[15] = 0;
  return projBuf;
}
function mulInto(a, b) {
  for (let c = 0; c < 4; c += 1) {
    for (let r = 0; r < 4; r += 1) {
      vpBuf[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return vpBuf;
}

let drawCalls = 0;
let jsMs = 0;
let skyTop = 0;
let skyMid = 0;
let settled = false;
let pawFrac = PAW_FRAC_FALLBACK;
let pawGallop = 0;
let pawY = 0;
let pawIdleMeasured = false;
let pawGallopMeasured = false;

function measurePaw(video) {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!(w > 2 && h > 2)) return pawFrac;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(video, 0, 0);
  const d = g.getImageData(0, 0, w, h).data;
  let maxY = 0;
  for (let y = 0; y < h; y += 2) {
    for (let x0 = 0; x0 < w; x0 += 4) {
      const o = (y * w + x0) * 4;
      const r = d[o];
      const gg = d[o + 1];
      const b = d[o + 2];
      if (gg - Math.max(r, b) > 40 && gg > 70) continue;
      if (r + gg + b < 30) continue;
      if (y > maxY) maxY = y;
    }
  }
  return maxY > 0 ? maxY / h : pawFrac;
}

function meanLuma(x0, y0, w, h) {
  const buf = new Uint8Array(w * h * 4);
  gl.readPixels(x0, y0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  let s = 0;
  const n = w * h;
  for (let i = 0; i < buf.length; i += 4) s += buf[i] * 0.299 + buf[i + 1] * 0.587 + buf[i + 2] * 0.114;
  return s / n;
}

function frame() {
  const t0 = performance.now();
  drawCalls = 0;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const yaw = heading * Math.PI / 180;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const rx = fz;
  const rz = -fx;
  eyeBuf[0] = x - fx * CHASE_BOOM + rx * CHASE_SLIDE;
  eyeBuf[1] = CHASE_EYE;
  eyeBuf[2] = z - fz * CHASE_BOOM + rz * CHASE_SLIDE;
  const pitch = pitchOf(chasePitch(), camLook.cur);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  aimBuf[0] = eyeBuf[0] + fx * cp * 12;
  aimBuf[1] = eyeBuf[1] + sp * 12;
  aimBuf[2] = eyeBuf[2] + fz * cp * 12;
  chaseViewInto(viewBuf, eyeBuf, aimBuf);
  const vp = mulInto(perspectiveInto(VFOV, canvas.width / canvas.height, 0.08, 400), viewBuf);
  drawCalls += sky.draw(vp, eyeBuf, yaw);

  gl.useProgram(groundProg);
  gl.bindVertexArray(groundVao);
  gl.uniformMatrix4fv(gLoc.vp, false, vp);
  gl.uniform1f(gLoc.tile, tileM);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, groundTex);
  gl.uniform1i(gLoc.tex, 0);
  gl.disable(gl.BLEND);
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(true);
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, groundCount);
  drawCalls += 1;

  ruins.draw(vp, 0);
  drawCalls += ruins.draws || 0;
  hulls.boulder.draw(vp, 0);
  drawCalls += 1;
  hulls.stone.draw(vp, 0);
  drawCalls += 1;

  const clip = activeBolt();
  if (clip.readyState >= 2) {
    const stamp = clip.currentTime;
    if (stamp !== boltStamp) {
      boltStamp = stamp;
      gl.bindTexture(gl.TEXTURE_2D, boltTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, clip);
    }
    const bw = clip.videoWidth || 768;
    const bh = clip.videoHeight || 1168;
    const worldH = BOLT_H;
    const worldW = worldH * (bw / bh);
    if (clip === idle && !pawIdleMeasured && bw > 2) {
      pawFrac = measurePaw(clip);
      pawIdleMeasured = true;
    }
    if (clip === gallop && !pawGallopMeasured && bw > 2) {
      pawGallop = measurePaw(clip);
      pawGallopMeasured = true;
    }
    const frac = clip === gallop && pawGallop > 0 ? pawGallop : pawFrac;
    const y0 = -(1 - frac) * worldH;
    pawY = y0 + (1 - frac) * worldH;
    gl.useProgram(boltProg);
    gl.bindVertexArray(boltVao);
    gl.uniformMatrix4fv(bLoc.vp, false, vp);
    gl.uniform3f(bLoc.right, rx, 0, rz);
    gl.uniform3f(bLoc.up, 0, 1, 0);
    gl.uniform3f(bLoc.center, x, 0, z);
    gl.uniform2f(bLoc.size, worldW, worldH);
    gl.uniform1f(bLoc.y0, y0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, boltTex);
    gl.uniform1i(bLoc.tex, 0);
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    drawCalls += 1;
    boltReady = true;
  }

  const sample = lastSample || { mode: "zone", along: 0, rate: 0, bolt: "IDLE", zoneId: world.start };
  const activeVideos = sky.activeVideos() + (videoOn(idle) ? 1 : 0) + (videoOn(gallop) ? 1 : 0);
  jsMs = performance.now() - t0;
  const glError = gl.getError();
  window.__corridor = {
    ready: boltReady && sky.ready,
    mode: sample.mode,
    zoneId: sample.zoneId,
    along: sample.along,
    rate: sample.rate,
    bolt: sample.bolt,
    boltReady,
    x,
    z,
    heading,
    look: camLook.cur,
    drawCalls,
    texMB: Math.round((texBytes / (1024 * 1024)) * 10) / 10,
    activeVideos,
    jsMs: Math.round(jsMs * 10) / 10,
    glError,
    rocks: rockCount(field),
    live: field.live,
    speed: Math.round(field.speed * 100) / 100,
    charge: Math.round(field.charge * 100) / 100,
    eyeY: eyeBuf[1],
    pawY: Math.round(pawY * 1000) / 1000,
    arch: field.arch ? { x: field.arch.x, z: field.arch.z, emerge: field.arch.emerge } : null,
    gate: field.gate ? { x: field.gate.x, z: field.gate.z, emerge: field.gate.emerge } : null,
    wreck: field.wreck ? { x: field.wreck.x, z: field.wreck.z, emerge: field.wreck.emerge } : null,
    archOpen,
    archPier,
    seed,
    lengthM: corridor.length_m,
    skyTop,
    skyMid,
    settled,
    black: false,
  };
  document.title = JSON.stringify(window.__corridor);
  if (debug) {
    hud.textContent = [
      "Perf: drawCalls=" + drawCalls,
      "texMB=" + window.__corridor.texMB,
      "activeVideos=" + activeVideos,
      "jsMs=" + window.__corridor.jsMs,
      "spd " + field.speed.toFixed(2),
      "live " + field.live,
      "hdg " + heading.toFixed(0),
      "look " + camLook.cur.toFixed(2),
    ].join(" ");
  }
}

function sampleSky() {
  skyTop = Math.round(meanLuma(0, canvas.height - 24, canvas.width, 24) * 10) / 10;
  skyMid = Math.round(meanLuma(0, canvas.height - 160, canvas.width, 24) * 10) / 10;
  settled = true;
  window.__corridor.skyTop = skyTop;
  window.__corridor.skyMid = skyMid;
  window.__corridor.settled = true;
  document.title = JSON.stringify(window.__corridor);
}

frame();

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
if (stick && !shot) {
  stick.addEventListener("pointerdown", (e) => {
    stickOn = true;
    try { stick.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ }
    stickAt(e.clientX, e.clientY);
  });
  stick.addEventListener("pointermove", (e) => { if (stickOn) stickAt(e.clientX, e.clientY); });
  stick.addEventListener("pointerup", () => {
    stickOn = false;
    nub.style.left = "40px";
    nub.style.top = "40px";
    state.forward = 0;
    state.turn = 0;
    state.gallop = false;
  });
  stick.addEventListener("pointercancel", () => {
    stickOn = false;
    state.forward = 0;
    state.turn = 0;
    state.gallop = false;
  });
}
function inStick(cx, cy) {
  if (!stick || shot) return false;
  const r = stick.getBoundingClientRect();
  return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
}
canvas.addEventListener("pointerdown", (e) => {
  if (shot || camLook.ptr >= 0) return;
  if (e.target === stick || e.target === nub || inStick(e.clientX, e.clientY)) return;
  camLook.ptr = e.pointerId;
  camLook.drag = true;
  camLook.ly = e.clientY;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ }
});
canvas.addEventListener("pointermove", (e) => {
  if (e.pointerId !== camLook.ptr) return;
  const dy = camLook.ly - e.clientY;
  camLook.ly = e.clientY;
  pushLook(camLook, dy);
});
function stopLook(e) {
  if (e.pointerId !== camLook.ptr) return;
  endLook(camLook);
}
canvas.addEventListener("pointerup", stopLook);
canvas.addEventListener("pointercancel", stopLook);

const keys = new Set();
addEventListener("keydown", (e) => {
  keys.add(e.key.toLowerCase());
  e.preventDefault();
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
function pollKeys() {
  if (stickOn || shot) return;
  let f = 0;
  let t = 0;
  if (keys.has("w") || keys.has("arrowup")) f += 1;
  if (keys.has("s") || keys.has("arrowdown")) f -= 1;
  if (keys.has("a") || keys.has("arrowleft")) t -= 1;
  if (keys.has("d") || keys.has("arrowright")) t += 1;
  state.gallop = keys.has("shift") && f > 0;
  state.forward = f;
  state.turn = t;
}

let then = performance.now();
let shotFrames = 0;
function tick(now) {
  const dt = Math.min(0.05, (now - then) / 1000);
  then = now;
  pollKeys();
  moveBody(dt);
  stepFlow(dt, flowSpeed());
  frame();
  if (shot && shot !== "film") {
    shotFrames += 1;
    if ((!boltReady && shotFrames < 180) || shotFrames < 8) {
      requestAnimationFrame(tick);
      return;
    }
    sampleSky();
    return;
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

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
  CHASE_AIM_Y,
  CHASE_BOOM,
  CHASE_EYE,
  CHASE_SLIDE,
  chasePitch,
  chaseViewInto,
  createLook,
  endLook,
  GATE_TOP,
  PAW_FRAC_FALLBACK,
  CHASE_PITCH_RATE,
  pitchForEye,
  pitchForTall,
  pitchOf,
  pushLook,
  holdBody,
  resetChase,
  stepChase,
  stepLook,
  createChase,
  TURN_DPS,
  wrap360,
} from "./look.js";
import { clearEye, rockShells } from "./mag.js";
import { pushDiscs, RUN_YAW } from "./scatter.js";
import { PASS_BACK, POOL, bindPlan, createField, horizonSeats, rockBottom, rockCount, seatSink, settleField, stepField } from "./stream.js";
import { FOG_FAR, FOG_NEAR, groundRectFor } from "./ground.js";
import { DEFAULT_POST, POST_LIMITS } from "../../zone-a/play/biomeblend.js";
import { cardToPlan } from "../../../tools/adventure/playmap.js";
import { offlineCard } from "../../../tools/adventure/offline.js";
import { loadCatalog, loadLibrary, mountAdventureUi } from "./adventure-ui.js";
import { createQuest, skipToRun, stepQuest } from "./quest.js";
import { mountSky } from "./sky.js";
import { mountRuins } from "../../zone-a/play/ruins.js";
import { loadWorldHull, setHullFog } from "../../zone-a/play/hullmesh.js";

const params = new URLSearchParams(location.search);
const shot = params.get("shot");
const adventureShot = shot === "intro" || shot === "mid" || shot === "adventure";
const adventureBoot = params.get("adventure") === "1" || adventureShot;
const debug = params.get("debug") === "1";
const shotDeg = Number(params.get("deg") || 90);
const shotAt = Number(params.get("at") || 0.5);
const shotTilt = shot === "tilt" || params.get("tilt") === "1";
const HFOV = 22.7 * Math.PI / 180;
const ASPECT = 720 / 1600;
const VFOV = 2 * Math.atan(Math.tan(HFOV / 2) / ASPECT);
const BOLT_H = 2.15;

const PAGE_TITLE = "Boltverse Odyssey";
const canvas = document.getElementById("view");
const hud = document.getElementById("hud");
const stick = document.getElementById("stick");
const nub = document.getElementById("nub");
document.title = PAGE_TITLE;
canvas.width = 720;
canvas.height = 1600;
if (debug) hud.style.display = "block";
if (shot && stick && params.get("stick") !== "1") stick.style.display = "none";

function fitView() {
  const w = Math.max(2, Math.round(canvas.clientWidth || 720));
  const h = Math.max(2, Math.round(canvas.clientHeight || 1600));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

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

// One still for the whole carpet, native 1024², no resize.
// m0 and m1 are darker at the rim than in the core, so a repeat draws a square.
// m3 wraps and the rim matches the core (about 1 luma).
const GROUND_STILL = "packs/zone-a/src/ground/m3.png";
const images = [await loadImage(absUrl(GROUND_STILL))];
const maxW = images[0].width;
const maxH = images[0].height;
const groundLevels = Math.floor(Math.log2(Math.max(maxW, maxH))) + 1;
const groundTex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D_ARRAY, groundTex);
gl.texStorage3D(gl.TEXTURE_2D_ARRAY, groundLevels, gl.RGBA8, maxW, maxH, images.length);
gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
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

const xStart = corridor.waypoints[0][0];
const xEnd = corridor.waypoints[corridor.waypoints.length - 1][0];
const pathZ = corridor.waypoints[0][1];
// One quad, moved with Bolt. The repeat is the sampler, so the tiles do not draw a seam.
const groundRect = new Float32Array(4);

function clampPost(v, key) {
  const lim = POST_LIMITS[key];
  return Math.min(lim[1], Math.max(lim[0], v));
}
const fogK = clampPost(DEFAULT_POST.fogDensity, "fogDensity");
const fogCap = clampPost(DEFAULT_POST.fogCap, "fogCap");
let fogRgb = [0, 0, 0];
let fogOn = 0;
async function sampleSkyFog() {
  const names = ["sky-0.jpg", "sky-4.jpg", "sky-8.jpg"];
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < names.length; i++) {
    let img;
    try {
      img = await loadImage(absUrl("packs/zone-a/src/sky/" + names[i]));
    } catch (err) {
      return;
    }
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g2 = c.getContext("2d", { willReadFrequently: true });
    g2.drawImage(img, 0, 0);
    const y0 = Math.max(0, Math.floor(img.height * 0.78));
    const y1 = Math.min(img.height, Math.ceil(img.height * 0.94));
    const data = g2.getImageData(0, y0, img.width, Math.max(1, y1 - y0)).data;
    for (let p = 0; p < data.length; p += 16) {
      r += data[p];
      g += data[p + 1];
      b += data[p + 2];
      n += 1;
    }
  }
  if (!n) return;
  fogRgb = [r / n / 255, g / n / 255, b / n / 255];
  fogOn = 1;
}
await sampleSkyFog();

const GROUND_VS = `#version 300 es
layout(location=0) in vec2 aCorner;
uniform mat4 uVP;
uniform vec4 uRect;
uniform float uTile;
out vec2 vUv;
out vec2 vXz;
void main() {
  vec2 xz = vec2(mix(uRect.x, uRect.z, aCorner.x), mix(uRect.y, uRect.w, aCorner.y));
  gl_Position = uVP * vec4(xz.x, 0.0, xz.y, 1.0);
  vUv = xz / uTile;
  vXz = xz;
}`;
const GROUND_FS = `#version 300 es
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray uTex;
uniform vec2 uEye;
uniform vec3 uFog;
uniform float uFogK;
uniform float uFogCap;
in vec2 vUv;
in vec2 vXz;
out vec4 o;
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  return vec2(hash12(p), hash12(p + 17.13));
}
void main() {
  // Four windows of the same still, crossfaded, so the still's own rim
  // does not line up into a square every 1.45 m. Every sample is that still.
  vec2 iuv = floor(vUv);
  vec2 fuv = fract(vUv);
  vec2 ddx = dFdx(vUv);
  vec2 ddy = dFdy(vUv);
  vec2 ofa = hash22(iuv);
  vec2 ofb = hash22(iuv + vec2(1.0, 0.0));
  vec2 ofc = hash22(iuv + vec2(0.0, 1.0));
  vec2 ofd = hash22(iuv + vec2(1.0, 1.0));
  vec2 b = smoothstep(vec2(0.25), vec2(0.75), fuv);
  vec3 c00 = textureGrad(uTex, vec3(fuv + ofa, 0.0), ddx, ddy).rgb;
  vec3 c10 = textureGrad(uTex, vec3(fuv + ofb, 0.0), ddx, ddy).rgb;
  vec3 c01 = textureGrad(uTex, vec3(fuv + ofc, 0.0), ddx, ddy).rgb;
  vec3 c11 = textureGrad(uTex, vec3(fuv + ofd, 0.0), ddx, ddy).rgb;
  vec3 col = mix(mix(c00, c10, b.x), mix(c01, c11, b.x), b.y);
  float dist = distance(vXz, uEye);
  float fog = clamp(1.0 - exp(-uFogK * max(0.0, dist - 18.0)), 0.0, uFogCap);
  if (uFogK > 0.0) fog = max(fog, smoothstep(${FOG_NEAR.toFixed(1)}, ${FOG_FAR.toFixed(1)}, dist));
  o = vec4(mix(col, uFog, fog), 1.0);
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
  rect: gl.getUniformLocation(groundProg, "uRect"),
  tile: gl.getUniformLocation(groundProg, "uTile"),
  tex: gl.getUniformLocation(groundProg, "uTex"),
  eye: gl.getUniformLocation(groundProg, "uEye"),
  fog: gl.getUniformLocation(groundProg, "uFog"),
  fogK: gl.getUniformLocation(groundProg, "uFogK"),
  fogCap: gl.getUniformLocation(groundProg, "uFogCap"),
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
let adventureCatalog = null;
let adventureLibrary = null;
let adventurePlan = null;
let adventureQuest = null;
if (adventureBoot) {
  adventureCatalog = await loadCatalog(absUrl);
  adventureLibrary = await loadLibrary(absUrl);
  const card = offlineCard(seed, adventureCatalog);
  adventurePlan = cardToPlan(card, { x0: xStart, pathZ, maxLengthM: corridor.length_m }, adventureCatalog, adventureLibrary);
  bindPlan(field, {
    seed: adventurePlan.seed,
    lengthM: adventurePlan.lengthM,
    objects: adventurePlan.objects,
    density: adventurePlan.density,
  });
  adventureQuest = createQuest(adventurePlan);
  if (shot === "mid") skipToRun(adventureQuest);
}
const rockManifest = await fetch(absUrl("packs/zone-a/src/rocks/manifest.json")).then((r) => r.json());
const hulls = {};
const batches = {};
for (const type of ["boulder", "stone"]) {
  const spec = rockManifest.types[type];
  const file = rockManifest.assets[type];
  hulls[type] = await loadWorldHull(gl, absUrl(file), trackTex, { maxH: spec.maxTex || 512 });
  batches[type] = [hulls[type], hulls[type].forkBatch()];
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
    if (!slot) {
      pose.scale = 0;
      pose.rise = -40;
      continue;
    }
    pose.x = slot.x;
    pose.z = slot.z;
    pose.scale = 1;
    pose.rise = 0;
  }
}

let rockBaseHi = 0;
let rockBaseLo = 0;
let rockBaseN = 0;
function noteBase(y) {
  if (rockBaseN === 0) {
    rockBaseHi = y;
    rockBaseLo = y;
  } else {
    if (y > rockBaseHi) rockBaseHi = y;
    if (y < rockBaseLo) rockBaseLo = y;
  }
  rockBaseN += 1;
}
function placeInstance(type, x, y, z, yaw, scale) {
  const list = batches[type];
  if (list[0].addInstance(x, y, z, yaw, scale, 0)) return;
  list[1].addInstance(x, y, z, yaw, scale, 0);
}
function syncRocks() {
  batches.boulder[0].reset();
  batches.boulder[1].reset();
  batches.stone[0].reset();
  batches.stone[1].reset();
  discN = 0;
  rockBaseN = 0;
  for (let i = 0; i < field.pool.length; i++) {
    const slot = field.pool[i];
    if (!slot.on || slot.kind > 2) continue;
    const type = slot.kind === 2 ? "boulder" : "stone";
    const hull = hulls[type];
    const spec = rockManifest.types[type];
    const meshH = Math.max(0.05, hull.maxY - hull.minY);
    const drawScale = (spec.objectSize[1] * slot.base) / meshH;
    const base = rockBottom();
    const y = base - hull.minY * drawScale;
    noteBase(base);
    placeInstance(type, slot.x, y, slot.z, slot.yaw, drawScale);
    if (discN < discBuf.length) {
      const disc = discBuf[discN];
      disc.x = slot.x;
      disc.z = slot.z;
      disc.r = 0.5 * Math.hypot(spec.objectSize[0], spec.objectSize[2]) * drawScale;
      discN += 1;
    }
  }
  const skyline = horizonSeats(field, x);
  for (let s = 0; s < skyline.length; s++) {
    const seat = skyline[s];
    const type = seat.kind === 2 ? "boulder" : "stone";
    const hull = hulls[type];
    const meshH = Math.max(0.05, hull.maxY - hull.minY);
    const drawScale = seat.height / meshH;
    const base = -seatSink(seat.height);
    const y = base - hull.minY * drawScale;
    noteBase(base);
    placeInstance(type, seat.x, y, seat.z, seat.yaw, drawScale);
  }
  for (let i = discN; i < discBuf.length; i++) discBuf[i].r = 0;
  batches.boulder[0].upload();
  batches.boulder[1].upload();
  batches.stone[0].upload();
  batches.stone[1].upload();
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
const paceShot = shot === "walk" || shot === "sprint" || shot === "rocks";
const filmShot = shot === "film" || shot === "pass";
function useBolt(moving) {
  if (shot && !paceShot && !filmShot) return;
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
const home = { x, z, heading };
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
  const held = holdBody({ x, z, heading }, sample, prevMode, zones, world.start);
  x = held.x;
  z = held.z;
  heading = held.heading;
  prevMode = sample.mode;
  lastSample = sample;
  return sample;
}

let adventureUi = null;
function moveBody(dt) {
  const filming = filmShot || shot === "adventure";
  if (shot && !filming) return;
  if (adventureUi && adventureUi.blocksPlay()) return;
  if (adventureUi && adventureUi.quest && adventureUi.quest.holdMove) return;
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

function standForRocks() {
  settleField(field, { x, z, heading, forward: 1, gallop: true }, "sprint");
  let best = null;
  let bestAhead = 1e9;
  for (let i = 0; i < field.pool.length; i++) {
    const slot = field.pool[i];
    if (!slot.on || slot.kind > 2) continue;
    const ahead = slot.x - x;
    if (ahead < 6 || ahead > 22) continue;
    if (ahead < bestAhead) {
      bestAhead = ahead;
      best = slot;
    }
  }
  if (!best) return;
  x = best.x - 5.5;
  z = best.z;
  settleField(field, { x, z, heading, forward: 1, gallop: false }, "walk");
}

if (shot === "mid" && adventurePlan) {
  x = xStart + adventurePlan.lengthM * 0.42;
  z = pathZ;
  heading = 90;
  settleField(field, { x, z, heading, forward: 1, gallop: true }, "sprint");
  speed = field.speed;
  useBolt(true);
  applyPoses();
  syncRocks();
  stepFlow(0, 0);
} else if (shot === "intro" || shot === "adventure") {
  x = xStart + 4;
  z = pathZ;
  heading = 90;
  settleField(field, { x, z, heading, forward: 1, gallop: false }, "walk");
  speed = 0;
  field.speed = 0;
  useBolt(false);
  applyPoses();
  syncRocks();
  stepFlow(0, 0);
} else if (paceShot || filmShot) {
  x = xStart + 6;
  z = pathZ;
  heading = 90;
  if (shot === "pass") {
    settleField(field, { x, z, heading, forward: 1, gallop: true }, "sprint");
    if (field.gate) x = field.gate.x - PASS_BACK;
    z = pathZ;
    settleField(field, { x, z, heading, forward: 1, gallop: true }, "sprint");
    speed = field.speed;
    useBolt(true);
  } else if (shot === "rocks") {
    standForRocks();
    speed = field.speed;
    useBolt(false);
  } else if (paceShot) {
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
const chase = createChase();
let camDt = 0;
let camSnap = true;

function placeCamera() {
  const yaw = heading * Math.PI / 180;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const rx = fz;
  const rz = -fx;
  const rigid = [
    x - fx * CHASE_BOOM + rx * CHASE_SLIDE,
    CHASE_EYE,
    z - fz * CHASE_BOOM + rz * CHASE_SLIDE,
  ];
  const clearedNow = clearEye(rigid, x, z, rockShells(field.pool), field);
  const aimBoom = Math.hypot(clearedNow[0] - x, clearedNow[2] - z) || CHASE_BOOM;
  let goal = pitchOf(Math.atan2(CHASE_AIM_Y - clearedNow[1], aimBoom), camLook.cur);
  if (field.gate && field.gate.emerge > 0.4) {
    const dx = field.gate.x - rigid[0];
    const dz = field.gate.z - rigid[2];
    const ahead = dx * fx + dz * fz;
    const side = dx * rx + dz * rz;
    if (ahead > 12 && Math.abs(Math.atan2(side, ahead)) < HFOV * 0.5) {
      goal = pitchForTall(goal, GATE_TOP, Math.hypot(ahead, side), VFOV);
    }
  }
  const cleared = clearedNow;
  const still = !!(shot && !filmShot && shot !== "adventure");
  const snap = camSnap || still;
  stepChase(chase, rigid, cleared, goal, camDt, snap, speed, state.turn);
  const boomNow = Math.hypot(chase.eye[0] - x, chase.eye[2] - z) || CHASE_BOOM;
  const held = pitchOf(pitchForEye(chase.eye[1], boomNow), camLook.cur);
  let tall = held;
  if (field.gate && field.gate.emerge > 0.4) {
    const dx = field.gate.x - chase.eye[0];
    const dz = field.gate.z - chase.eye[2];
    const ahead = dx * fx + dz * fz;
    const side = dx * rx + dz * rz;
    if (ahead > 12 && Math.abs(Math.atan2(side, ahead)) < HFOV * 0.5) {
      tall = pitchForTall(held, GATE_TOP, Math.hypot(ahead, side), VFOV);
    }
  }
  let extra = chase.extra || 0;
  const want = tall - held;
  if (snap) extra = want;
  else {
    const de = want - extra;
    const allow = CHASE_PITCH_RATE * (camDt > 0 ? camDt : 1);
    if (Math.abs(de) <= allow) extra = want;
    else extra += Math.sign(de) * allow;
  }
  chase.extra = extra;
  chase.pitch = held + extra;
  chase.tp = chase.pitch;
  eyeBuf[0] = chase.eye[0];
  eyeBuf[1] = chase.eye[1];
  eyeBuf[2] = chase.eye[2];
  if (!still) camSnap = false;
  return { fx, fz, rx, rz, pitch: chase.pitch, yaw };
}
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

let playFrames = 0;
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

function projectScreen(px, py, pz, vp) {
  const cx = vp[0] * px + vp[4] * py + vp[8] * pz + vp[12];
  const cy = vp[1] * px + vp[5] * py + vp[9] * pz + vp[13];
  const cw = vp[3] * px + vp[7] * py + vp[11] * pz + vp[15];
  if (!(Math.abs(cw) > 1e-6)) return null;
  return [(cx / cw + 1) * 0.5, (1 - cy / cw) * 0.5];
}

function frame() {
  const t0 = performance.now();
  drawCalls = 0;
  fitView();
  const span = groundRectFor(x, z);
  groundRect[0] = span[0];
  groundRect[1] = span[1];
  groundRect[2] = span[2];
  groundRect[3] = span[3];
  const cam = placeCamera();
  const fx = cam.fx;
  const fz = cam.fz;
  const rx = cam.rx;
  const rz = cam.rz;
  const pitch = cam.pitch;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  aimBuf[0] = eyeBuf[0] + fx * cp * 12;
  aimBuf[1] = eyeBuf[1] + sp * 12;
  aimBuf[2] = eyeBuf[2] + fz * cp * 12;
  chaseViewInto(viewBuf, eyeBuf, aimBuf);
  const vp = mulInto(perspectiveInto(VFOV, canvas.width / canvas.height, 0.08, 400), viewBuf);
  const bodyScreen = projectScreen(x, 1.05, z, vp);
  if (window.__nodraw) {
    if (window.__corridor) {
      window.__corridor.boltScreen = bodyScreen;
      window.__corridor.x = x;
      window.__corridor.z = z;
      window.__corridor.heading = heading;
      window.__corridor.live = field.live;
      window.__corridor.speed = Math.round(field.speed * 100) / 100;
      window.__corridor.charge = Math.round(field.charge * 100) / 100;
      window.__corridor.eyeY = eyeBuf[1];
      window.__corridor.pitch = pitch;
      window.__corridor.boom = Math.round(Math.hypot(eyeBuf[0] - x, eyeBuf[2] - z) * 1000) / 1000;
      window.__corridor.frameN = playFrames;
    }
    return;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  drawCalls += sky.draw(vp, eyeBuf, cam.yaw);

  gl.useProgram(groundProg);
  gl.bindVertexArray(groundVao);
  gl.uniformMatrix4fv(gLoc.vp, false, vp);
  gl.uniform4fv(gLoc.rect, groundRect);
  gl.uniform1f(gLoc.tile, tileM);
  gl.uniform2f(gLoc.eye, eyeBuf[0], eyeBuf[2]);
  gl.uniform3f(gLoc.fog, fogRgb[0], fogRgb[1], fogRgb[2]);
  gl.uniform1f(gLoc.fogK, fogOn ? fogK : 0);
  gl.uniform1f(gLoc.fogCap, fogCap);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, groundTex);
  gl.uniform1i(gLoc.tex, 0);
  gl.disable(gl.BLEND);
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(true);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  drawCalls += 1;

  const fogKNow = fogOn ? fogK : 0;
  if (ruins.setFog) ruins.setFog(eyeBuf[0], eyeBuf[2], fogRgb, fogKNow, fogCap);
  ruins.draw(vp, 0);
  drawCalls += ruins.draws || 0;
  setHullFog(gl, eyeBuf[0], eyeBuf[2], fogRgb, fogKNow, fogCap);
  drawCalls += batches.boulder[0].draw(vp, 0);
  drawCalls += batches.boulder[1].draw(vp, 0);
  drawCalls += batches.stone[0].draw(vp, 0);
  drawCalls += batches.stone[1].draw(vp, 0);

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
    adventure: adventureUi && adventureUi.quest ? {
      phase: adventureUi.quest.phase,
      title: adventureUi.quest.plan.title,
      found: adventureUi.quest.found.size,
      total: adventureUi.quest.plan.shards.length,
      result: adventureUi.quest.result,
    } : null,
    ground: "m3",
    groundLayers: images.length,
    groundPx: maxW,
    fogOn,
    pitch,
    boom: Math.round(Math.hypot(eyeBuf[0] - x, eyeBuf[2] - z) * 1000) / 1000,
    gateLat: field.gate ? Math.round((field.gate.z - pathZ) * 10) / 10 : null,
    frameN: playFrames,
    skyTop,
    skyMid,
    settled,
    black: false,
  };
  window.__corridor.boltScreen = bodyScreen;
  window.__corridor.view = [canvas.width, canvas.height];
  window.__corridor.rockBaseHi = Math.round(rockBaseHi * 1000) / 1000;
  window.__corridor.rockBaseLo = Math.round(rockBaseLo * 1000) / 1000;
  window.__corridor.rockBaseN = rockBaseN;
  document.title = PAGE_TITLE;
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
  document.title = PAGE_TITLE;
}

function returnHome() {
  x = home.x;
  z = home.z;
  heading = home.heading;
  speed = 0;
  field.speed = 0;
  field.charge = 0;
  resetChase(chase);
}

function stepAdventure(dt) {
  if (!adventureUi || !adventureUi.quest) return;
  if (shot === "intro" || shot === "mid") return;
  const blocked = adventureUi.blocksPlay();
  if (!blocked) adventureUi.sense(x, z);
  const q = adventureUi.quest;
  stepQuest(q, blocked ? 0 : dt, x, z);
  if (q.teleport) {
    q.teleport = false;
    returnHome();
  }
}

if (!shot || adventureBoot) {
  adventureUi = mountAdventureUi(document, {
    absUrl,
    origin: { x0: xStart, pathZ, maxLengthM: corridor.length_m },
    field,
    catalog: adventureCatalog,
    library: adventureLibrary,
    plan: adventurePlan,
    quest: adventureQuest,
    onBegin() {
      x = xStart + 4;
      z = pathZ;
      heading = 90;
      speed = 0;
    },
    onHold(open) {
      sky.hold(open);
      if (open) {
        if (!idle.paused) idle.pause();
        if (gallop.src && !gallop.paused) gallop.pause();
      } else {
        useBolt(speed > 0.05);
      }
    },
  });
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
function advanceFilm() {
  const dt = 1 / 24;
  camDt = dt;
  pollKeys();
  moveBody(dt);
  stepFlow(dt, flowSpeed());
  if (gallop.duration > 0) {
    const t = (playFrames / 24) % gallop.duration;
    if (Math.abs(gallop.currentTime - t) > 0.02) {
      try { gallop.currentTime = t; } catch (err) { /* seek before metadata */ }
    }
  }
  playFrames += 1;
  window.__pose = {
    x, z, heading, speed: field.speed, live: field.live, charge: field.charge,
  };
  frame();
  return document.title;
}
function aimCollect() {
  if (params.get("collect") !== "1" || !adventureUi || !adventureUi.quest) return;
  const q = adventureUi.quest;
  if (q.phase !== "run") return;
  const shards = q.plan.shards || [];
  let target = null;
  let best = 1e9;
  for (let i = 0; i < shards.length; i++) {
    const shard = shards[i];
    if (q.found.has(shard.id)) continue;
    const ahead = shard.x - x;
    if (ahead < -0.5) continue;
    if (ahead < best) {
      best = ahead;
      target = shard;
    }
  }
  let targetZ = pathZ;
  if (target && best <= 6) targetZ = target.z;
  const dz = targetZ - z;
  if (Math.abs(dz) > 0.12) z += Math.sign(dz) * Math.min(Math.abs(dz), 0.35);
}

function advanceAdventure() {
  const dt = 1 / 24;
  camDt = dt;
  aimCollect();
  const held = adventureUi && adventureUi.quest && adventureUi.quest.holdMove;
  if (!held) {
    state.forward = 1;
    state.gallop = true;
    state.turn = 0;
    moveBody(dt);
    stepFlow(dt, flowSpeed());
  }
  stepAdventure(dt);
  if (adventureUi) adventureUi.tick(dt, false);
  playFrames += 1;
  window.__pose = {
    x, z, heading, speed: field.speed, live: field.live, charge: field.charge,
  };
  frame();
  return document.title;
}
if (filmShot) window.__advance = advanceFilm;
if (shot === "adventure") window.__advance = advanceAdventure;
function tick(now) {
  if (filmShot || shot === "adventure") {
    if (!window.__corridor || !window.__corridor.ready) {
      frame();
      requestAnimationFrame(tick);
    }
    return;
  }
  const dt = Math.min(0.05, (now - then) / 1000);
  then = now;
  camDt = dt;
  pollKeys();
  moveBody(dt);
  stepAdventure(dt);
  if (adventureUi) adventureUi.tick(dt, adventureUi.blocksPlay());
  stepFlow(dt, flowSpeed());
  playFrames += 1;
  frame();
  if (shot && !filmShot) {
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

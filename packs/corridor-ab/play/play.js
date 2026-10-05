/**
 * Walk Bolt along a hung WFC corridor.
 * Every texel is an Imagine file already in the repo, or the locked Bolt video.
 * The solve does not run here. Zone-flow only decides the handoff and the rate.
 */

window.addEventListener("error", (event) => {
  document.title = "ERR " + (event.message || "error");
});
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  document.title = "REJ " + (reason && reason.message ? reason.message : reason);
});

import { createFlow, BOLT_GALLOP, BOLT_IDLE, boltClip } from "../../../biome/scripts/zone-flow/zoneFlow.mjs";
import { poseOnCorridor } from "./place.js";

const params = new URLSearchParams(location.search);
const shot = params.get("shot");
const debug = params.get("debug") === "1";
const WALK = 4;
const BOOM = 5.5;
const EYE = 1.55;
const FOV = 40 * Math.PI / 180;

const canvas = document.getElementById("view");
const hud = document.getElementById("hud");
if (debug) hud.style.display = "block";
const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, preserveDrawingBuffer: true });
if (!gl) throw new Error("webgl2 missing");

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

const VS = `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec3 aOrigin;
uniform mat4 uViewProj;
uniform vec3 uOrigin;
uniform vec3 uAxisU;
uniform vec3 uAxisV;
uniform vec2 uSize;
uniform float uWorldUv;
uniform float uTileM;
uniform float uScreen;
uniform vec4 uScreenBox;
out vec2 vUv;
void main() {
  if (uScreen > 0.5) {
    vec2 p = mix(uScreenBox.xy, uScreenBox.zw, aCorner);
    gl_Position = vec4(p, 0.0, 1.0);
    vUv = aCorner;
    return;
  }
  vec3 worldPos = uOrigin + aOrigin
    + (aCorner.x - 0.5) * uSize.x * uAxisU
    + (aCorner.y - 0.5) * uSize.y * uAxisV;
  gl_Position = uViewProj * vec4(worldPos, 1.0);
  vec2 tiled = vec2(worldPos.x, worldPos.z) / uTileM;
  vUv = mix(aCorner, tiled, uWorldUv);
}`;

const FS = `#version 300 es
precision mediump float;
uniform sampler2D uTex;
uniform float uAlpha;
uniform float uKey;
in vec2 vUv;
out vec4 o;
void main() {
  vec4 c = texture(uTex, vUv);
  if (uKey > 0.5) {
    float dg = c.g - max(c.r, c.b);
    if (dg > 0.027) discard;
  }
  o = vec4(c.rgb, c.a * uAlpha);
}`;

function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || "shader");
  }
  return shader;
}

const prog = gl.createProgram();
gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
  throw new Error(gl.getProgramInfoLog(prog) || "link");
}
gl.useProgram(prog);
const loc = {
  view: gl.getUniformLocation(prog, "uViewProj"),
  origin: gl.getUniformLocation(prog, "uOrigin"),
  axisU: gl.getUniformLocation(prog, "uAxisU"),
  axisV: gl.getUniformLocation(prog, "uAxisV"),
  size: gl.getUniformLocation(prog, "uSize"),
  worldUv: gl.getUniformLocation(prog, "uWorldUv"),
  tileM: gl.getUniformLocation(prog, "uTileM"),
  screen: gl.getUniformLocation(prog, "uScreen"),
  screenBox: gl.getUniformLocation(prog, "uScreenBox"),
  alpha: gl.getUniformLocation(prog, "uAlpha"),
  key: gl.getUniformLocation(prog, "uKey"),
};

const quad = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quad);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

const originBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, originBuf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 0]), gl.DYNAMIC_DRAW);
gl.enableVertexAttribArray(1);
gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
gl.vertexAttribDivisor(1, 1);

const textures = new Map();
const cellGroups = new Map();
for (const cell of layout.grid.cells) {
  const list = cellGroups.get(cell.asset) || [];
  const centre = cellCenter(cell.x, cell.y);
  list.push(centre[0], 0.01, centre[1]);
  cellGroups.set(cell.asset, list);
}
const groupBufs = new Map();
for (const [asset, floats] of cellGroups) {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(floats), gl.STATIC_DRAW);
  groupBufs.set(asset, { buf, count: floats.length / 3 });
}

function cellCenter(col, row) {
  return [(col + 0.5) * tileM, (row + 0.5) * tileM];
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(url));
    img.src = url.startsWith("/") ? url : "/" + url.replace(/^\.\//, "");
  });
}

function makeTexture(img, repeat) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
  gl.generateMipmap(gl.TEXTURE_2D);
  return tex;
}

const urls = new Set([world.sky]);
for (const zone of Object.values(zones)) urls.add(zone.plate);
for (const asset of cellGroups.keys()) urls.add(asset);
const images = new Map();
for (const url of urls) images.set(url, await loadImage(url));
for (const [url, img] of images) {
  const repeat = url !== world.sky;
  textures.set(url, makeTexture(img, repeat));
}

function sampleHorizon(img) {
  const band = Math.max(1, Math.round(img.height * 0.08));
  const scratch = document.createElement("canvas");
  scratch.width = img.width;
  scratch.height = band;
  const ctx = scratch.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, img.height - band, img.width, band, 0, 0, img.width, band);
  const data = ctx.getImageData(0, 0, scratch.width, scratch.height).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 16) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n += 1;
  }
  return [r / n / 255, g / n / 255, b / n / 255];
}

const clearColour = sampleHorizon(images.get(world.sky));
const skyImg = images.get(world.sky);
const skyFit = Math.min(720 / skyImg.width, 800 / skyImg.height, 1);
const skyW = (skyImg.width * skyFit) / 720;
const skyH = (skyImg.height * skyFit) / 1600;
const skyBox = [-skyW, 0, skyW, skyH * 2];

const bolt = document.createElement("video");
bolt.muted = true;
bolt.loop = true;
bolt.playsInline = true;
bolt.autoplay = true;
bolt.preload = "auto";
const boltTex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, boltTex);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
let boltSrc = "";
let boltReady = false;

function useBolt(src) {
  const file = src === BOLT_IDLE ? "/" + BOLT_IDLE : "/" + BOLT_GALLOP;
  if (boltSrc === file) return;
  boltSrc = file;
  boltReady = false;
  bolt.src = file;
  bolt.play().catch(() => {});
}

bolt.addEventListener("loadeddata", () => {
  boltReady = true;
});

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
  const z = norm([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]]);
  const x = norm(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
  ]);
}

function mul(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c += 1) {
    for (let r = 0; r < 4; r += 1) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function norm(v) {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
}

let drawCalls = 0;

function bindSingle() {
  gl.bindBuffer(gl.ARRAY_BUFFER, originBuf);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
}

function draw(opts) {
  gl.uniform3f(loc.origin, opts.origin[0], opts.origin[1], opts.origin[2]);
  gl.uniform3f(loc.axisU, opts.axisU[0], opts.axisU[1], opts.axisU[2]);
  gl.uniform3f(loc.axisV, opts.axisV[0], opts.axisV[1], opts.axisV[2]);
  gl.uniform2f(loc.size, opts.size[0], opts.size[1]);
  gl.uniform1f(loc.worldUv, opts.worldUv || 0);
  gl.uniform1f(loc.tileM, tileM);
  gl.uniform1f(loc.screen, opts.screen || 0);
  gl.uniform4fv(loc.screenBox, opts.screenBox || skyBox);
  gl.uniform1f(loc.alpha, opts.alpha);
  gl.uniform1f(loc.key, opts.key || 0);
  gl.bindTexture(gl.TEXTURE_2D, opts.tex);
  const count = opts.count || 1;
  if (opts.instances) {
    gl.bindBuffer(gl.ARRAY_BUFFER, opts.instances);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
  } else {
    bindSingle();
  }
  gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
  drawCalls += 1;
}

const X = [1, 0, 0];
const Y = [0, 1, 0];
const Z = [0, 0, 1];

function groundQuad(tex, alpha) {
  if (!(alpha > 0) || !tex) return;
  draw({
    tex,
    alpha,
    origin: [0, 0, 0],
    axisU: X,
    axisV: Z,
    size: [180, 180],
    worldUv: 1,
  });
}

const startZone = zones[world.start];
let x = startZone.spawn.position[0];
let z = startZone.spawn.position[1];
let heading = startZone.spawn.heading_deg;
let speed = 0;
let prevMode = "zone";
let last = null;

function opacityOf(sample, id) {
  let value = 0;
  for (const plate of sample.plates || []) {
    if (plate.id === id) value = Math.max(value, plate.opacity);
  }
  return value;
}

function advance(dt, walk) {
  const rad = (heading * Math.PI) / 180;
  if (prevMode === "zone") {
    x += Math.sin(rad) * walk * dt;
    z += Math.cos(rad) * walk * dt;
  }
  const sample = flow.step({
    dt,
    x,
    z,
    heading,
    speed: walk,
    hitchMs: Math.min(1000, dt * 1000),
    black: false,
  });
  if (sample.mode === "corridor") {
    const pose = poseOnCorridor(corridor.waypoints, corridor.length_m, sample.along);
    x = pose.x;
    z = pose.z;
    heading = pose.heading;
  } else if (sample.mode === "zone" && prevMode !== "zone" && sample.zoneId && sample.zoneId !== world.start) {
    const gate = (zones[sample.zoneId].gates || [])[0];
    if (gate && gate.position) {
      x = gate.position[0];
      z = gate.position[1];
      heading = (Number(gate.heading_deg) + 180) % 360;
    }
  }
  prevMode = sample.mode;
  last = sample;
  if (!shot) useBolt(boltClip(walk));
  return sample;
}

function pump(kind) {
  for (let i = 0; i < 4000; i += 1) {
    const sample = advance(0.05, WALK);
    if (kind === "mid" && sample.mode === "corridor" && sample.along >= corridor.length_m * 0.45) return;
    if (kind === "end" && sample.mode === "zone" && sample.zoneId === world.corridors[0].to.zone) return;
  }
}

if (shot === "mid" || shot === "end") pump(shot);
else advance(0, 0);
useBolt(boltClip(0));

let holding = false;
if (!shot) {
  const down = () => {
    holding = true;
  };
  const up = () => {
    holding = false;
  };
  canvas.addEventListener("pointerdown", down);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}

function frame(sample) {
  drawCalls = 0;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(clearColour[0], clearColour[1], clearColour[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.disable(gl.DEPTH_TEST);
  const aspect = canvas.width / canvas.height;
  const proj = perspective(FOV, aspect, 0.08, 240);
  const rad = (heading * Math.PI) / 180;
  const eye = [x - Math.sin(rad) * BOOM, EYE, z - Math.cos(rad) * BOOM];
  const view = lookAt(eye, [x, EYE, z], Y);
  gl.uniformMatrix4fv(loc.view, false, mul(proj, view));
  gl.uniform1i(gl.getUniformLocation(prog, "uTex"), 0);

  draw({
    tex: textures.get(world.sky),
    alpha: 1,
    origin: [0, 0, 0],
    axisU: X,
    axisV: Y,
    size: [1, 1],
    screen: 1,
    screenBox: skyBox,
  });

  for (const [id, clearing] of Object.entries(zones)) {
    groundQuad(textures.get(clearing.plate), opacityOf(sample, id));
  }
  const corridorAlpha = opacityOf(sample, corridor.id);
  if (corridorAlpha > 0) {
    const fill = layout.grid.cells.find((cell) => cell.role === "fill");
    groundQuad(textures.get(fill.asset), corridorAlpha);
    for (const [asset, group] of groupBufs) {
      draw({
        tex: textures.get(asset),
        alpha: corridorAlpha,
        origin: [0, 0, 0],
        axisU: X,
        axisV: Z,
        size: [tileM, tileM],
        instances: group.buf,
        count: group.count,
      });
    }
  }

  if (boltReady && bolt.readyState >= 2) {
    gl.bindTexture(gl.TEXTURE_2D, boltTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bolt);
    const right = norm(cross(Y, [Math.sin(rad), 0, Math.cos(rad)]));
    draw({
      tex: boltTex,
      alpha: 1,
      key: 1,
      origin: [x, 0.645, z],
      axisU: right,
      axisV: Y,
      size: [0.848, 1.29],
    });
  }

  const glError = gl.getError();
  window.__corridor = {
    ready: boltReady || shot === "start" || !shot,
    mode: sample.mode,
    zoneId: sample.zoneId,
    along: sample.along,
    rate: sample.rate,
    bolt: sample.bolt,
    boltReady,
    x,
    z,
    heading,
    drawCalls,
    glError,
    black: false,
  };
  document.title = JSON.stringify(window.__corridor);
  if (debug) {
    hud.textContent = [
      sample.mode,
      sample.zoneId || corridor.id,
      "along " + (sample.along || 0).toFixed(1),
      "rate " + (sample.rate || 0).toFixed(2),
      sample.bolt,
      "draws " + drawCalls,
    ].join(" · ");
  }
}

frame(last || advance(0, 0));

let then = performance.now();
let shotFrames = 0;
function tick(now) {
  const dt = Math.min(0.05, (now - then) / 1000);
  then = now;
  if (!shot) speed = holding ? WALK : 0;
  else speed = 0;
  frame(advance(dt, speed));
  if (shot) {
    shotFrames += 1;
    if (!boltReady && shotFrames < 180) requestAnimationFrame(tick);
    else if (boltReady && shotFrames < 8) requestAnimationFrame(tick);
    return;
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

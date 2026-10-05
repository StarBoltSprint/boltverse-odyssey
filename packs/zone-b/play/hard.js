/**
 * Zone B hard objects. One measured loft, one unlit atlas, one draw.
 * Colliders are the Zone A face field: a wall only where a drawn face crosses
 * Bolt's body band. The plaza arch stays walkable. The Anchor mouth does not:
 * the shipped loft bridges it with opaque faces, and this field does not cut a hole.
 * The beacon is a world-locked quad on the landmark, not a camera card.
 */
import { buildCollider, frameOf } from "./collide.js";

const BODY_R = 0.3;

function program(gl, vs, fs) {
  const p = gl.createProgram();
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
    return s;
  };
  compile(gl.VERTEX_SHADER, vs);
  compile(gl.FRAGMENT_SHADER, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

function empty() {
  return {
    draws: 0,
    draw() {},
    mag() { return 0; },
    push() { return null; },
    blocks() { return false; },
    videoOn() { return false; },
    kick() {},
    setVideo() {},
    info() { return { count: 0 }; },
  };
}

function groundAt(env, x, z) {
  return env.heightAt(x, z) + env.skirtLift(x, z);
}

function colliderOptFor(part) {
  const span = Math.max(part.worldW || 1, part.worldH || 1, part.depth || 1);
  // The Anchor is ~60 m. A 0.15 m camera voxel would be millions of cells.
  // The body grid stays fine enough that a multi-metre arch is not filled in.
  if (span > 20) return { cellM: 0.25, voxM: 0.85, stepM: 0.25, clearM: 1.3, padM: 1.6 };
  if (span > 6) return { cellM: 0.15, voxM: 0.35, stepM: 0.25, clearM: 1.3, padM: 1.2 };
  return { cellM: 0.12, voxM: 0.22, stepM: 0.25, clearM: 1.3, padM: 0.8 };
}

/** Mirror and tilt baked into the part frame. Yaw and seat stay in frameOf, matching the draw. */
export function placementGroup(srcV, srcI, part, place) {
  const mirror = place.mirror ? -1 : 1;
  const ct = Math.cos(place.tilt || 0);
  const st = Math.sin(place.tilt || 0);
  const xyzuv = new Float32Array(part.nv * 5);
  for (let v = 0; v < part.nv; v++) {
    const o = (part.v0 + v) * 5;
    const lx = srcV[o] * mirror;
    const ly = srcV[o + 1];
    const lz = srcV[o + 2];
    const d = v * 5;
    xyzuv[d] = lx;
    xyzuv[d + 1] = ly * ct - lz * st;
    xyzuv[d + 2] = ly * st + lz * ct;
    xyzuv[d + 3] = srcV[o + 3];
    xyzuv[d + 4] = srcV[o + 4];
  }
  const idx = new Uint32Array(part.ni);
  for (let k = 0; k < part.ni; k++) idx[k] = srcI[part.i0 + k] - part.v0;
  return { xyzuv, idx };
}

/**
 * One face collider per placed part, including the Anchor (its boxes stay empty:
 * a box would wall every opening). A cell is open only when no drawn face
 * crosses the body band. The Anchor mouth is closed because those faces do.
 */
export function buildFaceSolids(loft, srcV, srcI, seatOf) {
  const cols = [];
  for (let pi = 0; pi < loft.placements.length; pi++) {
    const p = loft.placements[pi];
    const part = loft.parts[p.part];
    if (!part || !part.nv || !part.ni) continue;
    const base = seatOf(p, part);
    // Seat is ground - sink + lift. The field uses that same floor, so a
    // sloping sample cannot drop the lintel into the body band.
    const floor = base - (p.lift || 0) + (p.sink || 0);
    const group = placementGroup(srcV, srcI, part, p);
    const frame = frameOf({ yaw: p.yaw || 0 }, { x: p.x, y: base, z: p.z });
    const col = buildCollider([group], frame, () => floor, colliderOptFor(part));
    cols.push({
      id: p.id || p.part,
      name: p.name,
      part: p.part,
      col,
      x: p.x,
      z: p.z,
    });
  }
  return cols;
}

export async function mountHard(gl, env) {
  let loft;
  try {
    const res = await fetch(env.loftUrl);
    if (!res.ok) return empty();
    loft = await res.json();
  } catch (e) {
    return empty();
  }
  const atlasImg = await env.loadImage(env.absUrl(env.root + loft.atlas));
  const meshBuf = await (await fetch(env.absUrl(env.root + loft.mesh))).arrayBuffer();
  const view = new DataView(meshBuf);
  const magic = view.getUint32(0, true);
  if (magic !== 0x3148534d) throw new Error("hard mesh magic");
  const nv = view.getUint32(4, true);
  const ni = view.getUint32(8, true);
  const srcV = new Float32Array(meshBuf, 12, nv * 5);
  const srcI = new Uint32Array(meshBuf, 12 + nv * 5 * 4, ni);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasImg);
  gl.generateMipmap(gl.TEXTURE_2D);
  env.trackTex("hard", Math.ceil(atlasImg.width * atlasImg.height * 4 * 4 / 3));

  const baked = [];
  const indices = [];
  const bounds = [];
  let anchorBase = 0;

  function seat(p, part) {
    if (p.gx != null && p.gz != null) return groundAt(env, p.gx, p.gz);
    const hx = Math.max(0.45, (part.maxX - part.minX) * 0.45);
    const hz = Math.max(0.35, (part.maxZ - part.minZ) * 0.45);
    let min = Infinity;
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const h = groundAt(env, p.x + i * hx, p.z + j * hz);
        if (h < min) min = h;
      }
    }
    return Number.isFinite(min) ? min : 0;
  }

  function xform(lx, ly, lz, p, base) {
    const mirror = p.mirror ? -1 : 1;
    const x0 = lx * mirror;
    const ct = Math.cos(p.tilt || 0);
    const st = Math.sin(p.tilt || 0);
    const y1 = ly * ct - lz * st;
    const z1 = ly * st + lz * ct;
    const c = Math.cos(p.yaw || 0);
    const s = Math.sin(p.yaw || 0);
    return [
      p.x + c * x0 + s * z1,
      base + y1,
      p.z - s * x0 + c * z1,
    ];
  }

  for (let pi = 0; pi < loft.placements.length; pi++) {
    const p = loft.placements[pi];
    const part = loft.parts[p.part];
    if (!part) continue;
    const g = seat(p, part);
    const base = g - (p.sink || 0) + (p.lift || 0);
    if (p.part === "anchor") anchorBase = base;
    const id = env.labelOf(p.id || "hard");
    const vBase = baked.length / 6;
    for (let v = 0; v < part.nv; v++) {
      const o = (part.v0 + v) * 5;
      const w = xform(srcV[o], srcV[o + 1], srcV[o + 2], p, base);
      baked.push(w[0], w[1], w[2], srcV[o + 3], srcV[o + 4], id);
    }
    for (let k = 0; k < part.ni; k++) {
      indices.push(srcI[part.i0 + k] - part.v0 + vBase);
    }
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    const corners = [
      [part.minX, part.minY, part.minZ],
      [part.maxX, part.minY, part.minZ],
      [part.minX, part.maxY, part.minZ],
      [part.maxX, part.maxY, part.minZ],
      [part.minX, part.minY, part.maxZ],
      [part.maxX, part.minY, part.maxZ],
      [part.minX, part.maxY, part.maxZ],
      [part.maxX, part.maxY, part.maxZ],
    ];
    for (let c = 0; c < 8; c++) {
      const w = xform(corners[c][0], corners[c][1], corners[c][2], p, base);
      if (w[0] < minX) minX = w[0];
      if (w[1] < minY) minY = w[1];
      if (w[2] < minZ) minZ = w[2];
      if (w[0] > maxX) maxX = w[0];
      if (w[1] > maxY) maxY = w[1];
      if (w[2] > maxZ) maxZ = w[2];
    }
    bounds.push({
      minX, minY, minZ, maxX, maxY, maxZ,
      srcW: part.srcW, srcH: part.srcH,
      worldW: part.worldW, worldH: part.worldH,
    });
  }

  const cols = buildFaceSolids(loft, srcV, srcI, (p, part) => {
    const g = seat(p, part);
    return g - (p.sink || 0) + (p.lift || 0);
  });

  const prog = program(gl, `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aUv;
layout(location=2) in float aId;
uniform mat4 uVP;
out vec2 vUv;
flat out float vId;
void main() {
  gl_Position = uVP * vec4(aPos, 1.0);
  vUv = aUv;
  vId = aId;
}`, `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform int uMode;
in vec2 vUv;
flat in float vId;
out vec4 o;
void main() {
  vec4 c = texture(uTex, vUv);
  if (c.a < 0.45) discard;
  if (uMode == 1) o = vec4(vId / 255.0, 0.0, 0.0, 1.0);
  else o = vec4(c.rgb, 1.0);
}`);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  const vertData = new Float32Array(baked);
  gl.bufferData(gl.ARRAY_BUFFER, vertData, gl.STATIC_DRAW);
  const ib = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  const idxData = new Uint32Array(indices);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxData, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 12);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 24, 20);
  gl.bindVertexArray(null);

  const loc = {
    vp: gl.getUniformLocation(prog, "uVP"),
    tex: gl.getUniformLocation(prog, "uTex"),
    mode: gl.getUniformLocation(prog, "uMode"),
  };
  const count = indices.length;

  const beacon = loft.beacon;
  let beaconVideo = null;
  let beaconTex = null;
  let beaconPos = null;
  if (beacon && beacon.file) {
    const c = Math.cos(beacon.yaw || 0);
    const s = Math.sin(beacon.yaw || 0);
    beaconPos = {
      x: beacon.x + c * beacon.lx + s * beacon.lz,
      y: anchorBase + beacon.ly,
      z: beacon.z - s * beacon.lx + c * beacon.lz,
      size: beacon.size || 2,
      src: beacon.src || 480,
    };
    beaconTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, beaconTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const px = new Uint8Array([0, 0, 0, 0]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
    beaconVideo = env.videoEl(env.absUrl(env.root + beacon.file));
    beaconVideo.loop = true;
    await new Promise((r) => {
      if (beaconVideo.readyState >= 2) r();
      else {
        beaconVideo.addEventListener("loadeddata", () => r(), { once: true });
        beaconVideo.addEventListener("error", () => r(), { once: true });
        setTimeout(r, 12000);
      }
    });
    await beaconVideo.play().catch(() => {});
  }

  const beaconProg = program(gl, `#version 300 es
layout(location=0) in vec2 aCorner;
uniform mat4 uVP;
uniform vec3 uCenter;
uniform vec2 uSize;
out vec2 vUv;
void main() {
  vec3 p = uCenter + vec3((aCorner.x - 0.5) * uSize.x, (aCorner.y - 0.5) * uSize.y, 0.0);
  gl_Position = uVP * vec4(p, 1.0);
  vUv = aCorner;
}`, `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform int uMode;
uniform float uId;
in vec2 vUv;
out vec4 o;
void main() {
  vec4 c = texture(uTex, vUv);
  float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  if (lum < 0.06) discard;
  if (uMode == 1) o = vec4(uId / 255.0, 0.0, 0.0, 1.0);
  else o = vec4(c.rgb, 1.0);
}`);
  const beaconVao = gl.createVertexArray();
  gl.bindVertexArray(beaconVao);
  const beaconVb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, beaconVb);
  const corners = new Float32Array([
    0, 0, 1, 0, 1, 1,
    0, 0, 1, 1, 0, 1,
  ]);
  gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  gl.bindVertexArray(null);
  const beaconLoc = {
    vp: gl.getUniformLocation(beaconProg, "uVP"),
    center: gl.getUniformLocation(beaconProg, "uCenter"),
    size: gl.getUniformLocation(beaconProg, "uSize"),
    tex: gl.getUniformLocation(beaconProg, "uTex"),
    mode: gl.getUniformLocation(beaconProg, "uMode"),
    id: gl.getUniformLocation(beaconProg, "uId"),
  };
  const beaconId = env.labelOf("hard:beacon");
  let beaconStamp = -1;

  function uploadBeacon() {
    const v = beaconVideo;
    if (!v || v.readyState < 2 || !beaconTex) return false;
    if (beaconStamp === v.currentTime) return true;
    if (v.paused && beaconStamp >= 0) return true;
    beaconStamp = v.currentTime;
    gl.bindTexture(gl.TEXTURE_2D, beaconTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
    env.trackTex("hard-beacon", (v.videoWidth || 480) * (v.videoHeight || 480) * 4);
    return true;
  }

  function closest(b, eye) {
    const x = Math.max(b.minX, Math.min(b.maxX, eye[0]));
    const y = Math.max(b.minY, Math.min(b.maxY, eye[1]));
    const z = Math.max(b.minZ, Math.min(b.maxZ, eye[2]));
    return Math.hypot(eye[0] - x, eye[1] - y, eye[2] - z);
  }

  const api = {
    draws: 1,
    count: loft.placements.length,
    solids: cols.length,
    push(x, z) {
      let cx = x;
      let cz = z;
      let hit = false;
      for (let iter = 0; iter < 4; iter++) {
        let moved = false;
        for (let i = 0; i < cols.length; i++) {
          const col = cols[i].col;
          if (!col.near(cx, cz, BODY_R)) continue;
          const d = col.sd(cx, cz);
          if (d >= BODY_R) continue;
          const g = col.grad(cx, cz);
          if (g[0] === 0 && g[1] === 0) continue;
          cx += g[0] * (BODY_R - d);
          cz += g[1] * (BODY_R - d);
          moved = true;
          hit = true;
        }
        if (!moved) break;
      }
      return hit ? [cx, cz] : null;
    },
    blocks(eye) {
      const x = eye[0];
      const y = eye[1];
      const z = eye[2];
      for (let i = 0; i < cols.length; i++) {
        const col = cols[i].col;
        if (!col.near(x, z, 0.6)) continue;
        if (col.dist(x, y, z) < 0.28) return true;
      }
      return false;
    },
    videoOn() {
      return !!(beaconVideo && !beaconVideo.paused && beaconVideo.readyState >= 2);
    },
    kick() {
      if (beaconVideo && beaconVideo.paused) beaconVideo.play().catch(() => {});
    },
    setVideo(on) {
      if (!beaconVideo) return;
      if (on) {
        if (beaconVideo.paused) beaconVideo.play().catch(() => {});
      } else if (!beaconVideo.paused) beaconVideo.pause();
    },
    draw(vp, mode) {
      gl.useProgram(prog);
      gl.bindVertexArray(vao);
      gl.uniformMatrix4fv(loc.vp, false, vp);
      gl.uniform1i(loc.mode, mode);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(loc.tex, 0);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_INT, 0);
      let n = 1;
      if (beaconPos && uploadBeacon()) {
        gl.useProgram(beaconProg);
        gl.bindVertexArray(beaconVao);
        gl.uniformMatrix4fv(beaconLoc.vp, false, vp);
        gl.uniform3f(beaconLoc.center, beaconPos.x, beaconPos.y, beaconPos.z);
        gl.uniform2f(beaconLoc.size, beaconPos.size, beaconPos.size);
        gl.uniform1i(beaconLoc.mode, mode);
        gl.uniform1f(beaconLoc.id, beaconId);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, beaconTex);
        gl.uniform1i(beaconLoc.tex, 0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        n = 2;
      }
      api.draws = n;
    },
    mag(eye, focal) {
      let m = 0;
      for (let i = 0; i < bounds.length; i++) {
        const b = bounds[i];
        const d = Math.max(0.35, closest(b, eye));
        const mh = (focal * b.worldH) / (d * Math.max(1, b.srcH));
        const mw = (focal * b.worldW) / (d * Math.max(1, b.srcW));
        if (mh > m) m = mh;
        if (mw > m) m = mw;
      }
      if (beaconPos) {
        const d = Math.max(0.35, Math.hypot(eye[0] - beaconPos.x, eye[1] - beaconPos.y, eye[2] - beaconPos.z));
        const mb = (focal * beaconPos.size) / (d * beaconPos.src);
        if (mb > m) m = mb;
      }
      return m;
    },
    info() {
      return {
        count: loft.placements.length,
        solids: cols.length,
        collider: "faces",
        openings: {
          arch: cols.filter((c) => c.part === "leg" || c.part === "span").map((c) => c.col.wallCells),
          anchor: (cols.find((c) => c.part === "anchor") || { col: { wallCells: 0, sealed: 0 } }).col.wallCells,
        },
        tris: count / 3,
        atlas: [atlasImg.width, atlasImg.height],
        anchorBase,
        beacon: beaconPos,
        videos: api.videoOn() ? 1 : 0,
        anchor: loft.anchor,
        arch: loft.arch,
      };
    },
  };
  return api;
}

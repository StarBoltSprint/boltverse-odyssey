/**
 * Lofted hard objects. One merged draw, unlit Imagine skin, no collider here.
 * The caller places the foot and owns pickup. Near cull hides a solid that
 * would pass magnification 1.
 */

import { footY, seatMin, worldHeight } from "./place.js";

const STRIDE = 14;
const NEAR_CAP = 0.99;

const VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aUv;
layout(location=2) in float aSlot;
layout(location=3) in vec4 aCull;
layout(location=4) in vec4 aBox;
uniform mat4 uVP;
uniform vec3 uEye;
uniform float uFocal;
out vec2 vUv;
out float vSlot;
void main() {
  vUv = aUv;
  vSlot = aSlot;
  gl_Position = uVP * vec4(aPos, 1.0);
  float yq = clamp(uEye.y, aBox.z, aBox.w);
  vec2 d = uEye.xz - aCull.xy;
  float c = cos(aCull.z);
  float s = sin(aCull.z);
  vec2 ax = vec2(c, -s);
  float t = clamp(dot(d, ax), -aBox.x, aBox.x);
  float horiz = length(d - ax * t);
  float dist = length(vec2(horiz, uEye.y - yq));
  if (aCull.w > 0.0 && uFocal > 0.0 && dist * ${NEAR_CAP.toFixed(2)} < uFocal * aCull.w) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
}`;

const FS = `#version 300 es
precision highp float;
uniform sampler2D uTex0;
uniform sampler2D uTex1;
in vec2 vUv;
in float vSlot;
out vec4 o;
void main() {
  vec4 c = vSlot < 0.5 ? texture(uTex0, vUv) : texture(uTex1, vUv);
  if (c.a < 0.45) discard;
  o = vec4(c.rgb, 1.0);
}`;

function program(gl, vs, fs) {
  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  };
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

function around(part) {
  return part.ring && part.ring.length >= 3 ? part.ring.length : 4;
}

function corner(part, station, i) {
  const xSpan = station[1];
  const zSpan = station[2];
  if (part.ring && part.ring.length >= 3) {
    const r = part.ring[i];
    return [r[0] * xSpan, station[0], r[1] * zSpan];
  }
  const sx = i === 0 || i === 1 ? 0.5 : -0.5;
  const sz = i === 0 || i === 3 ? 0.5 : -0.5;
  return [sx * xSpan, station[0], sz * zSpan];
}

function uvOf(station, p, kind, side, front, cap) {
  const xSpan = Math.max(1e-4, station[1]);
  const zSpan = Math.max(1e-4, station[2]);
  let v = station[5];
  let u = station[3];
  let rect = side;
  if (kind === 2 && cap) {
    // Caps have no top plate. Sample the side plate where the body is widest,
    // so the tip's collapsed u does not paint one column across the face.
    const x01 = Math.min(1, Math.max(0, (p[0] + xSpan * 0.5) / xSpan));
    const z01 = Math.min(1, Math.max(0, (p[2] + zSpan * 0.5) / zSpan));
    u = cap[0] + x01 * (cap[1] - cap[0]);
    v = cap[2] + z01 * (cap[3] - cap[2]);
  } else if (kind === 1 && front) {
    const z01 = (p[2] + zSpan * 0.5) / zSpan;
    u = station[6] + z01 * (station[7] - station[6]);
    rect = front;
  } else if (kind === 1) {
    const z01 = (p[2] + zSpan * 0.5) / zSpan;
    u = station[3] + z01 * (station[4] - station[3]);
  } else if (kind !== 2) {
    const x01 = (p[0] + xSpan * 0.5) / xSpan;
    u = station[3] + x01 * (station[4] - station[3]);
  }
  return [
    rect[0] + u * (rect[2] - rect[0]),
    rect[1] + v * (rect[3] - rect[1]),
  ];
}

/** u0, u1, v0, v1 inside the side plate, over rows that stay wide. */
function capPatch(stations) {
  let maxX = 0;
  for (let i = 0; i < stations.length; i++) {
    if (stations[i][1] > maxX) maxX = stations[i][1];
  }
  let u0 = 0;
  let u1 = 1;
  let v0 = 1;
  let v1 = 0;
  let n = 0;
  for (let i = 0; i < stations.length; i++) {
    const st = stations[i];
    if (st[1] < maxX * 0.72) continue;
    if (n === 0) {
      u0 = st[3];
      u1 = st[4];
    } else {
      if (st[3] > u0) u0 = st[3];
      if (st[4] < u1) u1 = st[4];
    }
    if (st[5] < v0) v0 = st[5];
    if (st[5] > v1) v1 = st[5];
    n++;
  }
  if (n === 0 || u1 - u0 < 0.04) {
    let wide = stations[0];
    for (let i = 1; i < stations.length; i++) {
      if (stations[i][1] > wide[1]) wide = stations[i];
    }
    u0 = wide[3];
    u1 = wide[4];
    v0 = wide[5];
    v1 = Math.min(1, wide[5] + 0.04);
  }
  if (v1 - v0 < 0.02) v1 = Math.min(1, v0 + 0.02);
  return [u0, u1, v0, v1];
}

function outward(a, b, c, up) {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  if (nx * nx + ny * ny + nz * nz < 1e-12) return null;
  const cx = (a[0] + b[0] + c[0]) / 3;
  const cz = (a[2] + b[2] + c[2]) / 3;
  let flip = false;
  if (up > 0) flip = ny < 0;
  else if (up < 0) flip = ny > 0;
  else flip = nx * cx + nz * cz < 0;
  return flip ? [a, c, b] : [a, b, c];
}

function triCount(part) {
  const n = around(part);
  const s = part.stations.length;
  if (s < 2) return 0;
  return (s - 1) * n * 2 + n * 2;
}

/**
 * Append one placed solid. `item` carries the foot, the yaw, and the atlas rect.
 * Returns the number of vertices written.
 */
export function writeInstance(dst, offset, item) {
  const itemStart = offset;
  const part = item.part;
  const stations = part.stations || [];
  const n = around(part);
  const sCount = stations.length;
  if (sCount < 2) return 0;
  const yaw = item.yaw || 0;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const worldH = item.worldH;
  const mirror = item.mirror ? -1 : 1;
  const side = item.side;
  const front = item.front || null;
  const capUv = capPatch(stations);
  const slot = item.slot || 0;
  const mpp = worldH / Math.max(1, item.contentH || 1);
  const hx = part.halfX * worldH;
  const hz = part.halfZ * worldH;
  const y0 = item.y;
  const y1 = item.y + worldH;
  const cx = item.x;
  const cz = item.z;

  function kindOf(a, b, d) {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = d[0] - a[0];
    const vy = d[1] - a[1];
    const vz = d[2] - a[2];
    const nx = Math.abs(uy * vz - uz * vy);
    const ny = Math.abs(uz * vx - ux * vz);
    const nz = Math.abs(ux * vy - uy * vx);
    if (ny >= nx && ny >= nz) return 2;
    if (nx >= nz) return 1;
    return 0;
  }

  function emit(p, kind, station) {
    const uv = uvOf(station, p, kind, side, front, capUv);
    const lx = p[0] * mirror * worldH;
    const ly = p[1] * worldH;
    const lz = p[2] * worldH;
    const o = offset;
    dst[o] = cx + lx * c + lz * s;
    dst[o + 1] = y0 + ly;
    dst[o + 2] = cz - lx * s + lz * c;
    dst[o + 3] = uv[0];
    dst[o + 4] = uv[1];
    dst[o + 5] = slot;
    dst[o + 6] = cx;
    dst[o + 7] = cz;
    dst[o + 8] = yaw;
    dst[o + 9] = mpp;
    dst[o + 10] = hx;
    dst[o + 11] = hz;
    dst[o + 12] = y0;
    dst[o + 13] = y1;
    offset += STRIDE;
  }

  function tri(a, b, d, kind, sa, sb, sd, up) {
    const wound = outward(a, b, d, up);
    if (!wound) return;
    const pts = [a, b, d];
    const sts = [sa, sb, sd];
    const order = wound[1] === b ? [0, 1, 2] : [0, 2, 1];
    emit(pts[order[0]], kind, sts[order[0]]);
    emit(pts[order[1]], kind, sts[order[1]]);
    emit(pts[order[2]], kind, sts[order[2]]);
  }

  for (let s = 0; s < sCount - 1; s++) {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a = corner(part, stations[s], i);
      const b = corner(part, stations[s], j);
      const d = corner(part, stations[s + 1], j);
      const e = corner(part, stations[s + 1], i);
      const kind = kindOf(a, b, d);
      tri(a, b, d, kind, stations[s], stations[s], stations[s + 1], 0);
      tri(a, d, e, kind, stations[s], stations[s + 1], stations[s + 1], 0);
    }
  }
  const foot = stations[0];
  const cap = stations[sCount - 1];
  const footC = [0, foot[0], 0];
  const capC = [0, cap[0], 0];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    tri(footC, corner(part, foot, j), corner(part, foot, i), 2, foot, foot, foot, -1);
    tri(capC, corner(part, cap, i), corner(part, cap, j), 2, cap, cap, cap, 1);
  }
  return (offset - itemStart) / STRIDE;
}

export function vertexCount(part) {
  return triCount(part) * 3;
}

export function uploadMerged(gl, data, count) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  const used = count * STRIDE;
  const slice = data.subarray(0, used);
  gl.bufferData(gl.ARRAY_BUFFER, slice, gl.STATIC_DRAW);
  const stride = STRIDE * 4;
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 12);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 20);
  gl.enableVertexAttribArray(3);
  gl.vertexAttribPointer(3, 4, gl.FLOAT, false, stride, 24);
  gl.enableVertexAttribArray(4);
  gl.vertexAttribPointer(4, 4, gl.FLOAT, false, stride, 40);
  gl.bindVertexArray(null);
  return { vao, buf, count };
}

let cached = null;

export function solidProgram(gl) {
  if (cached && cached.gl === gl) return cached;
  const prog = program(gl, VS, FS);
  cached = {
    gl,
    prog,
    vp: gl.getUniformLocation(prog, "uVP"),
    eye: gl.getUniformLocation(prog, "uEye"),
    focal: gl.getUniformLocation(prog, "uFocal"),
    tex0: gl.getUniformLocation(prog, "uTex0"),
    tex1: gl.getUniformLocation(prog, "uTex1"),
  };
  return cached;
}

export function drawMerged(gl, mesh, vp, eye, focal, tex0, tex1) {
  if (!mesh || !mesh.count) return;
  const prog = solidProgram(gl);
  gl.useProgram(prog.prog);
  gl.bindVertexArray(mesh.vao);
  gl.uniformMatrix4fv(prog.vp, false, vp);
  gl.uniform3f(prog.eye, eye ? eye[0] : 0, eye ? eye[1] : 0, eye ? eye[2] : 0);
  gl.uniform1f(prog.focal, eye && focal ? focal : 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex0);
  gl.uniform1i(prog.tex0, 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, tex1 || tex0);
  gl.uniform1i(prog.tex1, 1);
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(true);
  gl.disable(gl.BLEND);
  gl.disable(gl.CULL_FACE);
  gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  gl.bindVertexArray(null);
  gl.activeTexture(gl.TEXTURE0);
}

export function fillItems(items) {
  let verts = 0;
  for (let i = 0; i < items.length; i++) verts += vertexCount(items[i].part);
  const data = new Float32Array(Math.max(1, verts * STRIDE));
  let offset = 0;
  let count = 0;
  for (let i = 0; i < items.length; i++) {
    const n = writeInstance(data, offset, items[i]);
    offset += n * STRIDE;
    count += n;
  }
  return { data, count };
}

function uploadImage(gl, source) {
  const flip = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
  const pre = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flip);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, pre);
}

/**
 * Echo shards as one shared solid. No collider. The pickup card still uses
 * the manifest image. This draw replaces the flat card when a loft is named.
 */
export async function mountShardSolid(gl, env, manifest) {
  const spec = manifest.solid;
  if (!spec || !spec.loft || !spec.skin) return null;
  const res = await fetch(env.absUrl(spec.loft));
  if (!res.ok) return null;
  const loft = await res.json();
  const part = loft.parts && loft.parts[spec.part || "crystal"];
  if (!part || !part.stations || !part.rects || !part.rects.side) return null;
  const img = await env.loadImage(env.absUrl(spec.skin));
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  uploadImage(gl, img);
  gl.generateMipmap(gl.TEXTURE_2D);
  env.trackTex("echo-crystal", Math.ceil(img.width * img.height * 4 * 4 / 3));

  const focal = env.focal;
  const cap = manifest.heightCapM == null ? 1.12 : manifest.heightCapM;
  const approach = manifest.approachM == null ? 2.3 : manifest.approachM;
  const buryFrac = manifest.buryFrac == null ? 0.1 : manifest.buryFrac;
  const groundAt = env.groundAt || (() => 0);
  const contentH = part.contentH || img.height;
  const worldH = worldHeight(contentH, focal, approach, cap);
  if (!(worldH > 0)) return null;
  const side = part.rects.side;
  const front = part.rects.front || null;
  const shards = manifest.shards || [];
  const placed = [];
  for (let i = 0; i < shards.length; i++) {
    const shard = shards[i];
    const yaw = ((shard.yaw || 0) * Math.PI) / 180;
    const halfW = Math.max(part.halfX, part.halfZ) * worldH;
    const seat = seatMin(groundAt, shard.x, shard.z, yaw, 4, halfW);
    const y = footY(seat, worldH * buryFrac);
    placed.push({
      id: shard.id,
      part,
      x: shard.x,
      y,
      z: shard.z,
      yaw,
      worldH,
      contentH,
      side,
      front,
      slot: 0,
      mirror: false,
    });
  }

  let mesh = null;
  let shown = [];

  function rebuild(found) {
    shown = placed.filter((p) => !found || !found.has(p.id));
    if (mesh) {
      gl.deleteVertexArray(mesh.vao);
      gl.deleteBuffer(mesh.buf);
      mesh = null;
    }
    if (!shown.length) return;
    const built = fillItems(shown);
    mesh = uploadMerged(gl, built.data, built.count);
  }

  function onScreen(vp, x, y, z, r) {
    if (!vp) return true;
    const cx = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
    const cy = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
    const cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
    if (cw < 0.05 - r) return false;
    const px = r * (2 * focal / 720);
    const py = r * (2 * focal / 1600);
    return Math.abs(cx) <= cw + px && Math.abs(cy) <= cw + py;
  }

  function nearCut(eye, p) {
    const hx = p.part.halfX * p.worldH;
    const c = Math.cos(p.yaw);
    const s = Math.sin(p.yaw);
    const dx = eye[0] - p.x;
    const dz = eye[2] - p.z;
    const along = dx * c - dz * s;
    const t = Math.max(-hx, Math.min(hx, along));
    const horiz = Math.hypot(dx - c * t, dz + s * t);
    const yq = Math.max(p.y, Math.min(p.y + p.worldH, eye[1]));
    const dist = Math.hypot(horiz, eye[1] - yq);
    return dist * 0.995 < focal * (p.worldH / p.contentH);
  }

  rebuild(null);

  return {
    colliders: [],
    get draws() { return shown.length ? 1 : 0; },
    setFound(found) { rebuild(found); },
    draw(vp, eye) {
      if (!shown.length || !mesh) return;
      drawMerged(gl, mesh, vp, eye, focal, tex, tex);
    },
    mag(eye, f, vp) {
      let m = 0;
      const focalNow = f || focal;
      for (let i = 0; i < shown.length; i++) {
        const p = shown[i];
        if (nearCut(eye, p)) continue;
        const r = Math.hypot(p.part.halfX * p.worldH, p.worldH * 0.5);
        if (!onScreen(vp, p.x, p.y + p.worldH * 0.5, p.z, r)) continue;
        const hx = p.part.halfX * p.worldH;
        const c = Math.cos(p.yaw);
        const s = Math.sin(p.yaw);
        const dx = eye[0] - p.x;
        const dz = eye[2] - p.z;
        const along = dx * c - dz * s;
        const t = Math.max(-hx, Math.min(hx, along));
        const horiz = Math.hypot(dx - c * t, dz + s * t);
        const yq = Math.max(p.y, Math.min(p.y + p.worldH, eye[1]));
        const dist = Math.max(0.35, Math.hypot(horiz, eye[1] - yq));
        const mm = (focalNow * p.worldH) / (dist * p.contentH);
        if (mm > m) m = mm;
      }
      return m;
    },
    info() {
      return {
        placed: placed.length,
        drawn: shown.length,
        draws: shown.length ? 1 : 0,
        colliders: [],
        worldH,
        solid: true,
        texMiB: (img.width * img.height * 4 * 4 / 3) / (1024 * 1024),
        atlas: [img.width, img.height],
      };
    },
  };
}

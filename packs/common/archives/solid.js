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

function lerp3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
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
 * Wall and cap UVs stay inside the wide-body window of the side plate and
 * repeat that window so a face never spends fewer texels than its edge.
 * A flared shoulder is still a wall: its height is in v. Caps are the fans only.
 * Returns the worst edge stretch (1 = one texel per local unit of plateH).
 */
function writeSolid(tmp, item) {
  const part = item.part;
  const stations = part.stations || [];
  const n = around(part);
  const sCount = stations.length;
  if (sCount < 2 || !item.side) return 0;
  const yaw = item.yaw || 0;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const worldH = item.worldH;
  const mirror = item.mirror ? -1 : 1;
  const side = item.side;
  const slot = item.slot || 0;
  const plateW = Math.max(1, item.plateW || item.contentW || item.contentH || 1);
  const plateH = Math.max(1, item.plateH || item.contentH || 1);
  const density = Math.max(1, item.vTiles || 1);
  const capUv = capPatch(stations);
  let u0 = capUv[0];
  let u1 = capUv[1];
  if (u1 - u0 < 0.08) {
    u0 = 0.04;
    u1 = 0.96;
  }
  const v0 = 0.02;
  const v1 = 0.98;
  const uSpan = u1 - u0;
  const vSpan = v1 - v0;
  const mpp = worldH / Math.max(1, (item.contentH || plateH) * density);
  const hx = part.halfX * worldH;
  const hz = part.halfZ * worldH;
  const yFoot = stations[0][0];
  const yTop = stations[sCount - 1][0];
  const yDen = Math.max(1e-4, yTop - yFoot);
  const yBase = item.y;
  const cx = item.x;
  const cz = item.z;
  let worst = 0;

  function y01(y) {
    return (y - yFoot) / yDen;
  }

  function note(p, q, pu, qu) {
    const local = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    if (local < 1e-5) return;
    const pix = Math.hypot((pu[0] - qu[0]) * plateW, (pu[1] - qu[1]) * plateH);
    const stretch = pix < 1e-5 ? 1e6 : (local * plateH * density) / pix;
    if (stretch > worst) worst = stretch;
  }

  function push(p, plateU, plateV) {
    const lx = p[0] * mirror * worldH;
    const ly = p[1] * worldH;
    const lz = p[2] * worldH;
    tmp.push(
      cx + lx * c + lz * s,
      yBase + ly,
      cz - lx * s + lz * c,
      side[0] + plateU * (side[2] - side[0]),
      side[1] + plateV * (side[3] - side[1]),
      slot,
      cx,
      cz,
      yaw,
      mpp,
      hx,
      hz,
      yBase,
      yBase + worldH,
    );
  }

  function tri(a, b, d, ua, ub, ud, up) {
    const wound = outward(a, b, d, up);
    if (!wound) return;
    const pts = [a, b, d];
    const uvs = [ua, ub, ud];
    const order = wound[1] === b ? [0, 1, 2] : [0, 2, 1];
    const p0 = pts[order[0]];
    const p1 = pts[order[1]];
    const p2 = pts[order[2]];
    const t0 = uvs[order[0]];
    const t1 = uvs[order[1]];
    const t2 = uvs[order[2]];
    note(p0, p1, t0, t1);
    note(p1, p2, t1, t2);
    note(p2, p0, t2, t0);
    push(p0, t0[0], t0[1]);
    push(p1, t1[0], t1[1]);
    push(p2, t2[0], t2[1]);
  }

  // Embed one triangle in the plate so each edge keeps its real length.
  // A skewed loft quad is not a rectangle: sizing only the axis edges left
  // the diagonal short of texels (the smeared band). Split until the
  // embedding fits one copy of the opaque window.
  function fitTri(a, b, d, up, depth) {
    const lab = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const lad = Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
    const lbd = Math.hypot(d[0] - b[0], d[1] - b[1], d[2] - b[2]);
    const k = plateH * density;
    let pab = lab * k;
    let pad = lad * k;
    let pbd = lbd * k;
    let pa = a;
    let pb = b;
    let pd = d;
    if (pbd > pab && pbd >= pad) {
      pa = b; pb = d; pd = a;
      const t = pab; pab = pbd; pbd = pad; pad = t;
    } else if (pad > pab) {
      pa = d; pb = a; pd = b;
      const t = pab; pab = pad; pad = pbd; pbd = t;
    }
    const maxU = uSpan * plateW * 0.999;
    const maxV = vSpan * plateH * 0.999;
    let px = 0;
    let py = 0;
    if (pab > 1e-4) {
      px = (pad * pad + pab * pab - pbd * pbd) / (2 * pab);
      const yy = pad * pad - px * px;
      py = yy > 0 ? Math.sqrt(yy) : 0;
    }
    const minX = Math.min(0, px);
    const maxX = Math.max(pab, px);
    const tooBig = maxX - minX > maxU || py > maxV;
    if (tooBig && depth < 14) {
      const mid = lerp3(pa, pb, 0.5);
      fitTri(pa, mid, pd, up, depth + 1);
      fitTri(mid, pb, pd, up, depth + 1);
      return;
    }
    const ox = -minX;
    const uv = (x, y) => [u0 + (x + ox) / plateW, v0 + y / plateH];
    tri(pa, pb, pd, uv(0, 0), uv(pab, 0), uv(px, py), up);
  }

  function wall(a, b, e, d) {
    fitTri(a, b, d, 0, 0);
    fitTri(a, d, e, 0, 0);
  }

  function capTri(a, b, d, up) {
    fitTri(a, b, d, up, 0);
  }

  for (let si = 0; si < sCount - 1; si++) {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a = corner(part, stations[si], i);
      const b = corner(part, stations[si], j);
      const d = corner(part, stations[si + 1], j);
      const e = corner(part, stations[si + 1], i);
      wall(a, b, e, d);
    }
  }
  const foot = stations[0];
  const cap = stations[sCount - 1];
  const footC = [0, foot[0], 0];
  const capC = [0, cap[0], 0];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    capTri(footC, corner(part, foot, j), corner(part, foot, i), -1, 0);
    capTri(capC, corner(part, cap, i), corner(part, cap, j), 1, 0);
  }
  return worst;
}

/**
 * Append one placed solid. `item` carries the foot, the yaw, and the atlas rect.
 * Returns the number of vertices written.
 */
export function writeInstance(dst, offset, item) {
  const tmp = [];
  item.faceStretch = writeSolid(tmp, item);
  for (let i = 0; i < tmp.length; i++) dst[offset + i] = tmp[i];
  return tmp.length / STRIDE;
}

/** Worst UV stretch of one placed solid. 1 is a true-size texel. */
export function faceStretch(item) {
  const tmp = [];
  return writeSolid(tmp, item);
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
  const chunks = [];
  let count = 0;
  let stretch = 0;
  for (let i = 0; i < items.length; i++) {
    const tmp = [];
    const s = writeSolid(tmp, items[i]);
    items[i].faceStretch = s;
    if (s > stretch) stretch = s;
    chunks.push(tmp);
    count += tmp.length / STRIDE;
  }
  const data = new Float32Array(Math.max(STRIDE, count * STRIDE));
  let offset = 0;
  for (let c = 0; c < chunks.length; c++) {
    const tmp = chunks[c];
    for (let i = 0; i < tmp.length; i++) data[offset++] = tmp[i];
  }
  return { data, count, stretch };
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
  const plateW = Math.max(1, (side[2] - side[0]) * img.width);
  const plateH = Math.max(1, (side[3] - side[1]) * img.height);
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
      contentH: plateH,
      plateW,
      plateH,
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

/**
 * One instanced draw of Echo Shard cards. No collider. Near cull hides a
 * card that would pass magnification 1. Sampling is LINEAR_MIPMAP_LINEAR.
 */

import { footY, seatMin, worldHeight } from "./place.js";
import { mountShardSolid } from "./solid.js";

const NEAR_CAP_GPU = 0.99;
const NEAR_CAP_JS = 0.995;

const VS = `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aBody;
layout(location=2) in vec4 aGeom;
layout(location=3) in vec4 aUv;
uniform mat4 uVP;
uniform vec3 uEye;
uniform float uFocal;
out vec2 vUv;
float nearDist(vec4 b, vec4 g, vec3 e) {
  float qy = clamp(e.y, b.y, b.y + g.y);
  vec2 d = e.xz - b.xz;
  vec2 u = vec2(cos(b.w), -sin(b.w));
  float t = clamp(dot(d, u), -0.5 * g.x, 0.5 * g.x);
  float hz = length(d - u * t);
  return length(vec2(hz, e.y - qy));
}
void main() {
  float yaw = aBody.w;
  float c = cos(yaw);
  float s = sin(yaw);
  vec3 p = vec3(aBody.x, aBody.y, aBody.z);
  p += vec3(c, 0.0, -s) * (aCorner.x - 0.5) * aGeom.x;
  p.y += aCorner.y * aGeom.y;
  vUv = mix(aUv.xy, aUv.zw, aCorner);
  gl_Position = uVP * vec4(p, 1.0);
  if (aGeom.z > 0.0 && uFocal > 0.0 && nearDist(aBody, aGeom, uEye) * ${NEAR_CAP_GPU.toFixed(4)} < uFocal * aGeom.z) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
}`;

const FS = `#version 300 es
precision highp float;
uniform sampler2D uTex;
in vec2 vUv;
out vec4 o;
void main() {
  vec4 c = texture(uTex, vUv);
  if (c.a < 0.45) discard;
  o = vec4(c.rgb, 1.0);
}`;

function program(gl, vs, fs) {
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

function texUpload(gl, source) {
  const flip = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
  const pre = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flip);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, pre);
}

function noop() {
  return {
    draws: 0,
    colliders: [],
    draw() {},
    mag() { return 0; },
    setFound() {},
    info() { return { placed: 0, drawn: 0, draws: 0, colliders: [] }; },
  };
}

export async function mountWorld(gl, env, manifest) {
  const shards = manifest.shards || [];
  if (!gl || !shards.length) return noop();
  if (manifest.solid && manifest.solid.loft && manifest.solid.skin) {
    try {
      const solid = await mountShardSolid(gl, env, manifest);
      if (solid) return solid;
    } catch (err) {
      console.warn("shard solid", err);
    }
  }
  const urls = [];
  for (let i = 0; i < shards.length; i++) {
    if (!urls.includes(shards[i].image)) urls.push(shards[i].image);
  }
  const imgs = [];
  for (let i = 0; i < urls.length; i++) {
    imgs.push({ url: urls[i], img: await env.loadImage(env.absUrl(urls[i])) });
  }
  let source = imgs[0].img;
  const uvOf = {};
  if (imgs.length === 1) {
    uvOf[imgs[0].url] = { u0: 0, v0: 0, u1: 1, v1: 1, w: source.width, h: source.height };
  } else {
    const W = imgs.reduce((s, row) => s + row.img.width, 0);
    const H = imgs.reduce((s, row) => Math.max(s, row.img.height), 0);
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    let x = 0;
    for (let i = 0; i < imgs.length; i++) {
      const im = imgs[i].img;
      ctx.drawImage(im, x, H - im.height);
      uvOf[imgs[i].url] = {
        u0: x / W,
        v0: 0,
        u1: (x + im.width) / W,
        v1: im.height / H,
        w: im.width,
        h: im.height,
      };
      x += im.width;
    }
    source = canvas;
  }

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  texUpload(gl, source);
  gl.generateMipmap(gl.TEXTURE_2D);
  const tw = source.width;
  const th = source.height;
  env.trackTex("echo-crystal", Math.ceil(tw * th * 4 * 4 / 3));

  const focal = env.focal;
  const cap = manifest.heightCapM == null ? 1.12 : manifest.heightCapM;
  const approach = manifest.approachM == null ? 2.3 : manifest.approachM;
  const buryFrac = manifest.buryFrac == null ? 0.1 : manifest.buryFrac;
  const groundAt = env.groundAt || (() => 0);
  const placed = [];
  for (let i = 0; i < shards.length; i++) {
    const s = shards[i];
    const uv = uvOf[s.image];
    const contentH = uv.h;
    const contentW = uv.w;
    const worldH = worldHeight(contentH, focal, approach, cap);
    if (!(worldH > 0)) continue;
    const quadH = worldH;
    const quadW = worldH * (contentW / contentH);
    const yaw = ((s.yaw || 0) * Math.PI) / 180;
    const halfW = quadW * 0.5;
    const seat = seatMin(groundAt, s.x, s.z, yaw, 1, halfW);
    const bury = worldH * buryFrac;
    const y = footY(seat, bury);
    placed.push({
      id: s.id,
      x: s.x,
      z: s.z,
      y,
      seat,
      yaw,
      quadW,
      quadH,
      worldH,
      contentH,
      mpp: worldH / contentH,
      uv,
    });
  }

  const prog = program(gl, VS, FS);
  const loc = {
    vp: gl.getUniformLocation(prog, "uVP"),
    tex: gl.getUniformLocation(prog, "uTex"),
    eye: gl.getUniformLocation(prog, "uEye"),
    focal: gl.getUniformLocation(prog, "uFocal"),
  };
  const corners = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
  let vao = null;
  let shown = [];

  function bind(buf, n) {
    const next = gl.createVertexArray();
    gl.bindVertexArray(next);
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ib);
    gl.bufferData(gl.ARRAY_BUFFER, buf.subarray(0, n * 12), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 48, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 48, 16);
    gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 48, 32);
    gl.vertexAttribDivisor(3, 1);
    gl.bindVertexArray(null);
    return next;
  }

  function rebuild(found) {
    shown = placed.filter((p) => !found || !found.has(p.id));
    if (vao) gl.deleteVertexArray(vao);
    vao = null;
    if (!shown.length) return;
    const buf = new Float32Array(shown.length * 12);
    for (let i = 0; i < shown.length; i++) {
      const p = shown[i];
      const o = i * 12;
      buf[o] = p.x;
      buf[o + 1] = p.y;
      buf[o + 2] = p.z;
      buf[o + 3] = p.yaw;
      buf[o + 4] = p.quadW;
      buf[o + 5] = p.quadH;
      buf[o + 6] = p.mpp;
      buf[o + 7] = 1;
      buf[o + 8] = p.uv.u0;
      buf[o + 9] = p.uv.v0;
      buf[o + 10] = p.uv.u1;
      buf[o + 11] = p.uv.v1;
    }
    vao = bind(buf, shown.length);
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
    const ux = Math.cos(p.yaw);
    const uz = -Math.sin(p.yaw);
    const dx = eye[0] - p.x;
    const dz = eye[2] - p.z;
    const t = Math.max(-0.5 * p.quadW, Math.min(0.5 * p.quadW, dx * ux + dz * uz));
    const qy = Math.max(p.y, Math.min(p.y + p.quadH, eye[1]));
    const dist = Math.hypot(dx - ux * t, eye[1] - qy, dz - uz * t);
    return dist * NEAR_CAP_JS < focal * p.mpp;
  }

  rebuild(null);

  return {
    colliders: [],
    get draws() { return shown.length ? 1 : 0; },
    setFound(found) { rebuild(found); },
    draw(vp, eye) {
      if (!shown.length || !vao) return;
      gl.useProgram(prog);
      gl.bindVertexArray(vao);
      gl.uniformMatrix4fv(loc.vp, false, vp);
      gl.uniform3f(loc.eye, eye ? eye[0] : 0, eye ? eye[1] : 0, eye ? eye[2] : 0);
      gl.uniform1f(loc.focal, eye && focal ? focal : 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(loc.tex, 0);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.disable(gl.CULL_FACE);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, shown.length);
      gl.bindVertexArray(null);
    },
    mag(eye, f, vp) {
      let m = 0;
      const focalNow = f || focal;
      for (let i = 0; i < shown.length; i++) {
        const p = shown[i];
        if (nearCut(eye, p)) continue;
        const cx = p.x;
        const cy = p.y + p.worldH * 0.5;
        const cz = p.z;
        if (!onScreen(vp, cx, cy, cz, Math.hypot(p.quadW * 0.5, p.worldH * 0.5))) continue;
        const ux = Math.cos(p.yaw);
        const uz = -Math.sin(p.yaw);
        const ex = eye[0] - p.x;
        const ez = eye[2] - p.z;
        const t = Math.max(-p.quadW * 0.5, Math.min(p.quadW * 0.5, ex * ux + ez * uz));
        const qy = Math.max(p.y, Math.min(p.y + p.worldH, eye[1]));
        const dist = Math.max(0.35, Math.hypot(ex - ux * t, eye[1] - qy, ez - uz * t));
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
        worldH: placed[0] ? placed[0].worldH : 0,
        texMiB: (tw * th * 4 * 4 / 3) / (1024 * 1024),
        atlas: [tw, th],
      };
    },
  };
}

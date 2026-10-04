/**
 * Near mesas: one loft per rock. Front and side silhouettes set the sections.
 * Each face wears an unlit Imagine skin. The base sits under the skirt.
 * Far painted mesas stay in the sky slices.
 */
const STATIONS = 28;
const SINK_M = 2.6;
const KEY = 12;
const MAX_SIDE = 1280;

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
    info() { return { count: 0, sinkM: SINK_M }; },
  };
}

function seatMin(heightAt, skirtLift, x, z, hx, hz) {
  let min = Infinity;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const px = x + i * hx;
      const pz = z + j * hz;
      const h = heightAt(px, pz) + skirtLift(px, pz);
      if (h < min) min = h;
    }
  }
  return Number.isFinite(min) ? min : 0;
}

function pixelsOf(img) {
  let w = img.width;
  let h = img.height;
  const long = Math.max(w, h);
  if (long > MAX_SIDE) {
    const k = MAX_SIDE / long;
    w = Math.max(1, Math.round(w * k));
    h = Math.max(1, Math.round(h * k));
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0, w, h);
  const data = g.getImageData(0, 0, w, h).data;
  return { w, h, data };
}

function isOp(data, w, x, y) {
  const o = (y * w + x) * 4;
  if (data[o + 3] < 128) return false;
  return data[o] > KEY || data[o + 1] > KEY || data[o + 2] > KEY;
}

function silhouette(img) {
  const left = new Int32Array(img.h);
  const right = new Int32Array(img.h);
  left.fill(-1);
  right.fill(-1);
  let top = img.h;
  let bot = -1;
  let minX = img.w;
  let maxX = -1;
  for (let y = 0; y < img.h; y++) {
    let L = -1;
    let R = -1;
    for (let x = 0; x < img.w; x++) {
      if (!isOp(img.data, img.w, x, y)) continue;
      if (L < 0) L = x;
      R = x;
    }
    if (L < 0) continue;
    left[y] = L;
    right[y] = R;
    if (y < top) top = y;
    if (y > bot) bot = y;
    if (L < minX) minX = L;
    if (R > maxX) maxX = R;
  }
  if (bot < top) return null;
  let prev = top;
  for (let y = top; y <= bot; y++) {
    if (left[y] >= 0) {
      prev = y;
      continue;
    }
    let nxt = y + 1;
    while (nxt <= bot && left[nxt] < 0) nxt++;
    const b = nxt <= bot ? nxt : prev;
    const span = Math.max(1, b - prev);
    const t = (y - prev) / span;
    left[y] = Math.round(left[prev] * (1 - t) + left[b] * t);
    right[y] = Math.round(right[prev] * (1 - t) + right[b] * t);
  }
  return {
    left,
    right,
    top,
    bot,
    minX,
    maxX,
    contentH: bot - top + 1,
    contentW: maxX - minX + 1,
    midX: (minX + maxX) * 0.5,
  };
}

function rowAt(sil, t) {
  const y = sil.bot - t * (sil.bot - sil.top);
  const y0 = Math.max(sil.top, Math.min(sil.bot, Math.floor(y)));
  const y1 = Math.max(sil.top, Math.min(sil.bot, y0 + 1));
  const f = Math.min(1, Math.max(0, y - y0));
  return {
    y,
    L: sil.left[y0] * (1 - f) + sil.left[y1] * f,
    R: sil.right[y0] * (1 - f) + sil.right[y1] * f,
  };
}

function bleed(img) {
  const { w, h, data } = img;
  const n = w * h;
  const a = new Uint8Array(n);
  const rgb = new Uint8Array(n * 3);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    rgb[i * 3] = data[o];
    rgb[i * 3 + 1] = data[o + 1];
    rgb[i * 3 + 2] = data[o + 2];
    a[i] = isOp(data, w, i % w, (i / w) | 0) ? 255 : 0;
  }
  const op = new Uint8Array(n);
  for (let i = 0; i < n; i++) op[i] = a[i] ? 1 : 0;
  for (let pass = 0; pass < 6; pass++) {
    const nr = rgb.slice();
    const no = op.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (op[i]) continue;
        const ns = [
          x > 0 ? i - 1 : -1,
          x + 1 < w ? i + 1 : -1,
          y > 0 ? i - w : -1,
          y + 1 < h ? i + w : -1,
        ];
        for (let k = 0; k < 4; k++) {
          const j = ns[k];
          if (j >= 0 && op[j]) {
            nr[i * 3] = rgb[j * 3];
            nr[i * 3 + 1] = rgb[j * 3 + 1];
            nr[i * 3 + 2] = rgb[j * 3 + 2];
            no[i] = 1;
            break;
          }
        }
      }
    }
    rgb.set(nr);
    op.set(no);
  }
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    out[i * 4] = rgb[i * 3];
    out[i * 4 + 1] = rgb[i * 3 + 1];
    out[i * 4 + 2] = rgb[i * 3 + 2];
    out[i * 4 + 3] = op[i] ? 255 : 0;
  }
  return out;
}

async function loadFace(env, file) {
  if (!file) return null;
  try {
    const img = await env.loadImage(env.absUrl(file));
    const px = pixelsOf(img);
    const sil = silhouette(px);
    if (!sil) return null;
    return { w: px.w, h: px.h, data: px.data, sil, file };
  } catch (e) {
    console.warn("mesa face", file, e);
    return null;
  }
}

function pushVert(verts, p, u, v, fitX, fitY, layer, id) {
  const idx = verts.length / 9;
  verts.push(p[0], p[1], p[2], u, v, fitX, fitY, layer, id);
  return idx;
}

function pushTri(dst, a, b, c) {
  dst.i.push(a, b, c);
}

export async function mountMesas(gl, env) {
  let manifest;
  try {
    const res = await fetch(env.manifestUrl);
    if (!res.ok) return empty();
    manifest = await res.json();
  } catch (e) {
    return empty();
  }
  const cards = manifest.cards || [];
  if (!cards.length) return empty();

  const built = [];
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const front = await loadFace(env, env.root + c.file);
    if (!front) continue;
    const side = (await loadFace(env, c.side ? env.root + c.side : "")) || null;
    const back = (await loadFace(env, c.back ? env.root + c.back : "")) || null;
    const top = (await loadFace(env, c.top ? env.root + c.top : "")) || null;
    const worldH = c.h * (front.sil.contentH / front.h);
    const mpp = worldH / front.sil.contentH;
    let maxW = 0;
    for (let s = 0; s < STATIONS; s++) {
      const row = rowAt(front.sil, s / (STATIONS - 1));
      maxW = Math.max(maxW, (row.R - row.L) * mpp);
    }
    let sideFace = side;
    let mppS = mpp;
    let depth = maxW * 0.62;
    if (side) {
      mppS = worldH / side.sil.contentH;
      depth = side.sil.contentW * mppS;
      const cap = maxW * 1.35;
      if (depth > cap) depth = cap;
    } else {
      sideFace = front;
      mppS = mpp;
      depth = maxW * 0.62;
    }
    const len = Math.hypot(c.x, c.z) || 1;
    const rx = c.z / len;
    const rz = -c.x / len;
    const fx = -c.x / len;
    const fz = -c.z / len;
    const foot = 0.5 * Math.hypot(maxW, depth);
    const seat = seatMin(env.heightAt, env.skirtLift, c.x, c.z, foot, foot);
    const baseY = seat - SINK_M;
    built.push({
      i,
      card: c,
      front,
      side: sideFace,
      sideReal: !!side,
      back: back || front,
      backReal: !!back,
      top,
      worldH,
      mpp,
      mppS,
      maxW,
      depth,
      baseY,
      seat,
      rx,
      rz,
      fx,
      fz,
      contentH: front.sil.contentH,
      sideH: sideFace.sil.contentH,
      sideW: side ? side.sil.contentW : Math.max(1, Math.round(depth / mpp)),
    });
  }
  if (!built.length) return empty();

  let maxW = 2;
  let maxH = 2;
  const layers = [];
  function addLayer(face) {
    if (!face) return -1;
    if (face._layer != null) return face._layer;
    face._layer = layers.length;
    layers.push(face);
    maxW = Math.max(maxW, face.w);
    maxH = Math.max(maxH, face.h);
    return face._layer;
  }
  for (const b of built) {
    addLayer(b.front);
    addLayer(b.side);
    addLayer(b.back);
    if (b.top) addLayer(b.top);
  }

  const levels = Math.floor(Math.log2(Math.max(maxW, maxH))) + 1;
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
  gl.texStorage3D(gl.TEXTURE_2D_ARRAY, levels, gl.RGBA8, maxW, maxH, layers.length);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.getError();
  for (let i = 0; i < layers.length; i++) {
    const face = layers[i];
    const keyed = bleed(face);
    const full = new Uint8Array(maxW * maxH * 4);
    const rowBytes = face.w * 4;
    for (let y = 0; y < face.h; y++) {
      full.set(keyed.subarray(y * rowBytes, y * rowBytes + rowBytes), y * maxW * 4);
    }
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, maxW, maxH, 1, gl.RGBA, gl.UNSIGNED_BYTE, full);
    face.fitX = face.w / maxW;
    face.fitY = face.h / maxH;
  }
  gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
  const uploadError = gl.getError();
  env.trackTex("mesas", Math.ceil(maxW * maxH * 4 * layers.length * 4 / 3));

  const verts = [];
  const index = [];
  const dst = { i: index };

  function place(b, lx, ly, lz) {
    return [
      b.card.x + b.rx * lx + b.fx * lz,
      b.baseY + ly,
      b.card.z + b.rz * lx + b.fz * lz,
    ];
  }
  function vImg(face, px, py) {
    return [(px + 0.5) / face.w, (py + 0.5) / face.h];
  }

  for (const b of built) {
    const id = env.labelOf("butte:" + b.i);
    const cols = [];
    for (let s = 0; s < STATIONS; s++) {
      const t = s / (STATIONS - 1);
      const fr = rowAt(b.front.sil, t);
      const xL = (fr.L - b.front.sil.midX) * b.mpp;
      const xR = (fr.R - b.front.sil.midX) * b.mpp;
      let zF = b.depth * 0.5;
      let zB = -b.depth * 0.5;
      const sr = rowAt(b.side.sil, t);
      const span = Math.max(1, sr.R - sr.L);
      const used = Math.min(span, b.depth / b.mppS);
      const midS = (sr.L + sr.R) * 0.5;
      let sL = (midS - used * 0.5) / b.side.w;
      let sR = (midS + used * 0.5) / b.side.w;
      if (sL < 0) {
        sR -= sL;
        sL = 0;
      }
      if (sR > 1) {
        sL -= sR - 1;
        sR = 1;
      }
      if (b.sideReal) {
        zF = used * b.mppS * 0.5;
        zB = -zF;
      }
      const y = t * b.worldH;
      const fuL = vImg(b.front, fr.L, fr.y);
      const fuR = vImg(b.front, fr.R, fr.y);
      let buL = fuL;
      let buR = fuR;
      if (b.backReal) {
        const br = rowAt(b.back.sil, t);
        const mppB = b.worldH / b.back.sil.contentH;
        const faceW = Math.max(0.01, xR - xL);
        const pix = faceW / mppB;
        const mid = b.back.sil.midX;
        const u0 = (mid - pix * 0.5) / b.back.w;
        const u1 = (mid + pix * 0.5) / b.back.w;
        const vv = vImg(b.back, mid, br.y)[1];
        buL = [u0, vv];
        buR = [u1, vv];
      }
      const sv = vImg(b.side, b.side.w * 0.5, rowAt(b.side.sil, t).y)[1];
      cols.push({ xL, xR, zF, zB, y, fuL, fuR, buL, buR, sL, sR, sv });
    }
    const fFit = [b.front.fitX, b.front.fitY, b.front._layer];
    const sFit = [b.side.fitX, b.side.fitY, b.side._layer];
    const kFit = [b.back.fitX, b.back.fitY, b.back._layer];
    for (let s = 0; s < STATIONS - 1; s++) {
      const a = cols[s];
      const c = cols[s + 1];
      const q = (p0, p1, p2, p3, u0, u1, u2, u3, fit) => {
        const i0 = pushVert(verts, p0, u0[0], u0[1], fit[0], fit[1], fit[2], id);
        const i1 = pushVert(verts, p1, u1[0], u1[1], fit[0], fit[1], fit[2], id);
        const i2 = pushVert(verts, p2, u2[0], u2[1], fit[0], fit[1], fit[2], id);
        const i3 = pushVert(verts, p3, u3[0], u3[1], fit[0], fit[1], fit[2], id);
        pushTri(dst, i0, i1, i2);
        pushTri(dst, i0, i2, i3);
      };
      q(
        place(b, a.xL, a.y, a.zF), place(b, a.xR, a.y, a.zF),
        place(b, c.xR, c.y, c.zF), place(b, c.xL, c.y, c.zF),
        a.fuL, a.fuR, c.fuR, c.fuL, fFit,
      );
      q(
        place(b, a.xR, a.y, a.zB), place(b, a.xL, a.y, a.zB),
        place(b, c.xL, c.y, c.zB), place(b, c.xR, c.y, c.zB),
        a.buR, a.buL, c.buL, c.buR, kFit,
      );
      q(
        place(b, a.xR, a.y, a.zF), place(b, a.xR, a.y, a.zB),
        place(b, c.xR, c.y, c.zB), place(b, c.xR, c.y, c.zF),
        [a.sR, a.sv], [a.sL, a.sv], [c.sL, c.sv], [c.sR, c.sv], sFit,
      );
      q(
        place(b, a.xL, a.y, a.zB), place(b, a.xL, a.y, a.zF),
        place(b, c.xL, c.y, c.zF), place(b, c.xL, c.y, c.zB),
        [a.sL, a.sv], [a.sR, a.sv], [c.sR, c.sv], [c.sL, c.sv], sFit,
      );
    }
    const cap = cols[STATIONS - 1];
    const topFace = b.top || b.front;
    const tFit = [topFace.fitX, topFace.fitY, topFace._layer];
    const fw = Math.max(0.01, cap.xR - cap.xL);
    const fd = Math.max(0.01, cap.zF - cap.zB);
    const sil = topFace.sil;
    const srcW = b.top ? sil.contentW : Math.max(1, sil.maxX - sil.minX);
    const srcH = b.top ? sil.contentH : Math.max(2, Math.round(sil.contentH * 0.18));
    const srcCx = b.top ? sil.midX : (sil.minX + sil.maxX) * 0.5;
    const srcCy = b.top ? (sil.top + sil.bot) * 0.5 : sil.top + srcH * 0.5;
    const mppT = Math.max(fw / srcW, fd / srcH);
    const cx = (cap.xL + cap.xR) * 0.5;
    const cz = (cap.zB + cap.zF) * 0.5;
    const uvTop = (lx, lz) => {
      const px = srcCx + (lx - cx) / mppT;
      const py = srcCy + (lz - cz) / mppT;
      return [(px + 0.5) / topFace.w, 1 - (py + 0.5) / topFace.h];
    };
    const corners = [
      [cap.xL, cap.zF],
      [cap.xR, cap.zF],
      [cap.xR, cap.zB],
      [cap.xL, cap.zB],
    ];
    const ids = corners.map(([lx, lz]) => {
      const uv = uvTop(lx, lz);
      return pushVert(verts, place(b, lx, cap.y, lz), uv[0], uv[1], tFit[0], tFit[1], tFit[2], id);
    });
    pushTri(dst, ids[0], ids[1], ids[2]);
    pushTri(dst, ids[0], ids[2], ids[3]);
  }

  const prog = program(gl, `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aUv;
layout(location=2) in vec2 aFit;
layout(location=3) in float aLayer;
layout(location=4) in float aId;
uniform mat4 uVP;
out vec2 vUv;
flat out vec2 vFit;
flat out float vLayer;
flat out float vId;
void main() {
  gl_Position = uVP * vec4(aPos, 1.0);
  vUv = aUv;
  vFit = aFit;
  vLayer = aLayer;
  vId = aId;
}`, `#version 300 es
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray uTex;
uniform int uMode;
in vec2 vUv;
flat in vec2 vFit;
flat in float vLayer;
flat in float vId;
out vec4 o;
void main() {
  if (vUv.x < 0.0 || vUv.y < 0.0 || vUv.x > 1.0 || vUv.y > 1.0) discard;
  vec2 st = vec2(vUv.x * vFit.x, vUv.y * vFit.y);
  vec4 c = texture(uTex, vec3(st, vLayer));
  if (c.a < 0.5) discard;
  if (uMode == 1) o = vec4(vId / 255.0, 0.0, 0.0, 1.0);
  else o = vec4(c.rgb, 1.0);
}`);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  const ib = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  const idx = new Uint32Array(index);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  const stride = 9 * 4;
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 12);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 20);
  gl.enableVertexAttribArray(3);
  gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 28);
  gl.enableVertexAttribArray(4);
  gl.vertexAttribPointer(4, 1, gl.FLOAT, false, stride, 32);
  gl.bindVertexArray(null);

  const loc = {
    vp: gl.getUniformLocation(prog, "uVP"),
    tex: gl.getUniformLocation(prog, "uTex"),
    mode: gl.getUniformLocation(prog, "uMode"),
  };
  const count = index.length;
  const infoRows = built.map((b) => ({
    i: b.i,
    x: b.card.x,
    z: b.card.z,
    worldH: b.worldH,
    width: b.maxW,
    depth: b.depth,
    baseY: b.baseY,
    seat: b.seat,
    sinkM: SINK_M,
    contentH: b.contentH,
    sideReal: b.sideReal,
    backReal: b.backReal,
    topReal: !!b.top,
  }));

  return {
    draws: 1,
    count: built.length,
    draw(vp, mode) {
      gl.useProgram(prog);
      gl.bindVertexArray(vao);
      gl.uniformMatrix4fv(loc.vp, false, vp);
      gl.uniform1i(loc.mode, mode);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
      gl.uniform1i(loc.tex, 0);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_INT, 0);
    },
    mag(eye, focal) {
      let m = 0;
      for (let i = 0; i < built.length; i++) {
        const b = built[i];
        const d = Math.max(0.5, Math.hypot(eye[0] - b.card.x, eye[2] - b.card.z));
        const sh = (focal * b.worldH) / d;
        const sw = (focal * b.maxW) / d;
        const sd = (focal * b.depth) / d;
        m = Math.max(m, sh / b.contentH, sw / Math.max(1, b.front.sil.contentW), sd / Math.max(1, b.sideW), sh / b.sideH);
      }
      return m;
    },
    info() {
      return { count: built.length, sinkM: SINK_M, layers: layers.length, texW: maxW, texH: maxH, uploadError, tris: count / 3, rows: infoRows };
    },
  };
}

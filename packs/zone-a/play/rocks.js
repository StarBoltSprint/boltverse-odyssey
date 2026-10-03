/**
 * Instanced Imagine rocks. Code places and seats. Pixels stay on the hulls
 * and the keyed cutouts. Drawn into the scene target so the existing fog applies.
 */
import { loadWorldHull } from "./hullmesh.js";

const VS = `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aBody;
layout(location=2) in vec4 aSize;
uniform mat4 uVP;
out vec2 vUv;
flat out int vLayer;
void main() {
  float yaw = aBody.w;
  float c = cos(yaw);
  float s = sin(yaw);
  vec3 right = vec3(c, 0.0, -s);
  vec3 p = vec3(aBody.x, aBody.y, aBody.z);
  p += right * (aCorner.x - 0.5) * aSize.x;
  p.y += aCorner.y * aSize.y;
  vUv = aCorner;
  vLayer = int(aSize.z + 0.5);
  gl_Position = uVP * vec4(p, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray uTex;
in vec2 vUv;
flat in int vLayer;
out vec4 o;
void main() {
  vec4 c = texture(uTex, vec3(vUv, float(vLayer)));
  if (c.a < 0.35) discard;
  o = c;
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

function empty() {
  return {
    hulls: [],
    objects: [],
    draws: 0,
    draw() {},
    mag() { return 0; },
    info() { return { count: 0, types: {}, loadMs: 0 }; },
  };
}

function seatMin(heightAt, x, z, radius) {
  const r = Math.max(0.12, radius);
  let min = Infinity;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const h = heightAt(x + i * r * 0.55, z + j * r * 0.55);
      if (h < min) min = h;
    }
  }
  return min;
}

function pixelsOf(img, maxH) {
  let w = img.width;
  let h = img.height;
  if (h > maxH) {
    w = Math.max(1, Math.round(w * maxH / h));
    h = maxH;
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0, w, h);
  return { w, h, data: g.getImageData(0, 0, w, h).data };
}

export async function mountRocks(gl, env) {
  const t0 = performance.now();
  let manifest;
  try {
    const res = await fetch(env.absUrl("packs/zone-a/src/rocks/manifest.json"));
    if (!res.ok) return empty();
    manifest = await res.json();
  } catch (e) {
    return empty();
  }
  const types = manifest.types || {};
  const assets = manifest.assets || {};
  const instances = manifest.instances || [];
  const hulls = [];
  const objects = [];
  const byType = {};
  for (const name of Object.keys(types)) {
    const spec = types[name];
    if (!spec || spec.kind !== "hull" || !assets[name]) continue;
    const path = assets[name];
    try {
      const hull = await loadWorldHull(gl, env.absUrl(path), env.trackTex, { maxH: spec.maxTex || 720 });
      byType[name] = hull;
      hulls.push({ path, hull });
    } catch (e) {
      console.warn("rock hull", name, e);
    }
  }
  for (let i = 0; i < instances.length; i++) {
    const inst = instances[i];
    const hull = byType[inst.type];
    const spec = types[inst.type];
    if (!hull || !spec || spec.kind !== "hull") continue;
    const scale = inst.scale || 1;
    const meshH = Math.max(0.05, hull.maxY - hull.minY);
    // The carve is shorter than the kit height when the still has margin.
    // Fit the instance so the mesh matches that height. Do not enlarge the texture file.
    const drawScale = (spec.objectSize[1] * scale) / meshH;
    const foot = 0.5 * Math.hypot(spec.objectSize[0], spec.objectSize[2]) * drawScale;
    const base = seatMin(env.heightAt, inst.x, inst.z, foot);
    const y = base - hull.minY * drawScale;
    hull.addInstance(inst.x, y, inst.z, inst.yaw || 0, drawScale, env.labelOf(inst.id));
    if (inst.collider !== false) {
      objects.push({
        id: inst.id,
        asset: assets[inst.type],
        position: [inst.x, inst.z],
        yaw_deg: inst.yaw || 0,
        scale: drawScale,
        base_y_m: base,
        kind: "rock",
      });
    }
  }
  for (const row of hulls) row.hull.upload();

  const pebbleSpec = types.pebble;
  const variants = (pebbleSpec && pebbleSpec.variants) || [];
  const pebImgs = [];
  const boxes = [];
  for (let i = 0; i < variants.length; i++) {
    const meta = assets[variants[i]];
    if (!meta) continue;
    const img = await env.loadImage(env.absUrl(meta.file));
    pebImgs.push(pixelsOf(img, pebbleSpec.maxTex || 384));
    boxes.push(meta);
  }
  let pebbleDraw = null;
  const magN = { n: 0, x: new Float32Array(0), h: new Float32Array(0), px: new Float32Array(0) };
  if (pebImgs.length) {
    let maxW = 2;
    let maxH = 2;
    for (const im of pebImgs) {
      maxW = Math.max(maxW, im.w);
      maxH = Math.max(maxH, im.h);
    }
    const levels = Math.floor(Math.log2(Math.max(maxW, maxH))) + 1;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, levels, gl.RGBA8, maxW, maxH, pebImgs.length);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    for (let i = 0; i < pebImgs.length; i++) {
      const im = pebImgs[i];
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, im.w, im.h, 1, gl.RGBA, gl.UNSIGNED_BYTE, im.data);
    }
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    env.trackTex("rocks-pebble", Math.ceil(maxW * maxH * 4 * pebImgs.length * 4 / 3));

    const list = instances.filter((o) => o.type === "pebble");
    const data = new Float32Array(list.length * 2 * 8);
    magN.n = list.length;
    magN.x = new Float32Array(list.length * 3);
    magN.h = new Float32Array(list.length);
    magN.px = new Float32Array(list.length);
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const inst = list[i];
      const box = boxes[inst.variant] || boxes[0];
      const contentH = box.contentH || maxH;
      const worldH = (inst.heightM || 0.2) * (inst.scale || 1);
      const cardH = worldH * (maxH / contentH);
      const cardW = cardH * (maxW / maxH);
      const foot = worldH * 0.55;
      const base = seatMin(env.heightAt, inst.x, inst.z, foot);
      magN.x[i * 3] = inst.x;
      magN.x[i * 3 + 1] = base + worldH * 0.5;
      magN.x[i * 3 + 2] = inst.z;
      magN.h[i] = worldH;
      magN.px[i] = contentH * (maxH / (box.tex || maxH));
      const yaw = (inst.yaw || 0) * Math.PI / 180;
      const layer = inst.variant || 0;
      for (let k = 0; k < 2; k++) {
        const o = w * 8;
        data[o] = inst.x;
        data[o + 1] = base;
        data[o + 2] = inst.z;
        data[o + 3] = yaw + k * Math.PI * 0.5;
        data[o + 4] = cardW;
        data[o + 5] = cardH;
        data[o + 6] = layer;
        data[o + 7] = 0;
        w++;
      }
    }
    const prog = program(gl, VS, FS);
    const loc = {
      vp: gl.getUniformLocation(prog, "uVP"),
      tex: gl.getUniformLocation(prog, "uTex"),
    };
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ib);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16);
    gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);
    pebbleDraw = { prog, loc, vao, tex, count: w };
  }

  const loadMs = performance.now() - t0;
  const counts = {};
  let drawn = 0;
  for (let i = 0; i < instances.length; i++) {
    const t = instances[i].type;
    const spec = types[t];
    const live = spec && (spec.kind === "cutout" ? assets[instances[i].variant] || assets[(spec.variants || [])[instances[i].variant]] : byType[t]);
    if (!live) continue;
    counts[t] = (counts[t] || 0) + 1;
    drawn++;
  }
  return {
    hulls,
    objects,
    draws: pebbleDraw ? 1 : 0,
    loadMs,
    draw(vp) {
      if (!pebbleDraw || !pebbleDraw.count) return;
      const d = pebbleDraw;
      gl.useProgram(d.prog);
      gl.bindVertexArray(d.vao);
      gl.uniformMatrix4fv(d.loc.vp, false, vp);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, d.tex);
      gl.uniform1i(d.loc.tex, 0);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.disable(gl.CULL_FACE);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, d.count);
      gl.bindVertexArray(null);
    },
    mag(eye, focal) {
      let m = 0;
      const x = magN.x;
      for (let i = 0; i < magN.n; i++) {
        const dx = eye[0] - x[i * 3];
        const dy = eye[1] - x[i * 3 + 1];
        const dz = eye[2] - x[i * 3 + 2];
        const dist = Math.max(0.35, Math.hypot(dx, dy, dz));
        const px = magN.px[i] || 256;
        const mm = (focal * magN.h[i]) / (dist * px);
        if (mm > m) m = mm;
      }
      return m;
    },
    info() {
      return { count: drawn, placed: instances.length, types: counts, loadMs, draws: pebbleDraw ? 1 : 0 };
    },
  };
}

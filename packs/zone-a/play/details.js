/**
 * Instanced micro-details. Ridge and pebble are cheap box solids (one instance).
 * Shard, tuft, feature rocks, and the far hills are lofted solids in one merged draw.
 * Seated on the drawn relief. World-locked. No camera-facing card.
 */

import { drawMerged, fillItems, uploadMerged } from "../../common/archives/solid.js";
import { radiusAt } from "./field.js";
import { HILL_ANGLES, HILL_H, HILL_PART, hillFaceDist, hillRepeat } from "./hills.js";
import { LOD_BOX, LOD_BOX_VERTS, LOD_DEPTH_FRAC } from "./lodbox.js";
// Cards nearer the eye than magnification 1 allows are culled per instance,
// so no drawn card is ever stretched. The GPU cut is a hair tighter than
// the JS check, so the measured magnification can only overstate.
const NEAR_CAP_GPU = 0.99;
const NEAR_CAP_JS = 0.995;

const VS = `#version 300 es
layout(location=0) in vec4 aCorner;
layout(location=1) in vec4 aBody;
layout(location=2) in vec4 aGeom;
layout(location=3) in vec4 aUv;
uniform mat4 uVP;
uniform vec3 uEye;
uniform float uFocal;
out vec2 vUv;
// Distance from the eye to the nearest point of the box (width aGeom.x, depth aGeom.w).
float nearDist(vec4 b, vec4 g, vec3 e) {
  float qy = clamp(e.y, b.y, b.y + g.y);
  vec2 d = e.xz - b.xz;
  float c = cos(b.w);
  float s = sin(b.w);
  vec2 right = vec2(c, -s);
  vec2 fwd = vec2(s, c);
  float lx = clamp(dot(d, right), -0.5 * g.x, 0.5 * g.x);
  float lz = clamp(dot(d, fwd), -0.5 * g.w, 0.5 * g.w);
  vec2 closest = right * lx + fwd * lz;
  return length(vec2(length(d - closest), e.y - qy));
}
void main() {
  float yaw = aBody.w;
  float c = cos(yaw);
  float s = sin(yaw);
  vec3 p = vec3(aBody.x, aBody.y, aBody.z);
  vec3 right = vec3(c, 0.0, -s);
  vec3 fwd = vec3(s, 0.0, c);
  p += right * aCorner.x * aGeom.x;
  p.y += aCorner.y * aGeom.y;
  p += fwd * aCorner.z * aGeom.w;
  float faceU;
  float faceV;
  if (aCorner.w < 0.5) {
    faceU = aCorner.x + 0.5;
    faceV = aCorner.y;
  } else if (aCorner.w < 1.5) {
    faceU = aCorner.z + 0.5;
    float frac = aGeom.w / max(aGeom.x, 1e-4);
    faceU = (1.0 - frac) * 0.5 + faceU * frac;
    faceV = aCorner.y;
  } else {
    faceU = aCorner.x + 0.5;
    faceV = aCorner.z + 0.5;
    float frac = aGeom.w / max(aGeom.y, 1e-4);
    faceV = (1.0 - frac) * 0.5 + faceV * frac;
  }
  vUv = mix(aUv.xy, aUv.zw, vec2(faceU, faceV));
  gl_Position = uVP * vec4(p, 1.0);
  // Near cull: a box closer to the eye than its own pixels allow at
  // magnification ${NEAR_CAP_GPU.toFixed(4)} is not drawn at all (same test as nearCut in JS).
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

// Half depth of a feature collider across the card. The card is one plane, so
// depth is not measured; a thin slab across the plane stops Bolt without
// reaching past what the side of the rock would cover.
const COLLIDER_HALF_DEPTH = 0.15;

function empty() {
  return {
    draws: 0,
    loadMs: 0,
    draw() {},
    mag() { return 0; },
    info() { return { placed: 0, drawn: 0, byType: {}, loadMs: 0, draws: 0 }; },
    colliders: [],
  };
}

// Lowest drawn ground under the bottom edge of every crossed plane, so no
// part of a card floats and micro relief between mesh vertices cannot bury it.
function seatMin(groundAt, x, z, yaw, planes, halfW) {
  let min = Infinity;
  for (let k = 0; k < planes; k++) {
    const a = yaw + k * Math.PI / planes;
    const ux = Math.cos(a);
    const uz = -Math.sin(a);
    for (let i = -2; i <= 2; i++) {
      const t = (i / 2) * halfW;
      const h = groundAt(x + ux * t, z + uz * t);
      if (h < min) min = h;
    }
  }
  return min;
}

// Copy each variant rect 1:1 onto a tighter sheet. No resample. Empty atlas padding is not uploaded.
function repackAtlas(img, variants) {
  const W = img.width;
  const H = img.height;
  if (!W || !H || !variants.length) return { img, variants };
  const rects = [];
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    const x = Math.round(v.u0 * W);
    const y = Math.round((1 - v.v1) * H);
    const w = v.rectW || Math.round((v.u1 - v.u0) * W);
    const h = v.rectH || Math.round((v.v1 - v.v0) * H);
    if (w < 1 || h < 1 || x < 0 || y < 0 || x + w > W || y + h > H) return { img, variants };
    rects.push({ x, y, w, h });
  }
  const gutter = 2;
  let maxRow = 0;
  for (let i = 0; i < rects.length; i++) if (rects[i].w > maxRow) maxRow = rects[i].w;
  const packAt = (rowMax) => {
    let x = 0;
    let y = 0;
    let rh = 0;
    let uw = 0;
    const at = [];
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (x > 0 && x + r.w > rowMax) {
        y += rh + gutter;
        x = 0;
        rh = 0;
      }
      at.push({ dx: x, dy: y });
      x += r.w + gutter;
      if (x - gutter > uw) uw = x - gutter;
      if (r.h > rh) rh = r.h;
    }
    return { at, w: Math.max(1, uw), h: Math.max(1, y + rh) };
  };
  let best = packAt(Math.min(2048, Math.max(maxRow, 1024)));
  let bestArea = best.w * best.h;
  for (let rowMax = maxRow; rowMax <= 1400; rowMax += 16) {
    const trial = packAt(rowMax);
    const area = trial.w * trial.h;
    if (area < bestArea) {
      best = trial;
      bestArea = area;
    }
  }
  const place = best.at;
  const cw = best.w;
  const ch = best.h;
  if (cw * ch >= W * H * 0.92) return { img, variants };
  const c = document.createElement("canvas");
  c.width = cw;
  c.height = ch;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, cw, ch);
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    const p = place[i];
    g.drawImage(img, r.x, r.y, r.w, r.h, p.dx, p.dy, r.w, r.h);
  }
  const next = variants.map((v, i) => {
    const r = rects[i];
    const p = place[i];
    return {
      ...v,
      u0: p.dx / cw,
      u1: (p.dx + r.w) / cw,
      v1: 1 - p.dy / ch,
      v0: 1 - (p.dy + r.h) / ch,
    };
  });
  return { img: c, variants: next };
}

// The manifests store v with the image's top row at v = 1, so every atlas is
// uploaded flipped. The unpack flags are shared GL state that other layers
// change between awaits: set them for this upload and put them back.
function platePx(variant, atlasW, atlasH) {
  const pw = variant.rectW || Math.max(1, Math.round(Math.abs(variant.u1 - variant.u0) * (atlasW || 1)));
  const ph = variant.rectH || Math.max(1, Math.round(Math.abs(variant.v1 - variant.v0) * (atlasH || 1)));
  return [Math.max(1, pw), Math.max(1, ph)];
}

function texUpload(gl, img) {
  const flip = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
  const pre = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flip);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, pre);
}

export async function mountDetails(gl, env) {
  const t0 = performance.now();
  let manifest;
  try {
    const res = await fetch(env.absUrl("packs/zone-a/src/details/manifest.json"));
    if (!res.ok) return empty();
    manifest = await res.json();
  } catch (e) {
    return empty();
  }
  let variants = manifest.variants || [];
  const instances = manifest.instances || [];
  if (!variants.length || !instances.length || !manifest.atlas) return empty();
  let img = await env.loadImage(env.absUrl(manifest.atlas));
  const packed = repackAtlas(img, variants);
  img = packed.img;
  variants = packed.variants;
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  texUpload(gl, img);
  gl.generateMipmap(gl.TEXTURE_2D);
  const tw = img.width;
  const th = img.height;
  env.trackTex("details", Math.ceil(tw * th * 4 * 4 / 3));

  const byType = {};
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    if (!byType[v.type]) byType[v.type] = [];
    byType[v.type].push(v);
  }
  const data = new Float32Array(instances.length * 12);
  const magN = instances.length;
  const mx = new Float32Array(magN * 3);
  const mh = new Float32Array(magN);
  const mpx = new Float32Array(magN);
  const mq = new Float32Array(magN * 4);
  const counts = {};
  const groundAt = env.drawnHeightAt || env.heightAt;
  let lofts = null;
  try {
    const lr = await fetch(env.absUrl("packs/zone-a/src/solids/lofts.json"));
    if (lr.ok) lofts = await lr.json();
  } catch (e) {
    lofts = null;
  }
  const parts = (lofts && lofts.parts) || {};
  const solidItems = [];
  const solidRecs = [];
  let w = 0;
  let placed = 0;
  for (let i = 0; i < instances.length; i++) {
    const inst = instances[i];
    const group = byType[inst.type];
    const variant = group && group[inst.variant];
    if (!variant || !variant.contentH) continue;
    const microPart = parts[inst.type + ":" + (inst.variant || 0)];
    if (microPart && (inst.type === "shard" || inst.type === "tuft")) {
      const worldH = inst.heightM * (inst.scale || 1) * (microPart.bodyFrac || 1);
      const yaw0 = ((inst.yaw || 0) * Math.PI) / 180;
      const halfW = Math.max(microPart.halfX, microPart.halfZ) * worldH;
      const base = seatMin(groundAt, inst.x, inst.z, yaw0, 4, halfW);
      const y = base - Math.min(0.03, worldH * 0.08);
      const microPlate = platePx(variant, img.width, img.height);
      solidItems.push({
        part: microPart,
        x: inst.x,
        y,
        z: inst.z,
        yaw: yaw0,
        worldH,
        contentH: variant.contentH,
        plateW: microPlate[0],
        plateH: microPlate[1],
        side: [variant.u0, variant.v0, variant.u1, variant.v1],
        front: null,
        slot: 1,
        mirror: !!inst.mirror,
      });
      solidRecs.push({
        x: inst.x, z: inst.z, y, yaw: yaw0, worldH, contentH: variant.contentH,
        hx: microPart.halfX * worldH, hz: microPart.halfZ * worldH,
      });
      counts[inst.type] = (counts[inst.type] || 0) + 1;
      continue;
    }
    const worldH = inst.heightM * (inst.scale || 1);
    const rectH = variant.rectH || variant.contentH;
    const rectW = variant.rectW || variant.contentW;
    const quadH = worldH * (rectH / variant.contentH);
    const quadW = quadH * (rectW / rectH);
    const sink = worldH * ((variant.padBottom || 0) / variant.contentH) + 0.006;
    const yaw0 = (inst.yaw || 0) * Math.PI / 180;
    const depth = quadW * LOD_DEPTH_FRAC;
    const halfW = 0.5 * worldH * ((variant.contentW || rectW) / variant.contentH);
    const base = seatMin(groundAt, inst.x, inst.z, yaw0, 4, Math.max(halfW, depth * 0.5));
    const y = base - sink;
    mx[placed * 3] = inst.x;
    mx[placed * 3 + 1] = y + worldH * 0.5;
    mx[placed * 3 + 2] = inst.z;
    mh[placed] = worldH;
    mpx[placed] = variant.contentH;
    mq[placed * 4] = y;
    mq[placed * 4 + 1] = quadW;
    mq[placed * 4 + 2] = quadH;
    mq[placed * 4 + 3] = yaw0;
    counts[inst.type] = (counts[inst.type] || 0) + 1;
    placed++;
    const o = w * 12;
    data[o] = inst.x;
    data[o + 1] = y;
    data[o + 2] = inst.z;
    data[o + 3] = yaw0;
    data[o + 4] = quadW;
    data[o + 5] = quadH;
    data[o + 6] = worldH / variant.contentH;
    data[o + 7] = depth;
    data[o + 8] = variant.u0;
    data[o + 9] = variant.v0;
    data[o + 10] = variant.u1;
    data[o + 11] = variant.v1;
    w++;
  }
  const prog = program(gl, VS, FS);
  const loc = {
    vp: gl.getUniformLocation(prog, "uVP"),
    tex: gl.getUniformLocation(prog, "uTex"),
    eye: gl.getUniformLocation(prog, "uEye"),
    focal: gl.getUniformLocation(prog, "uFocal"),
  };
  const corners = LOD_BOX;

  function upload(img, label) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    texUpload(gl, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    env.trackTex(label, Math.ceil(img.width * img.height * 4 * 4 / 3));
    return t;
  }

  function bindInstances(buf, n) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
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
    return vao;
  }

  const vao = bindInstances(data, w);
  const drawn = w;
  let fDrawn = 0;
  let fPlaced = 0;
  let fVao = null;
  let fTex = null;
  let fCounts = {};
  let fMx = new Float32Array(0);
  let fMh = new Float32Array(0);
  let fPx = new Float32Array(0);
  let fGeo = new Float32Array(0);
  let fQ = new Float32Array(0);
  // Real-obstacle footprint per feature: the visible rock width near the ground,
  // measured from the still's own alpha (bodyWPx), never wider than the card shows.
  const colliders = [];
  let fW = 0;
  let fH = 0;
  try {
    const fres = await fetch(env.absUrl("packs/zone-a/src/details/features.json"));
    if (fres.ok) {
      const fman = await fres.json();
      const fimg = await env.loadImage(env.absUrl(fman.atlas));
      fTex = upload(fimg, "features");
      fW = fimg.width;
      fH = fimg.height;
      const fBy = {};
      const fvars = fman.variants || [];
      const fists = fman.instances || [];
      for (let i = 0; i < fvars.length; i++) {
        const v = fvars[i];
        if (!fBy[v.type]) fBy[v.type] = [];
        fBy[v.type].push(v);
      }
      for (let i = 0; i < fists.length; i++) {
        const inst = fists[i];
        const group = fBy[inst.type];
        const variant = group && group[inst.variant];
        if (!variant || !variant.contentH) continue;
        const part = parts[inst.type];
        const worldH = inst.heightM * (inst.scale || 1) * (part && part.bodyFrac ? part.bodyFrac : 1);
        const yaw0 = (inst.yaw || 0) * Math.PI / 180;
        const halfW = part ? Math.max(part.halfX, part.halfZ) * worldH : 0.5 * worldH * ((variant.contentW || variant.rectW) / variant.contentH);
        const base = seatMin(groundAt, inst.x, inst.z, yaw0, 4, halfW);
        const bury = Math.min(0.05, worldH * 0.08) + (inst.buryM || 0);
        const y = base - bury;
        if (part) {
          const featPlate = platePx(variant, fW, fH);
          solidItems.push({
            part,
            x: inst.x,
            y,
            z: inst.z,
            yaw: yaw0,
            worldH,
            contentH: variant.contentH,
            plateW: featPlate[0],
            plateH: featPlate[1],
            side: [variant.u0, variant.v0, variant.u1, variant.v1],
            front: null,
            slot: 0,
            mirror: !!inst.mirror,
          });
          solidRecs.push({
            x: inst.x, z: inst.z, y, yaw: yaw0, worldH, contentH: variant.contentH,
            hx: part.halfX * worldH, hz: part.halfZ * worldH,
          });
        }
        // Footprint matches the loft. bodyWPx is the measured card width and
        // stays the reference so a missing loft cannot invent a wider box.
        if (variant.bodyWPx && part) {
          const mpp = worldH / variant.contentH;
          const bw = variant.bodyWPx * mpp;
          const off = (variant.bodyCxPx || 0) * mpp * (inst.mirror ? -1 : 1);
          const cy = Math.cos(yaw0);
          const sy = Math.sin(yaw0);
          const hx = Math.min(part.halfX * worldH, bw * 0.5);
          const hz = part.halfZ * worldH;
          colliders.push({
            x: inst.x + cy * off,
            z: inst.z - sy * off,
            c: cy,
            s: sy,
            hx,
            hz,
            y0: y,
            y1: y + worldH,
          });
        }
        fCounts[inst.type] = (fCounts[inst.type] || 0) + 1;
        fPlaced++;
      }
      const crest = fBy.crest && fBy.crest[0];
      if (crest && crest.contentH && fW > 0) {
        const plate = platePx(crest, fW, fH);
        const focal = env.focal || 1793;
        const repeats = hillRepeat(focal, plate[1], HILL_H);
        const face = hillFaceDist(focal, plate[1], HILL_H, repeats);
        const inward = HILL_PART.halfZ * HILL_H;
        for (let hi = 0; hi < HILL_ANGLES.length; hi++) {
          const az = HILL_ANGLES[hi];
          const rim = radiusAt(az) * 1.045;
          const r = rim + face + inward;
          const x = Math.sin(az) * r;
          const z = Math.cos(az) * r;
          const yaw = az + Math.PI;
          // The macro rise past the mesh is not drawn ground. Seat on the rim
          // height so the hill meets the horizon instead of floating in the sky.
          const seatR = radiusAt(az) * 1.02;
          const y = groundAt(Math.sin(az) * seatR, Math.cos(az) * seatR) - 0.5;
          solidItems.push({
            part: HILL_PART,
            x,
            y,
            z,
            yaw,
            worldH: HILL_H,
            contentH: crest.contentH,
            plateW: plate[0],
            plateH: plate[1],
            vTiles: repeats,
            side: [crest.u0, crest.v0, crest.u1, crest.v1],
            front: null,
            slot: 0,
            mirror: false,
          });
          solidRecs.push({
            x, z, y, yaw, worldH: HILL_H,
            contentH: crest.contentH * repeats,
            hx: HILL_PART.halfX * HILL_H,
            hz: inward,
          });
        }
        fCounts.hill = HILL_ANGLES.length;
      }
      fDrawn = 0;
    }
  } catch (err) {
    fDrawn = 0;
    fPlaced = 0;
  }
  let solidMesh = null;
  if (solidItems.length) {
    const built = fillItems(solidItems);
    for (let i = 0; i < solidItems.length && i < solidRecs.length; i++) {
      solidRecs[i].stretch = solidItems[i].faceStretch || 1;
    }
    solidMesh = uploadMerged(gl, built.data, built.count);
  }
  const loadMs = performance.now() - t0;
  const solidDraw = solidMesh && solidMesh.count ? 1 : 0;
  const draws = (drawn ? 1 : 0) + solidDraw;

  // A card off screen paints no pixel, so it cannot be stretched. With a view
  // matrix, only cards whose bounding sphere meets the frustum count.
  // Portrait 720x1600: clip margin per metre is 2*focal/W across, 2*focal/H up.
  function onScreen(vp, focal, x, y, z, r) {
    if (!vp) return true;
    const cx = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
    const cy = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
    const cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
    if (cw < 0.05 - r) return false;
    const px = r * (2 * focal / 720);
    const py = r * (2 * focal / 1600);
    return Math.abs(cx) <= cw + px && Math.abs(cy) <= cw + py;
  }

  // Mirror of the shader near cull (nearDist), with the looser JS cap.
  // True when the card is not drawn from this eye.
  function nearCut(eye, focal, xs, q, i, mpp, plane) {
    const x = xs[i * 3];
    const z = xs[i * 3 + 2];
    const by = q[i * 4];
    const qw = q[i * 4 + 1];
    const qh = q[i * 4 + 2];
    const depth = qw * LOD_DEPTH_FRAC;
    const qy = Math.max(by, Math.min(by + qh, eye[1]));
    const yaw = q[i * 4 + 3];
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const dx = eye[0] - x;
    const dz = eye[2] - z;
    const lx = Math.max(-0.5 * qw, Math.min(0.5 * qw, dx * c - dz * s));
    const lz = Math.max(-0.5 * depth, Math.min(0.5 * depth, dx * s + dz * c));
    const hz = Math.hypot(dx - (c * lx + s * lz), dz - (-s * lx + c * lz));
    return Math.hypot(hz, eye[1] - qy) * NEAR_CAP_JS < focal * mpp;
  }

  function worst(eye, focal, n, xs, hs, ps, vp, q) {
    let m = 0;
    for (let i = 0; i < n; i++) {
      if (q && nearCut(eye, focal, xs, q, i, hs[i] / (ps[i] || 1), false)) continue;
      if (!onScreen(vp, focal, xs[i * 3], xs[i * 3 + 1], xs[i * 3 + 2], hs[i])) continue;
      const dx = eye[0] - xs[i * 3];
      const dy = eye[1] - xs[i * 3 + 1];
      const dz = eye[2] - xs[i * 3 + 2];
      const dist = Math.max(0.35, Math.hypot(dx, dy, dz));
      const mm = (focal * hs[i]) / (dist * (ps[i] || 1));
      if (mm > m) m = mm;
    }
    return m;
  }

  // Features are wide single cards: use the nearest point of the card, not its centre.
  function worstCards(eye, focal, n, xs, hs, ps, geo, vp, q) {
    let m = 0;
    for (let i = 0; i < n; i++) {
      if (q && nearCut(eye, focal, xs, q, i, hs[i] / (ps[i] || 1), true)) continue;
      const x = xs[i * 3];
      const z = xs[i * 3 + 2];
      const y0 = geo[i * 4];
      const ux = geo[i * 4 + 1];
      const uz = geo[i * 4 + 2];
      const hw = geo[i * 4 + 3];
      const h = hs[i];
      if (!onScreen(vp, focal, x, y0 + h * 0.5, z, Math.hypot(hw, h * 0.5))) continue;
      const ex = eye[0] - x;
      const ez = eye[2] - z;
      const t = Math.max(-hw, Math.min(hw, ex * ux + ez * uz));
      const qy = Math.max(y0, Math.min(y0 + h, eye[1]));
      const dist = Math.max(0.35, Math.hypot(ex - ux * t, eye[1] - qy, ez - uz * t));
      const mm = (focal * h) / (dist * (ps[i] || 1));
      if (mm > m) m = mm;
    }
    return m;
  }

  function boxNear(eye, focal, p) {
    const c = Math.cos(p.yaw);
    const s = Math.sin(p.yaw);
    const dx = eye[0] - p.x;
    const dz = eye[2] - p.z;
    const along = dx * c - dz * s;
    const t = Math.max(-p.hx, Math.min(p.hx, along));
    const horiz = Math.hypot(dx - c * t, dz + s * t);
    const yq = Math.max(p.y, Math.min(p.y + p.worldH, eye[1]));
    return Math.hypot(horiz, eye[1] - yq) * NEAR_CAP_JS < focal * (p.worldH / (p.contentH || 1));
  }

  function solidMag(eye, focal, vp) {
    let m = 0;
    for (let i = 0; i < solidRecs.length; i++) {
      const p = solidRecs[i];
      if (boxNear(eye, focal, p)) continue;
      const r = Math.hypot(p.hx, p.worldH * 0.5);
      if (!onScreen(vp, focal, p.x, p.y + p.worldH * 0.5, p.z, r)) continue;
      const c = Math.cos(p.yaw);
      const s = Math.sin(p.yaw);
      const dx = eye[0] - p.x;
      const dz = eye[2] - p.z;
      const along = dx * c - dz * s;
      const t = Math.max(-p.hx, Math.min(p.hx, along));
      const horiz = Math.hypot(dx - c * t, dz + s * t);
      const yq = Math.max(p.y, Math.min(p.y + p.worldH, eye[1]));
      const dist = Math.max(0.35, Math.hypot(horiz, eye[1] - yq));
      const mm = ((focal * p.worldH) / (dist * (p.contentH || 1))) * Math.max(1, p.stretch || 1);
      if (mm > m) m = mm;
    }
    return m;
  }

  function paint(vp, batchVao, batchTex, n, eye, focal) {
    if (!n || !batchVao) return;
    gl.useProgram(prog);
    gl.bindVertexArray(batchVao);
    gl.uniformMatrix4fv(loc.vp, false, vp);
    gl.uniform3f(loc.eye, eye ? eye[0] : 0, eye ? eye[1] : 0, eye ? eye[2] : 0);
    gl.uniform1f(loc.focal, eye && focal ? focal : 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, batchTex);
    gl.uniform1i(loc.tex, 0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, LOD_BOX_VERTS, n);
    gl.bindVertexArray(null);
  }

  return {
    draws,
    loadMs,
    colliders,
    draw(vp, eye, focal) {
      paint(vp, vao, tex, drawn, eye, focal);
      if (solidMesh) drawMerged(gl, solidMesh, vp, eye, focal, fTex || tex, tex);
    },
    mag(eye, focal, vp) {
      return Math.max(worst(eye, focal, placed, mx, mh, mpx, vp, mq), solidMag(eye, focal, vp));
    },
    magFeatures(eye, focal, vp) {
      return solidMag(eye, focal, vp);
    },
    // Cards hidden by the near cull from this eye (for the snapshot).
    // With vp, only cards whose bounding sphere meets the frustum count.
    nearCulled(eye, focal, vp) {
      let n = 0;
      for (let i = 0; i < placed; i++) {
        if (!nearCut(eye, focal, mx, mq, i, mh[i] / (mpx[i] || 1), false)) continue;
        if (onScreen(vp, focal, mx[i * 3], mx[i * 3 + 1], mx[i * 3 + 2], mh[i])) n++;
      }
      for (let i = 0; i < solidRecs.length; i++) {
        const p = solidRecs[i];
        if (!boxNear(eye, focal, p)) continue;
        if (onScreen(vp, focal, p.x, p.y + p.worldH * 0.5, p.z, Math.hypot(p.hx, p.worldH * 0.5))) n++;
      }
      return n;
    },
    info() {
      return {
        placed,
        drawn,
        byType: counts,
        loadMs,
        draws,
        texMiB: (tw * th * 4 * 4 / 3) / (1024 * 1024),
        atlas: [tw, th],
        features: {
          placed: fPlaced,
          drawn: fDrawn,
          byType: fCounts,
          atlas: [fW, fH],
          texMiB: fW && fH ? (fW * fH * 4 * 4 / 3) / (1024 * 1024) : 0,
          maxStretch: solidRecs.reduce((m, p) => Math.max(m, p.stretch || 1), 1),
        },
      };
    },
  };
}

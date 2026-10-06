/**
 * Unlit Imagine ruins. The mesh is a measured loft. Pixels stay on the skins.
 * Drawn into the scene target so the existing fog applies.
 * Colliders come from the same faces (collide.js): a wall where a face crosses Bolt's body band,
 * openings stay walkable, no keep-out circle.
 */
import { buildCollider, buildMagProbe, frameOf } from "./collide.js";

// One draw for every ruin: vertices are placed in the world at mount (seats are static), each
// carries its skin's unit. Samplers cannot be indexed by a varying in GLSL ES 3.0, so the fragment
// shader picks the skin with a literal if-chain and textureGrad (derivatives taken outside the branch).
const VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aUv;
layout(location=2) in vec3 aLoc;
layout(location=3) in float aUnit;
uniform mat4 uVP;
uniform vec3 uShift[3];
uniform vec2 uSeat[3];
uniform float uScale[3];
uniform int uObjOfUnit[8];
out vec2 vUv;
out vec3 vLoc;
flat out int vUnit;
void main() {
  vUv = aUv;
  vLoc = aLoc;
  int unit = int(aUnit + 0.5);
  vUnit = unit;
  int oi = 0;
  if (unit >= 0 && unit < 8) oi = uObjOfUnit[unit];
  float s = uScale[oi];
  vec2 seat = uSeat[oi];
  vec3 sh = uShift[oi];
  vec3 p = vec3(
    seat.x + (aPos.x - seat.x) * s + sh.x,
    aPos.y * s + sh.y,
    seat.y + (aPos.z - seat.y) * s + sh.z
  );
  gl_Position = uVP * vec4(p, 1.0);
}`;

/**
 * gateUnit: the gate's unit (or -1). Its faces drop where the elevation's own alpha cut says so
 * (front, back and the seam faces through their front-image spot). Thickness faces, and the
 * elevation where it would be shown magnified past CLOSE_LO..CLOSE_HI (mag 1), take the surface plate,
 * repeated in local metres at its native density: windows of the plate at random offsets that
 * never cross its border, blended with a variance-keeping weight. Pixels are never stretched.
 * A foot skirt (local y under 0.02, hanging to the relief) always takes that plate, on the two
 * axes that span the face, so the base is not a stretched strip of the elevation and is not cut.
 */
function fragmentSource(units, gateUnit) {
  const decl = [];
  const pick = [];
  for (let i = 0; i < units; i++) {
    decl.push("uniform sampler2D uT" + i + ";");
    pick.push((i ? "  else " : "  ") + "if (vUnit == " + i + ") c = textureGrad(uT" + i + ", vUv, gx, gy);");
  }
  const g = gateUnit >= 0 ? "uT" + gateUnit : "uT0";
  return `#version 300 es
precision highp float;
precision highp int;
${decl.join("\n")}
uniform vec4 uSlate;
uniform vec2 uSlatePx;
uniform float uSlateTpm;
uniform vec3 uSlateMean;
in vec2 vUv;
in vec3 vLoc;
flat in int vUnit;
out vec4 o;
const float CELL = 320.0;
const float CLOSE_LO = 0.92;
const float CLOSE_HI = 1.0;
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
vec3 plate(vec2 p, vec2 dpx, vec2 dpy) {
  vec2 t = p * uSlateTpm / CELL;
  vec2 k = uSlate.zw / uSlatePx;
  vec2 gpx = dpx * uSlateTpm * k;
  vec2 gpy = dpy * uSlateTpm * k;
  vec3 acc = vec3(0.0);
  float w2 = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 off = vec2(float(i & 1), float(i >> 1)) * 0.5;
    vec2 q = t + off;
    vec2 cell = floor(q);
    vec2 f = q - cell;
    vec2 tri = 1.0 - abs(2.0 * f - 1.0);
    float w = tri.x * tri.y;
    vec2 r = floor(hash2(cell + off * 37.0) * (uSlatePx - CELL - 4.0)) + 2.0;
    vec2 uv = uSlate.xy + (r + f * CELL) * k;
    acc += w * (textureGrad(${g}, uv, gpx, gpy).rgb - uSlateMean);
    w2 += w * w;
  }
  return clamp(uSlateMean + acc / sqrt(max(w2, 1e-4)), 0.0, 1.0);
}
void main() {
  vec2 gx = dFdx(vUv);
  vec2 gy = dFdy(vUv);
  vec3 lx = dFdx(vLoc);
  vec3 ly = dFdy(vLoc);
  vec4 c = vec4(0.0);
${pick.join("\n")}
  if (vUnit == ${gateUnit}) {
    bool foot = vLoc.y < 0.02;
    if (!foot && c.a < 0.5) discard;
    vec3 an = abs(cross(lx, ly));
    vec2 p;
    vec2 dpx;
    vec2 dpy;
    float w = 1.0;
    if (foot) {
      float sx = lx.x * lx.x + ly.x * ly.x;
      float sy = lx.y * lx.y + ly.y * ly.y;
      float sz = lx.z * lx.z + ly.z * ly.z;
      if (sx <= sy && sx <= sz) {
        p = vLoc.zy; dpx = lx.zy; dpy = ly.zy;
      } else if (sy <= sz) {
        p = vLoc.xz; dpx = lx.xz; dpy = ly.xz;
      } else {
        p = vLoc.xy; dpx = lx.xy; dpy = ly.xy;
      }
    } else if (an.z >= an.x && an.z >= an.y) {
      p = vLoc.xy; dpx = lx.xy; dpy = ly.xy;
      vec2 ts = vec2(textureSize(${g}, 0));
      float rho = max(length(gx * ts), length(gy * ts));
      w = smoothstep(CLOSE_LO, CLOSE_HI, 1.0 / max(rho, 1e-4));
    } else if (an.x >= an.y) {
      p = vLoc.zy; dpx = lx.zy; dpy = ly.zy;
    } else {
      p = vLoc.xz; dpx = lx.xz; dpy = ly.xz;
    }
    if (w > 0.0) c.rgb = mix(c.rgb, plate(p, dpx, dpy), w);
  }
  o = vec4(c.rgb, 1.0);
}`;
}

/** Close-up swap the gate shader makes, for the mag metrics: [far tpm, close tpm, switch mag]. */
export const GATE_CLOSE_SWITCH = 1.0;

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
    draws: 0,
    loadMs: 0,
    draw() {},
    mag() { return { m: 0, which: "" }; },
    collide(ox, oz, x, z) { return { x, z, contact: false }; },
    lift() { return 0; },
    near() { return false; },
    clearance() { return 99; },
    clearGrad() { return null; },
    segFree() { return 1; },
    where() { return null; },
    probe() { return {}; },
    info() { return { count: 0, loadMs: 0, draws: 0 }; },
  };
}

function parseRuin(buf) {
  const view = new DataView(buf);
  if (view.byteLength < 8) throw new Error("ruin short");
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== "RUIN") throw new Error("ruin magic");
  let o = 4;
  const n = view.getUint32(o, true);
  o += 4;
  const groups = [];
  for (let i = 0; i < n; i++) {
    const skin = view.getUint32(o, true);
    o += 4;
    const vc = view.getUint32(o, true);
    o += 4;
    const ic = view.getUint32(o, true);
    o += 4;
    const xyzuv = new Float32Array(buf, o, vc * 5);
    o += vc * 5 * 4;
    const idx = new Uint32Array(buf, o, ic);
    o += ic * 4;
    groups.push({ skin, xyzuv, idx });
  }
  return groups;
}

function seatOf(obj, heightAt) {
  const yaw = obj.yaw;
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  const lx = obj.contact[0] || 0;
  const lz = obj.contact[1] || 0;
  let wx;
  let wz;
  if (obj.frame === "ship") {
    wx = obj.x + lx * s - lz * c;
    wz = obj.z + lx * c + lz * s;
  } else {
    wx = obj.x + lx * c + lz * s;
    wz = obj.z - lx * s + lz * c;
  }
  // contactY is the local height of the contact point: 0 for a base contact, the sill for a hangar seat.
  return { x: obj.x, y: heightAt(wx, wz) - (obj.contactY || 0) - (obj.sink || 0), z: obj.z, contactX: wx, contactZ: wz };
}

/**
 * Upload a skin cropped to the parts its faces use: 1:1 copies of each used island (plus a margin,
 * origins on a 16 px grid so mip blocks keep their alignment), packed side by side. No resampling.
 * keep: extra rects kept whole [x0, y0, x1, y1] (the gate's surface plate). alpha: optional cut
 * image at the skin's own resolution, written into the alpha channel over its left part.
 * remap(u, v) moves a source UV to the packed texture.
 */
function packSkin(gl, img, groups, keep, alpha) {
  const W = img.width;
  const H = img.height;
  const MARGIN = 16;
  const tris = [];
  for (const g of groups) {
    const p = g.xyzuv;
    const idx = g.idx;
    for (let t = 0; t + 2 < idx.length; t += 3) {
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
      for (let k = 0; k < 3; k++) {
        const x = p[idx[t + k] * 5 + 3] * W;
        const y = (1 - p[idx[t + k] * 5 + 4]) * H;
        u0 = Math.min(u0, x); u1 = Math.max(u1, x); v0 = Math.min(v0, y); v1 = Math.max(v1, y);
      }
      tris.push([u0, u1, v0, v1]);
    }
  }
  tris.sort((a, b) => a[0] - b[0]);
  const islands = [];
  for (const t of tris) {
    const last = islands[islands.length - 1];
    if (last && t[0] <= last[1] + 2 * MARGIN) {
      last[1] = Math.max(last[1], t[1]); last[2] = Math.min(last[2], t[2]); last[3] = Math.max(last[3], t[3]);
    } else islands.push(t.slice());
  }
  const rects = [];
  const snap = (v) => Math.floor(v / 16) * 16;
  for (const k of keep) rects.push({ sx: k[0], sy: k[1], sw: k[2] - k[0], sh: k[3] - k[1], keep: true });
  for (const is of islands) {
    const sx = Math.max(0, snap(is[0] - MARGIN));
    const sy = Math.max(0, snap(is[2] - MARGIN));
    const ex = Math.min(W, Math.ceil((is[1] + MARGIN) / 16) * 16);
    const ey = Math.min(H, Math.ceil((is[3] + MARGIN) / 16) * 16);
    // An island inside a kept rect needs no copy of its own.
    if (rects.some((r) => r.keep && sx >= r.sx && ex <= r.sx + r.sw)) continue;
    rects.push({ sx, sy, sw: ex - sx, sh: ey - sy, keep: false, core: [is[0], is[1]] });
  }
  // Shelves no wider than the phone-safe texture limit (4096, or the GPU's own if smaller).
  const maxW = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096);
  let x = 0;
  let y = 0;
  let rowH = 0;
  let wMax = 0;
  for (const r of rects) {
    const cw = Math.ceil(r.sw / 16) * 16;
    if (x > 0 && x + cw > maxW) {
      y += Math.ceil(rowH / 16) * 16;
      x = 0;
      rowH = 0;
    }
    r.dx = x;
    r.dy = y;
    x += cw;
    wMax = Math.max(wMax, x);
    rowH = Math.max(rowH, r.sh);
  }
  const w = Math.max(1, wMax);
  const h = Math.max(1, y + rowH);
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d", { willReadFrequently: !!alpha || keep.length > 0 });
  ctx.imageSmoothingEnabled = false;
  for (const r of rects) ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.sw, r.sh);
  let source = cv;
  const keptMean = [];
  if (alpha || keep.length) {
    const data = ctx.getImageData(0, 0, w, h);
    const px = data.data;
    for (const r of rects.filter((q) => q.keep)) {
      let s0 = 0, s1 = 0, s2 = 0, n = 0;
      for (let yy = r.dy; yy < r.dy + r.sh; yy += 2) {
        for (let xx = r.dx; xx < r.dx + r.sw; xx += 2) {
          const o = (yy * w + xx) * 4;
          s0 += px[o]; s1 += px[o + 1]; s2 += px[o + 2]; n++;
        }
      }
      keptMean.push([s0 / n / 255, s1 / n / 255, s2 / n / 255]);
    }
    if (alpha) {
      const ac = document.createElement("canvas");
      ac.width = alpha.width;
      ac.height = alpha.height;
      const actx = ac.getContext("2d", { willReadFrequently: true });
      actx.drawImage(alpha, 0, 0);
      const ad = actx.getImageData(0, 0, alpha.width, alpha.height).data;
      for (const r of rects.filter((q) => !q.keep)) {
        for (let yy = 0; yy < r.sh; yy++) {
          const sy = r.sy + yy;
          if (sy >= alpha.height) continue;
          for (let xx = 0; xx < r.sw; xx++) {
            const sx = r.sx + xx;
            if (sx >= alpha.width) continue;
            px[((r.dy + yy) * w + r.dx + xx) * 4 + 3] = ad[(sy * alpha.width + sx) * 4];
          }
        }
      }
    }
    source = data;
  }
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const aniso = gl.getExtension("EXT_texture_filter_anisotropic");
  if (aniso) {
    const maxA = gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 1;
    gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, maxA));
  }
  // Only the gate cut reads alpha. Other skins store RGB8.
  const rgb = !alpha;
  if (rgb) {
    const px = ctx.getImageData(0, 0, w, h).data;
    const buf = new Uint8Array(w * h * 3);
    for (let i = 0, j = 0; i < px.length; i += 4, j += 3) {
      buf[j] = px[i];
      buf[j + 1] = px[i + 1];
      buf[j + 2] = px[i + 2];
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8, w, h, 0, gl.RGB, gl.UNSIGNED_BYTE, buf);
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  }
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  const find = (x) => {
    for (const r of rects) if (!r.keep && x >= r.core[0] - 0.5 && x <= r.core[1] + 0.5) return r;
    for (const r of rects) if (r.keep && x >= r.sx && x <= r.sx + r.sw) return r;
    return rects[0];
  };
  return {
    tex,
    w,
    h,
    bpp: rgb ? 3 : 4,
    kept: rects.filter((q) => q.keep),
    keptMean,
    remap(u, v) {
      const x = u * W;
      const y = (1 - v) * H;
      const r = find(x);
      return [(x - r.sx + r.dx) / w, 1 - (y - r.sy + r.dy) / h];
    },
  };
}

function imageLuma(img) {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  return { data: g.getImageData(0, 0, c.width, c.height).data, W: img.width, H: img.height };
}

function lumaOf(img, x, y) {
  const ix = Math.max(0, Math.min(img.W - 1, Math.round(x)));
  const iy = Math.max(0, Math.min(img.H - 1, Math.round(y)));
  const o = (iy * img.W + ix) * 4;
  const d = img.data;
  return 0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2];
}

/**
 * Hang the base ring down to the relief. The flat seat is one height; the drawn ground is not.
 * Only edges of the lowest course, and only where that edge sits above the ground. The drop is
 * new geometry in the same draw. It is not added to the collider groups, so an opening stays open.
 * The gate plate is sampled in the shader from local metres. Other skins shift the foot UV into
 * stone already inside that skin's island, tiled at the skin's own texel rate. No second part.
 */
function appendSkirts(parts, groups, obj, seat, heightAt, units, imgs) {
  const sink = obj.sink || 0;
  const ship = obj.frame === "ship";
  const sn = Math.sin(obj.yaw);
  const cs = Math.cos(obj.yaw);
  const gatePlate = !!(obj.nearTexelsPerM && obj.atlasSplitU);
  let minY = Infinity;
  for (let gi = 0; gi < groups.length; gi++) {
    const p = groups[gi].xyzuv;
    for (let k = 1; k < p.length; k += 5) if (p[k] < minY) minY = p[k];
  }
  if (!Number.isFinite(minY)) return { quads: 0, maxGap: 0 };
  const footCut = minY + 0.02;
  const seen = new Set();
  const buckets = new Map();
  let quads = 0;
  let maxGap = 0;
  const worldOf = (x, y, z) => {
    const wx = ship ? x * sn - z * cs : x * cs + z * sn;
    const wz = ship ? x * cs + z * sn : -x * sn + z * cs;
    return [seat.x + wx, seat.y + y, seat.z + wz];
  };
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const p = g.xyzuv;
    const idx = g.idx;
    const u = units[g.skin];
    if (!u) continue;
    let vmin = Infinity, vmax = -Infinity;
    if (!gatePlate) {
      for (let k = 0; k < p.length; k += 5) {
        const vv = p[k + 4];
        if (vv < vmin) vmin = vv;
        if (vv > vmax) vmax = vv;
      }
    }
    for (let t = 0; t + 2 < idx.length; t += 3) {
      const vs = [idx[t], idx[t + 1], idx[t + 2]];
      const foot = [];
      for (let k = 0; k < 3; k++) if (p[vs[k] * 5 + 1] <= footCut) foot.push(vs[k]);
      if (foot.length !== 2) continue;
      const ia = foot[0], ib = foot[1];
      const ax = p[ia * 5], ay = p[ia * 5 + 1], az = p[ia * 5 + 2];
      const bx = p[ib * 5], by = p[ib * 5 + 1], bz = p[ib * 5 + 2];
      const qa = Math.round(ax / 0.02) + "," + Math.round(az / 0.02);
      const qb = Math.round(bx / 0.02) + "," + Math.round(bz / 0.02);
      const key = (qa < qb ? qa + "|" + qb : qb + "|" + qa) + "#" + g.skin;
      if (seen.has(key)) continue;
      seen.add(key);
      const wa = worldOf(ax, ay, az);
      const wb = worldOf(bx, by, bz);
      const d0 = wa[1] - (heightAt(wa[0], wa[2]) - sink);
      const d1 = wb[1] - (heightAt(wb[0], wb[2]) - sink);
      if (d0 > maxGap) maxGap = d0;
      if (d1 > maxGap) maxGap = d1;
      const drop0 = d0 > 0.03 ? d0 : 0;
      const drop1 = d1 > 0.03 ? d1 : 0;
      if (drop0 === 0 && drop1 === 0) continue;
      const au = p[ia * 5 + 3], av = p[ia * 5 + 4];
      const bu = p[ib * 5 + 3], bv = p[ib * 5 + 4];
      const img = imgs[g.skin];
      const tpm = obj.texelsPerM || 1;
      let band = 0;
      if (!gatePlate && img) {
        const pyA = (1 - av) * (img.H - 1);
        const pyB = (1 - bv) * (img.H - 1);
        const room = Math.min(pyA, pyB) - (1 - vmax) * (img.H - 1);
        const need = Math.max(drop0, drop1) * tpm;
        const px = ((au + bu) * 0.5) * (img.W - 1);
        const lit = lumaOf(img, px, Math.min(pyA, pyB) - need) >= 24;
        if (room > 8 && need <= room && lit) band = 0;
        else band = Math.max(8, Math.min(room > 8 ? room : 24, 48));
      }
      const segM = !gatePlate && band > 0 ? band / tpm : Math.max(drop0, drop1, 0.01);
      const nseg = gatePlate || band === 0 ? 1 : Math.max(1, Math.ceil(Math.max(drop0, drop1) / segM));
      let bucket = buckets.get(g.skin);
      if (!bucket) {
        bucket = { skin: g.skin, num: [] };
        buckets.set(g.skin, bucket);
      }
      for (let s = 0; s < nseg; s++) {
        const f0 = s / nseg;
        const f1 = (s + 1) / nseg;
        const h0a = drop0 * f0, h1a = drop0 * f1;
        const h0b = drop1 * f0, h1b = drop1 * f1;
        const topA = worldOf(ax, ay - h0a, az);
        const botA = worldOf(ax, ay - h1a, az);
        const topB = worldOf(bx, by - h0b, bz);
        const botB = worldOf(bx, by - h1b, bz);
        let uva, uvb, uvac, uvbc;
        if (gatePlate || !img) {
          uva = [au, av]; uvb = [bu, bv]; uvac = uva; uvbc = uvb;
        } else if (band === 0) {
          const sA = (drop0 * f1) * tpm / Math.max(1, img.H - 1);
          const sB = (drop1 * f1) * tpm / Math.max(1, img.H - 1);
          const sA0 = (drop0 * f0) * tpm / Math.max(1, img.H - 1);
          const sB0 = (drop1 * f0) * tpm / Math.max(1, img.H - 1);
          uva = [au, Math.min(vmax, av + sA0)];
          uvb = [bu, Math.min(vmax, bv + sB0)];
          uvac = [au, Math.min(vmax, av + sA)];
          uvbc = [bu, Math.min(vmax, bv + sB)];
        } else {
          const islandTop = (1 - vmax) * (img.H - 1);
          const pyLo = Math.min((1 - av) * (img.H - 1), (1 - bv) * (img.H - 1));
          const pyHi = Math.max(islandTop, pyLo - band);
          const vTop = 1 - pyHi / Math.max(1, img.H - 1);
          const vBot = 1 - pyLo / Math.max(1, img.H - 1);
          uva = [au, vTop];
          uvb = [bu, vTop];
          uvac = [au, vBot];
          uvbc = [bu, vBot];
        }
        const ru = u.packed.remap;
        const push = (wpos, uv, lx, ly, lz) => {
          const m = ru(uv[0], uv[1]);
          bucket.num.push(wpos[0], wpos[1], wpos[2], m[0], m[1], lx, ly, lz, u.unit);
        };
        const base = bucket.num.length / 9;
        push(topA, uva, ax, ay - h0a, az);
        push(topB, uvb, bx, by - h0b, bz);
        push(botB, uvbc, bx, by - h1b, bz);
        push(botA, uvac, ax, ay - h1a, az);
        if (!bucket.tris) bucket.tris = [];
        bucket.tris.push(base, base + 1, base + 2, base, base + 2, base + 3);
        quads++;
      }
    }
  }
  for (const bucket of buckets.values()) {
    if (!bucket.tris || !bucket.tris.length) continue;
    const v = new Float32Array(bucket.num);
    const index = new Uint32Array(bucket.tris);
    parts.push({ v, idx: index });
  }
  return { quads, maxGap };
}

export async function mountRuins(gl, env) {
  const t0 = performance.now();
  let manifest;
  try {
    const res = await fetch(env.absUrl("packs/zone-a/src/ruins/manifest.json"));
    if (!res.ok) return empty();
    manifest = await res.json();
  } catch (e) {
    return empty();
  }
  const objects = manifest.objects || [];
  if (!objects.length) return empty();
  const mags = [];
  const solids = [];
  const POSE_SLOT = { gate: 0, wreck: 1, arch: 2 };
  const objOfUnit = new Int32Array(8);
  const bakedXZ = new Float32Array(6);
  let poses = null;
  const colliderOpt = manifest.collider || {};
  const skinTex = [];
  const texDims = [];
  const parts = [];
  let gateUnit = -1;
  let slate = null;
  for (let i = 0; i < objects.length; i++) {
    // A caller may reseat a loft. Absent placements keep the manifest coordinates.
    let obj = objects[i];
    const placed = env.placements && env.placements[obj.id];
    if (placed) obj = { ...obj, x: placed.x, z: placed.z, yaw: placed.yaw };
    const bin = await (await fetch(env.absUrl(obj.mesh))).arrayBuffer();
    const groups = parseRuin(bin);
    const texSize = [];
    const units = [];
    const skinImgs = [];
    const close = obj.nearTexelsPerM && obj.atlasSplitU ? obj.nearTexelsPerM : 0;
    let alphaImg = null;
    if (obj.alpha) alphaImg = await env.loadImage(env.absUrl(obj.alpha));
    for (let sk = 0; sk < obj.skins.length; sk++) {
      const img = await env.loadImage(env.absUrl(obj.skins[sk]));
      texSize.push([img.width, img.height]);
      const keep = close && sk === 0 ? [[Math.round(obj.atlasSplitU * img.width), 0, img.width, img.height]] : [];
      const packed = packSkin(gl, img, groups.filter((gr) => gr.skin === sk), keep, alphaImg && sk === 0 ? alphaImg : null);
      env.trackTex("ruin:" + obj.id + ":" + sk, Math.ceil(packed.w * packed.h * packed.bpp * 4 / 3));
      texDims.push({ id: obj.id + ":" + sk, src: [img.width, img.height], packed: [packed.w, packed.h] });
      const unit = skinTex.length;
      skinTex.push(packed.tex);
      units.push({ unit, packed });
      if (unit < objOfUnit.length) objOfUnit[unit] = POSE_SLOT[obj.id] == null ? 0 : POSE_SLOT[obj.id];
      skinImgs.push(close ? null : imageLuma(img));
      if (close && sk === 0) {
        gateUnit = unit;
        const r = packed.kept[0];
        slate = {
          rect: [r.dx / packed.w, 1 - (r.dy + r.sh) / packed.h, r.sw / packed.w, r.sh / packed.h],
          px: [r.sw, r.sh],
          tpm: close,
          mean: packed.keptMean[0],
        };
      }
    }
    const seat = seatOf(obj, env.heightAt);
    const ship = obj.frame === "ship";
    const sn = Math.sin(obj.yaw);
    const cs = Math.cos(obj.yaw);
    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      const u = units[group.skin];
      if (!group.idx.length || !u) continue;
      const src = group.xyzuv;
      const n = src.length / 5;
      const v = new Float32Array(n * 9);
      for (let k = 0; k < n; k++) {
        const x = src[k * 5], y = src[k * 5 + 1], z = src[k * 5 + 2];
        const wx = ship ? x * sn - z * cs : x * cs + z * sn;
        const wz = ship ? x * cs + z * sn : -x * sn + z * cs;
        const uv = u.packed.remap(src[k * 5 + 3], src[k * 5 + 4]);
        v.set([seat.x + wx, seat.y + y, seat.z + wz, uv[0], uv[1], x, y, z, u.unit], k * 9);
      }
      parts.push({ v, idx: group.idx });
    }
    const frame = frameOf(obj, seat);
    const tc = performance.now();
    const col = buildCollider(groups, frame, env.heightAt, colliderOpt);
    const skirt = appendSkirts(parts, groups, obj, seat, env.heightAt, units, skinImgs);
    const openTop = obj.openingTopM || 0;
    const poseSlot = POSE_SLOT[obj.id] == null ? 0 : POSE_SLOT[obj.id];
    bakedXZ[poseSlot * 2] = obj.x;
    bakedXZ[poseSlot * 2 + 1] = obj.z;
    solids.push({
      id: obj.id,
      bakedX: obj.x,
      bakedZ: obj.z,
      col,
      groups,
      frame,
      texSize,
      probe: null,
      tagOf: ship
        ? () => "hull"
        : (gi, ti, cy, ny) => (ny < -0.5 ? "arch-underside" : cy < openTop ? "pier" : "lintel"),
      // The gate shader's real density: thickness faces show the plate at its native density; the
      // elevation swaps to it once magnified past GATE_CLOSE_SWITCH (see fragmentSource).
      densityOf: close
        ? (nx, ny, nz, tpm) => (Math.abs(nz) >= Math.max(Math.abs(nx), Math.abs(ny)) ? [tpm, close, GATE_CLOSE_SWITCH] : [close, 0])
        : null,
      texelsPerM: obj.texelsPerM,
      closeTexelsPerM: close,
      buildMs: performance.now() - tc,
    });
    mags.push({
      id: obj.id,
      x: obj.x,
      z: obj.z,
      horiz: obj.horizRadiusM,
      texels: obj.texelsPerM,
      approach: obj.minApproachM,
      seatY: seat.y,
      contactX: seat.contactX,
      contactZ: seat.contactZ,
      skirts: skirt.quads,
      footGap: skirt.maxGap,
    });
  }
  // One vertex buffer, one index buffer, one draw.
  let vn = 0;
  let inN = 0;
  for (const pt of parts) {
    vn += pt.v.length / 9;
    inN += pt.idx.length;
  }
  const verts = new Float32Array(vn * 9);
  const index = new Uint32Array(inN);
  let vo = 0;
  let io = 0;
  for (const pt of parts) {
    verts.set(pt.v, vo * 9);
    for (let k = 0; k < pt.idx.length; k++) index[io + k] = pt.idx[k] + vo;
    vo += pt.v.length / 9;
    io += pt.idx.length;
  }
  const prog = program(gl, VS, fragmentSource(skinTex.length, gateUnit));
  const loc = {
    vp: gl.getUniformLocation(prog, "uVP"),
    shift: gl.getUniformLocation(prog, "uShift"),
    seat: gl.getUniformLocation(prog, "uSeat"),
    scale: gl.getUniformLocation(prog, "uScale"),
    objOfUnit: gl.getUniformLocation(prog, "uObjOfUnit"),
    slate: gl.getUniformLocation(prog, "uSlate"),
    slatePx: gl.getUniformLocation(prog, "uSlatePx"),
    slateTpm: gl.getUniformLocation(prog, "uSlateTpm"),
    slateMean: gl.getUniformLocation(prog, "uSlateMean"),
    tex: skinTex.map((_, k) => gl.getUniformLocation(prog, "uT" + k)),
  };
  const shiftU = new Float32Array(9);
  const seatU = new Float32Array(6);
  const scaleU = new Float32Array([1, 1, 1]);
  const poseIds = ["gate", "wreck", "arch"];
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 36, 12);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 36, 20);
  gl.enableVertexAttribArray(3);
  gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 36, 32);
  const ib = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  const loadMs = performance.now() - t0;
  const drawCount = index.length ? 1 : 0;
  function collidePosed(ox, oz, x, z, r) {
    let cx = ox;
    let cz = oz;
    let contact = false;
    const dx = x - ox;
    const dz = z - oz;
    const len = Math.hypot(dx, dz);
    const cell = solids[0] ? solids[0].col.cellM : 0.25;
    const steps = Math.max(1, Math.ceil(len / cell));
    for (let s = 0; s < steps; s++) {
      cx += dx / steps;
      cz += dz / steps;
      for (let iter = 0; iter < 4; iter++) {
        let moved = false;
        for (let i = 0; i < solids.length; i++) {
          const solid = solids[i];
          const p = poses[solid.id];
          if (!p || !(p.scale > 0.35)) continue;
          const sc = p.scale;
          const bx = solid.bakedX + (cx - p.x) / sc;
          const bz = solid.bakedZ + (cz - p.z) / sc;
          const col = solid.col;
          const br = r / sc;
          if (!col.near(bx, bz, br)) continue;
          const d = col.sd(bx, bz);
          if (d >= br) continue;
          const g = col.grad(bx, bz);
          if (g[0] === 0 && g[1] === 0) continue;
          const push = (br - d) * sc;
          cx += g[0] * push;
          cz += g[1] * push;
          moved = true;
          contact = true;
        }
        if (!moved) break;
      }
    }
    return { x: cx, z: cz, contact };
  }
  return {
    draws: drawCount,
    loadMs,
    setPoses(next) {
      poses = next || null;
    },
    draw(vp, mode) {
      if (mode === 1 || !drawCount) return;
      gl.useProgram(prog);
      scaleU[0] = 1;
      scaleU[1] = 1;
      scaleU[2] = 1;
      shiftU[0] = 0; shiftU[1] = 0; shiftU[2] = 0;
      shiftU[3] = 0; shiftU[4] = 0; shiftU[5] = 0;
      shiftU[6] = 0; shiftU[7] = 0; shiftU[8] = 0;
      seatU[0] = 0; seatU[1] = 0; seatU[2] = 0; seatU[3] = 0; seatU[4] = 0; seatU[5] = 0;
      if (poses) {
        for (let i = 0; i < 3; i++) {
          const p = poses[poseIds[i]];
          seatU[i * 2] = bakedXZ[i * 2];
          seatU[i * 2 + 1] = bakedXZ[i * 2 + 1];
          if (!p || !(p.scale > 0.02)) {
            scaleU[i] = 0;
            shiftU[i * 3 + 1] = -40;
            continue;
          }
          scaleU[i] = p.scale;
          shiftU[i * 3] = p.x - bakedXZ[i * 2];
          shiftU[i * 3 + 1] = p.rise || 0;
          shiftU[i * 3 + 2] = p.z - bakedXZ[i * 2 + 1];
        }
      }
      gl.uniform3fv(loc.shift, shiftU);
      gl.uniform2fv(loc.seat, seatU);
      gl.uniform1fv(loc.scale, scaleU);
      gl.uniform1iv(loc.objOfUnit, objOfUnit);
      gl.uniformMatrix4fv(loc.vp, false, vp);
      for (let k = 0; k < skinTex.length; k++) {
        gl.activeTexture(gl.TEXTURE0 + k);
        gl.bindTexture(gl.TEXTURE_2D, skinTex[k]);
        gl.uniform1i(loc.tex[k], k);
      }
      if (slate) {
        gl.uniform4f(loc.slate, slate.rect[0], slate.rect[1], slate.rect[2], slate.rect[3]);
        gl.uniform2f(loc.slatePx, slate.px[0], slate.px[1]);
        gl.uniform1f(loc.slateTpm, slate.tpm);
        gl.uniform3f(loc.slateMean, slate.mean[0], slate.mean[1], slate.mean[2]);
      }
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.disable(gl.CULL_FACE);
      gl.bindVertexArray(vao);
      gl.drawElements(gl.TRIANGLES, index.length, gl.UNSIGNED_INT, 0);
      gl.bindVertexArray(null);
      gl.activeTexture(gl.TEXTURE0);
    },
    /** Closest drawn face from the eye, at the skin's nominal texel density. */
    mag(eye, focal) {
      let m = 0;
      let which = "";
      for (let i = 0; i < solids.length; i++) {
        const o = solids[i];
        if (!o.col.near(eye[0], eye[2], 30)) continue;
        const dist = Math.max(0.05, o.col.dist(eye[0], eye[1], eye[2]));
        let mm = focal / (o.texelsPerM * dist);
        if (o.closeTexelsPerM && mm >= GATE_CLOSE_SWITCH) mm = focal / (o.closeTexelsPerM * dist);
        if (mm > m) {
          m = mm;
          which = o.id;
        }
      }
      return { m, which };
    },
    /**
     * Move the body from (ox, oz) toward (x, z). A wall pushes it out along the field gradient,
     * so it slides along the face instead of stopping or snapping. Substeps stop tunnelling.
     */
    collide(ox, oz, x, z, radius) {
      const r = radius || colliderOpt.bodyRadiusM || 0.3;
      if (poses) return collidePosed(ox, oz, x, z, r);
      let any = false;
      for (let i = 0; i < solids.length; i++) {
        if (solids[i].col.near(x, z, r + 0.5) || solids[i].col.near(ox, oz, r + 0.5)) any = true;
      }
      if (!any) return { x, z, contact: false };
      let cx = ox;
      let cz = oz;
      let contact = false;
      const dx = x - ox;
      const dz = z - oz;
      const len = Math.hypot(dx, dz);
      const steps = Math.max(1, Math.ceil(len / solids[0].col.cellM));
      for (let s = 0; s < steps; s++) {
        cx += dx / steps;
        cz += dz / steps;
        for (let iter = 0; iter < 4; iter++) {
          let moved = false;
          for (let i = 0; i < solids.length; i++) {
            const col = solids[i].col;
            if (!col.near(cx, cz, r)) continue;
            const d = col.sd(cx, cz);
            if (d >= r) continue;
            const g = col.grad(cx, cz);
            if (g[0] === 0 && g[1] === 0) continue;
            cx += g[0] * (r - d);
            cz += g[1] * (r - d);
            moved = true;
            contact = true;
          }
          if (!moved) break;
        }
      }
      return { x: cx, z: cz, contact };
    },
    /** Floor lift above the relief where a face sits within one step of it (a sill, a hull foot). */
    lift(x, z) {
      let m = 0;
      for (let i = 0; i < solids.length; i++) {
        const col = solids[i].col;
        if (!col.near(x, z, 0)) continue;
        const v = col.lift(x, z);
        if (v > m) m = v;
      }
      return m;
    },
    near(x, z, extra) {
      for (let i = 0; i < solids.length; i++) if (solids[i].col.near(x, z, extra || 0)) return true;
      return false;
    },
    /** Distance from a world point to the nearest drawn ruin face. */
    clearance(x, y, z) {
      let m = 99;
      for (let i = 0; i < solids.length; i++) {
        const col = solids[i].col;
        if (!col.near(x, z, 2)) continue;
        const v = col.dist(x, y, z);
        if (v < m) m = v;
      }
      return m;
    },
    /** Unit gradient of clearance() (direction away from the nearest face), or null when flat. */
    clearGrad(x, y, z) {
      const h = 0.08;
      const gx = this.clearance(x + h, y, z) - this.clearance(x - h, y, z);
      const gy = this.clearance(x, y + h, z) - this.clearance(x, y - h, z);
      const gz = this.clearance(x, y, z + h) - this.clearance(x, y, z - h);
      const l = Math.hypot(gx, gy, gz);
      return l > 1e-6 ? [gx / l, gy / l, gz / l] : null;
    },
    /** Fraction of the segment A->B that stays at least eps from every face (sphere march). 1 = clear. */
    segFree(ax, ay, az, bx, by, bz, eps) {
      const e = eps == null ? 0.08 : eps;
      const dx = bx - ax;
      const dy = by - ay;
      const dz = bz - az;
      const len = Math.hypot(dx, dy, dz);
      if (len < 1e-6) return 1;
      let close = false;
      for (let i = 0; i < solids.length; i++) {
        if (solids[i].col.near(ax, az, len + 2)) close = true;
      }
      if (!close) return 1;
      const minStep = solids[0].col.voxM * 0.5;
      let t = 0;
      while (t < len) {
        const f = t / len;
        const d = this.clearance(ax + dx * f, ay + dy * f, az + dz * f);
        if (d < e) return f;
        t += Math.max(d - e * 0.5, minStep);
      }
      return 1;
    },
    /** Which ruin a point is in or under (tests, HUD). */
    where(x, z) {
      for (let i = 0; i < solids.length; i++) {
        const col = solids[i].col;
        if (!col.near(x, z, 0)) continue;
        return {
          id: solids[i].id,
          covered: col.covered(x, z),
          wall: col.wall(x, z),
          sd: col.sd(x, z),
          lx: col.toLocalX(x, z),
          lz: col.toLocalZ(x, z),
        };
      }
      return null;
    },
    /** Close-up magnification per part, from the face UVs, inside the frustum. Built on first call. */
    probe(eye, fwd, right, up, focal, tanH, tanV) {
      const out = {};
      for (let i = 0; i < solids.length; i++) {
        const o = solids[i];
        if (!o.probe) o.probe = buildMagProbe(o.groups, o.frame, o.texSize, o.tagOf, 0.08, o.densityOf);
        const r = o.probe(eye, fwd, right, up, focal, tanH, tanV);
        for (const k of Object.keys(r)) out[o.id + ":" + k] = r[k];
      }
      return out;
    },
    info() {
      return {
        count: objects.length,
        draws: drawCount,
        textures: texDims,
        loadMs,
        seats: mags.map((o) => ({
          id: o.id,
          y: o.seatY,
          contact: [o.contactX, o.contactZ],
          approach: o.approach,
          skirts: o.skirts,
          footGap: o.footGap,
        })),
        colliders: solids.map((o) => ({
          id: o.id,
          cells: [o.col.nx, o.col.nz],
          voxels: [o.col.vnx, o.col.vny, o.col.vnz],
          wallCells: o.col.wallCells,
          sealedCells: o.col.sealed,
          buildMs: Math.round(o.buildMs),
          bodyBand: [o.col.stepM, o.col.clearM],
        })),
      };
    },
  };
}

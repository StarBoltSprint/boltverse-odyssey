/**
 * Canyon pillars, mesas, and walls. One measured-section loft per rock.
 * Front and side stills set the stations. Each face wears that still.
 * The foot is sunk and flared under the relief. Far rocks use fewer
 * stations. None of them is a camera-facing card. The sky is not in here.
 */
const KEY = 12;
const MAX_SIDE = 1280;
const BODY_R = 0.46;
const CONTACT = 0.1;

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
    info() { return { count: 0, billboards: 0, footAboveMax: 0, faceDotMax: 0 }; },
  };
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

const faceCache = new Map();

async function loadFace(env, file) {
  if (!file) return null;
  if (faceCache.has(file)) return faceCache.get(file);
  let face = null;
  try {
    const img = await env.loadImage(env.absUrl(file));
    const px = pixelsOf(img);
    const sil = silhouette(px);
    if (sil) face = { w: px.w, h: px.h, data: px.data, sil, file };
  } catch (e) {
    console.warn("mesa face", file, e);
  }
  faceCache.set(file, face);
  return face;
}

function pushVert(verts, p, u, v, fitX, fitY, layer, id) {
  const idx = verts.length / 9;
  verts.push(p[0], p[1], p[2], u, v, fitX, fitY, layer, id);
  return idx;
}

function lodOf(c) {
  if (c.h >= 8) return { stations: 16, ring: 8 };
  return { stations: 8, ring: 6 };
}

function faceYaw(x, z) {
  return Math.atan2(x, -z);
}

function instanceYaw(c) {
  if (typeof c.yaw === "number") return c.yaw;
  const face = faceYaw(c.x, c.z);
  let turn = 0.96;
  if (c.role === "wall") turn = 1.05;
  else if (c.role === "block" || c.role === "rim") turn = c.x >= 0 ? 0.7 : -0.62;
  else if (c.role === "mid") turn = 0.84;
  const j = Math.sin(c.x * 0.13 + c.z * 0.07) * 0.08;
  return face + turn + j;
}

function section(xL, xR, zB, zF, n, flare) {
  const cx = (xL + xR) * 0.5;
  const cz = (zB + zF) * 0.5;
  const hx = Math.max(0.12, (xR - xL) * 0.5) * flare;
  const hz = Math.max(0.12, (zF - zB) * 0.5) * flare;
  const raw = n === 8
    ? [[-1, 0.58], [-0.58, 1], [0.58, 1], [1, 0.58], [1, -0.58], [0.58, -1], [-0.58, -1], [-1, -0.58]]
    : [[-1, 0.42], [0, 1], [1, 0.42], [1, -0.42], [0, -1], [-1, -0.42]];
  const pts = raw.map(([x, z]) => [cx + x * hx, cz + z * hz]);
  const o = outward(pts[0], pts[1]);
  const mid = [(pts[0][0] + pts[1][0]) * 0.5 - cx, (pts[0][1] + pts[1][1]) * 0.5 - cz];
  if (o[0] * mid[0] + o[1] * mid[1] < 0) pts.reverse();
  return pts;
}

function outward(p0, p1) {
  const dx = p1[0] - p0[0];
  const dz = p1[1] - p0[1];
  const ox = -dz;
  const oz = dx;
  const len = Math.hypot(ox, oz) || 1;
  return [ox / len, oz / len];
}

function kindOf(p0, p1) {
  const o = outward(p0, p1);
  if (o[1] >= Math.abs(o[0])) return "front";
  if (-o[1] >= Math.abs(o[0])) return "back";
  return "side";
}

function insideRing(ring, x, z) {
  let inP = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i][1];
    const yj = ring[j][1];
    const xi = ring[i][0];
    const xj = ring[j][0];
    if ((yi > z) !== (yj > z) && x < ((xj - xi) * (z - yi)) / ((yj - yi) || 1e-8) + xi) inP = !inP;
  }
  return inP;
}

function edgeHit(ring, x, z) {
  let best = 1e9;
  let nx = 1;
  let nz = 0;
  let px = x;
  let pz = z;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const l2 = dx * dx + dz * dz || 1;
    let t = ((x - a[0]) * dx + (z - a[1]) * dz) / l2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const qx = a[0] + dx * t;
    const qz = a[1] + dz * t;
    const ex = x - qx;
    const ez = z - qz;
    const d = Math.hypot(ex, ez);
    if (d < best) {
      best = d;
      px = qx;
      pz = qz;
      const len = d || 1;
      nx = ex / len;
      nz = ez / len;
    }
  }
  return { d: best, nx, nz, px, pz };
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

  const groundAt = (x, z) => env.heightAt(x, z) + env.skirtLift(x, z);
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
    for (let s = 0; s < 12; s++) {
      const row = rowAt(front.sil, s / 11);
      maxW = Math.max(maxW, (row.R - row.L) * mpp);
    }
    let sideFace = side;
    let mppS = mpp;
    let depth = Math.max(maxW * 0.55, worldH * 0.42);
    if (side) {
      mppS = worldH / side.sil.contentH;
      depth = side.sil.contentW * mppS;
      const cap = Math.max(maxW * 1.2, worldH * 0.7);
      if (depth > cap) depth = cap;
      if (depth < maxW * 0.42) depth = maxW * 0.42;
    } else {
      sideFace = front;
    }
    if (c.role === "wall") {
      depth = Math.max(14, Math.min(worldH * 0.58, Math.max(16, maxW * 0.42)));
    }
    const lod = lodOf(c);
    const yaw = instanceYaw(c);
    const sink = Math.min(3.1, Math.max(c.h >= 8 ? 1.8 : 0.55, worldH * 0.08));
    built.push({
      i,
      card: c,
      front,
      side: sideFace,
      sideReal: !!side && c.role !== "wall",
      back: back || front,
      backReal: !!back,
      top,
      worldH,
      mpp,
      mppS,
      maxW,
      depth,
      yaw,
      sink,
      stations: lod.stations,
      ringN: lod.ring,
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

  function place(b, lx, y, lz) {
    const cy = Math.cos(b.yaw);
    const sy = Math.sin(b.yaw);
    return [
      b.card.x + lx * cy - lz * sy,
      y,
      b.card.z + lx * sy + lz * cy,
    ];
  }
  function vImg(face, px, py) {
    return [(px + 0.5) / face.w, (py + 0.5) / face.h];
  }
  function spanAt(face, mpp, t) {
    const row = rowAt(face.sil, t);
    return {
      L: (row.L - face.sil.midX) * mpp,
      R: (row.R - face.sil.midX) * mpp,
      row,
    };
  }

  for (const b of built) {
    const id = env.labelOf("butte:" + b.i);
    const cols = [];
    let maxDepth = 0;
    for (let s = 0; s < b.stations; s++) {
      const t = s / (b.stations - 1);
      const fr = spanAt(b.front, b.mpp, t);
      let xL = fr.L;
      let xR = fr.R;
      if (xR - xL < 0.2) {
        const mid = (xL + xR) * 0.5;
        xL = mid - 0.1;
        xR = mid + 0.1;
      }
      const sr = spanAt(b.side, b.mppS, t);
      let zB = sr.L;
      let zF = sr.R;
      if (!b.sideReal) {
        const widthK = Math.max(0.35, (xR - xL) / Math.max(0.2, b.maxW));
        const thick = b.card.role === "wall"
          ? b.depth * (0.62 + 0.38 * widthK)
          : Math.max(b.depth * widthK, (xR - xL) * 0.48);
        zB = -thick * 0.5;
        zF = thick * 0.5;
      } else {
        let span = zF - zB;
        const need = Math.max((xR - xL) * 0.42, b.card.role === "wall" ? b.depth * 0.7 : 0.8);
        if (span < need) {
          const mid = (zB + zF) * 0.5;
          zB = mid - need * 0.5;
          zF = mid + need * 0.5;
          span = need;
        }
        const cap = Math.max(b.maxW * 1.25, b.worldH * 0.85);
        if (span > cap) {
          const mid = (zB + zF) * 0.5;
          zB = mid - cap * 0.5;
          zF = mid + cap * 0.5;
        }
      }
      const flare = t < CONTACT ? 1.42 - 0.42 * (t / CONTACT) : 1;
      maxDepth = Math.max(maxDepth, (zF - zB) * flare);
      cols.push({ t, xL, xR, zB, zF, flare, fr: fr.row, sr: sr.row });
    }
    b.depth = Math.max(b.depth, maxDepth);

    const probe = section(cols[2].xL, cols[2].xR, cols[2].zB, cols[2].zF, b.ringN, 1);
    let seat = Infinity;
    const samples = [[0, 0]].concat(probe);
    for (let k = 0; k < samples.length; k++) {
      const p = place(b, samples[k][0], 0, samples[k][1]);
      const g = groundAt(p[0], p[2]);
      if (g < seat) seat = g;
    }
    if (!Number.isFinite(seat)) seat = 0;
    b.seat = seat;
    b.baseY = seat - b.sink;

    function yAt(t) {
      if (t <= CONTACT) return seat - b.sink * (1 - t / CONTACT);
      return seat + (t - CONTACT) * b.worldH;
    }

    const rings = [];
    const footAbove = [];
    for (let s = 0; s < b.stations; s++) {
      const col = cols[s];
      const local = section(col.xL, col.xR, col.zB, col.zF, b.ringN, col.flare);
      const y = yAt(col.t);
      const world = [];
      for (let k = 0; k < local.length; k++) {
        let p = place(b, local[k][0], y, local[k][1]);
        if (col.t <= CONTACT) {
          const g = groundAt(p[0], p[2]);
          const capY = g - 0.35;
          if (p[1] > capY) p = [p[0], capY, p[2]];
          footAbove.push(p[1] - g);
        }
        world.push(p);
      }
      rings.push(world);
    }
    b.footAbove = footAbove.length ? Math.max(...footAbove) : 0;

    const fx = -Math.sin(b.yaw);
    const fz = Math.cos(b.yaw);
    const toX = -b.card.x;
    const toZ = -b.card.z;
    const toL = Math.hypot(toX, toZ) || 1;
    b.faceDot = (fx * toX + fz * toZ) / toL;

    const fFit = [b.front.fitX, b.front.fitY, b.front._layer];
    const sFit = [b.side.fitX, b.side.fitY, b.side._layer];
    const kFit = [b.back.fitX, b.back.fitY, b.back._layer];

    function uvFor(kind, col, lx, lz) {
      if (kind === "front") {
        const u = (lx - col.xL) / Math.max(0.01, col.xR - col.xL);
        const px = col.fr.L + u * (col.fr.R - col.fr.L);
        return vImg(b.front, px, col.fr.y);
      }
      if (kind === "back" && b.backReal) {
        const u = (lx - col.xL) / Math.max(0.01, col.xR - col.xL);
        const br = rowAt(b.back.sil, col.t);
        const px = br.L + u * (br.R - br.L);
        return vImg(b.back, px, br.y);
      }
      const span = Math.max(1, col.sr.R - col.sr.L);
      const band = b.sideReal ? span : span * 0.34;
      const mid = (col.sr.L + col.sr.R) * 0.5;
      const u = (lz - col.zB) / Math.max(0.01, col.zF - col.zB);
      const px = mid - band * 0.5 + u * band;
      return vImg(b.side, px, col.sr.y);
    }
    function fitFor(kind) {
      if (kind === "front") return fFit;
      if (kind === "back" && b.backReal) return kFit;
      return sFit;
    }

    function addQuad(p0, p1, p2, p3, u0, u1, u2, u3, fit) {
      const ax = p1[0] - p0[0];
      const ay = p1[1] - p0[1];
      const az = p1[2] - p0[2];
      const bx = p3[0] - p0[0];
      const by = p3[1] - p0[1];
      const bz = p3[2] - p0[2];
      const nx = ay * bz - az * by;
      const nz = ax * by - ay * bx;
      const mx = (p0[0] + p1[0] + p2[0] + p3[0]) * 0.25 - b.card.x;
      const mz = (p0[2] + p1[2] + p2[2] + p3[2]) * 0.25 - b.card.z;
      let order = [p0, p1, p2, p3];
      let uvs = [u0, u1, u2, u3];
      if (nx * mx + nz * mz < 0) {
        order = [p0, p3, p2, p1];
        uvs = [u0, u3, u2, u1];
      }
      const i0 = pushVert(verts, order[0], uvs[0][0], uvs[0][1], fit[0], fit[1], fit[2], id);
      const i1 = pushVert(verts, order[1], uvs[1][0], uvs[1][1], fit[0], fit[1], fit[2], id);
      const i2 = pushVert(verts, order[2], uvs[2][0], uvs[2][1], fit[0], fit[1], fit[2], id);
      const i3 = pushVert(verts, order[3], uvs[3][0], uvs[3][1], fit[0], fit[1], fit[2], id);
      index.push(i0, i1, i2, i0, i2, i3);
    }

    for (let s = 0; s < b.stations - 1; s++) {
      const a = cols[s];
      const ccol = cols[s + 1];
      const ra = section(a.xL, a.xR, a.zB, a.zF, b.ringN, a.flare);
      const rc = section(ccol.xL, ccol.xR, ccol.zB, ccol.zF, b.ringN, ccol.flare);
      for (let k = 0; k < b.ringN; k++) {
        const k2 = (k + 1) % b.ringN;
        const kind = kindOf(ra[k], ra[k2]);
        const fit = fitFor(kind);
        addQuad(
          rings[s][k], rings[s][k2], rings[s + 1][k2], rings[s + 1][k],
          uvFor(kind, a, ra[k][0], ra[k][1]),
          uvFor(kind, a, ra[k2][0], ra[k2][1]),
          uvFor(kind, ccol, rc[k2][0], rc[k2][1]),
          uvFor(kind, ccol, rc[k][0], rc[k][1]),
          fit,
        );
      }
    }

    const topCol = cols[b.stations - 1];
    const topLocal = section(topCol.xL, topCol.xR, topCol.zB, topCol.zF, b.ringN, 1);
    const topFace = b.top || b.front;
    const tFit = [topFace.fitX, topFace.fitY, topFace._layer];
    const sil = topFace.sil;
    const srcW = b.top ? sil.contentW : Math.max(1, sil.maxX - sil.minX);
    const srcH = b.top ? sil.contentH : Math.max(2, Math.round(sil.contentH * 0.18));
    const srcCx = b.top ? sil.midX : (sil.minX + sil.maxX) * 0.5;
    const srcCy = b.top ? (sil.top + sil.bot) * 0.5 : sil.top + srcH * 0.5;
    const fw = Math.max(0.2, topCol.xR - topCol.xL);
    const fd = Math.max(0.2, topCol.zF - topCol.zB);
    const mppT = Math.max(fw / srcW, fd / srcH);
    const uvTop = (lx, lz) => {
      const px = srcCx + lx / mppT;
      const py = srcCy + lz / mppT;
      return [(px + 0.5) / topFace.w, 1 - (py + 0.5) / topFace.h];
    };
    const topRing = rings[b.stations - 1];
    const hub = place(b, 0, yAt(1), 0);
    const hubUv = uvTop(0, 0);
    const hubI = pushVert(verts, hub, hubUv[0], hubUv[1], tFit[0], tFit[1], tFit[2], id);
    for (let k = 0; k < b.ringN; k++) {
      const k2 = (k + 1) % b.ringN;
      const uvA = uvTop(topLocal[k][0], topLocal[k][1]);
      const uvB = uvTop(topLocal[k2][0], topLocal[k2][1]);
      const ia = pushVert(verts, topRing[k], uvA[0], uvA[1], tFit[0], tFit[1], tFit[2], id);
      const ib = pushVert(verts, topRing[k2], uvB[0], uvB[1], tFit[0], tFit[1], tFit[2], id);
      index.push(hubI, ia, ib);
    }

    const walkS = Math.min(b.stations - 1, Math.max(1, Math.round(CONTACT * (b.stations - 1)) + 1));
    const walkRing = rings[walkS].map((p) => [p[0], p[2]]);
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let k = 0; k < walkRing.length; k++) {
      minX = Math.min(minX, walkRing[k][0]);
      maxX = Math.max(maxX, walkRing[k][0]);
      minZ = Math.min(minZ, walkRing[k][1]);
      maxZ = Math.max(maxZ, walkRing[k][1]);
    }
    b.solid = { ring: walkRing, minX, maxX, minZ, maxZ };
    b.thickness = maxDepth;
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
  const solids = built.map((b) => b.solid);

  function pushBody(x, z) {
    for (let i = 0; i < solids.length; i++) {
      const s = solids[i];
      if (x < s.minX - BODY_R || x > s.maxX + BODY_R || z < s.minZ - BODY_R || z > s.maxZ + BODY_R) continue;
      const inside = insideRing(s.ring, x, z);
      const hit = edgeHit(s.ring, x, z);
      if (!inside && hit.d >= BODY_R) continue;
      if (inside) {
        const out = hit.d + BODY_R;
        return [x - hit.nx * out, z - hit.nz * out];
      }
      return [x + hit.nx * (BODY_R - hit.d), z + hit.nz * (BODY_R - hit.d)];
    }
    return null;
  }

  let footAboveMax = -Infinity;
  let faceDotMax = 0;
  let minThickness = Infinity;
  const infoRows = built.map((b) => {
    footAboveMax = Math.max(footAboveMax, b.footAbove);
    faceDotMax = Math.max(faceDotMax, Math.abs(b.faceDot));
    minThickness = Math.min(minThickness, b.thickness);
    return {
      i: b.i,
      role: b.card.role || "",
      x: b.card.x,
      z: b.card.z,
      worldH: b.worldH,
      width: b.maxW,
      depth: b.depth,
      thickness: b.thickness,
      yaw: b.yaw,
      faceDot: b.faceDot,
      baseY: b.baseY,
      seat: b.seat,
      sinkM: b.sink,
      footAbove: b.footAbove,
      stations: b.stations,
      ring: b.ringN,
      sideReal: b.sideReal,
      billboard: false,
    };
  });

  return {
    draws: 1,
    count: built.length,
    push: pushBody,
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
        const hit = edgeHit(b.solid.ring, eye[0], eye[2]);
        const inside = insideRing(b.solid.ring, eye[0], eye[2]);
        const d = Math.max(0.5, inside ? 0.5 : hit.d);
        const sh = (focal * b.worldH) / d;
        const sw = (focal * b.maxW) / d;
        const sd = (focal * b.depth) / d;
        m = Math.max(
          m,
          sh / b.contentH,
          sw / Math.max(1, b.front.sil.contentW),
          sd / Math.max(1, b.sideW),
          sh / b.sideH,
        );
      }
      return m;
    },
    info() {
      return {
        count: built.length,
        billboards: 0,
        sinkM: built.length ? built[0].sink : 0,
        layers: layers.length,
        texW: maxW,
        texH: maxH,
        uploadError,
        tris: count / 3,
        footAboveMax: Number.isFinite(footAboveMax) ? footAboveMax : 0,
        faceDotMax,
        minThickness: Number.isFinite(minThickness) ? minThickness : 0,
        rows: infoRows,
      };
    },
  };
}

import * as THREE from "three";

/**
 * Howl-class frigate. Shape is read off Imagine plates:
 * full contours (not a mirrored half-width), port and starboard separately,
 * and a gap in the port plate is left as a hole. Hull skins are the plates with the
 * parts lifted off. Part position is read from images/measure, where the part is still painted.
 */

type Pix = { data: Uint8ClampedArray; w: number; h: number };
type V3 = { x: number; y: number; z: number };
type UV = [number, number];
type Ray = { sx: number; sy: number };

const NU = 84;
const NS = 64;
const LEN = 224;

const loadPix = (src: string) =>
  new Promise<Pix>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        resolve({ data: new Uint8ClampedArray(16), w: 2, h: 2 });
        return;
      }
      ctx.drawImage(img, 0, 0);
      const im = ctx.getImageData(0, 0, c.width, c.height);
      resolve({ data: im.data, w: c.width, h: c.height });
    };
    img.onerror = () => resolve({ data: new Uint8ClampedArray(16), w: 2, h: 2 });
    img.src = src;
  });

const lumAt = (p: Pix, i: number) =>
  0.2126 * p.data[i * 4] + 0.7152 * p.data[i * 4 + 1] + 0.0722 * p.data[i * 4 + 2];

const skinTex = (src: string) => {
  const tex = new THREE.TextureLoader().load(src);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Law 65: stills sample LINEAR_MIPMAP_LINEAR with mipmaps, never NEAREST.
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
};

class Bucket {
  pos: number[] = [];
  uv: number[] = [];
  idx: number[] = [];
  v(x: number, y: number, z: number, u: number, v: number) {
    const i = this.pos.length / 3;
    this.pos.push(x, y, z);
    this.uv.push(u, v);
    return i;
  }
  tri(a: number, b: number, c: number) {
    this.idx.push(a, b, c);
  }
  quad(a: number, b: number, c: number, d: number) {
    this.tri(a, b, c);
    this.tri(a, c, d);
  }
  mesh(map: THREE.Texture) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    const mat = new THREE.MeshBasicMaterial({ map, toneMapped: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(g, mat);
    m.frustumCulled = false;
    return m;
  }
}

const maskOf = (p: Pix, thr: number) => {
  const m = new Uint8Array(p.w * p.h);
  for (let i = 0; i < m.length; i++) if (lumAt(p, i) > thr) m[i] = 1;
  return m;
};

const blueMask = (p: Pix) => {
  const m = new Uint8Array(p.w * p.h);
  for (let i = 0; i < m.length; i++) {
    const r = p.data[i * 4];
    const g = p.data[i * 4 + 1];
    const b = p.data[i * 4 + 2];
    if (b > 80 && b > r + 18 && b > g) m[i] = 1;
  }
  return m;
};

const fillEnclosed = (m: Uint8Array, w: number, h: number) => {
  const seen = new Uint8Array(m.length);
  const qx = new Int32Array(m.length);
  const qy = new Int32Array(m.length);
  let qe = 0;
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const s = y * w + x;
    if (m[s] || seen[s]) return;
    seen[s] = 1;
    qx[qe] = x;
    qy[qe] = y;
    qe++;
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  let qs = 0;
  while (qs < qe) {
    const x = qx[qs];
    const y = qy[qs];
    qs++;
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }
  for (let i = 0; i < m.length; i++) if (!m[i] && !seen[i]) m[i] = 1;
};

type Blob = { n: number; x0: number; y0: number; x1: number; y1: number; cx: number; cy: number; sx: number; sy: number };

const blobs = (m: Uint8Array, w: number, h: number, minN: number) => {
  const seen = new Uint8Array(m.length);
  const qx = new Int32Array(Math.min(m.length, 800000));
  const qy = new Int32Array(qx.length);
  const out: Blob[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s0 = y * w + x;
      if (!m[s0] || seen[s0]) continue;
      let qs = 0;
      let qe = 0;
      seen[s0] = 1;
      qx[qe] = x;
      qy[qe] = y;
      qe++;
      let n = 0;
      let x0 = x;
      let y0 = y;
      let x1 = x;
      let y1 = y;
      let sx = 0;
      let sy = 0;
      while (qs < qe) {
        const cx = qx[qs];
        const cy = qy[qs];
        qs++;
        n++;
        sx += cx;
        sy += cy;
        if (cx < x0) x0 = cx;
        if (cx > x1) x1 = cx;
        if (cy < y0) y0 = cy;
        if (cy > y1) y1 = cy;
        const step = (nx: number, ny: number) => {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || qe >= qx.length) return;
          const s = ny * w + nx;
          if (!m[s] || seen[s]) return;
          seen[s] = 1;
          qx[qe] = nx;
          qy[qe] = ny;
          qe++;
        };
        step(cx - 1, cy);
        step(cx + 1, cy);
        step(cx, cy - 1);
        step(cx, cy + 1);
      }
      if (n >= minN) out.push({ n, x0, y0, x1, y1, cx: sx / n, cy: sy / n, sx: x, sy: y });
    }
  }
  out.sort((a, b) => b.n - a.n);
  return out;
};

const largestMask = (m: Uint8Array, w: number, h: number) => {
  const all = blobs(m, w, h, 8);
  const keep = new Uint8Array(m.length);
  if (!all.length) return keep;
  const b = all[0];
  const seen = new Uint8Array(m.length);
  const qx = new Int32Array(m.length);
  const qy = new Int32Array(m.length);
  let qe = 0;
  let qs = 0;
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h || qe >= qx.length) return;
    const s = y * w + x;
    if (!m[s] || seen[s]) return;
    seen[s] = 1;
    keep[s] = 1;
    qx[qe] = x;
    qy[qe] = y;
    qe++;
  };
  push(b.sx, b.sy);
  while (qs < qe) {
    const x = qx[qs];
    const y = qy[qs];
    qs++;
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }
  return keep;
};

const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross = (a: V3, b: V3): V3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const norm = (a: V3): V3 => {
  const L = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / L, y: a.y / L, z: a.z / L };
};

const smoothKeep = (a: Float32Array) => {
  const t = Float32Array.from(a);
  for (let i = 1; i < a.length - 1; i++) {
    const jump = Math.max(Math.abs(t[i] - t[i - 1]), Math.abs(t[i + 1] - t[i]));
    if (jump > 1.6) continue;
    a[i] = t[i] * 0.5 + t[i - 1] * 0.25 + t[i + 1] * 0.25;
  }
};

const contentBox = (m: Uint8Array, w: number, h: number) => {
  let x0 = w;
  let y0 = h;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!m[y * w + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < x0) return { x0: 0, y0: 0, x1: 1, y1: 1 };
  return { x0, y0, x1, y1 };
};

const raysOf = (p: Pix): Ray[] => {
  const m = maskOf(p, 18);
  fillEnclosed(m, p.w, p.h);
  const box = contentBox(m, p.w, p.h);
  let cx = (box.x0 + box.x1) / 2;
  let cy = (box.y0 + box.y1) / 2;
  if (!m[Math.round(cy) * p.w + Math.round(cx)]) {
    let found = false;
    for (let r = 1; r < 120 && !found; r++) {
      for (let k = 0; k < 12; k++) {
        const x = Math.round(cx + Math.cos((k / 12) * Math.PI * 2) * r);
        const y = Math.round(cy + Math.sin((k / 12) * Math.PI * 2) * r);
        if (x < 0 || y < 0 || x >= p.w || y >= p.h) continue;
        if (m[y * p.w + x]) {
          cx = x;
          cy = y;
          found = true;
          break;
        }
      }
    }
  }
  const halfW = Math.max(8, Math.max(box.x1 - cx, cx - box.x0));
  const H = Math.max(8, box.y1 - box.y0);
  const out: Ray[] = [];
  for (let j = 0; j < NS; j++) {
    const a = (j / NS) * Math.PI * 2;
    const dx = Math.sin(a);
    const dy = Math.cos(a);
    let lx = cx;
    let ly = cy;
    const limit = Math.hypot(box.x1 - box.x0, box.y1 - box.y0) + 8;
    for (let r = 1; r < limit; r += 0.8) {
      const x = cx + dx * r;
      const y = cy + dy * r;
      const ix = Math.round(x);
      const iy = Math.round(y);
      if (ix < 0 || iy < 0 || ix >= p.w || iy >= p.h || !m[iy * p.w + ix]) break;
      lx = x;
      ly = y;
    }
    out.push({ sx: (lx - cx) / halfW, sy: (box.y1 - ly) / H });
  }
  return out;
};

const mixRay = (a: Ray, b: Ray, k: number): Ray => ({
  sx: a.sx * (1 - k) + b.sx * k,
  sy: a.sy * (1 - k) + b.sy * k,
});

type Pt = V3 & { sy: number; u: number };

const pixUV = (p: Pix, x: number, y: number): UV => [x / p.w, 1 - y / p.h];

export async function mountFrigate(
  scene: THREE.Scene,
  place: { x: number; y: number; z: number; yaw: number } = { x: 280, y: 22, z: -250, yaw: 0.42 },
) {
  const [port, stbd, top, belly, stern, secStern, secShoulder, secMid, secBow, nacelle, nacelleFront, turret, turretFront, bridge, bridgeFront, pylon, hangar, topMeasure, bellyMeasure, sternMeasure, bell, bellFront, portMeasure] =
    await Promise.all([
      loadPix("/biome/frigate/port.jpg"),
      loadPix("/biome/frigate/stbd.jpg"),
      loadPix("/biome/frigate/top.jpg"),
      loadPix("/biome/frigate/belly.jpg"),
      loadPix("/biome/frigate/stern.jpg"),
      loadPix("/biome/frigate/sec-stern.jpg"),
      loadPix("/biome/frigate/sec-shoulder.jpg"),
      loadPix("/biome/frigate/sec-mid.jpg"),
      loadPix("/biome/frigate/sec-bow.jpg"),
      loadPix("/biome/frigate/nacelle.jpg"),
      loadPix("/biome/frigate/nacelle-front.jpg"),
      loadPix("/biome/frigate/turret.jpg"),
      loadPix("/biome/frigate/turret-front.jpg"),
      loadPix("/biome/frigate/bridge.jpg"),
      loadPix("/biome/frigate/bridge-front.jpg"),
      loadPix("/biome/frigate/pylon.jpg"),
      loadPix("/biome/frigate/hangar.jpg"),
      loadPix("/biome/frigate/measure/top.jpg"),
      loadPix("/biome/frigate/measure/belly.jpg"),
      loadPix("/biome/frigate/measure/stern.jpg"),
      loadPix("/biome/frigate/bell.jpg"),
      loadPix("/biome/frigate/bell-front.jpg"),
      loadPix("/biome/frigate/measure/port.jpg"),
    ]);

  const portMap = skinTex("/biome/frigate/port.jpg");
  const stbdMap = skinTex("/biome/frigate/stbd.jpg");
  const topMap = skinTex("/biome/frigate/top.jpg");
  const bellyMap = skinTex("/biome/frigate/belly.jpg");
  const sternMap = skinTex("/biome/frigate/stern.jpg");
  const nacelleMap = skinTex("/biome/frigate/nacelle.jpg");
  const nacelleFrontMap = skinTex("/biome/frigate/nacelle-front.jpg");
  const turretMap = skinTex("/biome/frigate/turret.jpg");
  const turretFrontMap = skinTex("/biome/frigate/turret-front.jpg");
  const bridgeMap = skinTex("/biome/frigate/bridge.jpg");
  const bridgeFrontMap = skinTex("/biome/frigate/bridge-front.jpg");
  const pylonMap = skinTex("/biome/frigate/pylon.jpg");
  const hangarMap = skinTex("/biome/frigate/hangar.jpg");
  const bellMap = skinTex("/biome/frigate/bell.jpg");
  const bellFrontMap = skinTex("/biome/frigate/bell-front.jpg");

  const portM = largestMask(maskOf(port, 16), port.w, port.h);
  const stbdM = largestMask(maskOf(stbd, 16), stbd.w, stbd.h);
  const topM = largestMask(maskOf(top, 16), top.w, top.h);
  const bellyM = largestMask(maskOf(belly, 16), belly.w, belly.h);
  const portBox = contentBox(portM, port.w, port.h);
  const stbdBox = contentBox(stbdM, stbd.w, stbd.h);
  const topBox = contentBox(topM, top.w, top.h);
  const bellyBox = contentBox(bellyM, belly.w, belly.h);
  const portScale = LEN / Math.max(8, portBox.x1 - portBox.x0);
  const topMeasureM = largestMask(maskOf(topMeasure, 16), topMeasure.w, topMeasure.h);
  const topMeasureBox = contentBox(topMeasureM, topMeasure.w, topMeasure.h);
  // The raw content box starts on the five painted engine mouths. The hull
  // lock is the first solid run of columns, past those mouths.
  {
    const gapsAt = (x: number) => {
      const ix = Math.max(0, Math.min(topMeasure.w - 1, x));
      let top = -1;
      let bot = -1;
      let n = 0;
      for (let y = 0; y < topMeasure.h; y++) {
        if (!topMeasureM[y * topMeasure.w + ix]) continue;
        if (top < 0) top = y;
        bot = y;
        n++;
      }
      if (n < 80) return 999;
      return bot - top + 1 - n;
    };
    const last = Math.min(topMeasureBox.x1 - 12, topMeasureBox.x0 + 400);
    let stern = topMeasureBox.x0;
    for (let x = topMeasureBox.x0; x < last; x++) {
      let ok = true;
      for (let k = 0; k < 12; k++) {
        if (gapsAt(x + k) > 1) {
          ok = false;
          break;
        }
      }
      if (ok) {
        stern = x;
        break;
      }
    }
    let y0 = topMeasure.h;
    let y1 = 0;
    for (let y = 0; y < topMeasure.h; y++) {
      const row = y * topMeasure.w;
      for (let x = stern; x < topMeasureBox.x1; x++) {
        if (!topMeasureM[row + x]) continue;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
        break;
      }
    }
    topMeasureBox.x0 = stern;
    if (y1 > y0) {
      topMeasureBox.y0 = y0;
      topMeasureBox.y1 = y1;
    }
  }
  const measureScale = LEN / Math.max(8, topMeasureBox.x1 - topMeasureBox.x0);

  const column = (m: Uint8Array, w: number, h: number, x: number) => {
    const ix = Math.max(0, Math.min(w - 1, Math.round(x)));
    let topY = -1;
    let botY = -1;
    const gaps: { a: number; b: number }[] = [];
    let run = -1;
    let gap = -1;
    for (let y = 0; y < h; y++) {
      if (m[y * w + ix]) {
        if (topY < 0) topY = y;
        botY = y;
        if (gap >= 0) {
          const glen = y - gap;
          if (glen > 36) gaps.push({ a: gap, b: y - 1 });
          gap = -1;
        }
        run = y;
      } else if (run >= 0 && gap < 0) gap = y;
    }
    return topY < 0 ? null : { topY, botY, gaps };
  };

  const hullTop = new Float32Array(NU);
  const hullBot = new Float32Array(NU);
  const beamPort = new Float32Array(NU);
  const beamStbd = new Float32Array(NU);
  const portImgTop = new Float32Array(NU);
  const portImgBot = new Float32Array(NU);
  let yRef = 0;
  let nRef = 0;
  for (let i = 0; i < NU; i++) {
    const u = i / (NU - 1);
    const x = portBox.x0 + u * (portBox.x1 - portBox.x0);
    const col = column(portM, port.w, port.h, x);
    if (!col) continue;
    yRef += (col.topY + col.botY) * 0.5;
    nRef++;
  }
  yRef = nRef ? yRef / nRef : port.h / 2;
  for (let i = 0; i < NU; i++) {
    const u = i / (NU - 1);
    const x = portBox.x0 + u * (portBox.x1 - portBox.x0);
    const col = column(portM, port.w, port.h, x);
    if (!col) {
      hullTop[i] = i ? hullTop[i - 1] : 0;
      hullBot[i] = i ? hullBot[i - 1] : 0;
      portImgTop[i] = i ? portImgTop[i - 1] : portBox.y0;
      portImgBot[i] = i ? portImgBot[i - 1] : portBox.y1;
      continue;
    }
    hullTop[i] = (yRef - col.topY) * portScale;
    hullBot[i] = (yRef - col.botY) * portScale;
    portImgTop[i] = col.topY;
    portImgBot[i] = col.botY;
  }

  const stbdTop = new Float32Array(NU);
  const stbdImgTop = new Float32Array(NU);
  const stbdImgBot = new Float32Array(NU);
  let sRef = 0;
  let ns = 0;
  for (let i = 0; i < NU; i++) {
    const u = i / (NU - 1);
    const x = stbdBox.x0 + u * (stbdBox.x1 - stbdBox.x0);
    const col = column(stbdM, stbd.w, stbd.h, x);
    if (!col) continue;
    sRef += (col.topY + col.botY) * 0.5;
    ns++;
  }
  sRef = ns ? sRef / ns : stbd.h / 2;
  const stbdScale = LEN / Math.max(8, stbdBox.x1 - stbdBox.x0);
  for (let i = 0; i < NU; i++) {
    const u = i / (NU - 1);
    const x = stbdBox.x0 + u * (stbdBox.x1 - stbdBox.x0);
    const col = column(stbdM, stbd.w, stbd.h, x);
    stbdTop[i] = col ? (sRef - col.topY) * stbdScale : hullTop[i];
    stbdImgTop[i] = col ? col.topY : i ? stbdImgTop[i - 1] : stbdBox.y0;
    stbdImgBot[i] = col ? col.botY : i ? stbdImgBot[i - 1] : stbdBox.y1;
  }
  const deltas: number[] = [];
  for (let i = 0; i < NU; i++) deltas.push(stbdTop[i] - hullTop[i]);
  deltas.sort((a, b) => a - b);
  const align = deltas[Math.floor(deltas.length / 2)] || 0;
  const deckRank = Array.from(stbdImgTop).sort((a, b) => a - b);
  const deckRef = deckRank[Math.floor(deckRank.length * 0.6)] || stbdBox.y0;
  for (let i = 0; i < NU; i++) if (deckRef - stbdImgTop[i] > 28) stbdImgTop[i] = -1;
  for (let i = 0; i < NU; i++) {
    if (stbdImgTop[i] >= 0) continue;
    let a = i;
    let b = i;
    while (a > 0 && stbdImgTop[a] < 0) a--;
    while (b < NU - 1 && stbdImgTop[b] < 0) b++;
    const ta = stbdImgTop[a] < 0 ? deckRef : stbdImgTop[a];
    const tb = stbdImgTop[b] < 0 ? deckRef : stbdImgTop[b];
    const k = b === a ? 0 : (i - a) / (b - a);
    stbdImgTop[i] = ta * (1 - k) + tb * k;
  }
  let bridgeU = 0.62;
  let bridgeH = 8;
  let bridgeRun = 0;
  let runStart = -1;
  for (let i = 0; i <= NU; i++) {
    const bump = i < NU ? stbdTop[i] - align - hullTop[i] : 0;
    if (bump > 3.2) {
      if (runStart < 0) runStart = i;
    } else if (runStart >= 0) {
      const len = i - runStart;
      if (len > bridgeRun) {
        bridgeRun = len;
        bridgeU = (runStart + i - 1) / 2 / (NU - 1);
        let peak = 0;
        for (let k = runStart; k < i; k++) peak = Math.max(peak, stbdTop[k] - align - hullTop[k]);
        bridgeH = peak;
      }
      runStart = -1;
    }
  }

  const mids: number[] = [];
  for (let i = Math.floor(NU * 0.72); i < Math.floor(NU * 0.94); i++) {
    const u = i / (NU - 1);
    const x = topMeasureBox.x0 + u * (topMeasureBox.x1 - topMeasureBox.x0);
    const col = column(topMeasureM, topMeasure.w, topMeasure.h, x);
    if (col) mids.push((col.topY + col.botY) * 0.5);
  }
  mids.sort((a, b) => a - b);
  const centerPx = mids.length ? mids[Math.floor(mids.length / 2)] : (topMeasureBox.y0 + topMeasureBox.y1) / 2;
  for (let i = 0; i < NU; i++) {
    const u = i / (NU - 1);
    const x = topMeasureBox.x0 + u * (topMeasureBox.x1 - topMeasureBox.x0);
    const col = column(topMeasureM, topMeasure.w, topMeasure.h, x);
    if (!col) {
      beamPort[i] = i ? beamPort[i - 1] : 4;
      beamStbd[i] = i ? beamStbd[i - 1] : 4;
      continue;
    }
    beamStbd[i] = Math.max(0.8, (centerPx - col.topY) * measureScale);
    beamPort[i] = Math.max(0.8, (col.botY - centerPx) * measureScale);
  }
  smoothKeep(hullTop);
  smoothKeep(hullBot);
  smoothKeep(beamPort);
  smoothKeep(beamStbd);
  // The cleaned side skin can leave a one-column speck at the stern tip.
  // That speck is not a section. Give station 0 the next real bulkhead height.
  if (hullTop[0] - hullBot[0] < (hullTop[1] - hullBot[1]) * 0.45) {
    hullTop[0] = hullTop[1];
    hullBot[0] = hullBot[1];
  }

  let holeU0 = 0.42;
  let holeU1 = 0.58;
  let holeS0 = 0.35;
  let holeS1 = 0.72;
  let holeN = 0;
  let runI0 = -1;
  let runS0 = 1;
  let runS1 = 0;
  let bestN = 0;
  const takeRun = (i1: number) => {
    const n = i1 - runI0;
    if (runI0 < 0 || n <= bestN) return;
    bestN = n;
    holeN = n;
    holeU0 = runI0 / (NU - 1);
    holeU1 = (i1 - 1) / (NU - 1);
    holeS0 = runS0;
    holeS1 = runS1;
  };
  for (let i = 0; i <= NU; i++) {
    const u = i / (NU - 1);
    const x = portBox.x0 + Math.min(1, u) * (portBox.x1 - portBox.x0);
    const col = i < NU ? column(portM, port.w, port.h, x) : null;
    const gap = col && col.gaps.length ? col.gaps.reduce((p, g) => (g.b - g.a > p.b - p.a ? g : p)) : null;
    const open = gap && gap.b - gap.a >= 70 && col;
    if (open && col && gap) {
      const sTop = (col.botY - gap.a) / Math.max(1, col.botY - col.topY);
      const sBot = (col.botY - gap.b) / Math.max(1, col.botY - col.topY);
      if (runI0 < 0) {
        runI0 = i;
        runS0 = sBot;
        runS1 = sTop;
      } else {
        runS0 = Math.min(runS0, sBot);
        runS1 = Math.max(runS1, sTop);
      }
    } else {
      takeRun(i);
      runI0 = -1;
    }
  }

  const shapes = [raysOf(secStern), raysOf(secShoulder), raysOf(secMid), raysOf(secBow)];
  const stations = [0.08, 0.34, 0.56, 0.9];
  const shapeAt = (u: number, j: number): Ray => {
    let ia = 0;
    while (ia < stations.length - 2 && u > stations[ia + 1]) ia++;
    const k = Math.max(0, Math.min(1, (u - stations[ia]) / (stations[ia + 1] - stations[ia] || 1)));
    return mixRay(shapes[ia][j], shapes[ia + 1][j], k);
  };

  const P: Pt[][] = [];
  for (let i = 0; i < NU; i++) {
    P[i] = [];
    const u = i / (NU - 1);
    const deck = hullTop[i];
    const keel = hullBot[i];
    for (let j = 0; j < NS; j++) {
      const s = shapeAt(u, j);
      const beam = s.sx < 0 ? beamPort[i] : beamStbd[i];
      P[i][j] = {
        x: (u - 0.5) * LEN,
        y: keel + s.sy * (deck - keel),
        z: -s.sx * beam,
        sy: s.sy,
        u,
      };
    }
  }

  const sideUV = (img: Pix, box: { x0: number; x1: number }, tops: Float32Array, bots: Float32Array, u: number, sy: number): UV => {
    const x = box.x0 + u * (box.x1 - box.x0);
    const f = Math.max(0, Math.min(NU - 1.0001, u * (NU - 1)));
    const i = Math.floor(f);
    const t = f - i;
    const top = tops[i] * (1 - t) + tops[i + 1] * t;
    const bot = bots[i] * (1 - t) + bots[i + 1] * t;
    const y = bot - Math.max(0, Math.min(1, sy)) * (bot - top);
    return pixUV(img, x, y);
  };
  const planUV = (img: Pix, box: { x0: number; x1: number }, u: number, z: number, scale: number, mid: number): UV => {
    const x = box.x0 + u * (box.x1 - box.x0);
    const y = mid + z / scale;
    return pixUV(img, x, y);
  };

  const buckets = {
    port: new Bucket(),
    stbd: new Bucket(),
    roof: new Bucket(),
    belly: new Bucket(),
    stern: new Bucket(),
    bow: new Bucket(),
  };

  const inHole = (u: number, sy: number, z: number) =>
    holeN > 4 && z > 0 && u >= holeU0 && u <= holeU1 && sy >= holeS0 && sy <= holeS1;

  for (let i = 0; i < NU - 1; i++) {
    for (let j = 0; j < NS; j++) {
      const j2 = (j + 1) % NS;
      const A = P[i][j];
      const B = P[i + 1][j];
      const C = P[i + 1][j2];
      const D = P[i][j2];
      const n = norm(cross(sub(B, A), sub(D, A)));
      const cz = (A.z + B.z + C.z + D.z) / 4;
      const cy = (A.y + B.y + C.y + D.y) / 4;
      const midY = (hullTop[i] + hullBot[i]) * 0.5;
      const outward = n.y * (cy - midY) + n.z * cz + n.x * 0;
      const nn = outward < 0 ? { x: -n.x, y: -n.y, z: -n.z } : n;
      if (nn.z > 0.2 && inHole((A.u + B.u) / 2, (A.sy + B.sy + C.sy + D.sy) / 4, cz)) continue;
      let kind: keyof typeof buckets = cz >= 0 ? "port" : "stbd";
      if (nn.y > 0.62) kind = "roof";
      else if (nn.y < -0.48) kind = "belly";
      const bucket = buckets[kind];
      const uv = (pt: Pt): UV => {
        if (kind === "roof") return planUV(top, topMeasureBox, pt.u, pt.z, measureScale, centerPx);
        if (kind === "belly") return planUV(belly, bellyBox, pt.u, pt.z, LEN / Math.max(8, bellyBox.x1 - bellyBox.x0), (bellyBox.y0 + bellyBox.y1) / 2);
        if (kind === "stbd") return sideUV(stbd, stbdBox, stbdImgTop, stbdImgBot, pt.u, pt.sy);
        return sideUV(port, portBox, portImgTop, portImgBot, pt.u, pt.sy);
      };
      const ua = uv(A);
      const ub = uv(B);
      const uc = uv(C);
      const ud = uv(D);
      const ia = bucket.v(A.x, A.y, A.z, ua[0], ua[1]);
      const ib = bucket.v(B.x, B.y, B.z, ub[0], ub[1]);
      const ic = bucket.v(C.x, C.y, C.z, uc[0], uc[1]);
      const idd = bucket.v(D.x, D.y, D.z, ud[0], ud[1]);
      bucket.quad(ia, ib, ic, idd);
    }
  }

  const sternBox = contentBox(maskOf(stern, 16), stern.w, stern.h);
  const makeSternUV = (pix: Pix, box: { x0: number; y0: number; x1: number; y1: number }) => (y: number, z: number): UV => {
    const H = Math.max(1e-3, hullTop[0] - hullBot[0]);
    const t = Math.max(0, Math.min(1, (y - hullBot[0]) / H));
    const py = box.y1 - t * (box.y1 - box.y0);
    const half = Math.max(1, (box.x1 - box.x0) * 0.5);
    const mid = (box.x0 + box.x1) * 0.5;
    const reach = Math.max(beamPort[0], beamStbd[0], 0.001);
    const px = mid - (z / reach) * half;
    return pixUV(pix, px, py);
  };
  const sternUV = makeSternUV(stern, sternBox);

  const cap = (i: number, bow: boolean) => {
    const bucket = bow ? buckets.bow : buckets.stern;
    const loop = P[i];
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const p of loop) {
      cx += p.x;
      cy += p.y;
      cz += p.z;
    }
    cx /= loop.length;
    cy /= loop.length;
    cz /= loop.length;
    const cuv = bow ? sideUV(port, portBox, portImgTop, portImgBot, loop[0].u, 0.5) : sternUV(cy, cz);
    const cId = bucket.v(cx, cy, cz, cuv[0], cuv[1]);
    const ids = loop.map((p) => {
      const uv = bow
        ? sideUV(p.z >= 0 ? port : stbd, p.z >= 0 ? portBox : stbdBox, p.z >= 0 ? portImgTop : stbdImgTop, p.z >= 0 ? portImgBot : stbdImgBot, p.u, p.sy)
        : sternUV(p.y, p.z);
      return bucket.v(p.x, p.y, p.z, uv[0], uv[1]);
    });
    for (let k = 0; k < ids.length; k++) {
      const k2 = (k + 1) % ids.length;
      if (bow) bucket.tri(cId, ids[k], ids[k2]);
      else bucket.tri(cId, ids[k2], ids[k]);
    }
  };
  cap(0, false);
  cap(NU - 1, true);

  const sternMeasureBox = contentBox(maskOf(sternMeasure, 16), sternMeasure.w, sternMeasure.h);
  const blues = blobs(blueMask(sternMeasure), sternMeasure.w, sternMeasure.h, 80).slice(0, 4);
  const bells = new Bucket();
  const cores = new Bucket();
  const xSurf = P[0][0].x;
  const measureCenter = centerPx;
  const portMeasureM = largestMask(maskOf(portMeasure, 16), portMeasure.w, portMeasure.h);
  const portMeasureBox = contentBox(portMeasureM, portMeasure.w, portMeasure.h);
  const portMeasureScale = LEN / Math.max(8, portMeasureBox.x1 - portMeasureBox.x0);
  const bellLen = Math.max(2.2, Math.min(8, Math.max(0, portBox.x0 - portMeasureBox.x0) * portMeasureScale));
  const faceTop = hullTop[0];
  const faceBot = hullBot[0];
  const faceH = Math.max(1, faceTop - faceBot);
  const faceW = Math.max(1, beamPort[0] + beamStbd[0]);
  const plateW = Math.max(1, sternMeasureBox.x1 - sternMeasureBox.x0);
  const plateH = Math.max(1, sternMeasureBox.y1 - sternMeasureBox.y0);
  const bellScale = Math.min(faceW / plateW, faceH / plateH);
  const faceY = (faceTop + faceBot) * 0.5;
  const faceZ = (beamPort[0] - beamStbd[0]) * 0.5;
  const plateMidX = (sternMeasureBox.x0 + sternMeasureBox.x1) * 0.5;
  const plateMidY = (sternMeasureBox.y0 + sternMeasureBox.y1) * 0.5;
  const frontMask = maskOf(bellFront, 16);
  const frontBox = contentBox(frontMask, bellFront.w, bellFront.h);
  const frontCx = (frontBox.x0 + frontBox.x1) * 0.5;
  const frontCy = (frontBox.y0 + frontBox.y1) * 0.5;
  const frontR = Math.min(frontBox.x1 - frontBox.x0, frontBox.y1 - frontBox.y0) * 0.5;
  for (const e of blues) {
    const y = faceY - (e.cy - plateMidY) * bellScale;
    const z = faceZ - (e.cx - plateMidX) * bellScale;
    const r = Math.max(0.7, (e.x1 - e.x0) * 0.5 * bellScale * 1.65);
    const SEG = 24;
    const ring = (bucket: Bucket, x: number, rad: number, along: number) => {
      const ids: number[] = [];
      for (let s = 0; s < SEG; s++) {
        const a = (s / SEG) * Math.PI * 2;
        ids.push(bucket.v(x, y + Math.cos(a) * rad, z + Math.sin(a) * rad, along, s / SEG));
      }
      return ids;
    };
    const aft = ring(bells, xSurf - bellLen, r, 0);
    const root = ring(bells, xSurf - 0.06, r * 0.62, 1);
    for (let s = 0; s < SEG; s++) {
      const s2 = (s + 1) % SEG;
      bells.quad(aft[s], aft[s2], root[s2], root[s]);
    }
    const lip: number[] = [];
    for (let s = 0; s < SEG; s++) {
      const a = (s / SEG) * Math.PI * 2;
      const px = frontCx + Math.cos(a) * frontR * 0.96;
      const py = frontCy + Math.sin(a) * frontR * 0.96;
      const uv = pixUV(bellFront, px, py);
      lip.push(cores.v(xSurf - bellLen - 0.02, y + Math.cos(a) * r * 0.96, z + Math.sin(a) * r * 0.96, uv[0], uv[1]));
    }
    const cuv = pixUV(bellFront, frontCx, frontCy);
    const gc = cores.v(xSurf - bellLen - 0.02, y, z, cuv[0], cuv[1]);
    for (let s = 0; s < SEG; s++) cores.tri(gc, lip[s], lip[(s + 1) % SEG]);
  }

  const root = new THREE.Group();
  root.add(buckets.port.mesh(portMap));
  root.add(buckets.stbd.mesh(stbdMap));
  root.add(buckets.roof.mesh(topMap));
  root.add(buckets.belly.mesh(bellyMap));
  root.add(buckets.stern.mesh(sternMap));
  root.add(buckets.bow.mesh(portMap));
  root.add(bells.mesh(bellMap));
  root.add(cores.mesh(bellFrontMap));

  const depth = Math.max(8, (beamPort[Math.floor(NU * 0.5)] || 8) * 0.82);
  const sample = (u: number, sy: number, zSide: number) => {
    const i = Math.max(0, Math.min(NU - 1, Math.round(u * (NU - 1))));
    let best = P[i][0];
    let bd = 1e9;
    for (const p of P[i]) {
      if (Math.sign(p.z || 1) !== Math.sign(zSide || 1)) continue;
      const d = Math.abs(p.sy - sy);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  };
  const hang = new Bucket();
  const rim = new Bucket();
  const hUL = sample(holeU0, holeS1, 1);
  const hUR = sample(holeU1, holeS1, 1);
  const hLL = sample(holeU0, holeS0, 1);
  const hLR = sample(holeU1, holeS0, 1);
  const inset = (p: Pt): V3 => ({ x: p.x, y: p.y, z: p.z - depth });
  const iUL = inset(hUL);
  const iUR = inset(hUR);
  const iLL = inset(hLL);
  const iLR = inset(hLR);
  const face = (bucket: Bucket, A: V3, B: V3, C: V3, D: V3, uv: UV[]) => {
    const ia = bucket.v(A.x, A.y, A.z, uv[0][0], uv[0][1]);
    const ib = bucket.v(B.x, B.y, B.z, uv[1][0], uv[1][1]);
    const ic = bucket.v(C.x, C.y, C.z, uv[2][0], uv[2][1]);
    const idd = bucket.v(D.x, D.y, D.z, uv[3][0], uv[3][1]);
    bucket.quad(ia, ib, ic, idd);
  };
  const quad = (u0: number, v0: number, u1: number, v1: number): UV[] => [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ];
  const mid = {
    x: (iUL.x + iUR.x + iLL.x + iLR.x) / 4,
    y: (iUL.y + iUR.y + iLL.y + iLR.y) / 4,
    z: (iUL.z + iUR.z + iLL.z + iLR.z) / 4,
  };
  const shrink = (p: V3): V3 => ({
    x: mid.x + (p.x - mid.x) * 0.72,
    y: mid.y + (p.y - mid.y) * 0.72,
    z: p.z,
  });
  const bUL = shrink(iUL);
  const bUR = shrink(iUR);
  const bLL = shrink(iLL);
  const bLR = shrink(iLR);
  // Open at the port mouth. Inner walls use crops of hangar.jpg so the bay is a volume, not one flat poster.
  face(hang, bUL, bUR, bLR, bLL, quad(0.08, 0.08, 0.92, 0.92));
  face(hang, hLL, hLR, bLR, bLL, quad(0.05, 0.72, 0.95, 0.98));
  face(hang, hUL, bUL, bUR, hUR, quad(0.05, 0.02, 0.95, 0.28));
  face(hang, hUL, hLL, bLL, bUL, quad(0.02, 0.15, 0.28, 0.85));
  face(hang, hUR, bUR, bLR, hLR, quad(0.72, 0.15, 0.98, 0.85));
  const uvPt = (p: Pt): UV => sideUV(port, portBox, portImgTop, portImgBot, p.u, p.sy);
  face(rim, hUL, hUR, iUR, iUL, [uvPt(hUL), uvPt(hUR), uvPt(hUR), uvPt(hUL)]);
  face(rim, hLL, iLL, iLR, hLR, [uvPt(hLL), uvPt(hLL), uvPt(hLR), uvPt(hLR)]);
  face(rim, hUL, iUL, iLL, hLL, [uvPt(hUL), uvPt(hUL), uvPt(hLL), uvPt(hLL)]);
  face(rim, hUR, hLR, iLR, iUR, [uvPt(hUR), uvPt(hLR), uvPt(hLR), uvPt(hUR)]);
  root.add(hang.mesh(hangarMap));
  root.add(rim.mesh(portMap));

  const boxOf = (p: Pix) => {
    const m = maskOf(p, 16);
    return contentBox(m, p.w, p.h);
  };

  const addPrism = (side: Pix, front: Pix, length: number, sideMap: THREE.Texture, frontMap: THREE.Texture, mouth: "start" | "end" | "none" = "none") => {
    const box = boxOf(side);
    const fbox = boxOf(front);
    const scale = length / Math.max(8, box.x1 - box.x0);
    const N = 28;
    const topY: number[] = [];
    const botY: number[] = [];
    const pxT: number[] = [];
    const pxB: number[] = [];
    const cols: number[] = [];
    let ref = 0;
    let nr = 0;
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      const x = box.x0 + u * (box.x1 - box.x0);
      const ix = Math.max(0, Math.min(side.w - 1, Math.round(x)));
      let a = -1;
      let b = -1;
      for (let y = 0; y < side.h; y++) {
        if (lumAt(side, y * side.w + ix) <= 16) continue;
        if (a < 0) a = y;
        b = y;
      }
      cols.push(ix);
      pxT.push(a);
      pxB.push(b);
      if (a >= 0) {
        ref += (a + b) * 0.5;
        nr++;
      }
    }
    ref = nr ? ref / nr : side.h / 2;
    for (let i = 0; i < N; i++) {
      const a = pxT[i];
      const b = pxB[i];
      if (a < 0 || b < 0) {
        topY[i] = i ? topY[i - 1] : 0;
        botY[i] = i ? botY[i - 1] : 0;
      } else {
        topY[i] = (ref - a) * scale;
        botY[i] = (ref - b) * scale;
      }
    }
    const sideH = Math.max(0.4, Math.max(...topY) - Math.min(...botY));
    const thick = Math.max(0.35, ((fbox.x1 - fbox.x0) / Math.max(8, fbox.y1 - fbox.y0)) * sideH);
    const body = new Bucket();
    const putFace = (z: number) => {
      const ids: number[] = [];
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1);
        const x = (u - 0.5) * length;
        const uvT = pixUV(side, cols[i], pxT[i] < 0 ? ref : pxT[i]);
        const uvB = pixUV(side, cols[i], pxB[i] < 0 ? ref : pxB[i]);
        ids.push(body.v(x, topY[i], z, uvT[0], uvT[1]), body.v(x, botY[i], z, uvB[0], uvB[1]));
      }
      for (let i = 0; i < N - 1; i++) {
        const a = ids[i * 2];
        const b = ids[i * 2 + 1];
        const c = ids[(i + 1) * 2 + 1];
        const d = ids[(i + 1) * 2];
        if (z > 0) body.quad(a, d, c, b);
        else body.quad(a, b, c, d);
      }
    };
    putFace(thick / 2);
    putFace(-thick / 2);
    const rho = (box.x1 - box.x0) / Math.max(0.001, length);
    const lip = 8;
    const slab = lip / Math.max(0.001, rho);
    const clampY = (y: number) => Math.max(0, Math.min(side.h - 1, Math.round(y)));
    const topNear = (i: number) => clampY(pxT[i] < 0 ? ref : pxT[i]);
    const botNear = (i: number) => clampY(pxB[i] < 0 ? ref : pxB[i]);
    const band = (up: boolean) => {
      for (let i = 0; i < N - 1; i++) {
        const x0 = (i / (N - 1) - 0.5) * length;
        const x1 = ((i + 1) / (N - 1) - 0.5) * length;
        let z0 = thick / 2;
        while (z0 > -thick / 2 + 1e-4) {
          const z1 = Math.max(-thick / 2, z0 - slab);
          const frac = (z0 - z1) / Math.max(1e-4, slab);
          const pixY = (idx: number) => clampY((up ? topNear(idx) : botNear(idx)) + (up ? 1 : -1) * lip * frac);
          const yAt = (idx: number) => (up ? topY[idx] : botY[idx]);
          const uv0 = pixUV(side, cols[i], up ? topNear(i) : botNear(i));
          const uv1 = pixUV(side, cols[i + 1], up ? topNear(i + 1) : botNear(i + 1));
          const uv0f = pixUV(side, cols[i], pixY(i));
          const uv1f = pixUV(side, cols[i + 1], pixY(i + 1));
          const a = body.v(x0, yAt(i), z0, uv0[0], uv0[1]);
          const b = body.v(x1, yAt(i + 1), z0, uv1[0], uv1[1]);
          const c = body.v(x1, yAt(i + 1), z1, uv1f[0], uv1f[1]);
          const d = body.v(x0, yAt(i), z1, uv0f[0], uv0f[1]);
          if (up) body.quad(a, b, c, d);
          else body.quad(a, d, c, b);
          z0 = z1;
        }
      }
    };
    band(true);
    band(false);
    const g = new THREE.Group();
    g.add(body.mesh(sideMap));
    const frontCaps = new Bucket();
    const sideCaps = new Bucket();
    const nearestPainted = (pix: Pix, x: number, y: number) => {
      const lit = (px: number, py: number) => px >= 0 && py >= 0 && px < pix.w && py < pix.h && lumAt(pix, py * pix.w + px) > 16;
      const ix = Math.round(x);
      const iy = Math.round(y);
      if (lit(ix, iy)) return [ix, iy] as const;
      for (let rad = 1; rad <= 40; rad++) {
        for (let dy = -rad; dy <= rad; dy++) {
          for (let dx = -rad; dx <= rad; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
            if (lit(ix + dx, iy + dy)) return [ix + dx, iy + dy] as const;
          }
        }
      }
      return [Math.max(0, Math.min(pix.w - 1, ix)), Math.max(0, Math.min(pix.h - 1, iy))] as const;
    };
    const paintFront = (i: number, sign: number) => {
      const x = (i / (N - 1) - 0.5) * length;
      const GX = 6;
      const GY = 5;
      const ids: number[] = [];
      for (let gy = 0; gy <= GY; gy++) {
        for (let gx = 0; gx <= GX; gx++) {
          const z = thick / 2 - (gx / GX) * thick;
          const yv = topY[i] + ((botY[i] - topY[i]) * gy) / GY;
          const hit = nearestPainted(front, fbox.x0 + (gx / GX) * (fbox.x1 - fbox.x0), fbox.y0 + (gy / GY) * (fbox.y1 - fbox.y0));
          ids.push(frontCaps.v(x, yv, z, hit[0] / front.w, 1 - hit[1] / front.h));
        }
      }
      const row = GX + 1;
      for (let gy = 0; gy < GY; gy++) {
        for (let gx = 0; gx < GX; gx++) {
          const a = ids[gy * row + gx];
          const b = ids[gy * row + gx + 1];
          const c = ids[(gy + 1) * row + gx + 1];
          const d = ids[(gy + 1) * row + gx];
          if (sign > 0) frontCaps.quad(a, b, c, d);
          else frontCaps.quad(a, d, c, b);
        }
      }
    };
    const paintSide = (i: number, sign: number) => {
      const x = (i / (N - 1) - 0.5) * length;
      const dir = i === 0 ? 1 : -1;
      const span = Math.max(4, Math.round(Math.max(thick, 0.2) * rho));
      const y0 = topNear(i);
      const y1 = Math.max(y0 + 2, botNear(i));
      const px0 = Math.max(0, Math.min(side.w - 1, cols[i] + dir * 3));
      const px1 = Math.max(0, Math.min(side.w - 1, px0 + dir * span));
      const uv = (px: number, py: number) => pixUV(side, px, py);
      const ua = uv(px0, y0);
      const ub = uv(px0, y1);
      const uc = uv(px1, y1);
      const ud = uv(px1, y0);
      const a = sideCaps.v(x, topY[i], thick / 2, ua[0], ua[1]);
      const b = sideCaps.v(x, botY[i], thick / 2, ub[0], ub[1]);
      const c = sideCaps.v(x, botY[i], -thick / 2, uc[0], uc[1]);
      const d = sideCaps.v(x, topY[i], -thick / 2, ud[0], ud[1]);
      if (sign > 0) sideCaps.quad(a, b, c, d);
      else sideCaps.quad(a, d, c, b);
    };
    const capOf = (i: number, sign: number) => {
      const frontHere = (mouth === "start" && i === 0) || (mouth === "end" && i === N - 1);
      if (frontHere) paintFront(i, sign);
      else paintSide(i, sign);
    };
    capOf(0, -1);
    capOf(N - 1, 1);
    g.add(frontCaps.mesh(frontMap));
    g.add(sideCaps.mesh(sideMap));
    return { g, thick, low: Math.min(...botY), high: Math.max(...topY) };
  };

  const portBlobs = blobs(maskOf(port, 16), port.w, port.h, 400);
  const hullBlob = portBlobs[0];
  const dorsal = portBlobs
    .filter((b) => {
      if (b === hullBlob) return false;
      const col = column(portM, port.w, port.h, b.cx);
      return !!col && b.cy < col.topY + 4;
    })
    .sort((a, b) => b.n - a.n)[0];

  const placePrism = (
    side: Pix,
    front: Pix,
    sideMap: THREE.Texture,
    frontMap: THREE.Texture,
    length: number,
    x: number,
    y: number,
    z: number,
    rotX = 0,
    mouth: "start" | "end" | "none" = "none",
  ) => {
    const built = addPrism(side, front, length, sideMap, frontMap, mouth);
    built.g.position.set(x, y, z);
    built.g.rotation.x = rotX;
    root.add(built.g);
    return built;
  };

  const topParts = blobs(maskOf(topMeasure, 16), topMeasure.w, topMeasure.h, 800).slice(1);
  topParts.forEach((b) => {
    const u = (b.cx - topMeasureBox.x0) / Math.max(1, topMeasureBox.x1 - topMeasureBox.x0);
    const length = Math.max(6, (b.x1 - b.x0) * measureScale);
    const i = Math.max(0, Math.min(NU - 1, Math.round(u * (NU - 1))));
    const y = (hullTop[i] + hullBot[i]) * 0.5;
    const z = (b.cy - measureCenter) * measureScale;
    placePrism(nacelle, nacelleFront, nacelleMap, nacelleFrontMap, length, (u - 0.5) * LEN, y, z, 0, "start");
    const outward = Math.sign(z) || 1;
    const hullZ = outward > 0 ? beamPort[i] : -beamStbd[i];
    const gap = z - hullZ;
    const span = Math.abs(gap) + 0.35;
    const pBox = boxOf(pylon);
    const aspect = Math.max(1.2, (pBox.y1 - pBox.y0) / Math.max(1, pBox.x1 - pBox.x0));
    const arm = addPrism(pylon, pylon, span / aspect, pylonMap, pylonMap, "none");
    const dir = gap >= 0 ? 1 : -1;
    arm.g.rotation.x = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    const midLocal = (arm.high + arm.low) * 0.5;
    arm.g.position.set((u - 0.5) * LEN, y, (hullZ + z) * 0.5 - midLocal * dir);
    root.add(arm.g);
  });

  if (dorsal) {
    const u = (dorsal.cx - portBox.x0) / Math.max(1, portBox.x1 - portBox.x0);
    const length = Math.max(4, (dorsal.x1 - dorsal.x0) * portScale);
    const i = Math.max(0, Math.min(NU - 1, Math.round(u * (NU - 1))));
    const built = placePrism(turret, turretFront, turretMap, turretFrontMap, length, (u - 0.5) * LEN, 0, 0, 0, "end");
    built.g.position.y = hullTop[i] - built.low;
  }

  const darkFrac = (b: Blob) => {
    let dark = 0;
    let n = 0;
    for (let y = b.y0; y <= b.y1; y += 2) {
      for (let x = b.x0; x <= b.x1; x += 2) {
        n++;
        if (lumAt(bellyMeasure, y * bellyMeasure.w + x) < 18) dark++;
      }
    }
    return n ? dark / n : 0;
  };
  const bellyMeasureBox = contentBox(largestMask(maskOf(bellyMeasure, 16), bellyMeasure.w, bellyMeasure.h), bellyMeasure.w, bellyMeasure.h);
  const bellyParts = blobs(maskOf(bellyMeasure, 16), bellyMeasure.w, bellyMeasure.h, 800).slice(1);
  const scored = bellyParts.map((b) => ({ b, d: darkFrac(b) })).sort((a, c) => c.d - a.d);
  const ventral = scored.length && scored[0].d > scored[scored.length - 1].d + 0.08 ? scored[0].b : undefined;
  if (ventral) {
    const bellyScale = LEN / Math.max(8, bellyMeasureBox.x1 - bellyMeasureBox.x0);
    const u = (ventral.cx - bellyMeasureBox.x0) / Math.max(1, bellyMeasureBox.x1 - bellyMeasureBox.x0);
    const i = Math.max(0, Math.min(NU - 1, Math.round(u * (NU - 1))));
    const length = Math.max(4, (ventral.x1 - ventral.x0) * bellyScale);
    const bellyMid = (bellyMeasureBox.y0 + bellyMeasureBox.y1) / 2;
    const z = (ventral.cy - bellyMid) * bellyScale;
    const built = placePrism(turret, turretFront, turretMap, turretFrontMap, length, (u - 0.5) * LEN, 0, z, Math.PI, "end");
    let surfaceY = hullBot[i];
    let bestD = 1e9;
    for (const p of P[i]) {
      if (p.sy > 0.5) continue;
      const d = Math.abs(p.z - z);
      if (d < bestD) {
        bestD = d;
        surfaceY = p.y;
      }
    }
    built.g.position.y = surfaceY + built.low;
  }

  let bridgeZ = -Math.max(1.5, beamStbd[Math.round(bridgeU * (NU - 1))] * 0.28);
  {
    let sy = 0;
    let n = 0;
    const span = Math.max(1, topMeasureBox.x1 - topMeasureBox.x0);
    const u0 = bridgeU - 0.1;
    const u1 = bridgeU + 0.16;
    for (let y = topMeasureBox.y0; y <= topMeasureBox.y1; y += 2) {
      for (let x = topMeasureBox.x0; x <= topMeasureBox.x1; x += 2) {
        const u = (x - topMeasureBox.x0) / span;
        if (u < u0 || u > u1) continue;
        if (lumAt(topMeasure, y * topMeasure.w + x) < 200) continue;
        sy += y;
        n++;
      }
    }
    if (n > 8) bridgeZ = (sy / n - measureCenter) * measureScale;
  }
  const bi = Math.max(0, Math.min(NU - 1, Math.round(bridgeU * (NU - 1))));
  const tower = addPrism(bridge, bridgeFront, 1, bridgeMap, bridgeFrontMap, "end");
  const towerH = Math.max(0.2, tower.high - tower.low);
  const towerScale = Math.max(4, bridgeH) / towerH;
  tower.g.scale.setScalar(towerScale);
  tower.g.position.set((bridgeU - 0.5) * LEN, hullTop[bi] - tower.low * towerScale, bridgeZ);
  root.add(tower.g);

  root.position.set(place.x, place.y, place.z);
  root.rotation.y = place.yaw;
  scene.add(root);
}

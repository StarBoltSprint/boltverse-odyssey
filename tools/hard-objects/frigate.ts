import * as THREE from "three";

/**
 * Howl-class frigate. Shape is read off Imagine plates:
 * full contours (not a mirrored half-width), port and starboard separately,
 * and a gap in the port plate is left as a hole. Skins are those same plates, unlit.
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
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
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
  const [port, stbd, top, belly, stern, secStern, secShoulder, secMid, secBow, nacelle, nacelleFront, turret, turretFront, bridge, bridgeFront, pylon, hangar] =
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
  const pylonFrontMap = skinTex("/biome/frigate/pylon.jpg");
  const hangarMap = skinTex("/biome/frigate/hangar.jpg");

  const portM = largestMask(maskOf(port, 16), port.w, port.h);
  const stbdM = largestMask(maskOf(stbd, 16), stbd.w, stbd.h);
  const topM = largestMask(maskOf(top, 16), top.w, top.h);
  const bellyM = largestMask(maskOf(belly, 16), belly.w, belly.h);
  const portBox = contentBox(portM, port.w, port.h);
  const stbdBox = contentBox(stbdM, stbd.w, stbd.h);
  const topBox = contentBox(topM, top.w, top.h);
  const bellyBox = contentBox(bellyM, belly.w, belly.h);
  const portScale = LEN / Math.max(8, portBox.x1 - portBox.x0);
  const topScale = LEN / Math.max(8, topBox.x1 - topBox.x0);

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
    const x = topBox.x0 + u * (topBox.x1 - topBox.x0);
    const col = column(topM, top.w, top.h, x);
    if (col) mids.push((col.topY + col.botY) * 0.5);
  }
  mids.sort((a, b) => a - b);
  const centerPx = mids.length ? mids[Math.floor(mids.length / 2)] : (topBox.y0 + topBox.y1) / 2;
  for (let i = 0; i < NU; i++) {
    const u = i / (NU - 1);
    const x = topBox.x0 + u * (topBox.x1 - topBox.x0);
    const col = column(topM, top.w, top.h, x);
    if (!col) {
      beamPort[i] = i ? beamPort[i - 1] : 4;
      beamStbd[i] = i ? beamStbd[i - 1] : 4;
      continue;
    }
    beamStbd[i] = Math.max(0.8, (centerPx - col.topY) * topScale);
    beamPort[i] = Math.max(0.8, (col.botY - centerPx) * topScale);
  }
  smoothKeep(hullTop);
  smoothKeep(hullBot);
  smoothKeep(beamPort);
  smoothKeep(beamStbd);

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
        if (kind === "roof") return planUV(top, topBox, pt.u, pt.z, topScale, centerPx);
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
  const sternUV = (y: number, z: number): UV => {
    const H = Math.max(1e-3, hullTop[0] - hullBot[0]);
    const t = Math.max(0, Math.min(1, (y - hullBot[0]) / H));
    const py = sternBox.y1 - t * (sternBox.y1 - sternBox.y0);
    const half = Math.max(1, (sternBox.x1 - sternBox.x0) * 0.5);
    const mid = (sternBox.x0 + sternBox.x1) * 0.5;
    const reach = Math.max(beamPort[0], beamStbd[0], 0.001);
    const px = mid - (z / reach) * half;
    return pixUV(stern, px, py);
  };

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

  const blues = blobs(blueMask(stern), stern.w, stern.h, 80).slice(0, 4);
  const bells = new Bucket();
  const cores = new Bucket();
  const xSurf = P[0][0].x;
  for (const e of blues) {
    const H = Math.max(1e-3, hullTop[0] - hullBot[0]);
    const t = (sternBox.y1 - e.cy) / Math.max(1, sternBox.y1 - sternBox.y0);
    const y = hullBot[0] + Math.max(0, Math.min(1, t)) * H;
    const reach = Math.max(beamPort[0], beamStbd[0]);
    const half = Math.max(1, (sternBox.x1 - sternBox.x0) * 0.5);
    const mid = (sternBox.x0 + sternBox.x1) * 0.5;
    const z = -((e.cx - mid) / half) * reach;
    const r = Math.max(0.7, ((e.x1 - e.x0) * 0.5 / half) * reach);
    const SEG = 16;
    const len = Math.max(2.2, r * 2);
    const ring = (bucket: Bucket, x: number, rad: number) => {
      const ids: number[] = [];
      for (let s = 0; s < SEG; s++) {
        const a = (s / SEG) * Math.PI * 2;
        const yy = y + Math.cos(a) * rad;
        const zz = z + Math.sin(a) * rad;
        const uv = sternUV(yy, zz);
        ids.push(bucket.v(x, yy, zz, uv[0], uv[1]));
      }
      return ids;
    };
    const sew = (A: number[], B: number[]) => {
      for (let s = 0; s < SEG; s++) {
        const s2 = (s + 1) % SEG;
        bells.quad(A[s], A[s2], B[s2], B[s]);
      }
    };
    const outer = ring(bells, xSurf - len, r * 1.25);
    const mouth = ring(bells, xSurf - len * 0.15, r * 0.92);
    sew(outer, mouth);
    const lip = ring(cores, xSurf - len - 0.05, r * 0.55);
    const cuv = sternUV(y, z);
    const gc = cores.v(xSurf - len - 0.05, y, z, cuv[0], cuv[1]);
    for (let s = 0; s < SEG; s++) cores.tri(gc, lip[s], lip[(s + 1) % SEG]);
  }

  const root = new THREE.Group();
  root.add(buckets.port.mesh(portMap));
  root.add(buckets.stbd.mesh(stbdMap));
  root.add(buckets.roof.mesh(topMap));
  root.add(buckets.belly.mesh(bellyMap));
  root.add(buckets.stern.mesh(sternMap));
  root.add(buckets.bow.mesh(portMap));
  root.add(bells.mesh(sternMap));
  root.add(cores.mesh(sternMap));

  const depth = Math.max(6, (beamPort[Math.floor(NU * 0.5)] || 8) * 0.55);
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
  const face = (bucket: Bucket, A: V3, B: V3, C: V3, D: V3, mapFull: boolean, edge?: UV) => {
    const uv = (k: number): UV => {
      if (!mapFull && edge) return edge;
      return [k === 1 || k === 2 ? 1 : 0, k === 2 || k === 3 ? 1 : 0];
    };
    const ia = bucket.v(A.x, A.y, A.z, uv(0)[0], uv(0)[1]);
    const ib = bucket.v(B.x, B.y, B.z, uv(1)[0], uv(1)[1]);
    const ic = bucket.v(C.x, C.y, C.z, uv(2)[0], uv(2)[1]);
    const idd = bucket.v(D.x, D.y, D.z, uv(3)[0], uv(3)[1]);
    bucket.quad(ia, ib, ic, idd);
  };
  face(hang, iUL, iUR, iLR, iLL, true);
  face(hang, hLL, hLR, iLR, iLL, true);
  face(hang, hUL, iUL, iUR, hUR, true);
  face(hang, hUL, hLL, iLL, iUL, true);
  face(hang, hUR, iUR, iLR, hLR, true);
  const edgeUV = sideUV(port, portBox, portImgTop, portImgBot, (holeU0 + holeU1) / 2, (holeS0 + holeS1) / 2);
  face(rim, hUL, hUR, iUR, iUL, false, edgeUV);
  face(rim, hLL, iLL, iLR, hLR, false, edgeUV);
  face(rim, hUL, iUL, iLL, hLL, false, edgeUV);
  face(rim, hUR, hLR, iLR, iUR, false, edgeUV);
  root.add(hang.mesh(hangarMap));
  root.add(rim.mesh(portMap));

  const boxOf = (p: Pix) => {
    const m = maskOf(p, 16);
    return contentBox(m, p.w, p.h);
  };

  const addPrism = (side: Pix, front: Pix, length: number, sideMap: THREE.Texture, frontMap: THREE.Texture) => {
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
    for (let i = 0; i < N - 1; i++) {
      const u0 = i / (N - 1);
      const u1 = (i + 1) / (N - 1);
      const x0 = (u0 - 0.5) * length;
      const x1 = (u1 - 0.5) * length;
      const uv0 = pixUV(side, cols[i], pxT[i] < 0 ? ref : pxT[i]);
      const uv1 = pixUV(side, cols[i + 1], pxT[i + 1] < 0 ? ref : pxT[i + 1]);
      const a = body.v(x0, topY[i], thick / 2, uv0[0], uv0[1]);
      const b = body.v(x1, topY[i + 1], thick / 2, uv1[0], uv1[1]);
      const c = body.v(x1, topY[i + 1], -thick / 2, uv1[0], uv1[1]);
      const d = body.v(x0, topY[i], -thick / 2, uv0[0], uv0[1]);
      body.quad(a, b, c, d);
      const uvb0 = pixUV(side, cols[i], pxB[i] < 0 ? ref : pxB[i]);
      const uvb1 = pixUV(side, cols[i + 1], pxB[i + 1] < 0 ? ref : pxB[i + 1]);
      const e = body.v(x0, botY[i], thick / 2, uvb0[0], uvb0[1]);
      const f = body.v(x0, botY[i], -thick / 2, uvb0[0], uvb0[1]);
      const g = body.v(x1, botY[i + 1], -thick / 2, uvb1[0], uvb1[1]);
      const hh = body.v(x1, botY[i + 1], thick / 2, uvb1[0], uvb1[1]);
      body.quad(e, f, g, hh);
    }
    const g = new THREE.Group();
    g.add(body.mesh(sideMap));
    const caps = new Bucket();
    const fu0 = fbox.x0 / front.w;
    const fu1 = fbox.x1 / front.w;
    const fv1 = 1 - fbox.y0 / front.h;
    const fv0 = 1 - fbox.y1 / front.h;
    const paintCap = (i: number, sign: number) => {
      const x = (i / (N - 1) - 0.5) * length;
      const a = caps.v(x, topY[i], thick / 2, fu0, fv1);
      const b = caps.v(x, botY[i], thick / 2, fu0, fv0);
      const c = caps.v(x, botY[i], -thick / 2, fu1, fv0);
      const d = caps.v(x, topY[i], -thick / 2, fu1, fv1);
      if (sign > 0) caps.quad(a, b, c, d);
      else caps.quad(a, d, c, b);
    };
    paintCap(0, -1);
    paintCap(N - 1, 1);
    g.add(caps.mesh(frontMap));
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
  ) => {
    const built = addPrism(side, front, length, sideMap, frontMap);
    built.g.position.set(x, y, z);
    built.g.rotation.x = rotX;
    root.add(built.g);
    return built;
  };

  const topParts = blobs(maskOf(top, 16), top.w, top.h, 800).slice(1);
  topParts.forEach((b) => {
    const u = (b.cx - topBox.x0) / Math.max(1, topBox.x1 - topBox.x0);
    const length = Math.max(6, (b.x1 - b.x0) * topScale);
    const i = Math.max(0, Math.min(NU - 1, Math.round(u * (NU - 1))));
    const y = (hullTop[i] + hullBot[i]) * 0.5;
    const z = (b.cy - centerPx) * topScale;
    const built = placePrism(nacelle, nacelleFront, nacelleMap, nacelleFrontMap, length, (u - 0.5) * LEN, y, z);
    const outward = Math.sign(z) || 1;
    const hullZ = outward > 0 ? beamPort[i] : -beamStbd[i];
    const gap = Math.abs(z - hullZ);
    const span = Math.max(1.2, gap - built.thick * 0.4);
    const arm = addPrism(pylon, pylon, 1, pylonMap, pylonFrontMap);
    const long = Math.max(0.2, arm.high - arm.low);
    arm.g.scale.setScalar(span / long);
    arm.g.rotation.x = Math.PI / 2;
    arm.g.position.set((u - 0.5) * LEN, y, (hullZ + z) / 2);
    root.add(arm.g);
  });

  if (dorsal) {
    const u = (dorsal.cx - portBox.x0) / Math.max(1, portBox.x1 - portBox.x0);
    const length = Math.max(4, (dorsal.x1 - dorsal.x0) * portScale);
    const i = Math.max(0, Math.min(NU - 1, Math.round(u * (NU - 1))));
    const built = placePrism(turret, turretFront, turretMap, turretFrontMap, length, (u - 0.5) * LEN, 0, 0);
    built.g.position.y = hullTop[i] - built.low;
  }

  const darkFrac = (b: Blob) => {
    let dark = 0;
    let n = 0;
    for (let y = b.y0; y <= b.y1; y += 2) {
      for (let x = b.x0; x <= b.x1; x += 2) {
        n++;
        if (lumAt(belly, y * belly.w + x) < 18) dark++;
      }
    }
    return n ? dark / n : 0;
  };
  const bellyParts = blobs(maskOf(belly, 16), belly.w, belly.h, 800).slice(1);
  const scored = bellyParts.map((b) => ({ b, d: darkFrac(b) })).sort((a, c) => c.d - a.d);
  const ventral = scored.length && scored[0].d > scored[scored.length - 1].d + 0.08 ? scored[0].b : undefined;
  if (ventral) {
    const bellyScale = LEN / Math.max(8, bellyBox.x1 - bellyBox.x0);
    const u = (ventral.cx - bellyBox.x0) / Math.max(1, bellyBox.x1 - bellyBox.x0);
    const i = Math.max(0, Math.min(NU - 1, Math.round(u * (NU - 1))));
    const length = Math.max(4, (ventral.x1 - ventral.x0) * bellyScale);
    const bellyMid = (bellyBox.y0 + bellyBox.y1) / 2;
    const z = (ventral.cy - bellyMid) * bellyScale;
    const built = placePrism(turret, turretFront, turretMap, turretFrontMap, length, (u - 0.5) * LEN, 0, z, Math.PI);
    built.g.position.y = hullBot[i] + built.low;
  }

  let bridgeZ = -Math.max(1.5, beamStbd[Math.round(bridgeU * (NU - 1))] * 0.28);
  {
    let sy = 0;
    let n = 0;
    const span = Math.max(1, topBox.x1 - topBox.x0);
    const u0 = bridgeU - 0.1;
    const u1 = bridgeU + 0.16;
    for (let y = topBox.y0; y <= topBox.y1; y += 2) {
      for (let x = topBox.x0; x <= topBox.x1; x += 2) {
        const u = (x - topBox.x0) / span;
        if (u < u0 || u > u1) continue;
        if (lumAt(top, y * top.w + x) < 200) continue;
        sy += y;
        n++;
      }
    }
    if (n > 8) bridgeZ = (sy / n - centerPx) * topScale;
  }
  const bi = Math.max(0, Math.min(NU - 1, Math.round(bridgeU * (NU - 1))));
  const tower = addPrism(bridge, bridgeFront, 1, bridgeMap, bridgeFrontMap);
  const towerH = Math.max(0.2, tower.high - tower.low);
  const towerScale = Math.max(4, bridgeH) / towerH;
  tower.g.scale.setScalar(towerScale);
  tower.g.position.set((bridgeU - 0.5) * LEN, hullTop[bi] - tower.low * towerScale, bridgeZ);
  root.add(tower.g);

  root.position.set(place.x, place.y, place.z);
  root.rotation.y = place.yaw;
  scene.add(root);
}

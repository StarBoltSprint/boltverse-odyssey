// Motion-compensated flicker. Reproject frame A into frame B with the
// camera matrices and the depth, then take the mean absolute luma residual.
// Disocclusions, the Bolt card, and non-spire pixels are left out.
// A stable texture that only slides with the camera lands near zero.
// A pattern that changes on its own does not.

export const SPIRE = new Set([1, 2, 6, 7]);

export function lumaOf(r, g, b) {
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

function mulPoint(m, x, y, z, w) {
  const X = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
  const Y = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
  const Z = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
  const W = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
  return [X, Y, Z, W];
}

function unproject(ivp, x, y, zNdc, W, H) {
  const ndcX = ((x + 0.5) / W) * 2 - 1;
  const ndcY = 1 - ((y + 0.5) / H) * 2;
  const p = mulPoint(ivp, ndcX, ndcY, zNdc, 1);
  const w = p[3] || 1;
  return [p[0] / w, p[1] / w, p[2] / w];
}

function project(vp, world, W, H) {
  const c = mulPoint(vp, world[0], world[1], world[2], 1);
  if (!(c[3] > 0.05)) return null;
  const sx = (c[0] / c[3] * 0.5 + 0.5) * W;
  const sy = (1 - (c[1] / c[3] * 0.5 + 0.5)) * H;
  return [sx, sy];
}

function worldOnRay(ivp, cam, x, y, dist, W, H) {
  const far = unproject(ivp, x, y, 1, W, H);
  let dx = far[0] - cam[0];
  let dy = far[1] - cam[1];
  let dz = far[2] - cam[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  dx /= len; dy /= len; dz /= len;
  return [cam[0] + dx * dist, cam[1] + dy * dist, cam[2] + dz * dist];
}

function inRect(rect, x, y) {
  if (!rect) return false;
  return x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1;
}

function sampleLuma(src, bpr, x, y, W, H) {
  // Pixel (i, j) is the sample at continuous coordinate (i + 0.5, j + 0.5).
  const sx = x - 0.5;
  const sy = y - 0.5;
  if (sx < 0 || sy < 0 || sx >= W - 1 || sy >= H - 1) return null;
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const fx = sx - x0;
  const fy = sy - y0;
  const at = (px, py) => {
    const i = py * bpr + px * 4;
    return lumaOf(src[i], src[i + 1], src[i + 2]);
  };
  const a = at(x0, y0);
  const b = at(x0 + 1, y0);
  const c = at(x0, y0 + 1);
  const d = at(x0 + 1, y0 + 1);
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

// Glacier frames. geo stores material in R and distance/4000 in G.
export function glacierResidual(frameA, frameB, opts = {}) {
  const W = opts.W || 720;
  const H = opts.H || 1280;
  const bpr = opts.bpr || (Math.ceil(W * 4 / 256) * 256);
  const tol = opts.depthTol == null ? 0.08 : opts.depthTol;
  let sum = 0;
  let n = 0;
  let disoccluded = 0;
  const matOf = (src, i) => {
    if (src[i] === 0 && src[i + 1] === 0 && src[i + 2] === 0) return -1;
    return Math.round(src[i] / 255 * 8 - 0.5);
  };
  const distOf = (src, i) => src[i + 1] / 255 * 4000;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (inRect(frameB.bolt, x, y)) continue;
      const i = y * bpr + x * 4;
      const mb = matOf(frameB.geo, i);
      const db = distOf(frameB.geo, i);
      if (!SPIRE.has(mb) || db < 100 || db > 300) continue;
      const stride = bpr / 4;
      const zNdc = frameB.depth ? frameB.depth[y * stride + x] : 1;
      const world = frameB.depth
        ? unproject(frameB.ivp, x, y, zNdc, W, H)
        : worldOnRay(frameB.ivp, frameB.cam, x, y, db, W, H);
      const src = project(frameA.vp, world, W, H);
      if (!src) { disoccluded++; continue; }
      const sx = src[0];
      const sy = src[1];
      if (sx < 1 || sy < 1 || sx >= W - 2 || sy >= H - 2) { disoccluded++; continue; }
      if (inRect(frameA.bolt, sx, sy)) { disoccluded++; continue; }
      const ix = Math.round(sx);
      const iy = Math.round(sy);
      const j = iy * bpr + ix * 4;
      const ma = matOf(frameA.geo, j);
      const da = distOf(frameA.geo, j);
      let occluded = false;
      if (frameA.depth && frameB.depth) {
        const clip = mulPoint(frameA.vp, world[0], world[1], world[2], 1);
        const zExpect = clip[3] > 0.05 ? clip[2] / clip[3] : 1;
        occluded = Math.abs(frameA.depth[iy * stride + ix] - zExpect) > 0.004;
      } else {
        const expect = Math.hypot(world[0] - frameA.cam[0], world[1] - frameA.cam[1], world[2] - frameA.cam[2]);
        occluded = Math.abs(da - expect) > Math.max(24, expect * tol);
      }
      if (!SPIRE.has(ma) || da < 100 || da > 300 || occluded) {
        disoccluded++;
        continue;
      }
      const lb = lumaOf(frameB.colour[i], frameB.colour[i + 1], frameB.colour[i + 2]);
      const la = sampleLuma(frameA.colour, bpr, sx, sy, W, H);
      if (la == null) { disoccluded++; continue; }
      sum += Math.abs(lb - la);
      n++;
    }
  }
  return { mean: n ? sum / n : null, n, disoccluded };
}

// Generic buffers for the fixtures. depth is metres, 0 means empty.
// mask(x, y) true means the pixel is in the measured set.
export function bufferResidual(spec) {
  const { W, H, lumaA, lumaB, depthA, depthB, ivpB, vpA, camA, camB } = spec;
  const tol = spec.depthTol == null ? 0.08 : spec.depthTol;
  const mask = spec.mask || (() => true);
  let sum = 0;
  let n = 0;
  let disoccluded = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const db = depthB[y * W + x];
      if (!(db > 0) || !mask(x, y, db)) continue;
      const world = worldOnRay(ivpB, camB, x, y, db, W, H);
      const src = project(vpA, world, W, H);
      if (!src) { disoccluded++; continue; }
      const sx = src[0];
      const sy = src[1];
      if (sx < 1 || sy < 1 || sx >= W - 2 || sy >= H - 2) { disoccluded++; continue; }
      const ix = Math.round(sx);
      const iy = Math.round(sy);
      const da = depthA[iy * W + ix];
      const expect = Math.hypot(world[0] - camA[0], world[1] - camA[1], world[2] - camA[2]);
      if (!(da > 0) || Math.abs(da - expect) > Math.max(0.5, expect * tol)) {
        disoccluded++;
        continue;
      }
      const px = sx - 0.5;
      const py = sy - 0.5;
      const x0 = Math.floor(px);
      const y0 = Math.floor(py);
      const fx = px - x0;
      const fy = py - y0;
      const at = (qx, qy) => lumaA[qy * W + qx];
      const la = at(x0, y0) * (1 - fx) * (1 - fy) + at(x0 + 1, y0) * fx * (1 - fy)
        + at(x0, y0 + 1) * (1 - fx) * fy + at(x0 + 1, y0 + 1) * fx * fy;
      sum += Math.abs(lumaB[y * W + x] - la);
      n++;
    }
  }
  return { mean: n ? sum / n : null, n, disoccluded };
}

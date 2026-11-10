// Reusable unit sphere for a world-fixed planet. The page supplies the surface map.
// Stride 6 floats: position xyz, normal xyz (the same on a unit sphere).

export function createPlanetMesh(stacks = 32, slices = 56) {
  const f = [];
  const sph = (lat, lon) => {
    const y = Math.cos(lat);
    const s = Math.sin(lat);
    return [s * Math.sin(lon), y, s * Math.cos(lon)];
  };
  const push = (p) => f.push(p[0], p[1], p[2], p[0], p[1], p[2]);
  for (let i = 0; i < stacks; i++) {
    const p0 = Math.PI * i / stacks;
    const p1 = Math.PI * (i + 1) / stacks;
    for (let j = 0; j < slices; j++) {
      const u0 = Math.PI * 2 * j / slices;
      const u1 = Math.PI * 2 * (j + 1) / slices;
      const a = sph(p0, u0), b = sph(p0, u1), c = sph(p1, u1), d = sph(p1, u0);
      push(a); push(d); push(b);
      push(b); push(d); push(c);
    }
  }
  return new Float32Array(f);
}

// The supplied map is not a closed wrap. Blend each edge toward the other
// so longitude 0 and 1 meet. Poles of this plate are pale, low-detail bands:
// flatten those rows to their own average so the pinch does not sparkle.
export function prepareSurfaceRGBA(data, w, h, band = 56, poleRows = 4) {
  const out = new Uint8ClampedArray(data);
  const blend = (ia, ib, t) => {
    for (let k = 0; k < 3; k++) out[ia + k] = data[ia + k] * t + data[ib + k] * (1 - t);
  };
  for (let y = 0; y < h; y++) {
    for (let i = 0; i < band; i++) {
      const t = 0.5 + 0.5 * (i / band);
      const L = (y * w + i) * 4;
      const R = (y * w + (w - 1 - i)) * 4;
      blend(L, R, t);
      blend(R, L, t);
    }
  }
  const meanRow = (y0, y1) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      r += out[i]; g += out[i + 1]; b += out[i + 2]; n++;
    }
    return [r / n, g / n, b / n];
  };
  const paint = (y0, y1, col) => {
    for (let y = y0; y < y1; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      out[i] = col[0]; out[i + 1] = col[1]; out[i + 2] = col[2];
    }
  };
  paint(0, poleRows, meanRow(0, poleRows));
  paint(h - poleRows, h, meanRow(h - poleRows, h));
  return out;
}

// Yaw that puts the map's centre (away from the seam) on the face toward the camera.
export function frontYaw(dir) {
  const nx = -dir[0], nz = -dir[2];
  const u = Math.atan2(nx, nz) / (Math.PI * 2) + 0.5;
  return (0.5 - u) * Math.PI * 2;
}

export function planetCenter(dir, distance) {
  const l = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  return [dir[0] / l * distance, dir[1] / l * distance, dir[2] / l * distance];
}

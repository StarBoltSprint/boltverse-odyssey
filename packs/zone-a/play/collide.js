/**
 * Walls taken from ruin mesh edges. A hole with no edge stays open.
 * The mesh is the only shape. No circle around an object.
 */

const CELL = 4;
const BODY_R = 0.55;

function worldOf(x, y, z, src) {
  const s = Math.sin(src.yaw);
  const c = Math.cos(src.yaw);
  let wx;
  let wz;
  if (src.frame >= 0.5) {
    wx = src.x + x * s - z * c;
    wz = src.z + x * c + z * s;
  } else {
    wx = src.x + x * c + z * s;
    wz = src.z - x * s + z * c;
  }
  return [wx, src.y + y, wz];
}

function keyOf(ix, iz) {
  return (ix + 4096) * 8192 + (iz + 4096);
}

export function buildWalls(sources) {
  const segs = [];
  const seen = new Map();
  for (let s = 0; s < sources.length; s++) {
    const src = sources[s];
    const groups = src.groups || [];
    for (let g = 0; g < groups.length; g++) {
      const xyz = groups[g].xyzuv;
      const idx = groups[g].idx;
      for (let i = 0; i < idx.length; i += 3) {
        const ia = idx[i] * 5;
        const ib = idx[i + 1] * 5;
        const ic = idx[i + 2] * 5;
        const tri = [
          worldOf(xyz[ia], xyz[ia + 1], xyz[ia + 2], src),
          worldOf(xyz[ib], xyz[ib + 1], xyz[ib + 2], src),
          worldOf(xyz[ic], xyz[ic + 1], xyz[ic + 2], src),
        ];
        const us = [xyz[ia + 3], xyz[ib + 3], xyz[ic + 3]];
        const meanU = (us[0] + us[1] + us[2]) / 3;
        const near = src.splitU != null && meanU >= src.splitU;
        const tex = near ? src.nearTexels : src.texels;
        const kind = src.splitU == null ? "hull" : (near ? "near" : "front");
        for (let e = 0; e < 3; e++) {
          const a = tri[e];
          const b = tri[(e + 1) % 3];
          const dx = b[0] - a[0];
          const dz = b[2] - a[2];
          const len = Math.hypot(dx, dz);
          if (len < 0.08) continue;
          const ax = Math.round(a[0] * 25);
          const ay = Math.round(a[1] * 25);
          const az = Math.round(a[2] * 25);
          const bx = Math.round(b[0] * 25);
          const by = Math.round(b[1] * 25);
          const bz = Math.round(b[2] * 25);
          let k0 = ax + "," + ay + "," + az + "|" + bx + "," + by + "," + bz;
          let k1 = bx + "," + by + "," + bz + "|" + ax + "," + ay + "," + az;
          if (seen.has(k0) || seen.has(k1)) continue;
          seen.set(k0, 1);
          segs.push({
            x0: a[0], y0: a[1], z0: a[2],
            x1: b[0], y1: b[1], z1: b[2],
            len,
            tex,
            id: src.id,
            kind,
          });
        }
      }
    }
  }
  seen.clear();
  const grid = new Map();
  const scratch = new Uint32Array(16384);
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const lo = seg.y0 < seg.y1 ? seg.y0 : seg.y1;
    const hi = seg.y0 > seg.y1 ? seg.y0 : seg.y1;
    // Person-height edges only. Taller edges stay in the magnification list.
    if (hi < -1 || lo > 12) continue;
    const steps = Math.max(1, Math.ceil(seg.len / CELL));
    for (let t = 0; t <= steps; t++) {
      const u = t / steps;
      const x = seg.x0 + (seg.x1 - seg.x0) * u;
      const z = seg.z0 + (seg.z1 - seg.z0) * u;
      const k = keyOf(Math.floor(x / CELL), Math.floor(z / CELL));
      let bucket = grid.get(k);
      if (!bucket) {
        bucket = [];
        grid.set(k, bucket);
      }
      bucket.push(i);
    }
  }
  const stamp = new Uint32Array(Math.max(1, segs.length));
  let gen = 1;
  const magOut = { m: 0, which: "", kind: "", dist: 0, texels: 0, front: 0, near: 0, hull: 0 };
  const coarse = [];
  const bin = new Map();
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const mx = (seg.x0 + seg.x1) * 0.5;
    const my = (seg.y0 + seg.y1) * 0.5;
    const mz = (seg.z0 + seg.z1) * 0.5;
    const k = seg.kind + ":" + Math.round(mx / 0.32) + ":" + Math.round(my / 0.32) + ":" + Math.round(mz / 0.32);
    if (bin.has(k)) continue;
    bin.set(k, 1);
    coarse.push(seg);
  }
  bin.clear();

  function query(x, z, rad) {
    if (gen === 0xffffffff) {
      stamp.fill(0);
      gen = 1;
    }
    gen++;
    const mark = gen;
    const reach = rad + CELL;
    const ix0 = Math.floor((x - reach) / CELL);
    const ix1 = Math.floor((x + reach) / CELL);
    const iz0 = Math.floor((z - reach) / CELL);
    const iz1 = Math.floor((z + reach) / CELL);
    let n = 0;
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const bucket = grid.get(keyOf(ix, iz));
        if (!bucket) continue;
        for (let b = 0; b < bucket.length; b++) {
          const id = bucket[b];
          if (stamp[id] === mark) continue;
          stamp[id] = mark;
          if (n < scratch.length) scratch[n++] = id;
        }
      }
    }
    return n;
  }

  function overlaps(seg, y0, y1) {
    const lo = seg.y0 < seg.y1 ? seg.y0 : seg.y1;
    const hi = seg.y0 > seg.y1 ? seg.y0 : seg.y1;
    return hi >= y0 && lo <= y1;
  }

  function separate(x, z, radius, feetY, prevX, prevZ) {
    let cx = x;
    let cz = z;
    const y0 = feetY + 0.05;
    const y1 = feetY + 1.7;
    for (let iter = 0; iter < 6; iter++) {
      let hit = false;
      const n = query(cx, cz, radius + 0.2);
      for (let i = 0; i < n; i++) {
        const seg = segs[scratch[i]];
        if (!overlaps(seg, y0, y1)) continue;
        const dx = seg.x1 - seg.x0;
        const dz = seg.z1 - seg.z0;
        const l2 = dx * dx + dz * dz || 1e-8;
        let t = ((cx - seg.x0) * dx + (cz - seg.z0) * dz) / l2;
        if (t < 0) t = 0;
        else if (t > 1) t = 1;
        const qx = seg.x0 + dx * t;
        const qz = seg.z0 + dz * t;
        let nx = cx - qx;
        let nz = cz - qz;
        let d = Math.hypot(nx, nz);
        if (d >= radius) continue;
        if (d < 1e-4) {
          const len = Math.sqrt(l2);
          nx = -dz / len;
          nz = dx / len;
          if ((prevX - qx) * nx + (prevZ - qz) * nz < 0) {
            nx = -nx;
            nz = -nz;
          }
          d = 0;
        } else {
          nx /= d;
          nz /= d;
        }
        const push = Math.min(radius - d + 0.02, 0.42);
        cx += nx * push;
        cz += nz * push;
        hit = true;
      }
      if (!hit) break;
    }
    return { x: cx, z: cz };
  }

  function move(x, z, px, pz, radius, feetY) {
    const rad = radius || BODY_R;
    const dist = Math.hypot(x - px, z - pz);
    const steps = Math.max(1, Math.ceil(dist / 0.28));
    let cx = px;
    let cz = pz;
    for (let s = 1; s <= steps; s++) {
      const tx = px + (x - px) * (s / steps);
      const tz = pz + (z - pz) * (s / steps);
      const pushed = separate(tx, tz, rad, feetY, cx, cz);
      cx = pushed.x;
      cz = pushed.z;
    }
    const gx = x - px;
    const gz = z - pz;
    const gl2 = gx * gx + gz * gz;
    const along = gl2 < 1e-8 ? 1 : ((cx - px) * gx + (cz - pz) * gz) / gl2;
    return { x: cx, z: cz, blocked: gl2 > 1e-6 && along < 0.22 };
  }

  function boomCap(hx, hz, fx, fz, boom, feetY) {
    const y0 = feetY + 0.3;
    const y1 = feetY + 8;
    const steps = Math.max(1, Math.ceil(boom / 0.35));
    for (let i = 1; i <= steps; i++) {
      const d = Math.min(boom, i * 0.35);
      const x = hx - fx * d;
      const z = hz - fz * d;
      const n = query(x, z, 0.28);
      for (let k = 0; k < n; k++) {
        const seg = segs[scratch[k]];
        if (!overlaps(seg, y0, y1)) continue;
        const dx = seg.x1 - seg.x0;
        const dz = seg.z1 - seg.z0;
        const l2 = dx * dx + dz * dz || 1e-8;
        let t = ((x - seg.x0) * dx + (z - seg.z0) * dz) / l2;
        if (t < 0) t = 0;
        else if (t > 1) t = 1;
        const qx = seg.x0 + dx * t;
        const qz = seg.z0 + dz * t;
        if (Math.hypot(x - qx, z - qz) < 0.24) return Math.max(2.4, d - 0.45);
      }
    }
    return boom;
  }

  function pointDist(ex, ey, ez, seg) {
    const dx = seg.x1 - seg.x0;
    const dy = seg.y1 - seg.y0;
    const dz = seg.z1 - seg.z0;
    const l2 = dx * dx + dy * dy + dz * dz || 1e-8;
    let t = ((ex - seg.x0) * dx + (ey - seg.y0) * dy + (ez - seg.z0) * dz) / l2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const qx = seg.x0 + dx * t;
    const qy = seg.y0 + dy * t;
    const qz = seg.z0 + dz * t;
    return Math.hypot(ex - qx, ey - qy, ez - qz);
  }

  function mag(eye, focal) {
    let best = 0;
    let which = "";
    let kind = "";
    let dist = 0;
    let tex = 0;
    let front = 0;
    let near = 0;
    let hull = 0;
    const ex = eye[0];
    const ey = eye[1];
    const ez = eye[2];
    for (let i = 0; i < coarse.length; i++) {
      const seg = coarse[i];
      const approx = Math.hypot(ex - seg.x0, ez - seg.z0);
      if (approx > 70 && approx - seg.len > 70) continue;
      const d = Math.max(0.08, pointDist(ex, ey, ez, seg));
      const mm = focal / (seg.tex * d);
      if (seg.kind === "front") {
        if (mm > front) front = mm;
      } else if (seg.kind === "near") {
        if (mm > near) near = mm;
      } else if (mm > hull) hull = mm;
      if (mm > best) {
        best = mm;
        which = seg.id;
        kind = seg.kind;
        dist = d;
        tex = seg.tex;
      }
    }
    magOut.m = best;
    magOut.which = which;
    magOut.kind = kind;
    magOut.dist = dist;
    magOut.texels = tex;
    magOut.front = front;
    magOut.near = near;
    magOut.hull = hull;
    return magOut;
  }

  return { move, boomCap, mag, count: segs.length, magCount: coarse.length };
}

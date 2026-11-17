// Screen probes for the follow camera. Bases and open snow, in world metres.
import { pathX, wallPoint } from './world.js';

function objectDist(x, z, world) {
  let best = 1e9;
  for (const dz of [0, -4, 4, -8, 8]) {
    for (const side of [-1, 1]) {
      const w = wallPoint(z + dz, side, 0);
      const d = Math.hypot(w[0] - x, w[2] - (z + dz));
      if (d < best) best = d;
    }
  }
  const inst = world.instances;
  if (inst) {
    for (const key of ['drift', 'chunk', 'icicle']) {
      const data = inst[key].data;
      for (let i = 0; i < data.length; i += 8) {
        const d = Math.hypot(data[i] - x, data[i + 2] - z);
        if (d < best) best = d;
      }
    }
  }
  return best;
}

export function contactProbes(world, project, eye, W, H, boltPx) {
  const verts = world.verts;
  const heightAt = world.heightAt;
  const clusters = new Map();
  const maxD = 85;
  for (let t = 0; t + 24 <= verts.length; t += 24) {
    const mat = Math.round(verts[t + 3]);
    if (mat !== 6 && mat !== 1 && mat !== 7) continue;
    const y0 = verts[t + 1];
    const y1 = verts[t + 9];
    const y2 = verts[t + 17];
    let li = 0;
    if (y1 < (li === 0 ? y0 : y1)) li = 1;
    if (y2 < [y0, y1, y2][li]) li = 2;
    const minY = li === 0 ? y0 : li === 1 ? y1 : y2;
    const bx = verts[t + li * 8];
    const bz = verts[t + li * 8 + 2];
    const nx = verts[t + 4];
    const ny = verts[t + 5];
    const nz = verts[t + 6];
    if (ny > 0.62) continue;
    const horiz = Math.hypot(nx, nz);
    if (horiz < 0.35) continue;
    const floor = heightAt(bx, bz);
    if (minY > floor + 0.85) continue;
    const dx = bx - eye[0];
    const dz = bz - eye[2];
    if (dx * dx + dz * dz > maxD * maxD) continue;
    const dirx = nx / horiz;
    const dirz = nz / horiz;
    const p05 = [bx + dirx * 0.45, 0, bz + dirz * 0.45];
    p05[1] = heightAt(p05[0], p05[2]) + 0.05;
    const p3 = [bx + dirx * 3, 0, bz + dirz * 3];
    p3[1] = heightAt(p3[0], p3[2]) + 0.05;
    const latB = Math.abs(bx - pathX(bz));
    const lat5 = Math.abs(p05[0] - pathX(p05[2]));
    const lat3 = Math.abs(p3[0] - pathX(p3[2]));
    if (!(lat5 < latB - 0.12 && lat3 < lat5 - 1.5)) continue;
    if (objectDist(p3[0], p3[2], world) < 2.4) continue;
    const s5 = project(p05);
    const s3 = project(p3);
    if (!s5 || !s3) continue;
    if (s5[0] < 4 || s5[1] < 4 || s5[0] > W - 4 || s5[1] > H - 4) continue;
    if (s3[0] < 4 || s3[1] < 4 || s3[0] > W - 4 || s3[1] > H - 4) continue;
    if (boltPx && (Math.hypot(s5[0] - boltPx[0], s5[1] - boltPx[1]) < 80 || Math.hypot(s3[0] - boltPx[0], s3[1] - boltPx[1]) < 80)) continue;
    const depth = Math.hypot(p05[0] - eye[0], p05[1] - eye[1], p05[2] - eye[2]);
    const key = Math.round(bx / 2.2) + ':' + Math.round(bz / 2.2);
    const prev = clusters.get(key);
    if (prev && prev.depth <= depth) continue;
    clusters.set(key, {
      mat,
      depth: +depth.toFixed(2),
      p05: [+s5[0].toFixed(1), +s5[1].toFixed(1)],
      p3: [+s3[0].toFixed(1), +s3[1].toFixed(1)],
      w05: [+p05[0].toFixed(2), +p05[2].toFixed(2)],
      w3: [+p3[0].toFixed(2), +p3[2].toFixed(2)],
    });
  }
  return [...clusters.values()].sort((a, b) => a.depth - b.depth).slice(0, 6);
}

export function openProbes(world, live, project, eye, W, H, boltPx) {
  const fx = -Math.sin(live.psi);
  const fz = -Math.cos(live.psi);
  const rx = Math.cos(live.psi);
  const rz = -Math.sin(live.psi);
  const out = [];
  for (const d of [6, 11, 17]) {
    for (const lat of [-2.5, 0, 2.5]) {
      const x = live.x + fx * d + rx * lat;
      const z = live.z + fz * d + rz * lat;
      const dist = objectDist(x, z, world);
      if (dist < 5) continue;
      const y = world.heightAt(x, z) + 0.05;
      const p = project([x, y, z]);
      if (!p || p[0] < 12 || p[1] < 12 || p[0] > W - 12 || p[1] > H - 12) continue;
      if (boltPx && Math.hypot(p[0] - boltPx[0], p[1] - boltPx[1]) < 110) continue;
      const depth = Math.hypot(x - eye[0], y - eye[1], z - eye[2]);
      out.push({
        p: [+p[0].toFixed(1), +p[1].toFixed(1)],
        depth: +depth.toFixed(2),
        clear: +dist.toFixed(2),
      });
    }
  }
  return out;
}

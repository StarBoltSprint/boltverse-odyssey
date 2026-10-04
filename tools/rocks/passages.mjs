/**
 * Walk passages of hard objects. Placement must not drop a collider in one.
 * The quad is the opening. A disc hits when it comes within its radius plus
 * the body radius of that quad. Draws nothing.
 */
import { frameOf, toWorld } from "../playcheck/src/ruinwalk.mjs";

export function passagesFromRuin(manifest) {
  const body = (manifest && manifest.collider && manifest.collider.bodyRadiusM) || 0.3;
  const quads = [];
  for (const obj of (manifest && manifest.objects) || []) {
    if (obj.frame !== "ship" && obj.openingBoxM && obj.bounds) {
      const zFront = obj.bounds.max[2];
      const zBack = obj.bounds.min[2];
      const f = frameOf(obj);
      quads.push({
        id: obj.id,
        kind: "gate",
        pad: body,
        corners: [
          toWorld(f, obj.openingBoxM[0], zFront + 6),
          toWorld(f, obj.openingBoxM[1], zFront + 6),
          toWorld(f, obj.openingBoxM[1], zBack - 1),
          toWorld(f, obj.openingBoxM[0], zBack - 1),
        ],
      });
    }
    if (obj.frame === "ship" && obj.hangar && obj.bounds) {
      const h = obj.hangar;
      const f = frameOf(obj);
      quads.push({
        id: obj.id + "-hangar",
        kind: "hangar",
        pad: body,
        corners: [
          toWorld(f, h.x[0], h.portZ + 8),
          toWorld(f, h.x[1], h.portZ + 8),
          toWorld(f, h.x[1], obj.bounds.min[2]),
          toWorld(f, h.x[0], obj.bounds.min[2]),
        ],
      });
    }
  }
  return quads;
}

export function pointInConvex(x, z, corners) {
  let sign = 0;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    const cross = (b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]);
    if (Math.abs(cross) < 1e-8) continue;
    const s = cross > 0 ? 1 : -1;
    if (!sign) sign = s;
    else if (s !== sign) return false;
  }
  return corners.length >= 3;
}

function distPointSeg(px, pz, ax, az, bx, bz) {
  const vx = bx - ax;
  const vz = bz - az;
  const l2 = vx * vx + vz * vz || 1;
  let t = ((px - ax) * vx + (pz - az) * vz) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}

export function distToQuad(x, z, corners) {
  if (pointInConvex(x, z, corners)) return 0;
  let best = Infinity;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    best = Math.min(best, distPointSeg(x, z, a[0], a[1], b[0], b[1]));
  }
  return best;
}

export function hitsPassage(x, z, radius, passages) {
  if (!passages || !passages.length) return false;
  const r = radius || 0;
  for (const passage of passages) {
    if (distToQuad(x, z, passage.corners) < r + (passage.pad || 0)) return true;
  }
  return false;
}

export function auditRocks(rocks, passages) {
  const hits = [];
  for (const inst of (rocks && rocks.instances) || []) {
    const spec = (rocks.types || {})[inst.type];
    if (!spec || spec.kind !== "hull" || inst.collider === false) continue;
    const sz = spec.objectSize || [1, 1, 1];
    const radius = 0.5 * Math.hypot(sz[0], sz[2]) * (inst.scale || 1);
    for (const passage of passages || []) {
      if (distToQuad(inst.x, inst.z, passage.corners) < radius + (passage.pad || 0)) {
        hits.push({ id: inst.id, type: inst.type, x: inst.x, z: inst.z, radius, passage: passage.id });
        break;
      }
    }
  }
  return hits;
}

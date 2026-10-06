/**
 * Load-time placement. A seed scatters hull rocks and reseats the three
 * zone A lofts along one straight corridor. Nothing is drawn here.
 */

export const RUN_YAW = Math.PI / 2;
const BODY_R = 0.3;

const ROCK = {
  boulder: { size: [1.55, 1.35, 1.45], scale: [0.92, 1] },
  stone: { size: [0.54, 0.95, 0.5], scale: [0.62, 1] },
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function footprint(type, scale) {
  const size = ROCK[type].size;
  return 0.5 * Math.hypot(size[0], size[2]) * scale;
}

/**
 * Local metres of a world point in a seated loft.
 * Gate and arch use the ruin frame. The wreck uses the ship frame.
 */
export function localXZ(frame, yaw, seatX, seatZ, x, z) {
  const wx = x - seatX;
  const wz = z - seatZ;
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  if (frame === "ship") {
    return { x: wx * s + wz * c, z: -wx * c + wz * s };
  }
  return { x: wx * c - wz * s, z: wx * s + wz * c };
}

export function pushDiscs(x, z, discs, bodyR) {
  const radius = bodyR == null ? BODY_R : bodyR;
  let cx = x;
  let cz = z;
  let contact = false;
  for (let i = 0; i < discs.length; i++) {
    const d = discs[i];
    const dx = cx - d.x;
    const dz = cz - d.z;
    const dist = Math.hypot(dx, dz);
    const limit = d.r + radius;
    if (dist < 1e-6) {
      cx = d.x + limit;
      contact = true;
      continue;
    }
    if (dist < limit) {
      const s = limit / dist;
      cx = d.x + dx * s;
      cz = d.z + dz * s;
      contact = true;
    }
  }
  return { x: cx, z: cz, contact };
}

function tooClose(along, lateral, taken, monuments) {
  for (let i = 0; i < taken.length; i++) {
    const o = taken[i];
    if (Math.hypot(along - o.along, lateral - o.lateral) < 2.4) return true;
  }
  if (Math.abs(along - monuments.arch) < 6 && Math.abs(lateral) < 4.2) return true;
  if (Math.abs(along - monuments.gate) < 14 && Math.abs(lateral) < 12) return true;
  if (Math.abs(along - monuments.ship) < 18 && lateral > 2 && lateral < 26) return true;
  return false;
}

function rockAt(type, along, lateral, yaw, scale, x0, z) {
  return {
    type,
    x: x0 + along,
    z: z + lateral,
    yaw,
    scale,
    r: footprint(type, scale),
  };
}

/**
 * waypoints are [x, z] on a straight east run. lengthM is that run.
 * The arch and the gate sit on the centre line, yawed so their opening
 * faces the run. The wreck sits off the north shoulder.
 */
export function placeProps({ seed, waypoints, lengthM }) {
  const pts = waypoints || [];
  const x0 = pts.length ? pts[0][0] : 0;
  const z = pts.length ? pts[0][1] : 0;
  const length = Number(lengthM) > 0 ? Number(lengthM) : 0;
  const rand = mulberry32(Number(seed) || 1);
  const archAlong = length * (0.22 + rand() * 0.12);
  const gateAlong = length * (0.62 + rand() * 0.12);
  const shipAlong = length * (0.42 + rand() * 0.1);
  const monuments = { arch: archAlong, gate: gateAlong, ship: shipAlong };
  const rocks = [];
  const taken = [];
  // Two stones stay on the south shoulder at mid-run so a look due south
  // meets a hull. Their yaw still comes from the seed.
  const anchors = [
    { type: "stone", along: length * 0.5 + 1.15, lateral: -7.2 },
    { type: "boulder", along: length * 0.5 - 1.35, lateral: -8.0 },
  ];
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    const span = ROCK[a.type].scale;
    const scale = span[0] + rand() * (span[1] - span[0]);
    const yaw = rand() * 360;
    rocks.push(rockAt(a.type, a.along, a.lateral, yaw, scale, x0, z));
    taken.push(a);
  }
  const plan = [
    ["boulder", 12],
    ["stone", 20],
  ];
  for (let p = 0; p < plan.length; p++) {
    const type = plan[p][0];
    const want = plan[p][1];
    const span = ROCK[type].scale;
    let placed = 0;
    for (let n = 0; n < 800 && placed < want; n++) {
      const along = 4 + rand() * Math.max(1, length - 8);
      const lateral = (rand() < 0.5 ? -1 : 1) * (3.8 + rand() * 4.6);
      if (tooClose(along, lateral, taken, monuments)) continue;
      const scale = span[0] + rand() * (span[1] - span[0]);
      const yaw = rand() * 360;
      rocks.push(rockAt(type, along, lateral, yaw, scale, x0, z));
      taken.push({ along, lateral });
      placed += 1;
    }
  }
  return {
    seed: Number(seed) || 1,
    lengthM: length,
    pathZ: z,
    x0,
    rocks,
    monuments: {
      arch: { x: x0 + archAlong, z, yaw: RUN_YAW },
      gate: { x: x0 + gateAlong, z, yaw: RUN_YAW },
      wreck: { x: x0 + shipAlong, z: z + 22, yaw: RUN_YAW },
    },
  };
}

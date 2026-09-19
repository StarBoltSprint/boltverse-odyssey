export type NodeId = "core" | "tide" | "canyon" | "crystal" | "hollow" | "drift";
export type NodeRing = "core" | "inner" | "outer";

export interface WorldNode {
  id: NodeId;
  name: string;
  epithet: string;
  x: number;
  y: number;
  z: number;
  ring: NodeRing;
  video: string;
  poster: string;
}

/** World-space size of each node's video plate (square). */
export const VIDEO_SIZE = 1000;

/** Core is the heart — drawn larger than the planets. */
export const PLATE_SCALE: Record<NodeId, number> = {
  core: 3.55,
  tide: 1,
  canyon: 1,
  crystal: 1,
  hollow: 1,
  drift: 1,
};

export function plateSize(id: NodeId) {
  return VIDEO_SIZE * (PLATE_SCALE[id] ?? 1);
}

export const NODES: WorldNode[] = [
  {
    id: "core",
    name: "Star Core",
    epithet: "heart of the universe",
    x: 0,
    y: 0,
    z: 0,
    ring: "core",
    video: "/videos/core.mp4?v=orb1",
    poster: "/videos/core.jpg?v=orb1",
  },
  {
    id: "tide",
    name: "Tide",
    epithet: "ocean world",
    x: -2720,
    y: 960,
    z: 880,
    ring: "inner",
    video: "/videos/tide.mp4?v=big1",
    poster: "/videos/tide.jpg?v=big1",
  },
  {
    id: "canyon",
    name: "Canyon",
    epithet: "scarred world",
    x: 2960,
    y: -800,
    z: -820,
    ring: "inner",
    video: "/videos/canyon.mp4?v=fill2",
    poster: "/videos/canyon.jpg?v=fill2",
  },
  {
    id: "crystal",
    name: "Crystal",
    epithet: "dormant ice",
    x: -1120,
    y: -2880,
    z: 580,
    ring: "inner",
    video: "/videos/crystal.mp4?v=nohalo",
    poster: "/videos/crystal.jpg?v=nohalo",
  },
  {
    id: "hollow",
    name: "Hollow",
    epithet: "quiet vein",
    x: -4310,
    y: 3340,
    z: -1140,
    ring: "outer",
    video: "/videos/hollow.mp4?v=spin-slow",
    poster: "/videos/hollow.jpg?v=spin-slow",
  },
  {
    id: "drift",
    name: "Drift",
    epithet: "ash world",
    x: 4750,
    y: 2820,
    z: 1280,
    ring: "outer",
    video: "/videos/drift.mp4?v=spin-slow",
    poster: "/videos/drift.jpg?v=spin-slow",
  },
];

export const LINKS: Array<[NodeId, NodeId]> = [
  ["core", "tide"],
  ["core", "canyon"],
  ["core", "crystal"],
  ["core", "hollow"],
  ["core", "drift"],
  ["tide", "hollow"],
  ["canyon", "drift"],
  ["tide", "crystal"],
  ["canyon", "crystal"],
];

export const NODE_BY_ID: Record<NodeId, WorldNode> = Object.fromEntries(
  NODES.map((n) => [n.id, n]),
) as Record<NodeId, WorldNode>;

export function constellationBounds() {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of NODES) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x);
    maxY = Math.max(maxY, n.y);
  }
  const pad = VIDEO_SIZE * 2.2;
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

export function panLimit() {
  const { minX, minY, maxX, maxY } = constellationBounds();
  return Math.max(-minX, maxX, -minY, maxY);
}

export function zoomLimits(vw: number, vh: number) {
  const { minX, minY, maxX, maxY } = constellationBounds();
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const minZ = Math.min(vw / spanX, vh / spanY) * 0.92;
  const maxZ = (Math.max(vw, vh) / VIDEO_SIZE) * 1.1;
  return { minZ, maxZ, maxZSurface: maxZ * 6.4 };
}

/** Extra approach plate — does not replace the orbital loop. Canyon only for now. */
export const LOD1: Partial<Record<NodeId, { video: string; poster: string }>> = {
  canyon: {
    video: "/videos/canyon-lod1.mp4?v=lod1",
    poster: "/videos/canyon-lod1.jpg?v=lod1",
  },
};

export const LOD2: Partial<Record<NodeId, { video: string; poster: string }>> = {
  canyon: {
    video: "/videos/canyon-lod2.mp4?v=lod2b",
    poster: "/videos/canyon-lod2.jpg?v=lod2b",
  },
};

export const LOD3: Partial<Record<NodeId, { video: string; poster: string }>> = {
  canyon: {
    video: "/videos/canyon-lod3.mp4?v=lod3",
    poster: "/videos/canyon-lod3.jpg?v=lod3",
  },
};

export function lod1Id(id: NodeId) {
  return `${id}-lod1`;
}

export function lod2Id(id: NodeId) {
  return `${id}-lod2`;
}

export function lod3Id(id: NodeId) {
  return `${id}-lod3`;
}

export function smooth01(t: number) {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

/** Screen-filling factor of a globe disc. 1 = limb touches the short side. */
export function globeU(
  sizePx: number,
  source: number,
  vw: number,
  vh: number,
) {
  const R = sizePx * source;
  return R / Math.max(0.5 * Math.min(vw, vh), 1);
}

/** LOD1 opacity: one fade, then holds. */
export function lod1Alpha(u: number) {
  return smooth01((u - 0.85) / 0.4);
}

/** LOD0 opacity under the approach plate. */
export function lod0Alpha(u: number) {
  return 1 - smooth01((u - 1.12) / 0.7);
}

/** Surface plate — as soon as the globe fills, skip the oval crop. */
export function lod2Alpha(u: number) {
  return smooth01((u - 0.94) / 0.72);
}

/** Oblique flyover — born over the nadir plate. */
export function lod3Alpha(u: number) {
  return smooth01((u - 3.2) / 1.55);
}

/** World radius of the visible planet orb (not the full video plate). */
export const ORB_HIT_RADIUS = VIDEO_SIZE * 0.28;

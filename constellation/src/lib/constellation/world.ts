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

export const NODES: WorldNode[] = [
  {
    id: "core",
    name: "Star Core",
    epithet: "heart of the universe",
    x: 0,
    y: 0,
    z: 0,
    ring: "core",
    video: "/videos/core.mp4",
    poster: "/videos/core.jpg",
  },
  {
    id: "tide",
    name: "Tide",
    epithet: "ocean world",
    x: -1360,
    y: 480,
    z: 440,
    ring: "inner",
    video: "/videos/tide.mp4",
    poster: "/videos/tide.jpg",
  },
  {
    id: "canyon",
    name: "Canyon",
    epithet: "scarred world",
    x: 1480,
    y: -400,
    z: -410,
    ring: "inner",
    video: "/videos/canyon.mp4",
    poster: "/videos/canyon.jpg",
  },
  {
    id: "crystal",
    name: "Crystal",
    epithet: "dormant ice",
    x: -560,
    y: -1440,
    z: 290,
    ring: "inner",
    video: "/videos/crystal.mp4",
    poster: "/videos/crystal.jpg",
  },
  {
    id: "hollow",
    name: "Hollow",
    epithet: "quiet vein",
    x: -1960,
    y: 1520,
    z: -520,
    ring: "outer",
    video: "/videos/hollow.mp4",
    poster: "/videos/hollow.jpg",
  },
  {
    id: "drift",
    name: "Drift",
    epithet: "ash world",
    x: 2160,
    y: 1280,
    z: 580,
    ring: "outer",
    video: "/videos/drift.mp4",
    poster: "/videos/drift.jpg",
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
  const pad = VIDEO_SIZE * 0.55;
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
  return { minZ, maxZ };
}

/** World radius of the visible planet orb (not the full video plate). */
export const ORB_HIT_RADIUS = VIDEO_SIZE * 0.22;

/** Jade field seed + spawn kinds. Kitchen remix. */
export const SEED = 7749;
export const CHUNK = 32; // meters per chunk
export const PATH_HALF = 3.4; // path corridor stays empty

export type Hit = "block" | "soft" | "shatter" | "decor";
export type Kind = "bole" | "elder" | "ruin" | "crystal" | "fern";
export type Band = "near" | "mid" | "far" | "cull";

export type SpawnRow = {
  id: string;
  kind: Kind;
  x: number;
  z: number;
  r: number;
  h: number;
  yaw: number;
  variant: number;
  hit: Hit;
};

/** Defaults by kind — capsule twin uses same r/h. Law 46 name: KIND_TABLE. */
export const KIND_RH: Record<Kind, { r: number; h: number; hit: Hit }> = {
  bole: { r: 0.55, h: 3.2, hit: "block" },
  elder: { r: 0.9, h: 5.5, hit: "block" },
  ruin: { r: 1.2, h: 2.4, hit: "block" },
  crystal: { r: 0.35, h: 1.6, hit: "shatter" },
  /** Tuft disk. Not the 1.1 m card width. */
  fern: { r: 0.45, h: 0.6, hit: "soft" },
};

/** Same table. Capsule r hangs on the bole, never the crown. */
export const KIND_TABLE = KIND_RH;

export type Volume = {
  x: number;
  z: number;
  r: number;
  h: number;
  kind: Kind;
  hit: Hit;
  id: string;
};

export type LodRow = SpawnRow & {
  /** Hysteresis. holdBand reads this. The budget does not write it. */
  band: Band;
  /** After the quota. Picture, mesh, and volume follow this. Not prev. */
  bandDraw: Band;
  /** Same as bandDraw. The picture lod. Not the sticky band. */
  meshLod: Band;
  picture: "full" | "bole" | "impostor" | "none";
  /** True for bandDraw near or mid. Far and cull have no capsule. */
  volume: boolean;
  dist: number;
  /** Nearest 24. They win a fade slot over a farther tree. */
  fadePriority: boolean;
};

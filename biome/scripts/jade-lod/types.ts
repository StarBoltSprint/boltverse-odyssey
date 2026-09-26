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

/** Defaults by kind — capsule twin uses same r/h. */
export const KIND_RH: Record<Kind, { r: number; h: number; hit: Hit }> = {
  bole: { r: 0.55, h: 3.2, hit: "block" },
  elder: { r: 0.9, h: 5.5, hit: "block" },
  ruin: { r: 1.2, h: 2.4, hit: "block" },
  crystal: { r: 0.35, h: 1.6, hit: "shatter" },
  fern: { r: 0.25, h: 0.9, hit: "soft" },
};

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
  band: Band;
  picture: "full" | "bole" | "impostor" | "none";
  volume: boolean;
};

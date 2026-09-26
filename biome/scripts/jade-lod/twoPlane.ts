import { billboardYaw } from "./billboard";
import { KIND_TABLE, type Band, type Kind, type LodRow } from "./types";

/**
 * Two-plane tree. Law 46. Kitchen types. Does not import three.
 * Bole + crown share (x, z, yaw family). Capsule r is KIND_TABLE[kind].r on the bole.
 * Near↔mid dissolves crown + shadow only. The bole stays cutout.
 * Mid↔far dissolves bole ↔ impostor.
 */

export type Plane = "bole" | "crown" | "shadow" | "impostor";

export const BOLE_FACE = 0.55;
export const CROWN_FACE = 0.85;
export const CROWN_FADE_MS = 220;
export const BOLE_IMP_FADE_MS = 280;
export const SHADOW_Y = 0.02;

/** Trunk band named on the bole. Live collider stays KIND_TABLE[kind].r. Never the crown width. */
export const TRUNK_R = { contact: 0.28, bole: 0.55 } as const;

const ON: Record<Band, Record<Plane, 0 | 1>> = {
  near: { bole: 1, crown: 1, shadow: 1, impostor: 0 },
  mid: { bole: 1, crown: 0, shadow: 0, impostor: 0 },
  far: { bole: 0, crown: 0, shadow: 0, impostor: 1 },
  cull: { bole: 0, crown: 0, shadow: 0, impostor: 0 },
};

export function planesFor(band: Band): Record<Plane, 0 | 1> {
  return { ...ON[band] };
}

export function hasCrown(kind: Kind): boolean {
  return kind === "bole" || kind === "elder";
}

/** Elder uses the bole/crown family at the larger quad. */
export function planeSize(kind: Kind): { wBole: number; wCrown: number; hBole: number; hCrown: number } {
  if (kind === "elder") return { wBole: 1.0, wCrown: 2.4, hBole: 5.5, hCrown: 2.2 };
  if (kind === "bole") return { wBole: 0.85, wCrown: 2.1, hBole: 3.2, hCrown: 1.8 };
  const h = KIND_TABLE[kind].h;
  return { wBole: 0.85, wCrown: 0, hBole: h, hCrown: 0 };
}

/**
 * Sheet names. Cook v0–v3. Hung spawnChunk currently emits variant 0–2.
 * No binaries here.
 */
export function sheetFile(kind: Kind, variant: number, part: "bole" | "crown" | "imp" | "sheet"): string {
  const v = Math.min(3, Math.max(0, variant | 0));
  if (part === "imp") return `${kind}_imp_v${v}.png`;
  if (part === "crown") return `crown_v${v}.png`;
  if (part === "bole" && hasCrown(kind)) return `bole_v${v}.png`;
  return `${kind}_v${v}.png`;
}

export type TexSet = { bole?: string; crown?: string; imp: string; sheet?: string };

/** TEX[kind][variant].bole / .crown / .imp */
export function texOf(kind: Kind, variant: number): TexSet {
  const imp = sheetFile(kind, variant, "imp");
  if (hasCrown(kind)) {
    return {
      bole: sheetFile(kind, variant, "bole"),
      crown: sheetFile(kind, variant, "crown"),
      imp,
    };
  }
  return { sheet: sheetFile(kind, variant, "sheet"), imp };
}

export type DissolveJob = {
  planes: Plane[];
  ms: number;
  /** Near↔mid: bole does not enter the fade. It stays cutout and writes depth. */
  boleStaysCutout: boolean;
};

/** Which planes may dissolve. Null = no picture fade (rest, or a pair this law does not crossfade). */
export function dissolveJob(from: Band, to: Band): DissolveJob | null {
  if (from === to) return null;
  const pair = (a: Band, b: Band) => (from === a && to === b) || (from === b && to === a);
  if (pair("near", "mid")) {
    return { planes: ["crown", "shadow"], ms: CROWN_FADE_MS, boleStaysCutout: true };
  }
  if (pair("mid", "far")) {
    return { planes: ["bole", "impostor"], ms: BOLE_IMP_FADE_MS, boleStaysCutout: false };
  }
  return null;
}

export function planeFace(plane: Plane): number {
  if (plane === "crown") return CROWN_FACE;
  if (plane === "bole" || plane === "impostor" || plane === "shadow") return BOLE_FACE;
  return BOLE_FACE;
}

export type PlanePose = {
  plane: Plane;
  on: 0 | 1;
  x: number;
  y: number;
  z: number;
  yaw: number;
  w: number;
  h: number;
  /** True when this plane must stay on the mask path. */
  cutout: boolean;
  sheet: string;
};

/**
 * Pose the planes on the floor height. groundY is postureHeight — the film itself stays flat.
 * Capsule is not a plane. Use capsuleOnBole.
 */
export function posePlanes(
  row: LodRow,
  camX: number,
  camZ: number,
  groundY: number,
): PlanePose[] {
  const on = planesFor(row.band);
  const size = planeSize(row.kind);
  const crown = hasCrown(row.kind);
  const out: PlanePose[] = [];
  const push = (plane: Plane, y: number, w: number, h: number, sheet: string, cutout: boolean) => {
    if (!crown && (plane === "crown")) return;
    out.push({
      plane,
      on: on[plane],
      x: row.x,
      y,
      z: row.z,
      yaw: billboardYaw(row.yaw, camX, camZ, row.x, row.z, planeFace(plane)),
      w,
      h,
      cutout: cutout || (plane === "bole" && (row.band === "near" || row.band === "mid")),
      sheet,
    });
  };
  push("bole", groundY + size.hBole / 2, size.wBole, size.hBole, texOf(row.kind, row.variant).bole ?? texOf(row.kind, row.variant).sheet ?? "", true);
  if (crown) {
    push("crown", groundY + size.hBole + size.hCrown / 2, size.wCrown, size.hCrown, texOf(row.kind, row.variant).crown ?? "", false);
  }
  push("shadow", groundY + SHADOW_Y, size.wBole * 1.4, size.wBole * 1.4, "", false);
  push("impostor", groundY + size.hBole / 2, size.wBole, size.hBole, texOf(row.kind, row.variant).imp, false);
  return out;
}

/** Collider on the bole. r from the kind table. y is the posture base. Crown width is not here. */
export function capsuleOnBole(row: LodRow, groundY: number): { x: number; y: number; z: number; r: number; h: number } {
  return {
    x: row.x,
    y: groundY,
    z: row.z,
    r: KIND_TABLE[row.kind].r,
    h: row.h,
  };
}

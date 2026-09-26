import { billboardYaw } from "./billboard";
import { KIND_TABLE, type Band, type Kind, type LodRow } from "./types";

/**
 * Two-plane tree kit. Law 49. Kitchen types. Does not import three.
 * Bole = architecture (mask). Crown = weather (may dissolve). One address.
 * They do not share a material path. The impostor is a third far silhouette.
 * The group is not yawed. Each child mixes yaw on its own.
 * Near↔mid is one fade slot (the crown). Shadow follows the crown.
 * The bole goes translucent only on mid↔far.
 */

export type Plane = "bole" | "crown" | "shadow" | "impostor";

export const BOLE_FACE = 0.55;
export const CROWN_FACE = 0.85;
export const IMP_FACE = 0.9;
export const CROWN_FADE_MS = 220;
export const BOLE_IMP_FADE_MS = 280;
export const IMP_FADE_MS = 180;
export const SHADOW_Y = 0.02;
export const SHADOW_A = 0.28;
/** Crown lean on variant v1. Volume xz does not move. */
export const LEAN_X = 0.15;
/** One tree, one slot, even when crown and shadow both move. */
export const SLOTS_PER_TREE = 1;

export const RENDER_ORDER = { shadow: 2, impostor: 3, bole: 4, crown: 5 } as const;

/**
 * Two-plane cylinder. Bole 0.28, elder 0.55.
 * Elder 0.55 is the thicker bole, not the crown width.
 */
export const CYLINDER_R = { bole: 0.28, elder: 0.55 } as const;

/** Named trunk band. The live two-plane hit is CYLINDER_R, not the crown. */
export const TRUNK_R = { contact: 0.28, bole: 0.55 } as const;

type Size = { hBole: number; hCrown: number; wBole: number; wCrown: number; twoPlane: boolean };

/** Only bole and elder are two planes. Ruin has no crown. */
export const SIZE: Record<Kind, Size> = {
  bole: { hBole: 2.4, hCrown: 2.0, wBole: 0.85, wCrown: 2.1, twoPlane: true },
  elder: { hBole: 4.2, hCrown: 3.2, wBole: 1.15, wCrown: 2.8, twoPlane: true },
  ruin: { hBole: 2.8, hCrown: 0, wBole: 3.2, wCrown: 0, twoPlane: false },
  crystal: { hBole: 1.6, hCrown: 0, wBole: 0.7, wCrown: 0, twoPlane: false },
  fern: { hBole: 0.6, hCrown: 0, wBole: 1.1, wCrown: 0, twoPlane: false },
};

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

/** Quad sizes. Ruin / crystal / fern are one card. */
export function planeSize(kind: Kind): { wBole: number; wCrown: number; hBole: number; hCrown: number } {
  const s = SIZE[kind];
  return { wBole: s.wBole, wCrown: s.wCrown, hBole: s.hBole, hCrown: s.hCrown };
}

/** Documented folder. No binaries in the repo. Law 47. */
export const SHEET_DIR = "public/decor/jade/sheets";

export function clampVariant(variant: number): number {
  if (!Number.isFinite(variant)) return 0;
  return Math.min(3, Math.max(0, variant | 0));
}

/**
 * Sheet file names. Cook v0–v3. Elder shares the bole/crown family.
 * Far tree ghost is bole_imp. crown_imp is optional and is not the far default.
 * No binaries here.
 */
export function sheetFile(
  kind: Kind,
  variant: number,
  part: "bole" | "crown" | "imp" | "crownImp" | "sheet",
): string {
  const v = clampVariant(variant);
  if (part === "crownImp") return `crown_imp_v${v}.png`;
  if (part === "imp") {
    if (kind === "bole" || kind === "elder") return `bole_imp_v${v}.png`;
    return `${kind}_imp_v${v}.png`;
  }
  if (part === "crown") return `crown_v${v}.png`;
  if (part === "bole" && hasCrown(kind)) return `bole_v${v}.png`;
  return `${kind}_v${v}.png`;
}

/** Missing file → v0 name. The row still draws. */
export function resolveSheet(
  kind: Kind,
  variant: number,
  part: "bole" | "crown" | "imp" | "crownImp" | "sheet",
  hasFile: (fileName: string) => boolean,
): string {
  const name = sheetFile(kind, variant, part);
  if (clampVariant(variant) === 0 || hasFile(name)) return name;
  return sheetFile(kind, 0, part);
}

export type TexSet = { bole?: string; crown?: string; imp: string; sheet?: string };

/** TEX.bole[2].bole / .crown / .imp — kind + variant only. Paths sit under SHEET_DIR. */
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

export type FadeEdge = "near-mid" | "mid-far" | "far-cull";

export type TreeFade = {
  edge: FadeEdge;
  ms: number;
  /** Always 1. Crown + shadow share it. */
  slots: 1;
  crown: boolean;
  /** True only on mid↔far. */
  boleTranslucent: boolean;
  impostor: boolean;
  /** Volume does not follow alpha. */
  volume: "stay" | "snap-off-leave-44" | "snap-on-enter-40" | "none";
};

const ORDER: Band[] = ["cull", "far", "mid", "near"];

/** How many belts the band jumped. 1 is a real edge. More than 1 is a sprint. */
export function bandSteps(from: Band, to: Band): number {
  return Math.abs(ORDER.indexOf(from) - ORDER.indexOf(to));
}

/** Sprint through the belt: snap the matrix, skip the fade. */
export function sprintSnap(from: Band, to: Band): boolean {
  return from !== to && bandSteps(from, to) > 1;
}

/**
 * The two edges that matter, plus impostor far↔cull.
 * Budget demote near→mid is this fade, not a snap.
 * Null when the band did not move, or the pawn sprinted through a belt.
 */
export function fadeEdge(from: Band, to: Band): TreeFade | null {
  if (from === to || sprintSnap(from, to)) return null;
  const pair = (a: Band, b: Band) => (from === a && to === b) || (from === b && to === a);
  if (pair("near", "mid")) {
    return {
      edge: "near-mid",
      ms: CROWN_FADE_MS,
      slots: 1,
      crown: true,
      boleTranslucent: false,
      impostor: false,
      volume: "stay",
    };
  }
  if (pair("mid", "far")) {
    return {
      edge: "mid-far",
      ms: BOLE_IMP_FADE_MS,
      slots: 1,
      crown: false,
      boleTranslucent: true,
      impostor: true,
      volume: to === "far" ? "snap-off-leave-44" : "snap-on-enter-40",
    };
  }
  if (pair("far", "cull")) {
    return {
      edge: "far-cull",
      ms: IMP_FADE_MS,
      slots: 1,
      crown: false,
      boleTranslucent: false,
      impostor: true,
      volume: "none",
    };
  }
  return null;
}

export type DissolveJob = {
  planes: Plane[];
  ms: number;
  /** Near↔mid: bole does not enter the fade. It stays cutout and writes depth. */
  boleStaysCutout: boolean;
  slots: 1;
};

/** One slot. Shadow is not its own plane — it tracks crown alpha. */
export function dissolveJob(from: Band, to: Band): DissolveJob | null {
  const edge = fadeEdge(from, to);
  if (!edge) return null;
  if (edge.edge === "near-mid") {
    return { planes: ["crown"], ms: edge.ms, boleStaysCutout: true, slots: 1 };
  }
  if (edge.edge === "mid-far") {
    return { planes: ["bole", "impostor"], ms: edge.ms, boleStaysCutout: false, slots: 1 };
  }
  return { planes: ["impostor"], ms: edge.ms, boleStaysCutout: true, slots: 1 };
}

/** Shadow does not yaw. The others mix planted yaw toward the camera. */
export function planeFace(plane: Plane): number | null {
  if (plane === "shadow") return null;
  if (plane === "crown") return CROWN_FACE;
  if (plane === "impostor") return IMP_FACE;
  return BOLE_FACE;
}

export type EdgeAlpha = {
  bole: number;
  crown: number;
  shadow: number;
  impostor: number;
  boleCutout: boolean;
  boleDepthWrite: boolean;
  crownDepthWrite: boolean;
  impostorDepthWrite: boolean;
};

function clamp01(u: number): number {
  if (!Number.isFinite(u)) return 0;
  return Math.min(1, Math.max(0, u));
}

/**
 * Picture alpha on an edge. u = 0 at `from`, 1 at `to`.
 * Crown snaps to 0 before a mid↔far fade. Shadow = 0.28 * crown.
 * Volume is not in this return.
 */
export function edgeAlpha(from: Band, to: Band, u: number): EdgeAlpha {
  const t = clamp01(u);
  const rest = (band: Band): EdgeAlpha => {
    const on = ON[band];
    const crown = on.crown;
    return {
      bole: on.bole,
      crown,
      shadow: SHADOW_A * crown,
      impostor: on.impostor,
      boleCutout: true,
      boleDepthWrite: on.bole === 1,
      crownDepthWrite: crown === 1,
      impostorDepthWrite: on.impostor === 1,
    };
  };
  if (sprintSnap(from, to) || from === to) return rest(to);
  const edge = fadeEdge(from, to);
  if (!edge) return rest(to);
  if (edge.edge === "near-mid") {
    const crown = from === "near" ? 1 - t : t;
    return {
      bole: 1,
      crown,
      shadow: SHADOW_A * crown,
      impostor: 0,
      boleCutout: true,
      boleDepthWrite: true,
      crownDepthWrite: crown >= 1,
      impostorDepthWrite: false,
    };
  }
  if (edge.edge === "mid-far") {
    const bole = from === "mid" ? 1 - t : t;
    const imp = 1 - bole;
    const fading = bole > 0 && bole < 1;
    return {
      bole,
      crown: 0,
      shadow: 0,
      impostor: imp,
      boleCutout: !fading,
      boleDepthWrite: !fading && bole >= 1,
      crownDepthWrite: false,
      impostorDepthWrite: !fading && imp >= 1,
    };
  }
  const imp = from === "far" ? 1 - t : t;
  return {
    bole: 0,
    crown: 0,
    shadow: 0,
    impostor: imp,
    boleCutout: true,
    boleDepthWrite: false,
    crownDepthWrite: false,
    impostorDepthWrite: imp >= 1,
  };
}

export type PlanePose = {
  plane: Plane;
  on: 0 | 1;
  /** Child local position. Parent sits at (row.x, groundY, row.z) and is not yawed. */
  x: number;
  y: number;
  z: number;
  /** Null on the shadow. The group does not carry this. */
  yaw: number | null;
  w: number;
  h: number;
  /** True when this plane must stay on the mask path. */
  cutout: boolean;
  renderOrder: number;
  /** Shadow is 0.28 at rest. Other planes are 1 when shown. */
  opacity: number;
  sheet: string;
};

export type TreeFiles = { bole?: boolean; crown?: boolean };

/**
 * Resting children in parent space. groundY is postureHeight — the film stays flat.
 * Far does not keep a hidden bole. Missing crown: near looks like mid.
 * Missing bole: no children, so a crown cannot float.
 * v1 leans the crown by -0.15. The cylinder stays on x = 0.
 */
export function posePlanes(
  row: LodRow,
  camX: number,
  camZ: number,
  files: TreeFiles = {},
): PlanePose[] {
  const boleFile = files.bole !== false;
  const crownFile = files.crown !== false && hasCrown(row.kind);
  if (!boleFile) return [];
  const on = planesFor(row.band);
  if (!crownFile) {
    on.crown = 0;
    on.shadow = 0;
  }
  const size = planeSize(row.kind);
  const tex = texOf(row.kind, row.variant);
  const cyl = cylinderR(row.kind);
  const out: PlanePose[] = [];
  const yawOf = (plane: Plane): number | null => {
    const face = planeFace(plane);
    if (face == null) return null;
    return billboardYaw(row.yaw, camX, camZ, row.x, row.z, face);
  };
  const push = (pose: PlanePose) => {
    if (pose.on === 0) return;
    out.push(pose);
  };
  push({
    plane: "bole",
    on: on.bole,
    x: 0,
    y: size.hBole * 0.5,
    z: 0,
    yaw: yawOf("bole"),
    w: size.wBole,
    h: size.hBole,
    cutout: true,
    renderOrder: RENDER_ORDER.bole,
    opacity: 1,
    sheet: tex.bole ?? tex.sheet ?? "",
  });
  if (crownFile) {
    push({
      plane: "crown",
      on: on.crown,
      x: row.variant === 1 ? -LEAN_X : 0,
      y: size.hBole + size.hCrown * 0.5,
      z: 0,
      yaw: yawOf("crown"),
      w: size.wCrown,
      h: size.hCrown,
      cutout: true,
      renderOrder: RENDER_ORDER.crown,
      opacity: 1,
      sheet: tex.crown ?? "",
    });
  }
  const shadowR = cyl * 2.2;
  push({
    plane: "shadow",
    on: on.shadow,
    x: 0,
    y: SHADOW_Y,
    z: 0,
    yaw: null,
    w: shadowR * 2,
    h: shadowR * 2,
    cutout: false,
    renderOrder: RENDER_ORDER.shadow,
    opacity: SHADOW_A,
    sheet: "",
  });
  const imp = hasCrown(row.kind)
    ? { w: 1.2, h: 1.6, y: (size.hBole + size.hCrown) * 0.35 }
    : { w: size.wBole, h: size.hBole, y: size.hBole * 0.35 };
  push({
    plane: "impostor",
    on: on.impostor,
    x: 0,
    y: imp.y,
    z: 0,
    yaw: yawOf("impostor"),
    w: imp.w,
    h: imp.h,
    cutout: true,
    renderOrder: RENDER_ORDER.impostor,
    opacity: 1,
    sheet: tex.imp,
  });
  return out;
}

/** Parent at (x, h, z). Yaw stays 0 so children do not double-turn. */
export function poseTree(
  row: LodRow,
  camX: number,
  camZ: number,
  groundY: number,
  files: TreeFiles = {},
): { x: number; y: number; z: number; yaw: 0; children: PlanePose[]; cylinder: ReturnType<typeof capsuleOnBole> | null } {
  const children = posePlanes(row, camX, camZ, files);
  const missingBole = files.bole === false;
  return {
    x: row.x,
    y: groundY,
    z: row.z,
    yaw: 0,
    children,
    cylinder: missingBole ? null : capsuleOnBole(row, groundY),
  };
}

/** Two-plane hit radius. Other kinds stay on the kind table. */
export function cylinderR(kind: Kind): number {
  if (kind === "bole" || kind === "elder") return CYLINDER_R[kind];
  return KIND_TABLE[kind].r;
}

/**
 * Collider on the bole. y is the posture base. Crown width is not here.
 * Bole r 0.28, elder r 0.55, height = hBole. Block.
 */
export function capsuleOnBole(row: LodRow, groundY: number): { x: number; y: number; z: number; r: number; h: number; block: true } {
  const size = planeSize(row.kind);
  const two = hasCrown(row.kind);
  return {
    x: row.x,
    y: groundY,
    z: row.z,
    r: cylinderR(row.kind),
    h: two ? size.hBole : KIND_TABLE[row.kind].h,
    block: true,
  };
}

import { resolveCheapAlpha, tickFades, type CheapAlpha } from "./fade";
import type { LodRow } from "./types";

const FACE = 0.7; // 70% face-cam → 30% planted yaw

/** 70% look-at camera on Y, 30% planted yaw so the trunk stays rooted. */
export function billboardYaw(
  planted: number,
  camX: number,
  camZ: number,
  x: number,
  z: number,
): number {
  const toCam = Math.atan2(camX - x, camZ - z);
  let d = toCam - planted;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return planted + d * FACE;
}

export function scaleByBand(band: LodRow["band"]): number {
  if (band === "near") return 1;
  if (band === "mid") return 0.72;
  if (band === "far") return 0.42;
  return 0;
}

/** Shadow only on near (full card). Mid/far: no contact blob. */
export function wantsShadow(row: LodRow): boolean {
  return row.band === "near" && row.picture === "full";
}

export type CardKit = {
  visible: boolean;
  yaw: number;
  scale: number;
  picture: LodRow["picture"];
  shadow: boolean;
  row: LodRow;
};

/** Map LOD rows → per-card kit for the remix renderer. */
export function applyLodToKit(
  rows: LodRow[],
  camX: number,
  camZ: number,
): CardKit[] {
  return rows.map((row) => {
    if (row.band === "cull" || row.picture === "none") {
      return {
        visible: false,
        yaw: billboardYaw(row.yaw, camX, camZ, row.x, row.z),
        scale: 0,
        picture: "none",
        shadow: false,
        row,
      };
    }
    return {
      visible: true,
      yaw: billboardYaw(row.yaw, camX, camZ, row.x, row.z),
      scale: scaleByBand(row.band),
      picture: row.picture,
      shadow: wantsShadow(row),
      row,
    };
  });
}

export type CardDraw = CardKit & { alpha: CheapAlpha };

function scaleForPicture(picture: LodRow["picture"]): number {
  if (picture === "full") return scaleByBand("near");
  if (picture === "bole") return scaleByBand("mid");
  if (picture === "impostor") return scaleByBand("far");
  return 0;
}

/**
 * Idle cutout vs mid-fade blend vs skip.
 * Does not import three. Copy `alpha` onto the material the remix already has.
 * FrontSide only. Resting cards stay cutout. Capsule is not in this return —
 * `volumes` from tickField already snapped.
 * nowMs is milliseconds. Scale-down while `a` falls is not hung; scale follows the picture.
 */
export function applyCheapAlpha(kits: CardKit[], nowMs: number): CardDraw[] {
  tickFades(nowMs);
  return kits.map((kit) => {
    const alpha = resolveCheapAlpha(kit.row.id, kit.row.band, nowMs);
    return {
      ...kit,
      visible: alpha.visible,
      picture: alpha.picture,
      scale: scaleForPicture(alpha.picture),
      shadow: alpha.visible && alpha.picture === "full",
      alpha,
    };
  });
}

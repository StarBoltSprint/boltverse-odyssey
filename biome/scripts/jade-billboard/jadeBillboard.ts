// jadeBillboard.ts
import * as THREE from "three";

export type Hit = "block" | "soft" | "shatter" | "decor";

export type SpawnRow = {
  kind: "bole" | "elder" | "ruin" | "crystal" | "fern";
  x: number;
  z: number;
  r: number;
  h: number;
  yaw: number;       // planted yaw from seed, radians
  variant: number;
  hit: Hit;
};

export const DRAW_ORDER = [
  "sky",
  "ground",
  "farDecor",
  "midCards",
  "nearCards",
  "shadows",
  "bolt",
  "fx",
] as const;

const FACE = 0.7;     // face camera
const PLANT = 0.3;    // keep seed yaw so the trunk stays rooted
const NEAR = 12;      // meters — near band
const MID = 40;

export function bandOf(dist: number): "near" | "mid" | "far" {
  if (dist < NEAR) return "near";
  if (dist < MID) return "mid";
  return "far";
}

/** 70% look-at camera on Y, 30% planted yaw. */
export function billboardYaw(planted: number, camX: number, camZ: number, x: number, z: number) {
  const toCam = Math.atan2(camX - x, camZ - z);
  let d = toCam - planted;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return planted + d * FACE; // FACE=0.7 ⇒ 30% plant remains
}

export function scaleByDistance(dist: number, nearS = 1, farS = 0.42) {
  const t = Math.min(1, Math.max(0, (dist - 3) / (MID - 3)));
  return nearS + (farS - nearS) * t;
}

export function makeCard(tex: THREE.Texture, row: SpawnRow) {
  const w = row.kind === "elder" ? 2.4 : row.kind === "ruin" ? 3.2 : 1.6;
  const h = row.h + (row.kind === "bole" || row.kind === "elder" ? 1.2 : 0);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.position.set(row.x, h * 0.5, row.z);
  mesh.userData.row = row;
  mesh.renderOrder =
    row.hit === "decor" ? 3 : bandOf(0) === "near" ? 5 : 4;
  return mesh;
}

export function makeShadow(row: SpawnRow) {
  const g = new THREE.CircleGeometry(row.r * 2.2, 16);
  const m = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(g, m);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(row.x, 0.02, row.z);
  shadow.renderOrder = 6;
  return shadow;
}

export function tickCards(
  cards: THREE.Mesh[],
  cam: THREE.Vector3,
) {
  for (const mesh of cards) {
    const row = mesh.userData.row as SpawnRow;
    const dx = cam.x - row.x;
    const dz = cam.z - row.z;
    const dist = Math.hypot(dx, dz);
    if (bandOf(dist) === "far") {
      mesh.visible = false;
      continue;
    }
    mesh.visible = true;
    const y = billboardYaw(row.yaw, cam.x, cam.z, row.x, row.z);
    mesh.rotation.set(0, y, 0);
    const s = scaleByDistance(dist);
    mesh.scale.setScalar(s);
    mesh.renderOrder = bandOf(dist) === "near" ? 5 : 4;
  }
}

/** Same row the GPU drew — drop into SprintCore obstacles. */
export function volumeOf(row: SpawnRow) {
  if (row.hit === "decor") return null;
  return { x: row.x, z: row.z, r: row.r, h: row.h, kind: row.kind, hit: row.hit };
}

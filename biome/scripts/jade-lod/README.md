# Jade LOD — volume stack remix

Does **not** thicken the mp4. Picks **how much twin** a spawned thing gets as you close in.

## Bands

| Band | Distance (enter / leave) | Picture | Volume |
|---|---|---|---|
| Near | `< 12` / leave `14` | full card + shadow | yes |
| Mid | `< 40` / leave `44` | bole-only, smaller | yes |
| Far | `< 72` / leave `80` | impostor quad | no |
| Cull | beyond | ground film only | no |

Leave is farther than enter so a tree on the line does not flicker. Near capped at **24** cards; extras drop to mid and **keep** their capsule.

## Wire

```ts
import { tickField } from "./field";
import { applyLodToKit, applyCheapAlpha } from "./billboard";

const { rows, volumes } = tickField(cam.x, cam.z, 1);
const kits = applyLodToKit(rows, cam.x, cam.z);
const drawn = applyCheapAlpha(kits, nowMs);
// volumes → SprintCore obstacles this frame (capsule snaps; it never fades)
```

Far trees are allowed to be ghosts: they live in the ground film. Near/mid must thud.

## Cheap alpha

Resting trees are **cutout**. Blend only while a band change is dissolving. Fill rate is the enemy. The curve is not.

| State | GPU path |
|---|---|
| Idle near / mid / far | **cutout** (`alphaTest 0.45`, `transparent: false`, `depthWrite: true`) |
| Mid-fade only | **blend** (`transparent: true`, `depthWrite: false`, premultiplied `rgb * a, a`) |
| `a < 0.02` | skip the draw (`discard` / `visible = false`) |

Cap **8** concurrent fades. Extra band changes snap. Duration **250 ms** (allowed 220–280), shorter than the hysteresis belt (2–8 m), so two fades rarely stack on one tree. A second change on the same id snaps. Closer kits take the slots first (`applyLod` is near to far). While coverage is still 1, the card stays cutout. The blend path starts once `a` drops.

Front side only. The 70/30 yaw already faces the camera.

The capsule never fades. Soft alpha is look only. The hit snaps on the hysteresis line in `lod.ts`.

Policy: [`fade.ts`](fade.ts) (`requestFade`, `tickFades`, `activeFadeCount`). Flags: `applyCheapAlpha` in [`billboard.ts`](billboard.ts). Fragment: [`card.frag.glsl`](card.frag.glsl). This folder does not import `three`.

Flattened chain in the fragment: sample → multiply fade → discard cutoff → premultiply. The node stack, the two material instances, and the ground/sky graph are law [45](../../docs/45-shader-graph-look-kitchen.md). The graph shades a card the CPU already posed. `billboardYaw` owns yaw. `holdBand` in [`lod.ts`](lod.ts) owns meshLod. The capsule stays `volumes`.

Not hung yet: InstancedMesh per kind+band, an atlas, impostor mip bias, scale-down on far→cull while `a` falls, one opaque cutout pass then the ≤8 fades back-to-front. Skip OIT.

## Four picture jobs

Law [46](../../docs/46-four-picture-jobs.md). Same seed, same ids. The film still has no thickness. No sheet or plate binaries in this folder.

**Sheets.** Cutouts, not places. Folder `public/decor/jade/sheets/` (names only, no binaries). `bole_v0..v3`, `crown_v0..v3`, `bole_imp_v0..v3`, optional `crown_imp`, plus `ruin` / `crystal` / `fern` and their `_imp`. Same `N` on bole+crown is one pair. Wire: `TEX.bole[2].bole / .crown / .imp` via `texOf(kind, variant)`. Missing file → v0, the row still draws. Cook rail: law [47](../../docs/47-jade-sheet-cook.md) · prompts [`SHEETS.md`](SHEETS.md).

**Plates.** The room, not the furniture. Folder `public/decor/jade/plates/` (names only). `jade_ground.mp4` + poster, `jade_sky.mp4` + poster. Optional `jade_ground_still.jpg`, same UV. `TILE` 24 m. `u = worldX/TILE + 0.02*sin(pictureTime*0.15)`. `pictureTime` is the sim clock. Never `Date.now`. Sky yaws with the camera and does not nod. Kits are siblings of the plane. Cook: law [48](../../docs/48-jade-plate-cook.md) · prompts [`PLATES.md`](PLATES.md) · [`plates.ts`](plates.ts).

**Two planes.** [`twoPlane.ts`](twoPlane.ts). Law [49](../../docs/49-two-plane-tree.md). One address, two jobs. Bole is the mask. Crown may dissolve. They do not share a material. Near = bole + crown + shadow. Mid = bole. Far = impostor only (no hidden bole). Cull = nothing. Near↔mid is **one** slot, 220 ms, crown `a` 1↔0, shadow `0.28 * a`, bole stays cutout, volume stays. Mid↔far is 280 ms: bole may go translucent on that edge only, impostor fades in, crown already 0. Volume snaps off at the 44 m leave, and snaps on at the 40 m enter even if bole `a` is still 0.3. Far↔cull is the impostor alone, 180 ms, no volume. Yaw is per child (bole 0.55, crown 0.85, impostor 0.90, shadow none). The group does not yaw. Cylinder on the bole: bole `r` 0.28, elder `r` 0.55 (thicker bole, not the crown). Sizes: bole 2.4 / 2.0, elder 4.2 / 3.2. Ruin has no crown.

**Height.** [`height.ts`](height.ts). Law [50](../../docs/50-heightfield-posture.md). Posture only. `h0 = 0.20 + 0.20 * fbm(x/28, z/28, s+101)` with 3 octaves. Path flattens toward 0.20 with a smoothstep (`pathHalf` 3.4). Bolt snaps `h + 0.45` every tick. A kit stores `groundY` once. The cylinder base is that `groundY`, never 0. Spawn stays `s+0` / `s+17` / `s+31`. The sol film stays `y = 0`.

Frame: picture-time → `tickField` → snap kits to `h` → pawn `(x, h, z)` and volumes at `y = h`.

## Pack law

- Imagine videos stay the world (sol/ciel). Cards are keyed Imagine sheets.
- Simplex / seed placement only — does not draw terrain.
- Do not rewrite pyre-stage into a Three.js world. Remix ports this into the existing composite.
- Capsule dies with the card band (far/cull → no volume).

## Remix next

Point cards at Jade Imagine sheets and hook `volumes` into the existing obstacle query.

## Earlier companion

One-file tick, before this stack: [`../jade-billboard/jadeBillboard.ts`](../jade-billboard/jadeBillboard.ts). This folder is the LOD hang. That file stays the companion. LOD here picks how much twin as you close in. It does not thicken the mp4.

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

## Pack law

- Imagine videos stay the world (sol/ciel). Cards are keyed Imagine sheets.
- Simplex / seed placement only — does not draw terrain.
- Do not rewrite pyre-stage into a Three.js world. Remix ports this into the existing composite.
- Capsule dies with the card band (far/cull → no volume).

## Remix next

Point cards at Jade Imagine sheets and hook `volumes` into the existing obstacle query.

## Earlier companion

One-file tick, before this stack: [`../jade-billboard/jadeBillboard.ts`](../jade-billboard/jadeBillboard.ts). This folder is the LOD hang. That file stays the companion. LOD here picks how much twin as you close in. It does not thicken the mp4.

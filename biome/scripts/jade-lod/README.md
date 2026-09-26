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
import { applyLodToKit } from "./billboard";

const { rows, volumes } = tickField(cam.x, cam.z, 1);
// rows → applyLodToKit(rows, cam.x, cam.z) per card
// volumes → SprintCore obstacles this frame
```

Far trees are allowed to be ghosts: they live in the ground film. Near/mid must thud.

## Pack law

- Imagine videos stay the world (sol/ciel). Cards are keyed Imagine sheets.
- Simplex / seed placement only — does not draw terrain.
- Do not rewrite pyre-stage into a Three.js world. Remix ports this into the existing composite.
- Capsule dies with the card band (far/cull → no volume).

## Remix next

Point cards at Jade Imagine sheets and hook `volumes` into the existing obstacle query.

## Earlier companion

One-file tick, before this stack: [`../jade-billboard/jadeBillboard.ts`](../jade-billboard/jadeBillboard.ts). This folder is the LOD hang. That file stays the companion. LOD here picks how much twin as you close in. It does not thicken the mp4.

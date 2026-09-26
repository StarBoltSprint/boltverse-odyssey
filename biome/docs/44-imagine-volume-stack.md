# 44 — Imagine volume stack

**Go 2026-09-26 (SmiR).** Director confirmed this is the Pack-compatible path. Kitchen only. Do not read this to the player.

Law [43](43-open-ground.md) still owns the four skies and the tiling ground. This law stands objects on that ground. It extends the simplex placement of herbe and arbres in [`pyre/GROVE.md`](../../pyre/GROVE.md) and section B5 of [`COLD_START-biome-method.md`](COLD_START-biome-method.md). Same rows. It adds the twin capsule, the contact shadow, the near and mid bands, and the billboard mix. It does not replace those locks. Simplex still only places. Imagine still draws.

This file is the recipe for a later cold Grok. It does not ship a new player.

The Imagine file has no thickness. Fake a world in front of it with layers in meters. The seed keeps the layers honest: one spawn row, one place.

When you rotate, mid cards slide against the ground film. That slide is the volume. One clip alone is a spinning poster.

---

## Two jobs

Both. Same `(x, z)` as the spawn table.

**1. Collision volume.** A capsule, so you thud a trunk. The spawn row `(x, z, kind)` drives the capsule `(x, z, r, h)`. `r` and `h` come from `kind`, in meters, wide and tall enough that the chest meets the bole and the paws stop before the card center. One scatter. The capsule does not get its own seed.

**2. Look volume.** The eye reads depth when you turn or walk. Near slides faster than far. Near hides far. Trunks stay planted on yaw. That is parallax, occlusion, and scale. It is not a depth map cooked into the video.

---

## Stack (back → front)

| Layer | What | How |
|---|---|---|
| Sky film | Imagine nebula, or a canopy roof when that is the paint | 4-face / far dome, yaw only. Already law 43. The sky file does not contain the ground. |
| Ground film | Dirt or moss | Floor plane under the paws. Already law 43. |
| Far décor / cull | Ground film only | Beyond the far leave (`80` m). No card. No volume. |
| Far cards | Impostor quad | Enter `< 72`, leave `80`. No volume. A ghost in the ground film is allowed. |
| Mid cards | Bole-only, smaller | Enter `< 40`, leave `44`. Volume yes. |
| Near cards | Full Imagine card | Enter `< 12`, leave `14`. Volume yes. Near cap 24; extras drop to mid and keep the capsule. |
| Contact shadow | Dark multiply blob under the card and under Bolt | On the ground plane, at `(x, z)`. Near band only. |
| Bolt | Sealed keyed cutout | SprintCore / the existing Bolt. |

Each frame still sorts by distance. The table is the kind order. A card closer than Bolt draws in front of his flank.

Crystal on a sheet is quartz. Crystal is never chrome.

---

## Cook Imagine as parts

One "3D forest video" is the wrong ask. Cook parts. Same light lock (law [31](31-light-lock.md)). Mixed light reads as stickers.

1. **Empty ground.** No trunks in the near field. Travel is baked. The path stays clear.
2. **Empty sky.** No horizon props that fight the ground seam.
3. **Object sheets.** One tree, one elder, one ruin, one crystal. Green or black key. Shot from the rear three-quarter, the same camera as Bolt. Several variants.
4. **Optional near flank loops.** Only if they are cards too.

Native "Bolt baked in the road, UV slides" is the lane illusion. It does not give a 360° volume. On the open field, Bolt stays the cutout. The woods are the cards.

Do not extrude the mp4. Stand objects on it.

---

## Bands

LOD picks how much twin you get as you close in. It does not thicken the mp4. Leave is farther than enter so a tree on the line does not flicker.

| Band | Distance (enter / leave) | Picture | Volume |
|---|---|---|---|
| Near | `< 12` / leave `14` | full card + shadow | yes |
| Mid | `< 40` / leave `44` | bole-only, smaller | yes |
| Far | `< 72` / leave `80` | impostor quad | no |
| Cull | beyond | ground film only | no |

Near capped at 24. Extras drop to mid and keep the capsule. Far trees may be ghosts in the ground film. Near and mid must thud. The volume twin dies with the card band (far and cull have no capsule).

## Snippet

LOD remix: [`../scripts/jade-lod/`](../scripts/jade-lod/README.md). Seed `7749`, chunk `32` m, path half `3.4` m. Same `(ix, iz)` is the same woods every visit. The seed places. It does not draw terrain.

```ts
import { tickField } from "./field";
import { applyLodToKit, applyCheapAlpha } from "./billboard";
const { rows, volumes } = tickField(cam.x, cam.z, 1);
const drawn = applyCheapAlpha(applyLodToKit(rows, cam.x, cam.z), nowMs);
// volumes → SprintCore obstacles this frame (capsule snaps; it never fades)
```

Remix next: point the cards at Jade Imagine sheets. Hook `volumes` into the obstacle query.

Earlier one-file companion: [`../scripts/jade-billboard/jadeBillboard.ts`](../scripts/jade-billboard/jadeBillboard.ts). Paint order there: sky → ground film → far décor (in the plate) → mid cards → near cards → shadows → Bolt → howl/fx. `tickCards` alone looks deep and you still walk through bark. Feed `volumeOf` too.

`jade-lod` does not import `three`. The companion does, so a remix can port a card. That import does not make Three.js the world. `pyre-stage` stays the WebGL composite of Imagine videos. Do not rewrite it into a Three.js world. There is no `biomes.ts` on this repo. Do not invent one.

## GPU, every frame, per spawn row

1. A camera-facing quad. A cheap two-plane (bole + crown) is enough when one quad is too thin.
2. Scale from distance. Far cards get smaller. Do not stretch a far card up to fill the screen.
3. Billboard toward the camera, not all the way. About 70% face-camera and 30% planted yaw from the seed on that row, so the trunk stays rooted: `yaw = 0.7 * faceCamera + 0.3 * plantedYaw`.
4. Draw far to near. That is the occlusion.
5. Soft contact shadow on the ground plane at `(x, z)`. Near band only. Mid and far have no contact blob.
6. Fog or mist so the mid band fades into the plate.

## Cheap alpha

Fill rate is the cost. The curve is not. Resting trees stay cutout. Blend only while a band change is dissolving. Kitchen: [`fade.ts`](../scripts/jade-lod/fade.ts), [`card.frag.glsl`](../scripts/jade-lod/card.frag.glsl), `applyCheapAlpha` in [`billboard.ts`](../scripts/jade-lod/billboard.ts). Those files do not import three.

| State | GPU path |
|---|---|
| Idle near / mid / far | **cutout** (`alphaTest 0.45`, `transparent: false`, `depthWrite: true`) |
| Mid-fade only | **blend** (`transparent: true`, `depthWrite: false`, premultiplied `rgb * a, a`) |
| `a < 0.02` | skip the draw (`discard` / `visible = false`) |

Cap **8** concurrent fades. A further band change snaps. Fade is **220–280 ms** (hung at 250). That is shorter than the hysteresis belt (2–8 m), so two fades rarely stack on one tree. A second change on the same id snaps. While coverage is still 1, the card stays cutout. The blend path starts once `a` drops.

Front side only. The 70/30 yaw already faces the camera.

The capsule never fades. Soft alpha is look only. The hit snaps on the hysteresis line in `lod.ts`. The node stack for that shading is law [45](45-shader-graph-look-kitchen.md). The graph does not spawn, pick the band, or own the capsule.

Not hung yet: InstancedMesh per kind+band, an atlas, impostor mip bias, scale-down on far→cull while `a` falls, one opaque cutout pass then the ≤8 fades back-to-front. Skip OIT.

---

## Optional

- Two ground rates. The same clip, two UV speeds.
- Path ribbon in world X. Grove already keeps that path empty. Do not paint it into Video A.
- Heightfield from the seed, about 30 cm, under the feet and the cards only. The feet follow that tiny rise. The ground film stays the flat Imagine plane. It does not redraw sol and it does not paint the dirt photo. Fractal noise that lifts or refills that photo stays FAIL. That GROVE lock does not move.
- Occlusion before the look composite. A hide pass. The required draw is already far to near. This pass is extra.

---

## Skip

Monocular depth from the clip. NeRF. Stereo. They fight yaw. Pack state is not the pixels.

---

## Smallest test

Done-when for a remix. Stop here before thickening the forest.

1. Use the existing ground film and the existing sky films. Do not recook them.
2. From the existing tree seed (Grove cell 3.3 m), take eight bole rows in the near band only (about 3–12 m). One keyed bole sheet per row. Same `(x, z, kind)`.
3. Billboard mix, contact shadow, and fog, as in the GPU list above.
4. Capsules on, from those same rows. Walk a circle around one tree.
5. Those resting boles stay cutout (`alphaTest 0.45`). A band change may blend, eight at a time.

Pass: that tree stays planted (the trunk does not spin off its shadow). The forest behind it slides (near faster than far, near hides far). The paws thud the trunk.

Then thicken mid, elders, and collision polish.

---

## FAIL

- Mesh solids or cones in place of the Imagine cards (Iris Mere FAIL).
- Video wrapped on a coarse proxy so the ugly silhouette is the look.
- 8-face or multi-JPEG succession claimed as finished volume. Grove already rejected six JPEGs. Four faces stay the next step in Grove, not v1, and not this volume.
- Capsules without cards. It plays solid and looks like a screensaver.
- Cards without capsules. It looks deep and you ghost through the trunk.
- A heightfield or noise that paints or lifts the ground Imagine film.
- Asking Imagine for one "3D forest video" instead of the parts above.
- A Velum-class Three.js world (or Babylon, Unity, Unreal-as-world, a mesh scene) standing in for the cards. Three.js is not the world.
- Noise that draws terrain. The seed places rows. It does not paint the ground.
- Extruding the mp4.
- A depth map cooked into the video.
- One clip treated as the volume.
- An always-transparent forest. Resting cards are cutout. Blend is the dissolve only, eight at a time.
- Fading the capsule. The hit snaps. Alpha is look.

World stays Imagine Video assets. GPU composites keyed layers only. The player stays the sealed Bolt. No wallet. No player API keys. Hang URL stays `https://boltverse-odysseyyyy.grok.me`.

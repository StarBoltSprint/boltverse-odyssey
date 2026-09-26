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
| Far décor | Soft forest | Baked in the ground plate only if it stays soft and far. No near trunks in the empty-ground cook. Cheap depth. |
| Mid cards | Imagine tree, ruin, elder, or crystal stills, or 2–3 s loops | Billboards about 12–40 m. Scale by distance. |
| Near cards | The same assets, sharper | About 3–12 m. A nearer card may cover Bolt's flank. |
| Contact shadow | Dark multiply blob under the card and under Bolt | On the ground plane, at `(x, z)`. |
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

## Snippet

Remix tick: [`../scripts/jade-billboard/jadeBillboard.ts`](../scripts/jade-billboard/jadeBillboard.ts). Read [`../scripts/jade-billboard/README.md`](../scripts/jade-billboard/README.md).

Paint order each frame (`DRAW_ORDER`): sky → ground film → far décor (in the plate) → mid cards → near cards → shadows → Bolt → howl/fx.

One spawn row drives the card. `volumeOf(row)` is the capsule `(x, z, r)` into SprintCore obstacles (the return also carries `h`, `kind`, `hit`). Capsule code is not in that file. `tickCards` alone looks deep and you still walk through bark. Feed both.

Far band draws nothing. Those trees stay in the ground film. Do not billboard the horizon.

The file imports `three` so a remix can port the tick. It does not make Three.js the world. `pyre-stage` stays the WebGL composite of Imagine videos. Do not rewrite it into a Three.js world. There is no `biomes.ts` on this repo. Do not invent one. Sit the script next to the spawn table the remix already uses.

## GPU, every frame, per spawn row

1. A camera-facing quad. A cheap two-plane (bole + crown) is enough when one quad is too thin.
2. Scale from distance. Far cards get smaller. Do not stretch a far card up to fill the screen.
3. Billboard toward the camera, not all the way. About 70% face-camera and 30% planted yaw from the seed on that row, so the trunk stays rooted: `yaw = 0.7 * faceCamera + 0.3 * plantedYaw`.
4. Draw far to near. That is the occlusion.
5. Soft contact shadow on the ground plane at `(x, z)`.
6. Fog or mist so the mid band fades into the plate.

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
- A Velum-class Three.js world (or Babylon, Unity, Unreal-as-world, a mesh scene) standing in for the cards.
- Extruding the mp4.
- A depth map cooked into the video.
- One clip treated as the volume.

World stays Imagine Video assets. GPU composites keyed layers only. The player stays the sealed Bolt. No wallet. No player API keys. Hang URL stays `https://boltverse-odysseyyyy.grok.me`.

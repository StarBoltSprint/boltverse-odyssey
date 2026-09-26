# 48 — Plate tableau (Ember and Jade)

**Go 2026-09-26 (SmiR).** Kitchen only. Do not read this to the player. Do not cook the mp4s in this PR. Do not invent posters.

The plate is one **tableau**, the way the Ember reference film is one picture. It is not a canvas ground plus a canvas sky waiting "until later." When the real films land, the canvas plane is thrown. Leaving that plane up is FAIL.

One cook is one biome. Ember and Jade share this kitchen. Only the palette changes. Blood moon and noon moss do not share a frame.

Law [46](46-four-picture-jobs.md) names the jobs. Law [47](47-jade-sheet-cook.md) cooks the near and mid cutouts. Law [54](54-path-noise-valley.md) is the shader `d`. This law is the room. No mp4 and no jpg ship here. Do not rewrite `pyre-stage`. Three.js is not the world.

Prompts: [`../scripts/jade-lod/PLATES.md`](../scripts/jade-lod/PLATES.md). Projection: [`../scripts/jade-lod/plates.ts`](../scripts/jade-lod/plates.ts).

---

## Two biomes

| | Ember | Jade |
|---|---|---|
| Key | blood moon, lava gold | late-day gold, cyan bounce |
| Ground | cracked basalt, luminous cracks | wet moss, roots, no paving |
| Sky | moon + red vault + unreadable spires | canopy-filter mist, 2–3 distant blobs |
| Path | the crack is the film's feel; the engine tints with `d(x,z)`. No baked road | shader tint on `d`. No baked path |
| Far | towers in the plate | distant woods in the plate. Not 96 3D crosses |

---

## Files

`biome` is `ember` or `jade`.

```
public/decor/<biome>/plates/<biome>_ground.mp4
public/decor/<biome>/plates/<biome>_ground_poster.jpg
public/decor/<biome>/plates/<biome>_sky.mp4
public/decor/<biome>/plates/<biome>_sky_poster.jpg
```

Loop 8–10 s. First frame matches the last. Muted. Zero camera in the clip: no truck, no dolly, no yaw.

Ground is 2048² and tileable. Sky is 2048×1024 lat-long, or a 2048² dome. 9:16 is the player frame. It is not the world UV. A 9:16 ground used as a tile stripes. That is FAIL.

The poster is frame 0. The engine shows it until the mp4 decodes. This repo does not bake those jpgs.

---

## What may live in the plate

Ground, yes: grain, micro-relief, wet sheen or lava sheen, décor pebbles with no collision, a slight light crawl. Ember cracks may glow. They do not have to run straight south. Jade is moss. No readable near trunks.

Sky, yes: vault, horizon, and two or three masses you cannot count. Ember has one moon, locked to the same azimuth for the whole loop. A moon that drifts means the dome is lying. Gothic spires are silhouettes. They are not land. Jade has no blood moon.

Far may live in the plate. Near must not. A near trunk in the film plus a seeded bole is a double forest.

Forbidden in both: wolf, dog, Bolt, UI, text, a paved path, a near trunk, a crystal, a ruin, a second sun, a truck, yaw inside the clip.

---

## Light lock

The same phrase on both prompts of a biome. Sheets copy it verbatim.

Ember: `blood-red moon locked upper-center, volcanic dusk, lava key from the cracks, cool ash fill, no second sun, no daylight`

Jade: `late-day gold key upper-left, cool cyan canopy fill, no second sun, no blood moon, no noon`

Horizon cousins. The sky's bottom 10% matches the ground's far edge. Ember is ash-red. Jade is drowned gold-green. A teal lid on a gold ground is FAIL.

---

## Travel

The mp4 may breathe: grain, ember, moss wind. It is not a highway. A 360 field plus a strong travel makes the sheets skate.

Engine UV, and only this crawl:

```
u = worldX / 24 + 0.015 * sin(pictureTime * 0.12)
v = worldZ / 24
```

`0.015`, not `0.08`. `pictureTime` is the sim clock. Pause freezes the UV. `Date.now` is FAIL.

The sky follows camera xz. Yaw only. Pitch stays 0. Do not nod the dome to look at the moon.

---

## Parentage

```
skyDome     radius 90–120, center = camera xz, yaw = camYaw, pitch 0
groundPlane y = 0, world UV, MediaTexture
kits        siblings, y = h(x,z)
bolt        sibling, the keyed gallop
```

Nothing is a child of the video mesh. Do not warp the film mesh with the heightfield. Posture stays law [50](50-heightfield-posture.md), on the kits, not on the mp4.

When the plate carries the far grove, the far chair goes to 0. The 3D crosses stay silent. Near and mid sheets only. The planted cross is the lab stand-in, before this film exists (law [49](49-two-plane-tree.md)). Ninety-six impostors in front of a plate already full of woods is FAIL.

The path is still `smoothstep(d)` on albedo. Ember glows (the inverse of 0.72). Jade darkens (`0.72`). No paving in the mp4. The valley page stays law [54](54-path-noise-valley.md).

---

## FAIL

- A canvas plane left up after the tableau lands.
- 96 impostors in front of a plate that already holds the woods.
- Sprint travel baked into the mp4.
- A moon that drifts across the loop.
- A 9:16 ground used as the tile.
- UV driven by `Date.now`.
- Bolt in the plate for beauty.
- Blood moon in a Jade cook, or noon moss in an Ember cook.
- A near trunk, a crystal, a ruin, a paved path, text, or UI in either film.
- A second sun. A camera move. Yaw inside the clip.
- Cards parented to the video plane. A heightfield warp on the film mesh.

---

## Done-when

Later cook. This repo does not run it and does not ship the files.

Stand still. The grain may breathe. The near cards do not skate. Walk a circle. The floor is world UV, not a filmed sprint. The sky yaws and does not nod. Ember's moon stays put. Jade's horizon is drowned gold-green, not a teal lid. Far towers or far haze sit in the plate. No cross instances stand in front of them. Pause freezes the UV.

World stays Imagine Video assets. The player stays the sealed Bolt. No wallet. No player API keys. Hang URL stays `https://boltverse-odysseyyyy.grok.me`.

# 48 — Jade plate cook

**Go 2026-09-26 (SmiR).** Kitchen only. Do not read this to the player.

Plates are the **room**, not the furniture. Ground is the dirt you stand on. Sky is the lid. Anything you might thud belongs on a sheet, never in these films.

Law [46](46-four-picture-jobs.md) names the picture jobs. Law [47](47-jade-sheet-cook.md) cooks the cutouts. This law cooks the empty room. No mp4 and no jpg ship here. Do not rewrite `pyre-stage`. Three.js is not the world.

Prompts: [`../scripts/jade-lod/PLATES.md`](../scripts/jade-lod/PLATES.md). Projection: [`../scripts/jade-lod/plates.ts`](../scripts/jade-lod/plates.ts).

---

## Files

```
public/decor/jade/plates/jade_ground.mp4
public/decor/jade/plates/jade_ground_poster.jpg
public/decor/jade/plates/jade_sky.mp4
public/decor/jade/plates/jade_sky_poster.jpg
```

Optional `jade_ground_still.jpg` if the video is late. The engine may crawl that still with the same UV. That is legal.

Loop 6–10 s. First frame matches the last (MAE). Muted. No camera truck, dolly, or yaw inside the clip. The pawn owns travel.

Ground is 1920² or 2048², square. Sky is 2048×1024 lat-long. A cube can come later. A 9:16 frame as the floor is FAIL.

Posters are the first frame. The engine shows the poster until decode.

---

## What may live in the plate

Ground, yes: moss grain, fine roots, wet sheen, tiny décor stones, light crawl, mist texture, path tone (flatter moss color — not a modeled road, not curbs).

Sky, yes: canopy-filtered late-day, distant haze, two or three **unreadable** far blobs, gold rim, cyan vault.

Neither: a near bole, a readable tree, a ruin, a crystal, a fern, path tiles, Bolt, horizon props into card space, baked tree shadows that will also spawn.

Far blobs are the cull band. If you can count branches, the blob is too near. Recook.

---

## Light

The same hour as the bole sheets. Late-day. Gold key, upper left. Cyan fill. The ground's outer edge and the sky's lower 10% are cousins. A bright gold floor under a teal lid is FAIL.

---

## Runtime

Ground is one big plane, or a shallow dish of about 2–3%. UV:

```
u = worldX / TILE + 0.02 * sin(pictureTime * 0.15)
v = worldZ / TILE
TILE = 24 m
```

`pictureTime` is the sim clock, the same family as fade `dt`. Pause freezes the UV. Never `Date.now`. If the floor skates under a bole, the amplitude is too high or a sprint was baked into the mp4.

Sky is a sphere or hemisphere, radius about 80–120 m. The center follows camera xz. y stays locked. `sky.rotation.y = camYaw`. `x` and `z` rotations stay 0. No pitch.

Optional roots pass: the same ground mp4, `TILE * 1.7`, opacity 0.18–0.22, `y = heightfield - 0.08`, depth write off.

The visual ground mesh can stay flat. The pawn and the cards sit on `h(x,z)`, 20–40 cm, from law 46. Do not warp the video mesh with the heightfield. If a dish comes later, UV still comes from world XZ.

No stone road in the mp4. Flatten `h` and skip spawns inside `pathHalf`. An optional shader tint may darken `|x| < pathHalf`. Painted curbs fight a bending path.

Parenting: `skyDome`, `groundPlane`, `groundRoots`, `kits[]`, Bolt. Kits are siblings of the plane. They are not children of the video mesh. `y = h(x,z)`.

The plate is not a spawn map. Bright pixels are not trees.

---

## FAIL

- A rushing highway.
- Near trunks in the floor.
- A sky with a landable cliff.
- Camera move inside the clip.
- Scroll driven by `Date.now`.
- A 9:16 floor.
- Sheets, ground, and sky from different hours.
- Cards parented to the video plane.
- The plate used as a spawn map (CV, or a bright pixel meaning a tree).

---

## Done-when

Later cook. This repo does not run it.

Stand still: moss may breathe. Cards do not skate. Walk a circle: the floor moves with you. It is not a filmed sprint. The sky yaws and does not nod. There is no lid seam. There is no ghost trunk under a sheet. Pause: the UV freezes.

World stays Imagine Video assets. The player stays the sealed Bolt. No wallet. No player API keys. Hang URL stays `https://boltverse-odysseyyyy.grok.me`.

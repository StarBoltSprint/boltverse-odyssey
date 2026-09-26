# 43 — Open ground (four skies, one tile, horizon without strokes)

**Sealed 2026-09-25 (SmiR).** The forest. Same rig as the lava plain. Not a lane.

Paste: [`COLD_START-open-ground.md`](COLD_START-open-ground.md)

This is the method that made the forest match the plain. A cold Grok copies it. Do not invent a second sky.

**Shaders sample Imagine videos.** Sky and ground are cooked mp4s. The shader is a sampler and a composite of those videos. It does not invent the sky or the ground. Three.js, or any other language or engine as the world, is FAIL. Same lock as the top of [`COLD_START-biome-method.md`](COLD_START-biome-method.md).

---

## What it is

An open biome. No road, no three lanes, no dashes.

| Layer | What | Where |
|---|---|---|
| Sky | Four portrait videos, camera locked. Crossfade on yaw. | Drawn first, full width, `SKY.band` |
| Ground | One top-down video, tiled. Same yaw as the sky. | After the sky, `SRC_ALPHA` |
| Bolt | `bolt-native.mp4` at rate 4, `bolt-breath.mp4` idle. GPU key. | On top. `uGrove = 1` |

The sun lives in **one** sky face (`sky-0`), the way the moon lives in one face on the plain. It is not a sticker. Clouds are in the sky videos. An empty gradient plus keyed cards looks cheap and the loop shows.

Swipe sideways turns **sky and ground together**. One `orbit`. If only the ground turns, the sun stays glued.

---

## Not the lane

Laws [20](20-default-plate-proportions.md), [23](23-plate-geo-qc.md) and [24](24-camera-1point.md) are the **3-lane cone**. Horizon there is 0.38 because that is where the dashes vanish. `plate-geo-qc.py` looks for three dash tubes.

**Do not run that script on this ground.** There are no dashes. It will FAIL a good tile. Do not replace this dirt with a road ribbon. The player already rejected that.

φ is an audit on the lane. Do not put φ, `0.618`, or a UV table in an Imagine prompt.

---

## Cook

Four skies, 9:16, camera locked, no Bolt, no canopy, no zoom, no dolly.

1. Still `sky-0`: blue sky, sun in the upper third, clouds with volume. This face owns the sun.
2. Stills `sky-1` `sky-2` `sky-3`: the same sky, turned. No second sun. Match the horizon height of `sky-0`.
3. Image-to-video each still. Locked camera. Clouds drift. The sun does not travel across the frame.
4. Ground still: flat packed dirt, no relief, edges that tile, grain visible. Not a photograph of a field with a horizon in it.
5. Image-to-video that still. Locked overhead camera. A little dust. No bumps appearing.

Compress before hang:

```
ffmpeg -y -i in.mp4 -an -vf scale=720:-2 -c:v libx264 -pix_fmt yuv420p -crf 18 -movflags +faststart out.mp4
```

Dirt can be square (`720:720`). Skies stay portrait.

Load nothing at boot. `preload="none"`, `dataset.src`, arm the four skies and the dirt only when the player enters the biome. Preloading every clip freezes the phone on the menu.

---

## Draw (do not retune the plain)

Shared, already in the vista. Leave these. The lava plain uses them.

```
SKY.faces = 4
SKY.span = 0.7
SKY.fadeDeg = 74
SKY.moonBottom = 0.35
SKY.lead = 0.55
SKY.band = 0.76
SKY.v1 = 0.9
groundHorizon = 0.36
groundFade0 = 0.26
groundFade1 = 0.35
tile = fract(world * 0.18)
seam = smoothstep(0.92, 1.0, edge)   // outer 8% only
```

Sky quad: `quad(0, 0, 1, band)`. `uWrap = 0`. Face pick:

```
ang = fract(0.125 - orbit / TAU)
slice = ang * 4
faceA = floor(slice) % 4
```

Fade the next face only in the last `fadeDeg` of the quadrant. Smoothstep, not a cut.

Ground projection (both biomes):

```
dy = max(0.02, horizon - vUv.y)
depth = 0.72 / dy
```

`uYaw` is `orbit`. Travel is `worldX` / `worldZ`, not a scalar scroll after the yaw.

**Plain** (`uFlat = 0`): `alpha = sharp * intoSky`. Do not touch it. Lava and the red sky are the same darkness, so that fade is enough.

**Open ground** (`uFlat = 1`, only when this biome's dirt video is the plate):

```
dist = clamp((horizon - vUv.y) / horizon, 0, 1)
dyScreen = horizon - vUv.y
stretch = max(length(dFdx(p)), length(dFdy(p)))
grain = (1 - smoothstep(0.004, 0.05, stretch)) * smoothstep(0.03, 0.07, dyScreen)
earth = lit color from earth_color.py on this ground video
col = mix(earth, stone, grain)
near = 1 - smoothstep(0.0, 0.22, dist)
col = mix(col, vec3(0.72, 0.82, 0.92), (1 - grain) * near * 0.92)
alpha = smoothstep(0.0, 0.055, dist)
```

Forest earth that shipped: `vec3(0.335, 0.295, 0.216)`. Recompute for a new ground. Do not reuse the forest number on lava or snow.

---

## The vertical brown strokes

`dy` is clamped at `0.02` so the ground does not explode. Inside that clamp, depth is constant, so `stretch` falls back to 0. The shader thinks the tile is sharp and samples it. Each screen column locks onto one texel and paints it down the last strip. A dark pebble becomes a short vertical brown stroke. A row of them is a comb on the horizon.

`smoothstep(0.03, 0.07, dyScreen)` forces `grain` to 0 through the whole clamp and a little past it. That strip is one flat earth color, then the sky. Grain under Bolt stays, because there `dyScreen` is large and `stretch` is small.

Do not "fix" the comb by deleting the `0.02` clamp. Depth blows up and the ground tears. Do not trust `stretch` alone inside the clamp. It lies.

---

## Bolt

GPU key, already in `BOLT_FS`. Do not recook Bolt for a new open biome.

```
greenness = g - max(r, b)
alpha = 1 - smoothstep(0.16, 0.38, greenness)
if (greenness > 0.36) discard
```

Run clip `bolt-native.mp4`, `playbackRate = 4`. Idle `bolt-breath.mp4`, rate 1. In this biome `uGrove = 1`, which kills the lava tint (`lava = 1 - uGrove`). A forest Bolt with a red belly is the plain shader left on.

---

## FAIL

- A Three.js, Babylon, Unity, Unreal, Vite/TS, or procedural shader world in place of the Imagine sky and ground videos. The shader samples those mp4s. It is not the world.
- Empty blue video plus a sun sticker and a cloud sticker.
- A canopy, or a sky video that already contains the ground.
- One looping film that zooms when he runs. The loop reads as reverse.
- Painting the whole floor toward blue (`haze` over `dist` 0.14). The player said the ground went blue.
- A wide invented gray (`near` past `0.22`, or mix above `0.92`) that is not the sky. It reads as a shelf.
- Letting `grain` return where `dy < 0.03`. The brown comb comes back.
- Running `plate-geo-qc.py` here, or hanging a 3-lane plate under this sky.
- Preloading every sky and every orbit JPEG at boot.
- Changing `groundHorizon`, `SKY.span`, or the plain's `sharp * intoSky` to "match" this biome.

Related: [VISTA](../../VISTA.md) is the plain this copies. [24](24-camera-1point.md) is the other camera. Do not mix them.

Volume on this ground (collision capsule + look cards) is [44](44-imagine-volume-stack.md). This law stays the four skies and the tile.

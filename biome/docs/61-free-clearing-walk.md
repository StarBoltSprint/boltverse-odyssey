# 61 — Free-360 clearing walk

> **Superseded by [`docs/METHOD.md`](../../docs/METHOD.md)** in part: relief amplitude, single-material ground and upright rock cutouts (see METHOD ground + organic objects rows). Kept for history; not deleted.

Kitchen only. Not a hang. Not a new play URL. Phone QC **2026-10-01**, Rocky Clearing.

Invisible shape is the [2026-10-01 extension of law 59](59-invisible-depth-carrier.md#extension-2026-10-01-invisible-procedural-terrain-shape). Code computes the plane, the relief, the tile layout, collision, and placement. Every visible pixel is Imagine. The relief panorama, the far ring, and the hull command stay [doc 60](60-imagine-relief-panorama-method.md). This file is the walk that passed.

| Piece | Take | Status |
| --- | --- | --- |
| Free-360° clearing walk | 3 | **KEEP** |
| Clearing edge (fog + opening) | 4 | **IN PROGRESS** |
| Bolt idle breath | 4 | **KEEP** |

Law [43](43-open-ground.md) keeps its forest tile and `bolt-breath.mp4`. Law [58](58-void-orbit-closed-shell.md) keeps `bolt-breath.mp4` and `bolt-gallop.mp4`. Those sealed clips stay on those biomes.

## Walkable ground — KEEP (take 3)

Walkable ground is **world-locked** top-down Imagine ground tiles, about **0.90 m**, laid on an invisible height relief. The tiles stay on that relief while the camera walks.

Code computes only the invisible shape:

- the ground plane
- the height relief
- the tile layout
- collision
- placement

Code never draws, shades, or colours a pixel. Lighting stays baked in the Imagine pixels.

The tiles are Imagine stills at true world scale. Law 59 asks for **≥ 4** variants. Tile edges sit at height **0**. Relief amplitude stays the law 59 range: a few centimetres up to **~15–25 cm**.

The **360° Imagine ring** is the far backdrop only (sky and ridges). It is not the walkable ground. It stays put when Bolt walks.

## Rocks

Rock cutouts are Imagine images. Simplex **places** them. Placement only. Law 59 also allows a **90°** rotation. Simplex does not draw the rock.

- Dusk-grade the cutout to the scene. The grade is the Imagine pixels, matched to the dusk. It is not a new paint.
- Contact darkening and shadows come from Imagine pixels, baked into the Imagine asset or a keyed Imagine shadow card. Never code-drawn.
- The base snaps to the relief height.

## Boulders

A boulder is a **closed invisible hull**. The hull never draws its own pixels.

Preferred build: **8** Imagine views, then [`tools/walkaround/build.py`](../../tools/walkaround/build.py) (PR **#127**). The command and the silhouette lock are in [doc 60](60-imagine-relief-panorama-method.md#script).

Weaker fallback: one photo, a depth map, and a mirrored back. The back is mirror-symmetric. The sides are a thin seam. Cook the 8 views when the boulder has to be walked around.

Budget stays **2–3** walk-around objects per clearing.

## Quality lock

Magnification **≤ 1.0** at portrait **720×1600**. Measure it. Show that number on the HUD. The phone reads the same number.

| | HUD | Phone |
| --- | --- | --- |
| Take 3 KEEP | **0.979** | **0.979** |

### Attempt 1 — FAIL

One relief still is not the floor. Past about **4 cm** of travel it upscales (law 59, [doc 60](60-imagine-relief-panorama-method.md#walkable-ground-2026-10-01)). Freezing that still to the camera, so it would not upscale, left the ground stuck: the HUD distance changed and the image did not. The HUD showed magnification **0.406**. The claimed figure was **0.990**.

A stuck ground, and a HUD magnification that does not match the claim, are FAIL. Take 3 replaced that still with the world-locked tiles above.

## Watch-outs (phone QC)

- Patchwork tile seams, and the same tile repeating.
- Rocks brighter than the dusk.
- Green key fringe on the paws. Despill the same way as the gallop on that plate ([doc 60](60-imagine-relief-panorama-method.md) sandbox key, or law [17](17-live-compositor.md) on the lane compositor).
- Uniform ground. Add mid-size stones: Imagine cutouts, simplex placement.
- Floating cutouts. Snap the base to the relief.

## Paths between clearings

A scrolling, speed-synced Imagine ground **video** is the **fixed straight path** between clearings. That video works in one direction.

A free 360° clearing uses the tile method in this doc. The scrolling video is the path, not the clearing floor.

## Clearing edge — IN PROGRESS (take 4)

Dress the border with Imagine rocks and boulders, plus a looping keyed Imagine Video of ground fog.

The fog is soft, dusk-graded, wide feathered alpha, low opacity. Hard-edged streaks are FAIL.

Collision follows the border. One opening, framed by two boulders, is where the fixed path to the next clearing starts.

Take 4 phone QC, fix pending:

| | Result |
| --- | --- |
| Fog | **FAIL** — hard blue-white streaks |
| Near mid-stones | **FAIL** — blurry, semi-transparent |

Leave this edge unhung until that fix passes. The take 3 walk above stays KEEP.

## Bolt idle breath — KEEP (take 4)

A stop plays an idle breathing loop. A frozen frame is FAIL. The gallop left running at speed 0 is FAIL.

The loop: the chest rises and falls, the tail sways slowly, the ears twitch a little.

Asset: `lock/bolt-idle-breath.mp4`. Imagine Video, cooked by Grok Build from the same Bolt as [`lock/bolt-gallop-cycle.mp4`](../../lock/bolt-gallop-cycle.mp4). Same wolf, back view, scale, and lighting. Seamless loop. Keyed the same way as the gallop.

The gallop file is unchanged. This KEEP does not license a new gallop. Only SmiR replaces `lock/bolt-gallop-cycle.mp4`.

On this walk Bolt moves through the clearing, so the gallop playback rate follows his speed. The lane treadmill still plays the sealed cycle at **1×** (law [15](15-gpu-compositor.md)). Plate scroll is that lane's speed. This doc does not retune the gallop clock.

### State machine

| Speed | State |
| --- | --- |
| above a small threshold | **GALLOP**. Playback rate follows speed. |
| about **0** for **~0.25 s** | **IDLE** |
| crossfade | **0.25–0.35 s** |

- The feet stay on the same ground contact point.
- Screen position and scale stay put through the crossfade.
- Turning in place while stopped stays **IDLE**.
- The HUD shows `bolt IDLE` or `bolt GALLOP`.

### Keyed video

Bolt stays a keyed video. He is animated. A rigid hull of Bolt is a sliding statue, and it is FAIL (law 59 Bolt lock). `tools/walkaround/build.py` is for boulders.

A later cook that must show him from other angles would use this same gallop, cooked from **8** directions and switched by camera angle. That option is not approved. Do not cook it from this doc.

## Do not

- Draw, shade, or colour the ground in code.
- Freeze one relief still to the camera and report magnification 0.99 while the HUD reads something else.
- Lay the clearing floor as the one-direction scrolling ground video.
- Hang the clearing edge while the fog is hard streaks.
- Invent a new gallop, or put Bolt on a hull.
- Swap law 43 or law 58 clips for `lock/bolt-idle-breath.mp4`.

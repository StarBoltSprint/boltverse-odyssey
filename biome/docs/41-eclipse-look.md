# 41 — Eclipse look (hidden 3D, videos unchanged)

Cook gate. Only the **eclipse** plate (biome index 3 in law [40](40-nebula-cycle.md)).

The plate is a video. The pixels beside the frame do not exist. A free orbit would mean throwing the plate away. Do not.

What works: a 3D camera that is **off** on nebula, shore, and disk (`uYaw = 0`, the fullscreen quad is exactly the old clip-space quad). On eclipse it wakes. The same videos are planes in front of that camera.

## What the player does

| Gesture | Result |
|---|---|
| Drag left / right | Yaw. Threshold 16 px, and the drag must be more horizontal than vertical. |
| Release | Yaw eases back to 0. Do not leave the player stuck looking sideways. |
| Tap | Still changes lane. A drag sets `used` so the tap does not also slide. |
| Swipe up / down | Jump / howl, unchanged. |

`look` is −1…1 = `dx / (viewportWidth * 0.42)`, clamped. `uYaw = look * 0.62` radians. Ease toward the finger at 14/s, back to 0 at 3.2/s.

A start gate (two buttons, clock frozen until a choice) may jump straight to eclipse (`biomeIdx = 3`) or start at nebula. The run does not advance while the gate is up.

## Scene

Camera at the origin, looking down −Z. Vertical half-angle tangent `tanY = 0.42`. `tanX = tanY * (canvasWidth / canvasHeight)`.

The road is a plane at `z = −1` sized to fill that frustum. At yaw 0 it covers the screen and matches the old compositor. Yaw rotates the plane. The part of the screen it leaves is black until the sky is drawn.

Two planet videos, law 39 clean key, pure black, 1:1, 720p, 6 s, slow spin, copper rim, no stars in the clip (the sky draws the stars):

| Card | `uCard` | World yaw of the card | What |
|---|---|---|---|
| Ice | 1 | −0.66 rad | left |
| Gas giant | 2 | +0.66 rad | right |

Both sit at distance 1.2, billboarded toward the origin, half-height `tanY * dist * 0.82`. At yaw 0 they are outside the frustum. A full drag faces one of them. Stop the yaw before the card's edge shows. A planet video is a flat card. Past the edge it is a rectangle.

Bolt, crystals, globules, prints, and the howl use the **same** yaw on their clip-space rects, so they stay glued to the road plane. Do not also shift them in pixels. Do not also offset the road UV (`uLook` stays 0). One motion, or the paws leave the lanes.

Draw order when `|yaw| > 0.001`:

1. Clear black.
2. Sky (below). Fullscreen. Opaque.
3. Planet cards. Premultiplied. Clean key.
4. Road plane. Opaque. It covers the sky where the plate still is.
5. The rest of the compositor, yaw on, `uCard = 0`.

## Sky

Not a video. A fullscreen shader. The ray is the pixel. Inverse-yaw that ray so the stars are fixed in the world and slide when the head turns. Cold-white stars, a few copper, a slow twinkle, a faint dust band. Draw it only while yaw is awake, so the other biomes never see it.

## Vertex rule

`|uYaw| < 0.0008` and `uCard == 0` must `return` the old `gl_Position = vec4(ndc, 0, 1)`. If that early-out is missing, nebula, shore, and disk drift.

## Do not

- Turn this on for nebula, shore, or disk.
- Replace the plate with a mesh road.
- Pan the video UV and yaw in the same frame.
- Put stars inside the planet mp4. Keying keeps the bright ones and they stick to the card.
- Yaw past the card edge.

## Runtime

`biome/scripts/eclipse-look/eclipseLook.js` — the numbers. Paste: [COLD_START-nebula-lane.md](COLD_START-nebula-lane.md).

## Related

[24](24-camera-1point.md) · [39](39-imagine-live-light.md) · [40](40-nebula-cycle.md)

# 42 — Shoulder panorama (any biome)

Cook gate. Use this on **the biome the player is already playing**, after the road plates exist. Do not recook Bolt. Do not recook the road. Do not turn on law [41](41-eclipse-look.md) yaw for this. Yaw and this panorama never run in the same frame.

The road video stays the road video. Two more Imagine videos sit beside it: the world to the left, the world to the right. A drag looks. A flick still changes lane. From the outer lane, one more flick steps onto a single luminous path. That path is the only thing that scrolls on the shoulder. The vista behind it stays the wing video.

## What the player does

| Gesture | Result |
|---|---|
| Flick, under 150 ms or under 32 px | Lane change. Left third / right third of the screen still counts as a tap-lane. |
| Finger held ≥ 150 ms and ≥ 32 px, more horizontal than vertical | Look only. `used` is set so the release does not also change lane. |
| Release the look | `look` eases back to 0. Rate **10/s**. Not 3.2. 3.2 left the side plates on the edges for seconds. |
| Already on the left lane, flick left again | Board the left shoulder. Look locks to −1. Bolt tweens to `x = -1`. |
| Already on the right lane, flick right again | Board the right shoulder. Look locks to +1. Bolt tweens to `x = +1`. |
| Flick back toward the road | Leave the shoulder. Bolt returns to that outer lane (`±LANE_W`). |
| Swipe up / down | Jump / howl, unchanged. |

`look` is −1…1 = `dx / (viewportWidth * 0.42)`, clamped. Ease toward the finger at **14/s**. While boarded, ease at **9/s** and do not accept a new look-drag (`boardRef` blocks it).

Debounce `go()` by 90 ms. A touch and a pointer both fire.

## Wings

One left video, one right video. 9:16. Same exposure and the same color words as **this** plate (law [31](31-light-lock.md) and [39](39-imagine-live-light.md)). Extract one frame of the live plate. Image-to-video from that frame.

| Wing | The road is | The frame is |
|---|---|---|
| Left | off the **right** edge | the world beside the road, on the left |
| Right | off the **left** edge | the world beside the road, on the right |

Lock the horizon. The bright line of the wing must sit at the same fraction of the frame as the road plate (about `y = 0.58` on Nebula Lane). If it does not, the seam is a step, not a fade.

Prompt shape:

> Continue this exact frame. Same camera height, same horizon, same exposure, same colors. The road is now off the right edge. Fill the frame with the world beside the road: [one sentence of this biome]. No extra lanes. No text. No mirror of the road. The world rushes toward the camera the way the road plate does.

Play both wings only while this biome is on screen or about to fade in. If either video is not `readyState >= 2`, force `uGlance = 0`. A missing wing is a black slab.

## Shader

`uGlance` is `look`. The fragment does the rest. Copy the block. Do not "improve" it with a fog veil.

```glsl
float mag = abs(uGlance);
float open = smoothstep(0.10, 0.48, mag);
float shift = uGlance * open;
float ruvx = screen.x + shift;
float sy = clamp(screen.y, 0.001, 0.999);
float floorK = 1.0 - smoothstep(0.38, 0.66, sy);
float seam = mix(0.20, 0.48, floorK);
float cover = smoothstep(0.012, 0.10, abs(shift));
float wSideL = ruvx < 0.0 ? 1.0 : (1.0 - smoothstep(0.0, seam, ruvx)) * cover;
float wSideR = ruvx > 1.0 ? 1.0 : smoothstep(1.0 - seam, 1.0, ruvx) * cover;
vec2 ruv = vec2(clamp(ruvx, 0.001, 0.999), sy);
vec3 rc = mix(texture2D(uRoad, ruv).rgb, texture2D(uRoadB, ruv).rgb, uMix);
float intoL = clamp(max(ruvx, 0.0) / max(seam, 0.001), 0.0, 1.0);
float sideLU = mix(ruvx + 1.0, 0.78, intoL);
float intoR = clamp(max(1.0 - ruvx, 0.0) / max(seam, 0.001), 0.0, 1.0);
float sideRU = mix(ruvx - 1.0, 0.22, intoR);
sideLU = clamp(sideLU, 0.001, 0.999);
sideRU = clamp(sideRU, 0.001, 0.999);
vec3 lc = texture2D(uSideL, vec2(sideLU, sy)).rgb;
vec3 qc = texture2D(uSideR, vec2(sideRU, sy)).rgb;
lc = ridePath(vec2(sideLU, sy), uOnL, uFlowL, lc);
qc = ridePath(vec2(sideRU, sy), uOnR, uFlowR, qc);
road = mix(rc, lc, clamp(wSideL, 0.0, 1.0));
road = mix(road, qc, clamp(wSideR, 0.0, 1.0));
```

Why these numbers:

| Piece | Why |
|---|---|
| `seam` 0.20 in the sky, 0.48 on the floor | The sky join is short. The floor join is wide, where the lanes meet the fog. |
| `cover` | Side weight is 0 the moment `shift` is ~0. Without it, the left and right edges of the screen stay on the wing for the whole ease-out, because `ruvx` is still near 0 or 1 there. |
| `sideLU` pulled toward 0.78, `sideRU` toward 0.22 | The seam samples real fog, not the single edge column. Clamping `ruvx` and blending that column is a vertical smear down the sky. |
| `open` | A tiny look does not slide the road. The slide starts after 0.10 and is full by 0.48. |

Bolt's screen X uses the same open curve, or the paws leave the lanes:

```js
const u = Math.min(1, Math.max(0, (Math.abs(pan) - 0.10) / 0.38));
const open = u * u * (3 - 2 * u);
const slide = -pan * open * canvasWidth;
```

`uYaw` stays 0 while this is on. `uLook` stays 0. One motion.

## The shoulder path

One ribbon, not three lanes. It is drawn in the wing's UV by `ridePath`. It does not exist as a second road video.

| State | What you see |
|---|---|
| Looking, not boarded (`uOnL` / `uOnR` = 0) | The wing. A faint core on the ground. The wing does **not** scroll. |
| Boarded (`hot` → 1) | That core is replaced by a perspective sample of the **live** road textures (`uRoad` / `uRoadB`, same `uMix`). The shoulder rushes. Dashes move with `flow`. |

```glsl
float along = clamp((0.58 - suv.y) / 0.50, 0.0, 1.0);
float persp = pow(max(along, 0.001), 1.35);
float halfW = mix(0.016, 0.17, persp);
float roadY = mix(0.54, 0.045, persp);
float roadX = clamp(0.5 + (suv.x - 0.5) * 0.36, 0.30, 0.70);
vec3 plate = mix(texture2D(uRoad, vec2(roadX, roadY)).rgb,
                 texture2D(uRoadB, vec2(roadX, roadY)).rgb, uMix);
```

Flow accumulates **only while boarded**: `flow += dt * 0.72`, wrapped to 0…1. `uOn` eases at 5/s. Do not run the three-lane hazard spawner on `x = ±1`. Crystals and globules stay on the road. Drop the board when the biome fade starts and snap Bolt back to `lane * LANE_W`.

## Do not

- Bake a panorama. A stitched still, a V-mirror, or a multi-band blend of two frames leaves a hard vertical line. The mix is runtime, in the shader above.
- Add a mist veil on the seam (a `4 * w * (1 - w)` fog). The player rejected it. It reads as a pale band. The kept mix is the table above.
- Repeat the road's edge texel across the join. That is the vertical streak.
- Leave the return rate at 3.2. The side plates linger.
- Treat a 16 px drag as a look. It eats the lane flick. Look needs 150 ms **and** 32 px.
- Scroll the wing video itself. Only `ridePath`'s sample of the road scrolls, and only while boarded.
- Draw a white beam and call it the path. The path is the road plate, in perspective, one lane wide.
- Run law 41 yaw in the same frame. Eclipse keeps yaw and planet cards. This law is the three-video panorama.
- Put the shoulder on a biome whose wings are not cooked. `uGlance = 0` until both videos are ready.

## Runtime

[../scripts/shoulder-panorama/shoulderPanorama.js](../scripts/shoulder-panorama/shoulderPanorama.js) — the numbers and both GLSL blocks.

## Related

[12](12-lane-path-ribbon.md) · [31](31-light-lock.md) · [39](39-imagine-live-light.md) · [41](41-eclipse-look.md)

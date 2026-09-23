# COLD START — GPU light layers + openable objects (clés en main)

Read `biome/docs/38-gpu-light-openable.md`. Runtimes: `biome/scripts/gpu-light/gpuLight.js` and `biome/scripts/gpu-openable/gpuOpenable.js`. Run `node biome/scripts/gpu-light/demo.js` and `node biome/scripts/gpu-openable/demo.js`.

## **GPU is REQUIRED.**

Light layers (beam / glow / neon / flash), openable states (door / chest / generator / crystal hatch), path beat, Lena LOD bibs, Howl, and Bolt are **GPU keyed layers composited OVER densify Video A**.

Densify stays the **clean looping 3-lane plate**. It keeps base ambience (law 31). Imagine Video A does not receive playable lights, open doors, chests, generators, hatches, transitions, or content spawns.

**FAIL if Build paints a beam, a glow, an open door, a chest, a generator, or a hatch into Video A instead of the GPU.** `frame.gpu` is `true`. `frame.composite` is `"over-densify"`. `frame.bakeIntoDensify` is `false`. `frame.hud` is `false`. `frame.raytrace` is `false`. `assertLightNative` returns `"baked into densify"` or `"GPU"` if you break the light. `assertOpenableNative` returns `"baked into densify"`, `"painted open"`, or `"GPU"` if you break the prop.

This is composite + states. Same cone as Howl, Lena, and the path beat (`howlPose`). No second geometry stack.

## Pack RT — baked look, then a fake interactive overlay

Imagine has no real-time raytracing API. Do not claim one.

1. **Baked RT look.** Densify Video A and every light/openable bib must **look** path-traced. Soft GI, reflections, soft contact shadows, already in the pixels. `rtLook` is `"baked-imagine"`. **FAIL if the plate is flat plastic lighting.**
2. **Fake interactive RT.** When `lightLayerFrame` changes intensity, or `openableFrame` opens a prop, draw the keyed light and `glossOverlay` on that light’s `pose.dest`. `gradeFromPlate`. `fakeInteractive` is true. `bounces` is `0`. This mimics a response. It is not a ray bounce.
3. **Explicit FAIL.** Claiming **real-time raytracing via Imagine** is FAIL (`raytrace` or `realtimeImagine`). Baking those interactive lights into densify Video A is FAIL. True RT is the other rail (UE), **HOLD**. `trueRt` is `"ue-hold"`. Do not cook UE here.

Paste these lines into Imagine:

- Densify: `Path-traced look baked into the pixels: soft global illumination, reflections in the lane, soft contact shadows. Not flat plastic lighting. Not a real-time raytracer.`
- Light bib: `Only the light, on pure black. Soft falloff, soft bloom, a faint reflected tint. Path-traced look in the pixels. Not flat plastic. No road.`
- Openable bib: `The prop looks path-traced: soft GI, a soft contact shadow, a reflection in the lane. Keyed. Not flat plastic. Not a real-time raytracer.`

Densify Video A stays a **SuperGrok session** Imagine Video with **first + last** pinned. Build does not drive that session. Missing `XAI_API_KEY` is not a stop. Do not tile it.

## Cook a light-only plate

One still or one short clip. Pixels are **only** the light: a beam, a glow, a neon line, or a flash.

- Background is pure black (`#000000`) or transparent. No road. No Bolt. No vault. No densify crop.
- Key is black. The GPU composites the plate **over** densify and multiplies intensity and tint.
- Hang the file at `lightBib(kind, noun)` → `biome/fx/light/<kind>/<noun>.mp4`.
- Kinds: `beam` | `glow` | `neon` | `flash`.
- A short clip uses session Imagine Video with first + last pinned (the light may shimmer). A still is one frame of that same black key. Do not paint this light into Video A.
- GPU then owns intensity `0→1`, tint, on/off, cone position, and the fade (`LIGHT.fadeSec` is 0.35). `gradeFromPlate` stays true: bloom and mist still come from **this** densify plate. Tint does not replace that grade. Law 31 exposure on Video A does not rise.

## Cook openable state bibs

One prop. Three keyed plates. Same world, same materials as this densify plate, graded from that plate.

| State | File | What Imagine shows |
|---|---|---|
| `closed` | `biome/fx/openable/<kind>/<noun>-closed.mp4` | The prop shut. |
| `open` | `biome/fx/openable/<kind>/<noun>-open.mp4` | The prop open. Empty of loot if content is its own bib. |
| `transition` | `biome/fx/openable/<kind>/<noun>-transition.mp4` | The in-between. One pose, not a painted timeline on the road. |
| content (optional) | `biome/fx/openable/<kind>/<noun>-content.mp4` | What appears inside once `phase` is `open`. |

Kinds: `door` | `chest` | `generator` | `hatch` (crystal hatch). `openableBib` and `contentBib` return those paths.

Key green on the road (same family as a Lena rock). Key black if the prop sits in the sky vault (`zone: "sky"`). No wood door. No chrome UI rectangle. No densify crop.

Opening is **not** a frame of Video A. GPU plays `closed` → `transition` → `open` by `progress` over `OPENABLE.animSec` (0.45). Closing runs it backward. Content spawns only when `phase` is `open`, as another keyed quad, and only shows once the band is not far.

## Native to the video — FAIL if violated

`assertLightNative(frame)` and `assertOpenableNative(frame)` must return `[]`.

1. **One geometry.** Densify’s 3 lanes are the truth. Lights, openables, path beat, Lena, and Howl share `howlPose`. `frame.cone` is `"howlPose"`. `frame.lanes` is `3`.
2. **Grade from plate.** `gradeFromPlate: true` on the frame, on every light, and on every prop. Color, bloom, and mist come from this densify plate.
3. **Over densify, not inside it.** `gpu: true`. `composite: "over-densify"`. `bakeIntoDensify: false`. `paintedOpen: false` on openables. `onlyLight: true` and `key: "black"` on lights.
4. **In world, not a HUD.** `hud: false`. The lamp and the hatch sit on the cone. A corner icon is FAIL.
5. **LOD.** Far-band openables are visible and not hittable (`objectBand`). Contact shadow only when `band === "near"`. A generator’s `lightCue` feeds `lightLayerFrame`. The beam is still a light layer.
6. **One film, one clock.** `tileDensify` and `coversPlate` are false. `clock` is `"densify"`. Do not slice Video A.
7. **Pack RT.** `rtLook` is `"baked-imagine"`. `fakeInteractive` is true. `glossOverlay` is graded from the plate and has `bounces: 0`. `raytrace` is false. `trueRt` is `"ue-hold"`. Flat plastic lighting is FAIL. Real-time raytracing via Imagine is FAIL.

## One stack (densify film, then GPU)

Same `now` for every line. Densify is the looping plate. Build does **not** drive that Imagine first+last session.

```js
import { lenaFrame } from "../lena-lod/lenaLod.js";
import { pathBeatFrame, assertPathNative } from "../path-beat/pathBeat.js";
import { lightLayerState, lightLayerFrame, assertLightNative } from "../gpu-light/gpuLight.js";
import { openableState, openableFrame, openableHit, openableOpen, assertOpenableNative } from "../gpu-openable/gpuOpenable.js";

// 1. Densify Video A plays. No beams, no open props, no path, no generators painted in.
// 2. GPU keyed layers OVER that plate, one clock, one cone:
const lena = lenaFrame(lenaState, dt, ctx);
const path = pathBeatFrame(pathState, dt, ctx);
const props = openableFrame(openState, dt, ctx);
const lights = lightLayerFrame(lightState, dt, { ...ctx, set: props.lightCues });
if (assertPathNative(path).length) throw new Error("path native FAIL");
if (assertOpenableNative(props).length) throw new Error("openable native FAIL");
if (assertLightNative(lights).length) throw new Error("light native FAIL");
const hit = openableHit(props, x, y);
if (hit) openState = openableOpen(props.state, hit);
```

Draw each light with `draw === true` on `pose.dest` (intensity × tint). Where `glossOverlay(layer).draw` is true, draw that gloss quad on the same dest, graded from the plate, with zero bounces. Draw each prop’s `bib` on `pose.dest`. When `content` is set and `content.visible`, draw that bib too. Do not write any of those pixels back into Video A. Do not call it real-time raytracing.

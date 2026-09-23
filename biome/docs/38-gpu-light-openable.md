# 38 — GPU light layers + openable objects

**Sealed 2026-09-23 (SmiR product lock).** Runtime hang. Hang ≠ wipe. Does not recook hung masters. Does not invent a gallop. Does not change a Live URL. Pack RT is a baked look plus a fake interactive overlay. It is not a raytracer.

Light runtime: [`../scripts/gpu-light/gpuLight.js`](../scripts/gpu-light/gpuLight.js) — `lightLayerState` / `lightLayerFrame` / `lightBib` / `assertLightNative`.  
Openable runtime: [`../scripts/gpu-openable/gpuOpenable.js`](../scripts/gpu-openable/gpuOpenable.js) — `openableState` / `openableFrame` / `openableHit` / `openableOpen` / `assertOpenableNative`.  
Brief: [`COLD_START-gpu-light-openable.md`](COLD_START-gpu-light-openable.md)  
Cone: [`../scripts/howl-live/howlLive.js`](../scripts/howl-live/howlLive.js) (`howlPose`).  
Bands: [`../scripts/lena-lod/lenaLod.js`](../scripts/lena-lod/lenaLod.js) (`objectBand`).  
Lane clock on that same cone: [37](37-path-beat.md). World fill: [36](36-gpu-zones-lena-procedural.md).

Imagine cooks the look. GPU controls lights and open/close.

Densify keeps base ambience ([31](31-light-lock.md)). Playable lights and open states are never baked into Video A.

**GPU is REQUIRED.** Light layers, openable states, path beat, Lena LOD bibs, Howl, and Bolt are GPU keyed layers composited **OVER** densify Video A. **FAIL if Build paints a beam, a glow, an open door, a chest, a generator, or a hatch into Video A.** `frame.gpu === true`. `frame.bakeIntoDensify === false`. `frame.composite === "over-densify"`. `frame.hud === false`. `frame.raytrace === false`.

---

## Product

Two GPU jobs. One cone. No second geometry stack.

| Job | Imagine cooks | GPU owns |
|---|---|---|
| **Light layer** | A still or short clip that is **only** light: beam, glow, neon, or flash. Keyed black or transparent. No road, no dog, no densify décor. | Intensity `0→1`, tint, on/off, cone position (`howlPose`), fade (`LIGHT.fadeSec` 0.35). |
| **Openable** | Three keyed states per prop: `closed`, `open`, `transition`. Kinds: door, chest, generator, crystal hatch. Optional content bib. | Hit zone, open/close anim (`OPENABLE.animSec` 0.45), Lena LOD band, content spawn when open. |

Composite + states, same stack as the path beat and Lena. The Pack RT rule below is that stack. It is not a raytracer.

---

## Pack RT (Imagine × GPU)

Imagine has no real-time raytracing API. This stack does not invent one. Three rows, and only the first two are in play.

| Row | What it is | Where |
|---|---|---|
| **Baked RT look** | Densify and light/openable bibs **look** path-traced. Soft GI, reflections, soft contact shadows, baked into the pixels. `rtLook: "baked-imagine"`. | Imagine stills and Video A. The look is already in the file. |
| **Fake interactive RT** | When a light’s intensity moves, or an openable opens, the GPU composites the keyed light layer and an optional gloss/reflect quad. `glossOverlay`. `gradeFromPlate: true`. `fakeInteractive: true`. `bounces: 0`. | GPU, over densify. It mimics a response. It does not bounce rays. |
| **True RT** | A real tracer. | Other rail (UE). **HOLD.** Do not cook it here. `trueRt: "ue-hold"`. `raytrace: false`. |

Cook phrases (paste into Imagine):

- Densify: `Path-traced look baked into the pixels: soft global illumination, reflections in the lane, soft contact shadows. Not flat plastic lighting. Not a real-time raytracer.`
- Light bib: `Only the light, on pure black. Soft falloff, soft bloom, a faint reflected tint. Path-traced look in the pixels. Not flat plastic. No road.`
- Openable bib: `The prop looks path-traced: soft GI, a soft contact shadow, a reflection in the lane. Keyed. Not flat plastic. Not a real-time raytracer.`

`RT_PHRASE` in `gpuLight.js` is those three lines. Flat plastic lighting on densify or on a bib is FAIL.

A generator may name a `lightId`. `openableFrame` emits `lightCues`. Feed that row to `lightLayerFrame` as `set`. The beam stays a light layer. It is not painted into the generator plate and not painted into densify.

---

## Same cone as Howl / Lena / path beat

Placement is `howlPose` on densify lanes `-1 / 0 / 1` (`L` / `C` / `R`). `objectBand` is the Lena far / mid / near read. Contact shadow only when `band === "near"`.

Far-band openables are visible and **not hittable**. Mid and near take the hit. There is no second ribbon and no screen-space widget.

---

## Light call

```js
import { lightLayerState, lightLayerFrame, assertLightNative } from "./gpuLight.js";

let state = lightLayerState([
  { id: "neon-c", kind: "neon", noun: "lane", lane: "C", z: 0.25, on: false, intensity: 1 },
]);
const frame = lightLayerFrame(state, dt, {
  now, cw, ch, pawY, destH0,
  set: [{ id: "neon-c", on: true, tint: "#22e6ff" }],
});
state = frame.state;
if (assertLightNative(frame).length) throw new Error("light native FAIL");
```

- `frame.layers[]` — `intensity` (smoothed 0→1), `tint`, `on`, `bib`, `pose`, `band`, `draw`.
- `lightBib(kind, noun)` → `biome/fx/light/<kind>/<noun>.mp4`.
- Kinds: `beam` | `glow` | `neon` | `flash`.
- `key` is `"black"`. `onlyLight` is true. The plate is light pixels only.
- `gradeFromPlate` is true. Tint multiplies. Bloom and mist still come from this densify plate.
- `ambience` is `"densify"`. Law 31 exposure stays on Video A. These layers do not raise it.

---

## Openable call

```js
import { openableState, openableFrame, openableHit, openableOpen, assertOpenableNative } from "./gpuOpenable.js";

let state = openableState([
  { id: "chest-1", kind: "chest", noun: "quartz", lane: "C", z: 0.08, content: "shard" },
]);
let frame = openableFrame(state, dt, { now, cw, ch, pawY, destH0 });
const id = openableHit(frame, x, y);          // null on a miss or a far-band prop
if (id) state = openableOpen(frame.state, id);
frame = openableFrame(state, dt, { now, cw, ch, pawY, destH0 });
if (assertOpenableNative(frame).length) throw new Error("openable native FAIL");
```

| `phase` | Bib | Content |
|---|---|---|
| `closed` | `…-closed.mp4` | none |
| `opening` / `closing` | `…-transition.mp4` | none |
| `open` | `…-open.mp4` | optional `…-content.mp4` when `content` is set and the band is not far |

- `openableBib(kind, noun, state)` → `biome/fx/openable/<kind>/<noun>-<state>.mp4`.
- `contentBib(kind, noun)` → `biome/fx/openable/<kind>/<noun>-content.mp4`.
- Hit zone is `pose.dest`, padded. `openableClose` runs the same anim backward.
- `paintedOpen` is false. Opening is progress in code, not a frame of Video A.
- Road props key green (same family as Lena rocks). `zone: "sky"` keys black.

---

## Cook

Densify Video A stays a clean 3-lane loop. Session Imagine Video, first + last pinned. Build does not drive that session. Missing `XAI_API_KEY` is not a stop.

**Light-only plate.** Pixels are the beam, glow, neon, or flash. Background is pure black or transparent. No road, no Bolt, no vault, no densify crop. Hang it at the `lightBib` path.

**Openable states.** Three keyed plates, same prop, same world materials as this densify plate, graded from that plate. Closed, open, and the in-between. Optional fourth plate for what is inside. Hang them at the `openableBib` / `contentBib` paths. Do not paint the open door into the road loop.

---

## Native locks

`assertLightNative(frame)` and `assertOpenableNative(frame)` return `[]` or a list of FAIL reasons.

| Lock | Runtime | FAIL |
|---|---|---|
| One geometry | `pose` is `howlPose`. `cone === "howlPose"`. `lanes === 3` | A second stack, a screen light, a HUD hatch |
| Grade from plate | `gradeFromPlate: true` | A bib whose bloom or mist is not this densify plate |
| Over densify | `gpu: true`, `composite: "over-densify"`, `bakeIntoDensify: false` | A beam, glow, open door, chest, generator, or hatch painted into Video A |
| In world | `hud: false`, `inWorld: true` | A corner lamp icon, a button that is not on the cone |
| Light-only | `onlyLight: true`, `key: "black"`, bib under `biome/fx/light/` | A light plate that contains the road |
| Open is code | `paintedOpen: false`. Transition bib while progress is between 0 and 1 | An open state baked into densify. Content while still closed |
| LOD | Far openables are not hittable. Shadow only when `band === "near"` | A far-band hit. A shadow on far or mid |
| Baked look | `rtLook: "baked-imagine"` | Flat plastic lighting. A plate with no soft GI, no reflection, no soft shadow |
| Fake interactive | `fakeInteractive: true`. `glossOverlay` graded from the plate. `bounces: 0` | A gloss quad that traces, or a bounce count above 0 |
| Not a tracer | `raytrace: false`. `trueRt: "ue-hold"` | Claiming real-time raytracing via Imagine. Cooking the UE rail here |
| One film | `tileDensify: false`, `coversPlate: false`, `clock: "densify"` | Spatial slices of Video A. A private clock |
| Ambience | `ambience: "densify"` (lights) | A playable light that lifts Video A exposure (law 31) |

---

## FAIL

- Painting a playable light (beam, glow, neon, flash) into densify Video A
- Painting an open or closed door, chest, generator, or crystal hatch into densify Video A
- Painting the transition, or the content spawn, into that plate
- A HUD lamp, badge, or screen button
- A light plate that is not light-only on keyed black or transparent
- Flat plastic lighting on densify or on a light/openable bib (no soft GI, no reflection, no soft shadow)
- Claiming **real-time raytracing via Imagine**, or setting `raytrace` / `realtimeImagine`
- Baking interactive lights into densify Video A (the response belongs on the GPU gloss + light layer)
- Cooking true RT on this stack (UE is HOLD)
- Skipping the GPU, or turning on raytracing
- A second cone, or a perspective that is not `howlPose` on densify’s 3 lanes
- A hittable prop in the far band, or a contact shadow outside near
- A bib graded off this densify plate
- Tiling or slicing the densify loop
- A play URL, Build `/c/` link, or `grok.com/share` from this note

Related: [36](36-gpu-zones-lena-procedural.md) · [37](37-path-beat.md) · [34](34-howl-live-aim.md) · [31](31-light-lock.md) · [17](17-live-compositor.md) · [15](15-gpu-compositor.md) · runtime [`../scripts/gpu-light/gpuLight.js`](../scripts/gpu-light/gpuLight.js) · [`../scripts/gpu-openable/gpuOpenable.js`](../scripts/gpu-openable/gpuOpenable.js) · paste [`COLD_START-gpu-light-openable.md`](COLD_START-gpu-light-openable.md)

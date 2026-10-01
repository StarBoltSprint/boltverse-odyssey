# 62 — Open world by zones: the creation process (any biome, any style)

Kitchen only. Not a hang. Not a new play URL. Owner direction **2026-10-01**.

**This repo holds no biome style.** Each player chooses the style of every biome freely. This doc is the **creation process**: style-agnostic and fully codified. Any player's Grok follows the same steps for any paint. Nothing below is a look to copy. No example biome here is a model.

The free-walk method is [doc 61](61-free-clearing-walk.md). The invisible-shape exception is the [2026-10-01 extension of law 59](59-invisible-depth-carrier.md#extension-2026-10-01-invisible-procedural-terrain-shape) (PR #128). Hulls are [`tools/walkaround/build.py`](../../tools/walkaround/build.py) (PR #127, method in [doc 60](60-imagine-relief-panorama-method.md#script)). The layout file and the rendered-pixel validator are [doc 63](63-layout-file-and-validator.md).

## Hard locks (already in the repo, unchanged)

This doc restates them. It does not change them.

- **Every visible pixel is Imagine:** Imagine images, or seamless looping keyed Imagine video.
- **Code never draws, shades, or colours a pixel.** Code computes only **invisible shape**: relief, tile layout, colliders, placement, orientation. That includes shadows: **never draw a shadow in code** (take 8 below).
- **Bolt** = keyed back-view gallop [`lock/bolt-gallop-cycle.mp4`](../../lock/bolt-gallop-cycle.mp4) + idle `lock/bolt-idle-breath.mp4`, with the automatic IDLE / GALLOP switch of doc 61. **Exactly one Bolt** on screen. Never a hull, never a new gallop. If `lock/bolt-idle-breath.mp4` is missing from your checkout, do not recook it; ask the owner.
- **Magnification ≤ 1.0** at portrait **720×1600**. Lossless. No blur. Measured, and shown on the HUD.
- **Full-screen phone portrait.** Controls are a transparent overlay. No letterbox (doc 60 test 4 FAIL table).
- **360° ring = far backdrop only.** It does not move when Bolt walks. It is not the floor.
- **Walkable zone ground** = world-locked top-down Imagine tiles (**0.90 m**, ≥ 4 variants) on the invisible relief.
- **Solid objects** = 8-view Imagine hulls via `tools/walkaround/build.py` (standard 3D object pipeline below).
- **Living layers** (fog, particles, lights, energy, water, anything that moves) = seamless looping keyed Imagine video.
- **Scrolling, speed-tied Imagine ground video** is allowed **only** on a straight corridor between two zones. Never as a zone floor.
- **Fog** = one looping Imagine video packed into a frame atlas, drawn as **20–40+** camera-facing billboard patches, GPU instanced, each patch with its own size, tint, opacity, and loop offset, fading out near the camera. Tint and opacity are GPU controls on Imagine pixels (the law [38](38-gpu-light-openable.md) light-layer pattern). They never generate a colour or a shape of their own.

## World = zones + corridors

A world is a graph:

- **Zone** = a free-walk 360° clearing (doc 61 method). Closed edge ring of solid hulls. One or more readable **gates**.
- **Corridor** = a straight path between two gates, floored by a scrolling speed-tied Imagine ground video.

Smallest world:

```
Zone A ──gate──▶ corridor ──gate──▶ Zone B
```

Extensible: more zones, and branches (a zone with two or three gates, each to its own corridor).

```
Zone A ──▶ corridor ──▶ Zone B ──▶ corridor ──▶ Zone C
                          │
                          └──▶ corridor ──▶ Zone D
```

Each zone has its own `clearing.json` (doc 63). The links between zones are the `gates[].leads_to` fields. Nothing is hand-placed.

### Zone rules

- **Closed edge ring.** Seen from anywhere inside, the ring hulls cover the horizon band at every heading except the gates. Colliders follow the visible hulls, nothing else. An invisible wall is FAIL.
- **Readable gates.** Each gate is framed so it reads as the way out from across the zone.
- **Spawn** (first zone) faces the first gate. Arrival from a corridor enters through that zone's gate.
- **HUD** (kitchen QC HUD, not player chrome): `x`, `z`, heading, magnification, `bolt IDLE` / `bolt GALLOP`, and **heading + distance to each gate**. Movement is proven by those numbers changing (doc 60 test 4).
- **Fog band** just inside the ring, per the fog lock. Soft, wide feathered alpha, low opacity. Hard streaks are FAIL (doc 61 take 4).
- **Interior objects** (walk-around, interactive): 8-view hulls, budget **2–3** per zone (doc 61).
- **Composite objects** (for example a plant with moving foliage): rigid hull for the solid part + looping keyed Imagine cards for the moving part. Distant copies = **8-view impostors** (nearest of the 8 views by bearing to the camera; far band only, no collider, not claimed as volume).

### Corridor rules

- Straight, one direction. No free 360° turn on a corridor; turning around is a zone job.
- Floor = scrolling Imagine ground video, empty of Bolt, locked camera, portrait, at or above on-screen pixels (magnification ≤ 1.0).
- **Speed-tied:** `rate = boltSpeed / bakedGroundSpeed`. Bolt stops → the video stops and Bolt plays idle. Bolt accelerates → the video accelerates. Ground rolling under an idle Bolt, or a galloping Bolt on frozen ground, is FAIL.
- Walls / edges are Imagine pixels: in the corridor video itself, or keyed Imagine side layers.
- Corridor distance on the HUD. The corridor ends at the next zone's gate, visible ahead before the switch.

## Standard 3D object pipeline (all objects)

Owner-approved **2026-10-01**. Every solid object in every zone (edge-ring pieces, gates, interior objects, the solid part of a composite object) is built the same way, whatever the style. Code computes **invisible shape only**. It never draws a pixel.

1. **Cook 8 Imagine views, one every 45°.** Same object, same light, plain background, silhouette lock (doc 60 KEEP method: V0 first, each view from its neighbour + V0, area ±15%, height ±8%). Objects with hidden hollows (a cockpit, a bowl, an arch seen from above) also get a **top view** and **3/4-high views**.
2. **Silhouette visual hull** via [`tools/walkaround/build.py`](../../tools/walkaround/build.py) = the **coarse volume** (7-of-8 vote, rounded underside cap).
3. **Per-view monocular depth maps refine the surface.** Push and carve medium relief so details are real volume, not flat paint on a smooth hull.
4. **Auto-detect large protrusions** (parts that stick out of the main body, for example cannons, antennas, turrets) and **flag them**. Each flagged part is cooked as a **separate sub-object** with its own 8 views + hull, attached to the parent at a fixed joint. A sub-object may animate (rotate on its joint); its pixels stay Imagine.
5. **Project the real Imagine views onto the final volume.** Best-facing view per surface point, weight `(normal · viewDir)^8`, narrow seam band, nearest-view fallback, never averaged, never chosen by the viewer's yaw (doc 60). Nearest sample of the lossless PNG; magnification ≤ 1.0 (`qc/report.json`).

### What `tools/walkaround` does today

| Step | Status on `main` (2026-10-01) |
| --- | --- |
| 1. 8 yaw views | Supported. One shared `camera.eyeY` for all views. **Top / 3/4-high views are not supported yet** (no per-view elevation). |
| 2. Silhouette hull | Supported (7-of-8 vote, hole fill, rounded cap). |
| 3. Depth refine | Partial: `--model` (Depth Anything V2) or `--depth-dir` pushes the front **inward** only. Push **and** carve medium relief is a **planned upgrade, not implemented yet**. |
| 4. Protrusion detection + sub-objects | **Planned upgrade, not implemented yet.** Until it lands, split large protrusions by hand: cook the part as its own object (8 views + hull) and attach it in `clearing.json`. |
| 5. Projection | Supported (best-facing view, seam band, nearest fallback, `FAIL upscale` above 1.0). |

Do not claim steps 3 and 4 as done in a report. Do not fake them with code-drawn detail: relief that is not in the Imagine views is not added by code, and no pixel is painted to suggest it.

## Pipeline — every player's Grok, any style

Do the steps in order. Stop when one fails.

1. **Pick the style.** The player names it. Any paint. Write it down once as `{PAINT}`; it is used only in Imagine prompts, never in the schema or the code.
2. **Cook the Imagine assets** for one zone (and later its corridor), all in `{PAINT}`, all lossless:
   1. **Ground tiles:** top-down, seamless, **≥ 4 variants**, true world scale for **0.90 m**, no horizon, no Bolt.
   2. **360° backdrop:** far content only, seam matched, mapped to exactly 360° (doc 60 test 2d; split above 4096 px).
   3. **Edge-ring, gate, and interior objects:** the standard 3D object pipeline above, for each object: V0 + **8 views every 45°** with the silhouette lock (top / 3/4-high views for hollows), then `python3 tools/walkaround/build.py --views … --config … --out …`; large protrusions as separate sub-objects. `qc/report.json` magnification ≤ 1.0 for every view. Several distinct edge assets; no identical copies side by side (doc 60 "pasted copies" FAIL).
   4. **Living loops:** fog atlas (one looping video packed into frames), gate / light / particle loops. First frame = last frame. Keyed.
   5. **Corridor ground video** (when the corridor step comes): scrolling, one direction, speed measured (`bakedGroundSpeed`).
3. **Fill `clearing.json`** for the zone: `zone`, `edge_ring`, `gates`, `interior_objects`, `near_lens`, `fog_band` (+ `spawn`, `backdrop`, `view`, `bolt`). Schema in doc 63.
4. **Generate.** `tools/clearing/` builds placement, colliders, gates, and fog patches from that file.
5. **Validate on the rendered view.** Run `tools/playcheck/run --url <play url or local build> --layout <clearing.json>` ([doc 63](63-layout-file-and-validator.md), [`tools/playcheck/README.md`](../../tools/playcheck/README.md)). Every row **PASS** on the real 720×1600 play view. A data-only PASS is FAIL. Any WebGL error is FAIL (take 8). Paste `report.md`, the stills, and `walk.mp4`. A hand-written PASS table is not accepted.
6. **Proof stills** come from that command (the play view), not from a hand export: spawn, the turn, centre → gate, stops with the hero against a visible hull, fog, IDLE, GALLOP, plus `walk.mp4`.
7. **STOP.** Only now may a sandbox play URL be shared. The owner records phone QC himself. Only an owner KEEP opens the next step.

### Order of work for a new world

1. First zone: edge ring + gate → KEEP.
2. Corridor to the second zone → KEEP.
3. Second zone with its interior objects → KEEP.
4. Composite-object test (for example a plant: hull + looping cards; far impostors) → KEEP.
5. More zones and branches, one at a time, same loop.

## Take 8 (2026-10-01) — generic lessons

Take 8 is a past clearing take. Its paint is not a model. Only these lessons carry.

### KEEP

- Exactly one Bolt; the automatic IDLE / GALLOP switch.
- Ground magnification **0.979** at 720×1600 (HUD = phone).
- 8-view hull quality from `tools/walkaround/build.py`.

### Violation removed

- A **code-drawn multiply shadow oval under Bolt**. Code-drawn pixels break the Imagine-only lock. It was removed. Never draw shadows in code (no multiply oval, no gaussian blob, no darkening pass). If contact needs a shadow, it is Imagine pixels.

### FAIL

- The validator printed **ALL PASS** while the edge-ring hulls existed only in data, the debug map, and colliders, and were **not rendered** in the play view: empty ground at **18 m**, an invisible stop at **17.07 m** (heading **333°**), no visible gate at **238°**. Fix: the validator checks rendered pixels ([doc 63](63-layout-file-and-validator.md#critical-lesson--take-8-2026-10-01)).
- **WebGL `texSubImage3D` `INVALID_OPERATION`** errors were in the console. They likely broke the fog and hull rendering (texture-array uploads whose size, format / type, or layer count does not match the `texStorage3D` allocation silently draw nothing). Treat any WebGL error as FAIL; check that every array texture upload matches its allocation exactly.

## Do not

- Commit a biome style (a look, a prompt set, a palette) to this repo as the model.
- Lay a zone floor as the scrolling ground video, or put free 360° turning on a corridor.
- Leave the ring open, or close it with colliders that have no visible hull in front of them.
- Hand-place ring hulls, gates, colliders, or fog. They are generated from `clearing.json`.
- Post a play URL before every validator row passes on the rendered view.
- Draw, shade, colour, or shadow any pixel in code.

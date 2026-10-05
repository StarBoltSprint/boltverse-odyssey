# 62 — Open world by zones: the creation process (any biome, any style)

> **Amended 2026-10-03 to match [`docs/METHOD.md`](../../docs/METHOD.md)** (newer owner decisions win): zones are large organic open areas with natural soft boundaries, no circles / rings (owner 2026-10-02). The take 8 lessons below stay.

Kitchen only. Not a hang. Not a new play URL. Owner direction **2026-10-01**.

**This repo holds no biome palette and no Imagine prompt** (biome names are allowed, SmiR 2026-10-03). Each player chooses the style of every biome freely. This doc is the **creation process**: style-agnostic and fully codified. Any player's Grok follows the same steps for any paint. Nothing below is a look to copy. No example biome here is a model.

The free-walk method is [doc 61](61-free-clearing-walk.md). The invisible-shape exception is the [2026-10-01 extension of law 59](59-invisible-depth-carrier.md#extension-2026-10-01-invisible-procedural-terrain-shape) (PR #128). Hulls are [`tools/walkaround/build.py`](../../tools/walkaround/build.py) (PR #127, method in [doc 60](60-imagine-relief-panorama-method.md#script)). One `clearing.json` per zone is written and checked by [`tools/layout`](../../tools/layout/README.md). The rendered-pixel validator is [doc 63](63-layout-file-and-validator.md).

**Order:** [`tools/assetcheck`](../../tools/assetcheck/README.md) on every Imagine file, then [`tools/objsheet`](../../tools/objsheet/README.md) on every object view set, then [`tools/walkaround/build.py`](../../tools/walkaround/build.py) ([how Grok uses it](../../tools/walkaround/README.md#how-grok-uses-it): one mount per solid, instances for every copy), then [`tools/layout`](../../tools/layout/README.md) (`layout.py generate`, then `layout.py check`, one `clearing.json` per zone), then [`tools/playcheck/run`](../../tools/playcheck/README.md), then [`tools/reportview`](../../tools/reportview/README.md). Paste each report. Run tools/reportview and deliver the page with the play URL. A hand-written PASS is not a PASS. A layout PASS is invisible shape only. The measure tools only measure. They do not paint, resize, or replace a pixel.

**`lock/` is grandfathered.** Anything under `lock/` (and any manifest entry with `locked: true`) is owner KEEP. `assetcheck` still measures it and prints **WARN**. A WARN is not a FAIL, the exit code stays 0, and it is not a reason to recook or replace that file. Bolt stays [`lock/bolt-gallop-cycle.mp4`](../../lock/bolt-gallop-cycle.mp4) and `lock/bolt-idle-breath.mp4`. If the idle file is missing, ask the owner. Do not cook a new one.

## Hard locks (already in the repo, unchanged)

This doc restates them. It does not change them.

- **Every visible pixel is Imagine:** Imagine images, or seamless looping keyed Imagine video.
- **Code never draws, shades, or colours a pixel.** Code computes only **invisible shape**: relief, tile layout, colliders, placement, orientation. That includes shadows: **never draw a shadow in code** (take 8 below).
- **Bolt** = keyed back-view gallop [`lock/bolt-gallop-cycle.mp4`](../../lock/bolt-gallop-cycle.mp4) + idle `lock/bolt-idle-breath.mp4`, with the automatic IDLE / GALLOP switch of doc 61. **Exactly one Bolt** on screen. Never a hull, never a new gallop. If `lock/bolt-idle-breath.mp4` is missing from your checkout, do not recook it; ask the owner. An `assetcheck` **WARN** on either lock file is not a recook order.
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

- **Zone** = a **large natural organic open area** (doc 61 free-walk method): irregular footprint ≥ 5× the retired circle, ≥ 3 sub-areas / nooks, meandering passages, natural soft boundaries, **no circles or rings**. One or more readable **gates** on the boundary.
- **Corridor** = a fixed path between two gates, floored by a scrolling speed-tied Imagine ground video, with a distance-based fog / grade blend between the two biomes (law 67, owner 2026-10-02).

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

- **Natural soft boundary** (amended 2026-10-03, owner 2026-10-02). The footprint is closed, except at the gates, by visible Imagine pieces (cliff faces, rock masses, dense vegetation, terrain rising into them) with a soft fog band. Colliders follow the visible pieces, nothing else. An invisible wall is FAIL. **No ring:** no object family is laid out on a circle (`tools/layout` row `no_ring`).
- **Readable gates.** Each gate is framed so it reads as the way out from across the zone.
- **Spawn** (first zone) faces the first gate. Arrival from a corridor enters through that zone's gate.
- **HUD** (kitchen QC HUD, not player chrome): `x`, `z`, heading, magnification, `bolt IDLE` / `bolt GALLOP`, and **heading + distance to each gate**. Movement is proven by those numbers changing (doc 60 test 4).
- **Fog band** along the boundary, per the fog lock. Soft, wide feathered alpha, low opacity. Hard streaks are FAIL (doc 61 take 4).
- **Interior objects** (walk-around, interactive): 8-view hulls (organic) or real 3D hard objects (METHOD.md). One huge readable landmark + ≥ 3 discovery POIs per zone; the count is limited by the phone perf budgets, not a fixed 2–3.
- **Composite objects** (for example a plant with moving foliage): rigid hull for the solid part + keyed seamless-looping Imagine video layers for the moving part. Distant copies = **8-view impostors** (nearest of the 8 views by bearing to the camera; far band only, no collider, not claimed as volume).

### Corridor rules

- Straight, one direction. No free 360° turn on a corridor; turning around is a zone job.
- That straight run may be placed at load time by [`tools/wfc-path`](../../tools/wfc-path/README.md) ([doc 68](68-wfc-path-placement.md)). Neighbor sockets choose already-cooked tile ids. The file is `path-layout.json` (waypoints plus one straight segment). The solve does not draw, and it does not run again during play.
- Floor = scrolling Imagine ground video, empty of Bolt, locked camera, portrait, at or above on-screen pixels (magnification ≤ 1.0).
- **Speed-tied:** `rate = boltSpeed / bakedGroundSpeed`. Bolt stops → the video stops and Bolt plays idle. Bolt accelerates → the video accelerates. Ground rolling under an idle Bolt, or a galloping Bolt on frozen ground, is FAIL. Under `0.05` m/s the rate is `0` and the clip is `lock/bolt-idle-breath.mp4`. Otherwise the clip is `lock/bolt-gallop-cycle.mp4`. Neither file is recooked.
- **Handoff.** [`biome/scripts/zone-flow`](../../biome/scripts/zone-flow/README.md) preloads the next plate within `preloadM` (default 8 m), then crossfades (`fadeMs`, default 400) when the hero is inside `triggerM` (default 1.5 m) of the gate mouth from `clearing.json`. Weights sum to 1. The previous zone's source is cleared only after the fade. If the next plate is not ready, the current plate stays up. A black frame (luma under 12 on at least 92% of sampled pixels) is FAIL. A hitch over 100 ms is FAIL.
- Walls / edges are Imagine pixels: in the corridor video itself, or keyed Imagine side layers.
- Corridor distance on the HUD. The corridor ends at the next zone's gate, visible ahead before the switch.

## Standard 3D object pipeline (all objects)

Owner-approved **2026-10-01**. Every solid object in every zone (edge-ring pieces, gates, interior objects, the solid part of a composite object) is built the same way, whatever the style. Code computes **invisible shape only**. It never draws a pixel.

1. **Cook 8 Imagine views, one every 45°.** Same object, same light, plain background, silhouette lock (doc 60 KEEP method: V0 first, each view from its neighbour + V0, area ±15%, height ±8%). Objects with hidden hollows (a cockpit, a bowl, an arch seen from above) also get a **top view** and **3/4-high views**.
2. **Gate the stills, then the hull.** `python3 tools/assetcheck/check.py` on every view (kind `cutout`, declared on-screen size, declared key). Then `python3 tools/objsheet/sheet.py` on the view set, including top / 3/4-high views, guide frames from a turntable when one was cooked, and each sub-object's own views. Paste `report.json`, `report.md`, and `sheet.png`. Exit 0 only. Then the **silhouette visual hull** via [`tools/walkaround/build.py`](../../tools/walkaround/build.py) (7-of-8 vote on the horizontal ring, rounded underside cap). The default draw surface is a smooth mesh on that volume. The occupancy grid stays the collider. A failed sheet does not get a hull. The build repeats the sheet's margin, hole, and 2K gates before the carve, and it refuses a mirrored camera. Every solid is then one `mountHull` and `setInstances` for each placement ([how Grok uses it](../../tools/walkaround/README.md#how-grok-uses-it)). A camera-facing card is not that path. `tools/playcheck` row `solids_world_locked` fails a crop that stays pixel-identical across a 5° orbit step.
3. **Per-view monocular depth maps refine the surface inward**, inside the silhouette hull. They do not add volume outside it. See the table for the limit that is actually in the tool.
4. **Protrusions** (parts that stick out of the main body, for example cannons, antennas, turrets). The tool can **flag** a narrow part. It does not cook that part’s views. Supply the part as a **sub-object** with its own view set, a joint, and an axis. The tool carves it out of the parent and attaches the mesh. The axis is stored. This command does not animate the joint. Pixels stay Imagine.
5. **Project the real Imagine views onto the final surface.** On the smooth mesh that choice is per fragment: best-facing view, weight `(normal · viewDir)^8`, occlusion against that view, a second view only in a narrow seam, nearest texel of the lossless PNG. Not chosen by the viewer’s yaw (doc 60). Magnification ≤ 1.0 (`qc/report.json`). The legacy voxel path still assigns one view per voxel.

### What `tools/walkaround` does today

| Step | Status |
| --- | --- |
| 1. 8 yaw views | Supported. Optional per-view `elevationDeg` (top, 3/4-high) for carving and for projection. The horizontal ring stays 7-of-8. An elevated still is a mandatory carver and is not hole-filled, so a hollow the ring cannot see can stay open. Elevated stills are silhouette-locked only inside their own pitch band. One top view is not compared to the side ring. Before this build, [`tools/assetcheck`](../../tools/assetcheck/README.md) must PASS each still and [`tools/objsheet`](../../tools/objsheet/README.md) must PASS the set (guide IoU ≥ 0.97 when a guide exists; adjacent area ±15%, height ±8%; hull-keep fraction from the same 7-of-8 vote). |
| 2. Silhouette hull | Supported. **This is the default, and it is unchanged.** Surface nets on a finer occupancy (`max(64, 2×grid)`, cap 128) plus Taubin smoothing. `--legacy-voxels` keeps the cube grid. Collider remains the occupancy grid. Optional `--shape` does not replace this row. |
| 3. Depth refine | **Partial.** `--model` (Depth Anything V2) or `--depth-dir` (near = white, same pixel size as the still) moves the front **inward** only. Near stays on the outer hull. Far recedes by `depthRelief` (default **0.35** of local thickness on the smooth path, **0.10** on legacy voxels). On the smooth path, when at least four depth views exist, a voxel recedes only if **two** agree. A depth set that would delete more than 60% of the solid is rejected. Depth does not invent shell outside the silhouettes, and it does not push outward. Every method, default included, also **records** metres in `qc/report.json` without a further geometry change: `depthMetrics.perView[].nearM` / `farM` (camera-space z), `meanOffsetM` / `maxOffsetM` (the recess; 0 when depth was not applied), and `depthMetrics.bboxDepth` (world-Z extent). `depthRange` / `depthMin` / `depthMax` repeat the near/far span on the report and on `hull` for the report page. |
| 4. Protrusions + sub-objects | **Partial.** A supplied `subObjects` entry (own config, own views, `joint`, `localAttach`, `axis`) is carved out of the parent and attached. The axis is written. The tool does not rotate it. Auto-detect only **flags** a narrow neck (a 3-voxel opening: bbox and a suggested joint). It does not cook views and it does not cut the hull. Sub-objects require the smooth surface. `--legacy-voxels` with `subObjects` is a FAIL. |
| 5. Projection | Supported. Smooth mesh: per fragment, best facing view, visibility check, two-view seam only when the second weight is at least 0.65 of the best, nearest PNG texel, no mip, no third view. A sub-object samples only its own views. Legacy voxels: one view id per voxel (`viewVol`), which is the chopped look. `FAIL upscale` above magnification 1.0. The pass line prints every source’s width and height, vertex count, seam fraction, and the distance where magnification stays ≤ 1. |

Do not claim steps 3 and 4 as done in a report. Do not fake them with code-drawn detail: relief that is not in the Imagine views is not added by code, and no pixel is painted to suggest it.

### Optional shape (not the default)

`tools/walkaround/build.py` accepts two optional methods. Leave `--shape` off and step 2 above is what runs.

- `--shape photogrammetry` — four 90° turntable videos (pinned first and last) of one rigid object, plus the HD stills. CPU solver in the declared cameras, then a star mesh (one radius per direction; a dent or a hole is not recovered). The HD stills are projected exactly as on the default hull. Poor registration, including an object that morphs between the pinned ends, is a FAIL with an explicit fallback sentence. The run does not switch to the silhouette hull. `--photogram-engine colmap` FAILs when `colmap` is missing; it does not switch engines. No GPU.
- `--shape primitive --primitive box|cylinder` — an invisible box, or a vertical cylinder (world Y), fitted to the silhouettes. Imagine views are projected per face. The report has silhouette IoU per view and corner-seam warnings. A box's diagonal silhouette breaks the ±15% area lock, so that lock is waived for this method only and the waiver is written down. IoU is the fit measure.
- `--compare` — default plus each requested `--shape`. `comparison.schema` is `walkaround-compare-1` inside `qc/report.json`, with `qc/report.md` and thumbnails from four sides and one 3/4-high view. Recommended is the best score among methods that passed. A failed requested method still exits non-zero.

Try photogrammetry when a rigid turntable exists and the silhouette hull is too blobby. Try a primitive when the object really is a box or a vertical cylinder. Otherwise stay on the default. Limits and the depth-field table: [`tools/walkaround/README.md`](../../tools/walkaround/README.md).

## Pipeline — every player's Grok, any style

Do the steps in order. Stop when one fails.

1. **Pick the style.** The player names it. Any paint. Write it down once as `{PAINT}`; it is used only in Imagine prompts, never in the schema or the code.
2. **Cook the Imagine assets** for one zone (and later its corridor), all in `{PAINT}`, all lossless. **Every file is gated before it is named in `clearing.json` or passed to a hull:**
   1. **Ground tiles:** top-down, seamless, **≥ 4 variants**, true world scale for **0.90 m**, no horizon, no Bolt. `tools/assetcheck` kind `tile`, one manifest for the variant set (wrap seam, exposure, magnification ≤ 1 at 720×1600).
   2. **360° backdrop:** far content only, seam matched, mapped to exactly 360° (doc 60 test 2d; split above 4096 px). `tools/assetcheck` kind `backdrop`. Width above the WebGL max is a FAIL until the file is split.
   3. **Boundary pieces, gates, landmark, POIs and interior objects:** the standard 3D object pipeline above, for each object: V0 + **8 views every 45°** with the silhouette lock (top / 3/4-high views for hollows). `tools/assetcheck` on each still, then `tools/objsheet` on the set (and on each sub-object). Only a passing sheet goes to `python3 tools/walkaround/build.py --views … --config … --out …`. `qc/report.json` magnification ≤ 1.0 for every view. Several distinct boundary assets; no identical copies side by side (doc 60 "pasted copies" FAIL).
   4. **Living loops:** fog atlas (one looping video packed into frames), gate / light / particle loops. First frame = last frame. Keyed. `tools/assetcheck` kind `loop` (seam, pops, frozen runs, key). A turntable that must hold one shape also gets kind `turntable` (morph).
   5. **Corridor ground video** (when the corridor step comes): scrolling, one direction, speed measured (`bakedGroundSpeed`). `tools/assetcheck` before it is wired.
   Paste each `report.md` and `report.json`. Attach each `sheet.png`. Exit code 0. A sentence that says PASS, with no report, is a FAIL.
3. **Generate `clearing.json`.** Write an organic zone spec (`zone.shape: "organic"`, footprint polygon or seeded generator with sub-areas and passages, relief, boundary assets, gates, scatter categories, POIs, cells; `tools/layout/README.md` "Organic zones"). The circle mode is the retired test layout. A category entry may be a path or `{ "library": "<object-id>" }` from [`biome/library`](../../biome/library/README.md) (`tools/library`) so a validated object is reused instead of recooked. Run `python3 tools/layout/layout.py generate --spec <spec.json> --out <dir>`. Do not type coordinates by hand. Schema in doc 63. The file is the placement, including colliders.
4. **Check the layout file.** `python3 tools/layout/layout.py check --clearing <dir>/clearing.json --out <dir>`. Paste `report.md`. Exit code non-zero means FAIL. This is invisible shape only (footprint, sub-areas, passages, boundary, gates, `no_ring`, relief and slope, magnification, variety). It is not a framebuffer. When a corridor links this zone, run the same check with `--world <world.json>`. That adds the `transition` row (speed, ground file, gates from each `clearing.json`). A check without `--world` does not add it. Black frames and hitch time are the playcheck rows `transition_black` and `transition_hitch`, and only when `snapshot().transition` is present. The labelled synthetic walk is `node tools/zoneflow/selftest.mjs` (`tools/zoneflow/fixture`, not Imagine).
5. **Validate on the rendered view.** Run `tools/playcheck/run --url <play url or local build> --layout <clearing.json>` ([doc 63](63-layout-file-and-validator.md), [`tools/playcheck/README.md`](../../tools/playcheck/README.md)). Every row **PASS** on the real 720×1600 play view. A data-only PASS is FAIL, including a `tools/layout` PASS. Any WebGL error is FAIL (take 8). Law 65 rows are part of that PASS: `perf_line` (`drawCalls`, `texMB`, `activeVideos`, `jsMs`), `active_videos` (at most 4), and `render_source` (local `.js` or `--source`). Magnification stays ≤ 1.0. SwiftShader frame time is informational. Paste `report.md`, the stills, and `walk.mp4`. A hand-written PASS table is not accepted. [`65-render-quality.md`](65-render-quality.md).
6. **Proof stills** come from that command (the play view), not from a hand export: spawn, the turn, centre → gate, stops with the hero against a visible hull, fog, IDLE, GALLOP, plus `walk.mp4`.
7. **Phone page.** Run `python3 tools/reportview/build.py` ([`tools/reportview/README.md`](../../tools/reportview/README.md)) on those report folders and deliver the page with the play URL. A section that was not run stays **NOT RUN**. It is not a PASS. The page only displays the reports.
8. **STOP.** Only now may a sandbox play URL be shared, and it is shared on that page. The owner records phone QC himself. Only an owner KEEP opens the next step.

### Order of work for a new world

1. First zone: organic footprint + natural boundary + gates → KEEP.
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
- Leave the boundary open, or close it with colliders that have no visible piece in front of them. Lay out any object family on a circle or ring.
- Hand-place boundary pieces, gates, colliders, or fog. `tools/layout` writes `clearing.json`. Paste the check report. A layout PASS is not a rendered PASS.
- Post a play URL before every validator row passes on the rendered view.
- Draw, shade, colour, or shadow any pixel in code.
- Hand-write PASS for an Imagine file or an object view set. The asset-gate report and the consistency sheet are the PASS.
- Build a walk-around hull, or name an Imagine path in `clearing.json`, before those reports exist and exit 0.
- Recook or replace anything under `lock/` because `assetcheck` printed WARN. That WARN is informational. Bolt stays the locked gallop and the idle loop.

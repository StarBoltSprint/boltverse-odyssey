# 63 — Layout file + rendered-pixel validator (any biome)

Kitchen only. Not a hang. Owner direction **2026-10-01**, after the take 8 FAIL below.

Biome-agnostic. Any biome, cooked by any player's Grok, lays out its clearings the same way. The world-by-zones creation process is [doc 62](62-open-world-zones-process.md). The clearing method is [doc 61](61-free-clearing-walk.md). The invisible-shape exception is the [2026-10-01 extension of law 59](59-invisible-depth-carrier.md#extension-2026-10-01-invisible-procedural-terrain-shape). Every hard lock in doc 62 stays: every visible pixel is Imagine, code computes invisible shape only, one Bolt, magnification ≤ 1.0 at 720×1600.

## Status of `tools/clearing/`

`tools/clearing/` is **not on `main` yet** (2026-10-01). This doc is the spec it must meet. A first implementation may exist on a `take8-archive` branch. It was not on the remote when this doc was written. If you find it, treat it as a draft. Its validator is exactly the data-only kind that reported ALL PASS on take 8, so it must be brought up to the rendered-pixel rows below before anyone trusts it.

Expected layout:

| Path | What |
| --- | --- |
| `tools/clearing/README.md` | How to run generate + validate. |
| `tools/clearing/schema.json` | JSON Schema for `clearing.json`. No biome-specific words. |
| `tools/clearing/generate.*` | `clearing.json` → placement, colliders, gate, fog patches. |
| `tools/clearing/validate.*` | Renders the real play view, prints the PASS / FAIL table, writes proof stills. |
| `<biome>/clearings/<id>/clearing.json` | One file per clearing. Single source of truth. |

## Layout as data

One `clearing.json` per clearing is the **single source of truth**. Placement, colliders, gates, and fog patches are **generated** from it. Nothing is hand-placed in the scene code. A hull that is in the scene but not in the file, or in the file but not in the scene, is FAIL.

The schema uses only these generic words. No style or paint word appears as a key. Style lives only in the Imagine assets the paths point to.

| Key | Meaning |
| --- | --- |
| `zone` | Walkable area: shape, radius, centre, ground tile set (top-down Imagine tiles, `0.90` m), relief settings (amplitude, edge height 0). |
| `edge_ring` | Ring radius, the list of hull assets (`tools/walkaround` `asset.json`) with heading, radial offset, yaw. Max gap allowed outside gates: 0°. |
| `gates` | Each gate: `id`, heading, opening width, hull asset of the frame, optional living-layer asset (looping keyed Imagine video), `leads_to`. |
| `interior_objects` | Walk-around hulls inside the zone: asset, position, yaw, `interactive` flag. Budget 2–3 (doc 61). |
| `near_lens` | Camera-near cull and fade distances, so nothing blurry or semi-transparent sits in front of the lens (doc 61 take 4: blurry, semi-transparent near cutouts FAIL). |
| `fog_band` | Inner / outer radius, patch count (20–40+), fog atlas asset (one looping Imagine video packed into frames), size range, tint range, opacity range, loop offsets, near-camera fade. |

Allowed extra keys: `spawn` (position, `face: "gate:<id>"`), `backdrop` (360° far ring asset), `view` (`720×1600`, `mag_max: 1.0`), `bolt` (the two lock files). Values are per biome (asset paths). Keys are not.

Example (values are illustrative):

```json
{
  "schema": "clearing/1",
  "id": "level-01-A",
  "zone": { "shape": "circle", "center": [0, 0], "radius_m": 20,
            "ground": { "tile_m": 0.90, "tiles": ["tiles/t0.png", "tiles/t1.png", "tiles/t2.png", "tiles/t3.png"],
                        "relief": { "amp_m": 0.15, "edge_height_m": 0 } } },
  "edge_ring": { "radius_m": 18, "max_gap_deg": 0,
                 "hulls": [ { "asset": "hulls/edge-a/asset.json", "heading_deg": 0, "yaw_deg": 180 } ] },
  "gates": [ { "id": "to-path", "heading_deg": 238, "width_m": 4,
               "frame": "hulls/gate/asset.json", "field": "living/gate-field.mp4", "leads_to": "path-AB" } ],
  "interior_objects": [],
  "near_lens": { "cull_m": 1.2, "fade_m": [1.2, 2.5] },
  "fog_band": { "inner_m": 13, "outer_m": 24, "patches": 32, "atlas": "living/fog-atlas.png",
                "size_m": [3, 6], "opacity": [0.15, 0.35], "near_fade_m": [3, 6] },
  "spawn": { "position": [0, 0], "face": "gate:to-path" },
  "backdrop": { "ring": "backdrop/ring-360.png" },
  "view": { "width": 720, "height": 1600, "mag_max": 1.0 },
  "bolt": { "gallop": "lock/bolt-gallop-cycle.mp4", "idle": "lock/bolt-idle-breath.mp4" }
}
```

## Validator — PASS / FAIL table

The validator prints one table. Every row must be **PASS on the rendered view**.

| Row | Data check | Rendered check (required) |
| --- | --- | --- |
| `ring_closed` | 360 rays at **1°** from the centre each hit an edge-ring collider, except inside the gate span. | At each of **36 headings** (every 10°) from the centre, the edge-ring hulls' visible pixels cover the horizon band of the play view, except at the gate heading. |
| `collider_eq_visual` | Walk from the centre outward at the 36 headings; record each stop distance. | At every stop, Bolt stops within **0.5 m of a VISIBLE surface**, and a hull's visible pixels occupy the screen area in front of Bolt. An invisible stop is FAIL. |
| `gate` | Exactly the gates in the file; opening has no collider; leads to the path. | From the centre at the gate heading, the gate frame is visible and reads as an opening; walking through reaches the path trigger. HUD gate heading / distance match. |
| `near_lens` | Nothing inside `near_lens.cull_m` of the camera. | No object pixel inside the near zone; nothing blurry or semi-transparent in front of the lens. |
| `fog_band` | 20–40+ patches inside the band; near fade set. | Fog pixels are visible in the band; patches fade out near the camera; no hard streak edges. |
| `mag` | Tile size, hull approach caps (`qc/report.json` ≤ 1.0). | Magnification of ground, hulls, gate, fog, and Bolt **≤ 1.0** on the 720×1600 render, same number as the HUD. |
| `webgl_clean` | — | Zero WebGL errors (`gl.getError()` after the frame, console capture) during every validation render. |
| `single_bolt` | One Bolt entity; IDLE / GALLOP switch wired. | Exactly one Bolt in the rendered frame, at every heading and stop; idle frame and gallop frame both captured. |

Extra rows may be added. None of these may be removed. **A data-only check is FAIL**, even when the data agrees.

### How "rendered" is checked

- Render the **actual play view**, the same renderer, scene graph, culling, draw list, and shaders the phone runs, at **720×1600**. Not a debug renderer. Not the top-down map.
- Camera poses: the centre at 36 headings, and every stop point of `collider_eq_visual`.
- Read visibility back from the real framebuffer of that play view, for example:
  - an **object-ID / picking buffer** written by the same draw calls, with the same alpha discard as the colour pass (a texel that is cut out writes no ID), then `readPixels`; or
  - **per-draw visible pixel counts** (occlusion queries / sample counts) on the play-view draws.
- An object that exists in data, the debug map, and the collider set, but writes no visible pixel in the play view, counts as **absent**.
- Headless is fine (headless Chromium with WebGL at 720×1600). The numbers must come from that render, not from the JSON.

### Proof and STOP

- **HARD: no play URL** until every row PASSES on the rendered view.
- Proof stills, written by the validator from the play view:
  1. debug top-down map (zone, ring, gate, colliders, fog band, stop points);
  2. centre → gate view;
  3. two stop views with Bolt against a **visible** hull;
  4. fog band view;
  5. Bolt IDLE;
  6. Bolt GALLOP.
- Then **STOP**. The owner records phone QC himself. A validator PASS is not a KEEP.

## Critical lesson — take 8 (2026-10-01)

The validator reported **ALL PASS**. The edge-ring hulls existed in the data, on the debug map, and in the colliders, but were **not rendered** in the play view.

| Phone / play view | Validator said |
| --- | --- |
| Empty ground at **18 m**, no ring | `ring_closed` PASS |
| Invisible stop at **17.07 m**, heading **333°** | `collider_eq_visual` PASS |
| No visible gate at **238°** | `gate` PASS |

Every row checked the data against itself. None looked at the pixels the player sees. That is why the rendered column above is required, and why a data-only check is FAIL.

The console also showed WebGL **`texSubImage3D` `INVALID_OPERATION`** errors, which likely broke the fog and hull rendering (an array-texture upload that does not match its `texStorage3D` size, format / type, or layer count draws nothing). The validator must capture the WebGL / console errors of the render and FAIL on any.

## Do not

- Hand-place a hull, collider, gate, or fog patch outside `clearing.json`.
- Put biome words in the schema.
- Validate against the JSON, the debug map, or the collider set alone.
- Count a cut-out (alpha-discarded) texel as a visible pixel.
- Post a play URL, or call a clearing KEEP, before every row passes on the rendered view and the owner's phone QC.

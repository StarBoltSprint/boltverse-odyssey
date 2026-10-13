# Kit + relief + material library — the method (Zone D tier, 2026-10-13)

Back to [METHOD.md](../METHOD.md). Tools: [`tools/materials`](../../tools/materials/README.md), [`tools/kit`](../../tools/kit/README.md), [`tools/scatter`](../../tools/scatter/README.md).

## In plain words
One Imagine key image is 1024 px. On a wall up close that is ~16 px per metre: blurry. We need 500+.
1. **Solid kit pieces** (tiers, recess, cornice on a support, drifts, icicles) are fitted to the key: outline from SAM masks, step lines from the key, **depths from rules** (rise 2.5 m, tread 2.5 m, recess ≤ 2.5 m) because single-image depth inflates them.
2. **Imagine tileable materials** come from tight crops of the key (basalt, snow). Same colours, 512+ px/m. They are stored once in the **material library** and reused.
3. Each material's **height map pushes real relief** into the geometry (stones proud, joints deep, drifts rounded), strongest near the player and **fading with distance**, with LOD0/1/2.
4. **Hex tiling + triplanar** in the shader hides the 1024 repeat; the key's colour gain stays on top so it still reads as the key.
5. **Scatter + detail layers** (rocks, debris, tufts; dirt, snow, cracks, moss) are placed by key masks and rules, instanced for the phone.
Every colour pixel is Imagine. Light and shadows are computed live.

## Order
`materials find` → (if missing) Imagine tile → `materials add` → `kit build --fit --fit-camera` → read `contact.jpg` + `metrics.json` → viewer `probePxPerM` → `scatter run` + `detail run` → Critic + Art Director → only then `library add --intake` (KEEP). Before that: `library add-wip`.

## Gates
| Gate | Bar | Where |
|---|---|---|
| Material dE vs key crop | ≤ 5 | `materials check` |
| Material texel density | ≥ 500 px/m (texture) and **live** ≥ 500 at the 3 m spine cam | `materials check`, `probePxPerM` |
| Scene content in a tile | none (no sky gradient, seams wrap) | `materials check` |
| Repetition | hex peak ≤ 0.35 and below plain | `materials check`; re-run on captures |
| Shape | IoU closed ≥ 0.85, raw ≥ 0.75 | `kit build` |
| Watertight | 0 open edges (icicles excluded) | `kit build` |
| Phone | LOD0 ≤ 90k tris; scatter ≤ budget draw calls / tris / instances | `kit build`, `scatter run` |
| Walkable | no prop within path clearance | `scatter run` |
| Eye | Critic + Art Director KEEP from the play build | humans/bots, not a tool |

## Known failures (do not repeat)
- **v1 two boxes: IoU 0.45.** Plain blocks miss the recess, the band and the icicle fringe. Pieces must follow the key outline.
- **MoGe depth inflation.** Monocular depth read the treads at 5.3–8.0 m; the key reads 2.5 m. Clamp every depth to a rule; never trust raw depth for kit depths.
- **Snow chosen by surface angle reads dark.** v5 put snow where the normal faced up; the key's snow is driven by its **snow mask** and lit pale. Drive snow cover per face from the key snow mask (`detail.py` `mask` + `up_facing`) and gain it to the key.
- **Uniform decimation spikes blocks.** Decimating displaced lod0 uniformly turned stone blocks into spikes (v5 "hérissé"). Build each LOD from its own tessellation (`res_m`) and drop the block push below LOD0.
- **Offline px/m lies.** v4 measured 512 offline but the viewer ran ~200 px/m (downscaled textures). Only the live probe counts.
- **Floating cornice.** A slab with nothing under it reads as floating from the side. Seat it on a support block (v4 fix).
- **Mirrored key camera.** A kit frame with det = -1 mirrors the image; check `project()` against the legacy camera on known points before trusting IoU.
- **Even-odd raster.** `cv2.fillPoly` on a list of triangles cancels overlaps and speckles the silhouette; rasterise triangle by triangle.
- **Relief that grows the outline.** Blocks or drifts pushed in front of the key outline cost IoU; step blocks back from the outline plane.
- **Grey cones.** Icicles with no material read as grey cones in the sky; they need the ice material and must grow out of the drift.

## Status 2026-10-13
Tier kit = **WIP** (`biome/library/_wip/zd-tier-terrace`). v4: IoU 0.747/0.869, dE 2.37/3.48, 0 open edges, but Critic + Art Director FAIL (snow identity, icicles, block depth 8 cm vs 20–40 cm, ground, 195.5k tris). Outline-mask mode (ported 2026-10-13, `tools/kit/outline.py`) reaches **0.787 raw / 0.882 closed** on Zone D (v4 0.747/0.869), 0 open edges, 82.3k lod0 tris, snow ratio within 3.8% of the key.

## v7 (0003): AD + critic pass
- Spec `tools/kit/specs/zd-tier-v7.json`: zipper-wall cell extrusion with `fix_manifold` (0 open, 0 non-manifold edges),
  Taubin smoothing, inward block relief (0.32 m joints, 0–0.18 m faces) on courses taken from the key, a drift lip,
  and snow calibrated by threshold bisection (gate 2%).
- Cornice: the slab is the SAM mask minus the fringe. Icicles grow from the fringe (irregular, matte ice). A **seat wedge sits under
  every 0.5 m slab segment**, running 0.4 m into the smoothed wall top and 0.1 m into the slab, and a corbel sits every 1.1 m.
  `float_report` checks point-in-solid with a skewed ray and must find 0 floating probes.
- IoU target = tier + band (upper wall) + cornice. Tier+cornice-only IoU is reported next to it.
- Review: `tools/kit/viewer` (real headless Chrome, SwiftShader WebGL, spine phone camera, 6 views + mesa scale).

## v8 (0004): pre-AD self-fix
- `specs/zd-tier-v8.json`: `block_quantize` gives each block (one key course × a 0.9 m running-bond column) a single
  back depth, so tread edges step once per block instead of once per 11 cm cell.
  - The depth is the shallowest cell of the block, so the model stays inside the visual hull.
- Base: `sink_base` continues every wall column whose key-visible bottom is ≤ 1.5 m down to −0.3 m.
  - A `snow_skirt` bank covers the wall foot. Where the key shows the foot buried, the bank reaches the visible bottom; where the wall meets the ground, a low 0.25 m drift is used.
- Scoring: the skirt is terrain. Silhouette and snow ratio z-buffer it out (`render.zlabel`) and clamp buried geometry to the ground.
  - The IoU gate is in the spec (`iou_closed_min` 0.882). `iou-diff.png` is written: red = model only, blue = key only.
- Viewer: triplanar basalt normal map (`hexTriplanar` `normalMap`). The snow tile gets a linear gain of (1.31, 1.66, 1.09) toward the ground plate, which removes the purple-grey cast.
- Tier+cornice-only IoU stays low because the SAM tier mask misses the upper wall (band). `iou_vs_tier_cornice_band_ignored` scores without the band pixels.

## v9 (0005): smoothed outline + corrected key mask
- `contour_snap`: the occupancy is blurred (σ 0.3 m) and every boundary-corner vertex is moved onto the 0.5 iso-line
  with Newton steps (at most 1.5 cells). The outline becomes a smooth curve along the key contour. Topology does not change,
  so open and non-manifold edge counts stay at 0.
- The key tier mask `zd/tier_full.png` merges two SAM2 (hiera small) box re-prompts (`tier_full.sam2-boxes.json`, run through
  `tools/placement-from-key/sam2_boxes.py`) with the old tier and band masks, closed 9 px, keeping the largest component.
  It covers the terrace from the key's left edge (px 0) to px 616. The old SAM mask missed the upper wall and the left 138 px.
- The scores against the old masks (`iou_vs_old_tier_*`) are still reported for comparison. They are low because the model now covers the true, larger shape.
- cell_m is 0.13 to stay under 90k triangles. The cornice side view moved to the front-left, because the wall now runs on to x −11.5 m.

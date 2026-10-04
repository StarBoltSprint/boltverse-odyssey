# tools/layout

Writes and checks one `clearing.json` per zone. The file is the placement. Builders do not type object coordinates by hand.

The tool computes **invisible shape only**: positions, yaw, scale, relief height, and collider circles. It does not draw, shade, or colour a world pixel. Every visible pixel stays an Imagine asset named by the file. The top-down PNG is a kitchen diagram of that shape, not a play view and not an Imagine still.

Law: [`biome/docs/63-layout-file-and-validator.md`](../../biome/docs/63-layout-file-and-validator.md) and [`biome/docs/62-open-world-zones-process.md`](../../biome/docs/62-open-world-zones-process.md). Hull manifests come from [`tools/walkaround`](../walkaround/README.md).

Python 3.10+. Standard library only. `numpy` is optional: if a walkaround folder has `hull.npz` and numpy imports, the footprint radius is the XZ extent of the occupancy. Otherwise the manifest's `footprint` or `placement.collisionRadius` is the circle.

## Commands

From the repo root:

```bash
python3 tools/layout/layout.py generate \
  --spec tools/layout/testdata/spec.json \
  --out /tmp/zone

python3 tools/layout/layout.py check \
  --clearing /tmp/zone/clearing.json \
  --out /tmp/zone

python3 tools/layout/layout.py check \
  --clearing tools/zoneflow/fixture/clearing-a.json \
  --world tools/zoneflow/fixture/world.json \
  --out /tmp/zone-world
```

The fixture clearing has no edge ring, so that check fails the zone rows. The `transition` line is the corridor graph. `python3 tools/layout/selftest.py` runs the same row on the good sample, where the other rows still pass.

`check` writes `report.md`, `report.json`, and `debug-topdown.png`. It prints one `PASS` or `FAIL` row per rule. Exit **0** when every row passes. Exit **1** when any row fails. Exit **2** when the file or an asset cannot be read.

Paste `report.md`. A layout PASS does not open a play URL.

`python3 tools/layout/selftest.py` rebuilds the synthetic zone and checks the committed samples.

Scatter skips a point that lands in a hard-object walk passage (2026-10-04). The spec may set `hard_passages` (quads with `corners` and `pad`) or `ruin_manifest` (a ruins pack). With neither key, placement is unchanged. `python3 tools/layout/passages.py` is that selftest.

## What the spec asks for

`testdata/spec.json` is the worked spec. Keys stay generic. No paint word is a key.

| Block | Meaning |
| --- | --- |
| `zone` | Circle, centre, radius, 0.90 m tiles, relief amplitude and seed. |
| `ring.radius_m` | Centreline of the edge ring. |
| `gates` | Bearing, opening width (chord metres), frame asset, `leads_to`. |
| `hero` | Body width and radius. Width is the largest gap the ring may leave, apart from gates. |
| `categories` | Assets plus count or a fill, scale band, and for interiors an annulus `band_m`. |
| `limits` | Spawn clearance, minimum gap, path width, gate-cone length and half-angle, yaw and scale epsilon. |
| `view` | 720×1600, vertical fov, `mag_max`, follow distance `boom_m`, eye height. |

Categories used by the sample: `ring`, `exit` (gate jambs), `mid`, `near`, `hero`. Counts live in the spec. Doc 61's walk-around interior budget is the `hero` budget (sample max 3). The edge ring is not that budget.

Asset paths point at a walkaround `asset.json` (or the same shape of manifest). A category may instead list `{ "library": "<object-id>" }`, which resolves through [`biome/library`](../../biome/library/README.md) to that object's asset. Path strings are unchanged. If the category sets `scale`, that band is used. If it omits `scale` and every entry is a library id, the manifest's scale band is used. If it omits `scale` and the entries are paths, the band stays `1..1`.

The loader reads, in order:

1. `sourcePx.width` / `sourcePx.height` on the manifest (silhouette pixels, not a padded frame).
2. Else `qc/report.json` → `silhouetteLock.perView`, using the **smallest** width and height so the magnification check stays conservative.
3. Else the first camera's frame size. A full frame is larger than the silhouette, so this **under-estimates** magnification. Prefer a silhouette.

Footprint: `footprint` circle (`source: hull-xz` is the occupied columns on the ground, and that radius is `placement.collisionRadius`) or convex polygon, else `hull.npz` when numpy is present, else `placement.collisionRadius`. Generated colliders copy that radius and set `source` to `hull-footprint`. They are one circle per instance, not the ring.

## What generate writes

Schema `clearing/1`. Placement fields sit on the doc 63 objects. `tools/playcheck` (when that tree is present) reads this file as `--layout`. Its reader treats `position` as **`[x, z]`**, heading **0 = +z** and **90 = +x**, `edge_ring.hulls[].width_deg`, `interior_objects[].radius_m`, and gate `width_m` as a chord. Those fields are always written. Extra keys (`colliders`, `scale`, `base_y_m`, `limits`, `hero`, `variants`, `budgets`, fog `instances`) are ignored by that reader.

`base_y_m` is the relief height. It is not stuffed into `position`, because that slot's second component is z.

The same seed writes the same bytes. Interior positions and relief use seeded 2D simplex. The noise does not draw.

## Check rows

| Row | FAIL when |
| --- | --- |
| `ring_closed` | A 1° ray from the centre misses the visual ring or the collider ring outside a gate, or the missed arc is longer than `hero.width_m`. Both gaps are printed. |
| `collider_eq_visual` | A collider has no object, an object has no collider, the centre or radius differs by more than 2 cm, or an outward ray hits a collider more than 0.5 m before any visual. The invisible-stop distance and heading are printed. A collider centred on the zone (within 5 cm) whose radius matches `edge_ring.radius_m` (within 5 cm) is a ring wall: `ring_wall` counts it and the row fails. `edge_ring.radius_m` is the placement centreline, not a stop. |
| `gate` | Frame asset or `frame_ids` missing, the opening chord is narrower than the hero and the path, or a collider's angular span enters the opening. |
| `path` | Clearance from the spawn point to the gate mouth is under half `path_width_m`. |
| `gate_cone` | A solid circle meets the cone in front of a gate. |
| `spawn_clearance` | A solid surface is inside the spawn disk. |
| `separation` | An interior overlaps another solid, or the air gap is under `min_gap_m`. Adjacent ring pieces may overlap; that is how the ring closes. |
| `relief` | `base_y_m` is not the simplex relief at that xz (tolerance 0.5 mm). |
| `mag` | On-screen magnification at the closest follow-camera distance exceeds `view.mag_max`. |
| `variety` | A neighbour matches asset, yaw (within epsilon), and scale together, or a category's variants are not spread (counts differ by more than 1). When the clearing records `yaw_bands`, yaw is the offset inside that band. A band whose quantized offsets cannot differ by more than `yaw_eps_deg` does not fail this row for a shared yaw (owner decision 2026-10-02, spec rail 8: variety comes from distinct assets and scale). The row then also prints `yaw_span_deg` and `yaw_span_cat`. |
| `yaw_band` | Present when the clearing records `yaw_bands`. A placed object's yaw offset from its category reference is outside `yaw_band_deg`, or a band uses `yaw_ref` `inward` (`inward_refs`). `world` is yaw 0. `generate` exits 2 on `inward`. Organic `boundary` and `exit` without the key default to world [-15, 15]. Placed labels `boundary-N` still use the `boundary` band. The worst offender is printed. Director decision 2026-10-02 15:04 (delegated owner approval). Spec rail 8. A circle file with no `yaw_bands` omits the row and round-mode report bytes stay as they are. |
| `fog_band` | Fewer than 20 patches, or an instance sits outside the annulus. |
| `near_lens` | Spawn surface is closer than `near_lens.cull_m`. |
| `budgets` | A category count is outside the range copied into the file. |
| `playcheck_data` | The 1° `width_deg` test from `tools/playcheck/src/layout.mjs` misses. **Data half only.** |
| `bolt_paths` | `bolt.gallop` or `bolt.idle` is empty. This does not open the files. |
| `transition` | Present only with `--world`. FAIL when this zone is not on a corridor, `bakedGroundSpeed` is not above 0, `length_m` is not above 0, the ground file is missing, or the from / to gate is not in that zone's `clearing.json`. |

## Magnification

Square-pixel focal length from `view.height` and `view.fov_y_deg`. World height and width at `scale`, divided by the closest distance, times that focal length, divided by `sourcePx`.

Closest distance is the follow camera: scaled footprint radius + `hero.radius_m` + `view.boom_m`, combined with the vertical gap between eye height and the object's mid height. If the manifest also has `approach.capDistance` and `approach.maxMagnification`, that figure is computed at the same distance and the **larger** of the two magnifications is kept.

If the play camera can move closer than `boom_m`, the row is optimistic. Set `boom_m` to the real minimum.

## Samples

| Path | What |
| --- | --- |
| `sample/good/` | Seed 11. 16/16 PASS. Closed ring, clear gate, magnification 0.61 at the worst object. |
| `sample/broken/` | The same file after `mutate.py`. Exit 1. |

The broken edit is intentional: visuals removed on headings [40°, 143°), colliders kept; one neighbour cloned; one near object scaled to 4; one mid object lifted to `base_y_m` 3.5; the hero moved onto the gate centreline; the gate frame cleared. Measured on this seed: visual gap **104°** at 42.5°, collider gap **0°**, **16** collider-only ids, invisible stop **17.37 m** at heading 42.5°. See `sample/broken/NOTES.md`.

## Honest limits

- A paired object and collider can still be invisible in the play view. Take 8 passed a data check while the phone showed an empty ring, a stop near 17 m, and no gate. This tool would have failed the **file** faults in `sample/broken` (missing visuals, extra colliders, blocked gate). It cannot see a draw call that writes nothing. Rendered pixels are `tools/playcheck` (`node tools/playcheck/run --layout clearing.json`). The selftest imports `tools/playcheck/src/layout.mjs` (`normalizeLayout` + `ringRays`): the good sample has 0 missed 1° rays and the broken sample misses 104. Until a framebuffer run exits 0, do not claim that PASS. `playcheck_data` is only the data half of that reader's ring test.
- The diagram is drawn by this process (filled circles, lines). It is not the phone.
- Ring closure samples every 1°. A crack thinner than that sample can pass `max_gap_deg: 0` only if no sample lands in it. The hero-width test uses the measured run of missed samples.
- A polygon manifest is placed and checked as its bounding circle (the ring, the path, and the separation row all use that circle). Height is used for relief and magnification, not for a 3D intersection. The occupancy grid inside `hull.npz` is not the collider the check walks, beyond that one radius.
- Fog streaks, blur, WebGL errors, and whether a texture actually appears are outside this tool.
- `sourcePx` taken from a camera frame instead of a silhouette makes `mag` look safer than the phone.
- `--world` adds the `transition` row and does not change a check that omits it. The sample reports stay 16 rows. That row checks the corridor graph only. Black frames and hitch time are `tools/playcheck` (`transition_black`, `transition_hitch`), and only when the play view reports `snapshot().transition`.

## Organic zones (`clearing/2`)

`zone.shape: "organic"` is an extra mode. Circle specs (`zone.shape: "circle"`, schema `clearing/1`, `schema.json`) are unchanged, including sample bytes. Organic output is schema `clearing/2` (`schema.v2.json`).

Give **either** a closed counter-clockwise polygon in metres:

```json
"zone": { "shape": "organic", "reference_area_m2": 400, "center": [0, 0], "footprint": [[0, 0], [80, 10], [40, -70]] }
```

**or** a seeded generator. The same seed writes the same bytes. If both are present, the explicit footprint is kept and sub-areas and passages still come from `zone` or `zone.generator`.

| Key | Meaning |
| --- | --- |
| `zone.reference_area_m2` | Walkable area of the retired circle. `zone_area` requires at least 5× this. |
| `zone.generator.target_area_m2` | Target area passed to the grower (the checker uses the footprint, not this number). |
| `zone.generator.long_axis_m` | Requested long axis. The checker requires the footprint long axis ≥ 80 m. |
| `zone.generator.max_convexity` | Grow stops when area / convex-hull area is at or under this (checker cap 0.85). |
| `zone.generator.sub_areas[]` | `id`, `center` `[x, z]`, `radius_m`, `role`. At least 3. Each disk needs ≥ 150 m² walkable. |
| `zone.generator.passages[]` | `from`, `to`, `width_m`. The file stores `center` (polyline) and `width_m`. |
| `zone.generator.seed` | Footprint seed. |
| `zone.ground.relief.amp_m` | Relief amplitude, at most 3 m. |
| `zone.ground.relief.wavelength_m` | At least 20 m. |
| `zone.ground.relief.max_slope_deg` | Walkable slope cap, 15°. |
| `boundary.assets` | Manifests placed along the footprint, overlapping, `boundary.rows` 1–3 outward. |
| `boundary.rows` | Row 0 sits on the polyline. Later rows step outward. |
| `gates[].at_m` or `gates[].target` | Arc length along the polyline, or a point snapped onto it. |
| `gates[].width_m` | Opening chord. Must be at least `hero.width_m + limits.path_width_m`. |

`base_y_m` is the organic relief at that xz. Circle relief is a different function and is not called. On a circle spec with no `yaw_band_deg`, yaw uses the same cycle as the circle ring (outward heading + 180° + the cycle) and the clearing omits `yaw_bands`. On an organic spec, a `boundary` or `exit` category with no `yaw_band_deg` defaults to world yaw [-15, 15] (Director decision 2026-10-02 15:04, delegated owner approval; spec rail 8). Other organic categories with no key stay on the circle cycle and omit a band. Colliders are one circle per piece, `source: "hull-footprint"`. Gates store `position` on the boundary and `heading_deg` along the outward normal. Interior objects are a small seeded scatter inside the footprint. When the spec also sets `scatter`, `pois`, `far_plates`, or `cells`, the same seed adds density placement, discovery points, far plates, and streaming cells. A spec that omits those keys omits them on the clearing. Boundary pieces are labelled `boundary`. Exit pieces are labelled `exit`.

| Key | Meaning |
| --- | --- |
| `scatter.categories.<name>.count` | Exact object count. Wins over `density_per_100m2`. |
| `scatter.categories.<name>.density_per_100m2` | Count is that density times the footprint area / 100, rounded half up, when `count` is absent. |
| `scatter.categories.<name>.band` | `fore`, `mid`, or `far`. Bands follow the passage graph: the spawn-role sub-area is fore, the far end of that graph is far, and the ranks between are mid. |
| `scatter.categories.<name>.cluster_radius_m` / `cluster_count` | Poisson-disc samples pulled into clusters of that radius. |
| `scatter.categories.<name>.min_boundary_m` | Keep the disc at least this far inside the footprint. |
| `scatter.categories.<name>.max_slope_deg` | Local slope cap. The checker never uses a cap looser than 15°. |
| `pois[].intent` | `hidden_from_spawn` (occluded from the spawn eye), `landmark` (beacon, also written as a far plate), or `on_route` (within `within_m` of a passage centre line). |
| `far_plates[]` | Placed beyond the boundary along `bearing_deg`, at least `d_min` from walkable ground. No collider. Ids are listed on `always`. |
| `cells.mode` / `cells.size_m` | `grid` (default edge 24 m) or `sub_area` (one cell per sub-area, neighbours from the passage graph). Each cell stores `id`, `members`, `aabb`, and `neighbours`. With a `streaming` block, each cell also stores `preload`. |
| `streaming.fade_in_ms` | Opacity ramp in milliseconds. The check PASSes only in [300, 600]. Owner decree #457, approved 2026-10-02. |
| `streaming.fade_in_distance_m` | Optional distance ramp in metres. When present it must sit in [2, 24] (a ramp completes within one ~24 m cell, spec rail 11). Director decision 2026-10-02 15:04 (delegated owner approval). |
| `streaming.preload_lookahead_m` | Metres ahead of a cell centre. Must be at least the resident cell radius. |
| `streaming.preload_cone_deg` | Full cone in degrees. Required, finite, and in [30, 180]. Director decision 2026-10-02 15:04 (delegated owner approval), with decree #457. |
| `streaming.cell_radius_m` | Optional. Omitted uses 40 m (spec rail 11). The default is not written into the file. The row prints `cell_radius_source` `rail-11` or `file`. |
| `yaw_band_deg` | Per category, on `boundary`, on `categories.<name>`, on `scatter.categories.<name>`, or on a poi / far-plate object. A number N means [-N, N]. A pair is [lo, hi]. Relative to `yaw_ref`. |
| `yaw_ref` | `world` (yaw 0, the baked azimuth). `inward` is banned: `generate` exits 2, and `check` fails `yaw_band` with `inward_refs`. Director decision 2026-10-02 15:04 (delegated owner approval). Spec rail 8. |

`generate` honours the band in circle mode and in organic mode. It rewrites yaw after positions are fixed, so colliders, cells, and separation stay on the same centres. Spread inside the band is yaw only. On a circle spec that omits `yaw_band_deg`, yaw stays on today's formulas, the clearing omits `yaw_bands`, and the check omits the row. Round-mode sample bytes stay the same. On an organic spec, `boundary` and `exit` without `yaw_band_deg` default to world [-15, 15]. This organic sample sets [-15, 15] `world` on boundary, exit, interiors, and scatter. Placed labels `boundary-N` still resolve to the `boundary` band so an older file can be measured. Pois and far plates stay unbanded unless that object sets the key.

`d_min` is recomputed from the manifest and the view. It is not trusted from a stored field. `d_min = max(height, width) * focal_px / source_px / mag_max`, with `focal_px = (view height / 2) / tan(fov_y / 2)`. Owner decision 2026-10-02, spec rail 9. The sample beacon (height 20 m, source 2048 px, view 720×1600, fov_y 40, scale 1) needs about 21.5 m. Far-plate magnification uses the nearest walkable sample, and the row prints `far_d_m` and `far_d_min_m` only when far plates exist.

Discovery and cell thresholds (owner decision 2026-10-02): a landmark is visible from at least 60% of the 2 m walkable samples (spec rail 10); at least 2 POIs are occluded from the spawn eye (spec rail 10); every boundary piece, interior, and in-zone POI sits in exactly one cell, and far plates stay on `always` (spec rail 11). The visibility test is 2.5D: terrain relief plus footprint cylinders and their heights. It is not a framebuffer.

A passage loop fills its interior, so one side of a throat has no footprint edge. The generator places boundary pieces on that open side, including the bend's chord normal, so the clear width stays the passage width. Every boundary piece is category `boundary`. `separation` still allows boundary-to-boundary and boundary-to-exit overlap (the wall exemption). The matcher is the exact labels `boundary` and `exit`. Every boundary or exit piece versus an interior, scatter, or POI must meet `min_gap_m` 0.35. The overlap tolerance stays a gap under -0.02. Director decision 2026-10-02 15:04 (delegated owner approval).

Thresholds (owner decision 2026-10-02, spec rail 10, with the `no_ring` term from Director decision 2026-10-02 15:04, delegated owner approval): area ratio ≥ 5, convexity ≤ 0.85, best-fit circle IoU ≤ 0.75, long axis ≥ 80 m, ≥ 3 sub-areas each ≥ 150 m², passage width 2.5–8 m, one turn ≥ 30°, one graph cycle, collider gap ≤ `hero.width_m`, `no_ring` fails only when one category has at least 6 objects, the radius coefficient of variation from the footprint centroid is under 0.10, and the angular span (360° minus the largest gap) is over 180°, relief amplitude ≤ 3 m, wavelength ≥ 20 m, slope ≤ 15°. Ground magnification is the flat-ground figure times `1 / cos(max slope)`. `min_gap_m` stays 0.35.

Organic check rows, in order: `rules_present`, `zone_area`, `footprint_shape`, `sub_areas`, `passages`, `boundary_closed`, `collider_eq_visual`, `no_ring`, `relief`, `relief_slope`, `mag`, `gate`, `spawn_clearance`, `separation`, `variety`, `yaw_band`, `fog_band`, `near_lens`, `budgets`, `discovery_data`, `cells`, `stream_plan`, `scatter`, `bolt_paths`. `yaw_band` is present when the clearing records `yaw_bands`. A circle spec that omits `yaw_band_deg` omits that row. An organic file records `yaw_bands` for `boundary` and `exit` even when the spec omitted the key (world [-15, 15]). `yaw_ref` `inward` fails the row (`inward_refs`) and makes `generate` exit 2. `stream_plan` is present only when the clearing has a `streaming` object. `transition` only with `--world` (a gate fails that row only when `width_m` ≤ 0). Circle rows `ring_closed` and `playcheck_data` are not emitted. `tools/playcheck` reads an organic file for the rendered rows. `fade_in` is emitted there only when that file has `streaming`. `preload_ahead` is also emitted when the page snapshot declares streaming. The layout selftest still imports the circle ring reader for the circle samples. `discovery_data`, `cells`, and `scatter` are emitted for every organic file. A file with no POIs, no cells, and no banded interiors fails those rows.

| Sample | What |
| --- | --- |
| `sample/organic-good/` | Generator seed 11. Committed files are `spec.json`, `report.md`, `report.json`, and `debug-topdown.png`. `clearing.json` is built at selftest time. Every organic row PASS. Manifests under `testdata/organic/` are labelled `TEST FIXTURE - not Imagine`. The whole `sample/organic-*` set stays under 1 MB. Director decision 2026-10-02 15:04 (delegated owner approval). |
| broken organic rows | Built inside `selftest.py` at run time (footprint_shape, zone_area, boundary_closed, no_ring, passages, relief_slope, plus the later mutations). Each named row FAILs. Those clearings are not committed. |

### Streaming plan (owner decree #457, approved 2026-10-02)

Optional spec object `streaming`. When it is absent, `generate` writes no `streaming` key and no per-cell `preload`, and `check` emits no `stream_plan` row. Circle mode never reads the key.

`generate` copies the numbers onto schema `clearing/2` and adds `enter_rule` `crossfade-from-far-if-on-screen` and `headings_deg` `[0, 45, 90, 135, 180, 225, 270, 315]`. Heading 0 faces +z and 90 faces +x. Each cell's `preload` is eight entries `{ heading_deg, cells }`. A neighbour is listed when the centre-to-centre distance is within `preload_lookahead_m` and the bearing is inside half of `preload_cone_deg` (inclusive). The cell itself is excluded. An empty list for one heading is valid. Ids are sorted.

`stream_plan` FAILs when `fade_in_ms` is outside [300, 600], `preload_lookahead_m` is under the cell radius, the cone is missing or outside [30, 180], a present `fade_in_distance_m` is outside [2, 24], `enter_rule` or the eight headings differ, a preload id is missing or names the cell itself (`missing_refs`), or the stored lists differ from that cone recomputed on the same cells (`mismatch`). The printed `fade_in_ms` is the file's number, including 100 and 900. A list that names only existing cells and still disagrees with the cone FAILs as `mismatch`. Cone 10 and 200 fail. Distance 1 and 30 fail. Cone 30 and 180, and distance 2 and 24, pass. Director decision 2026-10-02 15:04 (delegated owner approval). The [300, 600] window and the 40 m cell radius are unchanged.

The rule: a fade from alpha 0 applies only to an object that was not on screen before it entered range (outside the frustum, occluded, or beyond fog). An object already visible as its far representation must crossfade to the near representation and must never drop to 0. This tool writes neighbour ids and the numbers. It does not draw, shade, or apply the alpha. The fade is alpha on existing pixels. The engine applies the fade and the preload later.

`sample/organic-good` sets `fade_in_ms` 450, `fade_in_distance_m` 16, `preload_lookahead_m` 48, and `preload_cone_deg` 90. The check prints `cells=27`, `preload_refs=356`, `missing_refs=0`, `cell_radius_m=40`, `cell_radius_source=rail-11`. Existing organic rows on that sample stay PASS. Placements, yaws, colliders, and cell membership are unchanged by the block.

### Honest limits (organic)

- Checks are 2D. Piece colliders are bounding circles, not the hull mesh.
- `boundary_closed` casts a ray every 1°. A crack between samples can pass. Collider gaps are walked every 0.25 m along the footprint.
- Passage width is the clearance along the centre polyline **outside** the sub-area disks (0.5 m margin on segment samples; the bend vertex uses margin 0), and only on the central 38–62% of the polyline. The bend vertex uses the chord normal from the first vertex to the last, because a pinch on that normal is the width the row must see. Each side hit farther than 20 m is ignored (the ray left the throat). Min and max of the kept samples must both sit in 2.5–8 m.
- `no_ring` uses the footprint centroid only (Director decision 2026-10-02 15:04, delegated owner approval). It fails only when one category has at least 6 objects, the population coefficient of variation of centroid distances (std / mean, divide by n) is under 0.10, and the angular span (360° minus the largest gap, seen from that centroid) is over 180°. Equality at 0.10 or at 180° passes. Many objects in one category pass when the radii scatter or the span is narrow. The row prints `n`, `cv`, and `span_deg` for the worst category, plus `hits` and `where`. The same metric grouped by source asset path is printed as `by_asset_n`, `by_asset_cv`, `by_asset_span_deg`, `by_asset_hits`, and `by_asset_where`. Those by-asset fields stay report-only. On `sample/organic-good` the worst category is `boundary` (n=1051, cv=0.4984, span_deg=352.5918, hits=0) and `by_asset_hits` is 0. The sample still keeps each scatter category, each POI category, and `far-plate` at 5 or fewer objects. That cap is a sample property, not this row's threshold.
- `discovery_data` is a 2.5D test (relief height plus cylinder tops). Height is the placed `height_m`, otherwise the manifest `height_m` times scale. It does not read a framebuffer, so a hole in a silhouette that a mesh would open is invisible to this row.
- `scatter` compares each passage's measured throat with that passage's authored `width_m`. The printed `need_m` is the authored width of the worst passage (smallest measured minus authored). An object on a slope over 15°, or over a tighter authored cap, fails unless its category is exactly `exit` or exactly `boundary`, or the object is flagged `boundary`. Each of fore, mid, and far must hold at least one category. Occlusion still treats an older `boundary-N` label as a wall so an old file can hide a POI. That list is not the separation exemption.
- The diagram adds cell rectangles, band disks, POI intent disks, and far-plate disks to the polygon, pieces, gates, sub-area disks, and passage lines. It is a kitchen diagram. It is not the phone. It does not draw the preload cone or a fade.
- `stream_plan` reads the file. A PASS here is not a framebuffer and does not open a play URL. `preload_cone_deg` must sit in [30, 180]. A present `fade_in_distance_m` must sit in [2, 24]. Director decision 2026-10-02 15:04 (delegated owner approval). The tool does not clamp an illegal value on write. It fails the check.

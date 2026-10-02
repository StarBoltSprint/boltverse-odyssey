# Layout spec rails

The tools cite these rails by number. The numbers are the ones `tools/layout` already enforces (`tools/layout/README.md`, `tools/layout/organic_check.py`). This file does not add a second set.

## Rail 8 — variety and yaw

Variety comes from distinct assets and scale. When a clearing records `yaw_bands`, a shared yaw inside a band whose quantized offsets cannot differ by more than `yaw_eps_deg` does not fail `variety`. The row prints `yaw_span_deg` and `yaw_span_cat`.

`yaw_ref` `world` is yaw 0. `inward` is banned: `generate` exits 2, and `check` fails `yaw_band` with `inward_refs`. On an organic spec, `boundary` and `exit` without `yaw_band_deg` default to world [-15, 15]. Other organic categories with no key stay on the circle cycle. Placed labels `boundary-N` still use the `boundary` band. A circle file with no `yaw_bands` omits the row.

## Rail 9 — far-plate distance

`d_min` is recomputed. It is not trusted from a stored field.

`d_min = max(height, width) * focal_px / source_px / mag_max`, with `focal_px = (view height / 2) / tan(fov_y / 2)`.

The sample beacon (height 20 m, source 2048 px, view 720×1600, fov_y 40, scale 1) needs about 21.5 m.

## Rail 10 — organic shape

Thresholds: area ratio ≥ 5, convexity ≤ 0.85, best-fit circle IoU ≤ 0.75, long axis ≥ 80 m, ≥ 3 sub-areas each ≥ 150 m², passage width 2.5–8 m, one turn ≥ 30°, one graph cycle, collider gap ≤ `hero.width_m`, relief amplitude ≤ 3 m, wavelength ≥ 20 m, slope ≤ 15°. Ground magnification is the flat-ground figure times `1 / cos(max slope)`. `min_gap_m` stays 0.35.

A landmark is visible from at least 60% of the 2 m walkable samples. At least 2 POIs are occluded from the spawn eye.

### `no_ring`

The retired rule was a multi-centre scan that treated radii inside ±10% of several trial centres as a ring. That scan is not the PASS/FAIL rule.

`no_ring` fails only when one category has at least 6 objects (`RING_COUNT`), the population coefficient of variation of distances from the footprint centroid is under **0.10** (`RING_CV_MAX`, std / mean, divide by n), and the angular span (360° minus the largest gap) is over **180°** (`RING_SPAN_MIN_DEG`). Equality at 0.10 or at 180° passes. Many objects in one category pass when the radii scatter or the span is narrow.

The row prints `n`, `cv`, and `span_deg` for the worst category, plus `hits` and `where`. The same metric grouped by source asset path is report-only (`by_asset_*`).

## Rail 11 — cells and streaming

Every boundary piece, interior, and in-zone POI sits in exactly one cell. Far plates stay on `always`.

When `streaming` is present: `fade_in_ms` in [300, 600], `preload_cone_deg` in [30, 180], a present `fade_in_distance_m` in [2, 24], `preload_lookahead_m` at least the cell radius. An omitted `cell_radius_m` uses **40 m**. The default is not written into the file. The row prints `cell_radius_source` `rail-11` or `file`.

A fade from alpha 0 applies only to an object that was not on screen. An object already visible as its far representation crossfades and must not drop to 0. The tool writes neighbour ids and the numbers. It does not draw the fade.

## Stop after 2

The same defect fails twice, then stop. List the small Imagine-intrinsic miss and accept it. Do not spend another cook on that defect. This is the take 10d stop (the earlier cook continued to a third round of the same drift).

Hall smoke is unchanged: one fresh cook plus one enlarge, then stock. This rail does not raise that cap.

## One step

A Grok step has one goal and a done-when list of at most 8 rows. Write `REPORT.md` as each row is measured. An oversized step (several art families, the playcheck left until the end, no final answer) is a failure. Take 10d attempts 1 and 2 (419 and 290 turns) are that failure.

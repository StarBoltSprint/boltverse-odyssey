# layout check organic-sample

| row | status | numbers |
| --- | --- | --- |
| rules_present | PASS | missing=none |
| zone_area | PASS | walkable_m2=5851.0000, footprint_m2=6630.5000, reference_m2=400.0000, ratio=14.6275 |
| footprint_shape | PASS | convexity=0.5343, circle_iou=0.4207, long_axis_m=171.7323 |
| sub_areas | PASS | count=4, smallest_m2=717.0000 |
| passages | PASS | min_width_m=4.3232, max_width_m=6.0018, max_turn_deg=36.0001, cycles=1, samples=54 |
| boundary_closed | PASS | ray_misses=0, collider_gap_m=0.0000, gap_at_m=0.0000, hero_width_m=0.7000, gaps=none |
| collider_eq_visual | PASS | collider_only=0, object_only=0, footprint_mismatch=0, duplicate_ids=0, invisible_stops=0, invisible_stop_m=0.0000, invisible_heading_deg=0.0000 |
| no_ring | PASS | hits=0, where=boundary, n=1051, cv=0.4984, span_deg=352.5918, by_asset_hits=0, by_asset_where=tools/layout/testdata/organic/scatter-a/asset.json, by_asset_n=6, by_asset_cv=0.1861, by_asset_span_deg=210.9313 |
| relief | PASS | worst_err_m=0.0001, off_surface=0, id=fog-20 |
| relief_slope | PASS | max_slope_deg=8.6591, amp_m=0.9000, wavelength_m=42.0000 |
| mag | PASS | worst=0.9863, mag_max=1.0000, id=poi-mark, closest_m=21.7619, over=0, unresolved_assets=0, ground_mag=0.3225, slope_stretch=1.0115, far_d_m=21.7619, far_d_min_m=21.4647 |
| gate | PASS | gates=1, frame_missing=0, narrow=0, off_boundary=0, opening_blocked=0 |
| spawn_clearance | PASS | clearance_m=4.3465, need_m=3.2000 |
| separation | PASS | worst_gap_m=0.4858, min_gap_m=0.3500, overlaps=0, pair=mid-01|scatter-far-01 |
| variety | PASS | identical_neighbours=0, spread=0, yaw_span_deg=30.0000, yaw_span_cat=boundary |
| yaw_band | PASS | checked=1072, inward_refs=0, outside=0, worst_excess_deg=0.0000, worst_hi=0.0000, worst_id=none, worst_lo=0.0000, worst_offset_deg=0.0000, worst_ref=none, worst_yaw_deg=0.0000 |
| fog_band | PASS | patches=24, instances=24, outside_footprint=0 |
| near_lens | PASS | spawn_surface_m=4.3465, cull_m=1.2000 |
| budgets | PASS | categories=11, outside=0 |
| discovery_data | PASS | hidden=2, hidden_occluded=2, hidden_visible=0, landmark_visible_frac=0.9851, landmark_samples=1474, landmarks=1, on_route=1, on_route_far=0 |
| cells | PASS | cells=27, members=1075, missing=0, duplicated=0, aabb_outside=0, asymmetric=0, far_in_cell=0, always=3, always_missing=0, unknown=0 |
| stream_plan | PASS | fade_in_ms=450.0000, preload_lookahead_m=48.0000, preload_cone_deg=90.0000, cell_radius_m=40.0000, cell_radius_source=rail-11, missing_refs=0, mismatch=0, cells=27, preload_refs=356, headings=8, fade_in_distance_m=16.0000 — fade_in_ms in [300, 600] (owner decree #457, approved 2026-10-02). preload_cone_deg in [30, 180] and fade_in_distance_m in [2, 24] when present (Director decision 2026-10-02 15:04, delegated owner approval). preload_lookahead_m >= cell radius (spec rail 11, default 40 m). The rule: a fade from alpha 0 applies only to an object that was not on screen before it entered range (outside the frustum, occluded, or beyond fog). An object already visible as its far representation must crossfade to the near representation and must never drop to 0. |
| scatter | PASS | min_clear_m=5.2634, need_m=5.2000, steep=0, fore=4, mid=4, far=4, bands_missing=none |
| bolt_paths | PASS | gallop=1, idle=1 |

PASS 24 rows

This report is the layout file only. It does not read a framebuffer. A PASS here does not open a play URL.

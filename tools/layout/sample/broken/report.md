# layout check sample-zone-broken

| row | status | numbers |
| --- | --- | --- |
| rules_present | PASS | missing=none |
| ring_closed | FAIL | visual_gap_deg=104.0000, visual_gap_m=32.7996, visual_gap_at_deg=42.5000, collider_gap_deg=0.0000, collider_gap_m=0.0000, collider_gap_at_deg=0.0000, hero_width_m=0.7000, miss_visual=104, miss_collider=0 |
| collider_eq_visual | FAIL | collider_only=16, object_only=0, footprint_mismatch=0, duplicate_ids=0, invisible_stops=76, invisible_stop_m=17.3749, invisible_heading_deg=42.5000, ring_wall=0 — ids=ring-23,ring-24,ring-25,ring-26,ring-27,ring-28 |
| gate | FAIL | gates=1, frame_missing=1, opening_blocked=1, narrow=0 |
| path | FAIL | min_clearance_m=-1.2500, need_m=0.7500, spawn_x=0.0000, spawn_z=0.0000 |
| gate_cone | FAIL | blocked_gates=1, cone_m=5.5000, half_deg=26.0000 |
| spawn_clearance | PASS | clearance_m=3.9812, need_m=3.2000 |
| separation | PASS | worst_gap_m=1.0626, min_gap_m=0.3500, overlaps=0, pair=near-01|near-02 |
| relief | FAIL | worst_err_m=3.4448, off_surface=2, id=mid-00 |
| mag | FAIL | worst=1.5146, mag_max=1.0000, id=near-00, closest_m=7.2560, over=1, unresolved_assets=0 |
| variety | FAIL | identical_neighbours=1, spread=0 |
| fog_band | PASS | patches=28, instances=28, outside_band=0, inner_m=12.0000, outer_m=20.0000 |
| near_lens | PASS | spawn_surface_m=3.9812, cull_m=1.2000 |
| budgets | PASS | categories=5, outside=0 |
| playcheck_data | FAIL | ray_misses=104, first_miss_deg=42 — data half only; rendered pixels are tools/playcheck |
| bolt_paths | PASS | gallop=1, idle=1 |

FAIL 9 rows

This report is the layout file only. It does not read a framebuffer. A PASS here does not open a play URL.

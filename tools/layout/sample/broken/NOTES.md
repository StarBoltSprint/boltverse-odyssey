# Broken sample

`clearing.json` here is `sample/good/clearing.json` after `tools/layout/mutate.py`. The edit is the recipe. Do not treat this file as a zone to load.

The check exits **1**. Measured numbers from `report.md` on seed 11:

| Fault | Measured |
| --- | --- |
| Visual ring removed for centres whose heading is in [40°, 143°). Colliders for those pieces stay. | `ring_closed` visual gap **104°** (32.80 m of arc) starting at **42.5°**. Collider gap **0°**. |
| Those colliders have no rendered object. | `collider_eq_visual` **16** collider-only ids. Outward rays: **76** invisible stops. The first reported stop is **17.37 m** at heading **42.5°**. |
| Gate `frame` cleared and `frame_ids` set to `missing-frame`. Hero moved onto the gate centreline. | `gate` frame missing and opening blocked. `path` clearance **−1.25 m** (need 0.75 m). `gate_cone` blocked. |
| `mid-00` `base_y_m` set to 3.5. The moved hero keeps its old height, so it is off the relief too. | `relief` worst error **3.44 m**, 2 objects. |
| `near-00` scale set to 4, radius updated to match. | `mag` **1.51** (limit 1.0) at closest **7.26 m**. |
| One remaining ring neighbour copied asset, yaw, and scale from the piece beside it. Its collider radius was updated to match. | `variety` **1** identical neighbour. |

`playcheck_data` also fails (104 missed 1° rays). That is the data half of the playcheck ring test. It is not a framebuffer.

This is a synthetic layout. The 104° gap and the 17.37 m stop are the same class of fault as the take 8 phone (a gap on the order of 103°, a stop on the order of 17 m, a missing gate). They are not a replay of that phone log.

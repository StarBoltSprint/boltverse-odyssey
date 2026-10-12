# tools/01-block-library

Branch `tools/01-block-library`. Base `a0676f9f`. No Imagine call. No push, no merge, no `reset --hard`.

Parts (1) and (2) were already committed (`c6104250`, `36104106`). Part (3) is `017481a1`. This note is the acceptance fix for the two FAIL rows in that report.

## Self-tests

| command | exit |
|---|---|
| `python3 tools/library/selftest.py` | 0 |
| `python3 tools/objsheet/selftest.py` | 0 |
| `python3 tools/gate/selftest.py` | 0 |

Known-bad samples still FAIL inside the gate self-test (flat tower, shredded arch, ghost streaks 84, mirrored UV). The new cases pass: a missed ray hit is xorPx 1, and a 2× shear caps to anisotropy 1.2480 while the neighbour stays 1.0000 and keeps its vt indices.

## Terrace profile (rebuild)

Rebuild: `block_builder.py` on `steps/zone-d/01-terrace` with `tools/imagine-to-3d/profiles/terrace-zd.json`, `--out /tmp/block-accept/terrace-lodN`. The KEEP meshes in `steps/zone-d/01-terrace/work/terrace-lod*.obj` were not overwritten. No file under `steps/zone-d/` was edited. Objs, npy, and the switch ray passes stayed in `/tmp` and are not committed.

UV repair runs after the winding flip. Each triangle whose anisotropy is over `uvAnisotropyMax` (1.3 in the terrace profile) is rescaled in its principal frame so the ratio drops under the cap, the centroid stays, and the signed area stays. OBJ `vt` is 5 decimals, so the fit is re-measured after that rounding. A corner used by one triangle overwrites that vertex UV. A shared corner gets a new `vt`. Positions and the triangle list stay.

| check | measured | expected | PASS/FAIL |
|---|---|---|---|
| LOD0 tris | 74870 (verts 60921, icicles 221, flippedForWinding 11028) | ≤ 80000; v3.4.1 json is 74870 / 60921 / 221 / 11028 | PASS |
| LOD1 / LOD2 tris | 28336 / 15414 | same as `work/terrace-lod1.json` and `terrace-lod2.json` | PASS |
| bbox lod0/1/2 | delta max 0. aabb min `[-8.698812396580253, 0.0, -15.995999999999999]`, max `[8.614000413678983, 14.7275, 1.0]` | same aabb | PASS |
| ghosts on new lod0 bands + icicles, v34 tex, cwd = terrace step | ghosts 0, pass true | 0 | PASS |
| UV stretch, v3.4 visible gate on stored `renders/*-pass.npz` face ids (not a new colour pass) | worst p95 1.270 (grazing); over13Frac 0.0000 on every stored view. Phone 1.115, oblique45 1.266, close8m 1.113, close3m 1.099, close3m-up 1.099 | p95 ≤ 1.3 and over13Frac ≤ 0.005 (`view_gates.py`) | PASS |
| UV anisotropy max, every triangle | lod0 npy max 1.2998144627, over13Frac 0. lod1 1.2999522686, over 0. lod2 1.2998144627, over 0. Builder json rounds those to 1.299814 / 1.299952 / 1.299814 | ≤ 1.3 | PASS |
| LOD outline at Engine switches 15 m and 40 m | ray hit-XOR plus interior depth jump (`outline.py ray_pair`, same test as `lod_gate.py`). lod0–lod1 and lod1–lod2: xorPx 0 at both distances. switch15m hitPx 454805. switch40m hitPx 167984. focusXorPx 0, maxBlobPx 0. Cameras from `work/switch-views.json`, 720×1280, vertical FOV 60, raydiv 1 | xorPx 0 | PASS |
| binary raster 180×320, yaw 35°, dist 28 m | new lod0–lod1 xorPx 38 (hitPx 40428); lod1–lod2 xorPx 29 (hitPx 40406). KEEP scores 38 and 29. New lod0 vs KEEP lod0 xorPx 0 | not the acceptance row. Documented because the coarse raster still aliases | matches KEEP |
| new vs KEEP at the same switch cameras | lod0, lod1, and lod2 each xorPx 0 at 15 m and at 40 m | silhouette unchanged by the UV repair | matches KEEP |
| lod0 vertex delta vs KEEP | max 0.0543 m (60921 verts). Lod1 same 0.0543 m. Lod2 delta 0. Bbox extrema did not move | no documented interior epsilon. SAM2 multiply after the high-pass moves samples that were off the mask | reported |

Gate JSON:

- `steps/tools/01-block-library/accept/terrace-accept.json`
- `steps/tools/01-block-library/accept/ghost-lod0.json`
- `steps/tools/01-block-library/accept/outline-lod0-lod1.json`
- `steps/tools/01-block-library/accept/outline-lod1-lod2.json`
- `steps/tools/01-block-library/accept/outline-keep-compare.json`

The acceptance check is `python3 tools/gate/outline.py --ray <a.npz> <b.npz> --view switch15m` (and `switch40m`). Exit 0 only when xorPx is 0. The 28 m binary command is unchanged and still requires xorPx 0 on that raster. It is not the terrace switch gate.

## Done when

| row | result |
|---|---|
| (1)(2)(3) self-tests exit 0 | yes (0, 0, 0) |
| terrace acceptance table all PASS | yes. The two former FAIL rows are PASS with the numbers above |
| diff stays in the allowed trees | `tools/gate`, `tools/imagine-to-3d`, `steps/tools/01-block-library`. No `steps/zone-d/` edit |
| no Imagine; no push/merge | held |

`learn/`, the quota log, and `tools/preview/freeze.py` were not updated. Those paths are outside the allowed diff. No quota number was invented. No play page was invented.

## Director

1. Every-triangle anisotropy max is 1.2999522686 on lod1 and 1.2998144627 on lod0 and lod2. Over-1.3 count is 0. The visible p95 gate still passes, and over13Frac on the stored face ids is now 0.
2. Ray outline xorPx is 0 at 15 m and at 40 m for lod0–lod1 and lod1–lod2. The 28 m binary raster is still 38 px and 29 px, the same as KEEP. That raster is not the Engine switch.

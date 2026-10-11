# ground tile — Zone C moss plates

Status: validated. Do not copy this file into a cook until the rows below are filled from a real run.

| Field | Value |
| --- | --- |
| Asset kind | ground tile |
| Take | zc/03-terrain plates |
| Commit | `fa2d6e61` |
| Date | 2026-10-11 |
| Size | 1408×1408, four plates, already committed |
| Tries | 1 of 2 |
| CLI | none this step (plates were already edits of key-zc1) |
| Image refs | `not stored` here. The pixels are `steps/zone-c/03-terrain/plates/moss-top-1.jpg` through `moss-top-4.jpg`. |

## Prompt

not stored. This step did not call Imagine.

```
not stored
```

## QC rows passed

| Command | Row | Numbers |
| --- | --- | --- |
| `python3 tools/terrain-from-key/run.py --zone c --score` | path IoU, UV p95, CIEDE2000, LOD, draws | IoU 0.7704; UV p95 0.214 at +8, +30, +60 m and lat 2.0; CIEDE2000 mean 8.68; LOD 0.9248 / 0.9591 / 0.9527 / 0.9525; 1 draw |
| `node tools/object-gate/cli.mjs --scene tools/object-gate/specs/zone-c/scene.yaml --url http://127.0.0.1:8771/?along=0 --out steps/zone-c/03-terrain/object-gate` | visible px/m, repetition, native size, anisotropy, mesh UV | 237.1 px/m vs 118.5; repetition peaks 0.1147 / 0.0758 / 0.0642; plates 1408; aniso 16; mesh UV max 1.005; verdict PASS |

## Gotchas

The far lip copy in `path.npy` drops path IoU from 0.7704 to 0.7106 if it is rasterized with the deck. `deck_mask` drops that run. Two-axis foreshortening at this pitch is about 3.4, so it cannot be the 1.3 stretch row. The station number is the near-key px/m divided by the px/m of the material in use. The 8 m sharpness camera must stand at eye height on the plates. Back along the pitched view ray the eye is under the mesh, and a pose on the key band (about 20 px/m) fails 118.

## Reuse

Copy the plate bake (`apply_plates`, tile 6.5 m, seed 1011, cutoff from the +8 m camera's first path sample minus the seam). Swap only the four top-down plates and the key. Do not rebuild `height.bin`. Do not type a clear colour. The tool writes the mask median.

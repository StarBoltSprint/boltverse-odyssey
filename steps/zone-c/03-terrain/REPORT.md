# Zone C terrain

Verdict: OPEN

Blocking rows cleared. UV stretch on the continuation is still above 1.3, and object-gate did not pass. This step is not a PASS.

Cost: 0 Imagine images. Depth is MoGe-2. Depth Anything V2 Large is a comparison number only (spearman 0.9979, n=29554, cache hit, 0.008 s). It is not in the height field or the renders.

## Before / after

| | Attempt 1, gain 1.0 | Attempt 2, kept |
| --- | --- | --- |
| Path IoU | 0.5044 | 0.7704 |
| Max slope | 15.5° | 15.5° |
| Relief | 0.909 m | 0.319 m |
| LOD pop at the key | 0.8302 | 0.9248 |
| Cliffs off the support | 0 | 0 |

Gain 1.0 missed the path silhouette because grazing MoGe lip pixels are not deck relief. The tool stops at these two gains.

## Blocking rows (kept field)

| Check | Number | Need |
| --- | --- | --- |
| Path IoU, key camera, deck mask | 0.7704 | ≥ 0.75 |
| Max slope | 15.5° | ≤ 16° |
| Min width | 2.0 m | ≥ 0.8 m |
| Relief | 0.319 m | ≤ 3 m |
| Height off the support | 0 | flat |
| LOD pop, key / +8 / +30 / +60 m | 0.9248 / 0.9591 / 0.9527 / 0.9525 | ≥ 0.90 |
| Draw calls | 1 | < 80 |

Headless Chrome after `Chargement` left the page, 16:9 and 720×1600, at 0, 8, 30 and 60 m. Each loading frame failed the capture gate. Each terrain frame passed. Triangle counts on the page: 45696 near (0 and 8 m), 14720 at 30 m, 5900 at 60 m. One draw call.

Sheets: `sheet-16x9.png`, `sheet-phone.png` (key beside the along-0 frame).

## Open

UV stretch p95 by band: 0–8 m 1.252 (n=6), 8–30 m 16.707, 30–60 m 74.136, 60+ m 93.095. All fail. The far ribbon reuses the lip row until the moss plates exist. Object-gate's mesh UV derivative (max 1.004) is the baked atlas, not this reuse. It does not close the row.

Object-gate (`steps/zone-c/03-terrain/object-gate/report.md`): FAIL. Anisotropy 8 is under the gate's max of 16. The baked albedo is 113×205 against the 1792×1008 key. Visible px/m and the repetition captures fail because the continuation is stretched and the close views do not fill a face. Runtime console, shaders, and the portrait pages passed. Draw calls in that report: 1, triangles 45696.

## Time

| Stage | Seconds |
| --- | --- |
| MoGe-2 | 14.10 |
| Attempt 1 | 1.37 |
| Attempt 2 | 1.26 |
| DA V2 compare (cache hit) | 0.03 |
| Total build | 16.77 |

World graph: `zone-c.zone.json`, validated as zone.v1. Sun, fog, halo, and the cliff solids are in `todo`.

Preview freeze was not run. `tools/preview/freeze.py` refuses a verdict that is not PASS.

## Run

```bash
/workspace/.venv-sam2/bin/python tools/terrain-from-key/run.py --zone c
python3 tools/terrain-from-key/serve.py --zone c --port 8771
```

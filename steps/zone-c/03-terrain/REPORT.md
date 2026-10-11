# Zone C terrain

Verdict: PASS

Date: 2026-10-11

The height field from the previous attempt is unchanged (`height.bin` sha256 prefix `4f61b63bae4f`). This step lays the four committed moss plates on it. Attempt 1 of 2. No new Imagine images.

Cost: 4 Imagine images, already committed. This run did not call Imagine. Depth was not rebuilt. Depth Anything V2 Large stays a comparison number only (spearman 0.9979). It is not in the height field.

## Plates

Near path keeps the key projection out to the last row the +8 m camera does not see. Cutoff 20.21 px/m (the short-axis density of that row). Reference near density 46.34 px/m. The core is s 4.5–11.5 m. A 0.55 m gaussian is the seam, and the core stays at full weight so the blur cannot erase it.

Beyond that, and on the shoulders, the four 1408×1408 plates tile in world space at 6.5 m. Graph colour is a 2×2 of the four plates (seed 1011 for rotation and flip). Orthogonal neighbours are 6.5 m apart, under 7 m, and do not share a plate. One mesh. Mipmaps are linear, anisotropy is the device max (16 in the headless gate). Macro tint is the low-frequency colour of key path pixels. The clear colour is the median of the causeway mask, `#2b3021`.

## Before / after

| Check | Base (height field) | Plates, attempt 1 |
| --- | --- | --- |
| Path IoU | 0.7704 | 0.7704 |
| Max slope | 15.5° | 15.5° |
| Min width | 2.0 m | 2.0 m |
| Relief | 0.319 m | 0.319 m |
| Height off the support | 0 | 0 |
| LOD pop, key / +8 / +30 / +60 m | 0.9248 / 0.9591 / 0.9527 / 0.9525 | same |
| Draw calls | 1 (need was < 80) | 1 (need ≤ 12) |
| UV stretch p95 | 1.252 / 16.707 / 74.136 / 93.095 by band | 0.214 at +8, +30, +60 m and the lane change |
| Colour, CIEDE2000, key camera | not measured | mean 8.68, median 6.38 |
| Object gate | FAIL | PASS |
| Triangles near / mid / far | 45696 / 14720 / 5900 | 45696 / 14720 / 5900 |

UV stretch is reference px/m divided by the px/m of the material in use (the key where its weight is above 0.5, otherwise 1408/6.5). The two-axis foreshortening of this pitch is about 3.4 and is not the row. The station cameras sit on plates, so their ratio is 46.34 / 216.6 = 0.214.

## Blocking rows

| Check | Number | Need |
| --- | --- | --- |
| UV stretch p95, +8 / +30 / +60 m / lane +8 m at lat 2.0 | 0.214 / 0.214 / 0.214 / 0.214 | ≤ 1.3 |
| Visible px/m at 8 m | 237.1 (need 118.5, at the capture limit) | object-gate |
| Repetition | ortho peak 0.1147, close 0.0758, low-portrait 0.0642, plate period 0.0149 | ≤ 0.65 and ≤ 0.5 at the tile period |
| Path IoU, deck only | 0.7704 | ≥ 0.75 |
| Draw calls | 1 | ≤ 12 |
| LOD pop | 0.9248 / 0.9591 / 0.9527 / 0.9525 | ≥ 0.90, unchanged |
| Colour deltaE, CIEDE2000, 16:9 key camera | 8.68 | < 10 |

Headless Chrome, SwiftShader, after `Chargement` left the page. Loading frames failed the capture gate. Terrain frames passed. Sizes 1280×720 and 720×1600, at 0, 8, 30, 60 m, and a lane change (`along=8`, `lat=2`). Triangle counts from those pages: 45696 at 0 and 8 m, 14720 at 30 m, 5900 at 60 m.

Object-gate (`steps/zone-c/03-terrain/object-gate/report.md`): PASS. Plates stayed 1408×1408. Anisotropy 16. Mesh UV stretch max 1.005. The 8 m sharpness camera stands on the plate field (the key band is about 20 px/m and cannot meet 118). Runtime console and shaders passed. `__perfReport` is absent; that row is INFO.

Sheets: `sheet-16x9.png`, `sheet-phone.png` (key beside the along-0 frame).

## Height field (previous attempt, kept)

| | Attempt 1, gain 1.0 | Attempt 2, kept |
| --- | --- | --- |
| Path IoU | 0.5044 | 0.7704 |
| Max slope | 15.5° | 15.5° |
| Relief | 0.909 m | 0.319 m |
| LOD pop at the key | 0.8302 | 0.9248 |
| Cliffs off the support | 0 | 0 |

Gain 1.0 missed the path silhouette because grazing MoGe lip pixels are not deck relief. That field was not rebuilt.

## Time

| Stage | Seconds |
| --- | --- |
| Plate density, tint, seam | 0.035 |
| Tile colour | 0.008 |
| Stretch and predicted colour | 0.028 |
| Plate bake total | 0.60 |
| MoGe-2 (previous attempt, not rerun) | 14.10 |

World graph: `zone-c.zone.json`, zone.v1, the four plates listed as terrain inputs. `uvStretchOpen` is false. `pass` is true.

## Run

```bash
python3 tools/terrain-from-key/run.py --zone c --attempt 1
python3 tools/terrain-from-key/serve.py --zone c --port 8771
python3 tools/terrain-from-key/run.py --zone c --score
```

`--zone c` lays the plates. It does not call MoGe and it does not write `height.bin`.

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

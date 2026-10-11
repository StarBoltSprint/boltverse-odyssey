# other — Zone B skyline heightfield

Status: terrain gates passed on attempt 1. No Imagine prompt was sent. The play frames do not match key-city3 as a picture.

| Field | Value |
| --- | --- |
| Asset kind | other |
| Take | terrain-key2-1011 |
| Commit | `45e55fe7` |
| Date | 2026-10-11 |
| Size | height grid 240×240, step 2 m. Key 1280×720. Sheets 1920×388 and 1920×448. |
| Tries | 1 reconstruction. SAM2 outline was scored inside that attempt and not shipped. |
| CLI | none |
| Image refs | `/workspace/zb-bible-1008/key-city3.jpg`. Camera prior `/workspace/zb-bible-1008/compare/run2/camera-key.json`. |

## Prompt

not stored

```
not stored
```

## QC rows passed

| Command | Row | Numbers |
| --- | --- | --- |
| `python3 tools/terrain-from-key/run.py` | silhouetteIoU | 0.8481 (need 0.80) |
| same | depthOrder | true |
| same | features | dune_left 0.91 m, mound_right 1.40 m, avenue −0.49 m, slabs −0.52 m |
| same | lodPopIoU | 0.9729 (need 0.90) |
| same | approachIoU | 0.971 (need 0.85) |
| same | repetition | 0.1499 (need < 0.75) |
| same | corridor | max slope 6.269°, median sink 1.986 m |
| same | vertexCost | 38997 verts, 69632 tris |
| `steps/terrain-key2-1011/gates-sam2.json` | silhouetteIoU | 0.5486, not shipped |
| `node tools/terrain-from-key/capture_play.mjs` | loading then terrain | live and staging, 1280×720 and 720×1280: early frame FAIL (Chargement), later frame PASS |
| `/workspace/.venv-sam2/bin/python tools/relief/bake_depth.py` on a 160×90 swatch | default model | wrote `/tmp/terrain-key2-moge.png` (90, 160). `DEFAULT_DEPTH` is `moge-2`. |

## Gotchas

A hard shoulder inside the centreline's bilinear kernel reads as about 30° of along-track slope. The passing shoulder is a smooth rise from 0.8 m to 3.5 m, with a flat trench only inside 0.8 m. World crests sit at setback 36 m. The key camera still cannot show a 15–30 m face under a 2.3 m eye. SAM2's sand mask is holey. A flat colour swatch makes the MoGe high-pass scale enormous; that number is not a plate.

## Reuse

Copy the colour skyline composer and the MoGe-2 default. Swap the key image and the camera prior. Do not write a Depth Anything V2 Large map into the step folder.

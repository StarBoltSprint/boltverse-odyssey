# other — grok-native proposal pick

Status: validated for choosing the tower cluster. Not a single-slab mask.

| Field | Value |
| --- | --- |
| Asset kind | other |
| Take | grok-native-1011 |
| Commit | `e7116fe1` |
| Date | 2026-10-11 |
| Size | key 1280×720 |
| Tries | 1 free-form box (miss), 1 numbered pick (cluster hit) |
| CLI | no Imagine call |
| Image refs | existing plates in `/workspace/grok-native-1011/imagine/`. No new images. |

## Prompt

Stored in `tools/grok-native/vision_api.py` `pick_hero`. The model returns `hero_id` only.

```
Numbered boxes are candidate towers on one desert city plate. Pick the broad dark slab just left of the road centre: slanted cap, vertical seams, broken mid ledges, base in the dune. Do not pick the thinner tower against the left cliff. Do not pick the ringed spire right of centre.
```

## QC rows passed

| Command | Row | Numbers |
| --- | --- | --- |
| `python3 tools/grok-native/selftest.py` | slab watertight, frankot, photometric, ecc, proposals | PASS, ecc ncc 1.000, photometric angle 0.000° |
| `steps/grok-native-1011/work/pick.json` | vision id on classic boxes | hero_id 2, fusion bbox IoU 0.4169 |

The GrabCut that followed is not a pass. IoU vs SAM2 0.749. IoU vs the fusion slab 0.4983. See `learn/failures.md` 2026-10-11.

## Gotchas

`cv2.findTransformECC` returns the map that `warpAffine` applies only with `WARP_INVERSE_MAP`. A free-form box on this plate landed on the left cliff. Erosion does not split three blades that touch.

## Reuse

Copy `structure_proposals` and `pick_hero` when the plate has several towers. Swap the hero sentence for the object. Do not copy the GrabCut output as a single-object mask.

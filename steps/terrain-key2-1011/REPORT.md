# Terrain key 2 — Zone B

Attempt: 1 of 2
Verdict: PASS

The shipped heightfield is the colour-mask skyline bake. Gates passed on that field. SAM2 was run and did not replace it.

## What changed

Side dunes are not unprojected from depth. From this camera the sand in the key only reaches about 8 m, and a downward ray never crosses a crest above the eye. Crest height and the along-track wavelength come from the ground-mask skyline plus the known scales: side bodies 15–30 m, wavelength 96 m, wind 60°. Depth Anything V2 Large is used only as a near-slab offset of at most 0.8 m, and only on the SAM2 trial.

The walkable shoulder is a smooth rise from 0.8 m to 3.5 m off the centreline, topping out just under the eye (1.85 m). A hard step at that distance aliases through bilinear samples (heading 78° on a world grid) and the centreline slope reads about 30°. The 15–30 m bodies sit outside that shoulder (setback 36 m). World crest samples: 29.6 m left, 30.0 m right.

The inner trough the slope gate walks is about 1.6 m wide. The 8 m figure is the shoulder the key's side boxes read as banks, not a flat 8–15 m excavated lane. The key-camera foreground still cannot show a 15–30 m wall as a dune face under the eye. Those crests are in the heightfield and in the ortho. In the play frames they read as steep banks because the ground albedo is stretched up the slope.

## Times

| Stage | Seconds |
| --- | --- |
| load | 0.02 |
| colour mask | 0.03 |
| cheap field | 0.18 |
| SAM2 (cache hit) + DA V2 Large | 18.13 |
| SAM2 field | 0.16 |
| staging | 0.00 |
| total | 18.57 |

Cheap clock: silhouette IoU 0.8481 (min 0.80), colour mean-abs 0.0000 (existing tiles, compared to themselves). Heavy ran after that.

## Gates (shipped colour outline)

- silhouetteIoU: PASS — 0.8481 (need 0.80)
- depthOrder: PASS
- features: PASS — dune_left 0.91 m, mound_right 1.40 m, avenue −0.49 m, slabs −0.52 m (banks ≥ avenue + 1.2)
- lodPopIoU: PASS — 0.9729 (need 0.90)
- approachIoU: PASS — 0.971 (need 0.85)
- repetition: PASS — 0.1499 (need < 0.75)
- corridor: PASS — max slope 6.269°, median sink 1.986 m (need ≤ 16° and ≥ 1.2 m)
- vertexCost: PASS — 38997 verts, 69632 tris, same as the live lods

## SAM2 trial (not shipped)

SAM2 small, box on the lower frame, intersected with the colour ground. Intersection covered 0.216 of the frame. The mask is the sand, but it is full of holes, so the column silhouette fell to IoU 0.5486. Every other gate on that field passed, including features, slope 6.269°, and repetition. Shipping the holed outline would fail the silhouette bar, so the colour outline stays.

The passing heightfield used `disp=None`. No depth map is in `height.bin`.

A Large map was computed once as an internal comparison (cache miss, 18.08 s, 720×1280) and then dropped. It is not in this folder. Licence line 12:25: the default depth model is MoGe-2 (`vision_models.DEFAULT_DEPTH`). Relief, fuse, and `bake_depth.py` call MoGe-2. Large stays an explicit internal call and is not written into a shipped or posted file. The 3916 panorama was not rebaked. The recorded heavy stage above is that comparison; the code path now calls `depth_default` (MoGe-2) and does not save a Large png. The colour-mask field was not rebaked.

## Play renders

Live `index.html` was not edited. Staging is served beside it. Captures wait until the Chargement overlay is gone, then the capture gate checks the pixels.

| Shot | Loading frame | Terrain frame |
| --- | --- | --- |
| Live 1280×720, key pose query | FAIL gate, DOM `Chargement… 16/20` | PASS, no overlay |
| Staging 1280×720, same query | FAIL gate, DOM `Chargement… 1/20` | PASS, no overlay |
| Live 720×1280 | FAIL gate, DOM `Chargement… 13/20` | PASS |
| Staging 720×1280 | FAIL gate, DOM `Chargement… 16/20` | PASS |

The pose query is `x=-51.115&z=9.63&yaw=78&pitch=-5.995&eye=2.3`. The rig still owns field of view, so this is not a 64° match to the key. Before is the live dune field with the towers. After is the keyed grid: sunken slabs, banks on both sides. The banks hide the towers from this seat. Sheets: `sheet-16x9.png`, `sheet-phone.png`.

## Camera

```json
{
  "x": -51.115,
  "z": 9.63,
  "yaw": 78.0,
  "eye": 2.3,
  "fov": 64.0,
  "pitch": -5.995
}
```

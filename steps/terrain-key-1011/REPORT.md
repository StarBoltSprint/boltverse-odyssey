# Terrain key — Zone B

Verdict: FAIL

Stopped after 2 reconstructions. No Imagine images. Live `index.html` was not edited. Staging is `tools/terrain-from-key/staging/` on `http://127.0.0.1:8767/`.

## Attempts

| Attempt | What changed | Result |
| --- | --- | --- |
| 1 | Plane fit. Disparity residual against y=0 was ~0, so gain did nothing. Crest rays with dy ≥ 0 were dropped. | FAIL. Silhouette 0.8539. Banks not above the avenue. LOD pop 0.8898. Repetition 0.7553. |
| 2 | Ray placement from Depth Anything V2 small. Avenue columns sunk in image space. Extension wavelengths kept inside 55–120 m. Crest gate uses the median of the crest line. | FAIL. Numbers below. |

q29 was read. DA V2 Large, MoGe-2, and SAM2 checkpoints are not on disk, so the small ONNX stayed. Clipmaps were not added: the vertex gate is the live lod table (38997 verts, 69632 tris) and a new topology would spend a third reconstruction. Wind for the extension stays 60°, the bible wind.

## Times

| Stage | Seconds |
| --- | --- |
| Attempt 1 depth + search + two full bakes | 5.86 |
| Attempt 2 prep (mask + depth) | 1.32 |
| Attempt 2 compose + gates | 0.47 |
| Staging page rewrite | under 1 |

## Gates (attempt 2, final bake)

- silhouetteIoU: PASS — 0.8373 (need 0.80)
- depthOrder: PASS
- features: FAIL — dune_left −2.07 m, mound_right −1.76 m, avenue −3.22 m, slabs −3.31 m. Left crest is 1.15 m above the avenue; the bar is 1.2 m. Both crests are still a low face, not a 15–40 m dune.
- lodPopIoU: PASS — 0.9797 (need 0.90)
- approachIoU: PASS — 0.957 (need 0.85)
- repetition: FAIL — 0.7576 (need < 0.75)
- corridor: FAIL — max slope 17.145° (need ≤ 16), median sink 1.872 m, min sink −1.388 m
- vertexCost: PASS — 38997 verts, 69632 tris, same as live

## Why the key still looks flat

A low eye (2.3 m, pitch −6.0°, fov 64, horizon row 0.416) sends the sand pixels onto the ground within about 8 m of the lane. Image-left and image-centre occupy the same cells. A downward ray cannot reach a crest above the eye, and almost all sand in the mask is below the horizon. Scaling those faces tops out near 2 m. The silhouette still passes because both masks fill below a shared horizon.

## Camera

x −51.115, z 9.63, yaw 78, pitch −5.995, eye 2.3, fov 64. Towers are not moved. `mountObjects` receives the keyed field, so `place()` reseats baseY when the page finishes loading. That load did not finish in headless Chrome (stuck at Chargement 17/20), so the air gap was not measured on a frame.

## Sheet

`steps/terrain-key-1011/before-16x9.png`, `after-16x9.png`, `before-phone.png`, `after-phone.png` are headless frames of the loading screen, not the terrain. `height-ortho.png` is the baked shape. `key-city3.jpg` is the key. The page to open is `http://127.0.0.1:8767/?x=-51.115&z=9.63&yaw=78&pitch=-5.995&eye=2.3`.

## Pixels

Existing ground tiles g0–g7 plus the macro splat. Height biases troughs, crests, and steep faces. No new colours. No new tile request.

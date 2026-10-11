# Fusion fix 4 — FAIL (stopped after 2 attempts)

Spec: SPEC-I23D-FUSION-FIX3-1011. No Imagine generation. Live preview untouched (gate row: 108 live files unchanged). Relief and fuse load Depth Anything V2 Large through `tools/common/vision_models.py`.

Verdict: FAIL. Attempt 1 missed the cheap overlay and built no mesh. Attempt 2 cleared that overlay, sealed the mesh, and missed alignment on hero, 30 m, and 8 m, plus relief on every axis. The key checklist stays fail. No third mesh.

## Times

| Stage | Seconds |
| --- | --- |
| Rectify | 0.149 |
| SAM2 (cache hit, 9 boxes) | 0.052 |
| Depth Anything V2 Large (cache) | 0.261 |
| Silhouette IoU | 0.004 |
| 2D overlay | 0.025 |
| Prepare total | 0.71 |
| Blender build | 3.8 |
| Object gate (gate5, `--fast`) | 344 |
| Zone B load wait (play page) | early 0.66, ready 31.8 |

Cheap 2D gate before Blender: attempt 1 overlay 0.7395 (precision relief 0.8147, precision texture 0.7395). Silhouette IoU vs the key crop 0.994. Bar 0.70. Build ran. Model `dav2-large`.

## Attempt 1

SAM2 masks were not clipped to the vision boxes. Cheap overlay 0.5436. `fusion.build` skipped. No mesh.

## Attempt 2 (this mesh)

One prism of the key silhouette. No 2 m height bands and no back ledges. Chrome stays on the painted columns 110, 116, 123, 131. The ladder skeleton is 212 px from a 424 px mask (rail px 90, rung px 20) and became 1 part.

Depth Anything medians, then chrome and ladder mapped in that order onto 0.32–0.55 m. Glass, damage, and the panel stay at 0 cm. Ladder 55.0 cm, chrome 32.0–41.5 cm.

Mesh sealed: open 0, non-manifold 0, 112 tris. Size about 50.42 × 209.81 × 28.59 m. Proportions pass. Grounding pass.

Facade relief (object-gate median of per-metre spans): +x 0, −x 0, +z 0, −z 0. Crispness is one plane on each axis. The 0.32–0.55 m ridges do not move that median on a 112-triangle shell.

Alignment: hero 0.5282, 30 m 0.5282, 8 m 0.5331, side 0.8118. Three views are under 0.70. UV ortho overlap 0.6146. The post-build facade shade reported 0 relief edges because it ignores a step against the unlabelled wall.

## Loading screen (real Zone B play page)

Staging `http://127.0.0.1:8996/tower3-1010/index-tower3.html?visionKey=1`. Phone 720×1600.

- `load-early.png` at 0.66 s: capture gate fail, loading screen, empty frame. The pixels say Chargement….
- `load-ready.png` at 31.8 s: capture gate pass, loading false, cover 0.957.
- Gate5 row `capture ready 540x1200`: pass, cover 0.9387.

The ready frame is the zone, not the loading plate. The hero blade in that frame is a dark slab. Chrome, rails, and the bite are not readable there.

## Checklist

Not marked pass. `records/tower-hero-vision.verified.yaml` stays fail for wedge, ladder, chrome, damage, and sand. Gate5 captures are near-black (close cover 3.2%, low-portrait 3.0%, far 24.6%, ortho-front 44.2% and black, ortho-side 31.2% and black). Colour deltaE 36.59, object L* 0.1.

The software contact sheet (`tower-checklist-sheet.png`) frames the tan prism (close 35%, low-portrait 47%, far 28%, ortho-front 67%, ortho-side 81%). That raster is not the play shader. It shows a wedge and a bite. It does not show rails, rungs, chrome strips, or the key's glass.

## Sheets next to key-city3

- 16:9 `steps/fusion-fix3-1011/sheet-16x9.jpg` — tan ortho blade beside the key crop. The crop has glass, a torn mid band, and cables. The mesh is a flat gold wedge.
- Phone `steps/fusion-fix3-1011/sheet-phone.jpg` — close framing of the same wedge beside the same crop.
- Gate sheet: `/workspace/i23d-auto/zoneb-tower-vision/gate5/tower-hero/capture-sheet.jpg` — key crop on the left, play captures black.

## Deliverables

- Mesh: `/workspace/i23d-auto/zoneb-tower-vision/vision/tower.glb` (copied onto staging `objects1/vision/`, not the live tree)
- Gate: `/workspace/i23d-auto/zoneb-tower-vision/gate5/report.md`
- Load proof: `steps/fusion-fix3-1011/load-early.png`, `load-ready.png`

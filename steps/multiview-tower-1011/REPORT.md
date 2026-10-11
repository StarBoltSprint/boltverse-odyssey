# Multiview tower — 2026-10-11

Verdict: FAIL. Bars were not loosened. Placement was left untouched. No `dataset/i23d` export.

The solid is one watertight mesh (9672 tris, 0 open edges, 0 non-manifold). It is installed at `kc-staging/zb-tower3/objects1/vision/tower.glb` (sha256 `5f4c25dab480e0c509468a2ddd0283bab03fea8bfa2d62bceae822da5413e05f`, same bytes as `steps/multiview-tower-1011/work/tower.glb`). Two gate rounds ran. The second is the kept measure. A third round would not move depth/width (the plates already sit at 0.761), would not invent a ladder, and would not scale relief. Stop.

## What the plates show

Sheet `sheet-turnaround.jpg` (1792×1008). Grey gutters (mean > 165, std < 14, width ≥ 40) at columns 421–577, 816–951, 1254–1418. Four panels, left to right:

| Panel | Pixels | h/w | What the pixels show |
| --- | --- | --- | --- |
| 1 front | 303×939 | 3.099 | Broad glass, concrete pier on the viewer's right, sheared crown, two damage bands. Check only. Front colour is the key projection. |
| 2 left | 238×940 | 3.950 | Profile. Concrete pier and vertical cables. Glass sliver on the viewer's left. |
| 3 back | 302×937 | 3.103 | A second elevation. Pier on the viewer's left. Damage pattern is its own. |
| 4 right | 223×933 | 4.184 | Profile. Pier on the viewer's left, glass on the viewer's right, cables. |

The sheet paints cables. It does not paint the ladder cage. The ladder checklist item stays FAIL.

`view-top.jpg` (1152×1728) is one tall elevation, bbox h/w 2.895. `shows_roof_plan` is false. The +y roof texture is left out. The crown silhouette comes from the key chord.

`view-under.jpg` (1152×1728) is one band. The classifier marks soffit content. It is not a base plan, and no ledge shelf was cut, so those pixels are not projected.

Old desert cuts `_src-view-{left,back,right}.jpg` (720×1280) NCC against the sheet panels: 0.361, 0.210, 0.297. Reused: false.

Mask method: grey-distance silhouette (border median, distance > 16). SAM2 hiera-tiny kept feature regions on left (4) and right (5). Front and back kept 2 regions, under the keep of 4, so those two use the watershed segmenter. `rembg` is not installed. Zero new Imagine images.

## Before (scene-strict) and after

Camera logged from `tools/common/align/camera.py`: FOV 88°, pitch −7.674° (three.js), eye 1.77 m, roll 0.17°, heading 248.531°. Stored yaw was not copied. The front raster is the stored facade homography under that lens (`front_sample` in `work/multiview.json`). One source pixel is not enlarged. Front sampling is about 2.41 px/m.

| View | Scene-strict strict | This step, vision recorded no (cap 0.69) | Structure score before that cap |
| --- | --- | --- | --- |
| key (play `ready-540x1200`) | 0.0421 | 0.69 | 0.8917 |
| hero | 0.3073 | 0.69 | 0.9165 |
| 30 m | 0.0 | 0.69 | 0.9165 |
| 8 m | 0.0 | 0.69 | 0.8794 |
| side | 0.2501 | 0.6667 | 0.6667 |

Vision API was not called. Cost $0. The play frame and the lit ortho are near black (gate colour L\*a\*b\* 0.1, 0.5, −0.1 versus key 34.9, 11.4, 0.6, deltaE 36.5). `albedo-hero` is a grazing view of the concrete pier; glass and the damage bands are in that capture. A vision "yes" on the black frames would be false. `strict_ok` needs the vision yes and a score ≥ 0.70. Every view fails that bar. Stripe energy on these five is 1.0. Edge alignment versus the key crop is 0.1207 / 0.073 / 0.073 / 0.0181 / 0.0258. The cheap front-panel IoU of 1.0 is the chord filled from the panel mask. The independent front check is `strict_geometry` of the key projection versus the key crop: 0.7618.

| | Scene-strict | This step |
| --- | --- | --- |
| h/w | 1.91 | 3.699 (plate 3.800). Inside 3–5. |
| d/w | 0.25 | plate foot 0.761, mesh bbox 0.792. Gate prints 0.79. Bar is 0.45–0.70. FAIL. Depth was not shrunk. |
| relief +x / −x / +z / −z | 0 / 0 / 0 / 0.591 | gate 0.517 / 0.443 / 0.163 / 0.32 |
| +y | (unpainted) | unpainted. view-top is not a roof. |
| float | 44.834 m at 458.5, −507.5 | 2.45 m at 87.8, −98.7 |
| UV stretch | −z 7.846, +z 7.846, −y 99, −x 99 | −y 20.99, −z 1.391, +x 2.785, −x 4.372 |
| gate5 | 12 / 21, exit 1 | round 1: 10 / 21. Round 2: 11 / 21, exit 1 |
| hero tris / draws | 264684 / 1, tex 9.38 MB, that row passed | 9672 tris, 1 material. Atlas 872×940. Albedo+normal decoded 6.56 MB. |

Relief source is MoGe-2 on each painted face (metric metres, larger = farther, then outward). Image levels were merged to 8 measured planes. Per-face median span of those levels: front 0.216 m (p99 0.350), left 0.890 m, back 0.781 m, right 1.556 m. The gate's +z span is 0.163 m, under the 0.3 m feature target. The gate row still prints PASS because `minReliefFaces` is 2. That PASS is not the spec target. Relief was not scaled up. Crispness axis scores pass 0.72 and the plane counts fail the 2–8 band: +x 14, −x 11, +z 15, −z 7.

The 44.834 m pit is not the column this gate measured. The key polygon closes on one vertex at the foot, so a centre probe reads air above that tip. Round 2 forces rings with t < 0.012 onto the chord at t = 0.012. Float moved from 2.53 m (94, −104.9) to 2.45 m. Bar is < 0.5 m. FAIL. The mesh was not dropped 44 m. Layout JSON and live `main.mjs` were not edited. The existing plinth wrap in `tower-fusion.mjs` is unchanged.

Seam ΔE, Reinhard of the overlap strip onto the key front: left 108.256 → 0.694, right 76.493 → 0.842, back 36.504 → 0.929 (back matched to the graded right). Feather 12 px. The play frame is still deltaE 36.5 from the key because that camera does not face the facade and the lit ortho is black. Moving the tower would be placement.

## Gate5 fail list (round 2, the kept report)

URL `http://127.0.0.1:8996/tower3-1010/index-fusion.html?visionKey=1`. Full text: `steps/multiview-tower-1011/gate/report.md`.

- UV stretch ≤ 1.3 — −y 20.99, −z 1.391, +x 2.785, −x 4.372
- scene self-report vs measured — claims 2.41 px/m; measured visible sampling 1.7 px/m
- repetition — face z 0.7396, face x 0.6085, close 0.5126; low-portrait covers 1.7%
- visible px/m — 0.0 versus 154.6 (8 m capture black / unlit). Plate sampling worst +z 2.4 px/m
- shadow cast — 0 ground pixels
- grounding — 2.45 m at 87.8, −98.7
- facade crispness — planes 14 / 11 / 15 / 7
- proportions — dOverW 0.79 outside 0.45–0.70
- relief-texture alignment — hero 0.1341, 30 m 0.1341, 8 m 0.6663, side 0.1398
- checklist cameras — close 2.7%, low-portrait 1.7%, far empty, ortho-front 38.1% and black, ortho-side 26.2% and black
- key checklist — wedge, ladder, chrome, damage, sand all recorded FAIL

Passed on this mesh: sealed (open 0, non-manifold 0, 9672 tris), approach morph min IoU 0.91, plates not downscaled (872×940), one hero material, runtime console / shader / portrait. The relief row printed PASS with +z at 0.163 m (see above). Staging-page budgets are 19 draws and 245129 tris. That page is the whole preview. The hero draw is one.

## Phone sheet and turnaround

`sheet-phone.jpg` places `gate/ready-540x1200.png` beside `key-crop.jpg`. The play camera shows a dark blade on the left of the avenue. The facade is not framed. That framing was not moved.

`turnaround.jpg` is the Blender ortho contact sheet: front, left, back, right, each above its sheet panel. Those renders were made with one shader flip of glTF v so the atlas reads upright (shear crown, pier on the viewer's right on the front). `vision_mesh.py` now stores the complement, so the installed glb (the hash above) samples the same packing under three.js `flipY: false`. The contact sheet was not re-rendered after that complement. Bbox is unchanged: 46.994 × 173.821 × 37.204 m.

## Rounds, seconds, cost

- Builder, last run: 35.305 s, Blender rc 0. MoGe cache: front hit, left 11.57 s, back 2.58 s, right 2.55 s (from the builder log in the previous session; the npy files are in `work/`).
- Gate round 1: FAIL 10 / 21. UV +y 134.601, float 2.53 m. Report overwritten by round 2.
- Gate round 2: FAIL 11 / 21. Extra fail is visible px/m at 0.0 on the black 8 m capture.
- Grok vision cost: $0. No cache write.
- `fusion.depth_inside` now calls MoGe-2 through `moge_depth.py`. DA V2 Large is only the optional `--dav2` comparison. The multiview builder did not request that comparison file.
- Phone preview freeze copies a play tree only when the report verdict line is the pass word. This report's verdict line is the fail word, so the freeze command exits 1 and writes nothing under `previews/`.

Hero-alone triangle count and one material are inside a phone mesh budget. The blocking phone row (visible px/m) failed. The step does not pass.

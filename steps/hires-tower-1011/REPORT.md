# Hires tower — 11 Oct

Verdict: FAIL

The solid is watertight, the play frame is no longer black, and the worst float is 0.00 m. Gate5 is 9 FAIL / 21. No view reaches strict 0.70 with a vision yes. Nothing was written under `dataset/i23d`. Bars were not loosened.

Placement was not moved. `meta.cameraSpace` is ignored when `right` / `up` / `toward` / `origin` exist. The staged basis stays.

## Plates, before any mesh

| File | What it shows | Ladder | Used |
| --- | --- | --- | --- |
| `face-front-1024.jpg` 720×1280 | Broad glass, concrete pier on the viewer's right, sheared crown, two damage bands, thin base, full height, light-grey isolation. NCC vs the sheet front 0.806. | no | yes, native crop, 6.932 px/m |
| `face-back-1024.jpg` 1008×1792 | A second broad elevation. Pier on the viewer's right, same family as the front. NCC vs the sheet front 0.801. | no | no. The old sheet panel stays on −z |
| `face-right-1024.jpg` 1008×1792 | Narrow stone side, hanging cables, a glass sliver, damage near the crown and mid-height. | no (cables, not rails or hoops) | yes, 10.033 px/m |
| `face-left-1024.jpg` 1008×1792 | The right plate mirrored. Crop NCC vs the flipped right crop is 1.0. Recorded as mirrored right. | no | yes, 10.033 px/m |
| `face-left-REJECTED.jpg` | not opened | | |

Ladder: **ladder not painted**. The checklist item stays FAIL. No ladder geometry was added.

The front file cannot reach 9.6 px/m (4× the multiview 2.4) without an upscale. It was not upscaled. Sides are at 10.033. The back face is the old panel at 5.391.

## Colour root cause

The near-black lit captures were not a missing texture. The albedo shade of the old mesh was already bright. Two bugs stacked:

1. The staging material was `MeshStandard`. The sun (azimuth 90°, elevation 8°) misses the front (front·sun about −0.84), so direct light on a pre-lit Imagine albedo is 0 and the ortho goes maroon.
2. `readRT` left the render target in `NoColorSpace`. Linear bytes were scored as sRGB, which is how gate Lab landed at 0.1, 0.5, −0.1.

Fix, in the tools: lit material is `MeshBasicMaterial({ map: albedo, toneMapped: false })`. `readRT` sets `SRGBColorSpace`. Round-3 play Lab is 42.1, 1.3, 0.5 versus the key 34.9, 11.4, 0.6 (deltaE 12.45, report-only). `flipY` stays false. The normal map is flat; the relief is in the mesh.

Ortho Lab ΔE versus the matching plate (CIE76 of mean Lab, bar < 10):

| Capture | ΔE | Result |
| --- | --- | --- |
| face +z vs front plate | 7.73 | under 10 |
| ortho-front vs front plate | 9.81 | under 10 |
| face +x vs right plate | 40.59 | FAIL. Capture L\* 81.9, plate L\* 41.7 |
| ortho-side vs right plate | 43.15 | FAIL |

The side miss is the Reinhard match onto the key front. The overlap strip lands (right 99.736 → 0.577, left 98.392 → 0.593, back 117.161 → 0.899) and the stone body is lifted off its own plate. That conflict was not given another round.

The phone 8 m capture (`cap-visible-8m.png`) has mean L\* 48.92, so it is not black. It is a soft beige wall: 20 tiles flat, visible px/m 0 versus 154.6. The plates cannot supply 154 px/m on a 174 m tower without an upscale. The albedo shade named `albedo-8m.png` is a different camera and is black (L\* 0.48). Vision was not called on that frame.

## Before vs after

Before is `steps/multiview-tower-1011/numbers.json`. After is this mesh, sha256 `5a4993fc2878450bdf49cbdd76b59783c540409d407993cd3fd24ed07d0f5166`, 9796 tris, 0 open, 0 non-manifold.

| View | Before strict (vision no) | After raw | After with vision | Vision |
| --- | --- | --- | --- | --- |
| key (play `ready-540x1200`) | 0.69 | 0.8916 | 0.69 | no, $0.002412 |
| hero | 0.69 | 0.0 (stripe 0) | 0.0 | no, $0.002308 |
| 30 m | 0.69 | 0.0 | 0.0 | same png as hero, not a second call |
| 8 m albedo | 0.69 | 0.8992 | 0.69 | not called, frame black |
| side | 0.6667 | 0.915 | 0.69 | no, $0.002761 |

Vision total **$0.007481**. Cache is `steps/hires-tower-1011/vision-cache`. Log is `steps/hires-tower-1011/vision.ndjson`. Every view fails the 0.70 bar that also needs a vision yes. Hero and 30 m are one grazing shot of the glass grid; stripe energy is 0.

Alignment after: key 0.1024, hero/30 m 0.1663, 8 m 0.0057, side 0.1611. The cheap front-panel chord IoU of 1.0 is not this score. `front_vs_key_strict_geometry` of the front plate versus the key crop is 0.4557.

## Geometry

| | Plate | Mesh | Bar |
| --- | --- | --- | --- |
| h/w | 3.8 | 3.711 | 3–5, inside |
| d/w | foot 0.86 | 0.859 (46.837 × 173.821 × 40.211) | 0.45–0.70, FAIL |

Depth is the side-plate width over the front width at the same height. The first build sampled empty margin rows and clipped the foot to 0.15. That glb was not installed. The foot was not squashed to enter the bar.

Relief, gate metres: +x 0.393, −x 0.405, +z 0.457, −z 0.002. The gate row prints PASS (`minReliefFaces` 2). The spec fails on −z. Back span is 0 because that plate was rejected. Levels were not scaled to 0.3 m.

UV stretch p95: +z 1.388, +x 4.627, −x 6.145, −z 1.422, +y 10.148, −y 1.001. FAIL. The crown and the tapered sides use the full texture width at every height. Not resampled.

Float: round 1 was 25.56 m because the runtime applied `keycam.mw` and left the staged footprint. Round 2, on the basis, was 1.536 m at (102.6, −113.6): the second ring's relief overhung the foot, and the column hit the lip. Round 3 zeros inset for t < 0.04. Gate: **0.00 m** at (88.6, −100.2), base Y 7.74, 43 columns. The runtime still raises each footprint sample of `surfaceHeight` to the max of a 5×5 patch and seats the mesh on that floor. No terrain tile file was edited.

## Gate5 fails (9 / 21)

URL `http://127.0.0.1:8996/tower3-1010/index-fusion.html?visionKey=1`. Exit 1. Full text: `steps/hires-tower-1011/gate/report.md`.

- UV stretch
- repetition (face z peak 0.5185; close peak 0.8067)
- visible px/m 0 vs 154.6, flat
- approach morph min IoU 0.908 at 11.3 m
- shadow 0 px
- proportions d/w 0.86
- relief-texture alignment (hero 0.0483, 8 m 0.6067)
- checklist cameras (close 2.8%, low-portrait 2.2%, ortho-front 38.2%, ortho-side 26.5%)
- key checklist: wedge, ladder, chrome, damage, sand all recorded FAIL

Grounding, sealed mesh, self-report px/m (claims 5.39, measured sampling 6.0), and the printed relief and crispness rows passed. Ladder stays FAIL on purpose.

## Phone

Hero mesh: 1 draw call, 9796 tris. Atlas 2286×1744. Decoded albedo + normal **30.42 MB**, under 260 MB. The page renderInfo is 19 calls and 245253 triangles. The visible-px/m row fails, so the phone budget does not pass.

`sheet-phone.jpg` is the 540×1200 play frame beside the key crop. The hero is a pale edge on the left of the avenue. It was not moved to centre it.

`turnaround.jpg` is four orthographic renders of the installed glb (three.js, albedo shade, `flipY` false) above the four plates. Front matches its plate. Left and right show the cable side and are paler than the plates. The back render is the old sheet; the back plate underneath is another front elevation and was not painted on. Side and back frames also catch a strip of terrain at the foot.

## Rounds and time

Three builds. The first is invalid (margin rows, foot d/w 0.15) and was not installed. The second is the mesh the round-2 gate scored (float 1.54 m). The third is installed. Last builder **30.812 s**. Three gates. Stop. The remaining misses (d/w, UV, 154 px/m, −z relief, rejected back plate, ladder, side ΔE) are recorded and not cooked again.

Key composite was not applied: copying key pixels onto the finer front plate would enlarge one source pixel. The key stays the silhouette. The front plate fills the front.

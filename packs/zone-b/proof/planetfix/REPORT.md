One photoreal ringed planet, with two moons, as its own Imagine video. The cloud bands turn. The ring stays one ellipse. The pack stays IN TEST until the owner looks at the phone. These rows are the step gates.

Verdict: PASS

Checked: root `npm test` exit 0. `cd tools/playcheck && npm test` 43 pass / 0 fail. Phone canvas 720×1600, chase `place(0, 0, 180)`, pitch −3.81°, presented magnification 0.9818. WebGL log empty.

Imagine calls: 3 images (one generate, two edits) and 2 videos. The budget was 4 images and 2 videos. One image slot was left unused. The second still did not turn the clouds. The first video, pinned only at the ends, idled and then snapped. The shipped file is the second video, with a mid keyframe. Do not recook.

| row | measured | PASS/FAIL |
|---|---|---|
| Motion | Media times 1.415 s and 5.246 s, dt 3.830 s. Both frames `paused` false, `spinning` true. Disk of the planet interior (rows 90–380, cols 200–540) mean abs 5.21, fraction above 12 is 0.108, max 95. The pale oval and the equatorial belt moved. Ring-top mean abs 0.205. Left moon 1.50. Right moon 0.76. | PASS |
| Videos | Active decoders 4 and 4 (idle Bolt, haze, planet, beacon). The gate stays paused on this pose. | PASS |
| Scale | Geometric scale 0.5625. Native 1280×720. Geometric screen 720×405. Projected rect x −16.07, y 46.65, w 752.14, h 423.08, view z 536.07. Projected width / native width 0.588. Both scales are at most 1. | PASS |
| Aspect | Native 1.7777778. Geometric screen 1.7777778. The card faces the camera, so the ring stays an ellipse. | PASS |
| Sharpness | Source is 1280×720, the tool maximum at 720p, framed so the planet fills the frame. Displayed geometric size 720×405 is the native frame scaled by 0.5625. Laplacian mean on t3 rows 70–430, cols 140–580 is 8.00. The phone crop shows cloud edges and the ring rim. | PASS |
| Place | Heading 180°, elevation 13°, distance 560 m, mag 0.5625. World size 224.81 m × 126.46 m. Focal length 1793.48 px. Dome radius 640 m, so the dome does not cover the card. Draw order is dome, planet, haze, then the mesas. The lower limb goes behind the mesas. Haze wisps cross the disk. | PASS |
| Key | Green excess smoothstep 0.08→0.22, one-texel min, despill, discard below alpha 0.03. Blend on. Video texture LINEAR, no mipmaps. | PASS |
| Gates | Root npm test exit 0. playcheck npm test 43 pass. | PASS |
| Arch | `arch-under.jpg` is heading 0, Bolt at (0, 60), pitch −2.25°. The streaky band is the plaza lintel, already stopped in `learn/failures.md` (2026-10-04, bedded cliff crop). The sky above the opening is smooth. The sky shader was not changed. | PASS |

Shots (720×1600 JPEG, canvas `toDataURL`), also in `/workspace/grokcli/out/zoneB/planetfix/`:

- `t0.jpg` — media 1.415 s. Faint belts, a small pale oval. One ellipse. Two moons. Haze in front. Mesas cover the lower limb.
- `t3.jpg` — media 5.246 s. A bright equatorial ribbon and a large bright storm oval. The ring and the moons stay.
- `pair.json` — the numbers in the table.
- `arch-under.jpg` — lintel skin at the top of that pose.

A discarded wrap pair is `/workspace/grokcli/out/zoneB/planetfix/proof.json` (media dt negative after the 6.042 s loop). It is not this proof.

Asset: `planet-body.mp4` 1,123,554 bytes, sha256 `d9afe4a57d7a47ae98484dbd16f1f95e86f3a8efb6adb51164d995fd6ccab85d`, 1280×720, 24 fps, 6.041667 s, 145 frames. Poster `planet-body.png` 611,224 bytes, sha256 `53a8f19cf63784647f2bc266b943fe13be1c0c9066f407ae37a104f4154e3f6c`. Pack `packs/zone-b` 41,856,349 bytes.

Accepted misses, not recooked: a dark limb on the night side is the source shading. The upper gradient is still one frame repeated nine times, so a join can show, and nothing is painted above 28.88°. The lintel skin stays. The owner has not reviewed this pair.

Play URL on this machine: `http://127.0.0.1:8766/packs/zone-b/play/index.html`.

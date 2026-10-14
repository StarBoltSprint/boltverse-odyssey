# hull/ship — zone B Anchor volume

Status: IN TEST. The phone path and the first apron stay `learn/recipes/zone-b-phone-anchor.md`. The loft method stays `docs/METHOD/hard-objects.md`. This file records the solid that keeps the 60 m height and stays at magnification 1 on the walk.

| Field | Value |
| --- | --- |
| Asset kind | `hull/ship` |
| Take | Ember Mesa Anchor volume, 2026-10-05 |
| Commit | `0b744f9` |
| Date | 2026-10-05 |
| Size | Tower height 60 m, opening 5.90 m, depth 22 m, shaft from y 15.20. Stone crop 84×461. Metal crop 116×150. Atlas 4096×1864, unchanged. |
| Tries | 0 image calls. 0 video calls. `METAL_D` 7.0 rejected before write (walk mag 1.010). One under-shot with the camera outside the south face was discarded. One solid-crown tilt was discarded. |
| CLI | `python3 packs/zone-b/src/hard/anchor_volume.py` after checking out `mesh.bin` and `loft.json`. Do not run `build.py` with no flag. Do not run `--recarve-anchor` for this volume. |
| Image refs | none |

## Prompt

not stored

No Imagine call was sent.

## QC rows passed

| Command | Row | Numbers |
| --- | --- | --- |
| gallop z 60 to z 244.95, no `debug=1` | magMax | 0.9817991443596215, blocked 0 |
| `node packs/zone-b/src/terrain/qc.mjs` | walk_mag_le_1 | walk_mag_max 0.9979774516766561 |
| same qc | relief and slope | span 1.9479100797582198 m / 20 m; slope 11.954694099254759° |
| same qc | boot | boot_clean PASS, console_errors 0 |
| place (0, 175.2) | under | eye z 168, pitch −3.07, blocked false |
| look-at (0, 42, 177.83) | tilt | pitch 76.40 |
| `perf` under the arch | budget | drawCalls 10, texture bytes 256963736, videos 4 |
| reaches | drone and rib | drone x 14.11 blocked 159; rib z −23.19 blocked 125 |
| root `npm test` | exit | 0 |
| `cd tools/playcheck && npm test` | unit | 43 pass, 0 fail |

## Gotchas

A 60 m AABB contains the eye, so closest distance falls to 0.35 and magnification leaves 1. Split the monument. Set each part's world size to the repeating crop, not to 60 m. Keep `loft.anchor.h` at 60. `STONE_D` 2.80 and `METAL_D` 6.6 passed. `METAL_D` 7.0 printed walk mag 1.010 and did not write.

The phone half-angle is about 11.35°. A mouth wider than that shows only the hole once the camera is inside the arch. Half-gap 2.95 m puts both jambs in the frame from just inside the south face (eye z 168, face z 166.83). A stone crown is the first hit on a ray from under the arch to the shaft. Leave the center open from y 15.2 to 60. Do not add an `anchor-crown` placement.

`anchor_volume.py` refuses to run once the new tower is no longer the first mesh section. Check out `mesh.bin` and `loft.json` before a rebuild. `build.py` with no flag recopies session images and forces the Anchor outside with empty boxes. `--recarve-anchor` is the old painted mouth.

Camera easing can sit under the plaza span for a few frames at magnification 1.045. `solveCamera` snaps onto the legal pose when `poseMetrics(eyeBuf).minR` is below 1.002.

North mesa cards on the tunnel axis read as a cliff in the hole. Keep them off that axis. The ground fade is rho 300 to 460, behind the tower.

`learn/recipes/zone-b-phone-anchor.md` says presented magnification under a 60 m tower is 27 and says not to shrink it. Do not use that sentence to leave magnification 27 in place. This volume keeps the height and brings the walk under 1.

The qc heading-0 walk ends near z 132. The under shot is a `place`, not that 30 s walk. qc `q6` and `q10` are posed judge cameras.

## Reuse

Copy `packs/zone-b/src/hard/anchor_volume.py` for the next hard monument that must stay tall and stay at magnification 1. Copy the `solveCamera` snap in `packs/zone-b/play/play.js`. Copy `APRON` and the north-card offsets when the ground has to continue past a rim. Swap the atlas crops. Keep one loft draw.

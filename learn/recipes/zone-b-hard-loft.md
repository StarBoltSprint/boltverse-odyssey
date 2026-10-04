# hull — zone B hard loft

Status: IN TEST. The measured-loft method is already VALIDATED (`docs/METHOD/hard-objects.md`, 2026-10-03 21:36). This file records the zone B use. It is not a second hull law.

| Field | Value |
| --- | --- |
| Asset kind | `hull/ship` |
| Take | Zone B step 2 |
| Commit | STEP2SHA |
| Date | 2026-10-04 |
| Size | Anchor 60 m tall. Legs 3.55×1.50 m. Span segment 1.43×0.38×1.21 m. Tower 3.99×1.86 m. Pylon 3.31×1.37 m. Drone long axis 2.09 m. Cart long axis 2.16 m. Rib 3.86×2.53 m. Atlas 4096×1864. |
| Tries | Drone caps: 1 rebuild after the open shell. Lintel: 2 placements, then stop. |
| CLI | `python3 packs/zone-b/src/hard/build.py` |
| Image refs | Elevation JPEGs in `packs/zone-b/src/hard/`. Arch leg and span are crops of `src/buttes/butte-0.jpg` and `src/buttes/cliff-0.jpg`. |

## Prompt

not stored

The colour-free job for each plate is the `JOB` block in `packs/zone-b/src/hard/*.PROMPT.txt`. Do not reconstruct a prompt.

## QC rows passed

| Command | Row | Numbers |
| --- | --- | --- |
| `python3 packs/zone-b/src/hard/build.py` | passages | arch, north road, outpost gate, basin road clear |
| play snapshot 720×1600 | presented mag | 0.982 on anchor, arch-under, outpost, drone, ribcage, chase |
| play snapshot | drawCalls | 10 |
| play snapshot | texture bytes | 258192536 (246.2 MiB) |
| play snapshot | active videos | 4 |
| `du -sb packs/zone-b` | pack | 42045499 bytes |

## Gotchas

Close the station. A prism with no top or bottom reads as stacked cards when the camera is above it.

Size each part at the distance the eye actually reaches. Walking through an opening puts the camera in the plane of the legs, so the half-gap is that distance. A uniform scale cannot open a painted hole.

A wide cliff crop is a legal lintel skin and still reads as beds. Stop after two tries on that skin.

Proof stills that call `lookAt` skip the chase solver and can report magnification above 1. Budget poses use `place`.

## Reuse

Copy `packs/zone-b/src/hard/build.py` and `packs/zone-b/play/hard.js`. Swap the elevation plates and the placements. Keep one draw, unlit `LINEAR_MIPMAP_LINEAR`, colliders from the solid runs, and the beacon as a world-locked quad. Do not add a second hero.

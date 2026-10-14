# cutout — zone B phone planet and Anchor mouth

Status: IN TEST. The planet card cook is `learn/recipes/zone-b-planet-card.md`. The loft method stays `docs/METHOD/hard-objects.md`. This file records the phone playback path and the walk up to the tower.

| Field | Value |
| --- | --- |
| Asset kind | `cutout` |
| Take | Ember Mesa owner phone fixes, 2026-10-05 06:12 |
| Commit | `5238234` |
| Date | 2026-10-05 |
| Size | Planet 1280×720, 145 frames, 6.041667 s, 980181 bytes, video stream only. Anchor mouth gap 16.54 m, opening height 14.77 m, tower still 60 m. |
| Tries | 0 image calls. 0 video calls. One discarded lookAt from inside a pier. |
| CLI | `ffmpeg -c:v copy -an -map 0:v:0` on the existing planet file. `python3 packs/zone-b/src/hard/build.py --recarve-anchor`. Do not run `build.py` with no flag. |
| Image refs | none |

## Prompt

not stored

No Imagine call was sent.

## QC rows passed

| Command | Row | Numbers |
| --- | --- | --- |
| phone canvas pair, gesture policy, no `debug=1` | sky crop mean abs | 12.701, 27982 / 156800 samples, media 3.835 s → 1.608 s |
| console | planet playing | `planet playing t=2.644 frames=67 paused=false` |
| `planetInfo` | videos | 4 at the pair |
| `planetInfo` | scale and aspect | 0.5625, 1.7777778 / 1.7777778 |
| gallop inside one `evaluate` | under the arch | z 174.28, blocked false |
| `carve_mouth` | mouth | rows 268, y 852–1134, gap 16.54 m, height 14.77 m, boxes 101 |
| reaches | outpost, drone, rib | z −51.73 blocked 0; x 14.11 blocked 12; x −14.06 blocked 27 |
| `perf` | budget | drawCalls 10 and 9, texture bytes 256963736 |
| root `npm test` | exit | 0 |
| `cd tools/playcheck && npm test` | unit | 43 pass, 0 fail |

## Gotchas

Headless Chrome played the planet before these changes. That is not a phone proof. Set muted, volume 0, and playsinline before `src`. Keep the element about 48 px at a low opacity. Upload a canvas the video was drawn into.

A `lookAt` from beside the tower put the eye inside the pier mesh. The under shot is a chase `place` plus ticks inside one `evaluate`, because `pollKeys` clears a stick that is not held.

`build.py` with no flag recopies session images and forces the Anchor outside with empty boxes. The mouth path is `--recarve-anchor` only.

Presented magnification under a 60 m tower is 27. Record it. Do not shrink the tower to pass `terrain/qc.mjs` walk_mag.

## Reuse

Copy `videoEl`, `uploadPlanet`, and the gesture retry in `packs/zone-b/play/play.js`. Copy `APRON` in `packs/zone-b/play/field.js` when a hard object sits past the walk polygon. Copy `carve_mouth` when a painted opening has to be a hole. Swap the elevation plate. Keep one loft draw.

# other — corridor awaken

Status: the phone frames passed. No Imagine prompt was sent.

| Field | Value |
| --- | --- |
| Asset kind | other |
| Take | corridor chase, sprint, and streaming props |
| Commit | `3381adb` |
| Date | 2026-10-06 |
| Size | 720×1600 proofs. Corridor length 79.75 m. No new image file. |
| Tries | 2 |
| CLI | none |
| Image refs | none. Sky, ground, lofts, and hulls are files already in `packs/zone-a`. |

## Prompt

not stored

```
not stored
```

## QC rows passed

| Command | Row | Numbers |
| --- | --- | --- |
| `python3 tools/wfc-path/hang_selftest.py` | exit | 0 |
| `node --test packs/corridor-ab/play/*.test.mjs` | tests | 20 pass |
| `node tools/playcheck/src/renderlint.mjs` on six play sources | render_source | PASS |
| `?shot=walk` settled title | phone | drawCalls 7, texMB 211.2, activeVideos 4, jsMs 0.8, glError 0, rocks 13, live 15, speed 2.85, eyeY 3.5, pawY 0 |
| `?shot=sprint` settled title | phone | drawCalls 7, texMB 211.2, activeVideos 4, jsMs 0.6, glError 0, rocks 33, live 36, speed 8.6, charge 1 |
| `proof/emerge.mp4` | clip | 720×1600, 16 frames, 3.2 s, 2011232 bytes |

## Gotchas

Fill the pool from the forward centre lanes, or the portrait cone stays empty while the shoulders are full. The paw offset is `(1 - pawFrac) * worldH`. The camera right is `(cos heading, 0, -sin heading)`. A mirrored lookAt makes stick-right turn left.

## Reuse

Copy the chase numbers and `stream.js`. Seat the zone A lofts with a pose shift so one mesh of each recycles along the run. Density and lookahead follow speed. The same seed and the same speed history rebuild the same slots. Do not solve WFC while Bolt runs. Do not hang a crossed card as décor. Far stays a real solid. Sky is the only backdrop.

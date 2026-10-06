# other — corridor horizon break, seated rocks, whole monolith

Status: the phone frames passed. No Imagine prompt was sent.

| Field | Value |
| --- | --- |
| Asset kind | other |
| Take | corridor horizon break, seated rocks, whole monolith |
| Commit | PENDING |
| Date | 2026-10-06 |
| Size | 720×1600 proofs. No new image file. |
| Tries | 1 |
| CLI | none |
| Image refs | none. Hulls and sky slices are the zone A files already in the tree. |

## Prompt

not stored

```
not stored
```

## QC rows passed

| Command | Row | Numbers |
| --- | --- | --- |
| `node --test packs/corridor-ab/play/*.test.mjs` | tests | 24 pass |
| `python3 tools/wfc-path/hang_selftest.py` | exit | 0 |
| `node tools/playcheck/src/renderlint.mjs` on six play sources | render_source | PASS |
| `?shot=walk` settled title | phone | drawCalls 7, texMB 184.5, activeVideos 4, jsMs 0.9, fogOn 1, rocks 13, speed 2.85, pawY 0 |
| `?shot=sprint` settled title | phone | drawCalls 7, texMB 184.5, activeVideos 4, jsMs 1.2, rocks 33, live 36, speed 8.6, gateLat 16 |
| `proof/monolith-pass.mp4` | clip | 720×1600, 72 frames, 24 fps, 3.0 s, 1627162 bytes; pitch −0.159 → −0.141 |

## Gotchas

A flat ground meets the sky in a straight line in this lens. Short rocks do not cross an eye at 3.5 m. The seats that break it are the existing boulder and stone hulls scaled to at least 8 m, inside the 22.7° cone, and clear of the run by more than their footprint. Fog colour is the average of three sky slices. It is not typed into the shader.

A 55 m gate offset leaves the 22.7° view, so the monolith is not in the picture. 16 m clears the footprint and stays in frame. The sprint look reaches 150 m so the gate is drawn while that is still true. The walk keeps the short look, so the gate still waits. Pitch-up is capped at 0.22 rad above the rest chase and never goes below the current pitch.

The rock base is `−0.18 + (emerge − 1) * 2.2` metres, so the rise comes from below the plane.

## Reuse

Copy the sink, the horizon seats, and the capped pitch-up onto the next corridor paint. Swap only the already-cooked hulls. Do not add a mesh, a card, or a second gate.

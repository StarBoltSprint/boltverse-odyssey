# other — corridor horizon and one ground

Status: the phone frames passed. No Imagine prompt was sent.

| Field | Value |
| --- | --- |
| Asset kind | other |
| Take | corridor horizon and one ground |
| Commit | `02aa13a` |
| Date | 2026-10-06 |
| Size | 720×1600 proofs. Ground still 1024×1024. No new image file. |
| Tries | 2 |
| CLI | none |
| Image refs | none. The floor is `packs/zone-a/src/ground/m3.png`. |

## Prompt

not stored

```
not stored
```

## QC rows passed

| Command | Row | Numbers |
| --- | --- | --- |
| `node --test packs/corridor-ab/play/*.test.mjs` | tests | 20 pass |
| `python3 tools/wfc-path/hang_selftest.py` | exit | 0 |
| `node tools/playcheck/src/renderlint.mjs` on six play sources | render_source | PASS |
| `?shot=walk` settled title | phone | drawCalls 7, texMB 184.5, activeVideos 4, jsMs 3.6, glError 0, eyeY 3.5, pawY 0, ground m3, groundPx 1024, rocks 13, speed 2.85 |
| `?shot=sprint` settled title | phone | drawCalls 7, texMB 184.5, activeVideos 4, jsMs 3.5, rocks 33, live 36, speed 8.6, charge 1 |
| `proof/sprint-run.mp4` | clip | 720×1600, 72 frames, 24 fps, 3.0 s, 2353380 bytes |

## Gotchas

m0 and m1 wrap on the outer column and still draw a square, because the rim is darker than the core. A quad per 1.45 m cell lines that rim up. One quad plus four windows of m3 does not. Aiming at 0.62 m from an eye at 3.5 m puts the horizon above the frame.

## Reuse

Keep the eye near 3.5 m and set the aim so `horizonFromTop` on a 720×1600, 22.7° view is between 0.30 and 0.35. Paint the carpet from the even still (`m3`), native pixels, one quad, sampler repeat. Do not pick a per-cell layer from the WFC set for the picture. The solve stays load-time.

# other — corridor look, sky, and props

Status: the phone frames passed. No Imagine prompt was sent.

| Field | Value |
| --- | --- |
| Asset kind | other |
| Take | corridor look sky props |
| Commit | `be725ee` |
| Date | 2026-10-06 |
| Size | 720×1600 proofs. Corridor length 79.75 m. No new image file. |
| Tries | 1 |
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
| `node --test packs/corridor-ab/play/place.test.mjs packs/corridor-ab/play/scatter.test.mjs packs/corridor-ab/play/look.test.mjs` | tests | 9 pass |
| `node tools/playcheck/src/renderlint.mjs` on the four play sources | render_source | PASS |
| `?shot=hdg` and `?shot=tilt` | settled title | drawCalls 7, texMB 211.2, activeVideos 4, glError 0, archOpen true, lengthM 79.75 |
| top 40 rows of each proof | dark pixels below luma 8 | 0, 2, 0, 0, 0 of 28800 |

## Gotchas

`texSubImage3D` needs the z offset. Ten arguments boot to a blank frame. Shard and detail cuts in zone A are cards; this page places the boulder and stone hulls instead. The stick turns yaw. The swipe only tilts, then eases back.

## Reuse

Copy zone A's look numbers and the sky dome. Reseat `mountRuins` with `placements`. Do not solve WFC while Bolt runs. Do not hang a crossed card as décor. The load-time scatter of hulls and lofts is superseded: props now stream while Bolt runs (`learn/recipes/corridor-awaken.md`).

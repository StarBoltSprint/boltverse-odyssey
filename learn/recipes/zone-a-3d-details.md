# rock — zone A Echo Shards and small-detail lofts

Status: validated for the crystal solid and the six detail types that left the card path. Ridge, pebble, and the ground families stayed cards.

| Field | Value |
| --- | --- |
| Asset kind | `rock` |
| Take | Zone A 3d-details |
| Commit | pending |
| Date | 2026-10-05 |
| Size | crystal skin 686×761. Feature skin stays `features.png` 1937×1238. Micro atlas stays `atlas.png`. |
| Tries | 15 Imagine edits. Two HTTP 429s (crystal side, crystal top), each retried once. No 16th image. |
| CLI | `edit` |
| Image refs | each plate is an edit of an existing zone still. Roles were sent to the tool only. |

## Prompt

not stored. Colour text was sent to the image tool and was not written into the repo. The tracked sheet line is `packs/zone-a/src/solids/crystal-skin.PROMPT.txt`.

```
not stored
```

## QC rows passed

| Command | Row | Numbers |
| --- | --- | --- |
| `python3 tools/solids/zonea_loft.py` | every part has thickness | halfX and halfZ above 0.02, at least 8 stations, crystal mip bytes 2784246 against old 2783648 |
| `node --test packs/common/archives/archives.test.mjs tools/playcheck/src/details.test.mjs tools/playcheck/src/renderlint.test.mjs` | archives, details, renderlint | 17 pass |
| `npm test` | root kitchen and archives | exit 0 |
| `cd tools/playcheck && npm test` | unit tests including ruinwalk | 56 pass, gallop blocked 0 through the openings |
| phone proof 360×800 DPR 2 | presented mag, draws, memory | mag 0.998, drawCalls 12, texMB 254.37, activeVideos 4, archivesMag 0.466 and 0.513, detailMag 0.810 and 0.846 |

## Gotchas

Tuft parts must be keyed `tuft:0` `tuft:1` `tuft:2`, the type-local variant, not the index in the whole manifest. A tip station has u0 equal to u1. Caps have to sample the wide mid-body of the side plate or the end view is one grey column. The crystal top plate shapes the ring and is not uploaded. Detail front and top plates are rulers only. The phone is already at 254 MiB.

## Reuse

Copy `packs/common/archives/solid.js` and the loft stations. Swap the skin rects and the foot placement. Do not add a second solid draw. Do not upload a third plate while texMB is this close to 256. Leave ridge, pebble, rock pebbles, and ground families c0–c2 as cards until a skin can replace bytes instead of adding them.

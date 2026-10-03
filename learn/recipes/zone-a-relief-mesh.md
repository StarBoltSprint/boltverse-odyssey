# ground tile — zone A relief mesh

Status: validated for this step's phone walk. The exact Imagine prompt is not in this file.

| Field | Value |
| --- | --- |
| Asset kind | `ground tile` |
| Take | zone A step 1 |
| Commit | `6afb2a2` |
| Date | 2026-10-03 |
| Size | ground stills 1024×1024; world tile 1.45 m; detail cards at most 0.30 m tall |
| Tries | 12 Imagine calls, 11 saved, 1 edit returned HTTP 429 |
| CLI | `generate` and `edit` |
| Image refs | session stills `1.jpg`–`11.jpg`. `8.jpg` edits `4.jpg`. `9.jpg` edits `1.jpg`. `11.jpg` edits `3.jpg`. The edit of `2.jpg` did not save. |

## Prompt

not stored

## QC rows passed

| Command | Row | Numbers |
| --- | --- | --- |
| opposite-edge measure on the saved PNG | seam ratio and absolute seam | m0–m7 and mask: ratio 0.000, abs 0.00 |
| debug walk, four headings, phone canvas 720×1600 | mag_max and ground mag | both 0.912 |
| proof cameras | presented mag | 0.910 |
| boot log | mesh | area 6500 m2, tris 77310, verts 40829, cards 400, height −1.74 to 7.66, max slope 0.639 |
| root `npm test` | suite | exit 0 |

`tools/assetcheck` was not run on this set. A sentence in this file is not that gate.

## Gotchas

The 1.45 m tile is as large as the phone view allowed. At eye height 1.35 m the walk ground mag reached 0.912. A larger tile goes through 1. A boom under about 3.3 m magnifies the Bolt card past 1; the close proof uses 4.2 m. An overview camera above the sky cylinder looks at the outside of the mesh. `page.screenshot` of this WebGL canvas hung; the proof used `canvas.toDataURL`. `prep.py` must depth-map only names like `m0.png`. `mask.png` also starts with `m` and used to write `hask.png`. Materials 6 and 7 are one still, copied after the 429. A wide camera still sees the tile period. Family changes are a height test, not a blend image.

## Reuse

Copy the relief mesh, the per-image depth displacement, and the world-yaw detail cards. Swap the Imagine stills for the next zone. Do not copy a prompt from memory. The strings that were sent are only in the untracked provenance file for this step.

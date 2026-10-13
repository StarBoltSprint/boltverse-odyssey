# Take note — zd rune pillar — 2026-10-13

## Quota and turns

`python3 tools/quota/quota.py` on this session's `events.jsonl` appended:

| Date | Step | Commit | Turns | Tool calls | Image gens | Video gens | Tokens in | Tokens out | Wall s | Log |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-13 | zd-02-rune-pillar | 9b5067d7 | 0 | 0 | 0 | 0 | n/a | n/a | 2304.4 | events.jsonl |

The log records `turn_started`, which that counter does not count as a turn. The zeros are the tool's row. Wall time is 2304.4 s. No image or video generation.

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| Rune pillar slim, UV, LOD, colliders, gates | hull/ship | one build plus one render pass | row above | rejected (volume stepFrac and relief alignment FAIL) |

## This step

- Step: `steps/zone-d/02-rune-pillar` spec `zd-rune-pillar-02r`. Build commit `9b5067d705ad1fd94e8e64b5c23981ce4d4a947b`.
- Accepted because: the ordered slim is measured (max flat-to-flat 1.6 m, UV stretch 1.221, outline 0 px, plaza free width 24.124 m) and the report records the FAIL rows. The object is not KEEP.
- Recipe appended: none. The QC rows did not all pass.
- Failure appended: volume jump misses centimetre grooves; relief edge score misses groove seating; visible-shot cannot import js-yaml.

## Biggest waste

The first rasterizer discarded every camera-facing triangle because y-down makes the screen area negative (`work/render_gate.py`, `if area <= 1e-6`). The frames were black until that test used `abs(area)`. After the frames existed, the volume gate and the relief edge score still failed for reasons a 4.5 cm groove and a photographic albedo cannot satisfy.

## Reuse next time

- Recipes to copy: none new. Shaft check is `python3 tools/object-gate/py/shaft_profile.py`. Plate UVs are equal px/m (`1024/7`) then conformal repair.
- Library ids to place: none. Intake refused this part.
- Failures that would have caught this take earlier: the 2026-10-12 painted-icicle row was already guarded; `painted_duplicate` on this mesh returned ghosts 0. The new rows are the volume jump and the relief recall.

## Added this take

- New recipes: none.
- New failure entries: three, dated 2026-10-13, in `learn/failures.md`.
- `learn/geometry.md` was not changed. This step confirmed flat-to-flat = 2 × apothem and the 1.65 m cap above the plinth.
- No owner reaction, so `learn/taste.md` was left as it was.

## This step (v2)

`python3 tools/quota/quota.py` appended:

| Date | Step | Commit | Turns | Tool calls | Image gens | Video gens | Tokens in | Tokens out | Wall s | Log |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-13 | zd-rune-pillar-v2 | c9f1803852ffe316a3c8c1df672f5b770edc0075 | 0 | 0 | 0 | 0 | n/a | n/a | 5728.0 | events.jsonl |

The counter still ignores `turn_started`. Wall time 5728.0 s is the whole session log. Image gens 0. Video gens 0.

- Step: `steps/zone-d/02-rune-pillar` spec `zd-rune-pillar-03-v2`. Build commit `c9f1803852ffe316a3c8c1df672f5b770edc0075`.
- Accepted because: the ordered v2 rows are measured and written in `object-gate-v2/REPORT-v2.md`. Alignment is front 0.9812, right45 0.9849, left45 0.7971. LOD tris 24902 / 6592 / 2352 with 0 px outline. Grazing relief stepFrac 0.0162 stays FAIL. The object is not KEEP.
- Recipe appended: none. One required row still fails, and no Imagine prompt was stored.
- Failure appended: rune mask box grows the groove past the stroke; grazing relief step fraction stays under 0.03.

## Biggest waste (v2)

The mask search and the pixel-box groove both missed 0.70. A 2 px dilation of a perfect mask already fails that score. The passing cut is one subcell per mask-pixel centre.

## Reuse next time (v2)

- Stop warping a rune mask when the best IoU is under about 0.03. Cut the pocket on the pixel centre.
- A checkerboard of floor cells opens the mesh. Fill one side cell.
- Do not spend a third cook on grazing stepFrac. The 2026-10-13 volume-jump entry and the new grazing entry already name the bar.

## Added this take (v2)

- New recipes: none.
- New failure entries: two more, dated 2026-10-13, in `learn/failures.md`.
- Shaft taper constants were left as v1. That confirmed the existing flat-to-flat row.
- No owner reaction, so `learn/taste.md` was left as it was.

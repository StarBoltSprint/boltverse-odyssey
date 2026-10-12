# Zone C plates #5–#15

Verdict: PASS (`python3 steps/zone-c/04-plates/check-plates.py`). Sheet is ready for SmiR. These plates are not in a 3D build.

Tool: `image_edit` on a square PIL crop of `key-zc1.jpg`. One reference per call. Pure `image_gen` was not used. Reference conditioning held (stone, moss, golden light, the ringed planet, the leaf, the fern).

Imagine calls: **13** (11 first plates + 1 retry on #6 + 1 retry on #8). Moss #1–#4 were not recooked.

| # | File | Calls | Native | Saved | Result |
| --- | --- | --- | --- | --- | --- |
| 5 | `plate-05-arch-left-inner.jpg` | 1 | 1008×1024 | 1024×1024 mirror-pad | flattened inner stone |
| 6 | `plate-06-arch-right-inner.jpg` | 2 | 1024×1024 | native | through-ring kept; unroll failed twice |
| 7 | `plate-07-wall-left.jpg` | 1 | 1008×1024 | 1024×1024 mirror-pad | face-on strata |
| 8 | `plate-08-wall-right.jpg` | 2 | 1024×1024 | native | same stone; depth remains (stop after 2) |
| 9 | `plate-09-waterfall.jpg` | 1 | 1008×1024 | 1024×1024 mirror-pad | straightened sheet |
| 10 | `plate-10-mist.jpg` | 1 | 1008×1024 | 1024×1024 mirror-pad | mist on mid-grey |
| 11 | `plate-11-leaf.jpg` | 1 | 1024×1024 | native | one leaf, grey field |
| 12 | `plate-12-fern.jpg` | 1 | 1024×1024 | native | one fern, grey field |
| 13 | `plate-13-causeway-underside.jpg` | 1 | 1024×1024 | native | underside / cliff foot |
| 14 | `plate-14-gorge-closure.jpg` | 1 | 1024×1024 | native | face-on closure |
| 15 | `plate-15-planet.jpg` | 1 | 1024×1024 | native | same cream banded planet and rings |

## Rows

1. Crops — `crops.json`. Eleven square cuts from `key-zc1.jpg` (1792×1008), copied to `steps/zone-c/04-plates/key-zc1.jpg`.
2. Tool — `image_edit` only. Output bucket about 1024. A crop one pixel off square came back 1008×1024. Those four files were mirror-padded 8 px per side so the short side is 1024. The Imagine pixels were not resampled.
3. Retries — #6 second call returned the canyon again. The first call (inner wall seen through the ring) is the file. #8 second call is still a deep cliff, not a flat orthographic face. Stop after 2. No third cook.
4. Sheet — `sheet-plates.jpg` 1760×1686, key on top, labels drawn in code. Wider than tall.
5. Gate — `check-plates.py` PASS. Eleven JPEGs, min side 1024, each file over 20 KB. `tesseract` is not installed, so the OCR branch was skipped. Variance check passed.
6. Sums — `SHA256SUMS` covers the 11 plates, the sheet, and the key copy. Counts are in `numbers.json` (`plates` 11, `imagine_calls` 13).
7. Quota — no session ndjson was in the worktree, so `tools/quota/quota.py` was not run. The Imagine count above is the calls made in this step, not a guessed token total.
8. Preview — not frozen. This step has no play tree, and the plates stay out of any 3D build.

Known misses for the owner: #6 is the inside of the ring, not an unrolled soffit. #8 still has cliff depth. The planet plate fills the frame in the key’s cream, tan, and gold, with thin rings.

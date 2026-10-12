# Zone C step 4: remaining Imagine plates #5–#15 (`zc/04-plates`, 12 Oct, SmiR GO 05:56)

Zone C "Cascade Verdance". Bible: `/workspace/zc-bible-1011/PROMPT-GROK-BUILD-ZONE-C.md` (rules 1–9 apply).
Branch `zc/04-plates` from `zc/03-terrain` (PR #203 open, NOT merged). Plates only — do NOT mesh, place, or build 3D from them. SmiR validates the contact sheet first.

kit-gate: python3 steps/zone-c/04-plates/check-plates.py
<!-- kit-gate-outdir: steps/zone-c/04-plates -->

## Read first
GROK.md, docs/METHOD.md, learn/failures.md, `/workspace/x-live/chrome-game-home/.grok/bundled/skills/imagine/SKILL.md` (use `/bundled:imagine`), SPEC-ZC-TERRAIN-PLATES-1011.md (moss #1–#4 already done).

## Imagine skill (confirmed)
- Tools: `image_gen`, `image_edit`, `reference_to_video`.
- **Prefer `image_edit`** with the key (or a PIL crop of the key) as `image` reference. Single-image edits keep the input aspect ratio. References are downscaled to ~768 px on the long side before the model — pick crops for composition/identity/colour, not tiny text.
- `image_gen` only if `image_edit` is unavailable; then `aspect_ratio` `1:1` (or native). If a first test shows no reference conditioning, write that in REPORT.md and **stop after 1 test image** (do not invent style with pure gen for all 11).
- Contact sheet: assemble in **code** (PIL/HTML), never as one Imagine generation.
- Cost: each call is one Imagine generation; max 1 retry per plate if clearly wrong.

## Inputs (FIXED)
- Key: `/workspace/zc-bible-1011/key-zc1.jpg` (1792×1008). Also copy into `steps/zone-c/04-plates/key-zc1.jpg` for local use.
- Existing moss plates #1–#4: `steps/zone-c/03-terrain/plates/moss-top-*.jpg` and `/workspace/zc-bible-1011/plates/` (do not regenerate).
- Same stone, same sun (warm golden), same moss green — never invent a new style/palette.

## Prep (code, before Imagine)
With PIL, crop useful references from the key into `steps/zone-c/04-plates/crops/`:
- `crop-arch-left.jpg`, `crop-arch-right.jpg` (arch openings + thickness)
- `crop-wall-left.jpg`, `crop-wall-right.jpg` (strata faces)
- `crop-waterfall.jpg`, `crop-mist.jpg`, `crop-leaf.jpg`, `crop-fern.jpg`
- `crop-causeway-underside.jpg` / cliff foot
- `crop-gorge-closure.jpg`
- `crop-planet.jpg` (ringed planet full in frame)
Write crop boxes into `steps/zone-c/04-plates/crops.json`.

## Generate (one call per plate; `image_edit` from key or matching crop)
Save under `steps/zone-c/04-plates/`:

| # | File pattern | Subject | Framing |
| --- | --- | --- | --- |
| 5 | `plate-05-arch-left-inner.jpg` | Inner thickness of **left** arch | Face-on / flattened inner face; same stone+moss; no full-scene horizon |
| 6 | `plate-06-arch-right-inner.jpg` | Inner thickness of **right** arch | Same as #5 for the right arch |
| 7 | `plate-07-wall-left.jpg` | Left canyon wall face-on | Same strata as key; orthographic / face-on; fill frame |
| 8 | `plate-08-wall-right.jpg` | Right canyon wall face-on | Same strata; face-on |
| 9 | `plate-09-waterfall.jpg` | Waterfall sheet straightened | Same water colour/motion look; straightened sheet, not a deep perspective canyon |
| 10 | `plate-10-mist.jpg` | Mist veil cut-out | Soft mist only on flat neutral (mid-grey or green-grey) background; no landscape |
| 11 | `plate-11-leaf.jpg` | Single big leaf isolated | One leaf, neutral bg, match key foliage |
| 12 | `plate-12-fern.jpg` | Single fern isolated | One fern, neutral bg |
| 13 | `plate-13-causeway-underside.jpg` | Underside of causeway / cliff foot | Same stone+moss; underside / foot, not skyline |
| 14 | `plate-14-gorge-closure.jpg` | Gorge closure wall | Same strata as walls; face-on closure |
| 15 | `plate-15-planet.jpg` | Ringed planet full frame | **THE SAME** planet as in the key (rings, colour, banding); full frame, no invented planet |

Resolution: max available from the tool; **at least 1024** on the short side (prefer 1:1 or native edit aspect; moss plates were 1408×1408 — match that when the tool allows). No text, no watermark, no UI chrome, no logo.

Retry rule: **max 1 retry** per plate, and only if clearly wrong (has horizon/perspective when it should be face-on, text/watermark, wrong object, invented style). Do not burn retries on taste.

## Contact sheet (code)
`steps/zone-c/04-plates/sheet-plates.jpg`: key on top, then 11 labelled thumbnails (#5–#15). Labels drawn in code. Also write `SHA256SUMS` for the 11 plates + sheet + key copy.

## Verify (blocking kit-gate = plate-check)
`python3 steps/zone-c/04-plates/check-plates.py` must PASS:
- All 11 `plate-0N-*.jpg` + `sheet-plates.jpg` exist
- Each plate: JPEG, min side ≥ 1024, file size > 20 KB
- No OCR-ish text/watermark heuristic: reject if a quick luminance-band / edge density suggests UI chrome *or* if filename content is wrong; prefer a simple check that scans for common watermark strings via optional `tesseract` if present, else skip OCR and only check dimensions + non-blank variance
- Sheet exists and is wider than tall (or clearly multi-panel)

Write `steps/zone-c/04-plates/REPORT.md` (what tool worked: image_edit vs gen; resolution; retries; cost count = N Imagine calls) and `numbers.json` (`plates: 11`, `imagine_calls`, per-plate sizes).

## Deliver
- `steps/zone-c/04-plates/` as above
- Local commits on `zc/04-plates` only
- **Do NOT** push, merge, reset --hard, or feed these plates into any 3D build / solids / terrain step
- Do NOT touch other worktrees (tower, zc-solids, zc-terrain)

Max effort: finish the 11 plates + sheet + gate. Stop for SmiR validation.

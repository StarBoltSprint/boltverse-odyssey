# Take note — glacier shaded snow — 2026-11-17

## Quota and turns

`tools/quota/quota.py` was not run. This step is a lighting change on the glacier candidate, not an Imagine cook. No quota figure is invented here.

## This step

- Step: shaded-snow b\* and CIE76 on the cast sun shadow, warmth derived from the run-31 key.
- Accepted because: four of six times pass both bars. 5.10 misses b\* by 0.45. 7.90 misses CIE76 by 0.45. The constant-ambient fixture fails every time. Face CIE76 stays under 10. The limit was not moved.
- Recipe appended: none
- Failure appended: `2026-11-17 — one snow-bounce scale cannot hit every cast-shadow crop`

## Biggest waste

The first scale (1.1) was scored from the decal model and landed the crop at b\* −1.2 to −2.6. The model is 2.42 b\* bluer than the crop. The second capture used that bias. See the failure entry.

## Reuse next time

- Recipes to copy: the shade crop in `shade-snow-gate.mjs` (snow ahead of the paws, beauty at least 6 L\* darker than the surface).
- Failures that would have caught this take earlier: the six crops do not share a lightness, so one added axis cannot satisfy a 1.2-wide b\* band and CIE76 10 together.

## Added this take

- New recipes: none
- New failure entries: the 2026-11-17 shaded-snow row in `learn/failures.md`

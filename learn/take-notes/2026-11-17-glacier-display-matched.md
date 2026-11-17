# Take note — glacier display-matched grade — 2026-11-17

Rejected. The locked tonemap gate did not pass, so this is not an accepted step. Quota was not run. No recipe was added.

## This step

- Step: display-matched present path (identity through scene 0.805437471876985, Reinhard shoulder to white point 4, exposureEv 0).
- Accepted because: not accepted. `display/tonemap-gate.json` verdict FAIL.
- Recipe appended: none.
- Failure appended: `2026-11-17 — display-matched grade matches gamma and still misses the snow key` in `learn/failures.md`.

## Biggest waste

Scoring the snow-key p50 as if a highlight shoulder could move it. The gamma stills already miss that key by up to 0.087, and the display stills match those snow medians exactly.

## Reuse next time

- The display operator in `light-rig.js` (`tonemap: "display"`) when the next branch needs highlight headroom without a new midtone look.
- Do not retune EV or the knee to chase `snow p50` against the texture key. That lift is the round-3 miss.

## Added this take

- New recipes: none.
- New failure entries: the snow-key identity miss above.

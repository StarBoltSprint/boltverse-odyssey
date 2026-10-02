# plate-geo-qc — 2026-10-02

Law 66. The dash judge let a level-horizon miss through because it never measured one.

## What happened

`plate-geo-qc.py` on a plate looks for three neon dash tubes and walks them toward y=0.38. A horizon at half the frame, a sky that does not close, an unmeasured width, and a tile whose texel density changes all passed that gate by never being asked.

## What the tool did

Exit 0 or 1 on the sealed dash thresholds only. It did not print a horizon fraction, an `f_px`, or pixels per metre.

## What changed

The same script now has `--report horizon|sky|turn|sun|texel|scale`. Those reports are not the hang gate. Passing plates with no `--report` still prints `law 23`. The thresholds (inliers, spread, VP sigma, sag, 720×1280, fps) are unchanged.

## Still open

The reports do not read a video. A plate still has to be a still, or a manifest, before rail 12 runs. The dash judge is still the hang gate for Video A.

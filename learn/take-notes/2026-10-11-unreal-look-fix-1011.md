# Take note — unreal look fix — 2026-10-11

No Imagine prompt. No image generation. The quota log for this session was not on disk, so the quota row was not invented.

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| Key-camera grade | other | 2 fit rounds | not in a session ndjson | accepted |

## This step

- Step: SPEC-UNREAL-LOOK-FIX-1011. Blocking luma, histogram, god-ray, and contact gates on the matched key camera, then a grade fit.
- Accepted because: `python3 tools/look/look.py gate` exit 0 on `after-r2-16x9.png`. Mean luma 0.3194 vs 0.3211 (rel −0.0053). Sky p98 0.7131. Contact 4/4. `python3 tools/look/selftest.py` PASS.
- Recipe appended: none. This was not an Imagine cook, and the recipe index does not list a cook whose prompt was not stored.
- Failure appended: `learn/failures.md` heading "matched luma ramp still missed the darkest histogram bin on the screenshot".

## Biggest waste

Round 1 already matched the mean, the rays, and the contact. One histogram bin was 0.0001 over its ±10% band, so the whole gate failed and the page had to load again for the toe lift.

## Reuse next time

- Camera: `/workspace/zb-bible-1008/compare/run3/camera/camera-v2.json`. Say when `fovDeg` is on the 80° bound.
- Fit the grade from `?grade=id` (the linear target, encoded), not from the AgX screenshot and not from the synthetic pregrade.
- `python3 tools/look/look.py gate --key KEY --frame FRAME --scene SCENE --pack look.json` before calling the pack done.

## Added this take

- New recipes: none
- New failure entries: darkest-bin screenshot drift; the synthetic-pregrade pack now fails `look.py gate`

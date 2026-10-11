# Take note — unreal look fix 2 — 2026-10-11

No Imagine prompt was sent. No image generation. The session ndjson for this step was not on disk, so the quota row was not invented and `tools/quota/quota.py` was not run.

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| Low-camera sun and region gate | other | 2 capture rounds | not in a session ndjson | rejected |

## This step

- Step: SPEC-UNREAL-LOOK-FIX2-1011. Low 16:9 camera, atlas sun, shaft check, region ΔE, 404, sheets.
- Accepted because: the step stopped at the spec's two-round cap with measured FAIL rows. `look.py gate` on `shots/after-r2-16x9.png` is false. Horizon ΔE 27.0191 (limit 6). Shafts hit 0. `python3 tools/look/selftest.py` PASS. `python3 tools/look/look.py check` PASS.
- Recipe appended: none. This was not an Imagine cook that passed QC.
- Failure appended: `learn/failures.md` heading "avenue yaw still shows the gas giant, so a screen-space sun cannot match the key horizon".

## Biggest waste

Round 1 intensity 1.15 clipped the open sky white and moved the shaft detector off the horizon. Round 2 only proved the atlas disc cannot repaint the gas-giant plate. That second capture was the stop the spec requires, and it did not move horizon ΔE under 6.

## Reuse next time

- Camera file: `steps/unreal-look-fix2-1011/camera/camera-v2.json`. Eye 4.0 is the 2–4 m clamp. fov 90 is inside 40–120.
- Sun pixels: existing `sky1/sky7-atlas.png` only. UV [0.6887, 0.4146], intensity 0.42, rim 0.4.
- Do not call the look matched while `colour-horizon` or `shafts` fail. The old sky-p98 row can still pass.
- `python3 tools/preview/freeze.py` exits 1 on a FAIL report. Skip it. Do not point it at the live symlink tree.

## Added this take

- New recipes: none
- New failure entries: gas-giant avenue vs key horizon, and shafts too weak for the new lift row
- Confirmed, not rewritten: the 2026-10-11 darkest-bin histogram entry. Round 2 still fails four bins. The guard already exists.

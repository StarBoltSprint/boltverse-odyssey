# Unreal look fix 2 — 11 Oct — framing + sunset glow

Date: 2026-10-11
Verdict: FAIL

Two capture rounds. Stop. No third tune. No Imagine image was generated. `bake-sand` stays `NEEDS_APPROVAL` (one request, not cooked).

The delivered frame is the low 16:9 camera with a small atlas sun on the right horizon. The avenue sky is still the purple gas-giant plate. The tower gaps do not show a shaft lift of 0.045. Region colour against `key-city3` fails on sky, horizon, and towers.

## Camera

`placement_v2.py camera` wrote `steps/unreal-look-fix2-1011/camera/camera-v2.json`. It did not overwrite the bible camera. Limits: eye via dy [−1.15, 0.85] on base eye 3.15, so eye 2–4 m; fov 40–120; pitch −12..15. Renders 18. Horizon is diagnostic only.

| | |
| --- | --- |
| Pose | x −51.115, z 9.63, yaw 78, pitch 4.84, eye 4.0, fov 90, dy 0.85 folded into eye |
| Bound | eye 4.0 is the upper clamp (2–4 m). fov 90 is inside 40–120. |
| Error | 0.00308 |
| Parts | vp 0.0477, spireTop 0.0283, visibleHorizon 0.2 (not fitted) |
| First | vp 0.1021, spireTop 0.2007, error 0.05069 |

Before this step the reused bible pose was eye 18.15, fov 80 (fov on the old 40–80 bound), pitch 8.84, same x z yaw. That frame is the before cell.

## Tower silhouette IoU

`keycompare.py` on the identity frame `shots/scene-r1-16x9.png` (same silhouettes as the after frame) vs `key-city3.jpg`. Job `steps/unreal-look-fix2-1011/iou-scene/job.json`.

| Element | IoU | Aligned | Verdict |
| --- | --- | --- | --- |
| towers | 0.322 | 0.35 | MATCH |
| tower-right | 0.484 | 0.491 | MATCH |
| spire | 0.595 | 0.595 | MATCH |

The tool's MATCH thresholds are loose. These IoU numbers are the report. Towers were not moved. `placement_v2 place` was not run.

## Sun

Pixels from the existing atlas `sky1/sky7-atlas.png` (`/workspace/zb-preview-1008/sky1/sky7-atlas.png`). Engine sets placement and intensity only. UV is the brightest warm pixel in the key horizon band: [0.6887, 0.4146]. Round 2 intensity 0.42, rim 0.4. sunRect [0, 0, 0.4560124934929724, 1]. rayRect [0.797501301405518, 0, 1, 0.9315068493150684]. Grade: curve `match`, reference `game`, toe 0.02, distance 14.2446, bloom off, fit on `shots/scene-r1-16x9.png`.

Round 1 used intensity 1.15. The right third of the frame clipped white and the shaft detector's brightest pixel left the horizon (sun [0.3719, 0.2792]).

## Gate

`python3 tools/look/look.py gate` on the matched 1280×720 frames. Overall pass false both rounds.

Round 1 (`gate-r1.json`, `shots/after-r1-16x9.png`):

| Row | Result | Number |
| --- | --- | --- |
| Frame | PASS | real framebuffer |
| Luma | FAIL | mean 0.439 vs key 0.3211, rel 0.3674 |
| God rays (sky p98) | PASS | score 1.0, keep 0.5302 |
| Contact | PASS | hit 2 of 3, need 2, delta 0.03 |
| Shafts | FAIL | hit 0, need 1, lift 0.045, sun [0.3719, 0.2792] |
| colour-sky | FAIL | ΔE 24.2443, limit 12 |
| colour-horizon | FAIL | ΔE 31.5002, limit 6 |
| colour-sand | PASS | ΔE 11.8669, limit 14 |
| colour-towers | FAIL | ΔE 24.2437, limit 14 |

Round 2 (`gate-r2.json`, `shots/after-r2-16x9.png`). This is the delivered frame.

| Row | Result | Number |
| --- | --- | --- |
| Frame | PASS | real framebuffer |
| Luma | FAIL | mean 0.3357 vs key 0.3211, rel 0.0454 (mean inside ±10%). Failing bins: i0 0.0254 vs 0.0308 tol 0.0031; i2 0.1153 vs 0.1018 tol 0.0102; i6 0.1002 vs 0.1119 tol 0.0112; i10 0.0327 vs 0.027 tol 0.0027 |
| God rays (sky p98) | PASS | score 0.8737, floor 0.50, keep 0.5302 |
| Contact | FAIL | hit 1 of 2, need 2, delta 0.03 |
| Shafts | FAIL | hit 0, need 1, lift 0.045, sun [0.6844, 0.4083] |
| colour-sky | FAIL | ΔE 14.4988, limit 12 |
| colour-horizon | FAIL | ΔE 27.0191, limit 6 |
| colour-sand | PASS | ΔE 10.3551, limit 14 |
| colour-towers | FAIL | ΔE 19.469, limit 14 |

The key itself passes the shaft detector (hit 3, sun [0.6773, 0.4222]). The delivered frame does not. The disc sits near the key UV. The gaps are not peaked. `SHAFT_LIFT` was not loosened.

## 404

Round 2 shots log `logs: []` (16:9 and phone). The stage page links `./sky1/sky7-atlas.png` and `favicon.ico` in the stage points at that atlas (curl of the stage icon returned 200 during the cook). The live tree `/favicon.ico` was not edited and was still 404. The previous step's unnamed console 404 was not reproduced on these shots.

## Sheets

`steps/unreal-look-fix2-1011/sheet-16x9.jpg` — before, after, key. Cell 640×396 so the image area is 640×360 (16:9). Before is `/workspace/zb-unreal-look-fix-1011/shots/after-r2-16x9.png` (eye 18.15, fov 80). After is `shots/after-r2-16x9.png`. Key is `/workspace/zb-bible-1008/key-city3.jpg`.

`steps/unreal-look-fix2-1011/sheet-phone.jpg` — same three labels, cell 540×1200. Before is the previous step's `after-phone.png`. After is `shots/after-phone.png` (540×1200, `logs: []`).

Phone page, loopback only:

`http://127.0.0.1:8996/unreal-look-1011/?hud=0&lockq=1&dyn=0&x=-51.115&z=9.63&yaw=78&pitch=4.84&eye=4&fov=90`

## Honest misses

- Eye stopped on the 4 m clamp. The solve cannot go lower inside the asked 2–4 m band because 4 m is the top of that band and the search sat there.
- Yaw 78 still shows the gas giant and rings. The key's horizon is a broad orange glow. A screen-space disc from the existing atlas does not replace that sky. Horizon ΔE 27.0191 against limit 6.
- Shafts are in the shader (radial blur of the atlas ray cell, occlusion from scene luma) and are too weak to pass the new check. They are not visible as volumetric gaps between the towers.
- Four histogram bins fail even though the mean is inside ±10%. Contact dropped from 2/3 to 1/2 when the sun was pulled back.
- Planet stays in the avenue view. Live `sky-t7.mjs` and `biome.json` were not edited.

## Not done

- `python3 tools/preview/freeze.py` was not run. The report verdict is FAIL, and freeze exits 1 unless the report says PASS. The staging tree is also a symlink mirror of the live preview.
- No session ndjson for this step was on disk. `tools/quota/quota.py` was not given invented counts. The fixture log was not used.
- No owner reaction in this chat, so `learn/taste.md` was not appended.

## Checks

`python3 tools/look/selftest.py` PASS (after the round-2 shader). `python3 tools/look/look.py check` PASS. `python3 tools/look/look.py gate` on `shots/after-r2-16x9.png` exit non-zero, verdict FAIL.

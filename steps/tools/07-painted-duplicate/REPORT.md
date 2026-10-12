# tools/07-painted-duplicate

Verdict: PASS

Blocking object-gate check `painted_duplicate` (API 1.8). A plate that still shows a painted icicle on a real cone fails. A pale leftover smear fails. A clean plate with the cone passes. No Imagine. The terrace (`steps/zone-d`) was not edited. No preview freeze: this step has no play tree.

## What the gate does

`tools/object-gate/py/painted_duplicate.py` projects each cone into its plate, grows the mask by 0.05 m, and looks 0.04 m past that edge. It reuses `ghost_streaks.bright_mask` / `detect` for vertical bright runs. A tapering ice-coloured streak (white, pale, or cool) covering at least 0.08 m of that near mask fails as overlap. A pale smear with no cone within the ghost range fails through `ghost_streaks.run`.

The JSON is the gates-API record: `check`, `status`, `failing_face_ids`, `world_position`, `suggested_fix`. On FAIL, `suggested_fix` is `inpaint painted feature with neighbouring basalt`. On PASS it is `""`, the face list is empty, and `world_position` is null. CLI exit 0 PASS, 1 FAIL, 2 bad invocation. Extra fields `causes`, `overlap_m`, and `ghosts` are diagnostic.

The row runs only when the object spec sets `paintedDuplicate`. Default profiles are unchanged. The row id is `painted_duplicate`. The fix plan action is `inpaint-basalt`, not automatic.

## Measured proofs

Synthetic plates only (256×220, 0.02 m/px, temporary directory, not committed). Cone faces 101, 102, 103 at world `[1.28, 0.0, -0.4]`.

| Fixture | Status | Causes | overlap_m | ghosts | failing_face_ids | world_position | suggested_fix | CLI |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Painted icicle under the cone | FAIL | overlap | 1.4 | 0 | 101, 102, 103 | [1.28, 0.0, -0.4] | inpaint painted feature with neighbouring basalt | 1 |
| Pale smear beside the cone | FAIL | ghost_streak | 0.0 | 1 | (empty) | [3.6, -0.76, 0.0] | inpaint painted feature with neighbouring basalt | 1 |
| Clean basalt plus the cone | PASS | (none) | 0.0 | 0 | (empty) | null | (empty) | 0 |

`python3 tools/object-gate/py/painted_duplicate.py --selftest` printed `ok: true` and exited 0.

`node tools/object-gate/selftest.mjs` printed `PASS selftest` and exited 0. The existing ghost proof still holds: v3.3 ship, 84 painted streaks without cones, FAIL; a cone on every streak, PASS.

## Left

No cook, no recipe, no commit. Quota row is already in `learn/quota-log.md` (2026-10-12, tools/07-painted-duplicate). A phone preview waits until a step has a play tree and the owner asks for a public URL.

# tools/gatesuite — one gate run, one gate-report.json

    python3 tools/gatesuite/run.py <build-url> [--out gate-report.json]
    python3 tools/gatesuite/run.py --selftest

`<build-url>` is a served folder (http) or a local folder with a `build.json` (schema in run.py docstring).

**Steps, in this order:** spine → layout → walk → pack → budget → playgate → depthmeasure → kitjudge.
- Every step writes its own section of ONE `gate-report.json`.
- A missing, skipped or errored section, or one with no evidence, is a FAIL ("not implemented, never pass").

| step | source spec | what it measures |
|---|---|---|
| spine | layout-stage, kit-engine "spine >= 1.3.1" | version ≥ 1.3.1, points, camera block |
| layout | layout-stage.json | grade ≤ 14 %, pitch step ≤ 4°/5 m, camera 4.5/2.6/48, no collider face > 5 cm outside its mesh |
| walk | playtest-walk.json | fixed-timestep sprint (8 m/s, 60 Hz): pitch Δ ≤ 1°/frame, world colliders in the 2.5 m lane |
| pack | kit-engine runtime.pack | UV range vs unpacked ≤ 0.001, tri count unchanged, min/max, finite |
| budget | kit-engine per_piece/runtime | tris per LOD (piece 3k/1k/300, tier 90k), draws ≤ 20, texture MB ≤ 48, texel ≥ 500 px/m |
| playgate | layout collider_visibility, playtest must_fail | served page `window.__inventory`: no drawn collider, drawn build nodes ⊂ GLB meshes, doubleSided only from GLB, no page errors |
| depthmeasure | kit-art auto_judge_checks | height vs Reader spec ±10 %, 1.8 m marker, 0 m float under overhangs (vertical-ray support, 2 cm) |
| kitjudge | kit-art auto_judge_checks | `tools/kit/judge.py` ≥ 50, no dark hard rectangle, stripe/chevron FFT ratio < 9 per review view |

**Selftest.** Every named must-fail fixture FAILs:
- dd80963f, 3e8dce00
- spine v1.1 and v1.2
- the 12 %-tall box, the 10 cm collider
- the v4 cornice float, the v9 side and chase views
- the v9, v10 and v11 judge scores

Controls must PASS their section: spine v1.3.1, an inset collider, a 7.5 m box with the marker, and the v11 seated cornice.

**Gaps:**
- `greybox-spec.json` was not in learn/proposals.
- `tools/kitjudge/judge.py` (named in kit-art-spec) is `tools/kit/judge.py` here.
- Real fps (S20 FE bench), LOD-pop pixel diff at 15/40 m and gltfpack round-trips are not measured yet. They are not in any check, so they cannot pass silently.

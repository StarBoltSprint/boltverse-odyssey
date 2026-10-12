# tools/07-painted-duplicate — compact Grok Build spec

Branch `tools/07-painted-duplicate` off a0676f9f. Work only in this worktree. Local commits OK. **No push, no merge, no reset --hard, no new Imagine. Do NOT touch the terrace (steps/zone-d) — tools only.**

Blocking object-gate check `painted_duplicate`: reject any plate that still shows a painted feature (icicle, stalactite, etc.) where real geometry of that feature already exists.
1. Project each geometric feature (e.g. icicle cones) into its plate UV space; build a mask with a small margin.
2. Detect painted icicle-like streaks in the plate (vertical bright/ice-coloured tapering streaks; reuse ghost_streaks.py logic where useful) inside AND near the mask.
3. FAIL when painted feature pixels overlap/duplicate projected geometry above a small threshold; emit JSON {check, status, failing_face ids, world position, suggested_fix:"inpaint painted feature with neighbouring basalt"} (gates-API shape).
4. Also FAIL if an inpainted area leaves a pale ghost streak (reuse ghost_streaks check).

Self-test must prove: plate with painted icicle under geometric icicle FAILs; pale-smear inpaint FAILs; clean inpainted plate with geometry PASSes.

Write `steps/tools/07-painted-duplicate/REPORT.md`.

<!-- kit-gate: node tools/object-gate/selftest.mjs -->
<!-- kit-gate-outdir: steps/tools/07-painted-duplicate -->

Done when: self-tests exit 0 proving bad output fails; no push/merge.

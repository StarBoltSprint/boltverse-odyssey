# tools/06-lod-streaming — compact Grok Build spec

Branch `tools/06-lod-streaming` off a0676f9f. Work only in this worktree. Local commits OK. **No push, no merge, no reset --hard, no new Imagine.**

Own LOD / streaming helpers (Engine Phase 2 feed, tools side):
1. Given lod0/1/2 meshes, measure outline difference at 15 m and 40 m switches; **refuse** if not 0 px.
2. Record triangle counts per LOD; refuse if lod0 > budget from profile (default 80k) or if coarser LOD has more tris than finer.
3. Texture streaming checklist: native ≥ 1024 Imagine px, mipmaps present; emit JSON report for playcheck / library intake.
4. No morph / no pop: silhouette match is the gate (reuse object-gate LOD outline logic where present).

Self-test must prove: outline-diff fixture FAILs; over-budget lod0 FAILs; missing mipmaps FAILs; good tiny fixture PASSes.

Write `steps/tools/06-lod-streaming/REPORT.md`. Prefer new package `tools/lodstream/` or extend object-gate geometry LOD rows — document choice in REPORT.

<!-- kit-gate: node tools/lodstream/selftest.mjs -->
<!-- kit-gate-outdir: steps/tools/06-lod-streaming -->
(If a dedicated selftest is added, put its command in the kit-gate comment instead.)

Done when: self-tests exit 0 proving bad output fails; no push/merge.

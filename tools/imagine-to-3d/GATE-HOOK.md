# Final stage: object-gate (mandatory)

Added 2026-10-09 by the object-gate worker (new file only; nothing else in this folder was edited).

After `package.py` writes the object into a STAGING copy of the biome page, run:

    node /workspace/grokcli/wt/object-gate/tools/object-gate/hooks/imagine-to-3d.mjs \
         --scene <staging scene.yaml> --object <id> --fix-cmd "<fixer> {plan}" --export-cmd "<export to game>"

Export to the game / catalogue only on exit 0. `{plan}` = fix-plan.json (one action per FAIL row; see FIX_ACTIONS
in the hook). Doc: docs/METHOD/imagine-to-3d.md and docs/METHOD/object-quality-gate.md (PR "object-gate").
Mesa spec example: tools/object-gate/specs/zone-b/mesa.yaml (plates projected: px/m = 1280 px / 107 m x scale).

## imagine-to-3d v2 stages before the gate (2026-10-09)
`run.py strata` runs hull -> depth_fuse (fuse.py, cross-view consistency check) -> depth_relief (depth_relief.py,
variance/spike/gradient check) -> strata (+ re-seed auto-fix: repetition, manifold, stretch, px/m) and exits 1 on any
stage FAIL. The object-gate CLI is then run on the STAGING page; export/live swap only on exit 0.
Note for the object-gate profile: the v2 mesa samples section plates through per-vertex windows (attribute aPx/aPl),
not a `uv` attribute; the runtime publishes the measured per-triangle px/m + stretch in window.__mesasGate.

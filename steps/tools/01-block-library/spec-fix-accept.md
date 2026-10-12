# tools/01-block-library — fix acceptance (UV aniso + LOD outline)

Branch `tools/01-block-library`. Work only in this worktree. Local commits OK.
**No push, no merge, no reset --hard, no new Imagine.**
**Do not edit `steps/zone-d/**` (terrace frozen until Wednesday).** Do not overwrite KEEP objs under `steps/zone-d/01-terrace/work/terrace-lod*.obj`. Rebuild outputs go under `/tmp/block-accept/` only.

## Context (from REPORT.md)

Two acceptance rows FAIL:
1. **UV anisotropy max, every triangle** — lod0 max **1.649808** > **1.3** (KEEP stretch npy max is the same). Visible UV gate (p95 ≤ 1.3, over13Frac ≤ 0.005) already PASSes.
2. **LOD outline** — binary raster 180×320 yaw 35° dist 28 m: lod0–lod1 xorPx **38**, lod1–lod2 xorPx **29** (not 0). KEEP objs score the same on this raster. New lod0 vs KEEP lod0 is 0 px. The v3.4.1 ray gate at **15 m / 40 m** switches previously scored xorPx **0** on KEEP (`work/lod-outline-v341.txt`); that path was not re-run on the new objs.

## Goal

Make the terrace-profile acceptance table **all PASS** (honest numbers), without touching zone-d files.

### Fix UV anisotropy ≤ 1.3 (every triangle)
- Adjust `tools/imagine-to-3d/block_builder.py` and/or profile-driven UV packing / seam handling so a fresh rebuild to `/tmp/block-accept/` has **every-triangle** UV anisotropy max ≤ **1.3** (and over13Frac consistent with existing gate).
- Do not loosen the 1.3 cap. Do not claim PASS on the visible-only gate alone — the acceptance row that failed is the every-triangle max.
- Re-measure after rebuild; write numbers into REPORT.

### Fix LOD outline to 0 px at 15 m and 40 m
- Prefer the real switch distances (**15 m** and **40 m**) used by `lod_gate` / Engine LOD, not the 28 m binary raster that already matches KEEP residuals.
- Ensure border-locked silhouettes across lod0/1/2 so outline xorPx is **0** at both switches on the rebuilt objs in `/tmp/block-accept/`.
- If the binary 28 m raster still shows residual on KEEP, document that, but the **done-when** for this fix is **0 px at 15 m and 40 m** on the new rebuild (and wire the acceptance check to that).

## Allowed edit trees
`tools/imagine-to-3d/`, `tools/gate/`, `tools/object-gate/` (adapters/helpers only), `steps/tools/01-block-library/` (REPORT, accept JSON, this spec). Thin wrappers only if already allowed by original spec — **not** zone-d content/meshes/plates.

## Self-tests (must stay green)
```
python3 tools/library/selftest.py
python3 tools/objsheet/selftest.py
python3 tools/gate/selftest.py
```
Do not loosen thresholds. Known-bad samples must still FAIL.

## Acceptance re-run
Rebuild terrace profile to `/tmp/block-accept/` (do not overwrite KEEP). Update:
- `steps/tools/01-block-library/REPORT.md` (PASS/FAIL table)
- `steps/tools/01-block-library/accept/*.json`

<!-- kit-gate: python3 tools/library/selftest.py && python3 tools/objsheet/selftest.py && python3 tools/gate/selftest.py -->
<!-- kit-gate-outdir: steps/tools/01-block-library -->

## Done when
- Both former FAIL rows are PASS with measured numbers
- Self-tests exit 0
- No Imagine; no push/merge; no edits under `steps/zone-d/`
- Commit: `tools: fix UV aniso ≤1.3 + LOD outline 0px at 15/40m`

END: HEAD sha, REPORT path, accept JSON paths, self-test exits.

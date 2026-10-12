# tools/05-shotsheet-verdict — compact Grok Build spec

Branch `tools/05-shotsheet-verdict` off a0676f9f. Work only in this worktree. Local commits OK. **No push, no merge, no reset --hard, no new Imagine.**

Extend `tools/objsheet/` (contact sheet) so each build can emit a **shot-sheet visual verdict** JSON for Art Director:
- cells: key / 45° / grazing / 8 m / 3 m up (plate | render side-by-side when available)
- per-cell fields: `view`, `plate_path`, `render_path`, `status` (PENDING|KEEP|FAIL), `defects[]` (empty until AD fills)
- sheet-level: `verdict` PENDING until AD KEEP/FAIL; refuse library intake while PENDING (hook or library check stub)

Self-test: `python3 tools/objsheet/selftest.py` exits 0; proves sheet JSON shape; proves PENDING blocks a stub intake; KEEP with empty defects allows; FAIL with defects listed.

Write `steps/tools/05-shotsheet-verdict/REPORT.md`.

<!-- kit-gate: python3 tools/objsheet/selftest.py -->
<!-- kit-gate-outdir: steps/tools/05-shotsheet-verdict -->

Done when: self-tests exit 0; no push/merge.

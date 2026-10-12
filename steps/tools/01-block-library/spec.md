# tools/01-block-library — compact Grok Build spec

Branch `tools/01-block-library` off `zd/01-terrace` @ a0676f9f. Work only in this worktree. Local commits OK. **No push, no merge, no reset --hard, no new Imagine generation.** MoGe-2 + SAM2 only; relief only under its own pixels; native 1024 plates. Key-match score and shape-family auto-fit are OUT OF SCOPE (later).

Order is mandatory. Finish (1) before (2) before (3). After each part: run its self-test, commit, then continue.

---

## (1) tools/library — register KEEP + zone `{library:id}`

Extend existing `tools/library/` (do not invent a parallel tree).

**Register** a KEEP object into `biome/library/` (or the path the README already uses) storing:
- glb LODs (lod0/1/2 paths)
- plates (front/side/… paths, native 1024)
- profile JSON (block builder profile id + path)
- gate report path
- content hash of the registered bytes

CLI must keep `add` / `list` / `check` (exit 0/1/2 as today). `add` refuses FAIL (lock WARN grandfathering stays).

**Resolve:** zone JSON may list `{ "library": "<id>" }` where an asset path would go. Resolver returns the registered paths. Path-string specs keep previous behaviour.

**Self-test:** `python3 tools/library/selftest.py` exits 0. Must cover: register a fixture KEEP → resolve `{library:id}` → `check --id` PASS; refuse a FAIL intake; path-string layout unchanged (`tools/layout/selftest.py` stays green).

Commit: `tools/library: register KEEP + resolve {library:id}`

---

## (2) Contact sheet — one fixed sheet per build

Use / extend `tools/objsheet/` (already present). One fixed sheet per build, views in this order when available:
1. key camera (if known in the step / profile)
2. 45° oblique
3. grazing
4. 8 m approach
5. 3 m up

Each cell: **plate side-by-side with its render** (same framing). Missing key camera → skip that cell, do not invent.

**Self-test:** `python3 tools/objsheet/selftest.py` exits 0; proves sheet layout + plate|render pairing on a tiny fixture (no Imagine).

Commit: `tools/objsheet: fixed contact sheet (key/45/grazing/8m/3m-up)`

---

## (3) Block tool — JSON-profiled builder + tools/gate

### 3a. Generalise `tools/imagine-to-3d/terrace_block.py`
- New entry: `tools/imagine-to-3d/block_builder.py` (or rename + thin terrace wrapper) driven by a **JSON profile** (no hard-coded plate pixel constants in the shared builder).
- Terrace constants (FX0/FY0/SX0/SY0, DOORS, Tiers, AMP, icicle columns, under-cornice offsets, …) move into `tools/imagine-to-3d/profiles/terrace-zd.json` (or `steps/zone-d/01-terrace/profile.json` referenced by the profile).
- Inputs: stepdir + `--profile <path>` + `--lod N`. Outputs stay `work/<name>-lodN.obj/.mtl/.json`.
- Relief: MoGe-2 depth under SAM2 mask only; border-locked silhouette across LODs; UV stretch ≤ 1.3.

### 3b. Fold into `tools/gate/` (new package; call from object-gate adapters if natural)
Move / wrap these into `tools/gate/` with a stable CLI + JSON reports (keep originals as thin wrappers that call the new code so terrace scripts do not break):
- `steps/zone-d/01-terrace/work/grade_feather.py`
- `steps/zone-d/01-terrace/work/clean_streaks.py` + `tools/object-gate/py/ghost_streaks.py`
- icicles (cone roots from plate columns; buried root ring)
- `steps/zone-d/01-terrace/work/repcheck.py` (repetition)
- `steps/zone-d/01-terrace/work/uvmirror.py` (UV mirror)
- `steps/zone-d/01-terrace/work/morph_control.py`

### 3c. Self-tests that FAIL known bad samples
`python3 tools/gate/selftest.py` (and/or `node tools/object-gate/selftest.mjs` rows) must exit 0 and prove:
| Sample | Expect |
|---|---|
| Oct 12 flat tower (`/workspace/grokcli/wt/tower-vision-1010/steps/tower-volumes-1012` flat/pasted-facade evidence, or a synthetic flat-box fixture matching that fail mode) | FAIL flat / no real volume |
| Zone C shredded (`/workspace/grokcli/wt/zc-solids-1012/steps/zone-c/05-solids` noisy depth-displaced mesh, or the triangle-quality self-test fixture that fails aspect/sliver) | FAIL shredded / sliver |
| v3.3 ghost (`tools/object-gate/fixtures/ghost-v33/`) | FAIL ghost streaks |
| Mirrored UV / mirrored-hidden-face synthetic | FAIL uvmirror |

Do not loosen thresholds. Synthetic fixtures OK if labelled and ≤ 200 KB committed; prefer existing samples when readable from this machine.

### 3d. Acceptance — terrace profile reproduces v3.4.x
Run the terrace profile against `steps/zone-d/01-terrace` plates/depths already in-tree (v3.4.1 tip). Compare to v3.4.x gate tolerances:
- LOD0 ≤ 80k tris
- LOD outline 0 px (silhouette match across LODs)
- 0 ghosts
- UV stretch ≤ 1.3
- same bbox (within existing terrace tolerance)

Write `steps/tools/01-block-library/REPORT.md` with the table (`check | measured | expected | PASS/FAIL`) and paths to gate JSON.

<!-- kit-gate: python3 tools/library/selftest.py && python3 tools/objsheet/selftest.py && python3 tools/gate/selftest.py -->
<!-- kit-gate-outdir: steps/tools/01-block-library -->

Commit: `tools: block builder + tools/gate (terrace profile reproduces v3.4.x)`

---

## Done when
- (1)(2)(3) self-tests exit 0
- terrace profile acceptance table all PASS (or honest FAIL rows with exact numbers — do not claim PASS)
- `git diff --stat a0676f9f..HEAD` stays in tools/library, tools/objsheet, tools/imagine-to-3d, tools/gate, tools/object-gate (adapters only), biome/library, steps/tools/01-block-library, and thin wrappers under steps/zone-d/01-terrace/work/
- no Imagine tool call; no push/merge

END: branch, HEAD sha, REPORT path, self-test exit codes, anything Director must decide.

# imagine-to-3d upgrade — integration plan (Grok q16, approved by SmiR 2026-10-09 18:23)

The q16 upgrade is built as **new modules with their own CLIs**. The prototype files (`run.py`, `hull.py`, `fuse.py`,
`depth_relief.py`, `strata.py`, `gen_strata_all.py`, `blender_mesa.py`, …) are copied **unchanged** from the mesa run
(snapshot 2026-10-09 18:35). The mesa worker still owns `run.py`, `strata.py`, `fuse.py`, `depth_relief.py`: the hooks
below get added to `run.py` **after** that worker finishes, in one small PR, so nobody edits the same file twice.

## Stage order (every object, every type)

| # | Stage | Module | In → Out | Gate (hard) |
|---|---|---|---|---|
| 0 | classify | `classify.py` | key crop → `type-profile.json` (type, profile, gate profile, checklist) | margin < 0.15 or creature/vegetation/ice → Grok vision (`--vision grokbuild`) |
| 1 | coarse | `coarse.py` | key crop (+ DA-V2-Small) → scaffold `coarse.npz/.obj` + reference renders per camera | — |
| 2 | views | `views.py plan/requests/accept` + `imagine.py run/ingest` | 8–12 Imagine EDITS (key + one-axis neighbour + coarse render) | IoU ≥ 0.87 vs the scaffold render; side/top = axis-defining (not a copy of the front, plausible depth); native size; 3 attempts |
| 2b | key video (optional) | `keyvideo.py request/analyze` | key → Imagine video → frames → `ideas.yaml` | frames are **never** geometry (`assert_not_video_frame`) |
| 3 | geometry | mesa pipeline: `hull.py` → `fuse.py` → `depth_relief.py` → `strata.py` / Blender | accepted views (`views.py legacy`) → mesh | fuse consistency median < 8 %, p90 < 12 % |
| 4 | sections | `views.py sections` + `imagine.py` | precomputed section cells → full-size Imagine plates | px/m ≥ required (no loop, no resize) |
| 5 | PBR | `pbr.py requests` + `imagine.py` + `pbr.py bake` | each plate → albedo/height/rough/metal plates → map + normal + ORM + `material.json` | native size, map byte-identical, albedo delit, no violet, relight response |
| 6 | QC + package | `qc.py`, `package.py` → **staging** page | — | manifold, stretch ≤ 1.25 |
| 7 | object-gate | `tools/object-gate/hooks/imagine-to-3d.mjs` (PR #191) | staging page → report + fix-plan | every gate row |
| 8 | compare | `compare.py` | matched-angle captures vs key / accepted views | LPIPS ≤ 0.15, SSIM, ΔE2000 ≤ 12, hist, IoU ≥ 0.87, shadow neutral, checklist ≥ 90 % |
| 9 | fix loop | `fixloop.py` | gate fix-plan + compare/pbr/views reports → actions → re-run stage | 3–5 iterations (profile), then HARD FAIL; vision-only → NEEDS_REVIEW |
| 10 | export | live swap / catalogue | — | only gate PASS **and** compare PASS |

## Hooks to add to `run.py` (after the mesa worker is done)

Add one subcommand `python3 run.py full --crop key.png --height-m H --name N --work W --staging S [--type T]`:

```python
# 0 classify (type from the crop unless --type is forced)
sh(PY, f"{HERE}/classify.py", a.crop, "--height-m", str(a.height_m), "--out", f"{W}/type-profile.json")
T = a.type or json.load(open(f"{W}/type-profile.json"))["type"]
# 1 coarse scaffold + reference renders
sh(PY, f"{HERE}/coarse.py", a.crop, "--type", T, "--height-m", str(a.height_m), "--out", f"{W}/coarse")
# 2 views: plan once, then batches until every view is accepted or failed
sh(PY, f"{HERE}/views.py", "plan", "--type", T, "--height-m", str(a.height_m), "--coarse", f"{W}/coarse", "--crop", a.crop, "--out", f"{W}/views")
while (b := views.requests(f"{W}/views/views-plan.json")[0]):
    sh(PY, f"{HERE}/imagine.py", "run", b, "--worktree", IMAGINE_WT, "--wait"); imagine.ingest(b)
    for r in json.load(open(b))["requests"]:
        if os.path.exists(r["out"]): views.accept(f"{W}/views/views-plan.json", r["meta"]["view"], r["out"])
failed = [n for n, s in json.load(open(f"{W}/views/views-state.json")).items() if s["status"] == "failed"]
if failed: fixloop -> refine_depth (coarse refit / fuse) then one more series; still failed -> exit 1
# 3 geometry: the existing v2 stages, fed with ALL accepted views
views.legacy_views_json(f"{W}/views/views-plan.json", f"{W}/views.json")      # {front, side, back, top, extra:{name:{path, camera}}}
main_strata(views=f"{W}/views.json", ...)                                       # unchanged call
# 4 sections at the precomputed px/m, 5 PBR per plate
b = views.section_requests(f"{W}/views/views-plan.json"); imagine run + ingest
for plate in sections: pbr.requests(...) -> imagine run + ingest -> pbr.bake(plate, metres, T, out, albedo, height, rough, metal)
# 6-9 gate + compare + fix loop (the gate's own loop drives fixloop as its --fix-cmd)
node tools/object-gate/hooks/imagine-to-3d.mjs --scene S/scene.yaml --object N \
     --fix-cmd "python3 tools/imagine-to-3d/fixloop.py hook {plan} --state W/fix --type T" --export-cmd "<export>"
python3 compare.py --key <key crop or accepted view> --capture <staging capture, same camera> --type T --out W/compare
python3 fixloop.py plan --compare W/compare/compare-report.json --views W/views/views-state.json --type T --out W/fix/actions.json
```

Exact insertion points in today's `run.py`:
1. `main_strata()` line `sh(PY, f"{HERE}/hull.py", "--plates", a.views, ...)`: `a.views` becomes the output of
   `views.legacy_views_json()` (same keys as today, plus `extra`). hull.py keeps reading front/side/back/top.
2. `fuse.py`: its loop `for view in ("front", "side", "back", "top")` must also iterate `plates["extra"]` with each
   view's `camera` (yaw, elev, distM, vfov) — that is the mesa worker's multi-view DA-V2 fusion, now with 8–12 views.
3. `run_gate()` (legacy v1 path) and the `print("next: runtime gate ...")` line at the end of `main_strata()`: call the
   object-gate hook with `fixloop.py hook {plan}` as `--fix-cmd` (fixloop keeps `fix-history.json`, so the gate's
   repeated rounds escalate along the ladder instead of retrying the same action).
4. After the gate PASS: `compare.py` on matched-angle staging captures; export only on PASS of both.

## Interfaces (stable)

- `classify.classify(crop, mask=None, height_m=None, vision="none") -> dict(type, profile, gate, checklist, ...)`
- `i23d_common.load_profile(type)` — i23d profile merged with `tools/object-gate/profiles/<gate.profile>.yaml`; a profile can only tighten the gate.
- `coarse.build(crop, type, height_m, mask=None) -> (info, V)`, `coarse.refit(dir, mask, cam, out, cams)`, `coarse.rerender(dir, out, cams)`
- `views.plan(profile, height_m, coarse_dir, crop, out, closest=None, vfov=40, cameras=None)`, `views.requests(plan)`, `views.accept(plan, view, image, mask=None)`, `views.section_requests(plan)`, `views.legacy_views_json(plan, out)`
- `imagine.Request(...)`, `imagine.write_batch(reqs, path)`, `imagine.run(batch, worktree, wait)`, `imagine.ingest(batch)`
- `pbr.requests(plate, out, type)`, `pbr.bake(plate, metres_wide, type, out, albedo=None, height=None, rough=None, metal=None)`
- `compare.compare(key, capture, type, out, items=None, records=None, key_mask=None, cap_mask=None)`
- `fixloop.collect(...)`, `fixloop.decide(...)`, `fixloop.run(check, apply, type)`, `fixloop.hook(fix_plan, state_dir, type)`
- `keyvideo.request(key, out)`, `keyvideo.analyze(key, video, out)`

## Known limits (honest)

- Imagine (Grok Build CLI) has no resolution knob: 720×1280 / 1280×720 / 1024×1024 per aspect. "Precomputed
  resolution" therefore fixes the **metres** a plate covers. At 135–180 px/m near the ground band and 64 px/m above it, a
  107 m mesa needs ~480 section plates and a 100 m tower ~230 (`views-plan.json` totals). That is the real cost of the
  quality rule; the plan shows it before any generation.
- `image_edit` takes at most 3 sources: key + one accepted neighbour + coarse render. Older accepted views are not
  passed directly; consistency rides on the one-axis chain plus the scaffold silhouette.
- The coarse scaffold cannot know the depth before a side view exists: side/top views are axis-defining (gated as
  "not a copy of the front + plausible depth") and then refit the scaffold; every other view is gated at IoU ≥ 0.87.
- classify heuristics were tuned on Zone B (sunset light makes hue useless). Creature, vegetation and ice have no
  Zone B examples: they always go to Grok vision.
- compare needs captures from the matched camera (key camera for the key crop, plan camera for each accepted view).
  Use the object-gate adapter `setPose()`; the capture step itself is not in this PR.
- LPIPS weights: torchvision AlexNet (downloaded once to ~/.cache/torch) + lpips 0.1.4 linear layers, CPU.

## 2026-10-10: auto.py runs this whole order

`python3 auto.py run <spec.yaml>` runs these stages and the lessons of 10-09/10 as hard checks: continuous strata,
same-shell LODs + approach-morph, hybrid detail layer, offline R8 grading, full-pixel-ratio perf budget, object-gate
zero FAIL. See `docs/METHOD/imagine-to-3d-auto.md` and `selftest/RESULTS-auto.md`. The `run.py full` hook above becomes
`auto.py`; `run.py` itself is still not edited (mesa worker).

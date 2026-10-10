# SPEC ZB-TOWER-RELIEF-1010 — Zone B tower facades in REAL 3D relief, through the Imagine-to-3D AUTO tool (staging only)

Owner: SmiR (2026-10-10, Paris). Supervisor: Grok Bot executor. You are the Grok Build worker.
This worktree is main at 8304198 (#191 object gate, #192 q16 modules, #193 `tools/imagine-to-3d/auto.py` +
`docs/METHOD/imagine-to-3d-auto.md`). SmiR's rule: use OUR full, updated tool with everything learned today.

## Why
SmiR's phone (v58, screenshot `/home/box/agent-data/agents/8f3c3da7-07a3-4f42-9f98-70ae0ef07993/attachments/076adfbfe4232df859c8a3fd72d8ddefc49d3b3cc21916453e81f7c5f95d2adf.jpg`):
the tower facades still read FLAT — a patchwork of grey rectangles pasted on a slab, no depth — while the mesas have
true volume. Current fins/cornices/bays (relief_damage_d2.py, CORRECTIONS #32) are too shallow/sparse to read, and the
plate section grid (R8 pool) does not line up with any geometry, so the cells read as a quilt.
Goal: every tower facade gets real, deep, readable 3D relief whose geometry matches the Imagine plate pixels, so at
close, 8 m, 30 m and low angle the towers read like key-city3: black graphite slabs with silver edges, deep window bays,
slab edges, ribs, damage in the volume.

## HOW — the tool, not ad-hoc scripts (mandatory)
1. Read `docs/METHOD/imagine-to-3d-auto.md`, `docs/METHOD/imagine-to-3d.md`, `docs/METHOD/objects-from-key-crops.md`,
   `docs/METHOD/object-quality-gate.md`, `docs/METHOD/hard-objects.md`, `docs/METHOD/ruins.md`,
   `tools/imagine-to-3d/README.md`, `INTEGRATION.md`, `GATE-HOOK.md`, `tools/object-gate/README.md` + `API.md`.
2. Drive the work with `tools/imagine-to-3d/auto.py` and a building/tower spec:
   write `tools/imagine-to-3d/specs/zoneb-tower-relief.yaml` (type building, profile `profiles/building.yaml`; one
   object per module m2/m3/m4/m6 or one spec per module — your call; reuse the existing plates/section cells as
   `imagine:` inputs, see `specs/zoneb-tower-sections.yaml` and `specs/zoneb-mesa-build.yaml`), `work:` under
   `/workspace/i23d-auto/zoneb-tower-relief/`, `staging:` = `/workspace/zb-preview-1008/objects1-t8/`,
   `stagingUrl:` = `http://127.0.0.1:8996/index-t8.html`. Run `python3 auto.py plan …` then `python3 auto.py run …`
   (use `--no-browser` while iterating on the busy box; `--from <stage>` to resume). Its `gate` stage = the #191
   object gate; its fix loop = `fixloop.py`.
3. SAME METHOD AS THE MESAS (SmiR 11:10, mandatory). The facade relief uses the exact mesa pipeline: Depth Anything V2
   (the "small AI") reads depth from EACH Imagine plate at native res, and that depth carves / displaces the REAL mesh.
   Study first: `tools/imagine-to-3d/depth_relief.py` (stage depth_relief: per-plate DA-V2, band-pass, per-plate p99
   normalisation, amplitude clamp, gradient limit so stretch stays ≤ 1.25-1.3, spike check), `fuse.py`, `coarse.py`,
   `strata2.py` (continuous surfaces, plate windows joint-to-joint, displacement along the face normal, welded
   watertight, per-triangle cap classification), `/workspace/mesa-1009/depth-v11/`, and the relief entries in
   `/workspace/zb-preview-1008-tools/PROGRESS-mesas.md` (18:02-18:57, 06:44-08:18 lessons: no independent boxes, no
   hard seams, relief continuous across joints).
   For towers, add HARD-SURFACE rules on top of the same depth: QUANTISE the plate depth into a few flat planes and
   steps (e.g. facade plane / slab-cornice plane +0.25..0.8 / rib-mullion plane +0.15..0.6 / bay floor -0.3..-1.2 /
   torn-hole through), snap step boundaries to the plate's dominant horizontal and vertical lines (Hough/projection
   of the depth gradient and luma edges) so windows, slabs and ribs get CRISP right-angle edges with vertical side walls,
   not blobby rock. Planes stay planar (no noise inside a plane), steps are vertical walls, chrome frames go on the step
   edges. Damage (sheared tops, holes, torn floors, missing chunks, beams) stays in the volume.
   Wire it into the tool as the BUILDING PROFILE of the SAME depth-relief module the mesas use — NOT a separate system:
   extend `depth_relief.py` (and the geometry stage / generator it feeds) with a `mode: hard-surface` / quantise branch
   selected by `profiles/building.yaml` (planes, step depths, snap tolerance, min feature size, chrome-frame width,
   damage kinds), so `auto.py run` on any `type: building` spec gets it automatically and mesas keep their current path
   unchanged (rock profile untouched; the mesa selftests must still pass).
   Also: plate assignment aligned to the relief grid (plate cell boundaries on real step edges), native size, stretch
   ≤ 1.25; a check row (tool + object-gate geometry row if missing) measuring facade relief depth/coverage and edge
   crispness so a flat or blobby facade FAILs automatically; selftest entries in `tools/imagine-to-3d/selftest/`; docs:
   update `docs/METHOD/imagine-to-3d-auto.md` (stage table + lesson "building facades = mesa depth relief, quantised to
   hard planes") and the tool README.
   The old Blender scripts in `/workspace/zb-bible-1008/objects1-redo/blender/` are reference only (base shells, damage
   code to port). WARNING: relief_damage_d2.py has `OUT = /workspace/zb-preview-1008/objects1` (LIVE) — never run it as is.
4. Commit locally in this worktree (small commits on a new branch `cursor/tower-facade-relief-36f5`); never push or merge.
   The supervisor opens the PR.

## Inputs (read, never modify)
- Live preview (served by the 8996 server, public via https://planner-depth-mysterious-sending.trycloudflare.com):
  `/workspace/zb-preview-1008/`. `index.html` → `main.mjs?v=58` → `objects-t7.mjs` (TEX7: merged LOD0 draws, R8 section
  pool of native Imagine 1024² plates at 85/142 px/m, 512 px/m detail layer `objects1/tex/detail-hp.png`),
  `facade-sections-t7.mjs`, GLBs `objects1/{m2,m3,m4,m6,spire}/*.glb`, textures `objects1/tex/` (sec6 atlases).
- Key image `/workspace/zb-bible-1008/key-city3.jpg`; key crops `/workspace/zb-bible-1008/objects1-redo/crops/`.
- Tower mistakes so far: `/workspace/zb-preview-1008-tools/CORRECTIONS-zoneb-towers.md` (read; do not repeat them).
- DA-V2 small ONNX `/workspace/grokcli/models/depth_anything_v2_small.onnx` (CPU). Blender `/home/box/.local/bin/blender`.
- Capture example `/workspace/zb-preview-1008-tools/stage-poses.mjs` (Playwright at /workspace/playtest/node_modules).

## Write ONLY here
- This worktree (tool code, spec yaml, docs, selftests, gate rows).
- Staging in the preview dir: `index-t8.html` (copy of index.html loading `main-t8.mjs`), `main-t8.mjs` (copy of main.mjs
  importing `objects-t8-stage.mjs`; every other line identical incl. sky/mesa/air hooks), `objects-t8-stage.mjs`
  (+ `facade-sections-t8-stage.mjs` if needed), `objects1-t8/` (new GLBs, atlases, LUTs; add the staging marker the
  tool's `stage` step requires).
- `/workspace/i23d-auto/zoneb-tower-relief/` (tool work dir) and `/workspace/zb-tower-relief-1010/` (scratch, captures).
- Notes: `/workspace/zb-preview-1008-tools/PROGRESS-tower-relief.md` (append per milestone, times Europe/Paris).

NEVER modify, move, rename or delete any file the live page loads: `index.html`, `main.mjs`, `objects-t7.mjs`,
`facade-sections-t7.mjs`, anything under `objects1/`, `mesas/`, `sky1/`, `air.mjs`, `runtime/`. Another job may bump live
to v59 while you work — expected; ignore it. Never kill the 8996 server or cloudflared. Never swap staging into live.
No new Imagine calls: if the tool says NEEDS_IMAGINE, keep its request batch, note it in PROGRESS and continue with
what exists (or stop if blocked).

## Geometry targets (per facade)
- recessed window bays 0.3–1.2 m deep (real inset faces with side walls, sills, lintels that catch sun and shadow);
- protruding floor slabs / cornices every floor band (0.25–0.8 m proud, sand on top faces where shown);
- vertical ribs and mullions (0.15–0.6 m proud); balcony / ledge depth where the plates show them;
- chrome panel frames (silver edges, metal) on bay frames and corners;
- damage in the volume kept and consistent with the relief: bevel-cut/sheared tops, through-holes, torn floors with
  exposed slab edges, missing chunks, protruding beams.
- Geometry placed from plate depth/masks (dark window in the plate = recess). Outer bbox/ratios stay inside the current
  gate rows (relief mostly INTO the volume). Welded, 0 non-manifold, no floating islands, parts clipped to sheared tops.
- Silhouette identical at every distance (same shell at every LOD, relief as attribute/same outline; approach-morph passes).
- Shadows world-fixed, dark, neutral. Every pixel Imagine (no hand-set surface colours); plates native, stretch ≤ 1.25,
  px/m ≥ 85 (≥ 142 low band) + 512 px/m detail layer kept.
- Phone budget at full pixel ratio: draw calls ≤ 12 for the tower set (merged LOD0), texture GPU ≤ 64 MiB, the tool's
  perf stage PASS; report triangles and `renderer.info`.

## Deliverables
- Staging page `https://planner-depth-mysterious-sending.trycloudflare.com/index-t8.html`.
- Captures portrait 540×1200 in `/workspace/zb-tower-relief-1010/caps/`: close (2–3 m off a sunlit facade), 8 m, 30 m,
  low-angle (looking up a tower from its foot, like SmiR's screenshot), avenue/hero; sheet `tower-relief-sheet.jpg`
  (rows = pose; columns = live v58 | staging t8 | key crop).
- `auto.py run` REPORT.md with no FAIL/ERROR (MANUAL rows listed are OK: swap, phone fps, checklist records).
- 0 FAIL on: `node tools/object-gate/cli.mjs --scene tools/object-gate/specs/zone-b/scene.yaml --url http://127.0.0.1:8996/index-t8.html`
  (OG_PLAYWRIGHT=/workspace/playtest/node_modules/playwright/index.mjs) and on
  `node /workspace/zb-preview-1008-tools/preview-gate.mjs "http://127.0.0.1:8996/index-t8.html?v=t8"` (if it hard-codes
  live module names, use a COPY in /workspace/zb-tower-relief-1010/ pointed at the staging modules; never edit the original).
- PROGRESS-tower-relief.md: what was built, numbers (relief depths, tris, draws, MiB, px/m, stretch), gate summaries,
  capture paths, tool changes (files + commits), what is left.

## Box etiquette
Shared, loaded box (mesa executor + ground/fps executor running). `nice -n 10` for heavy jobs, one Blender / one browser
at a time, no parallel gate runs, SwiftShader timeouts generous (goto 240 s, ready 300 s). Don't kill processes you didn't start.

End with a short summary: files changed, commits, checks run with PASS/FAIL counts, staging URL, what is left. Then STOP.

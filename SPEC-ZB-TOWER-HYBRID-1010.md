# SPEC ZB-TOWER-HYBRID-1010 — ONE complete Zone B tower, combined recipe (key projection far + Imagine plates near + real trim geometry). Staging only.

Owner: SmiR (approved 2026-10-10 18:52 Paris). Supervisor: Grok Bot executor. You are the Grok Build worker.
Worktree = branch `cursor/tower-hybrid-1010-36f5` at 25de1eb (object-gate atlas fix + hard-surface building profile from the
relief pass). Commit locally in small commits; never push, merge or reset --hard.

## One goal
Build ONE tower — the key's tall centre-left tower ("hero tower", key-city3 px x≈413-545, y≈42-440) — that looks like the key
from the hero camera AND stays sharp and coherent from 300 m down to 2 m, from every side. Nothing else (other towers, mesas,
spire, sky) is in scope; do not touch them.

## Why (read, do not redo)
- Grok Build relief pass (25de1eb, `/workspace/zb-preview-1008-tools/PROGRESS-tower-relief.md`): real 3D, no morph, perf OK,
  but FAILS the key checklist: repeating panel quilt, no wedge, no ladder cage, no chrome strips.
- Projection prototype `/workspace/proj-1010/` (PROGRESS.md, build_proxy.py, out/metrics.json, sheet.jpg, staging
  `/workspace/kc-staging/zb-projB/index-proj.html` + `proj.mjs` on :8982): key projected on a DA-V2 proxy that replaces t2-m3
  (moved 13.5 m back), solved camera-v2 (`/workspace/proj-1010/keycam.json`; x-51.115 z9.63 yaw78 pitch8.84 eye18.15 fov80),
  t0-m2 removed. From the key camera IoU 0.83, ΔE 4.6 (vs 0.20 / 34.1 for current). But: 1 key px ≈ 35 cm of facade → blurry
  at 8 m; wavy depth mesh from the side; baked sunset light does not react to the game sun; ladder/chrome/cables read painted.
- Grok q21 answer `/workspace/arch-research-1008/q21-answer.md` (hybrid projection + Imagine fills + explicit thin geometry).

## Recipe (all mandatory)
1. **Volume from the key.** Outline/silhouette from the key mask (prototype `out/mask.png`, refine if needed) extruded along
   the key rays into a WEDGE/blade volume (the key tower is a tapered blade, not a box). Facade faces are PLANAR (a few flat
   planes; depth map used only for each plane's placement and tilt — no wavy per-pixel depth mesh). Width/depth plausible from
   the side (no paper-thin slab: depth ≥ 0.45 × width at base). Sheared/damaged top kept in the volume. Base grounded: sunk
   ≥ 2 m, and the 14 m strip below the tower in the key view is covered (raise the dune locally or extend the base so no gap
   or floating edge from any pose). Watertight, 0 non-manifold, no floating islands.
2. **Imagine views, conditioned on the key crop** (image_edit with the key crop as source, + the full key as light/material
   reference): same dusk light, same graphite/silver materials, same tower. Native output size, never upscaled, never
   stretched; record measured W×H. Set: left flank, right flank, back, top/damage, 1–2 sharp close facade plates
   (graphite panels, silver edges, sand on lower ledges). **HARD CAP: 6 Imagine images total for this step, counting failed or
   rejected ones.** Before each call, write the prompt + sources to `/workspace/zb-tower-hybrid-1010/imagine/log.md`; after,
   the output path, size, ACCEPT/REJECT and why. If you need more than 6, STOP generating, write
   `/workspace/zb-tower-hybrid-1010/imagine/imagine-requests.json` (NEEDS_APPROVAL) and continue with what you have.
   Check each view with the silhouette gate / consistency (`/workspace/kc-wt/tools/imagine-to-3d/consistency.py`, palette
   grade allowed: `palette.py grade`, no painting). Every pixel comes from Imagine or the key.
3. **Projection + hybrid fade.** Key projected (from the solved camera) ONLY on faces that face the key camera (facing angle
   ≤ ~60°), used beyond ~40 m. Closer, crossfade by distance to the sharp Imagine plates + the 512 px/m detail layer
   (`objects1/tex/detail-hp.png` style, Imagine-derived). Flanks/back/top use the Imagine views from step 2 at all distances.
   Fade is smooth by distance and per pixel (no pop, no morph, geometry never changes with distance; only texture weights).
   The near plates must be registered to the key projection (same panel lines, ladder position, damage) so the fade does not
   swap one tower for another.
4. **Real trim geometry**: ladder cage (rails + rungs + hoops, real thin geometry), chrome/silver edge strips along the blade
   edges and floor bands, a few hanging cables where the key shows them — textured with Imagine trim crops (from the key or
   your step-2 images). Cheap: instanced or merged, ≤ 2 extra draw calls.
5. **Lit material.** MeshStandardMaterial-compatible (or the existing objects shader hooks) lit by the game sun: projected key
   colour is used as albedo/tint after removing the baked light by a smooth low-frequency luminance division (so the game
   sun relights it), the Imagine plates the same way, so the seam between projected and lit plates does not show under the
   game light. Shadows world-fixed, dark and NEUTRAL (no violet). Casts on sand, receives from neighbours.

## Tools to reuse (read first; extend, do not fork)
`GROK.md`, `docs/METHOD/imagine-to-3d-auto.md`, `docs/METHOD/objects-from-key-crops.md`, `docs/METHOD/object-quality-gate.md`,
`docs/METHOD/hard-objects.md`, `tools/imagine-to-3d/README.md` (this worktree);
key-compare / projection / staging tools (read-only, from `/workspace/kc-wt`, branch cursor/key-compare-gate):
`docs/METHOD/key-compare-and-consistency.md`, `tools/imagine-to-3d/{kc_stage.py,proj.py,depth_relief.py,palette.py,consistency.py,
compare.py,placement_v2.py}`, `tools/object-gate/key-compare.mjs`. Import them by path like `/workspace/proj-1010/build_proxy.py`
does; if you change one, copy it into THIS worktree and commit it here. Prototype scripts in `/workspace/proj-1010/`
(build_proxy.py, stage.py, capture.py, pshots.mjs, metrics.py, sheet.py) are your starting point — copy into
`tools/imagine-to-3d/hybrid/` (or similar) in this worktree and generalise. Key `/workspace/zb-bible-1008/key-city3.jpg`,
crops `/workspace/zb-bible-1008/objects1-redo/crops/`. DA-V2 `/workspace/grokcli/models/depth_anything_v2_small.onnx`.
Blender `/home/box/.local/bin/blender`. Playwright `/workspace/playtest/node_modules`.
Tower mistakes so far: `/workspace/zb-preview-1008-tools/CORRECTIONS-zoneb-towers.md` (do not repeat).

## Staging (write ONLY here)
- Staging dir `/workspace/kc-staging/zb-tower1/`: build it like `/workspace/proj-1010/stage.py` (kc_stage.build from live
  `/workspace/zb-preview-1008` with layout-v2, drop t0-m2 and t2-m3, add the hero tower in the prototype's slot). Page
  `index-tower1.html` (based on the CURRENT live v62 page: main.mjs?v=62 path, internal 1.5 + EASU/RCAS — do not use the old
  main-t8 base), your module(s) and assets in that dir. It is public at
  `https://planner-depth-mysterious-sending.trycloudflare.com/tower1-1010/index-tower1.html` through the symlink
  `/workspace/zb-preview-1008/tower1-1010 -> /workspace/kc-staging/zb-tower1` (the supervisor created it; local
  `http://127.0.0.1:8996/tower1-1010/index-tower1.html`). Add a debug URL flag that shows the projection weight (like proj B-w).
- Scratch / captures / sheet: `/workspace/zb-tower-hybrid-1010/`. Progress notes (append per milestone, Paris time):
  `/workspace/zb-preview-1008-tools/PROGRESS-tower-hybrid.md`.
- NEVER modify, move, rename or delete live files in `/workspace/zb-preview-1008/` (index.html, main.mjs, objects-*.mjs,
  objects1/, mesas/, sky1/, air.mjs, runtime/ …), nor `/workspace/kc-staging/zb*` dirs other than `zb-tower1`, nor
  `/workspace/proj-1010/`, nor `/workspace/kc-wt/`. Never kill the 8996 server (pid 14523), 8981/8982/8997 servers or
  cloudflared. Never swap into live.

## Done-when (≤ 8 rows; write `/workspace/zb-tower-hybrid-1010/REPORT.md` as each is measured)
1. **Imagine**: ≤ 6 images used, log complete, each native size, ACCEPT/REJECT with reason.
2. **Key-compare from the hero camera** (camera-v2, the prototype's `metrics.py` method and rect 398,27,561,446, plus
   `key-compare.mjs` tower row if it runs): IoU ≥ 0.87, ΔE (tower) ≤ 5, and better than the prototype B (IoU 0.83, ΔE 4.63).
3. **object-gate 0 FAIL** for this tower (write a `tools/object-gate/specs/zone-b/tower-hero.yaml` from tower-m2.yaml) incl.
   the key checklist (wedge, ladder cage, chrome strips, damage, sand on lower part) — records written ONLY after you actually
   look at the frames; be honest, `pass:false` if not visible.
4. **Approach-morph** 300 m → 2 m (lod-morph gate / object-gate morph): no silhouette jump, no texture pop (also measure frame
   to frame luminance jump in the fade band 30–50 m; max per-step mean ΔE ≤ 2).
5. **Resolution**: native px/m and UV stretch ≤ 1.3 on every visible face at 8 m; near plates ≥ the relief pass (≥ 154 px/m
   visible) + 512 px/m detail layer; no repetition/quilt (autocorrelation / pHash check of the near facade, no visible
   tile repeat within 30 m of facade).
6. **Phone perf (v62 mode B path)**: the tower adds ≤ 3 draw calls and ≤ 16 MiB texture GPU, ≤ 60k triangles; total scene
   draw calls/texture GPU within the tool perf stage limits (`auto.py --stages perf` or the same measurements).
7. **Sheet** `/workspace/zb-tower-hybrid-1010/sheet.jpg`, phone readable: columns key crop | hero view (key cam) | 30 m |
   8 m | low side angle (~65° off axis, from the foot looking up) — for the NEW tower, with the prototype B row beneath for
   comparison; plus portrait 540×1200 captures of the same poses in `caps/`. LOOK at it and write what you see.
8. **Summary** in REPORT.md: gate numbers, Imagine images used (paths + sizes), weak points (honest), commits.
Stop rule: the same defect failing twice after a real fix attempt → stop working on it, record it as an honest gap, move on.
Do not end with a gate painted green.

## Box etiquette
Shared box. `nice -n 10` heavy jobs, one Blender / one browser at a time, SwiftShader timeouts generous (goto 240 s, ready
300 s). Don't kill processes you didn't start. Keep the session efficient (this runs on SmiR's credit): no repeated full
gate runs when a targeted one answers the question.

End with the summary (files, commits, checks with numbers, staging URL, Imagine count, what is left), then STOP.

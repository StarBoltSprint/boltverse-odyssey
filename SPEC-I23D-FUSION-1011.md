# SPEC I23D-FUSION-1011 — FUSION test on ONE facade (key-facing front of the vision tower), PHASE 1 (staging only)

Owner: SmiR (go 2026-10-11 07:33 Paris). Supervisor: Grok Bot executor. You are the Grok Build worker and "Grok vision".
Worktree `/workspace/grokcli/wt/tower-vision-1010`, branch `cursor/i23d-vision-stage-36f5` (head cba9ab00). Commit locally; never push/merge.
Previous state: `/workspace/zb-tower-vision-1010/REPORT.md` (read it first, sections 2, 3, 8). Alignment stopped at hero 0.14 / 8 m 0.36
because relief was "87 depth runs per 2 m band", not the painted edges; no SAM2 (feature boxes only); key crop is only 163×419 px.
Start a wall clock (Paris) in progress; time every stage. Lean: SmiR's credit, one targeted re-run, no gold-plating.

## Scope
ONLY the key-facing front facade of the vision tower. Other faces stay as they are (do not spend on them). Build through the
imagine-to-3d stages (`auto.py`, `vision.py`, `vision_mesh.py`, existing modules) — no one-off hand code for the deliverable.

## Recipe
1. **Base volume** = the Grok vision geometry already built (silhouette IoU 0.98 round 1 / massing). Keep it.
2. **Pixels**: key projection from camera-v2 (`/workspace/proj-1010/keycam.json`) for far and mid range; ONE sharp Imagine near plate of
   that same facade for close range (crossfade ~40 m → ~15 m, per-texel, feathered). PHASE 1: the near plate does NOT exist yet.
   Write `imagine-requests.json` in the tool work dir AND copy it to `/workspace/zb-tower-fusion-1011/imagine-requests.json`: at most 2
   requests, status NEEDS_APPROVAL, each with: mode (image_edit), exact prompt, input image paths (rectified key crop of the front facade
   as the edit source; full key as light/material reference), target aspect/size, which facade region (metres) it covers, how it will be
   registered (homography to the rectified key crop, accept if luma NCC ≥ 0.85 vs the upscaled key region), and the reject rule. The
   prompt must ask to sharpen/re-render THIS facade front-on, same window grid, same damage, same colours, no new elements. Do NOT
   generate any image yourself. Wire the stage so that dropping the file at the declared path later and re-running finishes phase 2.
3. **Relief ONLY from the exact image painted on that face**, all in the SAME UV space as the painted texture:
   a. Rectify the face image (homography; record it). Analysis may upscale; the texture never does.
   b. Segments: SAM2 on CPU if installable in ≤ 10 min into a venv under /workspace (nice); else the best available CPU segmenter
      (SAM v1 ViT-B ONNX, rembg/BiRefNet, or SLIC/watershed on the edge map). Log which one and why.
   c. YOU label the SEGMENT IDs (numbered overlay + grid + DA + edge map tiles, Q25 prompt/schema in
      `/workspace/arch-research-1008/q25-answer.md`) with type (window, mullion/frame, panel, hole, damage, rib, ladder, chrome…),
      depth_cm vs the facade plane (negative = inward), depth order, confidence. Save in `vision/tower.json` (`segments`).
   d. Depth Anything (DA-V2 `/workspace/grokcli/models/depth_anything_v2_small.onnx`) on that SAME image, used ONLY inside each segment
      for fine relief (normalised per segment, small amplitude), on top of the per-segment depth_cm step. Crisp steps at segment borders.
   e. NO hard_surface grid / bay_of / seeded plate shuffle, NO invented or procedural elements (anything built cites a segment ID).
   f. Fix the V flip for real: an asymmetric marker test in the selftest, AND the alignment views below prove it.
4. **Grounding** (no float from 4 low poses), **shadow visible** (the gate's shadow probe; if the probe still reads 0, show a capture
   of the cast shadow and explain), **no repetition** (autocorrelation row PASS on that face).

## Gates (phase 1)
- **Relief/texture edge alignment ≥ 0.7, BLOCKING**, on the front face: relief-only render (normal/AO, neutral grey, raking light) vs
  texture-only (unlit albedo), same cameras: hero (camera-v2), 30 m, 8 m, raking 3/4. Report BOTH precisions and the F-score per view;
  save the edge overlays. Also an ortho UV-space version (relief edge map vs painted edge map in the face's UV) — this one isolates V flip.
- object-gate rows for that facade (relief ≥ 0.3 m, crispness, grounding, shadow, repetition, UV stretch, filtering, alignment), the
  approach-morph test. px/m at 8 m: report the current number, mark "phase 2 (needs the near plate)".
- Stop rule: same defect failing twice after a real fix → stop, record honestly.

## Deliverables (phase 1) → `/workspace/zb-tower-fusion-1011/`
- `REPORT.md`: segmenter used, segment count and labels summary, alignment table per view (P_relief→tex, P_tex→relief, F), object-gate rows,
  morph, grounding, shadow, timing per stage and end to end, credit note, what phase 2 needs.
- `sheet-phone.jpg`: phone-size (540×1200 portrait) captures of the front face: 8 m, 30 m, raking-light view (sun grazing the facade so
  relief shows), each as a pair textured / relief-only, plus the key crop and the UV edge overlay. LOOK at it and write in REPORT.md whether
  the relief sits under the pixels.
- Staging page `/workspace/kc-staging/zb-tower3/index-fusion.html` (same dir as tower3, title "Zone B — aperçu"), public
  `https://planner-depth-mysterious-sending.trycloudflare.com/tower3-1010/index-fusion.html`. Progress: `/workspace/zb-preview-1008-tools/PROGRESS-tower-fusion.md`.

## Write ONLY here
This worktree; `/workspace/i23d-auto/zoneb-tower-vision/`; `/workspace/zb-tower-fusion-1011/`; `/workspace/kc-staging/zb-tower3/`; venvs under /workspace.
READ ONLY: `/workspace/i23d-auto/zoneb-tower-hero/` (its `imagine/in/` views may be used as references), `/workspace/grokcli/wt/tower-project-1010`,
live `/workspace/zb-preview-1008/`, other staging dirs, `/workspace/proj-1010`. Never kill 8996/8981/8982/8997/cloudflared or processes you did not start.
`nice -n 10`, one Blender / one browser at a time. End with the summary, then STOP (phase 2 waits for the near plate).

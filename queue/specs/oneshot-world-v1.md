# oneshot-world-v1: `bolt oneshot <key-image>`

Goal: one command from key image to playable world, timed against the 8 min (480 s) target. A world is **done** only when the play-build gate passes AND Art Director's KEEP is recorded (`t_keep`).

Tool: `tools/oneshot/oneshot.py run <target> --out <dir> [--approved-plates] [--counter out/progress-counter.json]`; `oneshot.py keep <run.json> --counter ...` records t_keep.

## Stage statuses
PASS / FAIL / STOP (approval point) / BLOCKED (input missing) / SKIPPED (after a hard stop) / ADOPTED (existing validated artifact reused, not re-run; never counts as PASS) / NOT_IMPLEMENTED (stub; must never fake a pass). Pieces count in the % only when their own tests pass.

## Stages (in order, each timed)
1. reader_spec_sheet
2. imagine_hook - stub; Imagine via Grok Build's built-in Imagine only, never the API; generates nothing
3. plates
4. plate_gate - sky + plate checks from `learn/proposals/plate-precheck.json` (stub until it exists)
5. plate_contact_sheet - JPG for Art Director; sets t_plates_sheet
6. plates_approval - **STOP** until `plates.approved` flag file or `--approved-plates`
7. depth_moge2 (MoGe-2 only), 8. segmentation_sam2 (SAM2 only), 9. mesh_build
10. lod_generation, 11. lod_outline_15_40m (0 px outline diff at 15 m and 40 m)
12. budget_gate - reads `zone-d-perfbudget.v1.json`: visible tris 600k typical / 850k peak, ground <= 150k, each object LOD0 vs own budget, draw calls 150 / 200 peak, textures 384 MB total, UV stretch <= 1.3
13. packing - meshopt with UV >= 14 bit, sky KTX2 reusing the existing star-preserving mip 1 (`ktx2-final5-mip1-star`, no regen), LOD2 loaded first
14. object_gates, 15. ticket_validate (tools/build-ticket on a copy; real ticket never edited)
16. zone_json_world_graph
17. spine_from_key - spine.json v1.2, xy filled, a point every 5 m, grade <= 14 %, pitch blended over 10 m at each beat change
18. colliders_fit - fitted to meshes, 2 cm inset, no collider face > 5 cm outside visible geometry, door plane flush with door back face
19. placement_gate - every object at 0 m from ground, >= 2.5 m clear lane along the spine
20. colliders_never_drawn
21. play_build - page reads camera (4.5 m back, 2.6 m up, 48 deg, pitch per point) and route from spine.json
22. play_build_gate (no-grey per region, undeclared nodes, unexpected transparency, camera == spine, sky checks)
23. bench - `&bench=1`, result line saved
24. first_frame - t_first_frame
25. scripted_walk - spine at sprint speed; FAIL on LOD pop > 0 px, off-spine > 5 cm while input held, pitch change > 1 deg between frames; frame-time log during LOD swaps; timecoded events + a short JPG clip-strip per event
26. final_contact_sheet - from the play build, spine camera: each object at 45 deg, grazing, 8 m, 3 m + sky frames (s=375, 520, ~800, S00/S11 seam) + door threshold; sets t_sheet_ready

## Timer / counter
Run JSON `oneshot.run.v1`: per-stage `s`, `total_s`, `timer{t_plates_sheet,t_first_frame,t_sheet_ready,t_keep}`. Each run appends to `out/progress-counter.json` (the 49 % meter in wt/tools-14-progress-meter is untracked; counter starts at 49 % with that source noted).

## Required tests
- selftest.py: stop at plate approval, flag passes it, stubs never PASS, missing input blocks, spine must-fail fixture, t_keep record, counter append.
- **Must-fail:** terrace walk must FAIL at the door and both wall ends. OPEN until scripted_walk exists.

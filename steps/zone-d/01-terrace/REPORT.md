# Zone D 01-terrace: temple terrace block v1 (build test). Verdict: FAIL (gates). Not for SmiR.
Plates (1 Grok Build step, 3 Imagine image_edit calls from the key-B crop + key B): plates/plate-front.jpg (= left45.jpg, came out as a straight front elevation),
plates/plate-side.jpg (= front.jpg, came out as a left side profile), plates/side.jpg REJECTED (2-tier, a different object). The key-B crop is only about 310x260 px, so it is a style reference, not a front plate.
Build: tools/imagine-to-3d/terrace_block.py (SAM2-base masks, MoGe-2 depth; not hull.py, because hull.py is the organic mesa heightfield and cannot make recesses or overhangs).
LOD tris 64474 / 19940 / 7718. Grounded at y=0. Doors 1.5 m deep (MoGe reads the black voids as 4.1-5.8 m deep with no visible back wall, so they are clamped to the bible's 1.5 m). Cornice 1.0 m front / 0.6 m sides, 0.35 m lip.
Gates LOD0: work/gates-lod0.json. Self-tests: selftest/*.json. LOD silhouette IoU: work/lod-silhouette-iou.json.

## v2 (2026-10-12 ~11:15 Paris). View gates: PASS. Existing object-gate: NOT RUN. Still waiting on Art Director KEEP.
4th (last) plate: plates/top.jpg. It came out oblique from above, not a true top-down view.
Tops come from top.jpg (they are seen at most from above, never from the path). Undersides use the front plate's shadowed-basalt rows under each cornice (door columns shifted onto the next basalt); no tile is used.
Door returns now use the facade pixels next to each door. Side plate rows are remapped per tier, the wall relief is slope-limited, and the icicle UVs are unwrapped.
UV stretch is now measured as anisotropy σmax/σmin (it was max(σ, 1/σ) in v1). LOD switches at 15 m and 40 m, checked by tools/object-gate/py/lod_gate.py.
Dimensions are unchanged from v1. The triangle count changed from the added faces: 69016 / 21732 / 8642.

## v3 (2026-10-12 ~11:45 Paris). FAIL: texel density at 8 m/3 m, plus the existing object-gate (sealed mesh, approach morph, relief, framing, checklist, title)
131 icicle cones placed from plate drip streaks (113 raised to the 0.3 m minimum). 6 radial segments in every LOD. Texel-density gate added (v2 self-test FAILs).
Preview harness: /workspace/zd-preview-1012 (served on 127.0.0.1:8971), adapter tools/object-gate/adapters/zd-preview-1012.mjs, specs/zone-d.

## v3.1 (no new plates)
- Sealed: builder caps (tier-1 bottom with door hole, holed cornice tops = upper door floors, arc-profiled cornice ends, capped cone bases), winding pass; weld_export.py. object-gate "mesh sealed" PASS: 0 open / 0 non-manifold on all LODs; 0 inconsistent edges, signed volume +2942 m³. Page now FrontSide.
- Title: "Zone D — terrace block" (row passes). Fog removed from the preview (it was invented).
- Approach morph: still FAIL with fog off (identical numbers) -> fog not the cause. work/morph_control.py replays the gate path on a rigid plain box of the same AABB: it FAILS the same rule (jumps 285, 244, 210, 113, 102 m; 228-401 px silhouettes in a 135x240 mask). Pixel quantisation of the gate, not a shape change; LOD swap is at 15/40 m.
- Framing: gate-owned (common/frame_bbox.py fits AABB corners); stepped block fills 13.6/8.5/22.7 %. Not changed (shared tool).
- Sky: key-B crop x0-430,y0-270 only (no Frostspire); fills alpha-0 of a lit+ground transparent render (work/sky_composite.py).
- Tier 3: stubs <0.3 m dropped; clearance 2.643 m (front), 2.987 m (left) over tier-2 top 10.21 m. Only 2 tier-3 icicles remain.
- Repetition under cornice: now FAIL 0.677 (v3 0.421 measured wrongly-oriented faces; the face-normal selection is correct only after the winding fix).

## v3.2
- 3 Imagine plates (plates/v32, low effort, refs key B + key crop + plate-front). Only t1-right (frontal centre door) projected; t1-centre (oblique corner) and t1-left (whole block) did not match their standpoints, unused. Colour: plates/v32/colour-compare.png.
- Tier-1 front centre panel (x -6.07..4.23 m) at 98.2 px/m from t1-right; door widened to the plate's 2.50 m; 42 cones from its drips (16 raised).
- Jamb Rorschach root cause: negative u scale on the jamb island (608/608 mirrored) + GLB sampler had no wrap (= REPEAT). Fixed: translated strip, 0 mirrored; CLAMP_TO_EDGE in GLB and page.
- Side relief from side-plate MoGe-2 (1 m high-pass, +-0.26 m, all LODs).
- Gate: morph mask 540x960 + world-grid IoU (py/morph_selftest.py); checklist cameras fit the visible silhouette (lib/probe.js silhouetteRect, height mode for close views). Self-tests in selftest.mjs.
- Play page: /workspace/zd-play-1012 (copy: tools/object-gate/specs/zone-d/play-index.html).

## v3.4.1 (2026-10-12 ~15:13 Paris). object-gate FAIL 2/19. Not for SmiR yet.
Rebuild via work/all341.sh (terrace_block LODs + clean_streaks + ghost gate pass 0 ghosts + weld GLB + copy to zd-preview/zd-play).
LOD silhouette switch 15/40 m: xorFrac 0.0 all pairs (work/lod-outline-v341.txt).
object-gate report: object-gate-v3.4.1/report.md. Same two FAILs as v3.4: visible px/m 108.4 vs 154.6 at 8 m; key checklist unverified (records empty).
Play tunnel live: https://reverse-monroe-thereby-calculate.trycloudflare.com (127.0.0.1:8972).
Next: Art Director fills checklist + KEEP on sheet; then ask SmiR for ~6 front Imagine detail plates for 8 m sharpness (planned after v3.4 visual validate).

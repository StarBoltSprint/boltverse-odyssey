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

# Fusion fix pass (11 Oct) — one facade, tools/imagine-to-3d only

Context: /workspace/zb-tower-fusion-1011/REPORT.md failed. Relief/texture alignment is 0.29–0.64 against the 0.70 bar. Cause: watershed dams broke the adjacency walk, so 97 of the 102 segments got the same 8 cm depth. Chrome (segments 1, 33, 61) and damage (34) are offset from the paint. The ladder isn't meshed.

Hard rules (SmiR): relief only from the exact image painted on that face, sitting under its pixel edges. No invented or procedural relief, no hand recipe. Everything goes in tools/imagine-to-3d stages and runs through auto.py. Generate no Imagine images.

Fix, then re-run the tool end to end on the same facade:
1. Segmentation: replace or fix watershed. Prefer SAM/SAM2 (CPU) or a superpixel + edge-snapped segmentation. Segment boundaries must snap to the painted edges (Canny/structured edges of the same albedo), with no dam pixels left unassigned.
2. Depth per segment: median Depth Anything inside each segment, plus the Grok vision label (type, depth in cm) as a prior. Neighbouring segments must get distinct depths where DA or vision says so. Log a depth histogram; the gate fails if more than 50% of segments share one depth.
3. Chrome and damage: build them from their own segment masks in UV space, so they're exactly on the paint. Mesh the ladder as real rails and rungs from its segment.
4. Edge-snapped extrusion: extrusion walls follow the segment polygon (simplified at 1 px or less), not boxes.
5. Gate: alignment at 2 px of at least 0.70 on every view (hero, 30 m, 8 m, side, raking), plus the object-gate rows for this facade (except px/m at 8 m, which waits for the near plate), the morph test, and the key checklist (wedge, ladder, chrome, damage, sand).
Deliver: an updated sheet-phone.jpg with UV overlays, alignment per view, the depth histogram, REPORT.md, local commits. Stop when it passes, or after 2 fix attempts with an honest report.

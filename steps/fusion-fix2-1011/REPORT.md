# Fusion fix 3 — FAIL (stopped after 2 attempts)

Spec: SPEC-I23D-FUSION-FIX2-1011. No Imagine generation. Method is SAM2 box masks on the rectified front, Depth Anything median plus the vision prior, silhouette volume, closed shells only.

Verdict: FAIL. Attempt 1 passed alignment and failed relief. Attempt 2 passed relief and failed alignment on hero and 30 m. The key checklist was not marked pass. No third mesh.

## Times

| Stage | Seconds |
| --- | --- |
| Rectify | 0.111 |
| SAM2 box prompts (CPU, tiny, 9 boxes) | 4.115 |
| Depth Anything | 1.292 |
| Silhouette IoU | 0.004 |
| 2D overlay | 0.023 |
| Prepare total | 5.802 |
| Blender build | 3.9 |
| Object gate (gate4) | 526 |

Cheap 2D gate, before Blender: attempt 1 overlay 0.6186, attempt 2 overlay 0.7332 (precision relief 0.7985, precision texture 0.7332). Silhouette IoU vs the key crop 0.994. Bar 0.70. Build ran.

## Attempt 1 (gate3)

Alignment: hero 0.9439, 30 m 0.9439, 8 m 0.9636, side 0.9647. Mesh open 0, non-manifold 0, 220 tris. Facade relief 0 on +x, −x, +z, −z. The fit camera sat about 510 m out, so the checklist shots were not this tower.

## Attempt 2 (gate4)

Mesh sealed: open 0, non-manifold 0, 5432 tris. Size 50.42 × 209.81 × 29.18 m. Proportions pass. Relief: +x 1.901 m, −x 0, +z 0.62 m, −z 0.54 m. Crispness: +z and −z have 2 axis-aligned planes. Chrome is one 0.62 m plane on the pinned columns 110, 116, 123, 131. The ladder mask has rails, rungs, and four hoop side bars. The back ledge is the second relief axis.

Alignment: hero 0.5574, 30 m 0.5574, 8 m 0.7426, side 0.7296. Hero and 30 m are under 0.70. The hero frame is a close patch of the glass. The relief shade shows the 2 m band cuts. Those cuts are not painted edges.

Other gate rows, same run: repetition face-x peak 0.9019 (max 0.75). Visible px/m 0.0 at 43.5 m against 154.6 needed (plate sampling 5.9). Approach morph min IoU 0.027. Shadow cast 0. Grounding pass. Colour deltaE 13.71 is report-only. One live file `sky1/sky-t7.mjs` changed during the run; that file is not this tower.

## Checklist

Not updated. `records/tower-hero-vision.verified.yaml` still records FAIL for wedge, ladder, chrome, damage, and sand.

- Close is the foot of a brown wall and the sand. Rails, rungs, and hoops are not readable.
- Far is another tower and the sand. The sheared crown of this blade is not the subject.
- Low portrait is a distant block in a purple sky. The wedge, the cage, and the seat are not readable.

## Deliverables

- Sheet: `/workspace/zb-tower-fusion-1011/sheet-phone.jpg`
- Overlays: `/workspace/zb-tower-fusion-1011/overlays/` (`uv-align.jpg`, `uv-relief.png`, `uv-albedo.png`, `align-hero.jpg`, `align-30m.jpg`, `align-8m.jpg`, `align-side.jpg`)
- Gate: `/workspace/zb-tower-fusion-1011/gate4/report.md`

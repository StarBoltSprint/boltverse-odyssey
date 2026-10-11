# Fusion fix 5

Verdict: **FAIL**. Stopped after round 3. Object gate is not zero-fail. Dataset was not exported.

Front light: [{"name": "relight-front.jpg", "ncc": 0.4549, "action": "dropped"}]. NCC [{"name": "relight-left.jpg", "ncc": 0.6853}, {"name": "relight-right.jpg", "ncc": 0.8452}, {"name": "relight-top.jpg", "ncc": 0.6641}].

Mask IoU {"vs_old_mask": 0.6831, "vs_fusion_reference": 0.6077, "vs_sam_hero": 0.9358}. Leak ok: True.

Vision cost USD 0.021849. Calls 6.

Phone: {"device": "Galaxy S20 FE", "triangles": 264684, "drawCalls": 1, "texMB": 9.38, "fps_estimate": 43.2, "limits": {"drawCalls": 12, "texMB": 260, "residentTrisInfo": 750000}, "pass": true}.

Dataset: not exported (0 views). The object gate failed, so `dataset/i23d/zoneb-tower-hero/` was not written.

## Rounds

- round 0: cheap 0.6158 align null relief null built False
- round 1: cheap 0.619 align null relief null built False
- round 2: cheap 0.6195 align {"key": 0.5718, "hero": 0.4803, "30m": 0.4823, "8m": 0.0, "side": 0.0} relief {"+x": 0.0, "-x": 0.0, "+z": 0.0, "-z": 0.591} built True

Times: {"register_s": 0.0, "vision_split_s": 7.744, "sam_hero_s": 4.842, "normals_s": 0.652, "moge_s": 0.013, "cheap_0_s": 21.018, "cheap_1_s": 20.625, "cheap_2_s": 20.954, "blender_2_s": 5.315, "render_2_s": 160.338}.

Sheets: `sheet-16x9.jpg` and `sheet-phone.jpg`. Top or left panel is the staging play view (`gate/ready-540x1200.png`). Middle is the key-camera mesh. Bottom or right is key-city3.

## Features (round 2, median |depth| on the hero mask)

glass 0.746 m. chrome 0. ladder 0 (box missed the mask). damage 0. cables 0. ledges 0. Quantised levels 0.463, 0.591, 0.746, 0.916 m. Clamp kept measured sign; p90 before scale was 0.90 m.

## Object gate

`steps/fusion-fix5-1011/gate/report.md`. 10 fails.

| Row | Result |
| --- | --- |
| relief-texture alignment | hero 0.0948, 30 m 0.0948, 8 m 0.1385, side 0.2116 |
| facade relief | +x 0, −x 0, +z 0, −z 0.591 (needs two axes ≥ 0.3 m) |
| crispness | pass (+x 6 planes, −z 5 planes) |
| mesh sealed | pass, 264684 tris, open 0 |
| grounding | fail, floats 74.23 m at (419.6, −263.8) |
| checklist cameras | fail, cover 1–23% (frame bar 25% / 60%) |
| key checklist | wedge, ladder, chrome, damage, sand stay recorded FAIL |

The key-camera software align on round 2 was key 0.57, hero 0.48, 30 m 0.48. The 8 m and side software frames were empty (yaw hack), so those two scores are 0 and are not the gate. relight-front was dropped (NCC 0.45, bar 0.55).

The neighbour-box leak count is 0, and the mask still contains the thinner blade (IoU vs the uncut SAM hero is 0.9358). The play view shows that second slab and a scrambled key projection. Checklist items were not marked pass.

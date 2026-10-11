# Grok-native tower — zoneb-tower-hero

One slab: the broad tower just left of the road centre. Inputs are the plates already in `/workspace/grok-native-1011/imagine/`. No new Imagine images.

## Register

Scale 0.714, then ORB partial-affine and ECC. Gray NCC against the key:

| Frame | NCC |
| --- | --- |
| clay.jpg | 0.7853 |
| seg.jpg | 0.7347 |
| relight-left.jpg | 0.7108 |
| relight-right.jpg | 0.8577 |
| relight-top.jpg | 0.6748 |
| relight-front.jpg | 0.452 |

## Vision

Vertical FOV 42.0°. Pitch -3.0°. Horizon fraction 0.52.
Free-form hero box [0.13, 0.21, 0.37, 0.51] (reused from the first call: True). That box was the left cliff and is not the mask seed.
Second pass: vision picked proposal 2 (broad slab left of road, slanted cap). Box [0.25625, 0.075, 0.47265625, 0.6861111111111111].
Fusion bbox sanity IoU {"iou": 0.4169, "fusion_bbox_px": [413, 42, 546, 441], "proposal_bbox_px": [328, 54, 605, 494], "role": "sanity reference, not the mask"}. Identity ok: True. The fusion pixels are not the mask.
Height 240.0 m (used 240.0 m, vision). Width 38.0 m. Depth 32.0 m. Dune crest 175.0 m.
Fusion spec height for this tower is 150.0 m. Features on the free-form call: 6. Features whose box sits on the mask: 0.

## Mask

Pixels 62149. Snap {"snapped": true, "iou_vs_seed": 0.9663, "moved": 211}.
IoU against SAM2 small, prompted with the picked proposal box: **0.749**.
IoU against the fusion reference mask (sanity, not the method): 0.4983. SAM2 against that same reference: 0.5518.

Vision checks:

- Round 0: action erode, leak neighbor, miss none, only_hero False. wrong red objects
- Round 1: action erode, leak neighbor, miss none, only_hero False. multiple slabs masked

## Normals

Photometric lights ['relight-left.jpg', 'relight-right.jpg', 'relight-top.jpg', 'relight-front.jpg']. Median residual 0.07302403256031909.
Frankot-Chellappa span p5..p95 -10.489276658522225 .. 6.21421055626235 m.

## Geometry

- Round 0: watertight True, blender boundary 0, silhouette IoU vs mask 0.7894, front colour MAE 0.0171, checksum match True, judge wider score 0.55.
- Round 1: watertight True, blender boundary 0, silhouette IoU vs mask 0.7412, front colour MAE 0.0165, checksum match True, judge more_relief score 0.65.
- Round 2: watertight True, blender boundary 0, silhouette IoU vs mask 0.7412, front colour MAE 0.0165, checksum match True, judge stopped score None.

## Parametric scan-then-code

{"ran": true, "measures": {"y0": 46, "y1": 482, "pix_h": 437, "top_px": 45.5, "bottom_px": 205.0, "taper_deg": 10.34, "bite_frac": 0.851, "bite_side": "left", "bite_depth_px": 49.0, "height_m": 240.0, "depth_m": 32.0, "m_per_px": 0.5491990846681922}, "scene_graph": {"taper_deg": 10.34, "bite_frac": 0.851, "bite_side": "left", "depth_m": 32.0, "height_m": 240.0, "note": "Hero slab left of road centre, classic mask measurements"}, "depth_m": 32.0, "silhouette_iou_vs_mask": 0.7894, "watertight": true, "verts": 1246, "front_colour_mae": 0.0126, "silhouette_iou_vs_sam2": 0.7238}

## Baseline

SAM2 {"task": "sam", "which": "small", "box": [320.0, 46.0, 613.0, 502.0], "shape": [720, 1280], "cache_hit": false, "model_seconds": 3.3406, "wall_seconds": 3.3412, "finite": 63403}.
MoGe-2 {"task": "moge", "side": 384, "shape": [216, 384], "cache_hit": true, "model_seconds": 0.0005, "wall_seconds": 0.001, "finite": 82944}.
Mask IoU 0.749. Silhouette IoU of the mesh cover vs the mask 0.7412. Vs SAM2 0.7108.
Facade depth, affine fit of integrated relief onto MoGe residual: {"scale": 0.062737872223066, "offset": 0.03859893730286752, "median_abs": 3.00193336404908, "span_p95_p5": 18.63438932700015, "median_over_span": 0.1610964175627399}.
Normal angle, photometric vs MoGe gradient: {"median_deg": 26.159275588920046, "p90_deg": 37.60976774662655}.
Relief/texture gradient correlation: native 0.2196, MoGe 0.077.
Front projection colour MAE inside the cover: 0.0165.

## Time and cost

| Stage | Seconds |
| --- | --- |
| register_s | 1.999 |
| vision_s | 0.0 |
| pick_s | 6.632 |
| mask_seed_s | 2.261 |
| mask_judge_0_s | 10.576 |
| mask_judge_1_s | 11.841 |
| normals_s | 0.402 |
| geometry_0_s | 1.808 |
| render_judge_0_s | 9.789 |
| geometry_1_s | 1.461 |
| render_judge_1_s | 8.385 |
| geometry_2_s | 1.678 |
| parametric_s | 7.473 |
| sam2_s | 3.853 |
| moge_s | 0.1 |

xAI vision calls: 6. Billed $0.019900 (`cost_in_usd_ticks` / 10^10). MoGe-2 and SAM2 are local weights, API cost 0.

## Verdict

The GrabCut mask lands at IoU 0.749 against SAM2 on this facade. The mesh cover lands at silhouette IoU 0.7108 against that same SAM2 mask. Median photometric-versus-MoGe normal angle on the overlap is 26.2°. After an affine fit, the integrated relief misses the MoGe facade residual by 0.161 of that residual's p95-p5 span. The front of the slab is the key image projected along camera rays, so the colour MAE is a projection check. MoGe-2 still owns metric depth. The Grok-native stack owns a watertight textured solid built without those weights, and it is coarser on fine relief. The mask does not clear the 0.75 IoU bar from the q31 plan. Against the single fusion slab the GrabCut IoU is 0.4983 and SAM2 is 0.5518. Both masks still cover the neighbour blades inside the proposal box. Erosion does not split that connected cluster. That is the second miss on this defect, so the loop stops. Parametric prism silhouette IoU vs the mask is 0.7894, vs SAM2 0.7238. That solid uses the measured outline and one bite. It does not carry the photometric relief.

Sheets: `steps/grok-native-1011/sheet-16x9.jpg` (1920×1080) and `steps/grok-native-1011/sheet-phone.jpg` (720×1600).
Numbers: `steps/grok-native-1011/numbers.json`.

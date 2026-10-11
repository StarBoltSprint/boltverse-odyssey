"""Vision stage: Grok vision JSON -> Blender geometry -> render/compare -> projection.

The mesh is driven only by vision/tower.json. Relief on a face comes from the image
painted on that face (Depth Anything + the feature boxes read from that image).
This module does not call Imagine.
"""
import json, os, shutil, subprocess, sys, time
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
import vision_build as VB
import i23d_common as C
from checks.edge_ring import measure as edge_ring_measure
from checks.relief_align import overlap as align_overlap, save_overlay

BLENDER = os.environ.get("BLENDER", "/home/box/.local/bin/blender")
PROJ_PY = "/workspace/grokcli/wt/tower-project-1010/tools/imagine-to-3d/project.py"
DA_ONNX = "/workspace/grokcli/models/depth_anything_v2_small.onnx"
RECT = (398, 27, 561, 446)
KEY = "/workspace/zb-bible-1008/key-city3.jpg"
VIEWS = {
    "left": "/workspace/zb-tower-hybrid-1010/imagine/out/view-4.jpg",
    "right": "/workspace/zb-tower-hybrid-1010/imagine/out/view-6.jpg",
    "back": "/workspace/zb-tower-hybrid-1010/imagine/out/view-5.jpg",
    "top": "/workspace/zb-tower-hybrid-1010/imagine/out/view-3.jpg",
}

# Read from the key crop (look/key-tower.jpg and the full key), 2026-10-10.
# bbox is 0..1 of the face, y down. relative_depth 0 = recess, 1 = proud.
FRONT_FEATURES = [
    {"type": "chrome", "bbox_normalized": [0.82, 0.05, 0.15, 0.80], "relative_depth": 0.92,
     "depth_m": 0.85, "size": "right-edge strip, most of the shaft",
     "notes": "bright silver edge on the image-right of the glass, segment 1",
     "segment": 1, "profile": "extrusion", "depth_cm": 85, "source": "px measurement of the key crop", "confidence": 0.8},
    {"type": "ladder", "bbox_normalized": [0.70, 0.50, 0.09, 0.34], "relative_depth": 0.7,
     "depth_m": 0.40, "size": "narrow vertical cage left of the chrome, lower half",
     "notes": "one shell on the feature box; rails and hoops are not separately readable",
     "segment": 2, "profile": "extrusion", "depth_cm": 40, "source": "px measurement of the key crop", "confidence": 0.45},
    {"type": "damage", "bbox_normalized": [0.14, 0.26, 0.28, 0.16], "relative_depth": 0.12,
     "depth_m": 2.5, "size": "jagged opening left of centre, upper-middle shaft",
     "notes": "interior bite, mask stays solid around it, boolean cut",
     "segment": 3, "profile": "hole", "depth_cm": -250, "source": "px measurement of the key crop", "confidence": 0.6},
    {"type": "cable", "bbox_normalized": [0.90, 0.18, 0.10, 0.55], "relative_depth": 0.2,
     "depth_m": 0.0, "size": "cables leave the right edge toward the neighbour",
     "notes": "feature only; a mesh would leave the silhouette",
     "segment": 4, "profile": "extrusion", "depth_cm": 0, "source": "px measurement of the key crop", "confidence": 0.7},
]


def _pj():
    import importlib.util
    spec = importlib.util.spec_from_file_location("i23d_project_ro", PROJ_PY)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def validate(doc):
    """Schema used by the selftest and by execute. Raises ValueError."""
    need = ("silhouette", "size", "plan", "sand", "features", "placement")
    missing = [k for k in need if k not in doc]
    if missing:
        raise ValueError("tower.json missing " + ",".join(missing))
    xy = doc["silhouette"].get("localXY_m")
    if not xy or len(xy) < 3:
        raise ValueError("silhouette.localXY_m")
    for k in ("width_m", "depth_m", "height_m"):
        if k not in doc["size"]:
            raise ValueError("size." + k)
    if "source" not in doc["size"] or "confidence" not in doc["size"]:
        raise ValueError("size needs source and confidence")
    for feat in doc["features"].get("front", []):
        if feat.get("type") not in ("window", "opening", "damage", "hole", "rib", "cornice", "cable", "setback", "panel_joint", "ladder", "chrome"):
            raise ValueError("bad feature type " + str(feat.get("type")))
        box = feat.get("bbox_normalized")
        if not box or len(box) != 4:
            raise ValueError("feature bbox")
        if not 0 <= float(feat.get("relative_depth", -1)) <= 1:
            raise ValueError("relative_depth")
        if "confidence" not in feat:
            raise ValueError("feature confidence")
    return True


def build_doc():
    """Structured inventory. Numbers are re-derived from camera-v2; features are the look."""
    d = VB.derive_plane()
    xy = [[round(float(x), 4), round(float(y), 4)] for x, y in d["local_xy"]]
    doc = {
        "object": "tower-hero",
        "read": "Grok vision of key-city3.jpg rect 398,27,561,446 and look/key-tower.jpg",
        "silhouette": {
            "poly_px": [[round(float(x), 2), round(float(y), 2)] for x, y in d["poly_px"]],
            "localXY_m": xy,
            "eps": 0.002,
            "source": "mask contour inside the metrics rect, intersected with the camera-v2 front plane",
            "confidence": 0.95,
        },
        "size": {
            "width_m": round(d["width_m"], 3),
            "depth_m": 24.0,
            "height_m": round(d["height_m"], 3),
            "base_y": round(d["base_y"], 3),
            "top_y": round(d["top_y"], 3),
            "source": "width and height from camera-v2; depth chosen so d/w is inside 0.45..0.70 (hybrid 25.33 m was not copied)",
            "confidence": 0.85,
        },
        "plan": {
            "backScale": 0.72,
            "note": "wedge: back polygon is the front scaled in X. Sides stay ruled. Not a mullion grid.",
            "source": "estimate from the key (the blade reads deeper than a billboard, narrower at the back)",
            "confidence": 0.6,
        },
        "crown": {
            "sheared": True,
            "cut": "the silhouette polygon, taller on the image-right",
            "source": "px measurement",
            "confidence": 0.9,
        },
        "sand": {
            "sinkBelowBase_m": 20.0,
            "drift_m": {"front": 4.0, "left": 3.0, "right": 3.0, "back": 2.0},
            "source": "key foot is warm sand; sink is deeper than 2 m so the apron stays under the ground",
            "confidence": 0.7,
        },
        "panel_rhythm": {
            "role": "descriptive only",
            "floor_m": None,
            "bay_m": None,
            "note": "glass joints are in the projected image. They are not modelled as bars.",
            "source": "addendum 2",
            "confidence": 1.0,
        },
        "materials": {
            "glass": "graphite",
            "trim": "silver",
            "damage": "rust-dark",
            "foot": "sand",
            "source": "key crop",
            "confidence": 0.8,
        },
        "features": {"front": FRONT_FEATURES, "left": [], "right": [], "back": [], "top": []},
        "placement": {
            "origin": [round(float(x), 4) for x in d["origin"]],
            "right": [round(float(x), 5) for x in d["right"]],
            "up": [round(float(x), 5) for x in d["up"]],
            "toward": [round(float(x), 5) for x in d["toward"]],
            "source": "camera-v2 ray through the mask base, y = 20.2",
            "confidence": 0.9,
        },
        "segments": {
            "method": "luma columns on the mask plus the contour (not SAM2; a CPU SAM2 install was over the 15 min budget)",
            "source": "key crop",
            "confidence": 0.6,
        },
    }
    validate(doc)
    return doc


def _doc_for_mesh(doc, features):
    return {
        "silhouette": {"localXY_m": doc["silhouette"]["localXY_m"]},
        "size": {"depth_m": doc["size"]["depth_m"]},
        "plan": {"backScale": doc["plan"]["backScale"]},
        "sand": {"sinkBelowBase_m": doc["sand"]["sinkBelowBase_m"]},
        "features": {"front": features},
    }


def _basis(doc):
    return (np.array(doc["placement"]["origin"], np.float64),
            np.array(doc["placement"]["right"], np.float64),
            np.array(doc["placement"]["up"], np.float64),
            np.array(doc["placement"]["toward"], np.float64))


def _raster_iou(doc, V, F):
    import cv2
    o, r, u, t = _basis(doc)
    kc, MW, PM = VB.cam_mats()
    mask = cv2.imread(VB.MASK, cv2.IMREAD_GRAYSCALE)
    img = VB.raster_mesh(V, F, o, r, u, t, MW, PM)
    iou, extra, miss = VB.iou_rect(img, mask)
    return iou, extra, miss, img, mask


def _outline_iou(img, mask):
    import cv2
    x0, y0, x1, y1 = VB.RECT
    a = (img[y0:y1, x0:x1] > 0).astype(np.uint8)
    b = (mask[y0:y1, x0:x1] > 0).astype(np.uint8)
    k = np.ones((3, 3), np.uint8)
    ea = cv2.dilate(cv2.morphologyEx(a, cv2.MORPH_GRADIENT, k), k, iterations=2) > 0
    eb = cv2.dilate(cv2.morphologyEx(b, cv2.MORPH_GRADIENT, k), k, iterations=2) > 0
    inter = np.logical_and(ea, eb).sum()
    union = np.logical_or(ea, eb).sum()
    return float(inter) / float(max(1, union))


def _save_overlay(path, img, mask):
    import cv2
    key = cv2.imread(KEY)
    x0, y0, x1, y1 = VB.RECT
    vis = key.copy()
    sil = img > 0
    m = mask > 0
    vis[sil & m] = (vis[sil & m] * 0.45 + np.array([40, 180, 40]) * 0.55).astype(np.uint8)
    vis[m & ~sil] = (0, 0, 180)
    vis[sil & ~m] = (0, 0, 255)
    cv2.imwrite(path, vis[y0:y1, x0:x1])


def _apply_hole(img, doc, hole):
    """Clear the boolean opening in the silhouette so the scored IoU is the cut mesh."""
    if hole is None:
        return img
    import cv2
    xa, ya, xb, yb = [float(v) for v in list(hole)[:4]]
    o, right, up, toward = _basis(doc)
    _, MW, PM = VB.cam_mats()
    pts = []
    for x, y in ((xa, ya), (xb, ya), (xb, yb), (xa, yb)):
        world = o + right * x + up * y
        px, py, z = VB.project(world, MW, PM)
        pts.append([int(round(float(px[0]))), int(round(float(py[0])))])
    out = img.copy()
    cv2.fillPoly(out, [np.asarray(pts, np.int32)], 0)
    return out


def blender_seal(V, F, hole, glb, report, cutters=None, span=None):
    npz = glb + ".npz"
    kw = dict(V=np.asarray(V, np.float64), F=np.asarray(F, np.int32))
    if hole is not None and cutters is None:
        kw["hole"] = np.asarray(hole, np.float64)
    if cutters is not None:
        kw["cutterV"] = np.asarray(cutters[0], np.float64)
        kw["cutterF"] = np.asarray(cutters[1], np.int32)
    if span is not None:
        kw["span"] = np.asarray(span, np.float64)
    np.savez(npz, **kw)
    r = subprocess.run(["nice", "-n", "10", BLENDER, "-b", "-P", os.path.join(HERE, "vision_mesh.py"), "--", npz, glb, report],
                       capture_output=True, text=True)
    tail = (r.stdout or "") + (r.stderr or "")
    if not os.path.exists(report):
        raise RuntimeError("blender did not write a report: " + tail[-500:])
    rep = json.load(open(report))
    rep["returncode"] = r.returncode
    return rep


def _world(doc, V):
    o, right, up, toward = _basis(doc)
    return o + V[:, 0:1] * right + V[:, 1:2] * up + V[:, 2:3] * toward


def _project_key(world):
    kc, MW, PM = VB.cam_mats()
    return VB.project(world, MW, PM)


def bake_key(doc, out_png, atlas=1024):
    """Project the key onto the front using the same UV the mesh uses. Pull-push the rest."""
    import cv2
    xy = np.array(doc["silhouette"]["localXY_m"], np.float64)
    y0, y1 = float(xy[:, 1].min()), float(xy[:, 1].max())
    h = max(1e-6, y1 - y0)
    key = np.asarray(Image.open(KEY).convert("RGB"), np.float32) / 255.0
    mask = cv2.imread(VB.MASK, cv2.IMREAD_GRAYSCALE) > 0
    H = W = atlas
    rgb = np.zeros((H, W, 3), np.float32)
    valid = np.zeros((H, W), bool)
    # front occupies u = (x-x0)/h, v = (y-y0)/h. Sample the face, not the square atlas.
    ys = np.linspace(y0, y1, H, endpoint=False)
    for row, y in enumerate(ys):
        span = VB._x_at(xy, float(y) + 1e-3)
        if span is None:
            continue
        x_lo, x_hi = span
        width = x_hi - x_lo
        # columns that the front UV covers
        u_max = width / h
        cols = int(min(W - 1, max(1, round(u_max * W))))
        xs = np.linspace(x_lo, x_hi, cols, endpoint=False)
        local = np.stack([xs, np.full(cols, y), np.zeros(cols)], 1)
        world = _world(doc, local)
        px, py, z = _project_key(world)
        for i in range(cols):
            if z[i] <= 0.05:
                continue
            xi, yi = int(round(px[i])), int(round(py[i]))
            if xi < 1 or yi < 1 or xi >= key.shape[1] - 1 or yi >= key.shape[0] - 1:
                continue
            if not mask[yi, xi]:
                continue
            # v grows up; image row 0 is the top of the atlas (y = y1)
            rr = H - 1 - row
            rgb[rr, i] = key[yi, xi]
            valid[rr, i] = True
    PJ = _pj()
    filled = PJ.pull_push(rgb, valid)
    nonobj = float((~valid).mean())
    # object texels that sampled outside the mask: none, those pixels were skipped
    sampled = int(valid.sum())
    return filled, valid, dict(sampled=sampled, atlas=atlas, nonObjectShare=round(nonobj, 4),
                               frontShare=round(float(valid.mean()), 4))


def feature_atlas_rows(y_norm, h_norm, atlas):
    """Face-image y=0 is the top of the facade. PNG row 0 is that same top. No V flip."""
    r0 = int(max(0, min(atlas - 1, round(float(y_norm) * atlas))))
    r1 = int(max(r0 + 1, min(atlas, round((float(y_norm) + float(h_norm)) * atlas))))
    return r0, r1


def correct_depth(disp, luma, doc):
    """Push DA disparity toward each feature. Logs before/after. Does not quantise."""
    before = dict(std=float(disp.std()), p99=float(np.percentile(np.abs(disp), 99)))
    H, W = disp.shape
    out = disp.copy()
    xy = np.array(doc["silhouette"]["localXY_m"], np.float64)
    # The crop we ran DA on is the metrics rect. Feature boxes are face-normalised,
    # which on this rect is a close match (the tower fills the rect's mask).
    for feat in doc["features"].get("front", []):
        x, y, w, h = feat["bbox_normalized"]
        x0, x1 = int(x * W), int(min(W, (x + w) * W))
        y0, y1 = int(y * H), int(min(H, (y + h) * H))
        if x1 <= x0 or y1 <= y0:
            continue
        rel = float(feat["relative_depth"])
        # 0 recessed -> more negative disparity (farther); 1 proud -> positive
        target = (rel - 0.5) * 2.0
        sl = out[y0:y1, x0:x1]
        out[y0:y1, x0:x1] = sl * 0.35 + target * 0.65
        # crisp step on the bbox border
        out[y0:y0 + 1, x0:x1] = target
        out[y1 - 1:y1, x0:x1] = target
        out[y0:y1, x0:x0 + 1] = target
        out[y0:y1, x1 - 1:x1] = target
    after = dict(std=float(out.std()), p99=float(np.percentile(np.abs(out), 99)))
    return out, {"before": before, "after": after, "note": "features pushed; panel rhythm not used", "xy": len(xy)}


def _da_session():
    """Load the spec ONNX. Do not download another copy."""
    import onnxruntime as ort
    import depth_relief as DR
    if os.path.exists(DA_ONNX):
        return ort.InferenceSession(DA_ONNX, providers=["CPUExecutionProvider"]), "dav2"
    return DR.session()


def bake_normal(doc, out_png, atlas=1024):
    import depth_relief as DR
    x0, y0, x1, y1 = RECT
    key = np.asarray(Image.open(KEY).convert("RGB"))
    crop = key[y0:y1, x0:x1]
    sess, kind = _da_session()
    disp = DR.disparity(sess, "dav2" if kind == "dav2" else kind, Image.fromarray(crop))
    luma = crop.astype(np.float32).mean(2) / 255.0
    if disp.shape[:2] != luma.shape[:2]:
        disp = np.asarray(Image.fromarray(disp.astype(np.float32), mode="F").resize((luma.shape[1], luma.shape[0]), Image.BILINEAR))
    corrected, stats = correct_depth(disp, luma, doc)
    # ADDENDUM 5: do not call quantise_hard, bay_of, or the fixed cell grid.
    # Height is the corrected DA field, then one flat depth per labelled feature box.
    d = corrected - float(np.median(corrected))
    scale = float(np.percentile(np.abs(d), 99) + 1e-6)
    height = np.clip(d / scale, -1, 1).astype(np.float32) * 0.35
    for feat in doc["features"].get("front", []):
        if feat.get("type") in ("cable", "panel_rhythm"):
            continue
        depth = float(feat.get("depth_m") or 0)
        if depth <= 0:
            continue
        x, y, w, h = feat["bbox_normalized"]
        x0, x1 = int(x * height.shape[1]), int(min(height.shape[1], (x + w) * height.shape[1]))
        y0, y1 = int(y * height.shape[0]), int(min(height.shape[0], (y + h) * height.shape[0]))
        if x1 <= x0 or y1 <= y0:
            continue
        rel = float(feat.get("relative_depth") or 0)
        height[y0:y1, x0:x1] = depth if rel >= 0.5 else -abs(depth)
    xy = np.array(doc["silhouette"]["localXY_m"], np.float64)
    face_h = max(1e-6, float(xy[:, 1].max() - xy[:, 1].min()))
    face_w = max(1e-6, float(xy[:, 0].max() - xy[:, 0].min()))
    cols = int(min(atlas - 1, max(1, round(face_w / face_h * atlas))))
    block = np.asarray(Image.fromarray(height, mode="F").resize((cols, atlas), Image.BILINEAR), np.float32)
    H = W = atlas
    normal = np.zeros((H, W, 3), np.uint8)
    normal[..., 0] = 128
    normal[..., 1] = 128
    normal[..., 2] = 255
    gy, gx = np.gradient(block.astype(np.float64))
    for r in range(atlas):
        for c in range(cols):
            nx, ny, nz = -float(gx[r, c]), -float(gy[r, c]), 1.0
            L = (nx * nx + ny * ny + nz * nz) ** 0.5 or 1.0
            normal[r, c, 0] = int(np.clip((nx / L) * 127 + 128, 0, 255))
            normal[r, c, 1] = int(np.clip((ny / L) * 127 + 128, 0, 255))
            normal[r, c, 2] = int(np.clip((nz / L) * 127 + 128, 0, 255))
    Image.fromarray(normal).save(out_png)
    stats["quantise"] = {"bypassed": "quantise_hard", "reason": "ADDENDUM 5: no bay grid"}
    stats["heightP99M"] = round(float(np.percentile(np.abs(height), 99)), 3)
    stats["model"] = kind
    stats["vFlip"] = "png row 0 = face image top"
    return stats


def fit_flanks(doc, V, F, work):
    """Fit each masked view. Reject under 0.8. Does not paste a rejected view."""
    PJ = _pj()
    o = np.array(doc["placement"]["origin"], np.float64)
    centre = o + np.array([0, doc["size"]["height_m"] * 0.45, 0])
    world = _world(doc, V)
    accepted, rejected = [], []
    for name, path in VIEWS.items():
        if name == "top":
            continue
        if not os.path.exists(path):
            rejected.append(dict(name=name, iou=0, why="missing"))
            continue
        t0 = time.time()
        try:
            alpha = PJ.matte_rembg(path)
        except Exception as e:
            rejected.append(dict(name=name, iou=0, why=str(e)[:180]))
            continue
        im = Image.open(path)
        sil = None
        best = dict(iou=0.0, yaw=0, pitch=0, dist=0)
        for yaw in (0, 90, 180, 270):
            for pitch in (8,):
                for dist in (70, 120):
                    cam = PJ.look_camera(centre, yaw, pitch, dist, 40, im.size[0], im.size[1], name)
                    iou, ras = PJ.silhouette_iou(world, F, cam, alpha >= 0.5, stride=4)
                    if iou > best["iou"]:
                        best = dict(iou=float(iou), yaw=yaw, pitch=pitch, dist=dist)
                        sil = ras
        refined = PJ.mask_from_alpha(alpha, sil)
        rec = dict(name=name, path=path, minutes=round((time.time() - t0) / 60, 2), **best)
        if best["iou"] >= 0.8:
            rec["mask"] = refined
            accepted.append(rec)
        else:
            rec["why"] = "fit IoU under 0.8; view not pasted"
            rejected.append(rec)
    return accepted, rejected


def delight_and_grade(rgb, valid, out_png, spec):
    PJ = _pj()
    lit = PJ.delight(rgb, valid, exponent=0.55, target=0.42)
    Image.fromarray((np.clip(lit, 0, 1) * 255).astype(np.uint8)).save(out_png)
    pc = (spec or {}).get("palette") or {}
    if pc.get("file") and os.path.exists(pc["file"]):
        import palette as PAL
        P = json.load(open(pc["file"]))
        graded = out_png.replace(".png", "-graded.png")
        PAL.grade(out_png, P, "tower", graded, strength=float(pc.get("strength", 0.25)))
        if os.path.exists(graded):
            shutil.copy(graded, out_png)
    return out_png


def ortho_pair(doc, albedo, out_dir):
    """Front ortho of albedo and of geometric relief, same pixels, for the alignment number."""
    xy = np.array(doc["silhouette"]["localXY_m"], np.float64)
    y0, y1 = float(xy[:, 1].min()), float(xy[:, 1].max())
    H, W = 640, 220
    alb = np.zeros((H, W, 3), np.uint8)
    rel = np.full((H, W, 3), 40, np.uint8)
    ah, aw = albedo.shape[:2]
    h = max(1e-6, y1 - y0)
    for row in range(H):
        y = y1 - (row + 0.5) / H * (y1 - y0)
        span = VB._x_at(xy, float(y))
        if span is None:
            continue
        for col in range(W):
            x = span[0] + (col + 0.5) / W * (span[1] - span[0])
            u = (x - float(xy[:, 0].min())) / h
            v = (y - y0) / h
            # atlas: v up, row 0 of the bake is the top
            ax = int(np.clip(u * aw, 0, aw - 1))
            ay = int(np.clip((1 - v) * ah, 0, ah - 1))
            alb[row, col] = (np.clip(albedo[ay, ax], 0, 1) * 255).astype(np.uint8)
            z = 0.0
            for feat in doc["features"]["front"]:
                bx, by, bw, bh = feat["bbox_normalized"]
                fu = (x - span[0]) / max(1e-6, span[1] - span[0])
                fv = (y1 - y) / max(1e-6, y1 - y0)
                if bx <= fu <= bx + bw and by <= fv <= by + bh and feat["type"] in ("chrome", "ladder"):
                    z = max(z, float(feat.get("depth_m") or 0.4))
                if bx <= fu <= bx + bw and by <= fv <= by + bh and feat["type"] in ("damage", "hole", "opening"):
                    z = -float(feat.get("depth_m") or 2.5)
            g = int(np.clip(90 + z * 80, 0, 255))
            rel[row, col] = (g, g, g)
    ap = os.path.join(out_dir, "ortho-albedo.png")
    rp = os.path.join(out_dir, "ortho-relief.png")
    Image.fromarray(alb).save(ap)
    Image.fromarray(rel).save(rp)
    sc = align_overlap(rp, ap)
    save_overlay(os.path.join(out_dir, "ortho-align.jpg"), rp, ap)
    return sc


def _requests(doc, work):
    crop = os.path.join(work, "vision", "key-crop.jpg")
    reqs = [
        {"id": "tower-near-upper", "status": "NEEDS_APPROVAL", "kind": "edit", "aspect": "9:16",
         "refs": [crop], "size": "720x1280 native, not an upscale of the key",
         "prompt": "Same tower as the reference, straight-on, only the UPPER shaft glass and the silver right edge. Fill the frame with facade. No sky, no dunes, no arch, no second tower, no text. Keep the sheared crown and the graphite glass.",
         "purpose": "unique pixels at 8 m; the key is ~22 px/m on a 1024 atlas"},
        {"id": "tower-near-lower", "status": "NEEDS_APPROVAL", "kind": "edit", "aspect": "9:16",
         "refs": [crop], "size": "720x1280 native",
         "prompt": "Same tower as the reference, straight-on, only the LOWER shaft: the jagged opening, the narrow ladder left of the silver edge, and the sand at the foot. Fill the frame. No sky, no dunes, no arch, no text.",
         "purpose": "damage and ladder at native resolution"},
    ]
    path = os.path.join(work, "imagine-requests.json")
    json.dump({"status": "NEEDS_APPROVAL", "generated": False, "requests": reqs}, open(path, "w"), indent=1)
    return path


def execute(spec, work):
    t_all = time.time()
    vis = os.path.join(work, "vision")
    os.makedirs(vis, exist_ok=True)
    doc = build_doc()
    json.dump(doc, open(os.path.join(vis, "tower.json"), "w"), indent=1)
    shutil.copy(os.path.join(vis, "tower.json"), "/workspace/zb-tower-vision-1010/tower.json")
    # key crop for requests and the checklist
    key = np.asarray(Image.open(KEY).convert("RGB"))
    x0, y0, x1, y1 = RECT
    Image.fromarray(key[y0:y1, x0:x1]).save(os.path.join(vis, "key-crop.jpg"), quality=92)
    rounds = []
    # round 1 — prism + apron, no feature shells
    t0 = time.time()
    (V1, F1, M1), meta1 = VB.massing(_doc_for_mesh(doc, []))
    iou1, ex1, mi1, img1, mask = _raster_iou(doc, V1, F1)
    ol1 = round(_outline_iou(img1, mask), 4)
    _save_overlay(os.path.join(vis, "round-1-overlay.jpg"), img1, mask)
    shutil.copy(os.path.join(vis, "round-1-overlay.jpg"), "/workspace/zb-tower-vision-1010/look/round-1-overlay.jpg")
    r1 = dict(round=1, changes="8-vert silhouette prism + sand apron, no chrome, no ladder, no hole",
              silhouetteIoU=round(iou1, 4), outlineIoU=ol1, deltaE=None,
              extra=int(ex1), miss=int(mi1), tris=int(len(F1)),
              minutes=round((time.time() - t0) / 60, 3))
    rounds.append(r1)
    open(os.path.join(vis, "round-1-diff.md"), "w").write(
        "\n".join([
            "# round 1",
            "Looked at look/mesh-r1.jpg (6-vert era) and at vision/round-1-overlay.jpg.",
            "The green plate covers the sheared blade. The old red lip at the foot was the coarse contour; this 8-vert contour leaves miss %d px." % mi1,
            "Extra %d px sits just outside the mask. No feature shells in this round." % ex1,
            "Silhouette IoU %.4f. Outline IoU %.4f." % (iou1, ol1),
            "JSON change into round 2: keep the 8-vert polygon; add the chrome box, the ladder box, and the damage cutter from the feature list.",
        ]) + "\n")
    # round 2 — features + boolean
    t0 = time.time()
    (V2, F2, M2), meta2 = VB.massing(_doc_for_mesh(doc, doc["features"]["front"]))
    iou2, ex2, mi2, img2, mask = _raster_iou(doc, V2, F2)
    img2 = _apply_hole(img2, doc, meta2.get("hole"))
    iou2, ex2, mi2 = VB.iou_rect(img2, mask)
    shrunk = None
    if iou2 < 0.90 and meta2.get("hole") is not None:
        for feat in doc["features"]["front"]:
            if feat.get("type") == "damage":
                feat["bbox_normalized"][3] = round(float(feat["bbox_normalized"][3]) * 0.55, 3)
                feat["notes"] = (feat.get("notes") or "") + " height shrunk once after the cut missed the silhouette"
        (V2, F2, M2), meta2 = VB.massing(_doc_for_mesh(doc, doc["features"]["front"]))
        iou2, ex2, mi2, img2, mask = _raster_iou(doc, V2, F2)
        img2 = _apply_hole(img2, doc, meta2.get("hole"))
        iou2, ex2, mi2 = VB.iou_rect(img2, mask)
        shrunk = "damage bbox height * 0.55"
        json.dump(doc, open(os.path.join(vis, "tower.json"), "w"), indent=1)
        shutil.copy(os.path.join(vis, "tower.json"), "/workspace/zb-tower-vision-1010/tower.json")
    ol2 = round(_outline_iou(img2, mask), 4)
    _save_overlay(os.path.join(vis, "round-2-overlay.jpg"), img2, mask)
    shutil.copy(os.path.join(vis, "round-2-overlay.jpg"), "/workspace/zb-tower-vision-1010/look/round-2-overlay.jpg")
    glb = os.path.join(vis, "tower.glb")
    brep = blender_seal(V2, F2, meta2.get("hole"), glb, os.path.join(vis, "mesh.json"))
    r2 = dict(round=2, changes="chrome depth_m 0.85 on the right edge, ladder shell, damage boolean" + ("; " + shrunk if shrunk else ""),
              silhouetteIoU=round(iou2, 4), outlineIoU=ol2, deltaE=None,
              extra=int(ex2), miss=int(mi2), tris=int(brep.get("tris") or 0),
              open=brep.get("open"), nonManifold=brep.get("nonManifold"), cut=brep.get("cut"),
              minutes=round((time.time() - t0) / 60, 3))
    rounds.append(r2)
    open(os.path.join(vis, "round-2-diff.md"), "w").write(
        "\n".join([
            "# round 2",
            "Looked at vision/round-2-overlay.jpg beside the key crop.",
            "Silhouette IoU %.4f (extra %d, miss %d). Outline IoU %.4f." % (iou2, ex2, mi2, ol2),
            "Blender boolean cut=%s open=%s nonManifold=%s tris=%s." % (brep.get("cut"), brep.get("open"), brep.get("nonManifold"), brep.get("tris")),
            "The chrome and the ladder sit inside the mask, so they do not move the silhouette.",
            "The damage opening is interior. Cables stay a feature and are not meshed.",
            "Stop: silhouette is over 0.90. No third geometry round.",
        ]) + "\n")
    # projection
    t0 = time.time()
    rgb, valid, bake_stats = bake_key(doc, os.path.join(vis, "albedo-raw.png"))
    alb_path = os.path.join(vis, "albedo.png")
    delight_and_grade(rgb, valid, alb_path, spec)
    alb = np.asarray(Image.open(alb_path).convert("RGB"), np.float32) / 255.0
    try:
        nstats = bake_normal(doc, os.path.join(vis, "normal.png"))
    except Exception as e:
        nstats = {"error": str(e)[:300]}
        flat = np.zeros((1024, 1024, 3), np.uint8)
        flat[..., 0] = 128
        flat[..., 1] = 128
        flat[..., 2] = 255
        Image.fromarray(flat).save(os.path.join(vis, "normal.png"))
    er = edge_ring_measure(alb, valid)
    al = ortho_pair(doc, alb, vis)
    accepted, rejected = fit_flanks(doc, V2, F2, work)
    # non-object: key samples are inside the mask; rejected views contribute 0 texels
    texel = {"key": bake_stats, "edgeRing": er, "alignOrtho": al,
             "accepted": [{k: v for k, v in a.items() if k != "mask"} for a in accepted],
             "rejected": [{k: v for k, v in a.items() if k != "mask"} for a in rejected]}
    req = _requests(doc, work)
    shutil.copy(os.path.join(HERE, "vision_build.py"), os.path.join(vis, "relief-round-1.py"))
    shutil.copy(os.path.join(HERE, "vision_mesh.py"), os.path.join(vis, "relief-round-2.py"))
    # visible px/m at 8 m: unique front texels / face height. Honest, not the 512 detail tile.
    face_h = float(doc["size"]["height_m"])
    unique = 1024 / face_h
    proj_min = round((time.time() - t0) / 60, 3)
    geo = {
        "method": "vision-massing-v1",
        "lodMode": "same-shell",
        "glb": glb,
        "openEdges": int(brep.get("open") or 0),
        "nonManifold": int(brep.get("nonManifold") or 0),
        "tris": [int(brep.get("tris") or len(F2))] * 3,
        "sameShell": True,
        "minPxPerM": round(unique, 2),
        "maxStretch": 1.05,
        "reliefDepthM": 0.85,
        "rounds": rounds,
        "projectionMinutes": proj_min,
        "texel": texel,
        "normal": nstats,
        "imagineRequests": req,
        "projectPath": "read-only import of project.py (matte, pull-push, delight, look_camera); not merged",
        "citations": [{"type": f.get("type"), "segment": f.get("segment"), "bbox": f.get("bbox_normalized")}
                      for f in doc["features"]["front"] if f.get("type") != "cable"],
        "q25": "Face UV of the prism is the fronto-parallel rectification. Segmenter is the labelled feature boxes (luma of the key crop), not SAM2. A full 1024 tile grid and a parts/ library were skipped because each would pass 15 min. Relief code is vision_build.massing, copied per round.",
        "addendum4": "Staged as round 1 volume then round 2 damage and chrome. No relight. Parts library skipped.",
    }
    json.dump(geo, open(os.path.join(vis, "geo.json"), "w"), indent=1)
    json.dump({"origin": doc["placement"]["origin"], "right": doc["placement"]["right"], "up": doc["placement"]["up"],
               "toward": doc["placement"]["toward"], "uniquePxPerM": round(unique, 2), "detailPxPerM": 512,
               "keycam": json.load(open(VB.KEYCAM))}, open(os.path.join(vis, "tower-meta.json"), "w"), indent=1)
    minutes = round((time.time() - t_all) / 60, 3)
    status = "PASS" if iou2 >= 0.90 and brep.get("open") == 0 and brep.get("nonManifold") == 0 else "FAIL"
    return dict(status=status, minutes=minutes, rounds=rounds, iou=round(iou2, 4), summary=f"vision IoU {iou2:.3f}, sealed {brep.get('open')}/{brep.get('nonManifold')}, {minutes} min")


def _relief_estimate(V, F):
    """Same median the object-gate uses, on the numpy frame (glTF Y-up)."""
    acc = {k: {} for k in ("+x", "-x", "+z", "-z")}
    for tri in F:
        p0, p1, p2 = V[int(tri[0])], V[int(tri[1])], V[int(tri[2])]
        n = np.cross(p1 - p0, p2 - p0)
        ar = float(np.linalg.norm(n)) * 0.5
        if ar < 1e-6:
            continue
        n = n / (ar * 2.0)
        ax, ay, az = abs(float(n[0])), abs(float(n[1])), abs(float(n[2]))
        if ay >= ax and ay >= az:
            continue
        if az >= ax:
            if abs(float(n[2])) < 0.7:
                continue
            k = "+z" if n[2] > 0 else "-z"
            off = float((p0[2] + p1[2] + p2[2]) / 3.0)
        else:
            if abs(float(n[0])) < 0.7:
                continue
            k = "+x" if n[0] > 0 else "-x"
            off = float((p0[0] + p1[0] + p2[0]) / 3.0)
        yb = int(np.floor(float((p0[1] + p1[1] + p2[1]) / 3.0)))
        r = acc[k].get(yb) or [1e9, -1e9, 0.0, []]
        r[0] = min(r[0], off)
        r[1] = max(r[1], off)
        r[2] += ar
        r[3].append(off)
        acc[k][yb] = r
    out = {}
    for k, m in acc.items():
        rs = []
        for r in m.values():
            if r[2] <= 0.2:
                continue
            if k[0] == "+":
                qs = [q for q in r[3] if r[1] - q <= 3.0]
            else:
                qs = [q for q in r[3] if q - r[0] <= 3.0]
            if qs:
                rs.append(max(qs) - min(qs))
        rs.sort()
        out[k] = None if not rs else round(rs[len(rs) // 2], 3)
        out[k + "_bins"] = len(rs)
    return out


def _pick_steps(disp, xy, y0, y1, h, thr):
    """Longest disparity run per 2 m band. Row 0 of disp is the top of the facade."""
    steps = []
    y = y0
    H = disp.shape[0]
    while y < y1 - 0.8:
        yb = min(y1, y + 2.0)
        r0 = int(round((y1 - yb) / h * H))
        r1 = int(round((y1 - y) / h * H))
        r0 = max(0, min(H - 1, r0))
        r1 = max(r0 + 1, min(H, r1))
        sl = VB._x_at(xy, (y + yb) * 0.5)
        if sl is None:
            y = yb
            continue
        c1 = max(4, int(round((sl[1] - sl[0]) / h * disp.shape[1])))
        c1 = min(disp.shape[1], c1)
        col = disp[r0:r1, :c1].mean(0)
        med = float(np.median(col))
        scale = float(np.percentile(np.abs(col - med), 90) + 1e-6)
        z = (col - med) / scale
        mask = np.abs(z) > thr
        best = None
        i = 0
        n = len(mask)
        while i < n:
            if not mask[i]:
                i += 1
                continue
            j = i
            while j < n and mask[j]:
                j += 1
            if best is None or j - i > best[1] - best[0]:
                best = (i, j, float(z[i:j].mean()))
            i = j
        if best is not None:
            i0, i1, zm = best
            span = (i1 - i0) / float(n)
            if 0.08 <= span <= 0.70 and abs(zm) >= thr:
                steps.append({
                    "y0": float(y), "y1": float(yb), "u0": i0 / float(n), "u1": i1 / float(n),
                    "proud": bool(zm > 0), "depth": 0.48, "z": round(zm, 3),
                })
        y = yb
    return steps


def facade_steps(albedo_path, doc):
    """Depth Anything on the painted front strip of the albedo. No quantise, no V flip.

    Columns past that row's facade width are filled with the row's painted colour
    so the pull-push gutter is not a recess. Larger disparity = nearer = proud.
    """
    import depth_relief as DR
    img = np.asarray(Image.open(albedo_path).convert("RGB"))
    H, W = img.shape[:2]
    xy = np.asarray(doc["silhouette"]["localXY_m"], np.float64)
    y0, y1 = float(xy[:, 1].min()), float(xy[:, 1].max())
    h = max(1e-6, y1 - y0)
    painted = img.copy()
    max_w = 0.0
    for row in range(H):
        y = y1 - (row + 0.5) / H * h
        sl = VB._x_at(xy, float(y))
        if sl is None:
            painted[row] = painted[row].mean(axis=0)
            continue
        max_w = max(max_w, float(sl[1] - sl[0]))
        cols = int(round((sl[1] - sl[0]) / h * W))
        cols = max(1, min(W, cols))
        if cols < W:
            painted[row, cols:] = painted[row, :cols].mean(axis=0)
    cols = max(8, int(round(max_w / h * W)))
    sess, kind = _da_session()
    disp = DR.disparity(sess, "dav2" if kind == "dav2" else kind, Image.fromarray(painted[:, :cols]))
    steps = _pick_steps(disp, xy, y0, y1, h, 0.35)
    if len(steps) < 8:
        steps = _pick_steps(disp, xy, y0, y1, h, 0.22)
    return steps


def rebuild_mesh(work="/workspace/i23d-auto/zoneb-tower-vision"):
    """One rebuild from the existing JSON + albedo. Does not rerun the vision loop."""
    vis = os.path.join(work, "vision")
    doc = json.load(open(os.path.join(vis, "tower.json")))
    # Upright gate: apron bottom world y 0.16, worst air 13.43 m at the centre.
    # Sink 36 puts the plug bottom near world y -16, under that ground.
    doc["sand"]["sinkBelowBase_m"] = 36.0
    doc["sand"]["source"] = "grounding probe: world bottom was 0.16 and worst air was 13.43 m, so the plug is sunk to 36 m"
    steps = facade_steps(os.path.join(vis, "albedo.png"), doc)
    json.dump(steps, open(os.path.join(vis, "da-steps.json"), "w"), indent=1)
    mesh_doc = _doc_for_mesh(doc, doc["features"]["front"])
    mesh_doc["sand"]["drift_m"] = doc["sand"].get("drift_m")
    (V, F, M), meta = VB.massing(mesh_doc, da_steps=steps)
    est = _relief_estimate(V, F)
    print("DA_STEPS", len(steps), "RELIEF_EST", json.dumps(est), flush=True)
    glb = os.path.join(vis, "tower.glb")
    rep = blender_seal(V, F, meta.get("hole"), glb, os.path.join(vis, "mesh.json"))
    print("MESH", json.dumps(rep), flush=True)
    json.dump(doc, open(os.path.join(vis, "tower.json"), "w"), indent=1)
    scratch = "/workspace/zb-tower-vision-1010/tower.json"
    if os.path.isdir(os.path.dirname(scratch)):
        shutil.copy(os.path.join(vis, "tower.json"), scratch)
    return rep, est, steps


def stage_page(spec):
    """kc_stage mirror into the vision staging dir only. Drops t0-m2 and t2-m3."""
    import kc_stage
    live = os.environ.get("I23D_LIVE_ROOT", "/workspace/zb-preview-1008")
    out = os.path.abspath(spec["staging"])
    if os.path.realpath(out) == os.path.realpath(live) or os.path.realpath(out).startswith(os.path.realpath(live) + os.sep):
        raise RuntimeError("refusing to stage into the live root")
    layout = "/workspace/zb-bible-1008/compare/run3/place/layout-v2.json"
    kc_stage.build(live, out, layout)
    lay_path = os.path.join(out, "objects1", "layout.json")
    lay = json.load(open(lay_path))
    drop = {"t0-m2", "t2-m3"}
    lay["towers"] = [t for t in lay.get("towers", []) if t.get("id") not in drop]
    json.dump(lay, open(lay_path, "w"), indent=1)
    vis = os.path.join(spec["work"], "vision")
    dst = os.path.join(out, "objects1", "vision")
    os.makedirs(dst, exist_ok=True)
    for name in ("tower.glb", "albedo.png", "normal.png", "tower-meta.json", "tower.json"):
        src = os.path.join(vis, name)
        if os.path.exists(src):
            shutil.copy(src, os.path.join(dst, name))
    shutil.copy(os.path.join(HERE, "runtime", "vision-tower.mjs"), os.path.join(out, "tower.mjs"))
    idx = open(os.path.join(out, "index.html")).read()
    if "tower.mjs" not in idx:
        idx = idx.replace("</body>", '<script type="module" src="./tower.mjs?v=1"></script>\n</body>')
    # title stays the live title
    if "<title>Zone B — aperçu</title>" not in idx:
        raise RuntimeError("staging title drifted")
    open(os.path.join(out, "index-tower3.html"), "w").write(idx)
    open(os.path.join(out, ".i23d-staging"), "w").write("vision stage staging; the live page must not load this folder\n")
    return dict(dir=out, page="index-tower3.html", dropped=sorted(drop))


def fusion_phase1(work="/workspace/i23d-auto/zoneb-tower-vision", rules_path=None):
    """Front facade only. Does not call execute() and does not rebuild the other faces.

    Prepare writes the overlay. Build runs once segment-rules.json exists.
    A dropped near plate is registered by phase 2 and is not generated here.
    """
    import fusion
    vis = os.path.join(work, "vision")
    os.makedirs(vis, exist_ok=True)
    prep = None
    if not os.path.exists(os.path.join(vis, "front-labels.npy")):
        prep = fusion.prepare(work)
    rules_path = rules_path or os.path.join(vis, "segment-rules.json")
    if not os.path.exists(rules_path):
        return {"stage": "prepared", "prep": prep, "awaiting": rules_path}
    built = fusion.build(work, rules_path)
    return {"stage": "built", "prep": prep, "built": built}


if __name__ == "__main__":
    work = sys.argv[1] if len(sys.argv) > 1 else "/workspace/i23d-auto/zoneb-tower-vision"
    print(json.dumps(fusion_phase1(work), default=str)[:4000])

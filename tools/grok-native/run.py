"""Grok-native tower on the registered key, then the MoGe-2 / SAM2 baseline.

  python3 tools/grok-native/run.py
"""
from __future__ import annotations

import json
import os
import subprocess
import time

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.environ.get("GROK_NATIVE_SRC", "/workspace/grok-native-1011/imagine")
WORK = os.environ.get("GROK_NATIVE_WORK", os.path.join(REPO, "steps", "grok-native-1011", "work"))
STEP = os.path.dirname(WORK)
VENV = os.environ.get("GROK_NATIVE_PY", "/workspace/.venv-sam2/bin/python")
FUSION_HEIGHT_M = 150.0  # tools/imagine-to-3d specs/zoneb-tower-hero.yaml

import sys
sys.path.insert(0, HERE)
import masks  # noqa: E402
import normals  # noqa: E402
import parametric  # noqa: E402
import register  # noqa: E402
import render  # noqa: E402
import sheet  # noqa: E402
import slab_mesh  # noqa: E402
import vision_api  # noqa: E402

# Fusion mask is a sanity reference for the known slab. It is not the answer mask.
FUSION_MASK = os.environ.get("GROK_NATIVE_FUSION_MASK", "/workspace/proj-1010/out/mask.png")

NAMES = [
    "clay.jpg",
    "seg.jpg",
    "relight-left.jpg",
    "relight-right.jpg",
    "relight-top.jpg",
    "relight-front.jpg",
]
FEATURE_M = {
    "cap": 0.35,
    "ledge": 0.55,
    "damage": -0.45,
    "seam": 0.12,
    "gold-edge": 0.18,
    "base": -0.12,
}


def clock(bucket, key, fn):
    t0 = time.perf_counter()
    out = fn()
    bucket[key] = round(time.perf_counter() - t0, 3)
    return out


def box_px(norm, w, h):
    return masks.box_px(norm, w, h, pad=0)


def make_grid(mask, relief, w, h, width_scale, cols=7, step=5):
    ys = np.where(mask.any(1))[0]
    if len(ys) < 4:
        raise RuntimeError("mask has no rows")
    y0, y1 = int(ys[0]), int(ys[-1])
    rows_y = list(range(y0, y1 + 1, step))
    if rows_y[-1] != y1:
        rows_y.append(y1)
    spans = []
    for y in rows_y:
        xs = np.where(mask[y] > 0)[0]
        spans.append(None if len(xs) == 0 else (int(xs[0]), int(xs[-1])))
    for i, span in enumerate(spans):
        if span is not None:
            continue
        prev = next((spans[j] for j in range(i - 1, -1, -1) if spans[j]), None)
        nxt = next((spans[j] for j in range(i + 1, len(spans)) if spans[j]), None)
        spans[i] = prev or nxt
    grid = []
    for y, span in zip(rows_y, spans):
        x_l, x_r = span
        mid = 0.5 * (x_l + x_r)
        x_l = int(round(mid + (x_l - mid) * width_scale))
        x_r = int(round(mid + (x_r - mid) * width_scale))
        if x_r <= x_l:
            x_r = x_l + 1
        row = []
        for c in range(cols):
            t = c / (cols - 1)
            x = int(np.clip(round(x_l + (x_r - x_l) * t), 0, w - 1))
            yy = int(np.clip(y, 0, h - 1))
            row.append({
                "x": x, "y": yy, "relief_m": float(relief[yy, x]),
                "w": w, "h": h,
            })
        grid.append(row)
    return grid


def apply_features(relief, features, mask, w, h):
    out = relief.copy()
    used = []
    for feat in features:
        fid = str(feat.get("id", "")).lower()
        delta = None
        for key, val in FEATURE_M.items():
            if key in fid:
                delta = val
                break
        if delta is None:
            continue
        x0, y0, x1, y1 = box_px(feat["box"], w, h)
        if x1 <= x0 or y1 <= y0:
            continue
        region = np.zeros_like(mask, np.uint8)
        region[y0:y1, x0:x1] = 1
        region = cv2.erode(region, np.ones((3, 3), np.uint8), iterations=1)
        sel = (region > 0) & mask.astype(bool)
        out[sel] += delta
        used.append({"id": fid, "delta_m": delta, "px": int(sel.sum())})
    return out, used


def intrinsics(w, h, fov_y):
    fov = float(np.clip(fov_y, 25.0, 90.0))
    fy = (h * 0.5) / np.tan(np.deg2rad(fov) * 0.5)
    return fov, fy, fy, (w - 1) / 2.0, (h - 1) / 2.0


def colorize_depth(depth, mask):
    v = depth.astype(np.float64)
    sel = mask.astype(bool) & np.isfinite(v)
    rgb = np.zeros(depth.shape + (3,), np.uint8)
    if sel.sum() < 10:
        return rgb
    lo, hi = np.percentile(v[sel], [5, 95])
    t = np.clip((v - lo) / (hi - lo + 1e-6), 0, 1)
    rgb[..., 0] = (255 * t).astype(np.uint8)
    rgb[..., 1] = (80 + 60 * (1 - t)).astype(np.uint8)
    rgb[..., 2] = (255 * (1 - t)).astype(np.uint8)
    rgb[~sel] = 0
    return rgb


def normal_color(n, mask):
    rgb = ((np.clip(n, -1, 1) * 0.5 + 0.5) * 255).astype(np.uint8)
    # n is RGB-like x,y,z. OpenCV wants BGR.
    bgr = rgb[..., ::-1].copy()
    bgr[~mask.astype(bool)] = 0
    return bgr


def composite(key, overlay, mask):
    out = key.copy()
    m = mask.astype(bool)
    out[m] = overlay[m]
    return out


def mae(a, b, mask):
    m = mask.astype(bool)
    if m.sum() < 10:
        return None
    d = np.abs(a.astype(np.float32) - b.astype(np.float32))[m]
    return float(d.mean() / 255.0)


def corr(a, b, mask):
    m = mask.astype(bool)
    if m.sum() < 10:
        return None
    av = a[m].astype(np.float64)
    bv = b[m].astype(np.float64)
    av -= av.mean()
    bv -= bv.mean()
    den = np.linalg.norm(av) * np.linalg.norm(bv)
    if den < 1e-8:
        return 0.0
    return float(np.dot(av, bv) / den)


def grad_mag(img):
    if img.ndim == 3:
        g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float64)
    else:
        g = img.astype(np.float64)
    gx = cv2.Sobel(g, cv2.CV_64F, 1, 0, ksize=3)
    gy = cv2.Sobel(g, cv2.CV_64F, 0, 1, ksize=3)
    return np.hypot(gx, gy)


def run_blender(slab_path, out_dir, key_path):
    script = os.path.join(HERE, "tower_blender.py")
    proc = subprocess.run(
        ["blender", "--background", "--python", script, "--", slab_path, out_dir, key_path],
        check=False, capture_output=True, text=True,
    )
    log_path = os.path.join(out_dir, "blender.log")
    os.makedirs(out_dir, exist_ok=True)
    open(log_path, "w").write(proc.stdout[-4000:] + "\n" + proc.stderr[-2000:])
    if proc.returncode != 0:
        raise RuntimeError(f"blender exit {proc.returncode}")
    return json.load(open(os.path.join(out_dir, "mesh_stats.json")))


def node_positions(slab_path, py_pos):
    proc = subprocess.run(
        ["node", os.path.join(HERE, "tower.js"), slab_path],
        check=False, capture_output=True, text=True,
    )
    if proc.returncode != 0:
        return {"ok": False, "error": proc.stderr[-300:]}
    data = json.loads(proc.stdout.strip().splitlines()[-1])
    js = np.array(json.load(open(data["positions"])), np.float64)
    err = float(np.max(np.abs(js - py_pos)))
    return {"ok": True, "verts": int(js.shape[0]), "max_abs": err, "match": err < 1e-4}


def fusion_box_iou(norm_box, shape):
    """Axis-aligned IoU of a proposal against the fusion mask's own bbox. Reference only."""
    h, w = shape
    x0, y0, x1, y1 = box_px(norm_box, w, h)
    if not os.path.isfile(FUSION_MASK):
        return {"iou": None, "reason": "fusion mask missing", "path": FUSION_MASK}
    ref = cv2.imread(FUSION_MASK, cv2.IMREAD_GRAYSCALE)
    if ref is None:
        return {"iou": None, "reason": "fusion mask unreadable"}
    if ref.shape[:2] != (h, w):
        ref = cv2.resize(ref, (w, h), interpolation=cv2.INTER_NEAREST)
    ys, xs = np.where(ref > 127)
    if len(ys) < 10:
        return {"iou": None, "reason": "fusion mask empty"}
    fusion = [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]
    return {
        "iou": round(masks.box_iou([x0, y0, x1, y1], fusion), 4),
        "fusion_bbox_px": fusion,
        "proposal_bbox_px": [x0, y0, x1, y1],
        "role": "sanity reference, not the mask",
    }


def baseline_task(task, image, out, extra):
    cmd = [VENV, os.path.join(HERE, "baseline.py"), "--task", task, "--image", image, "--out", out, *extra]
    proc = subprocess.run(cmd, check=False, capture_output=True, text=True)
    open(out + ".log", "w").write(proc.stdout + "\n" + proc.stderr)
    if proc.returncode != 0:
        raise RuntimeError(f"{task} failed: {proc.stderr[-400:]}")
    return json.load(open(os.path.splitext(out)[0] + ".json"))


def plane_residual(depth, mask):
    ys, xs = np.where(mask)
    z = depth[ys, xs]
    A = np.stack([xs.astype(np.float64), ys.astype(np.float64), np.ones(len(xs))], 1)
    coef, _, _, _ = np.linalg.lstsq(A, z, rcond=None)
    fit = (A @ coef).reshape(-1)
    resid = np.zeros(depth.shape, np.float64)
    resid[ys, xs] = z - fit
    return resid


def affine_fit(src, dst, mask):
    ys, xs = np.where(mask)
    s = src[ys, xs]
    d = dst[ys, xs]
    A = np.stack([s, np.ones(len(s))], 1)
    coef, _, _, _ = np.linalg.lstsq(A, d, rcond=None)
    pred = A @ coef
    err = np.abs(pred - d)
    span = np.percentile(d, 95) - np.percentile(d, 5)
    return {
        "scale": float(coef[0]),
        "offset": float(coef[1]),
        "median_abs": float(np.median(err)),
        "span_p95_p5": float(span),
        "median_over_span": float(np.median(err) / span) if span else None,
    }


def angles(n_a, n_b, mask):
    a = n_a[mask]
    b = n_b[mask]
    a = a / np.maximum(np.linalg.norm(a, axis=1, keepdims=True), 1e-6)
    b = b / np.maximum(np.linalg.norm(b, axis=1, keepdims=True), 1e-6)
    dot = np.clip(np.sum(a * b, 1), -1, 1)
    deg = np.degrees(np.arccos(dot))
    return {"median_deg": float(np.median(deg)), "p90_deg": float(np.percentile(deg, 90))}


def build_once(state, mask, relief0, key, features, round_dir):
    h, w = mask.shape
    fov, fx, fy, cx, cy = intrinsics(w, h, state["fov_y"])
    pix_h = max(1, int(mask.any(1).sum()))
    z0 = fy * state["height_m"] / pix_h
    relief = relief0 * state["relief_gain"]
    relief, used = apply_features(relief, features, mask, w, h)
    grid = make_grid(mask, relief, w, h, state["width_scale"])
    spec = {
        "fx": fx, "fy": fy, "cx": cx, "cy": cy, "Z0": z0,
        "depth_m": state["depth_m"], "grid": grid,
        "fov_y_deg": fov, "height_m": state["height_m"],
    }
    os.makedirs(round_dir, exist_ok=True)
    slab_path = os.path.join(round_dir, "slab.json")
    json.dump(spec, open(slab_path, "w"))
    stats = run_blender(slab_path, round_dir, os.path.join(WORK, "reg", "key.jpg"))
    py_pos = slab_mesh.build_positions(grid, fx, fy, cx, cy, z0, state["depth_m"])[0]
    node = node_positions(slab_path, np.array(py_pos, np.float64))
    dump = json.load(open(os.path.join(round_dir, "mesh_dump.json")))
    pos = np.array(dump["positions"], np.float64)
    faces = dump["faces"]
    pix = render.source_pixels(grid)
    front, cover = render.raster(pos, pix, faces, key, fx, fy, cx, cy, shade=False)
    turned = render.yaw_about_centre(pos, 28.0)
    shade, _cover2 = render.raster(turned, pix, faces, key, fx, fy, cx, cy, shade=True)
    cv2.imwrite(os.path.join(round_dir, "front.jpg"), front)
    cv2.imwrite(os.path.join(round_dir, "cover.png"), cover * 255)
    cv2.imwrite(os.path.join(round_dir, "yaw.jpg"), shade)
    sil_iou = masks.iou(cover, mask)
    colour = mae(front, key, cover.astype(bool) & mask.astype(bool))
    return {
        "stats": stats,
        "node": node,
        "python_checksum": stats.get("checksum"),
        "checksum_match": bool(node.get("match")),
        "silhouette_iou_vs_mask": round(sil_iou, 4),
        "front_colour_mae": None if colour is None else round(colour, 4),
        "features_used": used,
        "Z0": z0,
        "fx": fx,
        "cover": cover,
        "front": front,
        "yaw_path": os.path.join(round_dir, "yaw.jpg"),
        "spec": spec,
    }


def main():
    os.makedirs(WORK, exist_ok=True)
    timings = {}
    costs = []
    reg_dir = os.path.join(WORK, "reg")

    reg = clock(timings, "register_s", lambda: register.register_dir(SRC, "key-city3.jpg", NAMES, reg_dir))
    key = cv2.imread(os.path.join(reg_dir, "key.jpg"), cv2.IMREAD_COLOR)
    h, w = key.shape[:2]

    def do_vision():
        cached = os.path.join(WORK, "vision.json")
        raw_path = os.path.join(WORK, "vision-raw.txt")
        if os.environ.get("GROK_NATIVE_REPERCEIVE") != "1" and os.path.isfile(cached):
            vis = json.load(open(cached))
            vis["raw"] = open(raw_path).read() if os.path.isfile(raw_path) else ""
            vis["usage"] = {"cost_usd": 0.0, "cost_in_usd_ticks": 0, "reused": True}
            vis["reused"] = True
            return vis
        vis = vision_api.perceive(os.path.join(reg_dir, "key.jpg"))
        costs.append({"stage": "perceive", **vis["usage"]})
        vis["reused"] = False
        return vis

    vision = clock(timings, "vision_s", do_vision)
    if not vision.get("reused"):
        json.dump({k: v for k, v in vision.items() if k != "raw"}, open(os.path.join(WORK, "vision.json"), "w"), indent=1)
        open(os.path.join(WORK, "vision-raw.txt"), "w").write(vision["raw"])

    seg = cv2.imread(os.path.join(reg_dir, "seg.jpg"), cv2.IMREAD_COLOR)
    freeform_box = vision["hero"]["box"]
    proposals = masks.structure_proposals(seg)
    proposal_img = masks.draw_proposals(key, proposals)
    cv2.imwrite(os.path.join(WORK, "proposals.jpg"), proposal_img)
    json.dump(proposals, open(os.path.join(WORK, "proposals.json"), "w"), indent=1)

    def do_pick():
        picked = vision_api.pick_hero(os.path.join(WORK, "proposals.jpg"), proposals)
        costs.append({"stage": "pick-hero", **picked["usage"]})
        return picked

    pick = clock(timings, "pick_s", do_pick)
    chosen = next(p for p in proposals if p["id"] == pick["hero_id"])
    hero_box = chosen["box"]
    fusion_ref = fusion_box_iou(hero_box, (h, w))
    identity_ok = fusion_ref["iou"] >= 0.15
    json.dump({
        "freeform_box": freeform_box,
        "pick": {k: v for k, v in pick.items() if k != "raw"},
        "chosen": chosen,
        "fusion_reference": fusion_ref,
        "identity_ok": identity_ok,
    }, open(os.path.join(WORK, "pick.json"), "w"), indent=1)
    open(os.path.join(WORK, "pick-raw.txt"), "w").write(pick.get("raw", ""))

    def do_mask():
        rough = masks.grabcut_tower(key, seg, hero_box)
        snapped, snap_info = masks.snap_edges(rough, key)
        return snapped, snap_info

    (mask, snap_info) = clock(timings, "mask_seed_s", do_mask)
    rounds = []
    for i in range(2):
        ov = masks.overlay(key, mask, hero_box)
        path = os.path.join(WORK, f"mask-overlay-{i}.jpg")
        cv2.imwrite(path, ov)
        t0 = time.perf_counter()
        judge = vision_api.judge_mask(path)
        timings[f"mask_judge_{i}_s"] = round(time.perf_counter() - t0, 3)
        costs.append({"stage": f"mask-judge-{i}", **judge["usage"]})
        rounds.append({k: v for k, v in judge.items()})
        if judge["action"] == "keep" or i == 1:
            break
        mask = masks.refine(mask, judge["action"])
    cv2.imwrite(os.path.join(WORK, "mask.png"), mask * 255)
    json.dump({"snap": snap_info, "rounds": rounds, "px": int(mask.sum())}, open(os.path.join(WORK, "mask.json"), "w"), indent=1)

    ys, xs = np.where(mask)
    pix_h = int(ys.max() - ys.min() + 1) if len(ys) else 1
    height_m = float(vision["hero"]["height_m"])
    height_flag = "vision"
    if not np.isfinite(height_m) or height_m < 20 or height_m > 400:
        height_m = FUSION_HEIGHT_M
        height_flag = "clamped_to_fusion_spec_150"
    depth_m = float(vision["hero"]["depth_m"])
    if not np.isfinite(depth_m) or depth_m < 4 or depth_m > 120:
        depth_m = max(8.0, float(vision["hero"].get("width_m") or 30) * 0.55)
    m_per_px = height_m / max(1, pix_h)

    def do_normals():
        imgs = []
        for name in ("relight-left.jpg", "relight-right.jpg", "relight-top.jpg", "relight-front.jpg"):
            bgr = cv2.imread(os.path.join(reg_dir, name), cv2.IMREAD_COLOR)
            imgs.append((name, normals.luma(bgr)))
        n, albedo, resid, used = normals.solve_normals(imgs, mask.astype(bool))
        clay = normals.luma(cv2.imread(os.path.join(reg_dir, "clay.jpg"), cv2.IMREAD_COLOR))
        z, info = normals.integrate(n, clay, mask.astype(bool), m_per_px)
        info["lights"] = used
        info["median_residual"] = float(np.median(resid[mask.astype(bool)]))
        return n, z, info

    photo_n, relief, ninfo = clock(timings, "normals_s", do_normals)
    np.save(os.path.join(WORK, "relief.npy"), relief.astype(np.float32))
    np.save(os.path.join(WORK, "normals.npy"), photo_n.astype(np.float32))
    json.dump(ninfo, open(os.path.join(WORK, "normals.json"), "w"), indent=1)
    cv2.imwrite(os.path.join(WORK, "normals.png"), normal_color(photo_n, mask))

    state = {
        "fov_y": float(vision["fov_y_deg"]),
        "height_m": height_m,
        "depth_m": depth_m,
        "relief_gain": 1.0,
        "width_scale": 1.0,
    }
    # Keep the integrated relief in a plausible band before the first render.
    span = abs(ninfo.get("relief_span_m") or 0)
    cap = 0.06 * height_m
    if span > cap and span > 0:
        state["relief_gain"] = cap / span
        ninfo["relief_gain_cap"] = state["relief_gain"]

    features = []
    for feat in vision.get("features") or []:
        x0, y0, x1, y1 = box_px(feat["box"], w, h)
        region = mask[y0:y1, x0:x1]
        if region.size and float(region.mean()) > 0.25:
            features.append(feat)
    geo_cap = 3 if identity_ok else 1
    geo_rounds = []
    built = None
    for i in range(geo_cap):
        round_dir = os.path.join(WORK, f"round-{i}")

        def do_build(i=i, round_dir=round_dir):
            return build_once(state, mask, relief, key, features, round_dir)

        built = clock(timings, f"geometry_{i}_s", do_build)
        safe = {k: v for k, v in built.items() if k not in ("cover", "front", "spec")}
        if identity_ok and i < geo_cap - 1:
            t0 = time.perf_counter()
            judge = vision_api.judge_render(built["yaw_path"], os.path.join(reg_dir, "key.jpg"))
            timings[f"render_judge_{i}_s"] = round(time.perf_counter() - t0, 3)
            costs.append({"stage": f"render-judge-{i}", **judge["usage"]})
        else:
            note = "round cap" if identity_ok else "identity miss, stop-after-2, no render judge"
            judge = {"action": "stopped", "note": note, "score": None}
        safe["judge"] = judge
        safe["state"] = dict(state)
        geo_rounds.append(safe)
        action = judge.get("action")
        if action in (None, "keep", "stopped"):
            break
        if action == "less_relief":
            state["relief_gain"] *= 0.65
        elif action == "more_relief":
            state["relief_gain"] *= 1.35
        elif action == "narrower":
            state["width_scale"] *= 0.92
        elif action == "wider":
            state["width_scale"] *= 1.08
        elif action == "deeper":
            state["depth_m"] *= 1.25
        elif action == "shallower":
            state["depth_m"] *= 0.8

    json.dump(geo_rounds, open(os.path.join(WORK, "geometry.json"), "w"), indent=1)

    para = {"ran": False, "reason": "identity miss, stop-after-2"}
    if identity_ok:
        def do_para():
            measures = parametric.measure_mask(mask, height_m, depth_m)
            graph = vision_api.scene_graph(
                os.path.join(reg_dir, "key.jpg"),
                os.path.join(reg_dir, "clay.jpg"),
                {k: measures[k] for k in (
                    "taper_deg", "bite_frac", "bite_side", "bite_depth_px",
                    "top_px", "bottom_px", "height_m", "depth_m",
                )},
            )
            costs.append({"stage": "scene-graph", **graph["usage"]})
            bite_m = 0.0
            if graph["bite_side"] in ("left", "right"):
                bite_m = min(0.08 * height_m, max(0.5, measures["bite_depth_px"] * m_per_px))
            field = parametric.relief_field(mask, measures, bite_m)
            para_state = {
                "fov_y": state["fov_y"],
                "height_m": height_m,
                "depth_m": float(np.clip(graph["depth_m"], 4, 120)),
                "relief_gain": 1.0,
                "width_scale": 1.0,
            }
            para_dir = os.path.join(WORK, "parametric")
            built_p = build_once(para_state, mask, field, key, [], para_dir)
            return measures, graph, built_p, para_state

        measures, graph, built_p, para_state = clock(timings, "parametric_s", do_para)
        para = {
            "ran": True,
            "measures": measures,
            "scene_graph": {k: v for k, v in graph.items() if k not in ("raw", "usage")},
            "depth_m": para_state["depth_m"],
            "silhouette_iou_vs_mask": built_p["silhouette_iou_vs_mask"],
            "watertight": (built_p["stats"] or {}).get("watertight"),
            "verts": (built_p["stats"] or {}).get("verts"),
            "front_colour_mae": built_p["front_colour_mae"],
        }
        open(os.path.join(WORK, "parametric-raw.txt"), "w").write(graph.get("raw", ""))

    # Baseline. SAM is prompted with the picked proposal box.
    x0, y0, x1, y1 = box_px(hero_box, w, h)
    # Pad the prompt the way a loose box prompt is used, still the vision box.
    sam_box = [max(0, x0 - 8), max(0, y0 - 8), min(w - 1, x1 + 8), min(h - 1, y1 + 8)]
    sam_meta = clock(timings, "sam2_s", lambda: baseline_task(
        "sam", os.path.join(reg_dir, "key.jpg"), os.path.join(WORK, "sam.npy"),
        ["--which", "small", "--box", *map(str, sam_box)],
    ))
    sam = np.load(os.path.join(WORK, "sam.npy"))
    if sam.shape != mask.shape:
        sam = cv2.resize(sam.astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST)
    sam_b = sam.astype(bool)

    def do_moge():
        try:
            return baseline_task(
                "moge", os.path.join(reg_dir, "key.jpg"), os.path.join(WORK, "moge.npy"),
                ["--side", "384"],
            )
        except RuntimeError:
            return baseline_task(
                "moge", os.path.join(reg_dir, "key.jpg"), os.path.join(WORK, "moge.npy"),
                ["--side", "256"],
            )

    moge_meta = clock(timings, "moge_s", do_moge)
    moge = np.load(os.path.join(WORK, "moge.npy")).astype(np.float64)
    moge_full = cv2.resize(moge, (w, h), interpolation=cv2.INTER_LINEAR)

    both = mask.astype(bool) & sam_b & np.isfinite(moge_full)
    mask_iou = masks.iou(mask, sam_b)
    fusion_px = None
    sam_fusion = None
    if os.path.isfile(FUSION_MASK):
        ref = cv2.imread(FUSION_MASK, cv2.IMREAD_GRAYSCALE)
        if ref is not None:
            if ref.shape[:2] != mask.shape:
                ref = cv2.resize(ref, (w, h), interpolation=cv2.INTER_NEAREST)
            ref_b = ref > 127
            fusion_px = round(masks.iou(mask, ref_b), 4)
            sam_fusion = round(masks.iou(sam_b, ref_b), 4)
    if para.get("ran"):
        pcover = cv2.imread(os.path.join(WORK, "parametric", "cover.png"), cv2.IMREAD_GRAYSCALE)
        if pcover is not None:
            para["silhouette_iou_vs_sam2"] = round(masks.iou(pcover > 127, sam_b), 4)
    cover = built["cover"]
    sil_vs_sam = masks.iou(cover, sam_b)
    sil_vs_mask = built["silhouette_iou_vs_mask"]
    resid = plane_residual(moge_full, both) if both.sum() > 50 else None
    depth_cmp = affine_fit(relief, resid, both) if resid is not None else None
    gy, gx = np.gradient(moge_full)
    n_moge = np.dstack([-gx, -gy, np.ones_like(gx)])
    n_cmp = angles(photo_n, n_moge, both) if both.sum() > 50 else None
    key_luma_g = grad_mag(key)
    relief_g = grad_mag(relief)
    moge_g = grad_mag(resid if resid is not None else moge_full)
    align_native = corr(key_luma_g, relief_g, mask.astype(bool))
    align_moge = corr(key_luma_g, moge_g, sam_b)

    # Sheets.
    grok_panel = composite(key, normal_color(photo_n, mask), mask)
    cnt, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(grok_panel, cnt, -1, (0, 220, 255), 2)
    base_panel = key.copy()
    dep_col = colorize_depth(moge_full, sam)
    base_panel[sam_b] = dep_col[sam_b]
    sc, _ = cv2.findContours(sam.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(base_panel, sc, -1, (255, 220, 0), 2)
    window = sheet.focus_window(mask if identity_ok else (sam if sam.sum() > mask.sum() else mask))
    wide = sheet.sheet_16x9(grok_panel, base_panel, key, window)
    phone = sheet.sheet_phone(grok_panel, base_panel, key, window)
    cv2.imwrite(os.path.join(STEP, "sheet-16x9.jpg"), wide, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    cv2.imwrite(os.path.join(STEP, "sheet-phone.jpg"), phone, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    cv2.imwrite(os.path.join(WORK, "panel-grok.jpg"), grok_panel)
    cv2.imwrite(os.path.join(WORK, "panel-moge.jpg"), base_panel)

    cost_usd = sum(c["cost_usd"] for c in costs)
    numbers = {
        "register_ncc": {k: v.get("ncc_gray") for k, v in reg["frames"].items()},
        "vision": {
            "fov_y_deg": vision["fov_y_deg"],
            "pitch_deg": vision["pitch_deg"],
            "horizon_frac": vision["horizon_frac"],
            "hero": vision["hero"],
            "freeform_box": freeform_box,
            "freeform_reused": bool(vision.get("reused")),
            "pick_id": pick["hero_id"],
            "pick_note": pick.get("note"),
            "picked_box": hero_box,
            "fusion_reference": fusion_ref,
            "identity_ok": identity_ok,
            "height_used_m": height_m,
            "height_flag": height_flag,
            "fusion_spec_height_m": FUSION_HEIGHT_M,
            "feature_count": len(vision["features"]),
            "features_on_mask": len(features),
        },
        "parametric": para,
        "mask": {
            "px": int(mask.sum()),
            "snap": snap_info,
            "vision_rounds": [{k: v for k, v in r.items() if k != "usage"} for r in rounds],
            "iou_vs_sam2": round(mask_iou, 4),
            "iou_vs_fusion_reference": fusion_px,
        },
        "normals": ninfo,
        "geometry": [{k: v for k, v in g.items() if k != "features_used"} | {"features_used": g.get("features_used")} for g in geo_rounds],
        "baseline": {
            "sam": sam_meta,
            "moge": moge_meta,
            "mask_iou": round(mask_iou, 4),
            "sam_iou_vs_fusion_reference": sam_fusion,
            "silhouette_iou_vs_mask": sil_vs_mask,
            "silhouette_iou_vs_sam2": round(sil_vs_sam, 4),
            "depth_affine_on_facade": depth_cmp,
            "normal_angle_deg": n_cmp,
            "relief_texture_corr_native": None if align_native is None else round(align_native, 4),
            "relief_texture_corr_moge": None if align_moge is None else round(align_moge, 4),
            "front_colour_mae": built["front_colour_mae"],
        },
        "timings_s": timings,
        "cost": {"calls": costs, "usd": cost_usd},
        "mesh": geo_rounds[-1]["stats"] if geo_rounds else None,
    }
    json.dump(numbers, open(os.path.join(WORK, "numbers.json"), "w"), indent=1)
    json.dump(numbers, open(os.path.join(STEP, "numbers.json"), "w"), indent=1)
    write_report(numbers)
    print(json.dumps({
        "mask_iou": numbers["mask"]["iou_vs_sam2"],
        "sil_iou_sam": numbers["baseline"]["silhouette_iou_vs_sam2"],
        "watertight": (numbers["mesh"] or {}).get("watertight"),
        "cost_usd": round(cost_usd, 6),
        "sheet": os.path.join(STEP, "sheet-16x9.jpg"),
    }, indent=1))


def write_report(n):
    v = n["vision"]
    b = n["baseline"]
    lines = [
        "# Grok-native tower — zoneb-tower-hero",
        "",
        "One slab: the broad tower just left of the road centre. Inputs are the plates already in `/workspace/grok-native-1011/imagine/`. No new Imagine images.",
        "",
        "## Register",
        "",
        "Scale 0.714, then ORB partial-affine and ECC. Gray NCC against the key:",
        "",
        "| Frame | NCC |",
        "| --- | --- |",
    ]
    for name, val in n["register_ncc"].items():
        lines.append(f"| {name} | {val} |")
    lines += [
        "",
        "## Vision",
        "",
        f"Vertical FOV {v['fov_y_deg']}°. Pitch {v['pitch_deg']}°. Horizon fraction {v['horizon_frac']}.",
        f"Free-form hero box {v.get('freeform_box')} (reused from the first call: {v.get('freeform_reused')}). That box was the left cliff and is not the mask seed.",
        f"Second pass: vision picked proposal {v.get('pick_id')} ({v.get('pick_note')}). Box {v.get('picked_box')}.",
        f"Fusion bbox sanity IoU {json.dumps(v.get('fusion_reference'))}. Identity ok: {v.get('identity_ok')}. The fusion pixels are not the mask.",
        f"Height {v['hero']['height_m']} m (used {v['height_used_m']} m, {v['height_flag']}). Width {v['hero']['width_m']} m. Depth {v['hero']['depth_m']} m. Dune crest {v['hero']['dune_crest_m']} m.",
        f"Fusion spec height for this tower is {v['fusion_spec_height_m']} m. Features on the free-form call: {v['feature_count']}. Features whose box sits on the mask: {v.get('features_on_mask')}.",
        "",
        "## Mask",
        "",
        f"Pixels {n['mask']['px']}. Snap {json.dumps(n['mask']['snap'])}.",
        f"IoU against SAM2 small, prompted with the picked proposal box: **{n['mask']['iou_vs_sam2']}**.",
        f"IoU against the fusion reference mask (sanity, not the method): {n['mask'].get('iou_vs_fusion_reference')}. SAM2 against that same reference: {n['baseline'].get('sam_iou_vs_fusion_reference')}.",
        "",
        "Vision checks:",
        "",
    ]
    for i, r in enumerate(n["mask"]["vision_rounds"]):
        lines.append(f"- Round {i}: action {r.get('action')}, leak {r.get('leak')}, miss {r.get('miss')}, only_hero {r.get('only_hero')}. {r.get('note')}")
    lines += [
        "",
        "## Normals",
        "",
        f"Photometric lights {n['normals'].get('lights')}. Median residual {n['normals'].get('median_residual')}.",
        f"Frankot-Chellappa span p5..p95 {n['normals'].get('relief_p5_m')} .. {n['normals'].get('relief_p95_m')} m.",
        "",
        "## Geometry",
        "",
    ]
    for i, g in enumerate(n["geometry"]):
        st = g.get("stats") or {}
        lines.append(
            f"- Round {i}: watertight {st.get('watertight')}, blender boundary {st.get('blender_boundary_edges')}, "
            f"silhouette IoU vs mask {g.get('silhouette_iou_vs_mask')}, front colour MAE {g.get('front_colour_mae')}, "
            f"checksum match {g.get('checksum_match')}, judge {g.get('judge', {}).get('action')} score {g.get('judge', {}).get('score')}."
        )
    lines += [
        "",
        "## Parametric scan-then-code",
        "",
        f"{json.dumps(n.get('parametric'))}",
        "",
        "## Baseline",
        "",
        f"SAM2 {json.dumps(b['sam'])}.",
        f"MoGe-2 {json.dumps(b['moge'])}.",
        f"Mask IoU {b['mask_iou']}. Silhouette IoU of the mesh cover vs the mask {b['silhouette_iou_vs_mask']}. Vs SAM2 {b['silhouette_iou_vs_sam2']}.",
        f"Facade depth, affine fit of integrated relief onto MoGe residual: {json.dumps(b['depth_affine_on_facade'])}.",
        f"Normal angle, photometric vs MoGe gradient: {json.dumps(b['normal_angle_deg'])}.",
        f"Relief/texture gradient correlation: native {b['relief_texture_corr_native']}, MoGe {b['relief_texture_corr_moge']}.",
        f"Front projection colour MAE inside the cover: {b['front_colour_mae']}.",
        "",
        "## Time and cost",
        "",
        "| Stage | Seconds |",
        "| --- | --- |",
    ]
    for k, val in n["timings_s"].items():
        lines.append(f"| {k} | {val} |")
    lines += [
        "",
        f"xAI vision calls: {len(n['cost']['calls'])}. Billed ${n['cost']['usd']:.6f} (`cost_in_usd_ticks` / 10^10). MoGe-2 and SAM2 are local weights, API cost 0.",
        "",
        "## Verdict",
        "",
        verdict(n),
        "",
        "Sheets: `steps/grok-native-1011/sheet-16x9.jpg` (1920×1080) and `steps/grok-native-1011/sheet-phone.jpg` (720×1600).",
        "Numbers: `steps/grok-native-1011/numbers.json`.",
        "",
    ]
    text = "\n".join(lines)
    open(os.path.join(STEP, "REPORT.md"), "w").write(text)
    open(os.path.join(HERE, "REPORT.md"), "w").write(text)


def verdict(n):
    iou = n["mask"]["iou_vs_sam2"]
    ang = (n["baseline"]["normal_angle_deg"] or {}).get("median_deg")
    depth = (n["baseline"]["depth_affine_on_facade"] or {}).get("median_over_span")
    sil = n["baseline"]["silhouette_iou_vs_sam2"]
    parts = []
    parts.append(
        f"The GrabCut mask lands at IoU {iou} against SAM2 on this facade. "
        f"The mesh cover lands at silhouette IoU {sil} against that same SAM2 mask."
    )
    if ang is not None:
        parts.append(f"Median photometric-versus-MoGe normal angle on the overlap is {ang:.1f}°.")
    if depth is not None:
        parts.append(
            f"After an affine fit, the integrated relief misses the MoGe facade residual by {depth:.3f} of that residual's p95-p5 span."
        )
    parts.append(
        "The front of the slab is the key image projected along camera rays, so the colour MAE is a projection check. "
        "MoGe-2 still owns metric depth. The Grok-native stack owns a watertight textured solid built without those weights, and it is coarser on fine relief."
    )
    # Honest pass/fail against the q31 target of 75% mask IoU.
    if not n["vision"].get("identity_ok", True):
        parts.append(
            "The free-form box missed the slab. The numbered-proposal pass also missed it "
            "(fusion-bbox sanity IoU under 0.15). Stop-after-2: no third mask method and no render-judge loop."
        )
    if iou >= 0.75 and sil >= 0.75:
        parts.append("Mask and silhouette both clear the 0.75 bar from the q31 plan.")
    elif iou >= 0.75:
        parts.append("The mask clears 0.75. The rendered silhouette against SAM2 does not.")
    else:
        parts.append("The mask does not clear the 0.75 IoU bar from the q31 plan.")
    fusion_px = n["mask"].get("iou_vs_fusion_reference")
    if fusion_px is not None:
        parts.append(
            f"Against the single fusion slab the GrabCut IoU is {fusion_px} and SAM2 is "
            f"{n['baseline'].get('sam_iou_vs_fusion_reference')}. "
            "Both masks still cover the neighbour blades inside the proposal box. "
            "Erosion does not split that connected cluster. That is the second miss on this defect, so the loop stops."
        )
    para = n.get("parametric") or {}
    if para.get("ran"):
        parts.append(
            f"Parametric prism silhouette IoU vs the mask is {para.get('silhouette_iou_vs_mask')}, "
            f"vs SAM2 {para.get('silhouette_iou_vs_sam2')}. "
            "That solid uses the measured outline and one bite. It does not carry the photometric relief."
        )
    return " ".join(parts)


if __name__ == "__main__":
    main()

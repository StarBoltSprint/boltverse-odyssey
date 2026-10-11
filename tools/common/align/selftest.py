#!/usr/bin/env python3
"""Selftests for metrics, the synthetic-box camera, and CMA-ES."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile

import cv2
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
PLACE = os.path.abspath(os.path.join(HERE, "..", "..", "placement-from-key"))
if PLACE not in sys.path:
    sys.path.insert(0, PLACE)

from align.camera import constrained_focal, render_box, solve
from align.metrics import apply_vision, score, strict_score
from align.search import search


def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + ((" — " + detail) if detail else ""))
    return bool(ok)


def test_metrics():
    im = Image.new("RGB", (80, 60), (0, 0, 0))
    dr = ImageDraw.Draw(im)
    dr.rectangle([20, 10, 50, 45], fill=(220, 220, 220))
    a = np.asarray(im)
    same = score(a, a)
    ok = same["silhouette_iou"] > 0.98 and same["alignment"] > 0.9 and same["chamfer_px"] < 1.5
    b = np.zeros_like(a)
    b[:, 6:] = a[:, :-6]
    moved = score(b, a)
    ok = check("identical frames score near 1", ok, f"iou {same['silhouette_iou']} align {same['alignment']}") and ok
    ok = check("a 6 px shift lowers IoU", moved["silhouette_iou"] < same["silhouette_iou"] - 0.05, f"{moved['silhouette_iou']}") and ok
    return ok


def _hero_crop():
    key_path = "/workspace/zb-bible-1008/key-city3.jpg"
    mask_path = os.path.join(HERE, "..", "..", "..", "steps", "fusion-fix5-1011", "work", "sam-hero.npy")
    sheet_path = os.path.join(HERE, "..", "..", "..", "steps", "week2-1011", "sheet-phone.jpg")
    key = np.asarray(Image.open(key_path).convert("RGB"))
    mask = np.load(os.path.abspath(mask_path)) > 0
    if mask.shape[:2] != key.shape[:2]:
        mask = cv2.resize(mask.astype(np.uint8), (key.shape[1], key.shape[0]), interpolation=cv2.INTER_NEAREST) > 0
    ys, xs = np.where(mask)
    pad = 8
    y0, y1 = max(0, int(ys.min()) - pad), min(key.shape[0], int(ys.max()) + 1 + pad)
    x0, x1 = max(0, int(xs.min()) - pad), min(key.shape[1], int(xs.max()) + 1 + pad)
    crop = key[y0:y1, x0:x1]
    cm = mask[y0:y1, x0:x1]
    sheet = np.asarray(Image.open(os.path.abspath(sheet_path)).convert("RGB"))
    grok = sheet[36:533]
    moge = sheet[569:1066]
    return crop, cm, grok, moge


def test_strict():
    crop, cm, grok, moge = _hero_crop()
    same = strict_score(crop, crop, {"render": cm, "key": cm})
    ext = np.zeros_like(crop)
    ext[cm] = np.array([148, 138, 128], np.uint8)
    filled = strict_score(ext, crop, {"render": cm, "key": cm})
    striped = strict_score(grok, crop, {"key": cm})
    pieces = strict_score(moge, crop, {"key": cm})
    stairs = np.zeros_like(crop)
    step = max(4, crop.shape[0] // 36)
    yy = np.arange(cm.shape[0])[:, None]
    on = cm & (((yy // step) % 2) == 0)
    stairs[on] = np.array([148, 138, 128], np.uint8)
    stair = strict_score(stairs, crop, {"render": on, "key": cm})
    blocked = apply_vision(dict(same), False)
    ok = check("key crop passes strict", same["strict"] >= 0.70 and same["strict_ok"], f"{same['strict']}")
    ok = check("extruded key mask passes strict", filled["strict"] >= 0.70 and filled["strict_ok"], f"{filled['strict']}") and ok
    ok = check("week-2 striped Grok render fails strict", striped["strict"] < 0.70 and not striped["strict_ok"], f"{striped['strict']} stripe {striped['stripe']}") and ok
    ok = check("week-2 fragmented MoGe render fails strict", pieces["strict"] < 0.70 and not pieces["strict_ok"], f"{pieces['strict']} cont {pieces['continuity']}") and ok
    ok = check("stair stack fails strict", stair["strict"] < 0.70, f"{stair['strict']}") and ok
    ok = check("vision no caps a passing crop under 0.70", blocked["strict"] < 0.70 and blocked["vision"] is False, f"{blocked['strict']}") and ok
    ok = check("old alignment stays on the strict result", "alignment" in same and same["score"]["alignment"] >= 0.7, str(same.get("alignment"))) and ok
    return ok


def test_camera():
    # A pitched box. FOV within 2°, pitch within 1°.
    gray, depth, truth = render_box(640, 480, fov_y_deg=50.0, pitch_deg=12.0, yaw_deg=18.0, roll_deg=0.0, height_m=1.7)
    cam = solve(gray, depth=depth)
    fov = cam["intrinsics"]["fov_y_deg"]
    pitch = cam["extrinsics"]["pitch_deg"]
    height = cam["extrinsics"]["height_m"]
    ok = check("fov within 2 deg", abs(fov - truth["fov_y_deg"]) <= 2.0, f"got {fov:.2f} want {truth['fov_y_deg']}")
    ok = check("pitch within 1 deg", abs(pitch - truth["pitch_deg"]) <= 1.0, f"got {pitch:.2f} want {truth['pitch_deg']}") and ok
    ok = check("not a fallback", not cam.get("fallback"), f"vps {len(cam['vanishing_points'])} lines {cam['lines']}") and ok
    if height is not None:
        ok = check("height within 0.25 m", abs(height - truth["height_m"]) <= 0.25, f"got {height:.2f}") and ok
    else:
        ok = check("height recovered", False, "none") and ok
    return ok


def test_constrained():
    # Horizon above the principal point. Align pitch is positive (looking down).
    intr = constrained_focal(640, 480, horizon_v=160.0, roll_deg=0.0, prior_fov_y=62.0)
    ok = check("constrained focal is not a fallback", not intr["fallback"] and intr["method"] == "constrained-focal",
               f"fov {intr['fov_y_deg']:.1f} pitch {intr['pitch_deg']:.2f}")
    ok = check("pitch looks down when the horizon is high", intr["pitch_deg"] > 0.5, f"{intr['pitch_deg']:.2f}") and ok
    ok = check("fov stays inside the grid", 48.0 <= intr["fov_y_deg"] <= 100.0, f"{intr['fov_y_deg']:.1f}") and ok
    # A painted sky over a dune, with no Manhattan building, must not fall back to 40°.
    h, w = 180, 320
    bgr = np.zeros((h, w, 3), np.uint8)
    bgr[:70] = (180, 140, 220)
    bgr[70:] = (40, 80, 160)
    cam = solve(bgr, depth=None, image_path=None, depth_fov_y=70.0)
    ok = check("sky/dune solve does not fall back", not cam["fallback"] and cam["method"] == "constrained-focal",
               f"method {cam['method']} fov {cam['intrinsics']['fov_y_deg']:.1f} pitch {cam['extrinsics']['pitch_deg']:.2f}") and ok
    ok = check("three.js pitch is the opposite sign",
               abs(cam["extrinsics"]["pitch_three_deg"] + cam["extrinsics"]["pitch_deg"]) < 1e-6,
               str(cam["extrinsics"]["pitch_three_deg"])) and ok
    return ok


def _box_mask(uv, shape):
    img = np.zeros(shape, np.uint8)
    pts = np.round(uv).astype(np.int32)
    if len(pts) >= 3:
        cv2.fillConvexPoly(img, cv2.convexHull(pts), 1)
    return img.astype(bool)


def test_raster_matches_three():
    """A known box scores the same through geom.Cam and three.js (±0.03 IoU)."""
    from geom import Cam

    w, h = 320, 180
    fov, yaw, pitch = 58.0, 20.0, -6.0
    eye = (2.0, 3.5, 8.0)
    cam = Cam(eye[0], eye[1], eye[2], yaw, pitch, fov, w, h)
    corners = []
    for x in (0.0, 4.0):
        for y in (0.0, 6.0):
            for z in (-12.0, -8.0):
                corners.append([x, y, z])
    corners = np.asarray(corners, np.float64)
    uv, depth = cam.project(corners)
    if np.any(depth <= 0.2):
        return check("box is in front of the camera", False, "depth")
    soft = _box_mask(uv[depth > 0.2], (h, w))
    cmd = [
        "node", os.path.join(HERE, "three_project.mjs"),
        str(fov), str(w), str(h),
        str(eye[0]), str(eye[1]), str(eye[2]),
        str(yaw), str(pitch), "0.05", "500",
    ] + [str(v) for v in corners.ravel()]
    proc = subprocess.run(cmd, text=True, capture_output=True, timeout=60)
    if proc.returncode != 0:
        return check("three.js project runs", False, proc.stderr[-300:])
    raw = json.loads(proc.stdout)
    tuv = np.array(raw, np.float64).reshape(-1, 3)[:, :2]
    hard = _box_mask(tuv, (h, w))
    inter = np.logical_and(soft, hard).sum()
    union = np.logical_or(soft, hard).sum()
    iou = float(inter) / float(union) if union else 0.0
    err = abs(1.0 - iou)
    return check("software box matches three.js", err <= 0.03, f"iou {iou:.4f}")


def test_relief_uses_painted_pixels():
    from align.relief import displace
    # A side wall facing +X. The depth residual is a 0.4 m ridge on the mask.
    xs = np.linspace(0, 2, 6)
    ys = np.linspace(0, 4, 8)
    pos = np.array([[2.0, y, z] for y in ys for z in np.linspace(-6, -4, 6)], np.float64)
    # two triangles covering the wall would be many; build a grid of quads
    gw, gh = 6, 8
    faces = []
    def vid(iy, iz):
        return iy * gw + iz
    for iy in range(gh - 1):
        for iz in range(gw - 1):
            a, b, c, d = vid(iy, iz), vid(iy, iz + 1), vid(iy + 1, iz), vid(iy + 1, iz + 1)
            faces.append([a, b, d])
            faces.append([a, d, c])
    faces = np.asarray(faces, np.int32)
    h, w = 40, 40
    depth = np.full((h, w), 5.0, np.float64)
    mask = np.zeros((h, w), bool)
    mask[10:30, 10:30] = True
    depth[16:24, 16:24] = 5.4
    # Project the wall into the mask: put the camera so +X wall lands mid-frame.
    # Vertices sit at x=2, z in [-6,-4], y in [0,4]. Use a camera at origin
    # looking -Z would not see a +X wall (x is constant, z negative). Shift
    # them in front of the camera by rewriting z and x into view space.
    view = pos.copy()
    view[:, 0] = (pos[:, 2] + 5.0) * 4.0
    view[:, 1] = pos[:, 1]
    view[:, 2] = -5.0
    fx = fy = 40.0
    moved, info = displace(view, faces, depth, mask, fx, fy, 19.5, 19.5, max_m=2.0, stretch=1.3)
    return check(
        "painted residual moves the wall",
        info["hit_vertices"] > 0 and info["max_move_m"] > 0.05,
        f"hit {info['hit_vertices']} move {info['max_move_m']} gain {info['stretch_gain']}",
    )


def test_relight_is_not_a_side_plate():
    from align.relief import plate_is_side_view
    key = np.zeros((32, 48, 3), np.uint8)
    key[4:28, 16:32] = (180, 170, 160)
    key[8:14, 18:30] = (40, 40, 50)
    same = key.copy()
    same = np.clip(same.astype(np.int16) + 12, 0, 255).astype(np.uint8)
    side = np.zeros_like(key)
    side[:, :] = (20, 30, 40)
    side[4:28, 4:10] = (200, 190, 180)
    named = plate_is_side_view(side, key, name="relight-left.jpg")
    return check(
        "same-camera relight is not a side plate",
        plate_is_side_view(same, key) is False and plate_is_side_view(side, key) is True and named is False,
        "ncc gate plus relight filename",
    )


def test_search():
    # A rectangle's left edge is the unknown. Loss is the absolute pixel error.
    target = 22.0

    def objective(x):
        return abs(float(x[0]) - target) / 40.0

    log = os.path.join(tempfile.mkdtemp(), "trials.jsonl")
    out = search(objective, bounds=[[0, 40]], sigma=0.3, seed=1, popsize=6, max_evals=40, patience=3, target=0.02, log_path=log)
    rows = open(log).read().strip().splitlines()
    ok = check("cmaes finds the edge", abs(out["x"][0] - target) <= 1.5, f"x {out['x'][0]:.2f} loss {out['loss']:.3f} evals {out['evals']} solver {out['solver']}")
    ok = check("every trial is logged", len(rows) == out["evals"] and out["evals"] >= 6, f"rows {len(rows)}") and ok
    return ok


def test_symmetry():
    from align.symmetry import detect
    rect = np.zeros((40, 20), bool)
    rect[4:36, 4:16] = True
    got = detect(rect)
    ell = np.zeros((30, 30), bool)
    ell[2:28, 2:8] = True
    ell[22:28, 2:26] = True
    odd = detect(ell)
    return check(
        "symmetric rect locks a mirror, the L does not",
        got["mirror_axis"] == "x" and got["dof_drop"] >= 1 and odd["mirror_axis"] is None,
        f"rect {got} L {odd['mirror_axis']}",
    )


def test_sun():
    from align.sunlight import from_pixels
    from geom import Cam
    cam = Cam(0.0, 5.0, 20.0, 0.0, 0.0, 50.0, 200, 200)
    contact = np.array([[0.0, 0.0, 0.0]])
    shadow = np.array([[6.0, 0.0, 0.0]])
    uv_c, dep_c = cam.project(contact)
    uv_s, dep_s = cam.project(shadow)
    got = from_pixels(cam, uv_c[0], uv_s[0], 6.0)
    heading_err = abs((got["azimuthDeg"] - 270.0 + 180.0) % 360.0 - 180.0)
    return check(
        "shadow ray recovers sun azimuth and elevation",
        got["ok"] and heading_err < 3.0 and abs(got["elevationDeg"] - 45.0) < 3.0 and dep_c[0] > 0 and dep_s[0] > 0,
        f"{got}",
    )


def test_cache_and_library():
    import tempfile
    from align.stepcache import get_or_compute, nearest
    calls = {"n": 0}

    def compute():
        calls["n"] += 1
        return np.arange(6)

    with tempfile.TemporaryDirectory() as d:
        a = get_or_compute(d, b"img", {"fov": 88}, compute)
        b = get_or_compute(d, b"img", {"fov": 88}, compute)
    near = nearest(
        [{"id": "tower-a", "params": {"fov": 40, "pitch": 0}}, {"id": "tower-b", "params": {"fov": 90, "pitch": -8}}],
        {"fov": 88, "pitch": -7},
    )
    return check(
        "cache hits and the nearest library row is tower-b",
        a["hit"] is False and b["hit"] is True and calls["n"] == 1 and near["id"] == "tower-b",
        f"calls {calls['n']} near {near}",
    )


def test_orchestrator():
    import tempfile
    from align.orchestrator import run
    with tempfile.TemporaryDirectory() as d:
        logp = os.path.join(d, "jobs.jsonl")
        rows = run([
            {"name": "a", "trials": [0.5, 0.4, 0.4, 0.4, 0.4, 0.1], "patience": 3, "budget_s": 5},
            {"name": "b", "trials": [0.2, 0.1], "patience": 3, "budget_s": 5},
        ], logp, workers=2)
        by = {r["name"]: r for r in rows}
        text = open(logp).read()
    return check(
        "plateau stops the flat job and the log has both names",
        by["a"]["stopped"] == "plateau" and by["a"]["trials_run"] < 6 and "\"job\": \"b\"" in text,
        str(rows),
    )


def test_refine_pose_only():
    from align.refine import refine_pose
    def render_alignment(x):
        return max(0.0, 1.0 - abs(float(x[1]) - 1.0))
    bounds = np.array([[-5.0, 5.0], [0.4, 1.6], [-4.0, 4.0]], np.float64)
    got = refine_pose(render_alignment, [0.0, 0.55, 0.0], bounds, max_nfev=8)
    return check(
        "pose refine moves scale toward 1 and does not edit relief",
        abs(got["x"][1] - 1.0) < 0.15 and got["relief_edited"] is False and got["backend"] in ("pytorch3d", "scipy-fallback"),
        str(got),
    )


def main():
    ok = True
    ok = test_metrics() and ok
    ok = test_strict() and ok
    ok = test_camera() and ok
    ok = test_constrained() and ok
    ok = test_raster_matches_three() and ok
    ok = test_relief_uses_painted_pixels() and ok
    ok = test_relight_is_not_a_side_plate() and ok
    ok = test_search() and ok
    ok = test_symmetry() and ok
    ok = test_sun() and ok
    ok = test_cache_and_library() and ok
    ok = test_orchestrator() and ok
    ok = test_refine_pose_only() and ok
    print("align selftest", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

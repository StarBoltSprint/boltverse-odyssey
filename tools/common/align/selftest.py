#!/usr/bin/env python3
"""Selftests for metrics, the synthetic-box camera, and CMA-ES."""
from __future__ import annotations

import os
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from align.camera import render_box, solve
from align.metrics import score
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


def main():
    ok = True
    ok = test_metrics() and ok
    ok = test_camera() and ok
    ok = test_search() and ok
    print("align selftest", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

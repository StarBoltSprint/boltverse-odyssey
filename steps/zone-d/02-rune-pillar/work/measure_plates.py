#!/usr/bin/env python3
"""MoGe-2 metric depth + SAM2 masks for the four shape plates. No Imagine calls.

Run with the vision venv (torch + sam2 + moge sources):
  /workspace/.venv-sam2/bin/python measure_plates.py
"""
import json
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
sys.path.insert(0, ROOT)
os.chdir(ROOT)

from tools.common.vision_models import depth_moge, mask_sam2  # noqa: E402

PLATES = "/workspace/zd-bible-1012/pillar-plates"
OUT = os.path.dirname(os.path.abspath(__file__))
SHAPE = {
    "01-front-lower": f"{PLATES}/01-front-lower.jpg",
    "02-front-upper": f"{PLATES}/02-front-upper.jpg",
    "03-45-left": f"{PLATES}/03-45-left.jpg",
    "04-45-right": f"{PLATES}/04-45-right.jpg",
}


def stone_mask(rgb, sam):
    """SAM2 subject, tightened by rejecting the pale sky."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    sky = (b > r + 12) & (b > g) & (b > 90) & (r < 170)
    m = sam.astype(bool) & ~sky
    return m


def amber_mask(rgb, subject):
    r, g, b = rgb[..., 0].astype(np.int16), rgb[..., 1].astype(np.int16), rgb[..., 2].astype(np.int16)
    amb = (r > 95) & (r > g + 12) & (r > b + 28) & (g > 40) & subject
    return amb


def bbox(mask):
    ys, xs = np.nonzero(mask)
    if len(xs) == 0:
        return None
    return [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]


def width_at(mask, y0, y1):
    sub = mask[y0:y1]
    if sub.size == 0 or not sub.any():
        return 0
    cols = sub.any(0)
    idx = np.flatnonzero(cols)
    return int(idx[-1] - idx[0] + 1) if len(idx) else 0


def profile(mask, depth):
    h, w = mask.shape
    bb = bbox(mask)
    if not bb:
        return {"bbox": None}
    x0, y0, x1, y1 = bb
    span_h = y1 - y0 + 1
    # shaft band: middle of the subject, away from the plinth and the cap
    a, b = y0 + int(span_h * 0.38), y0 + int(span_h * 0.62)
    c, d = y0 + int(span_h * 0.08), y0 + int(span_h * 0.22)  # upper shaft / under cap
    e, f = y0 + int(span_h * 0.78), y0 + int(span_h * 0.92)  # lower shaft above plinth
    cols = []
    for x in range(0, w, 4):
        col = mask[:, x]
        if not col.any():
            cols.append(None)
            continue
        ys = np.flatnonzero(col)
        cols.append(
            {
                "x": int(x),
                "y0": int(ys[0]),
                "y1": int(ys[-1]),
                "depth": float(np.median(depth[ys, x])),
            }
        )
    inside = mask & np.isfinite(depth)
    dep = depth[inside]
    return {
        "bbox": bb,
        "heightPx": int(span_h),
        "widthPx": int(x1 - x0 + 1),
        "midWidthPx": width_at(mask, a, b),
        "upperWidthPx": width_at(mask, c, d),
        "lowerWidthPx": width_at(mask, e, f),
        "depthP10": float(np.percentile(dep, 10)) if dep.size else None,
        "depthP50": float(np.percentile(dep, 50)) if dep.size else None,
        "depthP90": float(np.percentile(dep, 90)) if dep.size else None,
        "columns": [c for c in cols if c],
    }


def main():
    report = {}
    for name, path in SHAPE.items():
        print("measure", name, flush=True)
        rgb = np.asarray(Image.open(path).convert("RGB"))
        sam, _hit, seconds_m = mask_sam2(path, which="base")
        dep, _hit_d, seconds_d = depth_moge(path, side=512, full=True)
        sam_b = np.asarray(sam).astype(bool)
        if sam_b.shape != rgb.shape[:2]:
            sam_b = np.asarray(Image.fromarray(sam_b.astype(np.uint8) * 255).resize((rgb.shape[1], rgb.shape[0]), Image.NEAREST)) > 127
        dep = np.asarray(dep, np.float32)
        if dep.shape != rgb.shape[:2]:
            dep = np.asarray(Image.fromarray(dep).resize((rgb.shape[1], rgb.shape[0]), Image.BILINEAR), np.float32)
        subject = stone_mask(rgb, sam_b)
        amb = amber_mask(rgb, subject)
        np.save(os.path.join(OUT, f"{name}-mask.npy"), subject.astype(np.uint8))
        np.save(os.path.join(OUT, f"{name}-depth.npy"), dep)
        np.save(os.path.join(OUT, f"{name}-amber.npy"), amb.astype(np.uint8))
        Image.fromarray(subject.astype(np.uint8) * 255).save(os.path.join(OUT, f"{name}-mask.png"))
        info = profile(subject, dep)
        info["amberPx"] = int(amb.sum())
        info["subjectPx"] = int(subject.sum())
        info["samSeconds"] = seconds_m
        info["mogeSeconds"] = seconds_d
        info["depthShape"] = list(dep.shape)
        # drop the dense column list from the printed summary but keep it
        report[name] = info
        print(
            name,
            "bbox",
            info["bbox"],
            "midW",
            info["midWidthPx"],
            "upperW",
            info["upperWidthPx"],
            "amber",
            info["amberPx"],
            "depth",
            round(info["depthP50"] or -1, 3),
            flush=True,
        )
    # compact summary without per-column arrays for the builder defaults
    summary = {}
    for name, info in report.items():
        summary[name] = {k: v for k, v in info.items() if k != "columns"}
        summary[name]["columnCount"] = len(info["columns"])
    json.dump({"plates": summary}, open(os.path.join(OUT, "measure.json"), "w"), indent=1)
    json.dump(report, open(os.path.join(OUT, "measure-full.json"), "w"))
    print("wrote", os.path.join(OUT, "measure.json"))


if __name__ == "__main__":
    main()

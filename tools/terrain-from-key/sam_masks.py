#!/usr/bin/env python3
"""SAM2 small masks for one key still.

Boxes are in fractions of the frame, checked against the key before the run.
Each mask is the highest-scoring SAM2 mask for that box. The overlay is for
a hand check: a mask that swallows its neighbour is rejected, not shipped.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import cv2
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "common"))
import vision_models  # noqa: E402

# x0, y0, x1, y1 in frame fractions. Tight on purpose.
BOXES = {
    "causeway": (0.34, 0.72, 0.70, 0.99),
    "arch-left": (0.08, 0.10, 0.36, 0.70),
    "arch-right": (0.78, 0.08, 0.995, 0.68),
    "cliff-left": (0.22, 0.08, 0.46, 0.62),
    "falls-water": (0.40, 0.22, 0.50, 0.62),
    "gorge-rock": (0.34, 0.22, 0.58, 0.64),
    "cliff-right": (0.58, 0.02, 0.80, 0.62),
    "foliage-left": (0.00, 0.58, 0.40, 1.00),
    "foliage-right": (0.60, 0.55, 1.00, 1.00),
    "planet": (0.42, 0.04, 0.82, 0.34),
}

# Point prompts (x, y, label). 1 keeps that pixel, 0 rejects it.
POINTS = {
    "causeway": [
        (0.50, 0.86, 1), (0.46, 0.80, 1), (0.56, 0.80, 1),
        (0.40, 0.78, 1), (0.63, 0.78, 1), (0.50, 0.75, 1), (0.50, 0.94, 1),
        (0.10, 0.88, 0), (0.90, 0.86, 0), (0.50, 0.66, 0),
        (0.32, 0.84, 0), (0.72, 0.84, 0),
    ],
    "falls-water": [
        (0.445, 0.30, 1), (0.445, 0.40, 1), (0.445, 0.50, 1),
        (0.38, 0.36, 0), (0.52, 0.40, 0), (0.445, 0.16, 0),
    ],
    "gorge-rock": [
        (0.40, 0.34, 1), (0.51, 0.36, 1), (0.48, 0.50, 1),
        (0.445, 0.34, 0), (0.445, 0.48, 0), (0.48, 0.14, 0),
    ],
    "planet": [
        (0.62, 0.16, 1), (0.55, 0.20, 1), (0.70, 0.16, 1), (0.475, 0.15, 1),
        (0.62, 0.02, 0), (0.50, 0.03, 0), (0.74, 0.03, 0),
        (0.76, 0.07, 0), (0.30, 0.08, 0), (0.88, 0.08, 0), (0.62, 0.38, 0),
    ],
    "cliff-right": [(0.735, 0.12, 1), (0.70, 0.42, 0), (0.78, 0.48, 0)],
}
# Planet, rings and moon are separate blobs. Do not drop them as "small components".
KEEP_ALL = {"planet"}
POINT_BOX = {
    "cliff-right": (0.66, 0.02, 0.80, 0.40),
    "falls-water": (0.40, 0.20, 0.50, 0.62),
    "gorge-rock": (0.34, 0.24, 0.58, 0.62),
    "causeway": (0.34, 0.72, 0.70, 0.99),
    "planet": (0.42, 0.04, 0.82, 0.34),
}

COLOURS = {
    "causeway": (220, 190, 60),
    "arch-left": (70, 150, 255),
    "arch-right": (255, 120, 40),
    "cliff-left": (40, 180, 120),
    "falls-water": (230, 245, 255),
    "gorge-rock": (90, 160, 150),
    "cliff-right": (200, 80, 180),
    "foliage-left": (30, 140, 40),
    "foliage-right": (80, 180, 50),
    "planet": (255, 70, 70),
}


def _union_covering(masks, scores, xy, labels):
    """Union the best mask for each positive point, so rings and the moon survive."""
    order = list(np.argsort(-scores))
    acc = np.zeros(masks[0].shape, np.bool_)
    positives = xy[labels == 1]
    for px, py in positives:
        ix, iy = int(px), int(py)
        chosen = None
        for k in order:
            m = masks[k].astype(bool)
            if 0 <= iy < m.shape[0] and 0 <= ix < m.shape[1] and m[iy, ix]:
                # reject a candidate that also covers a negative point
                neg = xy[labels == 0]
                hit_neg = False
                for nx, ny in neg:
                    nix, niy = int(nx), int(ny)
                    if 0 <= niy < m.shape[0] and 0 <= nix < m.shape[1] and m[niy, nix]:
                        hit_neg = True
                        break
                if not hit_neg:
                    chosen = m
                    break
        if chosen is None:
            for k in order:
                m = masks[k].astype(bool)
                if 0 <= iy < m.shape[0] and 0 <= ix < m.shape[1] and m[iy, ix]:
                    chosen = m
                    break
        if chosen is not None:
            acc |= chosen
    return acc


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--max-side", type=int, default=1024)
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    im = Image.open(args.image).convert("RGB")
    w, h = im.size
    scale = min(1.0, args.max_side / max(w, h))
    if scale < 1:
        im = im.resize((int(round(w * scale)), int(round(h * scale))), Image.Resampling.LANCZOS)
    rgb = np.asarray(im)
    ih, iw = rgb.shape[:2]
    pred = vision_models.load_sam2("small")
    pred.set_image(rgb)
    overlay = rgb.astype(np.float32)
    rows = []
    for name, (x0, y0, x1, y1) in BOXES.items():
        if name in POINTS:
            pts = POINTS[name]
            xy = np.array([[p[0] * iw, p[1] * ih] for p in pts], np.float32)
            labels = np.array([p[2] for p in pts], np.int32)
            kw = dict(point_coords=xy, point_labels=labels, multimask_output=True)
            if name in POINT_BOX:
                b = POINT_BOX[name]
                kw["box"] = np.array([b[0] * iw, b[1] * ih, b[2] * iw, b[3] * ih], np.float32)
            masks, scores, _ = pred.predict(**kw)
            if name == "planet":
                mask = np.zeros((ih, iw), np.bool_)
                neg = xy[labels == 0]
                best_scores = []
                for px, py in xy[labels == 1]:
                    one = np.concatenate([np.array([[px, py]], np.float32), neg], axis=0)
                    one_labels = np.concatenate([np.array([1], np.int32), np.zeros(len(neg), np.int32)])
                    kw = dict(point_coords=one, point_labels=one_labels, multimask_output=True)
                    b = POINT_BOX["planet"]
                    kw["box"] = np.array([b[0] * iw, b[1] * ih, b[2] * iw, b[3] * ih], np.float32)
                    masks, scores, _ = pred.predict(**kw)
                    piece = _union_covering(masks, scores, one, one_labels)
                    mask |= piece
                    best_scores.append(float(np.max(scores)))
                scores = np.array(best_scores if best_scores else [0.0])
            else:
                k = int(np.argmax(scores))
                mask = masks[k].astype(bool)
                scores = scores
                k = k
        else:
            box = np.array([x0 * iw, y0 * ih, x1 * iw, y1 * ih], np.float32)
            masks, scores, _ = pred.predict(box=box, multimask_output=True)
            k = int(np.argmax(scores))
            mask = masks[k].astype(bool)
        if name not in KEEP_ALL:
            nlab, labels, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
            if nlab > 1:
                keep = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
                mask = labels == keep
        score = float(np.max(scores))
        if name == "causeway":
            # Fill gaps between slabs. Close does not grow the outer lip.
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31))
            mask = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_CLOSE, kernel).astype(bool)
            flood = np.pad(mask.astype(np.uint8), 1, constant_values=0)
            cv2.floodFill(flood, np.zeros((flood.shape[0] + 2, flood.shape[1] + 2), np.uint8), (0, 0), 2)
            holes = flood[1:-1, 1:-1] == 0
            mask = mask | holes
        area = float(mask.mean())
        Image.fromarray((mask.astype(np.uint8) * 255)).save(args.out / f"mask-{name}.png")
        colour = np.array(COLOURS[name], np.float32)
        overlay[mask] = overlay[mask] * 0.45 + colour * 0.55
        rows.append({"id": name, "box": [x0, y0, x1, y1], "score": score, "area": area})
        print(name, "score", round(score, 3), "area", round(area, 3), flush=True)
    Image.fromarray(overlay.astype(np.uint8)).save(args.out / "masks-overlay.jpg", quality=90)
    (args.out / "masks.json").write_text(json.dumps({"model": "sam2.1-hiera-small", "licence": "Apache-2.0", "size": [iw, ih], "masks": rows}, indent=2))


if __name__ == "__main__":
    main()

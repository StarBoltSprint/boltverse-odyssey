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
    "causeway": (0.40, 0.73, 0.64, 0.98),
    "arch-left": (0.08, 0.10, 0.36, 0.70),
    "arch-right": (0.78, 0.08, 0.995, 0.68),
    "cliff-left": (0.22, 0.08, 0.46, 0.62),
    "falls-center": (0.36, 0.18, 0.52, 0.62),
    "cliff-right": (0.58, 0.02, 0.80, 0.62),
    "foliage-left": (0.00, 0.58, 0.40, 1.00),
    "foliage-right": (0.60, 0.55, 1.00, 1.00),
    "planet": (0.42, 0.00, 0.82, 0.40),
}

# Point prompts (x, y, label) that replaced a loose box after the hand check.
# Planet: the disk only, not the sky. Right spire: the tall shaft, not the lower mass.
POINTS = {
    "planet": [(0.615, 0.16, 1), (0.72, 0.04, 0), (0.50, 0.06, 0), (0.78, 0.12, 0)],
    "cliff-right": [(0.735, 0.12, 1), (0.70, 0.42, 0), (0.78, 0.48, 0)],
}
POINT_BOX = {
    "cliff-right": (0.66, 0.02, 0.80, 0.40),
}

COLOURS = {
    "causeway": (220, 190, 60),
    "arch-left": (70, 150, 255),
    "arch-right": (255, 120, 40),
    "cliff-left": (40, 180, 120),
    "falls-center": (180, 220, 255),
    "cliff-right": (200, 80, 180),
    "foliage-left": (30, 140, 40),
    "foliage-right": (80, 180, 50),
    "planet": (255, 230, 180),
}


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
        else:
            box = np.array([x0 * iw, y0 * ih, x1 * iw, y1 * ih], np.float32)
            masks, scores, _ = pred.predict(box=box, multimask_output=True)
        k = int(np.argmax(scores))
        mask = masks[k].astype(bool)
        nlab, labels, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
        if nlab > 1:
            keep = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
            mask = labels == keep
        area = float(mask.mean())
        Image.fromarray((mask.astype(np.uint8) * 255)).save(args.out / f"mask-{name}.png")
        colour = np.array(COLOURS[name], np.float32)
        overlay[mask] = overlay[mask] * 0.45 + colour * 0.55
        rows.append({"id": name, "box": [x0, y0, x1, y1], "score": float(scores[k]), "area": area})
        print(name, "score", round(float(scores[k]), 3), "area", round(area, 3), flush=True)
    Image.fromarray(overlay.astype(np.uint8)).save(args.out / "masks-overlay.jpg", quality=90)
    (args.out / "masks.json").write_text(json.dumps({"model": "sam2.1-hiera-small", "licence": "Apache-2.0", "size": [iw, ih], "masks": rows}, indent=2))


if __name__ == "__main__":
    main()

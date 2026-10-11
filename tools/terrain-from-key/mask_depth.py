"""Ground mask and Depth Anything V2 (CPU) on the key frame."""

from __future__ import annotations

import os
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image

MEAN = np.array([0.485, 0.456, 0.406], np.float32)
STD = np.array([0.229, 0.224, 0.225], np.float32)
MODEL = Path(os.environ.get("DEPTH_MODEL", "/workspace/grokcli/models/depth_anything_v2_small.onnx"))


def load_rgb(path: Path) -> np.ndarray:
    im = Image.open(path).convert("RGB")
    return np.asarray(im)


def _box_mask(h: int, w: int, box) -> np.ndarray:
    x, y, bw, bh = box
    x0, y0 = int(x * w), int(y * h)
    x1, y1 = int((x + bw) * w), int((y + bh) * h)
    m = np.zeros((h, w), np.bool_)
    m[max(0, y0) : max(0, y1), max(0, x0) : max(0, x1)] = True
    return m


def color_parts(rgb: np.ndarray):
    r = rgb[..., 0].astype(np.float32)
    g = rgb[..., 1].astype(np.float32)
    b = rgb[..., 2].astype(np.float32)
    luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
    sand = (r > 88) & (r > b + 14) & (g > 42) & (r + 8 > g)
    sky = (b + 6 > r) & (luma > 70) & (g > 40) & ~sand
    dark = luma < 48
    return sand, sky, dark, luma


def horizon_row(ground: np.ndarray) -> float:
    """Avenue vanishing row from the centre of the ground mask, not the sun and not the side dunes."""
    h, w = ground.shape
    x0, x1 = int(w * 0.46), int(w * 0.54)
    tops = []
    for x in range(x0, x1):
        ys = np.where(ground[:, x])[0]
        if ys.size == 0:
            continue
        y = int(ys[0])
        if 0.36 * h < y < 0.62 * h:
            tops.append(y)
    if len(tops) < 8:
        return 0.48
    return float(np.median(tops) + 0.5) / h


def ground_mask(rgb: np.ndarray, features: dict) -> tuple[np.ndarray, np.ndarray, float]:
    """Return (ground, tower_columns, horizon_row_frac).

    Ground is sand plus the dark slab lane, minus sky, minus the exclude boxes
    (mesas, wreck, upper sky). Towers are dark vertical masses.
    """
    h, w = rgb.shape[:2]
    sand, sky, dark, luma = color_parts(rgb)
    excl = np.zeros((h, w), np.bool_)
    for item in features.get("exclude", []):
        excl |= _box_mask(h, w, item["box"])
    # dark slabs: lower centre, not the tower silhouettes
    yy = np.arange(h)[:, None]
    xx = np.arange(w)[None, :]
    slabs = dark & (yy > int(h * 0.58)) & (np.abs(xx - w * 0.5) < w * 0.20)
    # The sun is warm. A bright pixel in the upper half is sky, not sand.
    sun = (luma > 170) & (yy < int(h * 0.55))
    ground = (sand | slabs) & ~sky & ~sun & ~excl
    ground[: int(h * 0.30), :] = False
    towers = dark & ~slabs & (yy < int(h * 0.78))
    tower_cols = towers.mean(axis=0) > 0.18
    return ground, tower_cols, horizon_row(ground)


def infer_disp(rgb: np.ndarray) -> np.ndarray:
    """Relative disparity, larger = closer, full image size. CPU ORT."""
    sess = ort.InferenceSession(str(MODEL), providers=["CPUExecutionProvider"])
    h, w = rgb.shape[:2]
    # 14-pixel grid keeps the ONNX output aligned; 672x378 is the small model at ~half key.
    tw, th = 672, 378
    im = Image.fromarray(rgb).resize((tw, th), Image.Resampling.LANCZOS)
    arr = np.asarray(im).astype(np.float32) / 255.0
    arr = (arr - MEAN) / STD
    ten = np.transpose(arr, (2, 0, 1))[None].astype(np.float32)
    pred = sess.run(None, {"pixel_values": ten})[0][0].astype(np.float32)
    # predicted_depth for this export is disparity-like (near is high). Keep the sign
    # if the bottom band is nearer than the horizon band; flip otherwise.
    ph, pw = pred.shape
    band = pred[int(ph * 0.82) :, int(pw * 0.35) : int(pw * 0.65)].mean()
    far = pred[int(ph * 0.42) : int(ph * 0.52), int(pw * 0.42) : int(pw * 0.58)].mean()
    if band < far:
        pred = -pred
    pred = pred - np.percentile(pred, 2)
    pred = pred / (np.percentile(pred, 98) + 1e-6)
    pred = np.clip(pred, 0, 1)
    up = Image.fromarray((pred * 255).astype(np.uint8), "L").resize((w, h), Image.Resampling.BILINEAR)
    return np.asarray(up).astype(np.float32) / 255.0

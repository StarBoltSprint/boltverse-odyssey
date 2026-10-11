#!/usr/bin/env python3
"""Render-vs-key metrics.

score(render, key, masks, weights) returns soft silhouette IoU, symmetric
edge Chamfer, edge precision/recall at 2 px, and an optional Lab residual.
`alignment` is min(precision, recall) at 2 px. The object gate reads that
number as `overlap` and keeps the bar at 0.70.

  python3 tools/common/align/metrics.py --render r.png --key k.png --out dir
"""
from __future__ import annotations

import argparse
import json
import os

import cv2
import numpy as np
from PIL import Image

try:
    from skimage.color import rgb2lab
except Exception:  # pragma: no cover
    rgb2lab = None


def _rgb(image):
    if isinstance(image, str):
        im = Image.open(image).convert("RGB")
        return np.asarray(im)
    arr = np.asarray(image)
    if arr.ndim == 2:
        arr = np.stack([arr, arr, arr], -1)
    if arr.shape[-1] == 4:
        arr = arr[..., :3]
    if arr.dtype != np.uint8:
        a = arr.astype(np.float32)
        if a.max() <= 1.0:
            a = a * 255.0
        arr = np.clip(a, 0, 255).astype(np.uint8)
    return arr


def _mask(mask, shape):
    if mask is None:
        return None
    if isinstance(mask, str):
        m = np.asarray(Image.open(mask).convert("L"))
    else:
        m = np.asarray(mask)
        if m.ndim == 3:
            m = m[..., 0]
    if m.dtype != np.float32 and m.dtype != np.float64:
        m = m.astype(np.float32)
        if m.max() > 1.0:
            m = m / 255.0
    else:
        m = m.astype(np.float32)
        if m.max() > 1.0:
            m = m / 255.0
    if m.shape[:2] != shape[:2]:
        m = cv2.resize(m, (shape[1], shape[0]), interpolation=cv2.INTER_LINEAR)
    return np.clip(m, 0.0, 1.0)


def _edges(rgb, mask=None):
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 40, 120) > 0
    if mask is not None:
        edges &= mask > 0.25
    return edges


def soft_iou(a, b):
    inter = float(np.minimum(a, b).sum())
    union = float(np.maximum(a, b).sum())
    if union <= 1e-6:
        return 0.0
    return inter / union


def _chamfer(src, dst):
    """Mean distance in px from src edge pixels to dst edges."""
    if not src.any():
        return None
    inv = np.where(dst, 0, 255).astype(np.uint8)
    dt = cv2.distanceTransform(inv, cv2.DIST_L2, 3)
    return float(dt[src].mean()), dt


def _lab_residual(render, key, overlap):
    if rgb2lab is None or int(overlap.sum()) < 16:
        return None
    r = rgb2lab(render.astype(np.float32) / 255.0)
    k = rgb2lab(key.astype(np.float32) / 255.0)
    d = np.abs(r - k).mean(axis=2)
    return float(d[overlap].mean())


def score(render, key, masks=None, weights=None):
    """render/key are RGB arrays or paths. masks is {render, key} or None.

    weights keys: iou, chamfer, colour. They build `objective` in [0, 1],
    higher is better. Chamfer is normalised by the frame diagonal.
    """
    masks = masks or {}
    weights = weights or {"iou": 0.55, "chamfer": 0.35, "colour": 0.10}
    ren = _rgb(render["rgb"] if isinstance(render, dict) else render)
    ky = _rgb(key["rgb"] if isinstance(key, dict) else key)
    if ky.shape[:2] != ren.shape[:2]:
        ky = cv2.resize(ky, (ren.shape[1], ren.shape[0]), interpolation=cv2.INTER_AREA)
    rm = _mask(masks.get("render") if not isinstance(render, dict) else masks.get("render", render.get("mask")), ren.shape)
    km = _mask(masks.get("key") if not isinstance(key, dict) else masks.get("key", key.get("mask")), ren.shape)
    if rm is None:
        rm = (ren.max(axis=2) > 8).astype(np.float32)
    if km is None:
        km = (ky.max(axis=2) > 8).astype(np.float32)
    iou = soft_iou(rm, km)
    er = _edges(ren, rm)
    ek = _edges(ky, km)
    diag = float(np.hypot(*ren.shape[:2]))
    cr = _chamfer(er, ek)
    ck = _chamfer(ek, er)
    if cr is None or ck is None:
        chamfer_px = diag
        prec = 0.0
        rec = 0.0
        dt_k = None
    else:
        chamfer_px = 0.5 * (cr[0] + ck[0])
        dt_k = cr[1]
        prec = float((dt_k[er] <= 2.0).mean()) if er.any() else 0.0
        rec = float((ck[1][ek] <= 2.0).mean()) if ek.any() else 0.0
    alignment = float(min(prec, rec))
    overlap = (rm > 0.5) & (km > 0.5)
    colour = _lab_residual(ren, ky, overlap)
    chamfer_n = float(chamfer_px / diag) if diag else 1.0
    wsum = float(weights.get("iou", 0) + weights.get("chamfer", 0) + (weights.get("colour", 0) if colour is not None else 0))
    if wsum <= 0:
        wsum = 1.0
    colour_term = 0.0 if colour is None else max(0.0, 1.0 - colour / 40.0)
    objective = (
        weights.get("iou", 0) * iou
        + weights.get("chamfer", 0) * (1.0 - min(1.0, chamfer_n * 8.0))
        + (weights.get("colour", 0) if colour is not None else 0) * colour_term
    ) / wsum
    return {
        "silhouette_iou": round(float(iou), 4),
        "chamfer_px": round(float(chamfer_px), 3),
        "chamfer_norm": round(float(chamfer_n), 4),
        "edge_precision_2px": round(float(prec), 4),
        "edge_recall_2px": round(float(rec), 4),
        "alignment": round(alignment, 4),
        "overlap": round(alignment, 4),
        "ok": bool(alignment >= 0.70),
        "colour_lab": None if colour is None else round(float(colour), 3),
        "objective": round(float(objective), 4),
        "render_edges": int(er.sum()),
        "key_edges": int(ek.sum()),
        "tolPx": 2,
    }


def heatmaps(render, key, masks, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    ren = _rgb(render["rgb"] if isinstance(render, dict) else render)
    ky = _rgb(key["rgb"] if isinstance(key, dict) else key)
    if ky.shape[:2] != ren.shape[:2]:
        ky = cv2.resize(ky, (ren.shape[1], ren.shape[0]), interpolation=cv2.INTER_AREA)
    rm = _mask(None if not isinstance(render, dict) else render.get("mask"), ren.shape)
    km = _mask((masks or {}).get("key"), ren.shape)
    if rm is None:
        rm = (ren.max(axis=2) > 8).astype(np.float32)
    if km is None:
        km = (ky.max(axis=2) > 8).astype(np.float32)
    if masks and masks.get("render") is not None and not isinstance(render, dict):
        rm = _mask(masks.get("render"), ren.shape)
    if masks and masks.get("key") is not None:
        km = _mask(masks.get("key"), ren.shape)
    diff = np.clip(np.abs(rm - km) * 255, 0, 255).astype(np.uint8)
    cv2.imwrite(os.path.join(out_dir, "heatmap-iou.jpg"), cv2.applyColorMap(diff, cv2.COLORMAP_INFERNO))
    er = _edges(ren, rm)
    ek = _edges(ky, km)
    inv = np.where(ek, 0, 255).astype(np.uint8)
    dt = cv2.distanceTransform(inv, cv2.DIST_L2, 3)
    heat = np.zeros(ren.shape[:2], np.uint8)
    if er.any():
        heat[er] = np.clip(dt[er] * 8, 0, 255).astype(np.uint8)
    cv2.imwrite(os.path.join(out_dir, "heatmap-chamfer.jpg"), cv2.applyColorMap(heat, cv2.COLORMAP_VIRIDIS))
    if rgb2lab is not None:
        r = rgb2lab(ren.astype(np.float32) / 255.0)
        k = rgb2lab(ky.astype(np.float32) / 255.0)
        d = np.clip(np.abs(r - k).mean(axis=2) * 4, 0, 255).astype(np.uint8)
        cv2.imwrite(os.path.join(out_dir, "heatmap-colour.jpg"), cv2.applyColorMap(d, cv2.COLORMAP_MAGMA))
    return out_dir


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--render", required=True)
    ap.add_argument("--key", required=True)
    ap.add_argument("--mask-render")
    ap.add_argument("--mask-key")
    ap.add_argument("--out", default="")
    a = ap.parse_args(argv)
    masks = {"render": a.mask_render, "key": a.mask_key}
    sc = score(a.render, a.key, masks)
    if a.out:
        heatmaps(a.render, a.key, masks, a.out)
        json.dump(sc, open(os.path.join(a.out, "score.json"), "w"), indent=1)
    print(json.dumps(sc, indent=1))
    return 0 if sc["alignment"] >= 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Silhouette IoU of a render against the SAM instance masks, inside each mask box."""

from __future__ import annotations

import numpy as np
from PIL import Image

from geom import iou


def _structure(rgb: np.ndarray) -> np.ndarray:
    """Not sky and not sand. Lit towers stay in. Dunes stay out."""
    r = rgb[..., 0].astype(np.float32)
    g = rgb[..., 1].astype(np.float32)
    b = rgb[..., 2].astype(np.float32)
    L = 0.2126 * r + 0.7152 * g + 0.0722 * b
    sky = (b > 1.03 * g) & (L > 40)
    sand = (r > g * 1.08) & (g > b * 1.05) & (L > 70)
    return ~sky & ~sand


def score_render(png: str, labels: np.ndarray, instances: list) -> dict:
    im = np.asarray(Image.open(png).convert("RGB"))
    if im.shape[1] != labels.shape[1] or im.shape[0] != labels.shape[0]:
        im = np.asarray(Image.fromarray(im).resize((labels.shape[1], labels.shape[0]), Image.Resampling.BILINEAR))
    dark = _structure(im)
    rows = []
    union_k = np.zeros(labels.shape, bool)
    union_g = np.zeros(labels.shape, bool)
    weight = 0.0
    acc = 0.0
    for inst in instances:
        if inst.get("kind") in ("sun", "moon") or not inst.get("lift", True):
            continue
        if inst.get("status") not in (None, "lifted") and "label" not in inst:
            continue
        label = inst.get("label")
        if not label:
            continue
        key = labels == int(label)
        if key.sum() < 20:
            continue
        ys, xs = np.nonzero(key)
        y0, y1 = max(0, int(ys.min()) - 8), min(labels.shape[0], int(ys.max()) + 9)
        x0, x1 = max(0, int(xs.min()) - 8), min(labels.shape[1], int(xs.max()) + 9)
        window = np.zeros(labels.shape, bool)
        window[y0:y1, x0:x1] = True
        game = dark & window
        val = iou(key, game)
        area = int(key.sum())
        rows.append({"id": inst["id"], "kind": inst.get("kind"), "iou": round(val, 4), "pixels": area})
        union_k |= key
        union_g |= game
        acc += val * area
        weight += area
    overall = acc / weight if weight else 0.0
    union = iou(union_k, union_g)
    order = _depth_order(rows, instances)
    placed = placed_iou_from_rows(rows)
    return {
        "perObject": rows,
        "overallWeighted": round(overall, 4),
        "placedWeighted": round(placed, 4),
        "union": round(union, 4),
        "depthOrder": order,
        "frame": frame_stats(im),
    }


def placed_iou_from_rows(rows) -> float:
    """Decision score. Wreck, arch, rail, and slab have no movable mesh, so they stay out."""
    keep = [r for r in rows if r.get("kind") in ("tower", "spire", "mesa")]
    weight = sum(r["pixels"] for r in keep)
    if not weight:
        return 0.0
    return sum(r["iou"] * r["pixels"] for r in keep) / weight


def frame_stats(rgb: np.ndarray) -> dict:
    r = rgb[..., 0].astype(np.float32)
    g = rgb[..., 1].astype(np.float32)
    b = rgb[..., 2].astype(np.float32)
    L = 0.2126 * r + 0.7152 * g + 0.0722 * b
    sky = (b > 1.03 * g) & (L > 40)
    top = sky[: max(1, int(rgb.shape[0] * 0.45))]
    return {"luma": round(float(L.mean()), 2), "skyTop": round(float(top.mean()), 4)}


def frame_rejected(score: dict, before: dict) -> str | None:
    """The rock-wall render scored as structure inside every box and had no sky."""
    f, b = score["frame"], before["frame"]
    if b["skyTop"] > 0.02 and f["skyTop"] < 0.45 * b["skyTop"]:
        return "sky collapsed"
    if b["luma"] > 1 and f["luma"] < 0.55 * b["luma"]:
        return "frame went dark"
    return None


def _depth_order(rows, instances):
    """Closer in the picture is a lower mask bottom (larger v). Report the image order."""
    seq = []
    for inst in instances:
        box = inst.get("maskBox") or inst.get("box")
        if not box or inst.get("kind") in ("sun", "moon"):
            continue
        seq.append((box[3], inst["id"], inst.get("kind")))
    seq.sort(reverse=True)
    return [{"id": i, "kind": k, "bottom": b} for b, i, k in seq]

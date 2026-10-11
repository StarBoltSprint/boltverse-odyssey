"""Relief-texture alignment.

Edge overlap of an untextured relief render and an unlit albedo render.
A relief edge must sit within about 2 px of a texture edge, and the reverse.
Score is the min of the two precisions. FAIL under 0.70.
"""
import numpy as np
from PIL import Image, ImageFilter


def _luma(im):
    a = np.asarray(im.convert("RGB"), np.float32) / 255.0
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]


def _edges(im):
    y = _luma(im)
    blur = np.asarray(Image.fromarray((np.clip(y, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1)), np.float32) / 255.0
    gy, gx = np.gradient(blur)
    g = np.hypot(gx, gy)
    thr = float(np.percentile(g, 92))
    thr = max(thr, 0.02)
    return g >= thr


def _dilate(b, tol):
    im = Image.fromarray(b.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(tol * 2 + 1))
    return np.asarray(im) > 127


def overlap(relief_img, albedo_img, tol=2, min_score=0.70):
    """Edge agreement of a relief render against the albedo (or the key).

    The number is tools/common/align/metrics.py `alignment`: min of Canny
    edge precision and recall at 2 px. The object gate reads `overlap`,
    which is that alignment, and keeps the bar at 0.70.
    """
    import os
    import sys
    common = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "common"))
    if common not in sys.path:
        sys.path.insert(0, common)
    from align.metrics import score as metric_score

    if isinstance(relief_img, str):
        r = Image.open(relief_img).convert("RGB")
    else:
        r = relief_img.convert("RGB")
    if isinstance(albedo_img, str):
        a = Image.open(albedo_img).convert("RGB")
    else:
        a = albedo_img.convert("RGB")
    if a.size != r.size:
        a = a.resize(r.size, Image.BILINEAR)
    sc = metric_score(np.asarray(r), np.asarray(a))
    if sc["render_edges"] < 8 or sc["key_edges"] < 8:
        return dict(ok=False, overlap=0.0, reason="too few edges",
                    reliefEdges=sc["render_edges"], textureEdges=sc["key_edges"], tolPx=tol,
                    alignment=0.0, silhouette_iou=sc["silhouette_iou"], chamfer_px=sc["chamfer_px"])
    align = float(sc["alignment"])
    return dict(ok=bool(align >= min_score), overlap=round(align, 4), alignment=round(align, 4),
                precisionRelief=sc["edge_precision_2px"], precisionTexture=sc["edge_recall_2px"],
                reliefEdges=sc["render_edges"], textureEdges=sc["key_edges"], tolPx=tol,
                silhouette_iou=sc["silhouette_iou"], chamfer_px=sc["chamfer_px"], colour_lab=sc["colour_lab"])


def save_overlay(path, relief_img, albedo_img, tol=2):
    r = Image.open(relief_img).convert("RGB") if isinstance(relief_img, str) else relief_img.convert("RGB")
    a = Image.open(albedo_img).convert("RGB") if isinstance(albedo_img, str) else albedo_img.convert("RGB")
    if a.size != r.size:
        a = a.resize(r.size, Image.BILINEAR)
    er = _edges(r)
    ea = _edges(a)
    rgb = np.asarray(a, np.uint8).copy()
    rgb[ea] = (40, 220, 80)
    rgb[er] = (220, 40, 40)
    both = er & _dilate(ea, tol)
    rgb[both] = (240, 220, 40)
    Image.fromarray(rgb).save(path)
    return path

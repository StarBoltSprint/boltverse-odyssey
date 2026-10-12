#!/usr/bin/env python3
"""Metric relief volumes for a Zone C solid.

The object mask is the SAM2 mask from step #200. Ledge, frame, and vegetation
bands are read from the key image (horizontal structure inside that mask) and
from MoGe-2 depth already in metres. Each band is a protrusion in metres, snapped
to the mask outline, then blurred so the volume is a solid ledge and not a
per-pixel spike. This module does not call Imagine.
"""

from __future__ import annotations

import numpy as np

try:
    import cv2
except ImportError:  # pragma: no cover
    cv2 = None


def _rows(mask: np.ndarray):
    ys = np.where(mask.any(axis=1))[0]
    xs = np.where(mask.any(axis=0))[0]
    if len(ys) < 8 or len(xs) < 8:
        return None
    return int(ys[0]), int(ys[-1]), int(xs[0]), int(xs[-1])


def _band_weight(h: int, cy: int, half: int) -> np.ndarray:
    yy = np.arange(h, dtype=np.float32)[:, None]
    dist = np.abs(yy - float(cy)) / float(max(half, 1))
    return np.clip(1.0 - dist, 0.0, 1.0) ** 2


def _depth_step(depth: np.ndarray, mask: np.ndarray, cy: int, half: int) -> float:
    h = depth.shape[0]
    a0, a1 = max(0, cy - 2 * half), max(0, cy - half // 2)
    b0, b1 = min(h, cy + half // 2), min(h, cy + 2 * half)
    above = depth[a0:a1][mask[a0:a1]] if a1 > a0 else np.array([])
    below = depth[b0:b1][mask[b0:b1]] if b1 > b0 else np.array([])
    above = above[np.isfinite(above)]
    below = below[np.isfinite(below)]
    if above.size < 8 or below.size < 8:
        return 0.0
    return abs(float(np.median(below) - np.median(above)))


def feature_field(name: str, mask: np.ndarray, key_rgb: np.ndarray, depth: np.ndarray):
    """Return (field metres HxW, feature records). Field is 0 outside the mask."""
    mask = mask.astype(bool)
    field = np.zeros(mask.shape, np.float32)
    records = []
    span = _rows(mask)
    if span is None:
        return field, records
    y0, y1, x0, x1 = span
    height = max(1, y1 - y0)
    # Vision: strong horizontal edges inside the SAM2 mask (cornice, ledge, talus).
    if cv2 is not None and key_rgb is not None:
        gray = cv2.cvtColor(key_rgb, cv2.COLOR_RGB2GRAY)
        gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=5)
        gy = np.abs(gy)
        gy = cv2.GaussianBlur(gy, (0, 0), 3)
    else:
        gy = np.zeros(mask.shape, np.float32)
    specs = (
        (0.16, "cornice", 1.6),
        (0.42, "ledge", 1.15),
        (0.70, "talus", 0.75),
    )
    for frac, kind, floor_m in specs:
        cy = int(y0 + frac * height)
        # Snap the band centre to the strongest horizontal edge within ±8% of the span.
        win = max(4, int(height * 0.08))
        lo, hi = max(y0, cy - win), min(y1, cy + win)
        col = gy[lo:hi]
        if col.size and mask[lo:hi].any():
            score = (col * mask[lo:hi]).sum(axis=1)
            if float(score.max()) > 0:
                cy = lo + int(np.argmax(score))
        half = max(5, height // 22)
        delta = _depth_step(depth, mask, cy, half) if depth is not None else 0.0
        # MoGe step across the edge, never a centimetre ripple. Floor keeps a readable volume.
        prot = float(np.clip(max(floor_m, min(delta, 2.6)), 0.55, 2.6))
        w = _band_weight(mask.shape[0], cy, half)
        band = (w * prot).astype(np.float32) * mask
        field = np.maximum(field, band)
        ys = np.where(band.max(axis=1) > 0.15)[0]
        xs = np.where(band.max(axis=0) > 0.15)[0]
        records.append({
            "id": f"{name}-{kind}",
            "object": name,
            "kind": kind,
            "xy": [int(xs[0]), int(ys[0]), int(xs[-1]), int(ys[-1])] if len(xs) and len(ys) else [x0, cy - half, x1, cy + half],
            "protrusionM": round(prot, 3),
            "depthStepM": round(float(delta), 3),
            "mask": "SAM2 step #200 object mask",
            "placedBy": "key horizontal edge snapped inside the SAM2 outline; metres from MoGe-2",
        })
    if name.startswith("arch"):
        records.extend(_frame(name, mask, field))
    if name in ("cliff-left", "cliff-right", "gorge-rock"):
        _vegetation(name, mask, field, records, y0, y1, x0, x1)
    if cv2 is not None:
        blurred = cv2.GaussianBlur(field, (0, 0), 7)
        field = np.where(mask, np.maximum(field * 0.35, blurred), 0).astype(np.float32)
    else:
        field = np.where(mask, field, 0).astype(np.float32)
    return field, records


def _frame(name, mask, field):
    """Carved opening: a proud frame on the SAM2 hole ring."""
    if cv2 is None:
        return []
    inv = (~mask).astype(np.uint8)
    h, w = mask.shape
    painted = inv.copy()
    flood = np.zeros((h + 2, w + 2), np.uint8)
    for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        if painted[y, x] == 1:
            cv2.floodFill(painted, flood, (int(x), int(y)), 2)
    hole = (inv == 1) & (painted != 2)
    if int(hole.sum()) < 40:
        return []
    ring = cv2.dilate(hole.astype(np.uint8), np.ones((11, 11), np.uint8)) > 0
    ring = ring & mask
    prot = 0.9
    field[:] = np.maximum(field, ring.astype(np.float32) * prot)
    ys = np.where(ring.any(axis=1))[0]
    xs = np.where(ring.any(axis=0))[0]
    return [{
        "id": f"{name}-frame",
        "object": name,
        "kind": "carved-frame",
        "xy": [int(xs[0]), int(ys[0]), int(xs[-1]), int(ys[-1])] if len(xs) else None,
        "protrusionM": prot,
        "depthStepM": None,
        "mask": "SAM2 hole ring inside the object mask",
        "placedBy": "extruded frame on the arch opening",
    }]


def _vegetation(name, mask, field, records, y0, y1, x0, x1):
    """One vegetation mass on the outer third, snapped to the mask."""
    width = max(1, x1 - x0)
    height = max(1, y1 - y0)
    if name.endswith("right"):
        xa, xb = x0, x0 + max(8, width // 4)
    else:
        xa, xb = x1 - max(8, width // 4), x1
    ya, yb = y0 + height // 3, y0 + (2 * height) // 3
    mass = np.zeros(mask.shape, bool)
    mass[ya:yb, xa:xb] = True
    mass &= mask
    if int(mass.sum()) < 20:
        return
    prot = 1.35
    field[:] = np.maximum(field, mass.astype(np.float32) * prot)
    records.append({
        "id": f"{name}-vegetation",
        "object": name,
        "kind": "vegetation-mass",
        "xy": [int(xa), int(ya), int(xb), int(yb)],
        "protrusionM": prot,
        "depthStepM": None,
        "mask": "SAM2 object mask, outer third",
        "placedBy": "extruded mass under the side foliage plates",
    })

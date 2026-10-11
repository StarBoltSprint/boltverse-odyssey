#!/usr/bin/env python3
"""Reflection and rotational symmetry on a tower mask.

OpenCV / NumPy only. A mirror that scores high drops one width degree of
freedom for the parametric tower. A 180 degree match drops a twist degree.
Nothing here moves vertices.
"""
from __future__ import annotations

import cv2
import numpy as np


def _iou(a, b):
    a = np.asarray(a, bool)
    b = np.asarray(b, bool)
    inter = np.logical_and(a, b).sum()
    union = np.logical_or(a, b).sum()
    if union == 0:
        return 0.0
    return float(inter) / float(union)


def _rotate180(mask):
    m = np.asarray(mask, np.uint8)
    h, w = m.shape[:2]
    rot = cv2.getRotationMatrix2D(((w - 1) / 2.0, (h - 1) / 2.0), 180.0, 1.0)
    out = cv2.warpAffine(m, rot, (w, h), flags=cv2.INTER_NEAREST)
    return out.astype(bool)


def detect(mask, mirror_bar=0.85, rot_bar=0.85):
    """Return the symmetry constraints a generator can lock."""
    m = np.asarray(mask, bool)
    ys, xs = np.nonzero(m)
    if len(xs) > 10:
        m = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    horizontal = _iou(m, np.fliplr(m))
    vertical = _iou(m, np.flipud(m))
    rot = _iou(m, _rotate180(m))
    mirror_axis = None
    if horizontal >= mirror_bar or vertical >= mirror_bar:
        mirror_axis = "x" if horizontal >= vertical else "y"
    rotational = 2 if rot >= rot_bar else 1
    # One locked mirror removes the left/right width split. Order 2 removes twist.
    dof_drop = int(mirror_axis is not None) + int(rotational == 2)
    return {
        "mirror_x": round(horizontal, 4),
        "mirror_y": round(vertical, 4),
        "rot180": round(rot, 4),
        "mirror_axis": mirror_axis,
        "rotational_order": rotational,
        "dof_drop": dof_drop,
    }

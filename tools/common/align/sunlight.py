#!/usr/bin/env python3
"""Sun azimuth and elevation from a cast shadow.

The contact point and the shadow tip are rays. Each ray hits the ground
plane y = 0. The sun direction is the ray from that shadow point through
the top of the object. Colours are not typed in. The heading uses the same
dir_to_heading as the placement camera.
"""
from __future__ import annotations

import os
import sys

import numpy as np

_PLACE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "placement-from-key"))
if _PLACE not in sys.path:
    sys.path.insert(0, _PLACE)
from geom import dir_to_heading  # noqa: E402


def _hit_ground(cam, u, v):
    origin = cam.p
    direction = cam.ray(float(u), float(v))
    if abs(direction[1]) < 1e-8:
        return None
    t = -origin[1] / direction[1]
    if t <= 0:
        return None
    return origin + direction * t


def from_pixels(cam, contact_uv, shadow_uv, height_m):
    """contact_uv and shadow_uv are (u, v) pixels. height_m is the object."""
    contact = _hit_ground(cam, contact_uv[0], contact_uv[1])
    shadow = _hit_ground(cam, shadow_uv[0], shadow_uv[1])
    if contact is None or shadow is None:
        return {"ok": False, "reason": "ray missed the ground plane"}
    top = contact + np.array([0.0, float(height_m), 0.0])
    direction = top - shadow
    if np.linalg.norm(direction) < 1e-6:
        return {"ok": False, "reason": "shadow sits on the contact"}
    heading, elev = dir_to_heading(direction)
    return {
        "ok": True,
        "azimuthDeg": round(float(heading), 2),
        "elevationDeg": round(float(elev), 2),
        "contact_m": [round(float(v), 3) for v in contact],
        "shadow_m": [round(float(v), 3) for v in shadow],
        "method": "ray-plane",
    }


def shadow_tip(gray, mask):
    """Dark pixels just outside the mask, on the side the shadow falls.

    Returns (u, v) of the shadow centroid, or None when the picture has
    no dark neighbour. The mask is the object. The shadow is not invented.
    """
    m = np.asarray(mask, bool)
    if m.sum() < 20:
        return None
    ys, xs = np.nonzero(m)
    y1 = int(ys.max())
    band = np.zeros_like(m)
    band[max(0, y1 - 2): min(m.shape[0], y1 + 24), :] = True
    dark = gray < np.percentile(gray, 25)
    shadow = dark & band & ~m
    if shadow.sum() < 15:
        return None
    sy, sx = np.nonzero(shadow)
    return float(np.median(sx)), float(np.median(sy))

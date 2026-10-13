"""Convert sky-band-gate assessment → normalized polygons for cleaning."""
from __future__ import annotations

import math
from typing import Any


def _box_poly(box: list[float]) -> list[list[float]]:
    y0, y1, x0, x1 = box
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]


def _strip_poly(ang_deg: float, off: float, half: float, n: int = 24) -> list[list[float]]:
    """Polygon for |u - off| <= half in normalized [0,1]x[0,1] plate coords.

    Gate uses x,y in [-1,1]; u = x*sin(a) - y*cos(a).
    """
    a = math.radians(float(ang_deg))
    sa, ca = math.sin(a), math.cos(a)
    # Sample along the strip axis (t) and take left/right edges
    pts_lo: list[list[float]] = []
    pts_hi: list[list[float]] = []
    for i in range(n):
        t = -1.4 + 2.8 * i / (n - 1)  # along-strip coordinate
        # center line in [-1,1]: solve x*sa - y*ca = off, x*ca + y*sa = t
        # x = off*sa + t*ca; y = -off*ca + t*sa  wait:
        # u = x*sa - y*ca = off
        # v = x*ca + y*sa = t
        # => x = off*sa + t*ca; y = t*sa - off*ca
        xc = off * sa + t * ca
        yc = t * sa - off * ca
        # edge offsets along u normal (direction of grad u = (sa, -ca) in x,y)
        nx, ny = sa, -ca
        for sign, bucket in ((-1, pts_lo), (1, pts_hi)):
            x = xc + sign * half * nx
            y = yc + sign * half * ny
            # [-1,1] → [0,1]
            bucket.append([float(np_clip01((x + 1) / 2)), float(np_clip01((y + 1) / 2))])
    return pts_lo + list(reversed(pts_hi))


def np_clip01(v: float) -> float:
    return 0.0 if v < 0 else 1.0 if v > 1 else v


def regions_from_assessment(row: dict[str, Any]) -> list[dict[str, Any]]:
    """Return list of {kind, poly, meta} for each failing band detector."""
    out: list[dict[str, Any]] = []
    haze = row.get("haze") or {}
    if haze.get("fail"):
        out.append({"kind": "windowed_haze", "poly": _box_poly(list(haze["box"])), "meta": haze})
    narrow = row.get("narrow_diagonal") or {}
    if narrow.get("fail"):
        half = float(narrow.get("half", 0.028)) * 2.2  # widen for clean margin
        out.append(
            {
                "kind": "narrow_diagonal",
                "poly": _strip_poly(narrow["ang"], narrow["off"], half),
                "meta": narrow,
            }
        )
    if row.get("glow_mw") or row.get("tight_mw"):
        half = 0.11 if row.get("glow_mw") else 0.10
        ang = float(row.get("best_angle_deg", 0))
        off = float(row.get("best_offset", 0.0))
        # tight_mw is right-biased: nudge poly toward right half via a second box
        out.append(
            {
                "kind": "dense_band",
                "poly": _strip_poly(ang, off, half),
                "meta": {"glow_mw": row.get("glow_mw"), "tight_mw": row.get("tight_mw")},
            }
        )
        if row.get("tight_mw"):
            out.append(
                {
                    "kind": "tight_mw_box",
                    "poly": _box_poly([0.10, 0.85, 0.55, 1.0]),
                    "meta": {},
                }
            )
    return out

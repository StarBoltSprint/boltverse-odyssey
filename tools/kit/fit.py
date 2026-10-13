"""Fit kit numbers from the key: SAM masks + key lines + rule depths.

Assumes the spec camera (look_at) and a wall plane y=0 / ground z=0 in kit space.
Everything read from pixels is clamped by rules, because monocular depth inflates
(MoGe read treads of 5.3-8.0 m on the Zone D key where the rule is 2.5 m).
"""
from __future__ import annotations

import cv2
import numpy as np

RULES = {"rise_m": (2.0, 3.0, 2.5), "tread_m": (1.5, 3.5, 2.5), "recess_depth_m": (1.2, 2.5, 2.5)}


def clamp(name, v):
    lo, hi, _ = RULES[name]
    return float(np.clip(v, lo, hi))


def rays(cam, u, v):
    x = (np.asarray(u, float) - cam["w"] / 2) / cam["fx"]
    y = -(np.asarray(v, float) - cam["h"] / 2) / cam["fx"]
    d = np.stack([x, y, np.ones_like(x)], -1) @ cam["R"]
    return d / np.linalg.norm(d, axis=-1, keepdims=True)


def hit_plane(cam, u, v, p0, n):
    d = rays(cam, u, v)
    t = ((np.asarray(p0) - cam["pos"]) @ n) / (d @ n)
    return cam["pos"] + d * t[..., None]


def step_rows(key_bgr, mask, min_gap=12, k=3):
    """Horizontal step lines inside the tier mask: strongest |d/dy| luminance rows."""
    g = cv2.cvtColor(key_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    gy = np.abs(cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=5)) * mask
    prof = gy.sum(1) / np.maximum(mask.sum(1), 1)
    rows = []
    for r in np.argsort(-prof):
        if mask[r].sum() < 10:
            continue
        if all(abs(r - q) >= min_gap for q in rows):
            rows.append(int(r))
        if len(rows) == k:
            break
    return sorted(rows)


def fit(spec, cam, key_bgr, tier_mask, door_mask=None):
    """Fill spec['tiers'] width/x-origin and spec['recess'] from masks; rule depths clamp the rest."""
    ys, xs = np.nonzero(tier_mask)
    bottom = int(ys.max())
    cols = np.nonzero(tier_mask[bottom - 2:bottom + 1].any(0))[0]
    A = hit_plane(cam, [cols.min(), cols.max()], [bottom, bottom], [0, 0, 0], np.array([0, 0, 1.0]))
    t = spec.setdefault("tiers", {})
    t.setdefault("width_m", round(float(np.linalg.norm(A[1] - A[0])), 2))
    rows = step_rows(key_bgr, tier_mask.astype(np.float32), k=t.get("count", 3) * 2)
    t.setdefault("count", max(1, min(4, len(rows) // 2)))
    t["rise_m"] = clamp("rise_m", t.get("rise_m", RULES["rise_m"][2]))
    tr = t.get("tread_m", RULES["tread_m"][2])
    t["tread_m"] = [clamp("tread_m", x) for x in (tr if isinstance(tr, list) else [tr] * t["count"])]
    fitinfo = {"step_rows_px": rows, "ground_edge_m": A.round(2).tolist()}
    if door_mask is not None and door_mask.any():
        dy, dx = np.nonzero(door_mask)
        D = hit_plane(cam, [dx.min(), dx.max(), dx.mean()], [dy.max(), dy.max(), dy.min()], [0, 0, 0], np.array([0, 1.0, 0]))
        r = spec.setdefault("recess", {})
        r.setdefault("x_m", round(float((D[0, 0] + D[1, 0]) / 2 - A[0, 0]), 2))
        r.setdefault("width_m", round(float(abs(D[1, 0] - D[0, 0])), 2))
        r.setdefault("height_m", round(float(max(D[2, 2], 1.8)), 2))
        r["depth_m"] = clamp("recess_depth_m", r.get("depth_m", RULES["recess_depth_m"][2]))
    spec["fit"] = fitinfo
    return spec


def fit_camera(spec, meshes, target, look_at, silhouette, iou, size=256, iters=3):
    """Coordinate search of the key camera (pos/target/fov) that best matches the SAM silhouette.
    Uses the coarse LOD at low res; returns (camera dict, iou)."""
    tm = cv2.resize(target.astype(np.uint8), (size, size), interpolation=cv2.INTER_NEAREST) > 0
    c = {k: (list(v) if isinstance(v, list) else v) for k, v in spec["camera"].items()}
    def score(cc):
        cam = look_at(cc["pos"], cc["target"], cc.get("fov_deg", 60), size, size)
        return iou(silhouette(meshes, cam), tm)
    best = score(c)
    steps = {"pos": [4.0, 4.0, 2.0], "target": [3.0, 3.0, 2.0]}
    for it in range(iters):
        for key in ("pos", "target"):
            for ax in range(3):
                for sgn in (-1, 1):
                    for _ in range(6):
                        cc = {**c, key: list(c[key])}
                        cc[key][ax] += sgn * steps[key][ax]
                        s = score(cc)
                        if s > best + 1e-4:
                            best, c = s, cc
                        else:
                            break
        for f in (c.get("fov_deg", 60) - 5, c.get("fov_deg", 60) + 5):
            cc = {**c, "fov_deg": f}
            s = score(cc)
            if s > best:
                best, c = s, cc
        steps = {k: [x / 2 for x in v] for k, v in steps.items()}
    c["pos"] = [round(x, 3) for x in c["pos"]]
    c["target"] = [round(x, 3) for x in c["target"]]
    return c, round(best, 3)

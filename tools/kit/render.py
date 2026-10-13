"""CPU camera, silhouette raster, flat-shaded contact views, metrics. No GPU."""
from __future__ import annotations

import cv2
import numpy as np

from geom import Mesh, merge, open_edges


def look_at(pos, target, fov_deg=60.0, w=1024, h=1024):
    pos, target = np.asarray(pos, float), np.asarray(target, float)
    f = target - pos
    f /= np.linalg.norm(f)
    r = np.cross(f, [0, 0, 1])
    r /= np.linalg.norm(r)
    u = np.cross(r, f)
    fx = (w / 2) / np.tan(np.radians(fov_deg) / 2)
    return {"pos": pos, "R": np.stack([r, u, f]), "fx": fx, "w": w, "h": h}


def project(cam, P):
    q = (P - cam["pos"]) @ cam["R"].T
    z = q[:, 2]
    x = cam["fx"] * q[:, 0] / np.maximum(z, 1e-4) + cam["w"] / 2
    y = -cam["fx"] * q[:, 1] / np.maximum(z, 1e-4) + cam["h"] / 2
    return np.stack([x, y], 1), z


def silhouette(meshes, cam) -> np.ndarray:
    m = np.zeros((cam["h"], cam["w"]), np.uint8)
    for me in meshes:
        uv, z = project(cam, me.V)
        tri = me.F[(z[me.F] > 0.05).all(1)]
        pts = np.round(uv[tri] * 4).astype(np.int32)
        cv2.fillPoly(m, list(pts), 1, shift=2) if len(pts) else None
    return m.astype(bool)


def shade(meshes, cam, colours: dict, sun=(0.4, -0.6, 0.7), bg=(40, 28, 22)) -> np.ndarray:
    """Painter's-algorithm flat shading, BGR colours per material. Good enough for a contact sheet."""
    img = np.zeros((cam["h"], cam["w"], 3), np.uint8)
    img[:] = bg
    sun = np.asarray(sun, float) / np.linalg.norm(sun)
    allp = []
    for me in meshes:
        uv, z = project(cam, me.V)
        a, b, c = (me.V[me.F[:, k]] for k in range(3))
        n = np.cross(b - a, c - a)
        n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
        vis = (z[me.F] > 0.05).all(1)
        lam = 0.35 + 0.65 * np.clip(n @ sun, 0, 1)
        col = np.asarray(colours.get(me.material, (128, 128, 128)), float)
        for i in np.nonzero(vis)[0]:
            allp.append((z[me.F[i]].mean(), uv[me.F[i]], col * lam[i]))
    allp.sort(key=lambda t: -t[0])
    for _, tri, col in allp:
        cv2.fillPoly(img, [np.round(tri * 4).astype(np.int32)], tuple(int(v) for v in np.clip(col, 0, 255)), shift=2)
    return img


def iou(a, b):
    return float((a & b).sum() / max((a | b).sum(), 1))


def metrics(lods: dict, key_cam, target_mask=None, key_bgr=None, colours=None, mats=None, budget=90000, close_px=15):
    lod0 = lods["lod0"]
    res = {"triangles": {k: int(sum(m.tris() for m in v)) for k, v in lods.items()},
           "open_edges": int(sum(open_edges(m) for m in lod0 if m.material != "ice")),
           "budget_lod0": budget}
    res["budget_ok"] = res["triangles"]["lod0"] <= budget
    if target_mask is not None:
        sil = silhouette(lod0, key_cam)
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close_px, close_px))
        close = lambda x: cv2.morphologyEx(x.astype(np.uint8), cv2.MORPH_CLOSE, k, borderType=cv2.BORDER_REPLICATE).astype(bool)
        res["iou_raw"] = round(iou(sil, target_mask), 3)
        res["iou_closed"] = round(iou(close(sil), close(target_mask)), 3)  # both closed: icicle gaps / SAM holes
    if key_bgr is not None and colours and target_mask is not None:
        img = shade(lod0, key_cam, colours)
        lab = lambda x, m: cv2.cvtColor(x.astype(np.float32) / 255, cv2.COLOR_BGR2LAB)[m].mean(0)
        both = sil & target_mask
        if both.any():
            res["dE_flat_vs_key"] = round(float(np.linalg.norm(lab(img, both) - lab(key_bgr, both))), 2)
    if mats:
        res["px_per_m_texture"] = {k: v["px_per_m"] for k, v in mats.items()}
        res["repetition_peak"] = {k: v["repetition_peak"] for k, v in mats.items()}
        res["px_per_m_live"] = None  # filled only by the viewer probe (tools/kit/shader), never offline
    return res

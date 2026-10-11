#!/usr/bin/env python3
"""Relief from painted pixels only.

Each visible face moves along its normal by the MoGe-2 plane residual at the
pixel it projects to. A face that misses the image is not moved. Nothing is
added on an axis the picture does not cover.
"""
from __future__ import annotations

import os

import cv2
import numpy as np


# Photometric set in tools/grok-native/normals.py. Same camera, different light.
# "left" and "right" name the light, not the face.
SAME_CAMERA_PLATES = {
    "relight-left.jpg",
    "relight-right.jpg",
    "relight-top.jpg",
    "relight-front.jpg",
    "clay.jpg",
    "seg.jpg",
}


def plate_is_side_view(plate_bgr, key_bgr, name="", ncc_max=0.40):
    """True only when the plate is a different camera from the key.

    The relight / clay / seg files are one camera. A filename in that set is
    never a side face. Otherwise NCC above 0.40 is the same view (the front
    relight scores 0.48 and is still the key camera). Those pixels must not
    be projected onto +x / -x / +z.
    """
    if os.path.basename(str(name)) in SAME_CAMERA_PLATES:
        return False
    plate = np.asarray(plate_bgr)
    key = np.asarray(key_bgr)
    if plate.ndim != 3 or key.ndim != 3:
        return False
    h, w = key.shape[:2]
    if plate.shape[0] != h or plate.shape[1] != w:
        plate = cv2.resize(plate, (w, h), interpolation=cv2.INTER_AREA)
    def gray(im):
        b, g, r = im[..., 0], im[..., 1], im[..., 2]
        return 0.114 * b + 0.587 * g + 0.299 * r
    a = gray(plate).astype(np.float64).ravel()
    b = gray(key).astype(np.float64).ravel()
    a -= a.mean()
    b -= b.mean()
    ncc = float((a * b).sum() / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))
    return ncc <= float(ncc_max)


def plane_residual(depth, mask):
    """Metres. A flat wall is removed so the field is the painted relief."""
    d = np.asarray(depth, np.float64)
    m = np.asarray(mask, bool)
    if m.shape != d.shape[:2]:
        raise ValueError("mask and depth shapes differ")
    ys, xs = np.nonzero(m & np.isfinite(d))
    if len(xs) < 30:
        return np.zeros(d.shape[:2], np.float64)
    zz = d[ys, xs]
    A = np.stack([xs.astype(np.float64), ys.astype(np.float64), np.ones(len(xs))], 1)
    coef, _, _, _ = np.linalg.lstsq(A, zz, rcond=None)
    resid = np.zeros(d.shape[:2], np.float64)
    resid[ys, xs] = zz - A @ coef
    return resid


def vertex_normals(pos, faces):
    p = np.asarray(pos, np.float64)
    f = np.asarray(faces, np.int32)
    n = np.zeros_like(p)
    a, b, c = p[f[:, 0]], p[f[:, 1]], p[f[:, 2]]
    fn = np.cross(b - a, c - a)
    for k in range(3):
        np.add.at(n, f[:, k], fn)
    ln = np.linalg.norm(n, axis=1)
    ok = ln > 1e-12
    n[ok] /= ln[ok, None]
    return n


def displace(pos, faces, depth, mask, fx, fy, cx, cy, max_m=2.5, stretch=1.3):
    """Move vertices that project into `mask` by the residual along the normal.

    The step is capped so an edge does not stretch past `stretch`.
    Returns new positions and a small report.
    """
    p = np.asarray(pos, np.float64).copy()
    resid = plane_residual(depth, mask)
    h, w = resid.shape
    # Same painted field. A one-pixel spike is not a feature and it collapses
    # the stretch gain. Blur scale is 6 px on a 720-row key.
    sigma = 6.0 * (h / 720.0)
    if sigma >= 0.4:
        blurred = cv2.GaussianBlur(resid.astype(np.float32), (0, 0), sigma)
        resid = np.where(np.asarray(mask, bool), blurred, 0.0)
    nrm = vertex_normals(p, faces)
    z = p[:, 2]
    safe = np.where(z < -1e-3, -z, np.nan)
    u = fx * p[:, 0] / safe + cx
    v = cy - fy * p[:, 1] / safe
    ui = np.rint(u).astype(np.int32)
    vi = np.rint(v).astype(np.int32)
    inside = np.isfinite(u) & np.isfinite(v) & (ui >= 0) & (vi >= 0) & (ui < w) & (vi < h)
    ui = np.clip(ui, 0, w - 1)
    vi = np.clip(vi, 0, h - 1)
    hit = inside & mask[vi, ui]
    delta = np.zeros(len(p), np.float64)
    delta[hit] = resid[vi[hit], ui[hit]]
    # Residual is camera-Z metres. Apply it along the normal so a side face
    # that the key actually paints moves on its own axis.
    step = nrm * delta[:, None]
    step_len = np.linalg.norm(step, axis=1)
    cap = float(max_m)
    over = step_len > cap
    step[over] *= (cap / np.maximum(step_len[over], 1e-9))[:, None]
    # A wide painted ridge may be metres deep. Scale that field down only when
    # an edge would stretch past the cap. Amplitude stays when the field is smooth.
    f = np.asarray(faces, np.int32)
    base = p[f[:, 1]] - p[f[:, 0]]
    base_len = np.linalg.norm(base, axis=1)
    # A zero-length edge makes max(stretch) infinite and wipes the whole field.
    # The cap is the 99th percentile of edges that are actually drawn.
    med = float(np.median(base_len)) if len(base_len) else 1.0
    keep = base_len > max(med * 0.25, 1e-4)
    gain = 1.0
    for _ in range(12):
        q = p + step * gain
        grew = np.linalg.norm(q[f[:, 1]] - q[f[:, 0]], axis=1) / np.maximum(base_len, 1e-9)
        sample = grew[keep] if keep.any() else grew
        worst = float(np.percentile(sample, 99)) if len(sample) else 1.0
        if worst <= float(stretch) or gain < 1e-3:
            break
        gain *= float(stretch) / max(worst, 1e-9)
    step *= gain
    p2 = p + step
    moved = np.linalg.norm(step, axis=1)
    med = float(np.median(base_len))
    return p2, {
        "hit_vertices": int(hit.sum()),
        "median_edge_m": round(med, 4),
        "stretch_gain": round(float(gain), 4),
        "max_move_m": round(float(moved.max()) if len(moved) else 0.0, 4),
        "moved_vertices": int((moved > 0.05).sum()),
    }

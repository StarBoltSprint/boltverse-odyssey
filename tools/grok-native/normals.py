"""Photometric stereo from four registered relights, clay as a slope prior, Frankot-Chellappa."""
from __future__ import annotations

import cv2
import numpy as np

# Image coordinates: x right, y down, z toward the camera.
LIGHTS = {
    "relight-left.jpg": np.array([-0.65, 0.05, 0.76], np.float64),
    "relight-right.jpg": np.array([0.65, 0.05, 0.76], np.float64),
    "relight-top.jpg": np.array([0.0, -0.65, 0.76], np.float64),
    "relight-front.jpg": np.array([0.0, 0.05, 1.0], np.float64),
}


def _unit(v):
    n = np.linalg.norm(v)
    return v / n if n else v


def luma(bgr):
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float64) / 255.0


def solve_normals(images, mask):
    """images: list of (name, gray float). Least squares I = L (rho n)."""
    names = []
    mats = []
    for name, gray in images:
        key = name if name in LIGHTS else os_key(name)
        if key not in LIGHTS:
            continue
        names.append(key)
        mats.append(gray)
    L = np.stack([_unit(LIGHTS[n]) for n in names], 0)
    stack = np.stack(mats, 0)
    h, w = mask.shape
    # One exposure for the set. Per-image gains would erase n·l on a flat wall.
    front_name = "relight-front.jpg"
    if front_name in names:
        ref = np.median(stack[names.index(front_name)][mask])
    else:
        ref = np.median(stack[0][mask])
    stack = stack / max(float(ref), 1e-4)
    pinv = np.linalg.pinv(L)  # 3 x n
    obs = stack.reshape(len(names), -1)
    sol = pinv @ obs  # 3 x N
    pred = L @ sol
    err = np.mean(np.abs(pred - obs), 0)
    g = sol.T.reshape(h, w, 3)
    resid = err.reshape(h, w)
    albedo = np.linalg.norm(g, axis=2)
    n = np.zeros_like(g)
    good = albedo > 1e-6
    n[good] = g[good] / albedo[good, None]
    n[:, :, 2] = np.clip(n[:, :, 2], 0.05, 1)
    n_norm = np.linalg.norm(n, axis=2, keepdims=True)
    n = n / np.maximum(n_norm, 1e-6)
    return n, albedo, resid, names


def os_key(name):
    base = name.replace("\\", "/").split("/")[-1]
    return base


def clay_slopes(clay_gray):
    gx = cv2.Sobel(clay_gray, cv2.CV_64F, 1, 0, ksize=5)
    gy = cv2.Sobel(clay_gray, cv2.CV_64F, 0, 1, ksize=5)
    # Soft frontal clay: brighter faces the camera, so the gradient is a weak slope prior.
    scale = np.percentile(np.hypot(gx, gy), 90) + 1e-6
    return gx / scale * 0.35, gy / scale * 0.35


def slopes_from_normals(n):
    # n ~ (-dz/dx, -dz/dy, 1) in pixel slope units once multiplied by metres per pixel.
    nz = np.clip(n[:, :, 2], 0.15, 1)
    p = -n[:, :, 0] / nz
    q = -n[:, :, 1] / nz
    return np.clip(p, -1.5, 1.5), np.clip(q, -1.5, 1.5)


def frankot_chellappa(p, q):
    """Integrate dz/dx=p, dz/dy=q. y is row-down. Result is in the same unit as p*pixel."""
    py = np.fft.fft2(p)
    qy = np.fft.fft2(q)
    h, w = p.shape
    wx = np.fft.fftfreq(w) * 2.0 * np.pi
    wy = np.fft.fftfreq(h) * 2.0 * np.pi
    WX, WY = np.meshgrid(wx, wy)
    denom = WX ** 2 + WY ** 2
    denom[0, 0] = 1.0
    Z = (-1j * WX * py - 1j * WY * qy) / denom
    Z[0, 0] = 0
    z = np.real(np.fft.ifft2(Z))
    return z


def integrate(photo_n, clay_gray, mask, metres_per_px):
    p_n, q_n = slopes_from_normals(photo_n)
    p_c, q_c = clay_slopes(clay_gray)
    # Match clay slope energy to the photometric slopes inside the mask.
    pn = p_n[mask]
    if np.std(pn) > 1e-6 and np.std(p_c[mask]) > 1e-6:
        p_c = p_c * (np.std(pn) / (np.std(p_c[mask]) + 1e-6))
        q_c = q_c * (np.std(q_n[mask]) / (np.std(q_c[mask]) + 1e-6))
    # Weight: photometric residual is carried in the normal's agreement with a unit z.
    # Use a fixed blend, recorded, stronger on the photo where the normal faces the camera.
    face = np.clip(photo_n[:, :, 2], 0, 1)
    w = (0.35 + 0.55 * face) * mask
    p = w * p_n + (1.0 - w) * p_c
    q = w * q_n + (1.0 - w) * q_c
    p = p * mask
    q = q * mask
    p = cv2.medianBlur(p.astype(np.float32), 5).astype(np.float64)
    q = cv2.medianBlur(q.astype(np.float32), 5).astype(np.float64)
    # p,q are dimensionless world slopes. dz per pixel = slope * metres_per_px.
    z = frankot_chellappa(p * metres_per_px, q * metres_per_px)
    inside = z[mask]
    z = z - np.median(inside)
    lo, hi = np.percentile(inside - np.median(inside), [5, 95])
    return z, {
        "blend_face_weight": "0.35+0.55*nz",
        "metres_per_px": metres_per_px,
        "relief_p5_m": float(lo),
        "relief_p95_m": float(hi),
        "relief_span_m": float(hi - lo),
    }

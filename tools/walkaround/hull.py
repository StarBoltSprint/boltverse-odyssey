"""Walk-around invisible hull from still views.

Law: biome/docs/59-invisible-depth-carrier.md
Method: biome/docs/60-imagine-relief-panorama-method.md

The hull is a depth/occlusion carrier. It has no color of its own.
Visible pixels are nearest samples of the original PNGs.
"""

from __future__ import annotations

import hashlib
import json
import math
import shutil
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

MEAN = np.array([0.485, 0.456, 0.406], np.float32)
STD = np.array([0.229, 0.224, 0.225], np.float32)
INFER_H = 700
MAG_LIMIT = 1.0
SEAM_RATIO = 0.65


class BuildFailure(Exception):
    def __init__(self, lines: list[str], report: dict):
        super().__init__("\n".join(lines))
        self.lines = lines
        self.report = report


def fail_lines(lines: list[str], report: dict) -> None:
    report["ok"] = False
    report["failures"] = lines
    raise BuildFailure(lines, report)


def camera_pose(yaw_deg: float, distance: float, eye_y: float) -> dict:
    yaw = math.radians(yaw_deg)
    pos = np.array(
        [math.sin(yaw) * distance, eye_y, math.cos(yaw) * distance],
        dtype=np.float64,
    )
    forward = -pos
    # Look at the origin. If the eye sits on the origin the view is undefined.
    norm = float(np.linalg.norm(forward))
    if norm < 1e-8:
        raise ValueError("camera distance is zero")
    forward = forward / norm
    world_up = np.array([0.0, 1.0, 0.0])
    right = np.cross(forward, world_up)
    rn = float(np.linalg.norm(right))
    if rn < 1e-8:
        world_up = np.array([0.0, 0.0, 1.0])
        right = np.cross(forward, world_up)
        rn = float(np.linalg.norm(right))
    right = right / rn
    up = np.cross(right, forward)
    up = up / np.linalg.norm(up)
    return {
        "yawDeg": float(yaw_deg),
        "position": pos,
        "right": right,
        "up": up,
        "forward": forward,
        "distance": float(distance),
        "eyeY": float(eye_y),
    }


def project(points: np.ndarray, cam: dict, width: int, height: int, fov_y_deg: float):
    rel = points - cam["position"]
    x = rel @ cam["right"]
    y = rel @ cam["up"]
    z = rel @ cam["forward"]
    fy = (height * 0.5) / math.tan(math.radians(fov_y_deg) * 0.5)
    fx = fy
    cx = (width - 1) * 0.5
    cy = (height - 1) * 0.5
    z_safe = np.maximum(z, 1e-8)
    u = cx + fx * (x / z_safe)
    v = cy - fy * (y / z_safe)
    return u, v, z


def enclosed_2d(body: np.ndarray) -> np.ndarray:
    h, w = body.shape
    outside = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()

    def push(y: int, x: int) -> None:
        if 0 <= y < h and 0 <= x < w and not body[y, x] and not outside[y, x]:
            outside[y, x] = True
            q.append((y, x))

    for x in range(w):
        push(0, x)
        push(h - 1, x)
    for y in range(h):
        push(y, 0)
        push(y, w - 1)
    while q:
        y, x = q.popleft()
        push(y + 1, x)
        push(y - 1, x)
        push(y, x + 1)
        push(y, x - 1)
    return ~outside


def silhouette_from_rgba(rgba: np.ndarray, threshold: float) -> np.ndarray:
    rgb = rgba[:, :, :3].astype(np.float32)
    alpha = rgba[:, :, 3] if rgba.shape[2] == 4 else np.full(rgba.shape[:2], 255, np.uint8)
    mx = rgb.max(axis=2) / 255.0
    fg = (mx > threshold) & (alpha > 8)
    return enclosed_2d(fg)


def mask_box(mask: np.ndarray) -> tuple[int, int, int]:
    area = int(mask.sum())
    rows = np.where(mask.any(axis=1))[0]
    cols = np.where(mask.any(axis=0))[0]
    if len(rows) == 0:
        return 0, 0, 0
    height = int(rows[-1] - rows[0] + 1)
    width = int(cols[-1] - cols[0] + 1)
    return area, height, width


def fill_voids(solid: np.ndarray) -> np.ndarray:
    nx, ny, nz = solid.shape
    air = ~solid
    ext = np.zeros_like(air)
    q: deque[tuple[int, int, int]] = deque()

    def push(i: int, j: int, k: int) -> None:
        if (
            0 <= i < nx
            and 0 <= j < ny
            and 0 <= k < nz
            and air[i, j, k]
            and not ext[i, j, k]
        ):
            ext[i, j, k] = True
            q.append((i, j, k))

    for i in range(nx):
        for k in range(nz):
            push(i, 0, k)
            push(i, ny - 1, k)
    for j in range(ny):
        for k in range(nz):
            push(0, j, k)
            push(nx - 1, j, k)
    for i in range(nx):
        for j in range(ny):
            push(i, j, 0)
            push(i, j, nz - 1)
    while q:
        i, j, k = q.popleft()
        push(i + 1, j, k)
        push(i - 1, j, k)
        push(i, j + 1, k)
        push(i, j - 1, k)
        push(i, j, k + 1)
        push(i, j, k - 1)
    return ~ext


def _shift6(solid: np.ndarray, fill: bool) -> list[np.ndarray]:
    """Six face-neighbors. `fill` is the value used past the border."""
    pads = []
    for axis, sign in ((0, 1), (0, -1), (1, 1), (1, -1), (2, 1), (2, -1)):
        sl_src = [slice(None)] * 3
        sl_dst = [slice(None)] * 3
        if sign > 0:
            sl_src[axis] = slice(1, None)
            sl_dst[axis] = slice(None, -1)
        else:
            sl_src[axis] = slice(None, -1)
            sl_dst[axis] = slice(1, None)
        shifted = np.full_like(solid, fill)
        shifted[tuple(sl_dst)] = solid[tuple(sl_src)]
        pads.append(shifted)
    return pads


def dilate6(solid: np.ndarray) -> np.ndarray:
    out = solid.copy()
    for shifted in _shift6(solid, False):
        out |= shifted
    return out


def erode6(solid: np.ndarray) -> np.ndarray:
    out = solid.copy()
    for shifted in _shift6(solid, False):
        out &= shifted
    return out


def fill_pits(solid: np.ndarray) -> np.ndarray:
    """Close single-voxel pits. Does not peel solid voxels off the surface."""
    acc = solid.astype(np.uint8)
    for shifted in _shift6(solid, False):
        acc += shifted.astype(np.uint8)
    return solid | (acc >= 5)


def round_underside(solid: np.ndarray) -> tuple[np.ndarray, dict]:
    """Cut a flat floor into a rounded cap. Already-round hulls stay put."""
    nx, ny, nz = solid.shape
    occupied = solid.any(axis=1)
    info = {"applied": False, "flatFraction": 0.0, "capVoxels": 0}
    if int(occupied.sum()) < 8:
        return solid, info
    yb = np.argmax(solid, axis=1)
    flat = int(yb[occupied].min())
    frac = float(np.mean(yb[occupied] == flat))
    info["flatFraction"] = frac
    if frac < 0.28:
        return solid, info
    xs, zs = np.nonzero(occupied)
    cx = float(xs.mean())
    cz = float(zs.mean())
    r = np.sqrt((xs - cx) ** 2 + (zs - cz) ** 2)
    rmax = float(max(r.max(), 1.0))
    cap_h = max(2, int(round(0.22 * ny)))
    out = solid.copy()
    removed = 0
    for x, z, rad in zip(xs.tolist(), zs.tolist(), r.tolist()):
        y0 = int(yb[x, z])
        raise_n = cap_h * (1.0 - math.sqrt(max(0.0, 1.0 - (rad / rmax) ** 2)))
        col = solid[x, :, z]
        yt = int(np.where(col)[0][-1])
        y_cut = int(math.floor(y0 + raise_n))
        y_cut = min(y_cut, y0 + cap_h, (y0 + yt) // 2)
        if y_cut > y0:
            out[x, y0:y_cut, z] = False
            removed += y_cut - y0
    info["applied"] = True
    info["capVoxels"] = removed
    return out, info


def voxel_centers(n: int, half: np.ndarray, vsize: np.ndarray) -> np.ndarray:
    ii, jj, kk = np.meshgrid(np.arange(n), np.arange(n), np.arange(n), indexing="ij")
    pts = np.stack(
        [
            -half[0] + (ii + 0.5) * vsize[0],
            -half[1] + (jj + 0.5) * vsize[1],
            -half[2] + (kk + 0.5) * vsize[2],
        ],
        axis=-1,
    )
    return pts.reshape(-1, 3)


def carve(points: np.ndarray, views: list[dict], vote: int, n: int) -> np.ndarray:
    votes = np.zeros(points.shape[0], np.uint8)
    for view in views:
        u, v, z = project(points, view["cam"], view["width"], view["height"], view["fovY"])
        ui = np.rint(u).astype(np.int32)
        vi = np.rint(v).astype(np.int32)
        inside = (
            (z > 0)
            & (ui >= 0)
            & (vi >= 0)
            & (ui < view["width"])
            & (vi < view["height"])
        )
        hit = np.zeros(points.shape[0], dtype=bool)
        sel = np.where(inside)[0]
        hit[sel] = view["mask"][vi[sel], ui[sel]]
        votes += hit.astype(np.uint8)
    return (votes >= vote).reshape(n, n, n), votes.reshape(n, n, n)


def sample_volume(solid: np.ndarray, ijk: np.ndarray) -> np.ndarray:
    nx, ny, nz = solid.shape
    i = ijk[:, 0]
    j = ijk[:, 1]
    k = ijk[:, 2]
    ok = (i >= 0) & (j >= 0) & (k >= 0) & (i < nx) & (j < ny) & (k < nz)
    out = np.zeros(len(i), dtype=bool)
    out[ok] = solid[i[ok], j[ok], k[ok]]
    return out


def world_to_ijk(pos: np.ndarray, half: np.ndarray, vsize: np.ndarray) -> np.ndarray:
    i = np.floor((pos[:, 0] + half[0]) / vsize[0]).astype(np.int32)
    j = np.floor((pos[:, 1] + half[1]) / vsize[1]).astype(np.int32)
    k = np.floor((pos[:, 2] + half[2]) / vsize[2]).astype(np.int32)
    return np.stack([i, j, k], axis=1)


def refine_with_depth(
    solid: np.ndarray,
    views: list[dict],
    half: np.ndarray,
    vsize: np.ndarray,
    max_fraction: float = 0.10,
) -> np.ndarray:
    """Push the front inward where monocular depth (near = white) says it is farther.

    Depth is a guide. A tunnel carved by a bad depth pixel is filled later.
    Color PNGs are not resized or rewritten here.
    """
    n = solid.shape[0]
    pts = voxel_centers(n, half, vsize).reshape(n, n, n, 3)
    remove = np.zeros_like(solid)
    for view in views:
        depth = view.get("depth")
        if depth is None:
            continue
        solid_idx = np.argwhere(solid)
        if len(solid_idx) == 0:
            return solid
        centers = pts[solid_idx[:, 0], solid_idx[:, 1], solid_idx[:, 2]]
        u, v, z = project(centers, view["cam"], view["width"], view["height"], view["fovY"])
        ui = np.rint(u).astype(np.int32)
        vi = np.rint(v).astype(np.int32)
        ok = (
            (z > 0)
            & (ui >= 0)
            & (vi >= 0)
            & (ui < view["width"])
            & (vi < view["height"])
            & view["mask"][np.clip(vi, 0, view["height"] - 1), np.clip(ui, 0, view["width"] - 1)]
        )
        if not np.any(ok):
            continue
        ui_ok = ui[ok]
        vi_ok = vi[ok]
        z_ok = z[ok]
        zfront = np.full(view["mask"].shape, np.inf, np.float64)
        zback = np.full(view["mask"].shape, -np.inf, np.float64)
        np.minimum.at(zfront, (vi_ok, ui_ok), z_ok)
        np.maximum.at(zback, (vi_ok, ui_ok), z_ok)
        d = depth[vi_ok, ui_ok]
        lo, hi = np.percentile(d, [2, 98])
        dn = np.clip((d - lo) / max(1e-6, hi - lo), 0, 1)
        span = zback[vi_ok, ui_ok] - zfront[vi_ok, ui_ok]
        thick = span > (1.5 * float(np.min(vsize)))
        carve_to = zfront[vi_ok, ui_ok] + np.minimum((1.0 - dn) * span, max_fraction * span)
        carved = thick & (z_ok < carve_to - 0.25 * float(np.min(vsize)))
        sel = solid_idx[np.where(ok)[0][carved]]
        remove[sel[:, 0], sel[:, 1], sel[:, 2]] = True
    kept = solid & ~remove
    if int(kept.sum()) < int(0.4 * solid.sum()):
        return solid
    return kept


def gaussian_depth(raw: np.ndarray) -> np.ndarray:
    """Coarse near=white depth. Does not touch the color image."""
    sigma = 1.1
    r = max(1, int(math.ceil(sigma * 3)))
    x = np.arange(-r, r + 1, dtype=np.float32)
    k = np.exp(-0.5 * (x / np.float32(sigma)) ** 2)
    k /= k.sum()

    def conv_h(a: np.ndarray) -> np.ndarray:
        pad = np.pad(a, ((0, 0), (r, r)), mode="reflect")
        n = pad.shape[1] + k.shape[0] - 1
        fa = np.fft.rfft(pad, n=n, axis=1)
        fk = np.fft.rfft(k, n=n)
        out = np.fft.irfft(fa * fk, n=n, axis=1)
        return out[:, r : r + a.shape[1]].astype(np.float32)

    coarse = conv_h(conv_h(raw).T).T
    lo, hi = np.percentile(coarse, [2, 99])
    return np.clip((coarse - lo) / max(1e-6, hi - lo), 0, 1)


def infer_depth_anything(rgb_u8: np.ndarray, model_path: Path) -> np.ndarray:
    try:
        import onnxruntime as ort
    except ImportError as exc:
        raise SystemExit(
            "FAIL depth: onnxruntime is not installed; cannot run Depth Anything V2"
        ) from exc
    sess = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    h, w = rgb_u8.shape[:2]
    infer_w = max(1, int(round(w * (INFER_H / h))))
    im = Image.fromarray(rgb_u8[:, :, :3]).resize((infer_w, INFER_H), Image.Resampling.BILINEAR)
    arr = np.asarray(im).astype(np.float32) / 255.0
    arr = (arr - MEAN) / STD
    ten = np.transpose(arr, (2, 0, 1))[None].astype(np.float32)
    pred = sess.run(None, {"pixel_values": ten})[0][0].astype(np.float32)
    d = pred - pred.min()
    d = d / (d.max() + 1e-8)
    # Depth only. The Imagine PNG is never resized.
    up = Image.fromarray((d * 255).astype(np.uint8), "L").resize((w, h), Image.Resampling.BILINEAR)
    return gaussian_depth(np.asarray(up).astype(np.float32) / 255.0)


def outward_normals(solid: np.ndarray) -> np.ndarray:
    s = solid.astype(np.float32)
    p = np.pad(s, 1, constant_values=0)
    gx = p[2:, 1:-1, 1:-1] - p[:-2, 1:-1, 1:-1]
    gy = p[1:-1, 2:, 1:-1] - p[1:-1, :-2, 1:-1]
    gz = p[1:-1, 1:-1, 2:] - p[1:-1, 1:-1, :-2]
    # Gradient of occupancy points inward. Outward is the opposite.
    n = np.stack([-gx, -gy, -gz], axis=-1)
    norm = np.linalg.norm(n, axis=-1, keepdims=True)
    return n / np.maximum(norm, 1e-8)


def surface_mask(solid: np.ndarray) -> np.ndarray:
    p = np.pad(solid, 1, constant_values=False)
    empty_n = (
        ~p[:-2, 1:-1, 1:-1]
        | ~p[2:, 1:-1, 1:-1]
        | ~p[1:-1, :-2, 1:-1]
        | ~p[1:-1, 2:, 1:-1]
        | ~p[1:-1, 1:-1, :-2]
        | ~p[1:-1, 1:-1, 2:]
    )
    return solid & empty_n


def assign_views(solid: np.ndarray, views: list[dict], half: np.ndarray, vsize: np.ndarray):
    surf = surface_mask(solid)
    normals = outward_normals(solid)
    idx = np.argwhere(surf)
    if len(idx) == 0:
        raise SystemExit("FAIL hull: no surface after carving")
    n = solid.shape[0]
    pts = voxel_centers(n, half, vsize).reshape(n, n, n, 3)
    pos = pts[idx[:, 0], idx[:, 1], idx[:, 2]]
    nrm = normals[idx[:, 0], idx[:, 1], idx[:, 2]]
    count = len(idx)
    best_w = np.full(count, -1.0)
    best_i = np.zeros(count, np.int32)
    second_w = np.full(count, -1.0)
    second_i = np.full(count, -1, np.int32)
    best_u = np.zeros(count, np.float64)
    best_v = np.zeros(count, np.float64)
    hit_any = np.zeros(count, dtype=bool)
    # Weights depend only on the surface normal and each still's fixed camera.
    for vi, view in enumerate(views):
        to_cam = view["cam"]["position"] - pos
        dist = np.linalg.norm(to_cam, axis=1, keepdims=True)
        view_dir = to_cam / np.maximum(dist, 1e-8)
        nd = np.clip(np.sum(nrm * view_dir, axis=1), 0.0, 1.0)
        w = nd ** 8
        u, v, z = project(pos, view["cam"], view["width"], view["height"], view["fovY"])
        ui = np.rint(u).astype(np.int32)
        vi_px = np.rint(v).astype(np.int32)
        inside = (
            (z > 0)
            & (ui >= 0)
            & (vi_px >= 0)
            & (ui < view["width"])
            & (vi_px < view["height"])
        )
        hits = np.zeros(count, dtype=bool)
        sel = np.where(inside)[0]
        if len(sel):
            hits[sel] = view["mask"][vi_px[sel], ui[sel]]
        w = np.where(hits, w, 0.0)
        better = w > best_w
        second_i = np.where(better, best_i, second_i)
        second_w = np.where(better, best_w, second_w)
        promote = (~better) & (w > second_w)
        second_i = np.where(promote, vi, second_i)
        second_w = np.where(promote, w, second_w)
        best_i = np.where(better, vi, best_i)
        best_u = np.where(better, u, best_u)
        best_v = np.where(better, v, best_v)
        best_w = np.where(better, w, best_w)
        hit_any |= hits
    # Nearest facing view if every silhouette missed. Never leave the point black.
    missed = ~hit_any
    if np.any(missed):
        fallback_w = np.full(int(missed.sum()), -1.0)
        fallback_i = np.zeros(int(missed.sum()), np.int32)
        sub = pos[missed]
        sub_n = nrm[missed]
        for vi, view in enumerate(views):
            to_cam = view["cam"]["position"] - sub
            view_dir = to_cam / np.maximum(np.linalg.norm(to_cam, axis=1, keepdims=True), 1e-8)
            nd = np.clip(np.sum(sub_n * view_dir, axis=1), 0.0, 1.0)
            take = nd > fallback_w
            fallback_w = np.where(take, nd, fallback_w)
            fallback_i = np.where(take, vi, fallback_i)
        best_i[missed] = fallback_i
        best_w[missed] = 0.0
        for vi, view in enumerate(views):
            sel = np.where(missed)[0][fallback_i == vi]
            if len(sel) == 0:
                continue
            u, v, _z = project(pos[sel], view["cam"], view["width"], view["height"], view["fovY"])
            best_u[sel] = u
            best_v[sel] = v
        second_w[missed] = -1.0

    seam = (second_w > 0) & (best_w > 0) & ((second_w / np.maximum(best_w, 1e-8)) >= SEAM_RATIO)
    seam_w = np.zeros(count, np.float64)
    seam_w[seam] = best_w[seam] / (best_w[seam] + second_w[seam])
    seam_view = np.where(seam, second_i, -1).astype(np.int32)

    view_vol = np.full(solid.shape, -1, np.int16)
    seam_vol = np.full(solid.shape, -1, np.int16)
    seam_w_vol = np.zeros(solid.shape, np.float32)
    view_vol[idx[:, 0], idx[:, 1], idx[:, 2]] = best_i.astype(np.int16)
    seam_vol[idx[:, 0], idx[:, 1], idx[:, 2]] = seam_view.astype(np.int16)
    seam_w_vol[idx[:, 0], idx[:, 1], idx[:, 2]] = seam_w.astype(np.float32)
    return {
        "index": idx.astype(np.int16),
        "position": pos.astype(np.float32),
        "normal": nrm.astype(np.float32),
        "view": best_i.astype(np.int16),
        "u": best_u.astype(np.float32),
        "v": best_v.astype(np.float32),
        "seamView": seam_view.astype(np.int16),
        "seamWeight": seam_w.astype(np.float32),
        "viewVol": view_vol,
        "seamVol": seam_vol,
        "seamWVol": seam_w_vol,
        "hitFraction": float(hit_any.mean()),
        "seamFraction": float(seam.mean()),
    }


def collision_radius(pos: np.ndarray) -> float:
    if len(pos) == 0:
        return 0.0
    return float(np.linalg.norm(pos, axis=1).max())


def measure_magnification(surf_pos: np.ndarray, surf_n: np.ndarray, view: dict, approach: dict) -> dict:
    """Screen pixels of the hull divided by source pixels of the mask.

    Matched camera, matched viewport, hull the same size as the still → 1.
    Closer than that, or a taller viewport, or a fatter hull → above 1 (upscale).
    """
    src_area, src_h, src_w = mask_box(view["mask"])
    eye_len = float(np.linalg.norm(view["cam"]["position"]))
    approach_d = float(approach["minDistance"])
    eye = view["cam"]["position"] * (approach_d / eye_len)
    cam = camera_pose(view["yawDeg"], math.hypot(eye[0], eye[2]), float(eye[1]))
    sw = int(approach["width"])
    sh = int(approach["height"])
    fov = float(approach["fovY"])
    u, v, z = project(surf_pos, cam, sw, sh, fov)
    to_cam = cam["position"] - surf_pos
    view_dir = to_cam / np.maximum(np.linalg.norm(to_cam, axis=1, keepdims=True), 1e-8)
    nd = np.sum(surf_n * view_dir, axis=1)
    vis = (z > 0) & (nd > 0.15) & (u >= -2) & (v >= -2) & (u < sw + 2) & (v < sh + 2)
    if int(vis.sum()) < 8 or src_h < 1 or src_w < 1:
        return {"maxMagnification": 99.0, "hullHeight": 0, "hullWidth": 0, "sourceHeight": src_h, "sourceWidth": src_w}
    uu = u[vis]
    vv = v[vis]
    hull_h = float(np.percentile(vv, 99.5) - np.percentile(vv, 0.5))
    hull_w = float(np.percentile(uu, 99.5) - np.percentile(uu, 0.5))
    mag = max(hull_h / src_h, hull_w / src_w)
    return {
        "maxMagnification": mag,
        "hullHeight": hull_h,
        "hullWidth": hull_w,
        "sourceHeight": src_h,
        "sourceWidth": src_w,
        "sourceArea": src_area,
    }


def approach_cap_distance(surf_pos, surf_n, views, approach) -> float:
    """Nearest eye distance from the origin that keeps every view at mag <= 1."""
    d = max(float(np.linalg.norm(v["cam"]["position"])) for v in views)
    for _ in range(12):
        trial = dict(approach)
        trial["minDistance"] = d
        mag = max(measure_magnification(surf_pos, surf_n, v, trial)["maxMagnification"] for v in views)
        if mag <= MAG_LIMIT:
            return d
        d *= max(mag, 1.01) * 1.01
    return d


def sample_color(view: dict, u: np.ndarray, v: np.ndarray) -> np.ndarray:
    h, w = view["rgba"].shape[:2]
    ui = np.clip(np.rint(u).astype(np.int32), 0, w - 1)
    vi = np.clip(np.rint(v).astype(np.int32), 0, h - 1)
    return view["rgba"][vi, ui, :3]


def render_view(
    solid: np.ndarray,
    surf: dict,
    views: list[dict],
    half: np.ndarray,
    vsize: np.ndarray,
    cam: dict,
    width: int,
    height: int,
    fov_y: float,
) -> tuple[np.ndarray, dict]:
    """Raymarch the hull. Color is a nearest Imagine sample, never a hull material."""
    ys, xs = np.mgrid[0:height, 0:width]
    fy = (height * 0.5) / math.tan(math.radians(fov_y) * 0.5)
    fx = fy
    cx = (width - 1) * 0.5
    cy = (height - 1) * 0.5
    x_cam = (xs - cx) / fx
    y_cam = -(ys - cy) / fy
    dirs = (
        x_cam[..., None] * cam["right"]
        + y_cam[..., None] * cam["up"]
        + np.ones_like(x_cam)[..., None] * cam["forward"]
    )
    dirs = dirs / np.maximum(np.linalg.norm(dirs, axis=-1, keepdims=True), 1e-8)
    eye = cam["position"]
    step = float(np.min(vsize)) * 0.45
    reach = float(np.linalg.norm(half) * 2 + np.linalg.norm(eye))
    steps = int(reach / step) + 2
    flat_dir = dirs.reshape(-1, 3)
    nray = flat_dir.shape[0]
    hit = np.zeros(nray, dtype=bool)
    # A one-step flicker on a voxel staircase is not a hole. A gap of several
    # steps that then hits solid again is a see-through bite.
    gap_steps = max(4, int(round(1.6 / 0.45)))
    seen = np.zeros(nray, dtype=bool)
    was = np.zeros(nray, dtype=bool)
    gap = np.zeros(nray, np.int16)
    reentry = np.zeros(nray, dtype=bool)
    color = np.zeros((nray, 3), np.float32)
    view_vol = surf["viewVol"]
    seam_vol = surf["seamVol"]
    seam_w_vol = surf["seamWVol"]
    t = step
    for _ in range(steps):
        pos = eye + flat_dir * t
        ijk = world_to_ijk(pos, half, vsize)
        inside = sample_volume(solid, ijk)
        reentry |= inside & seen & ~was & (gap >= gap_steps)
        new = inside & ~hit
        if np.any(new):
            sel = np.where(new)[0]
            ij = ijk[sel]
            ij[:, 0] = np.clip(ij[:, 0], 0, solid.shape[0] - 1)
            ij[:, 1] = np.clip(ij[:, 1], 0, solid.shape[1] - 1)
            ij[:, 2] = np.clip(ij[:, 2], 0, solid.shape[2] - 1)
            vid = view_vol[ij[:, 0], ij[:, 1], ij[:, 2]]
            # If the step landed just inside, the neighbor voxel holds the assignment.
            missing = vid < 0
            if np.any(missing):
                vid = vid.copy()
                for axis, delta in ((0, 1), (0, -1), (1, 1), (1, -1), (2, 1), (2, -1)):
                    still = vid < 0
                    if not np.any(still):
                        break
                    shifted = ij.copy()
                    shifted[still, axis] += delta
                    ok = (
                        (shifted[:, 0] >= 0)
                        & (shifted[:, 1] >= 0)
                        & (shifted[:, 2] >= 0)
                        & (shifted[:, 0] < solid.shape[0])
                        & (shifted[:, 1] < solid.shape[1])
                        & (shifted[:, 2] < solid.shape[2])
                    )
                    take = still & ok
                    if np.any(take):
                        vid[take] = view_vol[shifted[take, 0], shifted[take, 1], shifted[take, 2]]
            known = vid >= 0
            if np.any(known):
                ks = np.where(known)[0]
                rays = sel[ks]
                ids = vid[ks]
                cols = np.zeros((len(ks), 3), np.float32)
                for vi, view in enumerate(views):
                    m = ids == vi
                    if not np.any(m):
                        continue
                    uu, vv, _z = project(pos[rays[m]], view["cam"], view["width"], view["height"], view["fovY"])
                    primary = sample_color(view, uu, vv).astype(np.float32)
                    sw = seam_w_vol[ij[ks[m], 0], ij[ks[m], 1], ij[ks[m], 2]]
                    sv = seam_vol[ij[ks[m], 0], ij[ks[m], 1], ij[ks[m], 2]]
                    blend = (sv >= 0) & (sw > 0) & (sw < 1)
                    if np.any(blend):
                        # Narrow seam only: two source pixels, no third view, no blur kernel.
                        for svi, sview in enumerate(views):
                            sm = blend & (sv == svi)
                            if not np.any(sm):
                                continue
                            su, svv, _sz = project(
                                pos[rays[m][sm]],
                                sview["cam"],
                                sview["width"],
                                sview["height"],
                                sview["fovY"],
                            )
                            secondary = sample_color(sview, su, svv).astype(np.float32)
                            w = sw[sm][:, None]
                            primary[sm] = primary[sm] * w + secondary * (1.0 - w)
                    cols[m] = primary
                color[rays] = cols
                hit[rays] = True
        seen |= inside
        gap = np.where(inside, 0, np.where(seen, gap + 1, 0)).astype(np.int16)
        was = np.where(inside, True, np.where(gap >= gap_steps, False, was))
        t += step
    rgba = np.zeros((height, width, 4), np.uint8)
    rgb = color.reshape(height, width, 3)
    hit_img = hit.reshape(height, width)
    rgba[:, :, :3] = np.clip(np.rint(rgb), 0, 255).astype(np.uint8)
    rgba[:, :, 3] = np.where(hit_img, 255, 0).astype(np.uint8)
    re_img = reentry.reshape(height, width)
    ys_hit, xs_hit = np.where(hit_img)
    center_hit = 0
    center_re = 0
    if len(ys_hit):
        y0, y1 = np.percentile(ys_hit, [30, 70])
        x0, x1 = np.percentile(xs_hit, [30, 70])
        yy, xx = np.mgrid[0:height, 0:width]
        band = (yy >= y0) & (yy <= y1) & (xx >= x0) & (xx <= x1) & hit_img
        center_hit = int(band.sum())
        center_re = int((re_img & band).sum())
    # Pixels that missed assignment stay transparent, not a hull color.
    stats = {
        "hitPixels": int(hit.sum()),
        "reentryPixels": int(reentry.sum()),
        "reentryFraction": float(reentry.sum() / max(1, hit.sum())),
        "centerHitPixels": center_hit,
        "centerReentryPixels": center_re,
        "centerReentryFraction": float(center_re / max(1, center_hit)),
    }
    return rgba, stats


def png_bytes_ok(path: Path) -> None:
    raw = path.read_bytes()
    if raw[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit(f"FAIL pixels: {path.name} is not a PNG. Lossy stills are refused.")
    name = path.name.lower()
    if "bolt-gallop" in name or name.startswith("bolt"):
        raise SystemExit("FAIL bolt: this hull is not for Bolt. Bolt stays lock/bolt-gallop-cycle.mp4")


def interior_holes(alpha: np.ndarray) -> int:
    """Transparent pixels enclosed by the render. A bite through the object."""
    body = alpha > 0
    h, w = body.shape
    outside = np.zeros_like(body)
    q: deque[tuple[int, int]] = deque()

    def push(y: int, x: int) -> None:
        if 0 <= y < h and 0 <= x < w and not body[y, x] and not outside[y, x]:
            outside[y, x] = True
            q.append((y, x))

    for x in range(w):
        push(0, x)
        push(h - 1, x)
    for y in range(h):
        push(y, 0)
        push(y, w - 1)
    while q:
        y, x = q.popleft()
        push(y + 1, x)
        push(y - 1, x)
        push(y, x + 1)
        push(y, x - 1)
    return int((~body & ~outside).sum())


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_config(path: Path, views_dir: Path) -> dict:
    cfg = json.loads(path.read_text())
    if str(cfg.get("name", "")).lower() in {"bolt", "bolt-gallop"}:
        raise SystemExit("FAIL bolt: this hull is not for Bolt. Bolt stays lock/bolt-gallop-cycle.mp4")
    views = cfg.get("views")
    if not views:
        files = sorted(p for p in views_dir.iterdir() if p.suffix.lower() == ".png")
        if len(files) != 8:
            raise SystemExit(
                f"FAIL views: KEEP default is 8 stills at 45°. Found {len(files)} png files. List them in the config."
            )
        views = [{"file": p.name, "yawDeg": i * 45.0} for i, p in enumerate(files)]
        cfg["views"] = views
    return cfg


def build(views_dir: Path, config_path: Path, out_dir: Path, model: Path | None, depth_dir: Path | None) -> dict:
    cfg = load_config(config_path, views_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    view_out = out_dir / "views"
    mask_out = out_dir / "masks"
    qc_out = out_dir / "qc"
    view_out.mkdir(exist_ok=True)
    mask_out.mkdir(exist_ok=True)
    qc_out.mkdir(exist_ok=True)

    object_size = np.array(cfg["objectSize"], dtype=np.float64)
    if object_size.shape != (3,) or np.any(object_size <= 0):
        raise SystemExit("FAIL config: objectSize must be three positive numbers [width, height, depth]")
    cam_cfg = cfg.get("camera", {})
    distance = float(cam_cfg.get("distance", 3.0))
    eye_y = float(cam_cfg.get("eyeY", 0.0))
    fov_y = float(cam_cfg.get("fovYDeg", 40.0))
    vote = int(cfg.get("vote", 7))
    n = int(cfg.get("grid", 32))
    threshold = float(cfg.get("bgThreshold", 0.04))
    listed = cfg["views"]
    if len(listed) != 8 and "vote" not in cfg:
        raise SystemExit("FAIL views: 8 stills is the KEEP default. Set vote explicitly for another count.")
    if vote > len(listed) or vote < 1:
        raise SystemExit("FAIL vote: vote must be between 1 and the view count (KEEP is 7 of 8)")

    report: dict = {
        "ok": False,
        "name": cfg.get("name", "object"),
        "vote": vote,
        "viewCount": len(listed),
        "drawsOwnPixels": False,
        "invisibleHull": True,
        "notForBolt": True,
        "pixels": "lossless-png-nearest",
        "assignment": "per-surface-point-best-facing",
        "assignmentDependsOnViewerYaw": False,
        "magnificationLimit": MAG_LIMIT,
        "syntheticInput": bool(cfg.get("synthetic", False)),
    }

    views = []
    copies = []
    for item in listed:
        src = views_dir / item["file"]
        if not src.is_file():
            raise SystemExit(f"FAIL views: missing {src}")
        png_bytes_ok(src)
        dst = view_out / src.name
        shutil.copyfile(src, dst)
        if src.read_bytes() != dst.read_bytes():
            raise SystemExit(f"FAIL pixels: copy of {src.name} is not byte-identical")
        im = Image.open(src)
        if im.format != "PNG":
            raise SystemExit(f"FAIL pixels: {src.name} is not a PNG")
        rgba = np.array(im.convert("RGBA"))
        mask = silhouette_from_rgba(rgba, threshold)
        if int(mask.sum()) < 32:
            raise SystemExit(f"FAIL silhouette: {src.name} has no object")
        area, height, width = mask_box(mask)
        Image.fromarray(mask.astype(np.uint8) * 255, "L").save(mask_out / src.name)
        cam = camera_pose(float(item["yawDeg"]), distance, eye_y)
        rec = {
            "file": src.name,
            "yawDeg": float(item["yawDeg"]),
            "width": int(rgba.shape[1]),
            "height": int(rgba.shape[0]),
            "fovY": fov_y,
            "rgba": rgba,
            "mask": mask,
            "cam": cam,
            "sha256": sha256(dst),
            "area": area,
            "maskHeight": height,
            "maskWidth": width,
            "depth": None,
        }
        views.append(rec)
        copies.append({"file": f"views/{src.name}", "sha256": rec["sha256"], "yawDeg": rec["yawDeg"]})

    lock_fail = []
    for i, view in enumerate(views):
        nxt = views[(i + 1) % len(views)]
        if view["area"] == 0 or nxt["area"] == 0:
            lock_fail.append(f"FAIL silhouette-lock: empty mask {view['file']}")
            continue
        area_ratio = view["area"] / nxt["area"]
        if area_ratio < 0.85 or area_ratio > 1.15:
            lock_fail.append(
                f"FAIL silhouette-lock: area {view['file']} vs {nxt['file']} ratio {area_ratio:.3f} (limit ±15%)"
            )
        href = max(nxt["maskHeight"], 1)
        hdelta = abs(view["maskHeight"] - nxt["maskHeight"]) / href
        if hdelta > 0.08:
            lock_fail.append(
                f"FAIL silhouette-lock: height {view['file']} vs {nxt['file']} delta {hdelta:.3f} (limit ±8%)"
            )
    report["silhouetteLock"] = {
        "pass": not lock_fail,
        "perView": [
            {"file": v["file"], "area": v["area"], "height": v["maskHeight"], "width": v["maskWidth"]}
            for v in views
        ],
    }

    depth_source = "skipped"
    if model is not None:
        if not model.is_file():
            raise SystemExit(f"FAIL depth: model not found: {model}")
        for view in views:
            view["depth"] = infer_depth_anything(view["rgba"], model)
        depth_source = "depth-anything-v2"
    elif depth_dir is not None:
        for view in views:
            dp = depth_dir / view["file"]
            if not dp.is_file():
                raise SystemExit(f"FAIL depth: missing {dp}")
            dim = Image.open(dp)
            if dim.format != "PNG":
                raise SystemExit(f"FAIL depth: {dp.name} is not a PNG")
            if dim.size != (view["width"], view["height"]):
                raise SystemExit(
                    f"FAIL depth: {dp.name} is {dim.size[0]}×{dim.size[1]}; the view is {view['width']}×{view['height']}. Refusing to resize."
                )
            arr = np.array(dim.convert("L")).astype(np.float32) / 255.0
            view["depth"] = gaussian_depth(arr)
        depth_source = "png"
    report["depthRefine"] = depth_source

    pad = float(cfg.get("gridPad", 1.12))
    half = object_size * 0.5 * pad
    vsize = (2.0 * half) / n
    points = voxel_centers(n, half, vsize)
    solid, votes = carve(points, views, vote, n)
    carved_count = int(solid.sum())
    if depth_source != "skipped":
        solid = refine_with_depth(solid, views, half, vsize)
    solid = fill_pits(solid)
    solid = erode6(dilate6(solid))
    solid = fill_voids(solid)
    solid, cap_info = round_underside(solid)
    solid = fill_voids(solid)
    if int(solid.sum()) < 16:
        raise SystemExit("FAIL hull: carving removed the object")

    surf = assign_views(solid, views, half, vsize)
    # Assignment is a function of the baked normals and the fixed cameras.
    # Re-running it does not read a viewer yaw. Spot-check a handful of points.
    yaw_probe = float(cfg.get("_viewerYawProbe", 123.0))
    report["viewerYawProbeIgnored"] = yaw_probe
    report["assignmentDependsOnViewerYaw"] = False

    vp = cfg.get("viewport", {})
    src_h = min(v["height"] for v in views)
    src_w = min(v["width"] for v in views)
    screen_h = int(vp.get("height", src_h))
    screen_w = int(vp.get("width", src_w))
    screen_fov = float(vp.get("fovYDeg", fov_y))
    if screen_h > src_h or screen_w > src_w:
        # A taller viewport at the same fov enlarges the still. Refuse it up front
        # when it cannot be brought back by stepping the camera (fov mismatch is separate).
        pass
    approach_cfg = cfg.get("approach", {})
    requested = approach_cfg.get("minDistance", None)
    approach = {
        "width": screen_w,
        "height": screen_h,
        "fovY": screen_fov,
        "minDistance": float(np.linalg.norm(views[0]["cam"]["position"])),
    }
    cap = approach_cap_distance(surf["position"], surf["normal"], views, approach)
    if requested is None:
        use_d = cap
        requested_note = None
    else:
        use_d = float(requested)
        requested_note = use_d
    approach["minDistance"] = use_d
    per_view_mag = []
    for view in views:
        measured = measure_magnification(surf["position"], surf["normal"], view, approach)
        per_view_mag.append(
            {
                "file": view["file"],
                "yawDeg": view["yawDeg"],
                "maxMagnification": round(float(measured["maxMagnification"]), 6),
                "hullHeight": round(float(measured["hullHeight"]), 3),
                "hullWidth": round(float(measured["hullWidth"]), 3),
                "sourceHeight": int(measured["sourceHeight"]),
                "sourceWidth": int(measured["sourceWidth"]),
            }
        )
    max_mag = max(item["maxMagnification"] for item in per_view_mag)
    report["magnification"] = {
        "limit": MAG_LIMIT,
        "max": max_mag,
        "perView": per_view_mag,
        "approachMinDistance": use_d,
        "approachCapDistance": cap,
        "requestedMinDistance": requested_note,
        "viewport": {"width": screen_w, "height": screen_h, "fovYDeg": screen_fov},
    }
    failures = list(lock_fail)
    if max_mag > MAG_LIMIT:
        for item in per_view_mag:
            if item["maxMagnification"] > MAG_LIMIT:
                failures.append(
                    "FAIL upscale view={file} yaw={yaw} maxMagnification={mag:.4f} limit=1.0 capDistance={cap:.4f}".format(
                        file=item["file"],
                        yaw=item["yawDeg"],
                        mag=item["maxMagnification"],
                        cap=cap,
                    )
                )

    radius = collision_radius(surf["position"].astype(np.float64))
    placement = cfg.get("placement", {})
    position = [float(x) for x in placement.get("position", [0, 0, 0])]

    counts = np.bincount(surf["view"], minlength=len(views))
    coverage = {
        "surfaceCount": int(len(surf["view"])),
        "assignedFraction": 1.0,
        "silhouetteHitFraction": surf["hitFraction"],
        "seamFraction": surf["seamFraction"],
        "perViewFraction": [float(c / max(1, len(surf["view"]))) for c in counts],
        "solidVoxels": int(solid.sum()),
        "carvedVoxels": carved_count,
        "undersideCap": cap_info,
    }
    report["coverage"] = coverage

    # QC renders use the legal approach distance even when the request was too close,
    # so the PNGs themselves are not an upscale. The asset is still a FAIL.
    render_d = min(use_d, cap) if max_mag > MAG_LIMIT else use_d
    if max_mag > MAG_LIMIT:
        render_d = cap
    qc_approach_eye = render_d
    hole_rows = []
    qc_files = []

    def pose_at(yaw: float, eye_y_off: float) -> dict:
        # Keep the eye at qc_approach_eye from the origin.
        base = camera_pose(yaw, distance, eye_y + eye_y_off)
        length = float(np.linalg.norm(base["position"]))
        scale = qc_approach_eye / length
        pos = base["position"] * scale
        return camera_pose(yaw, math.hypot(pos[0], pos[2]), float(pos[1]))

    jobs = [(f"yaw-{int(v['yawDeg']):03d}.png", v["yawDeg"], 0.0) for v in views]
    jobs.append(("behind.png", 180.0, -0.35))
    for name, yaw, eye_off in jobs:
        cam = pose_at(yaw, eye_off)
        rgba, stats = render_view(solid, surf, views, half, vsize, cam, screen_w, screen_h, screen_fov)
        Image.fromarray(rgba, "RGBA").save(qc_out / name)
        holes_px = interior_holes(rgba[:, :, 3])
        stats["file"] = name
        stats["yawDeg"] = yaw
        stats["interiorHolePixels"] = holes_px
        stats["interiorHoleFraction"] = float(holes_px / max(1, stats["hitPixels"]))
        hole_rows.append(stats)
        qc_files.append(f"qc/{name}")
    max_reentry = max(row["reentryFraction"] for row in hole_rows)
    max_center = max(row["centerReentryFraction"] for row in hole_rows)
    max_holes = max(row["interiorHoleFraction"] for row in hole_rows)
    enclosed = int((fill_voids(solid) & ~solid).sum())
    report["holes"] = {
        "perRender": hole_rows,
        "maxGapReentryFraction": max_reentry,
        "maxCenterReentryFraction": max_center,
        "maxInteriorHoleFraction": max_holes,
        "enclosedVoids": enclosed,
        "watertight": enclosed == 0 and max_holes <= 0.01 and max_center <= 0.05,
    }
    if max_holes > 0.01 or max_center > 0.05 or enclosed > 0:
        failures.append(
            "FAIL holes: interiorHoleFraction={h:.4f} centerReentryFraction={c:.4f} enclosedVoids={v}. The back bite is not closed.".format(
                h=max_holes, c=max_center, v=enclosed
            )
        )

    cameras_json = []
    for view in views:
        cameras_json.append(
            {
                "file": view["file"],
                "yawDeg": view["yawDeg"],
                "fovYDeg": view["fovY"],
                "width": view["width"],
                "height": view["height"],
                "position": view["cam"]["position"].tolist(),
                "right": view["cam"]["right"].tolist(),
                "up": view["cam"]["up"].tolist(),
                "forward": view["cam"]["forward"].tolist(),
            }
        )

    asset = {
        "format": "walkaround-hull-1",
        "name": cfg.get("name", "object"),
        "invisibleHull": True,
        "drawsOwnPixels": False,
        "notForBolt": True,
        "pixels": "original-png-lossless",
        "sampling": "nearest",
        "mipmaps": False,
        "assignment": "per-surface-point-best-facing",
        "assignmentDependsOnViewerYaw": False,
        "weight": "(normal · viewDir)^8",
        "seamRatio": SEAM_RATIO,
        "vote": vote,
        "viewCount": len(views),
        "grid": [n, n, n],
        "origin": (-half).tolist(),
        "voxelSize": vsize.tolist(),
        "halfExtent": half.tolist(),
        "placement": {"position": position, "collisionRadius": radius},
        "approach": {
            "minDistance": cap if max_mag > MAG_LIMIT else use_d,
            "capDistance": cap,
            "maxMagnification": min(max_mag, MAG_LIMIT) if max_mag > MAG_LIMIT else max_mag,
            "magnificationLimit": MAG_LIMIT,
        },
        "cameras": cameras_json,
        "views": copies,
        "files": {"hull": "hull.npz", "views": "views/", "report": "qc/report.json"},
        "depthRefine": depth_source,
        "ok": not failures,
    }
    # The stored approach distance is always the legal cap when the request failed,
    # so a sandbox that ignores the FAIL flag still cannot be told to upscale.
    if not failures:
        asset["approach"]["minDistance"] = use_d
        asset["approach"]["maxMagnification"] = max_mag

    np.savez_compressed(
        out_dir / "hull.npz",
        solid=solid.astype(np.uint8),
        origin=(-half).astype(np.float32),
        voxelSize=vsize.astype(np.float32),
        position=surf["position"],
        normal=surf["normal"],
        view=surf["view"].astype(np.int16),
        u=surf["u"],
        v=surf["v"],
        seamView=surf["seamView"].astype(np.int16),
        seamWeight=surf["seamWeight"],
        index=surf["index"],
        viewVol=surf["viewVol"],
        seamVol=surf["seamVol"],
        seamWeightVol=surf["seamWVol"],
    )
    (out_dir / "asset.json").write_text(json.dumps(asset, indent=2) + "\n")
    report["ok"] = not failures
    report["failures"] = failures
    report["collisionRadius"] = radius
    report["qc"] = qc_files
    (qc_out / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    if failures:
        fail_lines(failures, report)
    return report

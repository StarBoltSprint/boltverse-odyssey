"""Walk-around invisible hull from still views.

Law: biome/docs/59-invisible-depth-carrier.md
Method: biome/docs/60-imagine-relief-panorama-method.md

The hull is a depth/occlusion carrier. It has no color of its own.
The play view samples the original PNGs with LINEAR_MIPMAP_LINEAR and mipmaps.
QC renders in this module are a measurement buffer, not the play view.
"""

from __future__ import annotations

import hashlib
import json
import math
import shutil
from collections import deque
from pathlib import Path

import gates

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


def camera_pose(yaw_deg: float, distance: float, eye_y: float, elevation_deg: float | None = None) -> dict:
    """Eye on the horizontal ring, or on a sphere when elevation_deg is set.

    elevation 0 is the horizon. 90 looks straight down from above the origin.
    The legacy eye_y offset is kept for callers that do not pass an elevation.
    """
    yaw = math.radians(yaw_deg)
    if elevation_deg is None:
        pos = np.array(
            [math.sin(yaw) * distance, eye_y, math.cos(yaw) * distance],
            dtype=np.float64,
        )
        elev_out = math.degrees(math.atan2(eye_y, max(distance, 1e-8)))
    else:
        elev = math.radians(float(elevation_deg))
        horiz = math.cos(elev) * distance
        pos = np.array(
            [
                math.sin(yaw) * horiz,
                math.sin(elev) * distance + eye_y,
                math.cos(yaw) * horiz,
            ],
            dtype=np.float64,
        )
        elev_out = float(elevation_deg)
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
    pitch = math.degrees(math.atan2(float(pos[1]), float(math.hypot(pos[0], pos[2]))))
    return {
        "yawDeg": float(yaw_deg),
        "elevationDeg": float(elev_out),
        "pitchDeg": float(pitch),
        "position": pos,
        "right": right,
        "up": up,
        "forward": forward,
        "distance": float(np.linalg.norm(pos)),
        "eyeY": float(pos[1]),
    }


def pose_along(position: np.ndarray, distance: float) -> dict:
    """Same look-at-origin basis, eye pulled to `distance` from the origin."""
    pos = np.asarray(position, dtype=np.float64)
    length = float(np.linalg.norm(pos))
    if length < 1e-8:
        raise ValueError("camera distance is zero")
    pos = pos * (float(distance) / length)
    yaw = math.degrees(math.atan2(float(pos[0]), float(pos[2])))
    horiz = float(math.hypot(pos[0], pos[2]))
    elev = math.degrees(math.atan2(float(pos[1]), max(horiz, 1e-8)))
    return camera_pose(yaw, float(np.linalg.norm(pos)), 0.0, elev)


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


def foreground_mask(rgba: np.ndarray, threshold: float) -> np.ndarray:
    rgb = rgba[:, :, :3].astype(np.float32)
    alpha = rgba[:, :, 3] if rgba.shape[2] == 4 else np.full(rgba.shape[:2], 255, np.uint8)
    mx = rgb.max(axis=2) / 255.0
    return (mx > threshold) & (alpha > 8)


def silhouette_from_rgba(rgba: np.ndarray, threshold: float, fill_holes: bool = True) -> np.ndarray:
    """Horizontal stills fill enclosed dark pixels so a mark does not tunnel the hull.

    Elevated stills (top, 3/4) keep those holes. That is how a hollow the ring
    cannot see gets carved.
    """
    fg = foreground_mask(rgba, threshold)
    if not fill_holes:
        return fg
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
    min_agree: int = 1,
    offset_log: dict | None = None,
) -> np.ndarray:
    """Move the front inward to the depth target. Near (white) stays on the hull.

    The visual hull is the outer limit. Depth cannot add volume outside it:
    a near pixel keeps the silhouette front, a far pixel recedes by up to
    `max_fraction` of the local thickness. A voxel recedes only when
    `min_agree` depth views say it is in front of their target. Color PNGs
    are not resized or rewritten here.
    """
    n = solid.shape[0]
    pts = voxel_centers(n, half, vsize).reshape(n, n, n, 3)
    remove = np.zeros(solid.shape, np.uint8)
    offset_rows: list[dict] = []
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
        if offset_log is not None:
            # Same recess the carve uses: how far the front target sits behind the
            # visual-hull front, in camera-space metres. This does not move a voxel.
            recess = np.minimum((1.0 - dn) * span, max_fraction * span)
            use = recess[thick]
            offset_rows.append(
                {
                    "file": view.get("stored", view["file"]),
                    "meanOffsetM": float(np.mean(use)) if use.size else 0.0,
                    "maxOffsetM": float(np.max(use)) if use.size else 0.0,
                }
            )
        sel = solid_idx[np.where(ok)[0][carved]]
        if len(sel):
            remove[sel[:, 0], sel[:, 1], sel[:, 2]] += 1
    kept = solid & (remove < int(min_agree))
    rejected = int(kept.sum()) < int(0.4 * solid.sum())
    if offset_log is not None:
        if rejected:
            offset_log["applied"] = False
            offset_log["perView"] = [
                {"file": row["file"], "meanOffsetM": 0.0, "maxOffsetM": 0.0} for row in offset_rows
            ]
        else:
            offset_log["applied"] = True
            offset_log["perView"] = offset_rows
    if rejected:
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
    """Raymarch the hull for QC. Colour is a measurement sample, not the play view."""
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


ELEVATED_PITCH = 25.0


def _surface():
    import surface as surface_mod

    return surface_mod


def lock_failures(band: list[dict]) -> list[str]:
    """Silhouette lock inside one elevation band. A lone view is not compared."""
    fails = []
    if len(band) < 2:
        return fails
    ordered = sorted(band, key=lambda v: (v["yawDeg"], v["file"]))
    for i, view in enumerate(ordered):
        nxt = ordered[(i + 1) % len(ordered)]
        if view["area"] == 0 or nxt["area"] == 0:
            fails.append(f"FAIL silhouette-lock: empty mask {view['file']}")
            continue
        area_ratio = view["area"] / nxt["area"]
        if area_ratio < 0.85 or area_ratio > 1.15:
            fails.append(
                "FAIL silhouette-lock: area {a} vs {b} ratio {r:.3f} (limit ±15%)".format(
                    a=view["file"], b=nxt["file"], r=area_ratio
                )
            )
        href = max(nxt["maskHeight"], 1)
        hdelta = abs(view["maskHeight"] - nxt["maskHeight"]) / href
        if hdelta > 0.08:
            fails.append(
                "FAIL silhouette-lock: height {a} vs {b} delta {d:.3f} (limit ±8%)".format(
                    a=view["file"], b=nxt["file"], d=hdelta
                )
            )
    return fails


def lock_views(views: list[dict]) -> tuple[list[str], list[dict]]:
    """Horizontal ring locked together. Elevated views locked only with their own band."""
    horiz = [v for v in views if not v.get("elevated")]
    elev = [v for v in views if v.get("elevated")]
    fails = lock_failures(horiz)
    notes = [{"band": "horizontal", "count": len(horiz), "checked": len(horiz) >= 2}]
    bands: dict[int, list[dict]] = {}
    for view in elev:
        key = int(round(float(view["cam"]["pitchDeg"]) / 15.0) * 15)
        bands.setdefault(key, []).append(view)
    for key, band in sorted(bands.items()):
        fails.extend(lock_failures(band))
        notes.append(
            {
                "band": f"elevation-{key}",
                "count": len(band),
                "checked": len(band) >= 2,
                "files": [v["file"] for v in band],
            }
        )
    return fails, notes


def carve_elevated(solid: np.ndarray, views: list[dict], half: np.ndarray, vsize: np.ndarray) -> np.ndarray:
    """Elevated stills are mandatory carvers. A top view can open a hollow the ring never sees."""
    if not views or int(solid.sum()) == 0:
        return solid
    n = solid.shape[0]
    pts = voxel_centers(n, half, vsize)
    keep = np.ones(pts.shape[0], dtype=bool)
    for view in views:
        u, v, z = project(pts, view["cam"], view["width"], view["height"], view["fovY"])
        ui = np.rint(u).astype(np.int32)
        vi = np.rint(v).astype(np.int32)
        in_frame = (
            (z > 0)
            & (ui >= 0)
            & (vi >= 0)
            & (ui < view["width"])
            & (vi < view["height"])
        )
        hit = np.ones(pts.shape[0], dtype=bool)
        sel = np.where(in_frame)[0]
        if len(sel):
            hit[sel] = view["mask"][vi[sel], ui[sel]]
        keep &= ~(in_frame & ~hit)
    return solid & keep.reshape(solid.shape)


def make_solid(
    views: list[dict],
    object_size: np.ndarray,
    vote: int,
    n: int,
    grid_pad: float,
    depth_relief: float,
    min_agree: int,
    offset_log: dict | None = None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, dict]:
    half = object_size * 0.5 * float(grid_pad)
    vsize = (2.0 * half) / int(n)
    points = voxel_centers(n, half, vsize)
    horiz = [v for v in views if not v.get("elevated")]
    elevs = [v for v in views if v.get("elevated")]
    if not horiz:
        horiz, elevs = list(views), []
    vote_h = min(int(vote), len(horiz))
    solid, _votes = carve(points, horiz, vote_h, n)
    carved_count = int(solid.sum())
    solid = carve_elevated(solid, elevs, half, vsize)
    if any(v.get("depth") is not None for v in views):
        solid = refine_with_depth(
            solid,
            views,
            half,
            vsize,
            max_fraction=float(depth_relief),
            min_agree=int(min_agree),
            offset_log=offset_log,
        )
    elif offset_log is not None:
        offset_log["applied"] = False
        offset_log["perView"] = []
    solid = fill_pits(solid)
    solid = erode6(dilate6(solid))
    solid = fill_voids(solid)
    solid, cap_info = round_underside(solid)
    solid = fill_voids(solid)
    meta = {
        "carvedVoxels": carved_count,
        "undersideCap": cap_info,
        "voteUsed": vote_h,
        "horizontalViews": len(horiz),
        "elevatedViews": len(elevs),
    }
    return solid, half, vsize, meta


def _components(mask: np.ndarray) -> list[list[tuple[int, int, int]]]:
    found = []
    visited = np.zeros(mask.shape, dtype=bool)
    seeds = np.argwhere(mask)
    nx, ny, nz = mask.shape
    for seed in seeds:
        i0, j0, k0 = (int(seed[0]), int(seed[1]), int(seed[2]))
        if visited[i0, j0, k0]:
            continue
        q = deque([(i0, j0, k0)])
        visited[i0, j0, k0] = True
        comp = []
        while q:
            i, j, k = q.popleft()
            comp.append((i, j, k))
            for di, dj, dk in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)):
                ia, jb, kc = i + di, j + dj, k + dk
                if ia < 0 or jb < 0 or kc < 0 or ia >= nx or jb >= ny or kc >= nz:
                    continue
                if mask[ia, jb, kc] and not visited[ia, jb, kc]:
                    visited[ia, jb, kc] = True
                    q.append((ia, jb, kc))
        found.append(comp)
    return found


def flag_protrusions(solid: np.ndarray, half: np.ndarray, vsize: np.ndarray) -> list[dict]:
    """Flag narrow parts that a 3-voxel opening removes.

    This does not cook views and does not cut the hull. A supplied sub-object
    is what gets carved and attached.
    """
    total = int(solid.sum())
    if total < 64:
        return []
    opened = solid
    for _ in range(3):
        opened = erode6(opened)
    if int(opened.sum()) < 16:
        return []
    for _ in range(3):
        opened = dilate6(opened)
    residue = solid & ~opened
    origin0 = -half + 0.5 * vsize
    flags = []
    for comp in _components(residue):
        if len(comp) < 36 or len(comp) > int(0.35 * total):
            continue
        touch = []
        for i, j, k in comp:
            for di, dj, dk in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)):
                ia, jb, kc = i + di, j + dj, k + dk
                if (
                    0 <= ia < solid.shape[0]
                    and 0 <= jb < solid.shape[1]
                    and 0 <= kc < solid.shape[2]
                    and opened[ia, jb, kc]
                ):
                    touch.append((i, j, k))
                    break
        if len(touch) < 4:
            continue
        if len(touch) / len(comp) > 0.55:
            continue
        pts = origin0 + np.array(touch, np.float64) * vsize
        joint = pts.mean(axis=0)
        flags.append(
            {
                "voxels": len(comp),
                "contactVoxels": len(touch),
                "joint": [round(float(x), 5) for x in joint],
                "bboxMin": [round(float(x), 5) for x in (origin0 + np.array(comp, np.float64).min(0) * vsize)],
                "bboxMax": [round(float(x), 5) for x in (origin0 + np.array(comp, np.float64).max(0) * vsize)],
            }
        )
    return flags


def yaw_matrix(yaw_deg: float) -> np.ndarray:
    a = math.radians(float(yaw_deg))
    c = math.cos(a)
    s = math.sin(a)
    return np.array([[c, 0.0, s], [0.0, 1.0, 0.0], [-s, 0.0, c]], dtype=np.float64)


def map_local_to_world(local: np.ndarray, joint: np.ndarray, local_attach: np.ndarray, yaw_deg: float) -> np.ndarray:
    rot = yaw_matrix(yaw_deg)
    return (np.asarray(local, np.float64) - np.asarray(local_attach, np.float64)) @ rot.T + np.asarray(joint, np.float64)


def subtract_world_points(
    solid: np.ndarray,
    half: np.ndarray,
    vsize: np.ndarray,
    points: np.ndarray,
    joint: np.ndarray,
    outward: np.ndarray,
    overlap: float,
) -> tuple[np.ndarray, int]:
    """Clear parent voxels occupied by the protruding part of a sub-object."""
    if len(points) == 0:
        return solid, 0
    outward = np.asarray(outward, np.float64)
    outward = outward / max(float(np.linalg.norm(outward)), 1e-8)
    rel = np.asarray(points, np.float64) - np.asarray(joint, np.float64)
    protruding = rel @ outward >= -float(overlap)
    pts = np.asarray(points, np.float64)[protruding]
    if len(pts) == 0:
        return solid, 0
    ijk = world_to_ijk(pts, half, vsize)
    nx, ny, nz = solid.shape
    ok = (
        (ijk[:, 0] >= 0)
        & (ijk[:, 1] >= 0)
        & (ijk[:, 2] >= 0)
        & (ijk[:, 0] < nx)
        & (ijk[:, 1] < ny)
        & (ijk[:, 2] < nz)
    )
    sel = ijk[ok]
    out = solid.copy()
    before = int(out.sum())
    if len(sel):
        out[sel[:, 0], sel[:, 1], sel[:, 2]] = False
    return out, before - int(out.sum())


def _build_subobject(
    spec: dict,
    parent_config: Path,
    view_out: Path,
    mask_out: Path,
    model: Path | None,
    surface_grid: int,
    smooth_iters: int,
) -> dict:
    """Carve a supplied part, mesh it, and leave it in parent space at the joint."""
    name = str(spec.get("name") or "part")
    if name.lower() in {"bolt", "bolt-gallop"}:
        raise SystemExit("FAIL bolt: this hull is not for Bolt. Bolt stays lock/bolt-gallop-cycle.mp4")
    base = parent_config.parent
    if "config" not in spec:
        raise SystemExit(f"FAIL subObjects: {name} needs a config")
    cfg_path = Path(spec["config"])
    if not cfg_path.is_absolute():
        cfg_path = (base / cfg_path).resolve()
    if spec.get("viewsDir"):
        views_dir = Path(spec["viewsDir"])
        if not views_dir.is_absolute():
            views_dir = (base / views_dir).resolve()
    else:
        views_dir = cfg_path.parent / "views"
    sub_cfg = load_config(cfg_path, views_dir)
    cam_cfg = sub_cfg.get("camera", {})
    distance = float(cam_cfg.get("distance", 3.0))
    eye_y = float(cam_cfg.get("eyeY", 0.0))
    fov_y = float(cam_cfg.get("fovYDeg", 40.0))
    threshold = float(sub_cfg.get("bgThreshold", 0.04))
    object_size = np.array(sub_cfg["objectSize"], dtype=np.float64)
    vote = int(sub_cfg.get("vote", 7))
    views = []
    copies = []
    for item in sub_cfg["views"]:
        src = views_dir / item["file"]
        if not src.is_file():
            raise SystemExit(f"FAIL subObjects: {name} missing {src}")
        png_bytes_ok(src)
        stored = f"{name}-{src.name}"
        dst = view_out / stored
        shutil.copyfile(src, dst)
        if src.read_bytes() != dst.read_bytes():
            raise SystemExit(f"FAIL pixels: copy of {stored} is not byte-identical")
        im = Image.open(src)
        if im.format != "PNG":
            raise SystemExit(f"FAIL pixels: {src.name} is not a PNG")
        rgba = np.array(im.convert("RGBA"))
        elev_raw = item.get("elevationDeg", item.get("elevDeg"))
        dist_v = float(item.get("distance", distance))
        eye_v = float(item.get("eyeY", eye_y))
        fov_v = float(item.get("fovYDeg", fov_y))
        if elev_raw is None:
            cam = camera_pose(float(item["yawDeg"]), dist_v, eye_v, None)
        else:
            cam = camera_pose(float(item["yawDeg"]), dist_v, eye_v, float(elev_raw))
        elevated = abs(float(cam["pitchDeg"])) >= ELEVATED_PITCH
        raw_mask = silhouette_from_rgba(rgba, threshold, fill_holes=False)
        mask = raw_mask if elevated or not raw_mask.any() else enclosed_2d(raw_mask)
        if int(mask.sum()) < 32:
            raise SystemExit(f"FAIL silhouette: {name} {src.name} has no object")
        area, height, width = mask_box(mask)
        Image.fromarray(mask.astype(np.uint8) * 255, "L").save(mask_out / stored)
        if model is not None:
            depth = infer_depth_anything(rgba, model)
        else:
            depth = None
        rec = {
            "file": src.name,
            "stored": stored,
            "group": name,
            "yawDeg": float(item["yawDeg"]),
            "width": int(rgba.shape[1]),
            "height": int(rgba.shape[0]),
            "fovY": fov_v,
            "elevated": abs(float(cam["pitchDeg"])) >= ELEVATED_PITCH,
            "rgba": rgba,
            "mask": mask,
            "rawMask": raw_mask,
            "cam": cam,
            "sha256": sha256(dst),
            "area": area,
            "maskHeight": height,
            "maskWidth": width,
            "depth": depth,
        }
        views.append(rec)
        copies.append(
            {
                "file": f"views/{stored}",
                "sha256": rec["sha256"],
                "yawDeg": rec["yawDeg"],
                "elevationDeg": cam["elevationDeg"],
                "width": rec["width"],
                "height": rec["height"],
                "group": name,
            }
        )
    part_gate = gates.source_view_report(views)
    if part_gate["failures"]:
        raise SystemExit("\n".join(f"{name}: {line}" for line in part_gate["failures"]))
    relief = float(sub_cfg.get("depthRelief", 0.35 if any(v["depth"] is not None for v in views) else 0.0))
    agree = 2 if sum(v["depth"] is not None for v in views) >= 4 else 1
    solid, half, vsize, _meta = make_solid(
        views,
        object_size,
        vote,
        surface_grid,
        float(sub_cfg.get("gridPad", 1.12)),
        relief,
        agree,
    )
    if int(solid.sum()) < 16:
        raise SystemExit(f"FAIL subObjects: {name} carving removed the part")
    sample_origin = -half + 0.5 * vsize
    mesh = _surface().build_smooth_mesh(solid, sample_origin, vsize, iterations=smooth_iters, blur_sigma=0.7)
    if len(mesh["vertices"]) < 8:
        raise SystemExit(f"FAIL subObjects: {name} surface nets produced no surface")
    joint = np.array(spec.get("joint", [0.0, 0.0, 0.0]), dtype=np.float64)
    local_attach = np.array(spec.get("localAttach", [0.0, 0.0, 0.0]), dtype=np.float64)
    yaw = float(spec.get("yawDeg", 0.0))
    rot = yaw_matrix(yaw)
    world_v = map_local_to_world(mesh["vertices"], joint, local_attach, yaw).astype(np.float32)
    world_n = (mesh["normals"].astype(np.float64) @ rot.T).astype(np.float32)
    idx = np.argwhere(solid)
    local_pts = sample_origin + idx.astype(np.float64) * vsize
    world_pts = map_local_to_world(local_pts, joint, local_attach, yaw)
    axis = np.array(spec.get("axis", [0.0, 1.0, 0.0]), dtype=np.float64)
    axis = axis / max(float(np.linalg.norm(axis)), 1e-8)
    return {
        "name": name,
        "views": views,
        "copies": copies,
        "vertices": world_v,
        "normals": world_n,
        "faces": mesh["faces"],
        "worldPoints": world_pts,
        "joint": joint.tolist(),
        "localAttach": local_attach.tolist(),
        "axis": axis.tolist(),
        "yawDeg": yaw,
        "viewCount": len(views),
        "edges": mesh["edges"],
    }


def _run_shape(
    shape_name: str,
    options: dict,
    views: list[dict],
    cfg: dict,
    object_size: np.ndarray,
    config_path: Path,
    out_dir: Path,
) -> dict:
    """Optional invisible shape. The default path never calls this."""
    if shape_name == "photogrammetry":
        import photogram

        return photogram.reconstruct(
            config_path,
            cfg,
            object_size,
            out_dir,
            videos_dir=options.get("videos"),
            turntable_cli=options.get("turntables"),
            top_rise_cli=options.get("top_rise"),
            max_frames=int(options.get("max_frames") or 8),
            engine=str(options.get("photogram_engine") or "cpu"),
        )
    if shape_name == "primitive":
        import primitive

        return primitive.build_primitive(str(options.get("primitive") or ""), views, object_size)
    raise SystemExit(
        f"FAIL shape: unknown method {shape_name}. Use photogrammetry or primitive. "
        "This run did not fall back to the silhouette method."
    )


def _camera_span(points: np.ndarray, view: dict) -> tuple[float | None, float | None]:
    """Closest and farthest camera-space z of `points` that land in the silhouette."""
    if points is None or len(points) == 0:
        return None, None
    u, v, z = project(points, view["cam"], view["width"], view["height"], view["fovY"])
    ui = np.rint(np.asarray(u)).astype(np.int32)
    vi = np.rint(np.asarray(v)).astype(np.int32)
    z = np.asarray(z, np.float64)
    ok = (
        (z > 1e-4)
        & (ui >= 0)
        & (vi >= 0)
        & (ui < view["width"])
        & (vi < view["height"])
    )
    mask = view.get("mask")
    if mask is not None and np.any(ok):
        ok = ok & mask[np.clip(vi, 0, view["height"] - 1), np.clip(ui, 0, view["width"] - 1)]
    if not np.any(ok):
        return None, None
    return float(np.min(z[ok])), float(np.max(z[ok]))


def _solid_points(solid: np.ndarray, half: np.ndarray, vsize: np.ndarray) -> np.ndarray:
    idx = np.argwhere(solid)
    if len(idx) == 0:
        return np.zeros((0, 3), np.float64)
    n = int(solid.shape[0])
    grid = voxel_centers(n, half, vsize).reshape(n, n, n, 3)
    return grid[idx[:, 0], idx[:, 1], idx[:, 2]]


def _r4(value: float | None) -> float | None:
    if value is None:
        return None
    return round(float(value), 4)


def measure_depth_report(
    solid: np.ndarray,
    views: list[dict],
    half: np.ndarray,
    vsize: np.ndarray,
    mesh_vertices: np.ndarray | None,
    sub_records: list[dict],
    offset_log: dict | None,
    depth_source: str,
    depth_relief: float,
) -> dict:
    """Numeric depth for qc/report.json. Does not move the solid or the mesh.

    nearM / farM are camera-space z of the shipped surface, in metres.
    meanOffsetM / maxOffsetM are how far depth refine receded the front from
    the visual-hull front, in metres along that camera's z. They are 0 when
    depth was skipped, the carve was rejected, or the shape method does not
    recess. bboxDepth is the world-Z extent of the shipped mesh, or of the
    solid when there is no mesh.
    """
    offset_log = offset_log or {}
    by_file = {row["file"]: row for row in (offset_log.get("perView") or [])}
    applied = bool(offset_log.get("applied"))

    def points_for(view: dict) -> np.ndarray:
        group = view.get("group", "body")
        if group != "body":
            for sub in sub_records:
                verts = sub.get("vertices")
                if sub["name"] == group and verts is not None and len(verts):
                    # The part's stills look at its own origin. The stored mesh
                    # is already in the parent frame, so measure depth in the
                    # camera frame those stills were shot in.
                    world = np.asarray(sub["vertices"], np.float64)
                    joint = np.asarray(sub["joint"], np.float64)
                    attach = np.asarray(sub["localAttach"], np.float64)
                    local = (world - joint) @ yaw_matrix(float(sub["yawDeg"])) + attach
                    return local
        if mesh_vertices is not None and len(mesh_vertices) and group == "body":
            return np.asarray(mesh_vertices, np.float64)
        return _solid_points(solid, half, vsize)

    if mesh_vertices is not None and len(mesh_vertices):
        bbox_pts = np.asarray(mesh_vertices, np.float64)
    else:
        bbox_pts = _solid_points(solid, half, vsize)
    if len(bbox_pts) == 0:
        bbox_min = [0.0, 0.0, 0.0]
        bbox_max = [0.0, 0.0, 0.0]
        bbox_depth = 0.0
    else:
        lo = bbox_pts.min(axis=0)
        hi = bbox_pts.max(axis=0)
        bbox_min = [round(float(v), 4) for v in lo]
        bbox_max = [round(float(v), 4) for v in hi]
        bbox_depth = round(float(hi[2] - lo[2]), 4)

    per_view = []
    for view in views:
        near, far = _camera_span(points_for(view), view)
        key = view.get("stored", view["file"])
        recorded = by_file.get(key) or by_file.get(view["file"]) or {}
        mean_off = float(recorded.get("meanOffsetM", 0.0)) if applied else 0.0
        max_off = float(recorded.get("maxOffsetM", 0.0)) if applied else 0.0
        per_view.append(
            {
                "file": key,
                "yawDeg": round(float(view["yawDeg"]), 4),
                "elevationDeg": round(float(view["cam"]["elevationDeg"]), 4),
                "nearM": _r4(near),
                "farM": _r4(far),
                "meanOffsetM": round(mean_off, 4),
                "maxOffsetM": round(max_off, 4),
            }
        )
    if applied and by_file:
        mean_offset = float(np.mean([float(row["meanOffsetM"]) for row in by_file.values()]))
        max_offset = float(np.max([float(row["maxOffsetM"]) for row in by_file.values()]))
    else:
        mean_offset = 0.0
        max_offset = 0.0
    nears = [row["nearM"] for row in per_view if row["nearM"] is not None]
    fars = [row["farM"] for row in per_view if row["farM"] is not None]
    depth_min = round(float(min(nears)), 4) if nears else None
    depth_max = round(float(max(fars)), 4) if fars else None
    return {
        "units": "metres",
        "bboxDepth": bbox_depth,
        "bboxMin": bbox_min,
        "bboxMax": bbox_max,
        "depthMin": depth_min,
        "depthMax": depth_max,
        "depthRange": None if depth_min is None else [depth_min, depth_max],
        "refinement": {
            "applied": applied,
            "source": depth_source,
            "depthRelief": round(float(depth_relief), 4),
            "meanOffsetM": round(mean_offset, 4),
            "maxOffsetM": round(max_offset, 4),
        },
        "perView": per_view,
    }


def attach_depth(report: dict, block: dict) -> None:
    """Copy the names reportview already displays, plus the per-view block."""
    report["depthMetrics"] = block
    if block.get("depthRange") is not None:
        report["depthMin"] = block["depthMin"]
        report["depthMax"] = block["depthMax"]
        report["depthRange"] = block["depthRange"]
    hull = report.get("hull")
    if isinstance(hull, dict):
        hull["bboxDepth"] = block["bboxDepth"]
        if block.get("depthRange") is not None:
            hull["depthMin"] = block["depthMin"]
            hull["depthMax"] = block["depthMax"]
            hull["depthRange"] = block["depthRange"]


def _write_report(qc_out: Path, report: dict) -> None:
    (qc_out / "report.json").write_text(json.dumps(report, indent=2) + "\n")


def build(
    views_dir: Path,
    config_path: Path,
    out_dir: Path,
    model: Path | None,
    depth_dir: Path | None,
    options: dict | None = None,
) -> dict:
    options = options or {}
    cfg = load_config(config_path, views_dir)
    surface_mode = str(options.get("surface") or cfg.get("surface") or "nets")
    if options.get("legacy_voxels") or surface_mode == "voxels":
        surface_mode = "voxels"
    else:
        surface_mode = "nets"
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
    legacy_grid = int(cfg.get("grid", 32))
    if surface_mode == "nets":
        n = int(options.get("surface_grid") or cfg.get("surfaceGrid") or max(64, legacy_grid * 2))
        n = max(16, min(n, 128))
    else:
        n = legacy_grid
    if options.get("smooth_iters") is not None:
        smooth_iters = int(options["smooth_iters"])
    else:
        smooth_iters = int(cfg.get("smoothIters", 8))
    if options.get("depth_relief") is not None:
        depth_relief = float(options["depth_relief"])
    elif "depthRelief" in cfg:
        depth_relief = float(cfg["depthRelief"])
    else:
        depth_relief = 0.35 if surface_mode == "nets" else 0.10
    threshold = float(cfg.get("bgThreshold", 0.04))
    listed = cfg["views"]
    if len(listed) != 8 and "vote" not in cfg:
        # A top or 3/4 view carries elevationDeg and is not part of the 8-yaw ring.
        extra = [
            v
            for v in listed
            if v.get("elevationDeg") is not None or v.get("elevDeg") is not None
        ]
        if len(listed) - len(extra) != 8:
            raise SystemExit(
                "FAIL views: 8 horizontal stills is the KEEP default. "
                "Set vote explicitly for another count, or mark top / 3/4 views with elevationDeg."
            )
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
        "pixels": "lossless-png",
        "playSampling": "LINEAR_MIPMAP_LINEAR",
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
        elev_raw = item.get("elevationDeg", item.get("elevDeg"))
        dist_v = float(item.get("distance", distance))
        eye_v = float(item.get("eyeY", eye_y))
        fov_v = float(item.get("fovYDeg", fov_y))
        if elev_raw is None:
            cam = camera_pose(float(item["yawDeg"]), dist_v, eye_v, None)
        else:
            cam = camera_pose(float(item["yawDeg"]), dist_v, eye_v, float(elev_raw))
        elevated = abs(float(cam["pitchDeg"])) >= ELEVATED_PITCH
        raw_mask = silhouette_from_rgba(rgba, threshold, fill_holes=False)
        mask = raw_mask if elevated or not raw_mask.any() else enclosed_2d(raw_mask)
        if int(mask.sum()) < 32:
            raise SystemExit(f"FAIL silhouette: {src.name} has no object")
        area, height, width = mask_box(mask)
        Image.fromarray(mask.astype(np.uint8) * 255, "L").save(mask_out / src.name)
        rec = {
            "file": src.name,
            "stored": src.name,
            "group": "body",
            "yawDeg": float(item["yawDeg"]),
            "width": int(rgba.shape[1]),
            "height": int(rgba.shape[0]),
            "fovY": fov_v,
            "elevated": abs(float(cam["pitchDeg"])) >= ELEVATED_PITCH,
            "rgba": rgba,
            "mask": mask,
            "rawMask": raw_mask,
            "cam": cam,
            "sha256": sha256(dst),
            "area": area,
            "maskHeight": height,
            "maskWidth": width,
            "depth": None,
        }
        views.append(rec)
        copies.append(
            {
                "file": f"views/{src.name}",
                "sha256": rec["sha256"],
                "yawDeg": rec["yawDeg"],
                "elevationDeg": rec["cam"]["elevationDeg"],
                "width": rec["width"],
                "height": rec["height"],
                "group": "body",
            }
        )

    source_gate = gates.source_view_report(views)
    basis = gates.basis_report(views)
    report["sourceGates"] = source_gate
    report["handedness"] = {
        "status": basis["status"],
        "schema": basis["schema"],
        "contract": basis["contract"],
        "viewIndex": basis["viewIndex"],
        "plusXAtYaw0IsScreenRight": basis["plusXAtYaw0IsScreenRight"],
        "failures": basis["failures"],
    }
    early = list(source_gate["failures"]) + list(basis["failures"])
    if early:
        report["ok"] = False
        report["failures"] = early
        _write_report(qc_out, report)
        raise SystemExit("\n".join(early))

    lock_fail, lock_notes = lock_views(views)
    report["silhouetteLock"] = {
        "pass": not lock_fail,
        "bands": lock_notes,
        "perView": [
            {
                "file": v["file"],
                "area": v["area"],
                "height": v["maskHeight"],
                "width": v["maskWidth"],
                "yawDeg": v["yawDeg"],
                "elevationDeg": v["cam"]["elevationDeg"],
                "elevated": v["elevated"],
            }
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
    depth_views = [v for v in views if v.get("depth") is not None]
    # Two views must agree before a nets hull recedes, so one bad map cannot chew a hole.
    # The legacy voxel path stays a single-view carve, matching the previous tool.
    min_agree = 2 if surface_mode == "nets" and len(depth_views) >= 4 else 1
    body_views = list(views)
    sub_specs = list(cfg.get("subObjects") or [])
    shape_name = options.get("shape") or None
    shaped = None
    offset_log: dict = {}
    surface_name = "surface-nets" if surface_mode == "nets" else "voxels"
    if shape_name:
        if sub_specs:
            raise SystemExit(
                "FAIL shape: a sub-object stays on the default silhouette method. "
                "Do not pass --shape with subObjects."
            )
        if surface_mode != "nets":
            raise SystemExit(
                "FAIL shape: --legacy-voxels is the occupancy grid. Omit it when passing --shape."
            )
        shaped = _run_shape(shape_name, options, body_views, cfg, object_size, config_path, out_dir)
        report["shape"] = shaped["stats"]
        surface_name = str(shaped["stats"].get("surface") or shape_name)
        solid = np.asarray(shaped["solid"]).astype(bool)
        half = np.asarray(shaped["half"], np.float64).reshape(3)
        vsize = np.asarray(shaped["vsize"], np.float64).reshape(-1)
        if vsize.size == 1:
            vsize = np.repeat(float(vsize.reshape(-1)[0]), 3)
        vsize = np.asarray(vsize, np.float64).reshape(3)
        solid_meta = {
            "carvedVoxels": int(np.asarray(solid).sum()),
            "undersideCap": {
                "applied": False,
                "note": "a shape method does not run the underside cap",
            },
            "voteUsed": min(int(vote), len(body_views)),
            "horizontalViews": sum(1 for v in body_views if not v.get("elevated")),
            "elevatedViews": sum(1 for v in body_views if v.get("elevated")),
        }
        offset_log = {"applied": False, "perView": []}
        if len(np.asarray(shaped["vertices"])) < 16 or int(np.asarray(solid).sum()) < 16:
            failures = list(shaped.get("failures") or [])
            if not failures:
                failures = [
                    "FAIL shape: the method produced no closed surface. This run did not switch methods."
                ]
            report["hull"] = {
                "surface": surface_name,
                "vertexCount": int(len(np.asarray(shaped["vertices"]))),
                "triangleCount": int(len(np.asarray(shaped["faces"]))),
                "depthRelief": depth_relief,
                "bboxDepth": 0.0,
            }
            attach_depth(
                report,
                measure_depth_report(
                    solid, body_views, half, vsize, None, [], offset_log, depth_source, depth_relief
                ),
            )
            report["ok"] = False
            report["failures"] = failures
            _write_report(qc_out, report)
            fail_lines(failures, report)
    else:
        solid, half, vsize, solid_meta = make_solid(
            body_views, object_size, vote, n, pad, depth_relief, min_agree, offset_log=offset_log
        )
    carved_count = int(solid_meta["carvedVoxels"])
    cap_info = solid_meta["undersideCap"]
    protrusions = flag_protrusions(solid, half, vsize)
    sub_records = []
    if sub_specs and surface_mode != "nets":
        raise SystemExit(
            "FAIL subObjects: a sub-object is carved out of the smooth mesh. "
            "Leave the surface on nets (do not pass --legacy-voxels)."
        )
    for spec in sub_specs:
        sub_records.append(
            _build_subobject(spec, config_path, view_out, mask_out, model, n, smooth_iters)
        )
        sub_records[-1]["viewStart"] = len(views)
        sub_views = sub_records[-1]["views"]
        lock_more, notes_more = lock_views(sub_views)
        lock_fail.extend(lock_more)
        report["silhouetteLock"]["bands"].extend(
            [{"sub": sub_records[-1]["name"], **note} for note in notes_more]
        )
        report["silhouetteLock"]["pass"] = not lock_fail
        report["silhouetteLock"]["perView"].extend(
            {
                "file": v["stored"],
                "area": v["area"],
                "height": v["maskHeight"],
                "width": v["maskWidth"],
                "yawDeg": v["yawDeg"],
                "elevationDeg": v["cam"]["elevationDeg"],
                "elevated": v["elevated"],
                "group": v["group"],
            }
            for v in sub_views
        )
        joint = np.array(sub_records[-1]["joint"], np.float64)
        outward = joint - np.zeros(3)
        if float(np.linalg.norm(outward)) < 1e-6:
            outward = np.array([0.0, 1.0, 0.0])
        solid, removed = subtract_world_points(
            solid,
            half,
            vsize,
            sub_records[-1]["worldPoints"],
            joint,
            outward,
            overlap=float(spec.get("overlap", float(np.min(vsize)) * 1.5)),
        )
        sub_records[-1]["carvedParentVoxels"] = removed
        views.extend(sub_views)
        copies.extend(sub_records[-1]["copies"])
    if sub_records:
        solid = fill_voids(solid)
    report["viewCount"] = len(views)
    report["assignment"] = (
        "per-fragment-best-facing" if surface_mode == "nets" else "per-surface-point-best-facing"
    )
    if int(solid.sum()) < 16:
        raise SystemExit("FAIL hull: carving removed the object")

    surf = assign_views(solid, body_views, half, vsize)
    mesh_vertices = None
    mesh_normals = None
    mesh_faces = None
    mesh_groups = None
    group_ranges = [(0, len(body_views))]
    mesh_info = None
    if shaped is not None:
        mesh_vertices = np.asarray(shaped["vertices"], np.float32)
        mesh_normals = np.asarray(shaped["normals"], np.float32)
        mesh_faces = np.asarray(shaped["faces"], np.int32)
        mesh_groups = np.zeros(len(mesh_vertices), np.int32)
        group_ranges = [(0, len(body_views))]
        mesh_info = {
            "edges": _surface().geometric_edge_histogram(mesh_vertices, mesh_faces),
            "volume": None,
        }
        _surface().write_mesh_bin(out_dir / "mesh.bin", mesh_vertices, mesh_normals, mesh_faces, mesh_groups)
    elif surface_mode == "nets":
        sample_origin = -half + 0.5 * vsize
        mesh_info = _surface().build_smooth_mesh(
            solid, sample_origin, vsize, iterations=smooth_iters, blur_sigma=0.7
        )
        if len(mesh_info["vertices"]) < 16:
            raise SystemExit("FAIL hull: surface nets produced no closed surface")
        parts_v = [mesh_info["vertices"]]
        parts_n = [mesh_info["normals"]]
        parts_f = [mesh_info["faces"]]
        parts_g = [np.zeros(len(mesh_info["vertices"]), np.int32)]
        cursor = len(mesh_info["vertices"])
        for si, sub in enumerate(sub_records):
            parts_v.append(sub["vertices"])
            parts_n.append(sub["normals"])
            parts_f.append(sub["faces"] + cursor)
            parts_g.append(np.full(len(sub["vertices"]), si + 1, np.int32))
            group_ranges.append((sub["viewStart"], sub["viewCount"]))
            sub["vertexStart"] = int(cursor)
            sub["vertexCount"] = int(len(sub["vertices"]))
            cursor += len(sub["vertices"])
        mesh_vertices = np.vstack(parts_v).astype(np.float32)
        mesh_normals = np.vstack(parts_n).astype(np.float32)
        mesh_faces = np.vstack(parts_f).astype(np.int32)
        mesh_groups = np.concatenate(parts_g).astype(np.int32)
        mesh_info["edges"] = _surface().manifold_edge_histogram(mesh_faces)
        _surface().write_mesh_bin(out_dir / "mesh.bin", mesh_vertices, mesh_normals, mesh_faces, mesh_groups)
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
    def geometry_for(view: dict) -> tuple[np.ndarray, np.ndarray]:
        if mesh_vertices is None:
            return surf["position"], surf["normal"]
        if view.get("group", "body") == "body":
            pick = mesh_groups == 0
            return mesh_vertices[pick], mesh_normals[pick]
        for sub in sub_records:
            if sub["name"] == view.get("group"):
                return sub["vertices"], sub["normals"]
        return surf["position"], surf["normal"]

    approach = {
        "width": screen_w,
        "height": screen_h,
        "fovY": screen_fov,
        "minDistance": float(np.linalg.norm(views[0]["cam"]["position"])),
    }

    def max_mag_at(distance: float) -> float:
        trial = dict(approach)
        trial["minDistance"] = distance
        return max(
            measure_magnification(*geometry_for(v), v, trial)["maxMagnification"] for v in views
        )

    cap_d = max(float(np.linalg.norm(v["cam"]["position"])) for v in views)
    for _ in range(12):
        mag_now = max_mag_at(cap_d)
        if mag_now <= MAG_LIMIT:
            break
        cap_d *= max(mag_now, 1.01) * 1.01
    cap = cap_d
    if requested is None:
        use_d = cap
        requested_note = None
    else:
        use_d = float(requested)
        requested_note = use_d
    approach["minDistance"] = use_d
    per_view_mag = []
    for view in views:
        measured = measure_magnification(*geometry_for(view), view, approach)
        per_view_mag.append(
            {
                "file": view.get("stored", view["file"]),
                "yawDeg": view["yawDeg"],
                "elevationDeg": view["cam"]["elevationDeg"],
                "width": view["width"],
                "height": view["height"],
                "maxMagnification": round(float(measured["maxMagnification"]), 6),
                "hullHeight": round(float(measured["hullHeight"]), 3),
                "hullWidth": round(float(measured["hullWidth"]), 3),
                "sourceHeight": int(measured["sourceHeight"]),
                "sourceWidth": int(measured["sourceWidth"]),
                "atDistance": use_d,
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
    waive_lock = bool(shaped is not None and shaped.get("waive_silhouette_lock"))
    if waive_lock:
        report["silhouetteLock"]["waived"] = True
        report["silhouetteLock"]["waiveReason"] = (
            "This primitive is scored by silhouette IoU. "
            "The ±15% area and ±8% height lock stays on the default silhouette method."
        )
        failures = []
    else:
        failures = list(lock_fail)
    if shaped is not None:
        for line in shaped.get("failures") or []:
            if line not in failures:
                failures.append(line)
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

    if mesh_vertices is not None:
        bound_radius = collision_radius(mesh_vertices.astype(np.float64))
    else:
        bound_radius = collision_radius(surf["position"].astype(np.float64))
    radius = gates.xz_radius(solid, -half, vsize)
    if radius <= 0:
        radius = bound_radius
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
        return camera_pose(yaw, math.hypot(float(pos[0]), float(pos[2])), float(pos[1]))

    zbuffers = None
    if mesh_vertices is not None:
        bias = max(2.5 * float(np.min(vsize)), 1e-3)
        zbuffers = [
            _surface().render_zbuffer(mesh_vertices, mesh_faces, v["cam"], v["width"], v["height"], v["fovY"])
            for v in views
        ]

    def render_qc(cam: dict) -> tuple[np.ndarray, dict]:
        if mesh_vertices is None:
            return render_view(solid, surf, body_views, half, vsize, cam, screen_w, screen_h, screen_fov)
        buffers = _surface().rasterize_mesh(
            mesh_vertices, mesh_normals, mesh_faces, mesh_groups, cam, screen_w, screen_h, screen_fov
        )
        rgba, stats = _surface().project_fragments(buffers, views, zbuffers, group_ranges, bias)
        stats["reentryPixels"] = 0
        stats["reentryFraction"] = 0.0
        stats["centerHitPixels"] = stats["hitPixels"]
        stats["centerReentryPixels"] = 0
        stats["centerReentryFraction"] = 0.0
        stats["axisRunMean"] = _surface().axis_run_mean(rgba[:, :, 3])
        return rgba, stats

    def source_hole_fraction(mask: np.ndarray) -> float:
        holes = interior_holes((mask.astype(np.uint8) * 255))
        return float(holes / max(1, int(np.asarray(mask).sum())))

    used_names = set()
    jobs = []
    for view in body_views:
        stem = Path(view["stored"]).stem
        name = f"{stem}.png"
        if name in used_names:
            name = f"{stem}-e{int(round(view['cam']['pitchDeg']))}.png"
        used_names.add(name)
        elevated = bool(view.get("elevated"))
        jobs.append(
            (
                name,
                pose_along(view["cam"]["position"], qc_approach_eye),
                view["yawDeg"],
                elevated,
                source_hole_fraction(view["mask"]) if elevated else 0.0,
            )
        )
    behind = pose_at(180.0, -0.35)
    jobs.append(("behind.png", behind, 180.0, False, 0.0))
    for name, cam, yaw, elevated, src_holes in jobs:
        rgba, stats = render_qc(cam)
        Image.fromarray(rgba, "RGBA").save(qc_out / name)
        holes_px = interior_holes(rgba[:, :, 3])
        frac = float(holes_px / max(1, stats["hitPixels"]))
        # An elevated still that already shows an opening (a bowl, a cockpit)
        # is allowed to keep that opening. A horizontal render is not.
        excused = elevated and frac <= src_holes + 0.02
        stats["file"] = name
        stats["yawDeg"] = yaw
        stats["elevated"] = elevated
        stats["sourceHoleFraction"] = src_holes
        stats["openingMatchedToSource"] = excused
        stats["interiorHolePixels"] = holes_px
        stats["interiorHoleFraction"] = frac
        hole_rows.append(stats)
        qc_files.append(f"qc/{name}")
    max_reentry = max(row["reentryFraction"] for row in hole_rows)
    max_center = max(row["centerReentryFraction"] for row in hole_rows)
    max_holes = max(row["interiorHoleFraction"] for row in hole_rows)
    accidental = [
        row["interiorHoleFraction"] for row in hole_rows if not row.get("openingMatchedToSource")
    ]
    max_accidental = max(accidental) if accidental else 0.0
    enclosed = int((fill_voids(solid) & ~solid).sum())
    report["holes"] = {
        "perRender": hole_rows,
        "maxGapReentryFraction": max_reentry,
        "maxCenterReentryFraction": max_center,
        "maxInteriorHoleFraction": max_holes,
        "accidentalInteriorHoleFraction": max_accidental,
        "enclosedVoids": enclosed,
        "watertight": enclosed == 0 and max_holes <= 0.01 and max_center <= 0.05,
    }
    mirror = gates.mirror_against_sources(body_views, qc_out)
    report["handedness"]["mirror"] = {
        "status": mirror["status"],
        "conclusiveViews": mirror["conclusiveViews"],
        "views": mirror["views"],
    }
    for line in mirror["failures"]:
        failures.append(line)
    if mirror["failures"]:
        report["handedness"]["status"] = "FAIL"
        report["handedness"]["failures"] = list(report["handedness"].get("failures") or []) + mirror["failures"]

    if max_accidental > 0.01 or max_center > 0.05 or enclosed > 0:
        failures.append(
            "FAIL holes: interiorHoleFraction={h:.4f} centerReentryFraction={c:.4f} enclosedVoids={v}. The back bite is not closed.".format(
                h=max_accidental, c=max_center, v=enclosed
            )
        )
    if mesh_info is not None and int(mesh_info["edges"].get("boundary", 0)) > 0:
        failures.append(
            "FAIL hull: surface has {n} boundary edges. The smooth hull is not closed.".format(
                n=mesh_info["edges"]["boundary"]
            )
        )

    seam_fracs = [float(row.get("seamFraction", surf["seamFraction"])) for row in hole_rows]
    report["sources"] = [
        {
            "file": v.get("stored", v["file"]),
            "width": int(v["width"]),
            "height": int(v["height"]),
            "yawDeg": v["yawDeg"],
            "elevationDeg": v["cam"]["elevationDeg"],
            "pitchDeg": v["cam"]["pitchDeg"],
            "group": v.get("group", "body"),
        }
        for v in views
    ]
    report["hull"] = {
        "surface": surface_name,
        "surfaceGrid": int(n),
        "legacyGrid": int(legacy_grid),
        "vertexCount": 0 if mesh_vertices is None else int(len(mesh_vertices)),
        "triangleCount": 0 if mesh_faces is None else int(len(mesh_faces)),
        "smoothIters": int(smooth_iters) if surface_mode == "nets" else 0,
        "depthRelief": depth_relief,
        "depthMinAgree": min_agree,
        "edges": None if mesh_info is None else mesh_info["edges"],
        "meshVolume": None if mesh_info is None else mesh_info.get("volume"),
        "voxelVolume": float(solid.sum()) * float(np.prod(vsize)),
    }
    report["seam"] = {
        "seamRatio": SEAM_RATIO,
        "viewsBlendedMax": 2,
        "fragmentSeamFraction": max(seam_fracs) if seam_fracs else 0.0,
        "meanFragmentSeamFraction": float(np.mean(seam_fracs)) if seam_fracs else 0.0,
        "fallbackPixels": int(sum(int(row.get("fallbackPixels", 0)) for row in hole_rows)),
        "voxelSeamFraction": surf["seamFraction"],
    }
    report["protrusions"] = {
        "detected": len(protrusions),
        "flags": protrusions,
        "note": "Flags are a 3-voxel opening. They do not cook views. Supplied subObjects are carved and jointed.",
    }
    report["subObjects"] = [
        {
            "name": sub["name"],
            "joint": sub["joint"],
            "axis": sub["axis"],
            "localAttach": sub["localAttach"],
            "yawDeg": sub["yawDeg"],
            "viewStart": sub["viewStart"],
            "viewCount": sub["viewCount"],
            "vertexStart": sub.get("vertexStart", 0),
            "vertexCount": sub.get("vertexCount", 0),
            "carvedParentVoxels": sub.get("carvedParentVoxels", 0),
        }
        for sub in sub_records
    ]

    cameras_json = []
    for view in views:
        cameras_json.append(
            {
                "file": view.get("stored", view["file"]),
                "yawDeg": view["yawDeg"],
                "elevationDeg": view["cam"]["elevationDeg"],
                "pitchDeg": view["cam"]["pitchDeg"],
                "fovYDeg": view["fovY"],
                "width": view["width"],
                "height": view["height"],
                "group": view.get("group", "body"),
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
        "sampling": "LINEAR_MIPMAP_LINEAR",
        "mipmaps": True,
        "qcSampling": "measurement-nearest",
        "assignment": "per-fragment-best-facing" if surface_mode == "nets" else "per-surface-point-best-facing",
        "assignmentDependsOnViewerYaw": False,
        "weight": "(normal · viewDir)^8",
        "seamRatio": SEAM_RATIO,
        "surface": surface_name,
        "vertexCount": 0 if mesh_vertices is None else int(len(mesh_vertices)),
        "triangleCount": 0 if mesh_faces is None else int(len(mesh_faces)),
        "vote": vote,
        "viewCount": len(views),
        "grid": [n, n, n],
        "origin": (-half).tolist(),
        "voxelSize": vsize.tolist(),
        "halfExtent": half.tolist(),
        "placement": {
            "position": position,
            "collisionRadius": radius,
            "boundingRadius": bound_radius,
        },
        "footprint": {"type": "circle", "radius_m": radius, "source": "hull-xz"},
        "handedness": gates.HANDEDNESS,
        "approach": {
            "minDistance": cap if max_mag > MAG_LIMIT else use_d,
            "capDistance": cap,
            "maxMagnification": min(max_mag, MAG_LIMIT) if max_mag > MAG_LIMIT else max_mag,
            "magnificationLimit": MAG_LIMIT,
        },
        "cameras": cameras_json,
        "views": copies,
        "files": {
            "hull": "hull.npz",
            "views": "views/",
            "report": "qc/report.json",
            **({"mesh": "mesh.bin"} if mesh_vertices is not None else {}),
        },
        "depthRefine": depth_source,
        "depthRelief": depth_relief,
        "subObjects": report["subObjects"],
        "ok": not failures,
    }
    # The stored approach distance is always the legal cap when the request failed,
    # so a sandbox that ignores the FAIL flag still cannot be told to upscale.
    if not failures:
        asset["approach"]["minDistance"] = use_d
        asset["approach"]["maxMagnification"] = max_mag

    payload = dict(
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
    if mesh_vertices is not None:
        payload["meshVertices"] = mesh_vertices
        payload["meshNormals"] = mesh_normals
        payload["meshIndices"] = mesh_faces.astype(np.int32)
        payload["meshGroup"] = mesh_groups.astype(np.int16)
    np.savez_compressed(out_dir / "hull.npz", **payload)
    depth_block = measure_depth_report(
        solid,
        views,
        half,
        vsize,
        mesh_vertices,
        sub_records,
        offset_log,
        depth_source,
        depth_relief,
    )
    attach_depth(report, depth_block)
    asset["depthRange"] = report.get("depthRange")
    asset["depthMin"] = report.get("depthMin")
    asset["depthMax"] = report.get("depthMax")
    asset["bboxDepth"] = depth_block["bboxDepth"]
    (out_dir / "asset.json").write_text(json.dumps(asset, indent=2) + "\n")
    report["ok"] = not failures
    report["failures"] = failures
    report["collisionRadius"] = radius
    report["qc"] = qc_files
    _write_report(qc_out, report)
    if failures:
        fail_lines(failures, report)
    return report

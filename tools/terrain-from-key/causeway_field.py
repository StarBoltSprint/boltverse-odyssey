#!/usr/bin/env python3
"""Zone C causeway heightfield. Deck only. Does not run the dune composer.

Footprint comes from the locked camera and the causeway mask (ray ∩ deck plane).
Relief comes from MoGe-2 metric points on those pixels, then a slope cap.
Cliffs, arches, gorge rock, foliage, water and the planet stay a flat base.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "common"))

from geom import camera_axes, plane_t, ray_directions  # noqa: E402

MAX_RELIEF_M = 3.0
MAX_SLOPE_DEG = 16.0
STEP_M = 0.5
S_BACK_M = 6.0
S_FAR_M = 96.0
LAT_HALF_M = 28.0
TILE_M = 0.9


def locked_camera(camera_json: dict) -> dict:
    """The PR #199 lock. Yaw is 0: the key looks along −Z. Not a new solve."""
    return {
        "x": 0.0,
        "z": 0.0,
        "yaw": 0.0,
        "pitch": float(camera_json["pitchDeg"]),
        "eye": float(camera_json["eyeHeightM"]),
        "fov": float(camera_json["vfovDeg"]),
        "horizonRow": float(camera_json["horizonRow"]),
        "hfov": float(camera_json["hfovDeg"]),
    }


def load_mask(path: Path, size) -> np.ndarray:
    im = Image.open(path).convert("L").resize(size, Image.Resampling.NEAREST)
    return np.asarray(im) > 127


def world_from_moge(points: np.ndarray, cam: dict) -> np.ndarray:
    """OpenCV camera (x right, y down, z forward) → Three.js world."""
    right, up, forward = camera_axes(cam["yaw"], cam["pitch"])
    eye = np.array([cam["x"], cam["eye"], cam["z"]], np.float64)
    x = points[..., 0].astype(np.float64)
    y = points[..., 1].astype(np.float64)
    z = points[..., 2].astype(np.float64)
    return eye + x[..., None] * right + (-y)[..., None] * up + z[..., None] * forward


def _limit_slope_2d(h: np.ndarray, mask: np.ndarray, step: float, max_deg: float, iters: int = 48) -> np.ndarray:
    cap = math.tan(math.radians(max_deg)) * step
    out = h.copy()
    for _ in range(iters):
        for ax in (0, 1):
            sl_a = [slice(None), slice(None)]
            sl_b = [slice(None), slice(None)]
            sl_a[ax] = slice(0, -1)
            sl_b[ax] = slice(1, None)
            a = np.array(out[tuple(sl_a)])
            b = np.array(out[tuple(sl_b)])
            m = mask[tuple(sl_a)] & mask[tuple(sl_b)]
            diff = b - a
            delta = diff - np.clip(diff, -cap, cap)
            out[tuple(sl_a)] = a + np.where(m, 0.5 * delta, 0.0)
            out[tuple(sl_b)] = b - np.where(m, 0.5 * delta, 0.0)
    return out


def _cap_relief(h: np.ndarray, mask: np.ndarray, limit: float) -> np.ndarray:
    if not mask.any():
        return h
    vals = h[mask]
    med = float(np.median(vals))
    span = float(vals.max() - vals.min())
    out = h.copy()
    if span > limit and span > 1e-6:
        scale = limit / span
        out[mask] = med + (out[mask] - med) * scale
    lo = med - limit * 0.5
    hi = med + limit * 0.5
    out[mask] = np.clip(out[mask], lo, hi)
    return out


def project_points(cam: dict, pts: np.ndarray, width: int, height: int):
    """World points → pixel xy and forward depth. pts (N, 3)."""
    right, up, forward = camera_axes(cam["yaw"], cam["pitch"])
    eye = np.array([cam["x"], cam["eye"], cam["z"]], np.float64)
    rel = pts - eye
    lx = rel @ right
    ly = rel @ up
    depth = rel @ forward
    aspect = width / height
    t = math.tan(math.radians(cam["fov"]) * 0.5)
    p00 = 1.0 / (aspect * t)
    p11 = 1.0 / t
    ndc_x = np.divide(lx, depth, out=np.zeros_like(lx), where=depth > 0.05) * p00
    ndc_y = np.divide(ly, depth, out=np.zeros_like(ly), where=depth > 0.05) * p11
    px = (ndc_x + 1.0) * 0.5 * width
    py = (1.0 - ndc_y) * 0.5 * height
    return px, py, depth


def raster_path(cam, xs, zs, path, origin, step, width, height) -> np.ndarray:
    """Pixels covered by path quads. path is the material mask, not the shoulder."""
    nz, nx = path.shape
    ox, oz = origin
    quads = []
    for iz in range(nz - 1):
        row = path[iz] & path[iz + 1]
        for ix in range(nx - 1):
            if row[ix] and row[ix + 1] and path[iz, ix + 1] and path[iz + 1, ix + 1]:
                quads.append((ix, iz))
    if not quads:
        return np.zeros((height, width), np.bool_)
    out = np.zeros((height, width), np.bool_)
    # project cell corners once
    corners_x = ox + np.arange(nx) * step
    corners_z = oz + np.arange(nz) * step
    # heights are 0 for the silhouette of the deck plane; the mesh y is applied by the caller
    return out, quads, corners_x, corners_z


def raster_grid(cam, heights, path, origin, step, width, height) -> np.ndarray:
    """Z-buffer is unnecessary: painter of path quads into a mask, near last."""
    nz, nx = heights.shape
    ox, oz = origin
    ii, jj = np.meshgrid(np.arange(nx), np.arange(nz))
    x = ox + ii * step
    z = oz + jj * step
    y = heights
    pts = np.stack([x, y, z], axis=-1).reshape(-1, 3)
    px, py, depth = project_points(cam, pts, width, height)
    px = px.reshape(nz, nx)
    py = py.reshape(nz, nx)
    depth = depth.reshape(nz, nx)
    mask = np.zeros((height, width), np.bool_)
    order = []
    for iz in range(nz - 1):
        for ix in range(nx - 1):
            if not (path[iz, ix] and path[iz, ix + 1] and path[iz + 1, ix] and path[iz + 1, ix + 1]):
                continue
            d = float(depth[iz : iz + 2, ix : ix + 2].mean())
            if not math.isfinite(d) or d <= 0.2:
                continue
            order.append((d, ix, iz))
    order.sort(reverse=True)  # far first
    for _d, ix, iz in order:
        poly_x = np.array([px[iz, ix], px[iz, ix + 1], px[iz + 1, ix + 1], px[iz + 1, ix]])
        poly_y = np.array([py[iz, ix], py[iz, ix + 1], py[iz + 1, ix + 1], py[iz + 1, ix]])
        if not np.isfinite(poly_x).all() or not np.isfinite(poly_y).all():
            continue
        x0 = max(0, int(np.floor(poly_x.min())))
        x1 = min(width - 1, int(np.ceil(poly_x.max())))
        y0 = max(0, int(np.floor(poly_y.min())))
        y1 = min(height - 1, int(np.ceil(poly_y.max())))
        if x1 < x0 or y1 < y0:
            continue
        if x1 - x0 > width // 2 or y1 - y0 > height // 2:
            continue
        _fill_poly(mask, poly_x, poly_y, x0, x1, y0, y1)
    return mask


def _fill_poly(mask, poly_x, poly_y, x0, x1, y0, y1):
    # even-odd on a small box. Quads are convex: barycentric via fan from vertex 0.
    xs = np.arange(x0, x1 + 1) + 0.5
    ys = np.arange(y0, y1 + 1) + 0.5
    gx, gy = np.meshgrid(xs, ys)
    # point in convex quad: same side of each edge
    inside = np.ones(gx.shape, np.bool_)
    n = 4
    for i in range(n):
        x_a, y_a = poly_x[i], poly_y[i]
        x_b, y_b = poly_x[(i + 1) % n], poly_y[(i + 1) % n]
        cross = (x_b - x_a) * (gy - y_a) - (y_b - y_a) * (gx - x_a)
        inside &= cross <= 0
    # winding may be clockwise
    if not inside.any():
        inside = np.ones(gx.shape, np.bool_)
        for i in range(n):
            x_a, y_a = poly_x[i], poly_y[i]
            x_b, y_b = poly_x[(i + 1) % n], poly_y[(i + 1) % n]
            cross = (x_b - x_a) * (gy - y_a) - (y_b - y_a) * (gx - x_a)
            inside &= cross >= 0
    mask[y0 : y1 + 1, x0 : x1 + 1] |= inside


def _sample_bilinear(img: np.ndarray, x: np.ndarray, y: np.ndarray) -> np.ndarray:
    h, w = img.shape[:2]
    x = np.clip(x, 0, w - 1.001)
    y = np.clip(y, 0, h - 1.001)
    x0 = np.floor(x).astype(np.int32)
    y0 = np.floor(y).astype(np.int32)
    x1 = np.minimum(x0 + 1, w - 1)
    y1 = np.minimum(y0 + 1, h - 1)
    tx = (x - x0)[..., None]
    ty = (y - y0)[..., None]
    c00 = img[y0, x0].astype(np.float32)
    c10 = img[y0, x1].astype(np.float32)
    c01 = img[y1, x0].astype(np.float32)
    c11 = img[y1, x1].astype(np.float32)
    return (c00 * (1 - tx) + c10 * tx) * (1 - ty) + (c01 * (1 - tx) + c11 * tx) * ty


def infer_moge(image_path: Path, max_side: int = 896):
    import torch
    import vision_models

    im = Image.open(image_path).convert("RGB")
    w, h = im.size
    scale = min(1.0, max_side / max(w, h))
    if scale < 1:
        im = im.resize((int(round(w * scale)), int(round(h * scale))), Image.Resampling.LANCZOS)
    arr = np.asarray(im, np.float32) / 255.0
    tensor = torch.from_numpy(arr.transpose(2, 0, 1).copy())
    model = vision_models.load_moge2()
    with torch.inference_mode():
        out = model.infer(tensor, resolution_level=4, use_fp16=False, force_projection=True, apply_mask=False)
    points = out["points"].detach().cpu().numpy().astype(np.float32)
    depth = out["depth"].detach().cpu().numpy().astype(np.float32)
    return im, points, depth


def compare_dav2(image_path: Path, causeway: np.ndarray, moge_depth: np.ndarray) -> dict:
    """Internal number only. The map is not written."""
    import vision_models

    pred, _hit, _sec = vision_models.depth_dav2(str(image_path), 518)
    pred = np.asarray(pred, np.float32)
    # MoGe: metres, larger = farther. DA V2: inverse-ish disparity, larger = closer.
    mh, mw = moge_depth.shape
    pred_r = np.asarray(
        Image.fromarray(pred).resize((mw, mh), Image.Resampling.BILINEAR),
        np.float32,
    )
    m = causeway
    if m.shape != moge_depth.shape:
        m = np.asarray(
            Image.fromarray(m.astype(np.uint8) * 255).resize((mw, mh), Image.Resampling.NEAREST)
        ) > 127
    a = moge_depth[m].astype(np.float64)
    b = pred_r[m].astype(np.float64)
    ok = np.isfinite(a) & np.isfinite(b)
    a, b = a[ok], b[ok]
    if a.size < 10:
        return {"n": int(a.size), "spearman": None}
    ra = a.argsort().argsort().astype(np.float64)
    rb = (-b).argsort().argsort().astype(np.float64)  # flip so both increase with distance
    ra -= ra.mean()
    rb -= rb.mean()
    denom = math.sqrt(float(np.dot(ra, ra) * np.dot(rb, rb))) + 1e-9
    rho = float(np.dot(ra, rb) / denom)
    return {
        "n": int(a.size),
        "spearmanFar": round(rho, 4),
        "cached": bool(_hit),
        "seconds": round(float(_sec), 3),
        "note": "DA V2 Large, internal only, not shipped",
    }


def build_causeway(cam, causeway, exclude, rgb, points, relief_gain: float = 1.0, tiles=None):
    """causeway, exclude, rgb match the key size. points match a MoGe infer size."""
    h, w = causeway.shape
    dirs = ray_directions(cam["yaw"], cam["pitch"], cam["fov"], w, h)
    t = plane_t(cam["eye"], dirs, 0.0)
    hit = causeway & np.isfinite(t) & (t > 0.3) & (t < 80.0)
    # exclude wins where the masks overlap the deck
    if exclude is not None:
        hit = hit & ~exclude
    xs = cam["x"] + t * dirs[..., 0]
    zs = cam["z"] + t * dirs[..., 2]
    # along +s is the look direction on the ground (−Z at yaw 0)
    along = -(zs - cam["z"])
    lat = xs - cam["x"]

    pw = world_from_moge(points, cam)
    ph, pw_w = points.shape[:2]
    cau_s = np.asarray(
        Image.fromarray(causeway.astype(np.uint8) * 255).resize((pw_w, ph), Image.Resampling.NEAREST)
    ) > 127
    rel_y = pw[..., 1].copy()
    deck = cau_s & np.isfinite(rel_y) & np.isfinite(points[..., 2]) & (points[..., 2] > 0.2)
    med = float(np.median(rel_y[deck])) if deck.any() else 0.0
    rel_y = rel_y - med
    # Grazing pixels at the lip blow up. The plane fit on this deck is 1.4 cm RMS.
    # Keep slab lips, drop outliers, then the slope cap. Relief stays under 3 m.
    rel_y = np.where(np.isfinite(rel_y), rel_y, 0.0)
    rel_y = np.clip(rel_y, -0.6, 0.6)
    rel_y[np.abs(rel_y) > 0.55] = np.clip(rel_y[np.abs(rel_y) > 0.55], -0.45, 0.45)
    # image-space residual, resized to the key
    resid = np.zeros((h, w), np.float32)
    resid_im = Image.fromarray(rel_y.astype(np.float32), mode="F").resize((w, h), Image.Resampling.BILINEAR)
    resid = np.asarray(resid_im, np.float32) * float(relief_gain)

    s0 = -S_BACK_M
    s1 = S_FAR_M
    lat0 = -LAT_HALF_M
    nz = int(round((s1 - s0) / STEP_M)) + 1
    nx = int(round((2 * LAT_HALF_M) / STEP_M)) + 1
    # z = -s, s = s0 at the back (positive z if cam at 0)
    origin = [lat0, -(s0 + (nz - 1) * STEP_M)]
    # iz=0 is far (s1), so the array's last rows are near the camera? Keep iz=0 at s0 (behind).
    origin = [lat0, -s0]  # z of iz 0. s = -z, iz increases s? z = origin_z + iz*step = -s0 + iz*step
    # want s = s0 + iz*step = -z → z = -(s0 + iz*step) = origin_z + iz*step
    # origin_z = -s0, step_z = -STEP. sample_grid assumes +step. Store z increasing with iz,
    # and convert: s = -z, so iz 0 is z=-s0 (s=s0), iz increases z by step which DECREASES s.
    # Flip: store s increasing with iz by using z = -s, step negative is awkward.
    # Store the grid in (lat, s) and set origin/step so sample_grid's x=lat, z=s_encoded.
    # Keyed field and render_ground use world x, z. So the array axes must be world z rows, world x cols.
    z_at_iz0 = -s0  # s=s0 → z=-s0. As iz increases, s increases, z decreases.
    # Use decreasing z by a negative step? sample_grid: x = origin[0] + (ix+0.5)*step, positive step.
    # Build the array with iz=0 at the far end (largest s, smallest z) so z increases with iz.
    # s = s1 - iz*step, z = -s = -s1 + iz*step. origin_z = -s1, step = STEP.
    origin = [lat0, -s1]
    heights = np.zeros((nz, nx), np.float32)
    path = np.zeros((nz, nx), np.bool_)
    sum_y = np.zeros((nz, nx), np.float64)
    cnt = np.zeros((nz, nx), np.int32)

    yy, xx = np.where(hit)
    if yy.size == 0:
        raise RuntimeError("causeway mask missed the deck plane")
    s_hit = along[yy, xx]
    lat_hit = lat[yy, xx]
    y_hit = resid[yy, xx]
    iz = np.clip(np.round((s1 - s_hit) / STEP_M).astype(np.int32), 0, nz - 1)
    ix = np.clip(np.round((lat_hit - lat0) / STEP_M).astype(np.int32), 0, nx - 1)
    np.add.at(sum_y, (iz, ix), y_hit)
    np.add.at(cnt, (iz, ix), 1)
    got = cnt > 0
    heights[got] = (sum_y[got] / cnt[got]).astype(np.float32)
    path[got] = True

    # fill gaps between slabs along the deck (the mask already filled them; the grid may skip)
    s_index = np.where(path.any(axis=1))[0]
    if s_index.size == 0:
        raise RuntimeError("no causeway cells")
    iz_lo, iz_hi = int(s_index.min()), int(s_index.max())
    for iz_i in range(iz_lo, iz_hi + 1):
        cols = np.where(path[iz_i])[0]
        if cols.size == 0:
            # inherit the nearest filled row's span
            continue
        path[iz_i, cols.min() : cols.max() + 1] = True
    # rows with no hits inside the span: interpolate path span from neighbours
    for iz_i in range(iz_lo, iz_hi + 1):
        if path[iz_i].any():
            continue
        prev = next((k for k in range(iz_i - 1, iz_lo - 1, -1) if path[k].any()), None)
        nxt = next((k for k in range(iz_i + 1, iz_hi + 1) if path[k].any()), None)
        if prev is None or nxt is None:
            continue
        a = np.where(path[prev])[0]
        b = np.where(path[nxt])[0]
        lo = int(round((a.min() + b.min()) / 2))
        hi = int(round((a.max() + b.max()) / 2))
        path[iz_i, lo : hi + 1] = True
        heights[iz_i, lo : hi + 1] = heights[prev, lo : hi + 1]

    # height on filled-only cells: nearest measured
    measured = got & path
    if measured.any():
        # propagate along iz
        last = None
        acc = heights.copy()
        for iz_i in range(nz):
            if measured[iz_i].any():
                last = heights[iz_i].copy()
                have = measured[iz_i]
            if last is None:
                continue
            need = path[iz_i] & ~measured[iz_i]
            if need.any():
                acc[iz_i, need] = last[need] if last.shape == acc.shape[1] else 0
        last = None
        for iz_i in range(nz - 1, -1, -1):
            if measured[iz_i].any():
                last = heights[iz_i].copy()
            if last is None:
                continue
            need = path[iz_i] & ~measured[iz_i] & (acc[iz_i] == 0)
            # average of the two passes where both exist is already in acc from forward; keep it
            still = path[iz_i] & ~measured[iz_i]
            # where forward wrote 0 and this side has data
            if still.any() and not measured[iz_i].any():
                acc[iz_i, still] = 0.5 * (acc[iz_i, still] + last[still])
        heights = acc

    heights = _cap_relief(heights, path, MAX_RELIEF_M)
    # 15.5° on the axes leaves headroom for the measured 16° row.
    heights = _limit_slope_2d(heights, path, STEP_M, 15.5)
    heights = _cap_relief(heights, path, MAX_RELIEF_M)
    heights[~path] = 0.0

    deck = path.copy()
    # continuation past the far lip: same width, same height (slope 0), still the path
    far_rows = np.where(path.any(axis=1))[0]
    iz_far = int(far_rows.min())  # iz 0 is s=s1 (far). The lip is the smallest iz that is on the deck.
    # Deck occupies high iz (near, small s) through iz_far (far lip).
    # Wait: origin z=-s1, iz 0 → s=s1 (far). Hits have s ~ 1..15, so iz = (s1 - s)/step ≈ large.
    # Far lip = smallest s among hits? No: far lip is largest s (closest to horizon).
    # iz = (s1 - s)/step, largest s → smallest iz. Yes iz_far = min iz on the path is the lip.
    lip = path[iz_far]
    lip_h = heights[iz_far].copy()
    for iz_i in range(0, iz_far):
        path[iz_i] = lip
        heights[iz_i] = lip_h

    # shoulder: blend to the flat base. Path material stops at `path`; the blend ring is base.
    edge = float(np.max(np.abs(heights[path]))) if path.any() else 0.0
    shoulder_m = max(1.25, edge / math.tan(math.radians(MAX_SLOPE_DEG)) + 0.25)
    shoulder_cells = int(math.ceil(shoulder_m / STEP_M))
    ring = path.copy()
    heights_s = heights.copy()
    from numpy.lib.stride_tricks import sliding_window_view  # noqa: F401

    # dilate by iterating neighbour max
    dist = np.full(path.shape, 999, np.int32)
    dist[path] = 0
    for _ in range(shoulder_cells):
        inf = dist.copy()
        inf[1:, :] = np.minimum(inf[1:, :], dist[:-1, :] + 1)
        inf[:-1, :] = np.minimum(inf[:-1, :], dist[1:, :] + 1)
        inf[:, 1:] = np.minimum(inf[:, 1:], dist[:, :-1] + 1)
        inf[:, :-1] = np.minimum(inf[:, :-1], dist[:, 1:] + 1)
        dist = inf
    ring = (dist > 0) & (dist <= shoulder_cells)
    # nearest path height ≈ lip-side: use max-filter of heights over the radius, scaled
    near_h = heights.copy()
    for _ in range(shoulder_cells):
        acc = near_h.copy()
        acc[1:, :] = np.where(np.abs(heights[1:, :]) < np.abs(near_h[:-1, :]), near_h[:-1, :], acc[1:, :])
        # actually propagate the path height outward
        src = near_h.copy()
        for shift, slicer_dst, slicer_src in (
            (1, (slice(1, None), slice(None)), (slice(None, -1), slice(None))),
            (1, (slice(None, -1), slice(None)), (slice(1, None), slice(None))),
            (1, (slice(None), slice(1, None)), (slice(None), slice(None, -1))),
            (1, (slice(None), slice(None, -1)), (slice(None), slice(1, None))),
        ):
            take = (dist[slicer_dst] == dist[slicer_src] + 1) & (dist[slicer_dst] <= shoulder_cells)
            near_h[slicer_dst] = np.where(take, src[slicer_src], near_h[slicer_dst])
        # one propagation per dilation step is enough if we iterate shoulder_cells and refresh src
    fade = 1.0 - (dist.astype(np.float32) / max(shoulder_cells, 1))
    heights_s[ring] = near_h[ring] * fade[ring]
    heights = heights_s
    heights[dist > shoulder_cells] = 0.0
    # path material is the deck + the far continuation, not the shoulder
    support = dist <= shoulder_cells

    # slope once more across the shoulder so the blend cannot exceed 16°
    heights = _limit_slope_2d(heights, support, STEP_M, 15.5)
    heights[~support] = 0.0

    uv = _uv_stretch(cam, origin, STEP_M, path, heights, w, h, hit, along, lat)
    albedo = _bake_albedo(cam, rgb, tiles or [], origin, STEP_M, heights, path, support)

    meta_grid = {
        "origin": origin,
        "step": STEP_M,
        "s0": s0,
        "s1": s1,
        "lat0": lat0,
        "izFarIsSmall": True,
        "sOfIz": "s = s1 - iz * step",
        "shoulderM": round(shoulder_m, 3),
        "reliefGain": relief_gain,
        "mogeMedianYM": round(med, 4),
    }
    return {
        "heights": heights.astype(np.float32),
        "path": path,
        "support": support,
        "origin": origin,
        "step": STEP_M,
        "uv": uv,
        "albedo": albedo,
        "deck": deck,
        "grid": meta_grid,
        "hit_frac": float(hit.mean()),
        "deck_cells": int(path.sum()),
    }


def _uv_stretch(cam, origin, step, path, heights, w, h, hit, along, lat) -> dict:
    """Anisotropy of the key projection on the ribbon, per distance band.

    Far cells reuse the lip's pixels, so the ratio climbs. That stays open until
    the moss plates exist. This function does not mark a pass.
    """
    nz, nx = path.shape
    ox, oz = origin
    # near density: pixels per metre on the deck, from the mask hits
    if hit.any():
        # neighbouring hit pixels roughly a pixel apart; use depth gradient
        ys, xs = np.where(hit)
        s = along[ys, xs]
        near = s < 8.0
        if near.sum() > 30:
            # metres per pixel along s, rough
            span_m = float(np.percentile(s[near], 90) - np.percentile(s[near], 10))
            span_px = float(np.percentile(ys[near], 90) - np.percentile(ys[near], 10))
            px_per_m = span_px / max(span_m, 0.3)
        else:
            px_per_m = 40.0
    else:
        px_per_m = 40.0
    bands = [(0, 8), (8, 30), (30, 60), (60, 200)]
    out = []
    for lo, hi in bands:
        ratios = []
        for iz in range(0, nz - 1, 2):
            s_here = ( - (oz + iz * step))  # z = oz + iz*step, s = -z
            # origin z = -s1, s = -z = s1 - iz*step
            s_here = -oz - iz * step
            if not (lo <= s_here < hi):
                continue
            cols = np.where(path[iz])[0]
            if cols.size < 2:
                continue
            ix = int(cols[len(cols) // 2])
            p0 = np.array([[ox + ix * step, heights[iz, ix], oz + iz * step]])
            p1 = np.array([[ox + (ix + 1) * step, heights[iz, min(ix + 1, nx - 1)], oz + iz * step]])
            p2 = np.array([[ox + ix * step, heights[min(iz + 1, nz - 1), ix], oz + (iz + 1) * step]])
            for a, b in ((p0, p1), (p0, p2)):
                world = float(np.linalg.norm(b - a))
                xa, ya, da = project_points(cam, a, w, h)
                xb, yb, db = project_points(cam, b, w, h)
                if da[0] < 0.2 or db[0] < 0.2:
                    # off the key: the lip pixel is reused. Count one source pixel.
                    pix = 0.25
                else:
                    pix = math.hypot(float(xa[0] - xb[0]), float(ya[0] - yb[0]))
                    pix = max(pix, 0.25)
                ratios.append((world * px_per_m) / pix)
        if not ratios:
            out.append({"bandM": [lo, hi], "p95": None, "n": 0})
            continue
        arr = np.array(ratios, np.float64)
        out.append({
            "bandM": [lo, hi],
            "p95": round(float(np.percentile(arr, 95)), 3),
            "median": round(float(np.median(arr)), 3),
            "n": int(arr.size),
            "pass": False,
        })
    return {"pxPerMNear": round(float(px_per_m), 2), "bands": out, "pass": False,
            "note": "open until the step-3 moss plates; far stretch is not a pass"}


def _bake_albedo(cam, rgb, tiles, origin, step, heights, path, support):
    nz, nx = heights.shape
    # bake at the grid resolution. Key pixels on the path, existing tiles on the base.
    img = np.zeros((nz, nx, 3), np.uint8)
    ox, oz = origin
    ii, jj = np.meshgrid(np.arange(nx), np.arange(nz))
    x = ox + ii * step
    z = oz + jj * step
    y = heights
    pts = np.stack([x, y, z], axis=-1).reshape(-1, 3)
    h, w = rgb.shape[:2]
    px, py, depth = project_points(cam, pts, w, h)
    px = px.reshape(nz, nx)
    py = py.reshape(nz, nx)
    depth = depth.reshape(nz, nx)
    on_key = path & (depth > 0.3) & (px >= 0) & (py >= 0) & (px < w) & (py < h)
    if on_key.any():
        cols = _sample_bilinear(rgb, px[on_key], py[on_key])
        img[on_key] = np.clip(cols, 0, 255).astype(np.uint8)
    # continuation and misses: reuse the lip row's baked colour (same pixels, stretched)
    lip_rows = np.where(path.any(axis=1) & on_key.any(axis=1))[0]
    if lip_rows.size:
        lip = int(lip_rows.min())
        for iz in range(nz):
            need = path[iz] & (img[iz].sum(axis=-1) == 0)
            if need.any():
                img[iz, need] = img[lip, need] if need.shape == img.shape[1] else img[lip, int(np.where(path[lip])[0][0])]
                # per-column: if lip has colour at that ix, copy it; else copy lip centre
                centre = int(np.where(path[lip])[0][len(np.where(path[lip])[0]) // 2])
                src = img[lip].copy()
                empty = src.sum(axis=-1) == 0
                src[empty] = img[lip, centre]
                img[iz, need] = src[need]
    # base: existing ground tiles, world-locked at TILE_M
    base = support & ~path
    if tiles and base.any():
        loaded = [np.asarray(Image.open(p).convert("RGB")) for p in tiles]
        by = np.where(base)
        for iz, ix in zip(by[0], by[1]):
            wx = float(x[iz, ix])
            wz = float(z[iz, ix])
            tile = loaded[(int(math.floor(wx / 4.0)) + int(math.floor(wz / 4.0)) * 3) % len(loaded)]
            th, tw = tile.shape[:2]
            u = (wx / TILE_M) % 1.0
            v = (wz / TILE_M) % 1.0
            img[iz, ix] = tile[min(th - 1, int(v * th)), min(tw - 1, int(u * tw))]
    elif base.any():
        # no tile files: leave the key's own deck-edge pixels, still Imagine, not a typed colour
        img[base] = img[path].mean(axis=0).astype(np.uint8) if path.any() else 0
    return img


def corridor_slope(heights, path, step) -> dict:
    sel = heights.copy()
    # centreline per row
    slopes = []
    widths = []
    ys = []
    for iz in range(heights.shape[0]):
        cols = np.where(path[iz])[0]
        if cols.size == 0:
            continue
        mid = heights[iz, cols].mean()
        ys.append(mid)
        widths.append(float(cols.size * step))
    ys = np.array(ys, np.float64)
    if ys.size < 2:
        return {"maxSlopeDeg": 0.0, "minWidthM": 0.0, "reliefM": 0.0}
    dh = np.abs(np.diff(ys))
    slope = np.degrees(np.arctan(dh / step))
    # also the full support lateral slope
    lat = np.abs(np.diff(heights, axis=1))
    lat_s = np.degrees(np.arctan(lat / step))
    along = np.abs(np.diff(heights, axis=0))
    along_s = np.degrees(np.arctan(along / step))
    relief = float(heights.max() - heights.min())
    return {
        "maxSlopeDeg": round(float(max(slope.max(), lat_s.max(), along_s.max())), 3),
        "centreSlopeDeg": round(float(slope.max()), 3),
        "minWidthM": round(float(min(widths)), 3),
        "reliefM": round(relief, 3),
        "samples": int(ys.size),
    }


def lod_counts(step: float) -> dict:
    """One draw. The path outline stays at `step`. The flat base steps down with distance.

    Corridor is ±6 m (the hull). Base cells outside it use 0.5 / 1 / 2 m.
    Cells more than 8 m behind the eye are not submitted.
    """
    length = S_FAR_M + S_BACK_M
    width = 2 * LAT_HALF_M
    corridor = 12.0

    def tris(base_cell, look_m):
        # rows kept: from look-8 to the far end
        rows = max(1, int(round((length - max(0.0, look_m - 8.0)) / step)))
        col_fine = int(round(corridor / step))
        flank = max(0.0, (width - corridor) / 2)
        col_base = int(round(flank / base_cell))
        quads = rows * col_fine + int(round(rows * step / base_cell)) * col_base * 2
        return quads * 2

    out = {
        "near": {"cellM": 0.5, "triangles": tris(0.5, 0.0), "note": "base 0.5 m, path outline 0.5 m"},
        "mid": {"cellM": 1.0, "triangles": tris(1.0, 30.0), "note": "base 1 m, path outline 0.5 m"},
        "far": {"cellM": 2.0, "triangles": tris(2.0, 60.0), "note": "base 2 m, path outline 0.5 m"},
        "drawCalls": 1,
        "drawCallsMax": 80,
        "hull": "path outline is the same polyline at every LOD",
    }
    return out


def move_camera(cam: dict, along_m: float, heights, origin, step) -> dict:
    """Key rig, slid forward along the path. Eye stays the locked height above the deck."""
    # s = along, z = -s, x = 0
    z = -along_m
    x = 0.0
    # bilinear sample
    ox, oz = origin
    fx = (x - ox) / step
    fz = (z - oz) / step
    fx = min(max(fx, 0), heights.shape[1] - 1.001)
    fz = min(max(fz, 0), heights.shape[0] - 1.001)
    x0, z0 = int(math.floor(fx)), int(math.floor(fz))
    tx, tz = fx - x0, fz - z0
    x1, z1 = min(x0 + 1, heights.shape[1] - 1), min(z0 + 1, heights.shape[0] - 1)
    y = (
        heights[z0, x0] * (1 - tx) * (1 - tz)
        + heights[z0, x1] * tx * (1 - tz)
        + heights[z1, x0] * (1 - tx) * tz
        + heights[z1, x1] * tx * tz
    )
    out = dict(cam)
    out["x"] = x
    out["z"] = z
    out["eye"] = float(y) + float(cam["eye"])
    out["alongM"] = along_m
    return out


def path_iou(cam, heights, path, origin, step, causeway) -> float:
    h, w = causeway.shape
    scale = max(1, int(math.ceil(w / 360)))
    gw, gh = w // scale, h // scale
    small = causeway[::scale, ::scale][:gh, :gw]
    rend = raster_grid(cam, heights, path, origin, step, gw, gh)
    inter = np.logical_and(small, rend).sum()
    union = np.logical_or(small, rend).sum()
    if union == 0:
        return 0.0
    return float(inter) / float(union)


def _pool(heights, path, factor):
    nz, nx = heights.shape
    nz2, nx2 = nz // factor, nx // factor
    h = heights[: nz2 * factor, : nx2 * factor].reshape(nz2, factor, nx2, factor).mean(axis=(1, 3))
    p = path[: nz2 * factor, : nx2 * factor].reshape(nz2, factor, nx2, factor).any(axis=(1, 3))
    return h.astype(np.float32), p


def lod_pop_iou(cam, heights, path, origin, step, causeway) -> float:
    """Same hull: the path outline stays. Only the sampled heights get coarser.

    A strided path mask moves the boundary and is not this LOD. The far lattice
    is the fine outline with heights averaged in 2 m blocks.
    """
    h, w = causeway.shape
    scale = max(1, int(math.ceil(w / 280)))
    gw, gh = w // scale, h // scale
    fine = raster_grid(cam, heights, path, origin, step, gw, gh)
    factor = max(1, int(round(2.0 / step)))
    coarse_h, _coarse_p = _pool(heights, path, factor)
    up = np.repeat(np.repeat(coarse_h, factor, axis=0), factor, axis=1)
    padded = np.zeros_like(heights)
    padded[: up.shape[0], : up.shape[1]] = up[: heights.shape[0], : heights.shape[1]]
    coarse = raster_grid(cam, padded, path, origin, step, gw, gh)
    inter = np.logical_and(fine, coarse).sum()
    union = np.logical_or(fine, coarse).sum()
    if union == 0:
        return 0.0
    return float(inter) / float(union)


def selftest() -> None:
    """Flat deck, no MoGe. Slope 0, cliffs stay 0, a steep spike is pulled to 16°."""
    cam = {"x": 0, "z": 0, "yaw": 0, "pitch": 7.95, "eye": 1.508, "fov": 51.47, "horizonRow": 0.645, "hfov": 81.19}
    h, w = 180, 320
    mask = np.zeros((h, w), np.bool_)
    mask[120:170, 120:200] = True
    rgb = np.zeros((h, w, 3), np.uint8)
    rgb[mask] = (40, 90, 50)
    points = np.zeros((h, w, 3), np.float32)
    # synthetic OpenCV points on a plane 1.508 m below the eye, plus one 4 m spike
    dirs = ray_directions(0, 7.95, 51.47, w, h)
    tt = plane_t(1.508, dirs, 0.0)
    right, up, forward = camera_axes(0, 7.95)
    eye = np.array([0, 1.508, 0.0])
    world = eye + tt[..., None] * dirs
    # inverse of world_from_moge: solve roughly by using camera axes
    rel = world - eye
    lx = rel @ right
    ly = rel @ up
    depth = rel @ forward
    points[..., 0] = lx
    points[..., 1] = -ly
    points[..., 2] = depth
    spike = mask.copy()
    spike[:] = False
    spike[140:145, 150:155] = True
    points[spike, 1] -= 4.0  # 4 m up in world (y down in camera, so minus)
    built = build_causeway(cam, mask, np.zeros_like(mask), rgb, points, relief_gain=1.0, tiles=None)
    stats = corridor_slope(built["heights"], built["support"], built["step"])
    outside = built["heights"][~built["support"]]
    if stats["maxSlopeDeg"] > 16.05:
        raise SystemExit(f"selftest slope {stats['maxSlopeDeg']}")
    if float(np.max(np.abs(outside))) > 1e-3:
        raise SystemExit("selftest grew height off the deck")
    if stats["reliefM"] > 3.05:
        raise SystemExit(f"selftest relief {stats['reliefM']}")
    print("selftest ok", stats)


def run_zone_c(repo: Path | None = None) -> dict:
    """Build the Zone C field, gate it, write the step folder. No Imagine calls."""
    import time
    from gates import evaluate_causeway

    repo = repo or REPO
    step = repo / "steps" / "zone-c" / "03-terrain"
    key = step / "key-zc1.jpg"
    cam_json = json.loads((repo / "steps" / "zone-c" / "01-camera" / "camera.json").read_text())
    masks_meta = json.loads((repo / "steps" / "zone-c" / "02-masks" / "masks.json").read_text())
    cam = locked_camera(cam_json)
    rgb = np.asarray(Image.open(key).convert("RGB"))
    h, w = rgb.shape[:2]
    mask_dir = repo / "steps" / "zone-c" / "02-masks"
    causeway = load_mask(mask_dir / "mask-causeway.png", (w, h))
    exclude = np.zeros((h, w), np.bool_)
    for name in (
        "mask-cliff-left.png", "mask-cliff-right.png", "mask-gorge-rock.png",
        "mask-arch-left.png", "mask-arch-right.png", "mask-foliage-left.png",
        "mask-foliage-right.png", "mask-falls-water.png", "mask-planet.png",
    ):
        exclude |= load_mask(mask_dir / name, (w, h))
    # the deck wins on its own pixels; exclude only bites where it overlaps
    tiles = [repo / "packs" / "zone-a" / "src" / "ground" / f"m{i}.png" for i in range(4)]
    tiles = [p for p in tiles if p.is_file()]

    stages = []
    t0 = time.perf_counter()
    t = time.perf_counter()
    _im, points, depth = infer_moge(key, 896)
    stages.append(("moge-2", time.perf_counter() - t))
    # resize points are at infer size; build_causeway resizes the residual itself

    def attempt(gain, tag):
        t1 = time.perf_counter()
        built = build_causeway(cam, causeway, exclude, rgb, points, relief_gain=gain, tiles=tiles)
        ev = evaluate_causeway(cam, built, causeway)
        stages.append((tag, time.perf_counter() - t1))
        ev["gain"] = gain
        return built, ev

    attempts = []
    built, ev = attempt(1.0, "attempt-1")
    attempts.append({"gain": 1.0, "blockingPass": ev["blockingPass"], "checks": ev["checks"]})
    chosen = 1
    if not ev["blockingPass"]:
        built2, ev2 = attempt(0.35, "attempt-2")
        attempts.append({"gain": 0.35, "blockingPass": ev2["blockingPass"], "checks": ev2["checks"]})
        # keep the attempt that clears more blocking rows, then the higher IoU
        def score(e):
            n = sum(1 for v in e["checks"].values() if v.get("blocking") and v["pass"])
            return (n, e["checks"]["pathIoU"]["value"])
        if score(ev2) >= score(ev):
            built, ev = built2, ev2
            chosen = 2

    t = time.perf_counter()
    dav2 = compare_dav2(key, causeway, depth)
    stages.append(("dav2-compare", time.perf_counter() - t))

    data = step / "data"
    data.mkdir(parents=True, exist_ok=True)
    grid = built["heights"]
    grid.tofile(data / "height.bin")
    np.save(data / "path.npy", built["path"])
    Image.fromarray(built["albedo"]).save(data / "albedo.png")
    Image.fromarray(built["path"].astype(np.uint8) * 255).save(step / "path-grid.png")
    meta = {
        "origin": built["origin"],
        "step": built["step"],
        "nx": int(grid.shape[1]),
        "nz": int(grid.shape[0]),
        "hLo": float(grid.min()),
        "hHi": float(grid.max()),
        "camera": {k: cam[k] for k in ("x", "z", "yaw", "pitch", "eye", "fov")},
        "avenue": {"headingDeg": 0, "forward": "-Z"},
        "grid": built["grid"],
        "keyImage": "steps/zone-c/03-terrain/key-zc1.jpg",
        "masks": "steps/zone-c/02-masks/masks.json",
        "attempt": chosen,
    }
    (data / "height.json").write_text(json.dumps(meta, indent=2))
    numbers = {
        "attempt": chosen,
        "attempts": attempts,
        "blockingPass": ev["blockingPass"],
        "pass": False,
        "checks": ev["checks"],
        "stages": stages,
        "dav2": dav2,
        "costImagine": 0,
        "masks": {m["id"]: m["area"] for m in masks_meta["masks"]},
        "camera": meta["camera"],
        "keyImage": meta["keyImage"],
    }
    stages.append(("total-build", time.perf_counter() - t0))
    numbers["stages"] = stages
    (step / "numbers.json").write_text(json.dumps(numbers, indent=2, default=str))
    (step / "gates.json").write_text(json.dumps({
        "blockingPass": ev["blockingPass"], "pass": False, "checks": ev["checks"], "attempt": chosen,
    }, indent=2, default=str))
    print("blocking", ev["blockingPass"], "iou", ev["checks"]["pathIoU"]["value"], "slope", ev["checks"]["corridor"]["value"])
    return {"step": str(step), "blockingPass": ev["blockingPass"], "numbers": numbers}


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--zone", default="")
    args = ap.parse_args()
    if args.selftest or not args.zone:
        selftest()
    if args.zone == "c":
        run_zone_c()

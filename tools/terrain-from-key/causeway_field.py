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


def deck_mask(path: np.ndarray) -> np.ndarray:
    """Deck only. The saved path also copies the far lip out past the key.

    That copy is a run of identical rows at small iz. The path-IoU row compares
    the deck the key can see. The copy spills past the causeway mask.
    """
    iz = 0
    nz = path.shape[0]
    while iz < nz - 1 and path[iz].any() and np.array_equal(path[iz], path[iz + 1]):
        iz += 1
    deck = path.copy()
    deck[:iz] = False
    return deck


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
    copied = np.zeros((6, 4), np.bool_)
    copied[3, 1:3] = True
    copied[4, 0:3] = True
    copied[5, 1:4] = True
    copied[:3] = copied[3]
    deck = deck_mask(copied)
    if deck[:3].any() or not np.array_equal(deck[3:], copied[3:]):
        raise SystemExit("selftest deck_mask kept the copied lip")
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


def _sep_blur(a: np.ndarray, sigma: float) -> np.ndarray:
    if sigma <= 0.25:
        return a.astype(np.float64)
    r = max(1, int(math.ceil(sigma * 3.0)))
    x = np.arange(-r, r + 1, dtype=np.float64)
    k = np.exp(-0.5 * (x / sigma) ** 2)
    k /= k.sum()
    src = a.astype(np.float64)

    def conv(img, axis):
        if axis == 1:
            p = np.pad(img, ((0, 0), (r, r)), mode="edge")
            out = np.zeros_like(img)
            for i, kv in enumerate(k):
                out += kv * p[:, i : i + img.shape[1]]
            return out
        p = np.pad(img, ((r, r), (0, 0)), mode="edge")
        out = np.zeros_like(img)
        for i, kv in enumerate(k):
            out += kv * p[i : i + img.shape[0], :]
        return out

    return conv(conv(src, 1), 0)


def _sample_linear_img(img: np.ndarray, u: float, v: float) -> np.ndarray:
    """img is top-origin. v is GL (0 at the bottom), matching flipY textures."""
    h, w = img.shape[:2]
    x = u * w - 0.5
    y = (1.0 - v) * h - 0.5
    x0 = int(math.floor(x))
    y0 = int(math.floor(y))
    tx = x - x0
    ty = y - y0
    x0 %= w
    x1 = (x0 + 1) % w
    y0c = min(max(y0, 0), h - 1)
    y1 = min(max(y0 + 1, 0), h - 1)
    a = img[y0c, x0] * (1 - tx) + img[y0c, x1] * tx
    b = img[y1, x0] * (1 - tx) + img[y1, x1] * tx
    return a * (1 - ty) + b * ty


def _orient_uv(u: float, v: float, rot: int, flip: int) -> tuple[float, float]:
    if flip:
        u = 1.0 - u
    for _ in range(rot % 4):
        u, v = v, 1.0 - u
    return u, v


def _colour_tiles(ix0, ix1, iz0, iz1, tile_m: float, radius: float = 7.0, seed: int = 1011):
    """4-colour the tile centres closer than `radius`. Rotations are seeded."""
    cells = [(ix, iz) for iz in range(iz0, iz1 + 1) for ix in range(ix0, ix1 + 1)]
    ids = {}
    for ix, iz in cells:
        ids[(ix, iz)] = ((ix - ix0) & 1) + 2 * ((iz - iz0) & 1)
    # If a square of this size still has two centres inside the radius on the same colour, grow is the caller's job.
    bad = 0
    for i, (ax, az) in enumerate(cells):
        for bx, bz in cells[i + 1 :]:
            dx = (ax - bx) * tile_m
            dz = (az - bz) * tile_m
            if dx * dx + dz * dz < radius * radius and ids[(ax, az)] == ids[(bx, bz)]:
                bad += 1
                break
        if bad:
            break
    if bad:
        raise RuntimeError(f"4 plates cannot separate centres under {radius} m at tile {tile_m} m")
    rng = np.random.Generator(np.random.PCG64(seed))
    rot = {}
    flip = {}
    for ix, iz in cells:
        rot[(ix, iz)] = int(rng.integers(0, 4))
        flip[(ix, iz)] = int(rng.integers(0, 2))
    return ids, rot, flip


def _project_grid(cam, origin, step, heights, width, height):
    nz, nx = heights.shape
    ox, oz = origin
    ii, jj = np.meshgrid(np.arange(nx), np.arange(nz))
    pts = np.stack([ox + ii * step, heights, oz + jj * step], axis=-1).reshape(-1, 3)
    px, py, depth = project_points(cam, pts, width, height)
    return px.reshape(nz, nx), py.reshape(nz, nx), depth.reshape(nz, nx)


def _key_density(cam, origin, step, heights, path, key_w, key_h):
    """Per-cell key px/m (the shorter axis) and anisotropy, from the locked camera."""
    nz, nx = heights.shape
    px, py, depth = _project_grid(cam, origin, step, heights, key_w, key_h)
    pix_x = np.hypot(np.diff(px, axis=1), np.diff(py, axis=1))
    pix_z = np.hypot(np.diff(px, axis=0), np.diff(py, axis=0))
    dx = pix_x[:-1, :]
    dz = pix_z[:, :-1]
    dep = (depth[:-1, :-1] > 0.3) & (depth[:-1, 1:] > 0.3) & (depth[1:, :-1] > 0.3)
    short = np.minimum(dx, dz)
    long = np.maximum(dx, dz)
    px_m = np.zeros((nz, nx), np.float64)
    aniso = np.full((nz, nx), 99.0, np.float64)
    inside = np.zeros((nz, nx), np.bool_)
    good = path[:-1, :-1] & dep & (short > 1e-6)
    px_m[:-1, :-1] = np.where(good, short / step, 0.0)
    aniso[:-1, :-1] = np.where(good, long / np.maximum(short, 1e-6), 99.0)
    inside[:-1, :-1] = good & (px[:-1, :-1] >= 0) & (py[:-1, :-1] >= 0) & (px[:-1, :-1] < key_w) & (py[:-1, :-1] < key_h)
    return px_m, aniso, inside


def _station_stretch(cam_view, cam_key, origin, step, heights, weight, key_w, key_h, view_w, view_h, ref_px, plate_px):
    """p95 of reference px/m over the texels actually used, on cells in this view.

    Key cells use the locked projection. Plate cells use 1408 / tile. A ratio above 1
    means the surface is coarser than the near key. Ground foreshortening (the two
    axes of one cell) is not this ratio: the near key already clears 1.3 that way.
    """
    px, py, depth = _project_grid(cam_view, origin, step, heights, view_w, view_h)
    kpx, kpy, kd = _project_grid(cam_key, origin, step, heights, key_w, key_h)
    vis = (depth[:-1:2, :-1:2] > 0.4) & (px[:-1:2, :-1:2] >= 0) & (py[:-1:2, :-1:2] >= 0)
    vis &= (px[:-1:2, :-1:2] < view_w) & (py[:-1:2, :-1:2] < view_h)
    pix_x = np.hypot(np.diff(kpx, axis=1), np.diff(kpy, axis=1))[:-1:2, ::2] / step
    pix_z = np.hypot(np.diff(kpx, axis=0), np.diff(kpy, axis=0))[::2, :-1:2] / step
    short = np.minimum(pix_x, pix_z)
    key_ok = (kd[:-1:2, :-1:2] > 0.3) & (short > 1e-3)
    key_ratio = ref_px / np.maximum(short, 1e-3)
    plate_ratio = ref_px / plate_px
    use_key = (weight[:-1:2, :-1:2] > 0.5) & key_ok
    ratio = np.where(use_key, key_ratio, plate_ratio)
    sel = ratio[vis]
    if sel.size == 0:
        return {"p95": None, "n": 0, "pass": False}
    p95 = float(np.percentile(sel, 95))
    return {"p95": round(p95, 3), "median": round(float(np.median(sel)), 3), "n": int(sel.size), "pass": p95 <= 1.3}


def _predict_delta_e(cam, origin, step, heights, path, weight, tint, ids, rot, flip, plates_lin, means, rgb, causeway, tile_m):
    """Mean CIEDE2000 of path cells splatted into the key, weighted by pixel footprint."""
    sys.path.insert(0, str(REPO / "tools" / "biome"))
    from biome_lib import delta_e2000, rgb_to_lab, linear_to_srgb

    nz, nx = heights.shape
    ox, oz = origin
    h, w = rgb.shape[:2]
    acc = np.zeros((h, w, 3), np.float64)
    cov = np.zeros((h, w), np.float64)
    key_lin = None  # filled lazily per sample via srgb bytes
    for iz in range(0, nz - 1, 2):
        for ix in range(0, nx - 1, 2):
            if not path[iz, ix]:
                continue
            wx = ox + ix * step
            wz = oz + iz * step
            p0 = np.array([[wx, float(heights[iz, ix]), wz]])
            pr = project_points(cam, p0, w, h)
            if pr[2][0] < 0.3:
                continue
            u = float(pr[0][0])
            v = float(pr[1][0])
            if not (0 <= u < w and 0 <= v < h):
                continue
            if not causeway[min(h - 1, int(v)), min(w - 1, int(u))]:
                continue
            tix = math.floor(wx / tile_m)
            tiz = math.floor(wz / tile_m)
            pid = ids[(tix, tiz)]
            fu, fv = _orient_uv(wx / tile_m - tix, wz / tile_m - tiz, rot[(tix, tiz)], flip[(tix, tiz)])
            plate = _sample_linear_img(plates_lin[pid], fu, fv)
            graded = np.clip(plate * tint[iz, ix] / np.maximum(means[pid], 0.02), 0.0, 1.0)
            wgt = float(weight[iz, ix])
            # key sample in linear, same pixel
            ky = min(h - 1, int(v))
            kx = min(w - 1, int(u))
            src = rgb[ky, kx].astype(np.float64) / 255.0
            src_lin = np.where(src <= 0.04045, src / 12.92, ((src + 0.055) / 1.055) ** 2.4)
            lin = graded * (1.0 - wgt) + src_lin * wgt
            srgb = np.clip(linear_to_srgb(lin), 0, 1)
            px0 = int(u)
            py0 = int(v)
            acc[py0, px0] += srgb
            cov[py0, px0] += 1.0
    hit = cov > 0
    sel = hit & causeway
    if sel.sum() < 50:
        return None
    pred = acc[sel] / cov[sel, None]
    ref = rgb[sel].astype(np.float64) / 255.0
    de = delta_e2000(rgb_to_lab(pred), rgb_to_lab(ref))
    return float(np.mean(de))


def apply_plates(repo: Path | None = None, attempt: int = 1) -> dict:
    """Lay the four moss plates on the kept height field. Does not call MoGe."""
    import hashlib
    import time

    from gates import evaluate_plates

    sys.path.insert(0, str(REPO / "tools" / "biome"))
    from biome_lib import rgb01_to_hex, srgb_to_linear

    repo = repo or REPO
    step = repo / "steps" / "zone-c" / "03-terrain"
    data = step / "data"
    key_path = step / "key-zc1.jpg"
    height_path = data / "height.bin"
    before = hashlib.sha256(height_path.read_bytes()).hexdigest()
    meta = json.loads((data / "height.json").read_text())
    cam_json = json.loads((repo / "steps" / "zone-c" / "01-camera" / "camera.json").read_text())
    cam = locked_camera(cam_json)
    grid = np.fromfile(height_path, dtype=np.float32).reshape(meta["nz"], meta["nx"])
    path = np.load(data / "path.npy")
    if path.shape != grid.shape:
        raise SystemExit(f"path {path.shape} != height {grid.shape}")
    rgb = np.asarray(Image.open(key_path).convert("RGB"))
    key_h, key_w = rgb.shape[:2]
    mask_dir = repo / "steps" / "zone-c" / "02-masks"
    causeway = load_mask(mask_dir / "mask-causeway.png", (key_w, key_h))
    plate_paths = [step / "plates" / f"moss-top-{i}.jpg" for i in range(1, 5)]
    plates = []
    for p in plate_paths:
        im = Image.open(p).convert("RGB")
        if im.size != (1408, 1408):
            raise SystemExit(f"{p.name} is {im.size}, need 1408x1408")
        plates.append(np.asarray(im))
    plates_lin = [srgb_to_linear(im.astype(np.float64) / 255.0) for im in plates]
    means = [im.reshape(-1, 3).mean(axis=0) for im in plates_lin]

    # attempt 1: tile large enough for the phone px/m, small enough that a 2x2 colour clears 7 m
    knobs = {
        1: {"tileM": 6.5, "bandM": 0.55, "anisoKeep": 1.18, "tintSigmaM": 8.0},
        2: {"tileM": 5.2, "bandM": 1.0, "anisoKeep": 1.12, "tintSigmaM": 10.0},
    }
    if attempt not in knobs:
        raise SystemExit(f"attempt {attempt} is past the 2-attempt budget")
    knob = knobs[attempt]
    tile_m = float(knob["tileM"])
    origin = tuple(meta["origin"])
    step_m = float(meta["step"])
    ox, oz = origin
    nz, nx = grid.shape

    t0 = time.perf_counter()
    stages = []
    t = time.perf_counter()
    px_m, aniso, inside = _key_density(cam, origin, step_m, grid, path, key_w, key_h)
    # s = -z. The +8 camera first sees the path about 13 m ahead of the lock
    # (same pitch: the deck under the eye is below the frame). The key stays on
    # the path closer than that, where the lock still has the pixels. The cutoff
    # is the short-axis px/m of that last kept row.
    s_grid = -(oz + np.arange(nz) * step_m)
    ss = np.broadcast_to(s_grid[:, None], path.shape)
    inframe = path & inside & (px_m > 1.0)
    if int(inframe.sum()) < 10:
        ref = 40.0
        s_keep = 8.0
    else:
        smin = float(ss[inframe].min())
        near_band = inframe & (ss < smin + 4.0)
        ref = float(np.median(px_m[near_band]))
        cam8 = move_camera(cam, 8.0, grid, origin, step_m)
        p8, y8, d8 = _project_grid(cam8, origin, step_m, grid, 1280, 720)
        vis8 = (d8 > 0.4) & (p8 >= 0) & (p8 < 1280) & (y8 >= 0) & (y8 < 720) & path
        s_keep = float(ss[vis8].min()) - float(knob["bandM"]) - 0.5 if vis8.any() else 12.0
    keep = path & inside & (ss <= s_keep)
    edge = path & inside & (np.abs(ss - s_keep) <= step_m)
    cutoff = float(np.median(px_m[edge])) if edge.any() else ref / 1.3
    # the projected pixel must be the causeway, not a cliff
    ii, jj = np.meshgrid(np.arange(nx), np.arange(nz))
    pts = np.stack([ox + ii * step_m, grid, oz + jj * step_m], axis=-1).reshape(-1, 3)
    px, py, depth = project_points(cam, pts, key_w, key_h)
    px = px.reshape(nz, nx)
    py = py.reshape(nz, nx)
    depth = depth.reshape(nz, nx)
    xi = np.clip(px.astype(np.int32), 0, key_w - 1)
    yi = np.clip(py.astype(np.int32), 0, key_h - 1)
    on_mask = causeway[yi, xi] & (depth > 0.3) & (px >= 0) & (py >= 0) & (px < key_w) & (py < key_h)
    keep &= on_mask
    sigma = float(knob["bandM"]) / step_m
    weight = np.clip(_sep_blur(keep.astype(np.float64), sigma), 0.0, 1.0)
    # The core stays the key. The blur is only the seam outside that core.
    weight = np.maximum(weight, keep.astype(np.float64))
    # tint from key path pixels only, then a wide blur
    src = rgb[yi, xi].astype(np.float64) / 255.0
    src_lin = srgb_to_linear(src)
    paint = on_mask & path
    acc = np.zeros((nz, nx, 3), np.float64)
    acc[paint] = src_lin[paint]
    wacc = paint.astype(np.float64)
    tint_sigma = float(knob["tintSigmaM"]) / step_m
    acc_b = np.stack([_sep_blur(acc[..., c], tint_sigma) for c in range(3)], axis=-1)
    wb = _sep_blur(wacc, tint_sigma)
    tint = np.zeros_like(acc_b)
    ok = wb > 0.02
    tint[ok] = acc_b[ok] / wb[ok, None]
    if ok.any():
        med_lin = np.median(tint[ok], axis=0)
    else:
        med_lin = np.array([0.2, 0.22, 0.16])
    tint[~ok] = med_lin
    path_px = rgb[causeway].astype(np.float64) / 255.0
    med_srgb = np.median(path_px, axis=0)
    if float(np.dot(med_srgb, [0.2126, 0.7152, 0.0722])) < 0.08:
        med_srgb = np.percentile(path_px, 75, axis=0)
    clear_hex = rgb01_to_hex(med_srgb)
    stages.append(("density-tint", time.perf_counter() - t))

    t = time.perf_counter()
    x1 = ox + (nx - 1) * step_m
    z1 = oz + (nz - 1) * step_m
    ix0 = math.floor((ox - tile_m) / tile_m)
    ix1 = math.floor((x1 + tile_m) / tile_m)
    iz0 = math.floor((oz - tile_m) / tile_m)
    iz1 = math.floor((z1 + tile_m) / tile_m)
    ids, rot, flip = _colour_tiles(ix0, ix1, iz0, iz1, tile_m)
    ntx = ix1 - ix0 + 1
    ntz = iz1 - iz0 + 1
    tile = np.zeros((ntz, ntx, 4), np.uint8)
    for iz in range(iz0, iz1 + 1):
        for ix in range(ix0, ix1 + 1):
            tile[iz - iz0, ix - ix0, 0] = ids[(ix, iz)]
            tile[iz - iz0, ix - ix0, 1] = rot[(ix, iz)]
            tile[iz - iz0, ix - ix0, 2] = 255 if flip[(ix, iz)] else 0
            tile[iz - iz0, ix - ix0, 3] = 255
    stages.append(("colour", time.perf_counter() - t))

    # shoulder support: the kept field is flat off the deck+shoulder. Rebuild the mask from height + path.
    support = path.copy()
    r = int(math.ceil(1.25 / step_m))
    padded = np.pad(path, r, mode="constant")
    for dz in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dz * dz > r * r:
                continue
            support |= padded[r + dz : r + dz + nz, r + dx : r + dx + nx]
    # heights off the real support are ~0; keep that test honest by using the saved field
    off = np.abs(grid) <= 1e-6
    # do not mark the whole zero deck as off-support if the path itself is flat
    support = support | (~off)

    t = time.perf_counter()
    widths = []
    for iz in range(nz):
        cols = np.where(path[iz])[0]
        if cols.size:
            widths.append(0.5 * cols.size * step_m)
    lane = min(3.0, float(np.median(widths)) if widths else 1.0)
    view_w, view_h = 1280, 720
    stations = []
    poses = [(8.0, 0.0, False), (30.0, 0.0, False), (60.0, 0.0, False), (8.0, lane, True)]
    for along, lat, is_lane in poses:
        cam_i = move_camera(cam, along, grid, origin, step_m)
        cam_i["x"] = lat
        cam_i["eye"] = float(_height_at(grid, origin, step_m, lat, -along)) + float(cam["eye"])
        row = _station_stretch(
            cam_i, cam, origin, step_m, grid, weight, key_w, key_h, view_w, view_h, ref, 1408.0 / tile_m,
        )
        row["alongM"] = along
        row["latM"] = lat
        row["laneChange"] = is_lane
        stations.append(row)
    uv = {
        "cutoffPxPerM": round(cutoff, 3),
        "refPxPerM": round(ref, 3),
        "anisoKeep": knob["anisoKeep"],
        "tileM": tile_m,
        "bandM": knob["bandM"],
        "laneShiftM": round(lane, 3),
        "keepFraction": round(float(keep.mean()), 4),
        "stations": stations,
        "pass": all(s["pass"] for s in stations),
        "note": "p95 of the active material (key projection where weight>0.5, else the plate) at each station",
    }
    pred = _predict_delta_e(
        cam, origin, step_m, grid, path, weight, tint, ids, rot, flip, plates_lin, means, rgb, causeway, tile_m,
    )
    stages.append(("stretch-colour", time.perf_counter() - t))

    # maps. height.bin is not written.
    w8 = np.clip(weight * 255.0, 0, 255).astype(np.uint8)
    weight_rgba = np.stack([w8, w8, w8, np.full_like(w8, 255)], axis=-1)
    (data / "weight.bin").write_bytes(np.ascontiguousarray(weight_rgba).tobytes())
    tint_u8 = np.clip(tint * 255.0, 0, 255).astype(np.uint8)
    tint_rgba = np.concatenate([tint_u8, np.full((*tint_u8.shape[:2], 1), 255, np.uint8)], axis=-1)
    (data / "tint.bin").write_bytes(np.ascontiguousarray(tint_rgba).tobytes())
    (data / "tile.bin").write_bytes(tile.tobytes())
    right, up, forward = camera_axes(cam["yaw"], cam["pitch"])
    aspect = key_w / key_h
    t_fov = math.tan(math.radians(cam["fov"]) * 0.5)
    plates_json = {
        "tileM": tile_m,
        "tile0": [ix0, iz0],
        "tileN": [ntx, ntz],
        "gridOrigin": [ox, oz],
        "gridSize": [(nx - 1) * step_m, (nz - 1) * step_m],
        "keyP": [1.0 / (aspect * t_fov), 1.0 / t_fov],
        "keySize": [key_w, key_h],
        "eye": [cam["x"], cam["eye"], cam["z"]],
        "right": right.tolist(),
        "up": up.tolist(),
        "forward": forward.tolist(),
        "means": [m.tolist() for m in means],
        "clearSrgb": med_srgb.tolist(),
        "clearHex": clear_hex,
        "platePx": 1408,
        "cutoffPxPerM": round(cutoff, 3),
        "laneShiftM": round(lane, 3),
        "nx": nx,
        "nz": nz,
        "plates": [f"moss-top-{i}.jpg" for i in range(1, 5)],
    }
    (data / "plates.json").write_text(json.dumps(plates_json, indent=2))
    html = step.parents[2] / "tools" / "terrain-from-key" / "staging" / "zone-c" / "index.html"
    # step is steps/zone-c/03-terrain, parents[2] is repo
    html = repo / "tools" / "terrain-from-key" / "staging" / "zone-c" / "index.html"
    text = html.read_text()
    import re
    text = re.sub(r"background:\s*#[0-9a-fA-F]{3,8}", f"background: {clear_hex}", text)
    html.write_text(text)

    ev = evaluate_plates(cam, grid, path, support, origin, step_m, causeway, uv, None, uv["pass"])
    # predicted colour is not the blocking render number
    ev["checks"]["deltaE2000"]["predicted"] = None if pred is None else round(pred, 3)
    ev["checks"]["deltaE2000"]["pass"] = False
    ev["checks"]["deltaE2000"]["note"] = "CIEDE2000 mean on the 16:9 headless render; prediction is not the row"
    ev["blockingPass"] = False
    after = hashlib.sha256(height_path.read_bytes()).hexdigest()
    if after != before:
        raise SystemExit("height.bin changed during apply_plates")
    prev_path = step / "numbers.json"
    prev = json.loads(prev_path.read_text()) if prev_path.is_file() else {}
    base = prev.get("base") or {
        "pass": prev.get("pass"),
        "blockingPass": prev.get("blockingPass"),
        "checks": prev.get("checks"),
        "attempt": prev.get("attempt"),
    }
    numbers = {
        "base": base,
        "attempt": attempt,
        "pass": False,
        "blockingPass": False,
        "checks": ev["checks"],
        "plates": plates_json,
        "uv": uv,
        "predictedDeltaE2000": None if pred is None else round(pred, 3),
        "heightSha256": after,
        "stages": stages + [("total", time.perf_counter() - t0)],
        "costImagine": 4,
        "costNote": "4 moss plates already committed; this step did not call Imagine",
        "camera": ev["camera"],
        "metric": "CIEDE2000",
    }
    prev_path.write_text(json.dumps(numbers, indent=2))
    (step / "gates.json").write_text(json.dumps({
        "pass": False, "blockingPass": False, "checks": ev["checks"], "attempt": attempt,
    }, indent=2))
    print("cutoff", round(cutoff, 2), "ref", round(ref, 2), "tile", tile_m, "lane", round(lane, 2))
    print("stretch", [(s["alongM"], s["latM"], s["p95"], s["pass"]) for s in stations])
    print("predictedDeltaE", numbers["predictedDeltaE2000"], "clear", clear_hex)
    print("height", after[:12], "unchanged")
    return numbers


def _height_at(heights, origin, step, x, z):
    ox, oz = origin
    nz, nx = heights.shape
    fx = min(max((x - ox) / step, 0.0), nx - 1.001)
    fz = min(max((z - oz) / step, 0.0), nz - 1.001)
    x0, z0 = int(math.floor(fx)), int(math.floor(fz))
    tx, tz = fx - x0, fz - z0
    x1, z1 = min(x0 + 1, nx - 1), min(z0 + 1, nz - 1)
    return (
        heights[z0, x0] * (1 - tx) * (1 - tz)
        + heights[z0, x1] * tx * (1 - tz)
        + heights[z1, x0] * (1 - tx) * tz
        + heights[z1, x1] * tx * tz
    )


def score_renders(repo: Path | None = None, gate_json: Path | None = None) -> dict:
    """CIEDE2000 on the key-camera render, then the object-gate verdict. Writes pass only if both clear."""
    sys.path.insert(0, str(REPO / "tools" / "biome"))
    from biome_lib import delta_e2000, rgb_to_lab

    repo = repo or REPO
    step = repo / "steps" / "zone-c" / "03-terrain"
    numbers = json.loads((step / "numbers.json").read_text())
    render = step / "renders" / "along0-1280x720-terrain.png"
    if not render.is_file():
        raise SystemExit(f"missing {render}")
    key = np.asarray(Image.open(step / "key-zc1.jpg").convert("RGB"))
    shot = Image.open(render).convert("RGB")
    shot = shot.resize((key.shape[1], key.shape[0]), Image.Resampling.BILINEAR)
    shot_a = np.asarray(shot).astype(np.float64) / 255.0
    key_a = key.astype(np.float64) / 255.0
    mask = load_mask(repo / "steps" / "zone-c" / "02-masks" / "mask-causeway.png", (key.shape[1], key.shape[0]))
    if mask.sum() < 50:
        raise SystemExit("causeway mask empty")
    de = delta_e2000(rgb_to_lab(shot_a[mask]), rgb_to_lab(key_a[mask]))
    mean = float(np.mean(de))
    med = float(np.median(de))
    numbers["checks"]["deltaE2000"]["value"] = round(mean, 3)
    numbers["checks"]["deltaE2000"]["median"] = round(med, 3)
    numbers["checks"]["deltaE2000"]["metric"] = "CIEDE2000"
    numbers["checks"]["deltaE2000"]["pass"] = mean < 10.0
    gate_path = gate_json or (step / "object-gate" / "report.json")
    gate_pass = False
    if gate_path.is_file():
        gate = json.loads(gate_path.read_text())
        gate_pass = gate.get("verdict") == "PASS"
        numbers["objectGate"] = {"verdict": gate.get("verdict"), "path": str(gate_path.relative_to(repo))}
    else:
        numbers["objectGate"] = {"verdict": "MISSING", "path": str(gate_path)}
    py_ok = all(v.get("pass") for k, v in numbers["checks"].items() if k != "deltaE2000" and v.get("blocking", True))
    # uv and the other rows were stored by apply_plates; deltaE just updated
    py_ok = all(v.get("pass") for v in numbers["checks"].values() if v.get("blocking", True))
    numbers["blockingPass"] = bool(py_ok)
    numbers["pass"] = bool(py_ok and gate_pass)
    (step / "numbers.json").write_text(json.dumps(numbers, indent=2))
    (step / "gates.json").write_text(json.dumps({
        "pass": numbers["pass"], "blockingPass": numbers["blockingPass"],
        "checks": numbers["checks"], "attempt": numbers.get("attempt"),
        "objectGate": numbers["objectGate"],
    }, indent=2))
    print("deltaE2000", round(mean, 3), "median", round(med, 3), "pass", numbers["pass"], "gate", numbers["objectGate"]["verdict"])
    return numbers


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--zone", default="")
    ap.add_argument("--attempt", type=int, default=1)
    ap.add_argument("--score", action="store_true")
    args = ap.parse_args()
    if args.score:
        score_renders()
    elif args.zone == "c":
        apply_plates(attempt=args.attempt)
    elif args.selftest or not args.zone:
        selftest()

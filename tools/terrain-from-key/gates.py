"""Blocking gates for the key-matched ground. Numbers, not a hand-written PASS."""

from __future__ import annotations

import math

import numpy as np

from build_field import avenue_frame, mask_iou, render_ground, sample_grid, skyline_fill


def downsample(grid, factor):
    h, w = grid.shape
    h2, w2 = h // factor, w // factor
    g = grid[: h2 * factor, : w2 * factor]
    return g.reshape(h2, factor, w2, factor).mean(axis=(1, 3))


def vertex_cost(lods, cell_m, far_pad=1):
    """Triangles of one all-round build at a cell centre. Same topology the page uses."""
    far = lods[-1][0]
    rr = math.ceil(far / cell_m) + far_pad
    tris = 0
    verts = 0
    for j in range(-rr, rr + 1):
        for i in range(-rr, rr + 1):
            d = max(0.0, math.hypot(i * cell_m, j * cell_m) - cell_m * 0.7072)
            res = 0
            for m, r in lods:
                if d <= m:
                    res = r
                    break
            if not res:
                continue
            n = res + 1
            verts += n * n + 4 * n
            tris += res * res * 2
            tris += 4 * res * 2  # skirt
    return {"verts": verts, "tris": tris, "cells": (2 * rr + 1) ** 2}


def corridor_stats(grid, origin, step, cam, heading, half_w):
    xs = origin[0] + (np.arange(grid.shape[1]) + 0.5) * step
    zs = origin[1] + (np.arange(grid.shape[0]) + 0.5) * step
    # sample the centreline every step for 260 m each way
    hd = math.radians(heading)
    fx, fz = math.sin(hd), -math.cos(hd)
    ss = np.arange(-260, 261, step)
    x = cam["x"] + ss * fx
    z = cam["z"] + ss * fz
    y = sample_grid(grid, origin, step, x, z)
    dh = np.abs(np.diff(y))
    slope = np.degrees(np.arctan(dh / step))
    # banks
    rx, rz = math.sin(hd + math.pi / 2), -math.cos(hd + math.pi / 2)
    yb = []
    for side in (-1, 1):
        xb = x + side * (half_w + 12) * rx
        zb = z + side * (half_w + 12) * rz
        yb.append(sample_grid(grid, origin, step, xb, zb))
    bank = np.maximum(yb[0], yb[1])
    sink = bank - y
    return {
        "maxSlopeDeg": float(slope.max()) if slope.size else 0.0,
        "medianSinkM": float(np.median(sink)),
        "minSinkM": float(np.min(sink)),
    }


def repetition_score(grid, step):
    """Peak autocorrelation of an edge row, lags 40..220 m. A stamped tile scores near 1."""
    row = grid[8].astype(np.float64)
    row -= row.mean()
    if np.dot(row, row) < 1e-6:
        return 1.0
    corr = np.correlate(row, row, mode="full")
    corr = corr[len(row) - 1 :]
    corr /= corr[0]
    i0 = max(1, int(40 / step))
    i1 = min(len(corr) - 1, int(220 / step))
    return float(np.max(corr[i0:i1])) if i1 > i0 else 0.0


def feature_hits(cam, grid, origin, step, features, width, height):
    from geom import ray_directions

    dirs = ray_directions(cam["yaw"], cam["pitch"], cam["fov"], width, height)
    mask, dist = render_ground(cam, grid, origin, step, width, height, march=6.0)
    rows = []
    for f in features:
        x, y, w, h = f["box"]
        px = int((x + w * 0.5) * width)
        py = int((y + h * 0.5) * height)
        px = min(max(px, 0), width - 1)
        py = min(max(py, 0), height - 1)
        # search inside the box for a hit, prefer the centre
        x0, x1 = int(x * width), int((x + w) * width)
        y0, y1 = int(y * height), int((y + h) * height)
        sub_m = mask[y0:y1, x0:x1]
        sub_d = dist[y0:y1, x0:x1]
        hit = bool(mask[py, px])
        if sub_m.any():
            yy, xx = np.where(sub_m)
            heights = []
            for yyi, xxi in zip(yy, xx):
                py_i, px_i = y0 + int(yyi), x0 + int(xxi)
                ti = float(dist[py_i, px_i])
                if not math.isfinite(ti):
                    continue
                di = dirs[py_i, px_i]
                heights.append((cam["eye"] + ti * float(di[1]), py_i, px_i, ti))
            if not heights:
                t = float("nan")
                wy = float("nan")
            else:
                # Crests: the high point in the box. The lane: the low point.
                # Median of the crest line (upper 35% of a crest box) or of the
                # whole trough box. Max-versus-min scored a hole as a dune.
                if f["role"] == "crest":
                    y_cut = y0 + 0.35 * max(1, (y1 - y0))
                    band = [hgt for hgt in heights if hgt[1] <= y_cut]
                    pool = band or heights
                    pool.sort(key=lambda hgt: hgt[0])
                    wy, py, px, t = pool[len(pool) // 2]
                else:
                    heights.sort(key=lambda hgt: hgt[0])
                    wy, py, px, t = heights[len(heights) // 2]
                hit = True
        else:
            t = float("nan")
            wy = float("nan")
        rows.append({
            "id": f["id"],
            "role": f["role"],
            "hit": hit,
            "image": [px / width, py / height],
            "distanceM": t,
            "heightM": wy,
            "box": f["box"],
        })
    return rows


def depth_order_ok(rows) -> bool:
    good = [r for r in rows if r["hit"] and math.isfinite(r["distanceM"])]
    if len(good) < 3:
        return False
    ok = True
    for a in good:
        for b in good:
            if a is b:
                continue
            # lower in the image (larger y) should be closer
            if a["image"][1] > b["image"][1] + 0.04 and a["distanceM"] > b["distanceM"] + 8:
                ok = False
    return ok


def place_ok(rows) -> dict:
    by = {r["id"]: r for r in rows}
    need = ["dune_left", "mound_right", "sunken_avenue", "slab_field"]
    present = all(by.get(k, {}).get("hit") for k in need)
    av = by.get("sunken_avenue", {}).get("heightM", 0) or 0
    left = by.get("dune_left", {}).get("heightM", -99)
    right = by.get("mound_right", {}).get("heightM", -99)
    slab = by.get("slab_field", {}).get("heightM", 99)
    raised = (left is not None and left > av + 1.2) and (right is not None and right > av + 1.2)
    slab_low = slab is not None and slab < av + 1.6
    return {
        "present": present,
        "banksAboveAvenue": bool(raised),
        "slabsInLane": bool(slab_low),
        "pass": bool(present and raised and slab_low),
    }


def evaluate(cam, built, key_ground, tower_cols, features, lods, cell_m, heading, half_w):
    grid, origin, step = built["heights"], built["origin"], built["step"]
    h, w = key_ground.shape
    # Gate frames stay small. The silhouette is a column profile, not a beauty render.
    scale = max(1, int(math.ceil(w / 160)))
    gw, gh = w // scale, h // scale
    key_small = key_ground[::scale, ::scale][:gh, :gw]
    towers = tower_cols[::scale][:gw]
    rend, _ = render_ground(cam, grid, origin, step, gw, gh, march=6.0)
    iou = mask_iou(skyline_fill(key_small), skyline_fill(rend), towers)

    # far lattice: 8 m blocks (the far LOD spacing) resampled, same camera
    factor = max(1, int(round(8.0 / step)))
    coarse = downsample(grid, factor)
    # render_ground samples any grid with its own origin/step
    c_origin = origin
    c_step = step * factor
    rend_c, _ = render_ground(cam, coarse, c_origin, c_step, gw, gh, march=6.0)
    pop = mask_iou(skyline_fill(rend), skyline_fill(rend_c), towers)

    # approach: 24 m forward, silhouette should move, not swap
    hd = math.radians(heading)
    cam2 = dict(cam)
    cam2["x"] = cam["x"] + 24 * math.sin(hd)
    cam2["z"] = cam["z"] - 24 * math.cos(hd)
    # eye stays the same height above the new feet
    feet = float(sample_grid(grid, origin, step, cam2["x"], cam2["z"]))
    cam2["eye"] = cam["eye"]  # absolute eye offset is already "eye above 0"; feet moved
    # camera y is stored as eye above the zero at spawn. Keep absolute eye height = cam eye
    # (the rig adds eye to surface). For the silhouette test use eye height above local feet.
    cam2["eye"] = feet + cam["eye"]
    rend2, _ = render_ground(cam2, grid, origin, step, gw, gh, march=6.0)
    approach = mask_iou(skyline_fill(rend), skyline_fill(rend2))

    cost = vertex_cost(lods, cell_m)
    corr = corridor_stats(grid, origin, step, cam, heading, half_w)
    rep = repetition_score(grid, step)
    rows = feature_hits(cam, grid, origin, step, features, gw, gh)
    placed = place_ok(rows)
    order = depth_order_ok(rows)
    # playable: slope <= 16 deg (15 plus the lattice step), sink stays positive
    slope_ok = corr["maxSlopeDeg"] <= 16.0
    sink_ok = corr["medianSinkM"] >= 1.2
    pop_ok = pop >= 0.90
    # approach IoU stays high because 24 m does not swap the dune layout
    approach_ok = approach >= 0.85
    rep_ok = rep < 0.75
    checks = {
        "silhouetteIoU": {"value": round(iou, 4), "need": 0.80, "pass": iou >= 0.80},
        "depthOrder": {"value": order, "pass": order},
        "features": {"value": placed, "pass": placed["pass"]},
        "lodPopIoU": {"value": round(pop, 4), "need": 0.90, "pass": pop_ok},
        "approachIoU": {"value": round(approach, 4), "need": 0.85, "pass": approach_ok},
        "repetition": {"value": round(rep, 4), "need": "<0.75", "pass": rep_ok},
        "corridor": {"value": {k: round(v, 3) for k, v in corr.items()}, "pass": slope_ok and sink_ok},
        "vertexCost": {"value": cost, "pass": True},
    }
    hard = all(checks[k]["pass"] for k in checks)
    return {"pass": hard, "checks": checks, "features": rows, "cost": cost}


def evaluate_causeway(cam, built, causeway_mask, stations=(0.0, 8.0, 30.0, 60.0)):
    """Zone C blocking rows. UV stretch is reported and is not a pass.

    The dune rows (banks, sink, colour skyline) do not apply: cliffs are not terrain.
    """
    from causeway_field import corridor_slope, lod_counts, lod_pop_iou, move_camera, path_iou

    heights = built["heights"]
    path = built["deck"]
    origin = built["origin"]
    step = built["step"]
    iou = path_iou(cam, heights, path, origin, step, causeway_mask)
    slope = corridor_slope(heights, built["support"], step)
    slope_ok = slope["maxSlopeDeg"] <= 16.0 and slope["minWidthM"] >= 0.8
    relief_ok = slope["reliefM"] <= 3.0 + 1e-3
    outside = built["heights"][~built["support"]]
    cliff = float(np.max(np.abs(outside))) if outside.size else 0.0
    cliff_ok = cliff <= 1e-3
    pop = lod_pop_iou(cam, heights, built["path"], origin, step, causeway_mask)
    pops = []
    for along in stations:
        cam_i = move_camera(cam, along, heights, origin, step)
        pops.append({
            "alongM": along,
            "lodPopIoU": round(lod_pop_iou(cam_i, heights, built["path"], origin, step, causeway_mask), 4),
        })
    pop_ok = pop >= 0.90 and all(p["lodPopIoU"] >= 0.90 for p in pops)
    lod = lod_counts(step)
    draws_ok = lod["drawCalls"] < 80
    # continuous: every station has a finite deck under the eye
    gaps = []
    for along in stations:
        cam_i = move_camera(cam, along, heights, origin, step)
        if not math.isfinite(cam_i["eye"]):
            gaps.append(along)
    continuous = not gaps
    uv = built["uv"]
    checks = {
        "pathIoU": {"value": round(iou, 4), "need": 0.75, "pass": iou >= 0.75, "blocking": True},
        "corridor": {"value": slope, "pass": slope_ok and continuous, "blocking": True},
        "reliefM": {"value": slope["reliefM"], "need": "<=3", "pass": relief_ok, "blocking": True},
        "cliffsFlat": {"value": round(cliff, 4), "pass": cliff_ok, "blocking": True},
        "lodPopIoU": {"value": round(pop, 4), "need": 0.90, "pass": pop >= 0.90, "blocking": True},
        "approachLod": {"value": pops, "need": 0.90, "pass": pop_ok, "blocking": True},
        "drawCalls": {"value": lod, "need": "<80", "pass": draws_ok, "blocking": True},
        "uvStretch": {"value": uv, "pass": False, "blocking": False,
                      "note": "open until moss plates; not a pass"},
    }
    blocking = all(v["pass"] for v in checks.values() if v.get("blocking", True))
    return {
        "pass": False,  # UV stretch is open, so the step is not a PASS
        "blockingPass": blocking,
        "checks": checks,
        "camera": {k: cam[k] for k in ("x", "z", "yaw", "pitch", "eye", "fov")},
    }


def evaluate_plates(cam, heights, path, support, origin, step, causeway_mask, uv, delta_e, stations_ok):
    """Plate step rows. pass stays false until the headless object-gate agrees.

    Draw calls use the plate budget (<= 12). The older causeway row (< 80) is unchanged.
    """
    from causeway_field import corridor_slope, deck_mask, lod_counts, lod_pop_iou, move_camera, path_iou

    iou = path_iou(cam, heights, deck_mask(path), origin, step, causeway_mask)
    slope = corridor_slope(heights, path, step)
    slope_ok = slope["maxSlopeDeg"] <= 16.0 and slope["minWidthM"] >= 0.8
    relief_ok = slope["reliefM"] <= 3.0 + 1e-3
    outside = heights[~support]
    cliff = float(np.max(np.abs(outside))) if outside.size else 0.0
    cliff_ok = cliff <= 1e-3
    pops = []
    for along in (0.0, 8.0, 30.0, 60.0):
        cam_i = move_camera(cam, along, heights, origin, step)
        pops.append({
            "alongM": along,
            "lodPopIoU": round(lod_pop_iou(cam_i, heights, path, origin, step, causeway_mask), 4),
        })
    pop_ok = all(p["lodPopIoU"] >= 0.90 for p in pops)
    lod = lod_counts(step)
    draws_ok = lod["drawCalls"] <= 12
    uv_ok = bool(uv.get("pass")) and stations_ok
    colour_ok = delta_e is not None and delta_e < 10.0
    checks = {
        "pathIoU": {"value": round(iou, 4), "need": 0.75, "pass": iou >= 0.75, "blocking": True},
        "corridor": {"value": slope, "pass": slope_ok, "blocking": True},
        "reliefM": {"value": slope["reliefM"], "need": "<=3", "pass": relief_ok, "blocking": True},
        "cliffsFlat": {"value": round(cliff, 4), "pass": cliff_ok, "blocking": True},
        "lodPopIoU": {"value": pops[0]["lodPopIoU"], "need": 0.90, "pass": pops[0]["lodPopIoU"] >= 0.90, "blocking": True},
        "approachLod": {"value": pops, "need": 0.90, "pass": pop_ok, "blocking": True},
        "drawCalls": {"value": lod, "need": "<=12", "pass": draws_ok, "blocking": True},
        "uvStretch": {"value": uv, "need": "<=1.3", "pass": uv_ok, "blocking": True},
        "deltaE2000": {
            "value": None if delta_e is None else round(float(delta_e), 3),
            "need": "<10",
            "metric": "CIEDE2000",
            "pass": colour_ok,
            "blocking": True,
            "note": "mean CIEDE2000 of causeway-mask pixels, key camera, 16:9 render vs key",
        },
    }
    blocking = all(v["pass"] for v in checks.values() if v.get("blocking"))
    return {
        "pass": False,
        "blockingPass": blocking,
        "checks": checks,
        "camera": {k: cam[k] for k in ("x", "z", "yaw", "pitch", "eye", "fov")},
    }

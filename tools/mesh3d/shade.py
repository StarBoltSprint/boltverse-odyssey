"""Project Imagine views onto an invisible mesh.

Blend weight is cos(yaw delta) and zero past 45 degrees.
A texel no view covers stays alpha 0. Nothing is filled in.
"""

from __future__ import annotations

import math

import numpy as np

from cameras import camera_pose, fov_y_deg, project_points, yaw_weight


def rasterize(
    vertices: np.ndarray,
    normals: np.ndarray,
    faces: np.ndarray,
    cam: dict,
    width: int,
    height: int,
    fov_y: float,
    want_attr: bool = True,
) -> dict:
    """Front faces only. v grows downward, so a front face has negative screen area."""
    u, v, z = project_points(vertices, cam, width, height, fov_y)
    pix = int(width) * int(height)
    zbuf = np.full(pix, np.inf, np.float32)
    hit = np.zeros(pix, np.uint8)
    pos = nrm = None
    if want_attr:
        pos = np.zeros((pix, 3), np.float32)
        nrm = np.zeros((pix, 3), np.float32)
    if len(faces) == 0:
        return _pack(zbuf, hit, pos, nrm, height, width)
    verts = np.asarray(vertices, np.float64)
    norms = np.asarray(normals, np.float64)
    w = int(width)
    h = int(height)
    for i0, i1, i2 in np.asarray(faces, np.int32):
        z0 = float(z[i0])
        z1 = float(z[i1])
        z2 = float(z[i2])
        if z0 < 1e-3 or z1 < 1e-3 or z2 < 1e-3:
            continue
        ax, ay = float(u[i0]), float(v[i0])
        bx, by = float(u[i1]), float(v[i1])
        cx, cy = float(u[i2]), float(v[i2])
        area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
        if area >= -1e-6:
            continue
        minx = max(int(math.floor(min(ax, bx, cx))), 0)
        maxx = min(int(math.ceil(max(ax, bx, cx))), w - 1)
        miny = max(int(math.floor(min(ay, by, cy))), 0)
        maxy = min(int(math.ceil(max(ay, by, cy))), h - 1)
        if minx > maxx or miny > maxy:
            continue
        xs = np.arange(minx, maxx + 1, dtype=np.float64) + 0.5
        ys = np.arange(miny, maxy + 1, dtype=np.float64) + 0.5
        xg, yg = np.meshgrid(xs, ys)
        w0 = (by - cy) * (xg - cx) + (cx - bx) * (yg - cy)
        w1 = (cy - ay) * (xg - cx) + (ax - cx) * (yg - cy)
        w2 = area - w0 - w1
        mask = (w0 <= 1e-4) & (w1 <= 1e-4) & (w2 <= 1e-4)
        if not np.any(mask):
            continue
        inv_a = 1.0 / z0
        inv_b = 1.0 / z1
        inv_c = 1.0 / z2
        b0 = w0 / area
        b1 = w1 / area
        b2 = w2 / area
        inv_z = b0 * inv_a + b1 * inv_b + b2 * inv_c
        depth = (1.0 / np.maximum(inv_z, 1e-8)).astype(np.float32)
        slots = (np.arange(miny, maxy + 1)[:, None] * w + np.arange(minx, maxx + 1)[None, :])[mask]
        dsel = depth[mask]
        closer = dsel < zbuf[slots]
        if not np.any(closer):
            continue
        slots = slots[closer]
        zbuf[slots] = dsel[closer]
        hit[slots] = 1
        if want_attr:
            p0 = verts[i0] * inv_a
            p1 = verts[i1] * inv_b
            p2 = verts[i2] * inv_c
            n0 = norms[i0] * inv_a
            n1 = norms[i1] * inv_b
            n2 = norms[i2] * inv_c
            b0s = b0[mask][closer]
            b1s = b1[mask][closer]
            b2s = b2[mask][closer]
            invs = inv_z[mask][closer]
            pw = (b0s[:, None] * p0 + b1s[:, None] * p1 + b2s[:, None] * p2) / invs[:, None]
            nw = b0s[:, None] * n0 + b1s[:, None] * n1 + b2s[:, None] * n2
            ln = np.linalg.norm(nw, axis=1, keepdims=True)
            nw = nw / np.maximum(ln, 1e-8)
            pos[slots] = pw.astype(np.float32)
            nrm[slots] = nw.astype(np.float32)
    return _pack(zbuf, hit, pos, nrm, h, w)


def _pack(zbuf, hit, pos, nrm, height, width):
    out = {
        "z": zbuf.reshape(height, width),
        "hit": hit.reshape(height, width).astype(bool),
    }
    if pos is not None:
        out["pos"] = pos.reshape(height, width, 3)
        out["normal"] = nrm.reshape(height, width, 3)
    return out


def silhouette(vertices, faces, cam, width, height, fov_y) -> np.ndarray:
    normals = np.zeros_like(vertices, np.float32)
    return rasterize(vertices, normals, faces, cam, width, height, fov_y, want_attr=False)["hit"]


def mask_iou(pred: np.ndarray, gt: np.ndarray) -> float:
    inter = np.logical_and(pred, gt).sum()
    union = np.logical_or(pred, gt).sum()
    if union == 0:
        return 0.0
    return float(inter) / float(union)


def _sample_nearest(rgba: np.ndarray, u: np.ndarray, v: np.ndarray):
    """measurement buffer only: nearest source texel for QC coverage, not the play view.

    The viewer samples the PNG with LINEAR_MIPMAP_LINEAR and mipmaps (law 65).
    """
    h, w = rgba.shape[:2]
    ui = np.rint(u).astype(np.int32)
    vi = np.rint(v).astype(np.int32)
    inside = (ui >= 0) & (vi >= 0) & (ui < w) & (vi < h)
    color = np.zeros((len(u), 3), np.float32)
    alpha = np.zeros(len(u), np.float32)
    sel = np.flatnonzero(inside)
    if len(sel):
        tex = rgba[vi[sel], ui[sel]]
        color[sel] = tex[:, :3]
        alpha[sel] = tex[:, 3]
    return color, alpha, inside


def shade_points(
    points: np.ndarray,
    viewer_yaw: float,
    sources: list[dict],
    zbuffers: list[np.ndarray],
    z_bias: float,
    limit_deg: float = 45.0,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Returns rgb uint8, alpha uint8, and the two-view colour delta (0 where unblended).

    Uncovered points are alpha 0 and rgb 0. No fill colour.
    """
    n = len(points)
    acc = np.zeros((n, 3), np.float32)
    wsum = np.zeros(n, np.float32)
    best_c = np.zeros((n, 3), np.float32)
    second_c = np.zeros((n, 3), np.float32)
    best_w = np.zeros(n, np.float32)
    second_w = np.zeros(n, np.float32)
    pts = np.asarray(points, np.float64)
    for src, zbuf in zip(sources, zbuffers):
        weight = yaw_weight(viewer_yaw - src["cam"]["yawDeg"], limit_deg)
        if weight <= 0.0:
            continue
        u, v, z = project_points(pts, src["cam"], src["width"], src["height"], src["fovY"])
        color, alpha, inside = _sample_nearest(src["rgba"], u, v)
        ui = np.rint(u).astype(np.int32)
        vi = np.rint(v).astype(np.int32)
        h, w = zbuf.shape
        on = inside & (alpha > 16) & (z > 1e-3) & (vi >= 0) & (ui >= 0) & (vi < h) & (ui < w)
        if np.any(on):
            depth = np.full(n, np.inf, np.float32)
            sel = np.flatnonzero(on)
            depth[sel] = zbuf[vi[sel], ui[sel]]
            on = on & (z <= depth + z_bias) & np.isfinite(depth)
        if not np.any(on):
            continue
        acc[on] += weight * color[on]
        wsum[on] += weight
        take_best = on & (weight >= best_w)
        # Demote the previous best into second where we replace it.
        second_c[take_best] = best_c[take_best]
        second_w[take_best] = best_w[take_best]
        best_c[take_best] = color[take_best]
        best_w[take_best] = weight
        take_second = on & ~take_best & (weight >= second_w)
        second_c[take_second] = color[take_second]
        second_w[take_second] = weight
    rgb = np.zeros((n, 3), np.uint8)
    alpha_out = np.zeros(n, np.uint8)
    ok = wsum > 0
    rgb[ok] = np.clip(np.rint(acc[ok] / wsum[ok, None]), 0, 255).astype(np.uint8)
    alpha_out[ok] = 255
    delta = np.zeros(n, np.float32)
    both = ok & (second_w > 0)
    if np.any(both):
        delta[both] = np.abs(best_c[both] - second_c[both]).mean(axis=1) / 255.0
    return rgb, alpha_out, delta


def render_frame(
    vertices,
    normals,
    faces,
    viewer: dict,
    sources: list[dict],
    zbuffers: list[np.ndarray],
    width: int,
    height: int,
    fov_y: float,
    ground_y: float | None,
    z_bias: float,
) -> tuple[np.ndarray, dict]:
    buffers = rasterize(vertices, normals, faces, viewer, width, height, fov_y, want_attr=True)
    rgba = np.zeros((height, width, 4), np.uint8)
    hit = buffers["hit"]
    if ground_y is not None:
        buried = buffers["pos"][:, :, 1] < float(ground_y)
        hit = hit & ~buried
    visible = int(hit.sum())
    if visible == 0:
        return rgba, {"visible": 0, "covered": 0, "ghostMean": 0.0, "blended": 0}
    ys, xs = np.nonzero(hit)
    rgb, alpha, delta = shade_points(
        buffers["pos"][ys, xs],
        viewer["yawDeg"],
        sources,
        zbuffers,
        z_bias,
    )
    covered = alpha > 0
    rgba[ys[covered], xs[covered], :3] = rgb[covered]
    rgba[ys[covered], xs[covered], 3] = 255
    blended = int((delta > 0).sum())
    ghost = float(delta[delta > 0].mean()) if blended else 0.0
    return rgba, {
        "visible": visible,
        "covered": int(covered.sum()),
        "ghostMean": ghost,
        "blended": blended,
    }


def source_z(vertices, normals, faces, sources: list[dict], z_scale: float = 1.0) -> list[np.ndarray]:
    out = []
    for src in sources:
        w = max(8, int(round(src["width"] * z_scale)))
        h = max(8, int(round(src["height"] * z_scale)))
        buf = rasterize(vertices, normals, faces, src["cam"], w, h, src["fovY"], want_attr=False)
        # Store at the sampled resolution. Callers must project into this size.
        src = dict(src)
        out.append(buf["z"])
    return out


def prepare_sources(views, yaws, distance, elevation, hfov, z_scale: float = 1.0) -> tuple[list[dict], list[np.ndarray]]:
    """Bind cameras. z_scale < 1 keeps the occlusion buffer smaller than the PNG.

    Projection of colour still uses the full PNG. The z buffer is only a test,
    so a coarser one needs a larger bias (applied by the caller).
    """
    from engines import _pick

    sources = []
    for yaw in yaws:
        view = _pick(views, yaw)
        fov_y = fov_y_deg(hfov, view["width"], view["height"])
        sources.append(
            {
                **{k: view[k] for k in ("file", "path", "yawDeg", "rgba", "mask", "width", "height")},
                "cam": camera_pose(view["yawDeg"], distance, elevation),
                "fovY": fov_y,
            }
        )
    return sources


def build_source_z(vertices, normals, faces, sources, z_scale: float) -> list[np.ndarray]:
    buffers = []
    for src in sources:
        w = max(16, int(round(src["width"] * z_scale)))
        h = max(16, int(round(src["height"] * z_scale)))
        # Colour samples stay on the full image. The z test uses this grid,
        # so shade_points must be given a source whose width/height match the buffer.
        proxy = dict(src)
        proxy["width"] = w
        proxy["height"] = h
        # Scale the rgba lookup by keeping the original rgba and projecting
        # into the coarse size inside a wrapper. shade_points projects with
        # src width. So the z buffer must match src width. Rasterize coarse
        # then nearest-upsample the z to full size (occlusion test only).
        coarse = rasterize(vertices, normals, faces, src["cam"], w, h, src["fovY"], want_attr=False)["z"]
        if w == src["width"] and h == src["height"]:
            buffers.append(coarse)
            continue
        ys = np.linspace(0, h - 1, src["height"])
        xs = np.linspace(0, w - 1, src["width"])
        yi = np.clip(np.rint(ys).astype(np.int32), 0, h - 1)
        xi = np.clip(np.rint(xs).astype(np.int32), 0, w - 1)
        buffers.append(coarse[np.ix_(yi, xi)])
    return buffers


def bbox_mag(vertices, faces, cam, width, height, fov_y, mask: np.ndarray) -> float:
    hit = silhouette(vertices, faces, cam, width, height, fov_y)
    pred = _axis_box(hit)
    gt = _axis_box(mask)
    if pred is None or gt is None:
        return 0.0
    pw, ph = pred
    gw, gh = gt
    return float(max(pw / max(gw, 1), ph / max(gh, 1)))


def _axis_box(mask: np.ndarray):
    ys, xs = np.nonzero(mask)
    if len(xs) == 0:
        return None
    return float(xs.max() - xs.min() + 1), float(ys.max() - ys.min() + 1)


def fit_view_distance(
    vertices,
    faces,
    views,
    yaws,
    photo_distance: float,
    elevation: float,
    hfov: float,
    phone_w: int,
    phone_h: int,
    limit: float = 1.0,
) -> dict:
    """Pull the phone camera back until magnification is <= limit.

    Photo cameras stay at photo_distance. The orbit keeps one distance.
    The measure renders a 180 px-wide proxy and scales it up to the phone,
    so the ratio is the 720-wide magnification.
    """
    from engines import _pick

    phone_fov_y = fov_y_deg(hfov, phone_w, phone_h)
    proxy_w = 180
    proxy_h = max(8, int(round(phone_h * (proxy_w / float(phone_w)))))
    proxy_fov_y = fov_y_deg(hfov, proxy_w, proxy_h)
    dist = float(photo_distance)
    scale = float(phone_w) / float(proxy_w)

    def measure(distance: float):
        worst = 0.0
        per = []
        for yaw in yaws:
            view = _pick(views, yaw)
            cam = camera_pose(yaw, distance, elevation)
            hit = silhouette(vertices, faces, cam, proxy_w, proxy_h, proxy_fov_y)
            pred = _axis_box(hit)
            gt = _axis_box(view["mask"])
            if pred is None or gt is None:
                mag = 0.0
            else:
                mag = float(max((pred[0] * scale) / max(gt[0], 1), (pred[1] * scale) / max(gt[1], 1)))
            per.append({"yawDeg": float(yaw), "maxMagnification": round(mag, 4)})
            worst = max(worst, mag)
        return worst, per

    worst, per = measure(dist)
    pulls = 0
    while worst > limit and pulls < 4:
        dist *= worst / max(limit * 0.98, 1e-3)
        worst, per = measure(dist)
        pulls += 1
    return {
        "viewDistance": dist,
        "maxMagnification": worst,
        "perView": per,
        "phoneFovYDeg": phone_fov_y,
        "withinLimit": bool(worst <= limit + 1e-3),
    }


def ground_half(vertices: np.ndarray) -> float:
    y = vertices[:, 1]
    return float((y.min() + y.max()) * 0.5)


def coverage_ratio(stats: dict) -> float:
    vis = int(stats.get("visible") or 0)
    if vis <= 0:
        return 0.0
    return float(stats["covered"]) / float(vis)

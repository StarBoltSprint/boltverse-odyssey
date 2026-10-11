"""Software raster of the Blender dump. Perspective-correct key projection."""
from __future__ import annotations

import numpy as np


def project(pos, fx, fy, cx, cy):
    z = np.maximum(pos[:, 2], 1e-4)
    x = fx * pos[:, 0] / z + cx
    y = cy - fy * pos[:, 1] / z
    return np.stack([x, y, z], 1)


def yaw_about_centre(pos, deg):
    c = pos.mean(0)
    a = np.deg2rad(deg)
    rot = np.array([
        [np.cos(a), 0, np.sin(a)],
        [0, 1, 0],
        [-np.sin(a), 0, np.cos(a)],
    ], np.float64)
    return (pos - c) @ rot.T + c


def _bary(p, a, b, c):
    v0 = b - a
    v1 = c - a
    v2 = p - a
    den = v0[0] * v1[1] - v1[0] * v0[1]
    if abs(den) < 1e-8:
        return None
    u = (v2[0] * v1[1] - v1[0] * v2[1]) / den
    v = (v0[0] * v2[1] - v2[0] * v0[1]) / den
    w = 1.0 - u - v
    return w, u, v


def raster(pos, pix, faces, key_bgr, fx, fy, cx, cy, shade=False, light=(0.45, 0.15, 0.88)):
    """pix is Nx2 source pixels for the front verts; back verts repeat them."""
    h, w = key_bgr.shape[:2]
    screen = project(pos, fx, fy, cx, cy)
    color = np.zeros((h, w, 3), np.float32)
    cover = np.zeros((h, w), np.uint8)
    zbuf = np.full((h, w), np.inf, np.float32)
    normals = None
    if shade:
        normals = _vertex_normals(pos, faces)
        L = np.array(light, np.float64)
        L = L / np.linalg.norm(L)
    key = key_bgr.astype(np.float32)
    for tri in faces:
        ids = [int(i) for i in tri]
        s = screen[ids]
        area = (s[1, 0] - s[0, 0]) * (s[2, 1] - s[0, 1]) - (s[2, 0] - s[0, 0]) * (s[1, 1] - s[0, 1])
        if abs(area) < 1e-4:
            continue
        minx = max(0, int(np.floor(s[:, 0].min())))
        maxx = min(w - 1, int(np.ceil(s[:, 0].max())))
        miny = max(0, int(np.floor(s[:, 1].min())))
        maxy = min(h - 1, int(np.ceil(s[:, 1].max())))
        if minx > maxx or miny > maxy:
            continue
        xs = np.arange(minx, maxx + 1) + 0.5
        ys = np.arange(miny, maxy + 1) + 0.5
        gx, gy = np.meshgrid(xs, ys)
        a, b, c = s[0, :2], s[1, :2], s[2, :2]
        v0, v1 = b - a, c - a
        den = v0[0] * v1[1] - v1[0] * v0[1]
        if abs(den) < 1e-8:
            continue
        v2x, v2y = gx - a[0], gy - a[1]
        u = (v2x * v1[1] - v1[0] * v2y) / den
        v = (v0[0] * v2y - v2x * v0[1]) / den
        w0 = 1.0 - u - v
        inside = (w0 >= 0) & (u >= 0) & (v >= 0)
        zs = s[:, 2]
        z = w0 * zs[0] + u * zs[1] + v * zs[2]
        zb = zbuf[miny : maxy + 1, minx : maxx + 1]
        closer = inside & (z < zb)
        if not np.any(closer):
            continue
        zb[closer] = z[closer]
        zbuf[miny : maxy + 1, minx : maxx + 1] = zb
        inv = w0 / zs[0] + u / zs[1] + v / zs[2]
        sx = (w0 * pix[ids[0], 0] / zs[0] + u * pix[ids[1], 0] / zs[1] + v * pix[ids[2], 0] / zs[2]) / inv
        sy = (w0 * pix[ids[0], 1] / zs[0] + u * pix[ids[1], 1] / zs[1] + v * pix[ids[2], 1] / zs[2]) / inv
        ix = np.clip(np.rint(sx).astype(np.int32), 0, w - 1)
        iy = np.clip(np.rint(sy).astype(np.int32), 0, h - 1)
        rgb = key[iy, ix]
        if shade:
            n = (w0[..., None] * normals[ids[0]] + u[..., None] * normals[ids[1]] + v[..., None] * normals[ids[2]])
            nd = np.linalg.norm(n, axis=2, keepdims=True) + 1e-6
            lambert = 0.22 + 0.78 * np.clip(np.sum((n / nd) * L, axis=2), 0, None)
            rgb = rgb * lambert[..., None]
        patch = color[miny : maxy + 1, minx : maxx + 1]
        patch[closer] = rgb[closer]
        color[miny : maxy + 1, minx : maxx + 1] = patch
        cov = cover[miny : maxy + 1, minx : maxx + 1]
        cov[closer] = 1
        cover[miny : maxy + 1, minx : maxx + 1] = cov
    return color.astype(np.uint8), cover


def _vertex_normals(pos, faces):
    n = np.zeros_like(pos, np.float64)
    for a, b, c in faces:
        a, b, c = int(a), int(b), int(c)
        fn = np.cross(pos[b] - pos[a], pos[c] - pos[a])
        n[a] += fn
        n[b] += fn
        n[c] += fn
    norm = np.linalg.norm(n, axis=1, keepdims=True)
    return n / np.maximum(norm, 1e-8)


def source_pixels(grid):
    pix = []
    for row in grid:
        for p in row:
            pix.append((p["x"], p["y"]))
    front = pix
    return np.array(front + front, np.float64)

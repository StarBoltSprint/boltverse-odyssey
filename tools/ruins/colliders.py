"""Tight colliders from the lofted faces. Shape only.

Same rule as packs/<pack>/play/collide.js, on flat ground at the seat:
a cell is a wall when a face crosses Bolt's body band (ground + step .. ground + clear).
Faces above the band (a lintel, a deck) and under it (a buried sill) are not walls,
so a real opening stays walkable. Unreachable free cells (a pier's hollow) are solid.
The play build uses the live relief; this file proves the openings on the measured parts.
"""

import struct
from collections import deque

import numpy as np

INF = 1e20


def _edt1d(f):
    n = len(f)
    d = np.zeros(n)
    v = np.zeros(n, dtype=np.int64)
    z = np.zeros(n + 1)
    k = 0
    v[0] = 0
    z[0] = -INF
    z[1] = INF
    for q in range(1, n):
        s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
        while s <= z[k]:
            k -= 1
            s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
        k += 1
        v[k] = q
        z[k] = s
        z[k + 1] = INF
    k = 0
    for q in range(n):
        while z[k + 1] < q:
            k += 1
        d[q] = (q - v[k]) ** 2 + f[v[k]]
    return d


def edt(feature):
    """Exact Euclidean distance (cells) to the nearest feature cell. Same algorithm as collide.js."""
    g = np.where(feature > 0, 0.0, INF)
    for r in range(g.shape[0]):
        g[r, :] = _edt1d(g[r, :])
    for c in range(g.shape[1]):
        g[:, c] = _edt1d(g[:, c])
    return np.sqrt(g)


def reachable(free):
    """Free cells 4-connected to the grid border."""
    nz, nx = free.shape
    seen = np.zeros_like(free, dtype=bool)
    q = deque()
    for ix in range(nx):
        for iz in (0, nz - 1):
            if free[iz, ix] and not seen[iz, ix]:
                seen[iz, ix] = True
                q.append((iz, ix))
    for iz in range(nz):
        for ix in (0, nx - 1):
            if free[iz, ix] and not seen[iz, ix]:
                seen[iz, ix] = True
                q.append((iz, ix))
    while q:
        iz, ix = q.popleft()
        for dz, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            jz, jx = iz + dz, ix + dx
            if 0 <= jz < nz and 0 <= jx < nx and free[jz, jx] and not seen[jz, jx]:
                seen[jz, jx] = True
                q.append((jz, jx))
    return seen


def read_ruin(path):
    data = path.read_bytes()
    if data[:4] != b"RUIN":
        raise SystemExit("not a ruin mesh: " + str(path))
    n = struct.unpack_from("<I", data, 4)[0]
    o = 8
    groups = []
    for _ in range(n):
        skin, vc, ic = struct.unpack_from("<III", data, o)
        o += 12
        xyzuv = np.frombuffer(data, dtype="<f4", count=vc * 5, offset=o).reshape(vc, 5)
        o += vc * 20
        idx = np.frombuffer(data, dtype="<u4", count=ic, offset=o).reshape(-1, 3)
        o += ic * 4
        groups.append((skin, xyzuv, idx))
    return groups


def mesh_groups(meshes):
    out = []
    for m in meshes:
        if not m.idx:
            continue
        xyzuv = np.asarray(m.xyzuv, dtype=np.float32).reshape(-1, 5)
        idx = np.asarray(m.idx, dtype=np.int64).reshape(-1, 3)
        out.append((m.skin, xyzuv, idx))
    return out


def face_samples(groups, spacing):
    """Points on every triangle, at most `spacing` apart (object frame)."""
    pts = []
    for _skin, xyzuv, idx in groups:
        a = xyzuv[idx[:, 0], :3].astype(np.float64)
        b = xyzuv[idx[:, 1], :3].astype(np.float64)
        c = xyzuv[idx[:, 2], :3].astype(np.float64)
        e = np.maximum.reduce([
            np.linalg.norm(b - a, axis=1),
            np.linalg.norm(c - a, axis=1),
            np.linalg.norm(c - b, axis=1),
        ])
        n = np.maximum(1, np.ceil(e / spacing)).astype(np.int64)
        for k in np.unique(n):
            sel = n == k
            A, B, C = a[sel], b[sel], c[sel]
            if k == 1:
                pts.extend([A, B, C, (A + B + C) / 3.0])
                continue
            for i in range(k + 1):
                for j in range(k + 1 - i):
                    u = i / k
                    w = j / k
                    pts.append(A + u * (B - A) + w * (C - A))
    return np.concatenate(pts, axis=0) if pts else np.zeros((0, 3))


def body_field(groups, ground_y, opt):
    """Signed distance (m) to the nearest wall, on a cell grid in the object frame."""
    cell = float(opt.get("cellM", 0.1))
    step = float(opt.get("stepM", 0.25))
    clear = float(opt.get("clearM", 1.3))
    pad = float(opt.get("padM", 1.2))
    pts = face_samples(groups, cell * 0.5)
    x0 = pts[:, 0].min() - pad
    z0 = pts[:, 2].min() - pad
    nx = int(np.ceil((pts[:, 0].max() - pts[:, 0].min() + 2 * pad) / cell)) + 1
    nz = int(np.ceil((pts[:, 2].max() - pts[:, 2].min() + 2 * pad) / cell)) + 1
    ix = np.floor((pts[:, 0] - x0) / cell).astype(np.int64)
    iz = np.floor((pts[:, 2] - z0) / cell).astype(np.int64)
    h = pts[:, 1] - ground_y
    lift = np.zeros((nz, nx))
    sel = (h > -0.02) & (h <= step)
    np.maximum.at(lift, (iz[sel], ix[sel]), h[sel])
    hb = h - lift[iz, ix]
    wall = np.zeros((nz, nx), dtype=np.uint8)
    selb = (hb > step) & (hb < clear)
    wall[iz[selb], ix[selb]] = 1
    covered = np.zeros((nz, nx), dtype=np.uint8)
    covered[iz[h > clear], ix[h > clear]] = 1
    free = wall == 0
    reach = reachable(free)
    sealed = int((free & ~reach).sum())
    wall = (~reach).astype(np.uint8)
    d_out = edt(wall)
    d_in = edt(1 - wall)
    sd = np.where(wall == 1, -(d_in - 0.5) * cell, (d_out - 0.5) * cell)
    return {
        "x0": x0, "z0": z0, "cell": cell, "nx": nx, "nz": nz,
        "sd": sd, "wall": wall, "covered": covered, "sealed": sealed,
    }


def sd_at(field, x, z):
    fx = (x - field["x0"]) / field["cell"] - 0.5
    fz = (z - field["z0"]) / field["cell"] - 0.5
    ix = int(np.clip(np.floor(fx), 0, field["nx"] - 2))
    iz = int(np.clip(np.floor(fz), 0, field["nz"] - 2))
    tx = float(np.clip(fx - ix, 0, 1))
    tz = float(np.clip(fz - iz, 0, 1))
    s = field["sd"]
    a = s[iz, ix] * (1 - tx) + s[iz, ix + 1] * tx
    b = s[iz + 1, ix] * (1 - tx) + s[iz + 1, ix + 1] * tx
    return float(a * (1 - tz) + b * tz)


def covered_at(field, x, z):
    ix = int((x - field["x0"]) / field["cell"])
    iz = int((z - field["z0"]) / field["cell"])
    if 0 <= ix < field["nx"] and 0 <= iz < field["nz"]:
        return bool(field["covered"][iz, ix])
    return False


def walk_line(field, a, b, radius, step=0.05):
    """Smallest clearance (m) along a straight run from a to b (object frame x, z)."""
    a = np.asarray(a, dtype=np.float64)
    b = np.asarray(b, dtype=np.float64)
    n = max(2, int(np.linalg.norm(b - a) / step))
    worst = 1e9
    for t in np.linspace(0.0, 1.0, n):
        p = a + (b - a) * t
        worst = min(worst, sd_at(field, p[0], p[1]))
    return {"minClearM": round(worst - radius, 3), "free": bool(worst >= radius)}


def wall_area(field, pred):
    """Wall area (m^2) in cells whose centre passes pred(x, z)."""
    zz, xx = np.nonzero(field["wall"])
    cx = field["x0"] + (xx + 0.5) * field["cell"]
    cz = field["z0"] + (zz + 0.5) * field["cell"]
    keep = np.array([pred(x, z) for x, z in zip(cx, cz)], dtype=bool) if len(cx) else np.zeros(0, bool)
    return round(float(keep.sum()) * field["cell"] ** 2, 3)


def free_span(field, cx, z, lo, hi, step=0.02):
    """Width (m) of free ground through (cx, z) along x, limited to [lo, hi]."""
    x = cx
    while x > lo and sd_at(field, x, z) >= 0.0:
        x -= step
    xl = x
    x = cx
    while x < hi and sd_at(field, x, z) >= 0.0:
        x += step
    return x - xl

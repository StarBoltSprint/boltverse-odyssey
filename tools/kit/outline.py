"""Outline-mask shaping (port of legacy/relief5-6 + kitfit3): the tier front and the cornice come from
the key's SAM masks, back-projected through the key camera onto their planes, then extruded as clean
2.5-D cells. Each cell has its own front depth, so the door recess and the stone blocks are real steps
with side walls (no displacement spikes), and the solid stays watertight.

Also the v6 per-vertex snow rule: _SNOW = max(drift lift on up faces, key snow mask seen from the
key camera); on the cornice, down-facing faces get _ICE instead of snow.
"""
from __future__ import annotations

import cv2
import numpy as np

from fit import hit_plane
from geom import Mesh, box, vertex_normals, weld
from render import project


def _quad(V, F, pts, normal):
    a, b, c, d = (np.asarray(p, float) for p in pts)
    i = len(V)
    V += [a, b, c, d]
    if np.dot(np.cross(b - a, c - a), normal) >= 0:
        F += [(i, i + 1, i + 2), (i, i + 2, i + 3)]
    else:
        F += [(i, i + 2, i + 1), (i, i + 3, i + 2)]


def extrude_cells(occ, front, back, x0, z0, cell, name="cells", material="stone") -> Mesh:
    """occ[j, i] (j=0 bottom row) is solid from y=front[j,i] to y=back[j,i] (back may be a scalar).
    Watertight by construction: every wall is split at every depth level it crosses."""
    nz, nx = occ.shape
    back = np.broadcast_to(np.asarray(back, float), occ.shape)
    levels = np.unique(np.round(np.concatenate([front[occ], back[occ]]), 4))
    V, F = [], []
    X = lambda i: x0 + i * cell
    Z = lambda j: z0 + j * cell

    for j in range(nz):
        for i in range(nx):
            if not occ[j, i]:
                continue
            y, yb = front[j, i], back[j, i]
            _quad(V, F, [(X(i), y, Z(j)), (X(i + 1), y, Z(j)), (X(i + 1), y, Z(j + 1)), (X(i), y, Z(j + 1))], (0, -1, 0))
            _quad(V, F, [(X(i), yb, Z(j)), (X(i + 1), yb, Z(j)), (X(i + 1), yb, Z(j + 1)), (X(i), yb, Z(j + 1))], (0, 1, 0))
    for axis in (0, 1):
        for j in range(nz + (axis == 1)):
            for i in range(nx + (axis == 0)):
                if axis == 0:   # edge between (j, i-1) and (j, i) at x = X(i)
                    a = (j, i - 1) if i - 1 >= 0 else None
                    b = (j, i) if i < nx else None
                    sgn = np.array([1.0, 0, 0])
                else:           # edge between (j-1, i) and (j, i) at z = Z(j)
                    a = (j - 1, i) if j - 1 >= 0 else None
                    b = (j, i) if j < nz else None
                    sgn = np.array([0, 0, 1.0])
                A = (front[a], back[a]) if a is not None and occ[a] else None
                B = (front[b], back[b]) if b is not None and occ[b] else None
                if A is None and B is None:
                    continue
                if A is not None and B is not None and abs(A[0] - B[0]) < 1e-6 and abs(A[1] - B[1]) < 1e-6:
                    continue
                lo = min(r[0] for r in (A, B) if r is not None)
                hi = max(r[1] for r in (A, B) if r is not None)
                ls = levels[(levels >= lo - 1e-6) & (levels <= hi + 1e-6)]
                for y0, y1 in zip(ls[:-1], ls[1:]):
                    ym = (y0 + y1) / 2
                    ina = A is not None and A[0] < ym < A[1]
                    inb = B is not None and B[0] < ym < B[1]
                    if ina == inb:
                        continue
                    normal = sgn if ina else -sgn
                    if axis == 0:
                        x = X(i)
                        pts = [(x, y0, Z(j)), (x, y1, Z(j)), (x, y1, Z(j + 1)), (x, y0, Z(j + 1))]
                    else:
                        z = Z(j)
                        pts = [(X(i), y0, z), (X(i + 1), y0, z), (X(i + 1), y1, z), (X(i), y1, z)]
                    _quad(V, F, pts, normal)
    return weld(Mesh(np.array(V), np.array(F, int), name, material))


def carve_depth(occ, front, x0, z0, cell, cam, mask, back_max, back_min=0.6, step=0.1, dilate_px=1):
    """Visual-hull carving: each cell keeps the deepest y (<= back_max) whose top-of-cell point still
    projects inside the key mask, so tread tops and sides never show where the key shows none."""
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * dilate_px + 1,) * 2)
    mk = cv2.dilate(mask.astype(np.uint8), k) > 0
    nz, nx = occ.shape
    h, w = mk.shape
    gx, gz = np.meshgrid(x0 + (np.arange(nx) + 0.5) * cell, z0 + (np.arange(nz) + 1.0) * cell)
    back = np.full(occ.shape, back_min, float)
    alive = occ.copy()
    for y in np.arange(back_min, back_max + 1e-6, step):
        P = np.stack([gx.ravel(), np.full(gx.size, y), gz.ravel()], 1)
        uv, z = project(cam, P)
        u = np.clip(uv[:, 0].astype(int), 0, w - 1)
        v = np.clip(uv[:, 1].astype(int), 0, h - 1)
        ok = (mk[v, u] & (z > 0)).reshape(occ.shape)
        alive &= ok
        back[alive] = y
    return np.maximum(np.round(back / step) * step, np.maximum(front, 0) + back_min)


def mask_grid(mask, cam, plane_y, cell, pad=0.3):
    """Back-project a key mask onto the plane y=plane_y; return occ grid, x0, z0."""
    ys, xs = np.nonzero(mask)
    corners = hit_plane(cam, [xs.min(), xs.max(), xs.min(), xs.max()], [ys.min(), ys.min(), ys.max(), ys.max()],
                        [0, plane_y, 0], np.array([0, 1.0, 0]))
    x0, x1 = corners[:, 0].min() - pad, corners[:, 0].max() + pad
    z0, z1 = corners[:, 2].min() - pad, corners[:, 2].max() + pad
    nx, nz = int(np.ceil((x1 - x0) / cell)), int(np.ceil((z1 - z0) / cell))
    gx, gz = np.meshgrid(x0 + (np.arange(nx) + 0.5) * cell, z0 + (np.arange(nz) + 0.5) * cell)
    P = np.stack([gx.ravel(), np.full(gx.size, plane_y), gz.ravel()], 1)
    uv, depth = project(cam, P)
    h, w = mask.shape
    u = np.clip(uv[:, 0].astype(int), 0, w - 1)
    v = np.clip(uv[:, 1].astype(int), 0, h - 1)
    inside = (uv[:, 0] >= 0) & (uv[:, 0] < w) & (uv[:, 1] >= 0) & (uv[:, 1] < h) & (depth > 0)
    occ = (mask[v, u] & inside).reshape(nz, nx)
    return close_diagonals(occ), x0, z0


def close_diagonals(occ):
    """Fill 2x2 windows that touch only diagonally (would share a single edge -> non-manifold)."""
    occ = occ.copy()
    for _ in range(4):
        a, b, c, d = occ[:-1, :-1], occ[:-1, 1:], occ[1:, :-1], occ[1:, 1:]
        diag = (a & d & ~b & ~c) | (b & c & ~a & ~d)
        if not diag.any():
            break
        jj, ii = np.nonzero(diag)
        occ[jj, ii] = occ[jj, ii + 1] = occ[jj + 1, ii] = occ[jj + 1, ii + 1] = True
    return occ


def block_cells(occ, x0, z0, cell, size_m=(0.9, 0.55), depth_m=0.3, joint_m=0.06, seed=1, step=0.05):
    """Running-bond blocks snapped to cells: block faces 0..depth_m behind the outline plane, joints deeper."""
    nz, nx = occ.shape
    rng = np.random.default_rng(seed)
    table = rng.uniform(0.33, 1.0, 4096)
    gx, gz = np.meshgrid(x0 + (np.arange(nx) + 0.5) * cell, z0 + (np.arange(nz) + 0.5) * cell)
    row = np.floor(gz / size_m[1]).astype(int)
    xs = gx + (row % 2) * size_m[0] / 2
    col = np.floor(xs / size_m[0]).astype(int)
    # the key outline is the outermost plane: blocks step back from it (0..depth_m), joints deepest,
    # so relief never grows the silhouette
    push = np.round((1.0 - table[(row * 7919 + col * 104729) % 4096]) * depth_m / step) * step
    jx = (xs % size_m[0]) < cell
    jz = (gz % size_m[1]) < cell
    push[jx | jz] = depth_m + joint_m
    return np.where(occ, push, 0.0)


def snow_attr(m: Mesh, cam, snow_mask, lift=None):
    """v6 rule: snow where the drift lifted an up face, or where the key camera sees key snow."""
    N = vertex_normals(m)
    uv, z = project(cam, m.V)
    h, w = snow_mask.shape
    u = np.clip(uv[:, 0].astype(int), 0, w - 1)
    v = np.clip(uv[:, 1].astype(int), 0, h - 1)
    facing = ((cam["pos"] - m.V) * N).sum(1) > 0
    ks = snow_mask[v, u].astype(float) * facing * (z > 0)
    up = np.clip((N[:, 2] - 0.45) / 0.3, 0, 1)
    lifted = np.clip(((lift if lift is not None else np.zeros(len(m.V))) - 0.1) / 0.15, 0, 1) * (up > 0.5)
    return np.maximum.reduce([lifted, ks, (up > 0.5).astype(float) * 0.0])


def drift_lift(m: Mesh, thick=0.6, focus=None, f0=4.0, f1=12.0):
    """Lift up-facing vertices into a rounded drift crest (0.45..1 x thick), keeping connectivity."""
    N = vertex_normals(m)
    up = N[:, 2] > 0.5
    var = 0.5 + 0.5 * np.sin(m.V[:, 0] * 1.7 + m.V[:, 2] * 2.3)
    lift = np.where(up, thick * (0.75 + 0.25 * var), 0.0)
    out = Mesh(m.V + np.stack([np.zeros(len(lift)), np.zeros(len(lift)), lift], 1), m.F, m.name, m.material)
    out.attrs = dict(m.attrs)
    return out, lift


def outline_pieces(spec, cam, masks, res_boxes):
    """Tier 1 + cornice from masks, upper tiers as boxes behind. Returns list of Mesh (stone) with _SNOW/_ICE."""
    o = spec["outline"]
    t = spec["tiers"]
    cell = o.get("cell_m", 0.1)
    rise, n = t["rise_m"], t["count"]
    tread = t["tread_m"][0] if isinstance(t["tread_m"], list) else t["tread_m"]
    back = tread + 0.6
    tier = masks["tier"] | (masks["door"] if masks.get("door") is not None else False)
    occ, x0, z0 = mask_grid(tier, cam, 0.0, cell)
    front = np.zeros(occ.shape)
    if o.get("blocks", True):
        front = block_cells(occ, x0, z0, cell, tuple(o.get("block_m", (0.9, 0.55))), o.get("block_depth_m", 0.3))
    if masks.get("door") is not None:
        docc, dx0, dz0 = mask_grid(masks["door"] | tier, cam, 0.0, cell)
        dd, _, _ = mask_grid(masks["door"], cam, 0.0, cell)
        # same grid as occ (same union bbox) -> align by construction
        if dd.shape == occ.shape:
            k = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
            dd = cv2.morphologyEx(dd.astype(np.uint8), cv2.MORPH_OPEN, k).astype(bool)
            front[dd & occ] = spec.get("recess", {}).get("depth_m", 2.5)
    out = []
    t1_back = carve_depth(occ, front, x0, z0, cell, cam, masks["tier"] | (masks["door"] if masks.get("door") is not None else False), back) \
        if o.get("carve", True) else back
    t1 = extrude_cells(occ, front, t1_back, x0, z0, cell, "tier1", "stone")
    out.append(t1)
    zs = np.nonzero(occ.any(1))[0]
    xs = np.nonzero(occ.any(0))[0]
    xa, xb = x0 + xs.min() * cell, x0 + (xs.max() + 1) * cell
    for i in range(1, n if o.get("upper_tiers", True) else 1):
        out.append(box([xa - 0.5, tread * i, 0], [xb + 0.5, tread * n + 1.0, rise * (i + 1)], res_boxes, f"tier{i+1}"))
    if masks.get("cornice") is not None:
        over = spec.get("cornice", {}).get("overhang_m", 1.0)
        cocc, cx0, cz0 = mask_grid(masks["cornice"], cam, -over, cell)
        cback = carve_depth(cocc, np.full(cocc.shape, -over), cx0, cz0, cell, cam, masks["cornice"] | tier, 0.3, back_min=-over + 0.4) \
            if o.get("carve", True) else 0.3
        c = extrude_cells(cocc, np.full(cocc.shape, -over), cback, cx0, cz0, cell, "cornice", "stone")
        out.append(c)
        cz = np.nonzero(cocc.any(1))[0]
        cxs = np.nonzero(cocc.any(0))[0]
        czb = cz0 + np.percentile(np.nonzero(cocc)[0], 3) * cell
        # seat: a block under the slab, from just behind the slab front into the wall (no visible gap from the side)
        hull = masks["cornice"] | tier
        xs_ok = []
        for x in np.arange(cx0 + cxs.min() * cell + 0.3, cx0 + (cxs.max() + 1) * cell - 0.3, cell):
            P = np.array([[x, -over + 0.3, czb - 0.3], [x, 0.6, czb - 0.3]])
            uv, zz = project(cam, P)
            u = np.clip(uv[:, 0].astype(int), 0, hull.shape[1] - 1)
            v = np.clip(uv[:, 1].astype(int), 0, hull.shape[0] - 1)
            xs_ok.append(bool(hull[v, u].all() and (zz > 0).all()))
        xs_ok = np.array(xs_ok)
        if xs_ok.any():  # longest run of columns whose support corners the key shows as wall/cornice
            best, cur, start, bs = 0, 0, 0, 0
            for k, f in enumerate(xs_ok):
                cur = cur + 1 if f else 0
                if cur == 1:
                    start = k
                if cur > best:
                    best, bs = cur, start
            sx0 = cx0 + cxs.min() * cell + 0.3 + bs * cell
            out.append(box([sx0, -over + 0.3, czb - 0.3], [sx0 + best * cell, 0.6, czb + 0.25], res_boxes, "cornice-support"))
    return out

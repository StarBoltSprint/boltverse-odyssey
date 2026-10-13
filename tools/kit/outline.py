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
    Watertight: each side wall is zipped between the depth levels present at its two corner lines
    (the 4 cells around a corner), so neighbouring walls and faces share every vertex (no T-junctions)
    while a wall is only split where a neighbour actually changes depth (few triangles)."""
    nz, nx = occ.shape
    back = np.broadcast_to(np.asarray(back, float), occ.shape)
    V, F = [], []
    X = lambda i: x0 + i * cell
    Z = lambda j: z0 + j * cell

    def tri(a, b, c, normal):
        i = len(V)
        V.extend([a, b, c])
        if np.dot(np.cross(np.subtract(b, a), np.subtract(c, a)), normal) >= 0:
            F.append((i, i + 1, i + 2))
        else:
            F.append((i, i + 2, i + 1))

    cl = {}
    def corner_levels(j, i):  # corner at row boundary j, col boundary i
        k = (j, i)
        if k not in cl:
            ls = []
            for jj in (j - 1, j):
                for ii in (i - 1, i):
                    if 0 <= jj < nz and 0 <= ii < nx and occ[jj, ii]:
                        ls += [front[jj, ii], back[jj, ii]]
            cl[k] = np.unique(np.round(ls, 4))
        return cl[k]

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
                if axis == 0:   # edge at x = X(i) between rows Z(j)..Z(j+1); corners (j,i) and (j+1,i)
                    a = (j, i - 1) if i - 1 >= 0 else None
                    b = (j, i) if i < nx else None
                    sgn = np.array([1.0, 0, 0])
                    c1, c2 = (j, i), (j + 1, i)
                    p1 = lambda y: (X(i), y, Z(j))
                    p2 = lambda y: (X(i), y, Z(j + 1))
                else:           # edge at z = Z(j) between cols X(i)..X(i+1); corners (j,i) and (j,i+1)
                    a = (j - 1, i) if j - 1 >= 0 else None
                    b = (j, i) if j < nz else None
                    sgn = np.array([0, 0, 1.0])
                    c1, c2 = (j, i), (j, i + 1)
                    p1 = lambda y: (X(i), y, Z(j))
                    p2 = lambda y: (X(i + 1), y, Z(j))
                A = (front[a], back[a]) if a is not None and occ[a] else None
                B = (front[b], back[b]) if b is not None and occ[b] else None
                if A is None and B is None:
                    continue
                if A is not None and B is not None and abs(A[0] - B[0]) < 1e-6 and abs(A[1] - B[1]) < 1e-6:
                    continue
                own = np.unique(np.round([v for r in (A, B) if r is not None for v in r], 4))
                runs = []
                for y0, y1 in zip(own[:-1], own[1:]):
                    ym = (y0 + y1) / 2
                    ina = A is not None and A[0] < ym < A[1]
                    inb = B is not None and B[0] < ym < B[1]
                    if ina == inb:
                        continue
                    nrm = tuple(sgn if ina else -sgn)
                    if runs and runs[-1][2] == nrm and abs(runs[-1][1] - y0) < 1e-9:
                        runs[-1][1] = y1
                    else:
                        runs.append([y0, y1, nrm])
                L1, L2 = corner_levels(*c1), corner_levels(*c2)
                for y0, y1, nrm in runs:
                    l = [y for y in L1 if y0 - 1e-6 <= y <= y1 + 1e-6]
                    r = [y for y in L2 if y0 - 1e-6 <= y <= y1 + 1e-6]
                    ii = jj = 0
                    while ii < len(l) - 1 or jj < len(r) - 1:
                        if jj >= len(r) - 1 or (ii < len(l) - 1 and l[ii + 1] <= r[jj + 1]):
                            tri(p1(l[ii]), p1(l[ii + 1]), p2(r[jj]), nrm)
                            ii += 1
                        else:
                            tri(p1(l[ii]), p2(r[jj + 1]), p2(r[jj]), nrm)
                            jj += 1
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


def snow_attr(m: Mesh, cam, snow_mask, lift=None, grow_px=0, thr=None):
    """v6 rule: snow where the drift lifted an up face, or where the key camera sees key snow.
    grow_px (+dilate / -erode the key snow mask) is the calibration knob for the snow/stone ratio."""
    if grow_px:
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * abs(grow_px) + 1,) * 2)
        snow_mask = (cv2.dilate if grow_px > 0 else cv2.erode)(snow_mask.astype(np.uint8), k) > 0
    if thr is not None:  # continuous calibration: blurred key mask above a threshold (lower = more snow)
        snow_mask = cv2.GaussianBlur(snow_mask.astype(np.float32), (0, 0), 2.5) > thr
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


# ---------------------------------------------------------------- v7 (Art Director + Critic pass)
def fix_manifold(occ, front, back, iters=20):
    """Remove edge-only contacts: in any 2x2 window where two diagonal cells are solid at a depth and the
    other two are not, extend the empty pair (front -> min, back -> max). Also break back==front touches
    between neighbours. Result: extrude_cells gives 0 non-manifold edges."""
    occ, front, back = occ.copy(), front.copy(), np.array(back, float).copy()
    for _ in range(iters):
        changed = False
        lv = np.unique(np.round(np.concatenate([front[occ], back[occ]]), 4))
        mids = (lv[:-1] + lv[1:]) / 2
        for ym in mids:
            S = occ & (front < ym) & (back > ym)
            a, b, c, d = S[:-1, :-1], S[:-1, 1:], S[1:, :-1], S[1:, 1:]
            diag = (a & d & ~b & ~c) | (b & c & ~a & ~d)
            if not diag.any():
                continue
            changed = True
            jj, ii = np.nonzero(diag)
            for dj, di in ((0, 0), (0, 1), (1, 0), (1, 1)):
                J, I = jj + dj, ii + di
                new = ~occ[J, I]
                occ[J, I] = True
                front[J[new], I[new]] = ym - 0.05
                back[J[new], I[new]] = ym + 0.05
                front[J, I] = np.minimum(front[J, I], np.round(ym - 0.05, 4))
                back[J, I] = np.maximum(back[J, I], np.round(ym + 0.05, 4))
        # neighbours whose intervals only touch (back == front) share a face edge 4 ways: push apart
        for ax in (0, 1):
            A = occ & np.roll(occ, -1, ax)
            tb = A & (np.abs(back - np.roll(front, -1, ax)) < 1e-6)
            tf = A & (np.abs(front - np.roll(back, -1, ax)) < 1e-6)
            if ax == 0:
                tb[-1] = tf[-1] = False
            else:
                tb[:, -1] = tf[:, -1] = False
            if tb.any() or tf.any():
                changed = True
                back[tb] += 0.05
                front[tf] -= 0.05
        front, back = np.round(front, 4), np.round(np.maximum(back, front + 0.1), 4)
        if not changed:
            break
    return occ, front, back


def taubin(m: Mesh, n=8, lam=0.5, mu=-0.53, pin=None) -> Mesh:
    """Taubin smoothing (no shrink): removes the 0.13 m cell stairs, keeps connectivity (0 open edges)."""
    V = m.V.copy()
    e = np.vstack([m.F[:, [0, 1]], m.F[:, [1, 2]], m.F[:, [2, 0]]])
    e = np.unique(np.sort(e, 1), axis=0)
    deg = np.bincount(e.ravel(), minlength=len(V)).astype(float)[:, None]
    for k in range(2 * n):
        S = np.zeros_like(V)
        np.add.at(S, e[:, 0], V[e[:, 1]])
        np.add.at(S, e[:, 1], V[e[:, 0]])
        L = S / np.maximum(deg, 1) - V
        step = (lam if k % 2 == 0 else mu) * L
        if pin is not None:
            step[pin] = 0
        V = V + step
    out = Mesh(V, m.F, m.name, m.material)
    out.attrs = dict(m.attrs)
    return out


def subdivide(m: Mesh) -> Mesh:
    """1->4 midpoint subdivision (shared midpoints), keeps watertightness."""
    F = m.F
    e = np.sort(np.vstack([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]), 1)
    ue, inv = np.unique(e, axis=0, return_inverse=True)
    inv = inv.reshape(-1)
    nV = len(m.V)
    mid = (m.V[ue[:, 0]] + m.V[ue[:, 1]]) / 2
    nf = len(F)
    a, b, c = F[:, 0], F[:, 1], F[:, 2]
    ab, bc, ca = nV + inv[:nf], nV + inv[nf:2 * nf], nV + inv[2 * nf:]
    F2 = np.vstack([np.stack([a, ab, ca], 1), np.stack([ab, b, bc], 1), np.stack([ca, bc, c], 1), np.stack([ab, bc, ca], 1)])
    out = Mesh(np.vstack([m.V, mid]), F2, m.name, m.material)
    for k, v in m.attrs.items():
        out.attrs[k] = np.concatenate([v, (v[ue[:, 0]] + v[ue[:, 1]]) / 2])
    return out


def course_rows_z(key_bgr, tier_mask, cam, k=10, default_h=0.55, z_max=6.0):
    """Block course lines from the key: strong horizontal luminance edges inside the tier mask,
    back-projected to z on the wall plane; gaps filled with the default course height."""
    from fit import step_rows
    zs = []
    if key_bgr is not None:
        rows = step_rows(key_bgr, tier_mask.astype(np.float32), min_gap=4, k=k)
        cols = np.nonzero(tier_mask.any(0))[0]
        u = float(np.median(cols))
        if rows:
            P = hit_plane(cam, [u] * len(rows), rows, [0, 0, 0], np.array([0, 1.0, 0]))
            zs = sorted(float(z) for z in P[:, 2] if 0.2 < z < z_max)
    lines = [0.0]
    for z in zs + [z_max]:
        while z - lines[-1] > default_h * 1.6:
            lines.append(lines[-1] + default_h)
        if z - lines[-1] > default_h * 0.5:
            lines.append(z)
    return np.array(lines)


def block_relief(m: Mesh, courses, block_w=0.9, joint_w=0.07, joint_d=0.32, face_d=(0.0, 0.18), seed=1,
                 stone_h=None, stone_tile=2.0, grain=0.03, vary=0.0, smooth=0):
    """Real 20-40 cm block relief on front-facing (-y) stone, inward only (never grows the outline):
    joints sunk joint_d along the key course lines, each block face set back by a random 0..0.18 m,
    plus basalt height grain. Snow-covered vertices (_SNOW > 0.5) are left as drift."""
    from geom import vertex_normals
    N = vertex_normals(m)
    P = m.V
    front = (N[:, 1] < -0.6) & (P[:, 1] < 1.0)
    if "_SNOW" in m.attrs:
        front &= m.attrs["_SNOW"] < 0.5
    rng = np.random.default_rng(seed)
    table = rng.uniform(*face_d, 4096)
    ci = np.clip(np.searchsorted(courses, P[:, 2]) - 1, 0, len(courses) - 2)
    z0, z1 = courses[ci], courses[ci + 1]
    off = (ci % 2) * block_w / 2
    if vary:   # v10: per-course block width (1 +- vary) and random bond offset -> no vertical stripe rhythm
        cw = block_w * (1 + vary * (rng.random(len(courses) + 1) * 2 - 1))
        bw = cw[ci]
        off = rng.random(len(courses) + 1)[ci] * bw
    else:
        bw = np.full(len(P), block_w)
    xs = P[:, 0] + off
    col = np.floor(xs / bw).astype(int)
    dx = np.minimum(xs - col * bw, (col + 1) * bw - xs)
    dz = np.minimum(P[:, 2] - z0, z1 - P[:, 2])
    dj = np.minimum(dx, dz)
    joint = np.clip(1 - dj / joint_w, 0, 1) ** 0.7          # V-groove, 1 at the joint line
    edge = np.clip(dj / (joint_w * 3), 0, 1)               # rounded block edge
    face = table[(ci * 7919 + col * 104729) % 4096] * edge
    push = np.maximum(joint * joint_d, face)
    if stone_h is not None:
        # v10: blurred height map, bilinear sample (no nearest-texel steps -> no chevrons after shading)
        from scipy.ndimage import gaussian_filter, map_coordinates
        T = stone_h.shape[0]
        hb = gaussian_filter(stone_h.astype(float), 2.0, mode="wrap")
        u = (P[:, 0] / stone_tile) % 1 * T
        v = (-P[:, 2] / stone_tile) % 1 * T
        push = push + grain * map_coordinates(hb, [v, u], order=1, mode="grid-wrap") * (1 - joint)
    if smooth:   # v10: Laplacian-smooth the displacement field over the mesh before applying it
        E = np.vstack([m.F[:, [0, 1]], m.F[:, [1, 2]], m.F[:, [2, 0]]])
        E = np.vstack([E, E[:, ::-1]])
        deg = np.bincount(E[:, 0], minlength=len(P)).astype(float)
        for _ in range(smooth):
            nb = np.bincount(E[:, 0], weights=push[E[:, 1]], minlength=len(P)) / np.maximum(deg, 1)
            push = np.where(front, 0.5 * push + 0.5 * nb, push)
    V = P.copy()
    V[front, 1] += push[front]
    out = Mesh(V, m.F, m.name, m.material)
    out.attrs = dict(m.attrs)
    out.attrs["_JOINT"] = np.where(front, joint, 0.0)
    return out


def trim_fringe(cmask, win=25, smooth=15):
    """Split the cornice mask into the slab and its hanging icicle fringe (legacy kitfit3 rule)."""
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    slab = cmask.copy()
    cols = np.nonzero(cmask.any(0))[0]
    bot = np.array([np.nonzero(cmask[:, x])[0].max() for x in cols])
    sb = uniform_filter1d(minimum_filter1d(bot, win).astype(float), smooth)
    for x, s in zip(cols, sb):
        slab[int(s) + 1:, x] = False
    return slab, cmask & ~slab


def icicles_from_fringe(fringe, cam, plane_y, rng, max_n=140, min_len=0.12):
    """Icicles where the key shows them: each fringe column run -> a tapered, jittered, slightly bent
    ice spike whose length is the key's own (back-projected), grown from the drift lip."""
    from geom import merge
    cols = np.nonzero(fringe.any(0))[0]
    if len(cols) == 0:
        return None
    picks = cols[:: max(1, len(cols) // max_n)]
    parts = []
    for x in picks:
        rows = np.nonzero(fringe[:, x])[0]
        top, tip = rows.min() - 2, rows.max()
        P = hit_plane(cam, [x, x], [top, tip], [0, plane_y, 0], np.array([0, 1.0, 0]))
        L = float(P[0, 2] - P[1, 2])
        if L < min_len:
            continue
        L *= rng.uniform(0.85, 1.15)
        r = float(np.clip(0.035 + 0.06 * L, 0.04, 0.16)) * rng.uniform(0.7, 1.2)
        parts.append(spike(P[0] + [rng.normal(0, 0.02), rng.uniform(-0.05, 0.1), 0.12], L + 0.12, r, rng))
    if not parts:
        return None
    m = merge(parts, "icicles", "ice")
    m.attrs = {"_ICE": np.ones(len(m.V)), "_SNOW": np.zeros(len(m.V))}
    return m


def spike(top, L, r, rng, rings=4, seg=6):
    """Closed irregular icicle: rings shrink with a jittered radius, the axis bends a little."""
    top = np.asarray(top, float)
    V, F = [], []
    bend = rng.normal(0, 0.04, 2)
    for k in range(rings):
        t = k / rings
        rad = r * (1 - t) ** 1.3 * (1 + rng.normal(0, 0.12, seg))
        c = top + [bend[0] * t * t * L, bend[1] * t * t * L, -t * L]
        a0 = rng.uniform(0, 2 * np.pi)
        for s in range(seg):
            a = a0 + 2 * np.pi * s / seg
            V.append(c + [rad[s] * np.cos(a), rad[s] * np.sin(a), 0])
    tipi = len(V)
    V.append(top + [bend[0] * L, bend[1] * L, -L])
    capi = len(V)
    V.append(top + [0, 0, 0.02])
    for k in range(rings - 1):
        for s in range(seg):
            a, b = k * seg + s, k * seg + (s + 1) % seg
            c, d = a + seg, b + seg
            F += [(a, c, b), (b, c, d)]
    last = (rings - 1) * seg
    for s in range(seg):
        F.append((last + s, tipi, last + (s + 1) % seg))
        F.append((s, (s + 1) % seg, capi))
    return Mesh(np.array(V), np.array(F), "icicle", "ice")


def outline_pieces_v7(spec, cam, masks, key_bgr=None, stone_h=None):
    """AD/Critic pass: smoothed (no voxel stairs), 0 non-manifold, block relief on key courses,
    cornice slab seated on corbels, icicles grown from the key fringe, drift lip."""
    from scipy.ndimage import maximum_filter
    o = spec["outline"]
    t = spec["tiers"]
    cell = o.get("cell_m", 0.09)
    tread = t["tread_m"][0] if isinstance(t["tread_m"], list) else t["tread_m"]
    back = tread + 0.6
    rng = np.random.default_rng(o.get("seed", 7))
    door = masks.get("door")
    tier = masks["tier"] | (door if door is not None else False)
    if masks.get("band") is not None:   # the key's upper wall band behind the cornice (Critic e: full key extent)
        tier = tier | masks["band"]
    occ, x0, z0 = mask_grid(tier, cam, 0.0, cell)
    front = np.zeros(occ.shape)
    if door is not None:
        dd, _, _ = mask_grid(door | tier, cam, 0.0, cell)
        dd2, _, _ = mask_grid(door, cam, 0.0, cell)
        k = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        dd2 = cv2.morphologyEx(dd2.astype(np.uint8), cv2.MORPH_OPEN, k).astype(bool)
        if dd2.shape == occ.shape:
            front[dd2 & occ] = spec.get("recess", {}).get("depth_m", 2.5)
    bk = carve_depth(occ, front, x0, z0, cell, cam, tier, back, step=o.get("carve_step_m", 0.1))
    if o.get("block_quantize") and o.get("_courses") is not None:
        bk = quantize_blocks(occ, bk, x0, z0, cell, np.asarray(o["_courses"]), o.get("block_w_m", 0.9), o.get("carve_step_m", 0.1), o.get("block_pct", 0))
    if o.get("base_sink_m"):
        base0 = np.array([z0 + np.nonzero(occ[:, i])[0].min() * cell if occ[:, i].any() else np.inf for i in range(occ.shape[1])])
        occ, front, bk, z0 = sink_base(occ, front, bk, z0, cell, o["base_sink_m"], o.get("base_reach_m", 0.6))
    occ, front, bk = fix_manifold(occ, front, bk)
    t1 = extrude_cells(occ, front, bk, x0, z0, cell, "tier1", "stone")
    if o.get("contour_sigma_m"):
        t1 = contour_snap(t1, occ, x0, z0, cell, o["contour_sigma_m"])
    t1 = taubin(t1, o.get("smooth_iters", 6))
    out = {"tier1": t1, "grid": (occ, front, bk, x0, z0, cell)}
    if o.get("base_sink_m"):
        out["base0"] = base0   # key-visible wall bottom per column (before sinking)
    # cornice: slab + fringe (icicles)
    if masks.get("cornice") is not None:
        over = spec.get("cornice", {}).get("overhang_m", 1.0)
        slab, fringe = trim_fringe(masks["cornice"])
        ccell = cell * o.get("cornice_cell_k", 1.0)
        cocc, cx0, cz0 = mask_grid(slab, cam, -over, ccell)
        cfr = np.full(cocc.shape, -over)
        cbk = carve_depth(cocc, cfr, cx0, cz0, ccell, cam, slab | tier, back, back_min=0.5, step=o.get("carve_step_m", 0.1))
        cbk = np.maximum(cbk, 0.5)          # always reaches 0.5 m into the wall plane: no gap behind
        cocc, cfr, cbk = fix_manifold(cocc, cfr, cbk)
        c = extrude_cells(cocc, cfr, cbk, cx0, cz0, ccell, "cornice", "stone")
        if o.get("contour_sigma_m"):
            c = contour_snap(c, cocc, cx0, cz0, ccell, o["contour_sigma_m"])
        c = taubin(c, o.get("smooth_iters", 6))
        out["cornice"] = c
        # seat + corbels. Seat: the slab back runs 0.5 m into the wall plane, and where the wall below is
        # lower than the slab bottom a stone wedge fills the gap (hidden from the key camera, visible from
        # the side). Corbels: stone brackets under the 1 m overhang every corbel_step_m, so the side and
        # grazing views read a carried cornice, not a floating slab.
        tier_top = np.full(occ.shape[1], -np.inf)
        for i in range(occ.shape[1]):
            js = np.nonzero(occ[:, i] & (front[:, i] < 0.3))[0]
            if len(js):
                tier_top[i] = z0 + (js.max() + 1) * cell
        cols = np.nonzero(cocc.any(0))[0]
        seg = o.get("bracket_m", 0.5)
        brackets, probes, cprobes = [], [], []
        xa, xe = cx0 + cols.min() * ccell, cx0 + (cols.max() + 1) * ccell
        zb_at = {}
        x = xa
        while x < xe - 0.05:
            xb_ = min(x + seg, xe)
            ci = np.arange(int((x - cx0) / ccell), int(np.ceil((xb_ - cx0) / ccell)))
            ci = ci[(ci >= 0) & (ci < cocc.shape[1])]
            zbs = [cz0 + np.nonzero(cocc[:, c])[0].min() * ccell for c in ci if cocc[:, c].any()]
            ti = np.clip(((np.array([x, xb_]) - x0) / cell).astype(int), 0, occ.shape[1] - 1)
            tt = tier_top[ti[0]:ti[1] + 1]
            tt = tt[np.isfinite(tt)]
            if zbs:
                zb = max(zbs)
                zt = float(tt.min()) if len(tt) else 0.0
                # seat wedge on every segment: from below the smoothed wall top (0.1 m + rounding margin
                # into the wall) up 0.1 m into the slab, so the slab never sits on a smoothed-away edge
                brackets.append(wedge(x + 0.005, xb_ - 0.005, -0.05, zb + 0.1, min(zt, zb) - 0.4, 0.6, "seat"))
                probes.append(((x + xb_) / 2, zb))
                zb_at[round((x + xb_) / 2, 3)] = zb
            x = xb_
        step = o.get("corbel_step_m", 1.1)
        cw = o.get("corbel_w_m", 0.4)
        xc = xa + step / 2
        mids = np.array(sorted(zb_at))
        while xc < xe - cw:
            zb = zb_at[mids[np.argmin(np.abs(mids - xc))]]
            brackets.append(wedge(xc - cw / 2, xc + cw / 2, -over + 0.12, zb + 0.1, zb - o.get("corbel_drop_m", 0.9), 0.6, "corbel"))
            cprobes.append((xc, zb))
            xc += step
        out["corbels"] = brackets
        out["cornice_probes"] = {"seat": probes, "corbel": cprobes, "over": over}
        out["icicles"] = icicles_from_fringe(fringe, cam, -over + 0.15, rng)
        out["cornice_grid"] = (cocc, cfr, cbk, cx0, cz0, ccell)
    return out


def wedge(x0, x1, yf, ztop, zfoot, yb, name="corbel"):
    """Closed bracket prism along x. Profile (y,z): front-top (yf, ztop) -> wall foot (0, zfoot) ->
    back-foot (yb, zfoot) -> back-top (yb, ztop). Front face slopes from the slab edge to the tier edge."""
    prof = np.array([[yf, ztop], [0.0, zfoot], [yb, zfoot], [yb, ztop]])
    V = [[x0, y, z] for y, z in prof] + [[x1, y, z] for y, z in prof]
    F = [(0, 2, 1), (0, 3, 2), (4, 5, 6), (4, 6, 7)]
    for k in range(4):
        a, b = k, (k + 1) % 4
        F += [(a, b, b + 4), (a, b + 4, a + 4)]
    m = Mesh(np.array(V, float), np.array(F), name, "stone")
    # orient outward
    from geom import vertex_normals
    c = m.V.mean(0)
    A, B, C = (m.V[m.F[:, k]] for k in range(3))
    n = np.cross(B - A, C - A)
    flip = ((A + B + C) / 3 - c) @ np.array([0, 0, 0]) if False else (((A + B + C) / 3 - c) * n).sum(1) < 0
    m.F[flip] = m.F[flip][:, ::-1]
    return m


def drift_lip(m: Mesh, lip=(0.12, 0.35)):
    """Snow vertices on the top-front edge roll forward/down into a lip of varying thickness."""
    from geom import vertex_normals
    if "_SNOW" not in m.attrs:
        return m
    N = vertex_normals(m)
    s = m.attrs["_SNOW"] > 0.5
    edge = s & (N[:, 1] < -0.2) & (N[:, 2] > 0.2)
    var = 0.5 + 0.5 * np.sin(m.V[:, 0] * 1.3 + 0.7) * np.cos(m.V[:, 0] * 0.37)
    amt = lip[0] + (lip[1] - lip[0]) * var
    V = m.V.copy()
    V[edge, 1] -= amt[edge] * 0.6
    V[edge, 2] -= amt[edge] * 0.4
    out = Mesh(V, m.F, m.name, m.material)
    out.attrs = dict(m.attrs)
    return out


def float_report(solids, probes, over=None, below=0.06):
    """Cornice float, measured by point-in-solid: (1) seat - under every 0.5 m slab segment, a point
    just below the slab bottom at y=+0.2 (wall side) must be inside the wall or a seat wedge;
    (2) corbels - under each corbel, a point at mid-overhang must be inside the corbel.
    fraction 0 = seated everywhere."""
    over = probes.get("over", 1.0) if over is None else over
    Q = [[x, 0.2, zb - below] for x, zb in probes.get("seat", [])] + \
        [[x, -over / 2, zb - below] for x, zb in probes.get("corbel", [])]
    Q = np.array(Q, float).reshape(-1, 3)
    hit = np.zeros(len(Q), bool)
    for m in solids:
        hit |= inside(m, Q)
    nf = int((~hit).sum())
    return {"checked": int(len(Q)), "floating": nf, "fraction": round(nf / max(len(Q), 1), 4),
            "worst": [[round(float(v), 2) for v in q] for q in Q[~hit][:6]]}


def inside(m: Mesh, Q):
    """Ray-parity point-in-mesh with a skewed ray (avoids grazing shared edges of axis-aligned cells)."""
    a, b, c = (m.V[m.F[:, k]] for k in range(3))
    e1, e2 = b - a, c - a
    d = np.array([1.0, 0.01371, 0.00713])
    d /= np.linalg.norm(d)
    h = np.cross(d, e2)
    det = (e1 * h).sum(1)
    ok = np.abs(det) > 1e-12
    f = 1 / np.where(ok, det, 1)
    res = np.zeros(len(Q), bool)
    for qi, q in enumerate(np.asarray(Q, float)):
        s_ = q - a
        u = f * (s_ * h).sum(1)
        qq = np.cross(s_, e1)
        v = f * (qq @ d)
        t = f * (e2 * qq).sum(1)
        res[qi] = int((ok & (u >= 0) & (v >= 0) & (u + v <= 1) & (t > 1e-9)).sum()) % 2 == 1
    return res


def quantize_blocks(occ, bk, x0, z0, cell, courses, block_w=0.9, step=0.1, pct=0):
    """v8: one back depth per block (course row x running-bond column), the shallowest of its cells, so the
    tread edge steps once per block along the key course lines instead of zigzagging per cell. Stays inside
    the visual hull (min), so the key silhouette never grows."""
    nz, nx = occ.shape
    zc = z0 + (np.arange(nz) + 0.5) * cell
    ci = np.clip(np.searchsorted(courses, zc) - 1, 0, len(courses) - 2)
    xc = x0 + (np.arange(nx) + 0.5) * cell
    out = bk.copy()
    for c in np.unique(ci):
        rows = np.nonzero(ci == c)[0]
        col = np.floor((xc + (c % 2) * block_w / 2) / block_w).astype(int)
        for b in np.unique(col):
            cols = np.nonzero(col == b)[0]
            sub = occ[np.ix_(rows, cols)]
            if sub.any():
                v = np.percentile(bk[np.ix_(rows, cols)][sub], pct)
                blk = out[np.ix_(rows, cols)]
                blk[sub] = np.round(v / step) * step
                out[np.ix_(rows, cols)] = blk
    return out


def sink_base(occ, front, bk, z0, cell, sink=0.3, reach=0.6):
    """v8: every column whose lowest solid cell sits within 0.6 m of ground is continued down to -sink,
    so the wall foot is buried (no light gap at ground level in close views)."""
    nz, nx = occ.shape
    add = max(0, int(np.ceil((z0 + sink) / cell)))
    if add:
        occ = np.vstack([np.zeros((add, nx), bool), occ]); front = np.vstack([np.zeros((add, nx)), front])
        bk = np.vstack([np.repeat(bk[:1], add, 0), bk]); z0 -= add * cell
    import os
    if os.environ.get("KIT_DEBUG_BASE"):
        print("base z per 0.5m:", [(round(z0 + i * cell, 1), round(z0 + np.nonzero(occ[:, i])[0].min() * cell, 2)) for i in range(0, nx, max(1, int(0.5 / cell))) if occ[:, i].any()])
    for i in range(nx):
        js = np.nonzero(occ[:, i])[0]
        if not len(js):
            continue
        j0 = js.min()
        if z0 + j0 * cell > reach:
            continue
        jg = max(0, int(np.floor((-sink - z0) / cell)))
        occ[jg:j0, i] = True
        front[jg:j0, i] = front[j0, i]
        bk[jg:j0, i] = bk[j0, i]
    return occ, front, bk, z0


def snow_skirt(x_spans, depth=0.7, h=0.4, sink=0.3, res=0.25, seed=5):
    """v8: rounded snow bank along the wall foot (y from -depth to +0.2, z from -sink to ~h), closed box
    smoothed into a drift, _SNOW = 1. Hides the base joint against the ground in the 3 m / chase views."""
    from geom import box
    rng = np.random.default_rng(seed)
    out = []
    for xa, xb in x_spans:
        m = box([xa, -depth, -sink], [xb, 0.2, h], res, "skirt", "stone")
        V = m.V.copy()
        top = V[:, 2] > 0
        fr = np.clip((V[:, 1] + depth) / (depth + 0.2), 0, 1)            # 0 at the front, 1 at the wall
        wav = 0.75 + 0.25 * np.sin(V[:, 0] * 1.7 + rng.uniform(0, 6)) * np.cos(V[:, 0] * 0.6)
        V[top, 2] = (h * fr[top] ** 0.6 * wav[top]).clip(0.02)
        m = taubin(Mesh(V, m.F, "skirt", "stone"), 4)
        m.attrs["_SNOW"] = np.ones(len(m.V))
        out.append(m)
    return out


def contour_snap(m: Mesh, occ, x0, z0, cell, sigma_m=0.35, iters=6):
    """v9: replace the cell staircase of the outline by the smooth key contour. The occupancy is blurred
    (sigma_m) into a field whose 0.5 iso-line is a smooth polyline/spline through the key outline; every vertex
    on a boundary grid corner (mixed occupancy around it) is moved in x/z onto that iso-line by Newton steps
    (max 1.5 cells). Topology is untouched, so the mesh stays closed and manifold; side walls and block
    courses follow the smoothed outline instead of zigzagging per cell."""
    from scipy.ndimage import gaussian_filter, map_coordinates
    nz, nx = occ.shape
    pad = np.pad(occ.astype(float), 2)
    F = gaussian_filter(pad, sigma_m / cell)
    gz, gx = np.gradient(F)
    ci = np.round((m.V[:, 0] - x0) / cell).astype(int)
    cj = np.round((m.V[:, 2] - z0) / cell).astype(int)
    P = np.pad(occ, 1)
    a = P[np.clip(cj, 0, nz + 1), np.clip(ci, 0, nx + 1)]            # cell (j, i-1) in padded = P[j+1, i]... compute 4
    def occp(j, i):
        return P[np.clip(j + 1, 0, nz + 1), np.clip(i + 1, 0, nx + 1)]
    s4 = occp(cj - 1, ci - 1).astype(int) + occp(cj - 1, ci) + occp(cj, ci - 1) + occp(cj, ci)
    bnd = (s4 > 0) & (s4 < 4)
    # field coords: cell (j,i) centre at padded index (j+2, i+2); corner (j,i) at (j+1.5, i+1.5)
    u = (m.V[:, 0] - x0) / cell + 1.5
    w = (m.V[:, 2] - z0) / cell + 1.5
    u0, w0 = u.copy(), w.copy()
    idx = np.nonzero(bnd)[0]
    for _ in range(iters):
        f = map_coordinates(F, [w[idx], u[idx]], order=1) - 0.5
        dx = map_coordinates(gx, [w[idx], u[idx]], order=1)
        dz = map_coordinates(gz, [w[idx], u[idx]], order=1)
        g2 = dx * dx + dz * dz + 1e-6
        u[idx] -= f * dx / g2
        w[idx] -= f * dz / g2
        d = np.hypot(u[idx] - u0[idx], w[idx] - w0[idx])
        k = np.minimum(1, 1.5 / np.maximum(d, 1e-9))
        u[idx] = u0[idx] + (u[idx] - u0[idx]) * k
        w[idx] = w0[idx] + (w[idx] - w0[idx]) * k
    V = m.V.copy()
    V[:, 0] = (u - 1.5) * cell + x0
    V[:, 2] = (w - 1.5) * cell + z0
    out = Mesh(V, m.F, m.name, m.material)
    out.attrs = dict(m.attrs)
    return out

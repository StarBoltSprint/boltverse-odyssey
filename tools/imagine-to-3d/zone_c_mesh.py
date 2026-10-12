#!/usr/bin/env python3
"""Closed Zone C solids: MoGe front, plate-pixel relief, validated hidden plates.

The visible hull is a thin shell: the key face stays on MoGe, the back sits one
shell thickness behind it. Only the lower band of the back face drops to a floor
under the causeway, so a grounding ray hits rock. The skyline is not extruded.
One index buffer. Plate UVs are packed into one atlas (native 1024 cells, no new
pixels, no tiling).
"""

from __future__ import annotations

import hashlib
from pathlib import Path

import numpy as np
from PIL import Image

GRID_STEP = 2
SINK_M = 0.30
SHELL_M = 0.55
RELIEF_M = 0.55
STRETCH_MAX = 1.3
MIN_HOLE_PX = 48
NUDGE_M = 0.008

ORDER = ("arch-left", "arch-right", "cliff-left", "gorge-rock", "cliff-right")


def plate_for(plan, obj: str, kind: str) -> int:
    for row in plan:
        if kind in row["faces"] and row["object"] in (obj, "*"):
            return int(row["n"])
    raise KeyError(f"no plate for {obj} {kind}")


def object_band(name: str) -> tuple[float, float]:
    i = ORDER.index(name)
    return i / len(ORDER), (i + 1) / len(ORDER)


def fill_small_holes(mask: np.ndarray, min_px: int) -> np.ndarray:
    """Fill enclosed holes smaller than min_px. The arch opening stays."""
    inv = ~mask
    h, w = mask.shape
    seen = np.zeros_like(inv, bool)
    out = mask.copy()
    for y in range(h):
        for x in range(w):
            if not inv[y, x] or seen[y, x]:
                continue
            stack = [(y, x)]
            seen[y, x] = True
            cells = []
            touch = False
            while stack:
                cy, cx = stack.pop()
                cells.append((cy, cx))
                if cy == 0 or cx == 0 or cy == h - 1 or cx == w - 1:
                    touch = True
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy + dy, cx + dx
                    if ny < 0 or nx < 0 or ny >= h or nx >= w or seen[ny, nx] or not inv[ny, nx]:
                        continue
                    seen[ny, nx] = True
                    stack.append((ny, nx))
            if not touch and len(cells) < min_px:
                for cy, cx in cells:
                    out[cy, cx] = True
    return out


def _binary_close(mask: np.ndarray, radius: int = 1) -> np.ndarray:
    """Smooth the silhouette by one pixel. Arch openings stay open."""
    h, w = mask.shape
    pad = np.pad(mask, radius, mode="constant", constant_values=False)
    dil = np.zeros_like(mask)
    for dy in range(2 * radius + 1):
        for dx in range(2 * radius + 1):
            dil |= pad[dy : dy + h, dx : dx + w]
    pad = np.pad(dil, radius, mode="constant", constant_values=False)
    ero = np.ones_like(mask)
    for dy in range(2 * radius + 1):
        for dx in range(2 * radius + 1):
            ero &= pad[dy : dy + h, dx : dx + w]
    return ero


def components(mask: np.ndarray) -> list[np.ndarray]:
    h, w = mask.shape
    seen = np.zeros_like(mask, bool)
    out = []
    for y in range(h):
        for x in range(w):
            if not mask[y, x] or seen[y, x]:
                continue
            stack = [(y, x)]
            seen[y, x] = True
            cells = []
            while stack:
                cy, cx = stack.pop()
                cells.append((cy, cx))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy + dy, cx + dx
                    if ny < 0 or nx < 0 or ny >= h or nx >= w or seen[ny, nx] or not mask[ny, nx]:
                        continue
                    seen[ny, nx] = True
                    stack.append((ny, nx))
            if len(cells) < 24:
                continue
            comp = np.zeros_like(mask)
            for cy, cx in cells:
                comp[cy, cx] = True
            out.append(comp)
    return out


def quads_of(comp: np.ndarray, step: int) -> list[tuple[int, int]]:
    h, w = comp.shape
    found = []
    for j in range(0, h - step, step):
        for i in range(0, w - step, step):
            block = comp[j : j + step + 1 : step, i : i + step + 1 : step]
            if block.shape == (2, 2) and bool(block.all()):
                found.append((i, j))
    return found


def exterior_edges(qset: set, step: int):
    if not qset:
        return [], []
    i0 = min(i for i, _ in qset)
    j0 = min(j for _, j in qset)
    i1 = max(i for i, _ in qset)
    j1 = max(j for _, j in qset)
    cw = (i1 - i0) // step + 3
    ch = (j1 - j0) // step + 3
    blocked = np.zeros((ch, cw), bool)
    for i, j in qset:
        blocked[(j - j0) // step + 1, (i - i0) // step + 1] = True
    ext = np.zeros_like(blocked)
    stack = [(0, 0)]
    ext[0, 0] = True
    while stack:
        y, x = stack.pop()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if ny < 0 or nx < 0 or ny >= ch or nx >= cw or ext[ny, nx] or blocked[ny, nx]:
                continue
            ext[ny, nx] = True
            stack.append((ny, nx))

    def is_outer(ni, nj):
        if ni < i0 or nj < j0 or ni > i1 or nj > j1:
            return True
        ci = (ni - i0) // step + 1
        cj = (nj - j0) // step + 1
        if ci < 0 or cj < 0 or ci >= cw or cj >= ch:
            return True
        return bool(ext[cj, ci])

    outer, inner = [], []
    for i, j in qset:
        specs = (
            ((0, -step), (i, j), (i + step, j)),
            ((step, 0), (i + step, j), (i + step, j + step)),
            ((0, step), (i + step, j + step), (i, j + step)),
            ((-step, 0), (i, j + step), (i, j)),
        )
        for (di, dj), a, b in specs:
            if (i + di, j + dj) in qset:
                continue
            (outer if is_outer(i + di, j + dj) else inner).append((a, b, (i + step * 0.5, j + step * 0.5)))
    return outer, inner


def stretch_of(p0, p1, p2, uv0, uv1, uv2, tw, th) -> float:
    e1 = p1 - p0
    e2 = p2 - p0
    n = np.cross(e1, e2)
    ln = np.linalg.norm(n)
    if ln < 1e-8:
        return 1.0
    n = n / ln
    L1 = np.linalg.norm(e1)
    if L1 < 1e-8:
        return 1.0
    ex = e1 / L1
    ey = np.cross(n, ex)
    el = np.linalg.norm(ey)
    if el < 1e-8:
        return 99.0
    ey = ey / el
    x2 = float(np.dot(e2, ex))
    y2 = float(np.dot(e2, ey))
    du1 = (uv1[0] - uv0[0]) * tw
    dv1 = (uv1[1] - uv0[1]) * th
    du2 = (uv2[0] - uv0[0]) * tw
    dv2 = (uv2[1] - uv0[1]) * th
    det = L1 * y2
    if abs(det) < 1e-9:
        return 1.0
    j00 = du1 * y2 / det
    j01 = (du2 * L1 - du1 * x2) / det
    j10 = dv1 * y2 / det
    j11 = (dv2 * L1 - dv1 * x2) / det
    T = j00 * j00 + j01 * j01 + j10 * j10 + j11 * j11
    D = abs(j00 * j11 - j01 * j10)
    disc = max(0.0, T * T - 4 * D * D)
    s1 = (0.5 * (T + disc ** 0.5)) ** 0.5
    s2 = D / (s1 or 1.0)
    if s2 < 1e-9:
        return 99.0
    return float(s1 / s2)


def p95(values, weights) -> float:
    if not values:
        return 1.0
    order = np.argsort(values)
    acc = 0.0
    tot = float(np.sum(weights)) or 1.0
    out = float(values[order[-1]])
    for i in order:
        acc += float(weights[i])
        if acc >= 0.95 * tot:
            return float(values[i])
    return out


def weld_report(pos: np.ndarray, idx: np.ndarray) -> dict:
    """Same 1 mm weld the object-gate uses."""
    key = np.round(pos.astype(np.float64) * 1000.0).astype(np.int64)
    _, inv = np.unique(key, axis=0, return_inverse=True)
    edges = {}
    degenerate = 0
    for t in range(0, len(idx), 3):
        v = [int(inv[int(idx[t + k])]) for k in range(3)]
        if v[0] == v[1] or v[1] == v[2] or v[0] == v[2]:
            degenerate += 1
            continue
        for a, b in ((v[0], v[1]), (v[1], v[2]), (v[2], v[0])):
            e = (a, b) if a < b else (b, a)
            edges[e] = edges.get(e, 0) + 1
    open_n = sum(1 for n in edges.values() if n == 1)
    bad_e = [(e, n) for e, n in edges.items() if n != 2]
    # Map a welded id back to one original vertex for a position sample.
    sample = []
    if bad_e:
        inv_pos = {}
        for i, vid in enumerate(inv):
            inv_pos.setdefault(int(vid), i)
        for (a, b), n in bad_e[:6]:
            sample.append({"n": int(n), "a": pos[inv_pos[a]].round(4).tolist(), "b": pos[inv_pos[b]].round(4).tolist()})
    return {"open": open_n, "nonManifold": sum(1 for _, n in bad_e if n > 2), "degenerate": degenerate, "weldedVerts": int(inv.max()) + 1 if len(inv) else 0, "badSample": sample}


def _axis_name(normal: np.ndarray) -> str:
    ax = int(np.argmax(np.abs(normal)))
    if abs(float(normal[ax])) < 0.769:
        return "oblique"
    return "xyz"[ax]


def _project(p, axis: str) -> np.ndarray:
    if axis == "x":
        return np.array([p[2], p[1]], np.float64)
    if axis == "y":
        return np.array([p[0], p[2]], np.float64)
    if axis == "z":
        return np.array([p[0], p[1]], np.float64)
    return np.array([p[0], p[1]], np.float64)


def _tri_frame(p0, p1, p2):
    e1 = p1 - p0
    e2 = p2 - p0
    L1 = np.linalg.norm(e1)
    if L1 < 1e-8:
        return None
    ex = e1 / L1
    n = np.cross(e1, e2)
    ln = np.linalg.norm(n)
    if ln < 1e-10:
        return None
    ey = np.cross(n / ln, ex)
    el = np.linalg.norm(ey)
    if el < 1e-8:
        return None
    ey = ey / el
    q0 = np.array([0.0, 0.0])
    q1 = np.array([L1, 0.0])
    q2 = np.array([float(np.dot(e2, ex)), float(np.dot(e2, ey))])
    return q0, q1, q2


def build_atlas(plan, dest: Path) -> dict:
    cell = int(plan_atlas(plan)["cell"])
    cols = int(plan_atlas(plan)["cols"])
    rows = int(plan_atlas(plan)["rows"])
    atlas = Image.new("RGB", (cols * cell, rows * cell), (0, 0, 0))
    root = Path(plan["plateDir"]) if isinstance(plan, dict) else None
    info = []
    for row in plan["plates"]:
        src = root / row["file"]
        im = Image.open(src).convert("RGB")
        if im.size != (cell, cell):
            raise RuntimeError(f"{src.name} is {im.size}, expected {cell}")
        i = int(row["n"]) - 5
        ox, oy = (i % cols) * cell, (i // cols) * cell
        atlas.paste(im, (ox, oy))
        digest = hashlib.sha256(src.read_bytes()).hexdigest()
        info.append({"n": int(row["n"]), "id": row["id"], "file": row["file"], "sha256": digest, "cell": [ox, oy]})
    dest.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(dest, quality=95)
    return {"file": dest.name, "width": atlas.width, "height": atlas.height, "cell": cell, "plates": info}


def plan_atlas(plan) -> dict:
    return plan["atlas"]


def _cell_rect(n: int, atlas_info: dict, band: tuple[float, float] | None):
    cell = atlas_info["cell"]
    cols = atlas_info["width"] // cell
    i = n - 5
    ox, oy = (i % cols) * cell, (i // cols) * cell
    if band is None:
        return ox, oy, cell, cell
    y0 = oy + int(band[0] * cell)
    y1 = oy + int(band[1] * cell)
    return ox, y0, cell, max(8, y1 - y0)


def _uv_from_px(px, py, aw, ah):
    # flipY true on the loader: v = 1 is the top row.
    return (px + 0.5) / aw, 1.0 - (py + 0.5) / ah


def _write_planar(group, plate, band, atlas_info, origin_frac, span_frac):
    aw, ah = atlas_info["width"], atlas_info["height"]
    axis = group[0]["axis"]
    coords = []
    for t in group:
        qs = [_project(p, axis) for p in t["p"]]
        t["q"] = qs
        coords.extend(qs)
    arr = np.asarray(coords, np.float64)
    mn = arr.min(axis=0)
    mx = arr.max(axis=0)
    span = np.maximum(mx - mn, 1e-3)
    ox, oy, rw, rh = _cell_rect(plate, atlas_info, band)
    x0 = ox + int(rw * origin_frac)
    rw_use = max(8, int((ox + rw - x0) * span_frac))
    ppm = min((rw_use - 2) / span[0], (rh - 2) / span[1])
    for t in group:
        uvs = []
        for q in t["q"]:
            px = x0 + 1 + (q[0] - mn[0]) * ppm
            py = oy + 1 + (q[1] - mn[1]) * ppm
            uvs.append(_uv_from_px(px, py, aw, ah))
        t["uv"] = uvs
        t["stretch"] = stretch_of(t["p"][0], t["p"][1], t["p"][2], uvs[0], uvs[1], uvs[2], aw, ah)


def pack_plate_uvs(tris, atlas_info, band_for):
    """tris: list of dicts with p[3,3], plate, axis. Writes uv[3,2] and stretch."""
    del band_for
    groups = {}
    for t in tris:
        groups.setdefault((t["plate"], t["axis"], t["band"]), []).append(t)
    for (plate, axis, band), group in groups.items():
        if axis == "oblique":
            _pack_islands(group, plate, band, atlas_info)
            continue
        _write_planar(group, plate, band, atlas_info, 0.0, 1.0)
        bad_ids = {id(t) for t in group if t["stretch"] > STRETCH_MAX}
        if not bad_ids:
            continue
        # Planar charts stay in the left 70%. Islands take the right strip. No shared pixels.
        kept = [t for t in group if id(t) not in bad_ids]
        bad = [t for t in group if id(t) in bad_ids]
        if kept:
            _write_planar(kept, plate, band, atlas_info, 0.0, 0.70)
        _pack_islands(bad, plate, band, atlas_info, origin_frac=0.72)


def _pack_islands(group, plate, band, atlas_info, origin_frac=0.0):
    aw, ah = atlas_info["width"], atlas_info["height"]
    ox, oy, rw, rh = _cell_rect(plate, atlas_info, band)
    x0 = ox + int(rw * origin_frac)
    rw = max(8, ox + rw - x0)
    # Shelf pack at a ppm that fits. Stretch stays 1 because the island is the true edge lengths.
    items = []
    for t in group:
        frame = _tri_frame(t["p"][0], t["p"][1], t["p"][2])
        if frame is None:
            t["uv"] = [(0.0, 0.0), (0.0, 0.0), (0.0, 0.0)]
            t["stretch"] = 1.0
            continue
        q = np.asarray(frame, np.float64)
        mn = q.min(axis=0)
        q = q - mn
        items.append((t, q, float(q[:, 0].max()), float(q[:, 1].max())))
    if not items:
        return
    placed = []
    ppm = 64.0
    for _ in range(12):
        cursor_x, cursor_y, row_h = 1, 1, 0
        fits = True
        trial = []
        for t, q, bw, bh in items:
            pw, ph = bw * ppm + 2, bh * ppm + 2
            if pw > rw - 2 or ph > rh - 2:
                fits = False
                break
            if cursor_x + pw > rw - 1:
                cursor_x = 1
                cursor_y += row_h + 1
                row_h = 0
            if cursor_y + ph > rh - 1:
                fits = False
                break
            trial.append((t, q, cursor_x, cursor_y, ppm))
            cursor_x += pw
            row_h = max(row_h, ph)
        if fits:
            placed = trial
            break
        ppm *= 0.72
    if not placed:
        ppm = 0.25
        while ppm > 1e-4 and not placed:
            cursor_x, cursor_y, row_h = 1.0, 1.0, 0.0
            fits = True
            trial = []
            for t, q, bw, bh in items:
                pw, ph = bw * ppm + 2, bh * ppm + 2
                if pw > rw - 2 or ph > rh - 2:
                    fits = False
                    break
                if cursor_x + pw > rw - 1:
                    cursor_x = 1
                    cursor_y += row_h + 1
                    row_h = 0
                if cursor_y + ph > rh - 1:
                    fits = False
                    break
                trial.append((t, q, cursor_x, cursor_y, ppm))
                cursor_x += pw
                row_h = max(row_h, ph)
            if fits:
                placed = trial
            else:
                ppm *= 0.5
    for t, q, cx, cy, use in placed:
        uvs = []
        for qx, qy in q:
            uvs.append(_uv_from_px(x0 + cx + qx * use, oy + cy + qy * use, aw, ah))
        t["uv"] = uvs
        t["stretch"] = stretch_of(t["p"][0], t["p"][1], t["p"][2], uvs[0], uvs[1], uvs[2], aw, ah)


def key_luma_disp(key_path: Path, shape, forward: np.ndarray) -> np.ndarray:
    h, w = shape
    im = np.asarray(Image.open(key_path).convert("RGB").resize((w, h), Image.Resampling.BILINEAR), np.float32)
    lum = 0.2126 * im[:, :, 0] + 0.7152 * im[:, :, 1] + 0.0722 * im[:, :, 2]
    # 9 px box, high-pass. Relief comes from the key plate, not from noise.
    k = 9
    pad = k // 2
    c = np.pad(lum, pad, mode="edge")
    acc = np.zeros_like(lum)
    for dy in range(k):
        for dx in range(k):
            acc += c[dy : dy + h, dx : dx + w]
    blur = acc / (k * k)
    hp = lum - blur
    p = np.percentile(np.abs(hp), 99) or 1.0
    amp = np.clip(hp / p, -1.0, 1.0) * RELIEF_M
    return amp[:, :, None] * forward.reshape(1, 1, 3)


def build_solid(name, mask, world, depth, cam_forward, plan, ground, key_wh, atlas_info):
    step = GRID_STEP
    mask = _binary_close(fill_small_holes(mask, MIN_HOLE_PX), 1)
    forward = np.asarray(cam_forward, np.float64)
    forward = forward / (np.linalg.norm(forward) + 1e-12)
    comps = components(mask)
    if not comps:
        raise RuntimeError(f"{name}: empty mask")
    h, w = mask.shape
    tw, th = key_wh
    aw, ah = atlas_info["width"], atlas_info["height"]
    band = object_band(name)
    positions = []
    uvs = []
    plates_v = []
    indices = []
    tri_plate = []
    tri_kind = []
    stretches = []
    weights = []
    quad_n = 0

    def add_vert(p, uv, plate):
        positions.append(np.asarray(p, np.float64))
        uvs.append((float(uv[0]), float(uv[1])))
        plates_v.append(float(plate))
        return len(positions) - 1

    def push(ia, ib, ic, plate, kind, want, uv_override=None):
        pa, pb, pc = positions[ia], positions[ib], positions[ic]
        n = np.cross(pb - pa, pc - pa)
        if np.dot(n, want) < 0:
            ib, ic = ic, ib
            pb, pc = positions[ib], positions[ic]
            n = np.cross(pb - pa, pc - pa)
        area = float(np.linalg.norm(n)) * 0.5
        if area < 1e-8:
            return
        indices.extend((ia, ib, ic))
        tri_plate.append(int(plate))
        tri_kind.append(kind)
        if kind == "key":
            sv = stretch_of(pa, pb, pc, uvs[ia], uvs[ib], uvs[ic], tw, th)
            stretches.append(sv)
            weights.append(max(area, 1e-6))

    for ci, comp in enumerate(comps):
        qlist = _drop_pinch_quads(quads_of(comp, step), step)
        if len(qlist) < 4:
            continue
        qset = set(qlist)
        quad_n += len(qlist)
        nodes = {}
        for i, j in qlist:
            for ci2, cj in ((i, j), (i + step, j), (i, j + step), (i + step, j + step)):
                nodes[(ci2, cj)] = world[min(cj, h - 1), min(ci2, w - 1)].astype(np.float64)
        xs = [p[0] for p in nodes.values()]
        zs = [p[2] for p in nodes.values()]
        gy = [ground(x, z) for x, z in zip(xs, zs)]
        nudge = np.array([(ci + 1) * NUDGE_M, 0.0, 0.0]) if ci else np.zeros(3)
        front = {}
        taken = set()
        for (i, j), p in nodes.items():
            q = p + nudge
            # Two mask corners with the same XYZ would weld into one vertical.
            ntry = 0
            while tuple(np.round(q * 1e6).astype(np.int64).tolist()) in taken and ntry < 8:
                q = q.copy()
                q[0] += 0.0015
                ntry += 1
            taken.add(tuple(np.round(q * 1e6).astype(np.int64).tolist()))
            front[(i, j)] = q
        ys = np.array([p[1] for p in front.values()], np.float64)
        y0 = float(ys.min())
        y1 = float(ys.max())
        yc = (min(gy) if gy else 0.0) - SINK_M
        # The gate's lower 20% is measured after the floor sets ymin. Drop every
        # back vertex at or below that line, but never more than the bottom 40%
        # of the vertices, and never the arch-hole ring (the opening stays open).
        t_line = yc + 0.20 * (y1 - yc)
        if y0 > t_line:
            order = np.sort(ys)
            t_line = float(order[max(0, int(len(order) * 0.18) - 1)])
        order = np.sort(ys)
        t_line = min(t_line, float(order[max(0, int(len(order) * 0.40) - 1)]))
        outer, holes = exterior_edges(qset, step)
        hole_nodes = set()
        for e in holes:
            hole_nodes.add(e[0])
            hole_nodes.add(e[1])
        low_keys = {k for k, p in front.items() if p[1] <= t_line and k not in hole_nodes}
        if len(low_keys) < 4:
            lowest = sorted(front, key=lambda k: front[k][1])[: max(4, len(front) // 5)]
            low_keys = {k for k in lowest if k not in hole_nodes}
        # Seat the lower band on the terrain. Front and back move together, so the
        # foot is one sheet of shell thickness, not a fringe of edge-on spikes.
        for k in low_keys:
            front[k][1] = yc
        back = {k: p + forward * SHELL_M for k, p in front.items()}
        fmap = {}
        bmap = {}

        def fv(i, j):
            if (i, j) not in fmap:
                u = (i + 0.5) / w
                v = 1.0 - (j + 0.5) / h
                fmap[(i, j)] = add_vert(front[(i, j)], (u, v), 0)
            return fmap[(i, j)]

        def bv(i, j):
            if (i, j) not in bmap:
                bmap[(i, j)] = add_vert(back[(i, j)], (0.0, 0.0), 0)
            return bmap[(i, j)]

        front_tris = []
        for i, j in qlist:
            a, b, c, d = fv(i, j), fv(i + step, j), fv(i + step, j + step), fv(i, j + step)
            front_tris.append((a, d, b))
            front_tris.append((b, d, c))
            corners = ((i, j), (i + step, j), (i + step, j + step), (i, j + step))
            ba, bb, bc, bd = bv(i, j), bv(i + step, j), bv(i + step, j + step), bv(i, j + step)
            if all(c in low_keys for c in corners):
                push(ba, bb, bd, -1, "bottom-tmp", np.array([0.0, -1.0, 0.0]))
                push(bb, bc, bd, -1, "bottom-tmp", np.array([0.0, -1.0, 0.0]))
            else:
                push(ba, bd, bb, -1, "back", forward)
                push(bb, bd, bc, -1, "back", forward)
        for a, b, c in front_tris:
            sv = stretch_of(positions[a], positions[b], positions[c], uvs[a], uvs[b], uvs[c], tw, th)
            if sv <= STRETCH_MAX:
                push(a, b, c, 0, "key", -forward)
            else:
                push(a, b, c, -1, "grazing-tmp", -forward)
        centroid = np.mean(list(front.values()), axis=0)

        def add_wall(edge, hole):
            (i0, j0), (i1, j1), _centre = edge
            fa, fb = front[(i0, j0)], front[(i1, j1)]
            mid = (fa + fb) * 0.5
            outward = mid - centroid
            if np.linalg.norm(outward) < 1e-6:
                outward = np.cross(forward, np.array([0.0, 1.0, 0.0]))
            both_low = (i0, j0) in low_keys and (i1, j1) in low_keys
            if hole:
                kind = "inner"
            elif both_low:
                # Foot curtain. Own chart so it does not share the upper face's span.
                kind = "foot-tmp"
            else:
                kind = "back" if float(np.dot(outward / (np.linalg.norm(outward) + 1e-9), forward)) > 0.25 else "side"
            ia, ib = fv(i0, j0), fv(i1, j1)
            ja, jb = bv(i0, j0), bv(i1, j1)
            push(ia, ib, jb, -1, kind, outward)
            push(ia, jb, ja, -1, kind, outward)

        for e in outer:
            add_wall(e, False)
        for e in holes:
            add_wall(e, True)

    if quad_n < 4:
        raise RuntimeError(f"{name}: only {quad_n} quads")

    # Re-tag temporary plate triangles and pack their UVs. Key triangles stay.
    pos = positions
    packed = []
    key_idx = []
    rest = []  # (ia, ib, ic, plate, kind)
    for t in range(0, len(indices), 3):
        plate = tri_plate[t // 3]
        kind = tri_kind[t // 3]
        ia, ib, ic = indices[t], indices[t + 1], indices[t + 2]
        if kind == "key":
            key_idx.extend((ia, ib, ic))
            continue
        if kind == "foot-tmp":
            use_kind = "side"
        else:
            use_kind = {"grazing-tmp": "grazing", "bottom-tmp": "bottom"}.get(kind, kind)
        try:
            pn = plate_for(plan["plates"], name, use_kind)
        except KeyError:
            use_kind = "back" if use_kind == "inner" else "side"
            pn = plate_for(plan["plates"], name, use_kind)
        nrm = np.cross(pos[ib] - pos[ia], pos[ic] - pos[ia])
        ln = np.linalg.norm(nrm)
        # The foot curtain gets its own chart so a tall drop does not shrink the upper face.
        axis = "foot" if kind == "foot-tmp" else (_axis_name(nrm / ln) if ln > 1e-8 else "oblique")
        use_band = band if pn == 13 else None
        packed.append({
            "p": np.stack([pos[ia], pos[ib], pos[ic]]),
            "plate": pn,
            "kind": use_kind,
            "axis": axis,
            "band": use_band,
        })
    pack_plate_uvs(packed, atlas_info, None)
    # Rebuild the vertex buffer: key verts (shared) then one vert per plate corner.
    new_pos = []
    new_uv = []
    new_plate = []
    new_idx = []
    remap = {}

    def take_key(i):
        if i not in remap:
            remap[i] = len(new_pos)
            new_pos.append(pos[i])
            new_uv.append(uvs[i])
            new_plate.append(0.0)
        return remap[i]

    for t in range(0, len(key_idx), 3):
        new_idx.extend(take_key(key_idx[t + k]) for k in range(3))
    key_tris = len(key_idx) // 3
    plate_stretches = []
    plate_weights = []
    counts = {}
    for item in packed:
        ids = []
        for k in range(3):
            ids.append(len(new_pos))
            new_pos.append(item["p"][k])
            new_uv.append(item["uv"][k])
            new_plate.append(float(item["plate"]))
        new_idx.extend(ids)
        if "uv" not in item:
            item["uv"] = [(0.0, 0.0), (0.0, 0.0), (0.0, 0.0)]
            item["stretch"] = 99.0
        sv = float(item.get("stretch") or 1.0)
        area = float(np.linalg.norm(np.cross(item["p"][1] - item["p"][0], item["p"][2] - item["p"][0]))) * 0.5
        plate_stretches.append(sv)
        plate_weights.append(max(area, 1e-6))
        rec = counts.setdefault(str(item["plate"]), {"tris": 0, "kinds": {}})
        rec["tris"] += 1
        rec["kinds"][item["kind"]] = rec["kinds"].get(item["kind"], 0) + 1
    # A plate with no triangle still has to be listed so the gate cannot skip it.
    for row in plan["plates"]:
        if row["object"] not in (name, "*"):
            continue
        counts.setdefault(str(row["n"]), {"tris": 0, "kinds": {}})
    pos_a = np.asarray(new_pos, np.float32)
    uv_a = np.asarray(new_uv, np.float32)
    plate_a = np.asarray(new_plate, np.float32)
    idx = np.asarray(new_idx, np.uint32)
    # Separate plate corners that landed on the same 1 mm cell as a different chart
    # by a 2 mm slide along +Y only when the weld would merge two UV charts onto one edge
    # with more than two triangles. The slide is applied once, then re-measured.
    # Distinct corners that land in one 1 mm cell become non-manifold after the
    # gate weld. Exact copies (key chart + plate chart of the same corner) stay put.
    pos_a = _separate_distinct(pos_a)
    report = weld_report(pos_a, idx)
    all_s = stretches + plate_stretches
    all_w = weights + plate_weights
    return {
        "name": name,
        "pos": pos_a,
        "uv": uv_a,
        "plate": plate_a,
        "idx": idx,
        "keyTris": key_tris,
        "pending": counts,
        "edges": {k: report[k] for k in ("open", "nonManifold", "degenerate")},
        "weld": report,
        "stretchP95": round(p95(all_s, all_w), 4),
        "stretchMax": round(float(max(all_s)) if all_s else 1.0, 4),
        "keyStretchP95": round(p95(stretches, weights), 4),
        "plateStretchP95": round(p95(plate_stretches, plate_weights), 4),
        "aabb": {"min": pos_a.min(axis=0).tolist(), "max": pos_a.max(axis=0).tolist()},
        "quads": quad_n,
    }


def _drop_pinch_quads(qlist, step):
    """A boundary vertex with more than two edges puts four walls on one vertical."""
    qlist = list(qlist)
    for _ in range(8):
        if len(qlist) < 4:
            return qlist
        outer, holes = exterior_edges(set(qlist), step)
        deg = {}
        for a, b, _c in outer + holes:
            deg[a] = deg.get(a, 0) + 1
            deg[b] = deg.get(b, 0) + 1
        bad = {v for v, d in deg.items() if d > 2}
        if not bad:
            return qlist
        nxt = []
        for i, j in qlist:
            corners = ((i, j), (i + step, j), (i + step, j + step), (i, j + step))
            if any(c in bad for c in corners):
                continue
            nxt.append((i, j))
        if len(nxt) == len(qlist):
            return qlist
        qlist = nxt
    return qlist


def _separate_distinct(pos: np.ndarray) -> np.ndarray:
    """Give each distinct corner its own 1 mm cell. Exact copies stay together."""
    pos = pos.astype(np.float64).copy()
    exact = np.round(pos * 1e6).astype(np.int64)
    _, inv = np.unique(exact, axis=0, return_inverse=True)
    reps = {}
    for i, g in enumerate(inv.tolist()):
        reps.setdefault(g, i)
    used = set()
    for g, i in reps.items():
        base = pos[i].copy()
        shift = 0
        while shift < 64:
            trial = base.copy()
            trial[0] += shift * 0.0015
            if shift >= 32:
                trial[2] += (shift - 31) * 0.0015
            cell = tuple(np.round(trial * 1000.0).astype(np.int64).tolist())
            if cell not in used:
                used.add(cell)
                if shift:
                    delta = trial - base
                    pos[inv == g] += delta
                break
            shift += 1
    return pos.astype(np.float32)


def _heal(pos, idx, report, rounds=4):
    """Slide a welded vertex that sits on a non-manifold or open edge by 2 mm.

    The slide keeps the silhouette. It only separates a pinch the 1 mm weld had fused.
    """
    pos = pos.astype(np.float64).copy()
    for _ in range(rounds):
        report = weld_report(pos, idx)
        if report["open"] == 0 and report["nonManifold"] == 0:
            return pos.astype(np.float32), report
        key = np.round(pos * 1000.0).astype(np.int64)
        _, inv = np.unique(key, axis=0, return_inverse=True)
        edges = {}
        for t in range(0, len(idx), 3):
            v = [int(inv[int(idx[t + k])]) for k in range(3)]
            if len(set(v)) < 3:
                continue
            for a, b in ((v[0], v[1]), (v[1], v[2]), (v[2], v[0])):
                e = (a, b) if a < b else (b, a)
                edges.setdefault(e, []).append(t // 3)
        bad_verts = set()
        for (a, b), tris in edges.items():
            if len(tris) != 2:
                bad_verts.add(a)
                bad_verts.add(b)
        # Move every original vertex that maps to a bad weld id, each by its own 2 mm.
        for i, vid in enumerate(inv):
            if int(vid) in bad_verts:
                pos[i, 0] += 0.002 * ((i % 5) - 2)
                pos[i, 2] += 0.002 * (((i // 5) % 5) - 2)
    report = weld_report(pos, idx)
    return pos.astype(np.float32), report

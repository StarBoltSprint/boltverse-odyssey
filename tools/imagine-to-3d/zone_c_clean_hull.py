#!/usr/bin/env python3
"""Zone C solids — Zone B mesa base (hull silhouette + voxel solidify).

Same family as tools/imagine-to-3d/hull.py and blender_mesa.py (2026-10-09):
a cleaned mask silhouette becomes a terraced height, then a solid of one voxel
size (blender_mesa VOXEL class, 0.40 m). MoGe-2 depth is the median placement
only. It is never a per-pixel displacement.

Image-derived ledges (volume_features bands) are added as whole-voxel terraces.
A band that would shred the mesh is dropped. Vegetation masses are dropped.
"""

from __future__ import annotations

import numpy as np
from scipy import ndimage as ndi

from hull import clean_profile
from zone_c_mesh import (
    STRETCH_MAX,
    pack_plate_uvs,
    plate_for,
    stretch_of,
    weld_report,
)

# blender_mesa.py default is 0.35 m. 0.40 m is the same class and keeps quads fat.
CELL = 0.40
THICK_M = 5.6
SLOPE_PER_M = 0.20
# Whole-voxel stairs so an 8 m oblique view still leaves ≥ 0.5 m of plane residual.
STAIR_M = 1.20
STAIR_EVERY_M = 3.20
BATTER_M = 0.70
SINK_M = 0.45


def _drape(occ: set, ground) -> set:
    """Extend each column down to the terrain so the footprint does not float."""
    cols = {}
    for i, j, k in occ:
        cols.setdefault((i, k), []).append(j)
    out = set(occ)
    for (i, k), js in cols.items():
        gy = float(ground(i * CELL, k * CELL)) - SINK_M
        jg = int(np.floor(gy / CELL))
        for j in range(jg, min(js)):
            out.add((i, j, k))
    return out


def _median_depth(depth: np.ndarray, mask: np.ndarray) -> float:
    d = depth[mask]
    d = d[np.isfinite(d)]
    d = d[(d > 0.4) & (d < 400.0)]
    if d.size < 16:
        raise RuntimeError("mask has no finite metric depth for placement")
    return float(np.median(d))


def _silhouette(mask: np.ndarray) -> np.ndarray:
    """hull.clean_profile drops thin strands. The arch hole is not a strand."""
    cleaned, _top = clean_profile(mask.astype(bool), min_run=4)
    if int(cleaned.sum()) < 0.4 * int(mask.sum()):
        cleaned = mask.astype(bool)
    # Keep the original hole: opening pixels stay empty.
    cleaned = cleaned & ndi.binary_dilation(mask.astype(bool), iterations=1)
    cleaned = ndi.binary_closing(cleaned, iterations=1)
    return cleaned


def _world_of(eye, right, up, forward, depth, ys, xs):
    # Camera ray through the pixel. depth is camera-z (forward component).
    # Match zone_c_solids.world_from_points: world = eye + x*right - y*up + z*forward
    # Here x,y come from the pinhole at this depth, so the point sits on the
    # constant-forward plane. x_cv, y_cv are filled by the caller in metres
    # already via the ray. This helper is unused; placement is below.
    del eye, right, up, forward, depth, ys, xs
    raise AssertionError


def _aspects(pos, idx):
    out = []
    for t in range(0, len(idx), 3):
        a, b, c = pos[idx[t]], pos[idx[t + 1]], pos[idx[t + 2]]
        e = sorted([
            float(np.linalg.norm(b - a)),
            float(np.linalg.norm(c - b)),
            float(np.linalg.norm(a - c)),
        ])
        if e[0] < 1e-8:
            out.append(99.0)
        else:
            out.append(e[2] / e[0])
    return out


def mesh_is_clean(pos, idx) -> bool:
    """Same bar the object-gate triangle-quality row uses (p95 aspect ≤ 8)."""
    ratios = _aspects(pos, idx)
    if not ratios:
        return False
    ratios.sort()
    p95 = ratios[min(len(ratios) - 1, int(round(0.95 * (len(ratios) - 1))))]
    sliver = sum(1 for r in ratios if r > 20.0) / len(ratios)
    return p95 <= 8.0 and sliver <= 0.02


def build_clean_solid(
    name: str,
    mask: np.ndarray,
    depth: np.ndarray,
    rays: np.ndarray,
    eye: np.ndarray,
    forward: np.ndarray,
    right: np.ndarray,
    up: np.ndarray,
    cam: dict,
    plan,
    ground,
    key_wh,
    atlas_info: dict,
    feature_records: list,
):
    """Return a solid dict in the zone_c_mesh.build_solid shape."""
    del up
    mask = _silhouette(mask.astype(bool) & np.isfinite(depth))
    zmed = _median_depth(depth, mask)
    H, W = mask.shape
    # Metres per pixel at the placement plane, from the vertical fov.
    import math
    m_per_px = 2.0 * zmed * math.tan(math.radians(cam["fov"]) * 0.5) / H
    stride = max(2, int(round(CELL / max(m_per_px, 1e-4))))

    ys, xs = np.nonzero(mask[::stride, ::stride])
    ys = ys * stride
    xs = xs * stride
    if ys.size < 8:
        raise RuntimeError(f"{name}: silhouette empty after hull.clean_profile")

    # Placement plane: one depth. Not the per-pixel MoGe field.
    dist = zmed / np.clip(np.sum(rays * forward.reshape(1, 1, 3), axis=-1), 0.05, None)
    plane = eye + rays * dist[..., None]
    samples = plane[ys, xs]
    y_min = float(samples[:, 1].min())
    y_max = float(samples[:, 1].max())

    # Map feature image-rows onto world Y. Bands become voxel terraces.
    kept, dropped = [], []
    bands = []  # (y0, y1, cells toward camera)
    row_y = {}
    for y, x, p in zip(ys.tolist(), xs.tolist(), samples):
        row_y.setdefault(int(y), []).append(float(p[1]))
    for rec in feature_records:
        kind = rec.get("kind")
        if kind == "vegetation-mass":
            rec = dict(rec)
            rec["decision"] = "dropped"
            rec["reason"] = "vegetation mass left a sticker block; dropped so the hull stays the clean terrace"
            dropped.append(rec)
            continue
        xy = rec.get("xy") or None
        if not xy:
            rec = dict(rec)
            rec["decision"] = "dropped"
            rec["reason"] = "no mask span"
            dropped.append(rec)
            continue
        y0, y1 = int(xy[1]), int(xy[3])
        ys_hit = [row_y[r] for r in row_y if y0 <= r <= y1]
        if not ys_hit:
            rec = dict(rec)
            rec["decision"] = "dropped"
            rec["reason"] = "band missed the silhouette"
            dropped.append(rec)
            continue
        flat = [v for row in ys_hit for v in row]
        prot = float(rec.get("protrusionM") or 0.0)
        cells = int(round(prot / CELL))
        if cells < 1:
            rec = dict(rec)
            rec["decision"] = "dropped"
            rec["reason"] = "protrusion under one voxel; a sub-cell displace would shred"
            dropped.append(rec)
            continue
        rec = dict(rec)
        rec["decision"] = "kept"
        rec["protrusionM"] = round(cells * CELL, 3)
        rec["worldY"] = [round(min(flat), 2), round(max(flat), 2)]
        rec["reason"] = "kept as a whole-voxel terrace on the Zone B hull (not a depth displace)"
        kept.append(rec)
        bands.append((min(flat), max(flat), cells))

    def ledge_cells(y):
        extra = 0
        for a, b, c in bands:
            if a <= y <= b:
                extra = max(extra, c)
        return extra

    # Batter: narrow each image row by up to BATTER_M as it rises, so ±X faces carry relief.
    span = max(1e-3, y_max - y_min)
    occ = set()
    centers = {}
    for y, x, p in zip(ys.tolist(), xs.tolist(), samples):
        rise = (float(p[1]) - y_min) / span
        inset = BATTER_M * rise
        # Drop samples within `inset` of this row's horizontal ends (image x).
        centers.setdefault(int(y), []).append((int(x), p))
    for y, row in centers.items():
        xs_row = [t[0] for t in row]
        lo, hi = min(xs_row), max(xs_row)
        rise = (float(row[0][1][1]) - y_min) / span
        width = hi - lo
        inset_px = int(round((BATTER_M * rise) / max(m_per_px, 1e-4)))
        # A full inset erases a thin arch jamb. Keep at least one stride of stone.
        inset_px = min(inset_px, max(0, width // 2 - stride))
        for x, p in row:
            if x - lo < inset_px or hi - x < inset_px:
                continue
            toward = -forward
            rise_m = float(p[1]) - y_min
            slope = SLOPE_PER_M * rise_m + int(rise_m / STAIR_EVERY_M) * STAIR_M
            front = p + toward * (slope + ledge_cells(float(p[1])) * CELL)
            n = int(THICK_M / CELL) + 1
            for s in range(n):
                q = front + forward * (s * CELL)
                occ.add((int(round(q[0] / CELL)), int(round(q[1] / CELL)), int(round(q[2] / CELL))))

    if len(occ) < 8:
        raise RuntimeError(f"{name}: voxel hull empty")

    def _close(voxels: set) -> set:
        xs_ = [t[0] for t in voxels]
        ys_ = [t[1] for t in voxels]
        zs_ = [t[2] for t in voxels]
        o0 = (min(xs_) - 1, min(ys_) - 1, min(zs_) - 1)
        shape = (max(xs_) - o0[0] + 3, max(ys_) - o0[1] + 3, max(zs_) - o0[2] + 3)
        grid = np.zeros(shape, bool)
        for i, j, k in voxels:
            grid[i - o0[0], j - o0[1], k - o0[2]] = True
        # Odd 3×3×3 closing is the voxel-remesh weld (blender REMESH voxel).
        # A 2×2×2 kernel with origin 0 leaves diagonal pinches (four faces, one edge).
        grid = ndi.binary_closing(grid, structure=np.ones((3, 3, 3), bool))
        out = set()
        ii, jj, kk = np.nonzero(grid)
        for i, j, k in zip(ii.tolist(), jj.tolist(), kk.tolist()):
            out.add((i + o0[0], j + o0[1], k + o0[2]))
        return _fill_pinches(out)

    occ = _drape(occ, ground)
    occ = _close(occ)

    pos, idx, kinds, plates, key_uv = _extract(
        name, occ, forward, cam, key_wh, eye, right, plan,
    )
    if not mesh_is_clean(pos, idx):
        # Relief terraces failed the triangle bar. Rebuild the plain hull.
        dropped.extend(kept)
        for rec in dropped:
            if rec.get("decision") == "kept":
                rec["decision"] = "dropped"
                rec["reason"] = "terrace failed triangle-quality; plain Zone B hull kept"
        kept = []
        occ = set()
        for y, row in centers.items():
            xs_row = [t[0] for t in row]
            lo, hi = min(xs_row), max(xs_row)
            rise = (float(row[0][1][1]) - y_min) / span
            width = hi - lo
            inset_px = int(round((BATTER_M * rise) / max(m_per_px, 1e-4)))
            inset_px = min(inset_px, max(0, width // 2 - stride))
            for x, p in row:
                if x - lo < inset_px or hi - x < inset_px:
                    continue
                rise_m = float(p[1]) - y_min
                front = p + (-forward) * (SLOPE_PER_M * rise_m + int(rise_m / STAIR_EVERY_M) * STAIR_M)
                n = int(THICK_M / CELL) + 1
                for s in range(n):
                    q = front + forward * (s * CELL)
                    occ.add((int(round(q[0] / CELL)), int(round(q[1] / CELL)), int(round(q[2] / CELL))))
        occ = _drape(occ, ground)
        occ = _close(occ)
        pos, idx, kinds, plates, key_uv = _extract(
            name, occ, forward, cam, key_wh, eye, right, plan,
        )

    solid = _pack(name, pos, idx, kinds, plates, key_uv, plan, atlas_info)
    solid["featuresKept"] = kept
    solid["featuresDropped"] = dropped
    solid["cellM"] = CELL
    solid["placementDepthM"] = round(zmed, 3)
    return solid


def _fill_pinches(voxels: set) -> set:
    """Two voxels that touch only on an edge make a non-manifold crease. Fill one cell."""
    v = set(voxels)
    for _ in range(8):
        add = set()
        seen = set()
        for i, j, k in v:
            for axis, edges in (
                (0, ((i, j, k), (i, j, k + 1), (i, j + 1, k), (i, j + 1, k + 1))),
                (1, ((i, j, k), (i, j, k + 1), (i + 1, j, k), (i + 1, j, k + 1))),
                (2, ((i, j, k), (i, j + 1, k), (i + 1, j, k), (i + 1, j + 1, k))),
            ):
                for e in edges:
                    key = (axis, e)
                    if key in seen:
                        continue
                    seen.add(key)
                    x, y, z = e
                    if axis == 0:
                        cells = ((x, y - 1, z - 1), (x, y - 1, z), (x, y, z - 1), (x, y, z))
                    elif axis == 1:
                        cells = ((x - 1, y, z - 1), (x - 1, y, z), (x, y, z - 1), (x, y, z))
                    else:
                        cells = ((x - 1, y - 1, z), (x - 1, y, z), (x, y - 1, z), (x, y, z))
                    occ = [c for c in cells if c in v]
                    if len(occ) != 2:
                        continue
                    a, b = occ
                    if sum(abs(a[t] - b[t]) for t in range(3)) != 2:
                        continue
                    empty = [c for c in cells if c not in v]
                    add.add(min(empty))
        if not add:
            break
        v |= add
    return v


def _p95(values, weights) -> float:
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


def _extract(name, occ, forward, cam, key_wh, eye, right, plan):
    del plan
    # Face order: outward normal.
    # Neighbour offsets and the four corners (i,j,k) in outward winding.
    # Outward winding (right-hand). Axis-aligned quads only — the voxel hull.
    faces = (
        ((1, 0, 0), ((1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1))),
        ((-1, 0, 0), ((0, 0, 0), (0, 0, 1), (0, 1, 1), (0, 1, 0))),
        ((0, 1, 0), ((0, 1, 0), (0, 1, 1), (1, 1, 1), (1, 1, 0))),
        ((0, -1, 0), ((0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1))),
        ((0, 0, 1), ((0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1))),
        ((0, 0, -1), ((0, 0, 0), (0, 1, 0), (1, 1, 0), (1, 0, 0))),
    )
    # AABB of occupancy, for inner-face test.
    xs = [t[0] for t in occ]
    zs = [t[2] for t in occ]
    i0, i1 = min(xs), max(xs)
    k0, k1 = min(zs), max(zs)
    verts = {}
    positions = []
    indices = []
    kinds = []
    plates_n = []
    key_uvs = {}

    def vid(c):
        if c not in verts:
            verts[c] = len(positions)
            positions.append(np.array([c[0] * CELL, c[1] * CELL, c[2] * CELL], np.float64))
        return verts[c]

    import math
    aspect = key_wh[0] / key_wh[1]
    t = math.tan(math.radians(cam["fov"]) * 0.5)

    def project(p):
        d = p - eye
        lz = float(np.dot(d, forward))
        if lz < 0.2:
            return (0.5, 0.5)
        lx = float(np.dot(d, right))
        # right × up = forward ⇒ up = forward × right.
        ly = float(np.dot(d, np.cross(forward, right)))
        ndc_x = (lx / lz) / (aspect * t)
        ndc_y = (ly / lz) / t
        return (ndc_x * 0.5 + 0.5, ndc_y * 0.5 + 0.5)

    for i, j, k in occ:
        for (di, dj, dk), corners in faces:
            if (i + di, j + dj, k + dk) in occ:
                continue
            n = np.array([di, dj, dk], np.float64)
            ids = []
            pts = []
            for ci, cj, ck in corners:
                c = (i + ci, j + cj, k + ck)
                ids.append(vid(c))
                pts.append(positions[ids[-1]])
            kind = _kind(name, n, forward, i, k, i0, i1, k0, k1)
            # Two tris, outward.
            for tri in ((0, 1, 2), (0, 2, 3)):
                indices.extend(ids[t_] for t_ in tri)
                kinds.append(kind)
                if kind == "key":
                    uvs = [project(pts[t_]) for t_ in tri]
                    key_uvs[len(kinds) - 1] = uvs
    pos = np.asarray(positions, np.float64)
    idx = np.asarray(indices, np.int64)
    return pos, idx, kinds, plates_n, key_uvs


def _kind(name, n, forward, i, k, i0, i1, k0, k1):
    if n[1] < -0.5:
        return "bottom"
    df = float(np.dot(n, forward))
    # n is axis-aligned world; forward is mostly -Z. Toward-camera normal dots negative with forward? 
    # Camera looks along forward (negative Z). The face whose normal points back at the camera
    # has normal ≈ -forward, so dot(n, forward) < 0 and dot(n, -forward) > 0.
    if float(np.dot(n, -forward)) > 0.55:
        return "key"
    if df > 0.55:
        return "back"
    interior = (i0 < i < i1) and (k0 < k < k1)
    if name.startswith("arch") and interior:
        return "inner"
    return "side"


def _pack(name, pos, idx, kinds, _plates, key_uvs, plan, atlas_info):
    key_idx = []
    packed = []
    key_stretches = []
    key_weights = []
    # Key UVs live on the triangle, then we split verts.
    W, H = atlas_info["width"], atlas_info["height"]
    # Key texture is the full key, not the atlas. Stretch uses key pixel size.
    # The caller passes atlas; key size is stored on atlas as key size via a side channel.
    key_w, key_h = atlas_info.get("keyWh", (W, H))
    band = {
        "arch-left": (0.02, 0.18),
        "arch-right": (0.22, 0.38),
        "cliff-left": (0.42, 0.58),
        "gorge-rock": (0.62, 0.78),
        "cliff-right": (0.82, 0.98),
    }.get(name)

    new_pos = []
    new_uv = []
    new_plate = []
    new_idx = []

    def push_vert(p, uv, plate):
        new_pos.append(p)
        new_uv.append(uv)
        new_plate.append(float(plate))
        return len(new_pos) - 1

    # First pass key tris so they occupy the front of the index buffer.
    order = [t for t in range(len(kinds)) if kinds[t] == "key"]
    order += [t for t in range(len(kinds)) if kinds[t] != "key"]
    for t in order:
        ia, ib, ic = idx[3 * t], idx[3 * t + 1], idx[3 * t + 2]
        tri_p = np.stack([pos[ia], pos[ib], pos[ic]])
        kind = kinds[t]
        if kind == "key":
            uvs = key_uvs.get(t) or [(0.5, 0.5)] * 3
            sv = stretch_of(tri_p[0], tri_p[1], tri_p[2], uvs[0], uvs[1], uvs[2], key_w, key_h)
            area = float(np.linalg.norm(np.cross(tri_p[1] - tri_p[0], tri_p[2] - tri_p[0]))) * 0.5
            if sv > STRETCH_MAX:
                kind = "side"
            else:
                key_stretches.append(sv)
                key_weights.append(max(area, 1e-6))
                for k in range(3):
                    new_idx.append(push_vert(tri_p[k], uvs[k], 0.0))
                continue
        use = {"key": "side"}.get(kind, kind)
        try:
            pn = plate_for(plan["plates"] if isinstance(plan, dict) else plan, name, use)
        except KeyError:
            use = "back"
            pn = plate_for(plan["plates"] if isinstance(plan, dict) else plan, name, use)
        nrm = np.cross(tri_p[1] - tri_p[0], tri_p[2] - tri_p[0])
        ln = np.linalg.norm(nrm)
        axis = _axis_name(nrm / ln) if ln > 1e-8 else "oblique"
        packed.append({
            "p": tri_p,
            "plate": pn,
            "kind": use,
            "axis": axis,
            "band": band if pn == 13 else None,
        })

    pack_plate_uvs(packed, atlas_info, None)
    key_tris = len(key_stretches)
    counts = {}
    plate_s, plate_w = [], []
    for item in packed:
        sv = float(item.get("stretch") or 1.0)
        area = float(np.linalg.norm(np.cross(item["p"][1] - item["p"][0], item["p"][2] - item["p"][0]))) * 0.5
        plate_s.append(sv)
        plate_w.append(max(area, 1e-6))
        for k in range(3):
            new_idx.append(push_vert(item["p"][k], item["uv"][k], item["plate"]))
        rec = counts.setdefault(str(item["plate"]), {"tris": 0, "kinds": {}})
        rec["tris"] += 1
        rec["kinds"][item["kind"]] = rec["kinds"].get(item["kind"], 0) + 1
    for row in plan["plates"]:
        if row["object"] not in (name, "*"):
            continue
        counts.setdefault(str(row["n"]), {"tris": 0, "kinds": {}})

    pos_a = np.asarray(new_pos, np.float32)
    uv_a = np.asarray(new_uv, np.float32)
    plate_a = np.asarray(new_plate, np.float32)
    idx_a = np.asarray(new_idx, np.uint32)
    report = weld_report(pos_a, idx_a)
    all_s = key_stretches + plate_s
    all_w = key_weights + plate_w
    return {
        "name": name,
        "pos": pos_a,
        "uv": uv_a,
        "plate": plate_a,
        "idx": idx_a,
        "keyTris": key_tris,
        "pending": counts,
        "edges": {k: report[k] for k in ("open", "nonManifold", "degenerate")},
        "weld": report,
        "stretchP95": round(_p95(all_s, all_w), 4),
        "stretchMax": round(float(max(all_s)) if all_s else 1.0, 4),
        "aabb": {"min": pos_a.min(axis=0).tolist(), "max": pos_a.max(axis=0).tolist()},
        "quads": int(len(kinds) // 2),
    }


def _axis_name(n) -> str:
    ax = int(np.argmax(np.abs(n)))
    if abs(float(n[ax])) < 0.769:
        return "oblique"
    return "xyz"[ax]

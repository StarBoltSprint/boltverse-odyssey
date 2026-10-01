"""Smooth invisible hull: surface nets + Taubin, then project source pixels.

The mesh is shape only. It has no color. A fragment shader (and the QC
rasterizer here) chooses source texels from the original PNGs.
"""

from __future__ import annotations

import math
import struct
from pathlib import Path

import numpy as np

# Taubin pair. lambda > 0 shrinks, mu < 0 inflates; together they keep volume.
TAUBIN_LAMBDA = 0.50
TAUBIN_MU = -0.53


def blur_occupancy(solid: np.ndarray, sigma: float) -> np.ndarray:
    """Smooth the occupancy field. This is invisible shape, not a texture."""
    field = solid.astype(np.float32)
    if sigma <= 0:
        return field
    radius = max(1, int(math.ceil(sigma * 3.0)))
    x = np.arange(-radius, radius + 1, dtype=np.float32)
    kernel = np.exp(-0.5 * (x / np.float32(sigma)) ** 2)
    kernel /= kernel.sum()
    for axis in range(3):
        field = _conv_axis(field, kernel, axis)
    return field


def _conv_axis(vol: np.ndarray, kernel: np.ndarray, axis: int) -> np.ndarray:
    radius = len(kernel) // 2
    moved = np.moveaxis(vol, axis, -1)
    padded = np.pad(moved, [(0, 0)] * (moved.ndim - 1) + [(radius, radius)], mode="constant")
    acc = np.zeros_like(moved)
    width = moved.shape[-1]
    for i, weight in enumerate(kernel):
        acc += np.float32(weight) * padded[..., i : i + width]
    return np.moveaxis(acc, -1, axis)


def surface_nets(
    field: np.ndarray,
    iso: float,
    origin: np.ndarray,
    voxel_size: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    """Naive surface nets on a scalar field.

    `origin` is the world position of field index (0, 0, 0).
    `voxel_size` is the world step between samples.
    Returns vertices (N, 3) and triangle indices (M, 3).
    A one-cell outside pad is added so every surface edge has four cubes.
    """
    padded = np.pad(field, 1, mode="constant", constant_values=float(field.min()) - 1.0)
    # Padded index p corresponds to original index p-1.
    # World = origin + (p - 1) * voxel_size.
    verts_idx, quads = _nets_indexed(padded, float(iso))
    if len(verts_idx) == 0:
        return np.zeros((0, 3), np.float32), np.zeros((0, 3), np.int32)
    origin = np.asarray(origin, np.float64)
    step = np.asarray(voxel_size, np.float64)
    world = origin + (verts_idx - 1.0) * step
    tris = _quads_to_tris(quads)
    return world.astype(np.float32), tris


def _nets_indexed(field: np.ndarray, iso: float) -> tuple[np.ndarray, np.ndarray]:
    nx, ny, nz = field.shape
    c000 = field[:-1, :-1, :-1]
    c100 = field[1:, :-1, :-1]
    c010 = field[:-1, 1:, :-1]
    c110 = field[1:, 1:, :-1]
    c001 = field[:-1, :-1, 1:]
    c101 = field[1:, :-1, 1:]
    c011 = field[:-1, 1:, 1:]
    c111 = field[1:, 1:, 1:]
    inside = [
        c000 >= iso,
        c100 >= iso,
        c010 >= iso,
        c110 >= iso,
        c001 >= iso,
        c101 >= iso,
        c011 >= iso,
        c111 >= iso,
    ]
    count = np.zeros(c000.shape, np.uint8)
    for mask in inside:
        count += mask.astype(np.uint8)
    active = (count > 0) & (count < 8)
    if not np.any(active):
        return np.zeros((0, 3), np.float64), np.zeros((0, 4), np.int32)

    corner_f = [c000, c100, c010, c110, c001, c101, c011, c111]
    corner_off = np.array(
        [
            [0, 0, 0],
            [1, 0, 0],
            [0, 1, 0],
            [1, 1, 0],
            [0, 0, 1],
            [1, 0, 1],
            [0, 1, 1],
            [1, 1, 1],
        ],
        dtype=np.float64,
    )
    edges = (
        (0, 1),
        (2, 3),
        (4, 5),
        (6, 7),
        (0, 2),
        (1, 3),
        (4, 6),
        (5, 7),
        (0, 4),
        (1, 5),
        (2, 6),
        (3, 7),
    )
    acc = np.zeros(active.shape + (3,), np.float64)
    hits = np.zeros(active.shape, np.float64)
    for a, b in edges:
        fa = corner_f[a]
        fb = corner_f[b]
        cross = (fa >= iso) != (fb >= iso)
        use = active & cross
        if not np.any(use):
            continue
        denom = fb - fa
        t = np.zeros(active.shape, np.float64)
        ok = use & (np.abs(denom) > 1e-12)
        t[ok] = (iso - fa[ok]) / denom[ok]
        t = np.clip(t, 0.0, 1.0)
        point = corner_off[a] + t[..., None] * (corner_off[b] - corner_off[a])
        acc += point * use[..., None]
        hits += use.astype(np.float64)
    hits_safe = np.maximum(hits, 1.0)
    centroid = acc / hits_safe[..., None]

    ii, jj, kk = np.meshgrid(
        np.arange(nx - 1),
        np.arange(ny - 1),
        np.arange(nz - 1),
        indexing="ij",
    )
    base = np.stack([ii, jj, kk], axis=-1).astype(np.float64)
    position = base + centroid
    vid = np.full(active.shape, -1, np.int32)
    sel = np.argwhere(active)
    vid[sel[:, 0], sel[:, 1], sel[:, 2]] = np.arange(len(sel), dtype=np.int32)
    vertices = position[sel[:, 0], sel[:, 1], sel[:, 2]]

    quads = _emit_quads(field, iso, vid)
    return vertices, quads


def _emit_quads(field: np.ndarray, iso: float, vid: np.ndarray) -> np.ndarray:
    """One quad per grid edge that crosses the iso, linking the four cubes."""
    quads = []
    # X edges: (i,j,k) — (i+1,j,k). Cubes cycle around YZ.
    _collect_axis(field, iso, vid, quads, axis=0)
    _collect_axis(field, iso, vid, quads, axis=1)
    _collect_axis(field, iso, vid, quads, axis=2)
    if not quads:
        return np.zeros((0, 4), np.int32)
    return np.asarray(quads, np.int32)


def _collect_axis(field: np.ndarray, iso: float, vid: np.ndarray, quads: list, axis: int) -> None:
    nx, ny, nz = field.shape
    # Sign change on edges along `axis`. The edge starts at a grid point and
    # ends one step along the axis. Four cubes share it.
    if axis == 0:
        a = field[:-1, :, :]
        b = field[1:, :, :]
        # edge index (i,j,k) with i in 0..nx-2, j in 0..ny-1, k in 0..nz-1
    elif axis == 1:
        a = field[:, :-1, :]
        b = field[:, 1:, :]
    else:
        a = field[:, :, :-1]
        b = field[:, :, 1:]
    cross = ((a >= iso) != (b >= iso))
    idx = np.argwhere(cross)
    cx, cy, cz = vid.shape
    for i, j, k in idx:
        i = int(i)
        j = int(j)
        k = int(k)
        cubes = _four_cubes(axis, i, j, k)
        ids = []
        ok = True
        for ci, cj, ck in cubes:
            if ci < 0 or cj < 0 or ck < 0 or ci >= cx or cj >= cy or ck >= cz:
                ok = False
                break
            v = int(vid[ci, cj, ck])
            if v < 0:
                ok = False
                break
            ids.append(v)
        if not ok:
            continue
        # Inside on the positive side of the edge → flip so the quad faces outward.
        positive_inside = float(b[i, j, k]) >= iso
        if positive_inside:
            ids = [ids[0], ids[3], ids[2], ids[1]]
        quads.append(ids)


def _four_cubes(axis: int, i: int, j: int, k: int) -> list[tuple[int, int, int]]:
    """Cube min-corners around an edge, in one consistent cycle."""
    if axis == 0:
        # Edge (i,j,k)-(i+1,j,k). Cycle in the YZ plane.
        return [
            (i, j, k),
            (i, j - 1, k),
            (i, j - 1, k - 1),
            (i, j, k - 1),
        ]
    if axis == 1:
        return [
            (i, j, k),
            (i, j, k - 1),
            (i - 1, j, k - 1),
            (i - 1, j, k),
        ]
    return [
        (i, j, k),
        (i - 1, j, k),
        (i - 1, j - 1, k),
        (i, j - 1, k),
    ]


def _quads_to_tris(quads: np.ndarray) -> np.ndarray:
    if len(quads) == 0:
        return np.zeros((0, 3), np.int32)
    a = quads[:, [0, 1, 2]]
    b = quads[:, [0, 2, 3]]
    return np.vstack([a, b]).astype(np.int32)


def mesh_volume(vertices: np.ndarray, faces: np.ndarray) -> float:
    if len(faces) == 0:
        return 0.0
    tri = vertices[faces].astype(np.float64)
    return float(np.einsum("ij,ij->i", tri[:, 0], np.cross(tri[:, 1], tri[:, 2])).sum() / 6.0)


def face_normals(vertices: np.ndarray, faces: np.ndarray) -> np.ndarray:
    tri = vertices[faces].astype(np.float64)
    n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    return n


def orient_outward(vertices: np.ndarray, faces: np.ndarray) -> np.ndarray:
    """Flip every face if the average normal points inward (object around the origin)."""
    if len(faces) == 0:
        return faces
    n = face_normals(vertices, faces)
    centers = vertices[faces].astype(np.float64).mean(axis=1)
    score = float(np.sum(n * centers))
    if score < 0:
        faces = faces[:, ::-1].copy()
    return faces


def vertex_normals(vertices: np.ndarray, faces: np.ndarray) -> np.ndarray:
    n = face_normals(vertices, faces)
    acc = np.zeros_like(vertices, dtype=np.float64)
    for k in range(3):
        np.add.at(acc, faces[:, k], n)
    norm = np.linalg.norm(acc, axis=1, keepdims=True)
    acc /= np.maximum(norm, 1e-12)
    # Isolated vertices (should not happen) fall back to a radial normal.
    missing = (norm[:, 0] < 1e-8)
    if np.any(missing):
        radial = vertices[missing].astype(np.float64)
        radial /= np.maximum(np.linalg.norm(radial, axis=1, keepdims=True), 1e-8)
        acc[missing] = radial
    return acc.astype(np.float32)


def _edge_pairs(faces: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    pairs = np.vstack(
        [
            faces[:, [0, 1]],
            faces[:, [1, 2]],
            faces[:, [2, 0]],
        ]
    )
    pairs = np.sort(pairs, axis=1)
    pairs = np.unique(pairs, axis=0)
    a = pairs[:, 0].astype(np.int64)
    b = pairs[:, 1].astype(np.int64)
    n = int(faces.max()) + 1 if len(faces) else 0
    counts = np.zeros(n, np.float64)
    np.add.at(counts, a, 1)
    np.add.at(counts, b, 1)
    counts = np.maximum(counts, 1.0)
    return a, b, counts


def _laplacian(vertices: np.ndarray, a: np.ndarray, b: np.ndarray, counts: np.ndarray, weight: float) -> np.ndarray:
    acc = np.zeros_like(vertices)
    np.add.at(acc, a, vertices[b])
    np.add.at(acc, b, vertices[a])
    mean = acc / counts[:, None]
    return vertices + np.float32(weight) * (mean - vertices)


def taubin_smooth(
    vertices: np.ndarray,
    faces: np.ndarray,
    iterations: int,
    max_step: float,
    lam: float = TAUBIN_LAMBDA,
    mu: float = TAUBIN_MU,
) -> np.ndarray:
    """Volume-preserving Taubin smoothing. Displacement is clamped to `max_step`."""
    if iterations <= 0 or len(vertices) == 0 or len(faces) == 0:
        return vertices
    original = vertices.astype(np.float32).copy()
    a, b, counts = _edge_pairs(faces)
    v = original.copy()
    for _ in range(int(iterations)):
        v = _laplacian(v, a, b, counts, lam)
        v = _laplacian(v, a, b, counts, mu)
    delta = v - original
    dist = np.linalg.norm(delta, axis=1, keepdims=True)
    if max_step > 0:
        scale = np.ones_like(dist)
        over = dist > max_step
        scale[over] = max_step / np.maximum(dist[over], 1e-8)
        v = original + delta * scale.astype(np.float32)
    return v.astype(np.float32)


def geometric_edge_histogram(vertices: np.ndarray, faces: np.ndarray, tol: float = 1e-4) -> dict:
    """Edge counts after welding vertices that sit on the same point.

    A flat-shaded box keeps one normal per face, so corners are stored twice.
    Those copies are one corner. The index-only histogram would call every
    face edge a boundary. This welds them first.
    """
    if len(faces) == 0 or len(vertices) == 0:
        return manifold_edge_histogram(faces)
    quant = np.round(np.asarray(vertices, np.float64) / float(tol)).astype(np.int64)
    _uniq, inverse = np.unique(quant, axis=0, return_inverse=True)
    welded = inverse[np.asarray(faces, np.int64)]
    keep = (
        (welded[:, 0] != welded[:, 1])
        & (welded[:, 1] != welded[:, 2])
        & (welded[:, 2] != welded[:, 0])
    )
    return manifold_edge_histogram(welded[keep].astype(np.int32))


def manifold_edge_histogram(faces: np.ndarray) -> dict:
    if len(faces) == 0:
        return {"edges": 0, "boundary": 0, "manifold": 0, "nonManifold": 0}
    pairs = np.vstack([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]])
    pairs = np.sort(pairs, axis=1)
    _, counts = np.unique(pairs, axis=0, return_counts=True)
    return {
        "edges": int(len(counts)),
        "boundary": int(np.sum(counts == 1)),
        "manifold": int(np.sum(counts == 2)),
        "nonManifold": int(np.sum(counts > 2)),
    }


def build_smooth_mesh(
    solid: np.ndarray,
    origin: np.ndarray,
    voxel_size: np.ndarray,
    iterations: int = 10,
    blur_sigma: float = 0.75,
    iso: float = 0.5,
) -> dict:
    """Occupancy → blurred field → surface nets → outward Taubin mesh."""
    field = blur_occupancy(solid, blur_sigma)
    # `origin` is the world position of voxel-center index 0, matching voxel_centers.
    vertices, faces = surface_nets(field, iso, origin, voxel_size)
    if len(vertices) == 0:
        return {
            "vertices": vertices,
            "faces": faces,
            "normals": np.zeros((0, 3), np.float32),
            "volume": 0.0,
            "edges": manifold_edge_histogram(faces),
        }
    faces = orient_outward(vertices, faces)
    step = float(np.min(voxel_size))
    before = mesh_volume(vertices, faces)
    vertices = taubin_smooth(vertices, faces, iterations, max_step=1.75 * step)
    faces = orient_outward(vertices, faces)
    normals = vertex_normals(vertices, faces)
    after = mesh_volume(vertices, faces)
    return {
        "vertices": vertices.astype(np.float32),
        "faces": faces.astype(np.int32),
        "normals": normals.astype(np.float32),
        "volume": abs(after),
        "volumeBeforeSmooth": abs(before),
        "edges": manifold_edge_histogram(faces),
    }


def write_mesh_bin(
    path: Path,
    vertices: np.ndarray,
    normals: np.ndarray,
    faces: np.ndarray,
    groups: np.ndarray,
) -> None:
    """Little-endian mesh the WebGL view loads. No color in this file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    vc = int(len(vertices))
    ic = int(faces.size)
    group = np.asarray(groups, np.uint16)
    if len(group) != vc:
        group = np.zeros(vc, np.uint16)
    blob = bytearray()
    blob += struct.pack("<4sIIII", b"MSH1", vc, ic, 1, int(group.max()) + 1 if vc else 0)
    blob += np.ascontiguousarray(vertices, np.float32).tobytes()
    blob += np.ascontiguousarray(normals, np.float32).tobytes()
    blob += np.ascontiguousarray(faces.reshape(-1), np.uint32).tobytes()
    blob += np.ascontiguousarray(group, np.uint16).tobytes()
    path.write_bytes(blob)


def axis_run_mean(alpha: np.ndarray) -> float:
    """Mean length of axis-aligned runs on the silhouette edge.

    A voxel staircase makes long straight runs. A smooth outline steps one
    pixel at a time, so the mean run is short. This does not look at color.
    """
    body = alpha > 0
    if int(body.sum()) < 8:
        return 0.0
    edge = body & ~(
        np.pad(body, 1, constant_values=False)[1:-1, 2:]
        & np.pad(body, 1, constant_values=False)[1:-1, :-2]
        & np.pad(body, 1, constant_values=False)[2:, 1:-1]
        & np.pad(body, 1, constant_values=False)[:-2, 1:-1]
    )
    runs = []
    for row in edge:
        runs.extend(_runs_1d(row))
    for col in edge.T:
        runs.extend(_runs_1d(col))
    if not runs:
        return 0.0
    return float(np.mean(runs))


def _runs_1d(mask: np.ndarray) -> list[int]:
    runs = []
    length = 0
    for bit in mask.tolist():
        if bit:
            length += 1
        elif length:
            if length >= 2:
                runs.append(length)
            length = 0
    if length >= 2:
        runs.append(length)
    return runs


def project_points(points: np.ndarray, cam: dict, width: int, height: int, fov_y_deg: float):
    """Same projection as hull.project. Image v grows downward."""
    rel = points - cam["position"]
    x = rel @ cam["right"]
    y = rel @ cam["up"]
    z = rel @ cam["forward"]
    fy = (height * 0.5) / math.tan(math.radians(fov_y_deg) * 0.5)
    z_safe = np.maximum(z, 1e-8)
    cx = (width - 1) * 0.5
    cy = (height - 1) * 0.5
    u = cx + fy * (x / z_safe)
    v = cy - fy * (y / z_safe)
    return u, v, z


def rasterize_mesh(
    vertices: np.ndarray,
    normals: np.ndarray,
    faces: np.ndarray,
    groups: np.ndarray,
    cam: dict,
    width: int,
    height: int,
    fov_y: float,
) -> dict:
    """Perspective-correct raster of world position, normal, and group id.

    Group id is flat (one per triangle). No color is written here.
    """
    if len(faces) == 0:
        return _empty_buffers(width, height)
    u, v, z = project_points(vertices.astype(np.float64), cam, width, height, fov_y)
    u = np.asarray(u, np.float64)
    v = np.asarray(v, np.float64)
    z = np.asarray(z, np.float64)
    nvert = len(vertices)
    if len(groups) != nvert:
        groups = np.zeros(nvert, np.int32)
    else:
        groups = np.asarray(groups, np.int32)
    w = int(width)
    h = int(height)
    pix = w * h
    zbuf = np.full(pix, np.inf, np.float64)
    pos = np.zeros((pix, 3), np.float32)
    nrm = np.zeros((pix, 3), np.float32)
    grp = np.full(pix, -1, np.int16)
    hit = np.zeros(pix, np.uint8)

    verts = vertices.astype(np.float64)
    norms = normals.astype(np.float64)
    # Front faces are CCW in screen space. project() has v growing downward,
    # which flips the screen cross relative to world CCW, so we keep area < 0
    # after that flip (world CCW → negative screen area).
    for i0, i1, i2 in faces.tolist():
        z0 = z[i0]
        z1 = z[i1]
        z2 = z[i2]
        if z0 < 1e-3 or z1 < 1e-3 or z2 < 1e-3:
            continue
        ax, ay = u[i0], v[i0]
        bx, by = u[i1], v[i1]
        cx, cy = u[i2], v[i2]
        area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
        if area >= -1e-6:
            continue
        minx = max(int(math.floor(min(ax, bx, cx))), 0)
        maxx = min(int(math.ceil(max(ax, bx, cx))), w - 1)
        miny = max(int(math.floor(min(ay, by, cy))), 0)
        maxy = min(int(math.ceil(max(ay, by, cy))), h - 1)
        if minx > maxx or miny > maxy:
            continue
        inv_a = 1.0 / z0
        inv_b = 1.0 / z1
        inv_c = 1.0 / z2
        p0 = verts[i0] * inv_a
        p1 = verts[i1] * inv_b
        p2 = verts[i2] * inv_c
        n0 = norms[i0] * inv_a
        n1 = norms[i1] * inv_b
        n2 = norms[i2] * inv_c
        gid = int(groups[i0])
        for y in range(miny, maxy + 1):
            py = y + 0.5
            row = y * w
            for x in range(minx, maxx + 1):
                px = x + 0.5
                w0 = (by - cy) * (px - cx) + (cx - bx) * (py - cy)
                w1 = (cy - ay) * (px - cx) + (ax - cx) * (py - cy)
                w2 = area - w0 - w1
                # area is negative for front faces; barycentrics share that sign.
                if w0 > 1e-6 or w1 > 1e-6 or w2 > 1e-6:
                    continue
                b0 = w0 / area
                b1 = w1 / area
                b2 = w2 / area
                inv_z = b0 * inv_a + b1 * inv_b + b2 * inv_c
                if inv_z <= 1e-8:
                    continue
                depth = 1.0 / inv_z
                slot = row + x
                if depth >= zbuf[slot]:
                    continue
                zbuf[slot] = depth
                hit[slot] = 1
                grp[slot] = gid
                pw = (b0 * p0 + b1 * p1 + b2 * p2) / inv_z
                nw = b0 * n0 + b1 * n1 + b2 * n2
                pos[slot, 0] = pw[0]
                pos[slot, 1] = pw[1]
                pos[slot, 2] = pw[2]
                nn = math.sqrt(float(nw[0] * nw[0] + nw[1] * nw[1] + nw[2] * nw[2]))
                if nn < 1e-8:
                    nn = 1.0
                nrm[slot, 0] = nw[0] / nn
                nrm[slot, 1] = nw[1] / nn
                nrm[slot, 2] = nw[2] / nn
    return {
        "z": zbuf.reshape(h, w),
        "pos": pos.reshape(h, w, 3),
        "normal": nrm.reshape(h, w, 3),
        "group": grp.reshape(h, w),
        "hit": hit.reshape(h, w).astype(bool),
    }


def _empty_buffers(width: int, height: int) -> dict:
    return {
        "z": np.full((height, width), np.inf, np.float64),
        "pos": np.zeros((height, width, 3), np.float32),
        "normal": np.zeros((height, width, 3), np.float32),
        "group": np.full((height, width), -1, np.int16),
        "hit": np.zeros((height, width), bool),
    }


def render_zbuffer(
    vertices: np.ndarray,
    faces: np.ndarray,
    cam: dict,
    width: int,
    height: int,
    fov_y: float,
) -> np.ndarray:
    """Camera-space z of the closest front face. inf = no surface. Invisible."""
    zbuf = np.full(height * width, np.inf, np.float64)
    if len(faces) == 0:
        return zbuf.reshape(height, width)
    u, v, z = project_points(vertices.astype(np.float64), cam, width, height, fov_y)
    w = int(width)
    h = int(height)
    for i0, i1, i2 in faces.tolist():
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
        inv_a = 1.0 / z0
        inv_b = 1.0 / z1
        inv_c = 1.0 / z2
        for yy in range(miny, maxy + 1):
            py = yy + 0.5
            row = yy * w
            for xx in range(minx, maxx + 1):
                px = xx + 0.5
                w0 = (by - cy) * (px - cx) + (cx - bx) * (py - cy)
                w1 = (cy - ay) * (px - cx) + (ax - cx) * (py - cy)
                w2 = area - w0 - w1
                if w0 > 1e-6 or w1 > 1e-6 or w2 > 1e-6:
                    continue
                inv_z = (w0 * inv_a + w1 * inv_b + w2 * inv_c) / area
                if inv_z <= 1e-8:
                    continue
                depth = 1.0 / inv_z
                slot = row + xx
                if depth < zbuf[slot]:
                    zbuf[slot] = depth
    return zbuf.reshape(h, w)


def _sample_nearest(view: dict, u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Nearest source texel. No filter, no mip."""
    rgba = view["rgba"]
    height, width = rgba.shape[:2]
    ui = np.clip(np.rint(u).astype(np.int32), 0, width - 1)
    vi = np.clip(np.rint(v).astype(np.int32), 0, height - 1)
    return rgba[vi, ui, :3].astype(np.float32)


def project_fragments(
    buffers: dict,
    views: list[dict],
    zbuffers: list[np.ndarray],
    group_ranges: list[tuple[int, int]],
    bias: float,
) -> tuple[np.ndarray, dict]:
    """Per fragment: best facing visible view, blend the second only in the seam.

    Samples are nearest texels of the original images. No third view, no blur.
    `group_ranges[g]` is (first view index, count) for mesh group g.
    """
    seam_ratio = 0.65
    hit = buffers["hit"]
    h, w = hit.shape
    rgba = np.zeros((h, w, 4), np.uint8)
    ys, xs = np.nonzero(hit)
    if len(ys) == 0:
        return rgba, {"hitPixels": 0, "seamPixels": 0, "seamFraction": 0.0, "fallbackPixels": 0}
    pos = buffers["pos"][ys, xs].astype(np.float64)
    nrm = buffers["normal"][ys, xs].astype(np.float64)
    gid = buffers["group"][ys, xs].astype(np.int32)
    count = len(ys)
    best_w = np.full(count, -1.0)
    best_i = np.zeros(count, np.int32)
    second_w = np.full(count, -1.0)
    second_i = np.full(count, -1, np.int32)
    facing_w = np.full(count, -1.0)
    facing_i = np.zeros(count, np.int32)
    visible = np.zeros(count, dtype=bool)

    for vi, view in enumerate(views):
        to_cam = view["cam"]["position"] - pos
        dist = np.linalg.norm(to_cam, axis=1, keepdims=True)
        view_dir = to_cam / np.maximum(dist, 1e-8)
        nd = np.clip(np.sum(nrm * view_dir, axis=1), 0.0, 1.0)
        weight = nd ** 8
        allowed = np.zeros(count, dtype=bool)
        for g, (start, nview) in enumerate(group_ranges):
            if start <= vi < start + nview:
                allowed |= gid == g
        weight = np.where(allowed, weight, 0.0)
        facing_better = weight > facing_w
        facing_i = np.where(facing_better, vi, facing_i)
        facing_w = np.where(facing_better, weight, facing_w)

        uu, vv, zz = project_points(pos, view["cam"], view["width"], view["height"], view["fovY"])
        ui = np.rint(uu).astype(np.int32)
        vi_px = np.rint(vv).astype(np.int32)
        inside = (
            (zz > 1e-4)
            & (ui >= 0)
            & (vi_px >= 0)
            & (ui < view["width"])
            & (vi_px < view["height"])
        )
        mask_ok = np.zeros(count, dtype=bool)
        sel = np.where(inside)[0]
        if len(sel):
            mask_ok[sel] = view["mask"][vi_px[sel], ui[sel]]
        z_ref = np.full(count, np.inf)
        if len(sel):
            z_ref[sel] = zbuffers[vi][vi_px[sel], ui[sel]]
        # The fragment is this surface. A much larger camera-z means another
        # surface sits in front of it in that view.
        occ_ok = zz <= (z_ref + bias)
        vis = allowed & inside & mask_ok & occ_ok & (weight > 0)
        wvis = np.where(vis, weight, 0.0)
        visible |= vis
        better = wvis > best_w
        second_i = np.where(better, best_i, second_i)
        second_w = np.where(better, best_w, second_w)
        promote = (~better) & (wvis > second_w)
        second_i = np.where(promote, vi, second_i)
        second_w = np.where(promote, wvis, second_w)
        best_i = np.where(better, vi, best_i)
        best_w = np.where(better, wvis, best_w)

    missed = ~visible
    if np.any(missed):
        best_i[missed] = facing_i[missed]
        best_w[missed] = 0.0
        second_w[missed] = -1.0
        second_i[missed] = -1

    seam = (second_w > 0) & (best_w > 0) & ((second_w / np.maximum(best_w, 1e-8)) >= seam_ratio)
    color = np.zeros((count, 3), np.float32)
    for vi, view in enumerate(views):
        m = best_i == vi
        if not np.any(m):
            continue
        uu, vv, _zz = project_points(pos[m], view["cam"], view["width"], view["height"], view["fovY"])
        primary = _sample_nearest(view, uu, vv)
        sm = seam & m
        if np.any(sm):
            sec = second_i[sm]
            mixed = primary.copy()
            # sm indexes the full fragment list; primary is packed to m.
            packed_seam = sm[m]
            for svi, sview in enumerate(views):
                pick = sec == svi
                if not np.any(pick):
                    continue
                su, sv, _sz = project_points(
                    pos[sm][pick], sview["cam"], sview["width"], sview["height"], sview["fovY"]
                )
                secondary = _sample_nearest(sview, su, sv)
                bw = best_w[sm][pick][:, None]
                sw = second_w[sm][pick][:, None]
                mix = bw / np.maximum(bw + sw, 1e-8)
                dest = np.zeros(int(m.sum()), dtype=bool)
                dest[np.where(packed_seam)[0][pick]] = True
                mixed[dest] = primary[dest] * mix + secondary * (1.0 - mix)
            primary = mixed
        color[m] = primary

    rgba[ys, xs, :3] = np.clip(np.rint(color), 0, 255).astype(np.uint8)
    rgba[ys, xs, 3] = 255
    seam_n = int(seam.sum())
    return rgba, {
        "hitPixels": int(count),
        "seamPixels": seam_n,
        "seamFraction": float(seam_n / max(1, count)),
        "fallbackPixels": int(missed.sum()),
    }

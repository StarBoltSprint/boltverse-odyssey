"""Closed organic footprints. Invisible shape only. This module draws nothing."""

from __future__ import annotations

import math
from collections import deque

from tools.layout.geom import heading_of, hypot


def polygon_area(poly: list[tuple[float, float]]) -> float:
    area = 0.0
    n = len(poly)
    for i in range(n):
        x0, z0 = poly[i]
        x1, z1 = poly[(i + 1) % n]
        area += x0 * z1 - x1 * z0
    return area * 0.5


def ensure_ccw(poly: list[tuple[float, float]]) -> list[tuple[float, float]]:
    if polygon_area(poly) < 0.0:
        return list(reversed(poly))
    return list(poly)


def centroid(poly: list[tuple[float, float]]) -> tuple[float, float]:
    area = polygon_area(poly)
    if abs(area) < 1e-9:
        sx = sum(p[0] for p in poly) / len(poly)
        sz = sum(p[1] for p in poly) / len(poly)
        return sx, sz
    cx = 0.0
    cz = 0.0
    n = len(poly)
    for i in range(n):
        x0, z0 = poly[i]
        x1, z1 = poly[(i + 1) % n]
        cross = x0 * z1 - x1 * z0
        cx += (x0 + x1) * cross
        cz += (z0 + z1) * cross
    cx /= 6.0 * area
    cz /= 6.0 * area
    return cx, cz


def point_in_poly(x: float, z: float, poly: list[tuple[float, float]]) -> bool:
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, zi = poly[i]
        xj, zj = poly[j]
        if (zi > z) != (zj > z):
            denom = zj - zi
            if abs(denom) < 1e-15:
                j = i
                continue
            x_cross = (xj - xi) * (z - zi) / denom + xi
            if x < x_cross:
                inside = not inside
        j = i
    return inside


def convex_hull(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    uniq = sorted({(round(p[0], 5), round(p[1], 5)) for p in points})
    if len(uniq) <= 2:
        return [(p[0], p[1]) for p in uniq]

    def cross(o, a, b) -> float:
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower: list[tuple[float, float]] = []
    for p in uniq:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0.0:
            lower.pop()
        lower.append(p)
    upper: list[tuple[float, float]] = []
    for p in reversed(uniq):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0.0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def long_axis(poly: list[tuple[float, float]]) -> float:
    hull = convex_hull(poly)
    best = 0.0
    for i, a in enumerate(hull):
        for b in hull[i + 1 :]:
            best = max(best, hypot(a[0] - b[0], a[1] - b[1]))
    return best


def ring_lengths(poly: list[tuple[float, float]]) -> tuple[float, list[float]]:
    segs = []
    total = 0.0
    n = len(poly)
    for i in range(n):
        a = poly[i]
        b = poly[(i + 1) % n]
        d = hypot(b[0] - a[0], b[1] - a[1])
        segs.append(d)
        total += d
    return total, segs


def point_at(poly: list[tuple[float, float]], segs: list[float], total: float, s: float) -> tuple[float, float, float, float]:
    """Point and outward unit normal at arc length `s` on a CCW ring."""
    if total <= 1e-9:
        return poly[0][0], poly[0][1], 0.0, 1.0
    s = s % total
    acc = 0.0
    n = len(poly)
    for i, dseg in enumerate(segs):
        if acc + dseg >= s - 1e-8 or i == n - 1:
            t = 0.0 if dseg <= 1e-12 else min(1.0, max(0.0, (s - acc) / dseg))
            a = poly[i]
            b = poly[(i + 1) % n]
            x = a[0] + (b[0] - a[0]) * t
            z = a[1] + (b[1] - a[1]) * t
            dx, dz = b[0] - a[0], b[1] - a[1]
            length = hypot(dx, dz) or 1.0
            # CCW ring: interior is left, outward is right.
            nx, nz = dz / length, -dx / length
            return x, z, nx, nz
        acc += dseg
    a = poly[0]
    return a[0], a[1], 0.0, 1.0


def nearest_on_ring(
    poly: list[tuple[float, float]], x: float, z: float
) -> tuple[float, float, float, float, float]:
    """Returns s, distance, x, z, and the outward normal of the nearest point."""
    total, segs = ring_lengths(poly)
    best = None
    acc = 0.0
    n = len(poly)
    for i, dseg in enumerate(segs):
        a = poly[i]
        b = poly[(i + 1) % n]
        abx, abz = b[0] - a[0], b[1] - a[1]
        ab2 = abx * abx + abz * abz
        if ab2 <= 1e-12:
            t = 0.0
            px, pz = a
        else:
            t = max(0.0, min(1.0, ((x - a[0]) * abx + (z - a[1]) * abz) / ab2))
            px = a[0] + abx * t
            pz = a[1] + abz * t
        dist = hypot(x - px, z - pz)
        if best is None or dist < best[0]:
            length = math.sqrt(ab2) or 1.0
            nx, nz = abz / length, -abx / length
            best = (dist, acc + dseg * t, px, pz, nx, nz)
        acc += dseg
    assert best is not None
    return best[1], best[0], best[2], best[3], best[4], best[5]


def span_contains(s: float, start: float, length: float, total: float) -> bool:
    if total <= 1e-9:
        return False
    d = (s - start) % total
    return d <= length + 1e-6


def ray_polygon_t(ox: float, oz: float, heading_deg: float, poly: list[tuple[float, float]]) -> float | None:
    a = math.radians(heading_deg)
    dx, dz = math.sin(a), math.cos(a)
    best = None
    n = len(poly)
    for i in range(n):
        ax, az = poly[i]
        bx, bz = poly[(i + 1) % n]
        hit = _ray_segment(ox, oz, dx, dz, ax, az, bx, bz)
        if hit is None:
            continue
        if best is None or hit < best:
            best = hit
    return best


def _ray_segment(
    ox: float, oz: float, dx: float, dz: float, ax: float, az: float, bx: float, bz: float
) -> float | None:
    ex, ez = bx - ax, bz - az
    det = dx * ez - dz * ex
    if abs(det) < 1e-12:
        return None
    t = ((ax - ox) * ez - (az - oz) * ex) / det
    u = ((ax - ox) * dz - (az - oz) * dx) / det
    if t > 1e-5 and -1e-7 <= u <= 1.0 + 1e-7:
        return t
    return None


def polyline_samples(line: list[tuple[float, float]], step: float) -> list[tuple[float, float, float, float]]:
    """Points with the left unit normal, spaced about `step` metres."""
    if len(line) < 2:
        return []
    out = []
    for i in range(len(line) - 1):
        ax, az = line[i]
        bx, bz = line[i + 1]
        dx, dz = bx - ax, bz - az
        length = hypot(dx, dz)
        if length <= 1e-9:
            continue
        ux, uz = dx / length, dz / length
        nx, nz = -uz, ux
        n = max(1, int(math.ceil(length / step)))
        for k in range(n):
            t = k / n
            out.append((ax + dx * t, az + dz * t, nx, nz))
    out.append((line[-1][0], line[-1][1], out[-1][2], out[-1][3]) if out else (line[-1][0], line[-1][1], 1.0, 0.0))
    return out


def turn_deg(line: list[tuple[float, float]]) -> float:
    best = 0.0
    for i in range(1, len(line) - 1):
        h0 = heading_of(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1])
        h1 = heading_of(line[i + 1][0] - line[i][0], line[i + 1][1] - line[i][1])
        d = abs((h1 - h0 + 540.0) % 360.0 - 180.0)
        if d > best:
            best = d
    return best


def passage_line(a: tuple[float, float], b: tuple[float, float], bend_m: float) -> list[tuple[float, float]]:
    ax, az = a
    bx, bz = b
    dx, dz = bx - ax, bz - az
    length = hypot(dx, dz)
    if length < 1e-6:
        return [(ax, az), (bx, bz)]
    mx = (ax + bx) * 0.5 + (-dz / length) * bend_m
    mz = (az + bz) * 0.5 + (dx / length) * bend_m
    return [(ax, az), (mx, mz), (bx, bz)]


def bend_for_turn(length: float, turn: float = 36.0) -> float:
    """Perpendicular offset that turns a two-segment polyline by about `turn` degrees."""
    phi = math.radians(min(70.0, max(20.0, turn)))
    # cos phi = (L^2/4 - d^2) / (L^2/4 + d^2)
    c = math.cos(phi)
    # d^2 * (1+c) = (L^2/4) * (1-c)
    d2 = (length * length * 0.25) * (1.0 - c) / (1.0 + c)
    return math.sqrt(max(0.0, d2))


def dist_to_segments(x: float, z: float, line: list[tuple[float, float]]) -> float:
    best = float("inf")
    for i in range(len(line) - 1):
        ax, az = line[i]
        bx, bz = line[i + 1]
        abx, abz = bx - ax, bz - az
        ab2 = abx * abx + abz * abz
        if ab2 <= 1e-12:
            d = hypot(x - ax, z - az)
        else:
            t = max(0.0, min(1.0, ((x - ax) * abx + (z - az) * abz) / ab2))
            d = hypot(x - (ax + abx * t), z - (az + abz * t))
        if d < best:
            best = d
    return best


def grow_footprint(
    sub_areas: list[dict],
    passages: list[dict],
    lines: list[list[tuple[float, float]]],
    piece_pad: float,
    res: float = 0.5,
) -> list[tuple[float, float]]:
    """Raster union of sub-area disks and passage stadiums, traced as a CCW polygon.

    The stadium radius is passage width / 2 plus `piece_pad`, so pieces centred
    on the resulting ring leave about `width_m` of clear width.
    """
    disks = []
    for area in sub_areas:
        c = area["center"]
        disks.append((float(c[0]), float(c[1]), float(area["radius_m"])))
    stadia = []
    for passage, line in zip(passages, lines):
        half = float(passage["width_m"]) * 0.5 + piece_pad
        stadia.append((line, half))
    xs = [d[0] - d[2] for d in disks] + [d[0] + d[2] for d in disks]
    zs = [d[1] - d[2] for d in disks] + [d[1] + d[2] for d in disks]
    for line, half in stadia:
        for x, z in line:
            xs.append(x - half)
            xs.append(x + half)
            zs.append(z - half)
            zs.append(z + half)
    pad = res * 3.0
    x0 = min(xs) - pad
    z0 = min(zs) - pad
    x1 = max(xs) + pad
    z1 = max(zs) + pad
    nx = int(math.ceil((x1 - x0) / res))
    nz = int(math.ceil((z1 - z0) / res))

    def inside_cell(i: int, j: int) -> bool:
        x = x0 + (i + 0.5) * res
        z = z0 + (j + 0.5) * res
        for cx, cz, r in disks:
            if hypot(x - cx, z - cz) <= r:
                return True
        for line, half in stadia:
            if dist_to_segments(x, z, line) <= half:
                return True
        return False

    mask = [[inside_cell(i, j) for i in range(nx)] for j in range(nz)]
    solid = _fill_holes(mask, nx, nz)
    try:
        poly = _trace(solid, nx, nz, x0, z0, res)
    except RuntimeError:
        # A one-cell touch makes the boundary branch. One dilation merges it.
        solid = _dilate(solid, nx, nz)
        poly = _trace(solid, nx, nz, x0, z0, res)
    poly = _rdp_closed(poly, res * 0.9)
    poly = ensure_ccw(poly)
    poly = _drop_close(poly, res * 0.25)
    if polygon_area(poly) <= 1.0:
        raise RuntimeError("footprint area collapsed")
    return poly


def _fill_holes(mask: list[list[bool]], nx: int, nz: int) -> list[list[bool]]:
    seen = [[False] * nx for _ in range(nz)]
    q: deque[tuple[int, int]] = deque()
    for i in range(nx):
        for j in (0, nz - 1):
            if not mask[j][i]:
                q.append((i, j))
    for j in range(nz):
        for i in (0, nx - 1):
            if not mask[j][i]:
                q.append((i, j))
    while q:
        i, j = q.popleft()
        if i < 0 or j < 0 or i >= nx or j >= nz or seen[j][i] or mask[j][i]:
            continue
        seen[j][i] = True
        q.append((i + 1, j))
        q.append((i - 1, j))
        q.append((i, j + 1))
        q.append((i, j - 1))
    return [[mask[j][i] or not seen[j][i] for i in range(nx)] for j in range(nz)]


def _trace(solid: list[list[bool]], nx: int, nz: int, x0: float, z0: float, res: float) -> list[tuple[float, float]]:
    """CCW boundary of a simply connected solid mask. Integer edges, one loop."""
    edges: dict[tuple[int, int], tuple[int, int]] = {}

    def add(a: tuple[int, int], b: tuple[int, int]) -> None:
        prev = edges.get(a)
        if prev is not None and prev != b:
            raise RuntimeError("footprint boundary branches; the union is not a simple ring")
        edges[a] = b

    for j in range(nz):
        row = solid[j]
        for i in range(nx):
            if not row[i]:
                continue
            if i == 0 or not solid[j][i - 1]:
                add((i, j + 1), (i, j))
            if i == nx - 1 or not solid[j][i + 1]:
                add((i + 1, j), (i + 1, j + 1))
            if j == 0 or not solid[j - 1][i]:
                add((i, j), (i + 1, j))
            if j == nz - 1 or not solid[j + 1][i]:
                add((i + 1, j + 1), (i, j + 1))
    if not edges:
        raise RuntimeError("footprint mask is empty")
    start = min(edges)
    loop = [start]
    cur = edges[start]
    guard = 0
    while cur != start:
        loop.append(cur)
        if cur not in edges:
            raise RuntimeError("footprint boundary does not close")
        cur = edges[cur]
        guard += 1
        if guard > len(edges) + 2:
            raise RuntimeError("footprint boundary does not close")
    poly = [(x0 + i * res, z0 + j * res) for i, j in loop]
    return poly


def _dilate(solid: list[list[bool]], nx: int, nz: int) -> list[list[bool]]:
    out = [[False] * nx for _ in range(nz)]
    for j in range(nz):
        row = solid[j]
        for i in range(nx):
            if not row[i]:
                continue
            for dj in (-1, 0, 1):
                jj = j + dj
                if jj < 0 or jj >= nz:
                    continue
                for di in (-1, 0, 1):
                    ii = i + di
                    if 0 <= ii < nx:
                        out[jj][ii] = True
    return out


def _drop_close(poly: list[tuple[float, float]], tol: float) -> list[tuple[float, float]]:
    if not poly:
        return poly
    out = [poly[0]]
    for p in poly[1:]:
        if hypot(p[0] - out[-1][0], p[1] - out[-1][1]) >= tol:
            out.append(p)
    if len(out) >= 2 and hypot(out[0][0] - out[-1][0], out[0][1] - out[-1][1]) < tol:
        out.pop()
    return out


def _rdp_closed(points: list[tuple[float, float]], eps: float) -> list[tuple[float, float]]:
    if len(points) < 6:
        return points
    seq = points + [points[0]]
    kept = _rdp(seq, eps)
    if len(kept) >= 2 and kept[0] == kept[-1]:
        kept = kept[:-1]
    return kept


def _rdp(points: list[tuple[float, float]], eps: float) -> list[tuple[float, float]]:
    if len(points) < 3:
        return list(points)
    ax, az = points[0]
    bx, bz = points[-1]
    abx, abz = bx - ax, bz - az
    ab2 = abx * abx + abz * abz
    best_i = 0
    best_d = -1.0
    for i in range(1, len(points) - 1):
        px, pz = points[i]
        if ab2 <= 1e-12:
            d = hypot(px - ax, pz - az)
        else:
            t = max(0.0, min(1.0, ((px - ax) * abx + (pz - az) * abz) / ab2))
            d = hypot(px - (ax + abx * t), pz - (az + abz * t))
        if d > best_d:
            best_d = d
            best_i = i
    if best_d > eps:
        left = _rdp(points[: best_i + 1], eps)
        right = _rdp(points[best_i:], eps)
        return left[:-1] + right
    return [points[0], points[-1]]

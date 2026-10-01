"""Invisible-shape tests. No pixels of a world are produced here."""

from __future__ import annotations

import math
from typing import Iterable, Sequence


def clamp(v: float, lo: float, hi: float) -> float:
    return lo if v < lo else hi if v > hi else v


def hypot(x: float, z: float) -> float:
    return math.hypot(x, z)


def wrap360(a: float) -> float:
    x = a % 360.0
    if x < 0.0:
        x += 360.0
    return x


def wrap180(a: float) -> float:
    x = wrap360(a)
    return x - 360.0 if x > 180.0 else x


def ang_dist(a: float, b: float) -> float:
    return abs(wrap180(a - b))


def heading_of(x: float, z: float) -> float:
    """Degrees. 0 faces +z, 90 faces +x. Same convention as tools/playcheck."""
    return wrap360(math.degrees(math.atan2(x, z)))


def polar(heading_deg: float, radius: float) -> tuple[float, float]:
    a = math.radians(heading_deg)
    return math.sin(a) * radius, math.cos(a) * radius


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def smoothstep(e0: float, e1: float, x: float) -> float:
    if e1 <= e0:
        return 1.0 if x >= e1 else 0.0
    t = clamp((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def gate_half_deg(width_m: float, radius_m: float) -> float:
    """Half-angle of a chord of length `width_m` at `radius_m`. Matches playcheck."""
    if radius_m <= 0.0 or width_m <= 0.0:
        return 0.0
    return math.degrees(math.atan((width_m * 0.5) / radius_m))


def circle_half_deg(radius_m: float, dist_m: float) -> float:
    if dist_m <= 0.0:
        return 180.0
    if radius_m >= dist_m:
        return 180.0
    return math.degrees(math.asin(radius_m / dist_m))


def scale_for_full_width(asset_radius: float, full_width_deg: float, ring_r: float) -> float:
    """Scale that gives a circle this angular width when its centre sits on the ring."""
    if asset_radius <= 0.0 or ring_r <= 0.0:
        raise ValueError("radius must be positive")
    half = math.radians(full_width_deg * 0.5)
    s = math.sin(half)
    if s >= 1.0:
        raise ValueError("angular width does not fit on this ring")
    return (s * ring_r) / asset_radius


def in_gate_span(heading: float, gates: Sequence[dict], slop_deg: float = 0.05) -> bool:
    for g in gates:
        if ang_dist(heading, g["heading"]) <= g["half_deg"] + slop_deg:
            return True
    return False


def ray_circle_t(heading_deg: float, cx: float, cz: float, radius: float) -> float | None:
    """Nearest positive intersection distance of a ray from the origin, or None."""
    if radius < 0.0:
        return None
    a = math.radians(heading_deg)
    ux, uz = math.sin(a), math.cos(a)
    b = ux * cx + uz * cz
    c2 = cx * cx + cz * cz
    disc = b * b - (c2 - radius * radius)
    if disc < 0.0:
        return None
    root = math.sqrt(disc)
    t0 = b - root
    t1 = b + root
    if t0 > 1e-6:
        return t0
    if t1 > 1e-6:
        return t1
    return None


def circle_covers_heading(heading_deg: float, cx: float, cz: float, radius: float, slop_deg: float = 0.0) -> bool:
    dist = hypot(cx, cz)
    if dist <= radius:
        return True
    half = circle_half_deg(radius, dist) + slop_deg
    return ang_dist(heading_deg, heading_of(cx, cz)) <= half + 1e-6


def dist_point_segment(px: float, pz: float, ax: float, az: float, bx: float, bz: float) -> float:
    abx, abz = bx - ax, bz - az
    ab2 = abx * abx + abz * abz
    if ab2 <= 1e-12:
        return hypot(px - ax, pz - az)
    t = clamp(((px - ax) * abx + (pz - az) * abz) / ab2, 0.0, 1.0)
    return hypot(px - (ax + abx * t), pz - (az + abz * t))


def dist_point_to_sector(
    px: float,
    pz: float,
    apex_x: float,
    apex_z: float,
    axis_deg: float,
    half_deg: float,
    length: float,
) -> float:
    """Distance from a point to a disk sector of angle <= 180° (full width)."""
    vx, vz = px - apex_x, pz - apex_z
    d = hypot(vx, vz)
    if d <= 1e-9:
        return 0.0
    delta = ang_dist(heading_of(vx, vz), axis_deg)
    if delta <= half_deg + 1e-9:
        return 0.0 if d <= length else d - length
    left = polar(axis_deg - half_deg, length)
    right = polar(axis_deg + half_deg, length)
    return min(
        dist_point_segment(px, pz, apex_x, apex_z, apex_x + left[0], apex_z + left[1]),
        dist_point_segment(px, pz, apex_x, apex_z, apex_x + right[0], apex_z + right[1]),
    )


def circle_hits_sector(
    cx: float,
    cz: float,
    radius: float,
    apex_x: float,
    apex_z: float,
    axis_deg: float,
    half_deg: float,
    length: float,
) -> bool:
    return dist_point_to_sector(cx, cz, apex_x, apex_z, axis_deg, half_deg, length) <= radius + 1e-9


def segment_clearance(
    circles: Iterable[tuple[float, float, float]],
    ax: float,
    az: float,
    bx: float,
    bz: float,
) -> tuple[float, int]:
    """Smallest (distance from segment to a circle centre, minus that radius).

    Positive means the segment misses every circle by that many metres.
    Returns (clearance, index of the worst circle). Index -1 if there are none.
    """
    best = float("inf")
    which = -1
    for i, (cx, cz, r) in enumerate(circles):
        gap = dist_point_segment(cx, cz, ax, az, bx, bz) - r
        if gap < best:
            best = gap
            which = i
    return best, which


def circles_overlap(ax: float, az: float, ar: float, bx: float, bz: float, br: float, eps: float = 0.0) -> bool:
    return hypot(ax - bx, az - bz) < (ar + br - eps)


def polygon_intersects(a: Sequence[tuple[float, float]], b: Sequence[tuple[float, float]], eps: float = 0.0) -> bool:
    """Convex polygons. `eps` shrinks the test (negative eps makes it stricter)."""
    return _sat(a, b, eps) and _sat(b, a, eps)


def _sat(pts: Sequence[tuple[float, float]], other: Sequence[tuple[float, float]], eps: float) -> bool:
    n = len(pts)
    for i in range(n):
        x0, z0 = pts[i]
        x1, z1 = pts[(i + 1) % n]
        nx, nz = -(z1 - z0), x1 - x0
        length = hypot(nx, nz)
        if length <= 1e-12:
            continue
        nx /= length
        nz /= length
        a_min = a_max = pts[0][0] * nx + pts[0][1] * nz
        for x, z in pts[1:]:
            p = x * nx + z * nz
            a_min = min(a_min, p)
            a_max = max(a_max, p)
        b_min = b_max = other[0][0] * nx + other[0][1] * nz
        for x, z in other[1:]:
            p = x * nx + z * nz
            b_min = min(b_min, p)
            b_max = max(b_max, p)
        if a_max < b_min + eps or b_max < a_min + eps:
            return False
    return True


def circle_polygon_intersects(
    cx: float, cz: float, radius: float, poly: Sequence[tuple[float, float]], eps: float = 0.0
) -> bool:
    # Sample the circle as a convex 16-gon. Enough for the layout sizes we check.
    gon = []
    r = max(0.0, radius - eps)
    for i in range(16):
        a = (math.tau * i) / 16.0
        gon.append((cx + math.cos(a) * r, cz + math.sin(a) * r))
    return polygon_intersects(gon, poly, 0.0)


def gap_runs(misses: Sequence[float]) -> list[tuple[float, float]]:
    """Group 1°-sample headings into inclusive runs. Returns (start, length_deg)."""
    if not misses:
        return []
    ordered = sorted(wrap360(m) for m in misses)
    runs: list[list[float]] = [[ordered[0]]]
    for h in ordered[1:]:
        if h - runs[-1][-1] <= 1.01:
            runs[-1].append(h)
        else:
            runs.append([h])
    if len(runs) >= 2 and (runs[0][0] + 360.0) - runs[-1][-1] <= 1.01:
        wrapped = runs[-1] + runs[0]
        runs = runs[1:-1] + [wrapped]
    out = []
    for run in runs:
        # Each sample represents 1° centred on the sample.
        length = 1.0 if len(run) == 1 else (run[-1] - run[0]) % 360.0 + 1.0
        if length <= 0.0:
            length += 360.0
        out.append((run[0], length))
    return out

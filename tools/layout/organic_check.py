"""Organic clearing rows. Circle files never reach this module.

Thresholds: owner decision 2026-10-02, spec rail 10.
Walkable area >= 5x reference. Convexity <= 0.85. Best-fit circle IoU <= 0.75.
Long axis >= 80 m. At least 3 sub-areas, each >= 150 m2. Passage width 2.5-8 m,
one turn >= 30 deg, one cycle. Boundary closed except gates. Collider gap <= hero
width. A category fails no_ring only when it is a real ring: at least 6 objects,
radius CV from the footprint centroid under 0.10, and angular span over 180 deg
(Director decision 2026-10-02 15:04, delegated owner approval).
Relief amplitude <= 3 m, wavelength >= 20 m, slope <= 15 deg.
"""

from __future__ import annotations

import math
from pathlib import Path

from tools.layout.check import Row
from tools.layout.streaming import measure_stream_plan
from tools.layout.footprint import (
    centroid,
    convex_hull,
    long_axis,
    nearest_on_ring,
    point_at,
    point_in_poly,
    polygon_area,
    polyline_samples,
    ray_polygon_t,
    ring_lengths,
    span_contains,
    turn_deg,
)
from tools.layout.geom import ang_dist, heading_of, hypot, ray_circle_t
from tools.layout.model import focal_px, load_asset, magnification, qnum
from tools.layout.organic import relief_at
from tools.layout.yawband import clearing_objects, measure_yaw_band, yaw_matches, yaw_span
from tools.layout.scatter import (
    LANDMARK_MIN_FRAC,
    MIN_HIDDEN,
    CylinderIndex,
    cylinders_of,
    d_min_m,
    ray_occluded,
    slope_deg,
    walkable_samples,
)

# Owner decision 2026-10-02, spec rail 10.
MIN_AREA_RATIO = 5.0
MAX_CONVEXITY = 0.85
MAX_CIRCLE_IOU = 0.75
MIN_LONG_AXIS_M = 80.0
MIN_SUB_AREAS = 3
MIN_SUB_AREA_M2 = 150.0
MIN_PASSAGE_M = 2.5
MAX_PASSAGE_M = 8.0
MIN_TURN_DEG = 30.0
MIN_CYCLES = 1
RING_COUNT = 6
# Director decision 2026-10-02 15:04 (delegated owner approval).
# CV is the population std/mean of distances from the footprint centroid.
# The old multi-centre +-10% scan is not the PASS/FAIL rule.
RING_CV_MAX = 0.10
RING_SPAN_MIN_DEG = 180.0
MAX_AMP_M = 3.0
MIN_WAVELENGTH_M = 20.0
MAX_SLOPE_DEG = 15.0
NEIGHBOUR_GAP_M = 3.0


def measured_slope_deg(clearing: dict) -> float:
    """Max walkable slope from central differences of the organic relief."""
    zone = clearing.get("zone") or {}
    foot = [(float(p[0]), float(p[1])) for p in (zone.get("footprint") or [])]
    if len(foot) < 3:
        return 0.0
    xs = [p[0] for p in foot]
    zs = [p[1] for p in foot]
    step = 2.0
    h = 1.0
    best = 0.0
    x = min(xs)
    x1 = max(xs)
    z1 = max(zs)
    while x <= x1:
        z = min(zs)
        while z <= z1:
            if point_in_poly(x, z, foot):
                y0 = relief_at(x, z, zone)
                dhdx = (relief_at(x + h, z, zone) - y0) / h
                dhdz = (relief_at(x, z + h, zone) - y0) / h
                slope = math.degrees(math.atan(math.hypot(dhdx, dhdz)))
                if slope > best:
                    best = slope
            z += step
        x += step
    return best


def evaluate_organic(clearing: dict, roots: list[Path], world: dict | None = None) -> tuple[list[Row], dict]:
    rows: list[Row] = []
    zone = clearing.get("zone") or {}
    foot = [(float(p[0]), float(p[1])) for p in (zone.get("footprint") or [])]
    boundary = list((clearing.get("boundary") or {}).get("pieces") or [])
    interiors = list(clearing.get("interior_objects") or [])
    visuals = boundary + interiors
    colliders = list(clearing.get("colliders") or [])
    gates_raw = list(clearing.get("gates") or [])
    hero = clearing.get("hero") or {}
    limits = clearing.get("limits") or {}
    view = clearing.get("view") or {}
    spawn = clearing.get("spawn") or {}
    subs = list(clearing.get("sub_areas") or [])
    passages = list(clearing.get("passages") or [])
    total, segs = ring_lengths(foot) if len(foot) >= 3 else (0.0, [])
    origin = centroid(foot) if len(foot) >= 3 else (0.0, 0.0)
    spawn_pos = spawn.get("position") or [origin[0], origin[1]]
    sx, sz = float(spawn_pos[0]), float(spawn_pos[1])

    missing = [
        k
        for k in ("zone", "boundary", "gates", "sub_areas", "passages", "hero", "limits", "view", "spawn")
        if k not in clearing
    ]
    view_missing = [k for k in ("width", "height", "fov_y_deg", "boom_m", "mag_max") if k not in view]
    limit_missing = [
        k
        for k in ("spawn_clearance_m", "min_gap_m", "path_width_m", "gate_cone_m", "gate_cone_half_deg", "yaw_eps_deg", "scale_eps")
        if k not in limits
    ]
    hero_missing = [k for k in ("width_m", "radius_m") if k not in hero]
    relief = ((zone.get("ground") or {}).get("relief") or {})
    zone_missing = []
    if str(zone.get("shape") or "") != "organic":
        zone_missing.append("zone.shape")
    if len(foot) < 3:
        zone_missing.append("zone.footprint")
    if "reference_area_m2" not in zone:
        zone_missing.append("zone.reference_area_m2")
    if "amp_m" not in relief:
        zone_missing.append("relief.amp_m")
    if "wavelength_m" not in relief:
        zone_missing.append("relief.wavelength_m")
    rows.append(
        Row(
            "rules_present",
            not missing and not view_missing and not limit_missing and not hero_missing and not zone_missing,
            {
                "missing": ",".join(
                    missing
                    + [f"view.{k}" for k in view_missing]
                    + [f"limits.{k}" for k in limit_missing]
                    + [f"hero.{k}" for k in hero_missing]
                    + zone_missing
                )
                or "none"
            },
        )
    )

    hero_w = float(hero.get("width_m") or 0.6)
    hero_r = float(hero.get("radius_m") or 0.35)
    path_w = float(limits.get("path_width_m") or hero_w)
    reference = float(zone.get("reference_area_m2") or 0.0)
    circles = [_circle_of(c) for c in colliders]
    index = _CircleIndex(circles)
    foot_area = abs(polygon_area(foot)) if len(foot) >= 3 else 0.0
    walkable = _walkable_area(foot, index) if len(foot) >= 3 else 0.0
    ratio = (walkable / reference) if reference > 0 else 0.0
    rows.append(
        Row(
            "zone_area",
            reference > 0 and ratio + 1e-9 >= MIN_AREA_RATIO,
            {
                "walkable_m2": walkable,
                "footprint_m2": foot_area,
                "reference_m2": reference,
                "ratio": ratio,
            },
        )
    )

    hull = convex_hull(foot) if len(foot) >= 3 else []
    hull_area = abs(polygon_area(hull)) if len(hull) >= 3 else 0.0
    convexity = (foot_area / hull_area) if hull_area > 1e-6 else 1.0
    axis = long_axis(foot) if len(foot) >= 3 else 0.0
    iou = _best_circle_iou(foot) if len(foot) >= 3 else 1.0
    rows.append(
        Row(
            "footprint_shape",
            convexity <= MAX_CONVEXITY + 1e-9 and iou <= MAX_CIRCLE_IOU + 1e-9 and axis + 1e-9 >= MIN_LONG_AXIS_M,
            {"convexity": convexity, "circle_iou": iou, "long_axis_m": axis},
        )
    )

    sub_areas_m2 = []
    for area in subs:
        c = area.get("center") or [0, 0]
        sub_areas_m2.append(
            _disk_walkable(float(c[0]), float(c[1]), float(area.get("radius_m") or 0.0), foot, index)
        )
    smallest = min(sub_areas_m2) if sub_areas_m2 else 0.0
    rows.append(
        Row(
            "sub_areas",
            len(subs) >= MIN_SUB_AREAS and smallest + 1e-6 >= MIN_SUB_AREA_M2,
            {"count": len(subs), "smallest_m2": smallest},
        )
    )

    widths = []
    turns = []
    for passage in passages:
        line = [(float(p[0]), float(p[1])) for p in (passage.get("center") or passage.get("polyline") or [])]
        turns.append(turn_deg(line) if len(line) >= 3 else 0.0)
        widths.extend(_passage_widths(line, subs, circles))
    cycles = _cycles(subs, passages)
    min_w = min(widths) if widths else 0.0
    max_w = max(widths) if widths else 0.0
    max_turn = max(turns) if turns else 0.0
    width_ok = bool(widths) and min_w + 1e-6 >= MIN_PASSAGE_M and max_w <= MAX_PASSAGE_M + 1e-6
    rows.append(
        Row(
            "passages",
            width_ok and max_turn + 1e-6 >= MIN_TURN_DEG and cycles >= MIN_CYCLES,
            {
                "min_width_m": min_w,
                "max_width_m": max_w,
                "max_turn_deg": max_turn,
                "cycles": cycles,
                "samples": len(widths),
            },
        )
    )

    ray_misses, gap_m, gap_at, gap_list = _boundary_closed(foot, segs, total, boundary, gates_raw, circles, subs, passages)
    rows.append(
        Row(
            "boundary_closed",
            ray_misses == 0 and gap_m <= hero_w + 1e-3,
            {
                "ray_misses": ray_misses,
                "collider_gap_m": gap_m,
                "gap_at_m": gap_at,
                "hero_width_m": hero_w,
                "gaps": gap_list or "none",
            },
            note=("gaps " + gap_list) if gap_list else "",
        )
    )

    rows.append(_collider_row(visuals, colliders, foot, subs, gates_raw, total))

    ring = _no_ring(visuals, foot)
    rows.append(
        Row(
            "no_ring",
            ring["hits"] == 0,
            {
                "hits": ring["hits"],
                "where": ring["where"] or "none",
                "n": ring["n"],
                "cv": qnum(ring["cv"], 4),
                "span_deg": qnum(ring["span_deg"], 4),
                # Report only. Same centroid CV and span, keyed by source asset.
                "by_asset_hits": ring["by_asset_hits"],
                "by_asset_where": ring["by_asset_where"] or "none",
                "by_asset_n": ring["by_asset_n"],
                "by_asset_cv": qnum(ring["by_asset_cv"], 4),
                "by_asset_span_deg": qnum(ring["by_asset_span_deg"], 4),
            },
        )
    )

    relief_worst, relief_bad, relief_id = _relief_err(visuals, clearing.get("fog_band") or {}, zone)
    rows.append(
        Row(
            "relief",
            relief_bad == 0 and bool(relief),
            {"worst_err_m": relief_worst, "off_surface": relief_bad, "id": relief_id or "none"},
        )
    )

    amp = float(relief.get("amp_m") or 0.0)
    wave = float(relief.get("wavelength_m") or 0.0)
    slope = measured_slope_deg(clearing) if len(foot) >= 3 else 0.0
    rows.append(
        Row(
            "relief_slope",
            slope <= MAX_SLOPE_DEG + 1e-6 and amp <= MAX_AMP_M + 1e-9 and wave + 1e-9 >= MIN_WAVELENGTH_M,
            {"max_slope_deg": slope, "amp_m": amp, "wavelength_m": wave},
        )
    )

    rows.append(
        _mag_row(
            visuals, roots, view, hero_r, zone, slope,
            list(clearing.get("far_plates") or []), foot, circles,
        )
    )
    rows.append(_gate_row(gates_raw, foot, segs, total, visuals, circles, hero_w, path_w))

    spawn_need = float(limits.get("spawn_clearance_m") or 0.0)
    spawn_clear = _min_surface(circles, sx, sz)
    rows.append(
        Row(
            "spawn_clearance",
            spawn_clear + 1e-6 >= spawn_need,
            {"clearance_m": spawn_clear, "need_m": spawn_need},
        )
    )
    rows.append(_separation(visuals, float(limits.get("min_gap_m") or 0.0)))

    yaw_eps = float(limits.get("yaw_eps_deg") or 8.0)
    scale_eps = float(limits.get("scale_eps") or 0.03)
    bands = clearing.get("yaw_bands") or {}
    if bands:
        identical = _identical(boundary, interiors, total, yaw_eps, scale_eps, bands, roots)
    else:
        identical = _identical(boundary, interiors, total, yaw_eps, scale_eps)
    spread = _spread(clearing, visuals)
    variety_numbers = {"identical_neighbours": identical, "spread": spread}
    if bands:
        span = yaw_span(clearing_objects(clearing), bands, roots)
        if span is not None:
            variety_numbers["yaw_span_deg"] = span[0]
            variety_numbers["yaw_span_cat"] = span[1]
    rows.append(
        Row(
            "variety",
            identical == 0 and spread == 0,
            variety_numbers,
        )
    )
    if bands:
        measured = measure_yaw_band(clearing_objects(clearing), bands, roots)
        if measured is not None:
            rows.append(Row("yaw_band", measured["ok"], measured["numbers"]))

    fog = clearing.get("fog_band") or {}
    patches = int(fog.get("patches") or 0)
    instances = fog.get("instances") or []
    outside = 0
    for inst in instances:
        px, pz = float(inst["position"][0]), float(inst["position"][1])
        if len(foot) < 3 or not point_in_poly(px, pz, foot):
            outside += 1
    rows.append(
        Row(
            "fog_band",
            patches >= 20 and len(instances) == patches and outside == 0,
            {"patches": patches, "instances": len(instances), "outside_footprint": outside},
        )
    )
    cull = float((clearing.get("near_lens") or {}).get("cull_m") or 0.0)
    rows.append(
        Row(
            "near_lens",
            spawn_clear + 1e-6 >= cull,
            {"spawn_surface_m": spawn_clear, "cull_m": cull},
        )
    )

    budgets = clearing.get("budgets") or {}
    counts: dict[str, int] = {}
    seen_ids: set[str] = set()
    for obj in visuals:
        oid = str(obj.get("id"))
        if oid in seen_ids:
            continue
        seen_ids.add(oid)
        cat = str(obj.get("category") or "")
        if cat:
            counts[cat] = counts.get(cat, 0) + 1
    # Far plates are not visuals (no collider, no boom-distance mag). Count each id once.
    for obj in clearing.get("far_plates") or []:
        oid = str(obj.get("id"))
        if oid in seen_ids:
            continue
        seen_ids.add(oid)
        cat = str(obj.get("category") or "")
        if cat:
            counts[cat] = counts.get(cat, 0) + 1
    budget_fail = 0
    notes = []
    for cat, bounds in budgets.items():
        n = counts.get(str(cat), 0)
        lo, hi = int(bounds[0]), int(bounds[1])
        if n < lo or n > hi:
            budget_fail += 1
            notes.append(f"{cat}:{n}")
    rows.append(
        Row(
            "budgets",
            budget_fail == 0,
            {"categories": len(budgets), "outside": budget_fail},
            note=" ".join(notes),
        )
    )

    rows.append(_discovery_row(clearing, roots, zone, foot, circles, boundary, interiors, (sx, sz)))
    rows.append(_cells_row(clearing, boundary, interiors))
    plan = measure_stream_plan(clearing)
    if plan is not None:
        rows.append(Row("stream_plan", plan["ok"], plan["numbers"], note=plan["note"]))
    rows.append(_scatter_row(clearing, zone, passages, subs, circles))

    bolt = clearing.get("bolt") or {}
    rows.append(
        Row(
            "bolt_paths",
            bool(bolt.get("gallop")) and bool(bolt.get("idle")),
            {"gallop": 1 if bolt.get("gallop") else 0, "idle": 1 if bolt.get("idle") else 0},
        )
    )

    if world is not None:
        from tools.layout.transition import transition_rows

        rows.extend(transition_rows(clearing, world))

    extra = {
        "origin": [origin[0], origin[1]],
        "spawn": [sx, sz],
        "hero_w": hero_w,
        "path_w": path_w,
    }
    return rows, extra


class _CircleIndex:
    def __init__(self, circles: list[tuple[float, float, float]], cell: float = 4.0):
        self.cell = cell
        self.circles = circles
        self.buckets: dict[tuple[int, int], list[int]] = {}
        for i, (x, z, _r) in enumerate(circles):
            key = (math.floor(x / cell), math.floor(z / cell))
            self.buckets.setdefault(key, []).append(i)

    def covers(self, x: float, z: float) -> bool:
        ix = math.floor(x / self.cell)
        iz = math.floor(z / self.cell)
        for dx in (-1, 0, 1):
            for dz in (-1, 0, 1):
                for i in self.buckets.get((ix + dx, iz + dz), ()):
                    cx, cz, r = self.circles[i]
                    if (x - cx) * (x - cx) + (z - cz) * (z - cz) <= r * r:
                        return True
        return False


def _circle_of(obj: dict) -> tuple[float, float, float]:
    pos = obj.get("center") or obj.get("position") or [0, 0]
    return float(pos[0]), float(pos[1]), float(obj.get("radius_m") or 0.0)


def _walkable_area(foot, index: _CircleIndex, res: float = 1.0) -> float:
    xs = [p[0] for p in foot]
    zs = [p[1] for p in foot]
    count = 0
    x = min(xs) + res * 0.5
    while x < max(xs):
        z = min(zs) + res * 0.5
        while z < max(zs):
            if point_in_poly(x, z, foot) and not index.covers(x, z):
                count += 1
            z += res
        x += res
    return count * res * res


def _disk_walkable(cx, cz, radius, foot, index: _CircleIndex, res: float = 1.0) -> float:
    if radius <= 0:
        return 0.0
    count = 0
    x = cx - radius
    while x <= cx + radius:
        z = cz - radius
        while z <= cz + radius:
            if (x - cx) * (x - cx) + (z - cz) * (z - cz) <= radius * radius:
                if point_in_poly(x, z, foot) and not index.covers(x, z):
                    count += 1
            z += res
        x += res
    return count * res * res


def _best_circle_iou(foot) -> float:
    """Upper-leaning search. Missing a better circle would loosen the IoU fail."""
    area = abs(polygon_area(foot))
    if area < 1.0:
        return 1.0
    res = 1.5
    xs = [p[0] for p in foot]
    zs = [p[1] for p in foot]
    minx, maxx = min(xs), max(xs)
    minz, maxz = min(zs), max(zs)
    nx = int((maxx - minx) / res) + 3
    nz = int((maxz - minz) / res) + 3
    cells = []
    grid = set()
    for ix in range(nx):
        for iz in range(nz):
            x = minx + (ix + 0.5) * res
            z = minz + (iz + 0.5) * res
            if point_in_poly(x, z, foot):
                grid.add((ix, iz))
                cells.append((ix, iz, x, z))
    pcount = len(grid)
    if pcount == 0:
        return 1.0
    r0 = math.sqrt(area / math.pi)
    radii = [r0 * f for f in (0.45, 0.6, 0.75, 0.9, 1.0, 1.1, 1.25, 1.45, 1.7)]
    axis = long_axis(foot)
    radii.extend([axis * 0.35, axis * 0.5])
    cx, cz = centroid(foot)

    def iou_at(x: float, z: float, r: float) -> float:
        reach = int(r / res) + 1
        ix0 = int((x - minx) / res)
        iz0 = int((z - minz) / res)
        inter = 0
        circ = 0
        r2 = r * r
        for dx in range(-reach, reach + 1):
            for dz in range(-reach, reach + 1):
                px = minx + (ix0 + dx + 0.5) * res
                pz = minz + (iz0 + dz + 0.5) * res
                if (px - x) * (px - x) + (pz - z) * (pz - z) > r2:
                    continue
                circ += 1
                if (ix0 + dx, iz0 + dz) in grid:
                    inter += 1
        union = circ + pcount - inter
        if union <= 0:
            return 0.0
        return inter / union

    best = 0.0
    best_c = (cx, cz, r0)
    centers = [(cx, cz)]
    x = minx
    while x <= maxx:
        z = minz
        while z <= maxz:
            centers.append((x, z))
            z += 12.0
        x += 12.0
    for x, z in centers:
        if not point_in_poly(x, z, foot) and hypot(x - cx, z - cz) > r0:
            continue
        for r in radii:
            value = iou_at(x, z, r)
            if value > best:
                best = value
                best_c = (x, z, r)
    x, z, r = best_c
    for dx in (-6.0, -3.0, 0.0, 3.0, 6.0):
        for dz in (-6.0, -3.0, 0.0, 3.0, 6.0):
            for factor in (0.92, 1.0, 1.08):
                value = iou_at(x + dx, z + dz, r * factor)
                if value > best:
                    best = value
    return best


def _passage_widths(line, subs, circles) -> list[float]:
    if len(line) < 2:
        return []
    found = []
    length = 0.0
    parts = []
    for i in range(len(line) - 1):
        d = hypot(line[i + 1][0] - line[i][0], line[i + 1][1] - line[i][1])
        parts.append(d)
        length += d
    if length < 1e-6:
        return []
    acc = 0.0
    for i, dseg in enumerate(parts):
        ax, az = line[i]
        bx, bz = line[i + 1]
        dx, dz = bx - ax, bz - az
        norm = dseg or 1.0
        nx, nz = -dz / norm, dx / norm
        steps = max(1, int(math.ceil(dseg / 1.5)))
        for k in range(steps):
            t = (k + 0.5) / steps
            frac = (acc + dseg * t) / length
            if frac < 0.38 or frac > 0.62:
                continue
            px = ax + dx * t
            pz = az + dz * t
            if not _outside_subs(px, pz, subs, 0.5):
                continue
            width = _width_at(px, pz, nx, nz, circles)
            if width is not None:
                found.append(width)
        acc += dseg
    if len(line) >= 3:
        for i in range(1, len(line) - 1):
            px, pz = line[i]
            if not _outside_subs(px, pz, subs, 0.0):
                continue
            ax, az = line[0]
            bx, bz = line[-1]
            dx, dz = bx - ax, bz - az
            norm = hypot(dx, dz) or 1.0
            width = _width_at(px, pz, -dz / norm, dx / norm, circles)
            if width is not None:
                found.append(width)
    return found


def _outside_subs(x, z, subs, margin) -> bool:
    for area in subs:
        c = area.get("center") or [0, 0]
        limit = float(area.get("radius_m") or 0.0) + margin
        if hypot(x - float(c[0]), z - float(c[1])) <= limit:
            return False
    return True


def _width_at(px, pz, nx, nz, circles) -> float | None:
    left = _ray_hit(px, pz, nx, nz, circles)
    right = _ray_hit(px, pz, -nx, -nz, circles)
    if left is None or right is None:
        return None
    if left > 20.0 or right > 20.0:
        return None
    return left + right


def _ray_hit(px, pz, dx, dz, circles) -> float | None:
    heading = heading_of(dx, dz)
    best = None
    for cx, cz, r in circles:
        t = ray_circle_t(heading, cx - px, cz - pz, r)
        if t is None:
            continue
        if best is None or t < best:
            best = t
    return best


def _cycles(subs, passages) -> int:
    ids = [str(s.get("id")) for s in subs]
    adj = {i: set() for i in ids}
    edges = 0
    for passage in passages:
        a = str(passage.get("from") or "")
        b = str(passage.get("to") or "")
        if a not in adj or b not in adj or a == b or b in adj[a]:
            continue
        adj[a].add(b)
        adj[b].add(a)
        edges += 1
    seen = set()
    components = 0
    for node in ids:
        if node in seen:
            continue
        components += 1
        stack = [node]
        seen.add(node)
        while stack:
            cur = stack.pop()
            for nxt in adj[cur]:
                if nxt not in seen:
                    seen.add(nxt)
                    stack.append(nxt)
    if not ids:
        return 0
    return edges - len(ids) + components


def _boundary_closed(foot, segs, total, pieces, gates, circles, subs, passages):
    if len(foot) < 3 or total <= 1e-6:
        return 1, 999.0, 0.0, "no-footprint"
    wall = []
    for piece in pieces:
        pos = piece.get("position") or [0, 0]
        wall.append((float(pos[0]), float(pos[1]), float(piece.get("radius_m") or 0.0)))
    origins = []
    for area in subs:
        c = area.get("center") or [0, 0]
        origins.append((float(c[0]), float(c[1])))
    for passage in passages:
        line = passage.get("center") or passage.get("polyline") or []
        if len(line) >= 3:
            origins.append((float(line[1][0]), float(line[1][1])))
        elif len(line) == 2:
            origins.append(((float(line[0][0]) + float(line[1][0])) * 0.5, (float(line[0][1]) + float(line[1][1])) * 0.5))
    misses = 0
    for ox, oz in origins:
        for deg in range(360):
            heading = deg + 0.5
            t_poly = ray_polygon_t(ox, oz, heading, foot)
            if t_poly is None:
                misses += 1
                continue
            t_vis = _ray_hit(ox, oz, math.sin(math.radians(heading)), math.cos(math.radians(heading)), wall)
            if t_vis is not None and t_vis <= t_poly + 0.15:
                continue
            ex = ox + math.sin(math.radians(heading)) * t_poly
            ez = oz + math.cos(math.radians(heading)) * t_poly
            if _in_gate(ex, ez, foot, gates, total):
                continue
            misses += 1
    gap_m, gap_at, gap_list = _collider_gaps(foot, segs, total, circles, pieces, gates)
    return misses, gap_m, gap_at, gap_list


def _in_gate(x, z, foot, gates, total) -> bool:
    s, dist, _px, _pz, _nx, _nz = nearest_on_ring(foot, x, z)
    if dist > 2.0:
        return False
    for gate in gates:
        span = float(gate.get("span_m") or gate.get("width_m") or 0.0)
        at = float(gate.get("at_m") or 0.0)
        start = (at - span * 0.5) % total
        if span_contains(s, start, span, total):
            return True
    return False


def _collider_gaps(foot, segs, total, circles, pieces, gates):
    ids = {str(p.get("id")) for p in pieces}
    wall = []
    # Colliders are paired by object id. The gap walk uses piece circles, which
    # match those colliders when collider_eq_visual passes.
    for piece in pieces:
        pos = piece.get("position") or [0, 0]
        wall.append((float(pos[0]), float(pos[1]), float(piece.get("radius_m") or 0.0)))
    _ = (circles, ids)
    step = 0.25
    flags = []
    s = 0.0
    while s < total:
        if _span_s(s, gates, total):
            flags.append(None)
        else:
            x, z, _nx, _nz = point_at(foot, segs, total, s)
            flags.append(any(hypot(x - cx, z - cz) <= r + 0.02 for cx, cz, r in wall))
        s += step
    gaps = []
    run = 0
    run_at = 0.0
    for i, flag in enumerate(flags + [None]):
        if flag is False:
            if run == 0:
                run_at = i * step
            run += 1
        elif run:
            gaps.append((run * step, run_at))
            run = 0
    if not gaps:
        return 0.0, 0.0, ""
    length, at = max(gaps, key=lambda item: item[0])
    shown = ",".join(f"{g[0]:.2f}" for g in gaps[:8])
    return length, at, shown


def _span_s(s, gates, total) -> bool:
    for gate in gates:
        span = float(gate.get("span_m") or gate.get("width_m") or 0.0)
        at = float(gate.get("at_m") or 0.0)
        start = (at - span * 0.5) % total
        if span_contains(s % total, start, span, total):
            return True
    return False


def _collider_row(visuals, colliders, foot, subs, gates, total) -> Row:
    by_id = {}
    dup = []
    for obj in visuals:
        oid = str(obj.get("id"))
        if oid in by_id:
            dup.append(oid)
        by_id[oid] = obj
    collider_only = []
    mismatch = []
    linked = set()
    for c in colliders:
        oid = str(c.get("object_id") or "")
        host = by_id.get(oid)
        if host is None:
            collider_only.append(str(c.get("id")))
            continue
        linked.add(oid)
        cc = c.get("center") or [0, 0]
        hc = host.get("position") or [0, 0]
        if abs(float(cc[0]) - float(hc[0])) > 0.02 or abs(float(cc[1]) - float(hc[1])) > 0.02:
            mismatch.append(oid)
        elif abs(float(c.get("radius_m") or 0) - float(host.get("radius_m") or 0)) > 0.02:
            mismatch.append(oid)
    object_only = [str(o.get("id")) for o in visuals if str(o.get("id")) not in linked]
    all_c = [_circle_of(c) for c in colliders]
    all_v = [_circle_of(v) for v in visuals]
    origins = []
    if len(foot) >= 3:
        origins.append(centroid(foot))
    for area in subs:
        c = area.get("center") or [0, 0]
        origins.append((float(c[0]), float(c[1])))
    invisible = 0
    worst_stop = 0.0
    worst_heading = 0.0
    for ox, oz in origins:
        local_c = [(cx - ox, cz - oz, r) for cx, cz, r in all_c]
        local_v = [(cx - ox, cz - oz, r) for cx, cz, r in all_v]
        for deg in range(360):
            sample = deg + 0.5
            tc = _first(sample, local_c)
            tv = _first(sample, local_v)
            if tc is None:
                continue
            if tv is not None and tv <= tc + 0.5:
                continue
            # A gate opening has no near hit. The far side is a matched pair.
            if len(foot) >= 3 and total > 0:
                t_poly = ray_polygon_t(ox, oz, sample, foot)
                if t_poly is not None:
                    ex = ox + math.sin(math.radians(sample)) * t_poly
                    ez = oz + math.cos(math.radians(sample)) * t_poly
                    if _in_gate(ex, ez, foot, gates, total):
                        continue
            invisible += 1
            if tc > worst_stop:
                worst_stop = tc
                worst_heading = sample
    ok = not collider_only and not object_only and not mismatch and not dup and invisible == 0
    return Row(
        "collider_eq_visual",
        ok,
        {
            "collider_only": len(collider_only),
            "object_only": len(object_only),
            "footprint_mismatch": len(mismatch),
            "duplicate_ids": len(dup),
            "invisible_stops": invisible,
            "invisible_stop_m": worst_stop,
            "invisible_heading_deg": worst_heading if invisible else 0.0,
        },
    )


def _first(heading, circles) -> float | None:
    best = None
    for cx, cz, r in circles:
        t = ray_circle_t(heading, cx, cz, r)
        if t is None:
            continue
        if best is None or t < best:
            best = t
    return best


def _ring_stats(pts, origin):
    """Population CV and span of one group around the footprint centroid."""
    ox, oz = origin
    dists = [hypot(px - ox, pz - oz) for px, pz in pts]
    count = len(dists)
    if count == 0:
        return 0, 0.0, 0.0
    mean = sum(dists) / count
    var = sum((d - mean) ** 2 for d in dists) / count
    std = math.sqrt(var)
    cv = (std / mean) if mean > 1e-9 else 0.0
    if count < 2:
        return count, cv, 0.0
    angs = sorted(math.atan2(pz - oz, px - ox) for px, pz in pts)
    gaps = [angs[i + 1] - angs[i] for i in range(count - 1)]
    gaps.append((angs[0] + math.tau) - angs[-1])
    span = math.degrees(math.tau - max(gaps))
    return count, cv, span


def _is_ring(count: int, cv: float, span: float) -> bool:
    return count >= RING_COUNT and cv < RING_CV_MAX and span > RING_SPAN_MIN_DEG


def _worst_group(groups, origin):
    """Worst category: a failing ring, else the tightest group of at least 6, else the largest."""
    rows = []
    for name, pts in groups.items():
        count, cv, span = _ring_stats(pts, origin)
        rows.append((str(name), count, cv, span, _is_ring(count, cv, span)))
    if not rows:
        return "", 0, 0.0, 0.0, False
    failing = [row for row in rows if row[4]]
    if failing:
        failing.sort(key=lambda row: (row[2], -row[3], row[0]))
        return failing[0]
    wide = [row for row in rows if row[1] >= RING_COUNT]
    if wide:
        wide.sort(key=lambda row: (row[2], -row[3], row[0]))
        return wide[0]
    rows.sort(key=lambda row: (-row[1], row[0]))
    return rows[0]


def _no_ring(visuals, foot):
    by_cat: dict[str, list[tuple[float, float]]] = {}
    by_asset: dict[str, list[tuple[float, float]]] = {}
    for obj in visuals:
        pos = obj.get("position") or [0, 0]
        pt = (float(pos[0]), float(pos[1]))
        cat = str(obj.get("category") or "")
        if cat:
            by_cat.setdefault(cat, []).append(pt)
        asset = str(obj.get("asset") or "")
        if asset:
            by_asset.setdefault(asset, []).append(pt)
    origin = centroid(foot) if len(foot) >= 3 else (0.0, 0.0)
    name, count, cv, span, ring = _worst_group(by_cat, origin)
    aname, acount, acv, aspan, aring = _worst_group(by_asset, origin)
    return {
        "hits": 1 if ring else 0,
        "where": name,
        "n": count,
        "cv": cv,
        "span_deg": span,
        "by_asset_hits": 1 if aring else 0,
        "by_asset_where": aname,
        "by_asset_n": acount,
        "by_asset_cv": acv,
        "by_asset_span_deg": aspan,
    }


def _relief_err(visuals, fog, zone):
    worst = 0.0
    bad = 0
    which = ""
    for obj in list(visuals) + list(fog.get("instances") or []):
        pos = obj.get("position") or [0, 0]
        expect = relief_at(float(pos[0]), float(pos[1]), zone)
        got = float(obj.get("base_y_m") if obj.get("base_y_m") is not None else 999.0)
        err = abs(got - expect)
        if err > worst:
            worst = err
            which = str(obj.get("id"))
        if err > 5e-4:
            bad += 1
    return worst, bad, which


def _mag_row(visuals, roots, view, hero_r, zone, slope, far_plates=None, foot=None, circles=None) -> Row:
    mag_worst = 0.0
    mag_id = ""
    mag_closest = 0.0
    mag_fail = 0
    unresolved = 0
    mag_max = float(view.get("mag_max", 1.0))
    for obj in visuals:
        try:
            asset = load_asset(str(obj.get("asset")), roots)
        except (FileNotFoundError, ValueError, OSError):
            unresolved += 1
            continue
        scale = float(obj.get("scale") or 1.0)
        base = float(obj.get("base_y_m") or 0.0)
        info = magnification(asset, scale, view, hero_r, base)
        if info["mag"] > mag_worst:
            mag_worst = info["mag"]
            mag_id = str(obj.get("id"))
            mag_closest = info["closest_m"]
        if info["mag"] > mag_max + 1e-4:
            mag_fail += 1
    ground = zone.get("ground") or {}
    tile_m = float(ground.get("tile_m") or 0.0)
    src = ground.get("tile_source_px") or {}
    sw = float(src.get("width") or 0.0)
    sh = float(src.get("height") or 0.0)
    stretch = 1.0 / max(0.05, math.cos(math.radians(min(slope, 80.0))))
    ground_mag = 0.0
    if tile_m > 0 and sw > 0 and sh > 0:
        dist = max(0.05, hypot(float(view.get("boom_m") or 0.0), float(view.get("eye_height_m") or 0.9)))
        focal = focal_px(float(view.get("height") or 1600), float(view.get("fov_y_deg") or 40))
        screen = (tile_m / dist) * focal
        ground_mag = max(screen / sw, screen / sh) * stretch
        if ground_mag > mag_max + 1e-4:
            mag_fail += 1
            if ground_mag > mag_worst:
                mag_worst = ground_mag
                mag_id = "ground"
                mag_closest = dist
    numbers = {
        "worst": mag_worst,
        "mag_max": mag_max,
        "id": mag_id or "none",
        "closest_m": mag_closest,
        "over": mag_fail,
        "unresolved_assets": unresolved,
        "ground_mag": ground_mag,
        "slope_stretch": stretch,
    }
    # Far plates are graded from the nearest walkable sample, not the follow boom.
    # Owner decision 2026-10-02, spec rail 9. Keys stay off when the file has none.
    if far_plates:
        samples = walkable_samples(list(foot or []), list(circles or []), 2.0)
        focal = focal_px(float(view.get("height") or 1600), float(view.get("fov_y_deg") or 40))
        far_d = 0.0
        far_need = 0.0
        far_best = -1.0
        for obj in far_plates:
            try:
                asset = load_asset(str(obj.get("asset")), roots)
            except (FileNotFoundError, ValueError, OSError):
                unresolved += 1
                continue
            scale = float(obj.get("scale") or 1.0)
            if not samples:
                mag_fail += 1
                continue
            pos = obj.get("position") or [0.0, 0.0]
            dist = min(hypot(float(pos[0]) - sx, float(pos[1]) - sz) for sx, sz in samples)
            screen_h = (asset.height_m * scale / max(dist, 0.05)) * focal
            screen_w = (asset.width_m * scale / max(dist, 0.05)) * focal
            mag = max(screen_h / asset.source_h, screen_w / asset.source_w)
            need = d_min_m(asset, view, scale)
            if mag > far_best:
                far_best = mag
                far_d = dist
                far_need = need
            if mag > mag_worst:
                mag_worst = mag
                mag_id = str(obj.get("id"))
                mag_closest = dist
            if mag > mag_max + 1e-4 or dist + 1e-6 < need:
                mag_fail += 1
        numbers["worst"] = mag_worst
        numbers["id"] = mag_id or "none"
        numbers["closest_m"] = mag_closest
        numbers["over"] = mag_fail
        numbers["unresolved_assets"] = unresolved
        numbers["far_d_m"] = far_d
        numbers["far_d_min_m"] = far_need
    return Row(
        "mag",
        mag_fail == 0 and unresolved == 0 and bool(visuals),
        numbers,
    )


def _gate_row(gates, foot, segs, total, visuals, circles, hero_w, path_w) -> Row:
    by_id = {str(o.get("id")) for o in visuals}
    frame_missing = 0
    narrow = 0
    off = 0
    blocked = 0
    need = hero_w + path_w
    for gate in gates:
        if not gate.get("frame") or not gate.get("frame_ids") or any(str(fid) not in by_id for fid in gate.get("frame_ids") or []):
            frame_missing += 1
        width = float(gate.get("width_m") or 0.0)
        if width + 1e-6 < need or not gate.get("leads_to"):
            narrow += 1
        pos = gate.get("position") or [0, 0]
        if len(foot) >= 3:
            _s, dist, _x, _z, nx, nz = nearest_on_ring(foot, float(pos[0]), float(pos[1]))
            if dist > 0.75:
                off += 1
            outward = heading_of(nx, nz)
            if ang_dist(outward, float(gate.get("heading_deg") or 0.0)) > 8.0:
                off += 1
            at = float(gate.get("at_m") or 0.0)
            half = _half_chord(foot, segs, total, at, max(width, need))
            ax, az, _n1, _n2 = point_at(foot, segs, total, at - half)
            bx, bz, _n3, _n4 = point_at(foot, segs, total, at + half)
            clear = _clear_chord(ax, az, bx, bz, circles)
            if clear + 1e-6 < need:
                blocked += 1
        else:
            off += 1
    ok = bool(gates) and frame_missing == 0 and narrow == 0 and off == 0 and blocked == 0
    return Row(
        "gate",
        ok,
        {"gates": len(gates), "frame_missing": frame_missing, "narrow": narrow, "off_boundary": off, "opening_blocked": blocked},
    )


def _half_chord(foot, segs, total, at, chord) -> float:
    lo = 0.0
    hi = min(total * 0.4, max(chord, 1.0))
    for _ in range(10):
        ax, az, _a, _b = point_at(foot, segs, total, at - hi)
        bx, bz, _c, _d = point_at(foot, segs, total, at + hi)
        if hypot(ax - bx, az - bz) >= chord:
            break
        hi = min(total * 0.45, hi * 1.3 + 0.4)
    for _ in range(24):
        mid = 0.5 * (lo + hi)
        ax, az, _a, _b = point_at(foot, segs, total, at - mid)
        bx, bz, _c, _d = point_at(foot, segs, total, at + mid)
        if hypot(ax - bx, az - bz) >= chord:
            hi = mid
        else:
            lo = mid
    return hi


def _clear_chord(ax, az, bx, bz, circles) -> float:
    abx, abz = bx - ax, bz - az
    length = hypot(abx, abz)
    if length < 1e-6:
        return 0.0
    ux, uz = abx / length, abz / length
    blocked = []
    for cx, cz, r in circles:
        vx, vz = cx - ax, cz - az
        along = vx * ux + vz * uz
        px = ax + ux * along
        pz = az + uz * along
        d = hypot(cx - px, cz - pz)
        if d >= r:
            continue
        half = math.sqrt(max(0.0, r * r - d * d))
        lo = max(0.0, along - half)
        hi = min(length, along + half)
        if lo < hi:
            blocked.append((lo, hi))
    blocked.sort()
    merged = []
    for lo, hi in blocked:
        if not merged or lo > merged[-1][1]:
            merged.append([lo, hi])
        else:
            merged[-1][1] = max(merged[-1][1], hi)
    mid = length * 0.5
    cursor = 0.0
    for lo, hi in merged:
        if cursor <= mid <= lo:
            return lo - cursor
        if lo <= mid <= hi:
            return 0.0
        cursor = hi
    if cursor <= mid <= length:
        return length - cursor
    return 0.0


def _min_surface(circles, x, z) -> float:
    if not circles:
        return float("inf")
    return min(hypot(cx - x, cz - z) - r for cx, cz, r in circles)


def _separation(visuals, min_gap) -> Row:
    worst = float("inf")
    pair = ""
    overlaps = 0
    solids = []
    for obj in visuals:
        pos = obj.get("position") or [0, 0]
        solids.append((str(obj.get("id")), float(pos[0]), float(pos[1]), float(obj.get("radius_m") or 0.0), str(obj.get("category") or "")))
    for i in range(len(solids)):
        for j in range(i + 1, len(solids)):
            idi, ax, az, ar, ca = solids[i]
            idj, bx, bz, br, cb = solids[j]
            if _wall_cat(ca) and _wall_cat(cb):
                continue
            gap = hypot(ax - bx, az - bz) - ar - br
            if gap < worst:
                worst = gap
                pair = f"{idi}|{idj}"
            if gap < -0.02:
                overlaps += 1
    if worst == float("inf"):
        worst = 0.0
    return Row(
        "separation",
        overlaps == 0 and worst + 0.002 >= min_gap,
        {"worst_gap_m": worst, "min_gap_m": min_gap, "overlaps": overlaps, "pair": pair or "none"},
    )


def _wall_cat(cat: str) -> bool:
    # Honest labels only. boundary-N is not a wall exemption.
    # Director decision 2026-10-02 15:04 (delegated owner approval).
    return cat == "exit" or cat == "boundary"


def _identical(boundary, interiors, total, yaw_eps, scale_eps, bands=None, roots=None) -> int:
    bad = 0
    cache: dict = {}
    ordered = sorted(boundary, key=lambda p: float(p.get("s_m") or 0.0))
    n = len(ordered)
    for i in range(n):
        a = ordered[i]
        b = ordered[(i + 1) % n]
        forward = (float(b.get("s_m") or 0.0) - float(a.get("s_m") or 0.0)) % (total or 1.0)
        if total and forward > NEIGHBOUR_GAP_M:
            continue
        if _same(a, b, yaw_eps, scale_eps, bands, roots, cache):
            bad += 1
    by_cat: dict[str, list] = {}
    for obj in interiors:
        by_cat.setdefault(str(obj.get("category") or ""), []).append(obj)
    for group in by_cat.values():
        for i, a in enumerate(group):
            ax, az = float(a["position"][0]), float(a["position"][1])
            best = None
            best_d = float("inf")
            for j, b in enumerate(group):
                if i == j:
                    continue
                d = hypot(ax - float(b["position"][0]), az - float(b["position"][1]))
                if d < best_d:
                    best_d = d
                    best = b
            if best is not None and _same(a, best, yaw_eps, scale_eps, bands, roots, cache):
                bad += 1
    return bad


def _same(a, b, yaw_eps, scale_eps, bands=None, roots=None, cache=None) -> bool:
    if str(a.get("asset")) != str(b.get("asset")):
        return False
    if bands:
        if not yaw_matches(a, b, yaw_eps, bands, roots or [], cache if cache is not None else {}):
            return False
    elif ang_dist(float(a.get("yaw_deg") or 0), float(b.get("yaw_deg") or 0)) > yaw_eps:
        return False
    if abs(float(a.get("scale") or 1) - float(b.get("scale") or 1)) > scale_eps:
        return False
    return True


def _spread(clearing, visuals) -> int:
    variants = clearing.get("variants") or {}
    worst = 0
    for cat, paths in variants.items():
        members = [o for o in visuals if str(o.get("category")) == cat]
        if not members or not paths:
            continue
        counts = {p: 0 for p in paths}
        for obj in members:
            asset = str(obj.get("asset"))
            if asset in counts:
                counts[asset] += 1
        used = list(counts.values())
        extra = sum(1 for obj in members if str(obj.get("asset")) not in counts)
        if extra:
            worst = max(worst, extra)
        if len(members) >= len(paths):
            if min(used) == 0:
                worst = max(worst, 1 + max(used) - min(used))
            elif max(used) - min(used) > 1:
                worst = max(worst, max(used) - min(used) - 1)
        elif max(used) > 1:
            worst = max(worst, max(used) - 1)
    return worst


def _object_top(obj: dict, roots: list[Path], cache: dict) -> float:
    if obj.get("height_m") is not None:
        height = float(obj["height_m"])
    else:
        path = str(obj.get("asset") or "")
        if path not in cache:
            try:
                cache[path] = load_asset(path, roots)
            except (FileNotFoundError, ValueError, OSError):
                cache[path] = None
        asset = cache[path]
        if asset is None:
            height = 0.0
        else:
            height = asset.height_m * float(obj.get("scale") or 1.0)
    return float(obj.get("base_y_m") or 0.0) + height


def _discovery_row(clearing, roots, zone, foot, circles, boundary, interiors, spawn) -> Row:
    """Hidden POIs occluded from spawn; a landmark seen from >= 60% of walkable samples.

    Owner decision 2026-10-02, spec rail 10. The test is 2.5D relief plus footprints.
    """
    pois = list(clearing.get("pois") or [])
    view = clearing.get("view") or {}
    eye_h = float(view.get("eye_height_m") or 0.85)
    sx, sz = spawn
    cache: dict = {}
    cyls, unresolved = cylinders_of(list(boundary) + list(interiors), roots, cache)
    index = CylinderIndex(cyls)
    hidden = [p for p in pois if str(p.get("intent") or "") == "hidden_from_spawn"]
    landmarks = [p for p in pois if str(p.get("intent") or "") == "landmark"]
    routes = [p for p in pois if str(p.get("intent") or "") == "on_route"]
    eye_spawn = relief_at(sx, sz, zone) + eye_h
    hidden_visible = 0
    for poi in hidden:
        pos = poi.get("position") or [sx, sz]
        top = _object_top(poi, roots, cache)
        if not ray_occluded(
            sx, sz, eye_spawn, float(pos[0]), float(pos[1]), top, zone, index, skip=str(poi.get("id")),
        ):
            hidden_visible += 1
    samples = walkable_samples(foot, circles, 2.0) if landmarks else []
    sample_n = len(samples)
    if not landmarks:
        frac = 0.0
    elif sample_n == 0:
        frac = 0.0
    else:
        fracs = []
        for poi in landmarks:
            pos = poi.get("position") or [0.0, 0.0]
            tx, tz = float(pos[0]), float(pos[1])
            top = _object_top(poi, roots, cache)
            skip = str(poi.get("id"))
            visible = 0
            for px, pz in samples:
                eye = relief_at(px, pz, zone) + eye_h
                if not ray_occluded(px, pz, eye, tx, tz, top, zone, index, skip=skip):
                    visible += 1
            fracs.append(visible / sample_n)
        frac = min(fracs) if fracs else 0.0
    on_route_far = 0
    passages = list(clearing.get("passages") or [])
    for poi in routes:
        pos = poi.get("position") or [0.0, 0.0]
        within = float(poi.get("within_m") or 0.0)
        dist = _nearest_passage(float(pos[0]), float(pos[1]), passages)
        if dist > within + 1e-6:
            on_route_far += 1
    ok = (
        unresolved == 0
        and len(hidden) >= MIN_HIDDEN
        and hidden_visible == 0
        and len(landmarks) >= 1
        and frac + 1e-9 >= LANDMARK_MIN_FRAC
        and (not routes or on_route_far == 0)
    )
    return Row(
        "discovery_data",
        ok,
        {
            "hidden": len(hidden),
            "hidden_occluded": len(hidden) - hidden_visible,
            "hidden_visible": hidden_visible,
            "landmark_visible_frac": frac,
            "landmark_samples": sample_n,
            "landmarks": len(landmarks),
            "on_route": len(routes),
            "on_route_far": on_route_far,
        },
    )


def _nearest_passage(x: float, z: float, passages: list) -> float:
    from tools.layout.geom import dist_point_segment

    best = float("inf")
    for passage in passages:
        line = passage.get("center") or passage.get("polyline") or []
        for i in range(len(line) - 1):
            d = dist_point_segment(
                x, z,
                float(line[i][0]), float(line[i][1]),
                float(line[i + 1][0]), float(line[i + 1][1]),
            )
            if d < best:
                best = d
    return best


def _cells_row(clearing, boundary, interiors) -> Row:
    """Every placed object is in one cell. Far plates stay on the always list.

    Owner decision 2026-10-02, spec rail 11.
    """
    cells = list(clearing.get("cells") or [])
    objects = {}
    for obj in list(boundary) + list(interiors):
        objects[str(obj.get("id"))] = obj
    far_ids = {str(obj.get("id")) for obj in (clearing.get("far_plates") or [])}
    always = [str(item) for item in (clearing.get("always") or [])]
    member_count: dict[str, int] = {}
    unknown = 0
    far_in_cell = 0
    aabb_outside = 0
    for cell in cells:
        aabb = cell.get("aabb") or [[0.0, 0.0], [0.0, 0.0]]
        minx, minz = float(aabb[0][0]), float(aabb[0][1])
        maxx, maxz = float(aabb[1][0]), float(aabb[1][1])
        for raw in cell.get("members") or []:
            mid = str(raw)
            member_count[mid] = member_count.get(mid, 0) + 1
            if mid in far_ids:
                far_in_cell += 1
            obj = objects.get(mid)
            if obj is None:
                if mid not in far_ids:
                    unknown += 1
                continue
            pos = obj.get("position") or [0.0, 0.0]
            radius = float(obj.get("radius_m") or 0.0)
            x, z = float(pos[0]), float(pos[1])
            if (
                x - radius < minx - 1e-3
                or x + radius > maxx + 1e-3
                or z - radius < minz - 1e-3
                or z + radius > maxz + 1e-3
            ):
                aabb_outside += 1
    missing = sum(1 for oid in objects if member_count.get(oid, 0) == 0)
    duplicated = sum(1 for oid, count in member_count.items() if count > 1 and oid in objects)
    ids = {str(cell.get("id")) for cell in cells}
    by_id = {str(cell.get("id")): cell for cell in cells}
    asymmetric = 0
    for cell in cells:
        cid = str(cell.get("id"))
        for nid in cell.get("neighbours") or []:
            nid = str(nid)
            if nid not in ids:
                asymmetric += 1
                continue
            if cid not in [str(item) for item in (by_id[nid].get("neighbours") or [])]:
                asymmetric += 1
    always_missing = sum(1 for fid in far_ids if fid not in always)
    ok = (
        bool(cells)
        and missing == 0
        and duplicated == 0
        and unknown == 0
        and aabb_outside == 0
        and asymmetric == 0
        and far_in_cell == 0
        and always_missing == 0
    )
    return Row(
        "cells",
        ok,
        {
            "cells": len(cells),
            "members": sum(len(cell.get("members") or []) for cell in cells),
            "missing": missing,
            "duplicated": duplicated,
            "aabb_outside": aabb_outside,
            "asymmetric": asymmetric,
            "far_in_cell": far_in_cell,
            "always": len(always),
            "always_missing": always_missing,
            "unknown": unknown,
        },
    )


def _scatter_row(clearing, zone, passages, subs, circles) -> Row:
    """Passages keep their authored width. Each depth band has a category.

    Slope cap is the walkable limit (owner decision 2026-10-02, spec rail 10),
    or a tighter cap written on the relief, whichever is smaller.
    """
    worst = None
    for passage in passages:
        line = [(float(p[0]), float(p[1])) for p in (passage.get("center") or passage.get("polyline") or [])]
        widths = _passage_widths(line, subs, circles)
        authored = float(passage.get("width_m") or 0.0)
        measured = min(widths) if widths else 0.0
        slack = measured - authored
        if worst is None or slack < worst[0]:
            worst = (slack, measured, authored)
    if worst is None:
        min_clear, need = 0.0, 0.0
        narrow = True
    else:
        _slack, min_clear, need = worst
        narrow = min_clear + 1e-6 < need
    limit = MAX_SLOPE_DEG
    authored_limit = ((zone.get("ground") or {}).get("relief") or {}).get("max_slope_deg")
    if authored_limit is not None:
        limit = min(limit, float(authored_limit))
    steep = 0
    band_cats = {"fore": set(), "mid": set(), "far": set()}
    band_n = {"fore": 0, "mid": 0, "far": 0}
    for obj in clearing.get("interior_objects") or []:
        cat = str(obj.get("category") or "")
        if _wall_cat(cat) or obj.get("boundary"):
            continue
        pos = obj.get("position") or [0.0, 0.0]
        if slope_deg(float(pos[0]), float(pos[1]), zone) > limit + 1e-6:
            steep += 1
        band = str(obj.get("band") or "")
        if band in band_cats:
            band_cats[band].add(cat)
            band_n[band] += 1
    missing_bands = [name for name in ("fore", "mid", "far") if not band_cats[name]]
    ok = bool(passages) and not narrow and steep == 0 and not missing_bands
    return Row(
        "scatter",
        ok,
        {
            "min_clear_m": min_clear,
            "need_m": need,
            "steep": steep,
            "fore": band_n["fore"],
            "mid": band_n["mid"],
            "far": band_n["far"],
            "bands_missing": ",".join(missing_bands) if missing_bands else "none",
        },
    )

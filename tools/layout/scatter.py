"""Seeded scatter, discovery placement, far plates, and cells.

Owner decision 2026-10-02, spec rails 9, 10, and 11.
The tool places invisible shape only. It does not draw pixels.
"""

from __future__ import annotations

import math

from tools.layout.footprint import nearest_on_ring, point_in_poly, ray_polygon_t
from tools.layout.generate import (
    LayoutError,
    _load_spec_asset,
    _quantize,
    _scale_pair,
    _stamp_library,
)
from tools.layout.geom import heading_of, hypot, polar
from tools.layout.model import focal_px, load_asset, qnum
from tools.layout.passages import hits_passage, passages_from_spec

# Owner decision 2026-10-02, spec rail 11. Streaming cell edge when the spec
# does not name a size. Sub-area mode ignores this length.
DEFAULT_CELL_M = 24.0
# Owner decision 2026-10-02, spec rail 10. Landmark beacon, 2 m walkable grid.
LANDMARK_MIN_FRAC = 0.60
# Owner decision 2026-10-02, spec rail 10. Hidden from the spawn eye.
MIN_HIDDEN = 2


def requested_count(cat: dict, area_m2: float) -> int:
    """Explicit count wins. Otherwise density per 100 m², round half up."""
    if cat.get("count") is not None:
        return int(cat["count"])
    density = float(cat.get("density_per_100m2") or 0.0)
    raw = density * float(area_m2) / 100.0
    return int(math.floor(raw + 0.5))


def d_min_m(asset, view: dict, scale: float = 1.0) -> float:
    """Closest legal distance for a far plate. Owner decision 2026-10-02, spec rail 9.

    d >= max(h, w) * f / source_px / mag_max, with f = (view_px/2) / tan(fov_y/2).
    """
    height = float(view.get("height") or 1600)
    fov = float(view.get("fov_y_deg") or 40)
    mag_max = float(view.get("mag_max") or 1.0)
    focal = focal_px(height, fov)
    dh = (asset.height_m * scale) * focal / float(asset.source_h)
    dw = (asset.width_m * scale) * focal / float(asset.source_w)
    return max(dh, dw) / max(mag_max, 1e-9)


def slope_deg(x: float, z: float, zone: dict) -> float:
    """Local slope from a 1 m central difference of the organic relief."""
    from tools.layout.organic import relief_at

    h = 1.0
    y0 = relief_at(x, z, zone)
    dhdx = (relief_at(x + h, z, zone) - y0) / h
    dhdz = (relief_at(x, z + h, zone) - y0) / h
    return math.degrees(math.atan(math.hypot(dhdx, dhdz)))


class DiscIndex:
    """Spatial hash of circles for separation tests while placing."""

    def __init__(self, cell: float = 8.0):
        self.cell = cell
        self.max_r = 0.0
        self.items: list[tuple[float, float, float]] = []
        self.bins: dict[tuple[int, int], list[int]] = {}

    def add(self, x: float, z: float, radius: float) -> None:
        self.items.append((x, z, radius))
        self.max_r = max(self.max_r, radius)
        key = (math.floor(x / self.cell), math.floor(z / self.cell))
        self.bins.setdefault(key, []).append(len(self.items) - 1)

    def hits(self, x: float, z: float, radius: float, gap: float) -> bool:
        reach = int(math.ceil((radius + gap + self.max_r) / self.cell)) + 1
        ix = math.floor(x / self.cell)
        iz = math.floor(z / self.cell)
        need = radius + gap
        for dx in range(-reach, reach + 1):
            for dz in range(-reach, reach + 1):
                for i in self.bins.get((ix + dx, iz + dz), ()):
                    ox, oz, other = self.items[i]
                    if hypot(x - ox, z - oz) < need + other:
                        return True
        return False


class CylinderIndex:
    """Upright cylinders (x, z, radius, top y, id) for a 2.5D occlusion test."""

    def __init__(self, cylinders: list[tuple[float, float, float, float, str]], cell: float = 8.0):
        self.cell = cell
        self.max_r = 0.0
        self.cyls = cylinders
        self.bins: dict[tuple[int, int], list[int]] = {}
        for i, (x, z, radius, _top, _oid) in enumerate(cylinders):
            self.max_r = max(self.max_r, radius)
            key = (math.floor(x / cell), math.floor(z / cell))
            self.bins.setdefault(key, []).append(i)

    def blocks(self, x: float, z: float, y: float, skip: str | None = None, margin: float = 0.05) -> bool:
        if not self.cyls:
            return False
        reach = int(math.ceil(self.max_r / self.cell)) + 1
        ix = math.floor(x / self.cell)
        iz = math.floor(z / self.cell)
        for dx in range(-reach, reach + 1):
            for dz in range(-reach, reach + 1):
                for i in self.bins.get((ix + dx, iz + dz), ()):
                    cx, cz, radius, top, oid = self.cyls[i]
                    if skip is not None and oid == skip:
                        continue
                    if top <= y + margin:
                        continue
                    if (x - cx) * (x - cx) + (z - cz) * (z - cz) <= radius * radius:
                        return True
        return False


def cylinders_of(objects: list[dict], roots: list, cache: dict) -> tuple[list, int]:
    """World cylinders. height_m on the object wins; otherwise the manifest height."""
    out = []
    unresolved = 0
    for obj in objects:
        pos = obj.get("position") or [0.0, 0.0]
        radius = float(obj.get("radius_m") or 0.0)
        if obj.get("height_m") is not None:
            height = float(obj["height_m"])
        else:
            path = str(obj.get("asset") or "")
            if not path:
                unresolved += 1
                continue
            if path not in cache:
                try:
                    cache[path] = load_asset(path, roots)
                except (FileNotFoundError, ValueError, OSError):
                    cache[path] = None
            asset = cache[path]
            if asset is None:
                unresolved += 1
                continue
            height = asset.height_m * float(obj.get("scale") or 1.0)
        top = float(obj.get("base_y_m") or 0.0) + height
        out.append((float(pos[0]), float(pos[1]), radius, top, str(obj.get("id"))))
    return out, unresolved


def ray_occluded(
    x0: float,
    z0: float,
    y0: float,
    x1: float,
    z1: float,
    y1: float,
    zone: dict,
    index: CylinderIndex,
    skip: str | None = None,
    step: float = 1.25,
) -> bool:
    """True when relief or a cylinder crosses the segment before the target.

    Samples stop short of the target so the target's own volume is not the occluder.
    This is a 2.5D test, not a framebuffer.
    """
    from tools.layout.organic import relief_at

    dx, dz, dy = x1 - x0, z1 - z0, y1 - y0
    dist = hypot(dx, dz)
    if dist < 1e-4:
        return False
    n = max(1, int(dist / step))
    for i in range(1, n):
        t = i / n
        if t * dist > dist - 0.75:
            break
        x = x0 + dx * t
        z = z0 + dz * t
        y = y0 + dy * t
        if relief_at(x, z, zone) > y + 0.05:
            return True
        if index.blocks(x, z, y, skip=skip):
            return True
    return False


def walkable_samples(foot: list[tuple[float, float]], circles: list[tuple[float, float, float]], step: float = 2.0):
    """Points on a step grid inside the footprint and outside collider circles."""
    if len(foot) < 3:
        return []
    xs = [p[0] for p in foot]
    zs = [p[1] for p in foot]
    cell = 8.0
    bins: dict[tuple[int, int], list[tuple[float, float, float]]] = {}
    max_r = 0.0
    for cx, cz, radius in circles:
        max_r = max(max_r, radius)
        key = (math.floor(cx / cell), math.floor(cz / cell))
        bins.setdefault(key, []).append((cx, cz, radius))
    reach = int(math.ceil(max_r / cell)) + 1

    def covered(x: float, z: float) -> bool:
        ix = math.floor(x / cell)
        iz = math.floor(z / cell)
        for dx in range(-reach, reach + 1):
            for dz in range(-reach, reach + 1):
                for cx, cz, radius in bins.get((ix + dx, iz + dz), ()):
                    if (x - cx) * (x - cx) + (z - cz) * (z - cz) <= radius * radius:
                        return True
        return False

    found = []
    x = math.floor(min(xs) / step) * step
    x1 = max(xs)
    z1 = max(zs)
    while x <= x1 + 1e-6:
        z = math.floor(min(zs) / step) * step
        while z <= z1 + 1e-6:
            if point_in_poly(x, z, foot) and not covered(x, z):
                found.append((x, z))
            z += step
        x += step
    return found


def _band_ranks(subs: list[dict], lines: list, pass_in: list[dict]) -> dict[str, str]:
    """fore = spawn-role (or nearest) area, far = deepest, everything between is mid."""
    if not subs:
        return {}
    start = None
    for area in subs:
        if str(area.get("role") or "") == "spawn":
            start = str(area["id"])
            break
    if start is None:
        start = str(subs[0]["id"])
    graph: dict[str, list[tuple[str, float]]] = {str(s["id"]): [] for s in subs}
    for passage, line in zip(pass_in, lines):
        length = 0.0
        for i in range(len(line) - 1):
            length += hypot(line[i + 1][0] - line[i][0], line[i + 1][1] - line[i][1])
        a = str(passage.get("from"))
        b = str(passage.get("to"))
        if a in graph and b in graph and a != b:
            graph[a].append((b, length))
            graph[b].append((a, length))
    dist = {start: 0.0}
    pending = [start]
    while pending:
        pending.sort(key=lambda name: (dist[name], name))
        cur = pending.pop(0)
        for nxt, length in graph.get(cur, []):
            cand = dist[cur] + length
            if nxt not in dist or cand < dist[nxt] - 1e-9:
                dist[nxt] = cand
                pending.append(nxt)
    ranked = sorted(subs, key=lambda s: (dist.get(str(s["id"]), 1e9), str(s["id"])))
    out = {}
    last = len(ranked) - 1
    for i, area in enumerate(ranked):
        if i == 0:
            band = "fore"
        elif i == last and last > 0:
            band = "far"
        else:
            band = "mid"
        out[str(area["id"])] = band
    return out


def _host_area(subs: list[dict], ids: list[str]) -> float:
    total = 0.0
    for area in subs:
        if str(area["id"]) in ids:
            r = float(area["radius_m"])
            total += math.pi * r * r
    return total


def _point_on(line, frac: float):
    if len(line) < 2:
        return None
    parts = []
    acc = 0.0
    for i in range(len(line) - 1):
        d = hypot(line[i + 1][0] - line[i][0], line[i + 1][1] - line[i][1])
        parts.append(d)
        acc += d
    if acc < 1e-6:
        return None
    target = acc * frac
    cursor = 0.0
    for i, dseg in enumerate(parts):
        if cursor + dseg >= target and dseg > 0:
            t = (target - cursor) / dseg
            ax, az = line[i]
            bx, bz = line[i + 1]
            x = ax + (bx - ax) * t
            z = az + (bz - az) * t
            nx, nz = -(bz - az) / dseg, (bx - ax) / dseg
            return x, z, nx, nz
        cursor += dseg
    ax, az = line[-1]
    return ax, az, 1.0, 0.0


def _dist_poly(x: float, z: float, line) -> float:
    from tools.layout.geom import dist_point_segment

    best = float("inf")
    for i in range(len(line) - 1):
        d = dist_point_segment(x, z, line[i][0], line[i][1], line[i + 1][0], line[i + 1][1])
        if d < best:
            best = d
    return best


def build_cells(
    cell_spec: dict,
    poly: list[tuple[float, float]],
    subs: list[dict],
    pass_in: list[dict],
    objects: list[dict],
) -> list[dict]:
    """One cell per object. Grid (~24 m) or one cell per sub-area."""
    mode = str((cell_spec or {}).get("mode") or "grid")
    if mode == "sub_area":
        return _cells_sub_area(subs, pass_in, objects)
    size = float((cell_spec or {}).get("size_m") or DEFAULT_CELL_M)
    if size <= 0:
        size = DEFAULT_CELL_M
    return _cells_grid(poly, objects, size)


def _cells_grid(poly, objects, size: float) -> list[dict]:
    xs = [p[0] for p in poly] or [0.0]
    zs = [p[1] for p in poly] or [0.0]
    for obj in objects:
        pos = obj.get("position") or [0.0, 0.0]
        xs.append(float(pos[0]))
        zs.append(float(pos[1]))
    origin_x = math.floor(min(xs) / size) * size
    origin_z = math.floor(min(zs) / size) * size
    cells: dict[tuple[int, int], dict] = {}

    def touch(ix: int, iz: int) -> dict:
        cell = cells.get((ix, iz))
        if cell is None:
            cell = {"ix": ix, "iz": iz, "members": [], "minx": None, "minz": None, "maxx": None, "maxz": None}
            cells[(ix, iz)] = cell
        return cell

    def cover_square(ix: int, iz: int) -> None:
        cell = touch(ix, iz)
        x0 = origin_x + ix * size
        z0 = origin_z + iz * size
        _grow(cell, x0, z0, 0.0)
        _grow(cell, x0 + size, z0 + size, 0.0)

    for obj in objects:
        pos = obj.get("position") or [0.0, 0.0]
        x, z = float(pos[0]), float(pos[1])
        ix = int(math.floor((x - origin_x) / size))
        iz = int(math.floor((z - origin_z) / size))
        cell = touch(ix, iz)
        cell["members"].append(str(obj.get("id")))
        _grow(cell, x, z, float(obj.get("radius_m") or 0.0))
        cover_square(ix, iz)

    if len(poly) >= 3:
        min_ix = int(math.floor((min(p[0] for p in poly) - origin_x) / size))
        max_ix = int(math.floor((max(p[0] for p in poly) - origin_x) / size))
        min_iz = int(math.floor((min(p[1] for p in poly) - origin_z) / size))
        max_iz = int(math.floor((max(p[1] for p in poly) - origin_z) / size))
        for ix in range(min_ix, max_ix + 1):
            for iz in range(min_iz, max_iz + 1):
                cx = origin_x + (ix + 0.5) * size
                cz = origin_z + (iz + 0.5) * size
                corners = (
                    (origin_x + ix * size, origin_z + iz * size),
                    (origin_x + (ix + 1) * size, origin_z + iz * size),
                    (origin_x + ix * size, origin_z + (iz + 1) * size),
                    (origin_x + (ix + 1) * size, origin_z + (iz + 1) * size),
                )
                hit = point_in_poly(cx, cz, poly) or any(point_in_poly(px, pz, poly) for px, pz in corners)
                if not hit:
                    continue
                cover_square(ix, iz)
    return _emit_grid(cells)


def _grow(cell: dict, x: float, z: float, radius: float) -> None:
    x0, x1 = x - radius, x + radius
    z0, z1 = z - radius, z + radius
    cell["minx"] = x0 if cell["minx"] is None else min(cell["minx"], x0)
    cell["maxx"] = x1 if cell["maxx"] is None else max(cell["maxx"], x1)
    cell["minz"] = z0 if cell["minz"] is None else min(cell["minz"], z0)
    cell["maxz"] = z1 if cell["maxz"] is None else max(cell["maxz"], z1)


def _emit_grid(cells: dict) -> list[dict]:
    present = set(cells)
    out = []
    for ix, iz in sorted(present):
        cell = cells[(ix, iz)]
        neighbours = []
        for nix, niz in ((ix - 1, iz), (ix + 1, iz), (ix, iz - 1), (ix, iz + 1)):
            if (nix, niz) in present:
                neighbours.append(f"c-{nix:03d}-{niz:03d}")
        out.append(
            {
                "aabb": [
                    [qnum(cell["minx"]), qnum(cell["minz"])],
                    [qnum(cell["maxx"]), qnum(cell["maxz"])],
                ],
                "id": f"c-{ix:03d}-{iz:03d}",
                "members": sorted(cell["members"]),
                "neighbours": sorted(neighbours),
            }
        )
    return out


def _cells_sub_area(subs: list[dict], pass_in: list[dict], objects: list[dict]) -> list[dict]:
    if not subs:
        return []
    owners: dict[str, list[str]] = {str(s["id"]): [] for s in subs}
    extra: dict[str, list[tuple[float, float, float]]] = {str(s["id"]): [] for s in subs}
    for obj in objects:
        pos = obj.get("position") or [0.0, 0.0]
        x, z = float(pos[0]), float(pos[1])
        best = None
        best_d = float("inf")
        for area in subs:
            c = area["center"]
            cx, cz = float(c[0]), float(c[1])
            d = hypot(x - cx, z - cz)
            if d < best_d:
                best_d = d
                best = str(area["id"])
        owners[best].append(str(obj.get("id")))
        extra[best].append((x, z, float(obj.get("radius_m") or 0.0)))
    links: dict[str, set[str]] = {str(s["id"]): set() for s in subs}
    for passage in pass_in:
        a = str(passage.get("from"))
        b = str(passage.get("to"))
        if a in links and b in links and a != b:
            links[a].add(b)
            links[b].add(a)
    out = []
    for area in subs:
        sid = str(area["id"])
        c = area["center"]
        cx, cz = float(c[0]), float(c[1])
        radius = float(area["radius_m"])
        minx, maxx = cx - radius, cx + radius
        minz, maxz = cz - radius, cz + radius
        for x, z, r in extra[sid]:
            minx = min(minx, x - r)
            maxx = max(maxx, x + r)
            minz = min(minz, z - r)
            maxz = max(maxz, z + r)
        cid = f"c-{sid}"
        out.append(
            {
                "aabb": [[qnum(minx), qnum(minz)], [qnum(maxx), qnum(maxz)]],
                "id": cid,
                "members": sorted(owners[sid]),
                "neighbours": sorted(f"c-{n}" for n in links[sid]),
            }
        )
    out.sort(key=lambda cell: cell["id"])
    return out


def apply_scatter(
    spec: dict,
    roots: list,
    zone: dict,
    poly: list[tuple[float, float]],
    subs: list[dict],
    lines: list,
    pass_in: list[dict],
    gates: list[dict],
    pieces: list[dict],
    interiors: list[dict],
    spawn_x: float,
    spawn_z: float,
    hero_r: float,
    view: dict,
    limits: dict,
    seed: int,
):
    """Place scatter, POIs, and far plates. Returns interiors, far plates, pois, cells, always, variants."""
    from tools.layout.organic import _fits_interior, _finish, _lcg

    bands = _band_ranks(subs, lines, pass_in)
    rng = _lcg(int(seed) + 101)
    solids = [o for o in list(pieces) + list(interiors)]
    disc = DiscIndex()
    for obj in solids:
        pos = obj["position"]
        disc.add(float(pos[0]), float(pos[1]), float(obj["radius_m"]))

    added: list[dict] = []
    variants: dict[str, list[str]] = {}
    hard_passages = passages_from_spec(spec)
    scatter = spec.get("scatter") or {}
    categories = scatter.get("categories") or {}
    for cat_name in sorted(categories):
        cat = categories[cat_name]
        paths = list(cat.get("assets") or [])
        if not paths:
            raise LayoutError(f"scatter {cat_name} needs assets")
        assets = [_load_spec_asset(p, roots) for p in paths]
        variants[cat_name] = [a.path for a in assets]
        band = str(cat.get("band") or "")
        hosts = [s for s in subs if (not band) or bands.get(str(s["id"])) == band]
        if not hosts:
            raise LayoutError(f"scatter {cat_name} has no sub-area in band {band or 'any'}")
        area = _host_area(subs, [str(s["id"]) for s in hosts])
        count = requested_count(cat, area)
        if count < 0:
            raise LayoutError(f"scatter {cat_name} count is negative")
        cluster_n = max(1, int(cat.get("cluster_count") or 1))
        cluster_r = float(cat.get("cluster_radius_m") or 0.0)
        min_bound = float(cat.get("min_boundary_m") or 0.0)
        max_slope = float(cat.get("max_slope_deg") or 15.0)
        lo, hi = _scale_pair(cat, assets)
        from tools.layout.model import max_legal_scale

        caps = []
        for asset in assets:
            cap = max_legal_scale(asset, view, hero_r, lo, hi)
            if cap + 1e-4 < lo:
                raise LayoutError(f"{asset.path} exceeds magnification at its minimum scale")
            caps.append(cap)
        hi_use = min([hi] + caps)
        s0 = lo
        s1 = hi_use if hi_use <= lo + 1e-9 else min(hi_use, lo + max(0.08, (hi_use - lo) * 0.5))
        scales = [s0, s1]
        seeds = []
        for c in range(cluster_n):
            host = hosts[c % len(hosts)]
            seeds.append(_cluster_seed(host, rng))
        for i in range(count):
            asset = assets[i % len(assets)]
            scale = min(scales[i % len(scales)], caps[i % len(caps)])
            scale = max(lo, scale)
            sx0, sz0 = seeds[i % len(seeds)]
            placed = False
            for attempt in range(500):
                ang = next(rng) * 360.0
                rad = next(rng) * cluster_r
                dx, dz = polar(ang, rad)
                x, z = sx0 + dx, sz0 + dz
                radius = asset.radius_m * scale
                if hits_passage(x, z, radius, hard_passages):
                    continue
                if not _in_hosts(x, z, radius, hosts):
                    continue
                if slope_deg(x, z, zone) > max_slope + 1e-6:
                    continue
                _s, edge, _px, _pz, _nx, _nz = nearest_on_ring(poly, x, z)
                if edge < max(min_bound, radius + 1.4):
                    continue
                if disc.hits(x, z, radius, float(limits["min_gap_m"])):
                    continue
                if not _fits_interior(
                    x, z, radius, poly, spawn_x, spawn_z,
                    float(limits["spawn_clearance_m"]), float(limits["min_gap_m"]),
                    float(limits["path_width_m"]) * 0.5,
                    float(limits["gate_cone_m"]), float(limits["gate_cone_half_deg"]),
                    gates, solids, lines, pass_in, subs,
                ):
                    continue
                yaw = _quantize(i * 40.0 + attempt * asset.yaw_step, asset.yaw_step)
                obj = _bare(asset, cat_name, f"{cat_name}-{i:02d}", x, z, scale, yaw, zone, _finish)
                if band:
                    obj["band"] = band
                added.append(obj)
                solids.append(obj)
                disc.add(float(obj["position"][0]), float(obj["position"][1]), float(obj["radius_m"]))
                placed = True
                break
            if not placed:
                raise LayoutError(f"could not place {cat_name}-{i:02d}")

    pois_out = []
    far_out = []
    poi_specs = list(spec.get("pois") or [])
    for poi in poi_specs:
        intent = str(poi.get("intent") or "")
        if intent == "landmark":
            obj = _place_far_plate(
                poi, roots, zone, poly, view, rng, _finish, walkable=None,
            )
            obj["intent"] = "landmark"
            if poi.get("bearing_deg") is not None:
                obj["bearing_deg"] = qnum(float(poi["bearing_deg"]), 3)
            far_out.append(obj)
            pois_out.append(dict(obj))
            variants.setdefault(str(poi.get("category") or "poi"), [])
            if obj["asset"] not in variants[str(poi.get("category") or "poi")]:
                variants[str(poi.get("category") or "poi")].append(obj["asset"])
            continue
        if intent == "hidden_from_spawn":
            obj = _place_hidden(
                poi, roots, zone, poly, subs, lines, pass_in, gates, solids, disc,
                spawn_x, spawn_z, limits, bands, view, hero_r, rng, _fits_interior, _finish,
                pois_out,
            )
        elif intent == "on_route":
            obj = _place_on_route(
                poi, roots, zone, poly, subs, lines, pass_in, gates, solids, disc,
                spawn_x, spawn_z, limits, view, hero_r, rng, _fits_interior, _finish,
            )
        else:
            raise LayoutError(f"poi {poi.get('id')} intent {intent or 'missing'} is not supported")
        added.append(obj)
        solids.append(obj)
        disc.add(float(obj["position"][0]), float(obj["position"][1]), float(obj["radius_m"]))
        pois_out.append({k: obj[k] for k in obj})
        cat = str(poi.get("category") or "")
        if cat:
            variants.setdefault(cat, [])
            if obj["asset"] not in variants[cat]:
                variants[cat].append(obj["asset"])

    # Walkable samples after interiors exist, so far plates clear the ground people can stand on.
    circles = []
    for obj in solids:
        pos = obj["position"]
        circles.append((float(pos[0]), float(pos[1]), float(obj["radius_m"])))
    samples = walkable_samples(poly, circles, 2.0)
    # Landmark plates were staged without the sample set. Push them out to d_min now.
    pushed = []
    for obj in far_out:
        pushed.append(_push_far(obj, poly, zone, view, samples, _finish))
    far_out = pushed
    for i, obj in enumerate(far_out):
        if str(obj.get("intent") or "") == "landmark":
            for poi in pois_out:
                if str(poi.get("id")) == str(obj.get("id")):
                    poi.clear()
                    poi.update(obj)

    for plate in spec.get("far_plates") or []:
        obj = _place_far_plate(plate, roots, zone, poly, view, rng, _finish, samples)
        far_out.append(obj)
        cat = str(plate.get("category") or "far-plate")
        variants.setdefault(cat, [])
        if obj["asset"] not in variants[cat]:
            variants[cat].append(obj["asset"])

    cell_objects = list(pieces) + list(interiors) + list(added)
    cells = build_cells(spec.get("cells") or {"mode": "grid", "size_m": DEFAULT_CELL_M}, poly, subs, pass_in, cell_objects)
    always = sorted({str(o.get("id")) for o in far_out})
    return added, far_out, pois_out, cells, always, variants


def _cluster_seed(host: dict, rng) -> tuple[float, float]:
    c = host["center"]
    cx, cz = float(c[0]), float(c[1])
    inner = float(host["radius_m"]) * 0.35
    for _ in range(40):
        ang = next(rng) * 360.0
        rad = next(rng) * inner
        dx, dz = polar(ang, rad)
        return cx + dx, cz + dz
    return cx, cz


def _in_hosts(x, z, radius, hosts) -> bool:
    for host in hosts:
        c = host["center"]
        limit = float(host["radius_m"]) - radius
        if limit > 0 and hypot(x - float(c[0]), z - float(c[1])) <= limit:
            return True
    return False


def _bare(asset, category, oid, x, z, scale, yaw, zone, finish) -> dict:
    obj = {
        "asset": asset.path,
        "base_y_m": 0.0,
        "category": category,
        "id": oid,
        "interactive": False,
        "position": [x, z],
        "radius_m": asset.radius_m * scale,
        "scale": scale,
        "yaw_deg": yaw,
    }
    finish(obj, zone)
    obj["height_m"] = qnum(asset.height_m * float(obj["scale"]))
    obj["asset_obj"] = asset
    _stamp_library(obj, asset)
    return obj


def _place_hidden(
    poi, roots, zone, poly, subs, lines, pass_in, gates, solids, disc,
    spawn_x, spawn_z, limits, bands, view, hero_r, rng, fits, finish, already,
):
    del hero_r, rng
    asset = _load_spec_asset(poi["asset"], roots)
    scale = 1.0
    radius = asset.radius_m * scale
    gap = float(limits["min_gap_m"])
    cache: dict = {}
    cyls, _unresolved = cylinders_of(solids, roots, cache)
    index = CylinderIndex(cyls)
    from tools.layout.organic import relief_at

    eye_y = relief_at(spawn_x, spawn_z, zone) + float(view.get("eye_height_m") or 0.85)
    candidates = _hidden_candidates(solids, spawn_x, spawn_z, radius, gap, subs, bands)
    need_sep = 4.0
    for x, z in candidates:
        if any(hypot(x - float(p["position"][0]), z - float(p["position"][1])) < need_sep for p in already):
            continue
        if disc.hits(x, z, radius, gap):
            continue
        if not fits(
            x, z, radius, poly, spawn_x, spawn_z,
            float(limits["spawn_clearance_m"]), gap, float(limits["path_width_m"]) * 0.5,
            float(limits["gate_cone_m"]), float(limits["gate_cone_half_deg"]),
            gates, solids, lines, pass_in, subs,
        ):
            continue
        top = relief_at(x, z, zone) + asset.height_m * scale
        if not ray_occluded(spawn_x, spawn_z, eye_y, x, z, top, zone, index):
            continue
        yaw = _quantize(heading_of(spawn_x - x, spawn_z - z), asset.yaw_step)
        obj = _bare(asset, str(poi.get("category") or "poi"), str(poi["id"]), x, z, scale, yaw, zone, finish)
        obj["intent"] = "hidden_from_spawn"
        return obj
    raise LayoutError(f"could not hide {poi.get('id')} from the spawn eye ({len(candidates)} candidates)")


def _hidden_candidates(solids, spawn_x, spawn_z, radius, gap, subs, bands):
    found = []
    seen = set()

    def add(x, z):
        key = (round(x, 2), round(z, 2))
        if key in seen:
            return
        seen.add(key)
        found.append((x, z))

    walls = []
    for obj in solids:
        row = int(obj.get("row") or 0)
        cat = str(obj.get("category") or "")
        if row >= 2 or cat == "boundary" or cat.startswith("boundary-"):
            walls.append(obj)
    walls.sort(key=lambda o: (int(o.get("row") or 0) < 2, str(o.get("id"))))
    for obj in walls:
        pos = obj["position"]
        px, pz = float(pos[0]), float(pos[1])
        vx, vz = px - spawn_x, pz - spawn_z
        dist = hypot(vx, vz)
        if dist < 1.0:
            continue
        ux, uz = vx / dist, vz / dist
        reach = dist + float(obj["radius_m"]) + radius + gap + 0.3
        add(spawn_x + ux * reach, spawn_z + uz * reach)
    for area in subs:
        if bands.get(str(area["id"])) == "fore":
            continue
        c = area["center"]
        cx, cz = float(c[0]), float(c[1])
        limit = float(area["radius_m"]) * 0.72
        x = cx - limit
        while x <= cx + limit + 1e-6:
            z = cz - limit
            while z <= cz + limit + 1e-6:
                if hypot(x - cx, z - cz) <= limit:
                    add(x, z)
                z += 3.0
            x += 3.0
    return found


def _place_on_route(
    poi, roots, zone, poly, subs, lines, pass_in, gates, solids, disc,
    spawn_x, spawn_z, limits, view, hero_r, rng, fits, finish,
):
    del view, hero_r, rng
    asset = _load_spec_asset(poi["asset"], roots)
    scale = 1.0
    radius = asset.radius_m * scale
    gap = float(limits["min_gap_m"])
    within = float(poi.get("within_m") or 6.0)
    for line in lines:
        for frac in (0.44, 0.50, 0.56, 0.36, 0.64):
            hit = _point_on(line, frac)
            if hit is None:
                continue
            px, pz, nx, nz = hit
            for sign in (1.0, -1.0):
                lat = max(radius + gap + 0.4, 2.2)
                while lat <= within + 1e-6:
                    x = px + nx * sign * lat
                    z = pz + nz * sign * lat
                    lat += 0.35
                    if _dist_poly(x, z, line) > within + 1e-6:
                        continue
                    if disc.hits(x, z, radius, gap):
                        continue
                    if not fits(
                        x, z, radius, poly, spawn_x, spawn_z,
                        float(limits["spawn_clearance_m"]), gap, float(limits["path_width_m"]) * 0.5,
                        float(limits["gate_cone_m"]), float(limits["gate_cone_half_deg"]),
                        gates, solids, lines, pass_in, subs,
                    ):
                        continue
                    yaw = _quantize(heading_of(nx * sign, nz * sign), asset.yaw_step)
                    obj = _bare(asset, str(poi.get("category") or "poi"), str(poi["id"]), x, z, scale, yaw, zone, finish)
                    obj["intent"] = "on_route"
                    obj["within_m"] = qnum(within, 3)
                    return obj
    raise LayoutError(f"could not place {poi.get('id')} within {within} m of a passage")


def _place_far_plate(spec_obj, roots, zone, poly, view, rng, finish, walkable):
    asset = _load_spec_asset(spec_obj["asset"], roots)
    bearing = float(spec_obj.get("bearing_deg") or 0.0)
    # Consume one rng step so later plates stay deterministic even when this one is pushed later.
    next(rng)
    center = zone.get("center") or [0.0, 0.0]
    cx, cz = float(center[0]), float(center[1])
    t_exit = ray_polygon_t(cx, cz, bearing, poly) if len(poly) >= 3 else None
    dist = (t_exit or 0.0) + 2.0
    dx, dz = polar(bearing, dist)
    x, z = cx + dx, cz + dz
    yaw = _quantize(bearing + 180.0, asset.yaw_step)
    obj = _bare(
        asset,
        str(spec_obj.get("category") or "far-plate"),
        str(spec_obj["id"]),
        x, z, 1.0, yaw, zone, finish,
    )
    obj["bearing_deg"] = qnum(bearing, 3)
    obj["d_min_m"] = qnum(d_min_m(asset, view, 1.0), 4)
    if walkable is not None:
        obj = _push_far(obj, poly, zone, view, walkable, finish)
    return obj


def _push_far(obj, poly, zone, view, samples, finish):
    """Move a far plate along its bearing until it is outside and at least d_min from walkable ground."""
    from tools.layout.model import load_asset as _load

    if not samples:
        raise LayoutError(f"far plate {obj.get('id')} has no walkable sample to measure against")
    bearing = float(obj.get("bearing_deg") or 0.0)
    center = zone.get("center") or [0.0, 0.0]
    cx, cz = float(center[0]), float(center[1])
    # d_min was stored from the manifest at scale 1. Recompute so a moved file cannot shrink it.
    try:
        asset = _load(str(obj.get("asset")), [])
    except (FileNotFoundError, ValueError, OSError):
        asset = None
    need = float(obj.get("d_min_m") or 0.0)
    if asset is not None:
        need = d_min_m(asset, view, float(obj.get("scale") or 1.0))
    need += 0.05
    t_exit = ray_polygon_t(cx, cz, bearing, poly) if len(poly) >= 3 else 0.0
    dist = max((t_exit or 0.0) + 1.0, hypot(float(obj["position"][0]) - cx, float(obj["position"][1]) - cz))
    placed = None
    for _ in range(64):
        dx, dz = polar(bearing, dist)
        x, z = cx + dx, cz + dz
        if len(poly) >= 3 and point_in_poly(x, z, poly):
            dist += 2.0
            continue
        nearest = min(hypot(x - sx, z - sz) for sx, sz in samples)
        if nearest + 1e-6 >= need:
            placed = (x, z, nearest)
            break
        dist += max(1.0, need - nearest + 0.25)
    if placed is None:
        raise LayoutError(f"far plate {obj.get('id')} could not clear d_min {need}")
    x, z, _nearest = placed
    obj["position"] = [x, z]
    finish(obj, zone)
    if asset is not None:
        obj["height_m"] = qnum(asset.height_m * float(obj["scale"]))
        obj["d_min_m"] = qnum(d_min_m(asset, view, float(obj["scale"])), 4)
    return obj

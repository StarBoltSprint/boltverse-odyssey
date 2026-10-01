"""Build a clearing.json from a zone spec. Placement only. No pixels."""

from __future__ import annotations

from pathlib import Path

from tools.layout.geom import (
    ang_dist,
    circle_half_deg,
    circle_hits_sector,
    gate_half_deg,
    heading_of,
    polar,
    scale_for_full_width,
    segment_clearance,
    wrap360,
)
from tools.layout.model import (
    Asset,
    load_asset,
    load_json,
    max_legal_scale,
    perm_for_zone,
    qnum,
    relief_y,
)
from tools.layout.noise import fbm


class LayoutError(RuntimeError):
    pass


def generate(spec_path: Path, out_dir: Path, asset_roots: list[Path] | None = None) -> dict:
    spec = load_json(spec_path)
    roots = list(asset_roots or [])
    roots.append(spec_path.parent)
    roots.append(Path.cwd())
    clearing = build_clearing(spec, roots)
    out_dir.mkdir(parents=True, exist_ok=True)
    dest = out_dir / "clearing.json"
    from tools.layout.model import dump_json

    dest.write_text(dump_json(clearing), encoding="utf-8")
    return clearing


def build_clearing(spec: dict, roots: list[Path]) -> dict:
    zone = spec["zone"]
    ring_r = float(spec["ring"]["radius_m"])
    zone_r = float(zone["radius_m"])
    if ring_r <= 0 or zone_r <= ring_r:
        raise LayoutError("zone radius must be larger than the ring radius")
    hero = spec["hero"]
    hero_w = float(hero["width_m"])
    hero_r = float(hero["radius_m"])
    view = spec["view"]
    limits = spec["limits"]
    spawn = spec.get("spawn") or {"position": [0, 0]}
    spawn_x, spawn_z = float(spawn["position"][0]), float(spawn["position"][1])
    categories = spec["categories"]
    assets = {key: [load_asset(p, roots) for p in cat["assets"]] for key, cat in categories.items() if cat.get("assets")}
    for key, group in assets.items():
        if not group:
            raise LayoutError(f"category {key} has no assets")

    gates_in = spec["gates"]
    if not gates_in:
        raise LayoutError("a zone needs at least one gate")
    gates = []
    for g in gates_in:
        half = gate_half_deg(float(g["width_m"]), ring_r)
        gates.append(
            {
                "id": str(g["id"]),
                "heading": float(g["heading_deg"]),
                "half_deg": half,
                "width_m": float(g["width_m"]),
                "leads_to": g.get("leads_to") or "",
                "field": g.get("field") or "",
                "frame_asset": g.get("frame_asset"),
            }
        )
        if float(g["width_m"]) + 1e-6 < max(hero_w, float(limits["path_width_m"])):
            raise LayoutError(f"gate {g['id']} is narrower than the hero and the path")

    ring_assets = assets["ring"]
    exit_assets = assets.get("exit") or ring_assets
    scale_lo, scale_hi = _scale_pair(categories["ring"])
    legal = []
    for asset in ring_assets + exit_assets:
        cap = max_legal_scale(asset, view, hero_r, scale_lo, scale_hi)
        if cap + 1e-4 < scale_lo:
            raise LayoutError(
                f"{asset.path} cannot be placed at scale {scale_lo} without magnification above {view.get('mag_max', 1)}"
            )
        legal.append(cap)
    scale_hi = min([scale_hi] + legal)

    arcs = _free_arcs(gates)
    origin = (float((zone.get("center") or [0, 0])[0]), float((zone.get("center") or [0, 0])[1]))
    ring_pieces: list[dict] = []
    exits: list[dict] = []
    asset_cursor = 0
    for arc_i, (a0, a1) in enumerate(arcs):
        pieces, asset_cursor = _cover_arc(
            a0,
            a1,
            ring_r,
            ring_assets,
            exit_assets[arc_i % len(exit_assets)],
            scale_lo,
            scale_hi,
            origin,
            asset_cursor,
        )
        for p in pieces:
            if p["category"] == "exit":
                exits.append(p)
            else:
                ring_pieces.append(p)

    _assign_exit_ids(exits, gates)
    for i, p in enumerate(ring_pieces):
        p["id"] = f"ring-{i:02d}"

    solids = _as_circles(ring_pieces + exits)
    perm = perm_for_zone(zone)
    interiors: list[dict] = []
    place_order = [k for k in ("hero", "mid", "near") if k in categories]
    for cat_name in place_order:
        cat = categories[cat_name]
        made = _place_category(
            cat_name,
            cat,
            assets[cat_name],
            zone,
            ring_r,
            gates,
            solids,
            interiors,
            spawn_x,
            spawn_z,
            hero_r,
            view,
            limits,
            spec,
            perm,
            origin,
        )
        interiors.extend(made)
        solids.extend(_as_circles(made))

    _stamp_relief(ring_pieces + exits + interiors, zone, perm)

    fog = _fog(spec.get("fog_band") or {}, gates, ring_r, zone, perm, origin)
    hulls = _hull_records(ring_pieces + exits)
    interior_records = [_interior_record(o) for o in interiors]
    colliders = [_collider(o) for o in ring_pieces + exits + interiors]
    gate_records = []
    for g in gates:
        frames = [e["id"] for e in exits if e.get("gate_id") == g["id"]]
        gate_records.append(
            {
                "field": g["field"],
                "frame": g["frame_asset"] or (exit_assets[0].path if exit_assets else ""),
                "frame_ids": frames,
                "heading_deg": qnum(g["heading"], 3),
                "id": g["id"],
                "leads_to": g["leads_to"],
                "width_m": qnum(g["width_m"], 3),
            }
        )

    face = spawn.get("face")
    if not face and gates:
        face = f"gate:{gates[0]['id']}"
    budgets = spec.get("budgets") or {}
    variants = {key: list(cat["assets"]) for key, cat in categories.items() if cat.get("assets")}
    clearing = {
        "backdrop": spec.get("backdrop") or {},
        "bolt": spec.get("bolt")
        or {
            "gallop": "lock/bolt-gallop-cycle.mp4",
            "idle": "lock/bolt-idle-breath.mp4",
        },
        "budgets": budgets,
        "colliders": colliders,
        "edge_ring": {
            "hulls": hulls,
            "max_gap_deg": float(spec["ring"].get("max_gap_deg", 0)),
            "radius_m": qnum(ring_r, 4),
        },
        "fog_band": fog,
        "gates": gate_records,
        "hero": {"radius_m": qnum(hero_r, 4), "width_m": qnum(hero_w, 4)},
        "id": spec.get("id") or "zone",
        "interior_objects": interior_records,
        "limits": limits,
        "near_lens": spec.get("near_lens") or {"cull_m": 1.2, "fade_m": [1.2, 2.5]},
        "schema": "clearing/1",
        "seed": int(spec.get("seed", 1)),
        "spawn": {"face": face, "position": [qnum(spawn_x), qnum(spawn_z)]},
        "variants": variants,
        "view": view,
        "zone": zone,
    }
    return clearing


def _scale_pair(cat: dict) -> tuple[float, float]:
    pair = cat.get("scale") or [1.0, 1.0]
    return float(pair[0]), float(pair[1])


def _free_arcs(gates: list[dict]) -> list[tuple[float, float]]:
    """Arcs outside the gates, each as (start, end) with end > start."""
    spans = []
    for g in gates:
        a = wrap360(g["heading"] - g["half_deg"])
        b = wrap360(g["heading"] + g["half_deg"])
        if b <= a:
            b += 360.0
        spans.append((a, b))
    spans.sort()
    for i in range(len(spans) - 1):
        if spans[i + 1][0] < spans[i][1] - 0.05:
            raise LayoutError("gate openings overlap")
    if not spans:
        return [(0.0, 360.0)]
    arcs = []
    for i, (_s, e) in enumerate(spans):
        nstart = spans[(i + 1) % len(spans)][0]
        if i == len(spans) - 1:
            nstart += 360.0
        if nstart - e > 0.05:
            arcs.append((e, nstart))
    return arcs


def _cover_arc(
    a0: float,
    a1: float,
    ring_r: float,
    ring_assets: list[Asset],
    exit_asset: Asset,
    scale_lo: float,
    scale_hi: float,
    origin: tuple[float, float],
    asset_cursor: int,
) -> tuple[list[dict], int]:
    arc = a1 - a0
    ref = min(ring_assets + [exit_asset], key=lambda a: a.radius_m)
    best = None
    target = (scale_lo + scale_hi) * 0.5
    for n in range(3, 721):
        step = arc / n
        try:
            s_end = scale_for_full_width(exit_asset.radius_m, step, ring_r)
            s_ring = scale_for_full_width(ref.radius_m, step, ring_r)
        except ValueError:
            continue
        if scale_lo - 1e-4 <= s_end <= scale_hi + 1e-4 and s_ring <= scale_hi + 1e-4:
            score = abs(s_end - target)
            if best is None or score < best[0]:
                best = (score, n, step, s_end)
    if best is None:
        raise LayoutError(
            f"ring assets cannot close an arc of {arc:.2f}° at scales {scale_lo}..{scale_hi}"
        )
    _score, n, step, s_end = best
    yaw_cycle = [-30.0, -15.0, 0.0, 15.0, 30.0]
    scale_cycle = [0.0, 0.06, 0.12]
    pieces = []
    for i in range(n):
        center_h = wrap360(a0 + (i + 0.5) * step)
        is_end = i == 0 or i == n - 1
        if is_end:
            asset = exit_asset
            scale = s_end
            category = "exit"
            gate_side = "a" if i == 0 else "b"
        else:
            asset = ring_assets[asset_cursor % len(ring_assets)]
            asset_cursor += 1
            category = "ring"
            gate_side = ""
            slot_half = min((i + 0.5) * step, (n - i - 0.5) * step)
            # Stay inside the arc. A hair of overlap with the neighbour is already in `step`.
            max_full = max(step, 2.0 * slot_half - 0.05)
            try:
                s_slot = scale_for_full_width(asset.radius_m, max_full, ring_r)
            except ValueError:
                s_slot = scale_hi
            bump = scale_cycle[i % len(scale_cycle)]
            scale = min(scale_hi, s_slot, max(scale_lo, s_end + bump))
            if scale + 1e-6 < scale_for_full_width(asset.radius_m, step, ring_r):
                scale = scale_for_full_width(asset.radius_m, step, ring_r)
        radius = asset.radius_m * scale
        half = circle_half_deg(radius, ring_r)
        x, z = polar(center_h, ring_r)
        x += origin[0]
        z += origin[1]
        yaw = _quantize(center_h + 180.0 + yaw_cycle[i % len(yaw_cycle)], asset.yaw_step)
        pieces.append(
            {
                "asset": asset.path,
                "asset_obj": asset,
                "base_y_m": 0.0,
                "category": category,
                "gate_side": gate_side,
                "heading_deg": center_h,
                "interactive": False,
                "position": [x, z],
                "radius_m": radius,
                "scale": scale,
                "width_deg": half * 2.0,
                "yaw_deg": yaw,
            }
        )
    return pieces, asset_cursor


def _assign_exit_ids(exits: list[dict], gates: list[dict]) -> None:
    """Pair arc ends with the gate they touch."""
    for e in exits:
        h = e["heading_deg"]
        best = None
        for g in gates:
            d = min(
                abs(((h - (g["heading"] - g["half_deg"]) + 540) % 360) - 180),
                abs(((h - (g["heading"] + g["half_deg"]) + 540) % 360) - 180),
            )
            # Angular distance to the nearer gate edge.
            edge_a = g["heading"] - g["half_deg"]
            edge_b = g["heading"] + g["half_deg"]
            dist = min(_arc_delta(h, edge_a), _arc_delta(h, edge_b))
            if best is None or dist < best[0]:
                best = (dist, g)
        if best is None:
            raise LayoutError("exit piece has no gate")
        g = best[1]
        e["gate_id"] = g["id"]
        side = e.get("gate_side") or "a"
        e["id"] = f"exit-{g['id']}-{side}"


def _arc_delta(a: float, b: float) -> float:
    return abs(((a - b + 540.0) % 360.0) - 180.0)


def _quantize(yaw: float, step: float) -> float:
    if step <= 1.0:
        return wrap360(yaw)
    q = round(yaw / step) * step
    return wrap360(q)


def _as_circles(objs: list[dict]) -> list[dict]:
    return objs


def _place_category(
    cat_name: str,
    cat: dict,
    group: list[Asset],
    zone: dict,
    ring_r: float,
    gates: list[dict],
    solids: list[dict],
    already: list[dict],
    spawn_x: float,
    spawn_z: float,
    hero_r: float,
    view: dict,
    limits: dict,
    spec: dict,
    perm: list[int],
    origin: tuple[float, float],
) -> list[dict]:
    count = int(cat["count"])
    band = cat.get("band_m") or [2.0, ring_r * 0.6]
    scale_lo, scale_hi_spec = _scale_pair(cat)
    clearance = float(limits["spawn_clearance_m"])
    min_gap = float(limits["min_gap_m"])
    path_r = float(limits["path_width_m"]) * 0.5
    cone_m = float(limits["gate_cone_m"])
    cone_half = float(limits["gate_cone_half_deg"])
    seed = int(spec.get("seed", 1))
    made: list[dict] = []
    scale_bumps = [0.0, 0.05, 0.1, -0.04]
    yaw_steps_extra = [0.0, 90.0, 180.0, 270.0, 45.0, 135.0]
    for i in range(count):
        asset = group[i % len(group)]
        s_cap = max_legal_scale(asset, view, hero_r, scale_lo, scale_hi_spec)
        if s_cap + 1e-4 < scale_lo:
            raise LayoutError(f"{asset.path} exceeds magnification at the bottom of its scale range")
        placed = False
        for attempt in range(240):
            jx = fbm(10 + i, attempt + seed, perm, 1, 1.0)
            jz = fbm(80 + i, attempt + seed, perm, 1, 1.0)
            ang = wrap360((i + 0.5) * (360.0 / max(count, 1)) + jx * 55.0 + cat_name.__len__() * 13.0)
            t = 0.5 + 0.5 * jz
            # Keep t in range even when simplex saturates.
            t = min(1.0, max(0.0, t))
            rad = band[0] + (band[1] - band[0]) * t
            x, z = polar(ang, rad)
            x += origin[0]
            z += origin[1]
            bump = scale_bumps[(i + attempt) % len(scale_bumps)]
            scale = min(s_cap, max(scale_lo, (scale_lo + min(scale_hi_spec, s_cap)) * 0.5 + bump))
            radius = asset.radius_m * scale
            yaw = _quantize(yaw_steps_extra[(i + attempt // 3) % len(yaw_steps_extra)] + ang, asset.yaw_step)
            if _matches_neighbour(made, x, z, asset.path, yaw, scale):
                continue
            if not _fits(
                x,
                z,
                radius,
                spawn_x,
                spawn_z,
                clearance,
                min_gap,
                path_r,
                cone_m,
                cone_half,
                gates,
                ring_r,
                solids + made,
                zone,
                origin,
            ):
                continue
            made.append(
                {
                    "asset": asset.path,
                    "asset_obj": asset,
                    "base_y_m": 0.0,
                    "category": cat_name,
                    "heading_deg": heading_of(x - spawn_x, z - spawn_z),
                    "id": f"{cat_name}-{i:02d}",
                    "interactive": cat_name == "hero",
                    "position": [x, z],
                    "radius_m": radius,
                    "scale": scale,
                    "yaw_deg": yaw,
                }
            )
            placed = True
            break
        if not placed:
            raise LayoutError(f"could not place {cat_name}-{i:02d} without breaking clearance")
    return made


def _matches_neighbour(made: list[dict], x: float, z: float, asset: str, yaw: float, scale: float) -> bool:
    """Reject a candidate that copies its nearest already-placed neighbour."""
    best = None
    best_d = float("inf")
    for o in made:
        d = hypot(x - float(o["position"][0]), z - float(o["position"][1]))
        if d < best_d:
            best_d = d
            best = o
    if best is None:
        return False
    if str(best["asset"]) != asset:
        return False
    if ang_dist(float(best["yaw_deg"]), yaw) > 8.0:
        return False
    if abs(float(best["scale"]) - scale) > 0.03:
        return False
    return True


def _fits(
    x: float,
    z: float,
    radius: float,
    spawn_x: float,
    spawn_z: float,
    clearance: float,
    min_gap: float,
    path_r: float,
    cone_m: float,
    cone_half: float,
    gates: list[dict],
    ring_r: float,
    others: list[dict],
    zone: dict,
    origin: tuple[float, float],
) -> bool:
    center = zone.get("center") or [0, 0]
    if hypot(x - float(center[0]), z - float(center[1])) + radius > float(zone["radius_m"]) - 0.05:
        return False
    if hypot(x - spawn_x, z - spawn_z) < radius + clearance:
        return False
    for o in others:
        ox, oz = o["position"]
        if hypot(x - ox, z - oz) < radius + o["radius_m"] + min_gap:
            return False
    for g in gates:
        mx, mz = polar(g["heading"], ring_r)
        mx += origin[0]
        mz += origin[1]
        clearance_m, _ = segment_clearance([(x, z, radius)], spawn_x, spawn_z, mx, mz)
        if clearance_m < path_r:
            return False
        if circle_hits_sector(x, z, radius, mx, mz, wrap360(g["heading"] + 180.0), cone_half, cone_m):
            return False
    return True


def _stamp_relief(objs: list[dict], zone: dict, perm: list[int]) -> None:
    for o in objs:
        x, z = o["position"]
        y = qnum(relief_y(x, z, zone, perm), 4)
        o["base_y_m"] = y
        o["position"] = [qnum(x, 4), qnum(z, 4)]
        o["radius_m"] = qnum(o["radius_m"], 4)
        o["scale"] = qnum(o["scale"], 4)
        o["yaw_deg"] = qnum(o["yaw_deg"], 3)
        if "heading_deg" in o:
            o["heading_deg"] = qnum(o["heading_deg"], 3)
        if "width_deg" in o:
            o["width_deg"] = qnum(o["width_deg"], 3)


def _hull_records(objs: list[dict]) -> list[dict]:
    rows = []
    for o in objs:
        rows.append(
            {
                "asset": o["asset"],
                "base_y_m": o["base_y_m"],
                "category": o["category"],
                "heading_deg": o["heading_deg"],
                "id": o["id"],
                "interactive": False,
                "position": o["position"],
                "radius_m": o["radius_m"],
                "scale": o["scale"],
                "width_deg": o["width_deg"],
                "yaw_deg": o["yaw_deg"],
            }
        )
    return rows


def _interior_record(o: dict) -> dict:
    return {
        "asset": o["asset"],
        "base_y_m": o["base_y_m"],
        "category": o["category"],
        "id": o["id"],
        "interactive": bool(o.get("interactive")),
        "position": o["position"],
        "radius_m": o["radius_m"],
        "scale": o["scale"],
        "yaw_deg": o["yaw_deg"],
    }


def _collider(o: dict) -> dict:
    return {
        "base_y_m": o["base_y_m"],
        "center": list(o["position"]),
        "id": o["id"],
        "object_id": o["id"],
        "radius_m": o["radius_m"],
    }


def _fog(band: dict, gates: list[dict], ring_r: float, zone: dict, perm: list[int], origin: tuple[float, float]) -> dict:
    if not band:
        band = {
            "atlas": "living/fog-atlas.png",
            "inner_m": 12.0,
            "near_fade_m": [3.0, 6.0],
            "opacity": [0.15, 0.35],
            "outer_m": 20.0,
            "patches": 28,
            "size_m": [3.0, 6.0],
        }
    count = int(band.get("patches", 28))
    inner = float(band.get("inner_m", 12))
    outer = float(band.get("outer_m", 20))
    size = band.get("size_m") or [3, 6]
    opacity = band.get("opacity") or [0.15, 0.35]
    instances = []
    guard = 0
    i = 0
    while len(instances) < count and guard < count * 8:
        guard += 1
        ang = wrap360((len(instances) + 0.5) * (360.0 / count) + fbm(i, 3, perm, 1, 1) * 8.0)
        i += 1
        if any(abs(((ang - g["heading"] + 540) % 360) - 180) <= g["half_deg"] for g in gates):
            ang = wrap360(ang + 11.0)
            if any(abs(((ang - g["heading"] + 540) % 360) - 180) <= g["half_deg"] for g in gates):
                continue
        t = 0.5 + 0.5 * fbm(i, 9, perm, 1, 1)
        t = min(1.0, max(0.0, t))
        rad = inner + (outer - inner) * t
        x, z = polar(ang, rad)
        x += origin[0]
        z += origin[1]
        y = qnum(relief_y(x, z, zone, perm), 4)
        span = float(size[1]) - float(size[0])
        op_span = float(opacity[1]) - float(opacity[0])
        op_t = min(1.0, max(0.0, 0.5 + 0.5 * fbm(i, 4, perm, 1, 1)))
        sz_t = min(1.0, max(0.0, 0.5 + 0.5 * fbm(i, 5, perm, 1, 1)))
        instances.append(
            {
                "base_y_m": y,
                "id": f"fog-{len(instances):02d}",
                "opacity": qnum(float(opacity[0]) + op_span * op_t, 4),
                "position": [qnum(x), qnum(z)],
                "size_m": qnum(float(size[0]) + span * sz_t, 4),
            }
        )
    if len(instances) < count:
        raise LayoutError(f"fog band placed {len(instances)} of {count}")
    out = dict(band)
    out["instances"] = instances
    out["patches"] = count
    return out


def hypot(x: float, z: float) -> float:
    return (x * x + z * z) ** 0.5

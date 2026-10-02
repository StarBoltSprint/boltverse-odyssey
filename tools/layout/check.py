"""Check a clearing.json against the layout rules. Data only. No framebuffer."""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from pathlib import Path

from tools.layout.geom import (
    ang_dist,
    circle_covers_heading,
    gap_runs,
    gate_half_deg,
    heading_of,
    hypot,
    in_gate_span,
    polar,
    ray_circle_t,
    segment_clearance,
    wrap360,
    circle_hits_sector,
)
from tools.layout.model import load_asset, load_json, magnification, perm_for_zone, relief_y
from tools.layout.yawband import clearing_objects, measure_yaw_band, yaw_matches, yaw_span


@dataclass
class Row:
    name: str
    ok: bool
    numbers: dict = field(default_factory=dict)
    note: str = ""

    def line(self) -> str:
        status = "PASS" if self.ok else "FAIL"
        bits = [f"{k}={_fmt(v)}" for k, v in self.numbers.items()]
        extra = " ".join(bits)
        note = f" {self.note}" if self.note else ""
        return f"{status}  {self.name}  {extra}{note}".rstrip()


def _fmt(v) -> str:
    if isinstance(v, float):
        return f"{v:.4f}"
    return str(v)


def check_clearing(
    clearing_path: Path,
    asset_roots: list[Path] | None = None,
    world: dict | None = None,
) -> tuple[list[Row], dict]:
    clearing = load_json(clearing_path)
    roots = list(asset_roots or [])
    roots.append(clearing_path.parent)
    roots.append(Path.cwd())
    rows, extra = evaluate(clearing, roots, world)
    return rows, extra


def evaluate(clearing: dict, roots: list[Path], world: dict | None = None) -> tuple[list[Row], dict]:
    if str((clearing.get("zone") or {}).get("shape") or "") == "organic" or clearing.get("schema") == "clearing/2":
        from tools.layout.organic_check import evaluate_organic

        return evaluate_organic(clearing, roots, world)
    rows: list[Row] = []
    zone = clearing.get("zone") or {}
    edge = clearing.get("edge_ring") or {}
    hulls = list(edge.get("hulls") or [])
    interiors = list(clearing.get("interior_objects") or [])
    colliders = list(clearing.get("colliders") or [])
    gates_raw = list(clearing.get("gates") or [])
    hero = clearing.get("hero") or {}
    limits = clearing.get("limits") or {}
    view = clearing.get("view") or {}
    spawn = clearing.get("spawn") or {}
    ring_r = float(edge.get("radius_m") or zone.get("radius_m") or 0.0)
    origin = zone.get("center") or [0.0, 0.0]
    ox, oz = float(origin[0]), float(origin[1])
    spawn_pos = spawn.get("position") or [ox, oz]
    sx, sz = float(spawn_pos[0]), float(spawn_pos[1])

    missing = [k for k in ("zone", "edge_ring", "gates", "hero", "limits", "view") if k not in clearing]
    view_missing = [k for k in ("width", "height", "fov_y_deg", "boom_m", "mag_max") if k not in view]
    limit_missing = [k for k in ("spawn_clearance_m", "min_gap_m", "path_width_m", "gate_cone_m", "gate_cone_half_deg", "yaw_eps_deg", "scale_eps") if k not in limits]
    hero_missing = [k for k in ("width_m", "radius_m") if k not in hero]
    rows.append(
        Row(
            "rules_present",
            not missing and not view_missing and not limit_missing and not hero_missing,
            {
                "missing": ",".join(missing + [f"view.{k}" for k in view_missing] + [f"limits.{k}" for k in limit_missing] + [f"hero.{k}" for k in hero_missing]) or "none",
            },
        )
    )

    hero_w = float(hero.get("width_m") or 0.6)
    hero_r = float(hero.get("radius_m") or 0.35)
    gates = []
    for g in gates_raw:
        gates.append(
            {
                "id": str(g.get("id")),
                "heading": float(g.get("heading_deg") or 0.0),
                "width_m": float(g.get("width_m") or 0.0),
                "half_deg": gate_half_deg(float(g.get("width_m") or 0.0), ring_r),
                "frame": g.get("frame") or "",
                "frame_ids": list(g.get("frame_ids") or []),
                "leads_to": g.get("leads_to") or "",
            }
        )

    visuals = hulls + interiors
    by_id = {}
    dup = []
    for o in visuals:
        oid = str(o.get("id"))
        if oid in by_id:
            dup.append(oid)
        by_id[oid] = o

    # --- ring closure on visuals and on ring colliders ---
    visual_circles = [_circle(h, ox, oz) for h in hulls]
    interior_ids = {str(o.get("id")) for o in interiors}
    ring_colliders = [c for c in colliders if str(c.get("object_id")) not in interior_ids]
    collider_circles = [_circle_c(c) for c in ring_colliders]
    v_miss = _misses(_around(visual_circles, ox, oz), gates)
    c_miss = _misses(_around(collider_circles, ox, oz), gates)
    v_gap = _max_gap(v_miss, ring_r)
    c_gap = _max_gap(c_miss, ring_r)
    max_gap_deg = float(edge.get("max_gap_deg", 0.0))
    gap_limit_m = hero_w
    ring_ok = v_gap[1] <= gap_limit_m + 1e-3 and c_gap[1] <= gap_limit_m + 1e-3
    if max_gap_deg <= 0.0:
        ring_ok = ring_ok and not v_miss and not c_miss
    else:
        ring_ok = ring_ok and v_gap[0] <= max_gap_deg + 1e-6 and c_gap[0] <= max_gap_deg + 1e-6
    rows.append(
        Row(
            "ring_closed",
            ring_ok,
            {
                "visual_gap_deg": v_gap[0],
                "visual_gap_m": v_gap[1],
                "visual_gap_at_deg": v_gap[2],
                "collider_gap_deg": c_gap[0],
                "collider_gap_m": c_gap[1],
                "collider_gap_at_deg": c_gap[2],
                "hero_width_m": hero_w,
                "miss_visual": len(v_miss),
                "miss_collider": len(c_miss),
            },
        )
    )

    # --- collider matches a rendered object, same footprint ---
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
    # Invisible stop: first collider hit versus first visual hit, every degree.
    worst_heading = 0.0
    worst_delta = 0.0
    worst_stop = None
    invisible = 0
    all_c = [_circle_c(c) for c in colliders]
    all_v = [_circle(o, ox, oz) for o in visuals]
    all_c_local = _around(all_c, ox, oz)
    all_v_local = _around(all_v, ox, oz)
    for deg in range(360):
        sample = deg + 0.5
        tc = _first_hit(sample, all_c_local)
        tv = _first_hit(sample, all_v_local)
        if tc is None:
            continue
        if tv is None or tv > tc + 0.5:
            invisible += 1
            delta = 999.0 if tv is None else tv - tc
            if delta > worst_delta:
                worst_delta = delta
                worst_heading = sample
                worst_stop = tc
    ring_wall = []
    if ring_r > 1.0:
        for c in colliders:
            cc = c.get("center") or [0, 0]
            if hypot(float(cc[0]) - ox, float(cc[1]) - oz) <= 0.05 and abs(float(c.get("radius_m") or 0) - ring_r) <= 0.05:
                ring_wall.append(str(c.get("id")))
    pair_ok = not collider_only and not object_only and not mismatch and not dup and invisible == 0 and not ring_wall
    note_bits = []
    if collider_only:
        note_bits.append("ids=" + ",".join(collider_only[:6]))
    if ring_wall:
        note_bits.append("ring_wall=" + ",".join(ring_wall[:4]))
    rows.append(
        Row(
            "collider_eq_visual",
            pair_ok,
            {
                "collider_only": len(collider_only),
                "object_only": len(object_only),
                "footprint_mismatch": len(mismatch),
                "duplicate_ids": len(dup),
                "invisible_stops": invisible,
                "invisible_stop_m": worst_stop if worst_stop is not None else 0.0,
                "invisible_heading_deg": worst_heading if invisible else 0.0,
                "ring_wall": len(ring_wall),
            },
            note=" ".join(note_bits),
        )
    )

    # --- gates, path, cone ---
    path_w = float(limits.get("path_width_m") or hero_w)
    cone_m = float(limits.get("gate_cone_m") or 5.0)
    cone_half = float(limits.get("gate_cone_half_deg") or 28.0)
    gate_fail = 0
    path_worst = float("inf")
    cone_hits = 0
    frame_missing = 0
    opening_blocked = 0
    narrow = 0
    for g in gates:
        if g["width_m"] + 1e-6 < max(hero_w, path_w) or not g["leads_to"]:
            narrow += 1
        frames = g["frame_ids"]
        if not g["frame"] or not frames or any(fid not in by_id for fid in frames):
            frame_missing += 1
        for c in all_c:
            if _intrudes_gate(c, g, 0.2, ox, oz):
                opening_blocked += 1
                break
        mx, mz = polar(g["heading"], ring_r)
        mx += ox
        mz += oz
        clearance, _ = segment_clearance([(c[0], c[1], c[2]) for c in all_c], sx, sz, mx, mz)
        path_worst = min(path_worst, clearance)
        for c in all_c:
            if circle_hits_sector(c[0], c[1], c[2], mx, mz, wrap360(g["heading"] + 180.0), cone_half, cone_m):
                cone_hits += 1
                break
    if not gates:
        gate_fail = 1
    path_worst_out = 0.0 if path_worst == float("inf") else path_worst
    gate_ok = gate_fail == 0 and narrow == 0 and frame_missing == 0 and opening_blocked == 0 and bool(gates)
    rows.append(
        Row(
            "gate",
            gate_ok,
            {
                "gates": len(gates),
                "frame_missing": frame_missing,
                "opening_blocked": opening_blocked,
                "narrow": narrow,
            },
        )
    )
    rows.append(
        Row(
            "path",
            bool(gates) and path_worst + 1e-6 >= path_w * 0.5,
            {"min_clearance_m": path_worst_out, "need_m": path_w * 0.5, "spawn_x": sx, "spawn_z": sz},
        )
    )
    rows.append(
        Row(
            "gate_cone",
            cone_hits == 0 and bool(gates),
            {"blocked_gates": cone_hits, "cone_m": cone_m, "half_deg": cone_half},
        )
    )

    # --- spawn clearance and separation ---
    spawn_need = float(limits.get("spawn_clearance_m") or 0.0)
    spawn_clear = _min_surface(all_c, sx, sz)
    rows.append(
        Row(
            "spawn_clearance",
            spawn_clear + 1e-6 >= spawn_need,
            {"clearance_m": spawn_clear, "need_m": spawn_need},
        )
    )
    min_gap = float(limits.get("min_gap_m") or 0.0)
    worst_gap = float("inf")
    worst_pair = ""
    overlaps = 0
    ring_ids = {str(h.get("id")) for h in hulls}
    solids = [(str(o.get("id")), float(o["position"][0]), float(o["position"][1]), float(o["radius_m"])) for o in visuals]
    for i in range(len(solids)):
        for j in range(i + 1, len(solids)):
            idi, ax, az, ar = solids[i]
            idj, bx, bz, br = solids[j]
            if idi in ring_ids and idj in ring_ids:
                continue
            gap = hypot(ax - bx, az - bz) - ar - br
            if gap < worst_gap:
                worst_gap = gap
                worst_pair = f"{idi}|{idj}"
            if gap < -0.02:
                overlaps += 1
    if worst_gap == float("inf"):
        worst_gap = 0.0
    rows.append(
        Row(
            "separation",
            overlaps == 0 and worst_gap + 0.002 >= min_gap,
            {"worst_gap_m": worst_gap, "min_gap_m": min_gap, "overlaps": overlaps, "pair": worst_pair or "none"},
        )
    )

    # --- relief ---
    perm = perm_for_zone(zone) if zone.get("ground") else []
    relief_worst = 0.0
    relief_bad = 0
    relief_id = ""
    if perm:
        for o in visuals:
            x, z = float(o["position"][0]), float(o["position"][1])
            expect = relief_y(x, z, zone, perm)
            got = float(o.get("base_y_m") if o.get("base_y_m") is not None else 999.0)
            err = abs(got - expect)
            if err > relief_worst:
                relief_worst = err
                relief_id = str(o.get("id"))
            if err > 5e-4:
                relief_bad += 1
        for inst in (clearing.get("fog_band") or {}).get("instances") or []:
            x, z = float(inst["position"][0]), float(inst["position"][1])
            expect = relief_y(x, z, zone, perm)
            got = float(inst.get("base_y_m") if inst.get("base_y_m") is not None else 999.0)
            err = abs(got - expect)
            if err > 5e-4:
                relief_bad += 1
                if err > relief_worst:
                    relief_worst = err
                    relief_id = str(inst.get("id"))
    rows.append(
        Row(
            "relief",
            bool(perm) and relief_bad == 0,
            {"worst_err_m": relief_worst, "off_surface": relief_bad, "id": relief_id or "none"},
        )
    )

    # --- magnification from source pixels ---
    mag_worst = 0.0
    mag_id = ""
    mag_closest = 0.0
    mag_fail = 0
    mag_max = float(view.get("mag_max", 1.0))
    unresolved = 0
    for o in visuals:
        try:
            asset = load_asset(str(o.get("asset")), roots)
        except (FileNotFoundError, ValueError, OSError):
            unresolved += 1
            continue
        scale = float(o.get("scale") or 1.0)
        base = float(o.get("base_y_m") or 0.0)
        info = magnification(asset, scale, view, hero_r, base)
        if info["mag"] > mag_worst:
            mag_worst = info["mag"]
            mag_id = str(o.get("id"))
            mag_closest = info["closest_m"]
        if info["mag"] > mag_max + 1e-4:
            mag_fail += 1
    rows.append(
        Row(
            "mag",
            mag_fail == 0 and unresolved == 0 and bool(visuals),
            {
                "worst": mag_worst,
                "mag_max": mag_max,
                "id": mag_id or "none",
                "closest_m": mag_closest,
                "over": mag_fail,
                "unresolved_assets": unresolved,
            },
        )
    )

    # --- variety ---
    yaw_eps = float(limits.get("yaw_eps_deg") or 8.0)
    scale_eps = float(limits.get("scale_eps") or 0.03)
    bands = clearing.get("yaw_bands") or {}
    if bands:
        identical = _identical_neighbours(hulls, interiors, yaw_eps, scale_eps, bands, roots)
    else:
        identical = _identical_neighbours(hulls, interiors, yaw_eps, scale_eps)
    spread = _spread(clearing, hulls, interiors)
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

    # --- fog and near lens ---
    fog = clearing.get("fog_band") or {}
    patches = int(fog.get("patches") or 0)
    instances = fog.get("instances") or []
    inner = float(fog.get("inner_m") or 0)
    outer = float(fog.get("outer_m") or 0)
    outside = 0
    for inst in instances:
        d = hypot(float(inst["position"][0]) - ox, float(inst["position"][1]) - oz)
        if d < inner - 0.05 or d > outer + 0.05:
            outside += 1
    rows.append(
        Row(
            "fog_band",
            patches >= 20 and len(instances) == patches and outside == 0,
            {"patches": patches, "instances": len(instances), "outside_band": outside, "inner_m": inner, "outer_m": outer},
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

    # --- budgets ---
    budgets = clearing.get("budgets") or {}
    counts: dict[str, int] = {}
    for o in visuals:
        cat = str(o.get("category") or "")
        if cat:
            counts[cat] = counts.get(cat, 0) + 1
    budget_fail = 0
    budget_note = []
    for cat, bounds in budgets.items():
        n = counts.get(cat, 0)
        lo, hi = int(bounds[0]), int(bounds[1])
        if n < lo or n > hi:
            budget_fail += 1
            budget_note.append(f"{cat}:{n}")
    rows.append(
        Row(
            "budgets",
            budget_fail == 0,
            {"categories": len(budgets), "outside": budget_fail},
            note=" ".join(budget_note),
        )
    )

    # --- playcheck's data half (width_deg rays). Not a framebuffer. ---
    pc_miss = _playcheck_rays(hulls, gates)
    rows.append(
        Row(
            "playcheck_data",
            len(pc_miss) == 0 and all("width_deg" in h for h in hulls),
            {"ray_misses": len(pc_miss), "first_miss_deg": pc_miss[0] if pc_miss else 0},
            note="data half only; rendered pixels are tools/playcheck",
        )
    )

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
        "visual_gap": {"deg": v_gap[0], "at": v_gap[2], "length_deg": v_gap[0]},
        "gates": gates,
        "ring_r": ring_r,
        "origin": [ox, oz],
        "spawn": [sx, sz],
        "hero_w": hero_w,
        "path_w": path_w,
        "cone_m": cone_m,
        "cone_half": cone_half,
    }
    return rows, extra


def _around(circles: list[tuple[float, float, float]], ox: float, oz: float) -> list[tuple[float, float, float]]:
    return [(cx - ox, cz - oz, r) for cx, cz, r in circles]


def _circle(obj: dict, ox: float, oz: float) -> tuple[float, float, float]:
    pos = obj.get("position") or [ox, oz]
    return float(pos[0]), float(pos[1]), float(obj.get("radius_m") or 0.0)


def _circle_c(c: dict) -> tuple[float, float, float]:
    pos = c.get("center") or [0, 0]
    return float(pos[0]), float(pos[1]), float(c.get("radius_m") or 0.0)


def _misses(circles: list[tuple[float, float, float]], gates: list[dict]) -> list[float]:
    misses = []
    gate_lite = [{"heading": g["heading"], "half_deg": g["half_deg"]} for g in gates]
    for deg in range(360):
        sample = deg + 0.5
        if in_gate_span(sample, gate_lite, 0.05) or in_gate_span(float(deg), gate_lite, 0.05):
            continue
        if not any(circle_covers_heading(sample, cx, cz, r) for cx, cz, r in circles):
            misses.append(sample)
    return misses


def _max_gap(misses: list[float], ring_r: float) -> tuple[float, float, float]:
    runs = gap_runs(misses)
    if not runs:
        return 0.0, 0.0, 0.0
    start, length = max(runs, key=lambda r: r[1])
    arc_m = ring_r * (length * 3.141592653589793 / 180.0)
    return length, arc_m, start


def _first_hit(heading: float, circles: list[tuple[float, float, float]]) -> float | None:
    best = None
    for cx, cz, r in circles:
        t = ray_circle_t(heading, cx, cz, r)
        if t is None:
            continue
        if best is None or t < best:
            best = t
    return best


def _intrudes_gate(circle: tuple[float, float, float], gate: dict, tol_deg: float, ox: float, oz: float) -> bool:
    cx, cz, r = circle
    dx, dz = cx - ox, cz - oz
    dist = hypot(dx, dz)
    if dist <= 1e-6:
        return True
    half = 180.0 if r >= dist else math.degrees(math.asin(min(1.0, r / dist)))
    return ang_dist(heading_of(dx, dz), gate["heading"]) + tol_deg < half + gate["half_deg"]


def _min_surface(circles: list[tuple[float, float, float]], x: float, z: float) -> float:
    if not circles:
        return float("inf")
    return min(hypot(cx - x, cz - z) - r for cx, cz, r in circles)


def _identical_neighbours(
    hulls: list[dict],
    interiors: list[dict],
    yaw_eps: float,
    scale_eps: float,
    bands: dict | None = None,
    roots: list[Path] | None = None,
) -> int:
    bad = 0
    cache: dict = {}
    ordered = sorted(hulls, key=lambda h: float(h.get("heading_deg") or 0.0))
    for i, a in enumerate(ordered):
        b = ordered[(i + 1) % len(ordered)] if ordered else None
        if b is None:
            break
        # Do not pair across a gate-sized hole. A normal step is well under 25°.
        gap = ang_dist(float(a.get("heading_deg") or 0), float(b.get("heading_deg") or 0))
        gap -= float(a.get("width_deg") or 0) * 0.5
        gap -= float(b.get("width_deg") or 0) * 0.5
        if gap > 1.0:
            continue
        if _same(a, b, yaw_eps, scale_eps, bands, roots, cache):
            bad += 1
    by_cat: dict[str, list[dict]] = {}
    for o in interiors:
        by_cat.setdefault(str(o.get("category") or ""), []).append(o)
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


def _same(
    a: dict,
    b: dict,
    yaw_eps: float,
    scale_eps: float,
    bands: dict | None = None,
    roots: list[Path] | None = None,
    cache: dict | None = None,
) -> bool:
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


def _spread(clearing: dict, hulls: list[dict], interiors: list[dict]) -> int:
    """0 when variants are even. Positive is the worst max-min excess. -1 if a listed variant set is empty of objects while count allows repeats."""
    variants = clearing.get("variants") or {}
    objects = hulls + interiors
    worst = 0
    for cat, paths in variants.items():
        members = [o for o in objects if str(o.get("category")) == cat]
        if not members or not paths:
            continue
        counts = {p: 0 for p in paths}
        for o in members:
            asset = str(o.get("asset"))
            if asset in counts:
                counts[asset] += 1
        used = list(counts.values())
        if not used:
            continue
        # Objects whose asset is outside the declared set still count as clumping.
        extra = sum(1 for o in members if str(o.get("asset")) not in counts)
        if extra:
            worst = max(worst, extra)
        if len(members) >= len(paths):
            if min(used) == 0:
                worst = max(worst, 1 + max(used) - min(used))
            else:
                worst = max(worst, max(used) - min(used) - 1 if max(used) - min(used) > 1 else 0)
        else:
            if max(used) > 1:
                worst = max(worst, max(used) - 1)
    return worst


def _playcheck_rays(hulls: list[dict], gates: list[dict]) -> list[int]:
    """Same 1° test as tools/playcheck/src/layout.mjs ringRays, data half."""
    misses = []
    lite = [{"heading": g["heading"], "half_deg": g["half_deg"]} for g in gates]
    for deg in range(360):
        if in_gate_span(deg + 0.5, lite, 0.05) or in_gate_span(float(deg), lite, 0.05):
            continue
        covered = False
        for h in hulls:
            width = h.get("width_deg")
            if width is None:
                continue
            if ang_dist(deg + 0.5, float(h.get("heading_deg") or 0.0)) <= float(width) / 2.0 + 0.05:
                covered = True
                break
        if not covered:
            misses.append(deg)
    return misses


def render_report(rows: list[Row], clearing_id: str) -> str:
    fails = [r for r in rows if not r.ok]
    lines = [f"# layout check {clearing_id}", "", "| row | status | numbers |", "| --- | --- | --- |"]
    for r in rows:
        nums = ", ".join(f"{k}={_fmt(v)}" for k, v in r.numbers.items())
        if r.note:
            nums = (nums + " — " + r.note).strip(" —")
        lines.append(f"| {r.name} | {'PASS' if r.ok else 'FAIL'} | {nums} |")
    lines.append("")
    if fails:
        lines.append(f"FAIL {len(fails)} rows")
    else:
        lines.append(f"PASS {len(rows)} rows")
    lines.append("")
    lines.append(
        "This report is the layout file only. It does not read a framebuffer. "
        "A PASS here does not open a play URL."
    )
    lines.append("")
    return "\n".join(lines)


def rows_json(rows: list[Row]) -> list[dict]:
    return [
        {"name": r.name, "status": "PASS" if r.ok else "FAIL", "numbers": r.numbers, "note": r.note}
        for r in rows
    ]

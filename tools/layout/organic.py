"""Organic zone placement. Invisible shape only. Circle mode does not call this module.

Thresholds used by the checker live in organic_check.py and cite
owner decision 2026-10-02, spec rail 10.
"""

from __future__ import annotations

import copy
import math
from pathlib import Path

from tools.layout.footprint import (
    bend_for_turn,
    centroid,
    convex_hull,
    ensure_ccw,
    grow_footprint,
    long_axis,
    nearest_on_ring,
    passage_line,
    point_at,
    point_in_poly,
    polygon_area,
    polyline_samples,
    ring_lengths,
    span_contains,
)
from tools.layout.generate import (
    LayoutError,
    _load_spec_asset,
    _quantize,
    _scale_pair,
    _stamp_library,
)
from tools.layout.geom import (
    ang_dist,
    circle_hits_sector,
    dist_point_segment,
    heading_of,
    hypot,
    polar,
    segment_clearance,
)
from tools.layout.model import max_legal_scale, qnum
from tools.layout.yawband import apply_yaw_bands, collect_bands
from tools.layout.noise import fbm, permutation, simplex2

_PERMS: dict[int, list[int]] = {}
_YAW_CYCLE = [-30.0, -15.0, 0.0, 15.0, 30.0]
_SCALE_BUMPS = [0.0, 0.06, 0.12]


def relief_at(x: float, z: float, zone: dict) -> float:
    """Organic relief. One simplex octave over `wavelength_m`. Circle relief_y is not used."""
    rel = ((zone.get("ground") or {}).get("relief") or {})
    amp = float(rel.get("amp_m") or 0.0)
    wave = float(rel.get("wavelength_m") or 0.0)
    if wave <= 1e-6:
        return 0.0
    seed = int(rel.get("seed", 1))
    perm = _PERMS.get(seed)
    if perm is None:
        perm = permutation(seed)
        _PERMS[seed] = perm
    octaves = int(rel.get("octaves") or 1)
    if octaves <= 1:
        n = simplex2(x / wave, z / wave, perm)
    else:
        n = fbm(x, z, perm, octaves, 1.0 / wave)
    if n > 1.0:
        n = 1.0
    elif n < -1.0:
        n = -1.0
    return amp * n


def _reject_inward_yaw(spec: dict) -> None:
    """yaw_ref inward is banned in every block. Spec rail 8.

    Director decision 2026-10-02 15:04 (delegated owner approval).
    """
    blocks = []
    boundary = spec.get("boundary")
    if isinstance(boundary, dict):
        blocks.append(boundary)
    for cat in (spec.get("categories") or {}).values():
        if isinstance(cat, dict):
            blocks.append(cat)
    scatter = (spec.get("scatter") or {}).get("categories") or {}
    if isinstance(scatter, dict):
        for cat in scatter.values():
            if isinstance(cat, dict):
                blocks.append(cat)
    for key in ("pois", "far_plates"):
        for item in spec.get(key) or []:
            if isinstance(item, dict):
                blocks.append(item)
    for block in blocks:
        if str(block.get("yaw_ref") or "").strip().lower() == "inward":
            raise LayoutError(
                "yaw_ref inward is banned. Boundary and exit pieces use world yaw +-15 deg. "
                "Director decision 2026-10-02 15:04 (delegated owner approval). Spec rail 8."
            )


def _world_yaw_defaults(spec: dict, bands: dict) -> dict:
    """Boundary and exit without yaw_band_deg use world [-15, 15]. Organic only."""
    out = dict(bands)
    boundary = spec.get("boundary") if isinstance(spec.get("boundary"), dict) else {}
    if "boundary" not in out and "yaw_band_deg" not in boundary:
        out["boundary"] = {"hi": qnum(15.0, 4), "lo": qnum(-15.0, 4), "ref": "world"}
    exit_block = (spec.get("categories") or {}).get("exit")
    if not isinstance(exit_block, dict):
        exit_block = {}
    if "exit" not in out and "yaw_band_deg" not in exit_block:
        out["exit"] = {"hi": qnum(15.0, 4), "lo": qnum(-15.0, 4), "ref": "world"}
    return out


def build_organic(spec: dict, roots: list[Path]) -> dict:
    _reject_inward_yaw(spec)
    zone_in = spec.get("zone") or {}
    if str(zone_in.get("shape") or "") != "organic":
        raise LayoutError("organic generate requires zone.shape organic")
    gen = zone_in.get("generator") or {}
    sub_in = list(zone_in.get("sub_areas") or gen.get("sub_areas") or [])
    pass_in = list(zone_in.get("passages") or gen.get("passages") or [])
    if len(sub_in) < 1:
        raise LayoutError("organic zone needs sub_areas")
    boundary = spec.get("boundary") or {}
    boundary_paths = list(boundary.get("assets") or [])
    if not boundary_paths:
        raise LayoutError("organic zone needs boundary.assets")
    categories = spec.get("categories") or {}
    assets = {
        key: [_load_spec_asset(entry, roots) for entry in cat["assets"]]
        for key, cat in categories.items()
        if cat.get("assets")
    }
    boundary_assets = [_load_spec_asset(entry, roots) for entry in boundary_paths]
    if not boundary_assets:
        raise LayoutError("boundary assets did not load")
    gates_in = list(spec.get("gates") or [])
    if not gates_in:
        raise LayoutError("a zone needs at least one gate")

    hero = spec["hero"]
    hero_w = float(hero["width_m"])
    hero_r = float(hero["radius_m"])
    view = copy.deepcopy(spec["view"])
    limits = copy.deepcopy(spec["limits"])
    spawn = spec.get("spawn") or {"position": [0, 0]}
    spawn_x, spawn_z = float(spawn["position"][0]), float(spawn["position"][1])
    seed = int(spec.get("seed", 1))
    reference = float(zone_in.get("reference_area_m2") or 0.0)
    path_w = float(limits["path_width_m"])
    need_chord = hero_w + path_w

    subs = []
    for area in sub_in:
        c = area["center"]
        subs.append(
            {
                "id": str(area["id"]),
                "center": (float(c[0]), float(c[1])),
                "radius_m": float(area["radius_m"]),
                "role": str(area.get("role") or ""),
            }
        )
    by_id = {s["id"]: s for s in subs}

    scale_lo, scale_hi = _scale_pair(boundary, boundary_assets)
    legal = []
    for asset in boundary_assets:
        cap = max_legal_scale(asset, view, hero_r, scale_lo, scale_hi)
        if cap + 1e-4 < scale_lo:
            raise LayoutError(f"{asset.path} exceeds magnification at its minimum scale")
        legal.append(cap)
    scale_hi = min([scale_hi] + legal)
    piece_pad = scale_hi * max(a.radius_m for a in boundary_assets)

    explicit = zone_in.get("footprint")
    # An explicit polygon wins when both a footprint and a generator are present.
    use_explicit = isinstance(explicit, list) and len(explicit) >= 3
    lines: list[list[tuple[float, float]]] = []
    if use_explicit:
        poly = ensure_ccw([(float(p[0]), float(p[1])) for p in explicit])
        lines = _passage_lines(pass_in, by_id, seed, 36.0)
    else:
        if not gen.get("sub_areas") and not zone_in.get("sub_areas"):
            raise LayoutError("organic zone needs a footprint or a generator")
        poly, lines = _grow(subs, pass_in, by_id, seed, piece_pad, float(gen.get("max_convexity") or 0.85))

    poly = [(qnum(x), qnum(z)) for x, z in poly]
    poly = ensure_ccw(poly)
    if abs(polygon_area(poly)) <= 1.0:
        raise LayoutError("footprint area collapsed")
    total, segs = ring_lengths(poly)
    center_in = zone_in.get("center")
    if center_in and len(center_in) >= 2:
        center = (float(center_in[0]), float(center_in[1]))
    else:
        center = centroid(poly)

    ground = copy.deepcopy(zone_in.get("ground") or {})
    zone = {
        "center": [qnum(center[0]), qnum(center[1])],
        "footprint": [[p[0], p[1]] for p in poly],
        "ground": ground,
        "reference_area_m2": qnum(reference, 4),
        "shape": "organic",
    }

    min_r = min(a.radius_m for a in boundary_assets) * scale_lo
    spacing = max(0.4, 1.42 * min_r)
    max_piece_r = max(a.radius_m for a in boundary_assets) * scale_hi
    gates = _resolve_gates(gates_in, poly, segs, total, max_piece_r, need_chord, assets, categories, view, hero_r)

    pieces = _place_boundary(
        poly, segs, total, gates, boundary_assets, scale_lo, scale_hi, spacing, int(boundary.get("rows") or 2)
    )
    exits = _place_exits(poly, segs, total, gates, assets, categories, view, hero_r)
    pieces.extend(exits)
    # A passage loop fills its interior, so one side of a throat has no footprint
    # edge. Pieces on that side keep the clear width equal to the passage width.
    pieces.extend(
        _place_passage_walls(
            lines, pass_in, subs, poly, pieces, boundary_assets, scale_lo, scale_hi, spacing, piece_pad
        )
    )
    _name_boundary(pieces)
    _uncouple(pieces, total, limits)

    solids = list(pieces)
    interiors = _place_interiors(
        spec, categories, assets, subs, lines, pass_in, poly, gates, solids,
        spawn_x, spawn_z, hero_r, view, limits, seed, zone,
    )

    for group in (pieces, interiors):
        for obj in group:
            _finish(obj, zone)

    far_plates: list[dict] = []
    pois: list[dict] = []
    cells: list[dict] = []
    always: list[str] = []
    extra_variants: dict[str, list[str]] = {}
    # Scatter, discovery, far plates, and cells are additive. A spec without
    # those keys keeps the L0a bytes.
    if any(spec.get(key) for key in ("scatter", "pois", "far_plates", "cells")):
        from tools.layout.scatter import apply_scatter

        added, far_plates, pois, cells, always, extra_variants = apply_scatter(
            spec, roots, zone, poly, subs, lines, pass_in, gates,
            pieces, interiors, spawn_x, spawn_z, hero_r, view, limits, seed,
        )
        interiors.extend(added)

    # Absent yaw_band_deg on boundary and exit: world +-15 (spec rail 8).
    # Director decision 2026-10-02 15:04 (delegated owner approval).
    # Other categories stay untouched when the key is absent.
    bands = _world_yaw_defaults(spec, collect_bands(spec))
    if bands:
        apply_yaw_bands(
            pieces + interiors + far_plates,
            bands,
            float(limits.get("yaw_eps_deg") or 8.0),
            float(limits.get("scale_eps") or 0.03),
            roots,
            total,
        )
        by_id = {str(obj.get("id")): obj for obj in pieces + interiors + far_plates}
        for poi in pois:
            src = by_id.get(str(poi.get("id")))
            if src is not None and src is not poi:
                poi["yaw_deg"] = src["yaw_deg"]

    fog = _fog(spec.get("fog_band") or {}, poly, segs, total, gates, zone, seed)
    colliders = [_collider(o) for o in pieces + interiors]
    gate_records = []
    for g in gates:
        frames = [e["id"] for e in exits if e.get("gate_id") == g["id"]]
        gate_records.append(
            {
                "at_m": qnum(g["at_m"], 4),
                "field": g["field"],
                "frame": g["frame"],
                "frame_ids": frames,
                "heading_deg": qnum(g["heading"], 3),
                "id": g["id"],
                "leads_to": g["leads_to"],
                "position": [qnum(g["x"]), qnum(g["z"])],
                "span_m": qnum(g["span_m"], 4),
                "width_m": qnum(g["width_m"], 3),
            }
        )

    sub_records = [
        {
            "center": [qnum(s["center"][0]), qnum(s["center"][1])],
            "id": s["id"],
            "radius_m": qnum(s["radius_m"], 4),
            "role": s["role"],
        }
        for s in subs
    ]
    passage_records = []
    for i, (passage, line) in enumerate(zip(pass_in, lines)):
        passage_records.append(
            {
                "center": [[qnum(x), qnum(z)] for x, z in line],
                "from": str(passage["from"]),
                "id": f"passage-{i:02d}",
                "to": str(passage["to"]),
                "width_m": qnum(float(passage["width_m"]), 4),
            }
        )

    face = spawn.get("face")
    if not face and gates:
        face = f"gate:{gates[0]['id']}"
    variants = {key: [asset.path for asset in group] for key, group in assets.items()}
    for key, paths in extra_variants.items():
        have = list(variants.get(key) or [])
        for path in paths:
            if path not in have:
                have.append(path)
        variants[key] = have
    clearing = {
        "backdrop": copy.deepcopy(spec.get("backdrop") or {}),
        "bolt": copy.deepcopy(
            spec.get("bolt")
            or {"gallop": "lock/bolt-gallop-cycle.mp4", "idle": "lock/bolt-idle-breath.mp4"}
        ),
        "boundary": {"pieces": [_piece_record(o) for o in pieces], "rows": int(boundary.get("rows") or 2)},
        "budgets": copy.deepcopy(spec.get("budgets") or {}),
        "colliders": colliders,
        "fog_band": fog,
        "gates": gate_records,
        "hero": {"radius_m": qnum(hero_r, 4), "width_m": qnum(hero_w, 4)},
        "id": spec.get("id") or "zone",
        "interior_objects": [_interior_record(o) for o in interiors],
        "limits": limits,
        "near_lens": copy.deepcopy(spec.get("near_lens") or {"cull_m": 1.2, "fade_m": [1.2, 2.5]}),
        "passages": passage_records,
        "schema": "clearing/2",
        "seed": seed,
        "spawn": {"face": face, "position": [qnum(spawn_x), qnum(spawn_z)]},
        "sub_areas": sub_records,
        "variants": variants,
        "view": view,
        "zone": zone,
    }
    if bands:
        clearing["yaw_bands"] = bands
    if spec.get("note"):
        clearing["note"] = spec["note"]
    if any(spec.get(key) for key in ("scatter", "pois", "far_plates", "cells")):
        clearing["always"] = always
        clearing["cells"] = cells
        clearing["far_plates"] = [_public_record(o) for o in far_plates]
        clearing["pois"] = [_public_record(o) for o in pois]
    if isinstance(spec.get("streaming"), dict):
        from tools.layout.streaming import attach_streaming

        clearing["streaming"] = attach_streaming(clearing.get("cells"), spec["streaming"])
    return clearing


def _passage_lines(pass_in: list[dict], by_id: dict, seed: int, turn: float) -> list[list[tuple[float, float]]]:
    lines = []
    for i, passage in enumerate(pass_in):
        a = by_id[str(passage["from"])]["center"]
        b = by_id[str(passage["to"])]["center"]
        length = hypot(b[0] - a[0], b[1] - a[1])
        sign = 1.0 if ((i + seed) % 2) == 0 else -1.0
        lines.append(passage_line(a, b, bend_for_turn(length, turn) * sign))
    return lines


def _grow(subs, pass_in, by_id, seed, piece_pad, cap):
    best = None
    turn = 36.0
    last = "footprint did not close"
    for _attempt in range(6):
        if turn < 24.0:
            break
        lines = _passage_lines(pass_in, by_id, seed, turn)
        try:
            poly = grow_footprint(subs, pass_in, lines, piece_pad, 0.5)
        except RuntimeError as exc:
            last = str(exc)
            turn -= 5.0
            continue
        hull = convex_hull(poly)
        hull_area = abs(polygon_area(hull))
        conv = abs(polygon_area(poly)) / hull_area if hull_area > 1e-6 else 1.0
        axis = long_axis(poly)
        if best is None or conv < best[0]:
            best = (conv, poly, lines)
        if conv <= cap + 1e-6 and axis >= 80.0:
            return poly, lines
        turn = min(62.0, turn + 6.0)
    if best is None:
        raise LayoutError(last)
    return best[1], best[2]


def _resolve_gates(gates_in, poly, segs, total, max_piece_r, need_chord, assets, categories, view, hero_r):
    gates = []
    for g in gates_in:
        width = float(g["width_m"])
        if width + 1e-6 < need_chord:
            raise LayoutError(f"gate {g.get('id')} chord is under hero width plus path width")
        if "at_m" in g:
            at = float(g["at_m"]) % total
            x, z, nx, nz = point_at(poly, segs, total, at)
        else:
            target = g.get("target") or g.get("position")
            if not target:
                raise LayoutError(f"gate {g.get('id')} needs at_m or a target point")
            at, _dist, x, z, nx, nz = nearest_on_ring(poly, float(target[0]), float(target[1]))
        heading = heading_of(nx, nz)
        half = _half_for_chord(poly, segs, total, at, width)
        # Pull piece centres past the chord so their circles leave the opening clear.
        extra = max_piece_r + 0.35
        span = min(total * 0.45, 2.0 * half + 2.0 * extra)
        frame = g.get("frame_asset") or ""
        if not frame and categories.get("exit", {}).get("assets"):
            frame = categories["exit"]["assets"][0]
            if isinstance(frame, dict):
                frame = ""
        gates.append(
            {
                "id": str(g["id"]),
                "at_m": at,
                "half_m": half,
                "span_m": span,
                "width_m": width,
                "x": x,
                "z": z,
                "nx": nx,
                "nz": nz,
                "heading": heading,
                "field": g.get("field") or "",
                "frame": str(frame),
                "leads_to": g.get("leads_to") or "",
                "frame_asset": g.get("frame_asset"),
            }
        )
    return gates


def _half_for_chord(poly, segs, total, at, chord):
    lo = 0.0
    hi = min(total * 0.4, max(chord, 1.0))
    for _ in range(12):
        ax, az, _nx, _nz = point_at(poly, segs, total, at - hi)
        bx, bz, _nx2, _nz2 = point_at(poly, segs, total, at + hi)
        if hypot(ax - bx, az - bz) >= chord:
            break
        hi = min(total * 0.45, hi * 1.25 + 0.5)
    for _ in range(28):
        mid = 0.5 * (lo + hi)
        ax, az, _nx, _nz = point_at(poly, segs, total, at - mid)
        bx, bz, _nx2, _nz2 = point_at(poly, segs, total, at + mid)
        if hypot(ax - bx, az - bz) >= chord:
            hi = mid
        else:
            lo = mid
    return hi


def _in_spans(s, gates, total) -> bool:
    for g in gates:
        start = (g["at_m"] - g["span_m"] * 0.5) % total
        if span_contains(s % total, start, g["span_m"], total):
            return True
    return False


def _place_boundary(poly, segs, total, gates, assets, scale_lo, scale_hi, spacing, rows):
    rows = min(3, max(1, int(rows)))
    s_values = []
    s = 0.0
    guard = 0
    while s < total - 1e-6 and guard < 20000:
        guard += 1
        if not _in_spans(s, gates, total):
            s_values.append(s)
        s += spacing
    for g in gates:
        start = (g["at_m"] - g["span_m"] * 0.5) % total
        end = (start + g["span_m"]) % total
        for edge in (start, end):
            # Just outside the opening, so the run covers up to the gate.
            outside = (edge - 0.2) % total if edge == end else (edge + 0.2) % total
            if edge == start:
                outside = (edge - 0.2) % total
            else:
                outside = (edge + 0.2) % total
            if _in_spans(outside, gates, total):
                continue
            if any(min((outside - prev) % total, (prev - outside) % total) < 0.35 for prev in s_values):
                continue
            s_values.append(outside)
    s_values.sort()
    pieces = []
    cursor = 0
    for row in range(rows):
        offset = row * spacing * 0.85
        for s in s_values:
            x, z, nx, nz = point_at(poly, segs, total, s)
            x += nx * offset
            z += nz * offset
            asset = assets[cursor % len(assets)]
            cursor += 1
            bump = _SCALE_BUMPS[(cursor + row) % len(_SCALE_BUMPS)]
            scale = min(scale_hi, max(scale_lo, scale_lo + bump))
            radius = asset.radius_m * scale
            outward = heading_of(nx, nz)
            yaw = _quantize(outward + 180.0 + _YAW_CYCLE[(cursor + row) % len(_YAW_CYCLE)], asset.yaw_step)
            piece = {
                "asset": asset.path,
                "asset_obj": asset,
                "base_y_m": 0.0,
                "category": "boundary",
                "heading_deg": outward,
                "interactive": False,
                "position": [x, z],
                "radius_m": radius,
                "row": row,
                "s_m": s,
                "scale": scale,
                "yaw_deg": yaw,
            }
            _stamp_library(piece, asset)
            pieces.append(piece)
    return pieces


def _place_exits(poly, segs, total, gates, assets, categories, view, hero_r):
    exit_cat = categories.get("exit") or {}
    exit_assets = assets.get("exit") or []
    if not exit_assets:
        return []
    scale_lo, scale_hi = _scale_pair(exit_cat, exit_assets)
    made = []
    for g in gates:
        asset = exit_assets[0]
        cap = max_legal_scale(asset, view, hero_r, scale_lo, scale_hi)
        scale = min(scale_hi, max(scale_lo, scale_lo + 0.06), cap)
        radius = asset.radius_m * scale
        start = (g["at_m"] - g["span_m"] * 0.5) % total
        end = (start + g["span_m"]) % total
        for side, edge in (("a", start), ("b", end)):
            x, z, nx, nz = point_at(poly, segs, total, edge)
            # Sit just outside the chord so the circle does not close the opening.
            x = x + nx * (radius + 0.15)
            z = z + nz * (radius + 0.15)
            outward = heading_of(nx, nz)
            yaw = _quantize(outward + 180.0 + (15.0 if side == "b" else -15.0), asset.yaw_step)
            piece = {
                "asset": asset.path,
                "asset_obj": asset,
                "base_y_m": 0.0,
                "category": "exit",
                "gate_id": g["id"],
                "gate_side": side,
                "heading_deg": outward,
                "id": f"exit-{g['id']}-{side}",
                "interactive": False,
                "position": [x, z],
                "radius_m": radius,
                "row": 0,
                "s_m": edge,
                "scale": scale,
                "yaw_deg": yaw,
            }
            _stamp_library(piece, asset)
            made.append(piece)
    return made


def _place_passage_walls(lines, pass_in, subs, poly, existing, assets, scale_lo, scale_hi, spacing, piece_pad):
    """Boundary pieces on the open side of each passage throat."""
    made = []
    cursor = 0
    held = list(existing)
    for passage, line in zip(pass_in, lines):
        if len(line) < 2 or not assets:
            continue
        width = float(passage["width_m"])
        samples = polyline_samples([(float(x), float(z)) for x, z in line], max(0.4, spacing))
        # The width row also casts along the chord normal at each bend. Close that corner.
        for i in range(1, len(line) - 1):
            ax, az = float(line[0][0]), float(line[0][1])
            bx, bz = float(line[-1][0]), float(line[-1][1])
            dx, dz = bx - ax, bz - az
            norm = hypot(dx, dz) or 1.0
            samples.append((float(line[i][0]), float(line[i][1]), -dz / norm, dx / norm))
        for x, z, nx, nz in samples:
            if not _outside_disks(x, z, subs, 1.0):
                continue
            for sign in (1.0, -1.0):
                dist = width * 0.5 + piece_pad
                px = x + nx * dist * sign
                pz = z + nz * dist * sign
                if not _outside_disks(px, pz, subs, 0.4):
                    continue
                if not point_in_poly(px, pz, poly):
                    continue
                if _near_piece(px, pz, held, piece_pad + 0.45):
                    continue
                if _near_piece(px, pz, made, spacing * 0.8):
                    continue
                asset = assets[cursor % len(assets)]
                cursor += 1
                bump = _SCALE_BUMPS[cursor % len(_SCALE_BUMPS)]
                scale = min(scale_hi, max(scale_lo, scale_lo + bump))
                radius = asset.radius_m * scale
                outward = heading_of(nx * sign, nz * sign)
                yaw = _quantize(outward + 180.0 + _YAW_CYCLE[cursor % len(_YAW_CYCLE)], asset.yaw_step)
                s_m, _dist, _sx, _sz, _nnx, _nnz = nearest_on_ring(poly, px, pz)
                piece = {
                    "asset": asset.path,
                    "asset_obj": asset,
                    "base_y_m": 0.0,
                    "category": "boundary",
                    "heading_deg": outward,
                    "interactive": False,
                    "position": [px, pz],
                    "radius_m": radius,
                    "row": 2,
                    "s_m": s_m,
                    "scale": scale,
                    "yaw_deg": yaw,
                }
                _stamp_library(piece, asset)
                made.append(piece)
    return made


def _near_piece(x: float, z: float, pieces: list[dict], limit: float) -> bool:
    for piece in pieces:
        pos = piece.get("position") or [0, 0]
        if hypot(x - float(pos[0]), z - float(pos[1])) <= limit:
            return True
    return False


def _name_boundary(pieces: list[dict]) -> None:
    ordered = [p for p in pieces if p.get("category") != "exit"]
    ordered.sort(key=lambda p: (float(p["s_m"]), int(p.get("row") or 0), float(p["position"][0])))
    for i, piece in enumerate(ordered):
        piece["id"] = f"b-{i:04d}"
        piece["category"] = "boundary"


def _same(a: dict, b: dict, yaw_eps: float, scale_eps: float) -> bool:
    if str(a.get("asset")) != str(b.get("asset")):
        return False
    if ang_dist(float(a.get("yaw_deg") or 0), float(b.get("yaw_deg") or 0)) <= yaw_eps:
        if abs(float(a.get("scale") or 1) - float(b.get("scale") or 1)) <= scale_eps:
            return True
    return False


def _uncouple(pieces: list[dict], total: float, limits: dict) -> None:
    yaw_eps = float(limits.get("yaw_eps_deg") or 8.0)
    scale_eps = float(limits.get("scale_eps") or 0.03)
    for _ in range(3):
        ordered = sorted(pieces, key=lambda p: (float(p["s_m"]), str(p.get("id"))))
        n = len(ordered)
        changed = False
        for i in range(n):
            a = ordered[i]
            b = ordered[(i + 1) % n]
            forward = (float(b["s_m"]) - float(a["s_m"])) % total
            if forward > 3.0:
                continue
            if _same(a, b, yaw_eps, scale_eps):
                step = float(b["asset_obj"].yaw_step) if b.get("asset_obj") is not None else 15.0
                b["yaw_deg"] = _quantize(float(b["yaw_deg"]) + step, step)
                changed = True
        if not changed:
            break


def _place_interiors(
    spec, categories, assets, subs, lines, pass_in, poly, gates, solids,
    spawn_x, spawn_z, hero_r, view, limits, seed, zone,
):
    made = []
    clearance = float(limits["spawn_clearance_m"])
    min_gap = float(limits["min_gap_m"])
    path_r = float(limits["path_width_m"]) * 0.5
    cone_m = float(limits["gate_cone_m"])
    cone_half = float(limits["gate_cone_half_deg"])
    order = [k for k in ("hero", "mid", "near") if k in categories and int(categories[k].get("count") or 0) > 0]
    rng = _lcg(seed + 17)
    scale_bumps = [0.0, 0.05, 0.1, -0.04]
    yaw_steps = [40.0, 130.0, 220.0, 310.0, 70.0, 190.0]
    for cat_name in order:
        cat = categories[cat_name]
        group = assets[cat_name]
        count = int(cat["count"])
        band = cat.get("band_m") or [4.0, 12.0]
        scale_lo, scale_hi_spec = _scale_pair(cat, group)
        for i in range(count):
            asset = group[i % len(group)]
            s_cap = max_legal_scale(asset, view, hero_r, scale_lo, scale_hi_spec)
            if s_cap + 1e-4 < scale_lo:
                raise LayoutError(f"{asset.path} exceeds magnification at the bottom of its scale range")
            placed = False
            for attempt in range(360):
                bump = scale_bumps[(i + attempt) % len(scale_bumps)]
                scale = min(s_cap, max(scale_lo, (scale_lo + min(scale_hi_spec, s_cap)) * 0.5 + bump))
                radius = asset.radius_m * scale
                host = subs[(i + attempt // 5) % len(subs)]
                ang = (next(rng) * 360.0 + i * 47.0) % 360.0
                lo = max(float(band[0]), clearance + radius + 0.2)
                hi = max(float(band[1]), lo + 1.0)
                if host["id"] != subs[0]["id"]:
                    lo = radius + 1.5
                    hi = max(lo + 1.0, host["radius_m"] - radius - 1.0)
                rad = lo + (hi - lo) * next(rng)
                hx, hz = host["center"]
                x, z = polar(ang, rad)
                x += hx
                z += hz
                yaw = _quantize(yaw_steps[(i + attempt) % len(yaw_steps)] + ang * 0.15, asset.yaw_step)
                if not _fits_interior(
                    x, z, radius, poly, spawn_x, spawn_z, clearance, min_gap, path_r,
                    cone_m, cone_half, gates, solids + made, lines, pass_in, subs,
                ):
                    continue
                obj = {
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
                _stamp_library(obj, asset)
                made.append(obj)
                placed = True
                break
            if not placed:
                raise LayoutError(f"could not place {cat_name}-{i:02d} inside the footprint")
    return made


def _fits_interior(
    x, z, radius, poly, spawn_x, spawn_z, clearance, min_gap, path_r,
    cone_m, cone_half, gates, others, lines, pass_in, subs,
) -> bool:
    if not point_in_poly(x, z, poly):
        return False
    # Stay off the boundary run.
    _s, dist, _px, _pz, _nx, _nz = nearest_on_ring(poly, x, z)
    if dist < radius + 1.4:
        return False
    if hypot(x - spawn_x, z - spawn_z) < radius + clearance:
        return False
    for o in others:
        ox, oz = o["position"]
        if hypot(x - ox, z - oz) < radius + float(o["radius_m"]) + min_gap:
            return False
    for line, passage in zip(lines, pass_in):
        half = float(passage["width_m"]) * 0.5 + radius + min_gap
        if _dist_line(x, z, line) < half and _outside_disks(x, z, subs, 0.0):
            return False
    for g in gates:
        clearance_m, _which = segment_clearance([(x, z, radius)], spawn_x, spawn_z, g["x"], g["z"])
        if clearance_m < path_r:
            return False
        inward = (g["heading"] + 180.0) % 360.0
        if circle_hits_sector(x, z, radius, g["x"], g["z"], inward, cone_half, cone_m):
            return False
    return True


def _outside_disks(x, z, subs, margin) -> bool:
    for area in subs:
        cx, cz = area["center"]
        if hypot(x - cx, z - cz) <= float(area["radius_m"]) + margin:
            return False
    return True


def _dist_line(x, z, line) -> float:
    best = float("inf")
    for i in range(len(line) - 1):
        d = dist_point_segment(x, z, line[i][0], line[i][1], line[i + 1][0], line[i + 1][1])
        if d < best:
            best = d
    return best


def _lcg(seed: int):
    s = (int(seed) & 0xFFFFFFFF) or 1
    while True:
        s = (1664525 * s + 1013904223) & 0xFFFFFFFF
        yield s / 4294967296.0


def _finish(obj: dict, zone: dict) -> None:
    x = qnum(float(obj["position"][0]))
    z = qnum(float(obj["position"][1]))
    obj["position"] = [x, z]
    obj["base_y_m"] = qnum(relief_at(x, z, zone), 4)
    obj["radius_m"] = qnum(float(obj["radius_m"]), 4)
    obj["scale"] = qnum(float(obj["scale"]), 4)
    obj["yaw_deg"] = qnum(float(obj["yaw_deg"]), 3)
    if "s_m" in obj:
        obj["s_m"] = qnum(float(obj["s_m"]), 4)
    if "heading_deg" in obj:
        obj["heading_deg"] = qnum(float(obj["heading_deg"]), 3)


def _collider(o: dict) -> dict:
    return {
        "base_y_m": o["base_y_m"],
        "center": list(o["position"]),
        "id": o["id"],
        "object_id": o["id"],
        "radius_m": o["radius_m"],
        "source": "hull-footprint",
    }


def _piece_record(o: dict) -> dict:
    row = {
        "asset": o["asset"],
        "base_y_m": o["base_y_m"],
        "category": o["category"],
        "heading_deg": o["heading_deg"],
        "id": o["id"],
        "interactive": False,
        "position": o["position"],
        "radius_m": o["radius_m"],
        "row": int(o.get("row") or 0),
        "s_m": o["s_m"],
        "scale": o["scale"],
        "yaw_deg": o["yaw_deg"],
    }
    if o.get("library_id"):
        row["library_id"] = o["library_id"]
    return row


def _interior_record(o: dict) -> dict:
    row = {
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
    if o.get("library_id"):
        row["library_id"] = o["library_id"]
    for key in ("band", "intent", "height_m", "within_m", "bearing_deg", "d_min_m"):
        if key in o and o[key] not in (None, ""):
            row[key] = o[key]
    return row


def _public_record(o: dict) -> dict:
    """JSON record for a poi or a far plate. Drops generator-only fields."""
    row = _interior_record(o)
    return row


def _fog(band, poly, segs, total, gates, zone, seed) -> dict:
    band = dict(band or {})
    count = int(band.get("patches", 24))
    size = band.get("size_m") or [3, 6]
    opacity = band.get("opacity") or [0.15, 0.35]
    inset = band.get("inset_m") or [3.5, 8.0]
    perm = _PERMS.get(seed)
    if perm is None:
        perm = permutation(seed)
        _PERMS[seed] = perm
    instances = []
    steps = max(count * 6, 48)
    for i in range(steps):
        if len(instances) >= count:
            break
        s = ((i + 0.5) * total) / steps
        if _in_spans(s, gates, total):
            continue
        x, z, nx, nz = point_at(poly, segs, total, s)
        t = min(1.0, max(0.0, 0.5 + 0.5 * fbm(i, 4, perm, 1, 1.0)))
        dist = float(inset[0]) + (float(inset[1]) - float(inset[0])) * t
        px = x - nx * dist
        pz = z - nz * dist
        if not point_in_poly(px, pz, poly):
            px = x - nx * float(inset[0])
            pz = z - nz * float(inset[0])
            if not point_in_poly(px, pz, poly):
                continue
        span = float(size[1]) - float(size[0])
        op_span = float(opacity[1]) - float(opacity[0])
        op_t = min(1.0, max(0.0, 0.5 + 0.5 * fbm(i, 6, perm, 1, 1.0)))
        sz_t = min(1.0, max(0.0, 0.5 + 0.5 * fbm(i, 7, perm, 1, 1.0)))
        instances.append(
            {
                "base_y_m": qnum(relief_at(px, pz, zone), 4),
                "id": f"fog-{len(instances):02d}",
                "opacity": qnum(float(opacity[0]) + op_span * op_t, 4),
                "position": [qnum(px), qnum(pz)],
                "size_m": qnum(float(size[0]) + span * sz_t, 4),
            }
        )
    if len(instances) < count:
        raise LayoutError(f"fog band placed {len(instances)} of {count}")
    out = dict(band)
    out["instances"] = instances
    out["patches"] = count
    return out

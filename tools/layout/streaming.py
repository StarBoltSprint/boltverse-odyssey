"""Invisible streaming plan. No pixels.

Owner decree #457, approved 2026-10-02: fade_in_ms is in [300, 600].
Spec rail 11: preload_lookahead_m is at least the resident cell radius
(default 40 m). The fade is alpha on existing pixels. This module only
writes neighbour ids and the numbers the check prints.
"""

from __future__ import annotations

import math

from tools.layout.geom import ang_dist, heading_of, hypot
from tools.layout.model import qnum

# Owner decree #457, approved 2026-10-02. Do not loosen.
FADE_MS_MIN = 300.0
FADE_MS_MAX = 600.0
# Spec rail 11 resident radius. Do not loosen. Used only when the file omits cell_radius_m.
CELL_RADIUS_M = 40.0
# Director decision 2026-10-02 15:04 (delegated owner approval). Decree #457 cone,
# and a fade ramp that completes inside one ~24 m cell (spec rail 11).
CONE_DEG_MIN = 30.0
CONE_DEG_MAX = 180.0
FADE_DISTANCE_MIN = 2.0
FADE_DISTANCE_MAX = 24.0
COMPASS = (0, 45, 90, 135, 180, 225, 270, 315)
ENTER_RULE = "crossfade-from-far-if-on-screen"


def _finite(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number):
        return None
    return number


def _stored(value, places: int = 4):
    number = _finite(value)
    if number is None:
        return None
    quantized = qnum(number, places)
    if abs(quantized - round(quantized)) < 1e-9:
        return int(round(quantized))
    return quantized


def normalize_streaming(raw: dict) -> dict:
    """Copy the spec block. Absent optional keys stay absent. The 40 m default is not written."""
    block = {
        "enter_rule": ENTER_RULE,
        "headings_deg": [int(h) for h in COMPASS],
    }
    if not isinstance(raw, dict):
        return block
    for key in ("fade_in_ms", "fade_in_distance_m", "preload_lookahead_m", "preload_cone_deg", "cell_radius_m"):
        if key not in raw or raw.get(key) is None:
            continue
        stored = _stored(raw.get(key))
        if stored is not None:
            block[key] = stored
    return block


def _centre(cell: dict):
    aabb = cell.get("aabb") if isinstance(cell, dict) else None
    try:
        minx, minz = float(aabb[0][0]), float(aabb[0][1])
        maxx, maxz = float(aabb[1][0]), float(aabb[1][1])
    except (TypeError, ValueError, IndexError):
        return None
    if not all(math.isfinite(v) for v in (minx, minz, maxx, maxz)):
        return None
    return (minx + maxx) * 0.5, (minz + maxz) * 0.5


def preload_for(cell: dict, cells: list, block: dict) -> list:
    """Eight compass entries. Neighbour centres inside the heading cone, within the lookahead.

    Heading 0 faces +z, 90 faces +x. The cell itself is excluded. An empty list is valid.
    """
    lookahead = _finite((block or {}).get("preload_lookahead_m"))
    cone = _finite((block or {}).get("preload_cone_deg"))
    origin = _centre(cell)
    self_id = str(cell.get("id")) if isinstance(cell, dict) else ""
    half = None if cone is None else cone * 0.5
    entries = []
    for heading in COMPASS:
        picked = []
        if (
            origin is not None
            and lookahead is not None
            and lookahead >= 0.0
            and half is not None
            and 0.0 <= cone <= 360.0
        ):
            for other in cells or []:
                if not isinstance(other, dict):
                    continue
                oid = str(other.get("id"))
                if not oid or oid == self_id:
                    continue
                centre = _centre(other)
                if centre is None:
                    continue
                dx = centre[0] - origin[0]
                dz = centre[1] - origin[1]
                if hypot(dx, dz) > lookahead + 1e-6:
                    continue
                if ang_dist(heading_of(dx, dz), float(heading)) <= half + 1e-6:
                    picked.append(oid)
        entries.append({"cells": sorted(picked), "heading_deg": int(heading)})
    return entries


def attach_streaming(cells, spec_block: dict) -> dict:
    """Write per-cell preload in place. Does not invent a cells key."""
    block = normalize_streaming(spec_block if isinstance(spec_block, dict) else {})
    cell_list = list(cells) if isinstance(cells, list) else []
    for cell in cell_list:
        if isinstance(cell, dict):
            cell["preload"] = preload_for(cell, cell_list, block)
    return block


def _headings(value):
    if not isinstance(value, list) or len(value) != len(COMPASS):
        return None
    out = []
    for item in value:
        try:
            out.append(int(item))
        except (TypeError, ValueError):
            return None
    return out


def _preload_key(preload):
    if not isinstance(preload, list):
        return None
    rows = []
    for item in preload:
        if not isinstance(item, dict):
            return None
        try:
            heading = int(item.get("heading_deg"))
        except (TypeError, ValueError):
            return None
        rows.append((heading, tuple(sorted(str(cid) for cid in (item.get("cells") or [])))))
    return tuple(rows)


def measure_stream_plan(clearing: dict):
    """None when the clearing has no streaming key. Otherwise the stream_plan measurement."""
    if not isinstance(clearing, dict) or "streaming" not in clearing:
        return None
    streaming = clearing.get("streaming")
    if not isinstance(streaming, dict):
        streaming = {}
    cells = [cell for cell in (clearing.get("cells") or []) if isinstance(cell, dict)]
    known = {str(cell.get("id")) for cell in cells}
    fade = _finite(streaming.get("fade_in_ms"))
    lookahead = _finite(streaming.get("preload_lookahead_m"))
    cone = _finite(streaming.get("preload_cone_deg"))
    if "cell_radius_m" in streaming and _finite(streaming.get("cell_radius_m")) is not None:
        radius = _finite(streaming.get("cell_radius_m"))
        source = "file"
    else:
        radius = CELL_RADIUS_M
        source = "rail-11"
    distance = _finite(streaming.get("fade_in_distance_m")) if "fade_in_distance_m" in streaming else None
    distance_ok = True
    if "fade_in_distance_m" in streaming:
        distance_ok = (
            distance is not None
            and FADE_DISTANCE_MIN <= distance <= FADE_DISTANCE_MAX
        )

    missing_refs = 0
    mismatch = 0
    preload_refs = 0
    for cell in cells:
        self_id = str(cell.get("id"))
        preload = cell.get("preload")
        if isinstance(preload, list):
            for item in preload:
                if not isinstance(item, dict):
                    continue
                for cid in item.get("cells") or []:
                    preload_refs += 1
                    sid = str(cid)
                    if sid not in known or sid == self_id:
                        missing_refs += 1
        expected = _preload_key(preload_for(cell, cells, streaming))
        stored = _preload_key(preload)
        if stored is None or stored != expected or _headings([row[0] for row in stored] if stored else None) != list(COMPASS):
            mismatch += 1

    headings = _headings(streaming.get("headings_deg"))
    fade_ok = fade is not None and FADE_MS_MIN <= fade <= FADE_MS_MAX
    look_ok = lookahead is not None and lookahead + 1e-9 >= radius
    cone_ok = cone is not None and CONE_DEG_MIN <= cone <= CONE_DEG_MAX
    rule_ok = streaming.get("enter_rule") == ENTER_RULE
    headings_ok = headings == list(COMPASS)
    ok = (
        fade_ok
        and look_ok
        and cone_ok
        and distance_ok
        and rule_ok
        and headings_ok
        and missing_refs == 0
        and mismatch == 0
        and len(cells) >= 1
    )
    numbers = {
        "fade_in_ms": fade,
        "preload_lookahead_m": lookahead,
        "preload_cone_deg": cone,
        "cell_radius_m": radius,
        "cell_radius_source": source,
        "missing_refs": missing_refs,
        "mismatch": mismatch,
        "cells": len(cells),
        "preload_refs": preload_refs,
        "headings": len(COMPASS),
    }
    if "fade_in_distance_m" in streaming:
        numbers["fade_in_distance_m"] = distance
    note = (
        "fade_in_ms in [300, 600] (owner decree #457, approved 2026-10-02). "
        "preload_cone_deg in [30, 180] and fade_in_distance_m in [2, 24] when present "
        "(Director decision 2026-10-02 15:04, delegated owner approval). "
        "preload_lookahead_m >= cell radius (spec rail 11, default 40 m). "
        "The rule: a fade from alpha 0 applies only to an object that was not on screen "
        "before it entered range (outside the frustum, occluded, or beyond fog). "
        "An object already visible as its far representation must crossfade to the "
        "near representation and must never drop to 0."
    )
    return {"ok": ok, "numbers": numbers, "note": note}

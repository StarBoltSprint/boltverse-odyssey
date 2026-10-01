"""Deliberate faults for the broken sample. Not a generator a builder should run on a real zone."""

from __future__ import annotations

import copy
import math


def break_clearing(clearing: dict) -> dict:
    """Copy a passing layout and open the faults the checker must catch.

    - Visual ring removed across about 103°, colliders kept (invisible wall).
    - Two remaining neighbours forced to the same asset, yaw, and scale.
    - One near object enlarged so on-screen magnification exceeds 1.
    - One object lifted off the relief.
    - The hero object moved onto the gate centreline.
    - Gate frame ids pointed at nothing.
    """
    out = copy.deepcopy(clearing)
    hulls = out["edge_ring"]["hulls"]
    kept = []
    removed = []
    for h in hulls:
        heading = float(h["heading_deg"]) % 360.0
        if 40.0 <= heading < 143.0 and h.get("category") == "ring":
            removed.append(h["id"])
            continue
        kept.append(h)
    out["edge_ring"]["hulls"] = kept
    _clone_neighbour(out, kept)
    _scale_one_near(out)
    _lift_one(out)
    _block_gate(out)
    if out.get("gates"):
        out["gates"][0]["frame_ids"] = ["missing-frame"]
        out["gates"][0]["frame"] = ""
    out["id"] = str(clearing.get("id") or "zone") + "-broken"
    out["_broken"] = {
        "removed_visual_ids": removed,
        "span_deg": [40, 143],
        "note": "Deliberate faults. See tools/layout/sample/broken/NOTES.md.",
    }
    return out


def _clone_neighbour(clearing: dict, hulls: list[dict]) -> None:
    ordered = sorted(
        [h for h in hulls if h.get("category") == "ring"],
        key=lambda h: float(h["heading_deg"]) % 360.0,
    )
    pair = None
    for i in range(len(ordered) - 1):
        a, b = ordered[i], ordered[i + 1]
        ha = float(a["heading_deg"]) % 360.0
        hb = float(b["heading_deg"]) % 360.0
        if max(ha, hb) < 40.0 or min(ha, hb) > 143.0:
            if abs(ha - hb) < 20.0:
                pair = (a, b)
                break
    if pair is None and len(ordered) >= 2:
        pair = (ordered[0], ordered[1])
    if pair is None:
        return
    a, b = pair
    b["asset"] = a["asset"]
    b["yaw_deg"] = a["yaw_deg"]
    b["scale"] = a["scale"]
    b["radius_m"] = a["radius_m"]
    b["width_deg"] = a["width_deg"]
    for c in clearing["colliders"]:
        if c.get("object_id") == b["id"]:
            c["radius_m"] = b["radius_m"]


def _scale_one_near(clearing: dict) -> None:
    for obj in clearing["interior_objects"]:
        if not str(obj.get("id", "")).startswith("near-"):
            continue
        prev_scale = float(obj["scale"])
        asset_radius = float(obj["radius_m"]) / max(prev_scale, 1e-6)
        obj["scale"] = 4.0
        obj["radius_m"] = round(asset_radius * 4.0, 4)
        for c in clearing["colliders"]:
            if c.get("object_id") == obj["id"]:
                c["radius_m"] = obj["radius_m"]
        return


def _lift_one(clearing: dict) -> None:
    for obj in clearing["interior_objects"]:
        if str(obj.get("id", "")).startswith("mid-"):
            obj["base_y_m"] = 3.5
            for c in clearing["colliders"]:
                if c.get("object_id") == obj["id"]:
                    c["base_y_m"] = 3.5
            return


def _block_gate(clearing: dict) -> None:
    gate = (clearing.get("gates") or [None])[0]
    if not gate:
        return
    heading = float(gate["heading_deg"])
    ring = float(clearing["edge_ring"]["radius_m"])
    center = (clearing.get("zone") or {}).get("center") or [0, 0]
    dist = max(4.0, ring - 3.5)
    x = round(float(center[0]) + math.sin(math.radians(heading)) * dist, 4)
    z = round(float(center[1]) + math.cos(math.radians(heading)) * dist, 4)
    for obj in clearing["interior_objects"]:
        if obj.get("category") == "hero":
            obj["position"] = [x, z]
            for c in clearing["colliders"]:
                if c.get("object_id") == obj["id"]:
                    c["center"] = [x, z]
            return

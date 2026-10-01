"""Graph check for a corridor between two clearings. No framebuffer.

The row is omitted when no world is passed, so a plain clearing check
keeps its previous rows.
"""

from __future__ import annotations

import json
from pathlib import Path

from tools.layout.check import Row
from tools.layout.geom import gate_half_deg

ROOT = Path(__file__).resolve().parents[2]


def _as_path(value: str) -> Path | None:
    if not value:
        return None
    path = Path(value)
    if path.is_file():
        return path
    rooted = ROOT / value
    if rooted.is_file():
        return rooted
    return None


def _zone_doc(world: dict, zone_id: str) -> dict | None:
    listed = (world.get("zones") or {}).get(zone_id)
    if isinstance(listed, dict) and listed.get("gates") is not None:
        return listed
    path = None
    if isinstance(listed, str):
        path = listed
    elif isinstance(listed, dict):
        path = listed.get("clearing")
    if not path:
        return None
    found = _as_path(str(path))
    if found is None:
        return None
    return json.loads(found.read_text(encoding="utf-8"))


def _gate(doc: dict | None, gate_id: str) -> dict | None:
    if not doc:
        return None
    for gate in doc.get("gates") or []:
        if gate.get("id") == gate_id:
            return gate
    return None


def transition_rows(clearing: dict, world: dict | None) -> list[Row]:
    if world is None:
        return []
    zone_id = str(clearing.get("id") or "")
    corridors = list(world.get("corridors") or [])
    linked = [
        c
        for c in corridors
        if (c.get("from") or {}).get("zone") == zone_id or (c.get("to") or {}).get("zone") == zone_id
    ]
    problems: list[str] = []
    if not linked:
        problems.append("no corridor names this zone")
    speed_bad = 0
    ground_bad = 0
    gate_bad = 0
    for corridor in linked:
        cid = str(corridor.get("id") or "")
        speed = corridor.get("bakedGroundSpeed")
        length = corridor.get("length_m")
        ground = corridor.get("ground") or ""
        if not isinstance(speed, (int, float)) or speed <= 0:
            speed_bad += 1
            problems.append(f"{cid or '?'} bakedGroundSpeed")
        if not isinstance(length, (int, float)) or length <= 0:
            problems.append(f"{cid or '?'} length_m")
        if not str(ground).strip() or _as_path(str(ground)) is None:
            ground_bad += 1
            problems.append(f"{cid or '?'} ground")
        origin = corridor.get("from") or {}
        dest = corridor.get("to") or {}
        if origin.get("zone") == zone_id:
            gate = _gate(clearing, str(origin.get("gate") or ""))
            if gate is None:
                gate_bad += 1
                problems.append(f"{cid} from gate")
            elif gate.get("leads_to") and gate.get("leads_to") != cid:
                gate_bad += 1
                problems.append(f"{cid} leads_to")
            else:
                ring = (clearing.get("edge_ring") or {}).get("radius_m") or (clearing.get("zone") or {}).get("radius_m") or 0
                half = gate_half_deg(float(gate.get("width_m") or 0), float(ring or 0))
                if half <= 0:
                    gate_bad += 1
                    problems.append(f"{cid} gate width")
            dest_doc = _zone_doc(world, str(dest.get("zone") or ""))
            if dest_doc is None or _gate(dest_doc, str(dest.get("gate") or "")) is None:
                gate_bad += 1
                problems.append(f"{cid} to gate")
        if dest.get("zone") == zone_id:
            if _gate(clearing, str(dest.get("gate") or "")) is None:
                gate_bad += 1
                problems.append(f"{cid} arrival gate")
    ok = not problems
    return [
        Row(
            "transition",
            ok,
            {
                "corridors": len(linked),
                "speed_bad": speed_bad,
                "ground_bad": ground_bad,
                "gate_bad": gate_bad,
            },
            note="; ".join(problems),
        )
    ]

#!/usr/bin/env python3
"""Hang a load-time WFC corridor into world.json. Does not draw.

  python3 tools/wfc-path/hang.py \
    --spec tools/wfc-path/cook/spec.json \
    --out packs/corridor-ab

Reads a wfc-path/1 spec whose tile assets already exist, runs the solve,
and copies world_corridors onto world.json corridors. Waypoints stay in
path-layout.json. Gate leads_to is the corridor id. No pixels are written.
"""

from __future__ import annotations

import argparse
import importlib.util
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _load_wfc():
    spec = importlib.util.spec_from_file_location("wfc_path_tool_hang", HERE / "wfc.py")
    if spec is None or spec.loader is None:
        raise SystemExit("FAIL hang: cannot load wfc.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


wfc = _load_wfc()


def _repo_file(value: str) -> Path | None:
    if not isinstance(value, str) or not value.strip():
        return None
    path = Path(value.strip())
    if path.is_file():
        return path
    rooted = ROOT / value.strip()
    if rooted.is_file():
        return rooted
    return None


def _require_file(value: str, label: str) -> str:
    text = value.strip() if isinstance(value, str) else ""
    if _repo_file(text) is None:
        raise wfc.WfcError(f"FAIL missing asset: {label} {text or '(empty)'}", 1)
    return text


def _heading(dx: float, dz: float) -> float:
    deg = math.degrees(math.atan2(dx, dz))
    if deg < 0:
        deg += 360.0
    return wfc.qnum(deg)


def _center(mouth: list[float], heading: float, radius: float) -> list[float]:
    rad = math.radians(heading)
    return [
        wfc.qnum(mouth[0] - math.sin(rad) * radius),
        wfc.qnum(mouth[1] - math.cos(rad) * radius),
    ]


def _hang_block(spec: dict) -> dict:
    hang = spec.get("hang")
    if not isinstance(hang, dict):
        wfc._fail_spec("hang")
    plates = hang.get("plates")
    if not isinstance(plates, dict) or not plates:
        wfc._fail_spec("hang.plates")
    radius = hang.get("zoneRadiusM", 12)
    if isinstance(radius, bool) or not isinstance(radius, (int, float)) or radius <= 0:
        wfc._fail_spec("hang.zoneRadiusM")
    start = hang.get("start")
    if not isinstance(start, str) or not start.strip():
        wfc._fail_spec("hang.start")
    sky = hang.get("sky")
    if not isinstance(sky, str) or not sky.strip():
        wfc._fail_spec("hang.sky")
    _require_file(sky, "sky")
    for zone_id, plate in plates.items():
        if not isinstance(zone_id, str) or not zone_id.strip():
            wfc._fail_spec("hang.plates")
        _require_file(plate, f"plate {zone_id}")
    return hang


def _check_assets(spec: dict) -> None:
    for tile in spec.get("tiles") or []:
        if isinstance(tile, dict):
            _require_file(str(tile.get("asset") or ""), f"tile {tile.get('id')}")
    for link in spec.get("links") or []:
        if isinstance(link, dict):
            _require_file(str(link.get("ground") or ""), f"link {link.get('id')} ground")


def _endpoint(corridor: dict, end: str) -> dict:
    info = corridor[end]
    waypoints = corridor["waypoints"]
    mouth = waypoints[0] if end == "from" else waypoints[-1]
    return {
        "zone": info["zone"],
        "gate": info["gate"],
        "mouth": [mouth[0], mouth[1]],
        "corridor": corridor["id"],
        "role": end,
    }


def _clearings(layout: dict, hang: dict, out: Path) -> dict[str, str]:
    radius = float(hang.get("zoneRadiusM", 12))
    plates = hang["plates"]
    grouped: dict[str, list[dict]] = {}
    for corridor in layout["corridors"]:
        if not corridor.get("straight"):
            continue
        for end in ("from", "to"):
            item = _endpoint(corridor, end)
            grouped.setdefault(item["zone"], []).append(item)
    if not grouped:
        raise wfc.WfcError("FAIL hang: no straight corridor", 1)
    zones: dict[str, str] = {}
    for zone_id, ends in grouped.items():
        if zone_id not in plates:
            raise wfc.WfcError(f"FAIL hang: no plate for {zone_id}", 1)
        centers = []
        gates = []
        for item in ends:
            src = item["mouth"]
            partner = None
            for candidate in layout["corridors"]:
                if candidate["id"] != item["corridor"]:
                    continue
                partner = candidate["waypoints"][-1] if item["role"] == "from" else candidate["waypoints"][0]
            if partner is None:
                raise wfc.WfcError(f"FAIL hang: {item['corridor']}", 1)
            dx = partner[0] - src[0]
            dz = partner[1] - src[1]
            travel = _heading(dx, dz)
            # The from-gate faces along the run. The arrival gate faces back at it.
            heading = travel if item["role"] == "from" else _heading(-dx, -dz)
            center = _center(src, heading, radius)
            centers.append(tuple(center))
            gate = {
                "heading_deg": heading,
                "id": item["gate"],
                "position": [wfc.qnum(src[0]), wfc.qnum(src[1])],
                "width_m": 4.5,
            }
            if item["role"] == "from":
                gate["leads_to"] = item["corridor"]
            gates.append(gate)
        unique = {tuple(wfc.qnum(v) for v in center) for center in centers}
        if len(unique) != 1:
            raise wfc.WfcError(f"FAIL hang: {zone_id} gates do not share a centre", 1)
        center = list(unique.pop())
        # Spawn faces the first gate. Arrival play starts at the mouth, not here.
        face = gates[0]
        spawn_heading = face["heading_deg"]
        clearing = {
            "edge_ring": {"radius_m": radius},
            "gates": gates,
            "id": zone_id,
            "note": (
                "Handoff stub for the WFC corridor. Not the relief pack. "
                "The plate is an Imagine file that already exists."
            ),
            "plate": plates[zone_id],
            "schema": "clearing/1",
            "spawn": {
                "face": f"gate:{face['id']}",
                "heading_deg": spawn_heading,
                "position": center,
            },
            "zone": {"center": center, "radius_m": radius, "shape": "circle"},
        }
        name = f"clearing-{zone_id}.json"
        (out / name).write_text(wfc.dump_json(clearing), encoding="utf-8")
        zones[zone_id] = _display(out / name)
    return zones


def _display(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(ROOT)).replace("\\", "/")
    except ValueError:
        return str(path.resolve())


def hang(spec_path: Path, out: Path) -> dict:
    spec = wfc.load_spec(spec_path)
    block = _hang_block(spec)
    _check_assets(spec)
    out.mkdir(parents=True, exist_ok=True)
    layout = wfc.generate(spec, out)
    if layout.get("when") != "load" or layout.get("draws_pixels") is not False:
        raise wfc.WfcError("FAIL hang: solve flags", 1)
    corridors = list(layout.get("world_corridors") or [])
    if not corridors:
        raise wfc.WfcError("FAIL hang: no straight corridor", 1)
    zones = _clearings(layout, block, out)
    start = str(block["start"]).strip()
    if start not in zones:
        raise wfc.WfcError(f"FAIL hang: start {start} is not a zone", 1)
    rel_layout = _display(out / "path-layout.json")
    awaits = block.get("awaits")
    if awaits is None:
        awaits = []
    if not isinstance(awaits, list) or any(not isinstance(item, str) or not item.strip() for item in awaits):
        wfc._fail_spec("hang.awaits")
    world = {
        "awaits": [item.strip() for item in awaits],
        "corridors": corridors,
        "draws_pixels": False,
        "fadeMs": 400,
        "note": (
            "WFC hang. Corridors are copied from path-layout.json world_corridors. "
            "Ground files are already-cooked Imagine stills. No corridor video. No mid-run solve."
        ),
        "pathLayout": rel_layout,
        "preloadM": 8,
        "schema": "world/1",
        "sky": str(block["sky"]).strip(),
        "start": start,
        "tile_m": layout["grid"]["tile_m"],
        "triggerM": 1.5,
        "when": "load",
        "zones": zones,
    }
    (out / "world.json").write_text(wfc.dump_json(world), encoding="utf-8")
    return {"layout": layout, "world": world}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Hang a WFC corridor into world.json. Does not draw.")
    parser.add_argument("--spec", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        hang(args.spec, args.out)
    except wfc.WfcError as exc:
        print(str(exc))
        return exc.code
    print(f"PASS {args.out / 'world.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

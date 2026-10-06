#!/usr/bin/env python3
"""Hang check: WFC path-layout.json copied onto a world the layout transition accepts.

  python3 tools/wfc-path/hang_selftest.py
"""

from __future__ import annotations

import importlib.util
import json
import math
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
SPEC = HERE / "cook" / "spec.json"
PACK = ROOT / "packs" / "corridor-ab"
PY = sys.executable

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.layout.transition import transition_rows


def load_hang():
    spec = importlib.util.spec_from_file_location("wfc_hang_tool", HERE / "hang.py")
    if spec is None or spec.loader is None:
        raise SystemExit("FAIL hang selftest: cannot load hang.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


hang = load_hang()


def fail(message: str) -> None:
    print(f"FAIL {message}")
    raise SystemExit(1)


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def mouth(center, heading, radius):
    rad = math.radians(heading)
    return (
        center[0] + math.sin(rad) * radius,
        center[1] + math.cos(rad) * radius,
    )


def check_world(out: Path) -> dict:
    layout_path = out / "path-layout.json"
    world_path = out / "world.json"
    if not layout_path.is_file() or not world_path.is_file():
        fail("hang did not write path-layout.json and world.json")
    layout = read_json(layout_path)
    world = read_json(world_path)
    if layout.get("when") != "load" or world.get("when") != "load":
        fail("when is not load")
    if layout.get("draws_pixels") is not False or world.get("draws_pixels") is not False:
        fail("draws_pixels is not false")
    if layout.get("world_corridors") != world.get("corridors"):
        fail("world corridors are not a copy of world_corridors")
    if not world["corridors"]:
        fail("no corridor")
    allowed = {"bakedGroundSpeed", "from", "ground", "id", "length_m", "to"}
    for record in world["corridors"]:
        extra = set(record) - allowed
        if extra:
            fail(f"corridor gained keys {sorted(extra)}")
        if "waypoints" in record:
            fail("waypoints were copied into world.json")
        ground = ROOT / record["ground"]
        if not ground.is_file():
            fail(f"ground missing {record['ground']}")
        if ground.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp", ".mp4"}:
            fail(f"ground is not an image or video {record['ground']}")
    for cell in layout["grid"]["cells"]:
        asset = ROOT / cell["asset"]
        if not asset.is_file():
            fail(f"tile asset missing {cell['asset']}")
    corridor = layout["corridors"][0]
    if not corridor.get("straight") or not corridor.get("waypoints"):
        fail("corridor is not a straight waypoint run")
    if any(item.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".mp4"} for item in out.iterdir() if item.is_file()):
        fail("hang wrote an image")
    return {"layout": layout, "world": world}


def check_gates(out: Path, world: dict, layout: dict) -> None:
    corridor = layout["corridors"][0]
    record = world["corridors"][0]
    zones = {}
    for zone_id, listed in world["zones"].items():
        path = Path(listed)
        if not path.is_file():
            path = ROOT / listed
        if not path.is_file():
            fail(f"zone file missing {listed}")
        zones[zone_id] = read_json(path)
    origin = zones[record["from"]["zone"]]
    gate = next(item for item in origin["gates"] if item["id"] == record["from"]["gate"])
    if gate.get("leads_to") != record["id"]:
        fail("leads_to is not the corridor id")
    dest = zones[record["to"]["zone"]]
    if not any(item["id"] == record["to"]["gate"] for item in dest["gates"]):
        fail("arrival gate missing")
    ends = {
        record["from"]["zone"]: corridor["waypoints"][0],
        record["to"]["zone"]: corridor["waypoints"][-1],
    }
    for zone_id, waypoint in ends.items():
        clearing = zones[zone_id]
        gate = clearing["gates"][0]
        radius = clearing["edge_ring"]["radius_m"]
        hit = mouth(clearing["zone"]["center"], gate["heading_deg"], radius)
        if abs(hit[0] - waypoint[0]) > 1e-4 or abs(hit[1] - waypoint[1]) > 1e-4:
            fail(f"{zone_id} mouth {hit} is not waypoint {waypoint}")
        if abs(gate["position"][0] - waypoint[0]) > 1e-6 or abs(gate["position"][1] - waypoint[1]) > 1e-6:
            fail(f"{zone_id} gate position is not the waypoint")
    for zone_id, clearing in zones.items():
        rows = transition_rows(clearing, world)
        if len(rows) != 1 or rows[0].name != "transition" or not rows[0].ok:
            fail(f"transition {zone_id} {rows[0].line() if rows else 'missing'}")


def check_layout_cli(world: dict) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp)
        world_path = out / "world.json"
        payload = json.loads(json.dumps(world))
        world_path.write_text(json.dumps(payload), encoding="utf-8")
        for zone_id, listed in list(payload["zones"].items()):
            clearing = Path(listed)
            if not clearing.is_file():
                clearing = ROOT / listed
            report = out / zone_id
            proc = subprocess.run(
                [
                    PY,
                    str(ROOT / "tools" / "layout" / "layout.py"),
                    "check",
                    "--clearing",
                    str(clearing),
                    "--out",
                    str(report),
                    "--world",
                    str(world_path),
                ],
                cwd=ROOT,
                capture_output=True,
                text=True,
            )
            text = proc.stdout + proc.stderr
            passed = [line for line in text.splitlines() if line.startswith("PASS") and "transition" in line]
            failed = [line for line in text.splitlines() if line.startswith("FAIL") and "transition" in line]
            if not passed or failed:
                fail(f"layout transition {zone_id}: {text[-500:]}")


def check_missing() -> None:
    spec = read_json(SPEC)
    spec["links"][0]["ground"] = "packs/zone-a/src/ground/missing-corridor.png"
    with tempfile.TemporaryDirectory() as tmp:
        spec_path = Path(tmp) / "spec.json"
        spec_path.write_text(json.dumps(spec), encoding="utf-8")
        try:
            hang.hang(spec_path, Path(tmp) / "out")
        except hang.wfc.WfcError as exc:
            if exc.code != 1 or "missing asset" not in str(exc):
                fail(f"missing asset raised {exc}")
            return
        fail("a missing ground file was accepted")


def check_pack(fresh: dict) -> None:
    if not (PACK / "world.json").is_file():
        fail("packs/corridor-ab/world.json is not hung")
    packed = read_json(PACK / "world.json")
    laid = read_json(PACK / "path-layout.json")
    if packed.get("corridors") != fresh["world"]["corridors"]:
        fail("packed corridors differ from a fresh hang")
    if laid.get("world_corridors") != fresh["layout"]["world_corridors"]:
        fail("packed path-layout differs from a fresh hang")
    if laid.get("corridors") != fresh["layout"]["corridors"]:
        fail("packed waypoints differ from a fresh hang")
    if packed.get("when") != "load" or laid.get("draws_pixels") is not False:
        fail("packed flags")


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        first = Path(tmp) / "a"
        second = Path(tmp) / "b"
        hang.hang(SPEC, first)
        hang.hang(SPEC, second)
        one = (first / "path-layout.json").read_bytes()
        other = (second / "path-layout.json").read_bytes()
        if one != other:
            fail("same seed wrote different path-layout bytes")
        left = read_json(first / "world.json")
        right = read_json(second / "world.json")
        if left["corridors"] != right["corridors"] or left["when"] != right["when"]:
            fail("same seed wrote different corridor records")
        checked = check_world(first)
        check_gates(first, checked["world"], checked["layout"])
        check_layout_cli(checked["world"])
        check_pack(checked)
    check_missing()
    print("PASS tools/wfc-path/hang_selftest.py")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Placement gate for the detail generator. No pixels required."""
from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from place import load_solids, place  # noqa: E402

NUM = Path(__file__).resolve().parent / "numbers"
HEX = re.compile(r"#[0-9a-fA-F]{3,8}\b")
BANNED = ("prompt", "palette", "kelvin")


def fake_variants(numbers: dict) -> dict:
    out = {}
    for name in numbers["types"]:
        out[name] = [{"maxHeightM": 0.2, "contentH": 360, "contentW": 200} for _ in range(4)]
    return out


def main() -> int:
    files = sorted(NUM.glob("*.json"))
    if not files:
        print("FAIL details: no numbers files")
        return 1
    for path in files:
        text = path.read_text()
        if HEX.search(text):
            print(f"FAIL details: hex in {path.name}")
            return 1
        numbers = json.loads(text)
        blob = json.dumps(numbers).lower()
        for word in BANNED:
            if word in blob:
                print(f"FAIL details: {word} in {path.name}")
                return 1
        if numbers.get("schema") != "details-numbers/1":
            print(f"FAIL details: schema {path.name}")
            return 1
        kit = json.loads((ROOT / "biome" / "kits" / f"{numbers['kit']}.json").read_text())
        if kit.get("id") != numbers["kit"]:
            print("FAIL details: kit id")
            return 1
        for name, spec in numbers["types"].items():
            if spec.get("planes", 1) < 1:
                print(f"FAIL details: {name} planes")
                return 1
            if float(spec["heightM"][1]) > 0.30:
                print(f"FAIL details: {name} taller than 30 cm")
                return 1
            if spec.get("collider"):
                print(f"FAIL details: {name} collider")
                return 1
        solids = load_solids(ROOT, numbers["pack"])
        variants = fake_variants(numbers)
        first, stats = place(numbers, solids, variants)
        second, _ = place(numbers, solids, variants)
        if first != second:
            print("FAIL details: placement is not deterministic")
            return 1
        need = sum(int(spec["count"]) for spec in numbers["types"].values())
        if stats["placed"] < int(need * 0.9):
            print(f"FAIL details: placed {stats['placed']} of {need}")
            return 1
        if stats["nearPerM2"] < 0.4 or stats["nearPerM2"] < stats["farPerM2"] * 3:
            print(f"FAIL details: density near {stats['nearPerM2']} far {stats['farPerM2']}")
            return 1
        spawn = numbers["corridor"]["spawn"]
        heading = math.radians(float(numbers["corridor"]["headingDeg"]))
        fx, fz = math.sin(heading), math.cos(heading)
        rx, rz = fz, -fx
        clear = float(numbers.get("spawnClearM") or 0)
        by_type: dict[str, list] = {}
        for inst in first:
            if inst.get("planes", 0) < 1:
                print("FAIL details: instance has no card")
                return 1
            if "collider" in inst:
                print("FAIL details: instance collider")
                return 1
            spec = numbers["types"][inst["type"]]
            if not (float(spec["heightM"][0]) * 0.5 <= inst["heightM"] <= float(spec["heightM"][1]) + 1e-6):
                print(f"FAIL details: height {inst['heightM']} for {inst['type']}")
                return 1
            if math.hypot(inst["x"] - spawn[0], inst["z"] - spawn[1]) < clear - 0.02:
                print("FAIL details: inside spawn clear")
                return 1
            by_type.setdefault(inst["type"], []).append(inst)
        # Same-type separation, and a lateral spread so the path is not one row.
        lats = []
        for inst in first:
            dx = inst["x"] - spawn[0]
            dz = inst["z"] - spawn[1]
            along = dx * fx + dz * fz
            lat = dx * rx + dz * rz
            if 0 <= along <= 36 and abs(lat) <= float(numbers["bands"]["nearHalf"]):
                lats.append(lat)
            spec = numbers["types"][inst["type"]]
            sep = float(spec["minSeparation"])
            if numbers.get("clumps"):
                sep = min(sep, float(numbers["clumps"]["sepM"]))
            sep *= 0.98
            for other in by_type[inst["type"]]:
                if other is inst:
                    continue
                d = math.hypot(inst["x"] - other["x"], inst["z"] - other["z"])
                if d < sep and (other["x"], other["z"]) > (inst["x"], inst["z"]):
                    print(f"FAIL details: {inst['type']} separation {d:.3f}")
                    return 1
                    break
        if len(lats) < 8:
            print("FAIL details: near band almost empty")
            return 1
        mean = sum(lats) / len(lats)
        var = sum((v - mean) ** 2 for v in lats) / len(lats)
        if math.sqrt(var) < 0.45:
            print(f"FAIL details: near band is a row, std {math.sqrt(var):.3f}")
            return 1
        print(
            f"PASS details selftest placed={stats['placed']} near={stats['nearPerM2']}/m2 "
            f"far={stats['farPerM2']}/m2 clearing={stats['clearing']}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())

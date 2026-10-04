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
from place import load_solids, near_height_cap, place, place_features, thin_micro  # noqa: E402

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
        feat = numbers.get("features")
        if feat:
            fvar = {}
            for name, spec in feat["types"].items():
                if int(spec.get("planes", 1)) != 1:
                    print(f"FAIL details: feature {name} is crossed")
                    return 1
                if float(spec["heightM"][1]) > 1.25:
                    print(f"FAIL details: feature {name} over 1.25 m")
                    return 1
                if spec.get("collider"):
                    print(f"FAIL details: feature {name} blocks")
                    return 1
                fvar[name] = [{"maxHeightM": 1.5, "contentH": 640, "contentW": 520}]
            fa, fs = place_features(numbers, solids, fvar)
            fb, _ = place_features(numbers, solids, fvar)
            if fa != fb:
                print("FAIL details: features are not deterministic")
                return 1
            fneed = sum(int(spec["count"]) for spec in feat["types"].values())
            if fs["placed"] < int(fneed * 0.9):
                print(f"FAIL details: features placed {fs['placed']} of {fneed}")
                return 1
            run_clear = float(feat.get("runClearM") or 0.9)
            near_n = 0
            for inst in fa:
                if inst.get("planes") != 1 or "collider" in inst:
                    print("FAIL details: feature instance")
                    return 1
                spec = feat["types"][inst["type"]]
                if inst["heightM"] > float(spec["heightM"][1]) + 1e-6:
                    print(f"FAIL details: feature height {inst['heightM']}")
                    return 1
                dx = inst["x"] - spawn[0]
                dz = inst["z"] - spawn[1]
                lat = dx * rx + dz * rz
                aspect = 520 / 640
                half = 0.5 * inst["heightM"] * inst["scale"] * aspect
                if abs(lat) - half < run_clear - 0.02:
                    print(f"FAIL details: feature on the running line lat {lat:.2f}")
                    return 1
                if inst.get("near"):
                    band = feat["near"]["latM"]
                    if abs(lat) < float(band[0]) - 1e-6 or abs(lat) > float(band[1]) + 1e-6:
                        print(f"FAIL details: near feature outside its band lat {lat:.2f}")
                        return 1
                    cap = near_height_cap(640, abs(lat), feat["near"], float(feat.get("focalPx", 1793)))
                    if inst["heightM"] * inst["scale"] > cap + 1e-4:
                        print(f"FAIL details: near feature over its no-stretch cap {inst['heightM']} > {cap:.3f}")
                        return 1
                    near_n += 1
                elif abs(lat) + 1e-6 < float(spec["minAcross"]) - half:
                    print(f"FAIL details: feature inside minAcross {inst['type']}")
                    return 1
            if numbers.get("thin"):
                kept, ts = thin_micro(numbers, first, fa, solids, variants)
                kept2, _ = thin_micro(numbers, first, fa, solids, variants)
                if kept != kept2:
                    print("FAIL details: thinning is not deterministic")
                    return 1
                if not (0.25 <= ts["keptFrac"] <= 0.5):
                    print(f"FAIL details: thinning kept {ts['keptFrac']} (want about 40%)")
                    return 1
                if ts["clumpOnlyKept"] > 0.12 * max(1, ts["placed"]):
                    print(f"FAIL details: clump-only variants {ts['clumpOnlyKept']} of {ts['placed']}")
                    return 1
                if ts["nearPerM2"] < 3 * ts["farPerM2"]:
                    print(f"FAIL details: thinned near {ts['nearPerM2']} far {ts['farPerM2']}")
                    return 1
                print(f"PASS thin selftest kept={ts['placed']}/{ts['before']} clumpOnly={ts['clumpOnlyKept']}")
            if feat.get("near") and near_n < 60:
                print(f"FAIL details: near band has only {near_n} features")
                return 1
            print(
                f"PASS features selftest placed={fs['placed']} near={near_n} by={fs['byType']}"
            )
        print(
            f"PASS details selftest placed={stats['placed']} near={stats['nearPerM2']}/m2 "
            f"far={stats['farPerM2']}/m2 clearing={stats['clearing']}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Placement selftest plus a ban on palette words in the rock numbers."""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NUM = ROOT / "tools" / "rocks" / "numbers"
HEX = re.compile(r"#[0-9a-fA-F]{3,8}\b")
BANNED = ("prompt", "palette", "kelvin")


def main() -> int:
    files = sorted(NUM.glob("*.json"))
    if not files:
        print("FAIL rocks: no numbers files")
        return 1
    for path in files:
        text = path.read_text()
        if HEX.search(text):
            print(f"FAIL rocks: hex in {path.name}")
            return 1
        data = json.loads(text)
        blob = json.dumps(data).lower()
        for word in BANNED:
            if word in blob:
                print(f"FAIL rocks: {word} in {path.name}")
                return 1
        if data.get("schema") != "rocks-numbers/1":
            print(f"FAIL rocks: schema {path.name}")
            return 1
        types = data.get("types") or {}
        for name, spec in types.items():
            if spec.get("kind") == "hull" and spec.get("count", 0) > 64:
                print(f"FAIL rocks: {name} over 64 instances")
                return 1
            if spec.get("kind") == "cutout":
                hi = spec.get("heightM", [0, 1])[1]
                if hi > 0.30:
                    print(f"FAIL rocks: cutout {name} taller than 30 cm")
                    return 1
    proc = subprocess.run(
        ["node", "tools/rocks/place.mjs", "--selftest"],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    sys.stdout.write(proc.stdout)
    sys.stderr.write(proc.stderr)
    if proc.returncode != 0:
        return proc.returncode
    print("PASS rocks selftest")
    return 0


if __name__ == "__main__":
    sys.exit(main())

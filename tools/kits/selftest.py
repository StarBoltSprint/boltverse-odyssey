#!/usr/bin/env python3
"""Template lock, the three examples, and a kit that is not A/B/C.

  python3 tools/kits/selftest.py
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.kits.kit import SCHEMA_PATH, check_file, failure_headings, load_kit, load_schema, main  # noqa: E402

PY = sys.executable
KIT = ROOT / "tools" / "kits" / "kit.py"
EXAMPLES = ("howling-eclipse", "ember-mesa", "cascade-verdance")


def fail(msg: str) -> None:
    raise SystemExit(f"FAIL selftest: {msg}")


def test_schema_lock() -> None:
    schema = load_schema()
    geo = schema["geometry"]
    if geo["horizonFraction"] != 0.5 or geo["level"] is not True:
        fail("horizon is not level 50%")
    if geo["skySlices"] != 8 or geo["hfovDeg"] != 60 or geo["yawStepDeg"] != 45:
        fail("sky slice plan is not 8 × 60° at a 45° step")
    if geo["sunCount"] != 1 or geo["ground"] != "ortho":
        fail("sun or ground lock drifted")
    if schema["headingsDeg"] != [0, 45, 90, 135, 180, 225, 270, 315]:
        fail("headings drifted")
    headings = failure_headings()
    for heading in schema["requiredNegatives"]:
        if heading not in headings:
            fail(f"schema negative is not in the failure log: {heading}")


def test_examples_pass() -> None:
    code = main(["check"])
    if code != 0:
        fail("check rejected the filled examples")
    schema = load_schema()
    headings = failure_headings()
    for kit_id in EXAMPLES:
        path = ROOT / "biome" / "kits" / f"{kit_id}.json"
        errors = check_file(path, schema, headings)
        if errors:
            fail(f"{kit_id}: {errors}")
        kit = load_kit(path)
        if kit["sun"]["count"] != 1:
            fail(f"{kit_id} sun count")
        if kit["camera"]["plates"]["ground"]["type"] != "ortho":
            fail(f"{kit_id} ground is not ortho")


def test_template_is_blank() -> None:
    proc = subprocess.run(
        [PY, str(KIT), "check", "--file", str(ROOT / "biome" / "kits" / "_template" / "kit.json")],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    if proc.returncode == 0 or "name is empty" not in proc.stdout:
        fail(f"blank template should fail\n{proc.stdout}")


def test_show() -> None:
    proc = subprocess.run([PY, str(KIT), "show", "--id", "howling-eclipse"], cwd=ROOT, text=True, capture_output=True)
    if proc.returncode != 0 or "The Howling Eclipse" not in proc.stdout or "50%" not in proc.stdout:
        fail(f"show failed\n{proc.stdout}\n{proc.stderr}")


def test_player_kit_and_breaks() -> None:
    schema = load_schema()
    headings = failure_headings()
    src = load_kit(ROOT / "biome" / "kits" / "cascade-verdance.json")
    player = json.loads(json.dumps(src))
    player["id"] = "player-coast"
    player["name"] = "Player Coast"
    player["paint"] = "salt coast at morning"
    player["example"] = None
    del player["example"]
    player["decreeHooks"] = ["coast", "morning"]
    player["promptPreamble"] = player["promptPreamble"].replace("Cascade Verdance", "Player Coast").replace(
        "Emerald highlands in the morning", "A salt coast in the morning"
    )
    errors = check_file_dict(player, schema, headings, "player-coast")
    if errors:
        fail("player kit should pass: " + "; ".join(errors))

    broken = json.loads(json.dumps(player))
    broken["geometry"]["horizonFraction"] = 0.38
    broken["camera"]["play"]["horizonFraction"] = 0.38
    if not check_file_dict(broken, schema, headings, "player-coast"):
        fail("horizon 0.38 was accepted")

    broken = json.loads(json.dumps(player))
    broken["sun"]["count"] = 2
    if not any("sun.count" in line for line in check_file_dict(broken, schema, headings, "player-coast")):
        fail("two suns were accepted")

    broken = json.loads(json.dumps(player))
    broken["camera"]["plates"]["ground"]["type"] = "perspective"
    if not check_file_dict(broken, schema, headings, "player-coast"):
        fail("perspective ground was accepted")

    broken = json.loads(json.dumps(player))
    broken["skySlicePlan"]["count"] = 7
    broken["camera"]["plates"]["sky"]["slices"] = 7
    broken["geometry"]["skySlices"] = 7
    if not check_file_dict(broken, schema, headings, "player-coast"):
        fail("7 slices were accepted")

    broken = json.loads(json.dumps(player))
    broken["fog"]["colourSource"] = "#112233"
    if not any("fog" in line for line in check_file_dict(broken, schema, headings, "player-coast")):
        fail("hex fog colour was accepted")

    broken = json.loads(json.dumps(player))
    broken["pixels"]["codeMay"] = list(broken["pixels"]["codeMay"]) + ["shadows"]
    if not any("codeMay" in line for line in check_file_dict(broken, schema, headings, "player-coast")):
        fail("code-drawn shadows were accepted")

    broken = json.loads(json.dumps(player))
    broken["negatives"] = list(broken["negatives"]) + [{"heading": "not a real failure", "source": "learn/failures.md"}]
    if not any("not a real failure" in line for line in check_file_dict(broken, schema, headings, "player-coast")):
        fail("invented negative was accepted")

    broken = json.loads(json.dumps(player))
    broken["promptPreamble"] = broken["promptPreamble"].replace("ortho", "flat")
    if not any("ortho" in line for line in check_file_dict(broken, schema, headings, "player-coast")):
        fail("preamble without ortho was accepted")


def check_file_dict(kit: dict, schema: dict, headings: str, filename: str) -> list[str]:
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / f"{filename}.json"
        path.write_text(json.dumps(kit), encoding="utf-8")
        return check_file(path, schema, headings)


def test_schema_file_exists() -> None:
    if not SCHEMA_PATH.is_file():
        fail("schema missing")


def main_test() -> None:
    test_schema_file_exists()
    test_schema_lock()
    test_examples_pass()
    test_template_is_blank()
    test_show()
    test_player_kit_and_breaks()
    print("PASS kits selftest")


if __name__ == "__main__":
    main_test()

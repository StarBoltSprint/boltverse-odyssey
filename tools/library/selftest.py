#!/usr/bin/env python3
"""Library add / list / check, and a layout spec that names an id.

  python3 tools/library/selftest.py
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

from tools.layout.generate import build_clearing
from tools.layout.model import dump_json, load_json
from tools.library.library import build_manifest, main
from tools.library.resolve import load_library_asset

PY = sys.executable
SPEC = ROOT / "tools" / "layout" / "testdata" / "spec.json"
SAMPLE = ROOT / "tools" / "layout" / "sample" / "good" / "clearing.json"

ASSETCHECK_PASS = "tools/assetcheck/samples/good-cutout/report.json"
OBJSHEET_PASS = "tools/objsheet/samples/repo-synthetic-rock/report.json"
WALK_PASS = "tools/walkaround/testdata/synthetic-rock/out/qc/report.json"
VIEWS = "tools/walkaround/testdata/synthetic-rock/views"
WALK_DIR = "tools/walkaround/testdata/synthetic-rock/out"
ASSET = "tools/walkaround/testdata/synthetic-rock/out/asset.json"


def fail(msg: str) -> None:
    raise SystemExit(f"FAIL selftest: {msg}")


def intake(assetcheck: str) -> dict:
    return {
        "id": "fixture-solid",
        "fixture": True,
        "source": {
            "imagineIds": ["fixture-synthetic-solid"],
            "promptRef": "biome/library/fixture-solid/prompt-ref.txt",
        },
        "viewsDir": VIEWS,
        "shapeMethod": "surface-nets",
        "walkaroundDir": WALK_DIR,
        "asset": ASSET,
        "reports": {
            "assetcheck": assetcheck,
            "objsheet": OBJSHEET_PASS,
            "walkaround": WALK_PASS,
        },
        "scale": {"min": 0.85, "max": 1.2, "default": 1.0},
        "collider": {"type": "circle", "radius_m": 0.7366173380262299},
        "lod": {
            "billboardViews": [
                "yaw-000.png",
                "yaw-045.png",
                "yaw-090.png",
                "yaw-135.png",
                "yaw-180.png",
                "yaw-225.png",
                "yaw-270.png",
                "yaw-315.png",
            ]
        },
    }


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def test_reject_fail() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        bad = {
            "tool": "assetcheck",
            "ok": False,
            "assets": [
                {"file": "views/yaw-000.png", "locked": False, "checks": {"resolution": {"status": "FAIL"}}}
            ],
        }
        write_json(tmp_path / "bad-assetcheck.json", bad)
        write_json(tmp_path / "intake.json", intake("bad-assetcheck.json"))
        code = main(["add", "--intake", str(tmp_path / "intake.json"), "--library", str(tmp_path / "lib")])
        if code == 0:
            fail("add accepted a FAIL report")


def test_lock_warn() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        warned = {
            "tool": "assetcheck",
            "ok": True,
            "assets": [
                {"file": "lock/plate.png", "locked": True, "checks": {"basic": {"status": "WARN"}}}
            ],
        }
        write_json(tmp_path / "warn.json", warned)
        body = intake(str(tmp_path / "warn.json"))
        body["id"] = "lock-warn-solid"
        write_json(tmp_path / "intake.json", body)
        lib = tmp_path / "lib"
        code = main(["add", "--intake", str(tmp_path / "intake.json"), "--library", str(lib)])
        if code != 0:
            fail("add refused a lock WARN")
        manifest = json.loads((lib / "lock-warn-solid" / "manifest.json").read_text(encoding="utf-8"))
        if manifest["reports"]["assetcheck"]["verdict"] != "WARN":
            fail("lock WARN was not stored as WARN")
        if main(["check", "--library", str(lib), "--id", "lock-warn-solid"]) != 0:
            fail("check failed a lock WARN object")


def test_fixture_roundtrip() -> None:
    manifest = build_manifest(intake(ASSETCHECK_PASS), ROOT)
    if manifest["reports"]["objsheet"]["verdict"] != "PASS":
        fail("objsheet verdict")
    if manifest["reports"]["walkaround"]["verdict"] != "PASS":
        fail("walkaround verdict")
    on_disk = json.loads((ROOT / "biome" / "library" / "fixture-solid" / "manifest.json").read_text(encoding="utf-8"))
    if dump_json(on_disk) != dump_json(manifest):
        fail("biome/library/fixture-solid/manifest.json is stale; regenerate from build_manifest")
    if main(["list"]) != 0:
        fail("list")
    if main(["check", "--id", "fixture-solid"]) != 0:
        fail("check fixture-solid")
    asset = load_library_asset("fixture-solid", [ROOT])
    if asset.library_id != "fixture-solid":
        fail("library id was not attached")
    if not asset.path.endswith("asset.json"):
        fail(asset.path)


def test_layout_id_and_paths() -> None:
    spec = load_json(SPEC)
    plain = build_clearing(spec, [ROOT, SPEC.parent])
    if dump_json(plain) != SAMPLE.read_text(encoding="utf-8"):
        fail("path-string specs no longer match sample/good/clearing.json")
    spec["categories"] = json.loads(json.dumps(spec["categories"]))
    spec["categories"]["hero"]["assets"] = [{"library": "fixture-solid"}]
    spec["categories"]["hero"]["scale"] = [0.05, 0.2]
    clearing = build_clearing(spec, [ROOT, SPEC.parent])
    heroes = [o for o in clearing["interior_objects"] if o.get("category") == "hero"]
    if len(heroes) != 1:
        fail(f"expected one hero, got {len(heroes)}")
    if heroes[0].get("library_id") != "fixture-solid":
        fail("placed hero has no library_id")
    if heroes[0]["asset"] != ASSET:
        fail(f"hero asset {heroes[0]['asset']}")
    if any(isinstance(p, dict) for p in clearing["variants"]["hero"]):
        fail("variants stored a library object instead of a path")


def test_cli_help() -> None:
    proc = subprocess.run([PY, str(ROOT / "tools" / "library" / "library.py")], capture_output=True, text=True)
    if proc.returncode != 2:
        fail(f"bare cli exit {proc.returncode}")


def main_test() -> None:
    test_reject_fail()
    test_lock_warn()
    test_fixture_roundtrip()
    test_layout_id_and_paths()
    test_cli_help()
    print("PASS library selftest")


if __name__ == "__main__":
    main_test()

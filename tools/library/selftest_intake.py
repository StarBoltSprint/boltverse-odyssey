#!/usr/bin/env python3
"""Each library intake refusal has a bad fixture that add rejects.

  python3 tools/library/selftest_intake.py
"""

from __future__ import annotations

import contextlib
import io
import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.library.library import main as library_main
from tools.library.selftest import ASSETCHECK_PASS, fail, intake


def _copy(part: dict) -> dict:
    return json.loads(json.dumps(part))


def refuse_add(part: dict, needle: str) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        folder = Path(tmp)
        path = folder / "intake.json"
        path.write_text(json.dumps(part), encoding="utf-8")
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            code = library_main(["add", "--intake", str(path), "--library", str(folder / "lib")])
        text = err.getvalue()
        if code == 0:
            fail(f"add accepted a bad fixture ({needle})")
        if needle not in text:
            fail(f"refusal missing {needle!r}: {text}")


def good() -> dict:
    return intake(ASSETCHECK_PASS)


def test_keep_but_run_fail() -> None:
    part = _copy(good())
    part["run"] = {"tool": "object-gate", "verdict": "FAIL"}
    refuse_add(part, "run verdict is not PASS")
    with tempfile.TemporaryDirectory() as tmp:
        folder = Path(tmp)
        report = {"art_director": "KEEP", "tool": "object-gate", "verdict": "FAIL", "keep": True}
        (folder / "gate.json").write_text(json.dumps(report), encoding="utf-8")
        part = _copy(good())
        part["art_director"] = {"report": str(folder / "gate.json")}
        part["run"] = {"report": str(folder / "gate.json"), "tool": "object-gate"}
        (folder / "intake.json").write_text(json.dumps(part), encoding="utf-8")
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            code = library_main(["add", "--intake", str(folder / "intake.json"), "--library", str(folder / "lib")])
        if code == 0 or "run verdict is not PASS" not in err.getvalue():
            fail(f"KEEP + run FAIL report was accepted: {err.getvalue()}")


def test_run_pass_but_no_keep() -> None:
    part = _copy(good())
    del part["art_director"]
    refuse_add(part, "art director KEEP is missing")
    part = _copy(good())
    part["art_director"] = "REVIEW"
    refuse_add(part, "art director KEEP is missing")
    part = _copy(good())
    part["run"] = {"tool": "visual", "verdict": "PASS"}
    refuse_add(part, "run verdict is not PASS")
    with tempfile.TemporaryDirectory() as tmp:
        folder = Path(tmp)
        report = {"tool": "object-gate", "verdict": "PASS"}
        (folder / "gate.json").write_text(json.dumps(report), encoding="utf-8")
        part = _copy(good())
        part["art_director"] = {"report": str(folder / "gate.json")}
        part["run"] = {"report": str(folder / "gate.json"), "tool": "object-gate"}
        (folder / "intake.json").write_text(json.dumps(part), encoding="utf-8")
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            code = library_main(["add", "--intake", str(folder / "intake.json"), "--library", str(folder / "lib")])
        if code == 0 or "art director KEEP is missing" not in err.getvalue():
            fail(f"run PASS without KEEP was accepted: {err.getvalue()}")


def test_missing_collision() -> None:
    part = _copy(good())
    part["collision"]["boxes"] = [{"min": [0, 0, 0], "max": [1, 1, 1], "space": "world"}]
    refuse_add(part, "missing local collision boxes")
    part = _copy(good())
    del part["collision"]["boxes"]
    refuse_add(part, "missing local collision boxes")
    part = _copy(good())
    del part["collision"]["ground_anchor"]
    refuse_add(part, "missing ground_anchor")
    part = _copy(good())
    del part["collision"]["min_clearance_m"]
    refuse_add(part, "missing min_clearance_m")


def test_missing_camera_layer() -> None:
    part = _copy(good())
    del part["camera_layer"]
    refuse_add(part, "missing camera layer")
    part = _copy(good())
    part["camera_layer"] = "gallop"
    refuse_add(part, "missing camera layer")


def test_lod_outline_diff() -> None:
    part = _copy(good())
    part["lod"]["chain"]["outlineDiffPx"]["15"] = 4
    refuse_add(part, "LOD outline diff at 15 m is 4 px")
    part = _copy(good())
    part["lod"]["chain"]["outlineDiffPx"]["40"] = 2
    refuse_add(part, "LOD outline diff at 40 m is 2 px")


def test_missing_tri_counts() -> None:
    part = _copy(good())
    del part["lod"]["chain"]["lod1"]["triangles"]
    refuse_add(part, "missing per-LOD triangle counts (lod1)")
    part = _copy(good())
    del part["lod"]["chain"]["lod0"]
    del part["lod"]["chain"]["lod1"]
    del part["lod"]["chain"]["lod2"]
    refuse_add(part, "missing per-LOD triangle counts")


def test_texture() -> None:
    part = _copy(good())
    part["textures"] = [{"nativePx": 512, "mipmaps": True}]
    refuse_add(part, "texture native pixels 512 < 1024")
    part = _copy(good())
    part["textures"] = [{"width": 2048, "height": 512, "mipmaps": True}]
    refuse_add(part, "texture native pixels 512 < 1024")
    part = _copy(good())
    part["textures"] = [{"nativePx": 1024, "mipmaps": False}]
    refuse_add(part, "texture has no mipmaps")
    part = _copy(good())
    part["textures"] = [{"nativePx": 1024}]
    refuse_add(part, "texture has no mipmaps")


def test_accept_all_fields() -> None:
    part = good()
    with tempfile.TemporaryDirectory() as tmp:
        folder = Path(tmp)
        path = folder / "intake.json"
        path.write_text(json.dumps(part), encoding="utf-8")
        out = io.StringIO()
        err = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = library_main(["add", "--intake", str(path), "--library", str(folder / "lib")])
        if code != 0:
            fail(f"good fixture refused: {err.getvalue()}")
        manifest = json.loads((folder / "lib" / "fixture-solid" / "manifest.json").read_text(encoding="utf-8"))
        if manifest["art_director"] != "KEEP":
            fail("stored art_director")
        if manifest["run"]["verdict"] != "PASS" or manifest["run"]["tool"] != "object-gate":
            fail("stored run")
        if manifest["collision"]["boxes"][0]["space"] != "local":
            fail("stored collision space")
        if manifest["collision"]["ground_anchor"] != [0, 0, 0]:
            fail("stored ground_anchor")
        if manifest["collision"]["min_clearance_m"] != 0.5:
            fail("stored min_clearance_m")
        if manifest["camera_layer"] != {"id": "approach", "kind": "approach"}:
            fail(f"stored camera_layer {manifest['camera_layer']}")
        chain = manifest["lod"]["chain"]
        if chain["outlineDiffPx"] != {"15": 0, "40": 0}:
            fail("stored outline diff")
        if [chain["lod0"]["triangles"], chain["lod1"]["triangles"], chain["lod2"]["triangles"]] != [1200, 400, 80]:
            fail("stored triangle counts")
        if manifest["textures"] != [{"nativePx": 1024, "mipmaps": True}]:
            fail("stored textures")
        if library_main(["check", "--library", str(folder / "lib"), "--id", "fixture-solid"]) != 0:
            fail("check refused a complete part")
    # key layer id, and a tools/gate run verdict, are accepted the same way
    part = _copy(good())
    part["run"] = {"tool": "tools/gate", "verdict": "PASS"}
    part["camera_layer"] = {"id": "05-fixture-solid", "kind": "key"}
    with tempfile.TemporaryDirectory() as tmp:
        folder = Path(tmp)
        (folder / "intake.json").write_text(json.dumps(part), encoding="utf-8")
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            code = library_main(["add", "--intake", str(folder / "intake.json"), "--library", str(folder / "lib")])
        if code != 0:
            fail(f"key camera layer refused: {err.getvalue()}")


def main() -> None:
    test_keep_but_run_fail()
    test_run_pass_but_no_keep()
    test_missing_collision()
    test_missing_camera_layer()
    test_lod_outline_diff()
    test_missing_tri_counts()
    test_texture()
    test_accept_all_fields()
    print("PASS library intake selftest")


if __name__ == "__main__":
    main()

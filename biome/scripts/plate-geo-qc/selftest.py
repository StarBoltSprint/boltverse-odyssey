#!/usr/bin/env python3
"""Red-to-green checks for rail 12 reports. Law 23 thresholds stay sealed.

  python3 biome/scripts/plate-geo-qc/selftest.py
"""
from __future__ import annotations

import importlib.util
import json
import math
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
SCRIPT = HERE / "plate-geo-qc.py"
ROOT = HERE.parents[2]


def load():
    spec = importlib.util.spec_from_file_location("plate_geo_qc", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


QC = load()

FAILS = 0


def check(name: str, ok: bool, detail: str = "") -> None:
    global FAILS
    if ok:
        print(f"PASS  {name}")
    else:
        FAILS += 1
        print(f"FAIL  {name}  {detail}")


def save(rgb: np.ndarray, path: Path) -> None:
    Image.fromarray(rgb.astype(np.uint8), "RGB").save(path)


def split_horizon(height: int, row: int) -> np.ndarray:
    rgb = np.zeros((height, 64, 3), dtype=np.uint8)
    rgb[:row] = 220
    rgb[row:] = 30
    return rgb


def test_horizon(tmp: Path) -> None:
    level = tmp / "level.png"
    save(split_horizon(1600, 800), level)
    res = QC.report_horizon({"image": str(level)})
    check("horizon level 800", res["verdict"] == "PASS" and res["numbers"]["row"] == 800, json.dumps(res))
    check("horizon frac 0.5", abs(res["numbers"]["frac"] - 0.5) < 1e-6, str(res["numbers"]))

    pitched = tmp / "pitched.png"
    save(split_horizon(1600, 608), pitched)
    bare = QC.report_horizon({"image": str(pitched)})
    check(
        "horizon 0.38 without pitch",
        bare["verdict"] == "FAIL" and any("pitched" in line for line in bare["failures"]),
        json.dumps(bare),
    )
    stated = QC.report_horizon({"image": str(pitched), "pitchDeg": 8})
    check("horizon 0.38 with pitch", stated["verdict"] == "PASS", json.dumps(stated))

    mixed = QC.report_horizon({"image": str(level), "pitchDeg": 8})
    check(
        "pitch on a level row",
        mixed["verdict"] == "FAIL" and any("level" in line for line in mixed["failures"]),
        json.dumps(mixed),
    )

    flat = tmp / "flat.png"
    save(np.full((1600, 64, 3), 128, dtype=np.uint8), flat)
    none = QC.report_horizon({"image": str(flat)})
    check(
        "no horizon step",
        none["verdict"] == "FAIL" and any("no horizon" in line for line in none["failures"]),
        json.dumps(none),
    )


def sky_payload(n: int, hfov: float, width) -> dict:
    return {
        "hfovDeg": hfov,
        "stepDeg": 45,
        "slices": [{"yawDeg": i * 45, "widthPx": width} for i in range(n)],
    }


def test_sky() -> None:
    good = QC.report_sky(sky_payload(8, 60, 720))
    expect = (720 / 2) / math.tan(math.radians(30))
    got = good["numbers"]["fPx"][0]
    check("sky 8x60x45", good["verdict"] == "PASS", json.dumps(good))
    check("sky f_px", abs(got - expect) < 0.01 and abs(got - 623.538) < 0.01, str(got))

    short = QC.report_sky(sky_payload(6, 60, 720))
    check("sky n=6", short["verdict"] == "FAIL", json.dumps(short))
    wide = QC.report_sky(sky_payload(8, 70, 720))
    check("sky hfov 70", wide["verdict"] == "FAIL", json.dumps(wide))
    missing = QC.report_sky(sky_payload(8, 60, None))
    check(
        "sky width not measured",
        missing["verdict"] == "FAIL" and any("not measured" in line or "do not assume" in line for line in missing["failures"]),
        json.dumps(missing),
    )

    eq = QC.report_sky({"projection": "equirect", "widthPx": 200, "heightPx": 100})
    check("equirect 2:1", eq["verdict"] == "PASS", json.dumps(eq))
    bad = QC.report_sky({"projection": "equirect", "widthPx": 300, "heightPx": 100})
    check("equirect not 2:1", bad["verdict"] == "FAIL", json.dumps(bad))


def turn_payload(n: int, step: float, **extra) -> dict:
    body = {
        "elevationDeg": 15,
        "distanceM": 4,
        "hfovDeg": 24,
        "sourceCount": 2,
        "views": [{"yawDeg": i * step} for i in range(n)],
    }
    body.update(extra)
    return body


def test_turn() -> None:
    good = QC.report_turn(turn_payload(8, 45))
    check("turn 8x45", good["verdict"] == "PASS", json.dumps(good))
    four = QC.report_turn(turn_payload(4, 90))
    check("turn 4x90", four["verdict"] == "PASS", json.dumps(four))
    elev = QC.report_turn(turn_payload(8, 45, elevationDeg=18))
    check("turn elev 18", elev["verdict"] == "FAIL", json.dumps(elev))
    sources = QC.report_turn(turn_payload(8, 45, sourceCount=6))
    check("turn 6 sources", sources["verdict"] == "FAIL", json.dumps(sources))
    third = QC.report_turn(turn_payload(3, 120))
    check("turn 3x120", third["verdict"] == "FAIL", json.dumps(third))
    drift = QC.report_turn(turn_payload(8, 40))
    check("turn step 40", drift["verdict"] == "FAIL", json.dumps(drift))


def shade(left_bright: bool) -> np.ndarray:
    rgb = np.zeros((32, 64, 3), dtype=np.uint8)
    if left_bright:
        rgb[:, :32] = 220
        rgb[:, 32:] = 40
    else:
        rgb[:, :32] = 40
        rgb[:, 32:] = 220
    return rgb


def test_sun(tmp: Path) -> None:
    left_a = tmp / "left-a.png"
    left_b = tmp / "left-b.png"
    right = tmp / "right.png"
    save(shade(True), left_a)
    save(shade(True), left_b)
    save(shade(False), right)
    base = {"azimuthDeg": 120, "elevationDeg": 45, "kelvin": 5600, "heightM": 1}
    same = QC.report_sun({**base, "images": [str(left_a), str(left_b)]})
    check("sun one side", same["verdict"] == "PASS" and abs(same["numbers"]["shadowM"] - 1) < 1e-6, json.dumps(same))
    flip = QC.report_sun({**base, "images": [str(left_a), str(right)]})
    check("sun flipped", flip["verdict"] == "FAIL", json.dumps(flip))
    nok = QC.report_sun({"azimuthDeg": 120, "elevationDeg": 45, "heightM": 1})
    check("sun missing kelvin", nok["verdict"] == "FAIL" and any("kelvin" in line for line in nok["failures"]), json.dumps(nok))


def test_texel(tmp: Path) -> None:
    a = tmp / "tile-a.png"
    b = tmp / "tile-b.png"
    solid = np.full((64, 64, 3), 90, dtype=np.uint8)
    save(solid, a)
    save(solid, b)
    good = QC.report_texel({"tiles": [{"file": str(a), "meters": 0.90}, {"file": str(b), "meters": 0.90}]})
    check("texel constant", good["verdict"] == "PASS", json.dumps(good))

    big = tmp / "tile-big.png"
    save(np.full((64, 128, 3), 90, dtype=np.uint8), big)
    dense = QC.report_texel({"tiles": [{"file": str(a), "meters": 0.90}, {"file": str(big), "meters": 0.90}]})
    check("texel density spread", dense["verdict"] == "FAIL", json.dumps(dense))

    seam = tmp / "seam.png"
    split = np.zeros((64, 64, 3), dtype=np.uint8)
    split[:, :32] = (20, 20, 20)
    split[:, 32:] = (220, 220, 220)
    save(split, seam)
    seamed = QC.report_texel({"tiles": [{"file": str(seam), "meters": 0.90}]})
    check("texel seam", seamed["verdict"] == "FAIL" and any("seam" in line for line in seamed["failures"]), json.dumps(seamed))

    horiz = tmp / "tile-horiz.png"
    save(split_horizon(64, 32), horiz)
    has_h = QC.report_texel({"tiles": [{"file": str(horiz), "meters": 0.90}]})
    check("texel horizon", has_h["verdict"] == "FAIL" and any("horizon" in line for line in has_h["failures"]), json.dumps(has_h))


def test_scale() -> None:
    f_px = (720 / 2) / math.tan(math.radians(30))
    res = QC.report_scale({"fPx": f_px, "bolt": True, "distanceM": 6, "frameH": 1600, "measuredFrac": 0.039})
    check("scale bolt", res["verdict"] == "PASS" and abs(res["numbers"]["heightM"] - 0.60) < 1e-9, json.dumps(res))
    check("scale h_px", abs(res["numbers"]["hPx"] - 62.354) < 0.01, str(res["numbers"]["hPx"]))
    off = QC.report_scale({"fPx": f_px, "bolt": True, "distanceM": 6, "frameH": 1600, "measuredFrac": 0.10})
    check("scale measured 0.10", off["verdict"] == "FAIL", json.dumps(off))


def test_law23_untouched() -> None:
    check("inliers sealed", QC.INLIER_MIN == 0.75)
    check("sag sealed", QC.SAG_PX_MAX == 12.0)
    check("spread sealed", QC.SPREAD_MAX == 0.10)
    check("vpx sealed", QC.VPX_STD_MAX == 0.06)
    check("vpy sealed", QC.VPY_STD_MAX == 0.12)
    check("frame sealed", QC.FRAME == (720, 1280))


def test_cli(tmp: Path) -> None:
    missing = subprocess.run(
        [sys.executable, str(SCRIPT), "does-not-exist.mp4"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    check(
        "cli missing plate",
        missing.returncode == 1 and "missing file" in missing.stdout and "law 23" in missing.stdout,
        missing.stdout + missing.stderr,
    )
    bare = subprocess.run([sys.executable, str(SCRIPT)], cwd=ROOT, capture_output=True, text=True)
    check("cli no args", bare.returncode == 2, bare.stderr)
    both = subprocess.run(
        [sys.executable, str(SCRIPT), "--report", "horizon", "does-not-exist.mp4"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    check("cli report rejects plates", both.returncode == 2, both.stderr)


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="plate-geo-qc-self-") as raw:
        tmp = Path(raw)
        test_horizon(tmp)
        test_sky()
        test_turn()
        test_sun(tmp)
        test_texel(tmp)
        test_scale()
        test_law23_untouched()
        test_cli(tmp)
    print(f"{'PASS' if FAILS == 0 else 'FAIL'}  {FAILS} failed")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())

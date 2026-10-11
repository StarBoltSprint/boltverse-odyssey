#!/usr/bin/env python3
"""Self-test for the shared foundation helpers. No model weights, no browser, no Imagine."""
import os
import sys
import tempfile

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from common.capture_gate import check_capture  # noqa: E402
from common.frame_bbox import frame_view  # noqa: E402
from common.stage_clock import StageClock, StageOrderError  # noqa: E402
from common.vision_models import cached_array  # noqa: E402

# Fusion tower AABB (zoneb-tower-vision/vision/tower.glb), metres, y-up.
TOWER_MIN = [-24.434, -36.039, -26.530]
TOWER_MAX = [25.989, 173.772, 2.650]
FRONT = (0.0, 0.0, 1.0)

fails = []


def check(name, ok, detail=""):
    print(("PASS" if ok else "FAIL"), name, detail)
    if not ok:
        fails.append(name)


def solid(path, rgb, w=80, h=120, patch=None):
    im = Image.new("RGB", (w, h), rgb)
    if patch:
        box, colour = patch
        px = im.load()
        for y in range(box[1], box[3]):
            for x in range(box[0], box[2]):
                px[x, y] = colour
    im.save(path)


def main():
    for view in ("close", "low-portrait", "far"):
        pose = frame_view(TOWER_MIN, TOWER_MAX, view, 412, 915, FRONT)
        check(f"frame {view} cover", pose["coverEst"] >= 0.25, f"est {pose['coverEst']} fov {pose['fovY']}")
        check(f"frame {view} eye finite", all(np.isfinite(pose["eye"])))
    close = frame_view(TOWER_MIN, TOWER_MAX, "close", 412, 915, FRONT)
    low = frame_view(TOWER_MIN, TOWER_MAX, "low-portrait", 412, 915, FRONT)
    far = frame_view(TOWER_MIN, TOWER_MAX, "far", 412, 915, FRONT)
    check("close is 8 m", abs(close["distanceM"] - 8.0) < 1e-6, str(close["distanceM"]))
    check("low eye is 1.6 m", abs(low["eye"][1] - (TOWER_MIN[1] + 1.6)) < 1e-6, str(low["eye"][1]))
    check("far pulled back", far["distanceM"] >= 120.0, str(far["distanceM"]))
    for view in ("ortho-front", "ortho-side", "ortho-top"):
        pose = frame_view(TOWER_MIN, TOWER_MAX, view, 412, 915, FRONT)
        check(f"frame {view} cover", pose["coverEst"] >= 0.60, f"est {pose['coverEst']} {pose['width']}x{pose['height']}")

    with tempfile.TemporaryDirectory() as td:
        load = os.path.join(td, "load.png")
        empty = os.path.join(td, "empty.png")
        framed = os.path.join(td, "framed.png")
        black = os.path.join(td, "black.png")
        ortho = os.path.join(td, "ortho.png")
        solid(load, (0x1D, 0x14, 0x18), patch=((30, 40, 50, 55), (240, 240, 240)))
        solid(empty, (2, 2, 2))
        solid(framed, (8, 10, 14), patch=((10, 10, 60, 90), (180, 140, 60)))
        solid(black, (0, 0, 0))
        solid(ortho, (12, 12, 16), w=100, h=100, patch=((8, 8, 92, 92), (200, 160, 80)))
        a = check_capture(load, "frame", dom_text="Chargement… 17/20")
        b = check_capture(empty, "frame")
        c = check_capture(framed, "close")
        d = check_capture(black, "ortho-front")
        e = check_capture(ortho, "ortho-front")
        check("loading fails", (not a["ok"]) and a["loading"], a["why"])
        check("empty fails", (not b["ok"]) and b["empty"], b["why"])
        check("close 25% passes", c["ok"] and c["cover"] >= 0.25, str(c["cover"]))
        check("black ortho fails", (not d["ok"]) and d["black"], d["why"])
        check("filled ortho passes", e["ok"] and e["cover"] >= 0.60, str(e["cover"]))

        img = os.path.join(td, "subj.png")
        solid(img, (10, 20, 30), patch=((5, 5, 20, 20), (255, 0, 0)))
        calls = {"n": 0}

        def compute():
            calls["n"] += 1
            return np.arange(6, dtype=np.float32)

        os.environ["VISION_MODELS_DIR"] = td
        # cached_array uses the module CACHE captured at import. Point it at the temp dir.
        import common.vision_models as vm
        vm.CACHE = os.path.join(td, "cache")
        arr1, hit1, _t1 = cached_array("depth", "demo", img, "x", compute)
        arr2, hit2, _t2 = cached_array("depth", "demo", img, "x", compute)
        check("cache miss then hit", (not hit1) and hit2 and calls["n"] == 1 and np.array_equal(arr1, arr2))

    ref = np.zeros((8, 8), bool)
    ref[2:6, 2:6] = True
    colour = np.full((4, 4, 3), 0.4, np.float32)
    clock = StageClock()
    try:
        clock.heavy("build", lambda: 1)
        check("heavy blocked", False)
    except StageOrderError:
        check("heavy blocked", True)
    ok = clock.cheap(ref, ref, colour, colour)
    check("cheap passes", ok)
    out = clock.heavy("build", lambda: "ran")
    check("heavy after cheap", out == "ran" and clock.report()["cheapOk"] and clock.report()["heavyRan"] == 1)
    bad = StageClock()
    shifted = ref.copy()
    shifted[:] = False
    check("cheap colour/silhouette can fail", bad.cheap(ref, shifted, colour, np.zeros_like(colour)) is False)

    if fails:
        print(f"FAIL {len(fails)}: {', '.join(fails)}")
        sys.exit(1)
    print("PASS tools/common/selftest.py")


if __name__ == "__main__":
    main()

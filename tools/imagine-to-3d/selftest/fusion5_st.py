"""Fusion5 unit checks. No Grok vision, no SAM, no Blender."""
import os
import sys
import tempfile

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.abspath(os.path.join(HERE, "..")))
import fusion5


def test_cut_leak():
    hero = np.zeros((20, 20), bool)
    hero[2:18, 2:18] = True
    nb = np.zeros_like(hero)
    nb[2:18, 12:18] = True
    kept, leak = fusion5.cut_neighbours(hero, [nb], [(12, 2, 18, 18)], (6, 10))
    assert leak[0] == 0, leak
    assert kept[10, 6], "hero seed dropped"


def test_quantize():
    field = np.zeros((10, 10), np.float64)
    feat = np.zeros((10, 10), bool)
    feat[2:8, 2:8] = True
    field[feat] = np.linspace(0.2, 1.5, int(feat.sum()))
    out, levels = fusion5.quantize_planes(field, feat, 4)
    assert 1 <= len(levels) <= 4
    uniq = np.unique(np.round(out[np.abs(out) > 1e-6], 3))
    assert len(uniq) <= 4


def test_export_fail_writes_nothing():
    root = tempfile.mkdtemp()
    got = fusion5.export_dataset(root, "zoneb-tower-hero", False, {"why": "gate failed"})
    assert got["exported"] is False and got["count"] == 0
    assert not os.path.isdir(os.path.join(root, "dataset"))


def test_export_pass_files():
    root = tempfile.mkdtemp()
    view = {
        "name": "key-L0",
        "image": np.zeros((4, 4, 3), np.uint8),
        "depth": np.ones((4, 4), np.float32),
        "normal": np.zeros((4, 4, 3), np.float32),
        "normal_png": np.zeros((4, 4, 3), np.uint8),
        "mask": np.zeros((4, 4), np.uint8),
        "camera": fusion5.camera_json(0, 0, 10, 10, 2, 2, 4, 4),
    }
    got = fusion5.export_dataset(root, "obj", True, {
        "views": [view],
        "meta": {"method": "fusion5", "licences": {"moge-2": "MIT"}},
    })
    assert got["exported"] and got["count"] == 1
    base = os.path.join(root, "dataset", "i23d", "obj", "key-L0")
    for name in ("image.png", "depth.npy", "normal.npy", "normal.png", "mask.png", "camera.json"):
        assert os.path.isfile(os.path.join(base, name)), name
    cam = __import__("json").load(open(os.path.join(base, "camera.json")))
    assert len(cam["extrinsic_object_to_camera"]) == 4
    assert cam["units"] == "m"


def test_phone_and_rows():
    budget = fusion5.phone_budget(1000, 64, 64)
    assert budget["pass"] and budget["device"].startswith("Galaxy")
    ys = fusion5.dense_rows(0, 100, 0.5, fine_m=60, fine_step=0.22, coarse_step=1.5)
    assert ys[0] == 0 and ys[-1] == 100 and len(ys) > 8


def test_raster_depth():
    pos = [(-1, -1, -4), (1, -1, -4), (1, 1, -4), (-1, 1, -4)]
    faces = [(0, 1, 2), (0, 2, 3)]
    col = np.array([[200, 10, 10]] * 4, np.uint8)
    img = fusion5.raster_coloured(pos, faces, col, 32, 32, 40, 40, 16, 16)
    assert np.isfinite(img["depth"]).any()
    assert int(img["image"].sum()) > 0


def main():
    test_cut_leak()
    test_quantize()
    test_export_fail_writes_nothing()
    test_export_pass_files()
    test_phone_and_rows()
    test_raster_depth()
    print("fusion5_st ALL OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())

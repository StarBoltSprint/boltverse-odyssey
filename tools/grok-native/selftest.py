"""Classic pieces, no API and no model weights."""
from __future__ import annotations

import os
import subprocess
import sys
import tempfile

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import masks  # noqa: E402
import normals  # noqa: E402
import parametric  # noqa: E402
import register  # noqa: E402
import slab_mesh  # noqa: E402

fails = []


def check(name, ok, detail=""):
    print(("PASS" if ok else "FAIL"), name, detail)
    if not ok:
        fails.append(name)


def test_watertight():
    faces = slab_mesh.build_faces(4, 5)
    stats = slab_mesh.edge_stats(faces)
    check("slab watertight", stats["watertight"], str(stats))
    grid = [[{"x": 10 + c * 3, "y": 8 + r * 4, "relief_m": 0.1, "w": 40, "h": 30} for c in range(5)] for r in range(4)]
    pos, _uv = slab_mesh.build_positions(grid, 80, 80, 20, 15, 50, 6)
    check("vert count", len(pos) == 2 * 4 * 5, str(len(pos)))
    spec_path = None
    with tempfile.TemporaryDirectory() as td:
        import json
        spec = {"grid": grid, "fx": 80, "fy": 80, "cx": 20, "cy": 15, "Z0": 50, "depth_m": 6}
        spec_path = os.path.join(td, "slab.json")
        json.dump(spec, open(spec_path, "w"))
        proc = subprocess.run(["node", os.path.join(HERE, "tower.js"), spec_path], capture_output=True, text=True)
        data = json.loads(proc.stdout.strip()) if proc.stdout.strip() else {}
        js = np.array(json.load(open(data["positions"]))) if data.get("positions") else None
        ok = proc.returncode == 0 and js is not None and np.allclose(js, np.array(pos), atol=1e-6)
        check("node positions", ok, proc.stdout + proc.stderr)


def test_frankot():
    h = w = 64
    yy, xx = np.mgrid[0:h, 0:w]
    z = np.cos(2 * np.pi * xx / w) * np.cos(2 * np.pi * yy / h)
    p = -np.sin(2 * np.pi * xx / w) * (2 * np.pi / w) * np.cos(2 * np.pi * yy / h)
    q = -np.cos(2 * np.pi * xx / w) * np.sin(2 * np.pi * yy / h) * (2 * np.pi / h)
    zr = normals.frankot_chellappa(p, q)
    a = z - z.mean()
    b = zr - zr.mean()
    corr = float(np.dot(a.ravel(), b.ravel()) / (np.linalg.norm(a) * np.linalg.norm(b)))
    check("frankot cosine", corr > 0.98, f"corr {corr:.4f}")


def test_photo():
    true = np.array([0.25, -0.15, 0.95], np.float64)
    true = true / np.linalg.norm(true)
    names = list(normals.LIGHTS)
    L = np.stack([normals._unit(normals.LIGHTS[n]) for n in names])
    I = L @ true
    images = [(n, np.full((12, 12), float(v), np.float64)) for n, v in zip(names, I)]
    mask = np.ones((12, 12), bool)
    n, _alb, _resid, _used = normals.solve_normals(images, mask)
    got = n[6, 6]
    got = got / np.linalg.norm(got)
    ang = float(np.degrees(np.arccos(np.clip(np.dot(got, true), -1, 1))))
    check("photometric angle", ang < 2.0, f"{ang:.3f} deg {got}")


def test_ecc():
    key = np.zeros((80, 100, 3), np.uint8)
    cv2.rectangle(key, (20, 15), (70, 60), (180, 140, 40), -1)
    cv2.circle(key, (40, 35), 8, (20, 20, 20), -1)
    M = np.array([[1, 0, 4], [0, 1, -3]], np.float32)
    src = cv2.warpAffine(key, M, (100, 80))
    gray_k = cv2.cvtColor(key, cv2.COLOR_BGR2GRAY)
    gray_s = cv2.cvtColor(src, cv2.COLOR_BGR2GRAY)
    warp, info = register._ecc(gray_s, gray_k)
    back = cv2.warpAffine(src, warp, (100, 80), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP)
    ncc = register._ncc(cv2.cvtColor(back, cv2.COLOR_BGR2GRAY), gray_k, np.ones(gray_k.shape, bool))
    check("ecc shift", ncc > 0.95, f"ncc {ncc:.3f} ecc {info.get('ecc')}")


def test_proposals():
    seg = np.zeros((200, 320, 3), np.uint8)
    seg[:, :] = (180, 140, 40)  # sand-like in BGR is not our sand test; paint sky and two towers
    seg[:40, :] = (220, 160, 40)  # blue sky in BGR
    seg[50:180, 30:60] = (40, 40, 40)
    seg[40:190, 120:200] = (30, 30, 35)
    props = masks.structure_proposals(seg, min_area=200, max_n=6)
    ids = [p["id"] for p in props]
    check("two proposals", len(props) == 2 and ids == [1, 2], str(props))
    check("left to right", props[0]["cx"] < props[1]["cx"])
    mask = np.zeros((100, 40), np.uint8)
    mask[10:90, 8:32] = 1
    mask[50:70, 8:18] = 0
    m = parametric.measure_mask(mask, 100.0, 20.0)
    check("bite measured", m["bite_side"] == "left" and m["bite_frac"] > 0.3, str(m))
    check("box iou", abs(masks.box_iou([0, 0, 10, 10], [0, 0, 10, 10]) - 1) < 1e-6)


def main():
    test_watertight()
    test_frankot()
    test_photo()
    test_ecc()
    test_proposals()
    if fails:
        print("FAIL", ", ".join(fails))
        sys.exit(1)
    print("PASS tools/grok-native/selftest.py")


if __name__ == "__main__":
    main()

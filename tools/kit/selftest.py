#!/usr/bin/env python3
"""CPU selftest for tools/kit (no Blender, no GPU). Exit 0 = all rows pass."""
import json, struct, sys, tempfile
from pathlib import Path
import cv2, numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import kit as K  # noqa: E402
from build import build, fade  # noqa: E402
from fit import RULES, clamp, fit_camera  # noqa: E402
from geom import box, open_edges  # noqa: E402
from render import iou, look_at, silhouette  # noqa: E402

rows = []
def row(name, ok):
    rows.append(bool(ok)); print(("PASS " if ok else "FAIL ") + name)

spec = json.loads((HERE / "specs" / "zd-tier-v5.json").read_text())
spec["relief"]["res_m"] = [0.5, 1.0, 2.0]; spec["icicles"]["count"] = 8
row("subdivided box is closed", open_edges(box([0, 0, 0], [2, 1, 3], 0.25)) == 0)
row("distance fade 1 near, 0 far", fade(np.array([[0, 0, 0.], [20, 0, 0]]), [0, 0, 0], 4, 12).tolist() == [1.0, 0.0])
row("rule clamps MoGe tread 5.3 m -> 3.5 m", clamp("tread_m", 5.3) == RULES["tread_m"][1])
lods = build(spec)
t = {k: sum(m.tris() for m in v) for k, v in lods.items()}
row(f"LOD triangles fall {t}", t["lod0"] > t["lod1"] > t["lod2"])
row("lod0 solids closed after displacement", sum(open_edges(m) for m in lods["lod0"] if m.material != "ice") == 0)
lods2 = build(spec)
row("deterministic build", all(np.allclose(a.V, b.V) for a, b in zip(lods["lod0"], lods2["lod0"])))
d0 = [m for m in lods["lod0"] if m.name == "tier1-L"][0]
d2 = [m for m in lods["lod2"] if m.name == "tier1-L"][0]
row("lod0 has real relief, lod2 flat", np.ptp(d0.V[:, 1][d0.V[:, 1] < 0.5]) > 0.05 and np.ptp(d2.V[:, 1][d2.V[:, 1] < 0.5]) < 1e-6)
cam = look_at(spec["camera"]["pos"], spec["camera"]["target"], 60, 256, 256)
target = silhouette(lods["lod0"], cam)
row("self IoU = 1", iou(silhouette(lods["lod0"], cam), target) > 0.999)
bad = dict(spec); bad["camera"] = {**spec["camera"], "pos": [spec["camera"]["pos"][0] + 6, spec["camera"]["pos"][1] - 6, spec["camera"]["pos"][2]]}
cam_bad = look_at(bad["camera"]["pos"], bad["camera"]["target"], 60, 256, 256)
before = iou(silhouette(lods["lod2"], cam_bad), silhouette(lods["lod2"], cam))
_, after = fit_camera(bad, lods["lod2"], silhouette(lods["lod2"], cam), look_at, silhouette, iou, size=128, iters=2)
row(f"camera fit recovers IoU {before:.2f} -> {after:.2f}", after > before + 0.1)
with tempfile.TemporaryDirectory() as d:
    d = Path(d)
    sp = d / "spec.json"; sp.write_text(json.dumps(spec))
    full = silhouette(lods["lod0"], look_at(spec["camera"]["pos"], spec["camera"]["target"], 60, 1024, 1024))
    cv2.imwrite(str(d / "mask.png"), full.astype(np.uint8) * 255)
    rc = K.main(["build", "--spec", str(sp), "--out", str(d / "o"), "--mask", str(d / "mask.png"), "--no-sheet"])
    m = json.loads((d / "o" / "metrics.json").read_text())
    row(f"CLI PASS on matching mask (iou {m.get('iou_raw')}/{m.get('iou_closed')})", rc == 0 and m["verdict"] == "PASS")
    head = (d / "o" / "kit-lod0.glb").read_bytes()[:12]
    row("GLB header glTF v2", struct.unpack("<III", head)[:2] == (0x46546C67, 2))
    row("metrics fields", all(k in m for k in ["iou_raw", "iou_closed", "open_edges", "triangles", "px_per_m_texture", "repetition_peak", "dE_flat_vs_key"] if k != "dE_flat_vs_key"))
    spec2 = dict(spec); spec2["budget"] = {"lod0_tris": 100}; sp.write_text(json.dumps(spec2))
    row("CLI FAIL over triangle budget", K.main(["build", "--spec", str(sp), "--out", str(d / "o2"), "--no-sheet"]) == 1)
print(f"{sum(rows)}/{len(rows)} rows pass")
sys.exit(0 if all(rows) else 1)

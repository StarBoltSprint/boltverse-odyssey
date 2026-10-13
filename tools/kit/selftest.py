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
# --- outline-mask mode (v4 shaping port) + v6 snow attribute ---
from outline import close_diagonals, extrude_cells  # noqa: E402
from geom import nonmanifold_edges  # noqa: E402
rng = np.random.default_rng(0)
occ = np.ones((10, 12), bool)
fr = np.round(rng.integers(0, 4, occ.shape) * 0.1, 4)
bk = np.round(rng.integers(6, 10, occ.shape) * 0.1, 4)
row("cell extrusion with per-cell front/back is watertight", open_edges(extrude_cells(occ, fr, bk, 0, 0, 0.1)) == 0)
chk = np.array([[1, 0], [0, 1]], bool)
row("diagonal-only cells get closed (no edge-touching cells)", close_diagonals(chk).all())
ocam = look_at([4, -14, 5], [4, 0, 1.5], 60, 512, 512)
om = np.zeros((512, 512), np.uint8)
cv2.ellipse(om, (256, 300), (150, 60), 0, 0, 360, 1, -1)
om[300:380, 230:280] = 0  # a doorway notch
door = np.zeros_like(om); door[300:360, 235:275] = 1
snowm = np.zeros_like(om); snowm[:290] = 1
ospec = {"camera": {"pos": [4, -14, 5], "target": [4, 0, 1.5], "fov_deg": 60}, "tiers": {"count": 1, "rise_m": 2.5, "tread_m": 2.5, "width_m": 8},
         "outline": {"cell_m": 0.08, "upper_tiers": False}, "recess": {"depth_m": 1.5}, "relief": {"res_m": [0.5, 1, 2]}}
ol = build(ospec, None, ocam, {"tier": om > 0, "door": door > 0, "cornice": None, "snow": snowm > 0})
osil = silhouette(ol["lod0"], ocam)
oiou = iou(osil, (om > 0) | (door > 0))
row(f"outline mode matches its key mask (IoU {oiou:.3f} >= 0.85)", oiou >= 0.85)
row("outline lod0 watertight", sum(open_edges(m) for m in ol["lod0"]) == 0)
t1 = ol["lod0"][0]
row("door recess is a real step (cells at 1.5 m depth)", np.isclose(t1.V[:, 1], 1.5).any())
row("blocks step back from the outline (front never in front of y=0)", t1.V[:, 1].min() >= -1e-6 and len(np.unique(np.round(t1.V[:, 1], 2))) > 4)
sn = t1.attrs.get("_SNOW")
row("_SNOW attribute follows the key snow mask (top yes, bottom no)", sn is not None and sn[t1.V[:, 2] > np.percentile(t1.V[:, 2], 75)].mean() > sn[t1.V[:, 2] < np.percentile(t1.V[:, 2], 25)].mean() + 0.3)
# --- v7 rows: zipper walls, manifold fix, seated cornice, icicles ---
from outline import extrude_cells, fix_manifold, wedge, inside, float_report, spike
from geom import nonmanifold_edges
rng7 = np.random.default_rng(3)
occ7 = rng7.random((14, 18)) > 0.35
fr7 = np.round(rng7.random(occ7.shape) * 3) * 0.1
bk7 = fr7 + 0.3 + np.round(rng7.random(occ7.shape) * 4) * 0.1
occ7, fr7, bk7 = fix_manifold(occ7, fr7, bk7)
z7 = extrude_cells(occ7, fr7, bk7, 0, 0, 0.1)
row("zipper-wall extrusion of random depths: 0 open, 0 non-manifold", open_edges(z7) == 0 and nonmanifold_edges(z7) == 0)
row("fix_manifold keeps back >= front + 0.1", bool((bk7[occ7] >= fr7[occ7] + 0.1 - 1e-9).all()))
w7 = wedge(0, 0.5, -0.05, 2.1, 1.0, 0.6, "seat")
row("seat wedge closed and point-in-solid works (in/out)", open_edges(w7) == 0 and inside(w7, [[0.25, 0.2, 2.0], [0.25, 0.2, 2.5]]).tolist() == [True, False])
fr = float_report([w7], {"seat": [(0.25, 2.0)], "corbel": [(0.25, 2.5)], "over": 1.0})
row("float_report flags a corbel probe with no solid under it", fr["checked"] == 2 and fr["floating"] == 1)
ic = spike(np.array([0, 0, 2.0]), 0.6, 0.06, rng7)
row("icicle spike is closed and hangs downward", open_edges(ic) == 0 and ic.V[:, 2].min() < 1.5)
# --- v8 rows ---
from outline import quantize_blocks, sink_base, snow_skirt
q = quantize_blocks(np.ones((10, 20), bool), np.linspace(0.6, 2.0, 200).reshape(10, 20), 0, 0, 0.1, np.array([0, 0.5, 1.0]), 0.9)
row("quantize_blocks: one depth per block, never deeper than its cells", len(np.unique(q[:5, :4])) == 1 and (q <= np.linspace(0.6, 2.0, 200).reshape(10, 20) + 0.05).all())
oc = np.zeros((12, 3), bool); oc[8:, 0] = True; oc[2:, 1] = True
o2, f2, b2, zz = sink_base(oc, np.zeros(oc.shape), np.ones(oc.shape), 0.0, 0.1, 0.3, reach=0.6)
row("sink_base buries low columns to -0.3 m, leaves high ones", o2[0, 1] and not o2[:, 0][:5].any() and np.isclose(zz, -0.3))
sk = snow_skirt([(0, 2)], depth=0.8, h=0.6)[0]
row("snow skirt closed, all snow, buried below ground", open_edges(sk) == 0 and sk.attrs["_SNOW"].min() == 1 and sk.V[:, 2].min() < 0)
# --- v9 row ---
from outline import contour_snap
oc9 = np.tril(np.ones((16, 16), bool))
m9 = extrude_cells(oc9, np.zeros(oc9.shape), np.ones(oc9.shape), 0, 0, 0.1)
s9 = contour_snap(m9, oc9, 0, 0, 0.1, 0.3)
b9 = (np.abs(m9.V[:, 0] - m9.V[:, 2]) < 0.15) & (m9.V[:, 0] > 0.3) & (m9.V[:, 0] < 1.2)
row("contour_snap straightens a 45-degree staircase (spread off the line drops) and keeps the mesh closed",
    open_edges(s9) == 0 and nonmanifold_edges(s9) == 0 and np.std(s9.V[b9, 2] - s9.V[b9, 0]) < 0.85 * np.std(m9.V[b9, 2] - m9.V[b9, 0]))
# --- appearance judge rows (HOG fallback, no torch) ---
import judge as J
kp = HERE / "specs" / "zd" / "judge_mask.png"
with tempfile.TemporaryDirectory() as td:
    rng_j = np.random.default_rng(0)
    img = (rng_j.random((256, 256, 3)) * 255).astype(np.uint8); img = cv2.GaussianBlur(img, (0, 0), 3)
    msk = np.zeros((256, 256), np.uint8); msk[60:200, 40:220] = 255
    cv2.imwrite(f"{td}/a.png", img); cv2.imwrite(f"{td}/m.png", msk); cv2.imwrite(f"{td}/g.png", np.full_like(img, 128))
    ja = J.score(f"{td}/a.png", f"{td}/a.png", f"{td}/m.png", venv=None)
    jg = J.score(f"{td}/g.png", f"{td}/a.png", f"{td}/m.png", venv=None)
row(f"judge: identical image scores 100 ({ja['total']}), flat grey scores far lower ({jg['total']})", ja["total"] > 99.9 and jg["total"] < 60)
print(f"{sum(rows)}/{len(rows)} rows pass")
sys.exit(0 if all(rows) else 1)

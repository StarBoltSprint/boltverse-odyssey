#!/usr/bin/env python3
"""CPU selftest for tools/scatter (scatter + detail layers). Exit 0 = all rows pass."""
import json, sys, tempfile
from pathlib import Path
import cv2, numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import detail as D  # noqa: E402
import scatter as S  # noqa: E402

rows = []
def row(name, ok):
    rows.append(bool(ok)); print(("PASS " if ok else "FAIL ") + name)

rng = np.random.default_rng(1)
P = S.poisson_disk(10, 10, 0.5, rng)
dmin = min(np.linalg.norm(P[i] - P[j]) for i in range(len(P)) for j in range(i + 1, len(P)))
row(f"Poisson-disk min spacing {dmin:.3f} >= 0.5 ({len(P)} pts)", dmin >= 0.5 - 1e-9 and len(P) > 150)
with tempfile.TemporaryDirectory() as d:
    d = Path(d)
    left = np.zeros((128, 128), np.uint8); left[:, :64] = 255          # density only on the left half (x < 10)
    cv2.imwrite(str(d / "dens.png"), left)
    H = np.tile(np.linspace(0, 1, 128)[None], (128, 1)).astype(np.float32); H[:, 100:] = np.linspace(0, 1, 128)[100:] * 40  # steep right edge
    np.save(d / "h.npy", H)
    spec = {"seed": 7, "extent_m": [0, 0, 20, 20], "heightfield": {"path": "h.npy", "scale_m": 1.0},
            "path": {"polyline": [[5, 0], [5, 20]], "clearance_m": 1.5},
            "props": [{"id": "rock", "tris": 60, "min_spacing_m": 0.8, "density_mask": "dens.png", "slope_deg": [0, 30], "radius_m": 0.3},
                      {"id": "tuft", "tris": 24, "min_spacing_m": 0.6, "slope_deg": [0, 20], "max_instances": 150}],
            "budget": {"draw_calls": 4, "triangles": 40000, "instances": 3000}}
    (d / "s.json").write_text(json.dumps(spec))
    r1 = S.run(spec, d); r2 = S.run(spec, d)
    row("deterministic for a seed", json.dumps(r1) == json.dumps(r2))
    row(f"PASS within budget {r1['totals']}", r1["verdict"] == "PASS")
    rock = np.array([i[:2] for i in r1["types"][0]["instances_xyz_yaw_scale"]])
    row("density mask respected (rocks only x<10)", len(rock) > 20 and rock[:, 0].max() <= 10.2)
    allp = np.array([i[:2] for t in r1["types"] for i in t["instances_xyz_yaw_scale"]])
    row("no prop within path clearance", S.seg_dist(allp, [[5, 0], [5, 20]]).min() >= 1.5)
    row("slope rule drops steep strip (x>15.7)", allp[:, 0].max() < 15.8)
    row("max_instances cap", r1["types"][1]["count"] <= 150)
    row("one draw call per prop type", r1["totals"]["draw_calls"] == 2)
    spec["budget"]["triangles"] = 500
    row("FAIL over triangle budget", S.run(spec, d)["verdict"] == "FAIL")
    # detail layers
    hm = np.zeros((128, 128), np.float32); hm[40:80, 40:80] = 1.0; np.save(d / "dh.npy", hm)
    km = np.zeros((128, 128), np.uint8); km[:, 64:] = 255; cv2.imwrite(str(d / "keysnow.png"), km)
    keyimg = np.zeros((128, 128), np.uint8); keyimg[64:, :] = 200; cv2.imwrite(str(d / "key.png"), keyimg)
    dspec = {"size_px": [128, 128], "extent_m": [0, 0, 10, 10], "height": "dh.npy", "key": "key.png", "seed": 3,
             "layers": [{"id": "snow", "mask": "keysnow.png", "up_facing": 0.9, "height_scale": 20, "decals": 10},
                        {"id": "dirt", "cavity": 4.0, "cavity_px": 6},
                        {"id": "cracks", "edges": 1.0},
                        {"id": "moss", "mask": "keysnow.png", "cavity": 4.0, "strength": 0.5}]}
    (d / "d.json").write_text(json.dumps(dspec))
    r = D.run(dspec, d, d / "out")
    L = {l["id"]: l for l in r["layers"]}
    snow = cv2.imread(str(d / "out" / "layer-snow.png"), 0)
    row("snow follows key mask (right half only)", snow[:, :50].max() == 0 and snow[:, 70:].mean() > 50)
    row("snow avoids steep block edges", snow[40, 40] < snow[60, 60])
    row("cracks follow key edges (row 64)", cv2.imread(str(d / "out" / "layer-cracks.png"), 0)[62:67].mean() > cv2.imread(str(d / "out" / "layer-cracks.png"), 0)[:40].mean())
    row("decals seeded inside snow mask", len(L["snow"]["decals"]) == 10 and min(x[0] for x in L["snow"]["decals"]) >= 4.5)
    row("all four layers written", r["verdict"] == "PASS" and len(r["layers"]) == 4)
print(f"{sum(rows)}/{len(rows)} rows pass")
sys.exit(0 if all(rows) else 1)

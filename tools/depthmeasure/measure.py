"""Standalone relief depth measure (tools/13): real geometry depth under each relief vs the depth its pixels read as.
python3 -m tools.depthmeasure.measure <spec.json> <a.glb>[:label] [<b.glb>[:label] ...] --out DIR
- Renders each GLB at phone settings (DPR 2.6, internal ratio 1.5, vfov 48) from the spec's views (45 deg and grazing,
  camera 3 m and 8 m) and reads back a float world-position + uv buffer of the frame (the depth buffer, metric).
- Reliefs are plate-pixel regions (spec). apparent_m = MoGe-2 metric depth of the plate (independent of the mesh);
  real_m = mesh points under those pixels vs the wall plane fitted under the spec's wall pixels. PASS: real >= 0.7 x apparent.
- Outline (grazing views): silhouette pixels must leave the wall plane by >= spec.outline_break_m.
Writes DIR/depth-table.json and DIR/<label>-<view>.jpg only."""
import json, os, subprocess, sys
import numpy as np
from scipy import ndimage as ndi
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
K = 0.7


def region_masks(spec):
    L = np.asarray(Image.open(spec["plate"]).convert("L")).astype(float); d = np.load(spec["moge_depth"]); hp = d - ndi.gaussian_filter(d, 6)
    M = {}
    for R in spec["reliefs"]:
        m = np.zeros_like(L, bool); x0, y0, x1, y1 = R["box"]; m[y0:y1, x0:x1] = True
        if "luma_below" in R: m &= ndi.gaussian_filter(L, 1) < R["luma_below"]
        if "luma_above" in R: m &= L > R["luma_above"]
        M[R["name"]] = m
    wall = np.zeros_like(L, bool); x0, y0, x1, y1 = spec["wall_box"]; wall[y0:y1, x0:x1] = True
    for R in spec["reliefs"]:
        if R["kind"] != "texture": wall &= ~M[R["name"]]
    wd = float(np.median(d[wall])); app = {}
    for R in spec["reliefs"]:
        m = M[R["name"]]
        if R["kind"] == "recess": a = float(np.median(d[m]) - wd)
        elif R["kind"] == "protrusion": a = float(wd - np.median(d[m]))
        else: a = float(np.percentile(hp[m], 95) - np.percentile(hp[m], 5))
        if "cap_m" in R: a = min(a, R["cap_m"])
        app[R["name"]] = round(max(a, R.get("floor_m", 0.0)), 3)
    return M, wall, app


def measure(res, spec, M, wall, app, grazing):
    if res.get("frame") is None and spec.get("auto_frame"): return dict(error="auto_frame found no %s vertices facing %s with uv in wall_box" % (spec.get("material"), spec.get("facing")))
    a = [h for h in res["hits"] if spec.get("material") in (None, h[4])]
    if not a: return dict(error="no hits on material %s" % spec.get("material"))
    px = np.array([[min(1023, max(0, int(h[2] * 1024))), min(1023, max(0, int(h[3] * 1024)))] for h in a]); P = np.array([h[5:8] for h in a]); ij = np.array([h[:2] for h in a])
    ws = wall[px[:, 1], px[:, 0]]
    if ws.sum() < 20: return dict(error="wall pixels not in view")
    c = P[ws].mean(0); _, _, vt = np.linalg.svd(P[ws] - c, full_matrices=False); n = vt[2]
    if n @ (np.array(res["camPos"]) - c) < 0: n = -n
    z = (P - c) @ n
    row = {}
    for R in spec["reliefs"]:
        s = M[R["name"]][px[:, 1], px[:, 0]]
        if s.sum() < 8: row[R["name"]] = None; continue
        if R["kind"] == "recess": real = float(-np.median(z[s]))
        elif R["kind"] == "protrusion": real = float(np.median(z[s]))
        else: real = float(np.percentile(z[s], 95) - np.percentile(z[s], 5))
        A = app[R["name"]]
        row[R["name"]] = dict(n=int(s.sum()), real_m=round(real, 3), apparent_m=A, ratio=round(real / A, 2) if A else None, pass_=bool(real >= K * A))
    if grazing:
        occ = np.zeros((res["H"], res["W"]), bool); occ[ij[:, 1], ij[:, 0]] = True
        e = (occ & ~ndi.binary_erosion(occ))[ij[:, 1], ij[:, 0]]
        brk = float(np.percentile(z[e], 99)) if e.any() else 0.0
        row["outline"] = dict(maxOutOfPlane_m=round(brk, 3), need_m=spec["outline_break_m"], pass_=bool(brk >= spec["outline_break_m"]))
    return row


def main():
    a = sys.argv[1:]; spec = json.load(open(a[0])); out = os.path.abspath(a[a.index("--out") + 1])
    models = [dict(glb=os.path.abspath(x.rsplit(":", 1)[0] if x.count(":") else x), label=(x.rsplit(":", 1)[1] if x.count(":") else os.path.splitext(os.path.basename(x))[0]))
              for x in a[1:] if ".glb" in x]
    os.makedirs(out, exist_ok=True); views = spec["views"]
    job = dict(facing=spec.get("facing"), auto=spec["wall_box"] if spec.get("auto_frame") else None, material=spec.get("material"), three=spec["three"], jsm=spec["jsm"], plates=spec.get("plates", {}), out=out, dpr=2.6, ratio=1.5, models=models, views=views)
    jp = os.path.join(out, "job.json"); json.dump(job, open(jp, "w")); subprocess.run(["node", os.path.join(HERE, "measure.mjs"), jp], check=True)
    M, wall, app = region_masks(spec); T = {}
    for m in models:
        for v in views:
            hp = os.path.join(out, f"hits-{m['label']}-{v['name']}.json")
            T[f"{m['label']}/{v['name']}"] = measure(json.load(open(hp)), spec, M, wall, app, v.get("grazing", False)); pass
    os.remove(jp)
    ok = {m["label"]: all(not ("error" in T[f"{m['label']}/{v['name']}"]) and all(x is None or x["pass_"] for x in T[f"{m['label']}/{v['name']}"].values()) for v in views) for m in models}
    json.dump(dict(rule=f"real >= {K} x apparent (MoGe-2), outline leaves wall plane at grazing", apparent=app, table=T, pass_=ok), open(os.path.join(out, "depth-table.json"), "w"), indent=1)
    for k, r in T.items():
        if "error" in r: print(k, r); continue
        print(k.ljust(22), " | ".join((f"{n}: {x['real_m']:.3f}/{x['apparent_m']:.2f}={x['ratio']}{'' if x['pass_'] else ' FAIL'}" if "real_m" in x else f"outline {x['maxOutOfPlane_m']:.2f} m{'' if x['pass_'] else ' FAIL'}") if x else f"{n}: -" for n, x in r.items()))
    print("PASS" if all(ok.values()) else "FAIL", ok); sys.exit(0 if all(ok.values()) else 1)


if __name__ == "__main__":
    main()

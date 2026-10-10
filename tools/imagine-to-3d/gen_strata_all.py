"""Build strata geometry for every placement; auto-fix loop: re-seed until repeatClash == 0 and adjSamePlate == 0,
min px/m >= 64 and max stretch <= 1.3 (gate rows), max 6 seeds. Runs placements in parallel.
imagine-to-3d auto (2026-10-10): PLACEMENTS='[["id", scale], ...]' (default = the 9 Zone B mesas), MIN_PXM, MAX_STRETCH;
with strata2 (continuous strata) the repetition rows are group-aware (near-duplicate Imagine edits count as one image)."""
import json, subprocess, sys, os, concurrent.futures as cf
D = os.path.dirname(os.path.abspath(__file__))
work, front, top, outdir = sys.argv[1:5]
PL0 = [("L-mid", 1.25), ("L-mid2", 1.05), ("L-far", 1.6), ("R-butte", 1.7), ("R-mid", 1.35), ("R-band", 2.0), ("B-left", 1.7), ("B-right", 1.5), ("B-far", 2.2)]
PL0 = [tuple(p) for p in json.loads(os.environ["PLACEMENTS"])] if os.environ.get("PLACEMENTS") else PL0
MIN_PXM = float(os.environ.get("MIN_PXM", "64")); MAX_STRETCH = float(os.environ.get("MAX_STRETCH", "1.3"))
PL = [p for p in PL0 if not os.environ.get("ONLY") or p[0] in os.environ["ONLY"].split(",")]
IDX = {p[0]: i + 1 for i, p in enumerate(PL0)}
KEY_CROP = os.environ.get("KEY_CROP")          # outline IoU vs the key crop (>= IOU_MIN) is a gate row too
IOU_MIN = float(os.environ.get("IOU_MIN", "0.87"))
def rows(out, iou_known=None):
    d = json.load(open(out + "-geo.json"))
    n = lambda v: sum(v.values()) if isinstance(v, dict) else v
    clash = n(d.get("repeatClashGroups", d["repeatClash"])); adj = n(d.get("adjSameGroup", d["adjSamePlate"]))
    ok = all(l["stretch"].get("nonManifoldEdges", 0) == 0 for l in d["lods"]) and clash == 0 and adj == 0 and all(l["stretch"]["minPxPerM"] >= MIN_PXM and l["stretch"]["maxStretch"] <= MAX_STRETCH for l in d["lods"])
    iou = iou_known
    if iou is not None: return ok and iou >= IOU_MIN, d, iou   # same shape seed: silhouette unchanged by window salts
    if KEY_CROP:
        r = subprocess.run(["python3", f"{D}/outline_iou.py", KEY_CROP, out], capture_output=True, text=True)
        iou = json.loads(r.stdout.strip().splitlines()[-1])[out]["iou"]; ok = ok and iou >= IOU_MIN
    return ok, d, iou
def n_(v): return sum(v.values()) if isinstance(v, dict) else v
def one(i, pid, sc):
    # search seeds fast without relief (silhouette, windows, repetition are relief-independent), then build the
    # chosen seed with the depth relief and re-check every row
    relief = os.environ.get("RELIEF_DIR", "-")
    for k in range(int(os.environ.get("MAX_SEEDS", "10"))):
        seed = 1008 + i * 37 + k * 1000
        out = f"{outdir}/{pid}"
        for salt in range(int(os.environ.get("SALTS", "5"))):   # shape fails (IoU) -> next seed; only window rows fail -> re-roll windows, keep the shape
            subprocess.run(["python3", f"{D}/" + os.environ.get("GEN", "strata.py"), f"{work}/" + os.environ.get("HULL", "mesaA"), front, top, out, str(sc), str(seed), "-"], capture_output=True, text=True, env=dict(os.environ, WSALT=str(salt)))
            ok, d, iou = rows(out, iou if salt else None)
            if ok or (iou is not None and iou < IOU_MIN): break
        if not ok: continue
        if relief != "-":
            subprocess.run(["python3", f"{D}/" + os.environ.get("GEN", "strata.py"), f"{work}/" + os.environ.get("HULL", "mesaA"), front, top, out, str(sc), str(seed), relief], capture_output=True, text=True, env=dict(os.environ, WSALT=str(salt)))
            ok, d, iou = rows(out)
            if not ok: continue
        return pid, seed, k, True, n_(d.get("repeatClashGroups", d["repeatClash"])), [l["tris"] for l in d["lods"]], iou, salt
    return pid, seed, k, False, n_(d.get("repeatClashGroups", d["repeatClash"])), [l["tris"] for l in d["lods"]], iou
with cf.ThreadPoolExecutor(9) as ex:
    res = list(ex.map(lambda a: one(*a), [(IDX[p], p, s) for (p, s) in PL]))
for r in res: print(r)
json.dump(res, open(f"{outdir}/gen-summary.json", "w"))

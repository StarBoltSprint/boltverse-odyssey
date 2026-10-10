"""Build strata geometry for every placement; auto-fix loop: re-seed until repeatClash == 0 and adjSamePlate == 0,
min px/m >= 64 and max stretch <= 1.3 (gate rows), max 6 seeds. Runs placements in parallel."""
import json, subprocess, sys, os, concurrent.futures as cf
D = os.path.dirname(os.path.abspath(__file__))
work, front, top, outdir = sys.argv[1:5]
PL = [("L-mid", 1.25), ("L-mid2", 1.05), ("L-far", 1.6), ("R-butte", 1.7), ("R-mid", 1.35), ("R-band", 2.0), ("B-left", 1.7), ("B-right", 1.5), ("B-far", 2.2)]
def one(i, pid, sc):
    for k in range(10):
        seed = 1008 + i * 37 + k * 1000
        out = f"{outdir}/{pid}"
        r = subprocess.run(["python3", f"{D}/strata.py", f"{work}/" + os.environ.get("HULL", "mesaA"), front, top, out, str(sc), str(seed), os.environ.get("RELIEF_DIR", "-")], capture_output=True, text=True)
        d = json.load(open(out + "-geo.json"))
        ok = all(l["stretch"].get("nonManifoldEdges", 0) == 0 for l in d["lods"]) and d["repeatClash"] == 0 and d["adjSamePlate"] == 0 and all(l["stretch"]["minPxPerM"] >= 64 and l["stretch"]["maxStretch"] <= 1.3 for l in d["lods"])
        if ok: return pid, seed, k, True, d["repeatClash"], [l["tris"] for l in d["lods"]]
    return pid, seed, k, False, d["repeatClash"], [l["tris"] for l in d["lods"]]
with cf.ThreadPoolExecutor(9) as ex:
    res = list(ex.map(lambda a: one(*a), [(i + 1, p, s) for i, (p, s) in enumerate(PL)]))
for r in res: print(r)
json.dump(res, open(f"{outdir}/gen-summary.json", "w"))

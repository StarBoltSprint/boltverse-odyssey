#!/usr/bin/env python3
"""Build the hero-tower staging dir. Writes only /workspace/kc-staging/zb-tower1."""
import json, os, shutil, sys
sys.path.insert(0, "/workspace/kc-wt/tools/imagine-to-3d")
import kc_stage as KS

LIVE = "/workspace/zb-preview-1008"
OUT = "/workspace/kc-staging/zb-tower1"
LAY = "/workspace/zb-bible-1008/compare/run3/place/layout-v2.json"
ROOT = "/workspace/grokcli/wt/tower-hybrid-1010"
SCRATCH = "/workspace/zb-tower-hybrid-1010"

os.makedirs(OUT + "/mesas", exist_ok=True)
for f in ("kc-light.json", "mesas/kc-params.json"):
    src = "/workspace/kc-staging/zb/" + f
    if os.path.exists(src) and not os.path.exists(OUT + "/" + f):
        shutil.copy(os.path.realpath(src), OUT + "/" + f)

KS.build(LIVE, OUT, LAY)
p = OUT + "/objects1/layout.json"
L = json.load(open(p))
drop = {"t0-m2", "t2-m3"}
L["towers"] = [t for t in L["towers"] if t["id"] not in drop]
L.setdefault("kcLayout", {})["dropped"] = sorted(drop)
json.dump(L, open(p, "w"), indent=1)
open(OUT + "/KC-STAGING.txt", "a").write("tower-hybrid-1010: dropped t0-m2 and t2-m3, hero wedge in the t2-m3 slot\n")

qc = json.load(open(SCRATCH + "/mesh/qc.json"))
pack = json.load(open(SCRATCH + "/tex/pack.json"))
qc["pack"] = pack
qc["sand"] = pack["sand"]
json.dump(qc, open(OUT + "/tower-meta.json", "w"))
shutil.copy(SCRATCH + "/mesh/tower.bin", OUT + "/tower.bin")
shutil.copy(SCRATCH + "/mesh/albedo-key.png", OUT + "/albedo-key.png")
os.makedirs(OUT + "/tex", exist_ok=True)
for name in ("left", "right", "back"):
    for ext in ("-y.bin", "-c.bin"):
        shutil.copy(SCRATCH + "/tex/" + name + ext, OUT + "/tex/" + name + ext)
shutil.copy(ROOT + "/tools/imagine-to-3d/hybrid/tower.mjs", OUT + "/tower.mjs")

idx = open(OUT + "/index.html").read()
page = idx.replace("</body>", '<script type="module" src="./tower.mjs?v=1"></script>\n</body>')
page = page.replace("<title>Zone B — aperçu</title>", "<title>Zone B — tower hybrid</title>")
open(OUT + "/index-tower1.html", "w").write(page)
print("staged", OUT, "towers", len(L["towers"]))

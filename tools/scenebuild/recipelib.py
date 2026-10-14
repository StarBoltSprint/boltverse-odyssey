#!/usr/bin/env python3
"""tools/scenebuild/recipelib.py - validate the type recipes on built zones and record them in recipes/library.json.
For each zone (SHEET OUT PORT, already optimised: OUT/opt.json + OUT/optimize.json), re-score the after-loop
scene, group the per-element auto_check rows by type, and mark a recipe validated when its elements' median row
>= PASS on at least one zone with >= 3 elements. The library stores the recipe hash so a changed recipe must be
re-validated before other zones reuse it.
usage: recipelib.py ZONE=SHEET,OUT,PORT [ZONE=...]"""
import hashlib, json, sys
from pathlib import Path
import numpy as np
HERE = Path(__file__).resolve().parent; sys.path.insert(0, str(HERE))
import score as S  # noqa: E402

PASS = 40.0


def main():
    lib_p = HERE / "recipes" / "library.json"; lib = json.loads(lib_p.read_text()) if lib_p.exists() else {}
    for arg in sys.argv[1:]:
        zone, rest = arg.split("="); sheet, out, port = rest.split(",")
        o = json.loads((Path(out) / "optimize.json").read_text()); opt = json.loads((Path(out) / "opt.json").read_text())
        s, rows, info = S.score(sheet, out, port, opt, "lib", o["first"]["gain"])
        by = {}
        for eid, (t, _) in info["elements"].items():
            if eid in rows:
                by.setdefault(t, []).append(rows[eid])
        for f in sorted((HERE / "recipes").glob("*.json")):
            if f.name == "library.json":
                continue
            t = f.stem; v = by.get(t, []); h = hashlib.sha1(f.read_bytes()).hexdigest()[:10]
            ent = lib.setdefault(t, {"file": f"recipes/{f.name}", "zones": {}})
            if ent.get("sha") != h:
                ent["zones"] = {}; ent["sha"] = h
            ent["zones"][zone] = {"n": len(v), "median_row": round(float(np.median(v)), 1) if v else None,
                                  "pass": bool(v) and len(v) >= 3 and float(np.median(v)) >= PASS}
            ent["validated"] = any(z["pass"] for z in ent["zones"].values())
        print(zone, json.dumps({t: lib[t]["zones"][zone] for t in lib if zone in lib[t]["zones"]}))
    lib_p.write_text(json.dumps(lib, indent=1, sort_keys=True))


if __name__ == "__main__":
    main()

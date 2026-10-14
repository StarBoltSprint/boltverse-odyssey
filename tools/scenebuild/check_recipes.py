#!/usr/bin/env python3
"""lint every recipes/*.json: known ops only, expressions over bind() names only, finite non-empty mesh within
a sane size for a 1 m element. Run after adding a recipe (no code needed to add a shape)."""
import json, sys
from pathlib import Path
import numpy as np
HERE = Path(__file__).resolve().parent; sys.path.insert(0, str(HERE))
import ops as O  # noqa: E402
ENV = {"w": 1.0, "h": 0.6, "th": 0.2, "d": 0.2, "rough": 0.3, "snow": 0.5, "joint": 0.03, "px": 0.5, "nx": 2.0, "drips": 3.0, "ch": 0.3, "bw": 0.5, "jv": 0.2, "lod": 6.0}
bad = 0
for f in sorted((HERE / "recipes").glob("*.json")):
    if f.name == "library.json":
        continue
    try:
        R = json.loads(f.read_text()); V, F = O.run(R, ENV, 0); ok_wt = O.watertight(V, F)
        [O.ev(x, ENV) for x in R.get("offset", [0, 0, 0])]
        ok = ok_wt and len(F) > 0 and np.isfinite(V).all() and np.abs(V).max() < 10 and F.max() < len(V)
        print(("ok  " if ok else "BAD ") + f.stem, len(V), len(F)); bad += not ok
    except Exception as e:
        print("BAD", f.stem, e); bad += 1
sys.exit(1 if bad else 0)

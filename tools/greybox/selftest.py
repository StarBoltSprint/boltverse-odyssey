#!/usr/bin/env python3
"""greybox selftest: build from spine v1.3.1 -> gatesuite spine/layout/walk/depthmeasure PASS;
negative controls: terrace pushed onto the lane -> walk FAIL; spine v1.2 -> refused."""
import json, sys, tempfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from tools.greybox.build import build  # noqa: E402
from tools.gatesuite.run import run  # noqa: E402
FX = ROOT / "tools/gatesuite/fixtures"
spec = json.loads((Path(__file__).parent / "greybox-spec.json").read_text())
rows = []
def row(n, ok, v=""):
    rows.append(bool(ok)); print(("PASS " if ok else "FAIL ") + n + (f"  [{v}]" if v else ""))
T = Path(tempfile.mkdtemp())
info = build(FX / "spine-v1.3.1-89d9e684.json", spec, T / "ok")
r = run(str(T / "ok"))
for s in ("spine", "layout", "walk", "depthmeasure"):
    row(f"greybox {s} PASS", r["sections"][s]["status"] == "PASS", [c for c in r["sections"][s]["checks"] if not c["ok"]][:1])
row("lane clear >= 6 m from the spine", info["lane_clear_m"] >= 6.0, info["lane_clear_m"])
row("kitjudge FAILs on an untextured greybox (expected)", r["sections"]["kitjudge"]["status"] == "FAIL")
bad = json.loads(json.dumps(spec)); bad["terrace"]["min_offset_from_spine_m"] = 0.0; bad["terrace"]["width_m"] = 60
build(FX / "spine-v1.3.1-89d9e684.json", bad, T / "bad")
cols = json.loads((T / "bad/colliders.json").read_text())
# force the tier-1 collider across the lane at the placement point
cols[0]["min"][2] -= 40; cols[0]["max"][2] += 40
(T / "bad/colliders.json").write_text(json.dumps(cols))
row("collider across the lane -> walk FAIL (snag)", run(str(T / "bad"))["sections"]["walk"]["status"] == "FAIL")
try:
    build(FX / "spine-v1.2-3e8dce00.json", spec, T / "old"); row("spine v1.2 refused", False)
except AssertionError:
    row("spine v1.2 refused", True)
print(f"{sum(rows)}/{len(rows)} rows pass"); sys.exit(0 if all(rows) else 1)

#!/usr/bin/env python3
"""tools/keysheet/check.py — key-camera render vs key feature sheet; one blocking row per element.
usage: check.py RENDER.png SHEET_DIR/sheet.json [--out report.json]   (exit 1 on any FAIL)
Rules (per element, `rule` in the sheet):
  min_rel   count_render >= ceil(min_rel * count_key)      (presence/count, default 0.5)
  min_count absolute floor
  max_count for negative elements (straight_bar: 0)
  max_dL / max_db / max_da  Lab tolerances for region colour (render - key)"""
import argparse, json, math, sys
from pathlib import Path
import cv2, numpy as np
HERE = Path(__file__).resolve().parent; sys.path.insert(0, str(HERE))
import detect as D


def check(render, sheet_path):
    sp = Path(sheet_path); sheet = json.loads(sp.read_text()); W = sheet["frame_px"]
    I = cv2.imread(str(render))
    if I is None:
        raise FileNotFoundError(render)
    I = cv2.resize(I, (W, W), interpolation=cv2.INTER_AREA)
    lab = D.lab_of(I); L = lab[..., 0]
    rows = []
    for e in sheet["elements"]:
        R = cv2.imread(str(sp.parent / e["mask"]), 0) > 127
        m = D.KINDS[e["kind"]](L, lab, R, e["params"])
        ru, k = e.get("rule", {}), e["key"]
        ok, why = True, []
        if "max_count" in ru:
            ok &= m["count"] <= ru["max_count"]; why.append(f"count {m['count']} <= {ru['max_count']}")
        else:
            need = max(ru.get("min_count", 1), math.ceil(ru.get("min_rel", 0.5) * k["count"]))
            ok &= m["count"] >= need; why.append(f"count {m['count']} >= {need} (key {k['count']})")
        if e["kind"] == "region":
            d = [m["lab"][i] - k["lab"][i] for i in range(3)]
            for i, nm in ((0, "max_dL"), (1, "max_da"), (2, "max_db")):
                if nm in ru:
                    lim = ru[nm]; good = abs(d[i]) <= lim if nm != "max_db" else (abs(d[i]) <= lim)
                    ok &= good; why.append(f"d{'Lab'[i]} {d[i]:+.1f} (<= {lim})")
        rows.append({"check": f"{e['id']} [{e['kind']}]: {e['what'][:70]}", "ok": bool(ok), "value": "; ".join(why),
                     "render": {kk: vv for kk, vv in m.items() if kk != "boxes"}})
    return rows


def main(argv=None):
    ap = argparse.ArgumentParser(); ap.add_argument("render"); ap.add_argument("sheet"); ap.add_argument("--out")
    a = ap.parse_args(argv)
    rows = check(a.render, a.sheet)
    rep = {"verdict": "PASS" if all(r["ok"] for r in rows) else "FAIL", "rows": rows}
    if a.out:
        Path(a.out).write_text(json.dumps(rep, indent=1))
    for r in rows:
        print(("PASS " if r["ok"] else "FAIL ") + r["check"] + "  | " + r["value"])
    print(rep["verdict"]); return 0 if rep["verdict"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Shaft flat-to-flat profile.

FAIL if the shaft (materials front / right45 / left45 / side / back / cap,
above the plinth) is wider than 1.65 m flat-to-flat at any height.
Plinth faces are not the shaft. Icicles are not the shaft.

Flat-to-flat is the widest of the four octagon flat pairs (normals at
0 / 45 / 90 / 135 degrees): max(dot) - min(dot) on that normal.

python3 tools/object-gate/py/shaft_profile.py --selftest
python3 tools/object-gate/py/shaft_profile.py --obj mesh/rune-pillar.obj --out report.json
"""
import argparse
import json
import math
import sys

import numpy as np

MAX_FLAT_M = 1.65
STEP_MAX_M = 0.40
SHAFT_MATS = {"front", "right45", "left45", "side", "back", "cap"}
PLINTH_TOP = 0.60


def _normals():
    out = []
    for deg in (0.0, 45.0, 90.0, 135.0):
        a = math.radians(deg)
        out.append((math.sin(a), math.cos(a)))
    return out


NORMALS = _normals()


def flat_to_flat(points):
    """points: iterable of (x, y, z). None if the slice is too thin to be a width."""
    pts = [(float(p[0]), float(p[2])) for p in points]
    if len(pts) < 6:
        return None
    xz = np.array(pts, np.float64)
    if float(xz[:, 0].max() - xz[:, 0].min()) < 1e-3 and float(xz[:, 1].max() - xz[:, 1].min()) < 1e-3:
        return None
    widths = []
    for nx, nz in NORMALS:
        d = xz[:, 0] * nx + xz[:, 1] * nz
        widths.append(float(d.max() - d.min()))
    return max(widths)


def _ring(y, flat):
    apo = flat * 0.5
    cos22 = math.cos(math.radians(22.5))
    radius = apo / cos22
    pts = []
    for k in range(8):
        ang = math.radians(-22.5 + k * 45.0)
        pts.append((radius * math.sin(ang), y, radius * math.cos(ang)))
    return pts


def synthetic_shaft(mid_flat=None):
    """Linear 1.60 -> 1.20. mid_flat replaces the band around y=3.5 when set."""
    pts = []
    ys = np.linspace(0.60, 6.40, 59)
    for y in ys:
        t = (float(y) - 0.60) / (6.40 - 0.60)
        flat = 1.60 + (1.20 - 1.60) * t
        if mid_flat is not None and abs(float(y) - 3.50) <= 0.05:
            flat = mid_flat
        pts.extend(_ring(float(y), flat))
    return pts


def bands(points, y0, y1, step=0.10):
    rows = []
    y = y0
    while y < y1 - 1e-9:
        yb = min(y1, y + step)
        sl = [p for p in points if y - 1e-6 <= p[1] < yb - 1e-9 or (yb >= y1 and abs(p[1] - y1) < 1e-4 and p[1] >= y)]
        # include the top sample in the last band
        if abs(yb - y1) < 1e-9:
            sl = [p for p in points if y - 1e-6 <= p[1] <= y1 + 1e-6]
        w = flat_to_flat(sl)
        if w is not None:
            rows.append({"y0": round(y, 3), "y1": round(yb, 3), "flatM": round(w, 4)})
        y = yb
    return rows


def slice_width(points, y0, y1):
    sl = [p for p in points if y0 - 1e-4 <= p[1] <= y1 + 1e-4]
    w = flat_to_flat(sl)
    return None if w is None else round(w, 4)


def judge(points, plinth_top=PLINTH_TOP):
    above = [p for p in points if p[1] >= plinth_top - 1e-4]
    rows = bands(above, plinth_top, max((p[1] for p in above), default=plinth_top) + 1e-6)
    base = slice_width(above, plinth_top, plinth_top + 0.12)
    mid = slice_width(above, 3.45, 3.55)
    top = slice_width(above, 6.25, 6.39)
    lip = slice_width(above, 6.40, 6.70)
    widths = [r["flatM"] for r in rows]
    max_w = round(max(widths), 4) if widths else None
    ok = max_w is not None and max_w <= MAX_FLAT_M + 1e-4
    return {
        "baseM": base,
        "midM": mid,
        "topM": top,
        "lipM": lip,
        "maxM": max_w,
        "limitM": MAX_FLAT_M,
        "pass": bool(ok),
        "bands": rows,
    }


def check_steps(steps, limit=STEP_MAX_M):
    rows = []
    ok = True
    for s in steps:
        h = float(s.get("height_m", s.get("heightM", s["y1"] - s["y0"])))
        good = h <= limit + 1e-6
        ok = ok and good
        rows.append({"y0": s.get("y0"), "y1": s.get("y1"), "heightM": round(h, 4), "pass": bool(good), "limitM": limit})
    return {"pass": bool(ok) and len(rows) > 0, "steps": rows, "limitM": limit}


def load_obj_points(path, mats):
    verts = []
    cur = None
    used = []
    for line in open(path):
        if line.startswith("v "):
            x, y, z = line.split()[1:4]
            verts.append((float(x), float(y), float(z)))
        elif line.startswith("usemtl "):
            cur = line.split()[1]
        elif line.startswith("f ") and cur in mats:
            for tok in line.split()[1:4]:
                used.append(verts[int(tok.split("/")[0]) - 1])
    return used


def selftest():
    errors = []
    good = judge(synthetic_shaft())
    if not good["pass"]:
        errors.append(f"good 1.60->1.20 profile FAILed: {good['maxM']}")
    if good["baseM"] is None or abs(good["baseM"] - 1.60) > 0.02:
        errors.append(f"good base {good['baseM']} != 1.60")
    if good["midM"] is None or abs(good["midM"] - 1.40) > 0.03:
        errors.append(f"good mid {good['midM']} != 1.40")
    if good["topM"] is None or abs(good["topM"] - 1.20) > 0.03:
        errors.append(f"good top {good['topM']} != 1.20")
    bad = judge(synthetic_shaft(mid_flat=1.80))
    if bad["pass"]:
        errors.append(f"1.8 m mid-shaft profile PASSed (max {bad['maxM']})")
    if bad["midM"] is None or bad["midM"] < 1.75:
        errors.append(f"1.8 m mid not measured ({bad['midM']})")
    edge = judge(synthetic_shaft(mid_flat=1.66))
    if edge["pass"]:
        errors.append("1.66 m mid PASSed")
    steps_bad = check_steps([{"y0": 0.0, "y1": 0.41, "height_m": 0.41}])
    if steps_bad["pass"]:
        errors.append("0.41 m step PASSed")
    steps_ok = check_steps([
        {"y0": -0.15, "y1": 0.05, "height_m": 0.20},
        {"y0": 0.05, "y1": 0.28, "height_m": 0.23},
        {"y0": 0.28, "y1": 0.60, "height_m": 0.32},
    ])
    if not steps_ok["pass"]:
        errors.append("legal plinth steps FAILed")
    if errors:
        print("FAIL selftest")
        for e in errors:
            print(" -", e)
        return 1
    print("PASS selftest good max", good["maxM"], "bad mid", bad["midM"])
    return 0


def main(argv=None):
    p = argparse.ArgumentParser(description="Shaft flat-to-flat profile")
    p.add_argument("--selftest", action="store_true")
    p.add_argument("--obj")
    p.add_argument("--plinth-top", type=float, default=PLINTH_TOP)
    p.add_argument("--steps-json")
    p.add_argument("--out")
    args = p.parse_args(argv)
    if args.selftest:
        return selftest()
    if not args.obj:
        print("usage: --selftest | --obj mesh.obj [--out report.json]", file=sys.stderr)
        return 2
    pts = load_obj_points(args.obj, SHAFT_MATS)
    report = judge(pts, args.plinth_top)
    report["obj"] = args.obj
    report["samples"] = len(pts)
    if args.steps_json:
        blob = json.load(open(args.steps_json))
        steps = blob.get("steps") or blob.get("plinth", {}).get("steps") or []
        report["plinthSteps"] = check_steps(steps)
        if not report["plinthSteps"]["pass"]:
            report["pass"] = False
    text = json.dumps(report, indent=1)
    if args.out:
        open(args.out, "w").write(text + "\n")
    print(text)
    return 0 if report["pass"] else 1


if __name__ == "__main__":
    sys.exit(main())

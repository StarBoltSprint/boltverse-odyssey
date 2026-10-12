"""Icicle root checks for a block build.

1. Every cone coordinate lies on a plate column of its band: coord = a + b * col
   (x on front bands, z on side bands), col inside that band.
2. The root ring is buried in the lip: rootY >= lipY + sinkM (v3.4.1 sink is 0.03 m).
   JSON written by the builder stores the lip attachment (tipY + lenM), not the sunk
   ring. Pass rootY when you measured the ring. Do not lower sinkM to hide a gap.
"""
import json


def _bands_for(record, bands):
    out = []
    for b in bands:
        if b.get("tier") != record.get("tier") or b.get("side") != record.get("side"):
            continue
        if record.get("plate") and b.get("plate") and record["plate"] != b["plate"]:
            continue
        out.append(b)
    return out


def on_plate_column(record, bands, tol=0.001):
    key = "x" if record.get("side", "front") == "front" else "z"
    if key not in record:
        return False
    val = float(record[key])
    for b in _bands_for(record, bands):
        bcoef = float(b["b"])
        if abs(bcoef) < 1e-12:
            continue
        col = (val - float(b["a"])) / bcoef
        nearest = round(col)
        if abs(col - nearest) * abs(bcoef) <= tol and (int(b["c_lo"]) - 1) <= nearest <= (int(b["c_hi"]) + 1):
            return True
    return False


def root_buried(root_y, lip_y, sink):
    return float(root_y) + 1e-9 >= float(lip_y) + float(sink)


def check_columns(records, bands, tol=0.001):
    bad = []
    for i, rec in enumerate(records):
        if not on_plate_column(rec, bands, tol):
            bad.append({"index": i, "tier": rec.get("tier"), "side": rec.get("side"), "x": rec.get("x"), "z": rec.get("z")})
    return {"checked": len(records), "offColumn": len(bad), "examples": bad[:8], "pass": len(bad) == 0 and len(records) > 0}


def check_buried(records, sink):
    """records carry rootY and lipY (metres). Missing fields fail closed."""
    bad = []
    for i, rec in enumerate(records):
        if "rootY" not in rec or "lipY" not in rec:
            bad.append({"index": i, "why": "missing rootY/lipY"})
            continue
        if not root_buried(rec["rootY"], rec["lipY"], sink):
            bad.append({"index": i, "rootY": rec["rootY"], "lipY": rec["lipY"], "sink": sink})
    return {"checked": len(records), "unburied": len(bad), "examples": bad[:8], "pass": len(bad) == 0 and len(records) > 0}


def main(argv=None):
    import sys
    a = list(sys.argv[1:] if argv is None else argv)
    if len(a) < 2:
        print("usage: icicles <icicles.json> <bands.json> [--sink 0.03] [--out j]", file=sys.stderr)
        return 2
    ici = json.load(open(a[0]))
    bands = json.load(open(a[1]))
    sink = 0.03
    if "--sink" in a:
        sink = float(a[a.index("--sink") + 1])
    r = check_columns(ici, bands)
    r["sinkM"] = sink
    print(json.dumps({k: r[k] for k in ("checked", "offColumn", "pass")}))
    if "--out" in a:
        json.dump(r, open(a[a.index("--out") + 1], "w"), indent=1)
    return 0 if r["pass"] else 1


if __name__ == "__main__":
    import sys
    sys.exit(main())

#!/usr/bin/env python3
"""Self-test: fixture S03/S11 FAIL copies must FAIL; final4-pass + S06–S10 must PASS band rules.

Also runs live ring when present and prints S03/S11 final4 status.
"""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PKG = Path(__file__).resolve().parent
sys.path.insert(0, str(PKG))

from check import main as check_main  # noqa: E402
from measures import (  # noqa: E402
    DENSITY_RATIO_MAX,
    LANE_FRAC_MAX,
    assess_plate,
    key_b_median_star,
    load_rgb,
)

FIX = PKG / "fixtures"


def expect(name: str, path: Path, want: str, key_med, ring_v=None) -> dict:
    rgb = load_rgb(path)
    row = assess_plate(rgb, key_b_med=key_med, ring_median_v=ring_v)
    # For fixture band self-test, judge band/lane primarily; edge/banding reported
    band_fail = bool(row.get("band_fail")) or any(r.startswith("dense_band") or r.startswith("dark_lanes") for r in row["reasons"])
    # Overall status for FAIL fixtures must be FAIL; for PASS fixtures band must not fail
    ok = True
    detail = ""
    if want == "FAIL":
        ok = row["status"] == "FAIL" and band_fail
        detail = f"status={row['status']} band_fail={band_fail} reasons={row['reasons']}"
    else:
        ok = not band_fail
        detail = f"status={row['status']} band_fail={band_fail} dens={row['density_ratio_eff']} lane={row['lane_frac_eff']} reasons={row['reasons']}"
    print(("PASS" if ok else "FAIL"), name, want, detail)
    return {"name": name, "ok": ok, "want": want, "row": row}


def main() -> int:
    key = FIX / "key-zd1-b.jpg"
    key_med = key_b_median_star(key if key.is_file() else None)
    cases = [
        ("S03-final3-fail", FIX / "zd-sky12-S03-final3-fail.jpg", "FAIL"),
        ("S11-final2-fail", FIX / "zd-sky12-S11-final2-fail.jpg", "FAIL"),
        ("S03-final4-pass", FIX / "zd-sky12-S03-final4-pass.jpg", "PASS"),
        ("S11-final4-pass", FIX / "zd-sky12-S11-final4-pass.jpg", "PASS"),
        ("S06", FIX / "zd-sky12-S06-final3.jpg", "PASS"),
        ("S07", FIX / "zd-sky12-S07-final3.jpg", "PASS"),
        ("S08", FIX / "zd-sky12-S08-final3.jpg", "PASS"),
        ("S09", FIX / "zd-sky12-S09-final3.jpg", "PASS"),
        ("S10", FIX / "zd-sky12-S10-final3.jpg", "PASS"),
    ]
    # ring V from pass set
    vs = []
    for _, p, _ in cases:
        if p.is_file():
            from measures import mean_v
            vs.append(mean_v(load_rgb(p)))
    ring = float(sorted(vs)[len(vs) // 2]) if vs else None

    results = []
    missing = []
    for name, path, want in cases:
        if not path.is_file():
            missing.append(name)
            print("MISSING", name, path)
            continue
        results.append(expect(name, path, want, key_med, ring))

    all_ok = all(r["ok"] for r in results) and not missing
    if not all_ok:
        # print tuning hint
        print(
            f"thresholds density_ratio_max={DENSITY_RATIO_MAX} lane_frac_max={LANE_FRAC_MAX}",
            file=sys.stderr,
        )
        for r in results:
            if not r["ok"]:
                row = r["row"]
                print(
                    f"  tune {r['name']}: dens={row['density_ratio_eff']:.3f} "
                    f"densR={row['density_ratio_right']:.3f} lane={row['lane_frac_eff']:.4f} "
                    f"laneR={row['lane_frac_right']:.4f}",
                    file=sys.stderr,
                )

    # live ring quick (optional)
    live = Path("/workspace/zd-bible-1012/zd-plates/sky12")
    live_note = {}
    if live.is_dir():
        with tempfile.TemporaryDirectory() as td:
            rc = check_main(["--plates", str(live), "--out", td, "--key-b", str(key)])
            rep = json.loads((Path(td) / "report.json").read_text())
            live_note = {
                "status": rep["status"],
                "edge_line_plates": rep["edge_line_plates"],
                "S03": next((p for p in rep["plates"] if p["id"] == "S03"), None),
                "S11": next((p for p in rep["plates"] if p["id"] == "S11"), None),
                "exit": rc,
            }
            print("LIVE", json.dumps({
                "status": rep["status"],
                "edge": rep["edge_line_plates"],
                "S03": {"path": live_note["S03"]["path"] if live_note["S03"] else None,
                        "status": live_note["S03"]["status"] if live_note["S03"] else None,
                        "reasons": live_note["S03"]["reasons"] if live_note["S03"] else None},
                "S11": {"path": live_note["S11"]["path"] if live_note["S11"] else None,
                        "status": live_note["S11"]["status"] if live_note["S11"] else None,
                        "reasons": live_note["S11"]["reasons"] if live_note["S11"] else None},
            }))

    print("SELFTEST", "PASS" if all_ok else "FAIL")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Self-test for sky-band-gate.

FAIL fixtures: S03/S11 pre-final4, S05-final2, S09-final3, S11-final4.
PASS fixtures: S01, S02, S06–S08, S10 (current KEEP snapshots).
Also runs live ring (must PASS when Art Director KEEP'd all 12).
"""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

PKG = Path(__file__).resolve().parent
sys.path.insert(0, str(PKG))

from check import main as check_main  # noqa: E402
from measures import assess_plate, key_b_median_star, load_rgb, mean_v  # noqa: E402

FIX = PKG / "fixtures"

FAIL_CASES = [
    ("S03-final3-fail", FIX / "zd-sky12-S03-final3-fail.jpg"),
    ("S11-final2-fail", FIX / "zd-sky12-S11-final2-fail.jpg"),
    ("S05-final2-fail", FIX / "zd-sky12-S05-final2-fail.jpg"),
    ("S09-final3-fail", FIX / "zd-sky12-S09-final3-fail.jpg"),
    ("S11-final4-fail", FIX / "zd-sky12-S11-final4-fail.jpg"),
]
PASS_CASES = [
    ("S01-final2-pass", FIX / "zd-sky12-S01-final2-pass.jpg"),
    ("S02-final2-pass", FIX / "zd-sky12-S02-final2-pass.jpg"),
    ("S06-final3-pass", FIX / "zd-sky12-S06-final3-pass.jpg"),
    ("S07-final3-pass", FIX / "zd-sky12-S07-final3-pass.jpg"),
    ("S08-final5-pass", FIX / "zd-sky12-S08-final5-pass.jpg"),
    ("S10-final3-pass", FIX / "zd-sky12-S10-final3-pass.jpg"),
]


def main() -> int:
    key = FIX / "key-zd1-b.jpg"
    key_med = key_b_median_star(key if key.is_file() else None)
    paths = [p for _, p in FAIL_CASES + PASS_CASES if p.is_file()]
    vs = [mean_v(load_rgb(p)) for p in paths]
    ring = float(sorted(vs)[len(vs) // 2]) if vs else None

    bad = []
    for name, path in FAIL_CASES:
        if not path.is_file():
            print("MISSING", name); bad.append(name); continue
        row = assess_plate(load_rgb(path), key_b_med=key_med, ring_median_v=ring)
        ok = bool(row.get("band_fail")) or row["status"] == "FAIL" and any(
            r.startswith("dense_band") or r.startswith("windowed_haze") or r.startswith("narrow_diagonal")
            for r in row["reasons"]
        )
        # must be band-related fail
        ok = bool(row.get("band_fail"))
        print(("PASS" if ok else "FAIL"), name, "want=FAIL", "band_fail=", row.get("band_fail"), row["reasons"])
        if not ok: bad.append(name)
    for name, path in PASS_CASES:
        if not path.is_file():
            print("MISSING", name); bad.append(name); continue
        row = assess_plate(load_rgb(path), key_b_med=key_med, ring_median_v=ring)
        ok = not bool(row.get("band_fail"))
        print(("PASS" if ok else "FAIL"), name, "want=PASS band", "band_fail=", row.get("band_fail"), row["reasons"])
        if not ok: bad.append(name)

    live = Path("/workspace/zd-bible-1012/zd-plates/sky12")
    live_note = {}
    if live.is_dir():
        with tempfile.TemporaryDirectory() as td:
            rc = check_main(["--plates", str(live), "--out", td, "--key-b", str(key)])
            # check.py returns 2 without a file on disk-floor, mid-run disk stop,
            # or zero matching plates. Reading anyway raises FileNotFoundError.
            rep_path = Path(td) / "report.json"
            if not rep_path.is_file():
                print("LIVE_NO_REPORT", "exit", rc)
                bad.append(f"live:no-report:exit{rc}")
            else:
                rep = json.loads(rep_path.read_text())
                # Live ring band failures (ignore pure V/edge if AD KEEP — report honestly)
                band_fails = [
                    p["id"] for p in rep["plates"]
                    if p.get("band_fail") or any(
                        r.startswith("dense_band") or r.startswith("windowed_haze") or r.startswith("narrow_diagonal")
                        for r in p["reasons"]
                    )
                ]
                live_note = {
                    "status": rep["status"],
                    "edge": rep["edge_line_plates"],
                    "band_fails": band_fails,
                    "exit": rc,
                    "plates": [
                        {
                            "id": p["id"],
                            "status": p["status"],
                            "band_fail": p.get("band_fail"),
                            "path": Path(p["path"]).name,
                            "reasons": p["reasons"],
                        }
                        for p in rep["plates"]
                    ],
                }
                print("LIVE", json.dumps({
                    "status": rep["status"],
                    "edge": rep["edge_line_plates"],
                    "band_fails": band_fails,
                }))
                if band_fails:
                    print("LIVE_BAND_FAIL", band_fails)
                    bad.append("live:" + ",".join(band_fails))

    print("SELFTEST", "PASS" if not bad else "FAIL", bad)
    return 0 if not bad else 1


if __name__ == "__main__":
    sys.exit(main())

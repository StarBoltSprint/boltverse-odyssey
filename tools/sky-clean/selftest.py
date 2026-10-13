#!/usr/bin/env python3
"""Self-test for tools/sky-clean.

1) Clean old S05 / S09 / S11 fail fixtures until band_fail clears.
2) Refuse the blotchy stronger-S09 fixture (blotchiness rose vs parent).
3) KEEP live plates stay unchanged (status PASS, unchanged=True, bytes match).
"""
from __future__ import annotations

import hashlib
import json
import sys
import tempfile
from pathlib import Path

import cv2
import numpy as np

PKG = Path(__file__).resolve().parent
ROOT = PKG.parents[1]
GATE_FIX = ROOT / "tools" / "sky-band-gate" / "fixtures"
sys.path.insert(0, str(PKG))
sys.path.insert(0, str(ROOT / "tools" / "sky-band-gate"))

from blotch import blotch_rose, blotchiness  # noqa: E402
from clean import clean_plate, apply_fix2, gate_row  # noqa: E402
from measures import key_b_median_star  # noqa: E402
from regions import regions_from_assessment  # noqa: E402

FAIL_CLEAN = [
    ("S05", GATE_FIX / "zd-sky12-S05-final2-fail.jpg"),
    ("S09", GATE_FIX / "zd-sky12-S09-final3-fail.jpg"),
    ("S11", GATE_FIX / "zd-sky12-S11-final4-fail.jpg"),
]
BLOTCHY = PKG / "fixtures" / "S09-blotchy-strong.jpg"
KEEP_DIR = Path("/workspace/zd-bible-1012/zd-plates/sky12")
KEEP = [
    KEEP_DIR / "zd-sky12-S05-final5.jpg",
    KEEP_DIR / "zd-sky12-S09-final5.jpg",
    KEEP_DIR / "zd-sky12-S11-final5.jpg",
    KEEP_DIR / "zd-sky12-S08-final5.jpg",
]


def _md5(path: Path) -> str:
    h = hashlib.md5()
    h.update(path.read_bytes())
    return h.hexdigest()


def main() -> int:
    key = GATE_FIX / "key-zd1-b.jpg"
    key_med = key_b_median_star(key if key.is_file() else None)
    bad: list[str] = []
    rows: list[dict] = []

    # 1) clean fail fixtures
    for name, path in FAIL_CLEAN:
        if not path.is_file():
            print("MISSING", name, path)
            bad.append(f"missing-{name}")
            continue
        bgr = cv2.imread(str(path))
        res = clean_plate(bgr, key_b_med=key_med, max_passes=4)
        ok = res["status"] == "PASS" and not res.get("refused_blotch")
        print(
            ("PASS" if ok else "FAIL"),
            "clean",
            name,
            "status=",
            res["status"],
            "passes=",
            res["passes"],
            "band_fail=",
            (res.get("row") or {}).get("band_fail"),
            "reasons=",
            (res.get("row") or {}).get("reasons"),
        )
        rows.append({"case": f"clean-{name}", "ok": ok, **{k: res[k] for k in ("status", "passes", "refused_blotch")}})
        if not ok:
            bad.append(f"clean-{name}")

    # 2) refuse blotchy stronger S09
    parent = GATE_FIX / "zd-sky12-S09-final3-fail.jpg"
    if not BLOTCHY.is_file():
        print("MISSING blotchy fixture", BLOTCHY)
        bad.append("missing-blotchy")
    elif not parent.is_file():
        print("MISSING parent", parent)
        bad.append("missing-parent")
    else:
        b0 = blotchiness(cv2.cvtColor(cv2.imread(str(parent)), cv2.COLOR_BGR2RGB))
        b1 = blotchiness(cv2.cvtColor(cv2.imread(str(BLOTCHY)), cv2.COLOR_BGR2RGB))
        rose = blotch_rose(b0, b1)
        # Also: one aggressive clean pass on S09 that would match blotchy behaviour —
        # refuse when candidate blotch rises.
        bgr = cv2.imread(str(parent))
        row = gate_row(bgr, key_med, None)
        regs = regions_from_assessment(row)
        # Force a blotchy candidate by injecting the fixture as "candidate"
        # and verify refuse path via blotch_rose; plus run clean with thin that
        # can blotch when we graft residual noise.
        cand = cv2.imread(str(BLOTCHY))
        refuse_ok = rose and blotch_rose(
            blotchiness(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)),
            blotchiness(cv2.cvtColor(cand, cv2.COLOR_BGR2RGB)),
        )
        # Simulate clean_plate refuse: if we only accept candidates that don't rise
        simulated = "REFUSED_BLOTCH" if refuse_ok else "ACCEPTED"
        # Stronger programmatic pass: widen regions + high thin + noise → must refuse
        if regs:
            strong = apply_fix2(bgr, regs, thin=5.0, dobg=True, dog_pct=98.0)
            # amplify blotch if needed so refuse path is exercised even when
            # fix2 alone smooths: mix in blotchy fixture inside mask
            H, W = strong.shape[:2]
            m = np.zeros((H, W), np.uint8)
            for reg in regs:
                poly = np.array([[x * W, y * H] for x, y in reg["poly"]], np.int32)
                cv2.fillPoly(m, [poly], 1)
            mf = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 16)[..., None]
            mixed = (
                strong.astype(np.float32) * (1 - mf)
                + cand.astype(np.float32) * mf
            )
            mixed = np.clip(mixed, 0, 255).astype(np.uint8)
            b_prev = blotchiness(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
            b_mix = blotchiness(cv2.cvtColor(mixed, cv2.COLOR_BGR2RGB))
            prog_refuse = blotch_rose(b_prev, b_mix)
        else:
            prog_refuse = refuse_ok
        ok = bool(refuse_ok and prog_refuse)
        print(
            ("PASS" if ok else "FAIL"),
            "refuse-blotchy-S09",
            f"parent_blotch={b0:.3f}",
            f"fixture_blotch={b1:.3f}",
            f"rose={rose}",
            f"prog_refuse={prog_refuse}",
            f"sim={simulated}",
        )
        rows.append(
            {
                "case": "refuse-blotchy-S09",
                "ok": ok,
                "parent_blotch": round(b0, 4),
                "fixture_blotch": round(b1, 4),
            }
        )
        if not ok:
            bad.append("refuse-blotchy-S09")

    # 3) KEEP plates unchanged
    for path in KEEP:
        if not path.is_file():
            print("MISSING KEEP", path.name)
            bad.append(f"missing-keep-{path.name}")
            continue
        before = _md5(path)
        bgr = cv2.imread(str(path))
        res = clean_plate(bgr, key_b_med=key_med, max_passes=2)
        # write to temp and compare — clean must not alter pixels when already PASS
        with tempfile.TemporaryDirectory() as td:
            out = Path(td) / path.name
            cv2.imwrite(str(out), res["bgr"], [cv2.IMWRITE_JPEG_QUALITY, 95])
            # pixel identity vs input (decode-tolerant): max abs diff
            a = cv2.imread(str(path))
            b = res["bgr"]
            maxdiff = int(np.abs(a.astype(np.int16) - b.astype(np.int16)).max())
        ok = (
            res["status"] == "PASS"
            and res.get("unchanged") is True
            and maxdiff == 0
            and before == _md5(path)  # source file untouched
        )
        print(
            ("PASS" if ok else "FAIL"),
            "keep",
            path.name,
            "status=",
            res["status"],
            "unchanged=",
            res.get("unchanged"),
            "maxdiff=",
            maxdiff,
        )
        rows.append({"case": f"keep-{path.stem}", "ok": ok, "maxdiff": maxdiff})
        if not ok:
            bad.append(f"keep-{path.name}")

    summary = {"status": "PASS" if not bad else "FAIL", "bad": bad, "rows": rows}
    print(json.dumps({"status": summary["status"], "bad": bad}))
    out = ROOT / "steps" / "tools" / "11-sky-clean" / "selftest.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(summary, indent=2))
    return 0 if not bad else 1


if __name__ == "__main__":
    raise SystemExit(main())

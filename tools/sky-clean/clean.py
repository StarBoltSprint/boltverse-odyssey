#!/usr/bin/env python3
"""sky-clean: run sky-band-gate, clean only flagged regions, re-gate.

Stops when the plate PASSes band checks, or when blotchiness (local BG
variance) rises after a clean pass.

  python3 tools/sky-clean/clean.py --in plate.jpg --out out.jpg
  python3 tools/sky-clean/clean.py --in plate.jpg --out out.jpg --max-passes 4

Exit 0 = PASS (or already PASS / unchanged KEEP). Exit 1 = still FAIL or
refused blotch. Exit 2 = bad invocation / disk floor.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import cv2
import numpy as np
from scipy import ndimage as nd

PKG = Path(__file__).resolve().parent
ROOT = PKG.parents[1]
GATE = ROOT / "tools" / "sky-band-gate"
sys.path.insert(0, str(GATE))
sys.path.insert(0, str(PKG))

from measures import assess_plate, key_b_median_star, load_rgb, mean_v  # noqa: E402
from blotch import blotch_rose, blotchiness  # noqa: E402
from regions import regions_from_assessment  # noqa: E402

DISK_FLOOR_KB = 2_000_000
THIN_SCHEDULE = (1.15, 1.7, 2.4, 3.2)


def disk_free_kb(path: str = "/") -> int:
    st = os.statvfs(path)
    return int(st.f_bavail * st.f_frsize / 1024)


def _union_mask(H: int, W: int, regions: list[dict]) -> np.ndarray:
    m = np.zeros((H, W), np.uint8)
    for reg in regions:
        poly = np.array([[x * W, y * H] for x, y in reg["poly"]], np.int32)
        if len(poly) >= 3:
            cv2.fillPoly(m, [poly], 1)
    return m


def apply_fix2(
    bgr: np.ndarray,
    regions: list[dict],
    thin: float,
    *,
    dobg: bool = True,
    dog_pct: float = 99.0,
) -> np.ndarray:
    """Port of /workspace/sky-fix-1013/fix2.py over a union of region polys."""
    a = bgr.astype(np.float32)
    H, W = a.shape[:2]
    m = _union_mask(H, W, regions)
    if not m.any():
        return bgr.copy()
    mf = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 20)[..., None]

    def mfill(img, sig):
        w = (1 - m).astype(np.float32)
        num = cv2.GaussianBlur(img * (w[..., None] if img.ndim == 3 else w), (0, 0), sig)
        den = cv2.GaussianBlur(w, (0, 0), sig)
        return num / np.maximum(den[..., None] if img.ndim == 3 else den, 1e-4)

    bg = np.stack(
        [
            cv2.GaussianBlur(
                cv2.morphologyEx(a[..., c], cv2.MORPH_OPEN, np.ones((7, 7))), (0, 0), 4
            )
            for c in range(3)
        ],
        -1,
    )
    stars = a - bg

    def colfill(bg_img):
        out = bg_img.copy()
        cols = np.where(m.any(0))[0]
        tops = np.full(W, -1)
        bots = np.full(W, -1)
        for x in cols:
            ys = np.where(m[:, x])[0]
            tops[x] = max(int(ys[0]) - 1, 10)
            bots[x] = min(int(ys[-1]) + 1, H - 11)
        T = np.zeros((W, 3), np.float32)
        B = np.zeros((W, 3), np.float32)
        for x in cols:
            T[x] = bg_img[tops[x] - 10 : tops[x], x].mean(0)
            B[x] = bg_img[bots[x] : bots[x] + 10, x].mean(0)
        for arr in (T, B):
            arr[cols] = nd.gaussian_filter1d(arr[cols], 25, axis=0)
        for x in cols:
            n_ = bots[x] - tops[x]
            if n_ <= 1:
                continue
            t = np.linspace(0, 1, n_)[:, None]
            out[tops[x] : bots[x], x] = T[x] * (1 - t) + B[x] * t
        return out

    newbg = bg * (1 - mf) + colfill(bg) * mf if dobg else bg
    L = a.mean(-1)
    dog = cv2.GaussianBlur(L, (0, 0), 0.6) - cv2.GaussianBlur(L, (0, 0), 2)
    sm = dog > np.percentile(dog, dog_pct)
    lab, n = nd.label(sm)
    if n == 0:
        out = np.clip(newbg + stars, 0, 255).round().astype(np.uint8)
        return out
    cen = nd.center_of_mass(sm, lab, range(1, n + 1))
    dens = cv2.GaussianBlur(sm.astype(np.float32), (0, 0), 12)
    ref = mfill(dens, 60)
    kp = np.clip(ref / np.maximum(dens, 1e-6), 0, 1) ** float(thin)
    rng = np.random.default_rng(4)
    kill = np.zeros((H, W), bool)
    sl = nd.find_objects(lab)
    for i, (cy, cx) in enumerate(cen):
        iy, ix = int(cy), int(cx)
        if mf[iy, ix, 0] > 0.3 and rng.random() > kp[iy, ix]:
            s = sl[i]
            kill[s] |= lab[s] == i + 1
    kill = cv2.dilate(kill.astype(np.uint8), np.ones((5, 5))) > 0
    stars[kill] = 0
    out = np.clip(newbg + stars, 0, 255).round().astype(np.uint8)
    if not dobg:
        out = cv2.inpaint(out, kill.astype(np.uint8), 3, cv2.INPAINT_TELEA)
    return out


def gate_row(bgr: np.ndarray, key_b_med: float | None, ring_median_v: float | None):
    # assess_plate expects RGB
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB).astype(np.float32)
    return assess_plate(rgb, key_b_med=key_b_med, ring_median_v=ring_median_v)


def clean_plate(
    bgr: np.ndarray,
    *,
    key_b_med: float | None = None,
    ring_median_v: float | None = None,
    max_passes: int = 4,
    thin_schedule: tuple[float, ...] = THIN_SCHEDULE,
    dobg: bool = True,
) -> dict:
    """Iterate gate→clean→gate. Returns dict with status, bgr, passes, log."""
    cur = bgr.copy()
    row0 = gate_row(cur, key_b_med, ring_median_v)
    b0 = blotchiness(cv2.cvtColor(cur, cv2.COLOR_BGR2RGB))
    log = [
        {
            "pass": 0,
            "band_fail": bool(row0.get("band_fail")),
            "reasons": list(row0.get("reasons") or []),
            "blotchiness": round(b0, 4),
        }
    ]
    if not row0.get("band_fail"):
        return {
            "status": "PASS",
            "unchanged": True,
            "bgr": cur,
            "row": row0,
            "passes": 0,
            "blotchiness": b0,
            "log": log,
            "refused_blotch": False,
        }

    prev_blotch = b0
    schedule = list(thin_schedule[:max_passes])
    for i, thin in enumerate(schedule, start=1):
        row = gate_row(cur, key_b_med, ring_median_v)
        if not row.get("band_fail"):
            return {
                "status": "PASS",
                "unchanged": False,
                "bgr": cur,
                "row": row,
                "passes": i - 1,
                "blotchiness": prev_blotch,
                "log": log,
                "refused_blotch": False,
            }
        regs = regions_from_assessment(row)
        if not regs:
            break
        cand = apply_fix2(cur, regs, thin, dobg=dobg)
        b1 = blotchiness(cv2.cvtColor(cand, cv2.COLOR_BGR2RGB))
        entry = {
            "pass": i,
            "thin": thin,
            "regions": [r["kind"] for r in regs],
            "blotchiness": round(b1, 4),
            "blotch_before": round(prev_blotch, 4),
        }
        if blotch_rose(prev_blotch, b1):
            entry["refused"] = True
            log.append(entry)
            return {
                "status": "REFUSED_BLOTCH",
                "unchanged": False,
                "bgr": cur,  # keep last non-blotchy
                "row": row,
                "passes": i - 1,
                "blotchiness": prev_blotch,
                "log": log,
                "refused_blotch": True,
                "candidate_blotchiness": b1,
            }
        cur = cand
        prev_blotch = b1
        row_after = gate_row(cur, key_b_med, ring_median_v)
        entry["band_fail"] = bool(row_after.get("band_fail"))
        entry["reasons"] = list(row_after.get("reasons") or [])
        log.append(entry)
        if not row_after.get("band_fail"):
            return {
                "status": "PASS",
                "unchanged": False,
                "bgr": cur,
                "row": row_after,
                "passes": i,
                "blotchiness": prev_blotch,
                "log": log,
                "refused_blotch": False,
            }

    row_f = gate_row(cur, key_b_med, ring_median_v)
    return {
        "status": "FAIL" if row_f.get("band_fail") else "PASS",
        "unchanged": False,
        "bgr": cur,
        "row": row_f,
        "passes": len(log) - 1,
        "blotchiness": prev_blotch,
        "log": log,
        "refused_blotch": False,
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--in", dest="src", required=True, type=Path)
    ap.add_argument("--out", dest="dst", required=True, type=Path)
    ap.add_argument("--max-passes", type=int, default=4)
    ap.add_argument("--key-b", type=Path, default=GATE / "fixtures" / "key-zd1-b.jpg")
    ap.add_argument("--report", type=Path, default=None)
    ap.add_argument("--no-bg", action="store_true")
    args = ap.parse_args(argv)

    if disk_free_kb() < DISK_FLOOR_KB:
        print("DISK_FLOOR", disk_free_kb(), file=sys.stderr)
        return 2
    if not args.src.is_file():
        print("missing", args.src, file=sys.stderr)
        return 2

    bgr = cv2.imread(str(args.src))
    if bgr is None:
        print("unreadable", args.src, file=sys.stderr)
        return 2

    key_med = key_b_median_star(args.key_b if args.key_b.is_file() else None)
    result = clean_plate(
        bgr,
        key_b_med=key_med,
        max_passes=args.max_passes,
        dobg=not args.no_bg,
    )
    args.dst.parent.mkdir(parents=True, exist_ok=True)
    # KEEP / already-pass: write identical bytes only if out != in path requires write —
    # always write current best so callers have an artifact; unchanged noted in report.
    cv2.imwrite(str(args.dst), result["bgr"], [cv2.IMWRITE_JPEG_QUALITY, 95])

    report = {
        "status": result["status"],
        "unchanged": result["unchanged"],
        "refused_blotch": result["refused_blotch"],
        "passes": result["passes"],
        "blotchiness": result["blotchiness"],
        "reasons": list((result.get("row") or {}).get("reasons") or []),
        "band_fail": bool((result.get("row") or {}).get("band_fail")),
        "log": result["log"],
        "src": str(args.src),
        "dst": str(args.dst),
    }
    text = json.dumps(report, indent=2)
    print(text)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(text)

    if result["status"] == "PASS":
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

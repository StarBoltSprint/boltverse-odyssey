#!/usr/bin/env python3
"""Law 33 — seam judge: last frame of plate N vs first frame of plate N+1.

A cold Grok runs this BEFORE hang of a chained Video A. FAIL = recook the
seam, do not hang. Exit 0 = every consecutive pair PASS. Exit non-zero = FAIL.

  python3 biome/scripts/plate-mae-qc/plate-mae-qc.py road-N.mp4 road-N1.mp4
  python3 biome/scripts/plate-mae-qc/plate-mae-qc.py --json a.mp4 b.mp4 c.mp4

Needs: ffmpeg, numpy, Pillow. No other deps.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from typing import Any

import numpy as np
from PIL import Image

# Sealed 2026-09-22. Cold-start defaults — no hung seam pair lives in git.
# Do not raise these to hang a miss. Recalibrate only when SmiR accepts a pair.
MAE_MAX = 36.0  # full-frame mean |RGB| on 0–255. Different picture.
MAE_ROAD_MAX = 14.0  # asphalt band luma. Law 31: last must not run hotter.
WB_MAX = 12.0  # |Δ mean(R−B)|. White-balance jump.
MAE_WARN = 18.0
ROAD_WARN = 8.0
FRAME = (720, 1280)
# Road band: lower asphalt, inside the lanes, away from sky and the side walls.
ROAD_Y = (0.70, 0.92)
ROAD_X = (0.30, 0.70)


def _run(cmd: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, capture_output=True, text=True)


def probe(path: str) -> dict[str, Any]:
    r = _run(["ffmpeg", "-hide_banner", "-i", path])
    txt = r.stderr or ""
    w = h = fps = dur = None
    for line in txt.splitlines():
        if "Video:" in line:
            m = re.search(r"(\d{3,4})x(\d{3,4})", line)
            if m:
                w, h = int(m.group(1)), int(m.group(2))
            m = re.search(r"(\d+(?:\.\d+)?)\s*fps", line)
            if m:
                fps = float(m.group(1))
        if "Duration:" in line:
            m = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", line)
            if m:
                dur = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    return {"w": w, "h": h, "fps": fps, "dur": dur}


def grab(src: str, dest: str, *, sseof: float | None) -> bool:
    cmd = ["ffmpeg", "-y"]
    if sseof is None:
        cmd += ["-ss", "0"]
    else:
        cmd += ["-sseof", f"-{sseof:.3f}"]
    cmd += ["-i", src, "-frames:v", "1", "-q:v", "2", dest]
    _run(cmd)
    # Flat or small JPEGs are valid and can be well under 1 KB. Empty grabs are not.
    return os.path.isfile(dest) and os.path.getsize(dest) > 64


def load_rgb(path: str) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGB")).astype(np.float32)


def luma(im: np.ndarray) -> np.ndarray:
    return 0.2126 * im[:, :, 0] + 0.7152 * im[:, :, 1] + 0.0722 * im[:, :, 2]


def road_band(im: np.ndarray) -> np.ndarray:
    h, w = im.shape[:2]
    y0, y1 = int(ROAD_Y[0] * h), int(ROAD_Y[1] * h)
    x0, x1 = int(ROAD_X[0] * w), int(ROAD_X[1] * w)
    y1 = max(y0 + 1, y1)
    x1 = max(x0 + 1, x1)
    return luma(im[y0:y1, x0:x1])


def rb_mean(im: np.ndarray) -> float:
    return float(im[:, :, 0].mean() - im[:, :, 2].mean())


def judge_pair(a_path: str, b_path: str, tmp: str) -> dict[str, Any]:
    name_a = os.path.basename(a_path)
    name_b = os.path.basename(b_path)
    fails: list[str] = []
    warns: list[str] = []
    info_a = probe(a_path) if os.path.isfile(a_path) else {}
    info_b = probe(b_path) if os.path.isfile(b_path) else {}
    if not os.path.isfile(a_path):
        fails.append(f"missing file {a_path}")
    if not os.path.isfile(b_path):
        fails.append(f"missing file {b_path}")
    if fails:
        return _result(a_path, b_path, name_a, name_b, info_a, info_b, fails, warns, {})

    dur = info_a.get("dur") or 0.0
    back = 0.08 if dur > 0.2 else 0.02
    fa = os.path.join(tmp, "last_n.jpg")
    fb = os.path.join(tmp, "first_n1.jpg")
    if not grab(a_path, fa, sseof=back):
        fails.append(f"no last frame on {name_a}")
    if not grab(b_path, fb, sseof=None):
        fails.append(f"no first frame on {name_b}")
    if fails:
        return _result(a_path, b_path, name_a, name_b, info_a, info_b, fails, warns, {})

    try:
        ia = load_rgb(fa)
        ib = load_rgb(fb)
    except OSError:
        fails.append("grab was not a readable still")
        return _result(a_path, b_path, name_a, name_b, info_a, info_b, fails, warns, {})
    sa = (int(ia.shape[1]), int(ia.shape[0]))
    sb = (int(ib.shape[1]), int(ib.shape[0]))
    if sa != sb:
        fails.append(f"frame {sa[0]}x{sa[1]} vs {sb[0]}x{sb[1]} (seam is not the same still)")
        summary = {"mae": None, "mae_road": None, "wb": None, "size_a": list(sa), "size_b": list(sb)}
        return _result(a_path, b_path, name_a, name_b, info_a, info_b, fails, warns, summary)
    if sa != FRAME:
        warns.append(f"frame {sa[0]}x{sa[1]} (law 23 road is {FRAME[0]}x{FRAME[1]})")

    mae = float(np.mean(np.abs(ia - ib)))
    mae_road = float(np.mean(np.abs(road_band(ia) - road_band(ib))))
    wb = abs(rb_mean(ia) - rb_mean(ib))
    summary = {
        "mae": round(mae, 3),
        "mae_road": round(mae_road, 3),
        "wb": round(wb, 3),
        "mae_max": MAE_MAX,
        "mae_road_max": MAE_ROAD_MAX,
        "wb_max": WB_MAX,
        "size": list(sa),
    }
    if mae > MAE_MAX:
        fails.append(f"MAE {mae:.2f} > {MAE_MAX:.0f} (last N ≠ first N+1)")
    elif mae > MAE_WARN:
        warns.append(f"MAE {mae:.2f} > {MAE_WARN:.0f} (closer décor — confirm it is still the same still)")
    if mae_road > MAE_ROAD_MAX:
        fails.append(f"road luma MAE {mae_road:.2f} > {MAE_ROAD_MAX:.0f} (asphalt identity / hotter night)")
    elif mae_road > ROAD_WARN:
        warns.append(f"road luma MAE {mae_road:.2f} > {ROAD_WARN:.0f} (check law 31 exposure)")
    if wb > WB_MAX:
        fails.append(f"WB |Δ(R−B)| {wb:.2f} > {WB_MAX:.0f}")
    return _result(a_path, b_path, name_a, name_b, info_a, info_b, fails, warns, summary)


def _result(
    a_path: str,
    b_path: str,
    name_a: str,
    name_b: str,
    info_a: dict[str, Any],
    info_b: dict[str, Any],
    fails: list[str],
    warns: list[str],
    summary: dict[str, Any],
) -> dict[str, Any]:
    return {
        "a": a_path,
        "b": b_path,
        "name": f"{name_a} → {name_b}",
        "probe_a": info_a,
        "probe_b": info_b,
        "verdict": "FAIL" if fails else "PASS",
        "fails": fails,
        "warns": warns,
        "summary": summary,
    }


def fmt_report(res: dict[str, Any]) -> str:
    s = res.get("summary") or {}
    lines = [f"{res['verdict']:4}  {res['name']}"]
    if s.get("mae") is not None:
        lines.append(
            f"      MAE={s.get('mae')}  road={s.get('mae_road')}  WB={s.get('wb')}  "
            f"(caps {MAE_MAX:.0f} / {MAE_ROAD_MAX:.0f} / {WB_MAX:.0f})"
        )
    for f in res.get("fails") or []:
        lines.append(f"      FAIL  {f}")
    for w in res.get("warns") or []:
        lines.append(f"      WARN  {w}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Law 33 seam judge: last frame N vs first frame N+1")
    ap.add_argument("plates", nargs="+", help="mp4 plates in play order (need at least two)")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args(argv)
    results: list[dict[str, Any]] = []
    if len(args.plates) < 2:
        results.append(
            {
                "a": args.plates[0] if args.plates else "",
                "b": "",
                "name": " ".join(args.plates) or "(none)",
                "verdict": "FAIL",
                "fails": ["need at least two plates: last frame N vs first frame N+1"],
                "warns": [],
                "summary": {},
                "probe_a": {},
                "probe_b": {},
            }
        )
    else:
        with tempfile.TemporaryDirectory(prefix="plate-mae-qc-") as tmp:
            for i, (a, b) in enumerate(zip(args.plates, args.plates[1:])):
                pair_tmp = os.path.join(tmp, str(i))
                os.makedirs(pair_tmp, exist_ok=True)
                results.append(judge_pair(a, b, pair_tmp))
    if args.json:
        print(
            json.dumps(
                {
                    "law": 33,
                    "mae_max": MAE_MAX,
                    "mae_road_max": MAE_ROAD_MAX,
                    "wb_max": WB_MAX,
                    "results": results,
                },
                indent=2,
            )
        )
    else:
        print("law 33  plate-mae-qc  (last frame N vs first frame N+1)")
        print(f"MAE≤{MAE_MAX:.0f}  road luma MAE≤{MAE_ROAD_MAX:.0f}  |Δ(R−B)|≤{WB_MAX:.0f}   exit 1 = FAIL")
        print()
        for r in results:
            print(fmt_report(r))
            print()
        nfail = sum(1 for r in results if r["verdict"] != "PASS")
        print(f"{'PASS' if nfail == 0 else 'FAIL'}  {len(results) - nfail}/{len(results)} seams")
    return 0 if results and all(r["verdict"] == "PASS" for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Law 23 — geometric judge for a Lane Video A (empty / densify plate).

A cold Grok runs this BEFORE hang. FAIL = recook, do not hang.
Empty Frost KEEP is the teacher that sealed the thresholds.

  python3 biome/scripts/plate-geo-qc/plate-geo-qc.py road-frost.mp4
  python3 biome/scripts/plate-geo-qc/plate-geo-qc.py --json empty.mp4 d1.mp4 d2.mp4

Needs: ffmpeg, numpy, Pillow. No other deps.
Exit 0 = all plates PASS. Exit 1 = any FAIL.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from typing import Any

import numpy as np
from PIL import Image

# --- sealed numbers (law 20 / 20b + curvature session 2026-09-21) ---
PHI = 1.6180339887
INV_PHI = 1.0 / PHI
INV_PHI2 = 1.0 / (PHI * PHI)  # 0.382 horizon audit
LAW_VP = (0.53, INV_PHI2)  # (x, y) — φ is audit; Bolt X stays 0.50
LAW_W70 = (0.62, 0.84)  # 3-lane at y=0.70 (KEEP ~0.73)
LAW_SEED_SPAN = (0.58, 0.82)  # L–R dash span at y=0.70
INLIER_MIN = 0.75  # empty ~0.86 · d1 ~0.81 · d2 ~0.65 FAIL
SAG_PX_MAX = 12.0  # empty inliers ~7 px
SPREAD_MAX = 0.10  # 1-point: std of {L∩R, L∩C, C∩R}
VPX_STD_MAX = 0.06  # lock-off
VPY_STD_MAX = 0.12
W70_DROP_MAX = 0.12  # first→last pull-back
FRAME = (720, 1280)
FPS_MIN, FPS_MAX = 45.0, 51.0
SAMPLE_FRACS = (0.08, 0.35, 0.62, 0.90)


def _run(cmd: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, capture_output=True, text=True)


def probe(path: str) -> dict[str, Any]:
    """Parse ffmpeg -i (ffprobe is not always installed)."""
    import re

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


def grab(src: str, t: float, dest: str) -> None:
    _run(
        [
            "ffmpeg",
            "-y",
            "-ss",
            f"{t:.3f}",
            "-i",
            src,
            "-frames:v",
            "1",
            "-q:v",
            "2",
            dest,
        ]
    )


def neon_row(im: np.ndarray, y: int) -> np.ndarray:
    row = im[int(np.clip(y, 0, im.shape[0] - 1))]
    return row[:, 1] - np.maximum(row[:, 0], row[:, 2])


def peaks_px(im: np.ndarray, y: int, thr: float = 15.0) -> list[float]:
    n = neon_row(im, y)
    xs = np.where(n > thr)[0]
    if len(xs) < 2:
        return []
    out: list[float] = []
    s = prev = int(xs[0])
    acc = float(xs[0]) * float(n[xs[0]])
    wt = float(n[xs[0]])
    for x in xs[1:]:
        x = int(x)
        if x - prev <= 3:
            acc += x * float(n[x])
            wt += float(n[x])
            prev = x
        else:
            if prev - s >= 2 and wt > 0:
                out.append(acc / wt)
            s = prev = x
            acc = x * float(n[x])
            wt = float(n[x])
    if prev - s >= 2 and wt > 0:
        out.append(acc / wt)
    return out


def seed_three(im: np.ndarray) -> dict[str, float] | None:
    h, w = im.shape[:2]
    best = None
    for yf in np.linspace(0.66, 0.74, 17):
        pks = [x / w for x in peaks_px(im, int(yf * h)) if 0.10 * w < x < 0.90 * w]
        if len(pks) < 3:
            continue
        L, R = min(pks), max(pks)
        C = min(pks, key=lambda x: abs(x - 0.50))
        if C == L or C == R:
            continue
        span = R - L
        if not (LAW_SEED_SPAN[0] <= span <= 0.86):
            continue
        score = -abs(span - 0.73) - abs(C - 0.54) * 0.5
        if best is None or score > best[0]:
            best = (score, float(yf), float(L), float(C), float(R))
    if not best:
        return None
    return {"y": best[1], "L": best[2], "C": best[3], "R": best[4], "span": best[4] - best[2]}


def track(im: np.ndarray, seed: dict[str, float]) -> dict[str, list[tuple[float, float]]]:
    h, w = im.shape[:2]
    tr = {k: [] for k in "LCR"}

    def walk(ys, loc):
        loc = dict(loc)
        for yf in ys:
            pks = [x / w for x in peaks_px(im, int(yf * h)) if 0.06 < x / w < 0.94]
            if not pks:
                continue
            new, used = {}, set()
            for k in "LCR":
                maxj = 0.05 if yf > 0.55 else 0.035
                cand = [p for p in pks if p not in used]
                if not cand:
                    continue
                p = min(cand, key=lambda z: abs(z - loc[k]))
                if abs(p - loc[k]) <= maxj:
                    new[k] = p
                    used.add(p)
            if len(new) < 2:
                continue
            for k, p in new.items():
                tr[k].append((float(yf), float(p)))
                loc[k] = p

    loc0 = {k: seed[k] for k in "LCR"}
    walk(np.arange(seed["y"], 0.88, 0.004), loc0)
    walk(np.arange(seed["y"], 0.38, -0.004), loc0)
    for k in tr:
        tr[k] = sorted(set(tr[k]))
    return tr


def ransac_line(pts: list[tuple[float, float]], thresh: float = 0.012, iters: int = 80):
    if len(pts) < 8:
        return None
    Y = np.array([p[0] for p in pts])
    X = np.array([p[1] for p in pts])
    n = len(Y)
    rng = np.random.default_rng(0)
    best = None
    for _ in range(iters):
        i = rng.choice(n, 2, replace=False)
        if abs(Y[i[1]] - Y[i[0]]) < 0.04:
            continue
        b = (X[i[1]] - X[i[0]]) / (Y[i[1]] - Y[i[0]])
        a = X[i[0]] - b * Y[i[0]]
        resid = X - (a + b * Y)
        inl = np.abs(resid) < thresh
        score = int(inl.sum())
        if best is None or score > best[0]:
            best = (score, a, b)
    if not best:
        return None
    a, b = best[1], best[2]
    resid = X - (a + b * Y)
    inl = np.abs(resid) < thresh
    if int(inl.sum()) < 6:
        return None
    coef = np.polyfit(Y[inl], X[inl], 1)
    resid = X - np.polyval(coef, Y)
    inl = np.abs(resid) < thresh
    sag = resid[inl]
    sag_px = float(sag[np.argmax(np.abs(sag))]) * 720 if len(sag) else 0.0
    return {
        "a": float(coef[1]),
        "b": float(coef[0]),
        "inlier": float(inl.mean()),
        "sag_px": sag_px,
        "n": n,
        "nin": int(inl.sum()),
    }


def meet(f1, f2) -> tuple[float, float]:
    den = f1["b"] - f2["b"]
    if abs(den) < 1e-8:
        return (float("nan"), float("nan"))
    y = (f2["a"] - f1["a"]) / den
    x = f1["a"] + f1["b"] * y
    return float(x), float(y)


def analyze_frame(im: np.ndarray) -> dict[str, Any]:
    seed = seed_three(im)
    if not seed:
        return {"ok": False, "reason": "no 3-dash seed at y=0.70"}
    tr = track(im, seed)
    fits = {k: ransac_line(tr[k]) for k in "LCR"}
    vps = {}
    for a, b in (("L", "R"), ("L", "C"), ("C", "R")):
        if fits[a] and fits[b]:
            vps[a + b] = meet(fits[a], fits[b])
    xs = [v[0] for v in vps.values() if v[0] == v[0] and 0.2 < v[0] < 0.8]
    ys = [v[1] for v in vps.values() if v[1] == v[1] and 0.10 < v[1] < 0.70]
    xv = float(np.median(xs)) if xs else float("nan")
    yv = float(np.median(ys)) if ys else float("nan")
    spread = float(np.hypot(np.std(xs), np.std(ys))) if len(xs) >= 2 else float("nan")
    inliers = [fits[k]["inlier"] for k in "LCR" if fits[k]]
    sags = [abs(fits[k]["sag_px"]) for k in "LCR" if fits[k]]
    Ls = fits["L"]["sag_px"] if fits["L"] else 0.0
    Rs = fits["R"]["sag_px"] if fits["R"] else 0.0
    Cs = fits["C"]["sag_px"] if fits["C"] else 0.0
    optical = abs(Ls + Rs)  # ~0 = barrel/pincushion
    return {
        "ok": True,
        "seed": seed,
        "xv": xv,
        "yv": yv,
        "spread": spread,
        "inlier": float(np.mean(inliers)) if inliers else 0.0,
        "sag_px": float(np.mean(sags)) if sags else 0.0,
        "L_sag": Ls,
        "C_sag": Cs,
        "R_sag": Rs,
        "optical": optical,
        "nL": len(tr["L"]),
        "nC": len(tr["C"]),
        "nR": len(tr["R"]),
    }


def nanmean(xs: list[float]) -> float:
    v = [x for x in xs if x == x]
    return float(np.mean(v)) if v else float("nan")


def nanstd(xs: list[float]) -> float:
    v = [x for x in xs if x == x]
    return float(np.std(v)) if len(v) >= 2 else float("nan")


def judge_plate(path: str, tmp: str) -> dict[str, Any]:
    name = os.path.basename(path)
    info = probe(path)
    fails: list[str] = []
    warns: list[str] = []

    w, h = info.get("w"), info.get("h")
    if (w, h) != FRAME:
        fails.append(f"frame {w}x{h} ≠ {FRAME[0]}x{FRAME[1]}")
    fps = info.get("fps")
    if fps is None:
        warns.append("fps unknown")
    elif not (FPS_MIN <= fps <= FPS_MAX):
        fails.append(f"fps {fps:.2f} outside {FPS_MIN:.0f}–{FPS_MAX:.0f}")
    dur = info.get("dur") or 6.0

    frames = []
    for i, frac in enumerate(SAMPLE_FRACS):
        t = max(0.05, min((dur - 0.08) * frac, max(dur - 0.08, 0.1)))
        dest = os.path.join(tmp, f"{name}.{i}.jpg")
        grab(path, t, dest)
        if not os.path.isfile(dest) or os.path.getsize(dest) < 1000:
            fails.append(f"no frame at t={t:.2f}")
            continue
        im = np.asarray(Image.open(dest).convert("RGB")).astype(np.float32)
        an = analyze_frame(im)
        an["t"] = t
        frames.append(an)

    okf = [f for f in frames if f.get("ok")]
    if len(okf) < 2:
        fails.append("could not seed 3 neon dashes (not a 3-lane nationale)")
        return {
            "file": path,
            "name": name,
            "probe": info,
            "verdict": "FAIL",
            "fails": fails,
            "warns": warns,
            "frames": frames,
        }

    spans = [f["seed"]["span"] for f in okf]
    xv = [f["xv"] for f in okf]
    yv = [f["yv"] for f in okf]
    spr = [f["spread"] for f in okf]
    inl = [f["inlier"] for f in okf]
    sag = [f["sag_px"] for f in okf]
    opt = [f["optical"] for f in okf]

    m_span = nanmean(spans)
    m_xv, s_xv = nanmean(xv), nanstd(xv)
    m_yv, s_yv = nanmean(yv), nanstd(yv)
    m_spr = nanmean(spr)
    m_inl = nanmean(inl)
    m_sag = nanmean(sag)
    m_opt = nanmean(opt)
    drop = spans[-1] - spans[0]

    if not (LAW_SEED_SPAN[0] <= m_span <= LAW_SEED_SPAN[1]):
        fails.append(f"3-lane span@0.70 {m_span:.3f} outside {LAW_SEED_SPAN[0]:.2f}–{LAW_SEED_SPAN[1]:.2f}")
    if m_inl < INLIER_MIN:
        fails.append(f"dash inliers {m_inl:.0%} < {INLIER_MIN:.0%} (I2V warp / fake neon)")
    if m_sag == m_sag and m_sag > SAG_PX_MAX:
        fails.append(f"|sag| {m_sag:.1f}px > {SAG_PX_MAX:.0f}px (curved rays)")
    if m_spr == m_spr and m_spr > SPREAD_MAX:
        fails.append(f"1-point spread {m_spr:.3f} > {SPREAD_MAX:.2f} (not one VP)")
    if s_xv == s_xv and s_xv > VPX_STD_MAX:
        fails.append(f"VP.x wander σ={s_xv:.3f} > {VPX_STD_MAX:.2f} (camera not lock-off)")
    if s_yv == s_yv and s_yv > VPY_STD_MAX:
        fails.append(f"VP.y wander σ={s_yv:.3f} > {VPY_STD_MAX:.2f} (horizon rolling)")
    if drop < -W70_DROP_MAX:
        fails.append(f"3-lane shrink {drop:+.3f} (pull-back / reverse)")
    if m_xv == m_xv and not (0.46 <= m_xv <= 0.60):
        fails.append(f"VP.x {m_xv:.3f} off law 0.53 (yaw)")

    # shear vs optical — warn, fail only if wild
    if m_opt == m_opt and m_opt > 20:
        warns.append(f"shear L+R sag {m_opt:.1f}px (I2V cisaillement, empty ~0)")

    summary = {
        "span70": round(m_span, 3),
        "vp": (None if m_xv != m_xv else round(m_xv, 3), None if m_yv != m_yv else round(m_yv, 3)),
        "vp_std": (None if s_xv != s_xv else round(s_xv, 3), None if s_yv != s_yv else round(s_yv, 3)),
        "spread": None if m_spr != m_spr else round(m_spr, 3),
        "inliers": None if m_inl != m_inl else round(m_inl, 3),
        "sag_px": None if m_sag != m_sag else round(m_sag, 1),
        "span_drop": round(drop, 3),
        "optical_px": None if m_opt != m_opt else round(m_opt, 1),
        "law_vp": list(LAW_VP),
        "phi": {"phi": round(PHI, 4), "inv": round(INV_PHI, 4), "inv2": round(INV_PHI2, 4)},
    }
    verdict = "FAIL" if fails else "PASS"
    return {
        "file": path,
        "name": name,
        "probe": info,
        "verdict": verdict,
        "fails": fails,
        "warns": warns,
        "summary": summary,
        "frames": [
            {
                "t": round(f["t"], 2),
                "ok": f.get("ok"),
                "span": None if not f.get("ok") else round(f["seed"]["span"], 3),
                "xv": None if not f.get("ok") or f["xv"] != f["xv"] else round(f["xv"], 3),
                "yv": None if not f.get("ok") or f["yv"] != f["yv"] else round(f["yv"], 3),
                "inlier": None if not f.get("ok") else round(f["inlier"], 3),
                "sag_px": None if not f.get("ok") else round(f["sag_px"], 1),
            }
            for f in frames
        ],
    }


def fmt_report(res: dict[str, Any]) -> str:
    p = res["probe"]
    lines = [
        f"{res['verdict']:4}  {res['name']}  {p.get('w')}x{p.get('h')}  {p.get('fps') or '?'}fps  {p.get('dur') or '?'}s",
    ]
    s = res.get("summary") or {}
    if s:
        vp = s.get("vp") or (None, None)
        lines.append(
            f"      span70={s.get('span70')}  VP=({vp[0]},{vp[1]}) σ={s.get('vp_std')}  "
            f"1pt={s.get('spread')}  inliers={s.get('inliers')}  |sag|={s.get('sag_px')}px  drop={s.get('span_drop')}"
        )
    for f in res.get("fails") or []:
        lines.append(f"      FAIL  {f}")
    for w in res.get("warns") or []:
        lines.append(f"      WARN  {w}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Law 23 geometric judge for Lane Video A")
    ap.add_argument("plates", nargs="+", help="mp4 plate(s)")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args(argv)
    results = []
    with tempfile.TemporaryDirectory(prefix="plate-geo-qc-") as tmp:
        for p in args.plates:
            if not os.path.isfile(p):
                results.append({"file": p, "name": os.path.basename(p), "verdict": "FAIL", "fails": ["missing file"], "warns": [], "probe": {}})
                continue
            results.append(judge_plate(p, tmp))
    if args.json:
        print(json.dumps({"law": 23, "results": results}, indent=2))
    else:
        print("law 23  plate-geo-qc  (1-point · lock-off · 3-lane · curvature)")
        print(f"law VP ({LAW_VP[0]}, {LAW_VP[1]:.3f})  span@0.70 {LAW_SEED_SPAN[0]}–{LAW_SEED_SPAN[1]}  inliers≥{INLIER_MIN:.0%}  |sag|≤{SAG_PX_MAX:.0f}px")
        print()
        for r in results:
            print(fmt_report(r))
            print()
        nfail = sum(1 for r in results if r["verdict"] != "PASS")
        print(f"{'PASS' if nfail == 0 else 'FAIL'}  {len(results) - nfail}/{len(results)} plates")
    return 0 if all(r["verdict"] == "PASS" for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())

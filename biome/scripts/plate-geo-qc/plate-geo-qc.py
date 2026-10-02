#!/usr/bin/env python3
"""Law 23 — geometric judge for a Lane Video A (empty / densify plate).

A cold Grok runs this BEFORE hang. FAIL = recook, do not hang.
Empty Frost KEEP is the teacher that sealed the thresholds.

  python3 biome/scripts/plate-geo-qc/plate-geo-qc.py road-frost.mp4
  python3 biome/scripts/plate-geo-qc/plate-geo-qc.py --json empty.mp4 d1.mp4 d2.mp4

Rail 12 reports (not the hang gate; they do not change the dash judge):

  python3 biome/scripts/plate-geo-qc/plate-geo-qc.py --report horizon --image plate.png
  python3 biome/scripts/plate-geo-qc/plate-geo-qc.py --report sky --manifest sky.json
  python3 biome/scripts/plate-geo-qc/plate-geo-qc.py --report turn --manifest views.json
  python3 biome/scripts/plate-geo-qc/plate-geo-qc.py --report sun --manifest sun.json
  python3 biome/scripts/plate-geo-qc/plate-geo-qc.py --report texel --manifest tiles.json
  python3 biome/scripts/plate-geo-qc/plate-geo-qc.py --report scale --manifest scale.json

Needs: ffmpeg, numpy, Pillow. No other deps.
Exit 0 = all plates PASS. Exit 1 = any FAIL.
"""
from __future__ import annotations

import argparse
import json
import math
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

# Rail 12 (2026-10-02). Practice, not an xAI seal. Reports only.
# The dash judge above is unchanged. These numbers are not law-23 thresholds.
LEVEL_HORIZON = 0.50
PITCHED_HORIZON = 0.38  # law 20 / 24 Frost cone; also 1/3 and 1/φ²
HORIZON_TOL = 0.02
HORIZON_STRENGTH_MIN = 15.0  # same luma count as peaks_px; a row-mean step, not a dash
PHONE_W, PHONE_H = 720, 1600
SKY_N = 8
SKY_HFOV = 60.0
SKY_STEP = 45.0
SKY_OVERLAP = 0.25
TURN_ELEV = 15.0
TURN_HFOV = 24.0
TURN_HFOV_TOL = 1.0
BOLT_WITHERS_M = 0.60
SUN_HALF_DEG = 90.0  # bright side stays in the same half-plane
EDIT_SOURCES_MAX = 5
TEXEL_REL = 0.02


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


def _load_rgb(path: str) -> np.ndarray:
    if not os.path.isfile(path):
        raise FileNotFoundError(path)
    return np.asarray(Image.open(path).convert("RGB"))


def _read_manifest(path: str | None) -> dict[str, Any]:
    if not path:
        return {}
    if not os.path.isfile(path):
        raise FileNotFoundError(path)
    data = json.loads(open(path, encoding="utf-8").read())
    if not isinstance(data, dict):
        raise ValueError("manifest must be an object")
    return data


def measure_horizon(rgb: np.ndarray) -> dict[str, Any]:
    """Strongest row-mean step. frac is the first row of the far side, from the top."""
    gray = rgb.astype(np.float32).mean(axis=2).mean(axis=1)
    height = int(gray.shape[0])
    if height < 8:
        return {"frac": None, "row": None, "strength": 0.0, "height": height}
    diff = np.diff(gray)
    lo = max(1, int(round(0.05 * len(diff))))
    hi = min(len(diff) - 1, int(round(0.95 * len(diff))))
    window = diff[lo:hi]
    rel = int(np.argmax(np.abs(window)))
    strength = float(abs(window[rel]))
    ground_row = lo + rel + 1
    return {
        "frac": ground_row / float(height),
        "row": ground_row,
        "strength": strength,
        "height": height,
    }


def _pitched(frac: float) -> bool:
    return (
        abs(frac - PITCHED_HORIZON) <= HORIZON_TOL
        or abs(frac - (1.0 / 3.0)) <= HORIZON_TOL
        or abs(frac - INV_PHI2) <= HORIZON_TOL
    )


def report_horizon(payload: dict[str, Any]) -> dict[str, Any]:
    fails: list[str] = []
    warns: list[str] = []
    path = payload.get("image")
    try:
        measured = measure_horizon(_load_rgb(str(path)))
    except (FileNotFoundError, OSError) as exc:
        return {"kind": "horizon", "verdict": "FAIL", "failures": [f"missing image {exc}"], "warns": [], "numbers": {}}
    frac = measured["frac"]
    strength = float(measured["strength"])
    pitch = payload.get("pitchDeg")
    numbers = {
        "frac": None if frac is None else round(frac, 4),
        "row": measured["row"],
        "height": measured["height"],
        "strength": round(strength, 2),
        "level": LEVEL_HORIZON,
        "phoneRow": PHONE_H // 2,
        "pitchDeg": pitch,
    }
    if frac is None or strength < HORIZON_STRENGTH_MIN:
        fails.append(f"no horizon step strength={strength:.1f} min={HORIZON_STRENGTH_MIN:.0f}")
    elif pitch in (None, 0, 0.0):
        if _pitched(frac):
            fails.append(
                f"horizon {frac:.3f} is a pitched camera (0.38 / 0.382 / 1/3). "
                "State the pitch. Do not mix it with a level 1-point plate."
            )
        elif abs(frac - LEVEL_HORIZON) > HORIZON_TOL:
            fails.append(f"horizon {frac:.3f} is not the level row {LEVEL_HORIZON:.2f}")
    else:
        if abs(frac - LEVEL_HORIZON) <= HORIZON_TOL:
            fails.append(
                f"pitch {pitch}° is stated but the horizon is the level row {frac:.3f}"
            )
        elif not _pitched(frac):
            fails.append(
                f"pitched horizon {frac:.3f} is not 0.38, 0.382, or 1/3 (pitch {pitch}°)"
            )
    if measured["height"] == PHONE_H and measured["row"] == PHONE_H // 2 and not fails:
        numbers["phoneRowHit"] = True
    return {
        "kind": "horizon",
        "verdict": "FAIL" if fails else "PASS",
        "failures": fails,
        "warns": warns,
        "numbers": numbers,
    }


def focal_px(width: float, hfov_deg: float) -> float:
    """f_px = (W/2) / tan(HFOV/2). Width is measured pixels."""
    half = math.radians(hfov_deg) / 2.0
    return (float(width) / 2.0) / math.tan(half)


def report_sky(payload: dict[str, Any]) -> dict[str, Any]:
    fails: list[str] = []
    warns: list[str] = []
    if payload.get("projection") == "equirect":
        w = payload.get("widthPx")
        h = payload.get("heightPx")
        if not w or not h:
            fails.append("equirect width and height were not measured")
        elif abs((float(w) / float(h)) - 2.0) > 1e-6:
            fails.append(f"equirect width/height {float(w) / float(h):.4f} is not 2 (2π/π)")
        return {
            "kind": "sky",
            "verdict": "FAIL" if fails else "PASS",
            "failures": fails,
            "warns": ["equirect is code only; Imagine does not emit it"],
            "numbers": {"widthPx": w, "heightPx": h, "aspect": None if not w or not h else round(float(w) / float(h), 4)},
        }
    slices = list(payload.get("slices") or [])
    hfov = payload.get("hfovDeg")
    step = payload.get("stepDeg", SKY_STEP)
    n = len(slices)
    if n != SKY_N:
        fails.append(f"slice count {n} is not {SKY_N} (the circle is not closed)")
    if hfov is None:
        fails.append("hfovDeg not stated")
    else:
        hfov = float(hfov)
        if hfov > SKY_HFOV + 1e-6:
            fails.append(f"HFOV {hfov:.1f}° is over {SKY_HFOV:.0f}°")
        if hfov > 70:
            fails.append(f"HFOV {hfov:.1f}° stretches a rectilinear slice (about 70°)")
        if abs(hfov - SKY_HFOV) > 1e-6:
            fails.append(f"closing set HFOV is {SKY_HFOV:.0f}°, got {hfov:.1f}°")
    step = float(step)
    if abs(step - SKY_STEP) > 1e-6:
        fails.append(f"step {step:.1f}° is not {SKY_STEP:.0f}°")
    if abs(n * step - 360.0) > 1e-6:
        fails.append(f"n*step {n * step:.1f}° does not close 360°")
    overlap = None
    if hfov not in (None,) and hfov:
        overlap = (float(hfov) - step) / float(hfov)
        if abs(overlap - SKY_OVERLAP) > 1e-6:
            fails.append(f"overlap {overlap:.3f} is not {SKY_OVERLAP:.2f}")
    stated = payload.get("overlap")
    if stated is not None and overlap is not None and abs(float(stated) - overlap) > 1e-6:
        fails.append(f"stated overlap {stated} does not match (HFOV-step)/HFOV {overlap:.3f}")
    yaws = []
    widths = []
    focals = []
    for index, sl in enumerate(slices):
        if not isinstance(sl, dict):
            fails.append(f"slice {index} is not an object")
            continue
        yaw = sl.get("yawDeg")
        if yaw is None:
            fails.append(f"slice {index} has no yawDeg")
        else:
            yaws.append(float(yaw) % 360.0)
        width = sl.get("widthPx")
        if width in (None, 0):
            fails.append(f"slice {index} width was not measured (do not assume 2k)")
        else:
            widths.append(float(width))
            if hfov:
                focals.append(focal_px(float(width), float(hfov)))
    expect = [i * SKY_STEP for i in range(SKY_N)]
    if len(yaws) == SKY_N and sorted(yaws) != expect:
        fails.append(f"yaws {sorted(yaws)} are not {expect}")
    if len(widths) >= 2 and any(abs(w - widths[0]) > 0.5 for w in widths):
        fails.append(f"slice widths {widths} do not share one focal length")
    numbers = {
        "n": n,
        "hfovDeg": hfov,
        "stepDeg": step,
        "overlap": None if overlap is None else round(overlap, 4),
        "widths": widths,
        "fPx": [round(v, 3) for v in focals],
    }
    return {"kind": "sky", "verdict": "FAIL" if fails else "PASS", "failures": fails, "warns": warns, "numbers": numbers}


def report_turn(payload: dict[str, Any]) -> dict[str, Any]:
    fails: list[str] = []
    warns: list[str] = []
    views = list(payload.get("views") or [])
    n = len(views)
    step = 45.0 if n == 8 else 90.0 if n == 4 else None
    if step is None:
        fails.append(f"view count {n} is not 8 (45°) or 4 (90°)")
    yaws = []
    widths = []
    elevs = []
    dists = []
    for index, view in enumerate(views):
        if not isinstance(view, dict):
            fails.append(f"view {index} is not an object")
            continue
        if view.get("yawDeg") is None:
            fails.append(f"view {index} has no yawDeg")
        else:
            yaws.append(float(view["yawDeg"]) % 360.0)
        if view.get("widthPx") not in (None, 0):
            widths.append(float(view["widthPx"]))
        if view.get("elevationDeg") is not None:
            elevs.append(float(view["elevationDeg"]))
        if view.get("distanceM") is not None:
            dists.append(float(view["distanceM"]))
    if step is not None and len(yaws) == n:
        expect = [i * step for i in range(n)]
        if sorted(round(y, 4) for y in yaws) != [round(y, 4) for y in expect]:
            fails.append(f"yaws {sorted(yaws)} are not steps of {step:.0f}°")
    elev = payload.get("elevationDeg")
    if elev is None and elevs:
        elev = elevs[0]
    if elev is None:
        fails.append("elevationDeg not stated")
    elif abs(float(elev) - TURN_ELEV) > 1e-6:
        fails.append(f"elevation {elev}° is not +{TURN_ELEV:.0f}°")
    if elevs and any(abs(e - float(elevs[0])) > 1e-6 for e in elevs):
        fails.append(f"elevations {elevs} are not one angle")
    dist = payload.get("distanceM")
    if dist is None and dists:
        dist = dists[0]
    if dist is None:
        fails.append("distanceM not stated")
    if dists and any(abs(d - dists[0]) > 1e-6 for d in dists):
        fails.append(f"distances {dists} are not one distance")
    hfov = payload.get("hfovDeg")
    if hfov is None:
        fails.append("hfovDeg not stated (85 mm class, about 24°)")
    elif abs(float(hfov) - TURN_HFOV) > TURN_HFOV_TOL:
        fails.append(f"HFOV {hfov}° is outside the 85 mm class ({TURN_HFOV:.0f}° ± {TURN_HFOV_TOL:.0f}°)")
    sources = payload.get("sourceCount")
    if sources is not None and int(sources) > EDIT_SOURCES_MAX:
        fails.append(f"sourceCount {sources} exceeds {EDIT_SOURCES_MAX}")
    focals = []
    if hfov and widths:
        focals = [focal_px(w, float(hfov)) for w in widths]
        if any(abs(f - focals[0]) > 0.05 for f in focals):
            fails.append("measured widths do not share one f_px")
    elif not widths:
        warns.append("width not measured; f_px skipped")
    return {
        "kind": "turn",
        "verdict": "FAIL" if fails else "PASS",
        "failures": fails,
        "warns": warns,
        "numbers": {
            "n": n,
            "stepDeg": step,
            "elevationDeg": elev,
            "distanceM": dist,
            "hfovDeg": hfov,
            "fPx": [round(v, 3) for v in focals],
            "sourceCount": sources,
        },
    }


def shade_azimuth(rgb: np.ndarray) -> float | None:
    gray = rgb.astype(np.float32).mean(axis=2)
    gy, gx = np.gradient(gray)
    vx = float(np.mean(gx))
    vy = float(np.mean(gy))
    if abs(vx) + abs(vy) < 1e-3:
        return None
    return float(np.degrees(np.arctan2(vx, -vy)))


def _ang_diff(a: float, b: float) -> float:
    return abs((a - b + 180.0) % 360.0 - 180.0)


def shadow_length(height_m: float, elevation_deg: float) -> float | None:
    tangent = math.tan(math.radians(elevation_deg))
    if tangent <= 1e-8:
        return None
    return float(height_m) / tangent


def report_sun(payload: dict[str, Any]) -> dict[str, Any]:
    fails: list[str] = []
    warns: list[str] = []
    az = payload.get("azimuthDeg")
    el = payload.get("elevationDeg")
    kelvin = payload.get("kelvin")
    if az is None:
        fails.append("azimuthDeg not stated")
    if el is None:
        fails.append("elevationDeg not stated")
    if kelvin is None:
        fails.append("kelvin not stated")
    elif isinstance(kelvin, list) or (isinstance(kelvin, str) and "," in kelvin):
        fails.append("more than one kelvin")
    height = payload.get("heightM", BOLT_WITHERS_M)
    shadow = None
    if el is not None and height is not None:
        shadow = shadow_length(float(height), float(el))
        if shadow is None:
            fails.append("sun elevation is on the horizon; the shadow does not close")
        elif abs(float(el) - 45.0) <= 1e-6 and abs(shadow - float(height)) > 1e-6:
            fails.append(f"45° shadow {shadow} is not the height {height}")
    angles = []
    for path in payload.get("images") or []:
        try:
            ang = shade_azimuth(_load_rgb(str(path)))
        except (FileNotFoundError, OSError) as exc:
            fails.append(f"missing image {exc}")
            continue
        if ang is None:
            fails.append(f"{path} has no shading gradient")
        else:
            angles.append(ang)
    for i in range(len(angles)):
        for j in range(i + 1, len(angles)):
            gap = _ang_diff(angles[i], angles[j])
            if gap > SUN_HALF_DEG:
                fails.append(f"shading azimuths differ by {gap:.1f}° (bright side flipped)")
    return {
        "kind": "sun",
        "verdict": "FAIL" if fails else "PASS",
        "failures": fails,
        "warns": warns,
        "numbers": {
            "azimuthDeg": az,
            "elevationDeg": el,
            "kelvin": kelvin,
            "heightM": height,
            "shadowM": None if shadow is None else round(shadow, 4),
            "shadeDeg": [round(a, 2) for a in angles],
        },
    }


def _seam_tools():
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    if root not in sys.path:
        sys.path.insert(0, root)
    from tools.assetcheck.measures import SEAM_ABS, SEAM_RATIO, edge_seam

    return edge_seam, SEAM_RATIO, SEAM_ABS


def report_texel(payload: dict[str, Any]) -> dict[str, Any]:
    fails: list[str] = []
    warns: list[str] = []
    tiles = list(payload.get("tiles") or [])
    if len(tiles) < 1:
        fails.append("no tiles")
    edge_seam, ratio_max, abs_max = _seam_tools()
    densities = []
    for tile in tiles:
        if not isinstance(tile, dict):
            fails.append("tile is not an object")
            continue
        path = tile.get("file")
        meters = tile.get("meters")
        try:
            rgb = _load_rgb(str(path))
        except (FileNotFoundError, OSError) as exc:
            fails.append(f"missing tile {exc}")
            continue
        if meters in (None, 0):
            fails.append(f"{path} has no world metres")
            continue
        width = int(rgb.shape[1])
        density = width / float(meters)
        densities.append(density)
        horizon = measure_horizon(rgb)
        if float(horizon["strength"]) >= HORIZON_STRENGTH_MIN:
            fails.append(
                f"{path} has a horizon at {horizon['frac']:.3f}; a nadir tile has no horizon and no vanishing point"
            )
        for axis in ("x", "y"):
            seam = edge_seam(rgb, axis)
            if seam["ratio"] > ratio_max and seam["seam"] > abs_max:
                fails.append(
                    f"{path} {axis}-seam ratio={seam['ratio']:.3f} abs={seam['seam']:.2f}"
                )
    if len(densities) >= 2:
        lo, hi = min(densities), max(densities)
        if lo <= 0 or (hi - lo) / lo > TEXEL_REL:
            fails.append(f"texel density {densities} is not constant (px per metre)")
    return {
        "kind": "texel",
        "verdict": "FAIL" if fails else "PASS",
        "failures": fails,
        "warns": warns,
        "numbers": {"pxPerM": [round(v, 3) for v in densities]},
    }


def report_scale(payload: dict[str, Any]) -> dict[str, Any]:
    fails: list[str] = []
    warns: list[str] = []
    f_px = payload.get("fPx")
    height = BOLT_WITHERS_M if payload.get("bolt") else payload.get("heightM")
    dist = payload.get("distanceM")
    if f_px is None:
        fails.append("fPx not stated (lock f)")
    if height is None:
        fails.append("heightM not stated")
    if dist in (None, 0):
        fails.append("distanceM not stated (lock Z)")
    h_px = None
    frac = None
    frame_h = payload.get("frameH")
    if f_px is not None and height is not None and dist not in (None, 0):
        h_px = float(f_px) * float(height) / float(dist)
        if frame_h:
            frac = h_px / float(frame_h)
    measured = payload.get("measuredFrac")
    if measured is not None and frac is not None and abs(float(measured) - frac) > HORIZON_TOL:
        fails.append(
            f"measured fraction {measured} is not h_px/frame {frac:.4f} (state the fraction, then measure)"
        )
    elif measured is None:
        warns.append("no measured fraction; formula only")
    return {
        "kind": "scale",
        "verdict": "FAIL" if fails else "PASS",
        "failures": fails,
        "warns": warns,
        "numbers": {
            "fPx": f_px,
            "heightM": height,
            "distanceM": dist,
            "hPx": None if h_px is None else round(h_px, 3),
            "fraction": None if frac is None else round(frac, 4),
            "boltWithersM": BOLT_WITHERS_M,
        },
    }


REPORTS = {
    "horizon": report_horizon,
    "sky": report_sky,
    "turn": report_turn,
    "sun": report_sun,
    "texel": report_texel,
    "scale": report_scale,
}


def run_report(kind: str, payload: dict[str, Any]) -> dict[str, Any]:
    fn = REPORTS.get(kind)
    if fn is None:
        return {"kind": kind, "verdict": "FAIL", "failures": [f"unknown report {kind}"], "warns": [], "numbers": {}}
    return fn(payload)


def _print_report(res: dict[str, Any]) -> None:
    print(f"{res['verdict']:4}  rail 12  {res['kind']}")
    nums = res.get("numbers") or {}
    if nums:
        print(f"      {json.dumps(nums, sort_keys=True)}")
    for line in res.get("failures") or []:
        print(f"      FAIL  {line}")
    for line in res.get("warns") or []:
        print(f"      WARN  {line}")


def _payload_from_args(args: argparse.Namespace) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    if args.manifest:
        payload.update(_read_manifest(args.manifest))
    if args.image:
        if args.report == "horizon":
            payload["image"] = args.image[0]
        elif args.report == "sun":
            payload["images"] = list(args.image)
        elif args.report == "texel":
            tiles = list(payload.get("tiles") or [])
            for path in args.image:
                tiles.append({"file": path, "meters": args.meters})
            payload["tiles"] = tiles
    if args.pitch_deg is not None:
        payload["pitchDeg"] = args.pitch_deg
    if args.f_px is not None:
        payload["fPx"] = args.f_px
    if args.height_m is not None:
        payload["heightM"] = args.height_m
    if args.distance_m is not None:
        payload["distanceM"] = args.distance_m
    if args.frame_h is not None:
        payload["frameH"] = args.frame_h
    if args.measured_frac is not None:
        payload["measuredFrac"] = args.measured_frac
    if args.azimuth is not None:
        payload["azimuthDeg"] = args.azimuth
    if args.elevation is not None:
        payload["elevationDeg"] = args.elevation
    if args.kelvin is not None:
        payload["kelvin"] = args.kelvin
    if args.bolt:
        payload["bolt"] = True
    return payload


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Law 23 geometric judge for Lane Video A, plus rail 12 reports")
    ap.add_argument("plates", nargs="*", help="mp4 plate(s) for the law 23 dash judge")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--report", choices=sorted(REPORTS))
    ap.add_argument("--image", action="append", default=[])
    ap.add_argument("--manifest")
    ap.add_argument("--pitch-deg", type=float)
    ap.add_argument("--meters", type=float)
    ap.add_argument("--f-px", type=float)
    ap.add_argument("--height-m", type=float)
    ap.add_argument("--distance-m", type=float)
    ap.add_argument("--frame-h", type=float)
    ap.add_argument("--measured-frac", type=float)
    ap.add_argument("--azimuth", type=float)
    ap.add_argument("--elevation", type=float)
    ap.add_argument("--kelvin", type=float)
    ap.add_argument("--bolt", action="store_true")
    args = ap.parse_args(argv)
    if args.report:
        if args.plates:
            print("FAIL usage: --report does not take plates. The dash judge is a separate call.", file=sys.stderr)
            return 2
        try:
            res = run_report(args.report, _payload_from_args(args))
        except (FileNotFoundError, ValueError, json.JSONDecodeError) as exc:
            print(f"FAIL usage: {exc}", file=sys.stderr)
            return 2
        if args.json:
            print(json.dumps({"rail": 12, "result": res}, indent=2))
        else:
            _print_report(res)
        return 0 if res["verdict"] == "PASS" else 1
    if not args.plates:
        ap.error("plates required unless --report")
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

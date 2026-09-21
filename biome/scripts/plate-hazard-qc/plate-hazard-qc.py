#!/usr/bin/env python3
"""Law 25 — hazard-on-cone judge for a Lane Video A.

A cold Grok runs this AFTER law 23 (camera PASS) and BEFORE hang of a
hazard / densify plate. FAIL = recook the hazard, never overwrite empty KEEP.

  python3 biome/scripts/plate-hazard-qc/plate-hazard-qc.py --ref road-frost.mp4 road-frost-d2.mp4
  python3 biome/scripts/plate-hazard-qc/plate-hazard-qc.py --ref road-frost.mp4 --expect 1 d2.mp4
  python3 biome/scripts/plate-hazard-qc/plate-hazard-qc.py --ref road-frost.mp4 --expect 0 d1.mp4

--expect 0  décor only (empty / flora). FAIL if a 3-lane wall appears.
--expect 1  one-lane hazard (meteor). FAIL if wall OR if L+R both blocked.
--expect 2  two-lane hazard. FAIL if all three blocked.

Needs: ffmpeg, numpy, Pillow. Exit 0 = PASS. Exit 1 = FAIL.
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

LAW_VP = (0.53, 0.382)
YV, XV = LAW_VP[1], LAW_VP[0]
FRAME = (720, 1280)
DELTA = 38.0  # luma above KEEP third → blocked
WALL_SAMPLES = 2  # n=3 on this many samples → FAIL wall
SAMPLE_FRACS = (0.08, 0.22, 0.38, 0.52, 0.68, 0.85)
Y_SCAN = np.linspace(0.44, 0.62, 19)


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


def grab(src: str, t: float, dest: str) -> None:
    _run(["ffmpeg", "-y", "-ss", f"{t:.3f}", "-i", src, "-frames:v", "1", "-q:v", "2", dest])


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
        if not (0.58 <= R - L <= 0.86):
            continue
        score = -abs((R - L) - 0.73)
        if best is None or score > best[0]:
            best = (score, float(yf), float(L), float(R))
    if not best:
        return None
    return {"y": best[1], "L": best[2], "R": best[3]}


def third_meds(im: np.ndarray, seed: dict[str, float], yf: float) -> list[float] | None:
    h, w = im.shape[:2]
    ys, L, R = seed["y"], seed["L"], seed["R"]

    def x_at(y: float, xs: float) -> float:
        return XV + (xs - XV) * (y - YV) / (ys - YV)

    xL, xR = x_at(yf, L), x_at(yf, R)
    y = int(np.clip(yf * h, 0, h - 1))
    a, b = int(np.clip(xL * w, 0, w - 1)), int(np.clip(xR * w, 0, w - 1))
    if b - a < 18:
        return None
    row = im[y, a:b].astype(np.float32)
    luma = 0.2126 * row[:, 0] + 0.7152 * row[:, 1] + 0.0722 * row[:, 2]
    green = row[:, 1] - np.maximum(row[:, 0], row[:, 2])
    luma = luma.copy()
    luma[green > 20] = np.nan
    n = len(luma)
    w3 = n // 3
    out = []
    for sl in (luma[0:w3], luma[w3 : 2 * w3], luma[2 * w3 :]):
        v = sl[np.isfinite(sl)]
        out.append(float(np.median(v)) if len(v) > 4 else float("nan"))
    return out


def load_im(path: str, t: float, tmp: str, tag: str) -> np.ndarray | None:
    dest = os.path.join(tmp, f"{tag}_{t:.2f}.jpg")
    grab(path, t, dest)
    if not os.path.isfile(dest) or os.path.getsize(dest) < 1000:
        return None
    return np.asarray(Image.open(dest).convert("RGB")).astype(np.float32)


def times_of(dur: float) -> list[float]:
    return [max(0.05, min((dur - 0.08) * f, max(dur - 0.08, 0.1))) for f in SAMPLE_FRACS]


def ref_profile(path: str, tmp: str) -> np.ndarray | None:
    info = probe(path)
    dur = info.get("dur") or 6.0
    acc = []
    for t in times_of(dur)[:4]:
        im = load_im(path, t, tmp, "ref")
        if im is None:
            continue
        sd = seed_three(im)
        if not sd:
            continue
        row = []
        for yf in Y_SCAN:
            m = third_meds(im, sd, yf)
            row.append(m if m else [np.nan, np.nan, np.nan])
        acc.append(row)
    if not acc:
        return None
    return np.nanmean(np.array(acc, dtype=float), axis=0)


def worst_block(im: np.ndarray, ref: np.ndarray | None) -> dict[str, Any] | None:
    sd = seed_three(im)
    if not sd:
        return None
    worst = None
    for i, yf in enumerate(Y_SCAN):
        m = third_meds(im, sd, float(yf))
        if not m:
            continue
        flags = []
        deltas = []
        for j in range(3):
            if ref is not None and np.isfinite(m[j]) and np.isfinite(ref[i, j]):
                dlt = float(m[j] - ref[i, j])
                deltas.append(dlt)
                flags.append(dlt > DELTA)
            else:
                deltas.append(float("nan"))
                flags.append(bool(np.isfinite(m[j]) and m[j] > 90 and float(yf) < 0.58))
        n = int(sum(flags))
        rec = {"n": n, "yf": float(yf), "flags": flags, "meds": m, "deltas": deltas, "seed": sd}
        if worst is None or n > worst["n"] or (n == worst["n"] and yf > worst["yf"]):
            worst = rec
    return worst


def judge_plate(path: str, tmp: str, ref: np.ndarray | None, expect: int) -> dict[str, Any]:
    name = os.path.basename(path)
    info = probe(path)
    fails: list[str] = []
    warns: list[str] = []
    if (info.get("w"), info.get("h")) != FRAME:
        warns.append(f"frame {info.get('w')}x{info.get('h')} (law 23 should have caught this)")
    dur = info.get("dur") or 6.0
    samples = []
    for t in times_of(dur):
        im = load_im(path, t, tmp, name)
        if im is None:
            fails.append(f"no frame t={t:.2f}")
            continue
        w = worst_block(im, ref)
        if not w:
            samples.append({"t": t, "n": None, "ok": False})
            continue
        fl = "".join("X" if f else "." for f in w["flags"])
        dlt = w.get("deltas") or [float("nan")] * 3
        spread = float(np.nanmax(dlt) - np.nanmin(dlt)) if any(x == x for x in dlt) else 0.0
        samples.append(
            {
                "t": round(t, 2),
                "n": w["n"],
                "mask": fl,
                "y": round(w["yf"], 2),
                "spread": round(spread, 1),
                "ok": True,
            }
        )
    ns = [s["n"] for s in samples if s.get("n") is not None]
    if not ns:
        fails.append("could not seed 3-lane cone (run law 23 first)")
        return {"file": path, "name": name, "verdict": "FAIL", "fails": fails, "warns": warns, "samples": samples, "probe": info}

    peak = max(ns)
    nwall = sum(1 for n in ns if n >= 3)
    first = ns[0]
    spreads = [s.get("spread") or 0 for s in samples if s.get("n") is not None]
    # décor lighting = all 3 thirds up together (small spread). A real wall/meteor is peaked.
    uniform_wall = nwall >= WALL_SAMPLES and (np.median(spreads) < 22 if spreads else False)

    if expect == 0:
        if nwall >= WALL_SAMPLES and not uniform_wall:
            fails.append(f"3-lane wall on {nwall} samples (law 09: NEVER all three)")
        elif uniform_wall:
            warns.append(f"far-road wash vs KEEP on {nwall} samples (densify lighting, not a peaked hazard)")
    else:
        if first >= 3 and not (spreads and spreads[0] < 22):
            fails.append(f"spawn is already a 3-lane wall (n={first}) — hazard must start as a speck at the VP")
        if nwall >= WALL_SAMPLES:
            fails.append(f"3-lane wall on {nwall} samples (law 09: NEVER all three) — leave L or R open")
        if expect == 1:
            if peak >= 3:
                fails.append("expected 1-lane hazard, got a wall")
            two = sum(1 for n in ns if n >= 2)
            if two >= 2 and peak == 2:
                fails.append("expected 1-lane (one third blocked); 2 thirds blocked — leave a corridor")
            if peak == 0:
                warns.append("expected a 1-lane hazard but no third stayed blocked vs KEEP")
        if expect == 2 and peak <= 0:
            warns.append("expected 2-lane hazard, none detected")

    summary = {
        "peak_thirds": peak,
        "wall_samples": nwall,
        "spawn_n": first,
        "expect": expect,
        "formula": "x(y)=x_VP + b_lane*(y-y_v)  w_haz(y)=k_lane*(y-y_v)  lanes<=2",
        "law_vp": list(LAW_VP),
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
        "samples": samples,
    }


def fmt(res: dict[str, Any]) -> str:
    p = res.get("probe") or {}
    lines = [f"{res['verdict']:4}  {res['name']}  {p.get('w')}x{p.get('h')}  {p.get('dur') or '?'}s"]
    s = res.get("summary") or {}
    if s:
        lines.append(
            f"      peak thirds={s.get('peak_thirds')}  wall_samples={s.get('wall_samples')}  spawn_n={s.get('spawn_n')}  expect={s.get('expect')}"
        )
    for sm in res.get("samples") or []:
        if sm.get("n") is None:
            continue
        lines.append(f"      t={sm['t']:<5} y={sm.get('y')}  {sm.get('mask')}  n={sm['n']}")
    for f in res.get("fails") or []:
        lines.append(f"      FAIL  {f}")
    for w in res.get("warns") or []:
        lines.append(f"      WARN  {w}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Law 25 hazard-on-cone judge")
    ap.add_argument("plates", nargs="+")
    ap.add_argument("--ref", help="empty KEEP mp4 (road-frost.mp4)")
    ap.add_argument("--expect", type=int, default=0, choices=(0, 1, 2), help="blocked thirds expected (0 décor, 1 meteor, 2 two-lane)")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args(argv)
    results = []
    with tempfile.TemporaryDirectory(prefix="plate-hazard-qc-") as tmp:
        ref = ref_profile(args.ref, tmp) if args.ref else None
        if args.ref and ref is None:
            print("WARN  could not build KEEP ref profile — falling back to absolute luma", file=sys.stderr)
        for p in args.plates:
            if not os.path.isfile(p):
                results.append({"file": p, "name": os.path.basename(p), "verdict": "FAIL", "fails": ["missing file"], "warns": [], "probe": {}})
                continue
            results.append(judge_plate(p, tmp, ref, args.expect))
    if args.json:
        print(json.dumps({"law": 25, "results": results}, indent=2))
    else:
        print("law 25  plate-hazard-qc  (1–2 lanes on the 1-point cone · NEVER 3)")
        print(f"VP ({XV}, {YV:.3f})  Δluma vs KEEP ≥ {DELTA:.0f} → blocked third")
        print()
        for r in results:
            print(fmt(r))
            print()
        nfail = sum(1 for r in results if r["verdict"] != "PASS")
        print(f"{'PASS' if nfail == 0 else 'FAIL'}  {len(results) - nfail}/{len(results)} plates")
    return 0 if all(r["verdict"] == "PASS" for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())

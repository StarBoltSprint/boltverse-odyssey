#!/usr/bin/env python3
"""Material library: add / find / check.

Each entry is a folder under tools/materials/library/<id>/ with
  albedo.jpg   the Imagine tile (1024, tileable)
  height.png   16-bit height (bright = proud)
  normal.jpg   tangent-space normal map baked from height
  metadata.json

Gates (check): dE <= 5 vs key crop, px/m >= 500, no scene content
(no horizon / sky gradient / seam), hex repetition peak <= 0.35 and below plain.
Exit 0 PASS, 1 FAIL, 2 usage.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import shutil
import sys
from pathlib import Path

import cv2
import numpy as np

HERE = Path(__file__).resolve().parent
LIB = HERE / "library"
GATES = {"dE_max": 5.0, "ppm_min": 500.0, "hex_peak_max": 0.35, "seam_mae_max": 12.0, "trend_max": 18.0}
REQUIRED = ["id", "tags", "source", "imagine_prompt", "tile_px", "tile_m", "px_per_m", "repeat_period_m",
            "dE_vs_key", "repetition_peak", "status", "date"]


# ---------- measurements ----------
def lab_mean(img_bgr: np.ndarray, mask: np.ndarray | None = None) -> np.ndarray:
    lab = cv2.cvtColor(img_bgr.astype(np.float32) / 255.0, cv2.COLOR_BGR2LAB)
    return (lab[mask] if mask is not None else lab.reshape(-1, 3)).mean(0)


def delta_e(a_bgr, b_bgr, b_mask=None) -> float:
    return float(np.linalg.norm(lab_mean(a_bgr) - lab_mean(b_bgr, b_mask)))


def normal_from_height(h: np.ndarray, strength: float = 4.0) -> np.ndarray:
    """h float [0,1] -> BGR uint8 tangent normal (OpenGL, +Y up), wraps (tileable)."""
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * strength * h.shape[1] / 64.0
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * strength * h.shape[0] / 64.0
    n = np.dstack([-dx, dy, np.ones_like(h)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    rgb = ((n * 0.5 + 0.5) * 255).astype(np.uint8)
    return rgb[..., ::-1]


def hex_bake(img: np.ndarray, n_tiles: float = 4.0, out_px: int = 1024, seed: int = 1, rot: bool = True) -> np.ndarray:
    """Hex/simplex tiling bake (same math as the three.js shader), small size for checks."""
    T = img.shape[0]
    full = img.astype(np.float32)
    mean = full.reshape(-1, full.shape[2]).mean(0)
    yy, xx = np.mgrid[0:out_px, 0:out_px].astype(np.float32)
    u = xx / out_px * n_tiles
    v = yy / out_px * n_tiles
    U, V = u * 2.0, v * 2.0
    sk = (U + V) * 0.3660254
    i0, j0 = np.floor(U + sk), np.floor(V + sk)
    un = (i0 + j0) * 0.2113249
    x0, y0 = U - (i0 - un), V - (j0 - un)
    upper = x0 > y0
    ws, samples = [], []
    for di, dj in [(0, 0), (np.where(upper, 1, 0), np.where(upper, 0, 1)), (1, 1)]:
        ci, cj = i0 + di, j0 + dj
        uu = ci - (ci + cj) * 0.2113249
        vv = cj - (ci + cj) * 0.2113249
        dx, dy = x0 - (uu - (i0 - un)), y0 - (vv - (j0 - un))
        w = np.maximum(0.5 - dx * dx - dy * dy, 0) ** 2
        hsh = ((ci.astype(np.int64) * 73856093) ^ (cj.astype(np.int64) * 19349663 + seed)) & 0xFFFF
        ox, oy = (hsh * 0.6180339) % 1.0, (hsh * 0.4142135) % 1.0
        if rot:
            a = (hsh % 4) * np.pi / 2
            ca, sa = np.cos(a), np.sin(a)
            uu2, vv2 = u * ca - v * sa + ox, u * sa + v * ca + oy
        else:
            uu2, vv2 = u + ox, v + oy
        px = ((uu2 % 1) * T).astype(np.int32) % T
        py = ((vv2 % 1) * T).astype(np.int32) % T
        ws.append(w)
        samples.append(full[py, px])
    W = np.stack(ws) ** 3
    W /= W.sum(0) + 1e-8
    out = sum(w[..., None] * (s - mean) for w, s in zip(W, samples))
    out = out / np.sqrt((W ** 2).sum(0))[..., None] + mean
    return np.clip(out, 0, 255).astype(np.uint8)


def repetition_peak(img_bgr: np.ndarray, period_px: int) -> float:
    """Mean horizontal autocorrelation peak beyond 0.3 period (1.0 = perfect repeat)."""
    g = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    g -= g.mean(1, keepdims=True)
    N = g.shape[1]
    F = np.fft.rfft(g, n=2 * N, axis=1)
    ac = np.fft.irfft(F * np.conj(F), axis=1)[:, :N].mean(0)
    ac /= ac[0] + 1e-8
    lag0 = max(2, int(0.3 * period_px))
    return float(ac[lag0:int(0.9 * N)].max())


def repetition_pair(img_bgr: np.ndarray, n_tiles: float = 4.0, out_px: int = 1024) -> dict:
    small = cv2.resize(img_bgr, (int(out_px / n_tiles),) * 2, interpolation=cv2.INTER_AREA)
    plain = np.tile(small, (int(n_tiles), int(n_tiles), 1))[:out_px, :out_px]
    hexed = hex_bake(img_bgr, n_tiles, out_px)
    per = int(out_px / n_tiles)
    return {"plain": round(repetition_peak(plain, per), 3), "hex": round(repetition_peak(hexed, per), 3)}


def scene_content(img_bgr: np.ndarray) -> dict:
    """Cheap 'not a scene' proxy: no top/bottom luminance trend (sky/horizon), wraps seamlessly."""
    g = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    q = g.shape[0] // 4
    trend = abs(float(g[:q].mean() - g[-q:].mean()))
    trend_x = abs(float(g[:, :q].mean() - g[:, -q:].mean()))
    seam = float(np.abs(g[0] - g[-1]).mean() + np.abs(g[:, 0] - g[:, -1]).mean()) / 2
    inner = float(np.abs(np.diff(g, axis=0)).mean())
    return {"trend": round(max(trend, trend_x), 2), "seam_mae": round(max(0.0, seam - inner), 2)}


# ---------- gates ----------
def gate(meta: dict, folder: Path | None = None) -> list[str]:
    fails = []
    for k in REQUIRED:
        if k not in meta:
            fails.append(f"missing {k}")
    if fails:
        return fails
    if meta["dE_vs_key"] > GATES["dE_max"]:
        fails.append(f"dE {meta['dE_vs_key']} > {GATES['dE_max']}")
    if meta["px_per_m"] < GATES["ppm_min"]:
        fails.append(f"px/m {meta['px_per_m']} < {GATES['ppm_min']}")
    rp = meta["repetition_peak"]
    if rp["hex"] > GATES["hex_peak_max"]:
        fails.append(f"hex repetition peak {rp['hex']} > {GATES['hex_peak_max']}")
    if rp["hex"] >= rp["plain"]:
        fails.append("hex tiling does not beat plain tiling")
    sc = meta.get("scene_check") or {}
    if sc.get("trend", 0) > GATES["trend_max"]:
        fails.append(f"scene content: luminance trend {sc['trend']} (sky/horizon?)")
    if sc.get("seam_mae", 0) > GATES["seam_mae_max"]:
        fails.append(f"tile seam {sc['seam_mae']} > {GATES['seam_mae_max']}")
    if folder is not None:
        for f in ("albedo.jpg", "height.png", "normal.jpg"):
            if not (folder / f).is_file():
                fails.append(f"missing file {f}")
    if meta["status"] == "KEEP" and fails:
        fails.append("status KEEP but gates fail")
    return fails


# ---------- commands ----------
def cmd_add(a) -> int:
    lib = Path(a.library)
    dest = lib / a.id
    if dest.exists() and not a.force:
        print(f"FAIL {a.id} exists (use --force)", file=sys.stderr)
        return 1
    alb = cv2.imread(a.albedo, cv2.IMREAD_COLOR)
    if alb is None:
        raise ValueError(f"cannot read {a.albedo}")
    if a.height:
        h = cv2.imread(a.height, cv2.IMREAD_UNCHANGED).astype(np.float32)
        h /= 65535.0 if h.max() > 255 else 255.0
    else:
        l = cv2.cvtColor(alb, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
        h = cv2.GaussianBlur(l, (0, 0), 2) - cv2.GaussianBlur(l, (0, 0), 30)
        h = np.clip((h - np.percentile(h, 1)) / (np.percentile(h, 99) - np.percentile(h, 1) + 1e-6), 0, 1)
    key = cv2.imread(a.key, cv2.IMREAD_COLOR)
    x, y, w, hh = [int(v) for v in a.crop.split(",")]
    crop = key[y:y + hh, x:x + w]
    tile_px = alb.shape[1]
    meta = {
        "id": a.id,
        "tags": [t.strip() for t in a.tags.split(",") if t.strip()],
        "source": {"key_image": a.key_ref or a.key, "crop_box_xywh": [x, y, w, hh]},
        "imagine_prompt": a.prompt,
        "tile_px": tile_px,
        "tile_m": a.tile_m,
        "px_per_m": round(tile_px / a.tile_m, 1),
        "repeat_period_m": a.tile_m,
        "dE_vs_key": round(delta_e(alb, crop), 2),
        "mean_lab": [round(float(v), 2) for v in lab_mean(alb)],
        "repetition_peak": repetition_pair(alb),
        "scene_check": scene_content(alb),
        "status": "FAIL",
        "date": a.date or _dt.date.today().isoformat(),
        "notes": a.notes or "",
    }
    fails = gate(meta)
    meta["status"] = "KEEP" if (not fails and a.keep) else ("FAIL" if fails else "CANDIDATE")
    meta["gate_fails"] = fails
    dest.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(a.albedo, dest / "albedo.jpg") if a.albedo.lower().endswith((".jpg", ".jpeg")) else \
        cv2.imwrite(str(dest / "albedo.jpg"), alb, [cv2.IMWRITE_JPEG_QUALITY, 92])
    cv2.imwrite(str(dest / "height.png"), (h * 65535).astype(np.uint16))
    cv2.imwrite(str(dest / "normal.jpg"), normal_from_height(h), [cv2.IMWRITE_JPEG_QUALITY, 92])
    (dest / "metadata.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(("PASS" if not fails else "FAIL") + f" add {a.id} status={meta['status']} dE={meta['dE_vs_key']} "
          f"px/m={meta['px_per_m']} rep={meta['repetition_peak']}" + ("" if not fails else f" fails={fails}"))
    return 0 if not fails else 1


def iter_lib(lib: Path):
    for p in sorted(lib.glob("*/metadata.json")):
        yield p.parent, json.loads(p.read_text())


def cmd_find(a) -> int:
    want_tags = {t for t in (a.tag or "").split(",") if t}
    target = None
    if a.colour:
        hexs = a.colour.lstrip("#")
        bgr = np.array([[[int(hexs[4:6], 16), int(hexs[2:4], 16), int(hexs[0:2], 16)]]], np.uint8)
        target = lab_mean(bgr)
    rows = []
    for folder, m in iter_lib(Path(a.library)):
        if a.status and m.get("status") != a.status:
            continue
        if want_tags and not want_tags.issubset(set(m.get("tags", []))):
            continue
        d = float(np.linalg.norm(np.array(m["mean_lab"]) - target)) if target is not None else 0.0
        if target is not None and d > a.max_de:
            continue
        rows.append((d, m["id"], m["status"], ",".join(m["tags"]), str(folder)))
    for d, i, s, t, f in sorted(rows):
        print(f"{i}\t{s}\tdE={d:.1f}\t{t}\t{f}")
    return 0 if rows else 1


def cmd_check(a) -> int:
    bad = 0
    n = 0
    for folder, m in iter_lib(Path(a.library)):
        if a.id and m["id"] != a.id:
            continue
        n += 1
        fails = gate(m, folder)
        print(("PASS" if not fails else "FAIL") + f" {m['id']} status={m['status']}" + (f" {fails}" if fails else ""))
        bad += bool(fails)
    if a.id and n == 0:
        print(f"FAIL no material {a.id}", file=sys.stderr)
        return 1
    return 1 if bad else 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="materials.py", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--library", default=str(LIB))
    sub = p.add_subparsers(dest="cmd")
    s = sub.add_parser("add")
    s.add_argument("--id", required=True)
    s.add_argument("--albedo", required=True)
    s.add_argument("--height")
    s.add_argument("--key", required=True, help="key image path (for dE)")
    s.add_argument("--key-ref", help="repo-relative key name stored in metadata")
    s.add_argument("--crop", required=True, help="x,y,w,h crop box in the key")
    s.add_argument("--prompt", required=True)
    s.add_argument("--tile-m", type=float, required=True)
    s.add_argument("--tags", default="")
    s.add_argument("--keep", action="store_true", help="mark KEEP if every gate passes")
    s.add_argument("--date")
    s.add_argument("--notes")
    s.add_argument("--force", action="store_true")
    f = sub.add_parser("find")
    f.add_argument("--tag")
    f.add_argument("--colour", help="hex like #3a4a6b")
    f.add_argument("--max-de", type=float, default=15.0)
    f.add_argument("--status")
    c = sub.add_parser("check")
    c.add_argument("--id")
    a = p.parse_args(argv)
    if a.cmd is None:
        p.print_help()
        return 2
    try:
        return {"add": cmd_add, "find": cmd_find, "check": cmd_check}[a.cmd](a)
    except (ValueError, OSError, KeyError) as e:
        print(f"FAIL {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())

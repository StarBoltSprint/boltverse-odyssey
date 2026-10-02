#!/usr/bin/env python3
"""Per-view camera and exposure preflight, before an 8-view orbit is kept.

Imagine does not hold elevation or exposure across edits. This measures each
still against the hero. It does not call Imagine and it does not rewrite a plate.

  python3 tools/objsheet/preflight.py --views <dir> --hero <file> --out <proof>

Exit 0 when every view PASSes. Exit 1 when any view FAILs.
A failing orbit falls back to 3-4 views for a hero ship, or to 4 views at 90°
for a calibrated turnaround. Stop after 2 failures of the same defect.
`--kind hero-ship` makes 3-4 views the default and fails any other count.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

LUMA_REL = 0.10
HUE_CORR_MIN = 0.80
IOU_MIN = 0.55
TOP_REL = 0.25
GROUND_GAP = 0.12
ELEV_SPREAD = 12.0

FALLBACK = (
    "Fall back to 3-4 views for a hero ship (front, 3/4, side, optional back). "
    "A calibrated turnaround falls back to 4 views at 90°. "
    "A 120° arc does not pass. Do not cook eight yaws. "
    "Stop after 2 failures of this same defect. "
    "A small Imagine-intrinsic miss is listed and accepted, not fought with more quota."
)

HERO_SHIP_DEFAULT = (
    "Hero ship default is 3-4 views: front, 3/4, side, optional back. "
    "The picture method is not chosen. "
    "Do not cook an 8-view orbit for this ship."
)

HERO_SHIP_COUNTS = (3, 4)


def load_rgba(path: Path) -> np.ndarray:
    with Image.open(path) as im:
        return np.array(im.convert("RGBA"))


def foreground(rgba: np.ndarray) -> np.ndarray:
    alpha = rgba[..., 3]
    if int(alpha.min()) < 250:
        return alpha > 16
    rgb = rgba[..., :3].astype(np.float32)
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]], axis=0)
    bg = np.median(border, axis=0)
    if bg[1] > bg[0] + 40 and bg[1] > bg[2] + 40:
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        green = (g > 140) & (g > r + 40) & (g > b + 40)
        return ~green
    dist = np.linalg.norm(rgb - bg, axis=2)
    return dist > 18.0


def mask_luma(rgba: np.ndarray, mask: np.ndarray) -> float:
    if not mask.any():
        return 0.0
    rgb = rgba[..., :3].astype(np.float32)
    return float(rgb[mask].mean())


def hue_hist(rgba: np.ndarray, mask: np.ndarray, bins: int = 16) -> np.ndarray:
    rgb = rgba[..., :3].astype(np.float32)
    if not mask.any():
        return np.zeros(bins, np.float32)
    r, g, b = rgb[..., 0][mask], rgb[..., 1][mask], rgb[..., 2][mask]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    delta = np.maximum(mx - mn, 1e-6)
    hue = np.zeros_like(mx)
    mr = mx == r
    mg = mx == g
    mb = mx == b
    hue[mr] = ((g[mr] - b[mr]) / delta[mr]) % 6
    hue[mg] = (b[mg] - r[mg]) / delta[mg] + 2
    hue[mb] = (r[mb] - g[mb]) / delta[mb] + 4
    hue = (hue / 6.0) % 1.0
    hist, _ = np.histogram(hue, bins=bins, range=(0.0, 1.0))
    hist = hist.astype(np.float32)
    total = float(hist.sum())
    if total <= 0:
        return hist
    return hist / total


def corr(a: np.ndarray, b: np.ndarray) -> float:
    if float(a.std()) < 1e-6 or float(b.std()) < 1e-6:
        return 1.0 if np.allclose(a, b) else 0.0
    return float(np.corrcoef(a, b)[0, 1])


def silhouette(mask: np.ndarray) -> dict:
    ys, xs = np.where(mask)
    h, w = mask.shape
    if len(ys) == 0:
        return {"empty": True, "topFraction": 0.0, "groundGap": 1.0, "elevationDeg": 0.0, "cy": 0.0, "cx": 0.0}
    top, bot = int(ys.min()), int(ys.max())
    left, right = int(xs.min()), int(xs.max())
    widths = mask.sum(axis=1)
    keel = int(np.argmax(widths))
    span = max(1, bot - top)
    above = float(mask[:keel].sum()) / float(max(int(mask.sum()), 1))
    ground_gap = 1.0 - (bot + 1) / float(h)
    # Side view: the widest row sits near the lower hull, so little area is above it
    # and the contact is low. A plan view lifts the contact and puts area above the keel.
    elevation = float(np.degrees(np.arctan2(above * span, max(1, right - left))))
    return {
        "empty": False,
        "topFraction": round(above, 4),
        "groundGap": round(ground_gap, 4),
        "elevationDeg": round(elevation, 4),
        "cy": float(ys.mean()),
        "cx": float(xs.mean()),
        "height": bot - top + 1,
        "width": right - left + 1,
        "frame": [h, w],
    }


def centered_iou(a: np.ndarray, b: np.ndarray, ca: dict, cb: dict) -> float:
    if ca.get("empty") or cb.get("empty"):
        return 0.0
    dy = int(round(ca["cy"] - cb["cy"]))
    dx = int(round(ca["cx"] - cb["cx"]))
    shifted = np.zeros_like(a)
    h, w = a.shape
    y0 = max(0, dy)
    y1 = min(h, h + dy)
    x0 = max(0, dx)
    x1 = min(w, w + dx)
    sy0 = max(0, -dy)
    sy1 = sy0 + (y1 - y0)
    sx0 = max(0, -dx)
    sx1 = sx0 + (x1 - x0)
    if y1 <= y0 or x1 <= x0:
        return 0.0
    shifted[y0:y1, x0:x1] = b[sy0:sy1, sx0:sx1]
    inter = np.logical_and(a, shifted).sum()
    union = np.logical_or(a, shifted).sum()
    if union < 1:
        return 0.0
    return float(inter) / float(union)


def grade(name: str, rgba: np.ndarray, hero_rgba: np.ndarray, hero_mask, hero_stats, hero_hue, hero_luma) -> dict:
    mask = foreground(rgba)
    stats = silhouette(mask)
    luma = mask_luma(rgba, mask)
    hue = hue_hist(rgba, mask)
    hs = corr(hue, hero_hue)
    iou = centered_iou(hero_mask, mask, hero_stats, stats)
    failures = []
    if hero_luma > 8:
        rel = abs(luma - hero_luma) / hero_luma
    else:
        rel = abs(luma - hero_luma) / 8.0
    if rel > LUMA_REL:
        failures.append(f"FAIL view {name} luma {luma:.1f} vs hero {hero_luma:.1f} rel={rel:.3f} limit={LUMA_REL}")
    if hs < HUE_CORR_MIN:
        failures.append(f"FAIL view {name} hue corr={hs:.3f} limit={HUE_CORR_MIN}")
    if iou < IOU_MIN:
        failures.append(f"FAIL view {name} silhouette IoU={iou:.3f} limit={IOU_MIN}")
    top_delta = abs(stats["topFraction"] - hero_stats["topFraction"])
    top_lim = TOP_REL * max(hero_stats["topFraction"], 0.05)
    if top_delta > top_lim or abs(stats["groundGap"] - hero_stats["groundGap"]) > GROUND_GAP:
        failures.append(
            f"FAIL view {name} elevation topFraction={stats['topFraction']} hero={hero_stats['topFraction']} "
            f"groundGap={stats['groundGap']} heroGap={hero_stats['groundGap']}"
        )
    if abs(stats["elevationDeg"] - hero_stats["elevationDeg"]) > ELEV_SPREAD and top_delta > top_lim:
        failures.append(
            f"FAIL view {name} elevationDeg={stats['elevationDeg']} hero={hero_stats['elevationDeg']} spread={ELEV_SPREAD}"
        )
    return {
        "file": name,
        "status": "PASS" if not failures else "FAIL",
        "luma": round(luma, 4),
        "lumaRel": round(rel, 4),
        "hueCorr": round(hs, 4),
        "silhouetteIoU": round(iou, 4),
        "topFraction": stats["topFraction"],
        "groundGap": stats["groundGap"],
        "elevationDeg": stats["elevationDeg"],
        "failures": failures,
    }


def recommend(rows: list[dict], kind: str = "orbit", view_count: int | None = None) -> str:
    failed = [row for row in rows if row["status"] != "PASS"]
    if kind == "hero-ship":
        text = HERO_SHIP_DEFAULT
        if view_count is not None and view_count not in HERO_SHIP_COUNTS:
            text += f" This set has {view_count} views; keep 3-4."
        return text
    if not failed:
        return "Views match the hero elevation, luma, hue, and silhouette. An 8-view orbit can proceed."
    return FALLBACK


def collect(folder: Path, hero: Path) -> list[Path]:
    files = sorted(p for p in folder.iterdir() if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"})
    hero_res = hero.resolve()
    return [p for p in files if p.resolve() != hero_res]


def run_views(paths: list[Path], hero: Path, kind: str = "orbit") -> dict:
    hero_rgba = load_rgba(hero)
    hero_mask = foreground(hero_rgba)
    hero_stats = silhouette(hero_mask)
    hero_hue = hue_hist(hero_rgba, hero_mask)
    hero_luma = mask_luma(hero_rgba, hero_mask)
    rows = [grade(path.name, load_rgba(path), hero_rgba, hero_mask, hero_stats, hero_hue, hero_luma) for path in paths]
    view_count = len(paths) + 1
    failures = [line for row in rows for line in row["failures"]]
    if kind == "hero-ship" and view_count not in HERO_SHIP_COUNTS:
        failures.append(
            f"FAIL view count={view_count} hero ship default is 3-4 (front, 3/4, side, optional back)"
        )
    text = recommend(rows, kind, view_count)
    return {
        "ok": not failures,
        "status": "PASS" if not failures else "FAIL",
        "kind": kind,
        "viewCount": view_count,
        "hero": str(hero),
        "heroLuma": round(hero_luma, 4),
        "heroElevationDeg": hero_stats["elevationDeg"],
        "heroTopFraction": hero_stats["topFraction"],
        "views": rows,
        "recommendation": text,
        "failures": failures,
        "limits": {
            "lumaRel": LUMA_REL,
            "hueCorr": HUE_CORR_MIN,
            "silhouetteIoU": IOU_MIN,
            "topFractionRel": TOP_REL,
            "groundGap": GROUND_GAP,
            "elevationSpreadDeg": ELEV_SPREAD,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Preflight an orbit set against its hero still")
    parser.add_argument("--views", type=Path, required=True)
    parser.add_argument("--hero", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--kind", choices=("orbit", "hero-ship"), default="orbit")
    args = parser.parse_args()
    paths = collect(args.views, args.hero)
    if not paths:
        print("FAIL preflight: no views besides the hero", file=sys.stderr)
        return 2
    report = run_views(paths, args.hero, args.kind)
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    lines = [f"# view preflight {report['status']}", "", report["recommendation"], ""]
    for row in report["views"]:
        lines.append(
            f"- {row['status']} {row['file']} elev={row['elevationDeg']} lumaRel={row['lumaRel']} hue={row['hueCorr']} iou={row['silhouetteIoU']}"
        )
    lines.append("")
    (args.out / "report.md").write_text("\n".join(lines))
    print(f"{report['status']} preflight views={len(report['views'])}")
    print(report["recommendation"])
    for line in report["failures"]:
        print(line)
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())

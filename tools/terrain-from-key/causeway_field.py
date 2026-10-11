#!/usr/bin/env python3
"""Zone C walkable causeway. Terrain, and only that.

The Zone B skyline composer builds 15–30 m banks. Zone C forbids that:
the cliffs are solids. This script unprojects the causeway mask onto the
locked ground plane (MoGe-2 eye, pitch, field of view) and writes that deck.

No Imagine images.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from geom import pitch_for_horizon, plane_t, ray_directions


def load_mask(path: Path, size):
    m = Image.open(path).convert("L")
    if m.size != size:
        m = m.resize(size, Image.Resampling.NEAREST)
    return np.asarray(m) > 127


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", type=Path, required=True)
    ap.add_argument("--mask", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--vfov", type=float, default=51.47)
    ap.add_argument("--pitch", type=float, default=7.95)
    ap.add_argument("--eye", type=float, default=1.508)
    ap.add_argument("--horizon", type=float, default=0.6449)
    ap.add_argument("--step", type=int, default=4)
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    rgb = np.asarray(Image.open(args.image).convert("RGB"))
    ih, iw = rgb.shape[:2]
    # The mask was made at max side 1024. Measure on that same frame.
    scale = min(1.0, 1024 / max(iw, ih))
    mw, mh = int(round(iw * scale)), int(round(ih * scale))
    small = np.asarray(Image.fromarray(rgb).resize((mw, mh), Image.Resampling.LANCZOS))
    mask = load_mask(args.mask, (mw, mh))
    # Pitch must put the horizon on the measured row. Use the locked pitch,
    # and record the row geom would give so a drift is visible.
    row = pitch_for_horizon(args.vfov, args.horizon, mw / mh)
    dirs = ray_directions(0.0, args.pitch, args.vfov, mw, mh)
    ts = plane_t(args.eye, dirs, 0.0)
    ys, xs = np.mgrid[0:mh:args.step, 0:mw:args.step]
    sub = mask[ys, xs]
    t = ts[ys, xs]
    ok = sub & np.isfinite(t) & (t > 0.4) & (t < 120)
    d = dirs[ys, xs]
    pts = t[..., None] * d
    pts[..., 1] += args.eye
    # grid index of the subsample
    gh, gw = ys.shape
    vid = -np.ones((gh, gw), np.int32)
    verts = []
    uvs = []
    for j, i in zip(*np.where(ok)):
        vid[j, i] = len(verts)
        p = pts[j, i]
        verts.append((float(p[0]), 0.0, float(p[2])))
        uvs.append(((xs[j, i] + 0.5) / mw, (ys[j, i] + 0.5) / mh))
    faces = []
    for j in range(gh - 1):
        for i in range(gw - 1):
            a, b = vid[j, i], vid[j, i + 1]
            c, d0 = vid[j + 1, i], vid[j + 1, i + 1]
            if min(a, b, c, d0) < 0:
                continue
            faces.append((a, c, b))
            faces.append((b, c, d0))
    obj = args.out / "causeway.obj"
    with obj.open("w") as f:
        f.write("o causeway\n")
        for v in verts:
            f.write(f"v {v[0]:.5f} {v[1]:.5f} {v[2]:.5f}\n")
        for u, v in uvs:
            f.write(f"vt {u:.6f} {1 - v:.6f}\n")
        for a, b, c in faces:
            f.write(f"f {a+1}/{a+1} {b+1}/{b+1} {c+1}/{c+1}\n")
    # Width along the deck: each mask row that hits the plane.
    widths = []
    depths = []
    for y in range(0, mh, 2):
        xs_row = np.where(mask[y])[0]
        if xs_row.size < 4:
            continue
        xl, xr = int(xs_row[0]), int(xs_row[-1])
        tl, tr = ts[y, xl], ts[y, xr]
        if not (np.isfinite(tl) and np.isfinite(tr) and 0.4 < tl < 120 and 0.4 < tr < 120):
            continue
        pl = tl * dirs[y, xl]
        pr = tr * dirs[y, xr]
        widths.append(float(np.hypot(pl[0] - pr[0], pl[2] - pr[2])))
        depths.append(float(-0.5 * (pl[2] + pr[2])))
    widths = np.array(widths)
    hit = mask & np.isfinite(ts) & (ts > 0.4) & (ts < 120)
    iou = float(hit.sum() / max(1, mask.sum()))
    # top-down footprint
    if verts:
        arr = np.array(verts)
        x0, x1 = arr[:, 0].min(), arr[:, 0].max()
        z0, z1 = arr[:, 2].min(), arr[:, 2].max()
    else:
        x0 = x1 = z0 = z1 = 0.0
    canvas = Image.new("RGB", (640, 360), (15, 23, 7))
    dr = ImageDraw.Draw(canvas)
    if verts and x1 > x0 and z0 != z1:
        for v in verts[::3]:
            px = int((v[0] - x0) / (x1 - x0 + 1e-6) * 600 + 20)
            py = int((v[2] - z0) / (z1 - z0 + 1e-6) * 320 + 20)
            dr.point((px, py), fill=(220, 190, 60))
    canvas.save(args.out / "causeway-top.jpg", quality=90)
    # reprojection: paint hits back on the frame
    paint = small.copy()
    paint[hit] = (0.45 * paint[hit] + 0.55 * np.array([220, 190, 60])).astype(np.uint8)
    Image.fromarray(paint).save(args.out / "causeway-reproject.jpg", quality=90)
    report = {
        "what": "walkable causeway only",
        "not": "Zone B dune composer is not run. Cliffs stay solids.",
        "camera": {
            "vfovDeg": args.vfov,
            "pitchDeg": args.pitch,
            "pitchFromHorizonDeg": row,
            "eyeYM": args.eye,
            "horizonRow": args.horizon,
            "yawDeg": 0.0,
        },
        "maskPixels": int(mask.sum()),
        "planeHits": int(hit.sum()),
        "silhouetteIoU": round(iou, 4),
        "widthMedianM": None if widths.size == 0 else round(float(np.median(widths)), 3),
        "widthP10M": None if widths.size == 0 else round(float(np.percentile(widths, 10)), 3),
        "widthP90M": None if widths.size == 0 else round(float(np.percentile(widths, 90)), 3),
        "nearDepthM": None if not depths else round(float(np.min(depths)), 2),
        "farDepthM": None if not depths else round(float(np.max(depths)), 2),
        "spanXM": round(float(x1 - x0), 3),
        "spanZM": round(float(abs(z1 - z0)), 3),
        "vertices": len(verts),
        "triangles": len(faces),
        "maxSlopeDeg": 0.0,
        "heightM": 0.0,
    }
    (args.out / "causeway.json").write_text(json.dumps(report, indent=2))
    print(json.dumps({k: report[k] for k in ("silhouetteIoU", "widthMedianM", "widthP10M", "widthP90M", "vertices", "triangles", "spanXM", "spanZM", "nearDepthM", "farDepthM")}))


if __name__ == "__main__":
    main()

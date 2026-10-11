#!/usr/bin/env python3
"""Key-camera solve for a zone still.

The causeway lips are the luminance step between the deck and the drop
(the slabs are too broken by moss for a colour flood). Those two edges are
fit by RANSAC and extended to their vanishing point. LSD is a second vote.
Pitch comes from geom.pitch_for_horizon. Eye height is 1.7 m until MoGe-2.

Does not paint a game texture.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

from geom import camera_axes, pitch_for_horizon


def segments(gray: np.ndarray) -> np.ndarray:
    lsd = cv2.createLineSegmentDetector(cv2.LSD_REFINE_STD)
    lines = lsd.detect(gray)[0]
    if lines is None:
        return np.zeros((0, 4), np.float64)
    seg = lines.reshape(-1, 4).astype(np.float64)
    length = np.hypot(seg[:, 2] - seg[:, 0], seg[:, 3] - seg[:, 1])
    return seg[length >= 22.0]


def trace_ribbon(rgb: np.ndarray) -> dict:
    """Outer lips: dark-to-light on the left, light-to-dark on the right."""
    r = rgb[..., 0].astype(np.float32)
    g = rgb[..., 1].astype(np.float32)
    b = rgb[..., 2].astype(np.float32)
    luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
    h, w = luma.shape
    kernel = np.ones(21, np.float32) / 21.0
    smooth = np.apply_along_axis(lambda row: np.convolve(row, kernel, mode="same"), 1, luma)
    grad = np.zeros_like(smooth)
    grad[:, 1:-1] = smooth[:, 2:] - smooth[:, :-2]
    cx = w // 2
    rows, lefts, rights = [], [], []
    for y in range(int(h * 0.70), int(h * 0.93)):
        left_search = grad[y, cx - 460 : cx - 20]
        right_search = grad[y, cx + 20 : cx + 460]
        li = int(np.argmax(left_search)) + (cx - 460)
        ri = int(np.argmin(right_search)) + (cx + 20)
        if ri - li < 24:
            continue
        rows.append(y)
        lefts.append(li)
        rights.append(ri)
    if len(rows) < 20:
        raise RuntimeError(f"ribbon too short ({len(rows)} rows)")
    return {
        "rows": np.array(rows, np.int32),
        "left": np.array(lefts, np.float64),
        "right": np.array(rights, np.float64),
    }


def fit_line(xs: np.ndarray, ys: np.ndarray, rng: np.random.Generator, iters: int = 500):
    """x = m y + c. Returns slope, intercept, inlier count."""
    n = len(xs)
    best = None
    for _ in range(iters):
        i, j = rng.choice(n, 2, replace=False)
        if abs(float(ys[i] - ys[j])) < 6:
            continue
        m = (xs[j] - xs[i]) / (ys[j] - ys[i])
        c = xs[i] - m * ys[i]
        resid = np.abs(xs - (m * ys + c))
        inl = resid < 14.0
        count = int(inl.sum())
        if best is None or count > best[0]:
            best = (count, float(m), float(c), inl)
    count, m, c, inl = best
    if int(inl.sum()) >= 2:
        A = np.stack([ys[inl].astype(np.float64), np.ones(int(inl.sum()))], axis=1)
        mc, _, _, _ = np.linalg.lstsq(A, xs[inl], rcond=None)
        m, c = float(mc[0]), float(mc[1])
        resid = np.abs(xs - (m * ys + c))
        inl = resid < 14.0
    return {"m": m, "c": c, "inliers": int(inl.sum()), "n": int(n), "rms": float(np.median(np.abs(xs - (m * ys + c))))}


def intersect_lines(left, right):
    den = left["m"] - right["m"]
    if abs(den) < 1e-8:
        return None
    y = (right["c"] - left["c"]) / den
    x = left["m"] * y + left["c"]
    if not np.isfinite(x) or not np.isfinite(y):
        return None
    return float(x), float(y)


def line_abc_of(seg: np.ndarray) -> np.ndarray:
    x1, y1, x2, y2 = seg.T
    a = y1 - y2
    b = x2 - x1
    c = x1 * y2 - x2 * y1
    n = np.maximum(np.hypot(a, b), 1e-8)
    return np.stack([a / n, b / n, c / n], axis=1)


def ransac_vp(seg: np.ndarray, rng: np.random.Generator, iters: int = 600, thresh: float = 2.4):
    if len(seg) < 8:
        return None
    abc = line_abc_of(seg)
    best = None
    n = len(seg)
    for _ in range(iters):
        i, j = rng.choice(n, 2, replace=False)
        x1, y1, x2, y2 = seg[i]
        x3, y3, x4, y4 = seg[j]
        den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
        if abs(den) < 1e-6:
            continue
        px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / den
        py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / den
        if not np.isfinite(px) or abs(px) > 8000 or abs(py) > 8000:
            continue
        err = np.abs(abc[:, 0] * px + abc[:, 1] * py + abc[:, 2])
        count = int((err < thresh).sum())
        if best is None or count > best[0]:
            best = (count, float(px), float(py))
    if best is None or best[0] < 8:
        return None
    return {"xy": [best[1], best[2]], "inliers": best[0], "segments": int(n)}


def rays_at(yaw_deg, pitch_deg, fov_deg, width, height, xs, ys):
    aspect = width / height
    t = math.tan(math.radians(fov_deg) * 0.5)
    p00 = 1.0 / (aspect * t)
    p11 = 1.0 / t
    ndc_x = (xs + 0.5) / width * 2.0 - 1.0
    ndc_y = 1.0 - (ys + 0.5) / height * 2.0
    lx = ndc_x / p00
    ly = ndc_y / p11
    right, up, forward = camera_axes(yaw_deg, pitch_deg)
    world = lx[:, None] * right + ly[:, None] * up + forward[None, :]
    world /= np.maximum(np.linalg.norm(world, axis=1, keepdims=True), 1e-8)
    return world


def ribbon_width_cv(line_l, line_r, fov, horizon_row, shape, eye_y=1.7):
    ih, iw = shape
    pitch = pitch_for_horizon(fov, horizon_row, iw / ih)
    y0 = max(horizon_row * ih + 12.0, 0.74 * ih)
    y1 = 0.92 * ih
    if y1 - y0 < 20:
        return None
    ys = np.linspace(y0, y1, 16)
    xl = line_l["m"] * ys + line_l["c"]
    xr = line_r["m"] * ys + line_r["c"]
    if np.any(xr - xl < 8) or np.any(xl < 0) or np.any(xr >= iw):
        return None
    dl = rays_at(0.0, pitch, fov, iw, ih, xl, ys)
    dr = rays_at(0.0, pitch, fov, iw, ih, xr, ys)

    def hits(dirs):
        dy = dirs[:, 1]
        ok = dy < -1e-4
        t = np.full(len(dirs), np.nan)
        t[ok] = (0.0 - eye_y) / dy[ok]
        return t[:, None] * dirs, t

    pl, tl = hits(dl)
    pr, tr = hits(dr)
    ok = np.isfinite(tl) & np.isfinite(tr) & (tl > 0.4) & (tr > 0.4) & (tl < 300) & (tr < 300)
    if ok.sum() < 8:
        return None
    widths = np.linalg.norm(pl[ok] - pr[ok], axis=1)
    med = float(np.median(widths))
    if med < 0.3:
        return None
    cv = float(widths.std() / med)
    return {
        "fovDeg": float(fov),
        "pitchDeg": float(pitch),
        "yawDeg": 0.0,
        "widthMedianM": med,
        "widthCVM": cv,
        "widthP10M": float(np.percentile(widths, 10)),
        "widthP90M": float(np.percentile(widths, 90)),
        "samples": int(ok.sum()),
        "score": cv,
    }


def fit_fov(line_l, line_r, horizon_row, shape):
    best = None
    for fov in np.linspace(24.0, 72.0, 49):
        rec = ribbon_width_cv(line_l, line_r, float(fov), horizon_row, shape)
        if rec and (best is None or rec["score"] < best["score"]):
            best = rec
    return best


def draw(rgb, ribbon, line_l, line_r, vp, horizon_row, out_path: Path):
    im = Image.fromarray(rgb.copy())
    drw = ImageDraw.Draw(im)
    h, w = rgb.shape[:2]
    y_h = horizon_row * h
    drw.line([(0, y_h), (w - 1, y_h)], fill=(40, 170, 255), width=3)
    y_near = float(ribbon["rows"][-1])
    y_far = float(vp[1]) if vp else float(ribbon["rows"][0])
    for line, col in ((line_l, (255, 210, 40)), (line_r, (255, 90, 40))):
        drw.line(
            [(line["m"] * y_near + line["c"], y_near), (line["m"] * y_far + line["c"], y_far)],
            fill=col,
            width=3,
        )
    for y, xl, xr in zip(ribbon["rows"][::4], ribbon["left"][::4], ribbon["right"][::4]):
        drw.ellipse((xl - 3, y - 3, xl + 3, y + 3), fill=(255, 230, 80))
        drw.ellipse((xr - 3, y - 3, xr + 3, y + 3), fill=(255, 80, 50))
    if vp:
        x, y = vp
        drw.ellipse((x - 9, y - 9, x + 9, y + 9), outline=(255, 40, 40), width=3)
    im.save(out_path, quality=90)


def solve(image_path: Path, out_dir: Path) -> dict:
    rgb = np.asarray(Image.open(image_path).convert("RGB"))
    h, w = rgb.shape[:2]
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    seg = segments(gray)
    angs = np.array([abs(math.degrees(math.atan2(s[3] - s[1], s[2] - s[0]))) for s in seg]) if len(seg) else np.zeros(0)
    ribbon = trace_ribbon(rgb)
    rng = np.random.default_rng(11)
    left = fit_line(ribbon["left"], ribbon["rows"].astype(np.float64), rng)
    right = fit_line(ribbon["right"], ribbon["rows"].astype(np.float64), rng)
    vp = intersect_lines(left, right)
    horizon_source = "causeway-lips"
    if vp is None or not (-0.15 * w < vp[0] < 1.15 * w) or not (0.25 * h < vp[1] < 0.95 * h):
        horizon = float(np.median(ribbon["rows"]) / h)
        horizon_source = "lips-rejected-vp"
        vp = None
    else:
        horizon = vp[1] / h
    vertical = seg[angs > 78.0] if len(seg) else seg
    if len(vertical):
        my = np.clip(((vertical[:, 1] + vertical[:, 3]) * 0.5).astype(int), 0, h - 1)
        mx = np.clip(((vertical[:, 0] + vertical[:, 2]) * 0.5).astype(int), 0, w - 1)
        vertical = vertical[gray[my, mx] < 145]
    vp_vert = ransac_vp(vertical, rng)
    vert_info = None
    if vp_vert:
        far = abs(vp_vert["xy"][1]) > h * 4
        vert_info = {**vp_vert, "parallel": bool(far), "onePoint": bool(far)}
    fit = fit_fov(left, right, horizon, (h, w)) if vp else None
    # column of the VP against the principal point: yaw stays 0 while it is inside 4% of width
    yaw = 0.0
    if vp and abs(vp[0] - w / 2) > 0.04 * w and fit:
        # small-angle yaw from the horizon pixel offset at this fov
        aspect = w / h
        half = math.tan(math.radians(fit["fovDeg"]) * 0.5) * aspect
        ndc_x = (vp[0] / w) * 2.0 - 1.0
        yaw = math.degrees(math.atan(ndc_x * half))
    report = {
        "image": str(image_path),
        "size": [w, h],
        "segments": int(len(seg)),
        "verticalSegments": int(len(vertical)),
        "ribbonRows": int(len(ribbon["rows"])),
        "ribbonY": [int(ribbon["rows"][0]), int(ribbon["rows"][-1])],
        "leftLine": left,
        "rightLine": right,
        "vanishingCauseway": None if vp is None else {"xy": [vp[0], vp[1]]},
        "vanishingVertical": vert_info,
        "horizonRow": horizon,
        "horizonSource": horizon_source,
        "yawDeg": yaw,
        "eye": [0.0, 1.7, 0.0],
        "eyeSource": "provisional-1.7m-until-moge-2",
        "convention": "three.js YXZ, yaw about Y, pitch about X. geom.pitch_for_horizon.",
        "fit": fit,
        "cliffs": "solids via imagine-to-3d, not terrain relief",
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    draw(rgb, ribbon, left, right, vp, horizon, out_dir / "camera-overlay.jpg")
    (out_dir / "camera.json").write_text(json.dumps(report, indent=2))
    return report


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    report = solve(args.image, args.out)
    fit = report.get("fit") or {}
    vp = report.get("vanishingCauseway")
    print(json.dumps({
        "horizonRow": round(report["horizonRow"], 4),
        "source": report["horizonSource"],
        "yaw": round(report["yawDeg"], 3),
        "fov": None if not fit else round(fit["fovDeg"], 2),
        "pitch": None if not fit else round(fit["pitchDeg"], 3),
        "widthCV": None if not fit else round(fit["widthCVM"], 4),
        "widthM": None if not fit else round(fit["widthMedianM"], 3),
        "vp": None if not vp else [round(v, 1) for v in vp["xy"]],
        "ribbonY": report["ribbonY"],
        "leftInliers": report["leftLine"]["inliers"],
        "rightInliers": report["rightLine"]["inliers"],
        "leftRms": round(report["leftLine"]["rms"], 2),
        "rightRms": round(report["rightLine"]["rms"], 2),
        "onePoint": None if not report["vanishingVertical"] else report["vanishingVertical"]["onePoint"],
    }))


if __name__ == "__main__":
    main()

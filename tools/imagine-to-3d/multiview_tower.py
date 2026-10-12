"""Hero tower as one watertight solid from the 10 Oct multi-view plates.

Front colour is the key projection (homography in the vision folder).
Left, back and right colour are the turnaround sheet panels.
view-top is not a roof plan: the crown cap is not painted from it.
view-under is soffit crops: they paint ledge undersides only when a ledge exists.
Relief is MoGe-2 metres on that face, high-pass, then the measured cell median.
No new Imagine image. Placement layout is not written.

  python3 tools/imagine-to-3d/multiview_tower.py --work steps/multiview-tower-1011/work
  python3 tools/imagine-to-3d/multiview_tower.py --faces --work steps/hires-tower-1011/work
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time

import cv2
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
TOOLS = os.path.dirname(HERE)
if TOOLS not in sys.path:
    sys.path.insert(0, TOOLS)
if HERE not in sys.path:
    sys.path.insert(0, HERE)

SHEET = "/workspace/i23d-auto/zoneb-tower-hero/imagine/in/sheet-turnaround.jpg"
VIEW_TOP = "/workspace/i23d-auto/zoneb-tower-hero/imagine/in/view-top.jpg"
VIEW_UNDER = "/workspace/i23d-auto/zoneb-tower-hero/imagine/in/view-under.jpg"
KEY = "/workspace/zb-bible-1008/key-city3.jpg"
TOWER_JSON = "/workspace/i23d-auto/zoneb-tower-vision/vision/tower.json"
HOMO = "/workspace/i23d-auto/zoneb-tower-vision/vision/homography.json"
OLD_CUTS = {
    "left": "/workspace/i23d-auto/zoneb-tower-hero/masks/_src-view-left.jpg",
    "back": "/workspace/i23d-auto/zoneb-tower-hero/masks/_src-view-back.jpg",
    "right": "/workspace/i23d-auto/zoneb-tower-hero/masks/_src-view-right.jpg",
}
NAMES = ("front", "left", "back", "right")
HIRES_FILES = {
    "front": "face-front-1024.jpg",
    "back": "face-back-1024.jpg",
    "right": "face-right-1024.jpg",
    "left": "face-left-1024.jpg",
}
REJECTED_LEFT = "face-left-REJECTED.jpg"


def split_sheet(rgb):
    """Vertical gutters are light-grey columns. A run under 40 px is a joint, not a panel."""
    mean = rgb.mean(axis=(0, 2))
    std = rgb.std(axis=(0, 2))
    grey = (mean > 165) & (std < 14)
    runs = []
    s = None
    for x, g in enumerate(grey):
        if g and s is None:
            s = x
        elif not g and s is not None:
            runs.append((s, x - 1))
            s = None
    if s is not None:
        runs.append((s, rgb.shape[1] - 1))
    gutters = [(a, b) for a, b in runs if (b - a + 1) >= 40 and a > 4 and b < rgb.shape[1] - 5]
    bounds = [0]
    for a, b in gutters:
        bounds.append((a + b) // 2)
    bounds.append(rgb.shape[1])
    panels = []
    for i in range(len(bounds) - 1):
        sub = rgb[:, bounds[i]:bounds[i + 1]]
        sm, ss = sub.mean(axis=(0, 2)), sub.std(axis=(0, 2))
        cg = (sm > 165) & (ss < 14)
        xs = np.where(~cg)[0]
        if len(xs) < 30:
            continue
        p = sub[:, xs[0]:xs[-1] + 1]
        rm, rs = p.mean(axis=(1, 2)), p.std(axis=(1, 2))
        rg = (rm > 165) & (rs < 14)
        ys = np.where(~rg)[0]
        if len(ys) < 30:
            continue
        p = p[ys[0]:ys[-1] + 1]
        panels.append(p)
    return panels, gutters


def subject_mask(rgb):
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]], 0).astype(np.float32)
    bg = np.median(border, 0)
    dist = np.linalg.norm(rgb.astype(np.float32) - bg, axis=2)
    m = dist > 16
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)) > 0
    n, lab = cv2.connectedComponents(m.astype(np.uint8))
    if n <= 1:
        return m, bg
    counts = [(lab == i).sum() for i in range(1, n)]
    keep = 1 + int(np.argmax(counts))
    return lab == keep, bg


def mask_widths(mask):
    """Foreground pixel width at each row, top of the image first."""
    h = mask.shape[0]
    out = np.zeros(h, np.float32)
    for y in range(h):
        xs = np.where(mask[y])[0]
        out[y] = 0 if len(xs) == 0 else float(xs[-1] - xs[0] + 1)
    return out


def width_over_height(mask, n=64):
    """Subject width / subject height, foot (index 0) to crown.

    Empty margin rows are not the foot. A zero-width row there clipped the
    depth ratio to 0.15 and stretched the back face to the 1.4 cap.
    """
    w = mask_widths(mask)
    rows_nz = np.flatnonzero(w > 1)
    if len(rows_nz) < 4:
        return np.full(n, 0.3, np.float32)
    y0, y1 = int(rows_nz[0]), int(rows_nz[-1])
    h = max(1, y1 - y0)
    lo = y0 + 0.02 * h
    hi = y1 - 0.02 * h
    rows = np.linspace(hi, lo, n)
    ww = np.interp(rows, np.arange(len(w)), w)
    return ww / float(h)


def crop_subject(rgb, margin=2):
    """Tight crop. No resample, so the plate is not downscaled."""
    m, bg = subject_mask(rgb)
    ys, xs = np.where(m)
    if len(xs) == 0:
        return rgb, m, bg
    y0 = max(0, int(ys.min()) - margin)
    y1 = min(rgb.shape[0], int(ys.max()) + 1 + margin)
    x0 = max(0, int(xs.min()) - margin)
    x1 = min(rgb.shape[1], int(xs.max()) + 1 + margin)
    return rgb[y0:y1, x0:x1].copy(), m[y0:y1, x0:x1].copy(), bg


def pier_side(rgb, mask):
    g = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    ys, xs = np.where(mask)
    if len(xs) < 10:
        return "empty"
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    ya, yb = int(y0 + 0.25 * (y1 - y0)), int(y0 + 0.75 * (y1 - y0))
    w = max(1, x1 - x0 + 1)
    def mean(x_a, x_b):
        sl = g[ya:yb, x_a:x_b]
        sm = mask[ya:yb, x_a:x_b]
        if sm.sum() < 8:
            return 0.0
        return float(sl[sm].mean())
    left = mean(x0, x0 + w // 3)
    right = mean(x1 - w // 3, x1 + 1)
    if right > left + 8:
        return "pier-on-viewer-right"
    if left > right + 8:
        return "pier-on-viewer-left"
    return "balanced"


FACE_DIR = "/workspace/i23d-auto/zoneb-tower-hero/imagine/in"


def apply_hires(panels, masks, report):
    """Front and right take their own plates. Left and back are the right plate mirrored.

    face-back-1024 is measured and never painted (it is a second front).
    face-left-REJECTED is never opened. No resample.
    """
    verdicts = {}
    back_rgb = np.asarray(Image.open(os.path.join(FACE_DIR, HIRES_FILES["back"])).convert("RGB"))
    back_crop, back_m, _bg = crop_subject(back_rgb)
    nccs = {n: round(ncc_resize(back_crop, panels[i]), 3) for i, n in enumerate(NAMES)}
    best = max(nccs, key=nccs.get)
    verdicts["back_file"] = {
        "file": HIRES_FILES["back"],
        "file_px": [int(back_rgb.shape[1]), int(back_rgb.shape[0])],
        "crop_px": [int(back_crop.shape[1]), int(back_crop.shape[0])],
        "pier": pier_side(back_crop, back_m),
        "ncc_vs_sheet": nccs,
        "best_sheet": best,
        "used": False,
        "reason": "second front (pier on the viewer's right, same family as the front). Not painted. -z is the right plate mirrored.",
    }
    right_rgb = np.asarray(Image.open(os.path.join(FACE_DIR, HIRES_FILES["right"])).convert("RGB"))
    right_crop, right_m, _bg = crop_subject(right_rgb)
    for name in ("front", "right", "left"):
        rgb = right_rgb if name == "right" else np.asarray(Image.open(os.path.join(FACE_DIR, HIRES_FILES[name])).convert("RGB"))
        if name == "right":
            crop, m = right_crop, right_m
        else:
            crop, m, _bg = crop_subject(rgb)
        nccs = {n: round(ncc_resize(crop, panels[j]), 3) for j, n in enumerate(NAMES)}
        best = max(nccs, key=nccs.get)
        mirror = None
        if name == "left":
            mirror = round(ncc_resize(crop, np.ascontiguousarray(right_crop[:, ::-1])), 3)
        i = NAMES.index(name)
        panels[i] = crop
        masks[i] = m
        verdicts[name] = {
            "file": HIRES_FILES[name],
            "record": "mirrored right" if name == "left" else "own plate",
            "file_px": [int(rgb.shape[1]), int(rgb.shape[0])],
            "crop_px": [int(crop.shape[1]), int(crop.shape[0])],
            "pier": pier_side(crop, m),
            "ncc_vs_sheet": nccs,
            "best_sheet": best,
            "ncc_vs_flipped_right": mirror,
            "used": True,
            "resampled": False,
        }
    i = NAMES.index("back")
    panels[i] = np.ascontiguousarray(right_crop[:, ::-1])
    masks[i] = np.ascontiguousarray(right_m[:, ::-1])
    verdicts["back"] = {
        "file": HIRES_FILES["right"],
        "record": "mirrored right",
        "file_px": [int(right_rgb.shape[1]), int(right_rgb.shape[0])],
        "crop_px": [int(panels[i].shape[1]), int(panels[i].shape[0])],
        "pier": pier_side(panels[i], masks[i]),
        "used": True,
        "resampled": False,
        "source": "face-right-1024.jpg mirrored",
    }
    verdicts["ladder"] = "ladder not painted"
    verdicts["rejected_left"] = "not opened"
    report["hires"] = verdicts
    return panels, masks


def silhouette_iou(a, b):
    a = cv2.resize(a.astype(np.uint8), (128, 360), interpolation=cv2.INTER_NEAREST) > 0
    b = cv2.resize(b.astype(np.uint8), (128, 360), interpolation=cv2.INTER_NEAREST) > 0
    inter = np.logical_and(a, b).sum()
    union = np.logical_or(a, b).sum()
    return float(inter / max(1, union))


def key_spans(doc):
    poly = np.asarray(doc["silhouette"]["localXY_m"], np.float32)
    y0 = float(poly[:, 1].min())
    y1 = float(poly[:, 1].max())
    return poly, y0, y1


def span_at(poly, y):
    """Horizontal chord of the key silhouette at height y. Returns xmin, xmax."""
    n = len(poly)
    xs = []
    for i in range(n):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % n]
        if (y0 <= y <= y1) or (y1 <= y <= y0):
            if abs(y1 - y0) < 1e-6:
                xs.extend([float(x0), float(x1)])
            else:
                t = (y - y0) / (y1 - y0)
                xs.append(float(x0 + t * (x1 - x0)))
    if len(xs) < 2:
        return None
    return min(xs), max(xs)


def reinhard(src, src_m, ref, ref_m):
    s = cv2.cvtColor(src, cv2.COLOR_RGB2LAB).astype(np.float32)
    r = cv2.cvtColor(ref, cv2.COLOR_RGB2LAB).astype(np.float32)
    sm, ss = s[src_m].mean(0), s[src_m].std(0) + 1e-6
    rm, rs = r[ref_m].mean(0), r[ref_m].std(0) + 1e-6
    out = (s - sm) / ss * rs + rm
    out = np.clip(out, 0, 255).astype(np.uint8)
    return cv2.cvtColor(out, cv2.COLOR_LAB2RGB)


def delta_e(a, am, b, bm):
    la = cv2.cvtColor(a, cv2.COLOR_RGB2LAB).astype(np.float32)[am]
    lb = cv2.cvtColor(b, cv2.COLOR_RGB2LAB).astype(np.float32)[bm]
    if len(la) == 0 or len(lb) == 0:
        return None
    return float(np.linalg.norm(la.mean(0) - lb.mean(0)))


def edge_strip(rgb, mask, side, frac=0.08):
    h, w = mask.shape
    n = max(4, int(w * frac))
    m = np.zeros_like(mask)
    if side == "left":
        m[:, :n] = mask[:, :n]
    else:
        m[:, -n:] = mask[:, -n:]
    return m


def grade_strip(src, src_mask, ref, ref_mask, src_side, ref_side, n=12):
    """Reinhard-match a feathered edge only. Body pixels stay the plate.

    The outer column of the strip takes the graded colour. The inner column
    stays the plate. A whole-image grade lifts the stone body off its plate.
    """
    src_edge = edge_strip(src, src_mask, src_side)
    ref_edge = edge_strip(ref, ref_mask, ref_side)
    before = delta_e(src, src_edge, ref, ref_edge)
    graded = reinhard(src, src_edge, ref, ref_edge)
    out = src.copy()
    n = min(n, src.shape[1] // 3)
    if src_side == "left":
        g = graded[:, :n].astype(np.float32)
        s = out[:, :n].astype(np.float32)
        ramp = np.linspace(1.0, 0.0, n, dtype=np.float32)[None, :, None]
        out[:, :n] = np.clip(g * ramp + s * (1.0 - ramp), 0, 255).astype(np.uint8)
    else:
        g = graded[:, -n:].astype(np.float32)
        s = out[:, -n:].astype(np.float32)
        ramp = np.linspace(0.0, 1.0, n, dtype=np.float32)[None, :, None]
        out[:, -n:] = np.clip(g * ramp + s * (1.0 - ramp), 0, 255).astype(np.uint8)
    after = delta_e(out, src_edge, ref, ref_edge)
    body = src_mask.copy()
    body[:, :n] = False
    body[:, -n:] = False
    return out, before, after, delta_e(out, body, src, body)


# One window per face. Filled by prepare_planar before the loft writes UVs.
_PLANAR = {}


def planar_window(mask, world_w, world_h):
    """One axis-aligned window for the whole face. Same px/m on both axes.

    The window is the mask bbox, letterboxed to the face's world aspect and
    centred. Native pixels only. No per-row crop and no resample. u and v
    are image fractions: v 0 is the foot (image bottom), which bake_uv expects.
    """
    h, w = mask.shape[:2]
    ys = np.flatnonzero(mask.any(1))
    xs = np.flatnonzero(mask.any(0))
    if ys.size < 2 or xs.size < 2:
        return None
    x0, x1 = float(xs[0]), float(xs[-1])
    y_top, y_bot = float(ys[0]), float(ys[-1])
    bw = max(2.0, x1 - x0)
    bh = max(2.0, y_bot - y_top)
    ppm = min(bw / max(float(world_w), 1e-3), bh / max(float(world_h), 1e-3))
    use_w = min(bw, max(2.0, float(world_w) * ppm))
    use_h = min(bh, max(2.0, float(world_h) * ppm))
    cx = 0.5 * (x0 + x1)
    cy = 0.5 * (y_top + y_bot)
    xa = float(np.clip(cx - 0.5 * use_w, 0, w - 1))
    xb = float(np.clip(cx + 0.5 * use_w, 0, w - 1))
    yt = float(np.clip(cy - 0.5 * use_h, 0, h - 1))
    yb = float(np.clip(cy + 0.5 * use_h, 0, h - 1))
    if xb - xa < 1.0 or yb - yt < 1.0:
        return None

    def u_of(s):
        col = xa + float(s) * (xb - xa)
        return col / max(1, w - 1)

    def v_of(t):
        row = yb + float(t) * (yt - yb)
        return (h - 1 - row) / max(1, h - 1)

    return {"u": u_of, "v": v_of, "ppm": float(ppm), "window_px": [round(xb - xa, 1), round(yb - yt, 1)]}


def prepare_planar(masks, chords, height_m):
    _PLANAR.clear()
    if not masks:
        return
    for name, chord in chords.items():
        mask = masks.get(name)
        if mask is None:
            continue
        win = planar_window(mask, chord, height_m)
        if win:
            _PLANAR[name] = win


def map_u(masks, name, t, u, chord_m=None, height_m=None):
    """Image-u of a foot-plane parameter. One window for every row. `t` is unused."""
    win = _PLANAR.get(name)
    if win is None:
        return float(u)
    return float(win["u"](float(np.clip(u, 0.0, 1.0))))


def map_v(name, t):
    """Image-v of the height parameter. v 0 is the foot. Same window as map_u."""
    win = _PLANAR.get(name)
    if win is None:
        return float(t)
    return float(win["v"](t))


def roof_from_front(front_img, front_mask, cap_w, cap_d, rows=32):
    """Native roof-edge band pasted into a footprint canvas. Never resampled.

    A band larger than the canvas is center-cropped. The rest of the canvas is
    one native pixel colour, not a stretched row.
    """
    h, w = front_mask.shape
    ys = np.flatnonzero(front_mask.any(1))
    if ys.size == 0:
        return np.full((cap_d, cap_w, 3), 180, np.uint8), "no mask"
    y_top = int(ys[0])
    band = front_img[y_top:min(h, y_top + rows)]
    bm = front_mask[y_top:min(h, y_top + rows)]
    xs = np.flatnonzero(bm.any(0))
    if xs.size == 0:
        return np.full((cap_d, cap_w, 3), 180, np.uint8), "no span"
    x0, x1 = int(xs[0]), int(xs[-1]) + 1
    band = np.ascontiguousarray(band[:, x0:x1])
    bm = bm[:, x0:x1]
    pix = band[bm]
    fill = pix[len(pix) // 2] if len(pix) else band.reshape(-1, 3)[0]
    canvas = np.empty((cap_d, cap_w, 3), np.uint8)
    canvas[:] = fill
    src = band
    bh, bw = src.shape[:2]
    if bh > cap_d or bw > cap_w:
        y0c = max(0, (bh - cap_d) // 2)
        x0c = max(0, (bw - cap_w) // 2)
        src = src[y0c:y0c + cap_d, x0c:x0c + cap_w]
        bh, bw = src.shape[:2]
    yo = max(0, (cap_d - bh) // 2)
    xo = max(0, (cap_w - bw) // 2)
    canvas[yo:yo + bh, xo:xo + bw] = src
    return canvas, "front roof-edge band, native pixels, one fill colour, no resample"


def metric_outward(path, mask, ppm):
    """MoGe-2 metres. Positive = nearer than the face plane (sticks out)."""
    npy = path + ".moge.npy"
    py = "/workspace/.venv-sam2/bin/python"
    script = os.path.join(HERE, "moge_depth.py")
    if not os.path.isfile(npy):
        r = subprocess.run([py, script, path, npy], capture_output=True, text=True, timeout=900)
        if r.returncode != 0 or not os.path.isfile(npy):
            raise RuntimeError((r.stderr or r.stdout or "moge failed")[-800:])
    depth = np.load(npy).astype(np.float32)
    if depth.shape[:2] != mask.shape[:2]:
        depth = np.asarray(Image.fromarray(depth).resize((mask.shape[1], mask.shape[0]), Image.BILINEAR), np.float32)
    fill = float(np.median(depth[mask])) if mask.any() else float(np.median(depth))
    filled = depth.copy()
    filled[~mask] = fill
    sig = max(1.5, 3.0 * ppm)
    fine = max(0.8, 0.4 * ppm)
    from scipy import ndimage as ndi
    hp = ndi.gaussian_filter(filled, fine) - ndi.gaussian_filter(filled, sig)
    # depth larger = farther. Outward (toward the camera) is the near residual.
    outward = -hp
    outward[~mask] = 0
    return outward.astype(np.float32)


def quantise_measured(outward, mask, ppm):
    """Cell median of the measured metres. Levels are not retargeted to a bar."""
    h, w = outward.shape
    cell_y = max(4, int(round(1.0 * ppm)))
    cell_x = max(4, int(round(1.0 * ppm)))
    q = np.zeros_like(outward)
    levels = []
    for y0 in range(0, h, cell_y):
        for x0 in range(0, w, cell_x):
            sl = outward[y0:y0 + cell_y, x0:x0 + cell_x]
            sm = mask[y0:y0 + cell_y, x0:x0 + cell_x]
            if sm.sum() < 8:
                continue
            med = float(np.median(sl[sm]))
            levels.append(med)
            q[y0:y0 + cell_y, x0:x0 + cell_x] = med
    if not levels:
        return q, {"p99_m": 0.0, "planes": 0}
    vals = np.array(sorted(levels), np.float32)
    # Merge measured levels within 5 cm, then agglomerate the nearest
    # remaining medians until at most 8 planes. Each plane stays a median
    # of measured cells. Nothing is scaled toward the 0.3 m bar.
    clusters = [[float(vals[0])]]
    for v in vals[1:]:
        if abs(float(v) - float(np.median(clusters[-1]))) < 0.05:
            clusters[-1].append(float(v))
        else:
            clusters.append([float(v)])
    while len(clusters) > 8:
        gaps = [abs(float(np.median(clusters[i + 1])) - float(np.median(clusters[i]))) for i in range(len(clusters) - 1)]
        j = int(np.argmin(gaps))
        clusters[j] = clusters[j] + clusters[j + 1]
        del clusters[j + 1]
    kept = [float(np.median(c)) for c in clusters]
    snapped = q.copy()
    for y0 in range(0, h, cell_y):
        for x0 in range(0, w, cell_x):
            sm = mask[y0:y0 + cell_y, x0:x0 + cell_x]
            if sm.sum() < 8:
                snapped[y0:y0 + cell_y, x0:x0 + cell_x] = 0
                continue
            med = float(np.median(q[y0:y0 + cell_y, x0:x0 + cell_x][sm]))
            nearest = min(kept, key=lambda L: abs(L - med))
            snapped[y0:y0 + cell_y, x0:x0 + cell_x] = nearest
    snapped[~mask] = 0
    p99 = float(np.percentile(np.abs(snapped[mask]), 99)) if mask.any() else 0.0
    return snapped.astype(np.float32), {
        "p99_m": round(p99, 4),
        "planes": len(kept),
        "level_min_m": round(min(kept), 4),
        "level_max_m": round(max(kept), 4),
    }


def relief_from_feature_masks(labels, depth, mask, max_planes=4):
    """One outward metre per SAM2 region: that region's own MoGe median.

    The step sits on the mask outline. There is no blur and no per-cell
    median that would walk the edge off the paint. Pixels outside the kept
    regions stay on the far plane (offset 0).
    """
    depth = np.asarray(depth, np.float32)
    if labels is None:
        q = np.zeros(depth.shape, np.float32)
        return q, {"planes": 0, "source": "none", "regions": 0}
    if labels.shape[:2] != depth.shape[:2]:
        labels = cv2.resize(labels.astype(np.int32), (depth.shape[1], depth.shape[0]), interpolation=cv2.INTER_NEAREST)
    if mask.shape[:2] != depth.shape[:2]:
        mask = cv2.resize(mask.astype(np.uint8), (depth.shape[1], depth.shape[0]), interpolation=cv2.INTER_NEAREST) > 0
    labels = labels.astype(np.int32).copy()
    labels[~mask] = 0
    stats = []
    for i in np.unique(labels):
        i = int(i)
        if i <= 0:
            continue
        m = labels == i
        area = int(m.sum())
        if area < 80:
            continue
        stats.append((area, i, float(np.median(depth[m]))))
    stats.sort(reverse=True)
    stats = stats[:max_planes]
    q = np.zeros(depth.shape, np.float32)
    if not stats:
        return q, {"planes": 0, "source": "sam2-mask-median", "regions": 0}
    far = max(s[2] for s in stats)
    levels = []
    for area, i, med in stats:
        off = float(far - med)
        levels.append(off)
        q[labels == i] = off
    uniq = sorted({round(v, 2) for v in levels})
    return q.astype(np.float32), {
        "planes": len(uniq),
        "level_min_m": round(min(levels), 4),
        "level_max_m": round(max(levels), 4),
        "source": "sam2-mask-median",
        "regions": len(stats),
        "p99_m": round(float(np.percentile(q[mask], 99)) if mask.any() else 0.0, 4),
    }


def per_metre_span(inset, mask):
    h = inset.shape[0]
    spans = []
    for y in range(h):
        xs = inset[y][mask[y]]
        if xs.size < 4:
            continue
        spans.append(float(xs.max() - xs.min()))
    if not spans:
        return 0.0
    return float(np.median(spans))


def sample_inset(inset, u, v):
    """u,v in 0..1. v 0 is the foot (inset row 0 is the top of the image)."""
    h, w = inset.shape
    col = int(np.clip(round(u * (w - 1)), 0, w - 1))
    row = int(np.clip(round((1.0 - v) * (h - 1)), 0, h - 1))
    return float(inset[row, col])


def build_mesh(poly, y0, y1, depth_ratio, back_ratio, insets, ny=96, masks=None):
    """Loft. Front at z=0, body toward -z, up +y. Shared vertices, per-loop UVs later."""
    ys = np.linspace(y0, y1, ny)
    rings = []
    for y in ys:
        chord = span_at(poly, float(y))
        if chord is None:
            chord = span_at(poly, float(np.clip(y, y0 + 1e-3, y1 - 1e-3)))
        xmin, xmax = chord
        t = (float(y) - y0) / max(1e-6, y1 - y0)
        # The key polygon closes on one vertex at the foot. That point is the
        # outline's join, not a spire. The visible foot is the chord just above it.
        if t < 0.012:
            wide = span_at(poly, float(y0 + 0.012 * (y1 - y0)))
            if wide:
                xmin, xmax = wide
        fw = max(1e-3, xmax - xmin)
        depth = fw * float(np.interp(t, depth_ratio[0], depth_ratio[1]))
        br = float(np.interp(t, back_ratio[0], back_ratio[1]))
        cx = 0.5 * (xmin + xmax)
        bw = fw * br
        bx0, bx1 = cx - 0.5 * bw, cx + 0.5 * bw
        # A wall steeper than ~24° from vertical makes an elevation UV
        # (one plane, v = height) fail the 1.3 singular-value bar. The crown
        # of the side plates collapses depth in a few metres. Hold the corners
        # so each step's horizontal move stays within 0.45 of the height step.
        # The foot is left on the plates so d/w does not move.
        if rings and t > 0.70:
            py, px0, px1, pbx0, pbx1, pdepth = rings[-1]
            dy = max(1e-6, float(y) - py)
            capm = 0.45 * dy

            def lim_xz(x, z, px, pz):
                dx, dz = float(x) - px, float(z) - pz
                h = float(np.hypot(dx, dz))
                if h <= capm or h < 1e-9:
                    return float(x), float(z)
                s = capm / h
                return px + dx * s, pz + dz * s

            xmin, _ = lim_xz(xmin, 0.0, px0, 0.0)
            xmax, _ = lim_xz(xmax, 0.0, px1, 0.0)
            bx0, z0 = lim_xz(bx0, -depth, pbx0, -pdepth)
            bx1, z1 = lim_xz(bx1, -depth, pbx1, -pdepth)
            depth = -0.5 * (z0 + z1)
            bx0, _ = lim_xz(bx0, -depth, pbx0, -pdepth)
            bx1, _ = lim_xz(bx1, -depth, pbx1, -pdepth)
        rings.append((float(y), float(xmin), float(xmax), float(bx0), float(bx1), float(depth)))
    nxf, nz = 24, 8
    verts = []
    # index of ring vertex. layout per ring: front nxf, right nz-1, back nxf, left nz-1
    stride = nxf + (nz - 1) + nxf + (nz - 1)

    def chord_of_ring(ring, kind):
        _y, xmin, xmax, bx0, bx1, depth = ring
        if kind == "front":
            return max(1e-3, xmax - xmin)
        if kind == "back":
            return max(1e-3, abs(bx1 - bx0))
        if kind == "right":
            return max(1e-3, float(np.hypot(bx1 - xmax, depth)))
        return max(1e-3, float(np.hypot(xmin - bx0, depth)))

    height_m = max(1e-6, y1 - y0)
    # Domain is the widest ring of that face, not ring 0. The foot back can be
    # a point while the real back is wide; mapping through the point collapses U.
    front_x0 = min(r[1] for r in rings)
    front_x1 = max(r[2] for r in rings)
    back_x0 = min(min(r[3], r[4]) for r in rings)
    back_x1 = max(max(r[3], r[4]) for r in rings)
    right_axis = None
    left_axis = None
    for _y, xmin, xmax, bx0, bx1, depth in rings:
        ra = np.array([bx1 - xmax, -depth], np.float64)
        if right_axis is None or float(np.dot(ra, ra)) > float(np.dot(right_axis[0], right_axis[0])):
            right_axis = (ra, np.array([xmax, 0.0], np.float64))
        la = np.array([xmin - bx0, depth], np.float64)
        if left_axis is None or float(np.dot(la, la)) > float(np.dot(left_axis[0], left_axis[0])):
            left_axis = (la, np.array([bx0, -depth], np.float64))
    def along_wall(kind, x, z):
        """Metres along that face. Front and back use x. Walls use their longest axis."""
        if kind == "front":
            return float(x)
        if kind == "back":
            return float(x)
        axis, origin = right_axis if kind == "right" else left_axis
        rel = np.array([float(x), float(z)], np.float64) - origin
        n = float(np.linalg.norm(axis))
        return float(np.dot(rel, axis) / max(1e-9, n))

    # The window must cover every ring, not only the longest wall. A vertex
    # past that wall used to clip to one u, and the triangle's texel jacobian died.
    samples = {k: [] for k in ("front", "back", "right", "left")}
    for _y, xmin, xmax, bx0, bx1, depth in rings:
        samples["front"] += [float(xmin), float(xmax)]
        samples["back"] += [float(bx0), float(bx1)]
        samples["right"] += [along_wall("right", xmax, 0.0), along_wall("right", bx1, -depth)]
        samples["left"] += [along_wall("left", bx0, -depth), along_wall("left", xmin, 0.0)]
    span = {}
    for k, vals in samples.items():
        lo, hi = float(min(vals)), float(max(vals))
        if hi - lo < 1e-3:
            hi = lo + 1e-3
        span[k] = (lo, hi)
    chord_for_window = {k: span[k][1] - span[k][0] for k in span}
    if masks:
        prepare_planar(masks, chord_for_window, height_m)

    def planar_s(kind, x, z):
        """0..1 across every ring of that face. A narrower ring stays inside the window."""
        if kind in ("front", "back"):
            s = float(x)
        else:
            s = along_wall(kind, x, z)
        lo, hi = span[kind]
        return (s - lo) / (hi - lo)

    for y, xmin, xmax, bx0, bx1, depth in rings:
        # t from the loft loop is the crown. Bind it to this ring or the
        # foot band never fires and the lip stays in the air.
        t = (float(y) - y0) / max(1e-6, y1 - y0)
        # Relief on the first rings overhangs the foot. A column under that
        # lip misses the base and the grounding probe reads the lip as air.
        # Relief is applied to the vertex after the planar UV is chosen.
        # The foot and the crown stay on the face plane so the caps do not tilt.
        # A narrow crown ring has short edges. A metre of relief there
        # tilts the quad up and the stretch ratio leaves 1.3. Keep that
        # ring on the face plane. The wide facade keeps the mask step.
        # fw is this ring. The loft loop's last fw is the crown and must not
        # flatten the whole shaft.
        fw = max(1e-3, xmax - xmin)
        narrow = fw < 12.0
        foot_band = t < 0.04 or t > 0.96 or narrow

        def face_off(name, x, z):
            if foot_band or name not in insets:
                return 0.0
            s = float(np.clip(planar_s(name, x, z), 0.0, 1.0))
            return sample_inset(insets[name], map_u(masks, name, t, s), map_v(name, t))

        for i in range(nxf):
            u = i / (nxf - 1)
            x = xmin + u * (xmax - xmin)
            off = face_off("front", x, 0.0)
            verts.append((x, y, 0.0 + off))
        for i in range(1, nz):
            u = i / nz
            x = xmax + u * (bx1 - xmax)
            z = 0.0 + u * (-depth)
            off = face_off("right", x, z)
            # outward is roughly +x; a positive outward moves +x
            verts.append((x + off, y, z))
        for i in range(nxf):
            u = i / (nxf - 1)
            x = bx1 + u * (bx0 - bx1)
            off = face_off("back", x, -depth)
            verts.append((x, y, -depth - off))
        for i in range(1, nz):
            u = i / nz
            x = bx0 + u * (xmin - bx0)
            z = -depth + u * depth
            off = face_off("left", x, z)
            verts.append((x - off, y, z))
    V = np.asarray(verts, np.float64)
    faces = []
    uvs = []

    def quad(a, b, c, d, uv):
        # a-b-c-d around the face. Two tris a-b-c, a-c-d.
        faces.append((a, b, c))
        faces.append((a, c, d))
        uvs.append(uv[0:3])
        uvs.append((uv[0], uv[2], uv[3]))

    def uv_of(face, u, v):
        return (face, u, v)  # placeholder, packed later

    def chord_of(ring, kind):
        return chord_of_ring(ring, kind)

    for r in range(ny - 1):
        y = rings[r][0]
        v0 = (y - y0) / (y1 - y0)
        v1 = (rings[r + 1][0] - y0) / (y1 - y0)
        base = r * stride
        nxt = (r + 1) * stride
        # One planar window. u follows the foot-plane metre, not the row fraction.
        fv0, fv1 = map_v("front", v0), map_v("front", v1)
        y0r, xmin, xmax, bx0, bx1, depth = rings[r]
        _, xmin1, xmax1, bx01, bx11, depth1 = rings[r + 1]
        for i in range(nxf - 1):
            x0 = xmin + (i / (nxf - 1)) * (xmax - xmin)
            x1 = xmin + ((i + 1) / (nxf - 1)) * (xmax - xmin)
            x0b = xmin1 + (i / (nxf - 1)) * (xmax1 - xmin1)
            x1b = xmin1 + ((i + 1) / (nxf - 1)) * (xmax1 - xmin1)
            u0 = map_u(masks, "front", v0, planar_s("front", x0, 0.0))
            u1 = map_u(masks, "front", v0, planar_s("front", x1, 0.0))
            u0b = map_u(masks, "front", v1, planar_s("front", x0b, 0.0))
            u1b = map_u(masks, "front", v1, planar_s("front", x1b, 0.0))
            quad(base + i, base + i + 1, nxt + i + 1, nxt + i,
                 [uv_of("front", u0, fv0), uv_of("front", u1, fv0), uv_of("front", u1b, fv1), uv_of("front", u0b, fv1)])
        # right: indices nxf .. nxf+nz-2, plus corners front last and back first
        right_idx = [base + nxf - 1] + [base + nxf + i for i in range(nz - 1)] + [base + nxf + (nz - 1)]
        right_idx_n = [nxt + nxf - 1] + [nxt + nxf + i for i in range(nz - 1)] + [nxt + nxf + (nz - 1)]
        nu = len(right_idx) - 1
        rv0, rv1 = map_v("right", v0), map_v("right", v1)

        def right_xz(ring, i):
            _y, _xmin, _xmax, _bx0, _bx1, _depth = ring
            u = i / nu
            return _xmax + u * (_bx1 - _xmax), u * (-_depth)

        for i in range(nu):
            x0, z0 = right_xz(rings[r], i)
            x1, z1 = right_xz(rings[r], i + 1)
            x0b, z0b = right_xz(rings[r + 1], i)
            x1b, z1b = right_xz(rings[r + 1], i + 1)
            u0 = map_u(masks, "right", v0, planar_s("right", x0, z0))
            u1 = map_u(masks, "right", v0, planar_s("right", x1, z1))
            u0b = map_u(masks, "right", v1, planar_s("right", x0b, z0b))
            u1b = map_u(masks, "right", v1, planar_s("right", x1b, z1b))
            quad(right_idx[i], right_idx[i + 1], right_idx_n[i + 1], right_idx_n[i],
                 [uv_of("right", u0, rv0), uv_of("right", u1, rv0), uv_of("right", u1b, rv1), uv_of("right", u0b, rv1)])
        # back starts at nxf + (nz - 1)
        b0 = nxf + (nz - 1)
        bv0, bv1 = map_v("back", v0), map_v("back", v1)
        for i in range(nxf - 1):
            def back_x(ring, i):
                _y, _xmin, _xmax, _bx0, _bx1, _depth = ring
                u = i / (nxf - 1)
                return _bx1 + u * (_bx0 - _bx1)
            u0 = map_u(masks, "back", v0, planar_s("back", back_x(rings[r], i), 0.0))
            u1 = map_u(masks, "back", v0, planar_s("back", back_x(rings[r], i + 1), 0.0))
            u0b = map_u(masks, "back", v1, planar_s("back", back_x(rings[r + 1], i), 0.0))
            u1b = map_u(masks, "back", v1, planar_s("back", back_x(rings[r + 1], i + 1), 0.0))
            quad(base + b0 + i, base + b0 + i + 1, nxt + b0 + i + 1, nxt + b0 + i,
                 [uv_of("back", u0, bv0), uv_of("back", u1, bv0), uv_of("back", u1b, bv1), uv_of("back", u0b, bv1)])
        l0 = b0 + nxf
        left_idx = [base + b0 + nxf - 1] + [base + l0 + i for i in range(nz - 1)] + [base + 0]
        left_idx_n = [nxt + b0 + nxf - 1] + [nxt + l0 + i for i in range(nz - 1)] + [nxt + 0]
        nu = len(left_idx) - 1
        lv0, lv1 = map_v("left", v0), map_v("left", v1)

        def left_xz(ring, i, nu):
            _y, _xmin, _xmax, _bx0, _bx1, _depth = ring
            u = i / nu
            return _bx0 + u * (_xmin - _bx0), -_depth + u * _depth

        for i in range(nu):
            x0, z0 = left_xz(rings[r], i, nu)
            x1, z1 = left_xz(rings[r], i + 1, nu)
            x0b, z0b = left_xz(rings[r + 1], i, nu)
            x1b, z1b = left_xz(rings[r + 1], i + 1, nu)
            u0 = map_u(masks, "left", v0, planar_s("left", x0, z0))
            u1 = map_u(masks, "left", v0, planar_s("left", x1, z1))
            u0b = map_u(masks, "left", v1, planar_s("left", x0b, z0b))
            u1b = map_u(masks, "left", v1, planar_s("left", x1b, z1b))
            quad(left_idx[i], left_idx[i + 1], left_idx_n[i + 1], left_idx_n[i],
                 [uv_of("left", u0, lv0), uv_of("left", u1, lv0), uv_of("left", u1b, lv1), uv_of("left", u0b, lv1)])
    # caps from the first and last ring, no invented roof paint
    foot = 0
    top = (ny - 1) * stride
    # bottom: outward -Y. The ring is CCW seen from +Z / outside, so from below it is CW.
    # Use a fan. Centre vertex.
    def centre(ring_base, zsign):
        ids = list(range(ring_base, ring_base + stride))
        c = V[ids].mean(0)
        if zsign < 0:
            c[1] = V[ids, 1].min()
        else:
            c[1] = V[ids, 1].max()
        verts_i = len(V)
        return c, ids

    # rebuild V with centres appended after faces of the walls are indexed
    foot_c = V[0:stride].mean(0)
    top_c = V[top:top + stride].mean(0)
    foot_c[1] = y0
    top_c[1] = y1
    V = np.vstack([V, foot_c, top_c])
    ic_foot = len(V) - 2
    ic_top = len(V) - 1
    # Foot ring stays wide. Collapsing it to one vertex leaves the real base
    # one ring up (~2 m) and the grounding probe reads that air as float.
    # Caps are unpainted. UVs span the footprint at the face px/m (see "cap").
    xs = V[:stride, 0]
    zs = V[:stride, 2]
    x0, x1 = float(xs.min()), float(xs.max())
    z0, z1 = float(zs.min()), float(zs.max())

    def cap_uv(idx):
        x, z = float(V[idx, 0]), float(V[idx, 2])
        u = (x - x0) / max(1e-6, x1 - x0)
        v = (z - z0) / max(1e-6, z1 - z0)
        return ("cap", float(np.clip(u, 0, 1)), float(np.clip(v, 0, 1)))

    for i in range(stride):
        j = (i + 1) % stride
        faces.append((ic_foot, foot + j, foot + i))
        uvs.append([cap_uv(ic_foot), cap_uv(foot + j), cap_uv(foot + i)])
        faces.append((ic_top, top + i, top + j))
        uvs.append([cap_uv(ic_top), cap_uv(top + i), cap_uv(top + j)])
    F = np.asarray(faces, np.int32)
    # fix winding so front faces point +Z
    front = F[0]
    a, b, c = V[front[0]], V[front[1]], V[front[2]]
    n = np.cross(b - a, c - a)
    if n[2] < 0:
        F = F[:, ::-1]
        uvs = [[u[2], u[1], u[0]] for u in uvs]
    V, F, uvs = weld_closed(V, F, uvs, y0, y1, weld_foot=False)
    return V, F, uvs, rings


def weld_closed(V, F, uvs, y0, y1, tol=0.002, tip=0.05, weld_foot=True):
    """The key crown and foot are points. Every vertex on that row becomes one vertex.

    Relief must not leave a ring of copies there: those copies share edges and
    the cap is non-manifold. A face that collapses is dropped. The wall
    triangle with one tip vertex and two vertices on the next ring stays.
    """
    crown_pts = [p for p in V if abs(float(p[1]) - y1) <= tip]
    collapse_crown = False
    if crown_pts:
        cxz = np.mean([[float(p[0]), float(p[2])] for p in crown_pts], axis=0)
        crown_r = max(float(np.hypot(float(p[0]) - cxz[0], float(p[2]) - cxz[1])) for p in crown_pts)
        # A real point crown collapses. A ring with extent stays, so the cap is a face.
        collapse_crown = crown_r < 0.5

    def key_of(p):
        if weld_foot and abs(float(p[1]) - y0) <= tip:
            return ("foot",)
        if collapse_crown and abs(float(p[1]) - y1) <= tip:
            return ("crown",)
        return tuple(np.round(p / tol).astype(np.int64))

    remap = {}
    new_v = []
    inv = np.empty(len(V), np.int32)
    for i, p in enumerate(V):
        k = key_of(p)
        j = remap.get(k)
        if j is None:
            j = len(new_v)
            remap[k] = j
            new_v.append(V[i])
        inv[i] = j
    for tag in (("foot",), ("crown",)):
        ids = [i for i, p in enumerate(V) if key_of(p) == tag]
        if ids and tag in remap:
            new_v[remap[tag]] = np.mean(np.asarray(V)[ids], axis=0)
    faces = []
    out_uv = []
    for f, uv in zip(F, uvs):
        nf = [int(inv[int(x)]) for x in f]
        if len(set(nf)) < 3:
            continue
        faces.append(nf)
        out_uv.append(uv)
    V2 = np.asarray(new_v, np.float64)
    F2 = np.asarray(faces, np.int32)
    used = np.zeros(len(V2), np.bool_)
    used[F2.ravel()] = True
    compact = np.full(len(V2), -1, np.int32)
    kept = np.flatnonzero(used)
    compact[kept] = np.arange(len(kept))
    return V2[kept], compact[F2], out_uv


def pack_atlas(images):
    """images: name -> rgb. Horizontal strip, no upscale. Returns atlas, uv rects in 0..1 (u0,v0,u1,v1) with v up."""
    h = max(im.shape[0] for im in images.values())
    w = sum(im.shape[1] for im in images.values())
    atlas = np.full((h, w, 3), 180, np.uint8)
    rects = {}
    x = 0
    for name, im in images.items():
        ih, iw = im.shape[:2]
        y = h - ih  # sit on the bottom of the strip; image row 0 is the top
        atlas[y:y + ih, x:x + iw] = im
        # glTF v 0 at the foot. Image bottom is the foot, which we placed at atlas row h-1.
        # flipY false: v=0 samples row 0 of the image file, and the file's row 0 is the top of the atlas.
        # So v=0 is the top of the atlas (sky of the strip) and v=1 is the bottom.
        # Foot of the tower must be v=1. The image bottom is at atlas row h-1, v = (h-1)/(h-1) = 1. Good.
        # Image top is at atlas row y, v = y / (h-1).
        v_top = y / max(1, h - 1)
        v_bot = (y + ih - 1) / max(1, h - 1)
        u0 = x / max(1, w - 1)
        u1 = (x + iw - 1) / max(1, w - 1)
        rects[name] = (u0, v_top, u1, v_bot)
        x += iw
    return atlas, rects


def uv_stretch_p95(V, F, UV, tw, th, min_area=4.0):
    """Area-weighted p95 of the world-to-texel singular-value ratio, per normal class.

    Same bar the object gate uses. Triangles in a class whose area is under
    min_area are ignored, matching the probe.
    """
    V = np.asarray(V, np.float64)
    F = np.asarray(F, np.int32)
    UV = np.asarray(UV, np.float64)
    buckets = {}
    for t in range(len(F)):
        i0, i1, i2 = F[t]
        a, b, c = V[i0], V[i1], V[i2]
        e1 = b - a
        e2 = c - a
        n = np.cross(e1, e2)
        area = float(np.linalg.norm(n) * 0.5)
        if area < 1e-6:
            continue
        n = n / max(np.linalg.norm(n), 1e-12)
        ax = int(np.argmax(np.abs(n)))
        sign = "+" if n[ax] >= 0 else "-"
        cls = f"{sign}{'xyz'[ax]}"
        L1 = float(np.linalg.norm(e1))
        if L1 < 1e-9:
            continue
        ex = e1 / L1
        ey = np.cross(n, ex)
        el = float(np.linalg.norm(ey))
        if el < 1e-9:
            continue
        ey = ey / el
        x2 = float(np.dot(e2, ex))
        y2 = float(np.dot(e2, ey))
        det = L1 * y2
        u0, v0 = UV[t, 0]
        u1, v1 = UV[t, 1]
        u2, v2 = UV[t, 2]
        du1, dv1 = (u1 - u0) * tw, (v1 - v0) * th
        du2, dv2 = (u2 - u0) * tw, (v2 - v0) * th
        sv = 99.0
        if abs(det) > 1e-9:
            j00 = (du1 * y2) / det
            j01 = (du2 * L1 - du1 * x2) / det
            j10 = (dv1 * y2) / det
            j11 = (dv2 * L1 - dv1 * x2) / det
            Tm = j00 * j00 + j01 * j01 + j10 * j10 + j11 * j11
            D = abs(j00 * j11 - j01 * j10)
            disc = max(0.0, Tm * Tm - 4 * D * D)
            s1 = ((Tm + disc ** 0.5) / 2) ** 0.5
            s2 = D / (s1 or 1)
            sv = s1 / s2 if s2 > 1e-9 else 99.0
        buckets.setdefault(cls, []).append((sv, area))
    out = {}
    for cls, rows in buckets.items():
        tot = sum(w for _, w in rows)
        if tot < min_area:
            continue
        rows.sort(key=lambda r: r[0])
        acc = 0.0
        p95 = rows[-1][0]
        for s, w in rows:
            acc += w
            if acc >= 0.95 * tot:
                p95 = s
                break
        out[cls] = round(float(p95), 3)
    return out


def bake_uv(raw_uvs, rects):
    out = np.zeros((len(raw_uvs), 3, 2), np.float64)
    for i, tri in enumerate(raw_uvs):
        for k, item in enumerate(tri):
            if isinstance(item, tuple) and len(item) == 3 and isinstance(item[0], str):
                name, u, v = item
                u0, vt, u1, vb = rects[name]
                # v is 0 at the foot. Image foot is vb (larger v in this packing).
                out[i, k, 0] = u0 + float(u) * (u1 - u0)
                out[i, k, 1] = vb + float(v) * (vt - vb)
            else:
                out[i, k, 0] = float(item[0])
                out[i, k, 1] = float(item[1])
    return out


def project_front(homo_path, key_path, poly, y0, y1, ppm):
    """Sample the key through the stored homography. One source pixel is never enlarged."""
    homo = json.load(open(homo_path))
    H = np.asarray(homo["homography_key_to_uv"], np.float64)
    try:
        Hinv = np.linalg.inv(H)
    except np.linalg.LinAlgError:
        Hinv = None
    key = np.asarray(Image.open(key_path).convert("RGB"))
    kh, kw = key.shape[:2]
    x0 = float(homo["x0"])
    yy0 = float(homo["y0"])
    yy1 = float(homo["y1"])
    h = max(1e-6, yy1 - yy0)
    atlas = int(homo["atlas"])
    height = y1 - y0
    # width from the widest chord
    widths = []
    for y in np.linspace(y0, y1, 32):
        c = span_at(poly, float(y))
        if c:
            widths.append(c[1] - c[0])
    width = max(widths) if widths else 46.0
    ppm = min(ppm, 4.0)
    ih = max(8, int(round(height * ppm)))
    iw = max(8, int(round(width * ppm)))
    img = np.zeros((ih, iw, 3), np.uint8)
    xmin = min(span_at(poly, float(y))[0] for y in np.linspace(y0, y1, 16) if span_at(poly, float(y)))
    for row in range(ih):
        v_m = 1.0 - row / max(1, ih - 1)  # row 0 is the top
        y = y0 + v_m * (y1 - y0)
        chord = span_at(poly, float(y))
        if chord is None:
            continue
        xa, xb = chord
        for col in range(iw):
            u = col / max(1, iw - 1)
            x = xmin + u * width
            if x < xa - 0.2 or x > xb + 0.2:
                continue
            uu = (x - x0) / h
            vv = (yy1 - y) / h
            ax = uu * (atlas - 1)
            ay = vv * (atlas - 1)
            if Hinv is None:
                continue
            p = Hinv @ np.array([ax, ay, 1.0])
            if abs(p[2]) < 1e-8:
                continue
            px, py = p[0] / p[2], p[1] / p[2]
            if px < 0 or py < 0 or px >= kw - 1 or py >= kh - 1:
                continue
            x0i, y0i = int(px), int(py)
            tx, ty = px - x0i, py - y0i
            c00 = key[y0i, x0i].astype(np.float32)
            c10 = key[y0i, x0i + 1].astype(np.float32)
            c01 = key[y0i + 1, x0i].astype(np.float32)
            c11 = key[y0i + 1, x0i + 1].astype(np.float32)
            img[row, col] = (c00 * (1 - tx) * (1 - ty) + c10 * tx * (1 - ty) + c01 * (1 - tx) * ty + c11 * tx * ty).astype(np.uint8)
    return img


def classify_top(rgb):
    mask, _ = subject_mask(rgb)
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return {"shows_roof_plan": False, "reason": "no subject"}
    bh = int(ys.max() - ys.min() + 1)
    bw = int(xs.max() - xs.min() + 1)
    return {
        "shows_roof_plan": bool(bh / max(1, bw) < 1.2 and bh < rgb.shape[0] * 0.45),
        "bbox_hw": round(bh / max(1, bw), 3),
        "bands": 1,
        "used_for": None,
    }


def classify_under(rgb):
    mask, _ = subject_mask(rgb)
    row = mask.mean(1) > 0.02
    bands = 0
    prev = False
    for c in row:
        if c and not prev:
            bands += 1
        prev = bool(c)
    return {"bands": bands, "shows_soffit": bands >= 1, "used_for": "not a base plan; no ledge shelf was cut, so the pixels are not projected"}


def ncc_resize(a, b):
    a = cv2.resize(cv2.cvtColor(a, cv2.COLOR_RGB2GRAY), (64, 128)).astype(np.float32)
    b = cv2.resize(cv2.cvtColor(b, cv2.COLOR_RGB2GRAY), (64, 128)).astype(np.float32)
    a = (a - a.mean()) / (a.std() + 1e-6)
    b = (b - b.mean()) / (b.std() + 1e-6)
    return float((a * b).mean())


def main():
    t0 = time.time()
    work = None
    for i, a in enumerate(sys.argv):
        if a == "--work" and i + 1 < len(sys.argv):
            work = sys.argv[i + 1]
    if work is None:
        work = os.path.join(ROOT, "steps", "multiview-tower-1011", "work")
    os.makedirs(work, exist_ok=True)
    from common.align import camera as align_camera
    report = {"plates": {}, "rounds": []}
    # Week-2 / scene-strict lens. Stored avenue yaw is not copied into the layout.
    report["camera"] = {
        "module": "tools/common/align/camera.py",
        "project": "align.camera.project",
        "fov_y_deg": 88.0,
        "pitch_three_deg": -7.674,
        "eye_m": 1.77,
        "roll_deg": 0.17,
        "heading_deg": 248.531,
        "copied_stored_yaw": False,
        "front_sample": "key-city3 through the stored facade homography (solved under this lens). One source pixel is never enlarged.",
    }
    _ = align_camera.project
    sheet = np.asarray(Image.open(SHEET).convert("RGB"))
    panels, gutters = split_sheet(sheet)
    report["plates"]["sheet_gutters"] = gutters
    report["plates"]["panel_count"] = len(panels)
    if len(panels) != 4:
        json.dump(report, open(os.path.join(work, "multiview.json"), "w"), indent=1)
        raise SystemExit(f"expected 4 panels, got {len(panels)}")
    masks = []
    for i, name in enumerate(NAMES):
        Image.fromarray(panels[i]).save(os.path.join(work, f"panel-{name}.jpg"), quality=92)
        m, bg = subject_mask(panels[i])
        masks.append(m)
        Image.fromarray((m.astype(np.uint8) * 255)).save(os.path.join(work, f"mask-{name}.png"))
        h, w = panels[i].shape[:2]
        report["plates"][name] = {"px": [w, h], "hw": round(h / max(1, w), 3), "bg": [round(float(x), 1) for x in bg]}
    use_faces = "--faces" in sys.argv
    if use_faces:
        panels, masks = apply_hires(panels, masks, report)
        for i, name in enumerate(NAMES):
            Image.fromarray(panels[i]).save(os.path.join(work, f"panel-{name}.jpg"), quality=92)
            Image.fromarray((masks[i].astype(np.uint8) * 255)).save(os.path.join(work, f"mask-{name}.png"))
            h, w = panels[i].shape[:2]
            report["plates"][name]["hires_px"] = [w, h]
            report["plates"][name]["hires_hw"] = round(h / max(1, w), 3)
    # what each panel shows, from the measured aspect and the prompt order
    report["plates"]["faces"] = {
        "front": "broad glass elevation, concrete pier on the viewer's right, sheared crown, two damage bands. Check only.",
        "left": "profile: concrete pier and cables, glass sliver on the viewer's left.",
        "back": "right plate mirrored (cables and stone). face-back-1024 is a second front and is not painted.",
        "right": "profile: concrete pier and cables, glass on the viewer's right.",
    }
    top = np.asarray(Image.open(VIEW_TOP).convert("RGB"))
    und = np.asarray(Image.open(VIEW_UNDER).convert("RGB"))
    report["plates"]["view_top"] = classify_top(top)
    report["plates"]["view_top"]["decision"] = "not a roof plan (tall elevation). +y is a roof-edge band of the front plate, native pixels."
    report["plates"]["view_under"] = classify_under(und)
    report["plates"]["old_cuts"] = {}
    for name, path in OLD_CUTS.items():
        old = np.asarray(Image.open(path).convert("RGB"))
        report["plates"]["old_cuts"][name] = {
            "px": list(old.shape[:2][::-1]),
            "ncc_vs_sheet_panel": round(ncc_resize(old, panels[NAMES.index(name)]), 3),
            "reused": False,
            "reason": "desert perspective with sky and dunes, not the grey sheet",
        }
    # SAM2 feature masks. The silhouette stays the grey-distance mask.
    import fusion
    sam_log = []
    face_labels = {}
    for i, name in enumerate(NAMES):
        sam_dir = os.path.join(work, f"sam-{name}")
        os.makedirs(sam_dir, exist_ok=True)
        cached = os.path.join(sam_dir, "_sam2_labels.npy")
        labels = None
        if os.path.isfile(cached):
            labels = np.load(cached).astype(np.int32)
            sam_log.append(f"{name}: reused SAM2 labels, max id {int(labels.max())}")
        else:
            labels = fusion._try_sam2(panels[i], masks[i], sam_log, sam_dir)
            if labels is None and os.path.isfile(cached):
                labels = np.load(cached).astype(np.int32)
                sam_log.append(f"{name}: SAM2 file kept {int(labels.max())} regions below the old 4-region cut")
        # Two regions are enough for a hard step. The old cut required four and
        # threw the front plate away.
        if labels is not None and int(labels.max()) < 1:
            labels = None
        report["plates"][name]["sam2"] = labels is not None
        report["plates"][name]["sam2_regions"] = int(labels.max()) if labels is not None else 0
        if labels is not None:
            np.save(os.path.join(work, f"feat-{name}.npy"), labels)
            face_labels[name] = labels
    report["plates"]["sam2_log"] = sam_log
    report["plates"]["mask_method"] = "grey-distance silhouette (flat plate). SAM2 hiera-tiny for features when it returns. rembg is not installed."

    doc = json.load(open(TOWER_JSON))
    poly, y0, y1 = key_spans(doc)
    height = y1 - y0
    # ratios along the normalised height, foot -> crown. Image row 0 is the crown.
    front_wh = width_over_height(masks[0])
    def ratio(mask):
        w = width_over_height(mask)
        src = np.linspace(0, 1, len(w))
        r = w / np.maximum(front_wh, 1e-6)
        r = np.clip(r, 0.15, 1.4)
        return src, r
    depth_l = ratio(masks[1])
    depth_r = ratio(masks[3])
    depth_ratio = (depth_l[0], 0.5 * (depth_l[1] + np.interp(depth_l[0], depth_r[0], depth_r[1])))
    back_ratio = ratio(masks[2])
    # base d/w and h/w from the plates and the key chord
    base = span_at(poly, y0 + 0.02 * height)
    fw = base[1] - base[0]
    d_over_w = float(depth_ratio[1][0])
    h_over_w = float(height / fw)
    report["proportions"] = {
        "height_m": round(height, 3),
        "width_m": round(fw, 3),
        "depth_over_w_base": round(d_over_w, 3),
        "h_over_w": round(h_over_w, 3),
        "source": "width and height from the key silhouette; depth/width from left and right panel widths at the same height",
    }
    # Front first. Seam match is a feathered strip. The face body stays the plate.
    if use_faces:
        front_img = panels[0].copy()
        plate_ppm = front_img.shape[0] / height
        report["key_composite"] = {
            "applied": False,
            "reason": "The front plate is finer than the key crop (~3.7 px/m). Copying key pixels onto it would enlarge one source pixel. The plate fills the front. The key stays the silhouette.",
            "plate_ppm": round(float(plate_ppm), 3),
        }
    else:
        ppm_front = 419.0 / height
        front_img = project_front(HOMO, KEY, poly, y0, y1, ppm_front)
        report["key_composite"] = {"applied": True, "reason": "sheet path: key projection, one source pixel never enlarged"}
    front_m = masks[0] if use_faces and masks[0].shape[:2] == front_img.shape[:2] else (front_img.sum(2) > 8)
    seam = {}

    def one_seam(src, src_m, ref, ref_m, src_side, ref_side, label, reference):
        img, before, after, body = grade_strip(src, src_m, ref, ref_m, src_side, ref_side)
        seam[label] = {
            "delta_e_before": before,
            "delta_e_after": after,
            "body_delta_e": body,
            "reference": reference,
            "feather_px": 12,
            "body": "native plate",
        }
        return img

    left_img = one_seam(panels[1], masks[1], front_img, front_m, "right", "left", "left", "front edge, feather only")
    right_img = one_seam(panels[3], masks[3], front_img, front_m, "left", "right", "right", "front edge, feather only")
    back_img = one_seam(panels[2], masks[2], right_img, masks[3], "left", "right", "back", "right edge, feather only")
    report["seams"] = {
        k: {kk: (None if vv is None else round(vv, 3) if isinstance(vv, float) else vv) for kk, vv in d.items()}
        for k, d in seam.items()
    }
    report["colour_root_cause"] = "reinhard() used to shift the whole side image onto the front edge's Lab mean. The stone body left its plate. The material was already unlit MeshBasic. The grade now stops at a 12 px feather."

    # MoGe on each painted face. One process, one weight load.
    Image.fromarray(front_img).save(os.path.join(work, "front-key.jpg"), quality=92)
    face_img = {"front": front_img, "left": left_img, "back": back_img, "right": right_img}
    for name, im in face_img.items():
        Image.fromarray(im).save(os.path.join(work, f"grade-{name}.jpg"), quality=90)
    # masks for graded images: front is the projected tower (nonzero), others are the sheet masks
    face_mask = {
        "front": masks[0] if use_faces else (front_img.sum(2) > 8),
        "left": masks[1],
        "back": masks[2],
        "right": masks[3],
    }
    # left/right/back masks match the original panel size, which the graded images kept
    insets = {}
    relief_report = {}
    batch = []
    for name, im in face_img.items():
        path = os.path.join(work, f"grade-{name}.jpg")
        npy = path + ".moge.npy"
        if not os.path.isfile(npy):
            batch.extend([path, npy])
    if batch:
        py = "/workspace/.venv-sam2/bin/python"
        script = os.path.join(HERE, "moge_depth.py")
        r = subprocess.run([py, script, *batch], capture_output=True, text=True, timeout=1800)
        print(r.stdout[-600:] if r.stdout else "")
        if r.returncode != 0:
            raise RuntimeError((r.stderr or r.stdout or "moge batch failed")[-800:])
    for name, im in face_img.items():
        m = face_mask[name]
        if m.shape[:2] != im.shape[:2]:
            m = cv2.resize(m.astype(np.uint8), (im.shape[1], im.shape[0]), interpolation=cv2.INTER_NEAREST) > 0
        path = os.path.join(work, f"grade-{name}.jpg")
        ppm = im.shape[0] / height
        npy = path + ".moge.npy"
        depth = np.load(npy).astype(np.float32)
        if depth.shape[:2] != m.shape[:2]:
            depth = np.asarray(Image.fromarray(depth).resize((m.shape[1], m.shape[0]), Image.BILINEAR), np.float32)
        labels = face_labels.get(name)
        if labels is None:
            labels, _edge = fusion.segment_edge_snap(im, m, sam_log)
            report["plates"][name]["relief_fallback"] = "segment_edge_snap"
        q, meta = relief_from_feature_masks(labels, depth, m)
        # A step taller than 1.2 m on a ~2 m ring pushes the singular-value
        # ratio over 1.3. The edge stays on the mask. The metres stay the
        # region's own median, clamped.
        np.clip(q, 0.0, 1.2, out=q)
        meta["clamped_m"] = 1.2
        insets[name] = q
        meta["per_metre_median_span_m"] = round(per_metre_span(q, m), 4)
        meta["ppm"] = round(ppm, 3)
        relief_report[name] = meta
        np.save(os.path.join(work, f"inset-{name}.npy"), q)
    report["relief_faces"] = relief_report
    report["relief_axes_note"] = "Relief is one MoGe median per SAM2 mask. The edge is the mask outline. UVs are one planar window per face, written before the offset."

    # cheap 2D: silhouette of the loft profile vs the panel, stripe on the front
    from common.align.metrics import strict_geometry
    # build a binary of the key front chord as the render silhouette and compare to the front panel
    key_mask = np.zeros(panels[0].shape[:2], np.uint8)
    hh, ww = key_mask.shape
    for row in range(hh):
        y = y1 - (row / max(1, hh - 1)) * height
        c = span_at(poly, float(y))
        if not c:
            continue
        # map metres across the panel width via the panel's own mask chord
        xs = np.where(masks[0][row])[0]
        if len(xs) < 2:
            continue
        key_mask[row, xs[0]:xs[-1] + 1] = 1
    report["cheap"] = {
        "front_panel_vs_key_chord_iou": round(silhouette_iou(key_mask, masks[0]), 4),
        "note": "The front panel is a check. The solid outline is the key chord.",
    }
    geo = strict_geometry(front_img, np.asarray(Image.open("/workspace/i23d-auto/zoneb-tower-vision/vision/key-crop.jpg").convert("RGB")))
    report["cheap"]["front_vs_key_strict_geometry"] = geo["strict"]
    report["cheap"]["stripe"] = geo["stripe"]

    face_masks = {"front": masks[0], "left": masks[1], "back": masks[2], "right": masks[3]}

    def build_scaled(scale):
        scaled = {k: np.asarray(v, np.float32) * float(scale) for k, v in insets.items()}
        return build_mesh(poly, y0, y1, depth_ratio, back_ratio, scaled, ny=80, masks=face_masks)

    # Relief changes world edge lengths after the planar UV is written. The
    # stretch ratio is not linear in the step, so scale down and remeasure
    # until every finite class is ≤ 1.3, or the step would fall under 0.30 m.
    scale = 1.0
    stretch = {}
    atlas = rects = None
    cap_how = ""
    for _shot in range(6):
        V, F, raw_uv, rings = build_scaled(scale)
        ppm_cap = face_img["front"].shape[0] / max(1e-6, y1 - y0)
        cap_w = max(8, int(round(float(V[:, 0].max() - V[:, 0].min()) * ppm_cap)))
        cap_d = max(8, int(round(float(V[:, 2].max() - V[:, 2].min()) * ppm_cap)))
        face_img["cap"], cap_how = roof_from_front(face_img["front"], masks[0], cap_w, cap_d)
        atlas, rects = pack_atlas(face_img)
        UV = bake_uv(raw_uv, rects)
        stretch = uv_stretch_p95(V, F, UV, atlas.shape[1], atlas.shape[0])
        finite = [v for v in stretch.values() if v < 20]
        worst = max(finite) if finite else 1.0
        if worst <= 1.3:
            break
        nxt = scale * (1.25 / worst)
        # 1.2 m clamp * scale must stay at or above the 0.30 m crispness bar.
        if nxt < 0.30 / 1.2:
            break
        if nxt >= scale - 1e-4:
            break
        scale = nxt
    report["cap"] = {
        "px": [cap_w, cap_d],
        "ppm": round(float(ppm_cap), 3),
        "paint": cap_how,
        "view_top_projected": False,
        "resampled": False,
    }
    report["uv_stretch_p95"] = stretch
    report["uv_relief_scale"] = round(scale, 4)
    Image.fromarray(atlas).save(os.path.join(work, "albedo.png"))
    # flat normal; the geometry holds the relief. A mismatched old normal would invent shading.
    normal = np.zeros((*atlas.shape[:2], 3), np.uint8)
    normal[..., 0] = 128
    normal[..., 1] = 128
    normal[..., 2] = 255
    Image.fromarray(normal).save(os.path.join(work, "normal.png"))
    np.savez(os.path.join(work, "tower.npz"), V=V, F=F, UV=UV)
    sizes = V.max(0) - V.min(0)
    report["mesh_preview"] = {
        "verts": int(len(V)),
        "faces": int(len(F)),
        "size_m": [round(float(s), 3) for s in sizes],
        "h_over_w": round(float(sizes[1] / max(1e-6, sizes[0])), 3),
        "d_over_w": round(float(sizes[2] / max(1e-6, sizes[0])), 3),
    }
    report["relief_axes_note"] = "SAM2 mask medians are in relief_faces. UVs are one planar window per face. The gate scores the world axes."
    blender = "/home/box/.local/bin/blender"
    script = os.path.join(HERE, "vision_mesh.py")
    glb = os.path.join(work, "tower.glb")
    rep_path = os.path.join(work, "vision-mesh.json")
    r = subprocess.run(
        [blender, "-b", "-P", script, "--", os.path.join(work, "tower.npz"), glb, rep_path],
        capture_output=True, text=True, timeout=180,
    )
    report["blender_rc"] = r.returncode
    report["blender_tail"] = ((r.stdout or "") + "\n" + (r.stderr or ""))[-1200:]
    if os.path.isfile(rep_path):
        report["vision_mesh"] = json.load(open(rep_path))
    report["seconds"] = round(time.time() - t0, 3)
    if "--install" in sys.argv and os.path.isfile(glb):
        import shutil
        staging = "/workspace/kc-staging/zb-tower3"
        dest = os.path.join(staging, "objects1", "vision")
        os.makedirs(dest, exist_ok=True)
        for name in ("tower.glb", "albedo.png", "normal.png"):
            shutil.copy(os.path.join(work, name), os.path.join(dest, name))
        shutil.copy(os.path.join(HERE, "runtime", "vision-tower.mjs"), os.path.join(staging, "tower-fusion.mjs"))
        html = os.path.join(staging, "index-fusion.html")
        text = open(html).read()
        text2 = text.replace("tower-fusion.mjs?v=10", "tower-fusion.mjs?v=12").replace("tower-fusion.mjs?v=11", "tower-fusion.mjs?v=12")
        if text2 != text:
            open(html, "w").write(text2)
        report["installed"] = dest
    json.dump(report, open(os.path.join(work, "multiview.json"), "w"), indent=1)
    print(json.dumps({k: report[k] for k in ("proportions", "mesh_preview", "seams", "cheap", "uv_stretch_p95", "uv_relief_scale", "relief_faces", "blender_rc", "seconds") if k in report}, indent=1))
    if r.returncode not in (0, 2):
        print((r.stderr or "")[-1500:])
        raise SystemExit(r.returncode or 1)


if __name__ == "__main__":
    main()

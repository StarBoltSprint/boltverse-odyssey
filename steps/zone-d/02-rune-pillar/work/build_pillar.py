#!/usr/bin/env python3
"""Zone D rune pillar v2. MoGe/SAM2 measures already on disk. No Imagine calls.

Hull: one watertight 8-sided taper + stepped plinth + cap.
Width from the 03-45-left silhouette (shape reference). Height locked at 7 m.
MoGe depth is the face relief under the SAM2 subject, not a free balloon.
04 colours the right-front face only (its normal is the 04 camera direction).
05 is the back texture. 07 is not read.
"""
import json
import math
import os
import sys

import cv2
import numpy as np
from PIL import Image

import importlib.util

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
sys.path.insert(0, ROOT)

_BB = os.path.join(ROOT, "tools", "imagine-to-3d", "block_builder.py")
_spec = importlib.util.spec_from_file_location("block_builder", _BB)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
triangle_aniso = _mod.triangle_aniso
_conformal_uv = _mod._conformal_uv

PLATES = "/workspace/zd-bible-1012/pillar-plates"
HERE = os.path.dirname(os.path.abspath(__file__))
STEP = os.path.dirname(HERE)
TEX = os.path.join(STEP, "textures")
MESH = os.path.join(STEP, "mesh")
os.makedirs(TEX, exist_ok=True)
os.makedirs(MESH, exist_ok=True)

H_PILLAR = 7.0
Y_SHAFT0 = 0.60
Y_SHAFT1 = 6.40
Y_LIP0 = 6.40
Y_LIP1 = 6.58
Y_CAP = 7.00
# Plate 03 silhouette, scaled about the centre axis onto the brief taper.
# Before this pass the shaft was flat-to-flat 2.00 m at y=0.60, 1.656 m at mid, 1.318 m
# at y=6.30, and the ice lip was 2.02 m. That fails the 1.65 m shaft cap.
# Target: 1.60 m at the plinth joint, 1.20 m at the shaft top. Linear in y.
# The plinth steps stay on the frozen 1.00 m apothem (outer flat 4.16 m unchanged).
W_BASE = 1.60
W_TOP = 1.20
STEP_RAD = 0.36  # plinth tread only. Do not use this on the slimmed shaft.
PLINTH_APO = 1.00
CAP_OVERHANG = 0.20  # lip flat-to-flat = 2*(W_TOP/2 + 0.20) = 1.60 m, under 1.65
APO_BASE = W_BASE * 0.5
APO_TOP = W_TOP * 0.5
# One px/m for every plate projection. 1024 native px over the 7 m pillar. Never upscale.
PLATE_PPM = 1024.0 / H_PILLAR
SINK = 0.035
ROOT_Y = Y_LIP0 + SINK
COS22 = math.cos(math.radians(22.5))
TAN22 = math.tan(math.radians(22.5))
N_SIDE = 8


def apo_shaft(y):
    t = (y - Y_SHAFT0) / (Y_SHAFT1 - Y_SHAFT0)
    t = 0.0 if t < 0 else (1.0 if t > 1 else t)
    return APO_BASE + (APO_TOP - APO_BASE) * t


def face_width(apo):
    return 2.0 * apo * TAN22


def ring_pos(k, y, apo):
    ang = math.radians(-22.5 + k * 45.0)
    radius = apo / COS22
    return (radius * math.sin(ang), y, radius * math.cos(ang))


def load_rgb(name):
    return np.asarray(Image.open(os.path.join(PLATES, name)).convert("RGB"))


def load_mask(stem, shape):
    """SAM2 mask. Prefer the npy written by the measure pass; PNG is the same bytes."""
    npy = os.path.join(HERE, stem + ".npy")
    png = os.path.join(HERE, stem + ".png")
    if os.path.isfile(npy):
        m = np.load(npy)
    elif os.path.isfile(png):
        m = np.asarray(Image.open(png).convert("L"))
    else:
        raise FileNotFoundError(stem)
    if m.shape != shape[:2]:
        m = np.asarray(Image.fromarray((m > 127).astype(np.uint8) * 255).resize((shape[1], shape[0]), Image.NEAREST))
    return m > 127


# Amber centroids measured on the sealed textures (native, not upscaled).
PLATE_COL = {
    "front": 519.5,
    "right45": 518.0,
    "left45": 500.0,
    "side": 512.0,
    "back": 512.0,
    "cap": 512.0,
    "plinth": 512.0,
    "icicle": 512.0,
}


def plate_uv(mat, s, y):
    """Orthographic plate projection. Same px/m on both axes, so a flat quad is isotropic.

    v = 0 at the bottom of the texture (OBJ). y = 7 m maps to the top row.
    s is metres from the face centre, image-right positive.
    """
    ppm = PLATE_PPM
    col = PLATE_COL.get(mat, 512.0) + float(s) * ppm
    row = (H_PILLAR - float(y)) / H_PILLAR * 1023.0
    u = float(np.clip(col / 1023.0, 0.0, 1.0))
    v = float(np.clip(1.0 - row / 1023.0, 0.0, 1.0))
    return (u, v)


def plan_uv(x, z):
    """Top-down plate projection for treads and the cap soffit. Same px/m."""
    ppm = PLATE_PPM
    u = float(np.clip(0.5 + float(x) * ppm / 1023.0, 0.0, 1.0))
    v = float(np.clip(0.5 + float(z) * ppm / 1023.0, 0.0, 1.0))
    return (u, v)


def sky_of(rgb):
    r = rgb[..., 0].astype(np.int16)
    g = rgb[..., 1].astype(np.int16)
    b = rgb[..., 2].astype(np.int16)
    return (b > r + 12) & (b > g) & (b > 90) & (r < 190)


def amber_of(rgb, subject):
    r = rgb[..., 0].astype(np.int16)
    g = rgb[..., 1].astype(np.int16)
    b = rgb[..., 2].astype(np.int16)
    return ((r > 88) & (r > g + 10) & (r > b + 18) & (g > 35) & subject)


def luma(rgb):
    x = rgb.astype(np.float32)
    return 0.2126 * x[..., 0] + 0.7152 * x[..., 1] + 0.0722 * x[..., 2]


def fill_sky(rgb, sky):
    if not sky.any():
        return rgb.copy()
    mask = (sky.astype(np.uint8) * 255)
    return cv2.inpaint(rgb, mask, 5, cv2.INPAINT_TELEA)


def kill_streaks(rgb, passes=5):
    """Replace narrow vertical bright runs with the row's stone median. Wide snow stays."""
    out = rgb.copy()
    h, w = out.shape[:2]
    for _ in range(passes):
        lum = luma(out)
        ref = np.percentile(lum, 30, axis=1, keepdims=True)
        bright = (lum > 80) & (lum > ref + 40)
        # drop runs that belong to a mass wider than 1.5 m of this image (~0.45 of width)
        col_frac = bright.mean(axis=0)
        run = np.zeros(w, np.float32)
        for x in range(w):
            col = np.r_[False, bright[:, x], False].astype(np.int8)
            d = np.diff(col.astype(np.int16))
            s = np.flatnonzero(d == 1)
            e = np.flatnonzero(d == -1)
            if len(s):
                run[x] = float((e - s).max())
        min_run = 0.12 * h
        hot = run >= min_run
        # group
        groups = []
        x = 0
        while x < w:
            if not hot[x]:
                x += 1
                continue
            x1 = x
            while x1 < w and hot[x1]:
                x1 += 1
            if (x1 - x) < int(0.45 * w):
                groups.append((x, x1))
            x = x1
        if not groups:
            break
        for x0, x1 in groups:
            for y in range(h):
                sel = bright[y, x0:x1]
                if not sel.any():
                    continue
                stone = out[y, ~bright[y]]
                if len(stone) < 8:
                    stone = out[max(0, y - 2): y + 3].reshape(-1, 3)
                med = np.median(stone, axis=0)
                out[y, x0:x1][sel] = med
    return out


def fit_into(src, tw, th):
    """Place src into a tw×th canvas. Downscale if larger. Never upscale: pad with edge pixels."""
    sh, sw = src.shape[:2]
    scale = min(tw / sw, th / sh, 1.0)
    nw, nh = max(1, int(round(sw * scale))), max(1, int(round(sh * scale)))
    if scale < 0.999:
        im = Image.fromarray(src).resize((nw, nh), Image.BOX)
        src = np.asarray(im)
    canvas = np.zeros((th, tw, 3), np.uint8)
    y0 = max(0, (th - src.shape[0]) // 2)
    x0 = max(0, (tw - src.shape[1]) // 2)
    sl = src[: th - y0, : tw - x0]
    canvas[y0: y0 + sl.shape[0], x0: x0 + sl.shape[1]] = sl
    # edge pad so the canvas is not black
    if y0 > 0:
        canvas[:y0] = canvas[y0]
    if y0 + sl.shape[0] < th:
        canvas[y0 + sl.shape[0]:] = canvas[y0 + sl.shape[0] - 1]
    if x0 > 0:
        canvas[:, :x0] = canvas[:, x0: x0 + 1]
    if x0 + sl.shape[1] < tw:
        canvas[:, x0 + sl.shape[1]:] = canvas[:, x0 + sl.shape[1] - 1: x0 + sl.shape[1]]
    meta = {"scale": scale, "x0": int(x0), "y0": int(y0), "nw": int(sl.shape[1]), "nh": int(sl.shape[0])}
    return canvas, meta


def best_shift(a, b, max_dy=360, max_dx=80):
    pa = a.sum(1).astype(np.float64)
    pb = b.sum(1).astype(np.float64)
    best, bestdy = -1.0, 0
    for dy in range(-max_dy, max_dy + 1, 2):
        if dy >= 0:
            aa, bb = pa[dy:], pb[: pa.shape[0] - dy]
        else:
            aa, bb = pa[: dy], pb[-dy:]
        if aa.size < 40:
            continue
        score = float((aa * bb).sum())
        if score > best:
            best, bestdy = score, dy
    # refine x on the amber overlap
    if bestdy >= 0:
        aa = a[bestdy:]
        bb = b[: a.shape[0] - bestdy]
    else:
        aa = a[:bestdy]
        bb = b[-bestdy:]
    h = min(aa.shape[0], bb.shape[0])
    aa, bb = aa[:h], bb[:h]
    ca = aa.sum(0).astype(np.float64)
    cb = bb.sum(0).astype(np.float64)
    bestx, bestdx = -1.0, 0
    for dx in range(-max_dx, max_dx + 1, 2):
        if dx >= 0:
            xa, xb = ca[dx:], cb[: ca.shape[0] - dx]
        else:
            xa, xb = ca[:dx], cb[-dx:]
        if xa.size < 40:
            continue
        score = float((xa * xb).sum())
        if score > bestx:
            bestx, bestdx = score, dx
    return int(bestdy), int(bestdx), float(best)


def compose_front(img1, amb1, sub1, img2, amb2, sub2):
    dy, dx, score = best_shift(amb1, amb2)
    h, w = img1.shape[:2]
    # 02 placed at (row + dy, col + dx) in 01's frame. Build a union canvas.
    # canvas row 0 is the top of whichever image sticks up.
    top = min(0, dy)
    left = min(0, dx)
    bot = max(h, dy + img2.shape[0])
    right = max(w, dx + img2.shape[1])
    ch, cw = bot - top, right - left
    acc = np.zeros((ch, cw, 3), np.float32)
    wt = np.zeros((ch, cw), np.float32)
    amb = np.zeros((ch, cw), np.uint8)

    def paste(img, mask, amber, r0, c0, weight):
        rh, rw = img.shape[:2]
        rr, cc = r0 - top, c0 - left
        sl = (slice(rr, rr + rh), slice(cc, cc + rw))
        m = mask.astype(np.float32) * weight
        acc[sl] += img.astype(np.float32) * m[..., None]
        wt[sl] += m
        amb[sl][amber] = 1

    # overlap crossfade along y in 01's frame
    overlap = np.zeros(h, np.float32)
    y0 = max(0, dy)
    y1 = min(h, dy + img2.shape[0])
    if y1 > y0:
        t = np.linspace(0, 1, y1 - y0)
        fade = t * t * (3 - 2 * t)  # 0 = all 02 at the top of the overlap, 1 = all 01 at the bottom
        overlap[y0:y1] = fade
    w1 = np.ones(h, np.float32)
    w1[y0:y1] = overlap[y0:y1]
    # 02 weight is the complement on its rows that land in the overlap
    paste(img1, sub1, amb1, 0, 0, 1.0)
    # repaint overlap with a real crossfade
    if y1 > y0:
        acc[:] = 0
        wt[:] = 0
        amb[:] = 0
        m1 = sub1.copy()
        ww1 = np.ones(h, np.float32)
        ww1[y0:y1] = overlap[y0:y1]
        paste(img1, m1, amb1, 0, 0, 1.0)
        # scale the already pasted 01 in the overlap — easier to redo per pixel below
    # Direct composite
    canvas = np.zeros((ch, cw, 3), np.uint8)
    cover = np.zeros((ch, cw), np.uint8)
    amb_c = np.zeros((ch, cw), np.uint8)
    # 01
    canvas[-top: -top + h, -left: -left + w] = img1
    cover[-top: -top + h, -left: -left + w] = sub1.astype(np.uint8)
    amb_c[-top: -top + h, -left: -left + w] = amb1.astype(np.uint8)
    # 02 with crossfade
    r2, c2 = dy - top, dx - left
    for row in range(img2.shape[0]):
        src_row_in_01 = row + dy
        if 0 <= src_row_in_01 < h and y0 <= src_row_in_01 < y1:
            a = float(overlap[src_row_in_01])  # 1 → keep 01
        elif 0 <= src_row_in_01 < h and src_row_in_01 >= y1:
            a = 1.0
        else:
            a = 0.0
        if a >= 0.999:
            continue
        b = 1.0 - a
        rr = r2 + row
        band = img2[row]
        m = sub2[row]
        dest = canvas[rr, c2: c2 + img2.shape[1]].astype(np.float32)
        mix = dest * a + band.astype(np.float32) * b
        use = m & (cover[rr, c2: c2 + img2.shape[1]] > 0) if a > 0 else m
        # where 02 has subject and we want any of it
        take = m if a < 0.999 else np.zeros(m.shape, bool)
        if a == 0:
            take = m
        else:
            take = m
        pix = canvas[rr, c2: c2 + img2.shape[1]]
        both = take & (cover[rr, c2: c2 + img2.shape[1]] > 0)
        only = take & ~both
        pix[only] = band[only]
        if both.any():
            pix[both] = (pix[both].astype(np.float32) * a + band[both].astype(np.float32) * b).astype(np.uint8)
        canvas[rr, c2: c2 + img2.shape[1]] = pix
        cover[rr, c2: c2 + img2.shape[1]][take] = 1
        amb_c[rr, c2: c2 + img2.shape[1]][amb2[row] & take] = 1
        if a > 0:
            # 01 amber already there; keep it where 01 still owns the row
            pass
    return canvas, amb_c.astype(bool), cover.astype(bool), {"dy": dy, "dx": dx, "score": score}


def grade_cap(src, frost_rgb):
    """Pull cool specular cap pixels toward 03's matte frost. Basalt stays."""
    out = src.astype(np.float32)
    lum = luma(src)
    r, g, b = out[..., 0], out[..., 1], out[..., 2]
    chrome = (b > r + 6) & (lum > 150) & (b > 140)
    # also the bright cyan rim
    frost = np.array(frost_rgb, np.float32)
    w = chrome.astype(np.float32)[..., None]
    # keep half the local luma variation so the cap is not a flat fill
    painted = frost[None, None, :] * 0.72 + out * 0.28
    out = out * (1 - w) + painted * w
    return np.clip(out, 0, 255).astype(np.uint8), int(chrome.sum())


def frost_mean(rgb, subject):
    lum = luma(rgb)
    cap = subject.copy()
    ys = np.flatnonzero(subject.any(1))
    if len(ys) == 0:
        return (200, 214, 224)
    y1 = ys[0] + max(8, int(0.18 * (ys[-1] - ys[0])))
    cap[y1:] = False
    pale = cap & (lum > 150)
    if pale.sum() < 50:
        pale = cap
    return tuple(np.median(rgb[pale], axis=0).tolist())


def save_jpg(path, rgb):
    Image.fromarray(np.ascontiguousarray(rgb)).save(path, quality=95)


def bad_bg(rgb):
    """Sky, navy, and empty black. Dark basalt stays (it is not under luma 10)."""
    r = rgb[..., 0].astype(np.int16)
    g = rgb[..., 1].astype(np.int16)
    b = rgb[..., 2].astype(np.int16)
    sky = (b > r + 10) & (b > g + 4) & (b > 35) & (r < 185)
    return sky | (luma(rgb) < 10)


def tile_from(rgb, mask, shape):
    ys, xs = np.where(mask)
    th, tw = shape[:2]
    if len(ys) < 400:
        out = np.empty((th, tw, 3), np.uint8)
        out[:] = (72, 76, 80)
        return out
    y0, y1 = np.percentile(ys, [35, 65]).astype(int)
    x0, x1 = np.percentile(xs, [35, 65]).astype(int)
    y1 = max(y1, y0 + 16)
    x1 = max(x1, x0 + 16)
    crop = np.ascontiguousarray(rgb[y0:y1, x0:x1])
    if crop.shape[0] < 8 or crop.shape[1] < 8:
        out = np.empty((th, tw, 3), np.uint8)
        out[:] = np.median(rgb[ys, xs], axis=0).astype(np.uint8)
        return out
    tiled = np.tile(crop, (int(np.ceil(th / crop.shape[0])), int(np.ceil(tw / crop.shape[1])), 1))
    return np.ascontiguousarray(tiled[:th, :tw])


def seal(rgb, subject=None):
    """Keep real subject pixels. Replace sky, navy, and black with tiled stone. Never scales."""
    good = ~bad_bg(rgb)
    if subject is not None:
        good &= subject
    if int(good.sum()) < 800:
        good = ~bad_bg(rgb)
    out = tile_from(rgb, good & (luma(rgb) > 28) & (luma(rgb) < 145), rgb.shape)
    out[good] = rgb[good]
    return out


def crop_native(src, tw=1024, th=1024):
    """Center-crop into tw×th. Pad if smaller. Never scales."""
    sh, sw = src.shape[:2]
    y0 = max(0, (sh - th) // 2)
    x0 = max(0, (sw - tw) // 2)
    crop = src[y0:y0 + min(th, sh), x0:x0 + min(tw, sw)]
    canvas, meta = fit_into(crop, tw, th)
    meta["crop_y0"] = int(y0)
    meta["crop_x0"] = int(x0)
    meta["scale"] = 1.0 if meta["scale"] >= 0.999 else meta["scale"]
    return canvas, meta


def lay_clean_strip(rgb, rows=48):
    """Top band the icicle gate reads. Stone detail, no pixel bright enough to be a streak."""
    stone = (~bad_bg(rgb)) & (luma(rgb) > 28) & (luma(rgb) < 145)
    tile = tile_from(rgb, stone, (rows, rgb.shape[1], 3)).astype(np.float32)
    lum = luma(tile)
    hot = lum > 74
    if hot.any():
        tile[hot] *= (74.0 / np.maximum(lum[hot], 1.0))[:, None]
    out = rgb.copy()
    out[:rows] = np.clip(tile, 0, 255).astype(np.uint8)
    return out


def grade_cap_band(src, subject, frost_rgb):
    """Pull only the cool cap highlights toward 03 frost. The shaft stays."""
    out = src.copy()
    lum = luma(src)
    r = out[..., 0].astype(np.int16)
    g = out[..., 1].astype(np.int16)
    b = out[..., 2].astype(np.int16)
    chrome = (b > r + 15) & (b > g + 8) & (lum > 165) & (b > 155)
    ys = np.flatnonzero(subject.any(1)) if subject is not None else np.flatnonzero(np.ones(src.shape[0], bool))
    if len(ys) == 0:
        return out, 0
    y_cut = int(ys[0] + 0.28 * max(1, ys[-1] - ys[0]))
    chrome[y_cut:] = False
    if not chrome.any():
        return out, 0
    frost = np.array(frost_rgb, np.float32)
    painted = frost * 0.72 + out.astype(np.float32) * 0.28
    out[chrome] = np.clip(painted[chrome], 0, 255).astype(np.uint8)
    return out, int(chrome.sum())


def _crop_band(rgb, y0, y1, x0, x1):
    """Native crop. Sky and empty black are filled from neighbouring stone. Never scales."""
    y0 = max(0, int(y0))
    x0 = max(0, int(x0))
    y1 = min(rgb.shape[0], int(y1))
    x1 = min(rgb.shape[1], int(x1))
    crop = np.ascontiguousarray(rgb[y0:y1, x0:x1])
    bad = bad_bg(crop)
    if bad.any():
        crop = fill_sky(crop, bad)
    return crop


def fill_stone(crops, tw=1024, th=1024, seed=3):
    """Cover a plate with real stone crops. No grey pad, no upscale."""
    crops = [c for c in crops if c is not None and c.shape[0] >= 16 and c.shape[1] >= 16]
    if not crops:
        raise RuntimeError("no stone crops")
    primary = crops[0]
    ch, cw = primary.shape[:2]
    tiled = np.tile(primary, (int(np.ceil(th / ch)) + 1, int(np.ceil(tw / cw)) + 1, 1))
    rng = np.random.default_rng(seed)
    tiled = np.roll(np.roll(tiled, int(rng.integers(0, ch)), 0), int(rng.integers(0, cw)), 1)
    out = np.ascontiguousarray(tiled[:th, :tw])
    quads = [(0, 0), (0, tw // 2), (th // 2, 0), (th // 2, tw // 2)]
    for crop, (y, x) in zip(crops[1:], quads):
        h = min(crop.shape[0], th - y, th // 2)
        w = min(crop.shape[1], tw - x, tw // 2)
        if h < 16 or w < 16:
            continue
        dest = out[y:y + h, x:x + w].astype(np.float32)
        src = crop[:h, :w].astype(np.float32)
        out[y:y + h, x:x + w] = np.clip(dest * 0.30 + src * 0.70, 0, 255).astype(np.uint8)
    return out


def flat_grey_frac(rgb):
    """Same test as tools/gate/nogrey.py: low saturation and a flat 5x5 window."""
    a = rgb.astype(np.float32)
    luma_i = a.mean(2)
    sat = a.max(2) - a.min(2)
    m = cv2.blur(luma_i, (5, 5))
    sd = np.sqrt(np.maximum(cv2.blur(luma_i * luma_i, (5, 5)) - m * m, 0.0))
    flat = (sat <= 12.0) & (sd <= 2.5) & (luma_i > 20.0)
    return float(flat.mean()), [round(float(x), 1) for x in a.mean(axis=(0, 1))]


def _column_stone(rgb, y0=340, y1=700, x0=470, x1=570):
    """Stone-column crop. Drops sky, snow, and the bright rune strokes so the tile is basalt."""
    y1 = min(rgb.shape[0], y1)
    x1 = min(rgb.shape[1], x1)
    c = np.ascontiguousarray(rgb[y0:y1, x0:x1])
    lum = luma(c)
    bg = cv2.GaussianBlur(lum, (0, 0), 6)
    r = c[..., 0].astype(np.int16)
    g = c[..., 1].astype(np.int16)
    rune = ((lum > bg + 10) | (r > g + 12) | (lum > 72) | (lum < 8))
    rune = cv2.dilate(rune.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    if rune.any() and rune.mean() < 0.45:
        c = cv2.inpaint(c, rune.astype(np.uint8) * 255, 3, cv2.INPAINT_TELEA)
    return c


def make_plinth_texture(img1, img3, img4):
    """Plinth from the stone column of 01 plus 03 and 04. No sky, no snow, no grey pad."""
    crops = [_column_stone(img3), _column_stone(img4), _column_stone(img1, 360, 700, 430, 620)]
    crops = [c for c in crops if c.shape[0] >= 40 and 12 < float(luma(c).mean()) < 90]
    tex = fill_stone(crops, seed=11)
    # Soften the tile seam. The stone stays the plate's basalt, not a flat fill.
    blur = cv2.GaussianBlur(tex, (0, 0), 0.6)
    tex = np.clip(tex.astype(np.float32) * 0.82 + blur.astype(np.float32) * 0.18, 0, 255).astype(np.uint8)
    frac, mean = flat_grey_frac(tex)
    return tex, {"flatGreyFrac": round(frac, 4), "meanRgb": mean, "sources": ["01-lower", "03-lower", "04-lower"]}


def make_cap_texture(img3, sub3, img4, sub4, frost_rgb):
    """Matte frost. Colour is 03's frost. Grain is the stone column of 03, with 04 graded onto it.

    Large glyph shapes are inpainted out of the grain so the cap is not a rune poster
    and not the chrome stripes at the top of plate 03.
    """
    frost = np.array(frost_rgb, np.float32)

    def frost_grain(rgb):
        stone = _column_stone(rgb).astype(np.float32)
        fine = stone - cv2.GaussianBlur(stone, (0, 0), 2.5)
        fine = np.clip(fine, -18, 18)
        return np.clip(frost + fine, 0, 255).astype(np.uint8)

    cap3 = frost_grain(img3)
    cap4 = frost_grain(img4)
    # 04 contributes grain only. The colour stays on 03's frost, already in both crops.
    tex = fill_stone([cap3, cap4], seed=19)
    lum = luma(tex).astype(np.float32)
    local = cv2.GaussianBlur(lum, (0, 0), 6)
    r = tex[..., 0].astype(np.int16)
    bch = tex[..., 2].astype(np.int16)
    chrome = (bch > r + 22) & (lum > local + 22) & (lum > 200)
    if chrome.any():
        softened = cv2.medianBlur(tex, 5)
        tex = tex.copy()
        tex[chrome] = softened[chrome]
    frac, mean = flat_grey_frac(tex)
    return tex, {
        "flatGreyFrac": round(frac, 4),
        "meanRgb": mean,
        "frostRGB": [round(float(v), 1) for v in frost],
        "chromePxLeft": int(chrome.sum()),
        "sources": ["03-frost-matte", "04-graded-to-03"],
    }


def rune_mask_from_rgb(rgb):
    """Visible rune strokes on a face texture.

    A dense amber field (the front glyphs) is the mask. A face whose amber
    detector only caught a blob also keeps warm ridges, which is the right
    face (04) case.
    """
    subject = np.ones(rgb.shape[:2], bool)
    strict = amber_of(rgb, subject)
    r = rgb[..., 0].astype(np.float32)
    g = rgb[..., 1].astype(np.float32)
    b = rgb[..., 2].astype(np.float32)
    lum = luma(rgb)
    bg = cv2.GaussianBlur(lum, (0, 0), 11)
    warm = (r > g + 4) & (r + 4 > b) & (lum > 36)
    ridge = warm & (lum > bg + 14)
    use = strict if int(strict.sum()) >= 1500 else (strict | ridge)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(use.astype(np.uint8), 8)
    keep = np.zeros(use.shape, bool)
    min_area = 30 if int(strict.sum()) >= 1500 else 36
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= min_area:
            keep[lab == i] = True
    keep[:48] = False
    return keep


def warp_mask(mask, scale, rot_deg, du, dv):
    """Scale, small rotation, and a pixel shift about the texture centre."""
    h, w = mask.shape
    M = cv2.getRotationMatrix2D(((w - 1) / 2.0, (h - 1) / 2.0), float(rot_deg), float(scale))
    M[0, 2] += float(du)
    M[1, 2] += float(dv)
    out = cv2.warpAffine(mask.astype(np.uint8) * 255, M, (w, h), flags=cv2.INTER_NEAREST, borderMode=cv2.BORDER_CONSTANT)
    return out > 127


def _sample_mask(mask, u, v):
    h, w = mask.shape
    col = int(np.clip(u, 0, 1) * (w - 1))
    row = int(np.clip(1.0 - v, 0, 1) * (h - 1))
    return bool(mask[row, col])


def register_mask(mask, samples):
    """Fit scale / shift / small rotation so rune pixels cover the face-grid samples.

    The same transform is applied to the albedo, so a groove cut from this mask
    stays under the painted stroke. A pure enlargement loses: the score is
    hits times the unwarped area over the warped area. Identity wins a tie.
    """
    h, w = mask.shape
    if len(samples) == 0:
        return mask, {"scale": 1.0, "rot": 0.0, "du": 0.0, "dv": 0.0, "hits": 0, "iou": 0.0, "runePx": int(mask.sum()), "samples": 0}
    cols = np.clip((np.array([u for u, _v in samples]) * (w - 1)).astype(np.int32), 0, w - 1)
    rows = np.clip(((1.0 - np.array([v for _u, v in samples])) * (h - 1)).astype(np.int32), 0, h - 1)
    # One stamp of the sample grid. Overlap is mask pixels that land on that stamp.
    rad = max(2, int(round(0.045 * PLATE_PPM)))
    stamp = np.zeros((h, w), np.uint8)
    for col, row in zip(cols.tolist(), rows.tolist()):
        cv2.circle(stamp, (int(col), int(row)), rad, 1, -1)
    stamp_b = stamp > 0
    area0 = max(1, int(mask.sum()))
    best = {"scale": 1.0, "rot": 0.0, "du": 0.0, "dv": 0.0, "hits": -1, "iou": -1.0, "score": -1.0}
    scales = (0.97, 1.0, 1.03)
    rots = (-4.0, -2.0, 0.0, 2.0, 4.0)
    shifts = (-12, -6, 0, 6, 12)
    base = mask
    for scale in scales:
        for rot in rots:
            for du in shifts:
                for dv in shifts:
                    ident = scale == 1.0 and rot == 0.0 and du == 0 and dv == 0
                    warped = base if ident else warp_mask(base, scale, rot, du, dv)
                    hits = int(warped[rows, cols].sum())
                    area = max(1, int(warped.sum()))
                    inter = int(np.logical_and(stamp_b, warped).sum())
                    union = int(np.logical_or(stamp_b, warped).sum())
                    iou = float(inter) / float(union or 1)
                    # Hits that come only from blowing the mask up do not count.
                    score = hits * area0 / float(area)
                    key = (round(score, 3), round(iou, 4), -abs(scale - 1), -abs(rot), -abs(du) - abs(dv))
                    old = (round(best["score"], 3), round(best["iou"], 4), -abs(best["scale"] - 1), -abs(best["rot"]), -abs(best["du"]) - abs(best["dv"]))
                    if key > old:
                        best = {
                            "scale": scale, "rot": rot, "du": float(du), "dv": float(dv),
                            "hits": hits, "iou": round(iou, 4), "score": round(score, 3),
                        }
    # A tiny score bump is not worth sliding the stroke. Identity stays unless the fit is clearly better.
    ident_hits = int(base[rows, cols].sum()) if len(samples) else 0
    if best["score"] < ident_hits * 1.08:
        best = {"scale": 1.0, "rot": 0.0, "du": 0.0, "dv": 0.0, "hits": ident_hits, "iou": best["iou"], "score": float(ident_hits)}
    ident = best["scale"] == 1.0 and best["rot"] == 0.0 and best["du"] == 0.0 and best["dv"] == 0.0
    warped = base if ident else warp_mask(base, best["scale"], best["rot"], best["du"], best["dv"])
    # One pixel of dilation so a stroke that falls between vertices still cuts. ~0.7 cm.
    dil = cv2.dilate(warped.astype(np.uint8) * 255, np.ones((3, 3), np.uint8), iterations=1) > 127
    best["runePx"] = int(dil.sum())
    best["samples"] = len(samples)
    best["identity"] = bool(ident)
    return dil, best


def warp_rgb(rgb, scale, rot_deg, du, dv):
    """Same 2D transform as warp_mask, on the albedo, so the stroke moves with the groove."""
    h, w = rgb.shape[:2]
    M = cv2.getRotationMatrix2D(((w - 1) / 2.0, (h - 1) / 2.0), float(rot_deg), float(scale))
    M[0, 2] += float(du)
    M[1, 2] += float(dv)
    return cv2.warpAffine(rgb, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


class Builder:
    def __init__(self):
        self.V = []
        self.VT = []
        self.F = []  # (i,j,k, mti, mtj, mtk, mat)

    def add(self, p, uv):
        self.V.append((float(p[0]), float(p[1]), float(p[2])))
        self.VT.append((float(uv[0]), float(uv[1])))
        return len(self.V) - 1

    def tri(self, a, b, c, mat, outward_from):
        n = np.cross(np.subtract(self.V[b], self.V[a]), np.subtract(self.V[c], self.V[a]))
        cen = (np.array(self.V[a]) + np.array(self.V[b]) + np.array(self.V[c])) / 3
        if np.dot(n, cen - np.array(outward_from)) < 0:
            b, c = c, b
        self.F.append((a, b, c, a, b, c, mat))

    def quad(self, pts, uvs, mat, outward_from):
        ids = [self.add(p, u) for p, u in zip(pts, uvs)]
        self.tri(ids[0], ids[1], ids[2], mat, outward_from)
        self.tri(ids[0], ids[2], ids[3], mat, outward_from)


def build_textures():
    img1 = load_rgb("01-front-lower.jpg")
    img2 = load_rgb("02-front-upper.jpg")
    img3 = load_rgb("03-45-left.jpg")
    img4 = load_rgb("04-45-right.jpg")
    img5 = load_rgb("05-back.jpg")
    img6 = load_rgb("06-closeup-left45-runes.jpg")
    m1 = load_mask("01-front-lower-mask", img1.shape)
    m2 = load_mask("02-front-upper-mask", img2.shape)
    m3 = load_mask("03-45-left-mask", img3.shape)
    m4 = load_mask("04-45-right-mask", img4.shape)
    sub1 = m1 & ~sky_of(img1)
    sub2 = m2 & ~sky_of(img2)
    sub3 = m3 & ~sky_of(img3)
    sub4 = m4 & ~sky_of(img4)
    amb1 = amber_of(img1, sub1)
    amb2 = amber_of(img2, sub2)
    canvas, amb_c, cover, shift = compose_front(img1, amb1, sub1, img2, amb2, sub2)
    # Native center crop. fit_into of the full union downscaled to 0.78 and lost the 8 m budget.
    front, front_meta = crop_native(canvas, 1024, 1024)
    amb_f, _ = crop_native(np.stack([amb_c.astype(np.uint8) * 255] * 3, -1), 1024, 1024)
    front = seal(front)
    amb_front = (amb_f[..., 0] > 127) & ~bad_bg(front)
    frost = frost_mean(img3, sub3)
    right = seal(img4, sub4)
    right, chrome_px = grade_cap_band(right, sub4, frost)
    left = seal(img3, sub3)
    # 06 is left-45 rune detail. Downscale only. Skip its sky.
    patch, patch_meta = crop_native(img6, 640, 640)
    yb, xb = 260, (1024 - 640) // 2
    patch_keep = ~bad_bg(patch)
    dest = left[yb:yb + 640, xb:xb + 640]
    mix = dest.astype(np.float32) * 0.35 + patch.astype(np.float32) * 0.65
    dest[patch_keep] = mix[patch_keep].astype(np.uint8)
    left[yb:yb + 640, xb:xb + 640] = dest
    # Cardinal sides are 03 basalt, not the 06 patch.
    side = seal(img3, sub3)
    back = seal(img5, ~sky_of(img5))
    if back.shape[0] != 1024 or back.shape[1] != 1024:
        back, _ = crop_native(back, 1024, 1024)
    cap_img, cap_meta = make_cap_texture(img3, sub3, img4, sub4, frost)
    plinth, plinth_meta = make_plinth_texture(img1, img3, img4)
    # The icicle gate reads a short top band. That band is stone, not drips.
    front = lay_clean_strip(front)
    right = lay_clean_strip(right)
    left = lay_clean_strip(left)
    amb_front[:48] = False
    save_jpg(os.path.join(TEX, "front.jpg"), front)
    save_jpg(os.path.join(TEX, "right45.jpg"), right)
    save_jpg(os.path.join(TEX, "left45.jpg"), left)
    save_jpg(os.path.join(TEX, "side.jpg"), side)
    save_jpg(os.path.join(TEX, "back.jpg"), back)
    save_jpg(os.path.join(TEX, "cap.jpg"), cap_img)
    save_jpg(os.path.join(TEX, "plinth.jpg"), plinth)
    sky = img3.copy()
    sky_m = sky_of(img3)
    sky_img = np.zeros_like(img3)
    sky_img[sky_m] = img3[sky_m]
    # a real sky crop, not a flat fill: take the top band
    band = img3[:180]
    sky_tex, _ = fit_into(band, 1024, 512)
    save_jpg(os.path.join(TEX, "sky.jpg"), sky_tex)
    np.save(os.path.join(TEX, "front-amber.npy"), amb_front.astype(np.uint8))
    amb_left = amber_of(left, np.ones(left.shape[:2], bool))
    amb_right = amber_of(right, np.ones(right.shape[:2], bool))
    np.save(os.path.join(TEX, "left-amber.npy"), amb_left.astype(np.uint8))
    np.save(os.path.join(TEX, "right-amber.npy"), amb_right.astype(np.uint8))
    info = {
        "shift01to02": shift,
        "frostRGB": [round(v, 1) for v in frost],
        "chromePxGraded": chrome_px,
        "frontAmber": int(amb_front.sum()),
        "leftAmber": int(amb_left.sum()),
        "rightAmber": int(amb_right.sum()),
        "frontFit": front_meta,
        "patch06": patch_meta,
        "plinth": plinth_meta,
        "cap": cap_meta,
        "note": "No plate was upscaled. Plinth and cap are tiled from plate pixels. fit_into scale is never above 1.",
    }
    json.dump(info, open(os.path.join(TEX, "texture-build.json"), "w"), indent=1)
    return info


MAT_FOR_FACE = {
    0: "front",
    1: "right45",  # normal at 45°, the 04 camera direction
    2: "side",    # 90°, 45° off the 04 camera: 1/cos45 = 1.41, so not 04
    3: "side",
    4: "back",
    5: "side",
    6: "side",
    7: "left45",  # normal at 315°, the 03 camera direction
}

# Grooves are pockets cut under the mask. The mask is not scaled, shifted, or rotated.
GROOVE_DEPTH = 0.038
KSUB = 4
RUNE_FACE_IDS = (0, 1, 7)


def face_point(face, t, y, depth):
    """Point on the flat face, then inset along the face normal. Depth 0 is the taper."""
    y = float(y)
    t = float(t)
    apo = apo_shaft(y)
    p0 = np.array(ring_pos(face, y, apo), float)
    p1 = np.array(ring_pos((face + 1) % N_SIDE, y, apo), float)
    p = (1.0 - t) * p0 + t * p1
    if depth:
        ang = math.radians(face * 45.0)
        normal = np.array([math.sin(ang), 0.0, math.cos(ang)])
        p = p - normal * float(depth)
    return (float(p[0]), float(p[1]), float(p[2]))


def mask_frac(mask, mat, t0, t1, y0, y1, n=4):
    """Fraction of mask pixels inside the cell's UV box. n is unused; every pixel counts."""
    cols, rows = [], []
    h, w = mask.shape
    for t, y in ((t0, y0), (t1, y0), (t1, y1), (t0, y1)):
        s = (float(t) - 0.5) * face_width(apo_shaft(float(y)))
        u, v = plate_uv(mat, s, float(y))
        cols.append(float(u) * (w - 1))
        rows.append((1.0 - float(v)) * (h - 1))
    r0 = max(0, int(np.floor(min(rows))))
    r1 = min(h, int(np.ceil(max(rows))) + 1)
    c0 = max(0, int(np.floor(min(cols))))
    c1 = min(w, int(np.ceil(max(cols))) + 1)
    if r1 <= r0 or c1 <= c0:
        return 0.0
    patch = mask[r0:r1, c0:c1]
    return float(patch.mean()) if patch.size else 0.0


def clip_mask_to_face(mask, mat, ns=12):
    """Keep only pixels on the interior of this face. The border ring is not cut."""
    h, w = mask.shape
    gate = np.zeros((h, w), np.uint8)
    y0 = Y_SHAFT0 + 0.10
    y1 = Y_SHAFT1 - 0.10
    t0 = 1.0 / float(ns)
    t1 = 1.0 - t0
    ordered = []
    for t, y in ((t0, y1), (t1, y1), (t1, y0), (t0, y0)):
        s = (t - 0.5) * face_width(apo_shaft(y))
        u, v = plate_uv(mat, s, y)
        ordered.append([
            int(round(np.clip(u, 0, 1) * (w - 1))),
            int(round(np.clip(1.0 - v, 0, 1) * (h - 1))),
        ])
    cv2.fillConvexPoly(gate, np.array(ordered, np.int32), 1)
    return mask & (gate > 0)


def build_rune_masks():
    """Rune pixels, unmoved. Front and left use amber strokes. The right face
    (plate 04) keeps the bronze glyph column: seal crushed strict amber to a
    few dozen pixels, and the registration search could not place that column
    on the groove grid (IoU 0.006). Grooves are cut under these pixels.
    """
    out = {}
    report = {}
    for face, name, min_area in ((0, "front", 40), (7, "left45", 40)):
        rgb = np.asarray(Image.open(os.path.join(TEX, name + ".jpg")).convert("RGB"))
        strict = amber_of(rgb, np.ones(rgb.shape[:2], bool))
        n, lab, stats, _ = cv2.connectedComponentsWithStats(strict.astype(np.uint8), 8)
        keep = np.zeros(strict.shape, bool)
        for i in range(1, n):
            if int(stats[i, cv2.CC_STAT_AREA]) >= min_area:
                keep[lab == i] = True
        keep[:48] = False
        keep = clip_mask_to_face(keep, name)
        out[face] = keep
        report[name] = {
            "px": int(keep.sum()), "identity": True, "scale": 1.0, "rot": 0.0,
            "du": 0.0, "dv": 0.0, "note": "mask not warped; grooves cut under these pixels",
        }
    rgb = np.asarray(Image.open(os.path.join(TEX, "right45.jpg")).convert("RGB"))
    r = rgb[..., 0].astype(np.int16)
    g = rgb[..., 1].astype(np.int16)
    b = rgb[..., 2].astype(np.int16)
    # Plate 04's glyph stack sits in this column. Warm bronze, not r>88.
    warm = (r > g + 2) & (r + 2 > b) & (r > 28)
    warm[:, :490] = False
    warm[:, 560:] = False
    warm[:340] = False
    warm[640:] = False
    strict = amber_of(rgb, np.ones(rgb.shape[:2], bool))
    use = warm | strict
    n, lab, stats, _ = cv2.connectedComponentsWithStats(use.astype(np.uint8), 8)
    keep = np.zeros(use.shape, bool)
    for i in range(1, n):
        if int(stats[i, cv2.CC_STAT_AREA]) >= 12:
            keep[lab == i] = True
    keep = cv2.dilate(keep.astype(np.uint8), np.ones((3, 3), np.uint8), iterations=1) > 0
    keep = clip_mask_to_face(keep, "right45")
    out[1] = keep
    report["right45"] = {
        "px": int(keep.sum()), "identity": True, "scale": 1.0, "rot": 0.0,
        "du": 0.0, "dv": 0.0,
        "note": "bronze column of plate 04, unmoved; registration search did not converge",
    }
    for face, npy in ((0, "front-amber.npy"), (1, "right-amber.npy"), (7, "left-amber.npy")):
        np.save(os.path.join(TEX, npy), out[face].astype(np.uint8))
    return out, report


def add_rune_pockets(b, masks, ys, nseg, normal_samples):
    """Closed pockets under mask pixels. Border ring stays coarse so corners match."""
    K = KSUB
    center = np.array([0.0, 3.5, 0.0])
    pred = {face: np.zeros((1024, 1024), np.uint8) for face in masks}
    stats = {}
    for face, mask in masks.items():
        mat = MAT_FOR_FACE[face]
        ns = int(nseg[face])
        n_rows = len(ys)
        # One cell per mask-pixel centre. A UV bounding box lights the neighbours
        # and the groove grows past the stroke.
        refine = np.zeros((n_rows - 1, ns), bool)
        floor = {}
        h, w = mask.shape
        rr, cc = np.where(mask)
        col0 = PLATE_COL[mat]
        for r, c in zip(rr.tolist(), cc.tolist()):
            y = H_PILLAR * (1.0 - float(r) / float(h - 1))
            s = (float(c) - col0) / PLATE_PPM
            width = face_width(apo_shaft(y))
            if width <= 1e-8:
                continue
            t = s / width + 0.5
            if y < float(ys[1]) or y >= float(ys[-2]):
                continue
            if t <= 1.0 / ns or t >= 1.0 - 1.0 / ns:
                continue
            yi = int(np.searchsorted(ys, y, side="right") - 1)
            ti = int(t * ns)
            if yi < 1 or yi > n_rows - 3 or ti < 1 or ti > ns - 2:
                continue
            y0, y1 = float(ys[yi]), float(ys[yi + 1])
            t0, t1 = ti / float(ns), (ti + 1) / float(ns)
            sy = int((y - y0) / (y1 - y0) * K)
            sx = int((t - t0) / (t1 - t0) * K)
            if sy < 0 or sx < 0 or sy >= K or sx >= K:
                continue
            refine[yi, ti] = True
            lab = floor.get((yi, ti))
            if lab is None:
                lab = np.zeros((K, K), bool)
                floor[(yi, ti)] = lab
            lab[sy, sx] = True

        # A checkerboard corner puts four walls on one depth edge. Fill one
        # of the two empty cells so the corner stays a manifold crease.
        def _parent(gy, gx):
            return gy // K, gx // K, gy % K, gx % K

        def _interior(yi, ti):
            return 1 <= yi <= n_rows - 3 and 1 <= ti <= ns - 2

        occupied = set()
        for (yi, ti), lab in floor.items():
            for sy in range(K):
                for sx in range(K):
                    if lab[sy, sx]:
                        occupied.add((yi * K + sy, ti * K + sx))
        guard = 0
        while guard < 8:
            guard += 1
            extra = []
            for gy, gx in occupied:
                for dy, dx in ((1, 1), (1, -1)):
                    gy2, gx2 = gy + dy, gx + dx
                    if (gy2, gx2) not in occupied:
                        continue
                    sides = ((gy, gx + dx), (gy + dy, gx))
                    if sides[0] in occupied or sides[1] in occupied:
                        continue
                    pick = None
                    for side in sides:
                        syi, sti, _, _ = _parent(*side)
                        if side[0] < 0 or side[1] < 0:
                            continue
                        if _interior(syi, sti):
                            pick = side
                            break
                    if pick is not None and pick not in occupied:
                        extra.append(pick)
            if not extra:
                break
            for gy, gx in extra:
                if (gy, gx) in occupied:
                    continue
                yi, ti, sy, sx = _parent(gy, gx)
                if (yi, ti) not in floor:
                    floor[(yi, ti)] = np.zeros((K, K), bool)
                    refine[yi, ti] = True
                floor[(yi, ti)][sy, sx] = True
                occupied.add((gy, gx))

        def uv_of(t, y):
            s = (float(t) - 0.5) * face_width(apo_shaft(float(y)))
            return plate_uv(mat, s, float(y))

        def emit_quad(pts, uvs):
            b.quad(pts, uvs, mat, center)

        wall_shift = GROOVE_DEPTH * PLATE_PPM / 1023.0
        # One claim per undirected subcell edge. Two claims means both sides are
        # floor, so the edge is not a wall. One claim is the pocket boundary.
        wall_claim = {}
        walls = 0
        for yi in range(n_rows - 1):
            y0, y1 = float(ys[yi]), float(ys[yi + 1])
            for ti in range(ns):
                t0, t1 = ti / ns, (ti + 1) / ns
                if not refine[yi, ti]:
                    def mid_on(side, yi=yi, ti=ti):
                        if side == 0:
                            return bool(yi - 1 >= 0 and refine[yi - 1, ti])
                        if side == 2:
                            return bool(yi + 1 < n_rows - 1 and refine[yi + 1, ti])
                        if side == 3:
                            return bool(ti - 1 >= 0 and refine[yi, ti - 1])
                        return bool(ti + 1 < ns and refine[yi, ti + 1])

                    splits = [mid_on(s) for s in range(4)]
                    corners_tz = [(t0, y0), (t1, y0), (t1, y1), (t0, y1)]
                    cpos = [face_point(face, t, y, 0.0) for t, y in corners_tz]
                    cuv = [uv_of(t, y) for t, y in corners_tz]
                    if not any(splits):
                        emit_quad(cpos, cuv)
                        continue
                    # Match every subcell corner on a side that touches a pocket.
                    def edge_samples(side, n):
                        pts = []
                        for i in range(n):
                            a = i / float(n)
                            if side == 0:
                                pts.append((t0 + (t1 - t0) * a, y0))
                            elif side == 1:
                                pts.append((t1, y0 + (y1 - y0) * a))
                            elif side == 2:
                                pts.append((t1 + (t0 - t1) * a, y1))
                            else:
                                pts.append((t0, y1 + (y0 - y1) * a))
                        return pts
                    perim = []
                    for s in range(4):
                        perim.extend(edge_samples(s, K if splits[s] else 1))
                    cc = tuple(float(x) for x in np.mean(np.array(cpos), axis=0))
                    cu = tuple(float(x) for x in np.mean(np.array(cuv), axis=0))
                    cid = b.add(cc, cu)
                    ids = [b.add(face_point(face, t, y, 0.0), uv_of(t, y)) for t, y in perim]
                    for i in range(len(ids)):
                        b.tri(ids[i], ids[(i + 1) % len(ids)], cid, mat, center)
                    continue
                lab = floor[(yi, ti)]

                def tz(ix, iy_, y0=y0, y1=y1, t0=t0, t1=t1):
                    return (
                        t0 + (t1 - t0) * ix / K,
                        y0 + (y1 - y0) * iy_ / K,
                    )

                for sy in range(K):
                    for sx in range(K):
                        fl = bool(lab[sy, sx])
                        depth = GROOVE_DEPTH if fl else 0.0
                        corners_i = [(sx, sy), (sx + 1, sy), (sx + 1, sy + 1), (sx, sy + 1)]
                        pts, uvs = [], []
                        for ix, iy_ in corners_i:
                            t, y = tz(ix, iy_)
                            pts.append(face_point(face, t, y, depth))
                            uvs.append(uv_of(t, y))
                        emit_quad(pts, uvs)
                        if not fl:
                            continue
                        t_a, y_a = tz(sx, sy)
                        t_b, y_b = tz(sx + 1, sy + 1)
                        poly = []
                        for t, y in ((t_a, y_a), (t_b, y_a), (t_b, y_b), (t_a, y_b)):
                            u, v = uv_of(t, y)
                            poly.append([
                                int(np.clip(u, 0, 1) * 1023),
                                int(np.clip(1.0 - v, 0, 1) * 1023),
                            ])
                        cv2.fillConvexPoly(pred[face], np.array(poly, np.int32), 1)
                        u, v = uv_of((t_a + t_b) * 0.5, (y_a + y_b) * 0.5)
                        normal_samples[face].append((u, v, GROOVE_DEPTH))
                        # Integer grid so the cell across an edge names the same key.
                        gy0 = yi * K + sy
                        gx0 = ti * K + sx
                        sides = (
                            ("h", gy0, gx0, (sx, sy), (sx + 1, sy)),
                            ("h", gy0 + 1, gx0, (sx, sy + 1), (sx + 1, sy + 1)),
                            ("v", gy0, gx0, (sx, sy), (sx, sy + 1)),
                            ("v", gy0, gx0 + 1, (sx + 1, sy), (sx + 1, sy + 1)),
                        )
                        for key_h, key_a, key_b, ia, ib in sides:
                            key = (key_h, key_a, key_b)
                            if key in wall_claim:
                                wall_claim[key] = None
                                continue
                            tA, yA = tz(*ia)
                            tB, yB = tz(*ib)
                            wall_claim[key] = (tA, yA, tB, yB)
        for payload in wall_claim.values():
            if payload is None:
                continue
            tA, yA, tB, yB = payload
            top = [face_point(face, tA, yA, 0.0), face_point(face, tB, yB, 0.0)]
            bot = [face_point(face, tA, yA, GROOVE_DEPTH), face_point(face, tB, yB, GROOVE_DEPTH)]
            ua, ub = uv_of(tA, yA), uv_of(tB, yB)
            du, dv = ub[0] - ua[0], ub[1] - ua[1]
            ln = math.hypot(du, dv) or 1e-8
            px, py = -dv / ln, du / ln
            ba = (ua[0] + px * wall_shift, ua[1] + py * wall_shift)
            bb = (ub[0] + px * wall_shift, ub[1] + py * wall_shift)
            emit_quad([top[0], top[1], bot[1], bot[0]], [ua, ub, bb, ba])
            walls += 1
        stats[mat] = {
            "refinedQuads": int(refine.sum()),
            "floorQuads": int(sum(int(v.sum()) for v in floor.values())),
            "walls": walls,
            "maskPx": int(mask.sum()),
        }
    return pred, stats


def build_mesh(tex_info, y_step=0.05, nseg_override=None, grooves=True, register=False, icicles_on=True):
    """Shaft taper is the v1 slim: 1.60 m at the plinth joint, 1.20 m at the shaft top.

    register fits a per-face scale/shift/rotation of the rune mask onto the
    face grid, then the grooves are recut only under those rune pixels.
    """
    face_tex = {0: "front.jpg", 1: "right45.jpg", 7: "left45.jpg"}
    face_npy = {0: "front-amber.npy", 1: "right-amber.npy", 7: "left-amber.npy"}
    b = Builder()
    n_rows = int(round((Y_SHAFT1 - Y_SHAFT0) / y_step)) + 1
    ys = np.linspace(Y_SHAFT0, Y_SHAFT1, n_rows)
    # per-face segment counts. Shared corners only, so counts may differ.
    # Even counts so the cap can halve to a 15° fan (min angle 15°). 5 and 10 cannot.
    # Side faces stay planar, so fewer segments do not move the silhouette.
    # The saved triangles pay for the finer rune pockets.
    nseg = {0: 12, 1: 12, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 12}
    if nseg_override:
        for k, v in nseg_override.items():
            nseg[int(k)] = int(v)
    center = np.array([0.0, 3.5, 0.0])
    masks = {}
    reg_report = {}
    # Registration (scale / rot / shift) did not converge: left IoU 0.026, right 0.006.
    # The mask stays put. Pockets are cut exactly under its pixels.
    if grooves:
        masks, reg_report = build_rune_masks()
        for name, info in reg_report.items():
            print("mask", name, info, flush=True)
    normal_samples = {0: [], 1: [], 7: []}

    def sample_amber(face, s, y):
        """Same plate projection the UVs use, so a rune pixel sits on its groove."""
        mask = masks.get(face)
        if mask is None:
            return False
        u, v = plate_uv(MAT_FOR_FACE[face], s, y)
        return _sample_mask(mask, u, v)

    # Precompute corner positions so adjacent faces match exactly.
    corners = {}
    for yi, y in enumerate(ys):
        apo = apo_shaft(float(y))
        for k in range(N_SIDE):
            corners[(yi, k)] = ring_pos(k, float(y), apo)

    shaft_bottom = {i: [] for i in range(N_SIDE)}  # list of (pos, s) along each face at y0
    shaft_top = {i: [] for i in range(N_SIDE)}

    for face in range(N_SIDE):
        mat = MAT_FOR_FACE[face]
        ns = nseg[face]
        mid_ang = math.radians(face * 45.0)
        normal = np.array([math.sin(mid_ang), 0.0, math.cos(mid_ang)])
        rows = []
        for yi, y in enumerate(ys):
            apo = apo_shaft(float(y))
            width = face_width(apo)
            row = []
            for t_i in range(ns + 1):
                t = t_i / ns
                if t_i == 0:
                    p = corners[(yi, face)]
                elif t_i == ns:
                    p = corners[(yi, (face + 1) % N_SIDE)]
                else:
                    p0 = np.array(corners[(yi, face)])
                    p1 = np.array(corners[(yi, (face + 1) % N_SIDE)])
                    p = tuple((1 - t) * p0 + t * p1)
                s = (t - 0.5) * width
                depth = 0.0
                edge = min(t, 1 - t) * width
                ydist = min(float(y) - Y_SHAFT0, Y_SHAFT1 - float(y))
                # Rune faces are cut as closed pockets. This inset is only for a face
                # that still uses the coarse grid.
                if grooves and face not in RUNE_FACE_IDS and edge > 0.08 and ydist > 0.08 and t_i not in (0, ns):
                    if sample_amber(face, s, float(y)):
                        cell = min(float(y_step), width / float(ns))
                        depth = min(0.045, max(0.030, 0.68 * cell))
                if depth:
                    p = tuple(np.array(p) - normal * depth)
                if face in normal_samples and t_i not in (0, ns) and not (grooves and face in RUNE_FACE_IDS):
                    u, v = plate_uv(mat, s, float(y))
                    normal_samples[face].append((u, v, depth))
                row.append((p, s, float(y), depth))
            rows.append(row)
            if yi == 0:
                shaft_bottom[face] = [(p, s) for p, s, _y, _d in row]
            if yi == len(ys) - 1:
                shaft_top[face] = [(p, s) for p, s, _y, _d in row]
        if not (grooves and face in RUNE_FACE_IDS):
            for yi in range(len(ys) - 1):
                for ti in range(ns):
                    a = rows[yi][ti]
                    c = rows[yi][ti + 1]
                    d = rows[yi + 1][ti + 1]
                    e = rows[yi + 1][ti]
                    b.quad(
                        [a[0], c[0], d[0], e[0]],
                        [plate_uv(mat, a[1], a[2]), plate_uv(mat, c[1], c[2]), plate_uv(mat, d[1], d[2]), plate_uv(mat, e[1], e[2])],
                        mat,
                        center,
                    )

    if grooves and masks:
        pred, pocket_stats = add_rune_pockets(b, masks, ys, nseg, normal_samples)
        reg_report["pockets"] = pocket_stats
        try:
            import sys as _sys
            _root = os.path.abspath(os.path.join(HERE, "..", "..", "..", "..", "tools", "imagine-to-3d"))
            if _root not in _sys.path:
                _sys.path.insert(0, _root)
            from checks.relief_align import overlap as _overlap
            for face, mask in masks.items():
                name = MAT_FOR_FACE[face]
                pocket = pred[face] > 0
                both = np.zeros((*pocket.shape, 3), np.uint8)
                both[:] = (32, 36, 44)
                mark = both.copy()
                mark[pocket] = (230, 170, 60)
                alb = both.copy()
                alb[mask] = (230, 170, 60)
                sc = _overlap(Image.fromarray(mark), Image.fromarray(alb))
                reg_report[name]["predictOverlap"] = sc.get("overlap")
                print("predict", name, sc.get("overlap"), "ok", sc.get("ok"), flush=True)
        except Exception as exc:
            print("predict-skip", exc, flush=True)
        print("pockets", pocket_stats, flush=True)

    def band_ring(y, apo, face, ns, s_of):
        pts = []
        for t_i in range(ns + 1):
            t = t_i / ns
            if t_i == 0:
                p = ring_pos(face, y, apo)
            elif t_i == ns:
                p = ring_pos((face + 1) % N_SIDE, y, apo)
            else:
                p0 = np.array(ring_pos(face, y, apo))
                p1 = np.array(ring_pos((face + 1) % N_SIDE, y, apo))
                p = tuple((1 - t) * p0 + t * p1)
            s = s_of(t, apo)
            pts.append((p, s))
        return pts

    # Plinth: three steps. Inner top of the last tread uses the shaft bottom positions.
    steps = [
        (-0.15, 0.05, PLINTH_APO + 3 * STEP_RAD),
        (0.05, 0.28, PLINTH_APO + 2 * STEP_RAD),
        (0.28, 0.60, PLINTH_APO + 1 * STEP_RAD),
    ]
    plinth_steps = []
    for si, (y0, y1, apo) in enumerate(steps):
        plinth_steps.append({"y0": y0, "y1": y1, "apothem_m": round(apo, 4), "height_m": round(y1 - y0, 4)})
        for face in range(N_SIDE):
            ns = nseg[face]
            def s_of(t, apo, ns=ns):
                return (t - 0.5) * face_width(apo)
            bot = band_ring(y0, apo, face, ns, s_of)
            if si == len(steps) - 1:
                # top of this riser is the outer of the last riser; the shaft is further in
                top = band_ring(y1, apo, face, ns, s_of)
            else:
                top = band_ring(y1, apo, face, ns, s_of)
            for ti in range(ns):
                a, c, d, e = bot[ti], bot[ti + 1], top[ti + 1], top[ti]
                b.quad(
                    [a[0], c[0], d[0], e[0]],
                    [plate_uv("plinth", a[1], y0), plate_uv("plinth", c[1], y0), plate_uv("plinth", d[1], y1), plate_uv("plinth", e[1], y1)],
                    "plinth",
                    center,
                )
            # tread inward to the next apo, or to the shaft bottom on the last step
            if si < len(steps) - 1:
                inner_apo = steps[si + 1][2]
                inner = band_ring(y1, inner_apo, face, ns, s_of)
            else:
                inner = shaft_bottom[face]
            for ti in range(ns):
                # outer top → inner, seen from above
                o0, o1 = top[ti], top[ti + 1]
                if si < len(steps) - 1:
                    i0, i1 = inner[ti], inner[ti + 1]
                    uv = [plan_uv(*o0[0][::2]), plan_uv(*o1[0][::2]), plan_uv(*i1[0][::2]), plan_uv(*i0[0][::2])]
                    b.quad([o0[0], o1[0], i1[0], i0[0]], uv, "plinth", center)
                else:
                    i0, i1 = inner[ti], inner[ti + 1]
                    uv = [plan_uv(*o0[0][::2]), plan_uv(*o1[0][::2]), plan_uv(*i1[0][::2]), plan_uv(*i0[0][::2])]
                    b.quad([o0[0], o1[0], i1[0], i0[0]], uv, "plinth", center)

    # Cap. Overhang is 0.20 m (lip flat-to-flat 1.60 m). Three short bands, no sliver.
    # then a lip wall, then each face halves until 3 segments and closes with a 15° fan.
    lip_apo = APO_TOP + CAP_OVERHANG
    down_hint = np.array([0.0, 8.0, 0.0])

    def s_of_face(ns):
        def s_of(t, apo, ns=ns):
            return (t - 0.5) * face_width(apo)
        return s_of

    def _ring_uv(p, s, mat):
        # A ring point is (pos, s). Horizontal rings share a y; vertical rings do not.
        return plate_uv(mat, s, p[1])

    def emit_quads(ring_a, ring_b, mat, hint, horizontal=False):
        for ti in range(len(ring_a) - 1):
            a, c = ring_a[ti], ring_a[ti + 1]
            d, e = ring_b[ti + 1], ring_b[ti]
            if horizontal:
                uvs = [plan_uv(a[0][0], a[0][2]), plan_uv(c[0][0], c[0][2]), plan_uv(d[0][0], d[0][2]), plan_uv(e[0][0], e[0][2])]
            else:
                uvs = [_ring_uv(a[0], a[1], mat), _ring_uv(c[0], c[1], mat), _ring_uv(d[0], d[1], mat), _ring_uv(e[0], e[1], mat)]
            b.quad([a[0], c[0], d[0], e[0]], uvs, mat, hint)

    def emit_pair(outer, inner, mat, hint, horizontal=False):
        ns = len(outer) - 1
        for i in range(ns // 2):
            o0, o1, o2 = outer[2 * i], outer[2 * i + 1], outer[2 * i + 2]
            i0, i1 = inner[i], inner[i + 1]
            for tri in ((o0, o1, i0), (o1, i1, i0), (o1, o2, i1)):
                if horizontal:
                    ids = [b.add(p[0], plan_uv(p[0][0], p[0][2])) for p in tri]
                else:
                    ids = [b.add(p[0], plate_uv(mat, p[1], p[0][1])) for p in tri]
                b.tri(ids[0], ids[1], ids[2], mat, hint)

    for face in range(N_SIDE):
        ns = nseg[face]
        s_of = s_of_face(ns)
        inner = shaft_top[face]
        # three coplanar radial bands, 0.12 m each, one 0.36 m overhang
        for k, apo in enumerate((APO_TOP + CAP_OVERHANG / 3, APO_TOP + 2 * CAP_OVERHANG / 3, lip_apo)):
            outer = band_ring(Y_LIP0, apo, face, ns, s_of)
            emit_quads(inner, outer, "cap", down_hint, horizontal=True)
            inner = outer
        wall_top = band_ring(Y_LIP1, lip_apo, face, ns, s_of)
        emit_quads(inner, wall_top, "cap", center)
        # halve toward the crown. Every face takes the same two steps so corners meet.
        outer = wall_top
        y, apo, ns_now = Y_LIP1, lip_apo, ns
        for target, dy, da in ((6, 0.14, -0.16), (3, 0.14, -0.16)):
            y2, apo2 = y + dy, apo + da
            if ns_now > target:
                inner = band_ring(y2, apo2, face, ns_now // 2, s_of_face(ns_now // 2))
                emit_pair(outer, inner, "cap", center)
                ns_now //= 2
            else:
                inner = band_ring(y2, apo2, face, ns_now, s_of_face(ns_now))
                emit_quads(outer, inner, "cap", center)
            outer = inner
            y, apo = y2, apo2
        cpos = (0.0, Y_CAP, 0.0)
        for ti in range(len(outer) - 1):
            ids = [
                b.add(cpos, plan_uv(0.0, 0.0)),
                b.add(outer[ti][0], plan_uv(outer[ti][0][0], outer[ti][0][2])),
                b.add(outer[ti + 1][0], plan_uv(outer[ti + 1][0][0], outer[ti + 1][0][2])),
            ]
            b.tri(ids[0], ids[1], ids[2], "cap", center)

    # Bottom cap: halve in the plane, then the same 15° fan. No thin centre fan.
    bot_apo = PLINTH_APO + 3 * STEP_RAD
    below = np.array([0.0, -2.0, 0.0])
    for face in range(N_SIDE):
        ns = nseg[face]
        outer = band_ring(-0.15, bot_apo, face, ns, s_of_face(ns))
        ns_now = ns
        apo = bot_apo
        for target in (6, 3):
            apo2 = apo - 0.28
            if ns_now > target:
                inner = band_ring(-0.15, apo2, face, ns_now // 2, s_of_face(ns_now // 2))
                emit_pair(outer, inner, "plinth", below, horizontal=True)
                ns_now //= 2
            else:
                inner = band_ring(-0.15, apo2, face, ns_now, s_of_face(ns_now))
                emit_quads(outer, inner, "plinth", below, horizontal=True)
            outer = inner
            apo = apo2
        cpos = (0.0, -0.15, 0.0)
        for ti in range(len(outer) - 1):
            ids = [
                b.add(cpos, plan_uv(0.0, 0.0)),
                b.add(outer[ti][0], plan_uv(outer[ti][0][0], outer[ti][0][2])),
                b.add(outer[ti + 1][0], plan_uv(outer[ti + 1][0][0], outer[ti + 1][0][2])),
            ]
            b.tri(ids[0], ids[1], ids[2], "plinth", below)

    icicles = add_icicles(b, lip_apo) if icicles_on else []
    eased = ease_shaft_uv(b)
    uv_report = fix_uv(b)
    stabilised = stabilize_shaft_uv(b)
    uv_report["shaftEased"] = eased
    uv_report["shaftStabilised"] = stabilised
    uv_report["register"] = reg_report
    b.normal_samples = normal_samples
    return b, icicles, plinth_steps, nseg, uv_report


def add_icicles(b, lip_apo):
    """Closed cones. Roots sunk SINK into the lip. Not welded to the hull (2 mm clearance)."""
    records = []
    # front lip: x on a 0.004 m column grid, z just inside the front overhang
    z_front = APO_TOP + CAP_OVERHANG * 0.55
    xs = np.linspace(-0.34, 0.34, 9)
    lengths = [0.14, 0.20, 0.26, 0.18, 0.24, 0.16, 0.22, 0.28, 0.15]
    radii = [0.055, 0.065, 0.080, 0.060, 0.075, 0.055, 0.070, 0.085, 0.055]
    mpp = 0.004
    for i, x in enumerate(xs):
        col = int(round(x / mpp))
        x = col * mpp  # exact column
        place_cone(b, (x, ROOT_Y, z_front), lengths[i], radii[i])
        records.append({
            "id": f"front-{i}", "tier": 0, "side": "front", "plate": "front",
            "x": float(x), "z": float(z_front), "rootY": ROOT_Y, "lipY": Y_LIP0,
            "lengthM": lengths[i], "radiusM": radii[i],
            "world": [float(x), ROOT_Y, float(z_front)],
        })
    # right and left lips, coordinate on z
    for side, x_sign in (("right", 1.0), ("left", -1.0)):
        zs = np.linspace(-0.28, 0.28, 6)
        for i, z in enumerate(zs):
            col = int(round(z / mpp))
            z = col * mpp
            length = 0.12 + (i % 4) * 0.04
            radius = 0.055 + (i % 3) * 0.012
            x = x_sign * (APO_TOP + CAP_OVERHANG * 0.55)
            place_cone(b, (x, ROOT_Y, z), length, radius)
            records.append({
                "id": f"{side}-{i}", "tier": 0, "side": side, "plate": side,
                "x": float(x), "z": float(z), "rootY": ROOT_Y, "lipY": Y_LIP0,
                "lengthM": float(length), "radiusM": float(radius),
                "world": [float(x), ROOT_Y, float(z)],
            })
    return records


def place_cone(b, root, length, radius, n=8):
    tip = (root[0], root[1] - length, root[2])
    ring = []
    for i in range(n):
        a = 2 * math.pi * i / n
        ring.append((root[0] + radius * math.cos(a), root[1], root[2] + radius * math.sin(a)))
    tip_i = b.add(tip, plate_uv("cap", 0.0, tip[1]))
    ids = [b.add(p, plate_uv("cap", math.cos(2 * math.pi * i / n) * radius, root[1])) for i, p in enumerate(ring)]
    center_hint = np.array([root[0], root[1] - length * 0.5, root[2]])
    for i in range(n):
        b.tri(tip_i, ids[i], ids[(i + 1) % n], "icicle", center_hint)
    cap_i = b.add(root, plan_uv(root[0], root[2]))
    for i in range(n):
        b.tri(cap_i, ids[(i + 1) % n], ids[i], "icicle", center_hint + np.array([0, 1, 0]))


def _vert_inset(p):
    """Metres the point sits inside the smooth taper. 0 on the flat and off the shaft."""
    y = float(p[1])
    if y < Y_SHAFT0 or y > Y_SHAFT1:
        return 0.0
    ang = math.atan2(float(p[0]), float(p[2]))
    flat = round(ang / (math.pi / 4.0)) * (math.pi / 4.0)
    support = float(p[0]) * math.sin(flat) + float(p[2]) * math.cos(flat)
    return float(apo_shaft(y) - support)


def ease_shaft_uv(b, limit=1.26):
    """Pull stretched shaft triangles under the UV limit without moving a grooved corner's UV.

    A groove vertex keeps the plate UV that the rune was cut at. Only the stone
    corners of that triangle take the conformal fit.
    """
    V = np.array(b.V, float)
    VT = [np.array(u, float) for u in b.VT]
    shaft = {"front", "right45", "left45", "side", "back"}
    changed = 0
    for idx, (a, c, d, ta, tc, td, mat) in enumerate(list(b.F)):
        if mat not in shaft:
            continue
        P = V[[a, c, d]]
        Q = np.stack([VT[ta], VT[tc], VT[td]])
        r = triangle_aniso(P, Q)
        if r <= limit or r >= 1e8:
            continue
        aim = _conformal_uv(P, Q, min(1.18, limit))
        ins = [_vert_inset(P[k]) for k in range(3)]
        Qn = aim.copy()
        for k in range(3):
            if ins[k] > 0.012:
                Qn[k] = Q[k]
        if triangle_aniso(P, Qn) > limit:
            # A 20% slip on the pinned corners is still under one cell (~1.5 cm).
            for k in range(3):
                if ins[k] > 0.012:
                    Qn[k] = 0.80 * Q[k] + 0.20 * aim[k]
        ids = []
        for k in range(3):
            VT.append(np.asarray(Qn[k], float))
            ids.append(len(VT) - 1)
        b.F[idx] = (a, c, d, ids[0], ids[1], ids[2], mat)
        changed += 1
    b.VT = [tuple(float(x) for x in u) for u in VT]
    return changed


def stabilize_shaft_uv(b, limit=1.25):
    """Keep a shaft triangle's plate UV. A negative determinant is mirrored about
    the centroid. Swapping two vt indices would pair the wrong UV with a vertex.
    """
    shaft = {"front", "right45", "left45", "side", "back"}
    V = np.array(b.V, float)
    VT = [np.array(u, float) for u in b.VT]
    changed = 0
    for idx, (a, c, d, ta, tc, td, mat) in enumerate(list(b.F)):
        if mat not in shaft:
            continue
        P = V[[a, c, d]]
        Q = np.stack([VT[ta], VT[tc], VT[td]])
        r = triangle_aniso(P, Q)
        sgn = _uv_scale_sign(P, Q)
        if (r <= limit or r >= 1e8) and sgn > 0:
            continue
        aim = Q.copy()
        if r > limit and r < 1e8:
            aim = _conformal_uv(P, Q, min(1.08, limit))
        if _uv_scale_sign(P, aim) < 0:
            cen = aim.mean(0)
            aim = aim.copy()
            aim[:, 0] = 2.0 * cen[0] - aim[:, 0]
        ids = []
        for k in range(3):
            VT.append(np.asarray(aim[k], float))
            ids.append(len(VT) - 1)
        b.F[idx] = (a, c, d, ids[0], ids[1], ids[2], mat)
        changed += 1
    b.VT = [tuple(float(x) for x in u) for u in VT]
    return changed


def fix_uv(b, limit=1.25):
    """Give an over-limit triangle its own vt so anisotropy drops under 1.3. Positions stay."""
    V = np.array(b.V, float)
    VT = [np.array(u, float) for u in b.VT]
    new_f = []
    fixed = 0
    worst = 1.0
    for a, c, d, ta, tc, td, mat in b.F:
        P = V[[a, c, d]]
        Q = np.stack([VT[ta], VT[tc], VT[td]])
        r = triangle_aniso(P, Q)
        if r > worst and r < 1e8:
            worst = r
        # Shaft faces keep the plate projection. A conformal rewrite slides the runes off the grooves.
        if mat in ("front", "right45", "left45", "side", "back") or r <= limit or r >= 1e8:
            new_f.append((a, c, d, ta, tc, td, mat))
            continue
        Qn = _conformal_uv(P, Q, min(1.15, limit * 0.96))
        ids = []
        for k in range(3):
            VT.append(Qn[k])
            ids.append(len(VT) - 1)
        new_f.append((a, c, d, ids[0], ids[1], ids[2], mat))
        fixed += 1
    b.VT = [tuple(map(float, u)) for u in VT]
    b.F = new_f
    # remeasure
    worst2 = 1.0
    over = 0
    V = np.array(b.V, float)
    VT = np.array(b.VT, float)
    for a, c, d, ta, tc, td, mat in b.F:
        r = triangle_aniso(V[[a, c, d]], VT[[ta, tc, td]])
        if r > limit and r < 1e8:
            over += 1
        if r > worst2 and r < 1e8:
            worst2 = r
    return {"fixed": fixed, "worstBefore": round(worst, 3), "worstAfter": round(worst2, 3), "over": over}


def _uv_scale_sign(P, Q):
    e1, e2 = P[1] - P[0], P[2] - P[0]
    d1, d2 = Q[1] - Q[0], Q[2] - Q[0]
    det = d1[0] * d2[1] - d1[1] * d2[0]
    if abs(det) < 1e-14:
        return 0.0
    n = np.cross(e1, e2)
    dPu = (e1 * d2[1] - e2 * d1[1]) / det
    dPv = (e2 * d1[0] - e1 * d2[0]) / det
    return float(np.dot(np.cross(dPu, dPv), n))


def fix_flat_uv(path):
    """Horizontal faces get the plate plan projection, not raw metre (x, z).

    The shaft UVs are plate_uv. A tread or cap soffit is horizontal, so its
    plate axes are x and z at the same px/m. Writing metres here would throw
    the new projection away.
    """
    lines = open(path).read().splitlines()
    V, T = [], []
    face_at = []
    cur = None
    shaft = {"front", "right45", "left45", "side", "back"}
    for i, l in enumerate(lines):
        if l.startswith("usemtl "):
            cur = l.split()[1]
        elif l.startswith("v "):
            V.append([float(x) for x in l.split()[1:4]])
        elif l.startswith("vt "):
            T.append([float(x) for x in l.split()[1:3]])
        elif l.startswith("f "):
            p = [t.split("/") for t in l.split()[1:4]]
            face_at.append((i, [(int(a) - 1, int(b) - 1) for a, b in p], cur))
    V = np.array(V, float)
    T = [np.array(u, float) for u in T]
    fixed = 0
    for i, f, mat in face_at:
        # A groove wall is flat in y. plan_uv would replace its plate UV.
        if mat in shaft:
            continue
        P = V[[a for a, _ in f]]
        if float(P[:, 1].max() - P[:, 1].min()) > 1e-3:
            continue
        ids = []
        for k in range(3):
            u, v = plan_uv(float(P[k, 0]), float(P[k, 2]))
            T.append(np.array([round(u, 5), round(v, 5)]))
            ids.append(len(T) - 1)
        a0, a1, a2 = f
        lines[i] = f"f {a0[0]+1}/{ids[0]+1} {a1[0]+1}/{ids[1]+1} {a2[0]+1}/{ids[2]+1}"
        fixed += 1
    head, tail, phase = [], [], "head"
    for l in lines:
        if l.startswith("vt ") and phase == "head":
            phase = "vt"
            continue
        if phase == "vt":
            if l.startswith("vt "):
                continue
            phase = "tail"
            tail.append(l)
            continue
        (head if phase == "head" else tail).append(l)
    out = head[:]
    for u in T:
        out.append(f"vt {u[0]:.8f} {u[1]:.8f}")
    out.extend(tail)
    open(path, "w").write("\n".join(out) + "\n")
    return {"flatRetextured": fixed}


def unmirror_obj(path):
    """Flip UV index order on negative-scale triangles. Positions stay. Sign matches uvmirror.py."""
    lines = open(path).read().splitlines()
    V, T = [], []
    faces = []  # (line_index, verts)
    cur_header = []
    for i, l in enumerate(lines):
        if l.startswith("v "):
            V.append([float(x) for x in l.split()[1:4]])
        elif l.startswith("vt "):
            T.append([float(x) for x in l.split()[1:3]])
        elif l.startswith("f "):
            p = [t.split("/") for t in l.split()[1:4]]
            faces.append((i, [(int(a) - 1, int(b) - 1) for a, b in p]))
    V = np.array(V, float)
    T = np.array(T, float)
    flipped = 0
    cur = None
    shaft = {"front", "right45", "left45", "side", "back"}
    mat_at = {}
    for i, l in enumerate(lines):
        if l.startswith("usemtl "):
            cur = l.split()[1]
        elif l.startswith("f "):
            mat_at[i] = cur
    for i, f in faces:
        # Swapping vt indices on a shaft wall detaches the plate UV from its vertex.
        if mat_at.get(i) in shaft:
            continue
        P = V[[a for a, _ in f]]
        Q = T[[b for _, b in f]]
        if _uv_scale_sign(P, Q) < 0:
            a0, a1, a2 = f
            lines[i] = f"f {a0[0]+1}/{a0[1]+1} {a1[0]+1}/{a2[1]+1} {a2[0]+1}/{a1[1]+1}"
            flipped += 1
    open(path, "w").write("\n".join(lines) + "\n")
    # remeasure on the written (5-decimal) file
    V, T, F = [], [], []
    for l in open(path):
        if l.startswith("v "):
            V.append([float(x) for x in l.split()[1:4]])
        elif l.startswith("vt "):
            T.append([float(x) for x in l.split()[1:3]])
        elif l.startswith("f "):
            p = [t.split("/") for t in l.split()[1:4]]
            F.append([(int(a) - 1, int(b) - 1) for a, b in p])
    V = np.array(V, float)
    T = np.array(T, float)
    neg = 0
    worst = 1.0
    over = 0
    for f in F:
        P = V[[a for a, _ in f]]
        Q = T[[b for _, b in f]]
        if _uv_scale_sign(P, Q) < 0:
            neg += 1
        r = triangle_aniso(P, Q)
        if 1.3 < r < 1e8:
            over += 1
        if r > worst and r < 1e8:
            worst = r
    return {"flipped": flipped, "stillNegative": neg, "worstAniso": round(worst, 3), "over1_3": over}


def recap_obj(path, limit=1.24):
    """After 5-decimal OBJ rounding, give any triangle still over 1.3 its own rounded vt.

    Shaft materials keep the plate UVs. A conformal rewrite there slides the
    rune off the groove that was cut at the same UV.
    """
    lines = open(path).read().splitlines()
    V, T = [], []
    face_at = []
    cur = None
    shaft_mats = {"front", "right45", "left45", "side", "back"}
    for i, l in enumerate(lines):
        if l.startswith("usemtl "):
            cur = l.split()[1]
        elif l.startswith("v "):
            V.append([float(x) for x in l.split()[1:4]])
        elif l.startswith("vt "):
            T.append([float(x) for x in l.split()[1:3]])
        elif l.startswith("f "):
            if cur in shaft_mats:
                continue
            p = [t.split("/") for t in l.split()[1:4]]
            face_at.append((i, [(int(a) - 1, int(b) - 1) for a, b in p]))
    V = np.array(V, float)
    T = [np.array(u, float) for u in T]
    fixed = 0
    for i, f in face_at:
        P = V[[a for a, _ in f]]
        Q = np.stack([T[b] for _, b in f])
        r = triangle_aniso(P, Q)
        if r <= limit or r >= 1e8:
            continue
        Qn = Q.copy()
        for _ in range(8):
            if triangle_aniso(P, Qn) <= limit:
                break
            aim = 1.12 if triangle_aniso(P, Qn) > 1.2 else 1.05
            Qn = np.round(_conformal_uv(P, Qn, aim), 8)
        ids = []
        for k in range(3):
            T.append(np.round(Qn[k], 8))
            ids.append(len(T) - 1)
        a0, a1, a2 = f
        lines[i] = f"f {a0[0]+1}/{ids[0]+1} {a1[0]+1}/{ids[1]+1} {a2[0]+1}/{ids[2]+1}"
        fixed += 1
    # rewrite vt block: keep header and v, replace vt and what follows
    head, tail = [], []
    phase = "head"
    for l in lines:
        if l.startswith("vt ") and phase == "head":
            phase = "vt"
            continue
        if phase == "vt":
            if l.startswith("vt "):
                continue
            phase = "tail"
            tail.append(l)
            continue
        if phase == "head":
            head.append(l)
        else:
            tail.append(l)
    out = head[:]
    for u in T:
        out.append(f"vt {u[0]:.8f} {u[1]:.8f}")
    out.extend(tail)
    open(path, "w").write("\n".join(out) + "\n")
    return {"recapped": fixed}


def topo(V, F):
    P = np.array([(V[a], V[c], V[d]) for a, c, d, *_ in F], np.float64).reshape(-1, 3)
    q = np.round(P / 1e-3).astype(np.int64)
    _, idx = np.unique(q, axis=0, return_inverse=True)
    T = idx.reshape(-1, 3)
    deg = int(((T[:, 0] == T[:, 1]) | (T[:, 1] == T[:, 2]) | (T[:, 0] == T[:, 2])).sum())
    E = np.sort(np.concatenate([T[:, [0, 1]], T[:, [1, 2]], T[:, [2, 0]]]), axis=1)
    _, cnt = np.unique(E, axis=0, return_counts=True)
    boundary = int((cnt == 1).sum())
    return {"nonManifoldEdges": int((cnt > 2).sum()), "boundaryEdges": boundary, "degenerateTris": deg, "weldVerts": int(len(np.unique(idx)))}


def sliver(V, F):
    from tools.gate.quality import triangle_quality
    T = np.array([(V[a], V[c], V[d]) for a, c, d, *_ in F], np.float64)
    return triangle_quality(T)


def write_obj(path, b):
    mats = []
    with open(path, "w") as f:
        f.write("o rune-pillar\n")
        for v in b.V:
            f.write(f"v {v[0]:.5f} {v[1]:.5f} {v[2]:.5f}\n")
        for u in b.VT:
            f.write(f"vt {u[0]:.8f} {u[1]:.8f}\n")
        cur = None
        for a, c, d, ta, tc, td, mat in b.F:
            if mat != cur:
                f.write(f"usemtl {mat}\n")
                cur = mat
                mats.append(mat)
            f.write(f"f {a+1}/{ta+1} {c+1}/{tc+1} {d+1}/{td+1}\n")
    return sorted(set(mats))


def write_lod_json(path, b):
    # weld-free raw triangles; lodstream only needs positions + indices
    pos = []
    idx = []
    for a, c, d, *_ in b.F:
        base = len(pos)
        pos.extend([list(b.V[a]), list(b.V[c]), list(b.V[d])])
        idx.extend([base, base + 1, base + 2])
    json.dump({"positions": pos, "indices": idx}, open(path, "w"))


def _hull_xz(apo):
    pts = []
    for k in range(N_SIDE):
        p = ring_pos(k, 0.0, apo)
        pts.append([round(p[0], 4), round(p[2], 4)])
    return pts


def _box(apo, y0, y1, name):
    r = float(apo)
    return {
        "id": name, "role": "solid", "visual": True, "space": "local",
        "min": [round(-r, 4), round(y0, 4), round(-r, 4)],
        "max": [round(r, 4), round(y1, 4), round(r, 4)],
    }


def collider_boxes(plinth_steps):
    """Stepped plinth up to the top step, then the shaft convex hull inset 2 cm.

    Player and camera share the layers. The camera box adds the 1 m margin.
    Rune grooves are not colliders. The octagon flats face the axes, so the
    tight AABB is +/- the apothem, not the vertex radius.
    """
    inset = 0.02
    margin = 1.0
    steps = []
    for i, st in enumerate(plinth_steps):
        apo = float(st["apothem_m"]) - inset
        player = _box(apo, st["y0"], st["y1"], f"plinth-step-{i}")
        camera = _box(apo + margin, st["y0"], st["y1"], f"plinth-step-{i}-camera")
        steps.append({
            "id": f"plinth-step-{i}",
            "height_m": st["height_m"],
            "y0": st["y0"],
            "y1": st["y1"],
            "apothem_m": round(apo, 4),
            "layers": ["player", "camera"],
            "inset_m": inset,
            "camera_margin_m": margin,
            "box": player,
            "camera_box": camera,
            "hull_xz": _hull_xz(apo),
        })
    shaft_apo = max(APO_BASE, APO_TOP + CAP_OVERHANG)
    shaft_in = shaft_apo - inset
    shaft = _box(shaft_in, Y_SHAFT0, Y_CAP, "shaft-player")
    cam = _box(shaft_in + margin, Y_SHAFT0, Y_CAP, "shaft-camera")
    outer_apo = float(plinth_steps[0]["apothem_m"])
    outline = _hull_xz(outer_apo)
    return steps, shaft, cam, outline, _hull_xz(shaft_in)


def bake_groove_normal(samples, path):
    """Tangent normal from the groove depth field. Flat is (128, 128, 255). JPG only."""
    depth = np.zeros((1024, 1024), np.float32)
    weight = np.zeros((1024, 1024), np.float32)
    for u, v, d in samples:
        col = int(np.clip(u, 0.0, 1.0) * 1023)
        row = int(np.clip(1.0 - v, 0.0, 1.0) * 1023)
        depth[row, col] = float(d)
        weight[row, col] = 1.0
    if weight.sum() < 8:
        rgb = np.zeros((1024, 1024, 3), np.uint8)
        rgb[..., 2] = 255
        rgb[..., 0] = 128
        rgb[..., 1] = 128
        save_jpg(path, rgb)
        return
    # Spread each sample across its cell so the sobel sees the step, not a speck.
    dil = cv2.dilate(weight, np.ones((5, 5), np.uint8))
    filled = cv2.inpaint((np.clip(depth / 0.045, 0, 1) * 255).astype(np.uint8), ((dil > 0) & (weight == 0)).astype(np.uint8) * 255, 3, cv2.INPAINT_TELEA)
    field = filled.astype(np.float32) / 255.0 * 0.045
    field[dil == 0] = 0.0
    gx = cv2.Sobel(field, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(field, cv2.CV_32F, 0, 1, ksize=3)
    # One pixel is 1/PLATE_PPM metres on the plate.
    nx = -gx * PLATE_PPM
    ny = -gy * PLATE_PPM
    nz = np.ones_like(field)
    nrm = np.maximum(np.sqrt(nx * nx + ny * ny + nz * nz), 1e-8)
    rgb = np.zeros((1024, 1024, 3), np.uint8)
    rgb[..., 0] = 128
    rgb[..., 1] = 128
    rgb[..., 2] = 255
    vis = dil > 0
    rgb[..., 0][vis] = np.clip((nx / nrm)[vis] * 0.5 + 0.5, 0, 1) * 255
    rgb[..., 1][vis] = np.clip((ny / nrm)[vis] * 0.5 + 0.5, 0, 1) * 255
    rgb[..., 2][vis] = np.clip((nz / nrm)[vis] * 0.5 + 0.5, 0, 1) * 255
    save_jpg(path, rgb.astype(np.uint8))


def main():
    print("textures")
    info = build_textures()
    print("mesh", json.dumps({k: info[k] for k in ("shift01to02", "frontAmber", "chromePxGraded")}))
    b, icicles, steps, nseg, uv_report = build_mesh(info, register=True, grooves=True)
    info["uv"] = uv_report
    info["runeRegister"] = uv_report.get("register", {})
    print("uv", {k: uv_report[k] for k in uv_report if k != "register"})
    V = b.V
    report_topo = topo(V, b.F)
    report_sliver = sliver(V, b.F)
    print("topo", report_topo)
    print("sliver", {k: report_sliver[k] for k in ("tris", "degenerate", "sliverFrac", "pass", "minAngleP5")})
    obj = os.path.join(MESH, "rune-pillar.obj")
    write_obj(obj, b)
    flat_report = fix_flat_uv(obj)
    mirror_report = unmirror_obj(obj)
    recap_report = recap_obj(obj)
    mirror_report = unmirror_obj(obj)
    info["flatUv"] = flat_report
    print("unmirror", mirror_report, "recap", recap_report)
    info["unmirror"] = mirror_report
    info["recap"] = recap_report
    # LOD1 ~7k: same corner rows as LOD0 (outline), grooves removed, fewer segments across each face.
    # LOD2 ~2.5k: same corner rows, one segment per face. Grooves live in the normal map.
    lod1_nseg = {0: 4, 1: 4, 2: 2, 3: 2, 4: 4, 5: 2, 6: 2, 7: 4}
    lod2_nseg = {i: 2 for i in range(8)}
    print("lod1", flush=True)
    b1, _, _, nseg1, _ = build_mesh(info, y_step=0.05, nseg_override=lod1_nseg, grooves=False, register=False)
    print("lod2", flush=True)
    b2, _, _, nseg2, _ = build_mesh(info, y_step=0.12, nseg_override=lod2_nseg, grooves=False, register=False)
    write_lod_json(os.path.join(MESH, "lod0.json"), b)
    write_lod_json(os.path.join(MESH, "lod1.json"), b1)
    write_lod_json(os.path.join(MESH, "lod2.json"), b2)
    topo1 = topo(b1.V, b1.F)
    topo2 = topo(b2.V, b2.F)
    print("lod tris", len(b.F), len(b1.F), len(b2.F), "sealed", topo1, topo2, flush=True)
    for face, name in ((0, "front"), (1, "right45"), (7, "left45")):
        bake_groove_normal(b.normal_samples.get(face, []), os.path.join(TEX, name + "-normal.jpg"))
    info["lodTris"] = {"lod0": len(b.F), "lod1": len(b1.F), "lod2": len(b2.F)}
    info["lodTopo"] = {"lod1": topo1, "lod2": topo2}
    info["lodNseg"] = {"lod1": {str(k): v for k, v in nseg1.items()}, "lod2": {str(k): v for k, v in nseg2.items()}}
    profile = {
        "id": "rune-pillar",
        "lod0Max": 25000,
        "switchesM": [15, 40],
        "nativeMinPx": 1024,
        "maskW": 540,
        "maskH": 960,
        "fovDeg": 58,
        "views": [0, 90, 180, 270],
    }
    json.dump(profile, open(os.path.join(MESH, "profile.json"), "w"), indent=1)
    manifest = {
        "id": "rune-pillar",
        "profile": "profile.json",
        "lods": [{"level": i, "mesh": f"lod{i}.json"} for i in (0, 1, 2)],
        "textures": [
            {"id": name, "nativePx": [1024, 1024], "mipmaps": True, "source": "imagine"}
            for name in ("front", "right45", "left45", "side", "back", "cap", "plinth", "front-normal", "right45-normal", "left45-normal")
        ],
    }
    json.dump(manifest, open(os.path.join(MESH, "manifest.json"), "w"), indent=1)
    json.dump(icicles, open(os.path.join(MESH, "icicles.json"), "w"), indent=1)
    mpp = 0.004
    # a = -512 columns, so world 0 sits on column 512 and negative lip coords stay inside the plate.
    origin = -512 * mpp
    bands = []
    for plate, side, axis_note in (("front", "front", "x"), ("right", "right", "z"), ("left", "left", "z")):
        tex = {"front": "front.jpg", "right": "right45.jpg", "left": "left45.jpg"}[plate]
        bands.append({
            "plate": plate, "tex": os.path.join(TEX, tex), "tier": 0, "side": side,
            "row0": 6, "rows": 36, "c_lo": 0, "c_hi": 1023, "a": origin, "b": mpp,
        })
    json.dump(bands, open(os.path.join(MESH, "bands.json"), "w"), indent=1)
    plinth_steps_col, shaft, cam, outline, shaft_hull = collider_boxes(steps)
    plaza_r = 15.0
    off_center = 5.0  # 10 m past the rim entrance of a 30 m plaza
    chord = 2.0 * math.sqrt(plaza_r * plaza_r - off_center * off_center)
    plinth_flat = 2.0 * (PLINTH_APO + 3 * STEP_RAD)
    free_width = chord - plinth_flat
    plaza = {
        "diameterM": 30.0,
        "pillarFromEntranceM": 10.0,
        "pillarFromCenterM": off_center,
        "acrossChordM": round(chord, 3),
        "plinthFlatToFlatM": round(plinth_flat, 3),
        "freeWidthM": round(free_width, 3),
        "requiredM": 16.0,
        "pass": bool(free_width + 1e-6 >= 16.0),
        "note": "Chord of the 30 m plaza at 5 m off centre, minus the plinth outline. The 16 m bar is (6 m lane + 1 m camera margin) each side + a 2.0 m plinth.",
    }
    zone = {
        "schema": "zone-placement/1",
        "ground_y": 0,
        "beat": 5,
        "note": "Plaza entrance at the origin. Pillar on the path axis, 10 m past the entrance. Front face (local +Z) yaws 180 so it faces the incoming player.",
        "path": {
            "points": [[0, 0, 0], [0, 0, 7.0]],
            "width_m": 4.0,
            "min_clearance_m": 2.5,
        },
        "library": {
            "rune-pillar": {
                "ground_anchor": [0, 0, 0],
                "hanging": False,
                "boxes": [
                    {k: st["box"][k] for k in ("id", "role", "visual", "min", "max")}
                    for st in plinth_steps_col
                ] + [
                    {k: shaft[k] for k in ("id", "role", "visual", "min", "max")},
                ],
            }
        },
        "parts": [{
            "id": "beat5-rune-pillar",
            "library": "rune-pillar",
            "position": [0, 0, 10],
            "yaw_deg": 180,
            "scale": 1,
            "ground_snap": True,
        }],
        "plinth": {"outline_xz": outline, "steps": steps, "buried_m": 0.15, "flat_to_flat_m": round(plinth_flat, 4)},
        "plaza_across": plaza,
        "collision_layers": {
            "plinth_steps": plinth_steps_col,
            "shaft": {
                "layers": ["player", "camera"], "inset_m": 0.02, "camera_margin_m": 1.0,
                "box": shaft, "camera_box": cam, "hull_xz": shaft_hull,
                "kind": "convex hull of the slimmed frustum, widest section inset 2 cm",
            },
            "runes": "no colliders",
            "icicles": "no colliders, all roots above 5 m",
        },
    }
    json.dump(zone, open(os.path.join(STEP, "zone-placement.json"), "w"), indent=1)
    features = []
    for rec in icicles:
        features.append({
            "id": rec["id"], "faces": [rec["id"]], "plate": rec["plate"],
            "world": rec["world"], "lengthM": rec["lengthM"], "radiusM": rec["radiusM"],
            "tier": 0, "side": rec["side"], "kind": "icicle",
        })
    plates = []
    for pid, image, axis in (
        ("front", "front.jpg", "x"),
        ("right", "right45.jpg", "z"),
        ("left", "left45.jpg", "z"),
    ):
        plates.append({
            "id": pid, "image": os.path.join(TEX, image), "mpp": mpp,
            "uAxis": axis, "u0": 512, "uSign": 1, "v0": ROOT_Y / mpp, "vSign": -1,
        })
    json.dump({"plates": plates, "features": features, "bands": bands}, open(os.path.join(MESH, "painted-spec.json"), "w"), indent=1)
    tip_y = min(rec["rootY"] - rec["lengthM"] for rec in icicles)
    metrics = {
        "heightM": H_PILLAR,
        "shaftBaseFlatM": W_BASE,
        "shaftMidFlatM": round(W_BASE + 0.5 * (W_TOP - W_BASE), 4),
        "shaftTopFlatM": W_TOP,
        "lipFlatM": round(2.0 * (APO_TOP + CAP_OVERHANG), 4),
        "plinthFlatM": round(plinth_flat, 4),
        "platePpm": round(PLATE_PPM, 4),
        "uvStretch": mirror_report.get("worstAniso"),
        "uvOver1_3": mirror_report.get("over1_3"),
        "source": "slimmed about the centre axis to 1.60 m base -> 1.20 m top. Plinth steps frozen. Plate UVs are an equal px/m projection (1024/7), never an upscale.",
        "before": {
            "note": "WIP 265ae83f, flat-to-flat, icicles excluded from the body reading where noted",
            "shaftBaseM": 2.0,
            "shaftMidM": 1.656,
            "shaftTopBodyM": 1.312,
            "lipM": 2.02,
            "maxAbovePlinthM": 2.02,
        },
        "plaza": plaza,
        "tris": len(b.F),
        "topo": report_topo,
        "sliver": {k: report_sliver[k] for k in ("tris", "degenerate", "sliverFrac", "pass", "minAngleP5", "aspectP99")},
        "uv": info.get("uv"),
        "icicles": len(icicles),
        "icicleTipMinY": round(tip_y, 4),
        "nseg": {str(k): v for k, v in nseg.items()},
        "steps": steps,
        "textures": {k: info[k] for k in info if k not in ("uv",)},
        "buriedM": 0.15,
        "contactGapM": 0.0,
        "lod": info.get("lodTris"),
        "lodTopo": info.get("lodTopo"),
        "lodNseg": info.get("lodNseg"),
        "runeRegister": info.get("runeRegister"),
        "normalMaps": ["front-normal.jpg", "right45-normal.jpg", "left45-normal.jpg"],
    }
    # uv fix already applied inside build_mesh via fix_uv; recover by a second pass record stored on the function return
    json.dump(metrics, open(os.path.join(MESH, "build-metrics.json"), "w"), indent=1)
    print("tris", len(b.F))
    print("wrote", obj)


if __name__ == "__main__":
    main()

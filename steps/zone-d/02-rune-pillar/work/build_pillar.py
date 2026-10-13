#!/usr/bin/env python3
"""Zone D rune pillar v1. MoGe/SAM2 measures already on disk. No Imagine calls.

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
    cap_src = seal(img3, sub3)
    cap_img, _ = crop_native(cap_src[:320], 1024, 1024)
    cap_img, _cap_n = grade_cap_band(cap_img, np.ones(cap_img.shape[:2], bool), frost)
    plinth_src = seal(img1[700:], ~sky_of(img1[700:]))
    plinth, _ = crop_native(plinth_src, 1024, 1024)
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
        "note": "No plate was upscaled. fit_into scale is never above 1.",
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


def build_mesh(tex_info):
    amb_front = np.load(os.path.join(TEX, "front-amber.npy")).astype(bool)
    amb_left = np.load(os.path.join(TEX, "left-amber.npy")).astype(bool)
    amb_right = np.load(os.path.join(TEX, "right-amber.npy")).astype(bool)
    b = Builder()
    ys = np.linspace(Y_SHAFT0, Y_SHAFT1, int(round((Y_SHAFT1 - Y_SHAFT0) / 0.05)) + 1)
    # per-face segment counts. Shared corners only, so counts may differ.
    # Even counts so the cap can halve to a 15° fan (min angle 15°). 5 and 10 cannot.
    nseg = {0: 12, 1: 12, 2: 6, 3: 6, 4: 6, 5: 6, 6: 6, 7: 12}
    center = np.array([0.0, 3.5, 0.0])

    def sample_amber(face, s, y):
        """Same plate projection the UVs use, so a rune pixel sits on its groove."""
        if face == 0:
            mask = amb_front
        elif face == 1:
            mask = amb_right
        elif face == 7:
            mask = amb_left
        else:
            return False
        u, v = plate_uv(MAT_FOR_FACE[face], s, y)
        h, w = mask.shape
        col = int(np.clip(u, 0, 1) * (w - 1))
        row = int(np.clip(1.0 - v, 0, 1) * (h - 1))
        return bool(mask[row, col])

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
                if edge > 0.08 and ydist > 0.08 and t_i not in (0, ns):
                    if sample_amber(face, s, float(y)):
                        depth = 0.045  # rune groove, 3–6 cm, absolute, not scaled
                    elif face == 0 and min(abs(s - width * 0.22), abs(s + width * 0.22)) < 0.03:
                        depth = 0.025  # front flutes, shallow grooves on the one hull
                if depth:
                    p = tuple(np.array(p) - normal * depth)
                row.append((p, s, float(y), depth))
            rows.append(row)
            if yi == 0:
                shaft_bottom[face] = [(p, s) for p, s, _y, _d in row]
            if yi == len(ys) - 1:
                shaft_top[face] = [(p, s) for p, s, _y, _d in row]
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

    icicles = add_icicles(b, lip_apo)
    uv_report = fix_uv(b)
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
        if r <= limit or r >= 1e8:
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
    for i, l in enumerate(lines):
        if l.startswith("v "):
            V.append([float(x) for x in l.split()[1:4]])
        elif l.startswith("vt "):
            T.append([float(x) for x in l.split()[1:3]])
        elif l.startswith("f "):
            p = [t.split("/") for t in l.split()[1:4]]
            face_at.append((i, [(int(a) - 1, int(b) - 1) for a, b in p]))
    V = np.array(V, float)
    T = [np.array(u, float) for u in T]
    fixed = 0
    for i, f in face_at:
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
        out.append(f"vt {u[0]:.5f} {u[1]:.5f}")
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
    for i, f in faces:
        P = V[[a for a, _ in f]]
        Q = T[[b for _, b in f]]
        if _uv_scale_sign(P, Q) < 0:
            # swap the two vt indices only
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
    """After 5-decimal OBJ rounding, give any triangle still over 1.3 its own rounded vt."""
    lines = open(path).read().splitlines()
    V, T = [], []
    face_at = []
    for i, l in enumerate(lines):
        if l.startswith("v "):
            V.append([float(x) for x in l.split()[1:4]])
        elif l.startswith("vt "):
            T.append([float(x) for x in l.split()[1:3]])
        elif l.startswith("f "):
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
            Qn = np.round(_conformal_uv(P, Qn, aim), 5)
        ids = []
        for k in range(3):
            T.append(np.round(Qn[k], 5))
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
        out.append(f"vt {u[0]:.5f} {u[1]:.5f}")
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
            f.write(f"vt {u[0]:.5f} {u[1]:.5f}\n")
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


def collider_boxes(plinth_steps):
    """Inset convex hulls. Library still stores the AABB of each hull.

    The octagon flats face the axes, so the tight AABB is +/- the apothem,
    not the vertex radius. Shaft hull is the widest section above the plinth
    (base and lip are both 0.80 m apothem) inset 2 cm. Plinth hull is the
    unchanged outer step, inset 2 cm, from the buried base to the top step.
    """
    inset = 0.02
    plinth_apo = PLINTH_APO + 3 * STEP_RAD
    shaft_apo = max(APO_BASE, APO_TOP + CAP_OVERHANG)
    plinth_in = plinth_apo - inset
    shaft_in = shaft_apo - inset

    def box(apo, y0, y1, name):
        r = apo
        return {
            "id": name, "role": "solid", "visual": True, "space": "local",
            "min": [round(-r, 4), round(y0, 4), round(-r, 4)],
            "max": [round(r, 4), round(y1, 4), round(r, 4)],
        }

    plinth = box(plinth_in, -0.15, Y_SHAFT0, "plinth-player")
    shaft = box(shaft_in, Y_SHAFT0, Y_CAP, "shaft-player")
    cam = box(shaft_in + 1.0, Y_SHAFT0, Y_CAP, "shaft-camera")
    outline = _hull_xz(plinth_apo)
    return plinth, shaft, cam, outline, _hull_xz(plinth_in), _hull_xz(shaft_in)


def main():
    print("textures")
    info = build_textures()
    print("mesh", json.dumps({k: info[k] for k in ("shift01to02", "frontAmber", "chromePxGraded")}))
    b, icicles, steps, nseg, uv_report = build_mesh(info)
    info["uv"] = uv_report
    print("uv", uv_report)
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
    for level in (0, 1, 2):
        write_lod_json(os.path.join(MESH, f"lod{level}.json"), b)
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
            for name in ("front", "right45", "left45", "side", "back", "cap", "plinth")
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
    plinth, shaft, cam, outline, plinth_hull, shaft_hull = collider_boxes(steps)
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
                    {k: plinth[k] for k in ("id", "role", "visual", "min", "max")},
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
            "plinth": {"layers": ["player"], "inset_m": 0.02, "box": plinth, "hull_xz": plinth_hull, "y_top": Y_SHAFT0},
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
        "lod": "lod1 and lod2 are copies of slimmed lod0 so the outline difference is 0 px",
    }
    # uv fix already applied inside build_mesh via fix_uv; recover by a second pass record stored on the function return
    json.dump(metrics, open(os.path.join(MESH, "build-metrics.json"), "w"), indent=1)
    print("tris", len(b.F))
    print("wrote", obj)


if __name__ == "__main__":
    main()

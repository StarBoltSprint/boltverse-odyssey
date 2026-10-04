"""Shared plate measure and mesh pack."""

import array
import struct

import cv2
import numpy as np
from PIL import Image


def load_rgb(path):
    im = Image.open(path).convert("RGB")
    arr = np.asarray(im)
    lum = 0.2126 * arr[:, :, 0] + 0.7152 * arr[:, :, 1] + 0.0722 * arr[:, :, 2]
    return im.size[0], im.size[1], lum, arr


def largest_mask(bw):
    n, labels, stats, _ = cv2.connectedComponentsWithStats(bw.astype(np.uint8), 4)
    if n <= 1:
        return np.zeros_like(bw, dtype=bool), (0, 0)
    # label 0 is the background
    areas = stats[1:, cv2.CC_STAT_AREA]
    lab = 1 + int(np.argmax(areas))
    mask = labels == lab
    ys, xs = np.where(mask)
    return mask, (int(xs[0]), int(ys[0]))


def content_box(mask):
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return 0, 0, 1, 1
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def plate_mask(lum, margin=18.0):
    """Stone is brighter than the empty border. The threshold is measured from that border."""
    border = np.concatenate([lum[0, :], lum[-1, :], lum[:, 0], lum[:, -1]])
    base = float(np.median(border))
    thr = max(16.0, base + margin)
    stone, origin = largest_mask(lum > thr)
    return stone, origin, thr


def enclosed_holes(stone, min_area=400):
    """Every dark region fully inside the stone, largest first."""
    h, w = stone.shape
    inv = (~stone).astype(np.uint8)
    flood = inv.copy()
    ff = np.zeros((h + 2, w + 2), np.uint8)
    cv2.floodFill(flood, ff, (0, 0), 2)
    holes = (flood == 1).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(holes, 4)
    found = []
    for lab in range(1, n):
        area = int(stats[lab, cv2.CC_STAT_AREA])
        if area < min_area:
            continue
        found.append((area, labels == lab))
    found.sort(key=lambda it: -it[0])
    return found


def width_profile(path, rows=64):
    """Normalised solid width along the plate's content height. Measure only."""
    _w, _h, lum, _ = load_rgb(path)
    stone, _, _ = plate_mask(lum, margin=22.0)
    x0, y0, x1, y1 = content_box(stone)
    prof = np.zeros(rows, dtype=np.float64)
    span_y = max(1, y1 - y0)
    for i in range(rows):
        y = y0 + int((i + 0.5) / rows * span_y)
        y = min(y1, max(y0, y))
        prof[i] = float(stone[y, x0 : x1 + 1].sum())
    peak = float(prof.max()) or 1.0
    return prof / peak, content_box(stone)


def pack_ruin(draws):
    """draws: list of (skin_index, flat xyzuv floats, index ints)."""
    parts = [b"RUIN", struct.pack("<I", len(draws))]
    for skin, xyzuv, idx in draws:
        vc = len(xyzuv) // 5
        ic = len(idx)
        parts.append(struct.pack("<III", int(skin), vc, ic))
        parts.append(array.array("f", xyzuv).tobytes())
        parts.append(array.array("I", idx).tobytes())
    return b"".join(parts)


class Mesh(object):
    def __init__(self, skin):
        self.skin = skin
        self.xyzuv = []
        self.idx = []

    def quad(self, corners):
        base = len(self.xyzuv) // 5
        for c in corners:
            self.xyzuv.extend(c)
        self.idx.extend((base, base + 1, base + 2, base, base + 2, base + 3))

    def tri(self, a, b, c):
        base = len(self.xyzuv) // 5
        self.xyzuv.extend(a)
        self.xyzuv.extend(b)
        self.xyzuv.extend(c)
        self.idx.extend((base, base + 1, base + 2))

"""Side-by-side sheets. 16:9 is 1920x1080. Phone is 720x1600."""
from __future__ import annotations

import cv2
import numpy as np


def _fit(img, w, h):
    canvas = np.zeros((h, w, 3), np.uint8)
    ih, iw = img.shape[:2]
    scale = min(w / iw, h / ih)
    nw, nh = max(1, int(iw * scale)), max(1, int(ih * scale))
    resized = cv2.resize(img, (nw, nh), interpolation=cv2.INTER_AREA)
    x0 = (w - nw) // 2
    y0 = (h - nh) // 2
    canvas[y0 : y0 + nh, x0 : x0 + nw] = resized
    return canvas


def _cover(img, w, h):
    ih, iw = img.shape[:2]
    scale = max(w / iw, h / ih)
    nw, nh = max(1, int(round(iw * scale))), max(1, int(round(ih * scale)))
    resized = cv2.resize(img, (nw, nh), interpolation=cv2.INTER_AREA)
    x0 = max(0, (nw - w) // 2)
    y0 = max(0, (nh - h) // 2)
    return resized[y0 : y0 + h, x0 : x0 + w]


def focus_window(mask, margin=0.28):
    h, w = mask.shape[:2]
    ys, xs = np.where(mask)
    if len(ys) < 10:
        return 0, h, 0, w
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    pad_y = int((y1 - y0) * margin)
    pad_x = int((x1 - x0) * margin)
    return max(0, y0 - pad_y), min(h, y1 + pad_y), max(0, x0 - pad_x), min(w, x1 + pad_x)


def crop(img, window):
    y0, y1, x0, x1 = window
    return img[y0:y1, x0:x1]


def _label(img, text):
    out = img.copy()
    cv2.rectangle(out, (0, 0), (out.shape[1], 36), (12, 12, 14), -1)
    cv2.putText(out, text, (12, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (240, 240, 240), 2, cv2.LINE_AA)
    return out


def sheet_16x9(grok_bgr, base_bgr, key_bgr, window=None):
    """Top row is the full 16:9 plate. Bottom row is the tower crop, filled."""
    canvas = np.full((1080, 1920, 3), 18, np.uint8)
    panels = (
        (grok_bgr, "Grok-native"),
        (base_bgr, "MoGe-2 / SAM2"),
        (key_bgr, "key"),
    )
    for i, (img, title) in enumerate(panels):
        full = _label(_cover(img, 640, 400), title)
        canvas[0:400, i * 640 : (i + 1) * 640] = full
        src = crop(img, window) if window is not None else img
        zoom = _cover(src, 640, 680)
        canvas[400:1080, i * 640 : (i + 1) * 640] = zoom
    return canvas


def sheet_phone(grok_bgr, base_bgr, key_bgr, window=None):
    canvas = np.full((1600, 720, 3), 18, np.uint8)
    panels = (
        (grok_bgr, "Grok-native"),
        (base_bgr, "MoGe-2 / SAM2"),
        (key_bgr, "key"),
    )
    edges = [0, 533, 1066, 1600]
    for i, (img, title) in enumerate(panels):
        y0, y1 = edges[i], edges[i + 1]
        src = crop(img, window) if window is not None else img
        tile = _label(_cover(src, 720, y1 - y0), title)
        canvas[y0:y1] = tile
    return canvas

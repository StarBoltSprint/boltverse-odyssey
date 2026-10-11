"""Seg seeds inside the vision box, GrabCut on the key, then an edge snap."""
from __future__ import annotations

import cv2
import numpy as np


def iou(a, b):
    a = a.astype(bool)
    b = b.astype(bool)
    inter = np.logical_and(a, b).sum()
    union = np.logical_or(a, b).sum()
    return float(inter) / float(union) if union else 0.0


def box_px(norm, w, h, pad=0):
    x0, y0, x1, y1 = norm
    xa = int(round(x0 * w)) - pad
    ya = int(round(y0 * h)) - pad
    xb = int(round(x1 * w)) + pad
    yb = int(round(y1 * h)) + pad
    return max(0, xa), max(0, ya), min(w, xb), min(h, yb)


def sky_mask(seg_bgr):
    hsv = cv2.cvtColor(seg_bgr, cv2.COLOR_BGR2HSV)
    H, S, V = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    return (H > 110) & (H < 165) & (S > 20) & (V > 70)


def structure_proposals(seg_bgr, min_area=4000, max_n=6):
    """Tall structure blobs on the flat-colour plate, left to right. Classic colour, no model."""
    h, w = seg_bgr.shape[:2]
    hsv = cv2.cvtColor(seg_bgr, cv2.COLOR_BGR2HSV)
    H, S, V = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    sky = sky_mask(seg_bgr)
    sand = (H < 25) & (S > 40) & (V > 80)
    struct = ((~sky) & (~sand) & (V < 160)).astype(np.uint8)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 7))
    struct = cv2.morphologyEx(struct, cv2.MORPH_CLOSE, kernel, iterations=2)
    n, _labels, stats, centroids = cv2.connectedComponentsWithStats(struct, 8)
    props = []
    for i in range(1, n):
        area = int(stats[i, cv2.CC_STAT_AREA])
        if area < min_area or area > int(0.45 * h * w):
            continue
        x = int(stats[i, cv2.CC_STAT_LEFT])
        y = int(stats[i, cv2.CC_STAT_TOP])
        ww = int(stats[i, cv2.CC_STAT_WIDTH])
        hh = int(stats[i, cv2.CC_STAT_HEIGHT])
        if hh < 80 or ww < 24:
            continue
        # A component whose box is the whole plate is ground clutter, not a tower.
        if ww > int(0.70 * w) or hh > int(0.92 * h):
            continue
        cx, cy = centroids[i]
        props.append({
            "area": area,
            "box": [x / w, y / h, (x + ww) / w, (y + hh) / h],
            "cx": float(cx / w),
            "cy": float(cy / h),
            "xywh": [x, y, ww, hh],
        })
    props.sort(key=lambda p: p["cx"])
    props = props[:max_n]
    for i, p in enumerate(props, 1):
        p["id"] = i
    return props


def draw_proposals(key_bgr, proposals):
    out = key_bgr.copy()
    h, w = out.shape[:2]
    for p in proposals:
        x0, y0, x1, y1 = box_px(p["box"], w, h, pad=0)
        cv2.rectangle(out, (x0, y0), (x1, y1), (0, 220, 255), 2)
        label = str(p["id"])
        cv2.rectangle(out, (x0, y0), (x0 + 36, y0 + 32), (0, 140, 200), -1)
        cv2.putText(out, label, (x0 + 8, y0 + 24), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2, cv2.LINE_AA)
    return out


def box_iou(a, b):
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    ix0, iy0 = max(ax0, bx0), max(ay0, by0)
    ix1, iy1 = min(ax1, bx1), min(ay1, by1)
    iw, ih = max(0, ix1 - ix0), max(0, iy1 - iy0)
    inter = iw * ih
    union = max(0, ax1 - ax0) * max(0, ay1 - ay0) + max(0, bx1 - bx0) * max(0, by1 - by0) - inter
    return float(inter) / float(union) if union else 0.0


def grabcut_tower(key_bgr, seg_bgr, vision_box):
    h, w = key_bgr.shape[:2]
    x0, y0, x1, y1 = box_px(vision_box, w, h, pad=10)
    sky = sky_mask(seg_bgr)
    hsv = cv2.cvtColor(seg_bgr, cv2.COLOR_BGR2HSV)
    V = hsv[:, :, 2]
    box = np.zeros((h, w), bool)
    box[y0:y1, x0:x1] = True
    dark = box & ~sky & (V < 110)
    if dark.sum() < 40:
        dark = box & ~sky
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    core = cv2.erode(dark.astype(np.uint8), kernel, iterations=2).astype(bool)
    if core.sum() < 20:
        core = dark
    gc = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
    dil = cv2.dilate(box.astype(np.uint8), kernel, iterations=3).astype(bool)
    gc[~dil] = cv2.GC_BGD
    gc[sky] = cv2.GC_BGD
    gc[box & ~sky] = cv2.GC_PR_FGD
    gc[core] = cv2.GC_FGD
    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)
    cv2.grabCut(key_bgr, gc, None, bgd, fgd, 5, cv2.GC_INIT_WITH_MASK)
    mask = np.where((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD), np.uint8(1), np.uint8(0))
    # Largest component only.
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    if n > 1:
        order = np.argsort(stats[1:, cv2.CC_STAT_AREA])[::-1] + 1
        mask = (labels == int(order[0])).astype(np.uint8)
    return mask


def snap_edges(mask, key_bgr, radius=4):
    gray = cv2.cvtColor(key_bgr, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 140)
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not cnts:
        return mask, {"snapped": False, "reason": "no contour"}
    cnt = max(cnts, key=cv2.contourArea)
    pts = cnt[:, 0, :]
    if len(pts) < 12:
        return mask, {"snapped": False, "reason": "short contour"}
    step = max(1, len(pts) // 400)
    sample = pts[::step]
    h, w = mask.shape
    snapped = []
    moved = 0
    for i, (x, y) in enumerate(sample):
        prev = sample[i - 1]
        nxt = sample[(i + 1) % len(sample)]
        tang = nxt.astype(np.float64) - prev.astype(np.float64)
        norm = np.array([-tang[1], tang[0]], np.float64)
        nlen = np.hypot(norm[0], norm[1])
        if nlen < 1e-3:
            snapped.append((int(x), int(y)))
            continue
        norm /= nlen
        best = (int(x), int(y))
        best_s = 0
        found = False
        for s in range(-radius, radius + 1):
            xx = int(round(x + norm[0] * s))
            yy = int(round(y + norm[1] * s))
            if xx < 0 or yy < 0 or xx >= w or yy >= h:
                continue
            if edges[yy, xx]:
                if not found or abs(s) < abs(best_s):
                    best = (xx, yy)
                    best_s = s
                    found = True
        if found and best_s != 0:
            moved += 1
        snapped.append(best)
    poly = np.array(snapped, np.int32)
    out = np.zeros_like(mask)
    cv2.fillPoly(out, [poly], 1)
    score = iou(out, mask)
    if score < 0.82 or out.sum() < 50:
        return mask, {"snapped": False, "iou_vs_seed": round(score, 4), "moved": moved}
    return out, {"snapped": True, "iou_vs_seed": round(score, 4), "moved": int(moved)}


def refine(mask, action):
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    if action == "erode":
        return cv2.erode(mask, k, iterations=2)
    if action == "dilate":
        return cv2.dilate(mask, k, iterations=2)
    return mask


def overlay(key_bgr, mask, box_norm=None):
    out = key_bgr.copy()
    red = np.zeros_like(out)
    red[:, :, 2] = 255
    m = mask.astype(bool)
    out[m] = (0.55 * out[m] + 0.45 * red[m]).astype(np.uint8)
    if box_norm is not None:
        h, w = mask.shape
        x0, y0, x1, y1 = box_px(box_norm, w, h)
        cv2.rectangle(out, (x0, y0), (x1, y1), (0, 255, 0), 2)
    return out

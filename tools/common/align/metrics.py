#!/usr/bin/env python3
"""Render-vs-key metrics.

score(render, key, masks, weights) returns soft silhouette IoU, symmetric
edge Chamfer, edge precision/recall at 2 px, and an optional Lab residual.
`alignment` is min(precision, recall) at 2 px. The object gate reads that
number as `overlap` and keeps the bar at 0.70.

strict_score adds a blocking `strict` value. Alignment stays a component and
does not lift `strict`. Horizontal bands, a shattered outline, or a stair
stack stay under 0.70. The key crop and a flat fill of its mask clear 0.70.
A vision answer of no caps `strict` at 0.69. Yes does not raise it.

  python3 tools/common/align/metrics.py --render r.png --key k.png --out dir
"""
from __future__ import annotations

import argparse
import json
import os

import cv2
import numpy as np
from PIL import Image

try:
    from skimage.color import rgb2lab
except Exception:  # pragma: no cover
    rgb2lab = None


def _rgb(image):
    if isinstance(image, str):
        im = Image.open(image).convert("RGB")
        return np.asarray(im)
    arr = np.asarray(image)
    if arr.ndim == 2:
        arr = np.stack([arr, arr, arr], -1)
    if arr.shape[-1] == 4:
        arr = arr[..., :3]
    if arr.dtype != np.uint8:
        a = arr.astype(np.float32)
        if a.max() <= 1.0:
            a = a * 255.0
        arr = np.clip(a, 0, 255).astype(np.uint8)
    return arr


def _mask(mask, shape):
    if mask is None:
        return None
    if isinstance(mask, str):
        m = np.asarray(Image.open(mask).convert("L"))
    else:
        m = np.asarray(mask)
        if m.ndim == 3:
            m = m[..., 0]
    if m.dtype != np.float32 and m.dtype != np.float64:
        m = m.astype(np.float32)
        if m.max() > 1.0:
            m = m / 255.0
    else:
        m = m.astype(np.float32)
        if m.max() > 1.0:
            m = m / 255.0
    if m.shape[:2] != shape[:2]:
        m = cv2.resize(m, (shape[1], shape[0]), interpolation=cv2.INTER_LINEAR)
    return np.clip(m, 0.0, 1.0)


def _edges(rgb, mask=None):
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 40, 120) > 0
    if mask is not None:
        edges &= mask > 0.25
    return edges


def soft_iou(a, b):
    inter = float(np.minimum(a, b).sum())
    union = float(np.maximum(a, b).sum())
    if union <= 1e-6:
        return 0.0
    return inter / union


def _chamfer(src, dst):
    """Mean distance in px from src edge pixels to dst edges."""
    if not src.any():
        return None
    inv = np.where(dst, 0, 255).astype(np.uint8)
    dt = cv2.distanceTransform(inv, cv2.DIST_L2, 3)
    return float(dt[src].mean()), dt


def _lab_residual(render, key, overlap):
    if rgb2lab is None or int(overlap.sum()) < 16:
        return None
    r = rgb2lab(render.astype(np.float32) / 255.0)
    k = rgb2lab(key.astype(np.float32) / 255.0)
    d = np.abs(r - k).mean(axis=2)
    return float(d[overlap].mean())


def _crop_to(mask):
    ys, xs = np.where(mask)
    if len(ys) < 8:
        return None
    return int(ys.min()), int(ys.max()) + 1, int(xs.min()), int(xs.max()) + 1


def _silhouette(rgb, given):
    """Object mask. An explicit mask wins. A black-backed splat uses the lit pixels.

    A plate whose sky touches the crop border keeps the darker masses, so a
    sky gap between shards counts as a break.
    """
    if given is not None:
        m = given > 0.5
        box = _crop_to(m)
        if box is None:
            return m, rgb
        y0, y1, x0, x1 = box
        return m[y0:y1, x0:x1], rgb[y0:y1, x0:x1]
    lit = rgb.max(axis=2) > 16
    if float(lit.mean()) < 0.02:
        return lit, rgb
    box = _crop_to(lit)
    if box is None:
        return lit, rgb
    y0, y1, x0, x1 = box
    crop = rgb[y0:y1, x0:x1]
    lit = lit[y0:y1, x0:x1]
    gray = cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY)
    # Sky is bright. The tower body sits under that, darker than the sky and
    # above the black padding that was already cropped off.
    sky = gray > 100
    body = (gray > 16) & (gray < 90)
    if float(sky.mean()) > 0.12 and float(body.mean()) > 0.18:
        body = cv2.morphologyEx(body.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0
        if float(body.mean()) > 0.08:
            return body, crop
    if float((~lit).mean()) > 0.12:
        return lit, crop
    bright = gray >= np.percentile(gray, 68)
    border = np.concatenate([bright[0], bright[-1], bright[:, 0], bright[:, -1]])
    dark = gray <= np.percentile(gray, 50)
    if float(border.mean()) > 0.18 and float(dark.mean()) > 0.08:
        dark = cv2.morphologyEx(dark.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0
        return dark, crop
    return lit, crop


def _resize_pair(rgb, mask, height):
    h, w = rgb.shape[:2]
    if h == height:
        return rgb, mask
    w2 = max(1, int(round(w * height / float(h))))
    interp = cv2.INTER_AREA if h > height else cv2.INTER_LINEAR
    out = cv2.resize(rgb, (w2, height), interpolation=interp)
    m = cv2.resize(mask.astype(np.uint8), (w2, height), interpolation=cv2.INTER_NEAREST) > 0
    return out, m


def _sig_components(mask):
    n, labels = cv2.connectedComponents(mask.astype(np.uint8), connectivity=8)
    if n <= 1:
        return 0, 0.0
    areas = np.bincount(labels.ravel())[1:]
    total = float(areas.sum())
    big = areas[areas >= max(8.0, 0.02 * total)]
    if len(big) == 0:
        return 0, 0.0
    return int(len(big)), float(big.max() / big.sum())


def _outline(mask):
    """Solidity, hole fraction, and how many separate runs a row holds."""
    h, w = mask.shape
    inv = (~mask).astype(np.uint8)
    n, labels = cv2.connectedComponents(inv, connectivity=4)
    hole_area = 0
    for i in range(1, n):
        ys, xs = np.where(labels == i)
        if len(ys) < 12:
            continue
        if ys.min() == 0 or xs.min() == 0 or ys.max() == h - 1 or xs.max() == w - 1:
            continue
        hole_area += int(len(ys))
    hole_frac = float(hole_area) / float(mask.size)
    cnts, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        return {"solidity": 0.0, "hole_frac": hole_frac, "median_runs": 0.0, "components": 0, "largest": 0.0}
    cnt = max(cnts, key=cv2.contourArea)
    hull = cv2.convexHull(cnt)
    solidity = float(cv2.contourArea(cnt) / (cv2.contourArea(hull) + 1e-6))
    runs = []
    for y in range(h):
        row = mask[y]
        if float(row.mean()) < 0.04:
            continue
        d = np.diff(row.astype(np.int8), prepend=0)
        runs.append(int((d == 1).sum()))
    cc, largest = _sig_components(mask)
    return {
        "solidity": round(solidity, 4),
        "hole_frac": round(hole_frac, 4),
        "median_runs": round(float(np.median(runs)) if runs else 0.0, 3),
        "components": cc,
        "largest": round(largest, 4),
    }


def _stripe_energy(gray):
    """Share of row-profile power in short periods. Horizontal bands pile up here."""
    lum = gray.mean(axis=1).astype(np.float64)
    if len(lum) < 16:
        return 0.0
    x = np.linspace(-1.0, 1.0, len(lum))
    design = np.stack([x, np.ones_like(x)], 1)
    coef, *_ = np.linalg.lstsq(design, lum, rcond=None)
    hp = lum - design @ coef
    hp = hp - hp.mean()
    window = np.hanning(len(hp))
    spec = np.abs(np.fft.rfft(hp * window)) ** 2
    spec[0] = 0.0
    total = float(spec.sum())
    if total <= 1e-9:
        return 0.0
    freqs = np.fft.rfftfreq(len(hp))
    period = 1.0 / np.maximum(freqs, 1e-9)
    band = (period >= 0.012 * len(hp)) & (period <= 0.08 * len(hp))
    return float(spec[band].sum() / total)


def _boundary(mask):
    m = mask.astype(np.uint8)
    edge = cv2.morphologyEx(m, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8)) > 0
    return edge


def _orient_hist(gray, mask):
    """Undirected edge angles. Flat fills use the mask boundary, not an empty interior."""
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    mag = np.hypot(gx, gy)
    sel = mask & (mag >= np.percentile(mag[mask], 72) if int(mask.sum()) > 20 else 0)
    if int(sel.sum()) < 24:
        sel = _boundary(mask)
    ang = (np.degrees(np.arctan2(gy, gx)) + 180.0) % 180.0
    hist, _ = np.histogram(ang[sel], bins=12, range=(0.0, 180.0))
    hist = hist.astype(np.float64)
    hist /= hist.sum() + 1e-9
    return hist


def _edge_components(gray, mask):
    edges = cv2.Canny(gray, 40, 120) > 0
    edges &= mask
    if not edges.any():
        edges = _boundary(mask)
    n, labels = cv2.connectedComponents(edges.astype(np.uint8), connectivity=8)
    if n <= 1:
        return 0
    areas = np.bincount(labels.ravel())[1:]
    return int((areas >= 10).sum())


def _continuity(render_stats, key_stats):
    rc, kc = render_stats["components"], key_stats["components"]
    cc = 1.0 if rc <= max(kc, 1) else max(kc, 1) / float(rc)
    sol_r, sol_k = render_stats["solidity"], key_stats["solidity"]
    sol = 1.0 if sol_r + 0.06 >= sol_k else float(np.clip(sol_r / max(sol_k, 1e-3), 0.0, 1.0))
    runs_r, runs_k = render_stats["median_runs"], key_stats["median_runs"]
    runs = 1.0 if runs_r <= runs_k + 0.6 else float(np.clip(1.0 - (runs_r - runs_k) / 6.0, 0.0, 1.0))
    hole_r, hole_k = render_stats["hole_frac"], key_stats["hole_frac"]
    holes = 1.0 if hole_r <= hole_k + 0.012 else float(np.clip(1.0 - (hole_r - hole_k) / 0.08, 0.0, 1.0))
    return float(min(cc, sol, runs, holes)), {
        "cc": round(cc, 4),
        "solidity": round(sol, 4),
        "runs": round(runs, 4),
        "holes": round(holes, 4),
    }


def _fit_mask(mask, shape):
    if mask is None:
        return None
    if isinstance(mask, str):
        return _mask(mask, shape) > 0.5
    m = np.asarray(mask)
    if m.ndim == 3:
        m = m[..., 0]
    if m.dtype != bool:
        m = m.astype(np.float32)
        if m.max() > 1.0:
            m = m / 255.0
        m = m > 0.5
    if m.shape[:2] != shape[:2]:
        m = cv2.resize(m.astype(np.uint8), (shape[1], shape[0]), interpolation=cv2.INTER_NEAREST) > 0
    return m


def strict_geometry(render_rgb, key_rgb, render_mask=None, key_mask=None):
    """Blocking structure score in [0, 1]. The lenient alignment number is separate.

    A column of horizontal bands, a shard pile, or a stair stack stays under 0.70.
    The key crop and a flat fill of its mask stay at or above 0.70.
    """
    render_rgb = _rgb(render_rgb)
    key_rgb = _rgb(key_rgb)
    render_mask = _fit_mask(render_mask, render_rgb.shape)
    key_mask = _fit_mask(key_mask, key_rgb.shape)
    rs, rr = _silhouette(render_rgb, render_mask)
    ks, kr = _silhouette(key_rgb, key_mask)
    rr, rs = _resize_pair(rr, rs, 360)
    kr, ks = _resize_pair(kr, ks, 360)
    rg = cv2.cvtColor(rr, cv2.COLOR_RGB2GRAY)
    kg = cv2.cvtColor(kr, cv2.COLOR_RGB2GRAY)
    rost = _outline(rs)
    kost = _outline(ks)
    continuity, parts = _continuity(rost, kost)
    e_r = _stripe_energy(rg)
    e_k = _stripe_energy(kg)
    excess = max(0.0, e_r - e_k)
    stripe = float(np.clip(1.0 - excess / 0.22, 0.0, 1.0))
    hr = _orient_hist(rg, rs)
    hk = _orient_hist(kg, ks)
    orient = float(np.minimum(hr, hk).sum())
    # Horizontal-edge excess (bins near 0° and 180°) against the key crop.
    axis_r = float(hr[0] + hr[1] + hr[-1] + hr[-2])
    axis_k = float(hk[0] + hk[1] + hk[-1] + hk[-2])
    axis_pen = float(np.clip((axis_r - axis_k - 0.05) / 0.40, 0.0, 1.0))
    orient_score = float(np.clip(0.65 * orient + 0.35 * (1.0 - axis_pen), 0.0, 1.0))
    re = _edge_components(rg, rs)
    ke = _edge_components(kg, ks)
    edge = 1.0 if re <= max(ke, 1) * 1.4 else max(ke, 1) / float(re)
    # Orientation is a penalty, not a veto: a flat fill has the mask outline
    # and little interior texture, so a hard histogram match would fail it.
    orient_gate = float(np.clip(0.62 + 0.38 * orient_score, 0.0, 1.0))
    strict = float(min(continuity, stripe, edge, orient_gate))
    return {
        "strict": round(strict, 4),
        "strict_ok": bool(strict >= 0.70),
        "continuity": round(continuity, 4),
        "stripe": round(stripe, 4),
        "orientation": round(orient_score, 4),
        "edge_continuity": round(float(edge), 4),
        "stripe_energy_render": round(e_r, 4),
        "stripe_energy_key": round(e_k, 4),
        "components_render": rost["components"],
        "components_key": kost["components"],
        "edge_components_render": re,
        "edge_components_key": ke,
        "solidity_render": rost["solidity"],
        "solidity_key": kost["solidity"],
        "hole_frac_render": rost["hole_frac"],
        "hole_frac_key": kost["hole_frac"],
        "median_runs_render": rost["median_runs"],
        "median_runs_key": kost["median_runs"],
        "continuity_parts": parts,
        "vision": None,
    }


def apply_vision(result, yes):
    """A vision 'no' caps the strict score under the 0.70 bar. 'yes' does not raise it."""
    out = dict(result)
    if yes is None:
        out["vision"] = None
        out["strict_ok"] = bool(out["strict"] >= 0.70)
        return out
    out["vision"] = bool(yes)
    if not yes:
        out["strict"] = round(min(float(out["strict"]), 0.69), 4)
    out["strict_ok"] = bool(out["strict"] >= 0.70 and bool(yes))
    return out


def vision_looks_like(render_rgb, key_rgb, cache_dir, log_path=None):
    """One yes/no: does this render look like the tower in the key crop?

    Cached by sha256 of both images. Cost is 0 on a hit. The call is logged.
    """
    import hashlib
    import io
    import json as _json
    import time

    os.makedirs(cache_dir, exist_ok=True)

    def _jpg(rgb):
        buf = io.BytesIO()
        Image.fromarray(_rgb(rgb)).save(buf, format="JPEG", quality=70)
        return buf.getvalue()

    raw_r, raw_k = _jpg(render_rgb), _jpg(key_rgb)
    digest = hashlib.sha256(raw_r + b"|" + raw_k).hexdigest()[:24]
    path = os.path.join(cache_dir, digest + ".json")
    if os.path.isfile(path):
        row = _json.load(open(path))
        row["cached"] = True
        row["cost_usd"] = 0.0
        return row
    sys_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "grok-native"))
    import sys as _sys
    if sys_path not in _sys.path:
        _sys.path.insert(0, sys_path)
    import vision_api

    rpath = os.path.join(cache_dir, digest + "-render.jpg")
    kpath = os.path.join(cache_dir, digest + "-key.jpg")
    open(rpath, "wb").write(raw_r)
    open(kpath, "wb").write(raw_k)
    prompt = (
        "Image 1 is a render. Image 2 is the key crop of one tower. "
        "Does image 1 look like that same tower? "
        "Answer no for horizontal stripes, broken fragments, stair-steps, or a different object. "
        "Answer yes for the same solid tower, including a flat silhouette of that outline. "
        'Reply with one JSON object: {"yes": true} or {"yes": false}.'
    )
    text, log = vision_api.complete([
        {"type": "image_url", "image_url": {"url": vision_api.data_url(rpath)[0]}},
        {"type": "image_url", "image_url": {"url": vision_api.data_url(kpath)[0]}},
        {"type": "text", "text": prompt},
    ], max_tokens=80)
    data = vision_api.extract_json(text)
    row = {
        "yes": bool(data.get("yes")),
        "cached": False,
        "cost_usd": float(log.get("cost_usd") or 0.0),
        "model": log.get("model"),
        "seconds": log.get("seconds"),
        "key": digest,
        "at": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    _json.dump(row, open(path, "w"), indent=1)
    if log_path:
        os.makedirs(os.path.dirname(log_path) or ".", exist_ok=True)
        with open(log_path, "a") as fh:
            fh.write(_json.dumps(row) + "\n")
    return row


def strict_score(render, key, masks=None, vision=None, cache_dir=None, log_path=None):
    """Old `score` plus the strict structure score. `vision` is True, False, or 'ask'."""
    base = score(render, key, masks)
    ren = _rgb(render["rgb"] if isinstance(render, dict) else render)
    ky = _rgb(key["rgb"] if isinstance(key, dict) else key)
    masks = masks or {}
    rm = render.get("mask") if isinstance(render, dict) else masks.get("render")
    km = key.get("mask") if isinstance(key, dict) else masks.get("key")
    geo = strict_geometry(ren, ky, rm, km)
    geo["alignment"] = base["alignment"]
    if vision == "ask":
        if not cache_dir:
            raise ValueError("cache_dir is required when vision='ask'")
        asked = vision_looks_like(ren, ky, cache_dir, log_path)
        geo = apply_vision(geo, asked["yes"])
        geo["vision_cost_usd"] = asked["cost_usd"]
        geo["vision_cached"] = asked["cached"]
    else:
        geo = apply_vision(geo, vision)
        geo["vision_cost_usd"] = 0.0
        geo["vision_cached"] = False
    geo["score"] = base
    return geo


def score(render, key, masks=None, weights=None):
    """render/key are RGB arrays or paths. masks is {render, key} or None.

    weights keys: iou, chamfer, colour. They build `objective` in [0, 1],
    higher is better. Chamfer is normalised by the frame diagonal.
    """
    masks = masks or {}
    weights = weights or {"iou": 0.55, "chamfer": 0.35, "colour": 0.10}
    ren = _rgb(render["rgb"] if isinstance(render, dict) else render)
    ky = _rgb(key["rgb"] if isinstance(key, dict) else key)
    if ky.shape[:2] != ren.shape[:2]:
        ky = cv2.resize(ky, (ren.shape[1], ren.shape[0]), interpolation=cv2.INTER_AREA)
    rm = _mask(masks.get("render") if not isinstance(render, dict) else masks.get("render", render.get("mask")), ren.shape)
    km = _mask(masks.get("key") if not isinstance(key, dict) else masks.get("key", key.get("mask")), ren.shape)
    if rm is None:
        rm = (ren.max(axis=2) > 8).astype(np.float32)
    if km is None:
        km = (ky.max(axis=2) > 8).astype(np.float32)
    iou = soft_iou(rm, km)
    er = _edges(ren, rm)
    ek = _edges(ky, km)
    diag = float(np.hypot(*ren.shape[:2]))
    cr = _chamfer(er, ek)
    ck = _chamfer(ek, er)
    if cr is None or ck is None:
        chamfer_px = diag
        prec = 0.0
        rec = 0.0
        dt_k = None
    else:
        chamfer_px = 0.5 * (cr[0] + ck[0])
        dt_k = cr[1]
        prec = float((dt_k[er] <= 2.0).mean()) if er.any() else 0.0
        rec = float((ck[1][ek] <= 2.0).mean()) if ek.any() else 0.0
    alignment = float(min(prec, rec))
    overlap = (rm > 0.5) & (km > 0.5)
    colour = _lab_residual(ren, ky, overlap)
    chamfer_n = float(chamfer_px / diag) if diag else 1.0
    wsum = float(weights.get("iou", 0) + weights.get("chamfer", 0) + (weights.get("colour", 0) if colour is not None else 0))
    if wsum <= 0:
        wsum = 1.0
    colour_term = 0.0 if colour is None else max(0.0, 1.0 - colour / 40.0)
    objective = (
        weights.get("iou", 0) * iou
        + weights.get("chamfer", 0) * (1.0 - min(1.0, chamfer_n * 8.0))
        + (weights.get("colour", 0) if colour is not None else 0) * colour_term
    ) / wsum
    return {
        "silhouette_iou": round(float(iou), 4),
        "chamfer_px": round(float(chamfer_px), 3),
        "chamfer_norm": round(float(chamfer_n), 4),
        "edge_precision_2px": round(float(prec), 4),
        "edge_recall_2px": round(float(rec), 4),
        "alignment": round(alignment, 4),
        "overlap": round(alignment, 4),
        "ok": bool(alignment >= 0.70),
        "colour_lab": None if colour is None else round(float(colour), 3),
        "objective": round(float(objective), 4),
        "render_edges": int(er.sum()),
        "key_edges": int(ek.sum()),
        "tolPx": 2,
    }


def heatmaps(render, key, masks, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    ren = _rgb(render["rgb"] if isinstance(render, dict) else render)
    ky = _rgb(key["rgb"] if isinstance(key, dict) else key)
    if ky.shape[:2] != ren.shape[:2]:
        ky = cv2.resize(ky, (ren.shape[1], ren.shape[0]), interpolation=cv2.INTER_AREA)
    rm = _mask(None if not isinstance(render, dict) else render.get("mask"), ren.shape)
    km = _mask((masks or {}).get("key"), ren.shape)
    if rm is None:
        rm = (ren.max(axis=2) > 8).astype(np.float32)
    if km is None:
        km = (ky.max(axis=2) > 8).astype(np.float32)
    if masks and masks.get("render") is not None and not isinstance(render, dict):
        rm = _mask(masks.get("render"), ren.shape)
    if masks and masks.get("key") is not None:
        km = _mask(masks.get("key"), ren.shape)
    diff = np.clip(np.abs(rm - km) * 255, 0, 255).astype(np.uint8)
    cv2.imwrite(os.path.join(out_dir, "heatmap-iou.jpg"), cv2.applyColorMap(diff, cv2.COLORMAP_INFERNO))
    er = _edges(ren, rm)
    ek = _edges(ky, km)
    inv = np.where(ek, 0, 255).astype(np.uint8)
    dt = cv2.distanceTransform(inv, cv2.DIST_L2, 3)
    heat = np.zeros(ren.shape[:2], np.uint8)
    if er.any():
        heat[er] = np.clip(dt[er] * 8, 0, 255).astype(np.uint8)
    cv2.imwrite(os.path.join(out_dir, "heatmap-chamfer.jpg"), cv2.applyColorMap(heat, cv2.COLORMAP_VIRIDIS))
    if rgb2lab is not None:
        r = rgb2lab(ren.astype(np.float32) / 255.0)
        k = rgb2lab(ky.astype(np.float32) / 255.0)
        d = np.clip(np.abs(r - k).mean(axis=2) * 4, 0, 255).astype(np.uint8)
        cv2.imwrite(os.path.join(out_dir, "heatmap-colour.jpg"), cv2.applyColorMap(d, cv2.COLORMAP_MAGMA))
    return out_dir


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--render", required=True)
    ap.add_argument("--key", required=True)
    ap.add_argument("--mask-render")
    ap.add_argument("--mask-key")
    ap.add_argument("--out", default="")
    a = ap.parse_args(argv)
    masks = {"render": a.mask_render, "key": a.mask_key}
    sc = score(a.render, a.key, masks)
    if a.out:
        heatmaps(a.render, a.key, masks, a.out)
        json.dump(sc, open(os.path.join(a.out, "score.json"), "w"), indent=1)
    print(json.dumps(sc, indent=1))
    return 0 if sc["alignment"] >= 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())

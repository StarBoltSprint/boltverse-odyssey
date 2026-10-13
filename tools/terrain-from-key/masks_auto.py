"""Ground / relief / sky masks from the key image itself (no zone colour rules).

Models (licence-clean, both optional): MoGe-2 (MIT) metric depth -> ground plane fit on the near band; SAM2 (Apache)
box prompt on that plane refines the ground outline. Without weights (offline selftests) a Lab colour-cluster split is
used: clusters that own the bottom band are ground, the cluster that owns the top band and touches the top edge is sky.
Returns dict(ground, sky, relief: bool HxW, disp: float HxW 0..1 near=1, horizon: row fraction, method: str).
"""
from __future__ import annotations

import math
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

HERE = Path(__file__).resolve().parent


def _lab(rgb):
    c = rgb.astype(np.float32) / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]], np.float32)
    xyz = c @ M.T / np.array([0.9505, 1.0, 1.089], np.float32)
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def _kmeans(x, k=5, it=12, seed=0):
    rng = np.random.default_rng(seed)
    c = x[rng.choice(len(x), k, replace=False)]
    for _ in range(it):
        lab = ((x[:, None] - c[None]) ** 2).sum(2).argmin(1)
        for j in range(k):
            if (lab == j).any(): c[j] = x[lab == j].mean(0)
    return lab, c


def horizon_of(ground):
    h, w = ground.shape
    tops = [np.argmax(ground[:, x]) for x in range(int(w * 0.3), int(w * 0.7)) if ground[:, x].any()]
    return float(np.median(tops)) / h if tops else 0.5


def _clean(m, it=1):
    m = ndi.binary_opening(m, iterations=it)
    return ndi.binary_fill_holes(m)


def colour_split(rgb):
    h, w = rgb.shape[:2]
    small = np.asarray(Image.fromarray(rgb).resize((160, max(2, int(160 * h / w))), Image.Resampling.BILINEAR))
    sh, sw = small.shape[:2]
    lab, _ = _kmeans(_lab(small).reshape(-1, 3), 5)
    L = lab.reshape(sh, sw)
    bot = np.bincount(L[int(sh * 0.85):].ravel(), minlength=5) / L[int(sh * 0.85):].size
    tb = L[: max(1, int(sh * 0.22))]
    top = np.bincount(tb.ravel(), minlength=5) / tb.size
    gk = [j for j in range(5) if bot[j] > 0.15]
    sk = [j for j in range(5) if top[j] > 0.12 and j not in gk]
    ground = np.isin(L, gk)
    sky = np.isin(L, sk)
    lab_sky, _ = ndi.label(sky)
    keep = set(lab_sky[0][lab_sky[0] > 0].tolist())
    sky = np.isin(lab_sky, list(keep)) if keep else np.zeros_like(sky)
    # ground must connect to the bottom edge
    lg, _ = ndi.label(ground); kb = set(lg[-1][lg[-1] > 0].tolist())
    ground = np.isin(lg, list(kb)) if kb else ground
    up = lambda m: np.asarray(Image.fromarray(m.astype(np.uint8) * 255).resize((w, h), Image.Resampling.NEAREST)) > 127
    yy = np.linspace(1, 0, h, dtype=np.float32)[:, None] * np.ones((1, w), np.float32)
    return up(_clean(ground)), up(sky), 1.0 - yy  # disp proxy: lower = nearer


def moge_sky(vm, key_path, side=256):
    """MoGe-2's own validity mask (False = sky / infinity), cached like the depth."""
    def compute():
        import torch
        model = vm.load_moge2(); im = Image.open(key_path).convert("RGB"); im.thumbnail((side, side))
        t = torch.from_numpy((np.asarray(im, np.float32) / 255.0).transpose(2, 0, 1).copy())
        with torch.inference_mode():
            out = model.infer(t, resolution_level=0, use_fp16=False, force_projection=False, apply_mask=False)
        m = out["mask"]; m = m[0] if m.ndim == 3 else m
        return (~m.detach().cpu().numpy().astype(bool)).astype(np.uint8)
    arr, _hit, _s = vm.cached_array("mask", "moge-2-sky", str(key_path), f"side{side}", compute)
    return np.asarray(arr).astype(bool)


def depth_split(key_path, rgb, fov_deg, use_sam=True):
    sys.path.insert(0, str(HERE.parent / "common")); sys.path.insert(0, str(HERE.parent))
    import vision_models as vm
    depth, _hit, _s = vm.depth_default(str(key_path), 256)
    d = np.asarray(depth, np.float32); dh, dw = d.shape
    fin = np.isfinite(d) & (d > 0)
    far = np.nanpercentile(d[fin], 97) if fin.any() else 1.0
    f = (dw / 2) / math.tan(math.radians(fov_deg) / 2)
    ys, xs = np.mgrid[0:dh, 0:dw].astype(np.float32)
    X = (xs - dw / 2) / f * d; Y = -(ys - dh / 2) / f * d; Z = d
    band = fin & (ys > dh * 0.35) & (d < np.nanpercentile(d[fin], 80))  # lower frame, not the far wall
    A = np.stack([X[band], Z[band], np.ones(band.sum())], 1); n = None
    best = None; rng = np.random.default_rng(0)
    tol = 0.3 + 0.05 * Z[band]
    for _ in range(400):  # RANSAC plane Y = a X + b Z + c, near-horizontal only (ground, not a wall)
        idx = rng.choice(len(A), 3, replace=False)
        try: p = np.linalg.solve(A[idx], Y[band][idx])
        except np.linalg.LinAlgError: continue
        if abs(p[0]) > 0.35 or abs(p[1]) > 0.6 or p[2] > 0: continue  # the camera stands above its ground
        inl = np.abs(A @ p - Y[band]) < tol
        if best is None or inl.sum() > best[1]: best = (p, inl.sum())
    p = best[0]
    res = np.abs(p[0] * X + p[1] * Z + p[2] - Y)
    if best is None: raise RuntimeError("no ground plane")
    ground = fin & (res < 0.3 + 0.05 * d) & (d < far)
    # sky: the colour clusters owning the top band, top-connected, AND far (or no depth)
    cg, cs, _ = colour_split(np.asarray(Image.fromarray(rgb).resize((dw, dh), Image.Resampling.BILINEAR)))
    try: sky = moge_sky(vm, key_path); sky = sky if sky.shape == d.shape else cs
    except Exception: sky = cs & ((~fin) | (d >= np.nanpercentile(d[fin], 50)))  # far != sky (the spire is far)
    lab_s, _ = ndi.label(sky); keep = set(lab_s[0][lab_s[0] > 0].tolist()); sky = np.isin(lab_s, list(keep)) if keep else sky
    lg, _ = ndi.label(_clean(ground)); kb = set(lg[-1][lg[-1] > 0].tolist()); ground = np.isin(lg, list(kb)) if kb else ground
    h, w = rgb.shape[:2]
    up = lambda m: np.asarray(Image.fromarray(m.astype(np.uint8) * 255).resize((w, h), Image.Resampling.NEAREST)) > 127
    G, S = up(ground), up(sky); method = "moge-2"
    if use_sam and G.any():
        ys_, xs_ = np.where(G); box = [float(xs_.min()), float(ys_.min()), float(xs_.max()), float(h - 1)]
        try:
            sam, _h, _s = vm.mask_sam2(str(key_path), "small", box=box); sam = np.asarray(sam).astype(bool)
            if sam.shape != G.shape: sam = up(sam)
            if (sam & G).sum() > 0.5 * G.sum(): G = G & sam; method += "+sam2"
        except Exception as e:  # SAM2 is a refinement only
            method += f" (sam2 skipped: {type(e).__name__})"
    disp = np.where(fin, 1 - np.clip(d / far, 0, 1), 0).astype(np.float32)
    disp = np.asarray(Image.fromarray((disp * 255).astype(np.uint8)).resize((w, h), Image.Resampling.BILINEAR), np.float32) / 255
    return G, S, disp, method


def auto_masks(key_path, cfg=None, offline=None):
    cfg = cfg or {}; rgb = np.asarray(Image.open(key_path).convert("RGB"))
    offline = offline if offline is not None else os.environ.get("TFK_OFFLINE") == "1"
    method = "colour-cluster"
    if not offline:
        try:
            G, S, disp, method = depth_split(key_path, rgb, cfg.get("fovDeg", 48), cfg.get("sam2", "small") is not None)
        except Exception as e:
            print(f"[masks_auto] depth model unavailable ({type(e).__name__}: {str(e)[:120]}); colour-cluster fallback")
            G, S, disp = colour_split(rgb); method = "colour-cluster (fallback)"
    else:
        G, S, disp = colour_split(rgb)
    R = ~G & ~S
    return dict(ground=G, sky=S, relief=R, disp=disp, horizon=horizon_of(G), method=method, rgb=rgb)

#!/usr/bin/env python3
"""tools/keysheet/auto_extract.py - ZERO-SETUP hierarchical key sheet for any key image.
usage: python3 tools/keysheet/auto_extract.py KEY.jpg OUTDIR
Runs auto_sam.py in the SAM2 venv (SAM2.1 automatic mask generation + MoGe-2 metric depth), then here:
 colour clustering (k-means k=8, CIELAB) + depth, and builds a 3-level sheet:
  L1 big forms (~10): k-means on (Lab, log depth) -> merged large components, each >=1.5% of frame
     (sky, facade masses, tiers, ground, context). Scored on shape IoU + colour + depth order.
  L2 medium elements (hundreds): every SAM2 mask 0.01%..1.5% of frame + connected components of the two
     brightest colour clusters (catches facade snow patches / icicles SAM merges). Each carries class, bbox,
     Lab, depth, thickness (m), straightness, silhouette roughness. Scored one by one, worst blocks.
  L3 fine detail: NOT per element. 32 px tiles inside each L1 form; per form the key's tile statistics
     (high-pass energy, gradient-orientation entropy, FFT peak ratio, Lab std) -> distribution compared, plus
     DINO patch tokens per form. Scored per L1 form.
Stage gate: check L1 -> only if green check L2 -> only if green check L3 (auto_check.py)."""
import argparse, json, subprocess, sys
from pathlib import Path
import numpy as np
import cv2
from skimage.color import rgb2lab
HERE = Path(__file__).resolve().parent; ROOT = HERE.parents[1]
W = 1024; VENV = "/workspace/.venv-sam2/bin/python"
L1_MIN, L2_MIN, L2_MAX = 0.03, 12 / 1024 ** 2, 0.015


def rough_straight(M):
    cs, _ = cv2.findContours(M.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not cs:
        return 0.0, 0.0
    c = max(cs, key=cv2.contourArea)
    per = cv2.arcLength(c, True); hull = cv2.arcLength(cv2.convexHull(c), True)
    ap = cv2.approxPolyDP(c, 1.5, True)
    seg = np.linalg.norm(np.diff(np.r_[ap[:, 0], ap[:1, 0]], axis=0), axis=1)
    straight = float(seg[seg > 25].sum() / max(per, 1))      # share of outline in long straight runs
    return float(per / max(hull, 1) - 1.0), straight          # roughness = excess perimeter over hull


def thick(M):
    xs = np.nonzero(M.any(0))[0]; runs = []
    for x in xs[:: max(1, len(xs) // 40)]:
        dd = np.diff(np.r_[0, M[:, x].astype(np.int8), 0]); runs += list(np.nonzero(dd == -1)[0] - np.nonzero(dd == 1)[0])
    return float(np.median(runs)) if runs else 0.0


def classify(Lm, cy, Lp, Ap, zt, Zp, top=False):
    """relative-to-image rules, so any key works: sky = farthest depth, ice = most green-cyan a* (top 10%)."""
    if zt is None or zt > Zp or (top and cy < 0.3):
        return "sky"
    return ("snow" if Lm[0] > Lp[85] else "ice" if Lm[1] < Ap[10] and Lm[0] > 25 else
            "dark" if Lm[0] < Lp[10] else "stone")


def tile_stats(gray, M, T=32):
    out = []
    hp = gray - cv2.GaussianBlur(gray, (0, 0), 3)
    gx, gy = cv2.Sobel(gray, cv2.CV_32F, 1, 0), cv2.Sobel(gray, cv2.CV_32F, 0, 1)
    ang = (np.arctan2(gy, gx) % np.pi); mag = np.hypot(gx, gy)
    for y in range(0, W - T + 1, T // 2):
        for x in range(0, W - T + 1, T // 2):
            if M[y:y + T, x:x + T].mean() < 0.8:
                continue
            h = np.histogram(ang[y:y + T, x:x + T], 8, (0, np.pi), weights=mag[y:y + T, x:x + T])[0] + 1e-6; h /= h.sum()
            F = np.abs(np.fft.fft2(gray[y:y + T, x:x + T] - gray[y:y + T, x:x + T].mean())); F[0, 0] = 0
            out.append([float(hp[y:y + T, x:x + T].std()), float(-(h * np.log(h)).sum()),
                        float(F.max() / (F.mean() + 1e-6)), float(gray[y:y + T, x:x + T].std())])
    return np.array(out, np.float32).reshape(-1, 4)


def st_ok(st):
    """a drip: >= 12 px, at least 2x taller than wide"""
    return st[4] >= 12 and st[3] >= 2 * st[2] and st[3] >= 8


def build(key, out, pps=32, sam_npz=None):
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    bgr = cv2.resize(cv2.imread(str(key)), (W, W), interpolation=cv2.INTER_AREA)
    k1024 = out / "key1024.png"; cv2.imwrite(str(k1024), bgr)
    npz = Path(sam_npz) if sam_npz else out / "sam.npz"
    if not npz.exists():
        subprocess.run([VENV, str(HERE / "auto_sam.py"), str(k1024), str(npz), "--pps", str(pps)], check=True)
    d = np.load(npz); shp = tuple(d["shape"]); Z = d["depth"].astype(np.float32)
    S = np.unpackbits(d["masks"], axis=-1)[..., :shp[2]].astype(bool) if shp[0] else np.zeros((0, W, W), bool)
    lab = rgb2lab(bgr[:, :, ::-1] / 255.0).astype(np.float32); L = lab[..., 0]; Lp = np.percentile(L, range(101)); Ap = np.percentile(lab[..., 1], range(101))
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    fy = W / 2 / np.tan(np.radians(60) / 2)   # MoGe metric Z already folds intrinsics; fy only converts run px -> m
    # ---- L1: Lab + depth k-means, merge to big components
    lz = np.log(np.clip(np.nan_to_num(Z, nan=1e3, posinf=1e3), 0.3, 1e3))
    F = np.concatenate([lab / [10, 6, 6], (lz / max(lz.std(), 1e-3))[..., None] * 1.5], -1).reshape(-1, 4).astype(np.float32)
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.2)
    _, _, cen = cv2.kmeans(F[::11], 10, None, crit, 3, cv2.KMEANS_PP_CENTERS)
    CL = ((F[:, None] - cen[None]) ** 2).sum(-1).argmin(1).reshape(W, W).astype(np.uint8)
    CL = cv2.medianBlur(CL, 15)
    # components; absorb every component below L1_MIN into the neighbour it shares most border with
    comp = np.zeros((W, W), np.int32); nxt = 1
    for ci in range(10):
        n, cc = cv2.connectedComponents((CL == ci).astype(np.uint8))
        comp[cc > 0] = cc[cc > 0] + nxt - 1; nxt += n - 1
    for _ in range(6):
        area = np.bincount(comp.ravel(), minlength=nxt)
        small = np.nonzero((area > 0) & (area < L1_MIN * W * W))[0]
        if not len(small):
            break
        for ci in sorted(small, key=lambda c: area[c]):
            m = comp == ci
            if not m.any():
                continue
            ring = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & ~m
            nb = comp[ring]; nb = nb[nb != ci]
            if len(nb):
                comp[m] = np.bincount(nb).argmax()
    l1 = [comp == c for c in np.unique(comp) if (comp == c).sum() >= L1_MIN * W * W]
    l1.sort(key=lambda m: -m.sum())
    # ---- L2: SAM masks in range + bright-cluster components
    _, _, cenc = cv2.kmeans(lab.reshape(-1, 3)[::7], 8, None, crit, 3, cv2.KMEANS_PP_CENTERS)
    CC = ((lab.reshape(-1, 3)[:, None] - cenc[None]) ** 2).sum(-1).argmin(1).reshape(W, W)
    l2 = [("sam2", m) for m in S if L2_MIN * W * W <= m.sum() <= L2_MAX * W * W]
    for ci in np.argsort(-cenc[:, 0])[:2]:
        n, cc, st, _ = cv2.connectedComponentsWithStats((CC == ci).astype(np.uint8))
        l2 += [("bright", cc == i) for i in range(1, n) if L2_MIN * W * W <= st[i][4] <= L2_MAX * W * W]
    # tile/local snow detector: patches brighter than their 12 px surround (snow on stone tops/ledges), any size >= 12 px
    tophat = L - cv2.GaussianBlur(L, (0, 0), 12)
    sm = ((tophat > 7) & (L > Lp[55])).astype(np.uint8)
    sm = cv2.morphologyEx(sm, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    n, cc, st, _ = cv2.connectedComponentsWithStats(sm)
    # drip detector (icicles): bright-ish pixels that survive a vertical opening but not a horizontal one
    brt = (L > Lp[50]).astype(np.uint8)
    vert = cv2.morphologyEx(brt, cv2.MORPH_OPEN, np.ones((9, 1), np.uint8))
    hor = cv2.morphologyEx(brt, cv2.MORPH_OPEN, np.ones((1, 7), np.uint8))
    dr = cv2.morphologyEx(vert & (1 - hor), cv2.MORPH_OPEN, np.ones((5, 1), np.uint8))
    nd, ccd, std_, _ = cv2.connectedComponentsWithStats(dr)
    l2 += [("drip", ccd == i) for i in range(1, nd) if st_ok(std_[i])]
    l2 += [("tophat", cc == i) for i in range(1, n) if L2_MIN * W * W <= st[i][4] <= L2_MAX * W * W]
    # dedupe near-identical L2 masks (IoU > 0.85)
    keep, kb = [], []
    for src, m in sorted(l2, key=lambda t: -t[1].sum()):
        ys, xs = np.nonzero(m); bb = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1); a0 = len(xs); dup = False
        for (_, k), b2 in zip(keep, kb):
            if b2[0] < bb[2] and bb[0] < b2[2] and b2[1] < bb[3] and bb[1] < b2[3] and b2[4] < 1.4 * a0:
                x0, y0, x1, y1 = min(bb[0], b2[0]), min(bb[1], b2[1]), max(bb[2], b2[2]), max(bb[3], b2[3])
                i = (m[y0:y1, x0:x1] & k[y0:y1, x0:x1]).sum()
                if i / (a0 + b2[4] - i) > 0.7:
                    dup = True; break
        if not dup:
            keep.append((src, m)); kb.append(bb + (a0,))
    def desc(m, lvl, i, src):
        ys, xs = np.nonzero(m); Lm = [float(lab[..., c][m].mean()) for c in range(3)]; cy = float(ys.mean()) / W
        z = Z[m]; z = z[np.isfinite(z)]; zt = float(np.median(z)) if len(z) else None
        r, s = rough_straight(m); th = thick(m)
        cls = "ice" if src == "drip" else classify(Lm, cy, Lp, Ap, zt, Zp, int(ys.min()) == 0)
        return {"id": f"L{lvl}-{i:03d}", "level": lvl, "src": src, "class": cls, "kind": "auto",
                "area_frac": round(float(m.sum()) / W / W, 6), "bbox_px": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())],
                "centroid_frac": [round(float(xs.mean()) / W, 4), round(cy, 4)], "lab": [round(v, 2) for v in Lm],
                "L_std": round(float(L[m].std()), 2), "depth_m": None if zt is None else round(zt, 2), "rough": round(r, 4),
                "straight": round(s, 4), "thick_px": round(th, 1), "thick_m": None if zt is None else round(th * zt / fy, 3)}
    zf = Z[np.isfinite(Z)]; Zp = float(np.percentile(zf, 97)) if len(zf) else 1e9
    els, lab1 = [], np.zeros((W, W), np.uint8)
    for i, m in enumerate(l1, 1):
        e = desc(m, 1, i, "kmeans-lab-depth"); ts = tile_stats(gray, m)
        e["L3_tiles"] = int(len(ts)); e["L3_stats"] = {"mean": ts.mean(0).round(4).tolist() if len(ts) else None,
                                                       "std": ts.std(0).round(4).tolist() if len(ts) else None,
                                                       "fields": ["hp_std", "orient_entropy", "fft_peak", "L_std"]}
        els.append(e); lab1[m] = i
    lab2 = np.zeros((W, W), np.uint16); parent = []
    for i, (src, m) in enumerate(keep, 1):
        e = desc(m, 2, i, src); e["parent"] = int(np.bincount(lab1[m], minlength=len(l1) + 1)[1:].argmax() + 1) if len(l1) else 0
        els.append(e); lab2[m & (lab2 == 0)] = i
    cv2.imwrite(str(out / "L1.png"), lab1); cv2.imwrite(str(out / "L2.png"), lab2)
    np.save(out / "depth.npy", Z.astype(np.float16))
    l2m = {e["id"]: None for e in els if e["level"] == 2}
    np.savez_compressed(out / "L2masks.npz", m=np.packbits(np.stack([m for _, m in keep]) if keep else np.zeros((0, W, W), bool), axis=-1))
    sheet = {"zone": "auto", "key": str(Path(key).resolve()), "frame_px": W, "levels": {"L1": "L1.png", "L2": "L2masks.npz"},
             "masks_from": "sam2.1_hiera_small AMG + kmeans(Lab,depth) + kmeans8 bright components", "depth_from": "moge-2 vitl",
             "counts": {"L1": len(l1), "L2": len(keep), "L3_tiles": int(sum(e.get("L3_tiles", 0) for e in els))},
             "elements": els}
    (out / "sheet.json").write_text(json.dumps(sheet, indent=1))
    overlay(bgr, l1, keep, out / "auto-overlay.jpg")
    return sheet


def overlay(bgr, l1, keep, path):
    rng = np.random.default_rng(3); a = bgr.copy().astype(np.float32)
    for m in l1:
        a[m] = a[m] * 0.55 + rng.integers(40, 255, 3) * 0.45
    b = bgr.copy()
    for src, m in keep:
        col = (0, 140, 255) if src == "drip" else (255, 255, 0) if src in ("bright", "tophat") else tuple(int(v) for v in rng.integers(60, 255, 3))
        cs, _ = cv2.findContours(m.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        cv2.drawContours(b, cs, -1, col, 1)
    a = a.astype(np.uint8)
    for im, t in ((a, f"L1 forms: {len(l1)}"), (b, f"L2 elements: {len(keep)} (cyan=snow patches, orange=drips)")):
        cv2.putText(im, t, (12, 34), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 0), 4); cv2.putText(im, t, (12, 34), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)
    cv2.imwrite(str(path), cv2.resize(np.hstack([a, b]), (1600, 800)), [cv2.IMWRITE_JPEG_QUALITY, 80])


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("key"); ap.add_argument("out"); ap.add_argument("--pps", type=int, default=32); ap.add_argument("--sam")
    a = ap.parse_args(); s = build(a.key, a.out, a.pps, a.sam)
    print(json.dumps({"L2_by_src": {k: sum(e.get("src") == k for e in s["elements"]) for k in ("sam2", "bright", "tophat", "drip")}, "counts": s["counts"], "L2_by_class": {c: sum(e["class"] == c for e in s["elements"] if e["level"] == 2) for c in ("snow", "ice", "stone", "dark", "sky")}, "L1_by_class": {c: sum(e["class"] == c for e in s["elements"] if e["level"] == 1) for c in ("snow", "ice", "stone", "dark", "sky")}}))

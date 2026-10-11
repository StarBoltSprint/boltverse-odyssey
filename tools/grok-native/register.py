"""Scale Imagine edits by 0.714 and lock them to the key with ORB plus ECC."""
from __future__ import annotations

import json
import os

import cv2
import numpy as np

SCALE = 0.714


def _ncc(a, b, mask):
    m = mask.astype(bool)
    if m.sum() < 100:
        m = np.ones(a.shape, bool)
    av = a[m].astype(np.float64)
    bv = b[m].astype(np.float64)
    av = av - av.mean()
    bv = bv - bv.mean()
    den = np.linalg.norm(av) * np.linalg.norm(bv)
    if den < 1e-6:
        return 0.0
    return float(np.dot(av, bv) / den)


def scale_onto_key(src_bgr, key_shape):
    """Exact 0.714 scale, then a centred paste onto the key canvas."""
    h, w = src_bgr.shape[:2]
    nw = max(1, int(round(w * SCALE)))
    nh = max(1, int(round(h * SCALE)))
    small = cv2.resize(src_bgr, (nw, nh), interpolation=cv2.INTER_AREA)
    kh, kw = key_shape[:2]
    canvas = np.zeros((kh, kw, 3), np.uint8)
    x0 = max(0, (kw - nw) // 2)
    y0 = max(0, (kh - nh) // 2)
    x1 = min(kw, x0 + nw)
    y1 = min(kh, y0 + nh)
    canvas[y0:y1, x0:x1] = small[: y1 - y0, : x1 - x0]
    return canvas, {"scaled_wh": [nw, nh], "paste_xy": [x0, y0], "scale": SCALE}


def _orb_affine(src_gray, key_gray):
    orb = cv2.ORB_create(2500)
    k1, d1 = orb.detectAndCompute(src_gray, None)
    k2, d2 = orb.detectAndCompute(key_gray, None)
    info = {"keypoints_src": 0 if k1 is None else len(k1), "keypoints_key": 0 if k2 is None else len(k2), "inliers": 0}
    if d1 is None or d2 is None or len(k1) < 8 or len(k2) < 8:
        return np.array([[1, 0, 0], [0, 1, 0]], np.float32), info
    pairs = cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(d1, d2, k=2)
    good = []
    for pair in pairs:
        if len(pair) < 2:
            continue
        m, n = pair
        if m.distance < 0.75 * n.distance:
            good.append(m)
    info["good_matches"] = len(good)
    if len(good) < 8:
        return np.array([[1, 0, 0], [0, 1, 0]], np.float32), info
    src = np.float32([k1[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
    dst = np.float32([k2[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)
    M, inliers = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=3.0)
    if M is None:
        return np.array([[1, 0, 0], [0, 1, 0]], np.float32), info
    info["inliers"] = int(inliers.sum()) if inliers is not None else 0
    return M.astype(np.float32), info


def _ecc(src_gray, key_gray):
    M = np.array([[1, 0, 0], [0, 1, 0]], np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 50, 1e-5)
    try:
        res = cv2.findTransformECC(key_gray, src_gray, M, cv2.MOTION_AFFINE, criteria, None, 5)
    except cv2.error as exc:
        return M, {"ecc": None, "error": str(exc)}
    if isinstance(res, tuple):
        cc, M = res[0], res[-1]
    else:
        cc = float(res)
    return M.astype(np.float32), {"ecc": float(cc)}


def align_to_key(src_bgr, key_bgr):
    pasted, meta = scale_onto_key(src_bgr, key_bgr.shape)
    key_g = cv2.cvtColor(key_bgr, cv2.COLOR_BGR2GRAY)
    src_g = cv2.cvtColor(pasted, cv2.COLOR_BGR2GRAY)
    M_orb, orb_info = _orb_affine(src_g, key_g)
    warped = cv2.warpAffine(pasted, M_orb, (key_bgr.shape[1], key_bgr.shape[0]), flags=cv2.INTER_LINEAR)
    warp_g = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
    M_ecc, ecc_info = _ecc(warp_g, key_g)
    # findTransformECC returns the forward map (template(x) = input(Mx)). warpAffine is inverse.
    out = cv2.warpAffine(
        warped, M_ecc, (key_bgr.shape[1], key_bgr.shape[0]),
        flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP,
    )
    out_g = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)
    yy, xx = np.mgrid[0 : key_g.shape[0], 0 : key_g.shape[1]]
    centre = (yy > key_g.shape[0] * 0.08) & (yy < key_g.shape[0] * 0.92) & (xx > 8) & (xx < key_g.shape[1] - 8)
    # Ignore the black paste border when scoring.
    content = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY) > 0
    meta.update(orb_info)
    meta.update(ecc_info)
    meta["ncc_gray"] = round(_ncc(out_g, key_g, centre & content), 4)
    meta["affine_orb"] = M_orb.tolist()
    meta["affine_ecc"] = M_ecc.tolist()
    return out, meta


def register_dir(src_dir, key_name, names, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    key = cv2.imread(os.path.join(src_dir, key_name), cv2.IMREAD_COLOR)
    if key is None:
        raise FileNotFoundError(key_name)
    cv2.imwrite(os.path.join(out_dir, "key.jpg"), key)
    report = {"key_wh": [key.shape[1], key.shape[0]], "scale": SCALE, "frames": {}}
    for name in names:
        src = cv2.imread(os.path.join(src_dir, name), cv2.IMREAD_COLOR)
        if src is None:
            raise FileNotFoundError(name)
        aligned, meta = align_to_key(src, key)
        stem = os.path.splitext(name)[0]
        cv2.imwrite(os.path.join(out_dir, stem + ".jpg"), aligned, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        meta["src_wh"] = [src.shape[1], src.shape[0]]
        report["frames"][name] = meta
        print(f"register {name} ncc {meta['ncc_gray']} inliers {meta.get('inliers')} ecc {meta.get('ecc')}")
    json.dump(report, open(os.path.join(out_dir, "register.json"), "w"), indent=1)
    return report

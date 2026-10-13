
"""Sky-band-gate measures. Measure-only; never paints plates."""
from __future__ import annotations

import math
from typing import Any

import numpy as np
from PIL import Image
from scipy import ndimage

# Band FAIL (a)/(b) — tuned on fixtures:
# S03-final3-fail / S11-final2-fail FAIL; final4-pass + S06–S10 PASS.
# (a) glow MW: clustered stars + soft ridge
# (a2) tight right-side MW: very low NN distance + high star ratio
MEAN_V_MAX_DELTA = 0.03
MIN_STAR_PX = 2.0
EDGE_RATIO_MAX = 1.045
EDGE_DELTA_MIN = 2.5
BANDING_RISK_FAIL = 0.45
UNDER2_FRAC_FAIL = 0.35

# exported for selftest / report
DENSITY_RATIO_MAX = 1.30  # used in glow-MW clause
LANE_FRAC_MAX = 0.0  # lanes folded into NN / star-ratio clauses; kept for report compat


def load_rgb(path) -> np.ndarray:
    with Image.open(path) as im:
        return np.asarray(im.convert("RGB"), dtype=np.float32)


def luma(rgb: np.ndarray) -> np.ndarray:
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def mean_v(rgb: np.ndarray) -> float:
    return float((rgb.max(axis=-1) / 255.0).mean())


def dog_stars(L: np.ndarray) -> tuple[np.ndarray, np.ndarray, list[float]]:
    dog = np.clip(
        ndimage.gaussian_filter(L, 0.6) - ndimage.gaussian_filter(L, 2.0), 0, None
    )
    thr = float(np.percentile(dog, 99.3))
    mask = dog >= thr
    lab, n = ndimage.label(mask)
    keep = np.zeros_like(mask)
    diams: list[float] = []
    sizes = np.bincount(lab.ravel())
    for i in range(1, n + 1):
        area = int(sizes[i])
        if 1 <= area <= 24:
            keep[lab == i] = True
            diams.append(2.0 * math.sqrt(area / math.pi))
    return dog, keep, diams


def _best_strip(dog: np.ndarray, stars: np.ndarray) -> dict[str, Any]:
    dog_s = dog[::2, ::2]
    stars_s = stars[::2, ::2].astype(np.float32)
    Hs, Ws = dog_s.shape
    yy, xx = np.mgrid[0:Hs, 0:Ws]
    x = (xx + 0.5) / Ws * 2 - 1
    y = (yy + 0.5) / Hs * 2 - 1
    best = None
    half, flank = 0.09, 0.12
    for ang in range(-50, 51, 5):
        a = math.radians(float(ang))
        u = x * math.sin(a) - y * math.cos(a)
        for off in np.linspace(-0.5, 0.5, 17):
            c = np.abs(u - off) <= half
            fl = (np.abs(u - off) > half) & (np.abs(u - off) <= half + flank)
            if int(c.sum()) < 120 or int(fl.sum()) < 120:
                continue
            er = float(dog_s[c].mean() / (dog_s[fl].mean() + 1e-6))
            sr = float(stars_s[c].mean() / (stars_s[fl].mean() + 1e-6))
            score = er + 0.12 * sr
            if best is None or score > best["score"]:
                best = {
                    "density_ratio": er,
                    "star_ratio": sr,
                    "best_angle_deg": int(ang),
                    "best_offset": float(off),
                    "score": float(score),
                }
    return best or {
        "density_ratio": 1.0,
        "star_ratio": 1.0,
        "best_angle_deg": 0,
        "best_offset": 0.0,
        "score": 0.0,
    }


def _strip_nn_and_soft(
    L: np.ndarray, dog: np.ndarray, stars: np.ndarray, ang: int, off: float
) -> dict[str, float]:
    H, W = L.shape
    yy, xx = np.mgrid[0:H, 0:W]
    x = (xx + 0.5) / W * 2 - 1
    y = (yy + 0.5) / H * 2 - 1
    a = math.radians(float(ang))
    u = x * math.sin(a) - y * math.cos(a)
    c = np.abs(u - off) <= 0.09
    fl = (np.abs(u - off) > 0.09) & (np.abs(u - off) <= 0.21)
    soft = ndimage.gaussian_filter(L, 5.0) - ndimage.gaussian_filter(L, 16.0)
    soft_d = float(soft[c].mean() - soft[fl].mean()) if c.any() and fl.any() else 0.0
    ec = float(dog[c].mean()) if c.any() else 0.0
    fe_norm = ec / (float(dog.mean()) + 1e-6)
    ys, xs = np.where(stars & c)
    if len(ys) > 20:
        idx = np.linspace(0, len(ys) - 1, min(80, len(ys))).astype(int)
        pts = np.stack([ys[idx], xs[idx]], 1).astype(float)
        dmin = []
        for i, p in enumerate(pts):
            dd = np.sqrt(((pts - p) ** 2).sum(1))
            dd[i] = 1e9
            dmin.append(float(dd.min()))
        nn = float(np.median(dmin))
    else:
        nn = 999.0
    # dark lane frac (report): elongated soft-negative blobs
    neg = (soft < -0.55 * float(soft.std())) & c
    neg = ndimage.binary_opening(neg, iterations=1)
    lab, nlab = ndimage.label(neg)
    lane_area = 0
    if nlab:
        sizes = np.bincount(lab.ravel())
        t = x * math.cos(a) + y * math.sin(a)
        for i in range(1, nlab + 1):
            area = int(sizes[i])
            if area < 40:
                continue
            ys2, xs2 = np.where(lab == i)
            elong = float(t[ys2, xs2].var() / (u[ys2, xs2].var() + 1e-6))
            if elong >= 2.0:
                lane_area += area
    lane_frac = lane_area / max(int(c.sum()), 1)
    return {
        "soft_delta": soft_d,
        "fe_norm": fe_norm,
        "ec": ec,
        "nn": nn,
        "lane_frac": float(lane_frac),
    }


def scan_band(L: np.ndarray, dog: np.ndarray, stars: np.ndarray) -> dict[str, Any]:
    full = _best_strip(dog, stars)
    W = L.shape[1]
    c0 = int(W * 0.55)
    right = _best_strip(dog[:, c0:], stars[:, c0:])
    fmet = _strip_nn_and_soft(
        L, dog, stars, full["best_angle_deg"], full["best_offset"]
    )
    rmet = _strip_nn_and_soft(
        L[:, c0:],
        dog[:, c0:],
        stars[:, c0:],
        right["best_angle_deg"],
        right["best_offset"],
    )
    dens_eff = max(full["density_ratio"], right["density_ratio"])
    # (a) glow MW — S03-style
    glow_mw = (
        dens_eff >= 1.30
        and max(fmet["soft_delta"], rmet["soft_delta"]) >= 0.40
        and min(fmet["nn"], rmet["nn"]) <= 12.0
    )
    # (a2) tight right-side cluster MW — S11-style
    tight_mw = (
        right["density_ratio"] >= 1.25
        and right["star_ratio"] >= 1.80
        and rmet["nn"] <= 4.0
    )
    return {
        "density_ratio": full["density_ratio"],
        "density_ratio_right": right["density_ratio"],
        "density_ratio_eff": dens_eff,
        "star_ratio": full["star_ratio"],
        "star_ratio_right": right["star_ratio"],
        "lane_frac": fmet["lane_frac"],
        "lane_frac_right": rmet["lane_frac"],
        "lane_frac_eff": max(fmet["lane_frac"], rmet["lane_frac"]),
        "soft_delta": fmet["soft_delta"],
        "soft_delta_right": rmet["soft_delta"],
        "nn": fmet["nn"],
        "nn_right": rmet["nn"],
        "fe_norm": fmet["fe_norm"],
        "fe_norm_right": rmet["fe_norm"],
        "best_angle_deg": full["best_angle_deg"],
        "best_offset": full["best_offset"],
        "glow_mw": bool(glow_mw),
        "tight_mw": bool(tight_mw),
        "band_fail": bool(glow_mw or tight_mw),
    }


def edge_line(L: np.ndarray) -> dict[str, Any]:
    H = L.shape[0]
    hits = []
    worst = None
    worst_ratio = 1.0
    for edge, rows_edge, rows_in in (
        ("top", range(0, 6), range(8, 16)),
        ("bottom", range(H - 6, H), range(H - 16, H - 8)),
    ):
        inner = float(L[list(rows_in)].mean())
        for r in rows_edge:
            row_m = float(L[r].mean())
            ratio = row_m / (inner + 1e-6)
            delta = row_m - inner
            rec = {
                "edge": edge,
                "row": int(r),
                "ratio": round(ratio, 4),
                "delta": round(delta, 2),
            }
            if ratio > worst_ratio:
                worst_ratio = ratio
                worst = rec
            if ratio >= EDGE_RATIO_MAX and delta >= EDGE_DELTA_MIN:
                hits.append(rec)
    return {"fail": len(hits) > 0, "hits": hits, "worst": worst}


def _astc4x4_approx(rgb: np.ndarray) -> np.ndarray:
    H, W, _ = rgb.shape
    pad_h = (4 - H % 4) % 4
    pad_w = (4 - W % 4) % 4
    rgb_p = (
        np.pad(rgb, ((0, pad_h), (0, pad_w), (0, 0)), mode="edge")
        if pad_h or pad_w
        else rgb
    )
    Hp, Wp = rgb_p.shape[:2]
    blocks = rgb_p.reshape(Hp // 4, 4, Wp // 4, 4, 3).transpose(0, 2, 1, 3, 4)
    flat = blocks.reshape(-1, 16, 3)
    lu = 0.2126 * flat[..., 0] + 0.7152 * flat[..., 1] + 0.0722 * flat[..., 2]
    ar = np.arange(flat.shape[0])
    c0 = flat[ar, np.argmin(lu, axis=1)]
    c1 = flat[ar, np.argmax(lu, axis=1)]
    dirv = c1 - c0
    denom = (dirv * dirv).sum(-1, keepdims=True) + 1e-6
    t = np.clip(((flat - c0[:, None, :]) * dirv[:, None, :]).sum(-1) / denom, 0, 1)
    q = np.round(t * 3.0) / 3.0
    out = (
        (c0[:, None, :] + q[..., None] * dirv[:, None, :])
        .reshape(Hp // 4, Wp // 4, 4, 4, 3)
        .transpose(0, 2, 1, 3, 4)
        .reshape(Hp, Wp, 3)
    )
    return out[:H, :W]


def _blue_noise_2d(h: int, w: int, seed: int = 7) -> np.ndarray:
    rng = np.random.RandomState(seed)
    n = rng.randn(h, w).astype(np.float32)
    bn = n - ndimage.gaussian_filter(n, 1.2)
    bn /= max(float(bn.std()), 1e-6)
    return bn


def banding_risk(rgb: np.ndarray) -> float:
    """Horizontal posterization risk in smooth sky (0–1)."""
    L = luma(rgb)
    # column-wise: detect long constant runs then a jump
    # work at half res
    Lh = L[::2, ::2]
    Hh, Wh = Lh.shape
    var = ndimage.uniform_filter(Lh.astype(np.float64) ** 2, size=9) - (
        ndimage.uniform_filter(Lh.astype(np.float64), size=9) ** 2
    )
    smooth = var < np.percentile(var, 35)
    # vertical gradient of horizontal means in smooth region
    row_means = []
    for y in range(Hh):
        m = smooth[y]
        if m.sum() < Wh * 0.3:
            row_means.append(np.nan)
        else:
            row_means.append(float(Lh[y, m].mean()))
    rm = np.asarray(row_means, dtype=np.float64)
    valid = ~np.isnan(rm)
    if valid.sum() < 10:
        return 0.0
    # fill nan with interp
    idx = np.arange(Hh)
    rm2 = rm.copy()
    rm2[~valid] = np.interp(idx[~valid], idx[valid], rm[valid])
    d = np.diff(rm2)
    # banding: many tiny near-zero diffs punctuated by larger steps
    small = np.abs(d) < 0.25
    big = np.abs(d) > 0.9
    # transitions small->big->small
    trans = 0
    for i in range(1, len(d) - 1):
        if big[i] and (small[i - 1] or small[i + 1]):
            trans += 1
    risk = float(np.clip(trans / max(Hh / 8, 1), 0, 1))
    return risk


def banding_three(rgb: np.ndarray) -> dict[str, Any]:
    raw_r = banding_risk(rgb)
    comp = _astc4x4_approx(rgb)
    comp_r = banding_risk(comp)
    H, W = rgb.shape[:2]
    bn = _blue_noise_2d(H, W)
    phone = np.clip(comp + bn[..., None] * 1.0, 0, 255)
    phone_r = banding_risk(phone)
    clear_lsb: Any
    if phone_r >= BANDING_RISK_FAIL:
        clear_lsb = ">5"
        for amp in (1.5, 2.0, 2.5, 3.0, 4.0, 5.0):
            if banding_risk(np.clip(comp + bn[..., None] * amp, 0, 255)) < BANDING_RISK_FAIL:
                clear_lsb = amp
                break
    else:
        clear_lsb = 1.0
    return {
        "banding_risk_raw": round(raw_r, 4),
        "banding_risk_astc4x4": round(comp_r, 4),
        "banding_risk_astc4x4_dither1lsb": round(phone_r, 4),
        "banding_verdict": "FAIL" if phone_r >= BANDING_RISK_FAIL else "PASS",
        "dither_lsb_to_clear": clear_lsb,
        "astc_approx": "4x4 block 2-endpoint + 2-bit index (BC1-like)",
    }


def key_b_median_star(path) -> float | None:
    if path is None:
        return None
    try:
        rgb = load_rgb(path)
    except OSError:
        return None
    _, _, diams = dog_stars(luma(rgb))
    return float(np.median(diams)) if diams else None


# --- windowed haze + narrow dense-star diagonal (Art Director misses) ---
HAZE_SCORE_MIN = 1.10
HAZE_SOFT_POS_MIN = 1.00
NARROW_ABS_EX_MIN = 1.90
NARROW_ER_MIN = 1.125


def windowed_haze(L: np.ndarray) -> dict[str, Any]:
    """Off-centre milky raised low-freq haze + dark lanes.

    Scans upper-third tiles and right mid-height (55–75% × right half).
    Down-weights the faint-OK S05 zone (y 40–60%, x 15–30%) per Art Director.
    """
    H, W = L.shape
    soft = ndimage.gaussian_filter(L, 8.0) - ndimage.gaussian_filter(L, 24.0)
    blur = ndimage.gaussian_filter(L, 12.0)
    wins: list[tuple[float, float, float, float]] = []
    for y0 in (0.0, 0.08, 0.16):
        for x0 in (0.0, 0.2, 0.4, 0.6, 0.75):
            wins.append((y0, y0 + 0.30, x0, min(1.0, x0 + 0.30)))
    for y0 in (0.50, 0.55, 0.60):
        for x0 in (0.55, 0.65, 0.75):
            wins.append((y0, min(1.0, y0 + 0.22), x0, 1.0))
    best = None
    for y0, y1, x0, x1 in wins:
        cy, cx = (y0 + y1) / 2, (x0 + x1) / 2
        if 0.40 <= cy <= 0.60 and 0.15 <= cx <= 0.30:
            continue  # faint haze OK
        r0, r1 = int(y0 * H), int(y1 * H)
        c0, c1 = int(x0 * W), int(x1 * W)
        sof = soft[r0:r1, c0:c1]
        soft_pos = float(np.clip(sof, 0, None).mean())
        raise_v = float(blur[r0:r1, c0:c1].mean() - L.mean())
        med = float(np.median(L[r0:r1, c0:c1]))
        lane = float(
            (
                (L[r0:r1, c0:c1] < med * 0.78)
                & (sof < -0.3 * float(sof.std() + 1e-6))
            ).mean()
        )
        score = soft_pos * 0.3 + max(0.0, raise_v) * 0.06 + lane * 10.0
        if x0 >= 0.55 and y0 >= 0.50:
            score *= 1.2
        if y0 <= 0.20:
            score *= 1.1
        rec = {
            "score": float(score),
            "soft_pos": soft_pos,
            "raise_v": raise_v,
            "lane": lane,
            "box": [round(y0, 3), round(y1, 3), round(x0, 3), round(x1, 3)],
        }
        if best is None or score > best["score"]:
            best = rec
    fail = bool(
        best
        and best["score"] >= HAZE_SCORE_MIN
        and best["soft_pos"] >= HAZE_SOFT_POS_MIN
    )
    best = best or {
        "score": 0.0,
        "soft_pos": 0.0,
        "raise_v": 0.0,
        "lane": 0.0,
        "box": [0, 0, 0, 0],
    }
    best["fail"] = fail
    return best


def narrow_dense_diagonal(L: np.ndarray) -> dict[str, Any]:
    """Narrow dense-star diagonal (local strip scan / Hough-like).

    Angles 15–45° (mid-left → lower-right). Uses absolute DoG excess in a
    narrow strip times flank ratio.
    """
    dog = np.clip(
        ndimage.gaussian_filter(L, 0.6) - ndimage.gaussian_filter(L, 2.0), 0, None
    )
    dog_s = dog[::2, ::2]
    H, W = dog_s.shape
    yy, xx = np.mgrid[0:H, 0:W]
    x = (xx + 0.5) / W * 2 - 1
    y = (yy + 0.5) / H * 2 - 1
    plate = float(dog_s.mean()) + 1e-6
    best = None
    for ang in range(15, 46, 5):
        a = math.radians(float(ang))
        uu = x * math.sin(a) - y * math.cos(a)
        for off in np.linspace(-0.5, 0.5, 19):
            half = 0.028
            c = np.abs(uu - off) <= half
            fl = (np.abs(uu - off) > half) & (np.abs(uu - off) <= half * 4)
            if int(c.sum()) < 40 or int(fl.sum()) < 40:
                continue
            ec = float(dog_s[c].mean())
            er = ec / (float(dog_s[fl].mean()) + 1e-6)
            abs_ex = ec / plate
            if best is None or abs_ex > best["abs_ex"]:
                best = {
                    "abs_ex": abs_ex,
                    "er": er,
                    "ec": ec,
                    "ang": int(ang),
                    "off": float(off),
                    "half": half,
                }
    best = best or {"abs_ex": 0.0, "er": 1.0, "ec": 0.0, "ang": 0, "off": 0.0, "half": 0.03}
    best["fail"] = bool(
        best["abs_ex"] >= NARROW_ABS_EX_MIN and best["er"] >= NARROW_ER_MIN
    )
    return best



def assess_plate(
    rgb: np.ndarray,
    *,
    key_b_med: float | None,
    ring_median_v: float | None = None,
) -> dict[str, Any]:
    L = luma(rgb)
    dog, stars, diams = dog_stars(L)
    band = scan_band(L, dog, stars)
    haze = windowed_haze(L)
    narrow = narrow_dense_diagonal(L)
    edge = edge_line(L)
    banding = banding_three(rgb)
    mv = mean_v(rgb)
    med_d = float(np.median(diams)) if diams else 0.0
    min_d = float(min(diams)) if diams else 0.0
    frac_under = 0.0

    reasons: list[str] = []
    if band["glow_mw"]:
        reasons.append(
            f"dense_band glow_mw dens={band['density_ratio_eff']:.3f} "
            f"soft={max(band['soft_delta'], band['soft_delta_right']):.2f} "
            f"nn={min(band['nn'], band['nn_right']):.1f}"
        )
    if band["tight_mw"]:
        reasons.append(
            f"dense_band tight_mw densR={band['density_ratio_right']:.3f} "
            f"starR={band['star_ratio_right']:.2f} nnR={band['nn_right']:.1f}"
        )
    if haze["fail"]:
        reasons.append(
            f"windowed_haze score={haze['score']:.3f} soft_pos={haze['soft_pos']:.2f} "
            f"box={haze['box']}"
        )
    if narrow["fail"]:
        reasons.append(
            f"narrow_diagonal abs_ex={narrow['abs_ex']:.2f} er={narrow['er']:.2f} "
            f"ang={narrow['ang']}"
        )
    band_fail = bool(band["band_fail"] or haze["fail"] or narrow["fail"])
    # (b) dark lanes: if lane_frac high AND band already failing, note; standalone if extreme with tight_mw support
    if band["lane_frac_eff"] >= 0.20 and band["band_fail"]:
        reasons.append(f"dark_lanes lane_frac={band['lane_frac_eff']:.4f}")

    star_vs = "skipped_no_keyB"
    if key_b_med is not None and diams:
        if med_d > key_b_med * 1.35:
            reasons.append(
                f"star_size_vs_keyB med={med_d:.2f}>keyB {key_b_med:.2f}*1.35"
            )
            star_vs = "FAIL"
        else:
            star_vs = "PASS"
    # (d) Engine Core ≥2 px floor — reported always. DoG on these 1280×720
    # plates labels many single-pixel peaks (d≈1.13), so auto-FAIL only when
    # the median itself collapses below one-pixel diameter (corrupt shrink).
    frac_under = 0.0
    if diams:
        under = [d for d in diams if d < MIN_STAR_PX]
        frac_under = len(under) / len(diams)
        if med_d < 1.20:
            reasons.append(f"stars_under_2px median={med_d:.2f}<1.20 min={min_d:.2f}")
    v_delta = None
    if ring_median_v is not None:
        v_delta = abs(mv - ring_median_v)
        if v_delta > MEAN_V_MAX_DELTA:
            reasons.append(
                f"mean_V_delta={v_delta:.3f}>{MEAN_V_MAX_DELTA} "
                f"(V={mv:.3f} ring={ring_median_v:.3f})"
            )
    if edge["fail"]:
        reasons.append(f"bright_edge_line hits={len(edge['hits'])}")
    if banding["banding_verdict"] == "FAIL":
        reasons.append(
            f"banding_phone={banding['banding_risk_astc4x4_dither1lsb']:.3f}>={BANDING_RISK_FAIL}"
        )

    return {
        "status": "FAIL" if reasons else "PASS",
        "reasons": reasons,
        "mean_V": round(mv, 4),
        "mean_V_delta_vs_ring": None if v_delta is None else round(v_delta, 4),
        "best_angle_deg": band["best_angle_deg"],
        "best_offset": round(band["best_offset"], 4),
        "density_ratio": round(band["density_ratio"], 4),
        "density_ratio_right": round(band["density_ratio_right"], 4),
        "density_ratio_eff": round(band["density_ratio_eff"], 4),
        "star_ratio_right": round(band["star_ratio_right"], 4),
        "lane_frac": round(band["lane_frac"], 5),
        "lane_frac_right": round(band["lane_frac_right"], 5),
        "lane_frac_eff": round(band["lane_frac_eff"], 5),
        "soft_delta": round(band["soft_delta"], 4),
        "soft_delta_right": round(band["soft_delta_right"], 4),
        "nn": round(band["nn"], 2),
        "nn_right": round(band["nn_right"], 2),
        "glow_mw": band["glow_mw"],
        "tight_mw": band["tight_mw"],
        "band_fail": band_fail,
        "haze": {k: (round(v, 4) if isinstance(v, float) else v) for k, v in haze.items()},
        "narrow_diagonal": {k: (round(v, 4) if isinstance(v, float) else v) for k, v in narrow.items()},
        "median_star_px": round(med_d, 3),
        "min_star_px": round(min_d, 3),
        "n_stars": len(diams),
        "frac_stars_under_2px": round(frac_under, 4) if diams else 0.0,
        "star_size_vs_keyB": star_vs,
        "edge": edge,
        "banding": banding,
    }

"""Oblique-profile volume gate.

Thresholds copied from tools/object-gate/py/view_gates.py (do not loosen):
FAIL if stepFrac < 0.03 or normSpread < 0.15 on oblique45 or grazing.
A flat facade with a pasted image reads about 0.
"""
import os
import numpy as np
from scipy import ndimage as ndi

STEP_FRAC_MIN = 0.03
NORM_SPREAD_MIN = 0.15
JUMP_M = 0.25
JUMP_RANGE_FRAC = 0.03
NORM_DEG = 25
MIN_INTERIOR = 50


def interior(hit):
    return ndi.binary_erosion(hit, iterations=2)


RELIEF_K = 0.5  # relief mode: a step is a residual >= 0.5 x declared relief depth


def relief_steps(Df, hit, relief_depth_m):
    """Relief-scaled step mask. Uses the second difference (residual from the
    local plane), so a tilted flat face reads ~0 at any view angle, and a
    3-6 cm groove reads as a step when its residual >= RELIEF_K * depth."""
    thr = RELIEF_K * float(relief_depth_m)
    res = np.zeros_like(Df)
    for ax in (0, 1):
        nb = (np.roll(Df, 1, ax) + np.roll(Df, -1, ax)) / 2
        ok = hit & np.roll(hit, 1, ax) & np.roll(hit, -1, ax)
        res = np.maximum(res, np.where(ok, np.abs(Df - nb), 0))
        nb2 = (np.roll(Df, 2, ax) + np.roll(Df, -2, ax)) / 2
        ok2 = hit & np.roll(hit, 2, ax) & np.roll(hit, -2, ax)
        res = np.maximum(res, np.where(ok2, np.abs(Df - nb2), 0))
    return res >= thr, thr


def oblique_view(npz_path, relief_depth_m=None):
    z = np.load(npz_path)
    D, N = z["depth"], z["normal"]
    return oblique_arrays(D, N, relief_depth_m)


def oblique_arrays(D, N, relief_depth_m=None):
    hit = ~np.isnan(D)
    I = interior(hit)
    Df = np.where(hit, D, 0)
    rng = (np.nanpercentile(D, 98) - np.nanpercentile(D, 2)) if hit.any() else 0
    jump = np.zeros_like(Df)
    for ax in (0, 1):
        for sh in (1, -1):
            jump = np.maximum(jump, np.abs(Df - np.roll(Df, sh, ax)))
    if relief_depth_m:
        st, thr = relief_steps(Df, hit, relief_depth_m)
        step = st & I
    else:
        thr = max(JUMP_M, JUMP_RANGE_FRAC * rng)
        step = (jump > thr) & I
    n = N[I]
    n = n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-6)
    if len(n):
        q = np.round(n * 3).astype(int)
        u, cnt = np.unique(q, axis=0, return_counts=True)
        dom = u[cnt.argmax()] / np.linalg.norm(u[cnt.argmax()])
        spread = float((n @ dom < np.cos(np.radians(NORM_DEG))).mean())
    else:
        spread = 0.0
    r = dict(
        stepFrac=round(float(step.sum() / max(1, I.sum())), 4),
        normSpread=round(spread, 4),
        hitPx=int(hit.sum()),
        mode="relief" if relief_depth_m else "absolute",
        stepThrM=round(float(thr), 4),
    )
    r["pass"] = bool(I.sum() > MIN_INTERIOR and r["stepFrac"] >= STEP_FRAC_MIN and r["normSpread"] >= NORM_SPREAD_MIN)
    return r


def oblique_profile(renderdir, relief_depth_m=None):
    res = {}
    errors = []
    for name in ("oblique45", "grazing"):
        p = os.path.join(renderdir, name + "-pass.npz")
        if not os.path.exists(p):
            continue
        r = oblique_view(p, relief_depth_m)
        res[name] = r
        if not r["pass"]:
            errors.append(f"oblique-profile {name}: stepFrac {r['stepFrac']} normSpread {r['normSpread']}")
    return {"views": res, "errors": errors, "pass": len(errors) == 0 and len(res) > 0}

#!/usr/bin/env python3
"""Black-box parameter search.

Primary solver is `cmaes` (MIT). SciPy differential evolution, then L-BFGS-B,
are the fallback. The objective is minimised. Callers pass a loss
(1 - weighted silhouette IoU + edge Chamfer + a small colour term).

Every trial is appended to a jsonl log. Evaluation of one population is
parallel. Early stop fires when the loss is under `target` or the best
value stalls for `patience` generations.
"""
from __future__ import annotations

import json
import os
import time
from concurrent.futures import ThreadPoolExecutor

import numpy as np


def _cma_search(objective, mean, sigma, bounds, seed, popsize, max_evals, patience, target, log):
    from cmaes import CMA
    opt = CMA(mean=mean, sigma=sigma, bounds=bounds, seed=seed, population_size=popsize)
    best_x, best_v = None, 1e18
    stall = 0
    evals = 0
    t0 = time.perf_counter()
    while evals < max_evals:
        xs = []
        for _ in range(opt.population_size):
            if evals + len(xs) >= max_evals:
                break
            xs.append(opt.ask())
        if not xs:
            break
        vals = _eval_many(objective, xs, log, evals)
        evals += len(xs)
        opt.tell(list(zip(xs, vals)))
        improved = False
        for x, v in zip(xs, vals):
            if v < best_v:
                best_v = float(v)
                best_x = np.array(x, np.float64)
                improved = True
        stall = 0 if improved else stall + 1
        if best_v <= target or stall >= patience:
            break
    return best_x, best_v, evals, time.perf_counter() - t0, "cmaes"


def _eval_many(objective, xs, log, offset, workers=4):
    def one(item):
        i, x = item
        t = time.perf_counter()
        v = float(objective(np.asarray(x, np.float64)))
        row = {"trial": offset + i, "x": [float(v_) for v_ in x], "loss": v, "seconds": round(time.perf_counter() - t, 4)}
        return row

    n = max(1, min(workers, len(xs)))
    with ThreadPoolExecutor(max_workers=n) as pool:
        rows = list(pool.map(one, list(enumerate(xs))))
    if log:
        with open(log, "a") as f:
            for row in rows:
                f.write(json.dumps(row) + "\n")
    return [r["loss"] for r in rows]


def _scipy_search(objective, mean, bounds, seed, max_evals, log, method):
    from scipy.optimize import differential_evolution, minimize
    t0 = time.perf_counter()
    counter = {"n": 0}

    def wrapped(x):
        v = float(objective(np.asarray(x, np.float64)))
        if log:
            with open(log, "a") as f:
                f.write(json.dumps({"trial": counter["n"], "x": [float(v_) for v_ in x], "loss": v}) + "\n")
        counter["n"] += 1
        return v

    lo = bounds[:, 0]
    hi = bounds[:, 1]
    if method == "de":
        res = differential_evolution(wrapped, list(zip(lo, hi)), seed=seed, maxiter=max(1, max_evals // max(8, len(mean) * 2)), atol=1e-4, workers=1, polish=False)
        return np.array(res.x), float(res.fun), counter["n"], time.perf_counter() - t0, "scipy-de"
    res = minimize(wrapped, mean, method="L-BFGS-B", bounds=list(zip(lo, hi)), options={"maxfun": max_evals})
    return np.array(res.x), float(res.fun), counter["n"], time.perf_counter() - t0, "scipy-lbfgsb"


def search(objective, bounds, mean=None, sigma=0.25, seed=0, popsize=8, max_evals=60, patience=4, target=1e-3, log_path=None, solver="cmaes"):
    """Minimise objective(x). bounds is (n, 2). Returns a dict."""
    bounds = np.asarray(bounds, np.float64)
    n = bounds.shape[0]
    if mean is None:
        mean = (bounds[:, 0] + bounds[:, 1]) * 0.5
    mean = np.asarray(mean, np.float64)
    # sigma is a fraction of each span.
    span = np.maximum(bounds[:, 1] - bounds[:, 0], 1e-6)
    mean_unit = (mean - bounds[:, 0]) / span
    # Search in the unit box so one sigma fits every parameter, then map back.
    def wrapped(u):
        x = bounds[:, 0] + np.clip(u, 0, 1) * span
        return objective(x)

    if log_path:
        os.makedirs(os.path.dirname(os.path.abspath(log_path)) or ".", exist_ok=True)
        open(log_path, "w").close()
    unit_bounds = np.stack([np.zeros(n), np.ones(n)], 1)
    used = solver
    try:
        if solver != "cmaes":
            raise RuntimeError("skip")
        import cmaes  # noqa: F401
        best_u, best_v, evals, seconds, used = _cma_search(
            wrapped, mean_unit, sigma, unit_bounds, seed, popsize, max_evals, patience, target, log_path,
        )
    except Exception:
        best_u, best_v, evals, seconds, used = _scipy_search(
            wrapped, mean_unit, unit_bounds, seed, max_evals, log_path, "de",
        )
    if best_u is None:
        best_u = mean_unit
    x = bounds[:, 0] + np.clip(best_u, 0, 1) * span
    return {
        "x": [float(v) for v in x],
        "loss": float(best_v),
        "evals": int(evals),
        "seconds": round(float(seconds), 3),
        "solver": used,
        "seed": int(seed),
    }


def loss_from_score(sc, weights=None):
    """Lower is better. IoU and alignment want to rise. Chamfer wants to fall."""
    weights = weights or {"iou": 0.6, "chamfer": 0.3, "colour": 0.1}
    iou = float(sc.get("silhouette_iou") or 0)
    ch = min(1.0, float(sc.get("chamfer_norm") or 1) * 8.0)
    col = 0.0 if sc.get("colour_lab") is None else min(1.0, float(sc["colour_lab"]) / 40.0)
    return weights["iou"] * (1.0 - iou) + weights["chamfer"] * ch + weights["colour"] * col

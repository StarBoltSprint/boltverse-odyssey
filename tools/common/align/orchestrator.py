#!/usr/bin/env python3
"""Small process-pool orchestrator for object jobs.

Each job gets a budget in seconds and stops early when the loss does not
improve for `patience` trials. One jsonl row per trial.
"""
from __future__ import annotations

import json
import os
import time
from concurrent.futures import ProcessPoolExecutor, as_completed


def _run_job(spec):
    name = spec["name"]
    budget = float(spec.get("budget_s", 30))
    patience = int(spec.get("patience", 4))
    trials = spec.get("trials") or []
    log_path = spec["log_path"]
    t0 = time.perf_counter()
    best = None
    stale = 0
    rows = []
    stopped = "end"
    for i, loss in enumerate(trials):
        if time.perf_counter() - t0 > budget:
            stopped = "budget"
            break
        loss = float(loss)
        improved = best is None or loss < best - 1e-6
        if improved:
            best = loss
            stale = 0
        else:
            stale += 1
        row = {"job": name, "trial": i, "loss": loss, "best": best, "stale": stale}
        rows.append(row)
        with open(log_path, "a") as f:
            f.write(json.dumps(row) + "\n")
        if stale >= patience:
            stopped = "plateau"
            break
    return {
        "name": name,
        "best": best,
        "trials_run": len(rows),
        "stopped": stopped,
        "seconds": round(time.perf_counter() - t0, 4),
    }


def run(jobs, log_path, workers=2):
    os.makedirs(os.path.dirname(log_path) or ".", exist_ok=True)
    open(log_path, "w").close()
    specs = []
    for job in jobs:
        specs.append({**job, "log_path": log_path})
    out = []
    with ProcessPoolExecutor(max_workers=max(1, int(workers))) as pool:
        futs = [pool.submit(_run_job, spec) for spec in specs]
        for fut in as_completed(futs):
            out.append(fut.result())
    out.sort(key=lambda r: r["name"])
    return out

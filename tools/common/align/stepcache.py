#!/usr/bin/env python3
"""Disk cache for an expensive stage, keyed by image bytes and params.

The value is a numpy array or a JSON-able object. A second call with the
same key does not recompute. The report is the two timings.
"""
from __future__ import annotations

import hashlib
import json
import os
import time

import numpy as np


def _key(image_bytes, params):
    h = hashlib.sha256()
    h.update(image_bytes if isinstance(image_bytes, (bytes, bytearray)) else bytes(image_bytes))
    h.update(json.dumps(params, sort_keys=True, default=str).encode())
    return h.hexdigest()[:24]


def get_or_compute(directory, image_bytes, params, compute):
    """compute() returns a numpy array. The second call reads the file."""
    os.makedirs(directory, exist_ok=True)
    digest = _key(image_bytes, params)
    path = os.path.join(directory, digest + ".npy")
    meta = os.path.join(directory, digest + ".json")
    t0 = time.perf_counter()
    hit = os.path.isfile(path)
    if hit:
        value = np.load(path)
    else:
        value = np.asarray(compute())
        np.save(path, value)
        json.dump({"params": params, "shape": list(value.shape)}, open(meta, "w"))
    return {
        "value": value,
        "hit": hit,
        "seconds": round(time.perf_counter() - t0, 4),
        "key": digest,
    }


def nearest(library, params, weights=None):
    """library is a list of {params, id}. Distance is weighted L2 on shared keys."""
    if not library:
        return None
    keys = list(params.keys())
    w = weights or {k: 1.0 for k in keys}
    best = None
    best_d = 1e18
    for row in library:
        p = row["params"]
        acc = 0.0
        for k in keys:
            if k not in p:
                continue
            acc += float(w.get(k, 1.0)) * (float(p[k]) - float(params[k])) ** 2
        if acc < best_d:
            best_d = acc
            best = row
    return {"id": best["id"], "distance": round(float(best_d) ** 0.5, 4), "params": best["params"]}

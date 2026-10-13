#!/usr/bin/env python3
"""Detail-layer pass: dirt, accumulated snow, cracks, moss as mask layers + decals, driven by key masks.

  python3 tools/scatter/detail.py run --spec detail.json --out out/

Each layer = a 0..1 mask (PNG, same UV/extent as the surface) that the shader blends over the base
material, plus optional decals (position, size, yaw) sampled where the mask is strongest.
Sources per layer: a key mask path (SAM/colour), optional rules: `up_facing` (snow sits on tops,
from a normal/height grid), `cavity` (dirt/moss in low spots), `edges` (cracks along strong key edges).
Pixels stay Imagine: layers only weight Imagine materials, they never paint colour.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np


def _load(path, base, shape=None):
    p = Path(path)
    p = p if p.is_absolute() else base / p
    m = np.load(p) if p.suffix == ".npy" else cv2.imread(str(p), cv2.IMREAD_UNCHANGED)
    m = m.astype(np.float32)
    if m.ndim == 3:
        m = m.mean(2)
    m = m / (65535.0 if m.max() > 255 else 255.0 if m.max() > 1 else 1.0)
    if shape is not None and m.shape != shape:
        m = cv2.resize(m, (shape[1], shape[0]), interpolation=cv2.INTER_LINEAR)
    return m


def layer_mask(L, base, shape, height=None, key=None):
    m = _load(L["mask"], base, shape) if L.get("mask") else np.ones(shape, np.float32)
    if L.get("up_facing") and height is not None:
        gy, gx = np.gradient(height * L.get("height_scale", 1.0))
        flat = 1.0 / np.sqrt(1 + gx * gx + gy * gy)  # cos(slope)
        m = m * np.clip((flat - L["up_facing"]) / (1 - L["up_facing"] + 1e-6), 0, 1)
    if L.get("cavity") and height is not None:
        blur = cv2.GaussianBlur(height, (0, 0), L.get("cavity_px", 8))
        m = m * np.clip((blur - height) * L["cavity"] + 0.5, 0, 1)
    if L.get("edges") and key is not None:
        e = cv2.Canny((key * 255).astype(np.uint8), 50, 150).astype(np.float32) / 255
        m = m * cv2.GaussianBlur(e, (0, 0), 1.2) * L["edges"]
    m = cv2.GaussianBlur(m, (0, 0), L.get("soften_px", 1.5))
    return np.clip(m * L.get("strength", 1.0), 0, 1)


def decals(m, L, ext, rng):
    n = int(L.get("decals", 0))
    if n <= 0 or m.max() <= 0:
        return []
    h, w = m.shape
    p = m.reshape(-1) / m.sum()
    idx = rng.choice(h * w, size=min(n, int((m > 0.01).sum())), replace=False, p=p)
    v, u = np.divmod(idx, w)
    x = ext[0] + u / (w - 1) * (ext[2] - ext[0])
    y = ext[3] - v / (h - 1) * (ext[3] - ext[1])
    s = rng.uniform(*L.get("decal_size_m", [0.3, 0.8]), len(idx))
    a = rng.uniform(0, 360, len(idx))
    return [[round(float(i), 3), round(float(j), 3), round(float(k), 3), round(float(l), 1)] for i, j, k, l in zip(x, y, s, a)]


def run(spec, base, out):
    shape = tuple(spec.get("size_px", [512, 512]))
    height = _load(spec["height"], base, shape) if spec.get("height") else None
    key = _load(spec["key"], base, shape) if spec.get("key") else None
    rng = np.random.default_rng(spec.get("seed", 1))
    res = {"layers": [], "extent_m": spec["extent_m"], "seed": spec.get("seed", 1)}
    out.mkdir(parents=True, exist_ok=True)
    for L in spec["layers"]:
        m = layer_mask(L, base, shape, height, key)
        cv2.imwrite(str(out / f"layer-{L['id']}.png"), (m * 255).astype(np.uint8))
        res["layers"].append({"id": L["id"], "material": L.get("material"), "mask": f"layer-{L['id']}.png",
                              "coverage": round(float(m.mean()), 4), "decals": decals(m, L, spec["extent_m"], rng)})
    fails = [f"layer {l['id']} empty" for l in res["layers"] if l["coverage"] == 0 and not spec.get("allow_empty")]
    res["verdict"] = "PASS" if not fails else "FAIL"
    res["fails"] = fails
    (out / "detail.json").write_text(json.dumps(res, indent=1) + "\n")
    return res


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="detail.py", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd")
    r = sub.add_parser("run")
    r.add_argument("--spec", required=True)
    r.add_argument("--out", required=True)
    a = p.parse_args(argv)
    if a.cmd != "run":
        p.print_help()
        return 2
    sp = Path(a.spec)
    res = run(json.loads(sp.read_text()), sp.parent, Path(a.out))
    print(f"{res['verdict']} detail " + " ".join(f"{l['id']}={l['coverage']}" for l in res["layers"]))
    return 0 if res["verdict"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Automatic small-prop scatter (rocks, debris, snow tufts) on kit surfaces and ground.

  python3 tools/scatter/scatter.py run --spec scatter.json --out out/

Density comes from key-image masks (one per prop type, mapped onto the ground rectangle);
slope / height rules filter candidates; Bridson Poisson-disk gives spacing; nothing lands within
`path.clearance_m` of the walkable path polyline. Output is instanced: one draw call per prop type,
budgets on draw calls, instances and triangles (instances x prop tris). Same seed -> same file.
Exit 0 PASS, 1 budget/path FAIL, 2 usage.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np


def poisson_disk(w, h, r, rng, k=20, cap=200000):
    """Bridson sampling in [0,w]x[0,h], min distance r. Deterministic for a given rng."""
    cell = r / np.sqrt(2)
    gw, gh = int(np.ceil(w / cell)), int(np.ceil(h / cell))
    grid = -np.ones((gh, gw), int)
    pts = [np.array([rng.uniform(0, w), rng.uniform(0, h)])]
    grid[int(pts[0][1] / cell), int(pts[0][0] / cell)] = 0
    active = [0]
    while active and len(pts) < cap:
        i = active[int(rng.integers(len(active)))]
        ok = False
        for _ in range(k):
            a, d = rng.uniform(0, 2 * np.pi), rng.uniform(r, 2 * r)
            p = pts[i] + d * np.array([np.cos(a), np.sin(a)])
            if not (0 <= p[0] < w and 0 <= p[1] < h):
                continue
            gx, gy = int(p[0] / cell), int(p[1] / cell)
            y0, y1, x0, x1 = max(gy - 2, 0), min(gy + 3, gh), max(gx - 2, 0), min(gx + 3, gw)
            near = grid[y0:y1, x0:x1]
            near = near[near >= 0]
            if len(near) and np.min(np.linalg.norm(np.array([pts[j] for j in near]) - p, axis=1)) < r:
                continue
            grid[gy, gx] = len(pts)
            pts.append(p)
            active.append(len(pts) - 1)
            ok = True
            break
        if not ok:
            active.remove(i)
    return np.array(pts)


def seg_dist(P, poly):
    poly = np.asarray(poly, float)
    d = np.full(len(P), np.inf)
    for a, b in zip(poly[:-1], poly[1:]):
        ab = b - a
        t = np.clip(((P - a) @ ab) / max(ab @ ab, 1e-9), 0, 1)
        d = np.minimum(d, np.linalg.norm(P - (a + t[:, None] * ab), axis=1))
    return d


def load_mask(path, base: Path):
    p = Path(path)
    p = p if p.is_absolute() else base / p
    m = np.load(p) if p.suffix == ".npy" else cv2.imread(str(p), 0)
    m = m.astype(np.float32)
    return m / (255.0 if m.max() > 1 else 1.0)


def heightfield(spec, base):
    hf = spec.get("heightfield")
    if not hf:
        return None
    p = Path(hf["path"])
    p = p if p.is_absolute() else base / p
    # .npy = metres as stored; image = 0..1 normalised then scaled
    H = np.load(p).astype(np.float32) if p.suffix == ".npy" else load_mask(p, base)
    H = H * hf.get("scale_m", 1.0) + hf.get("offset_m", 0.0)
    return H


def sample_grid(G, ext, P):
    """Bilinear-free nearest sample of a grid covering ext=[x0,y0,x1,y1] (row 0 = far edge y1, like a key)."""
    h, w = G.shape
    u = np.clip(((P[:, 0] - ext[0]) / (ext[2] - ext[0]) * (w - 1)).round().astype(int), 0, w - 1)
    v = np.clip(((ext[3] - P[:, 1]) / (ext[3] - ext[1]) * (h - 1)).round().astype(int), 0, h - 1)
    return G[v, u]


def slope_deg(H, ext):
    h, w = H.shape
    dx = (ext[2] - ext[0]) / (w - 1)
    dy = (ext[3] - ext[1]) / (h - 1)
    gy, gx = np.gradient(H, dy, dx)
    return np.degrees(np.arctan(np.hypot(gx, gy)))


def run(spec: dict, base: Path) -> dict:
    ext = spec["extent_m"]  # [x0, y0, x1, y1]
    W, Hh = ext[2] - ext[0], ext[3] - ext[1]
    H = heightfield(spec, base)
    S = slope_deg(H, ext) if H is not None else None
    path = spec.get("path", {})
    clear = float(path.get("clearance_m", 0.0))
    poly = path.get("polyline", [])
    out = {"seed": spec["seed"], "types": [], "budget": spec["budget"]}
    tot_tris = tot_inst = 0
    for i, t in enumerate(spec["props"]):
        rng = np.random.default_rng([spec["seed"], i])
        P = poisson_disk(W, Hh, t["min_spacing_m"], rng) + [ext[0], ext[1]]
        dens = sample_grid(load_mask(t["density_mask"], base), ext, P) if t.get("density_mask") else np.ones(len(P))
        keep = rng.uniform(0, 1, len(P)) < np.clip(dens * t.get("density", 1.0), 0, 1)
        z = sample_grid(H, ext, P) if H is not None else np.zeros(len(P))
        if S is not None:
            s = sample_grid(S, ext, P)
            keep &= (s >= t.get("slope_deg", [0, 90])[0]) & (s <= t.get("slope_deg", [0, 90])[1])
        hr = t.get("height_m")
        if hr:
            keep &= (z >= hr[0]) & (z <= hr[1])
        if poly and clear > 0:
            keep &= seg_dist(P, poly) >= clear + t.get("radius_m", 0.0)
        P, z = P[keep], z[keep]
        cap = int(t.get("max_instances", 10 ** 9))
        if len(P) > cap:
            idx = np.sort(rng.choice(len(P), cap, replace=False))
            P, z = P[idx], z[idx]
        n = len(P)
        sc = rng.uniform(*t.get("scale", [0.8, 1.2]), n)
        yaw = rng.uniform(0, 360, n)
        inst = [[round(float(x), 3), round(float(y), 3), round(float(zz), 3), round(float(a), 1), round(float(s), 3)]
                for (x, y), zz, a, s in zip(P, z, yaw, sc)]
        tris = n * int(t["tris"])
        tot_tris += tris
        tot_inst += n
        out["types"].append({"id": t["id"], "mesh": t.get("mesh"), "material": t.get("material"), "count": n,
                             "tris": tris, "instances_xyz_yaw_scale": inst})
    b = spec["budget"]
    fails = []
    if len(out["types"]) > b.get("draw_calls", 8):
        fails.append(f"draw calls {len(out['types'])} > {b['draw_calls']}")
    if tot_tris > b.get("triangles", 30000):
        fails.append(f"triangles {tot_tris} > {b['triangles']}")
    if tot_inst > b.get("instances", 4000):
        fails.append(f"instances {tot_inst} > {b['instances']}")
    if poly and clear > 0:
        allp = np.array([i[:2] for t in out["types"] for i in t["instances_xyz_yaw_scale"]]).reshape(-1, 2)
        if len(allp) and seg_dist(allp, poly).min() < clear:
            fails.append("prop inside walkable path clearance")
    out["totals"] = {"draw_calls": len(out["types"]), "instances": tot_inst, "triangles": tot_tris}
    out["verdict"] = "PASS" if not fails else "FAIL"
    out["fails"] = fails
    return out


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="scatter.py", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd")
    r = sub.add_parser("run")
    r.add_argument("--spec", required=True)
    r.add_argument("--out", required=True)
    a = p.parse_args(argv)
    if a.cmd != "run":
        p.print_help()
        return 2
    spec_p = Path(a.spec)
    res = run(json.loads(spec_p.read_text()), spec_p.parent)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "scatter.json").write_text(json.dumps(res) + "\n")
    print(f"{res['verdict']} scatter {res['totals']}" + (f" fails={res['fails']}" if res["fails"] else ""))
    return 0 if not res["fails"] else 1


if __name__ == "__main__":
    sys.exit(main())

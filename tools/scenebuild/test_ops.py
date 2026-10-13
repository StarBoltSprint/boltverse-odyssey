#!/usr/bin/env python3
"""unit tests for ops.py: every op's output is watertight and its declared metric lands within 5 % when measured
in pixels through the key camera (element at depth Z, focal f from camera.json if given, else 700 px)."""
import json, sys, time
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent))
import ops as O  # noqa: E402

f = json.loads(Path(sys.argv[1]).read_text())["fy"] if len(sys.argv) > 1 else 700.0; Z = 8.0
px = lambda m: m * f / Z                                     # metres at depth Z -> key pixels


def proj(V):
    P = V + np.array([0, 0, -Z]); u = f * P[:, 0] / -P[:, 2]; v = f * P[:, 1] / -P[:, 2]; return u.max() - u.min(), v.max() - v.min()


def mk(ops, seed=0):
    O.CACHE.clear(); return O.run({"ops": ops}, {}, seed)


def near(a, b, tol=0.05):
    return abs(a - b) <= tol * abs(b) + 0.75     # +0.75 px for grid quantisation


T = []
def case(name, ops, check):
    t = time.time(); V, F = mk(ops); wt = O.watertight(V, F); ok, msg = check(V, F)
    T.append((name, wt and ok)); print(f"{'ok ' if wt and ok else 'BAD'} {name:12s} watertight={wt} {msg} ({len(F)} tris, {time.time() - t:.2f}s)")

W, H, D = 1.2, 0.6, 0.4
def bb(V, F, w=W, h=H):
    pw, ph = proj(V); return near(pw, px(w)) and near(ph, px(h)), f"px w {pw:.1f}/{px(w):.1f} h {ph:.1f}/{px(h):.1f}"
case("rbox-dc", [{"op": "rbox", "w": W, "h": H, "d": D, "r": 0.05}, {"op": "mesh", "method": "dc", "res": 24}], bb)
case("rbox-mc", [{"op": "rbox", "w": W, "h": H, "d": D, "r": 0.05}, {"op": "mesh", "method": "mc", "res": 24}], bb)
case("blob", [{"op": "blob", "w": W, "h": H, "t": D, "lump": 0.0}, {"op": "mesh", "method": "mc"}], bb)
case("spike", [{"op": "spike", "L": 1.0, "rad": 0.06}, {"op": "mesh", "method": "mc", "res": 12}], lambda V, F: (near(proj(V)[1], px(1.0)), f"L px {proj(V)[1]:.1f}/{px(1.0):.1f}"))
case("drape", [{"op": "rbox", "w": W, "h": H, "d": D}, {"op": "drape", "t": 0.2, "over": 0.0, "lump": 0.0, "k": 0.0}, {"op": "mesh", "method": "mc"}],
     lambda V, F: (near(px(V[:, 1].max() - H / 2), px(0.2)), f"cap px {px(V[:, 1].max() - H / 2):.1f}/{px(0.2):.1f}"))
case("drip", [{"op": "rbox", "w": W, "h": H, "d": D}, {"op": "drip", "n": 1, "L": 0.5, "rad": 0.04, "jit": 0.0, "k": 0.0}, {"op": "mesh", "method": "mc"}],
     lambda V, F: (near(px(-H / 2 - V[:, 1].min()), px(0.5 - 0.012)), f"drop px {px(-H / 2 - V[:, 1].min()):.1f}/{px(0.488):.1f}"))
def blocks2(V, F):
    n = len(O.to_manifold(V, F).decompose()); return 5 <= n <= 8, f"pieces {n} (2 courses, running bond)"
case("split_wall", [{"op": "split_wall", "w": 3.0, "h": 1.2, "d": 0.3, "ch": 0.6, "bw": 1.0, "joint": 0.04, "cv": 0.0, "jit": 0.0},
                    {"op": "mesh", "method": "dc", "res": 8}], blocks2)
def vol(name, ops, expect):
    def ck(V, F):
        v0 = O.to_manifold(*mk(ops[:2])).volume(); v1 = O.to_manifold(V, F).volume(); return near(f * f * (v0 - v1), f * f * expect), f"removed {v0 - v1:.4f}/{expect:.4f} m3"
    case(name, ops, ck)
vol("recess", [{"op": "rbox", "w": W, "h": H, "d": D}, {"op": "mesh", "method": "dc", "res": 24}, {"op": "recess", "inset": 0.2, "depth": 0.1}], (W - 0.4) * (H - 0.2) * 0.1)
vol("chip", [{"op": "rbox", "w": W, "h": H, "d": D}, {"op": "mesh", "method": "dc", "res": 24}, {"op": "chip", "vol": 0.02, "n": 2}], 0.02 * W * H * D)
# node cache: changing only the last op's param reuses the mesh node
O.CACHE.clear(); O.STATS.update(hit=0, miss=0); base = [{"op": "rbox", "w": W, "h": H, "d": D}, {"op": "mesh", "method": "dc"}]
O.run({"ops": base + [{"op": "chip", "vol": 0.02}]}, {}, 0); O.run({"ops": base + [{"op": "chip", "vol": 0.03}]}, {}, 0)
okc = O.STATS["hit"] >= 1; T.append(("cache", okc)); print(f"{'ok ' if okc else 'BAD'} cache        downstream-only rebuild {O.STATS}")
bad = [n for n, ok in T if not ok]; print("PASS" if not bad else f"FAIL {bad}"); sys.exit(1 if bad else 0)

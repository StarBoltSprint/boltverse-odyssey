#!/usr/bin/env python3
"""tools/placer/placer.py - place kit detail from the AUTO key sheet (tools/keysheet/auto_extract.py), any key.
For every in-scope L2 element the key-camera ray through its pixels is cast into the assembled kit (numpy
Moller-Trumbore, kit triangles + ground plane z=0). Pixel footprint at the hit distance gives metric size:
  snow / facade-snow patch -> lumpy flattened blob (width = bbox width, thickness = element thick_px; MoGe depth
                              only sets the key-vs-kit metric ratio used to sanity-clamp thickness)
  drip (icicle)            -> tapered ice spike hanging from the top of the drip (length = bbox height)
  stone element on ground  -> rubble boulder
Output: extra meshes + instances for pieces.write_scene, grouped ("facade_snow", "snow", "drips", "rubble") so the
keep/revert loop (loop.py) can toggle each group against the judges."""
import json, math, sys
from pathlib import Path
import numpy as np
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/kit")); sys.path.insert(0, str(ROOT / "tools/keysheet"))
from geom import Mesh  # noqa: E402
import pieces as P  # noqa: E402

KEY_CAM = {"pos": [-3.0598, 16.073, 30.3214], "tgt": [9.9346, 6.8148, 4.916], "up": [0.1304, 0.9511, -0.2799], "fov": 80.017}


def kit_tris(meshes, inst):
    """all instance triangles in kit coords (z up)."""
    out = []
    for i in inst:
        name, key, t, yaw = i[:4]
        if key.startswith("marker"):
            continue
        m = meshes[key]; V = m.V.copy()
        if len(i) > 4 and i[4]:
            V[:, 0] *= -1
        c, s = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
        V = np.c_[c * V[:, 0] - s * V[:, 1], s * V[:, 0] + c * V[:, 1], V[:, 2]] + np.asarray(t, float)
        out.append(V[m.F])
    return np.concatenate(out) if out else np.zeros((0, 3, 3))


def camera(ks, W=1024, cam=KEY_CAM):
    gl = lambda v: np.array([v[0], -v[2], v[1]], float)        # three (x, y, z) -> kit (x, -z, y)
    pos, tgt, up = gl(np.multiply(cam["pos"], ks)), gl(np.multiply(cam["tgt"], ks)), gl(cam["up"])
    f = tgt - pos; f /= np.linalg.norm(f); r = np.cross(f, up); r /= np.linalg.norm(r); u = np.cross(r, f)
    foc = (W / 2) / math.tan(math.radians(cam["fov"]) / 2)
    return pos, f, r, u, foc


def ray(cam, px, py, W=1024):
    pos, f, r, u, foc = cam
    d = f * foc + r * (px - W / 2) - u * (py - W / 2); return d / np.linalg.norm(d)


def hit(T, o, d):
    """nearest hit distance + normal; ground plane z=0 as fallback."""
    e1, e2 = T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]; p = np.cross(d, e2); det = (e1 * p).sum(1)
    ok = np.abs(det) > 1e-9; inv = np.where(ok, 1 / np.where(ok, det, 1), 0); s = o - T[:, 0]
    uu = (s * p).sum(1) * inv; q = np.cross(s, e1); vv = (q @ d) * inv; tt = (q * e2).sum(1) * inv
    m = ok & (uu >= 0) & (vv >= 0) & (uu + vv <= 1) & (tt > 0.05)
    best = (np.inf, None)
    if m.any():
        k = np.nonzero(m)[0][np.argmin(tt[m])]; n = np.cross(e1[k], e2[k]); n /= np.linalg.norm(n) + 1e-12
        best = (float(tt[k]), n if n @ d < 0 else -n)
    if d[2] < -1e-6:
        tg = -o[2] / d[2]
        if tg < best[0]:
            best = (float(tg), np.array([0, 0, 1.0]))
    return best


def blob(rng, w, dpt, th, seg=10, rings=4, name="placer_snow"):
    """lumpy flattened half-ellipsoid, flat base at z=0, irregular rim (no straight edge)."""
    V, F = [[0, 0, th]], []
    ph = rng.uniform(0, 6, 3)
    for k in range(1, rings + 1):
        a = k / rings
        for j in range(seg):
            t = 2 * math.pi * j / seg
            rr = 1 + 0.18 * math.sin(3 * t + ph[0]) + 0.1 * math.sin(5 * t + ph[1]) + rng.uniform(-0.06, 0.06)
            z = th * math.cos(a * math.pi / 2) * (1 + 0.15 * math.sin(2 * t + ph[2])) if k < rings else -0.03
            V.append([0.5 * w * math.sin(a * math.pi / 2) * rr * math.cos(t), 0.5 * dpt * math.sin(a * math.pi / 2) * rr * math.sin(t), z])
    for j in range(seg):
        F.append([0, 1 + j, 1 + (j + 1) % seg])
    for k in range(rings - 1):
        b0, b1 = 1 + k * seg, 1 + (k + 1) * seg
        for j in range(seg):
            j1 = (j + 1) % seg; F += [[b0 + j, b1 + j, b1 + j1], [b0 + j, b1 + j1, b0 + j1]]
    m = Mesh(np.array(V), np.array(F), name, "stone"); return P.tag(m, snow=1.0)


def spike(rng, L, r, seg=6, rings=4):
    V, F = [], []
    for k in range(rings):
        a = k / (rings - 1); rr = r * (1 - a) ** 0.8 + 0.004
        dx, dy = rng.uniform(-0.15, 0.15) * r * a, rng.uniform(-0.15, 0.15) * r * a
        for j in range(seg):
            t = 2 * math.pi * j / seg; V.append([dx + rr * math.cos(t), dy + rr * math.sin(t), 0.08 - (L + 0.08) * a])
    for k in range(rings - 1):
        for j in range(seg):
            j1 = (j + 1) % seg; a0, a1 = k * seg, (k + 1) * seg
            F += [[a0 + j, a1 + j1, a0 + j1], [a0 + j, a1 + j, a1 + j1]]   # outward winding
    V.append([0, 0, 0.08]); c = len(V) - 1
    F += [[c, j, (j + 1) % seg] for j in range(seg)]
    return P.tag(Mesh(np.array(V), np.array(F), "placer_drip", "ice"), ice=1.0)


def align(V, n, yaw):
    """rotate blob (z up) so +z follows surface normal n, plus a yaw about it."""
    c, s = math.cos(yaw), math.sin(yaw); V = V @ np.array([[c, s, 0], [-s, c, 0], [0, 0, 1]])
    z = np.array([0, 0, 1.0]); v = np.cross(z, n); cth = float(z @ n)
    if np.linalg.norm(v) < 1e-6:
        return V if cth > 0 else V * [1, -1, -1]
    vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    R = np.eye(3) + vx + vx @ vx / (1 + cth); return V @ R.T


def place(meshes, inst, sheet_dir, ks, scope=None, groups=("facade_snow", "snow", "drips", "rubble"), seed=7, max_per_group=400, cap_w=None, merge_host=None):
    cap_w = cap_w or {"facade_snow": 0.6, "snow": 1.2, "rubble": 1.6}
    import cv2
    sd = Path(sheet_dir); sh = json.loads((sd / "sheet.json").read_text())
    from auto_check import l2masks
    M2 = l2masks(sd); els = [e for e in sh["elements"] if e["level"] == 2]
    S = None if scope is None else cv2.resize(cv2.imread(str(scope), 0), (1024, 1024)) > 127
    T = kit_tris(meshes, inst); cam = camera(ks); rng = np.random.default_rng(seed)
    parts = {g: [] for g in groups}; log = {g: 0 for g in groups}; miss = 0
    for e, m in zip(els, M2):
        if S is not None and (m & S).sum() < 0.5 * m.sum():
            continue
        g = ("drips" if e["src"] == "drip" else "facade_snow" if e["src"] == "tophat" else
             "snow" if e["class"] == "snow" else "rubble" if e["class"] in ("stone", "dark") and e["centroid_frac"][1] > 0.55 else None)
        if g not in parts or log[g] >= max_per_group:
            continue
        x0, y0, x1, y1 = e["bbox_px"]; cx, cy = e["centroid_frac"][0] * 1024, e["centroid_frac"][1] * 1024
        py = y0 + 1 if g == "drips" else cy
        d = ray(cam, cx, py); dist, n = hit(T, cam[0], d)
        if not np.isfinite(dist):
            miss += 1; continue
        pxm = dist * float(d @ cam[1]) / cam[4]            # metres per pixel at the hit (forward depth / focal)
        p = cam[0] + d * dist
        if g == "drips":
            L = float(np.clip((y1 - y0 + 1) * pxm, 0.15, 3.0)); r = float(np.clip((x1 - x0 + 1) * pxm / 2, 0.03, 0.25))
            mm = spike(rng, L, r); mm.V = mm.V + p + [0, 0.03, 0]
        elif g == "rubble":
            if n[2] < 0.6:
                continue
            w = float(np.clip((x1 - x0 + 1) * pxm, 0.15, cap_w["rubble"]))
            mm = blob(rng, w, w * rng.uniform(0.6, 1.0), w * rng.uniform(0.3, 0.55), name="placer_rubble"); mm.material = "stone"
            mm = P.tag(mm, snow=0.25); mm.V = align(mm.V, n, rng.uniform(0, 6.28)) + p - n * 0.05
        else:
            w = float(np.clip((x1 - x0 + 1) * pxm, 0.08, cap_w[g])); th = float(np.clip(e["thick_px"] * pxm * (0.5 if n[2] > 0.6 else 0.35), 0.03, 0.7))
            mm = blob(rng, w, min(w, max(0.25, 0.6 * w)), th); mm.V = align(mm.V, n, rng.uniform(-0.3, 0.3)) + p - n * 0.02
        parts[g].append(mm); log[g] += 1
    add_m, add_i = {}, []
    # draw budget: snow/rubble patches join the single identity-placed tread_snow mesh (same stone+snow material, +0 draws);
    # drips get one ice mesh (+1 draw)
    import os
    merge_host = merge_host if merge_host is not None else os.environ.get("PLACER_MERGE", "1") == "1"
    host = next((k for n, k, t, yaw, *r in inst if k == "tread_snow" and tuple(t) == (0, 0, 0) and yaw == 0.0 and not (r and r[0])), None) if merge_host else None
    stone = [m for g in ("facade_snow", "snow", "rubble") for m in parts.get(g, [])]
    if stone and host:
        meshes[host] = _merge([meshes[host]] + stone, host, meshes[host].material)
    elif stone:
        add_m["placer_snow"] = _merge(stone, "placer_snow", "stone"); add_i.append(("placer_snow", "placer_snow", (0, 0, 0), 0.0))
    if parts.get("drips"):
        add_m["placer_drips"] = _merge(parts["drips"], "placer_drips", "ice"); add_i.append(("placer_drips", "placer_drips", (0, 0, 0), 0.0))
    return add_m, add_i, {"placed": log, "miss": miss, "tris": {k: int(len(v.F)) for k, v in add_m.items()}, "merged_into": host}


def _merge(ps, name, mat):
    from geom import merge
    return merge(ps, name, mat)

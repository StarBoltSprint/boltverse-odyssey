"""Spec -> kit pieces (tiers, recess, cornice + support, drifts, icicles) with real displacement.

Rule depths: rise/tread/recess come from the spec (read from key lines by fit.py, clamped to rules).
Frame: X along the wall, Y = depth (into the wall is +Y), Z up. Tier 1 front face at y=0, ground z=0.
"""
from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np

from geom import Mesh, box, cone, merge, vertex_normals, weld

REPO = Path(__file__).resolve().parents[2]
MATLIB = REPO / "tools" / "materials" / "library"


def load_height(mat_id: str, matlib: Path = MATLIB):
    meta = json.loads((matlib / mat_id / "metadata.json").read_text())
    h = cv2.imread(str(matlib / mat_id / "height.png"), cv2.IMREAD_UNCHANGED).astype(np.float32)
    h /= 65535.0 if h.max() > 255 else 255.0
    return h, meta


def triplanar(h: np.ndarray, tile_m: float, P: np.ndarray, N: np.ndarray) -> np.ndarray:
    """Sample a tileable height with triplanar blend (same as the shader, nearest texel)."""
    T = h.shape[0]
    out = np.zeros(len(P))
    w = np.abs(N) ** 4
    w /= w.sum(1, keepdims=True) + 1e-9
    for ax, (a, b) in enumerate([(1, 2), (0, 2), (0, 1)]):
        u = ((P[:, a] / tile_m) % 1 * T).astype(int) % T
        v = ((-P[:, b] / tile_m) % 1 * T).astype(int) % T
        out += w[:, ax] * h[v, u]
    return out


def fade(P, focus, start, end):
    d = np.linalg.norm(P - np.asarray(focus, float), axis=1)
    return np.clip((end - d) / max(end - start, 1e-6), 0, 1)


def displace(m: Mesh, h, tile_m, amp, focus, f0, f1, block=None) -> Mesh:
    """Real displacement along the vertex normal, faded with distance from the focus (play spine)."""
    N = vertex_normals(m)
    off = amp * (triplanar(h, tile_m, m.V, N) - 0.5)
    if block is not None and amp > 0:  # per-block push in metres (stones protrude unevenly)
        off = off + block(m.V)
    out = Mesh(m.V + N * (off * fade(m.V, focus, f0, f1))[:, None], m.F, m.name, m.material)
    out.attrs = dict(m.attrs)
    return out


def block_field(size_m=(0.9, 0.55), depth_m=0.3, seed=1):
    rng = np.random.default_rng(seed)
    table = rng.uniform(-0.5, 0.5, 4096)

    def f(P):
        row = np.floor(P[:, 2] / size_m[1]).astype(int)
        col = np.floor((P[:, 0] + (row % 2) * size_m[0] / 2) / size_m[0]).astype(int)
        idx = (row * 7919 + col * 104729) % 4096
        return (table[idx] + 0.5) * depth_m  # 0..depth_m proud
    return f


def pieces(spec: dict, res: float) -> list[Mesh]:
    t = spec["tiers"]
    rise, n = float(t["rise_m"]), int(t["count"])
    treads = t["tread_m"] if isinstance(t["tread_m"], list) else [t["tread_m"]] * n
    W = float(t["width_m"])
    out: list[Mesh] = []
    y = 0.0
    r = spec.get("recess")
    for i in range(n):
        back = y + treads[i] + (sum(treads[i + 1:]) + 1.0 if i < n - 1 else 1.0)
        z1 = rise * (i + 1)
        if i == 0 and r:
            x0, x1 = r["x_m"] - r["width_m"] / 2, r["x_m"] + r["width_m"] / 2
            d, hz = r["depth_m"], r["height_m"]
            out += [box([0, y, 0], [x0, back, z1], res, f"tier{i+1}-L"),
                    box([x1, y, 0], [W, back, z1], res, f"tier{i+1}-R"),
                    box([x0, y, hz], [x1, back, z1], res, f"tier{i+1}-lintel"),
                    box([x0, y + d, 0], [x1, back, hz], res, f"recess-back")]
        else:
            out.append(box([0, y, 0], [W, back, z1], res, f"tier{i+1}"))
        y += treads[i]
    c = spec.get("cornice")
    if c:
        ti = int(c.get("tier", 1)) - 1
        ytier = sum(treads[:ti])
        zc = rise * (ti + 1) + c.get("raise_m", 0.0)
        x0, x1 = c.get("x0_m", 0.0), c.get("x1_m", W)
        sup = box([x0 + 0.6, ytier - 0.4, zc - 0.5], [x1 - 0.6, ytier + treads[ti], zc + 0.25], res, "cornice-support")
        slab = box([x0, ytier - c["overhang_m"], zc], [x1, ytier + 0.6, zc + c["thick_m"]], res, "cornice")
        out += [sup, slab]
    return out


def drifts(spec: dict, res: float) -> list[Mesh]:
    """Thick rounded snow caps on each tread with a lip that drapes over the front edge."""
    d = spec.get("drifts")
    if not d:
        return []
    t = spec["tiers"]
    rise, n = float(t["rise_m"]), int(t["count"])
    treads = t["tread_m"] if isinstance(t["tread_m"], list) else [t["tread_m"]] * n
    W = float(t["width_m"])
    out, y = [], 0.0
    for i in range(n):
        z = rise * (i + 1)
        cap = box([-0.1, y - d["lip_m"], z - 0.02], [W + 0.1, y + treads[i], z + d["thick_m"]], res, f"drift{i+1}", "snow")
        # round the cap: lift the middle, sag the lip (cosine profile across the tread)
        u = np.clip((cap.V[:, 1] - (y - d["lip_m"])) / (treads[i] + d["lip_m"]), 0, 1)
        top = cap.V[:, 2] > z + 1e-3
        cap.V[top, 2] = z + d["thick_m"] * (0.55 + 0.45 * np.sin(np.pi * np.clip(u[top] * 1.6, 0, 1) / 2))
        lip = cap.V[:, 1] < y + 1e-3
        cap.V[lip, 2] -= d.get("drape_m", 0.25)
        out.append(cap)
        y += treads[i]
    return out


def icicles(spec: dict) -> list[Mesh]:
    ic = spec.get("icicles")
    if not ic:
        return []
    rng = np.random.default_rng(ic.get("seed", 3))
    c = spec.get("cornice")
    t = spec["tiers"]
    if c:
        ti = int(c.get("tier", 1)) - 1
        treads = t["tread_m"] if isinstance(t["tread_m"], list) else [t["tread_m"]] * int(t["count"])
        y = sum(treads[:ti]) - c["overhang_m"] + 0.08
        z = t["rise_m"] * (ti + 1) + c.get("raise_m", 0.0) + 0.1
        x0, x1 = c.get("x0_m", 0.0), c.get("x1_m", t["width_m"])
    else:
        y, z, x0, x1 = -0.1, t["rise_m"], 0.0, t["width_m"]
    out = []
    L0, L1 = ic["len_m"]
    r0, r1 = ic["r_m"]
    for k in range(int(ic["count"])):
        x = rng.uniform(x0 + 0.2, x1 - 0.2)
        L = L0 + (L1 - L0) * rng.beta(1.2, 3.0)   # many short, few long (key)
        r = r0 + (r1 - r0) * (L - L0) / max(L1 - L0, 1e-6)
        top = np.array([x, y + rng.uniform(0, 0.15), z])
        out.append(cone(top, top + [rng.normal(0, 0.03), 0, -L], r, 6, f"icicle{k}", "ice"))
    return out


def build_outline(spec: dict, cam, masks: dict) -> dict:
    """Outline-mask mode (v4 shaping + v6 snow): tier 1 + cornice from key masks, clean block cells."""
    from outline import drift_lift, outline_pieces, snow_attr
    o = spec["outline"]
    rel = spec.get("relief", {})
    focus = rel.get("focus")
    lods = {}
    for li, k in enumerate((1, 2, 4)):
        sub = dict(spec)
        sub["outline"] = {**o, "cell_m": o.get("cell_m", 0.1) * k, "blocks": o.get("blocks", True) and li == 0}
        parts = []
        for p in outline_pieces(sub, cam, masks, rel.get("res_m", [0.5, 1.0, 2.0])[li]):
            lift = None
            if spec.get("drifts") and li < 2:
                p, lift = drift_lift(p, spec["drifts"].get("thick_m", 0.6) * spec["drifts"].get("outline_k", 0.25))
            if masks.get("snow") is not None:
                p.attrs["_SNOW"] = snow_attr(p, cam, masks["snow"], lift)
            if p.name == "cornice":
                N = vertex_normals(p)
                p.attrs["_ICE"] = (N[:, 2] < -0.3).astype(float)
                p.attrs["_SNOW"] = np.where(p.attrs["_ICE"] > 0, 0.0, p.attrs.get("_SNOW", np.zeros(len(p.V))))
            parts.append(p)
        lods[f"lod{li}"] = parts
    return lods


def build(spec: dict, matlib: Path = MATLIB, cam=None, masks=None) -> dict:
    """Returns {'lod0': [Mesh...], 'lod1': ..., 'lod2': ...}."""
    if spec.get("outline") and cam is not None and masks:
        return build_outline(spec, cam, masks)
    rel = spec.get("relief", {})
    mats = spec.get("materials", {"stone": "basalt-zd-frost", "snow": "snow-zd-windpacked"})
    hs, ms = load_height(mats["stone"], matlib)
    hn, mn = load_height(mats["snow"], matlib)
    focus = rel.get("focus", [spec["tiers"]["width_m"] / 2, -4.0, 1.6])
    f0, f1 = rel.get("fade_start_m", 4.0), rel.get("fade_end_m", 12.0)
    blk = block_field(tuple(rel.get("block_m", (0.9, 0.55))), rel.get("block_depth_m", 0.3))
    lods = {}
    for li, res in enumerate(rel.get("res_m", [0.12, 0.35, 1.0])):
        amp_k = [1.0, 0.5, 0.0][li] if li < 3 else 0.0
        parts = []
        for p in pieces(spec, res):
            parts.append(displace(p, hs, ms["tile_m"], rel.get("stone_amp_m", 0.12) * amp_k, focus, f0, f1,
                                  blk if (rel.get("blocks", True) and li == 0) else None))
        for p in drifts(spec, res):
            parts.append(displace(p, hn, mn["tile_m"], rel.get("snow_amp_m", 0.08) * amp_k, focus, f0, f1))
        if li < 2:
            parts += icicles(spec)
        lods[f"lod{li}"] = parts
    return lods

"""One parametric generator per element type. Every parameter comes from the element's measured properties
(size / depth / thickness / protrusion in metres from MoGe, roughness, parts period, albedo, snow/wear) times an
optimiser multiplier (opt dict, default 1 / 0). Meshes are in three.js camera frame (camera at origin, -Z forward),
with per-vertex sRGB colour. Pure numpy."""
import math
import numpy as np
from skimage.color import lab2rgb


def lab_rgb(lab, gain=1.0):
    L, a, b = lab; return np.clip(lab2rgb(np.array([[[min(100, L * gain), a, b]]]))[0, 0], 0, 1)


class M:
    def __init__(self):
        self.V, self.F, self.C = [], [], []

    def add(self, V, F, col, jitter=0.0, rng=None):
        if V is None or len(V) == 0 or len(F) == 0:
            return
        o = sum(len(v) for v in self.V); V = np.asarray(V, float).reshape(-1, 3); F = np.asarray(F, int).reshape(-1, 3)
        col = np.asarray(col, float); cols = col.reshape(-1, 3) if col.size == 3 * len(V) else np.tile(col.reshape(3), (len(V), 1))
        if jitter and rng is not None:
            cols = np.clip(cols * (1 + rng.normal(0, jitter, (len(V), 1))), 0, 1)
        self.V.append(V); self.F.append(np.asarray(F, int) + o); self.C.append(cols)

    def arrays(self):
        if not self.V:
            return None
        return np.vstack(self.V).astype(np.float32), np.vstack(self.F).astype(np.uint32), np.vstack(self.C).astype(np.float32)


def box(c, ax, w, h, d, rough=0.0, rng=None, seg=1):
    """oriented box: centre c, axes ax = (right, up, out) unit vectors, size w x h x d; vertex chipping by rough."""
    r, u, o = ax; V, F = [], []
    g = np.linspace(-0.5, 0.5, seg + 1)
    for s in (-1, 1):
        for axis in range(3):
            base = len(V); A = [r * w, u * h, o * d]; n = A[axis] * s * 0.5; p, q = [A[k] for k in range(3) if k != axis]
            for i in g:
                for j in g:
                    V.append(c + n + p * i + q * j)
            for i in range(seg):
                for j in range(seg):
                    a0 = base + i * (seg + 1) + j; quad = [a0, a0 + seg + 1, a0 + seg + 2, a0 + 1]
                    F += [(quad[0], quad[1], quad[2]), (quad[0], quad[2], quad[3])] if s > 0 else [(quad[0], quad[2], quad[1]), (quad[0], quad[3], quad[2])]
    V = np.array(V)
    if rough and rng is not None:
        V += rng.normal(0, rough, V.shape) * min(w, h, d)
    return V, F


def blob(c, ax, w, h, t, lump=0.15, rng=None, seg=12, rings=4, droop=0.0):
    """lumpy half-ellipsoid: footprint w (right) x t (out), height h (up); droop pulls the front rim down."""
    r, u, o = ax; ph = rng.uniform(0, 6, 3); V = [c + u * h]; F = []
    for k in range(1, rings + 1):
        a = k / rings
        for j in range(seg):
            th = 2 * math.pi * j / seg
            rr = 1 + lump * (math.sin(3 * th + ph[0]) + 0.6 * math.sin(5 * th + ph[1])) + rng.uniform(-lump, lump) * 0.4
            hh = h * math.cos(a * math.pi / 2) * (1 + lump * math.sin(2 * th + ph[2])) - (droop * h * a * max(0, math.sin(th)) if droop else 0)
            V.append(c + r * (0.5 * w * math.sin(a * math.pi / 2) * rr * math.cos(th)) + o * (0.5 * t * math.sin(a * math.pi / 2) * rr * math.sin(th)) + u * hh)
    for j in range(seg):
        F.append((0, 1 + (j + 1) % seg, 1 + j))
    for k in range(rings - 1):
        b0, b1 = 1 + k * seg, 1 + (k + 1) * seg
        for j in range(seg):
            j1 = (j + 1) % seg; F += [(b0 + j, b1 + j1, b1 + j), (b0 + j, b0 + j1, b1 + j1)]
    return np.array(V), F


def spike(top, L, rad, rng, seg=6, rings=4):
    V, F = [], []
    for k in range(rings):
        a = k / (rings - 1); rr = rad * (1 - a) ** 0.8 + 0.002
        dx, dz = rng.normal(0, 0.1) * rad * a, rng.normal(0, 0.1) * rad * a
        for j in range(seg):
            t = 2 * math.pi * j / seg; V.append(top + np.array([dx + rr * math.cos(t), -L * a, dz + rr * math.sin(t)]))
    for k in range(rings - 1):
        for j in range(seg):
            j1 = (j + 1) % seg; a0, a1 = k * seg, (k + 1) * seg
            F += [(a0 + j, a1 + j1, a0 + j1), (a0 + j, a1 + j, a1 + j1)]
    V.append(top); c = len(V) - 1; F += [(c, j, (j + 1) % seg) for j in range(seg)]
    return np.array(V), F


import os
JUMP_CUT = 0.12 if os.environ.get("SB_CUT") else 0.0   # v6 experiment (off: cutting opened holes, off-view gate 34.6 -> 32.2)


def relief(P, valid, step, col_img, rough, rng):
    """depth-fitted surface for big forms (wall / ground / ice mass / sky backdrop): grid of back-projected points
    (P: HxWx3 three-frame points) sampled every `step` px inside the mask, displaced by roughness."""
    H, W = valid.shape; ys = np.arange(0, H, step); xs = np.arange(0, W, step)
    idx = -np.ones((len(ys), len(xs)), int); V, C = [], []
    for i, y in enumerate(ys):
        for j, x in enumerate(xs):
            if valid[y, x]:
                idx[i, j] = len(V); p = P[y, x].copy()
                if rough:
                    p *= 1 + rng.normal(0, rough)
                V.append(p); C.append(col_img[y, x])
    V = np.array(V).reshape(-1, 3); F = []
    zg = np.full(idx.shape, np.nan); zg[idx >= 0] = np.abs(V[idx[idx >= 0], 2])
    if JUMP_CUT > 0 and len(V):
        # depth-jump cells: depth ratio across the cell spikes above both JUMP_CUT and 3x its 5x5 neighbourhood median
        # (a steep but smooth surface, e.g. ground at a grazing angle, has a high ratio everywhere -> kept)
        q = np.stack([zg[:-1, :-1], zg[:-1, 1:], zg[1:, :-1], zg[1:, 1:]]); r = np.nanmax(q, 0) / np.nanmin(q, 0) - 1
        from scipy.ndimage import generic_filter
        med = generic_filter(np.nan_to_num(r, nan=0.0), np.median, size=5, mode="nearest")
        cut = (r > JUMP_CUT) & (r > 3 * med)
    else:
        cut = np.zeros((len(ys) - 1, len(xs) - 1), bool)
    for i in range(len(ys) - 1):
        for j in range(len(xs) - 1):
            if cut[i, j]:
                continue
            a, b, c, d = idx[i, j], idx[i, j + 1], idx[i + 1, j], idx[i + 1, j + 1]
            if min(a, b, c) >= 0:
                F.append((a, c, b))
            if min(b, c, d) >= 0:
                F.append((b, c, d))
    return V, F, np.array(C).reshape(-1, 3)

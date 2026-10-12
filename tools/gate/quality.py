"""Triangle-quality gate.

Thresholds copied from tools/object-gate/py/view_gates.py (do not loosen):
FAIL if any degenerate triangle (area < 1e-8 m^2), or the sliver share
(min angle < 10 deg or aspect > 8) is above 1%.
"""
import numpy as np

AREA_MIN = 1e-8
MIN_ANGLE_DEG = 10.0
ASPECT_MAX = 8.0
SLIVER_FRAC_MAX = 0.01


def load_obj_tris(path):
    vs = []
    fs = []
    for ln in open(path):
        if ln.startswith("v "):
            vs.append([float(x) for x in ln.split()[1:4]])
        elif ln.startswith("f "):
            fs.append([int(t.split("/")[0]) - 1 for t in ln.split()[1:4]])
    v = np.asarray(vs, np.float64)
    f = np.asarray(fs, np.int64)
    return v[f]


def triangle_quality(tris):
    T = np.asarray(tris, np.float64)
    e = [np.linalg.norm(T[:, (k + 1) % 3] - T[:, k], axis=1) for k in range(3)]
    area = 0.5 * np.linalg.norm(np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]), axis=1)
    ang = []
    for k in range(3):
        u = T[:, (k + 1) % 3] - T[:, k]
        w = T[:, (k + 2) % 3] - T[:, k]
        c = (u * w).sum(1) / np.maximum(np.linalg.norm(u, axis=1) * np.linalg.norm(w, axis=1), 1e-12)
        ang.append(np.degrees(np.arccos(np.clip(c, -1, 1))))
    mina = np.min(ang, 0)
    emax = np.max(e, 0)
    aspect = emax ** 2 / np.maximum(2 * area, 1e-12) * (np.sqrt(3) / 2)
    deg = int((area < AREA_MIN).sum())
    ok = area >= AREA_MIN
    sl = (mina < MIN_ANGLE_DEG) | (aspect > ASPECT_MAX)
    sliver = float(sl[ok].mean()) if ok.any() else 1.0
    r = dict(
        tris=int(len(T)),
        degenerate=deg,
        sliverFrac=round(sliver, 4),
        minAngleP5=round(float(np.percentile(mina[ok], 5)), 2) if ok.any() else 0.0,
        aspectP99=round(float(np.percentile(aspect[ok], 99)), 2) if ok.any() else 1e9,
    )
    r["pass"] = deg == 0 and r["sliverFrac"] <= SLIVER_FRAC_MAX
    return r

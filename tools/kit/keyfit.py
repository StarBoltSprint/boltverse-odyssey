#!/usr/bin/env python3
"""Fit the assembled terrace to the key SAM2 tier mask through the solved key camera (silhouette IoU).
usage: keyfit.py LOCAL.glb MASK.png --kscale S  -> best kit-frame offset (dx, dy, dz) printed as JSON."""
import argparse, json, sys
from pathlib import Path
import cv2, numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tools.gatesuite import glbio
CAM = {"pos": [-3.0598, 16.073, 30.3214], "tgt": [9.9346, 6.8148, 4.916], "up": [0.1304, 0.9511, -0.2799], "fov": 80.017}


def project(V, ks, W=1024):
    p, t, up = np.array(CAM["pos"]) * ks, np.array(CAM["tgt"]) * ks, np.array(CAM["up"])
    f = t - p; f /= np.linalg.norm(f); r = np.cross(f, up); r /= np.linalg.norm(r); u = np.cross(r, f)
    q = V - p; x, y, z = q @ r, q @ u, q @ f
    F = W / 2 / np.tan(np.radians(CAM["fov"]) / 2)
    return np.stack([W / 2 + F * x / z, W / 2 - F * y / z], 1), z


def silhouette(meshes, off, ks, W=1024):
    img = np.zeros((W, W), np.uint8)
    for m in meshes:
        if m["name"].startswith("marker"):
            continue
        V = m["V"] + np.array([off[0], off[2], -off[1]])     # kit offset -> glTF
        P2, z = project(V, ks, W)
        tri = P2[m["F"]]; ok = (z[m["F"]] > 0.1).all(1)
        cv2.fillPoly(img, [np.round(t_).astype(np.int32) for t_ in tri[ok]], 255)
    return img


def iou(a, b):
    a, b = a > 127, b > 127
    return float((a & b).sum() / max((a | b).sum(), 1))


def fit(glb, mask, ks):
    ms, _ = glbio.meshes(glb)
    M = cv2.resize(cv2.imread(str(mask), 0), (1024, 1024), interpolation=cv2.INTER_NEAREST)
    best = (iou(silhouette(ms, (0, 0, 0), ks), M), (0.0, 0.0, 0.0))
    base = best[0]
    for step in (2.0, 1.0, 0.5, 0.25):
        improved = True
        while improved:
            improved = False
            for ax in range(3):
                for sg in (-1, 1):
                    o = list(best[1]); o[ax] += sg * step * ks
                    s = iou(silhouette(ms, o, ks), M)
                    if s > best[0] + 1e-4:
                        best, improved = (s, tuple(o)), True
    return {"iou_before": round(base, 4), "iou_after": round(best[0], 4), "offset_kit_m": [round(v, 3) for v in best[1]]}


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("glb"); ap.add_argument("mask"); ap.add_argument("--kscale", type=float, default=1.0)
    a = ap.parse_args(); print(json.dumps(fit(a.glb, a.mask, a.kscale)))

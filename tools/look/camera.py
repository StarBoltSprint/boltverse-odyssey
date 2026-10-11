"""Key camera for the look gate. Reuses the placement-v2 solve when that file is on disk.

The solve is a real-render match (yaw, pitch, fov, eye) against key-city3.
A parameter that stopped on its limit is reported. It is not treated as exact.
"""
import json
import os

DEFAULT = "/workspace/zb-bible-1008/compare/run3/camera/camera-v2.json"
# Same limits as tools/imagine-to-3d/placement_v2.py camera().
LIMITS = {"fovDeg": (40.0, 80.0), "pitch": (-12.0, 15.0), "dy": (0.0, 25.0)}


def load(path=None):
    path = path or DEFAULT
    if not os.path.exists(path):
        raise SystemExit("camera match missing: %s" % path)
    doc = json.load(open(path))
    cam = dict(doc["camera"])
    raw = doc.get("cameraRaw") or {}
    at_bound = []
    for key, (lo, hi) in LIMITS.items():
        value = raw.get(key, cam.get(key))
        if value is None:
            continue
        if abs(float(value) - lo) < 1e-3 or abs(float(value) - hi) < 1e-3:
            at_bound.append(key)
    return {
        "source": os.path.abspath(path),
        "camera": cam,
        "error": doc.get("error"),
        "parts": doc.get("parts"),
        "keyTargets": doc.get("keyTargets"),
        "atBound": at_bound,
        "note": "Reused placement v2. fov at 80 means the avenue target sat on the limit.",
    }


def query(cam, extra=None):
    q = {
        "hud": "0",
        "lockq": "1",
        "dyn": "0",
        "x": cam["x"],
        "z": cam["z"],
        "yaw": cam["yaw"],
        "pitch": cam["pitch"],
        "eye": cam["eye"],
        "fov": cam["fovDeg"],
    }
    if extra:
        q.update(extra)
    return "&".join("%s=%s" % (k, v) for k, v in q.items())

"""Walk passages for scatter. Empty input leaves placement unchanged.

A point is excluded when it lies within radius + pad of a hard-object opening.
This module does not draw.
"""

from __future__ import annotations

import json
import math


def _frame(obj: dict) -> tuple:
    yaw = float(obj.get("yaw") or 0)
    s = math.sin(yaw)
    c = math.cos(yaw)
    if obj.get("frame") == "ship":
        return (s, -c, c, s, float(obj["x"]), float(obj["z"]))
    return (c, s, -s, c, float(obj["x"]), float(obj["z"]))


def _to_world(frame, lx: float, lz: float):
    a, b, c, d, px, pz = frame
    return (a * lx + b * lz + px, c * lx + d * lz + pz)


def passages_from_manifest(data: dict) -> list[dict]:
    body = float((data.get("collider") or {}).get("bodyRadiusM") or 0.3)
    quads = []
    for obj in data.get("objects") or []:
        if obj.get("frame") != "ship" and obj.get("openingBoxM") and obj.get("bounds"):
            ob = obj["openingBoxM"]
            z_front = float(obj["bounds"]["max"][2])
            z_back = float(obj["bounds"]["min"][2])
            frame = _frame(obj)
            quads.append(
                {
                    "id": obj.get("id"),
                    "pad": body,
                    "corners": [
                        _to_world(frame, float(ob[0]), z_front + 6),
                        _to_world(frame, float(ob[1]), z_front + 6),
                        _to_world(frame, float(ob[1]), z_back - 1),
                        _to_world(frame, float(ob[0]), z_back - 1),
                    ],
                }
            )
        hangar = obj.get("hangar")
        if obj.get("frame") == "ship" and hangar and obj.get("bounds"):
            frame = _frame(obj)
            x0, x1 = float(hangar["x"][0]), float(hangar["x"][1])
            port = float(hangar["portZ"])
            z_back = float(obj["bounds"]["min"][2])
            quads.append(
                {
                    "id": str(obj.get("id")) + "-hangar",
                    "pad": body,
                    "corners": [
                        _to_world(frame, x0, port + 8),
                        _to_world(frame, x1, port + 8),
                        _to_world(frame, x1, z_back),
                        _to_world(frame, x0, z_back),
                    ],
                }
            )
    return quads


def passages_from_spec(spec: dict | None) -> list[dict]:
    if not spec:
        return []
    raw = spec.get("hard_passages")
    if raw:
        return list(raw)
    path = spec.get("ruin_manifest")
    if not path:
        return []
    with open(path, encoding="utf-8") as handle:
        return passages_from_manifest(json.load(handle))


def _inside(x: float, z: float, corners) -> bool:
    sign = 0
    for i, a in enumerate(corners):
        b = corners[(i + 1) % len(corners)]
        cross = (b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0])
        if abs(cross) < 1e-8:
            continue
        s = 1 if cross > 0 else -1
        if sign == 0:
            sign = s
        elif s != sign:
            return False
    return len(corners) >= 3


def _dist(x: float, z: float, corners) -> float:
    if _inside(x, z, corners):
        return 0.0
    best = 1e9
    for i, a in enumerate(corners):
        b = corners[(i + 1) % len(corners)]
        vx, vz = b[0] - a[0], b[1] - a[1]
        l2 = vx * vx + vz * vz or 1.0
        t = max(0.0, min(1.0, ((x - a[0]) * vx + (z - a[1]) * vz) / l2))
        best = min(best, math.hypot(x - (a[0] + vx * t), z - (a[1] + vz * t)))
    return best


def hits_passage(x: float, z: float, radius: float, passages) -> bool:
    if not passages:
        return False
    r = float(radius or 0)
    for passage in passages:
        if _dist(x, z, passage["corners"]) < r + float(passage.get("pad") or 0):
            return True
    return False


def _selftest() -> int:
    manifest = {
        "collider": {"bodyRadiusM": 0.3},
        "objects": [
            {
                "id": "gate",
                "frame": "gate",
                "x": 0,
                "z": 0,
                "yaw": 0,
                "openingBoxM": [-2, 2, 0, 8],
                "bounds": {"min": [-6, 0, -3], "max": [6, 10, 3]},
            }
        ],
    }
    passages = passages_from_manifest(manifest)
    if not hits_passage(0, 0, 0.4, passages):
        print("FAIL opening should exclude the centre")
        return 1
    if hits_passage(30, 0, 0.4, passages):
        print("FAIL a point beside the gate was excluded")
        return 1
    if hits_passage(0, 0, 1, []):
        print("FAIL empty passages changed a point")
        return 1
    if passages_from_spec({}) or passages_from_spec({"scatter": {}}):
        print("FAIL a spec without passages returned a quad")
        return 1
    print("PASS layout passages")
    return 0


if __name__ == "__main__":
    raise SystemExit(_selftest())

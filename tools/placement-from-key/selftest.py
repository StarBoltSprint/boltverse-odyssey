#!/usr/bin/env python3
"""Round-trip the camera and the avenue frame. No browser, no SAM2."""

import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from depth_lift import assign_assets, clamp_sl
from geom import Cam, av_xz, dir_to_heading, heading_to_dir, iou, xz_av


def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + ((" — " + detail) if detail else ""))
    return ok


def main():
    ok = True
    d = heading_to_dir(78, 0)
    h, e = dir_to_heading(d)
    ok &= check("heading round trip", abs(h - 78) < 1e-6 and abs(e) < 1e-6, f"{h:.4f} {e:.4f}")
    cam = Cam(-51.115, 10.8, 9.63, 78, 0, 90, 1280, 720)
    fwd = heading_to_dir(78, 0)
    ok &= check("pitch 0 forward matches heading", np.allclose(cam.forward, fwd, atol=1e-6), str(cam.forward))
    # A point 100 m in front projects to the centre.
    p = cam.p + fwd * 100
    uv, depth = cam.project([p])
    ok &= check("centre projects to mid frame", abs(uv[0, 0] - 640) < 0.2 and abs(uv[0, 1] - 360) < 0.2, str(uv[0]))
    ray = cam.ray(uv[0, 0], uv[0, 1])
    ok &= check("unproject returns the forward ray", abs(float(np.dot(ray, fwd)) - 1) < 1e-5)
    x, z = av_xz(40, -12)
    s, lat = xz_av(x, z)
    ok &= check("avenue inverse", abs(s - 40) < 1e-3 and abs(lat + 12) < 1e-3, f"{s:.4f} {lat:.4f}")
    a = np.zeros((8, 8), bool)
    a[2:6, 2:6] = True
    ok &= check("iou identical", abs(iou(a, a) - 1) < 1e-9)
    b = np.zeros_like(a)
    b[4:8, 4:8] = True
    ok &= check("iou partial", abs(iou(a, b) - (4 / 28)) < 1e-6, f"{iou(a, b):.4f}")
    # Pitched camera still looks upward in world Y when pitch is positive and yaw is 0.
    cam2 = Cam(0, 5, 0, 0, 10, 60, 640, 360)
    ok &= check("positive pitch raises forward Y", cam2.forward[1] > 0, f"{cam2.forward[1]:.4f}")
    cam_s, _ = xz_av(-51.115, 9.63)
    ns, nlat = clamp_sl(50.0, -170.0, -36.0, -22.0, "mesa", cam_s)
    ok &= check(
        "mesa lift cannot enter the lens",
        ns >= cam_s + 90 and abs(nlat) >= 110 and abs(nlat - (-170)) <= 24,
        f"s={ns:.2f} lat={nlat:.2f} cam_s={cam_s:.2f}",
    )
    ts, tlat = clamp_sl(10.0, -43.57, -26.0, -14.0, "tower", cam_s)
    ok &= check(
        "tower lift stays ahead of the camera",
        ts >= cam_s + 55 and abs(tlat) >= 22,
        f"s={ts:.2f} lat={tlat:.2f}",
    )
    layout = {
        "towers": [{
            "id": "t0-m2", "module": "m2", "s": 10.0, "lateral": -43.57,
            "scale": 1.12, "height": 110.0, "yaw": 32, "x": 0, "z": 0,
        }],
        "spire": {"s": 88.0, "lateral": 53.0, "scale": 1.0, "height": 150.0, "yaw": 67, "x": 0, "z": 0},
        "skyline": [],
    }
    mesas = [
        {"id": "L-mid", "s": 50.0, "lat": -170.0, "scale": 1.25, "yaw": 180},
        {"id": "B-far", "s": -520.0, "lat": 10.0, "scale": 2.2, "yaw": 80},
    ]
    lifts = [
        {"id": "mesa-left", "kind": "mesa", "status": "lifted", "s": -36, "lateral": -22,
         "position": [0, 0, 0], "yaw": 200, "heightM": 10, "Z": 16, "imageBase": [140, 420]},
        {"id": "tower-l1", "kind": "tower", "status": "lifted", "s": -26, "lateral": -14,
         "position": [0, 0, 0], "yaw": 232, "heightM": 24, "Z": 25, "imageBase": [250, 400]},
        {"id": "wreck", "kind": "wreck", "status": "lifted", "s": -40, "lateral": 4,
         "position": [1, 2, 3], "yaw": 10, "heightM": 5, "Z": 12, "imageBase": [800, 500]},
    ]
    placed = assign_assets(lifts, layout, mesas, cam)
    mesa_row = next(p for p in placed["placed"] if p["kind"] == "mesa")
    tower_row = next(p for p in placed["placed"] if p["kind"] == "tower")
    ok &= check("assignment picks the foreground mesa", mesa_row["id"] == "L-mid" and abs(mesa_row["lateral"]) >= 110, str(mesa_row))
    ok &= check("assignment does not teleport the tower", tower_row["s"] >= cam_s + 55 and tower_row["scale"] >= 1.12 * 0.8 - 1e-6, str(tower_row))
    ok &= check("wreck is a TODO", any(td["status"] == "TODO" and td["kind"] == "wreck" for td in placed["todos"]))
    print("PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

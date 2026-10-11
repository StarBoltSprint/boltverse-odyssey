"""MoGe-2 metric depth for a plate. Run with /workspace/.venv-sam2/bin/python.

The system interpreter has OpenCV and not torch. This process has torch and MoGe.
"""
import os
import sys

import numpy as np

TOOLS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if TOOLS not in sys.path:
    sys.path.insert(0, TOOLS)

from common.vision_models import depth_moge


def _one(src, dst):
    arr, hit, sec = depth_moge(src, side=518, full=True)
    depth = np.asarray(arr, np.float32)
    np.save(dst, depth)
    print("moge", depth.shape, float(np.nanmedian(depth)), "cache", int(bool(hit)), "sec", round(float(sec), 2))
    return depth


def main():
    args = sys.argv[1:]
    dav2_out = None
    pairs = []
    i = 0
    while i < len(args):
        if args[i] == "--dav2":
            dav2_out = args[i + 1]
            i += 2
            continue
        pairs.append((args[i], args[i + 1]))
        i += 2
    if not pairs:
        raise SystemExit("usage: moge_depth.py src dst [src dst ...] [--dav2 compare.npy]")
    for src, dst in pairs:
        _one(src, dst)
    if dav2_out:
        from common.vision_models import depth_dav2
        # DA V2 Large is nearer-is-larger. It is a comparison file, not the relief.
        arr, hit, sec = depth_dav2(pairs[0][0], size=518)
        disp = np.asarray(arr, np.float32)
        np.save(dav2_out, disp)
        print("dav2", disp.shape, "cache", int(bool(hit)), "sec", round(float(sec), 2))


if __name__ == "__main__":
    main()

"""MoGe-2 depth and SAM2 mask. Run with the torch venv, one task per process."""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

import numpy as np

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, os.path.join(REPO, "tools"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--task", choices=["sam", "moge"], required=True)
    ap.add_argument("--image", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--box", type=float, nargs=4)
    ap.add_argument("--which", default="small")
    ap.add_argument("--side", type=int, default=384)
    args = ap.parse_args()
    from common.vision_models import depth_moge, mask_sam2  # noqa: E402

    t0 = time.perf_counter()
    if args.task == "sam":
        if args.box is None:
            raise SystemExit("sam needs --box")
        arr, hit, seconds = mask_sam2(args.image, args.which, box=list(args.box))
        meta = {"task": "sam", "which": args.which, "box": list(args.box)}
    else:
        arr, hit, seconds = depth_moge(args.image, side=args.side)
        meta = {"task": "moge", "side": args.side}
    wall = time.perf_counter() - t0
    np.save(args.out, arr)
    meta.update({
        "shape": list(arr.shape),
        "cache_hit": bool(hit),
        "model_seconds": round(float(seconds), 4),
        "wall_seconds": round(wall, 4),
        "finite": int(np.isfinite(arr).sum()) if arr.dtype.kind == "f" else int(arr.sum()),
    })
    json.dump(meta, open(os.path.splitext(args.out)[0] + ".json", "w"), indent=1)
    print(json.dumps(meta))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Build a walk-around invisible hull from a folder of still views.

Does not call Imagine. Imagine pixels are copied lossless and never upscaled.

  python3 tools/walkaround/build.py \\
    --views <views-dir> --config <config.json> --out <out-dir> \\
    --model /path/to/depth_anything_v2_small.onnx
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from hull import BuildFailure, build


def main() -> int:
    parser = argparse.ArgumentParser(description="Walk-around invisible hull from still views")
    parser.add_argument("--views", required=True, type=Path, help="Folder of PNG stills of one object")
    parser.add_argument("--config", required=True, type=Path, help="View angles and object size")
    parser.add_argument("--out", required=True, type=Path, help="Asset folder to write")
    parser.add_argument(
        "--model",
        type=Path,
        default=None,
        help="Depth Anything V2 Small ONNX (input pixel_values). Optional.",
    )
    parser.add_argument(
        "--depth-dir",
        type=Path,
        default=None,
        help="Optional PNG depth maps, same names and size as the views, near = white. Not a resize.",
    )
    parser.add_argument(
        "--surface",
        choices=("nets", "voxels"),
        default=None,
        help="nets: smooth surface nets + Taubin (default). voxels: legacy occupancy grid.",
    )
    parser.add_argument(
        "--legacy-voxels",
        action="store_true",
        help="Same as --surface voxels. Keeps the coarse grid the old raymarcher draws.",
    )
    parser.add_argument("--surface-grid", type=int, default=None, help="Occupancy resolution for the smooth hull. Default max(64, 2×grid), capped at 128.")
    parser.add_argument("--smooth-iters", type=int, default=None, help="Taubin iterations. Default 8.")
    parser.add_argument(
        "--depth-relief",
        type=float,
        default=None,
        help="How far depth may recess the hull, as a fraction of local thickness. Default 0.35 on nets, 0.10 on voxels.",
    )
    args = parser.parse_args()
    if args.model is not None and args.depth_dir is not None:
        print("FAIL depth: pass --model or --depth-dir, not both", file=sys.stderr)
        return 1
    try:
        report = build(
            args.views,
            args.config,
            args.out,
            args.model,
            args.depth_dir,
            options={
                "surface": args.surface,
                "legacy_voxels": args.legacy_voxels,
                "surface_grid": args.surface_grid,
                "smooth_iters": args.smooth_iters,
                "depth_relief": args.depth_relief,
            },
        )
    except BuildFailure as exc:
        for line in exc.lines:
            print(line)
        return 1
    except SystemExit as exc:
        if exc.code not in (0, None):
            print(exc.code if isinstance(exc.code, str) else "FAIL")
            return int(exc.code) if isinstance(exc.code, int) else 1
        raise
    mag = report["magnification"]["max"]
    hull = report.get("hull") or {}
    seam = report.get("seam") or {}
    dist = report["magnification"]["approachMinDistance"]
    print(
        "PASS walkaround out={out} maxMagnification={mag:.4f} atDistance={dist:.4f} views={n} vertices={v} seam={seam:.3f} surface={surf} depth={d}".format(
            out=args.out,
            mag=mag,
            dist=dist,
            n=report["viewCount"],
            v=hull.get("vertexCount", report["coverage"]["surfaceCount"]),
            seam=float(seam.get("meanFragmentSeamFraction", seam.get("voxelSeamFraction", 0.0))),
            surf=hull.get("surface", "voxels"),
            d=report["depthRefine"],
        )
    )
    for src in report.get("sources") or []:
        print(
            "  source {file} {w}x{h} yaw={yaw} elev={elev}".format(
                file=src["file"],
                w=src["width"],
                h=src["height"],
                yaw=src["yawDeg"],
                elev=src["elevationDeg"],
            )
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())

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
    args = parser.parse_args()
    if args.model is not None and args.depth_dir is not None:
        print("FAIL depth: pass --model or --depth-dir, not both", file=sys.stderr)
        return 1
    try:
        report = build(args.views, args.config, args.out, args.model, args.depth_dir)
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
    print(
        "PASS walkaround out={out} maxMagnification={mag:.4f} views={n} surface={s} depth={d}".format(
            out=args.out,
            mag=mag,
            n=report["viewCount"],
            s=report["coverage"]["surfaceCount"],
            d=report["depthRefine"],
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

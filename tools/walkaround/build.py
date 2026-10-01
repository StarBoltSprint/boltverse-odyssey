#!/usr/bin/env python3
"""Build a walk-around invisible hull from a folder of still views.

Does not call Imagine. Imagine pixels are copied lossless and never upscaled.

  python3 tools/walkaround/build.py \\
    --views <views-dir> --config <config.json> --out <out-dir> \\
    --model /path/to/depth_anything_v2_small.onnx

The default shape is the silhouette volume + surface nets. Optional methods:

  --shape photogrammetry
  --shape primitive --primitive box|cylinder
  --compare --shape primitive --primitive box
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

from hull import BuildFailure, build


def _options(args: argparse.Namespace, shape: str | None) -> dict:
    return {
        "surface": args.surface,
        "legacy_voxels": args.legacy_voxels,
        "surface_grid": args.surface_grid,
        "smooth_iters": args.smooth_iters,
        "depth_relief": args.depth_relief,
        "shape": shape,
        "primitive": args.primitive,
        "videos": args.videos,
        "turntables": args.turntable,
        "top_rise": args.top_rise,
        "max_frames": args.max_frames,
        "photogram_engine": args.photogram_engine,
    }


def _pass_line(report: dict, out: Path) -> str:
    mag = report["magnification"]["max"]
    hull = report.get("hull") or {}
    seam = report.get("seam") or {}
    dist = report["magnification"]["approachMinDistance"]
    return (
        "PASS walkaround out={out} maxMagnification={mag:.4f} atDistance={dist:.4f} views={n} vertices={v} seam={seam:.3f} surface={surf} depth={d}".format(
            out=out,
            mag=mag,
            dist=dist,
            n=report["viewCount"],
            v=hull.get("vertexCount", report["coverage"]["surfaceCount"]),
            seam=float(seam.get("meanFragmentSeamFraction", seam.get("voxelSeamFraction", 0.0))),
            surf=hull.get("surface", "voxels"),
            d=report["depthRefine"],
        )
    )


def _print_sources(report: dict) -> None:
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


def _run_build(args: argparse.Namespace, shape: str | None, out: Path) -> tuple[dict | None, list[str]]:
    try:
        report = build(
            args.views,
            args.config,
            out,
            args.model,
            args.depth_dir,
            options=_options(args, shape),
        )
        return report, []
    except BuildFailure as exc:
        return exc.report, list(exc.lines)
    except SystemExit as exc:
        if exc.code in (0, None):
            raise
        message = exc.code if isinstance(exc.code, str) else "FAIL"
        report_path = out / "qc" / "report.json"
        report = None
        if report_path.is_file():
            report = json.loads(report_path.read_text())
        return report, [message]


def _method_id(shape: str | None, primitive: str | None) -> str:
    if shape is None:
        return "default"
    if shape == "primitive":
        return f"primitive-{primitive}"
    return shape


def _copy_tree(src: Path, dest: Path) -> None:
    if not src.is_dir():
        return
    dest.mkdir(parents=True, exist_ok=True)
    for item in src.iterdir():
        target = dest / item.name
        if item.is_dir():
            if target.exists():
                shutil.rmtree(target)
            shutil.copytree(item, target)
        else:
            shutil.copyfile(item, target)


def _compare(args: argparse.Namespace) -> int:
    import metrics

    shapes = list(args.shape or [])
    jobs = [("default", None)]
    for shape in shapes:
        jobs.append((_method_id(shape, args.primitive), shape))
    args.out.mkdir(parents=True, exist_ok=True)
    built: list[tuple[str, Path, dict | None, list[str]]] = []
    for method_id, shape in jobs:
        dest = args.out / "methods" / method_id
        if dest.exists():
            shutil.rmtree(dest)
        report, lines = _run_build(args, shape, dest)
        built.append((method_id, dest, report, lines))
        if report and report.get("ok") and not lines:
            print(_pass_line(report, dest))
        else:
            for line in lines or (report or {}).get("failures") or [f"FAIL {method_id}"]:
                print(line)
    comparison = metrics.write_comparison(args.out, [(m, p, r) for m, p, r, _lines in built])
    recommended = comparison["recommended"]
    rec_path = args.out / "methods" / recommended
    rec_report = json.loads((rec_path / "qc" / "report.json").read_text())
    for name in ("asset.json", "hull.npz", "mesh.bin"):
        src = rec_path / name
        if src.is_file():
            shutil.copyfile(src, args.out / name)
    for folder in ("views", "masks"):
        _copy_tree(rec_path / folder, args.out / folder)
    qc = args.out / "qc"
    qc.mkdir(parents=True, exist_ok=True)
    src_qc = rec_path / "qc"
    if src_qc.is_dir():
        for item in src_qc.glob("*.png"):
            shutil.copyfile(item, qc / item.name)
    rec_report["comparison"] = comparison
    (qc / "report.json").write_text(json.dumps(rec_report, indent=2) + "\n")
    (qc / "report.md").write_text(metrics.report_md(comparison) + "\n")
    print(
        "COMPARE recommended={rec} score={score:.3f} schema={schema}".format(
            rec=recommended,
            score=float(comparison["recommendedScore"]),
            schema=comparison["schema"],
        )
    )
    requested_failed = False
    for method_id, _dest, report, lines in built:
        if method_id == "default":
            continue
        if lines or not (report and report.get("ok")):
            requested_failed = True
    if requested_failed:
        print("COMPARE a requested shape FAILed. The default method was not substituted.")
        return 1
    if not comparison.get("recommendedOk"):
        return 1
    return 0


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
    parser.add_argument(
        "--shape",
        action="append",
        choices=("photogrammetry", "primitive"),
        default=None,
        help="Optional shape. Omit it and the silhouette volume + surface nets stays the method. Repeat only with --compare.",
    )
    parser.add_argument(
        "--primitive",
        choices=("box", "cylinder"),
        default=None,
        help="Required with --shape primitive. Fits that solid to the silhouettes.",
    )
    parser.add_argument(
        "--compare",
        action="store_true",
        help="Run the default method and each --shape, then write qc/report.json comparison.",
    )
    parser.add_argument(
        "--turntable",
        action="append",
        default=None,
        help="path:yawStart:yawEnd. Four clips of 90° each. Overrides config turntables.",
    )
    parser.add_argument(
        "--top-rise",
        default=None,
        help="path:yaw:elevStart:elevEnd. Optional photogrammetry clip.",
    )
    parser.add_argument(
        "--videos",
        type=Path,
        default=None,
        help="Folder used to resolve turntable file names.",
    )
    parser.add_argument(
        "--photogram-engine",
        choices=("cpu", "colmap"),
        default="cpu",
        help="cpu is the OpenCV turntable solver. colmap FAILs when the binary is missing. It does not switch engines.",
    )
    parser.add_argument("--max-frames", type=int, default=8, help="Frames kept per turntable clip, including both pinned ends.")
    args = parser.parse_args()
    if args.model is not None and args.depth_dir is not None:
        print("FAIL depth: pass --model or --depth-dir, not both", file=sys.stderr)
        return 1
    shapes = list(args.shape or [])
    if "primitive" in shapes and args.primitive is None:
        print("FAIL primitive: --shape primitive needs --primitive box or --primitive cylinder")
        return 1
    if args.compare and not shapes:
        print("FAIL compare: pass at least one --shape. The default method is included on its own.")
        return 1
    if len(shapes) > 1 and not args.compare:
        print("FAIL shape: pass --compare to run more than one method.")
        return 1
    if args.compare:
        return _compare(args)
    shape = shapes[0] if shapes else None
    report, lines = _run_build(args, shape, args.out)
    if lines or not report or not report.get("ok"):
        for line in lines or (report or {}).get("failures") or ["FAIL"]:
            print(line)
        return 1
    print(_pass_line(report, args.out))
    _print_sources(report)
    return 0


if __name__ == "__main__":
    sys.exit(main())

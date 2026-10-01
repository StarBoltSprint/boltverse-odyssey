#!/usr/bin/env python3
"""Reject a bad Imagine cook before it enters the game.

Measures only. Does not resize, regrade, or replace the source.

  python3 tools/assetcheck/check.py --manifest manifest.json --out reports/assetcheck
  python3 tools/assetcheck/check.py --dir stills --kind cutout --on-screen 400x700 --out reports/assetcheck

Exit 0 when every check PASSes. Exit 1 on any FAIL. A hand-written PASS is not a PASS.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from measures import (
    CheckError,
    discover_assets,
    load_manifest,
    measure_manifest,
    parse_on_screen,
    to_markdown,
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Measure Imagine images and videos before they enter the game")
    parser.add_argument("--manifest", type=Path, help="manifest.json: file, kind, yaw, elevation, onScreen")
    parser.add_argument("--dir", type=Path, help="Folder of assets. Uses manifest.json inside it when present.")
    parser.add_argument("--kind", default="", help="Kind when --dir has no manifest")
    parser.add_argument("--on-screen", default="", help="Intended pixels at the closest camera, WxH, on a 720x1600 portrait")
    parser.add_argument("--key", default="", help="alpha, black, green, or none")
    parser.add_argument("--loop", action="store_true", help="Treat videos found in --dir as loops")
    parser.add_argument("--out", type=Path, required=True, help="Directory for report.md and report.json")
    args = parser.parse_args()
    try:
        if args.manifest:
            manifest = load_manifest(args.manifest)
            root = args.manifest.parent
        elif args.dir:
            bundled = args.dir / "manifest.json"
            if bundled.is_file() and not args.kind and not args.on_screen:
                manifest = load_manifest(bundled)
                root = args.dir
            else:
                on_screen = parse_on_screen(args.on_screen) if args.on_screen else None
                manifest = discover_assets(
                    args.dir,
                    args.kind,
                    on_screen,
                    args.key or None,
                    True if args.loop else None,
                )
                root = args.dir
        else:
            print("FAIL assetcheck: pass --manifest or --dir", file=sys.stderr)
            return 2
        report = measure_manifest(manifest, root)
    except CheckError as exc:
        print(f"FAIL assetcheck {exc.message}", file=sys.stderr)
        return 2
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    (args.out / "report.md").write_text(to_markdown(report))
    for asset in report["assets"]:
        for name, check in asset.get("checks", {}).items():
            if check.get("deferred") or check.get("sharedWith"):
                continue
            flag = check.get("status", "FAIL")
            extra = ""
            if name == "resolution" and check.get("magnification") is not None:
                extra = f" mag={check['magnification']}"
            if name == "loop" and check.get("seamMAE") is not None:
                extra = f" seamMAE={check['seamMAE']} flow={check['seamFlowPx']}"
            print(f"{flag} {name} {asset['file']}{extra}")
    if report["ok"]:
        print(f"PASS assetcheck out={args.out} assets={len(report['assets'])}")
        return 0
    print(f"FAIL assetcheck out={args.out} failures={len(report['failures'])}")
    for line in report["failures"]:
        print(line)
    return 1


if __name__ == "__main__":
    sys.exit(main())

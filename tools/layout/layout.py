#!/usr/bin/env python3
"""Zone layout tool. Writes and checks clearing.json. Does not draw a world.

  python3 tools/layout/layout.py generate --spec tools/layout/testdata/spec.json --out /tmp/zone
  python3 tools/layout/layout.py check --clearing /tmp/zone/clearing.json --out /tmp/zone
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.layout.check import check_clearing, render_report, rows_json
from tools.layout.diagram import write_diagram
from tools.layout.generate import LayoutError, generate
from tools.layout.model import dump_json, load_json


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate or check a zone clearing.json")
    sub = parser.add_subparsers(dest="cmd", required=True)

    gen = sub.add_parser("generate", help="spec → clearing.json")
    gen.add_argument("--spec", required=True, type=Path)
    gen.add_argument("--out", required=True, type=Path)
    gen.add_argument("--assets", type=Path, default=None, help="extra directory to resolve asset paths")

    chk = sub.add_parser("check", help="clearing.json → PASS/FAIL report and a top-down diagram")
    chk.add_argument("--clearing", required=True, type=Path)
    chk.add_argument("--out", required=True, type=Path)
    chk.add_argument("--assets", type=Path, default=None)
    chk.add_argument(
        "--world",
        type=Path,
        default=None,
        help="optional world.json; adds the transition row and leaves a check without it unchanged",
    )

    args = parser.parse_args(argv)
    try:
        if args.cmd == "generate":
            roots = [args.assets] if args.assets else []
            clearing = generate(args.spec, args.out, roots)
            print(f"PASS generate id={clearing.get('id')} out={args.out / 'clearing.json'}")
            return 0
        world = load_json(args.world) if args.world else None
        return _check(args.clearing, args.out, [args.assets] if args.assets else [], world)
    except (LayoutError, FileNotFoundError, ValueError, KeyError, OSError) as exc:
        print(f"FAIL layout {exc}", file=sys.stderr)
        return 2


def _check(clearing_path: Path, out_dir: Path, roots: list[Path], world: dict | None = None) -> int:
    rows, extra = check_clearing(clearing_path, roots, world)
    clearing = json.loads(clearing_path.read_text(encoding="utf-8"))
    text = render_report(rows, str(clearing.get("id") or clearing_path.stem))
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "report.md").write_text(text, encoding="utf-8")
    payload = {
        "id": clearing.get("id"),
        "ok": all(r.ok for r in rows),
        "rows": rows_json(rows),
    }
    (out_dir / "report.json").write_text(dump_json(payload), encoding="utf-8")
    write_diagram(out_dir / "debug-topdown.png", clearing, extra)
    for row in rows:
        print(row.line())
    fails = [r for r in rows if not r.ok]
    if fails:
        print(f"FAIL {len(fails)} rows")
        return 1
    print(f"PASS {len(rows)} rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

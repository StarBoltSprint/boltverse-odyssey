#!/usr/bin/env python3
"""Shot-sheet visual verdict for the Art Director.

Five cells, in order: key, 45°, grazing, 8 m, 3 m up. Each cell names the
Imagine plate and the render when that file exists. Both paths set means the
cell is plate | render side by side. A missing side is null.

The sheet starts PENDING. Defect lists stay empty until the Art Director
fills them. Library intake is refused while the verdict or any cell is
PENDING. KEEP with every defect list empty is the only allow. FAIL must
list the defects and does not enter the library.

This file does not call Imagine and does not read pixels.

  python3 tools/objsheet/verdict.py emit --build <id> --out <shot-verdict.json>
  python3 tools/objsheet/verdict.py fill --sheet <file> --verdict KEEP --out <file>
  python3 tools/objsheet/verdict.py fill --sheet <file> --verdict FAIL --defect "8 m=soft cornice" --out <file>
  python3 tools/objsheet/verdict.py intake --sheet <file>
"""

from __future__ import annotations

import argparse
import copy
import json
import sys
from pathlib import Path

SCHEMA = "objsheet-shot-verdict/1"
SHOT_VIEWS = ("key", "45°", "grazing", "8 m", "3 m up")
STATUSES = ("PENDING", "KEEP", "FAIL")
VERDICTS = ("PENDING", "KEEP", "FAIL")
CELL_KEYS = ("view", "plate_path", "render_path", "status", "defects")

_VIEW_ALIASES = {
    "key": "key",
    "45": "45°",
    "45°": "45°",
    "45deg": "45°",
    "grazing": "grazing",
    "8m": "8 m",
    "8 m": "8 m",
    "8-m": "8 m",
    "3m": "3 m up",
    "3 m": "3 m up",
    "3m-up": "3 m up",
    "3 m up": "3 m up",
    "3-m-up": "3 m up",
}


class IntakeRefused(RuntimeError):
    """Library intake must not proceed. `reason` is PENDING, FAIL, or shape."""

    def __init__(self, reason: str, defects: list[str] | None = None):
        self.reason = reason
        self.defects = list(defects or [])
        super().__init__(reason if not self.defects else reason + ": " + "; ".join(self.defects))


def canonical_view(name: str) -> str:
    key = " ".join(str(name).strip().split())
    found = _VIEW_ALIASES.get(key) or _VIEW_ALIASES.get(key.lower())
    if not found:
        raise ValueError(f"unknown view {name}")
    return found


def emit_sheet(
    build: str,
    plates: dict[str, str] | None = None,
    renders: dict[str, str] | None = None,
) -> dict:
    """Fresh Art Director sheet. Every cell is PENDING and defects are empty."""
    label = str(build).strip()
    if not label:
        raise ValueError("build id is required")
    plates = dict(plates or {})
    renders = dict(renders or {})
    unknown = (set(plates) | set(renders)) - set(SHOT_VIEWS)
    if unknown:
        raise ValueError("unknown view " + ", ".join(sorted(unknown)))
    cells = []
    for view in SHOT_VIEWS:
        cells.append(
            {
                "view": view,
                "plate_path": plates.get(view),
                "render_path": renders.get(view),
                "status": "PENDING",
                "defects": [],
            }
        )
    return {"schema": SCHEMA, "build": label, "verdict": "PENDING", "cells": cells}


def shape_errors(sheet: dict) -> list[str]:
    """Missing or mistyped fields. Empty means the JSON has the shot-sheet shape."""
    if not isinstance(sheet, dict):
        return ["sheet is not an object"]
    errors: list[str] = []
    if sheet.get("schema") != SCHEMA:
        errors.append("schema")
    build = sheet.get("build")
    if not isinstance(build, str) or not build.strip():
        errors.append("build")
    if sheet.get("verdict") not in VERDICTS:
        errors.append("verdict")
    cells = sheet.get("cells")
    if not isinstance(cells, list) or len(cells) != len(SHOT_VIEWS):
        errors.append("cells")
        return errors
    for expect, cell in zip(SHOT_VIEWS, cells):
        if not isinstance(cell, dict):
            errors.append(f"{expect} not an object")
            continue
        for key in CELL_KEYS:
            if key not in cell:
                errors.append(f"{expect} missing {key}")
        if cell.get("view") != expect:
            errors.append(f"view order {cell.get('view')}")
        if cell.get("status") not in STATUSES:
            errors.append(f"{expect} status")
        if not _path_ok(cell.get("plate_path")):
            errors.append(f"{expect} plate_path")
        if not _path_ok(cell.get("render_path")):
            errors.append(f"{expect} render_path")
        defects = cell.get("defects")
        if not isinstance(defects, list) or any(not isinstance(item, str) or not item.strip() for item in defects):
            errors.append(f"{expect} defects")
    return errors


def apply_art_director(
    sheet: dict,
    verdict: str,
    defects: dict[str, list[str]] | None = None,
) -> dict:
    """Copy the sheet with the Art Director's KEEP or FAIL. Does not mutate `sheet`."""
    errors = shape_errors(sheet)
    if errors:
        raise ValueError("sheet shape: " + "; ".join(errors))
    verdict = str(verdict).strip().upper()
    if verdict not in ("KEEP", "FAIL"):
        raise ValueError("Art Director verdict must be KEEP or FAIL")
    cleaned = _clean_defects(defects or {})
    if verdict == "KEEP" and cleaned:
        raise ValueError("KEEP requires empty defects")
    if verdict == "FAIL" and not any(cleaned.values()):
        raise ValueError("FAIL requires defects listed")
    out = copy.deepcopy(sheet)
    out["verdict"] = verdict
    for cell in out["cells"]:
        listed = cleaned.get(cell["view"], [])
        if listed:
            cell["status"] = "FAIL"
            cell["defects"] = listed
        else:
            cell["status"] = "KEEP"
            cell["defects"] = []
    return out


def library_intake(sheet: dict) -> dict:
    """Stub a library add calls before it accepts an object.

    PENDING raises IntakeRefused. KEEP with empty defects returns allow True.
    FAIL with defects listed returns allow False and those defect strings.
    """
    errors = shape_errors(sheet)
    if errors:
        raise IntakeRefused("shape: " + "; ".join(errors))
    verdict = sheet["verdict"]
    if verdict == "PENDING" or any(cell["status"] == "PENDING" for cell in sheet["cells"]):
        raise IntakeRefused("PENDING blocks library intake")
    listed = [item for cell in sheet["cells"] for item in cell["defects"]]
    if verdict == "KEEP":
        if listed or any(cell["status"] != "KEEP" for cell in sheet["cells"]):
            raise IntakeRefused("KEEP requires empty defects")
        return {"allow": True, "verdict": "KEEP", "defects": []}
    if verdict == "FAIL":
        if not listed:
            raise IntakeRefused("FAIL requires defects listed")
        for cell in sheet["cells"]:
            if cell["status"] == "FAIL" and not cell["defects"]:
                raise IntakeRefused("FAIL cell missing defects")
            if cell["status"] == "KEEP" and cell["defects"]:
                raise IntakeRefused("KEEP cell lists defects")
            if cell["status"] not in ("KEEP", "FAIL"):
                raise IntakeRefused(f"{cell['view']} status {cell['status']}")
        return {"allow": False, "verdict": "FAIL", "defects": listed}
    raise IntakeRefused(f"verdict {verdict}")


def write_sheet(path: Path, sheet: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(sheet, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def load_sheet(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"{path} is not a sheet object")
    return data


def parse_pair(token: str) -> tuple[str, str]:
    if "=" not in token:
        raise ValueError(f"expected VIEW=TEXT, got {token}")
    raw_view, raw_text = token.split("=", 1)
    view = canonical_view(raw_view)
    text = raw_text.strip()
    if not text:
        raise ValueError(f"empty value for {view}")
    return view, text


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Art Director shot-sheet visual verdict")
    sub = parser.add_subparsers(dest="cmd", required=True)

    emit = sub.add_parser("emit", help="Write a PENDING sheet")
    emit.add_argument("--build", required=True)
    emit.add_argument("--out", required=True, type=Path)
    emit.add_argument("--plate", action="append", default=[], metavar="VIEW=PATH")
    emit.add_argument("--render", action="append", default=[], metavar="VIEW=PATH")

    fill = sub.add_parser("fill", help="Record KEEP or FAIL")
    fill.add_argument("--sheet", required=True, type=Path)
    fill.add_argument("--verdict", required=True, choices=("KEEP", "FAIL"))
    fill.add_argument("--out", required=True, type=Path)
    fill.add_argument("--defect", action="append", default=[], metavar="VIEW=TEXT")

    intake = sub.add_parser("intake", help="Library intake stub")
    intake.add_argument("--sheet", required=True, type=Path)

    args = parser.parse_args(argv)
    try:
        if args.cmd == "emit":
            sheet = emit_sheet(args.build, _pair_map(args.plate), _pair_map(args.render))
            write_sheet(args.out, sheet)
            print(f"PENDING shot-verdict build={sheet['build']} out={args.out}")
            return 0
        if args.cmd == "fill":
            sheet = apply_art_director(load_sheet(args.sheet), args.verdict, _defect_map(args.defect))
            write_sheet(args.out, sheet)
            print(f"{sheet['verdict']} shot-verdict out={args.out}")
            return 0
        decision = library_intake(load_sheet(args.sheet))
    except (IntakeRefused, ValueError, OSError, json.JSONDecodeError) as exc:
        reason = getattr(exc, "reason", "")
        if isinstance(exc, IntakeRefused) and reason.startswith("PENDING"):
            print(f"REFUSE {exc}", file=sys.stderr)
            return 1
        if isinstance(exc, IntakeRefused):
            print(f"REFUSE {exc}", file=sys.stderr)
            return 1
        print(f"FAIL {exc}", file=sys.stderr)
        return 2
    if decision["allow"]:
        print("ALLOW KEEP")
        return 0
    print("REFUSE FAIL")
    for item in decision["defects"]:
        print(f"- {item}")
    return 1


def _path_ok(value: object) -> bool:
    if value is None:
        return True
    return isinstance(value, str) and bool(value.strip())


def _clean_defects(defects: dict[str, list[str]]) -> dict[str, list[str]]:
    unknown = set(defects) - set(SHOT_VIEWS)
    if unknown:
        raise ValueError("unknown view " + ", ".join(sorted(unknown)))
    cleaned: dict[str, list[str]] = {}
    for view, items in defects.items():
        texts = [str(item).strip() for item in items if str(item).strip()]
        if texts:
            cleaned[view] = texts
    return cleaned


def _pair_map(tokens: list[str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for token in tokens:
        view, path = parse_pair(token)
        out[view] = path
    return out


def _defect_map(tokens: list[str]) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for token in tokens:
        view, text = parse_pair(token)
        out.setdefault(view, []).append(text)
    return out


if __name__ == "__main__":
    sys.exit(main())

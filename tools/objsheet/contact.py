#!/usr/bin/env python3
"""One fixed contact sheet per block build.

Cells, in this order, when the step or profile has that pair:
  1. key camera
  2. 45° oblique
  3. grazing
  4. 8 m approach
  5. 3 m up

Each cell is the plate beside its render. Both are fitted into the same frame.
A missing key camera is skipped. This command does not invent one and does not call Imagine.

  python3 tools/objsheet/contact.py --spec <sheet.json> --out <dir>

Exit 0 when every provided pair is drawn. Exit 1 when a named pair is missing a file
or a plate has no render. Exit 2 on a bad invocation.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

SLOTS = (
    ("key", "key camera"),
    ("oblique45", "45° oblique"),
    ("grazing", "grazing"),
    ("approach8m", "8 m approach"),
    ("up3m", "3 m up"),
)
FRAME = 64
PAD = 8
LABEL_H = 16


class ContactFailure(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


def fit_frame(path: Path, box: int) -> Image.Image:
    with Image.open(path) as im:
        rgb = im.convert("RGB")
        w, h = rgb.size
        scale = min(box / w, box / h)
        nw = max(1, int(round(w * scale)))
        nh = max(1, int(round(h * scale)))
        resized = rgb.resize((nw, nh), Image.Resampling.NEAREST)
    canvas = Image.new("RGB", (box, box), (0, 0, 0))
    canvas.paste(resized, ((box - nw) // 2, (box - nh) // 2))
    return canvas


def _pair(spec: dict, slot: str) -> dict | None:
    cells = spec.get("cells") or spec.get("views") or {}
    raw = cells.get(slot)
    if raw is None and slot == "key":
        raw = spec.get("keyCamera")
    if raw in (None, False):
        return None
    if not isinstance(raw, dict):
        raise ContactFailure(f"{slot} is not a plate/render pair")
    if not raw.get("plate") or not raw.get("render"):
        raise ContactFailure(f"{slot} needs both a plate and a render")
    return raw


def build_contact(spec: dict, base: Path, out: Path) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    drawn = []
    skipped = []
    for slot, label in SLOTS:
        pair = _pair(spec, slot)
        if pair is None:
            skipped.append(slot)
            continue
        plate = _resolve(pair["plate"], base)
        render = _resolve(pair["render"], base)
        if not plate.is_file():
            raise ContactFailure(f"{slot} plate missing: {plate}")
        if not render.is_file():
            raise ContactFailure(f"{slot} render missing: {render}")
        drawn.append({"slot": slot, "label": label, "plate": plate, "render": render})
    if not drawn:
        raise ContactFailure("no plate/render pairs")
    cell_w = PAD + FRAME + PAD + FRAME + PAD
    cell_h = LABEL_H + FRAME + PAD
    sheet = Image.new("RGB", (cell_w * len(drawn), cell_h), (16, 16, 16))
    draw = ImageDraw.Draw(sheet)
    cells = []
    for i, item in enumerate(drawn):
        x0 = i * cell_w
        plate_box = (x0 + PAD, LABEL_H, FRAME, FRAME)
        render_box = (x0 + PAD + FRAME + PAD, LABEL_H, FRAME, FRAME)
        sheet.paste(fit_frame(item["plate"], FRAME), (plate_box[0], plate_box[1]))
        sheet.paste(fit_frame(item["render"], FRAME), (render_box[0], render_box[1]))
        draw.text((x0 + PAD, 1), item["label"], fill=(220, 220, 220))
        cells.append(
            {
                "slot": item["slot"],
                "label": item["label"],
                "plate": item["plate"].as_posix(),
                "render": item["render"].as_posix(),
                "frame": [FRAME, FRAME],
                "plateBox": list(plate_box),
                "renderBox": list(render_box),
            }
        )
    sheet_path = out / "sheet.png"
    sheet.save(sheet_path)
    report = {
        "tool": "objsheet-contact",
        "ok": True,
        "order": [c["slot"] for c in cells],
        "skipped": skipped,
        "cells": cells,
        "sheet": sheet_path.as_posix(),
        "frame": [FRAME, FRAME],
    }
    (out / "report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    lines = ["# Contact sheet", "", "Fixed order. A missing key camera is skipped.", ""]
    for cell in cells:
        lines.append(f"- {cell['label']}: plate beside render, frame {FRAME}×{FRAME}")
    if "key" in skipped:
        lines.append("- key camera: skipped (not named)")
    (out / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return report


def _resolve(value: str, base: Path) -> Path:
    raw = Path(value)
    if raw.is_file():
        return raw
    cand = base / value
    if cand.is_file():
        return cand
    return cand


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Fixed plate|render contact sheet")
    parser.add_argument("--spec", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args(argv)
    spec_path = Path(args.spec)
    try:
        spec = json.loads(spec_path.read_text(encoding="utf-8"))
        report = build_contact(spec, spec_path.parent, Path(args.out))
    except (OSError, json.JSONDecodeError, ContactFailure) as exc:
        message = getattr(exc, "message", str(exc))
        print(f"FAIL {message}", file=sys.stderr)
        return 1
    print("PASS contact " + " ".join(report["order"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())

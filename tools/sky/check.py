#!/usr/bin/env python3
"""Gate a sky slice chain and its living Imagine-video layers.

Measures only. Does not clone columns, blend a failed seam, or paint a pixel.

  python3 tools/sky/check.py --slices <dir> --out <reports>
  python3 tools/sky/check.py --manifest sky.json --out <reports>

Exit 0 on PASS. Exit 1 on FAIL. Exit 2 on a broken invocation.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tools" / "assetcheck"))

from measures import CheckError, check_loop, decode_gray_series, probe_video  # noqa: E402
from pixels import (  # noqa: E402
    AMPLITUDE_MAE,
    COMBINED_MIN_SEC,
    OFFSET_MIN_SEC,
    SKY_TEX_MAX,
    SKY_VIDEOS_MAX,
    assess_display,
    assess_slices,
    frame_amplitude,
    lcm_seconds,
    motif_defect,
    motif_neighbour,
    perceived_repetition,
    MOTIF_NEIGHBOUR,
)


def load_rgb(path: Path) -> np.ndarray:
    with Image.open(path) as im:
        return np.array(im.convert("RGB"))


def _measure_display(manifest: dict, root: Path, named: list) -> dict:
    """Source pixels for each displayed band, cap, and video tile. Missing files stay size 0."""
    display = manifest.get("display") or {}
    measured = {}
    for band in display.get("bands") or []:
        name = str(band.get("id") or "band")
        files = band.get("files")
        try:
            if files == "slices" and named:
                h, w = named[0][1].shape[:2]
                measured[name] = {"srcW": int(w), "srcH": int(h)}
            elif isinstance(files, list) and files:
                rgb = load_rgb(root / str(files[0]))
                measured[name] = {"srcW": int(rgb.shape[1]), "srcH": int(rgb.shape[0])}
        except (OSError, CheckError):
            measured[name] = {"srcW": 0, "srcH": 0}
    cap = display.get("cap") or {}
    if cap.get("file"):
        try:
            rgb = load_rgb(root / str(cap["file"]))
            measured["cap"] = {"srcW": int(rgb.shape[1]), "srcH": int(rgb.shape[0])}
        except (OSError, CheckError):
            measured["cap"] = {"srcW": 0, "srcH": 0}
    layers = {str(layer.get("id")): layer for layer in (manifest.get("layers") or [])}
    for tile in display.get("videoTiles") or []:
        name = str(tile.get("id") or "")
        layer = layers.get(name)
        if not layer or not layer.get("file"):
            continue
        try:
            info = probe_video(root / str(layer["file"]))
            measured[name] = {"srcW": int(info["width"]), "srcH": int(info["height"])}
        except CheckError:
            measured[name] = {"srcW": 0, "srcH": 0}
    return measured


def motif_on_band(root: Path, files: list, label: str) -> list[str]:
    """Repeat / mirror / seam gate for a band that is not the horizon slice list."""
    failures = []
    images = []
    names = []
    for rel in files:
        name = f"{label}/{Path(str(rel)).name}"
        rgb = load_rgb(root / str(rel))
        defect = motif_defect(rgb)
        if defect["repeated"]:
            failures.append(f"FAIL sky motif repeat {name} ncc={defect['repeat']}")
        if defect["mirrored"]:
            failures.append(f"FAIL sky motif mirror {name} ncc={defect['mirror']}")
        if defect["copied"]:
            failures.append(f"FAIL sky motif copy {name} ncc={defect['half']}")
        if defect["seamed"]:
            failures.append(f"FAIL sky motif seam {name} ratio={defect['seamRatio']} at={defect['seamAt']}")
        if defect["gapped"]:
            failures.append(
                f"FAIL sky motif gap {name} center={defect['gapCenter']} drop={defect['gapDrop']}"
            )
        images.append(rgb)
        names.append(name)
    for i in range(len(images)):
        nxt = (i + 1) % len(images)
        score = motif_neighbour(images[i], images[nxt])
        if score >= MOTIF_NEIGHBOUR:
            failures.append(f"FAIL sky motif neighbour {names[i]} -> {names[nxt]} ncc={score:.2f}")
    return failures


def slices_from_dir(folder: Path) -> list[tuple[str, np.ndarray]]:
    files = sorted(p for p in folder.iterdir() if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"})
    if len(files) < 2:
        raise CheckError(f"{folder} needs at least 2 sky slices")
    return [(p.name, load_rgb(p)) for p in files]


def assess_layers(manifest: dict, root: Path, slice_count: int) -> dict:
    layers = list(manifest.get("layers") or [])
    offsets = [float(v) for v in (manifest.get("offsetsSec") or [])]
    one_shots = list(manifest.get("oneShots") or [])
    failures = []
    rows = []
    durations = []
    tex = 0
    for layer in layers:
        name = str(layer.get("id") or layer.get("file"))
        path = root / str(layer["file"])
        declared = float(layer.get("durationSec") or 0)
        try:
            info = probe_video(path)
            series, fps = decode_gray_series(path)
        except CheckError as exc:
            failures.append(f"FAIL sky layer {name} {exc.message}")
            continue
        durations.append(declared or float(info.get("durationSec") or 0))
        tex += int(layer.get("texBytes") or 0)
        loop = check_loop(path, info, series, fps or float(info.get("fps") or 0))
        amp = frame_amplitude(series)
        repeat = perceived_repetition(series, fps or float(info.get("fps") or 0))
        if loop["status"] != "PASS":
            failures.extend(f"FAIL sky layer {name} {line}" for line in loop["failures"])
        if amp > AMPLITUDE_MAE:
            failures.append(f"FAIL sky layer {name} motion MAE={amp:.2f} limit={AMPLITUDE_MAE}")
        if not repeat["ok"]:
            failures.append(
                f"FAIL sky layer {name} perceived repetition period={repeat['periodSec']}s limit={60}"
            )
        if declared and info.get("durationSec") and abs(declared - float(info["durationSec"])) > 1.5:
            failures.append(
                f"FAIL sky layer {name} declared duration {declared}s != file {info['durationSec']}s"
            )
        rows.append(
            {
                "id": name,
                "file": layer.get("file"),
                "durationSec": declared or info.get("durationSec"),
                "seamMAE": loop.get("seamMAE"),
                "amplitudeMAE": round(amp, 4),
                "repetition": repeat,
                "loop": loop["status"],
            }
        )
    combined = lcm_seconds([d for d in durations if d > 0])
    if layers and combined < COMBINED_MIN_SEC:
        failures.append(
            f"FAIL sky combined repeat {combined}s is under {COMBINED_MIN_SEC}s (many minutes)"
        )
    if layers and slice_count > 1:
        if len(offsets) != slice_count:
            failures.append(
                f"FAIL sky offsets {len(offsets)} != slices {slice_count}; adjacent slices would sync"
            )
        else:
            for i, offset in enumerate(offsets):
                nxt = offsets[(i + 1) % len(offsets)]
                if abs(offset - nxt) < OFFSET_MIN_SEC:
                    failures.append(
                        f"FAIL sky offset slice {i} and {(i + 1) % len(offsets)} differ by under {OFFSET_MIN_SEC}s"
                    )
    concurrent = len(layers) + (1 if one_shots else 0)
    if concurrent > SKY_VIDEOS_MAX:
        failures.append(
            f"FAIL sky active videos {concurrent} exceed {SKY_VIDEOS_MAX} (phone decoder cap, Bolt keeps one)"
        )
    if tex > SKY_TEX_MAX:
        failures.append(f"FAIL sky texture bytes {tex} exceed {SKY_TEX_MAX}")
    for shot in one_shots:
        lo = float(shot.get("minGapSec") or 0)
        hi = float(shot.get("maxGapSec") or 0)
        if hi <= lo or lo < 30:
            failures.append(
                f"FAIL sky one-shot {shot.get('id') or shot.get('file')} needs a random gap of at least 30s, not a short loop"
            )
    return {
        "layers": rows,
        "combinedRepeatSec": combined,
        "activeVideos": concurrent,
        "texBytes": tex,
        "offsetsSec": offsets,
        "failures": failures,
        "limits": {
            "combinedMinSec": COMBINED_MIN_SEC,
            "videos": SKY_VIDEOS_MAX,
            "texBytes": SKY_TEX_MAX,
            "amplitudeMAE": AMPLITUDE_MAE,
            "offsetMinSec": OFFSET_MIN_SEC,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Measure a sky slice chain and its living loops")
    parser.add_argument("--slices", type=Path, help="Directory of slice stills, sorted by name")
    parser.add_argument("--manifest", type=Path, help="sky.json with slices, layers, offsetsSec")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.manifest:
            manifest = json.loads(args.manifest.read_text())
            root = args.manifest.parent
            names = list(manifest.get("slices") or [])
            named = [(name, load_rgb(root / name)) for name in names]
            if len(named) < 2:
                raise CheckError("manifest slices needs at least 2 images")
        elif args.slices:
            manifest = {}
            root = args.slices
            named = slices_from_dir(args.slices)
        else:
            print("FAIL sky: pass --slices or --manifest", file=sys.stderr)
            return 2
        report = assess_slices(named)
        display = manifest.get("display") if manifest else None
        if isinstance(display, dict):
            for band in display.get("bands") or []:
                files = band.get("files")
                if not isinstance(files, list) or len(files) < 2:
                    continue
                report["failures"] = list(report["failures"]) + motif_on_band(
                    root, files, str(band.get("id") or "band")
                )
        if manifest.get("layers") or manifest.get("oneShots") or manifest.get("offsetsSec"):
            layers = assess_layers(manifest, root, len(named))
            report["layers"] = layers
            report["failures"] = list(report["failures"]) + list(layers["failures"])
        display = manifest.get("display") if manifest else None
        if manifest and manifest.get("layers") and not (isinstance(display, dict) and display.get("videoTiles")):
            report["failures"] = list(report["failures"]) + [
                "FAIL sky display videoTiles missing; cannot prove magnification <= 1"
            ]
        if isinstance(display, dict):
            shown = assess_display(display, _measure_display(manifest, root, named))
            report["display"] = shown
            report["failures"] = list(report["failures"]) + list(shown["failures"])
        report["ok"] = not report["failures"]
        report["status"] = "PASS" if report["ok"] else "FAIL"
    except CheckError as exc:
        print(f"FAIL sky {exc.message}", file=sys.stderr)
        return 2
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    lines = [f"# sky {report['status']}", ""]
    for line in report["failures"]:
        lines.append(f"- {line}")
    if report.get("cheapest", {}).get("file"):
        lines.append("")
        lines.append(f"Cheapest recook: {report['cheapest']['why']}")
    if report.get("layers"):
        lines.append("")
        lines.append(f"Combined repeat: {report['layers']['combinedRepeatSec']}s")
    if report.get("display"):
        lines.append("")
        lines.append(f"Magnification limit: {report['display'].get('limit')}")
        for row in report["display"].get("rows") or []:
            lines.append(
                f"- {row.get('id')} mag={row.get('mag')} magW={row.get('magW')} magH={row.get('magH')}"
            )
    lines.append("")
    (args.out / "report.md").write_text("\n".join(lines))
    print(f"{report['status']} sky out={args.out} slices={len(named)} failures={len(report['failures'])}")
    if report.get("cheapest", {}).get("why"):
        print(report["cheapest"]["why"])
    for line in report["failures"]:
        print(line)
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())

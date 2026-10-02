#!/usr/bin/env python3
"""Check the living-loop registry. Measures files. Does not recook them.

  python3 stock/loops/check.py --registry stock/loops/loops.json --out <dir>

An empty loops array passes. A listed file that is missing fails.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tools" / "assetcheck"))
sys.path.insert(0, str(ROOT / "tools" / "sky"))

from measures import CheckError, check_loop, decode_gray_series, probe_video  # noqa: E402
from pixels import AMPLITUDE_MAE, SKY_TEX_MAX, frame_amplitude, perceived_repetition  # noqa: E402
from tools.kits.kit import load_schema  # noqa: E402

DURATION_SLOP = 1.5
SEAM_SLOP = 0.05


def check_registry(path: Path) -> dict:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if raw.get("schema") != "living-loop/1":
        raise CheckError("schema must be living-loop/1")
    loops = raw.get("loops")
    if not isinstance(loops, list):
        raise CheckError("loops must be a list")
    roles = set(load_schema()["livingLoopRoles"])
    failures: list[str] = []
    rows = []
    seen: set[str] = set()
    root = path.parent
    for index, entry in enumerate(loops):
        if not isinstance(entry, dict):
            failures.append(f"FAIL loop {index} is not an object")
            continue
        if not entry:
            failures.append(f"FAIL loop {index} is an empty object")
            continue
        loop_id = str(entry.get("id") or "")
        rel = entry.get("file")
        if not loop_id:
            failures.append(f"FAIL loop {index} has no id")
            continue
        if loop_id in seen:
            failures.append(f"FAIL loop {loop_id} duplicate id")
        seen.add(loop_id)
        if not isinstance(rel, str) or not rel.strip():
            failures.append(f"FAIL loop {loop_id} has no file; only register a file that exists")
            continue
        file_path = (root / rel).resolve()
        if "lock" in file_path.parts:
            failures.append(f"FAIL loop {loop_id} is under lock/")
            continue
        if not file_path.is_file():
            failures.append(f"FAIL loop {loop_id} file missing: {rel}")
            continue
        role = entry.get("role")
        if role not in roles:
            failures.append(f"FAIL loop {loop_id} role {role} is not a living-loop role")
        declared = entry.get("durationSec")
        biomes = entry.get("biomes") if isinstance(entry.get("biomes"), list) else []
        if any(not isinstance(tag, str) or not tag for tag in biomes):
            failures.append(f"FAIL loop {loop_id} biome tags must be strings")
        try:
            info = probe_video(file_path)
            series, fps = decode_gray_series(file_path)
        except CheckError as exc:
            failures.append(f"FAIL loop {loop_id} {exc.message}")
            continue
        loop = check_loop(file_path, info, series, fps or float(info.get("fps") or 0))
        amp = frame_amplitude(series)
        repeat = perceived_repetition(series, fps or float(info.get("fps") or 0))
        if loop["status"] != "PASS":
            failures.extend(f"FAIL loop {loop_id} {line}" for line in loop["failures"])
        if amp > AMPLITUDE_MAE:
            failures.append(f"FAIL loop {loop_id} motion MAE={amp:.2f} limit={AMPLITUDE_MAE}")
        if not repeat["ok"]:
            failures.append(
                f"FAIL loop {loop_id} perceived repetition period={repeat['periodSec']}s limit=60"
            )
        file_duration = float(info.get("durationSec") or 0)
        if not isinstance(declared, (int, float)) or isinstance(declared, bool):
            failures.append(f"FAIL loop {loop_id} durationSec is missing")
        elif abs(float(declared) - file_duration) > DURATION_SLOP:
            failures.append(
                f"FAIL loop {loop_id} declared duration {declared}s != file {file_duration}s"
            )
        measured = loop.get("seamMAE")
        stored = entry.get("seamMAE")
        if isinstance(stored, (int, float)) and not isinstance(stored, bool):
            if measured is None or abs(float(stored) - float(measured)) > SEAM_SLOP:
                failures.append(
                    f"FAIL loop {loop_id} seamMAE {stored} != measured {measured}"
                )
        file_bytes = file_path.stat().st_size
        cost = entry.get("decodeCost") if isinstance(entry.get("decodeCost"), dict) else {}
        tex = cost.get("texBytes")
        tex_bytes = int(tex) if isinstance(tex, int) and not isinstance(tex, bool) else file_bytes
        if tex_bytes > SKY_TEX_MAX or file_bytes > SKY_TEX_MAX:
            failures.append(f"FAIL loop {loop_id} decode cost {max(tex_bytes, file_bytes)} exceeds {SKY_TEX_MAX}")
        width = int(info.get("width") or 0)
        height = int(info.get("height") or 0)
        fps_value = float(info.get("fps") or 0)
        rows.append(
            {
                "id": loop_id,
                "file": rel,
                "durationSec": file_duration,
                "seamMAE": measured,
                "biomes": biomes,
                "role": role,
                "decodeCost": {
                    "fileBytes": file_bytes,
                    "texBytes": tex_bytes,
                    "width": width,
                    "height": height,
                    "fps": fps_value,
                    "pixelsPerSec": round(width * height * fps_value),
                },
                "loop": loop["status"],
                "amplitudeMAE": round(amp, 4),
                "repetition": repeat,
            }
        )
    return {
        "tool": "loops",
        "ok": not failures,
        "count": len(loops),
        "loops": rows,
        "failures": failures,
        "limits": {"seamMAE": 8, "amplitudeMAE": AMPLITUDE_MAE, "texBytes": SKY_TEX_MAX},
    }


def write_report(out: Path, report: dict) -> None:
    out.mkdir(parents=True, exist_ok=True)
    (out / "report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    lines = ["# Living loops", ""]
    if report["ok"]:
        lines.append(f"PASS {report['count']} loops")
    else:
        lines.append("FAIL")
        lines.extend(f"- {line}" for line in report["failures"])
    lines.append("")
    for row in report["loops"]:
        lines.append(
            f"- {row['id']} role={row['role']} duration={row['durationSec']}s seamMAE={row['seamMAE']} biomes={','.join(row['biomes']) or 'shared'}"
        )
    (out / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Check stock/loops against the sky and assetcheck loop gates")
    parser.add_argument("--registry", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    if not args.registry.is_file():
        print(f"FAIL loops: registry missing: {args.registry}", file=sys.stderr)
        return 2
    try:
        report = check_registry(args.registry)
    except (json.JSONDecodeError, CheckError) as exc:
        print(f"FAIL loops: {exc}", file=sys.stderr)
        return 2
    write_report(args.out, report)
    print(("PASS" if report["ok"] else "FAIL") + f" loops count={report['count']} out={args.out / 'report.json'}")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())

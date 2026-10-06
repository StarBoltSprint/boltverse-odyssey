#!/usr/bin/env python3
"""Red then green for tools/sky/layer_source.py.

  python3 tools/sky/layer_source_selftest.py

Builds a small synthetic source loop with ffmpeg, then proves: a stream copy with the
audio stripped passes; a downscale, a crf re-encode, and magnification above 1 fail;
a record file checks the same as the source file.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import layer_source as ls  # noqa: E402


def ff(*args: str) -> None:
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


def run(*args: str) -> int:
    return ls.main(list(args))


def main() -> int:
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        print("layer_source selftest: ffmpeg/ffprobe missing, cannot run", file=sys.stderr)
        return 2
    with tempfile.TemporaryDirectory() as td:
        t = Path(td)
        src = t / "imagine.mp4"
        ff("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24:duration=2", "-f", "lavfi", "-i",
           "sine=frequency=440:duration=2", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-shortest", str(src))
        copy = t / "copy.mp4"
        ff("-i", str(src), "-map", "0:v:0", "-c:v", "copy", "-an", str(copy))
        small = t / "small.mp4"
        ff("-i", str(src), "-map", "0:v:0", "-vf", "scale=480:270", "-c:v", "libx264", "-crf", "18", str(small))
        crf = t / "crf.mp4"
        ff("-i", str(src), "-map", "0:v:0", "-c:v", "libx264", "-crf", "35", str(crf))
        rec = t / "imagine.source.json"
        checks = [
            ("stream copy passes", run("check", "--shipped", str(copy), "--source", str(src)), 0),
            ("downscale fails", run("check", "--shipped", str(small), "--source", str(src)), 1),
            ("crf re-encode fails", run("check", "--shipped", str(crf), "--source", str(src)), 1),
            ("mag above 1 fails", run("check", "--shipped", str(copy), "--source", str(src), "--mag", "1.2"), 1),
            ("mag 0.5625 passes", run("check", "--shipped", str(copy), "--source", str(src), "--mag", "0.5625", "--canvas-w", "720"), 0),
            ("record written", run("record", "--source", str(src), "--out", str(rec)), 0),
            ("record check passes", run("check", "--shipped", str(copy), "--record", str(rec)), 0),
            ("record check fails on crf", run("check", "--shipped", str(crf), "--record", str(rec)), 1),
        ]
        bad = [(n, got, want) for n, got, want in checks if got != want]
        data = json.loads(rec.read_text())
        if data["width"] != 640 or data["frames"] != 48 or len(data["frameMd5"]) != 48:
            bad.append(("record numbers", data["width"], 640))
        for n, got, want in checks:
            print(f"{'ok  ' if got == want else 'BAD '} {n} (exit {got}, want {want})")
        if bad:
            print("layer_source selftest: FAIL", bad)
            return 1
        print("layer_source selftest: PASS")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())

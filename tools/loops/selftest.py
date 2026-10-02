#!/usr/bin/env python3
"""Empty registry, a seamless loop, a broken seam, a missing file.

  python3 tools/loops/selftest.py
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
CHECK = ROOT / "stock" / "loops" / "check.py"
PY = sys.executable


def fail(msg: str) -> None:
    raise SystemExit(f"FAIL selftest: {msg}")


def write_video(path: Path, frames: list[np.ndarray], fps: int = 12) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    h, w, _ = frames[0].shape
    raw = np.stack([frame[..., :3] for frame in frames]).astype(np.uint8).tobytes()
    cmd = [
        "ffmpeg",
        "-y",
        "-v",
        "error",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-s",
        f"{w}x{h}",
        "-r",
        str(fps),
        "-i",
        "-",
        "-an",
        "-c:v",
        "libx264",
        "-qp",
        "0",
        "-pix_fmt",
        "yuv444p",
        str(path),
    ]
    proc = subprocess.run(cmd, input=raw, check=False, capture_output=True)
    if proc.returncode != 0:
        raise SystemExit(proc.stderr.decode()[:500])


def circle(h: int, w: int, cx: int, cy: int, radius: int) -> np.ndarray:
    ys, xs = np.mgrid[0:h, 0:w]
    blob = (ys - cy) ** 2 + (xs - cx) ** 2 <= radius ** 2
    rgb = np.zeros((h, w, 3), np.uint8)
    rgb[..., 1] = 255
    rgb[blob] = (210, 40, 36)
    return rgb


def run(registry: Path, out: Path) -> tuple[int, dict]:
    proc = subprocess.run(
        [PY, str(CHECK), "--registry", str(registry), "--out", str(out)],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    report_path = out / "report.json"
    report = json.loads(report_path.read_text(encoding="utf-8")) if report_path.is_file() else {"ok": False, "failures": [proc.stderr]}
    return proc.returncode, report


def write_registry(folder: Path, loops: list[dict]) -> Path:
    path = folder / "loops.json"
    path.write_text(json.dumps({"schema": "living-loop/1", "loops": loops}, indent=2) + "\n", encoding="utf-8")
    return path


def test_repo_empty() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        code, report = run(ROOT / "stock" / "loops" / "loops.json", Path(tmp))
    if code != 0 or not report.get("ok") or report.get("count") != 0:
        fail(f"empty registry should pass: {report}")


def test_good_and_bad() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        folder = Path(tmp)
        frames = []
        for i in range(12):
            dx = int(round(6 * np.sin(2 * np.pi * i / 12.0)))
            frames.append(circle(96, 64, 32 + dx, 48, 18))
        write_video(folder / "good.mp4", frames, fps=12)
        jump = [circle(96, 64, 24, 48, 16) for _ in range(8)]
        jump.append(circle(96, 64, 48, 48, 16))
        write_video(folder / "jump.mp4", jump, fps=12)

        reg = folder / "reg"
        reg.mkdir()
        (reg / "good.mp4").write_bytes((folder / "good.mp4").read_bytes())
        (reg / "jump.mp4").write_bytes((folder / "jump.mp4").read_bytes())
        good = write_registry(
            reg,
            [
                {
                    "id": "dust-test",
                    "file": "good.mp4",
                    "durationSec": 1,
                    "seamMAE": None,
                    "biomes": ["howling-eclipse"],
                    "role": "dust",
                    "decodeCost": {},
                }
            ],
        )
        code, report = run(good, folder / "out-good")
        if code != 0 or not report.get("ok"):
            fail("good loop failed: " + "\n".join(report.get("failures") or []))
        row = report["loops"][0]
        if row["role"] != "dust" or row["biomes"] != ["howling-eclipse"] or row["seamMAE"] is None:
            fail(f"good row missing fields: {row}")
        if "pixelsPerSec" not in row["decodeCost"]:
            fail("decode cost missing")

        missing = write_registry(
            reg,
            [
                {
                    "id": "gone",
                    "file": "missing.mp4",
                    "durationSec": 1,
                    "seamMAE": None,
                    "biomes": [],
                    "role": "mist",
                    "decodeCost": {},
                }
            ],
        )
        code, report = run(missing, folder / "out-miss")
        if code == 0 or not any("missing" in line for line in report.get("failures") or []):
            fail("missing file was accepted")

        bad = write_registry(
            reg,
            [
                {
                    "id": "jump-test",
                    "file": "jump.mp4",
                    "durationSec": 0.75,
                    "seamMAE": None,
                    "biomes": ["ember-mesa"],
                    "role": "embers",
                    "decodeCost": {},
                }
            ],
        )
        code, report = run(bad, folder / "out-jump")
        blob = "\n".join(report.get("failures") or [])
        if code == 0 or "seam" not in blob.lower() and "pop" not in blob.lower() and "frozen" not in blob.lower():
            fail(f"jump loop should fail the loop gate:\n{blob}")

        heavy = write_registry(
            reg,
            [
                {
                    "id": "dust-test",
                    "file": "good.mp4",
                    "durationSec": 1,
                    "seamMAE": None,
                    "biomes": [],
                    "role": "dust",
                    "decodeCost": {"texBytes": 60 * 1024 * 1024},
                }
            ],
        )
        code, report = run(heavy, folder / "out-heavy")
        if code == 0 or not any("decode cost" in line for line in report.get("failures") or []):
            fail("oversize decode cost was accepted")


def main() -> None:
    test_repo_empty()
    test_good_and_bad()
    print("PASS loops selftest")


if __name__ == "__main__":
    main()

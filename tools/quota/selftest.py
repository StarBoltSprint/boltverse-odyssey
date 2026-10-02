#!/usr/bin/env python3
"""Fixture ndjson: turns, tools, image, video, tokens, wall time.

  python3 tools/quota/selftest.py
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
QUOTA = ROOT / "tools" / "quota" / "quota.py"
FIXTURE = ROOT / "tools" / "quota" / "fixture" / "session.ndjson"
PY = sys.executable


def fail(msg: str) -> None:
    raise SystemExit(f"FAIL selftest: {msg}")


def test_fixture() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "quota-log.md"
        base = [PY, str(QUOTA), "--log", str(FIXTURE), "--step", "sky-slices", "--out", str(out), "--date", "2026-10-02", "--commit", "abc1234"]
        first = subprocess.run(base, cwd=ROOT, text=True, capture_output=True)
        if first.returncode != 0:
            fail(first.stderr)
        for needle in ("turns=2", "tools=2", "images=1", "videos=1", "tokens_in=100", "tokens_out=40", "wall_s=60.0"):
            if needle not in first.stdout:
                fail(f"stdout missing {needle}: {first.stdout}")
        text = out.read_text(encoding="utf-8")
        if text.count("| 2026-10-02 | sky-slices |") != 1:
            fail("row was not written once")
        if "| 2 | 2 | 1 | 1 | 100 | 40 | 60.0 |" not in text:
            fail(f"row cells wrong:\n{text}")
        second = subprocess.run(base, cwd=ROOT, text=True, capture_output=True)
        if second.returncode != 0:
            fail(second.stderr)
        again = out.read_text(encoding="utf-8")
        if again.count("| 2026-10-02 | sky-slices |") != 2:
            fail("second run did not append")
        if not again.startswith(text):
            fail("first row was rewritten")
        header, _, _rest = again.partition("| 2026-10-02 |")
        if header.count("# Quota log") != 1:
            fail("header duplicated")


def main() -> None:
    if not FIXTURE.is_file():
        fail("fixture log missing")
    test_fixture()
    print("PASS quota selftest")


if __name__ == "__main__":
    main()
